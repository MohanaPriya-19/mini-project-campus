const { haversineDistance } = require('./locationService')

const ACTIVE_STATUSES = ['Reported', 'Verified', 'Assigned', 'In Progress', 'Overdue', 'Deadline Extended', 'Reassigned', 'Unable to Resolve']
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
function normalizeLocation(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}
function findRepetitiveComplaint(candidates, { latitude, longitude, description, locationDescription }) {
  const radius = Number(process.env.REPETITIVE_COMPLAINT_RADIUS_METERS || 50)
  const threshold = Number(process.env.REPETITIVE_COMPLAINT_SIMILARITY || 0.35)
  const submittedLocation = normalizeLocation(locationDescription)
  // GPS proximity alone cannot distinguish adjacent rooms, labs, or floors.
  // Only compare reports with the same normalized human-entered room/landmark.
  if (!submittedLocation) return null
  let best = null
  for (const complaint of candidates) {
    if (normalizeLocation(complaint.locationDescription) !== submittedLocation) continue
    const distance = haversineDistance(latitude, longitude, complaint.latitude, complaint.longitude)
    const confidence = similarity(description, complaint.description)
    if (distance <= radius && confidence >= threshold && (!best || confidence > best.confidence)) best = { complaint, distance, confidence }
  }
  return best
}
module.exports = { ACTIVE_STATUSES, findRepetitiveComplaint }
