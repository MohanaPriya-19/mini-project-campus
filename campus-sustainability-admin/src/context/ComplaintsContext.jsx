import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { normalizeComplaint } from '../api/normalize'
import { useAuth } from './AuthContext'

const ComplaintsContext = createContext(null)

export function ComplaintsProvider({ children }) {
  const { user, status: authStatus } = useAuth()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionFeedback, setActionFeedback] = useState(null)

  const refresh = useCallback(async () => {
    if (!user) { setComplaints([]); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      if (user.role === 'staff') {
        const { tasks } = await api.get('/staff/tasks')
        setComplaints(tasks.map((task) => normalizeComplaint({ ...task.complaintId, assignment: task })))
      } else {
        const pageSize = 100
        const firstPage = await api.get(`/admin/complaints?limit=${pageSize}&page=1`)
        const all = [...firstPage.complaints]
        const pageCount = Math.ceil(firstPage.total / pageSize)
        for (let page = 2; page <= pageCount; page += 1) {
          const result = await api.get(`/admin/complaints?limit=${pageSize}&page=${page}`)
          all.push(...result.complaints)
        }
        setComplaints(all.map(normalizeComplaint))
      }
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }, [user])

  useEffect(() => { if (authStatus === 'ready') refresh() }, [authStatus, refresh])
  const replace = (document) => {
    const normalized = normalizeComplaint(document)
    setComplaints((items) => items.map((item) => item.id === normalized.id ? { ...item, ...normalized } : item))
    return normalized
  }
  const runAction = async (pending, success, fn) => {
    setActionFeedback({ state: 'working', message: pending })
    try {
      const result = await fn()
      setActionFeedback({ state: 'success', message: success })
      return result
    } catch (err) {
      const message = `${pending.replace(/\.\.\.$/, '')} failed: ${err.message}`
      setActionFeedback({ state: 'error', message })
      alert(message)
      throw err
    }
  }
  const getComplaint = async (id) => replace((await api.get(`/admin/complaints/${id}`)).complaint)
  // Mutation responses intentionally remain compact on the API. Re-read the
  // detail endpoint so the UI always receives assignment, proof, and history.
  const verify = (id) => runAction('Verifying complaint...', 'Complaint verified.', async () => { await api.patch(`/admin/complaints/${id}/verify`); return getComplaint(id) })
  const reject = (id, reason) => runAction('Rejecting complaint...', 'Complaint rejected.', async () => { await api.patch(`/admin/complaints/${id}/reject`, { reason }); return getComplaint(id) })
  const assign = (id, staffId, deadline) => runAction('Assigning staff...', 'Staff assigned successfully.', async () => { await api.patch(`/admin/complaints/${id}/assign`, { staffId, deadline }); return getComplaint(id) })
  const extendDeadline = (id, deadline, note) => runAction('Extending deadline...', 'Deadline extended and monitoring continues.', async () => { await api.patch(`/admin/complaints/${id}/deadline`, { deadline, note }); return getComplaint(id) })
  const startProgress = (task) => runAction('Starting work...', 'Work marked as in progress.', async () => { await api.patch(`/staff/tasks/${task.assignmentId}/status`, { status: 'In Progress' }); return refresh() })
  const addWorkUpdate = (task, note) => runAction('Submitting work update...', 'Work update submitted.', async () => { await api.post(`/staff/tasks/${task.assignmentId}/work-update`, { note }); return refresh() })
  const resolveTask = (task, note, photo, location) => runAction('Submitting resolution proof...', 'Resolution proof submitted and complaint resolved.', async () => {
    const form = new FormData(); form.append('resolutionNote', note); form.append('photo', photo); form.append('latitude', String(location.latitude)); form.append('longitude', String(location.longitude)); form.append('gpsAccuracy', String(location.accuracy))
    await api.postForm(`/staff/tasks/${task.assignmentId}/resolution-proof`, form); return refresh()
  })
  const unableToResolve = (task, reason) => runAction('Submitting unable-to-resolve status...', 'Unable-to-resolve status submitted.', async () => { await api.patch(`/staff/tasks/${task.assignmentId}/unable-to-resolve`, { reason }); return refresh() })
  const counts = useMemo(() => complaints.reduce((result, complaint) => { result[complaint.status] = (result[complaint.status] || 0) + 1; return result }, {}), [complaints])
  const breachedCount = useMemo(() => complaints.filter(isBreached).length, [complaints])
  const value = useMemo(() => ({ complaints, loading, error, actionFeedback, counts, breachedCount, refresh, getComplaint, verify, reject, assign, extendDeadline, startProgress, addWorkUpdate, resolveTask, unableToResolve, resetToSeed: refresh }), [complaints, loading, error, actionFeedback, counts, breachedCount, refresh])
  return <ComplaintsContext.Provider value={value}>{children}</ComplaintsContext.Provider>
}

export function useComplaints() {
  const value = useContext(ComplaintsContext)
  if (!value) throw new Error('useComplaints must be used within a ComplaintsProvider')
  return value
}

export function isBreached(complaint) {
  return Boolean(complaint.deadline) && new Date(complaint.deadline) < new Date() && !['resolved', 'rejected', 'closed', 'unable_to_resolve'].includes(complaint.status)
}
