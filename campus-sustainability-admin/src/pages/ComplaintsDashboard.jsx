import { useMemo, useState } from 'react'
import { useComplaints, isBreached } from '../context/ComplaintsContext'
import { useStaffDirectory } from '../context/StaffDirectoryContext'
import { CATEGORIES, STATUS_META } from '../data/mockComplaints'
import StatusBadge from '../components/StatusBadge'
import PriorityBadge from '../components/PriorityBadge'
import ComplaintDetailPanel from '../components/ComplaintDetailPanel'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const STATUS_FILTERS = ['reported', 'verified', 'assigned', 'in_progress', 'overdue', 'unable_to_resolve', 'reassigned', 'deadline_extended', 'resolved', 'rejected', 'repetitive']
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 }
const STATUS_RANK = { reported: 0, repetitive: 0, verified: 1, assigned: 2, in_progress: 3, overdue: 3, reassigned: 3, deadline_extended: 3, resolved: 4, closed: 5, rejected: 5 }

function duplicateKey(complaint) {
  const normalize = (value) => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
  const date = new Date(complaint.reportedAt)
  if (!Number.isFinite(date.getTime())) return null
  return [
    normalize(complaint.category), normalize(complaint.reportedBy),
    normalize(complaint.location), normalize(complaint.description),
    date.toLocaleDateString('en-CA'),
  ].join('|')
}

function removeDuplicateComplaints(items) {
  const unique = new Map()
  for (const complaint of items) {
    const key = duplicateKey(complaint)
    if (!key) { unique.set(`id:${complaint.id}`, complaint); continue }
    const current = unique.get(key)
    const complaintRank = STATUS_RANK[complaint.status] ?? 0
    const currentRank = STATUS_RANK[current?.status] ?? 0
    if (!current || complaintRank > currentRank || (complaintRank === currentRank && new Date(complaint.reportedAt) > new Date(current.reportedAt))) {
      unique.set(key, complaint)
    }
  }
  return [...unique.values()]
}

export default function ComplaintsDashboard() {
  const { complaints } = useComplaints()
  const uniqueComplaints = useMemo(() => removeDuplicateComplaints(complaints), [complaints])
  const counts = useMemo(() => uniqueComplaints.reduce((result, complaint) => {
    result[complaint.status] = (result[complaint.status] || 0) + 1
    return result
  }, {}), [uniqueComplaints])
  const breachedCount = useMemo(() => uniqueComplaints.filter(isBreached).length, [uniqueComplaints])
  const { getStaffById } = useStaffDirectory()
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const filtered = useMemo(() => {
    return uniqueComplaints
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .filter((c) => categoryFilter === 'all' || c.category === categoryFilter)
      .filter((c) => !overdueOnly || isBreached(c))
      .filter((c) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          c.description.toLowerCase().includes(q) ||
          c.reportedBy.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        )
      })
      // FR-5: priority-based queue — highest priority first, then most recent.
      .sort((a, b) => {
        const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (rankDiff !== 0) return rankDiff
        return new Date(b.reportedAt) - new Date(a.reportedAt)
      })
  }, [uniqueComplaints, statusFilter, categoryFilter, search, overdueOnly])

  const selected = uniqueComplaints.find((c) => c.id === selectedId) || null
  const categoryCounts = useMemo(() => {
    const values = Object.fromEntries(CATEGORIES.map((category) => [category, 0]))
    uniqueComplaints.forEach((complaint) => { values[complaint.category] = (values[complaint.category] || 0) + 1 })
    return values
  }, [uniqueComplaints])
  const pendingVerification = uniqueComplaints.filter((complaint) => complaint.status === 'reported')
  const maxCategoryCount = Math.max(1, ...Object.values(categoryCounts))
  const chartStatuses = Object.entries(counts).filter(([, count]) => count > 0)
  const total = uniqueComplaints.length || 1
  let cursor = 0
  const pieStops = chartStatuses.map(([, count], index) => { const start = cursor; cursor += (count / total) * 100; return `var(--chart-${index % 6}) ${start}% ${cursor}%` }).join(', ')
  const repetitiveCount = uniqueComplaints.filter((complaint) => complaint.isRepetitive).length

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <span className="eyebrow">Administration</span>
          <h1 className="page__title">Complaint management</h1>
          <p className="page__subtitle">
            Priority-sorted queue — verify reports, match to skilled staff, and monitor SLA deadlines.
          </p>
        </div>
        {breachedCount > 0 && (
          <button
            className={overdueOnly ? 'sla-alert-pill active' : 'sla-alert-pill'}
            onClick={() => setOverdueOnly((v) => !v)}
          >
            ⚠ {breachedCount} overdue — SLA breached
          </button>
        )}
      </div>

      <div className="summary-grid">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={'summary-card' + (statusFilter === s ? ' active' : '')}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            style={{ '--badge-color': `var(${STATUS_META[s].var})` }}
          >
            <span className="summary-card__count">{counts[s] || 0}</span>
            <span className="summary-card__label">{STATUS_META[s].label}</span>
          </button>
        ))}
      </div>

      <div className="kpi-strip"><div><span>Total complaints</span><b>{uniqueComplaints.length}</b></div><div><span>Pending verification</span><b>{pendingVerification.length}</b></div><div><span>Repetitive reports</span><b>{repetitiveCount}</b></div><div><span>Overdue</span><b>{breachedCount}</b></div></div>

      <div className="analytics-grid">
        <section className="analytics-card chart-card"><h2>Complaints by Status</h2>{chartStatuses.length ? <div className="pie-layout"><div className="pie-chart" style={{ background: `conic-gradient(${pieStops})` }} /><div className="chart-legend">{chartStatuses.map(([status, count], index) => <span key={status}><i style={{ background: `var(--chart-${index % 6})` }} />{STATUS_META[status]?.label || status}: <b>{count}</b></span>)}</div></div> : <p className="empty-note">No complaint data yet.</p>}</section>
        <section className="analytics-card">
          <h2>Complaints by category</h2>
          {Object.entries(categoryCounts).map(([category, count]) => (
            <div className="category-bar" key={category}>
              <span>{category}</span>
              <div><i style={{ width: `${(count / maxCategoryCount) * 100}%` }} /></div>
              <b>{count}</b>
            </div>
          ))}
        </section>
        <section className="analytics-card">
          <h2>Category distribution</h2>
          <div className="distribution-list">
            {Object.entries(categoryCounts).map(([category, count]) => (
              <span key={category}>{category}<b>{uniqueComplaints.length ? Math.round((count / uniqueComplaints.length) * 100) : 0}%</b></span>
            ))}
          </div>
        </section>
      </div>

      <section className="pending-section">
        <h2 className="section-title">Awaiting verification</h2>
        <div className="table-wrap">
          <table className="data-table"><thead><tr><th>Category</th><th>Description</th><th>Reporter</th><th>Priority</th></tr></thead>
            <tbody>{pendingVerification.slice(0, 5).map((complaint) => (
              <tr key={complaint.id} onClick={() => setSelectedId(complaint.id)}>
                <td>{complaint.category}</td><td>{complaint.description}</td><td>{complaint.reportedBy}</td><td><PriorityBadge priority={complaint.priority} /></td>
              </tr>
            ))}{pendingVerification.length === 0 && <tr><td colSpan={4} className="empty-row">No complaints are awaiting verification.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search by title, location, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-search"
        />

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>

        {(statusFilter !== 'all' || categoryFilter !== 'all' || search || overdueOnly) && (
          <button
            className="btn-ghost"
            onClick={() => {
              setStatusFilter('all')
              setCategoryFilter('all')
              setSearch('')
              setOverdueOnly(false)
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Category</th>
              <th>Reporter</th>
              <th>Priority</th>
              <th>Location</th>
              <th>Reported</th>
              <th>Status</th>
              <th>Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const canShowAssignee = ['assigned', 'in_progress', 'overdue', 'reassigned', 'deadline_extended', 'resolved', 'closed', 'unable_to_resolve'].includes(c.status)
              const staff = canShowAssignee ? getStaffById(c.assignedTo) : null
              const breached = isBreached(c)
              return (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  tabIndex={0}
                  className={breached ? 'row-breached' : ''}
                >
                  <td className="mono">{c.id}</td>
                  <td>{c.description}</td>
                  <td>{c.category}</td>
                  <td>{c.reportedBy}</td>
                  <td>
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td>{c.location}</td>
                  <td>{formatDate(c.reportedAt)}</td>
                  <td>
                    <StatusBadge status={c.status} />
                    {breached && <span className="row-breached__tag">overdue</span>}
                  </td>
                  <td>{staff ? staff.name : ''}</td>
                </tr>
              )
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No complaints match these filters. Try clearing them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <ComplaintDetailPanel complaint={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
