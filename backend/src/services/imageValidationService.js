/**
 * Image validation service.
 * Layer 1: technical checks (MIME, size, sharp integrity)
 * Layer 2: AI semantic similarity (pluggable provider)
 *
 * AI_ENABLED=false → skip semantic check, return neutral result
 * AI_PROVIDER=mock  → keyword-based mock (no external cost)
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { validateComplaintWithVisionModel } = require('./ollamaVisionService')

const MAX_SIZE_BYTES = parseFloat(process.env.IMAGE_MAX_SIZE_MB || '5') * 1024 * 1024
const ALLOWED_TYPES = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/jpg')
  .split(',')
  .map((t) => t.trim())

// ── Technical validation (MIME + size + sharp integrity) ──────────────────────

async function validateTechnical(file) {
  if (!file) return { valid: false, reason: 'No image file provided.' }
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return { valid: false, reason: `Image must be JPEG or PNG. Received: ${file.mimetype}` }
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, reason: `Image size must be under ${process.env.IMAGE_MAX_SIZE_MB || 5}MB.` }
  }
  // Integrity check — sharp will throw if the file is corrupt/truncated
  try {
    await sharp(file.path).metadata()
  } catch {
    return { valid: false, reason: 'The uploaded image appears to be corrupt or unreadable. Please try again.' }
  }
  return { valid: true }
}

// ── AI provider abstraction ───────────────────────────────────────────────────

// Keyword map: category → keywords that suggest relevance
const CATEGORY_KEYWORDS = {
  Water: ['water', 'leak', 'pipe', 'flood', 'tap', 'drain', 'wet', 'overflow', 'sewage', 'puddle'],
  Electrical: ['wire', 'electric', 'light', 'bulb', 'switch', 'socket', 'spark', 'power', 'fan', 'ac', 'short'],
  Infrastructure: ['wall', 'crack', 'ceiling', 'floor', 'door', 'window', 'roof', 'broken', 'damage', 'collapse', 'railing', 'step'],
  Waste: ['waste', 'garbage', 'bin', 'trash', 'litter', 'dump', 'smell', 'overflow', 'rubbish'],
  Cleanliness: ['dirty', 'clean', 'stain', 'mess', 'dust', 'mold', 'fungus', 'toilet', 'washroom', 'hygiene'],
}

const providers = {
  // Mock provider: keyword match between description and category
  mock: async (_filePath, description, category) => {
    const keywords = CATEGORY_KEYWORDS[category] || []
    const lower = description.toLowerCase()
    const matches = keywords.filter((kw) => lower.includes(kw)).length
    const total = Math.max(keywords.length, 1)
    // Score: 0.5 base + up to 0.45 from keyword matches
    const confidence = Math.min(0.95, 0.5 + (matches / total) * 0.45)
    return { isRelevant: confidence >= 0.45, confidence: parseFloat(confidence.toFixed(2)) }
  },
  // Plug in real providers here without changing any other code:
  // openai_vision: require('./providers/openaiVisionProvider'),
  // clip: require('./providers/clipProvider'),
}

function confidenceLevel(score) {
  const high = parseFloat(process.env.AI_CONFIDENCE_HIGH || '0.70')
  const low = parseFloat(process.env.AI_CONFIDENCE_LOW || '0.40')
  if (score >= high) return 'HIGH'
  if (score >= low) return 'MEDIUM'
  return 'LOW'
}

function confidenceMessage(level, category) {
  if (level === 'HIGH') return `The image appears consistent with a ${category} complaint.`
  if (level === 'MEDIUM') return `The image may be related to your ${category} complaint. It has been flagged for administrator review.`
  return `The uploaded image may not clearly match your ${category} complaint description. Please check the image or submit it for administrator review.`
}

async function validateSemantic(filePath, description, category, options = {}) {
  if (process.env.AI_ENABLED !== 'true') {
    return { valid: true, isRelevant: true, confidence: null, level: null, reason: 'AI validation is disabled.', flaggedForReview: false }
  }

  const providerName = process.env.AI_PROVIDER || 'mock'
  if (providerName === 'ollama') {
    try {
      const result = await validateComplaintWithVisionModel(filePath, description, category, options)
      return {
        ...result,
        isRelevant: result.valid,
        level: result.reviewRequired ? 'MEDIUM' : result.valid ? 'HIGH' : 'LOW',
        status: result.valid ? 'VALID' : 'INVALID',
        flaggedForReview: !result.valid || Boolean(result.reviewRequired),
        validationAvailable: true,
      }
    } catch (err) {
      console.error('[IMAGE VALIDATION] AI validation error:', err.code || 'UNKNOWN', err.message)
      return {
        valid: false,
        isRelevant: false,
        level: 'UNAVAILABLE',
        status: 'UNAVAILABLE',
        reason: err.message || 'Image verification service is unavailable.',
        errorCode: err.code || 'OLLAMA_UNAVAILABLE',
        flaggedForReview: true,
        validationAvailable: false,
      }
    }
  }
  const provider = providers[providerName]

  if (!provider) {
    console.warn(`AI provider "${providerName}" not found. Skipping semantic check.`)
    return { valid: false, isRelevant: false, confidence: null, level: 'UNAVAILABLE', status: 'UNAVAILABLE', reason: 'Uploaded image could not be validated because the image validation provider is unavailable.', flaggedForReview: true }
  }

  try {
    const result = await provider(filePath, description, category)
    const level = confidenceLevel(result.confidence)
    return {
      valid: result.isRelevant,
      isRelevant: result.isRelevant,
      confidence: result.confidence,
      level,
      status: result.isRelevant ? 'VALID' : 'INVALID',
      reason: confidenceMessage(level, category),
      flaggedForReview: level !== 'HIGH',
    }
  } catch (err) {
    console.error('AI validation error:', err.message)
    return { valid: false, isRelevant: false, confidence: null, level: 'UNAVAILABLE', status: 'UNAVAILABLE', reason: 'Uploaded image could not be validated because the image validation service is unavailable.', flaggedForReview: true }
  }
}

module.exports = { validateTechnical, validateSemantic }
