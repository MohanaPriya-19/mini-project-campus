import { useEffect, useMemo, useState } from 'react'
import { useComplaints } from '../context/ComplaintsContext'
import { useStaffDirectory } from '../context/StaffDirectoryContext'
import { api } from '../api/client'
import {
  computeResolutionStats,
  computeStaffPerformance,
  computeRecurringLocations,
  exportRowsAsCsv,
} from '../utils/rcaAnalytics'

export default function ReportsPage() {
  const { complaints } = useComplaints()
  const { staff } = useStaffDirectory()
  const [duplicateAlertCount, setDuplicateAlertCount] = useState(0)

  useEffect(() => {
    api
      .get('/analytics/duplicate-alerts')
      .then(({ alerts }) => setDuplicateAlertCount(alerts.length))
      .catch((err) => console.error('Failed to load duplicate alerts:', err.message))
  }, [])

  const resolutionStats = useMemo(() => computeResolutionStats(complaints), [complaints])
  const staffPerf = useMemo(() => computeStaffPerformance(complaints, staff), [complaints, staff])
  const recurring = useMemo(() => computeRecurringLocations(complaints, 3), [complaints])

  const handleDownload = () => {
    const headers = ['Metric', 'Value']
    const rows = [
      ['Complaints resolved', resolutionStats.count],
      ['Avg resolution time (hrs)', resolutionStats.avgHours],
      ['Fastest resolution (hrs)', resolutionStats.minHours],
      ['Slowest resolution (hrs)', resolutionStats.maxHours],
      ['Duplicate/anomaly alerts caught', duplicateAlertCount],
      ['Locations flagged as recurring', recurring.length],
      ['Locations recommended for replacement', recurring.filter((r) => r.action === 'Replace').length],
      [],
      ['Staff', 'Assigned', 'Resolved', 'SLA breach rate (%)'],
      ...staffPerf.map((s) => [s.name, s.assignedCount, s.resolvedCount, s.breachRate]),
    ]
    exportRowsAsCsv('campus-sustainability-report.csv', headers, rows)
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1 className="page__title">Analytics &amp; reports</h1>
          <p className="page__subtitle">Resolution time, staff performance, and the anomaly summary — FR-12.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={handleDownload}>
          Download report (CSV)
        </button>
      </div>

      <div className="summary-grid">
        <div className="summary-card" style={{ "--badge-color": "var(--forest)" }}>
          <span className="summary-card__count">{resolutionStats.count}</span>
          <span className="summary-card__label">Complaints resolved</span>
        </div>
        <div className="summary-card" style={{ "--badge-color": "var(--forest)" }}>
          <span className="summary-card__count">{resolutionStats.avgHours}h</span>
          <span className="summary-card__label">Avg resolution time</span>
        </div>
        <div className="summary-card" style={{ "--badge-color": "var(--forest)" }}>
          <span className="summary-card__count">{duplicateAlertCount}</span>
          <span className="summary-card__label">Duplicate alerts caught</span>
        </div>
        <div className="summary-card" style={{ "--badge-color": "var(--forest)" }}>
          <span className="summary-card__count">{recurring.filter((r) => r.action === 'Replace').length}</span>
          <span className="summary-card__label">Locations flagged for replacement</span>
        </div>
      </div>

      <h2 className="section-title">Staff performance</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Assigned</th>
              <th>Resolved</th>
              <th>SLA breach rate</th>
            </tr>
          </thead>
          <tbody>
            {staffPerf.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.assignedCount}</td>
                <td>{s.resolvedCount}</td>
                <td>
                  <span className={s.breachRate > 0 ? 'rec-pill rec-pill--replace' : 'rec-pill'}>
                    {s.breachRate}%
                  </span>
                </td>
              </tr>
            ))}
            {staffPerf.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No staff in the directory yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="page__subtitle" style={{ marginTop: 8 }}>
        Exported as CSV rather than PDF — it opens directly in Excel/Sheets for further analysis, and needs no
        extra rendering dependency in the app. A PDF export can be added later if a formatted printout is needed.
      </p>
    </div>
  )
}
