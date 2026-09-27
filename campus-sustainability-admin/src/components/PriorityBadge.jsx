import { PRIORITY_META } from '../data/mockComplaints'

export default function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.Medium
  return (
    <span className="priority-badge" style={{ color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  )
}
