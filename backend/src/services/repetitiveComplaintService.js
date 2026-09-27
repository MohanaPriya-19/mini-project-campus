const { haversineDistance } = require('./locationService')

const ACTIVE_STATUSES = ['Verified', 'Assigned', 'In Progress', 'Overdue', 'Deadline Extended']
const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'at', 'in', 'on', 'near', 'to', 'of', 'and', 'for', 'with', 'please', 'there', 'has', 'have'])

function words(text = '') {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)))
}
function similarity(a, b) {
  const left = words(a); const right = words(b)
  const union = new Set([...left, ...right])
  if (!union.size) return 0
  return [...left].filter((word) => right.has(word)).length / union.size
}
function findRepetitiveComplaint(candidates, { latitude, longitude, description }) {
  const radius = Number(process.env.REPETITIVE_COMPLAINT_RADIUS_METERS || 50)
  const threshold = Number(process.env.REPETITIVE_COMPLAINT_SIMILARITY || 0.35)
  let best = null
  for (const complaint of candidates) {
    const distance = haversineDistance(latitude, longitude, complaint.latitude, complaint.longitude)
    const confidence = similarity(description, complaint.description)
    if (distance <= radius && confidence >= threshold && (!best || confidence > best.confidence)) best = { complaint, distance, confidence }
  }
  return best
}
module.exports = { ACTIVE_STATUSES, findRepetitiveComplaint }
