import { useMemo } from 'react'
import { useStaffDirectory } from '../context/StaffDirectoryContext'
import { useComplaints } from '../context/ComplaintsContext'
import { STATUS } from '../data/mockComplaints'

export default function StaffDirectoryPage() {
  const { staff } = useStaffDirectory()
  const { complaints } = useComplaints()

  const taskCounts = useMemo(() => {
    const counts = {}
    complaints.forEach((c) => {
      if (!c.assignedTo) return
      if (c.status === STATUS.ASSIGNED || c.status === STATUS.IN_PROGRESS) {
        counts[c.assignedTo] = (counts[c.assignedTo] || 0) + 1
      }
    })
    return counts
  }, [complaints])

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <span className="eyebrow">Maintenance team</span>
          <h1 className="page__title">Staff directory</h1>
          <p className="page__subtitle">
            Read-only view — staff maintain their own skillset and availability from their portal.
          </p>
        </div>
      </div>

      <div className="staff-grid">
        {staff.map((s) => (
          <div key={s.id} className="staff-card">
            <div className="staff-card__top">
              <h3>{s.name}</h3>
              <span className={s.available ? 'availability-pill available' : 'availability-pill'}>
                {s.available ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="staff-card__skills">
              {s.skills.length === 0 && <span className="empty-note">No skillset set yet</span>}
              {s.skills.map((skill) => (
                <span key={skill} className="skill-tag">
                  {skill}
                </span>
              ))}
            </div>
            <p className="staff-card__load">{taskCounts[s.id] || 0} open task(s)</p>
          </div>
        ))}
      </div>
    </div>
  )
}
