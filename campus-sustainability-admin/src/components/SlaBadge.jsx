import { isBreached } from '../context/ComplaintsContext'

function formatDeadline(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// FR-10: surfaces the SLA deadline and flags a breach wherever a task shows up
// (admin dashboard, detail panel, staff portal) so the alert is consistent.
export default function SlaBadge({ complaint }) {
  if (!complaint.deadline) return null
  const breached = isBreached(complaint)
  return (
    <span className={breached ? 'sla-badge sla-badge--breached' : 'sla-badge'}>
      {breached ? '⚠ SLA breached — was due' : 'Due'} {formatDeadline(complaint.deadline)}
    </span>
  )
}
