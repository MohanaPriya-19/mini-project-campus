import { STATUS_META } from '../data/mockComplaints'

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, var: '--ink-soft' }
  return (
    <span className="status-badge" style={{ '--badge-color': `var(${meta.var})` }}>
      <span className="status-badge__dot" />
      {meta.label}
    </span>
  )
}
