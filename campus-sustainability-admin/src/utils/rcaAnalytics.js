import { STATUS } from '../data/mockComplaints'

// FR-11: Root Cause Analysis — group complaints by location + category and
// flag ones that recur at or above a (configurable) threshold. Crossing the
// threshold flips the recommendation from "Repair" to "Replace".
export function computeRecurringLocations(complaints, threshold = 3) {
  const groups = new Map()

  complaints.forEach((c) => {
    const key = `${c.location}__${c.category}`
    if (!groups.has(key)) {
      groups.set(key, { location: c.location, category: c.category, occurrences: [] })
    }
    groups.get(key).occurrences.push(c)
  })

  return Array.from(groups.values())
    .filter((g) => g.occurrences.length >= 2) // recurring at all, worth surfacing
    .map((g) => {
      const sorted = [...g.occurrences].sort((a, b) => new Date(a.reportedAt) - new Date(b.reportedAt))
      const count = sorted.length
      const resolvedOccurrences = sorted.filter((c) => c.status === STATUS.RESOLVED)
      const hasRepeatedAfterResolution = resolvedOccurrences.some((resolved) =>
        sorted.some((candidate) => new Date(candidate.reportedAt) > new Date(resolved.resolvedAt || resolved.reportedAt))
      )
      const requiresReplacement = count >= threshold && hasRepeatedAfterResolution
      const replacementTarget = {
        Water: 'leaking pipe or water fixture',
        Electrical: 'faulty electrical component',
        Infrastructure: 'damaged infrastructure component',
        Waste: 'waste handling fixture',
        Cleanliness: 'affected facility fixture',
      }[g.category] || 'affected component'
      return {
        location: g.location,
        category: g.category,
        count,
        resolvedCount: resolvedOccurrences.length,
        repeatedAfterResolution: hasRepeatedAfterResolution,
        recommendation: requiresReplacement
          ? `Replace the ${replacementTarget}; it keeps recurring after resolution. Do not repair it again.`
          : count >= threshold
          ? 'Inspect the root cause before another repair; no post-resolution repeat has been recorded yet.'
          : 'Repair and monitor for recurrence.',
        action: requiresReplacement ? 'Replace' : 'Repair',
        crossedThreshold: requiresReplacement,
        complaintIds: sorted.map((c) => c.id),
        firstReportedAt: sorted[0].reportedAt,
        lastReportedAt: sorted[sorted.length - 1].reportedAt,
      }
    })
    .sort((a, b) => b.count - a.count)
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
