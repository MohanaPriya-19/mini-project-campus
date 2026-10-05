import { useEffect, useState } from 'react'
import { useComplaints, isBreached } from '../context/ComplaintsContext'
import { useStaffDirectory } from '../context/StaffDirectoryContext'
import { api } from '../api/client'
import { STATUS } from '../data/mockComplaints'
import StatusBadge from '../components/StatusBadge'
import PriorityBadge from '../components/PriorityBadge'
import SlaBadge from '../components/SlaBadge'
import ConfirmDialog from '../components/ConfirmDialog'

function formatDate(value) { return value ? new Date(value).toLocaleString('en-IN') : 'Not provided' }
const SKILL_OPTIONS = ['Electrical', 'Water', 'Plumbing', 'Infrastructure', 'Civil Maintenance', 'Cleaning', 'Cleanliness', 'Waste', 'Waste Management']
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '')
const ACTIVE_TASK_STATUSES = [STATUS.ASSIGNED, STATUS.IN_PROGRESS, STATUS.OVERDUE, STATUS.DEADLINE_EXTENDED]

function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser does not support location services.'))
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => reject(new Error({
        1: 'Allow location access in your browser, then try again.',
        2: 'Your device could not determine its location. Turn on GPS or Wi-Fi location and try again.',
        3: 'Location lookup timed out. Move near a window or outdoors and try again.',
      }[error.code] || 'Unable to get your current location.')),
      { enableHighAccuracy: true, timeout: 45000, maximumAge: 0 },
    )
  })
}

export default function StaffHome() {
  const { complaints, startProgress, addWorkUpdate, resolveTask, unableToResolve } = useComplaints()
  const { profile, updateProfile } = useStaffDirectory()
  const [draft, setDraft] = useState({ name: '', phone: '', skills: [], isAvailable: true })
  const [resolve, setResolve] = useState(null)
  const [unable, setUnable] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [note, setNote] = useState('')
  const [workNote, setWorkNote] = useState('')
  const [photo, setPhoto] = useState(null)
  const [proofLocation, setProofLocation] = useState(null)
  const [locationMessage, setLocationMessage] = useState('')
  const [locating, setLocating] = useState(false)
  useEffect(() => { if (profile) setDraft({ name: profile.name || '', phone: profile.phone || '', skills: profile.skills || [], isAvailable: profile.available }) }, [profile])
  if (!profile) return <p className="empty-note">Loading profile…</p>
  const toggleSkill = (skill) => setDraft((value) => ({ ...value, skills: value.skills.includes(skill) ? value.skills.filter((item) => item !== skill) : [...value.skills, skill] }))
  const verifyProofLocation = async () => {
    setLocating(true); setProofLocation(null); setLocationMessage('Getting current location…')
    try {
      const coords = await getBrowserPosition()
      const result = await api.post('/location/verify', { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy })
      if (!result.locationVerified) throw new Error(result.message)
      setProofLocation({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy })
      setLocationMessage(`Campus location verified (${Math.round(coords.accuracy)} m accuracy).`)
    } catch (error) { setLocationMessage(error.message || 'Unable to verify your current campus location.') } finally { setLocating(false) }
  }
  const submitResolution = async () => { if (!note.trim() || !photo || !proofLocation) return; await resolveTask(resolve, note.trim(), photo, proofLocation); setResolve(null); setNote(''); setPhoto(null); setProofLocation(null); setLocationMessage('') }
  const submitWorkUpdate = async () => { if (!workNote.trim()) return; await addWorkUpdate(updating, workNote.trim()); setUpdating(null); setWorkNote('') }
  const openResolve = (task) => { setResolve(task); setNote(''); setPhoto(null); setProofLocation(null); setLocationMessage('') }
  const workUpdates = (task) => (task.history || []).filter((item) => item.note?.startsWith('Work update:'))

  return <div className="page">
    <div className="page__header"><div><span className="eyebrow">Maintenance staff</span><h1 className="page__title">My tasks</h1><p className="page__subtitle">Share progress, verify campus location, and submit validated resolution proof.</p></div></div>
    <section className="skillset-card"><h2>My profile</h2><p className="skillset-card__hint">{profile.employeeCode} · {profile.department || 'Department not provided'}</p><label className="field"><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="field"><span>Phone</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="Contact number" /></label><label className="availability-toggle"><input type="checkbox" checked={draft.isAvailable} onChange={(event) => setDraft({ ...draft, isAvailable: event.target.checked })} /> {draft.isAvailable ? 'Available for new assignments' : 'Unavailable for new assignments'}</label><h3>Skills</h3><div className="skill-chip-row">{SKILL_OPTIONS.map((skill) => <button key={skill} type="button" className={draft.skills.includes(skill) ? 'skill-chip active' : 'skill-chip'} onClick={() => toggleSkill(skill)}>{skill}</button>)}</div><div className="skillset-card__footer"><button className="btn-primary" onClick={() => updateProfile(draft)}>Save profile</button></div></section>
    <section><h2 className="section-title">Assigned tasks ({complaints.length})</h2>{complaints.length === 0 && <p className="empty-note">No active tasks are assigned to you.</p>}<div className="task-list">{complaints.map((task) => <article key={task.id} className={isBreached(task) ? 'task-card task-card--breached' : 'task-card'}><div className="task-card__top"><span className="mono">{task.id}</span><StatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></div><h3>{task.title}</h3><p>{task.description}</p><p className="task-card__meta">Reported By: {task.reportedBy}</p><p className="task-card__meta">{task.category} · {task.location}</p><p className="task-card__meta">Deadline: {formatDate(task.deadline)}</p>{task.deadline && <SlaBadge complaint={task} />}{task.photoUrl && <><p className="task-card__meta">Complaint image</p><img className="task-card__proof" src={`${API_ORIGIN}${task.photoUrl}`} alt="Complaint evidence" /></>}{task.status === STATUS.ASSIGNED && <button className="btn-primary" onClick={() => startProgress(task)}>Start work</button>}{ACTIVE_TASK_STATUSES.includes(task.status) && <div className="task-card__actions"><button className="btn-ghost" onClick={() => { setUpdating(task); setWorkNote('') }}>Post work update</button><button className="btn-primary" onClick={() => openResolve(task)}>Resolve with validated proof</button><button className="btn-danger-outline" onClick={() => setUnable(task)}>Unable to resolve</button></div>}{workUpdates(task).length > 0 && <div className="drawer__history"><h3>Work updates</h3><ul className="history-list">{workUpdates(task).map((item, index) => <li key={index}><span className="history-list__by">{item.note}</span><span className="history-list__at">{formatDate(item.at)}</span></li>)}</ul></div>}{task.resolutionProofUrl && <img className="task-card__proof" src={`${API_ORIGIN}${task.resolutionProofUrl}`} alt="Resolution proof" />}</article>)}</div></section>
    {updating && <div className="modal-overlay"><div className="modal-card"><h3>Post work update</h3><p>Students and administrators will receive this progress update.</p><label className="field"><span>Update</span><textarea value={workNote} onChange={(event) => setWorkNote(event.target.value)} placeholder="Example: Replacement part collected; installation will begin this afternoon." /></label><div className="modal-actions"><button className="btn-ghost" onClick={() => setUpdating(null)}>Cancel</button><button className="btn-primary" disabled={workNote.trim().length < 5} onClick={submitWorkUpdate}>Share update</button></div></div></div>}
    {resolve && <div className="modal-overlay"><div className="modal-card"><h3>Resolve complaint</h3><p>Proof is checked against the assigned complaint and must be submitted from the PSG campus.</p><label className="field"><span>Resolution note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><label className="field"><span>Resolution proof image</span><input type="file" accept="image/jpeg,image/png" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label><button className="btn-ghost" type="button" disabled={locating} onClick={verifyProofLocation}>{locating ? 'Verifying location…' : proofLocation ? 'Campus location verified' : 'Verify current campus location'}</button>{locationMessage && <p className={proofLocation ? 'locationSuccess' : 'form-error'}>{locationMessage}</p>}<div className="modal-actions"><button className="btn-ghost" onClick={() => setResolve(null)}>Cancel</button><button className="btn-primary" disabled={!note.trim() || !photo || !proofLocation} onClick={submitResolution}>Validate proof & resolve</button></div></div></div>}
    {unable && <ConfirmDialog title="Unable to resolve?" message="The student and administrators will be notified. Give a clear reason." confirmLabel="Mark unable to resolve" requireReason onConfirm={async (reason) => { await unableToResolve(unable, reason); setUnable(null) }} onCancel={() => setUnable(null)} />}
  </div>
}
