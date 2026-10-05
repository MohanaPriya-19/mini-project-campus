import { STATUS } from '../data/mockComplaints'

// FR-11: Root Cause Analysis — group complaints by location + category and
// flag ones that recur at or above a (configurable) threshold. Crossing the
// threshold flips the recommendation from "Repair" to "Replace".
export function computeRecurringLocations(complaints, threshold = 3) {
  const locationGroups = new Map()

  complaints.filter((complaint) => !complaint.duplicateSuppressed).forEach((c) => {
    const locationKey = String(c.location || '').trim().toLowerCase().replace(/\s+/g, ' ')
    const categoryKey = String(c.category || '').trim().toLowerCase()
    const key = `${locationKey}__${categoryKey}`
    if (!locationGroups.has(key)) {
      locationGroups.set(key, { location: c.location, category: c.category, occurrences: [] })
    }
    locationGroups.get(key).occurrences.push(c)
  })

  const groups = Array.from(locationGroups.values()).flatMap((locationGroup) => {
    const issueGroups = []
    locationGroup.occurrences.forEach((complaint) => {
      const matchingGroup = issueGroups.find((group) => group.occurrences.some((existing) => descriptionsMatch(existing.description, complaint.description)))
      if (matchingGroup) matchingGroup.occurrences.push(complaint)
      else issueGroups.push({ ...locationGroup, occurrences: [complaint] })
    })
    return issueGroups
  })

  return groups
    .filter((g) => g.occurrences.length >= 2) // recurring at all, worth surfacing
    .map((g) => {
      const sorted = [...g.occurrences].sort((a, b) => new Date(a.reportedAt) - new Date(b.reportedAt))
      const count = sorted.length
      const resolvedOccurrences = sorted.filter((c) => c.status === STATUS.RESOLVED)
      const hasRepeatedAfterResolution = resolvedOccurrences.some((resolved) =>
        sorted.some((candidate) => new Date(candidate.reportedAt) > new Date(resolved.resolvedAt || resolved.reportedAt))
      )
      const requiresReplacement = count >= threshold && hasRepeatedAfterResolution
      const issueText = sorted.map((c) => c.description || '').join(' ').toLowerCase()
      const replacementTarget = replacementTargetFor(g.category, issueText)
      return {
        location: g.location,
        category: g.category,
        count,
        resolvedCount: resolvedOccurrences.length,
        repeatedAfterResolution: hasRepeatedAfterResolution,
        recommendation: requiresReplacement
          ? `Replace the ${replacementTarget}; it recurred after resolution and reached ${count} reports. Do not repeat the same repair.`
          : count >= threshold
          ? 'Inspect the root cause before another repair; no post-resolution repeat has been recorded yet.'
          : 'Repair and monitor for recurrence.',
        action: requiresReplacement ? 'Replace' : 'Repair',
        crossedThreshold: requiresReplacement,
        complaintIds: sorted.map((c) => c.id),
        occurrences: sorted.map((c) => ({
          id: c.id,
          description: c.description || '',
          photoUrl: c.photoUrl || null,
          status: c.status,
          reportedAt: c.reportedAt,
        })),
        firstReportedAt: sorted[0].reportedAt,
        lastReportedAt: sorted[sorted.length - 1].reportedAt,
      }
    })
    .sort((a, b) => b.count - a.count)
}

const DESCRIPTION_STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'near', 'from', 'this', 'that', 'there', 'issue', 'problem', 'reported', 'same', 'again'])
function descriptionWords(value = '') {
  return new Set(String(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !DESCRIPTION_STOP_WORDS.has(word)))
}
function descriptionsMatch(left, right) {
  const a = descriptionWords(left)
  const b = descriptionWords(right)
  if (!a.size || !b.size) return false
  const shared = [...a].filter((word) => b.has(word)).length
  return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.25
}

function replacementTargetFor(category, description) {
  const rules = {
    Water: [
      [/pipe|joint|plumbing|sewage/, 'pipe or plumbing joint'],
      [/tap|faucet|valve|shower/, 'water fixture or valve'],
      [/drain|block|overflow/, 'drainage component'],
      [/tank|pump|motor/, 'water tank or pump component'],
    ],
    Electrical: [
      [/wire|wiring|short circuit|spark/, 'damaged wiring or circuit component'],
      [/switch|socket|outlet/, 'electrical switch or outlet'],
      [/light|bulb|lamp/, 'lighting fixture'],
      [/fan|motor|ac|air conditioner/, 'electrical motor or appliance component'],
    ],
    Infrastructure: [
      [/crack|wall|ceiling|beam|column/, 'affected structural section'],
      [/door|window|hinge|frame/, 'damaged door or window fixture'],
      [/floor|tile|step|stair|railing/, 'damaged flooring or safety fixture'],
      [/roof|waterproof|seepage/, 'roofing or waterproofing section'],
    ],
    Waste: [
      [/bin|container|dumpster/, 'waste bin or container'],
      [/drain|overflow|sewage/, 'waste drainage component'],
    ],
    Cleanliness: [
      [/toilet|washroom|restroom|urinal/, 'affected washroom fixture'],
      [/mold|fungus|damp|seepage/, 'affected damp or mold-damaged surface'],
    ],
  }
  const match = (rules[category] || []).find(([pattern]) => pattern.test(description))
  if (match) return match[1]
  return ({
    Water: 'affected water system component',
    Electrical: 'affected electrical component',
    Infrastructure: 'affected infrastructure component',
    Waste: 'affected waste handling component',
    Cleanliness: 'affected facility fixture or surface',
  })[category] || 'affected component'
}

// FR-12: resolution-time analytics, in hours, only over complaints that
// have actually been resolved.
export function computeResolutionStats(complaints) {
  const resolved = complaints.filter((c) => c.status === STATUS.RESOLVED && c.resolvedAt)
  if (resolved.length === 0) return { count: 0, avgHours: 0, minHours: 0, maxHours: 0 }

  const hoursList = resolved.map(
    (c) => (new Date(c.resolvedAt) - new Date(c.reportedAt)) / (1000 * 60 * 60)
  )
  const avgHours = hoursList.reduce((a, b) => a + b, 0) / hoursList.length

  return {
    count: resolved.length,
    avgHours: Math.round(avgHours * 10) / 10,
    minHours: Math.round(Math.min(...hoursList) * 10) / 10,
    maxHours: Math.round(Math.max(...hoursList) * 10) / 10,
  }
}

// FR-12: staff performance — resolved count and SLA breach rate per staff
// member, computed only from tasks that were actually assigned to them.
export function computeStaffPerformance(complaints, staff) {
  return staff.map((s) => {
    const assigned = complaints.filter((c) => c.assignedTo === s.id)
    const resolved = assigned.filter((c) => c.status === STATUS.RESOLVED)
    const breached = assigned.filter(
      (c) => c.deadline && c.resolvedAt && new Date(c.resolvedAt) > new Date(c.deadline)
    )
    const openBreached = assigned.filter(
      (c) =>
        c.deadline &&
        !c.resolvedAt &&
        new Date(c.deadline) < new Date() &&
        c.status !== STATUS.REJECTED
    )
    const totalBreaches = breached.length + openBreached.length

    return {
      id: s.id,
      name: s.name,
      assignedCount: assigned.length,
      resolvedCount: resolved.length,
      breachRate: assigned.length ? Math.round((totalBreaches / assigned.length) * 100) : 0,
    }
  })
}

export function exportRowsAsCsv(filename, headers, rows) {
  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(',')]
  rows.forEach((row) => lines.push(row.map(escape).join(',')))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
