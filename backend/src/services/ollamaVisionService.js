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

function parseJson(content) {
  const text = String(content || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Vision model did not return JSON')
  const value = JSON.parse(match[0])
  // The public contract intentionally uses descriptive snake_case names.  The
  // camelCase fallback keeps one installed model response from breaking an
  // in-flight request while the stricter prompt takes effect.
  const normalized = {
    // qwen2.5vl:3b abbreviates this key to image_re in some JSON-mode
    // responses. It remains a required boolean; this is not a default-true
    // fallback and therefore cannot bypass relevance validation.
    imageRelevant: value.image_relevant ?? value.image_re ?? value.image_valid ?? value.imageValid ?? value.is_relevant ?? value.isRelevant,
    categoryMatch: value.category_match ?? value.category_relevant ?? value.categoryValid ?? value.categoryMatch,
    descriptionMatch: value.description_match ?? value.description_relevant ?? value.image_description_match ?? value.imageDescriptionMatch,
    descriptionValid: value.description_valid ?? value.descriptionValid ?? value.description_match ?? value.description_relevant ?? value.image_description_match ?? value.imageDescriptionMatch,
    confidence: value.confidence ?? value.score,
    evidence: value.observed_issue ?? value.evidence,
    visibleDefect: value.visible_defect ?? value.visibleDefect ?? value.observed_defect,
    reason: value.reason,
  }
  for (const field of ['imageRelevant', 'categoryMatch', 'descriptionMatch', 'descriptionValid']) {
    if (typeof normalized[field] !== 'boolean') {
      console.warn('[IMAGE VALIDATION] incomplete model response fields:', Object.keys(value).sort().join(', '))
      throw new Error('Vision model returned an incomplete validation result')
    }
  }
  if (typeof normalized.confidence !== 'number' || !Number.isFinite(normalized.confidence) || normalized.confidence < 0 || normalized.confidence > 1) {
    throw new Error('Vision model returned an invalid confidence score')
  }
  if (typeof normalized.evidence !== 'string' || normalized.evidence.trim().length < 3) {
    throw new Error('Vision model returned no visual evidence')
  }
  if (typeof normalized.reason !== 'string' || !normalized.reason.trim()) throw new Error('Vision model returned no reason')
  if (normalized.imageRelevant && (typeof normalized.visibleDefect !== 'string' || normalized.visibleDefect.trim().length < 3)) {
    throw new Error('Vision model approved an image without identifying a visible defect')
  }
  const valid = normalized.imageRelevant && normalized.descriptionValid && normalized.descriptionMatch && normalized.categoryMatch && normalized.confidence >= 0.8
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
  if (/\b(not|unrelated|does not|doesn't|mismatch|selfie|food|animal|scenery|document|logo)\b/i.test(`${result.reason} ${result.evidence}`) && result.valid) {
    result.valid = false
    result.imageDescriptionMatch = false
    result.categoryMatch = false
    result.reason = 'The uploaded image does not appear to match the reported issue. Please upload a relevant image and provide an accurate description.'
  }
  return result
}

function buildPrompt(category, description, retry, purpose = 'complaint', review = false) {
  const proofInstructions = purpose === 'resolution'
    ? 'This is a RESOLUTION PROOF photo. Approve only if the image visibly shows a completed repair, replacement, or corrected condition that is relevant to the assigned category and the staff resolution note. A generic, unrelated, blurry, before-repair, or empty photo is invalid.'
    : 'This is a COMPLAINT photo. Approve only if the image visibly shows the reported maintenance fault.'
  return `You are ${review ? 'an adversarial second reviewer' : 'the final strict validator'} for a campus maintenance complaint. Inspect the ACTUAL image; never infer a fault from the student's text. Selected category: ${category}. Student description: ${JSON.stringify(description)}.

${proofInstructions} Set image_relevant=true ONLY when the image visibly supports this request. Set category_match=true ONLY if the visible subject belongs to the selected category. Set description_match=true ONLY if the visible subject supports the supplied description. For Water the image must visibly show a pipe, tap, drain, leak, wet area, overflow, or water damage. For Electrical it must visibly show wiring, a switch, outlet, light, fan, electrical panel, or physically damaged electrical/lab equipment. For Infrastructure it must visibly show a building fixture or structural defect. For Waste it must visibly show garbage, bin overflow, or litter. For Cleanliness it must visibly show dirt, stains, washroom hygiene, or unsanitary conditions. A screen, logo, document, selfie, person, scenery, ordinary object, unclear photo, or an image without visible evidence is invalid. If uncertain, set all match fields false. A plausible description alone is never evidence. ${review ? 'Reject unless the visual defect is unmistakable and specifically supports BOTH category and description.' : ''}

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
    Electrical: /\b(wire|cable|switch|socket|outlet|bulb|light|fan|electrical|keyboard|computer|laptop|monitor|plug|panel)/,
    Infrastructure: /\b(wall|ceiling|floor|door|window|roof|railing|stair|step|chair|desk|table|building|crack|tile)/,
    Waste: /\b(waste|garbage|trash|rubbish|litter|bin|dump)/,
    Cleanliness: /\b(dirt|dirty|stain|dust|toilet|washroom|hygiene|mold|fungus|mess|unclean)/,
  }
  return anchors[category]?.test(inventory) || false
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
  let parsed
  try {
    parsed = parseJson(await requestVision(baseUrl, model, image, buildPrompt(category, description, false, options.purpose)))
  } catch (error) {
    if (error.code === 'OLLAMA_UNAVAILABLE' || error.code === 'OLLAMA_TIMEOUT') throw error
    // Qwen occasionally wraps or omits a structured field. Retry exactly once
    // with an explicit type reminder. A network/service failure still fails
    // closed instead of accepting an unchecked complaint.
    console.warn('[IMAGE_VALIDATION] initial vision response unusable:', error.message)
    try {
      parsed = parseJson(await requestVision(baseUrl, model, image, buildPrompt(category, description, true, options.purpose)))
    } catch (retryError) {
      console.error('[IMAGE VALIDATION] vision validation unavailable:', retryError.message)
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
      reviewer = parseJson(await requestVision(baseUrl, model, image, buildPrompt(category, description, false, options.purpose, true)))
    } catch (error) {
      console.warn('[IMAGE VALIDATION] second review unavailable:', error.message)
      return invalid('The uploaded image could not be verified with sufficient confidence. Please upload a clearer, relevant image.')
    }
    if (!reviewer.valid) {
      console.log('[IMAGE VALIDATION] second review rejected image')
      return { ...reviewer, reason: reviewer.reason || 'The uploaded image does not clearly match the reported issue.' }
    }
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
