import { useMemo, useState } from 'react'
import { useComplaints } from '../context/ComplaintsContext'
import { computeRecurringLocations } from '../utils/rcaAnalytics'

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '')

export default function RcaInsightsPage() {
  const { complaints } = useComplaints()
  const [threshold, setThreshold] = useState(3)
  const recurring = useMemo(() => computeRecurringLocations(complaints, threshold), [complaints, threshold])
  return <div className="page">
    <div className="page__header"><div><span className="eyebrow">Root cause analysis</span><h1 className="page__title">Recurring complaint locations</h1><p className="page__subtitle">Repeated complaints after a resolution are escalated to component replacement.</p></div><label className="threshold-control"><span>Threshold</span><input type="number" min="2" max="10" value={threshold} onChange={(event) => setThreshold(Math.max(2, Number(event.target.value) || 2))} /></label></div>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Location</th><th>Category</th><th>Occurrences</th><th>Resolved</th><th>Recommendation</th><th>Evidence</th></tr></thead><tbody>{recurring.map((item) => <tr key={`${item.location}-${item.category}`}><td>{item.location}</td><td>{item.category}</td><td>{item.count}</td><td>{item.resolvedCount}</td><td>{item.recommendation}</td><td><details><summary>View reports ({item.count})</summary><div className="rca-evidence">{item.occurrences.map((occurrence) => <article key={occurrence.id}><strong>{occurrence.status}</strong><p>{occurrence.description}</p>{occurrence.photoUrl && <img src={`${API_ORIGIN}${occurrence.photoUrl}`} alt="Complaint evidence" />}</article>)}</div></details></td></tr>)}{recurring.length === 0 && <tr><td colSpan="6" className="empty-row">No recurring locations at this threshold.</td></tr>}</tbody></table></div>
  </div>
}
