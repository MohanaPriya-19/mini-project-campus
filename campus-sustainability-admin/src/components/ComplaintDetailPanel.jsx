import { useEffect, useState } from 'react'
import { useComplaints } from '../context/ComplaintsContext'
import { useStaffDirectory } from '../context/StaffDirectoryContext'
import { STATUS, STATUS_META } from '../data/mockComplaints'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'
import SlaBadge from './SlaBadge'
import ConfirmDialog from './ConfirmDialog'

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '')
const date = (value) => value ? new Date(value).toLocaleString('en-IN') : 'Not provided'
const duration = (oldDeadline, newDeadline) => Math.round(((new Date(newDeadline) - new Date(oldDeadline)) / 3600000) * 10) / 10
const localInput = (value) => new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const futureLocalInput = (hours = 24) => localInput(new Date(Date.now() + hours * 3600000))

export default function ComplaintDetailPanel({ complaint: initial, onClose }) {
  const { getComplaint, verify, reject, assign, extendDeadline } = useComplaints()
  const { getStaffById, getAvailableStaffForCategory } = useStaffDirectory()
  const [complaint, setComplaint] = useState(initial)
  const [staffId, setStaffId] = useState('')
  const [assignmentDeadline, setAssignmentDeadline] = useState(() => futureLocalInput())
  const [extensionDeadline, setExtensionDeadline] = useState('')
  const [extensionReason, setExtensionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [extending, setExtending] = useState(false)
  useEffect(() => { getComplaint(initial.id).then(setComplaint).catch(() => {}) }, [initial.id])
  const eligible = getAvailableStaffForCategory(complaint.category)
  const assigned = getStaffById(complaint.assignedTo)
  const showAssignment = !complaint.isRepetitive && Boolean(complaint.assignedTo)
  const extensions = complaint.deadlineExtensions || []
  const extensionLimitReached = extensions.length >= 5
  const action = async (fn) => { const result = await fn(); if (result) setComplaint(result) }
  const openExtension = () => {
    setExtensionDeadline(localInput(new Date(new Date(complaint.deadline).getTime() + 24 * 3600000)))
    setExtensionReason('')
    setExtending(true)
  }
  const submitExtension = async () => {
    if (!extensionDeadline || !extensionReason.trim()) return
    await action(() => extendDeadline(complaint.id, new Date(extensionDeadline).toISOString(), extensionReason.trim()))
    setExtending(false)
  }

  return <><div className="drawer-overlay" onClick={onClose} /><aside className="drawer">
    <div className="drawer__header"><span className="drawer__id">{complaint.id}</span><button className="btn-icon" onClick={onClose}>×</button></div><h2 className="drawer__title">{complaint.title}</h2><div className="drawer__badges"><StatusBadge status={complaint.status} /><PriorityBadge priority={complaint.priority} /></div>
    <dl className="drawer__meta"><div><dt>Category</dt><dd>{complaint.category}</dd></div><div><dt>Location</dt><dd>{complaint.location}</dd></div><div><dt>Reported by</dt><dd>{complaint.reportedBy}</dd></div><div><dt>Reported at</dt><dd>{date(complaint.reportedAt)}</dd></div></dl>
    {complaint.photoUrl && <img className="task-card__proof" src={`${API_ORIGIN}${complaint.photoUrl}`} alt="Complaint evidence" />}<p className="drawer__description">{complaint.description}</p>{complaint.token && <div className="drawer__token"><span>Student token</span><code>{complaint.token}</code></div>}
    {complaint.deadline && <><div className="drawer__sla"><SlaBadge complaint={complaint} /></div><p>Current due time: {date(complaint.deadline)}</p></>}{showAssignment && <p className="drawer__assigned">Assigned To: <strong>{assigned ? assigned.name : 'Yet to Assign'}</strong></p>}
    {extensions.length > 0 && <div className="drawer__history"><h3>Deadline extension timeline ({extensions.length}/5)</h3><ul className="history-list">{extensions.map((item, index) => <li key={index}><span className="history-list__status">Extension {index + 1}: +{duration(item.oldDeadline, item.newDeadline)} hours</span><span className="history-list__by">{item.reason}</span><span className="history-list__at">New due: {date(item.newDeadline)}</span></li>)}</ul></div>}
    {complaint.isRepetitive && <p className="drawer__rejection">{complaint.duplicateSuppressed ? 'Duplicate submission by the same student · retained for audit and excluded from RCA counts.' : `Repetitive report · no separate token or assignment · linked reports: ${complaint.repetitiveCount}`}</p>}{complaint.resolutionProofUrl && <div className="drawer__proof"><span>Resolution proof</span><img src={`${API_ORIGIN}${complaint.resolutionProofUrl}`} alt="Resolution proof" /></div>}
    {complaint.relatedComplaint && <section className="drawer__history"><h3>Matching active report</h3><p><strong>{complaint.relatedComplaint.category}</strong> · {complaint.relatedComplaint.status} · {complaint.relatedComplaint.location}</p>{complaint.relatedComplaint.photoUrl && <img className="task-card__proof" src={`${API_ORIGIN}${complaint.relatedComplaint.photoUrl}`} alt="Photo from the related complaint" />}<p className="drawer__description">{complaint.relatedComplaint.description}</p></section>}
    {complaint.status === STATUS.REPORTED && <div className="drawer__actions"><button className="btn-primary" onClick={() => action(() => verify(complaint.id))}>Verify complaint</button><button className="btn-danger-outline" onClick={() => setRejecting(true)}>Reject</button></div>}
    {(complaint.status === STATUS.VERIFIED || complaint.status === STATUS.REASSIGNED || complaint.status === STATUS.UNABLE_TO_RESOLVE || ((complaint.status === STATUS.DEADLINE_EXTENDED || complaint.status === STATUS.OVERDUE) && extensionLimitReached)) && <div className="assign-block">{extensionLimitReached && <p>This assignment has used all 5 deadline extensions. Reassign to the same or a different eligible staff member to continue.</p>}<label className="field"><span>Eligible available staff</span><select value={staffId} onChange={(event) => setStaffId(event.target.value)}><option value="">Select staff</option>{eligible.map((staff) => <option key={staff.id} value={staff.id}>{staff.name} — {staff.skills.join(', ')}</option>)}</select></label><label className="field"><span>Assignment deadline (date & time)</span><input type="datetime-local" value={assignmentDeadline} min={futureLocalInput(0.02)} onChange={(event) => setAssignmentDeadline(event.target.value)} /></label><button className="btn-primary" disabled={!staffId || !assignmentDeadline} onClick={() => action(() => assign(complaint.id, staffId, new Date(assignmentDeadline).toISOString()))}>{extensionLimitReached ? 'Reassign staff' : 'Assign'}</button></div>}
    {complaint.deadline && !['resolved', 'rejected', 'closed', 'unable_to_resolve'].includes(complaint.status) && <div className="drawer__actions"><button className="btn-ghost" disabled={extensionLimitReached} onClick={openExtension}>{extensionLimitReached ? 'Extension limit reached (5/5)' : `Extend deadline (${extensions.length}/5 used)`}</button></div>}
    {complaint.rejectionReason && <p className="drawer__rejection">{complaint.rejectionReason}</p>}{complaint.unableToResolveReason && <p className="drawer__rejection">Unable to resolve: {complaint.unableToResolveReason}</p>}{complaint.history?.length > 0 && <div className="drawer__history"><h3>Status history</h3><ul className="history-list">{complaint.history.map((item, index) => <li key={index}><span className="history-list__status">{STATUS_META[item.status]?.label || item.status}</span><span className="history-list__by">{item.note || 'Status updated'}</span><span className="history-list__at">{date(item.at)}</span></li>)}</ul></div>}
  </aside>
  {rejecting && <ConfirmDialog title="Reject complaint?" message="A reason is required and the student will be notified." confirmLabel="Reject" requireReason onConfirm={(reason) => action(() => reject(complaint.id, reason)).then(() => setRejecting(false))} onCancel={() => setRejecting(false)} />}
  {extending && <div className="modal-overlay"><div className="modal-card"><h3>Extend deadline ({extensions.length + 1} of 5)</h3><p>Choose the exact new due date and time. It must be later than the current due time: {date(complaint.deadline)}.</p><label className="field"><span>New deadline (date & time)</span><input type="datetime-local" value={extensionDeadline} min={localInput(new Date(new Date(complaint.deadline).getTime() + 60000))} onChange={(event) => setExtensionDeadline(event.target.value)} /></label><label className="field"><span>Reason</span><textarea value={extensionReason} onChange={(event) => setExtensionReason(event.target.value)} placeholder="Why is more time required?" /></label><div className="modal-actions"><button className="btn-ghost" onClick={() => setExtending(false)}>Cancel</button><button className="btn-primary" disabled={!extensionDeadline || !extensionReason.trim()} onClick={submitExtension}>Extend to selected time</button></div></div></div>}
  </>
}
