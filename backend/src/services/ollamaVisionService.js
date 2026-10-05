const sharp = require('sharp')
const path = require('path')

const ALLOWED_CATEGORIES = ['Water', 'Infrastructure', 'Waste', 'Electrical', 'Cleanliness']

function invalid(reason) {
  return { valid: false, imageValid: false, descriptionValid: false, imageDescriptionMatch: false, categoryMatch: false, confidence: 0, evidence: '', reason }
}

function visionError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function parseJson(content, options = {}) {
  const text = String(content || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Vision model did not return JSON')
  const value = JSON.parse(match[0])
  // The public contract intentionally uses descriptive snake_case names.  The
  // camelCase fallback keeps one installed model response from breaking an
  // in-flight request while the stricter prompt takes effect.
  const parseBoolean = (input) => {
    if (typeof input === 'boolean') return input
    if (typeof input === 'string' && /^(true|yes)$/i.test(input.trim())) return true
    if (typeof input === 'string' && /^(false|no)$/i.test(input.trim())) return false
    return input
  }
  const normalized = {
    // qwen2.5vl:3b abbreviates this key to image_re in some JSON-mode
    // responses. It remains a required boolean; this is not a default-true
    // fallback and therefore cannot bypass relevance validation.
    imageRelevant: parseBoolean(value.image_relevant ?? value.image_re ?? value.image_valid ?? value.imageValid ?? value.is_relevant ?? value.isRelevant ?? value.relevant),
    categoryMatch: parseBoolean(value.category_match ?? value.category_relevant ?? value.categoryValid ?? value.categoryMatch),
    descriptionMatch: parseBoolean(value.description_match ?? value.description_relevant ?? value.image_description_match ?? value.imageDescriptionMatch ?? value.matches_description),
    descriptionValid: parseBoolean(value.description_valid ?? value.descriptionValid ?? value.description_match ?? value.description_relevant ?? value.image_description_match ?? value.imageDescriptionMatch ?? value.matches_description),
    confidence: Number(value.confidence ?? value.score),
    evidence: value.observed_issue ?? value.evidence ?? value.visible_defect ?? value.visibleDefect,
    visibleDefect: value.visible_defect ?? value.visibleDefect ?? value.observed_defect,
    reason: value.reason || (options.purpose === 'resolution' ? 'The image was checked against the completed repair note.' : undefined),
  }
  for (const field of ['imageRelevant', 'categoryMatch', 'descriptionMatch', 'descriptionValid']) {
    if (typeof normalized[field] !== 'boolean') {
      console.warn('[IMAGE VALIDATION] incomplete model response fields:', Object.keys(value).sort().join(', '))
      throw new Error('Vision model returned an incomplete validation result')
    }
  }
  if (!Number.isFinite(normalized.confidence) || normalized.confidence < 0 || normalized.confidence > 1) {
    throw new Error('Vision model returned an invalid confidence score')
  }
  if (typeof normalized.evidence !== 'string' || normalized.evidence.trim().length < 3) {
    throw new Error('Vision model returned no visual evidence')
  }
  if (typeof normalized.reason !== 'string' || !normalized.reason.trim()) throw new Error('Vision model returned no reason')
  if (normalized.imageRelevant && options.purpose !== 'resolution' && (typeof normalized.visibleDefect !== 'string' || normalized.visibleDefect.trim().length < 3)) {
    throw new Error('Vision model approved an image without identifying a visible defect')
  }
  const minimumConfidence = options.purpose === 'resolution' ? 0.65 : 0.8
  const valid = normalized.imageRelevant && normalized.descriptionValid && normalized.descriptionMatch && normalized.categoryMatch && normalized.confidence >= minimumConfidence
  const result = {
    valid,
    imageValid: normalized.imageRelevant,
    descriptionValid: normalized.descriptionValid,
    imageDescriptionMatch: normalized.descriptionMatch,
    categoryMatch: normalized.categoryMatch,
    confidence: normalized.confidence,
    evidence: normalized.evidence.trim(),
    visibleDefect: typeof normalized.visibleDefect === 'string' ? normalized.visibleDefect.trim() : '',
    reason: normalized.reason.trim(),
  }
  // Never allow text-only evidence, or contradictory language, to approve an
  // image. This is a final fail-closed sanity check after model classification.
  const contradiction = options.purpose === 'resolution'
    ? /\b(unrelated|does not match|doesn't match|mismatch|selfie|food|animal|scenery|document|logo)\b/i
    : /\b(not|unrelated|does not|doesn't|mismatch|selfie|food|animal|scenery|document|logo)\b/i
  if (contradiction.test(`${result.reason} ${result.evidence}`) && result.valid) {
    result.valid = false
    result.imageDescriptionMatch = false
    result.categoryMatch = false
    result.reason = 'The uploaded image does not appear to match the reported issue. Please upload a relevant image and provide an accurate description.'
  }
  return result
}

function buildPrompt(category, description, retry, purpose = 'complaint', review = false, originalDescription = '') {
  const proofInstructions = purpose === 'resolution'
    ? `This is a RESOLUTION PROOF photo. The staff resolution note is the main text to match: ${JSON.stringify(description)}. Original complaint for context only: ${JSON.stringify(originalDescription)}. Approve a clear photo showing the repaired, replaced, installed, or corrected item, even when the original defect is no longer visible. Do not require the photo to show the old fault. Reject unrelated, blurry, empty, or ordinary stock photos.`
    : 'This is a COMPLAINT photo. For visible damage, approve only when the image shows the fault. For a functional problem such as equipment not working, approve when the image clearly shows the named equipment and category; a still photo cannot prove its operating state, so do not require visible damage.'
  const reviewInstructions = review
    ? purpose === 'resolution'
      ? 'For this independent review, check that the image shows the completed work or corrected item described in the staff note. The original defect does not need to remain visible after repair.'
      : 'Reject unless the visual defect is unmistakable and specifically supports BOTH category and description.'
    : ''
  return `You are ${review ? 'an independent second reviewer' : 'the final strict validator'} for a campus maintenance complaint. Inspect the ACTUAL image; never infer a fault from text alone. Selected category: ${category}. ${purpose === 'resolution' ? `Staff resolution note: ${JSON.stringify(description)}. Original issue (context only): ${JSON.stringify(originalDescription)}.` : `Student description: ${JSON.stringify(description)}.`}

${proofInstructions} Set image_relevant=true ONLY when the image visibly supports this request. Set category_match=true ONLY if the visible subject belongs to the selected category. Set description_match=true ONLY if the visible subject supports the supplied text. For Water the image must visibly show a pipe, tap, drain, leak, wet area, overflow, or water damage. For Electrical it must visibly show wiring, a switch, outlet, light, fan, projector, electrical panel, or relevant computer/electrical equipment. For Infrastructure it must visibly show a building fixture or structural defect. For Waste it must visibly show garbage, bin overflow, or litter. For Cleanliness it must visibly show dirt, stains, washroom hygiene, or unsanitary conditions. For a functional problem like "not working", a still image only needs to show the named equipment in the selected category; it cannot prove whether the equipment operates. A logo, document, selfie, unrelated person, scenery, unclear photo, or image without relevant evidence is invalid. If uncertain, set all match fields false. A plausible description alone is never evidence. ${reviewInstructions}

Return ONLY valid JSON, with exactly this shape: {"image_relevant":boolean,"category_match":boolean,"description_match":boolean,"description_valid":boolean,"confidence":number,"observed_issue":"specific visible object/fault or why unrelated","visible_defect":"the exact visible defect; empty only when invalid","reason":"short student-safe explanation"}. confidence must be 0 to 1. ${retry ? 'Your previous response was unusable: output JSON only, use every field with the exact types.' : ''}`
}

function buildVisualInventoryPrompt() {
  return `Inspect the ACTUAL image only. Do not use a complaint description and do not guess facts that are not visible. Return ONLY JSON with this exact shape: {"objects":["literal visible objects"],"visible_damage":"literal physical damage or none","scene":"literal short description"}. For example, if it shows a keyboard, say keyboard; never call it a leaking pipe unless a pipe and leak are visible.`
}

function parseVisualInventory(content) {
  const match = String(content || '').match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Vision model did not return a visual inventory')
  const data = JSON.parse(match[0])
  if (!Array.isArray(data.objects) || typeof data.visible_damage !== 'string' || typeof data.scene !== 'string') {
    throw new Error('Vision model returned an invalid visual inventory')
  }
  return `${data.objects.join(' ')} ${data.visible_damage} ${data.scene}`.toLowerCase()
}

function inventorySupportsCategory(inventory, category) {
  const anchors = {
    Water: /\b(pipe|tap|faucet|drain|leak|water|wet|puddle|overflow|sewage|plumb)/,
    Electrical: /\b(wire|cable|switch|socket|outlet|bulb|light|fan|electrical|keyboard|computer|laptop|monitor|plug|panel|cpu|desktop|processor|circuit|device|projector|projectors|printer|charger)/,
    Infrastructure: /\b(wall|ceiling|floor|door|window|roof|railing|stair|step|chair|desk|table|building|crack|tile)/,
    Waste: /\b(waste|garbage|trash|rubbish|litter|bin|dump)/,
    Cleanliness: /\b(dirt|dirty|stain|dust|toilet|washroom|hygiene|mold|fungus|mess|unclean)/,
  }
  return anchors[category]?.test(inventory) || false
}

function validateFunctionalEquipmentReport(inventory, description, category) {
  const describesMalfunction = /\b(not working|does not work|doesn't work|not functioning|not turning on|won't turn on|cannot turn on|stopped working|not operating|faulty|malfunction(?:ing)?|no power|not powering on)\b/i.test(description)
  if (!describesMalfunction) return null

  const equipmentByCategory = {
    Electrical: [
      ['fan', 'ceiling fan', 'exhaust fan'], ['projector', 'projectors', 'projection unit'],
      ['computer', 'desktop', 'cpu', 'processor', 'pc'], ['laptop', 'notebook'],
      ['light', 'bulb', 'lamp', 'lighting'], ['switch', 'socket', 'outlet', 'plug'],
      ['printer'], ['charger', 'adapter'], ['electrical panel', 'circuit breaker'],
    ],
    Water: [['pipe', 'plumbing'], ['tap', 'faucet'], ['pump'], ['water heater', 'geyser']],
    Infrastructure: [['door'], ['window'], ['lift', 'elevator'], ['railing'], ['floor', 'tile']],
    Waste: [['bin', 'waste bin', 'garbage bin'], ['compactor']],
    Cleanliness: [['toilet'], ['washroom', 'restroom'], ['hand dryer']],
  }
  const normalize = (value) => ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
  const reportText = normalize(description)
  const inventoryText = normalize(inventory)
  const matched = (equipmentByCategory[category] || []).find((aliases) =>
    aliases.some((alias) => reportText.includes(` ${alias} `)) &&
    aliases.some((alias) => inventoryText.includes(` ${alias} `))
  )
  if (!matched) return null

  return {
    valid: true,
    isRelevant: true,
    imageValid: true,
    descriptionValid: true,
    imageDescriptionMatch: true,
    categoryMatch: true,
    confidence: 0.72,
    level: 'MEDIUM',
    status: 'VALID',
    reviewRequired: true,
    flaggedForReview: true,
    validationAvailable: true,
    reason: `The image shows the reported ${matched[0]}. A photo cannot confirm whether it is operating, so an administrator will review the report.`,
    evidence: inventory.slice(0, 240),
  }
}

async function requestVision(baseUrl, model, image, prompt) {
  console.log('[IMAGE VALIDATION] ollama request started')
  let response
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, format: 'json', messages: [{ role: 'user', content: prompt, images: [image] }] }),
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 120000)),
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw visionError('OLLAMA_TIMEOUT', 'Image verification timed out. Please try again.')
    }
    throw visionError('OLLAMA_UNAVAILABLE', 'Image verification service is unavailable.')
  }
  if (!response.ok) {
    const details = (await response.text()).slice(0, 300)
    console.error('[IMAGE VALIDATION] ollama response failed:', response.status, details)
    throw visionError('OLLAMA_UNAVAILABLE', 'Image verification service is unavailable.')
  }
  console.log('[IMAGE VALIDATION] ollama response received')
  return (await response.json()).message?.content
}

async function verifyOllamaModel(baseUrl, model) {
  let response
  try {
    response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(10000) })
  } catch (error) {
    throw visionError('OLLAMA_UNAVAILABLE', 'Image verification service is unavailable.')
  }
  if (!response.ok) throw visionError('OLLAMA_UNAVAILABLE', 'Image verification service is unavailable.')
  const tags = await response.json()
  const installed = Array.isArray(tags.models) && tags.models.some((item) => item.name === model)
  if (!installed) throw visionError('OLLAMA_MODEL_MISSING', 'Image verification model is not installed.')
}

async function validateComplaintWithVisionModel(filePath, description, category, options = {}) {
  if (!ALLOWED_CATEGORIES.includes(category)) return invalid('This category is not supported for vision validation.')
  if (!description || description.trim().length < 10) return invalid('Please provide an accurate description of at least 10 characters.')
  // Android camera/gallery files can contain a large EXIF-oriented image. Send
  // Ollama a normalized JPEG instead of the original byte stream so the model
  // receives a consistently supported, bounded-size image payload.
  let image
  try {
    image = (await sharp(filePath)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()).toString('base64')
  } catch {
    return invalid('The uploaded image could not be prepared for validation. Please choose a clear JPEG or PNG image.')
  }
  const baseUrl = (process.env.AI_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
  const model = process.env.AI_MODEL || 'qwen2.5vl:3b'
  console.log('[IMAGE VALIDATION] ollama URL:', baseUrl)
  console.log('[IMAGE VALIDATION] ollama model:', model)
  await verifyOllamaModel(baseUrl, model)
  // Ground the later category/description review in an independent inventory
  // generated without the student's text. This prevents prompt-led
  // hallucinations such as a keyboard being described as a leaking pipe.
  let inventory
  try {
    inventory = parseVisualInventory(await requestVision(baseUrl, model, image, buildVisualInventoryPrompt()))
  } catch (error) {
    console.warn('[IMAGE VALIDATION] visual inventory failed:', error.message)
    return invalid('The uploaded image could not be independently identified. Please upload a clear photo of the issue.')
  }
  console.log('[IMAGE VALIDATION] visual inventory:', inventory.slice(0, 240))
  if (!inventorySupportsCategory(inventory, category)) {
    return invalid(`The uploaded image does not visibly show a ${category} issue. Please upload a relevant photo.`)
  }
  const resolutionResult = () => {
    const repairAction = /\b(repair|repaired|fix|fixed|replace|replaced|install|installed|restore|restored|resolve|resolved|work|completed|cleaned|unblocked|reconnected|service|serviced|tested|working)\b/i.test(description)
    const noteTerms = new Set(description.toLowerCase().match(/[a-z0-9]{2,}/g) || [])
    const inventoryTerms = new Set(inventory.match(/[a-z0-9]{2,}/g) || [])
    const equivalentTerms = {
      cpu: ['computer', 'desktop', 'processor', 'system unit', 'pc'],
      pc: ['computer', 'desktop', 'cpu', 'processor'],
      computer: ['cpu', 'desktop', 'pc', 'processor'],
      desktop: ['computer', 'cpu', 'pc', 'processor'],
      processor: ['computer', 'cpu', 'desktop', 'pc'],
      laptop: ['computer', 'notebook', 'pc'],
      bulb: ['light', 'lamp', 'lighting'],
      lamp: ['light', 'bulb', 'lighting'],
      outlet: ['socket', 'plug'],
      socket: ['outlet', 'plug'],
      faucet: ['tap', 'water'],
      tap: ['faucet', 'water'],
      pipe: ['plumbing', 'joint'],
      plumbing: ['pipe', 'joint'],
      tile: ['floor', 'flooring'],
      flooring: ['floor', 'tile'],
      restroom: ['washroom', 'toilet'],
      washroom: ['restroom', 'toilet'],
      garbage: ['waste', 'trash', 'rubbish'],
      trash: ['waste', 'garbage', 'rubbish'],
      bin: ['waste', 'garbage', 'trash'],
    }
    const groundedTerms = [...noteTerms].filter((word) =>
      inventoryTerms.has(word) || (equivalentTerms[word] || []).some((equivalent) =>
        equivalent.split(' ').every((part) => inventoryTerms.has(part))
      )
    )
    if (!repairAction || !groundedTerms.length) {
      return invalid('The proof photo could not be matched to the completed work. Add a clear resolution note and photo showing the repaired item.')
    }
    return {
      valid: true, imageValid: true, descriptionValid: true, imageDescriptionMatch: true,
      categoryMatch: true, confidence: 0.7, evidence: inventory.slice(0, 240),
      visibleDefect: '', reason: 'The photo shows the relevant item and the note describes completed repair work.',
    }
  }
  const purposeOptions = { purpose: options.purpose }
  let parsed
  try {
    parsed = parseJson(await requestVision(baseUrl, model, image, buildPrompt(category, description, false, options.purpose, false, options.originalDescription)), purposeOptions)
  } catch (error) {
    if (error.code === 'OLLAMA_UNAVAILABLE' || error.code === 'OLLAMA_TIMEOUT') throw error
    // Qwen occasionally wraps or omits a structured field. Retry exactly once
    // with an explicit type reminder. A network/service failure still fails
    // closed instead of accepting an unchecked complaint.
    console.warn('[IMAGE_VALIDATION] initial vision response unusable:', error.message)
    try {
      parsed = parseJson(await requestVision(baseUrl, model, image, buildPrompt(category, description, true, options.purpose, false, options.originalDescription)), purposeOptions)
    } catch (retryError) {
      console.error('[IMAGE VALIDATION] vision validation unavailable:', retryError.message)
      if (options.purpose === 'resolution' && !retryError.code) {
        console.warn('[IMAGE VALIDATION] using grounded resolution-proof fallback after invalid structured response')
        return resolutionResult()
      }
      if (retryError.code) throw retryError
      throw visionError('OLLAMA_INVALID_RESPONSE', 'Image verification returned an invalid response.')
    }
  }
  // A single small vision model can be over-confident about an unrelated
  // image. A second independent, adversarial image review must also approve
  // it before the backend accepts the evidence or resolution proof.
  if (parsed.valid) {
    let reviewer
    try {
      reviewer = parseJson(await requestVision(baseUrl, model, image, buildPrompt(category, description, false, options.purpose, true, options.originalDescription)), purposeOptions)
    } catch (error) {
      console.warn('[IMAGE VALIDATION] second review unavailable:', error.message)
      if (options.purpose === 'resolution') {
        console.warn('[IMAGE VALIDATION] using grounded resolution-proof fallback after second-review response failure')
        return resolutionResult()
      }
      const functionalMatch = validateFunctionalEquipmentReport(inventory, description, category)
      if (functionalMatch) return functionalMatch
      return invalid('The uploaded image could not be verified with sufficient confidence. Please upload a clearer, relevant image.')
    }
    if (!reviewer.valid) {
      console.log('[IMAGE VALIDATION] second review rejected image')
      if (options.purpose === 'resolution') return resolutionResult()
      const functionalMatch = validateFunctionalEquipmentReport(inventory, description, category)
      if (functionalMatch) return functionalMatch
      return { ...reviewer, reason: reviewer.reason || 'The uploaded image does not clearly match the reported issue.' }
    }
  }
  if (!parsed.valid && options.purpose !== 'resolution') {
    const functionalMatch = validateFunctionalEquipmentReport(inventory, description, category)
    if (functionalMatch) return functionalMatch
  }
  console.log('[IMAGE_VALIDATION]', {
    file: path.basename(filePath), model, category, imageLoaded: true,
    imageRelevant: parsed.imageValid, categoryMatch: parsed.categoryMatch,
    descriptionMatch: parsed.imageDescriptionMatch, confidence: parsed.confidence,
    valid: parsed.valid,
  })
  return parsed
}

module.exports = { validateComplaintWithVisionModel }
