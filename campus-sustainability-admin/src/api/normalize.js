// The backend returns MongoDB documents (_id, populated refs, nested
// location object, etc). Every component in this app was built against
// the mock data's flatter shape (id, plain strings). Normalizing here in
// one place means the pages/components below don't need to change.

function idOf(value) {
  if (!value) return null
  return typeof value === 'string' ? value : value._id?.toString() || value.toString()
}

export function normalizeUser(u) {
  if (!u) return null
  return {
    id: idOf(u), name: u.name || u.email || u.employeeCode || u.rollNumber,
    email: u.email, rollNo: u.rollNo || u.rollNumber, role: u.role,
  }
}

export function formatReporter(u) {
  if (!u) return 'Unknown'
  if (typeof u === 'string') return u
  const rollNumber = u.rollNo || u.rollNumber
  return rollNumber ? `${u.name} (${rollNumber})` : u.name || 'Not provided'
}

export function normalizeStaff(s) {
  if (!s) return null
  return {
    id: idOf(s), userId: idOf(s.userId), name: s.name, skills: s.skills || [],
    available: Boolean(s.available ?? s.isAvailable), email: s.email || '', phone: s.phone || '', employeeCode: s.employeeCode || '',
  }
}

export function normalizeComplaint(c) {
  const statusMap = {
    Reported: 'reported', Verified: 'verified', Assigned: 'assigned',
    'In Progress': 'in_progress', Resolved: 'resolved', Rejected: 'rejected',
    Overdue: 'overdue', 'Unable to Resolve': 'unable_to_resolve', Reassigned: 'reassigned',
    'Deadline Extended': 'deadline_extended', Closed: 'closed', Repetitive: 'repetitive',
  }
  const status = statusMap[c.status] || c.status
  const assignment = c.assignment || null
  const attachments = c.attachments || []
  const complaintPhoto = attachments.find((item) => item.attachmentType === 'complaint_photo')
  const resolutionProof = attachments.find((item) => item.attachmentType === 'resolution_photo')
  const related = c.relatedComplaint || null
  const relatedPhoto = (c.relatedComplaintAttachments || []).find((item) => item.attachmentType === 'complaint_photo')
  return {
    id: idOf(c),
    title: c.title || c.categoryId?.name || 'Campus complaint',
    category: c.category || c.categoryId?.name || '',
    location: c.locationDescription || c.location?.description || 'Not provided',
    description: c.description,
    photoUrl: c.photoUrl || complaintPhoto?.fileUrl || null,
    reportedBy: formatReporter(c.reportedBy || c.studentId),
    reportedAt: c.reportedAt || c.createdAt,
    status,
    priority: c.priority,
    token: c.token || c.tokenId || null,
    // The assignment document is the source of truth. Complaint-level
    // assignedTo values may be stale legacy data and must not appear as an
    // assignment before an administrator actually assigns the complaint.
    assignedTo: ['assigned', 'in_progress', 'overdue', 'reassigned', 'deadline_extended', 'resolved', 'closed', 'unable_to_resolve'].includes(status)
      ? idOf(assignment?.staffId)
      : null,
    assignmentId: idOf(c.assignmentId || assignment),
    deadline: c.deadline || assignment?.deadline || null,
    deadlineExtensions: assignment?.deadlineExtensions || [],
    resolvedAt: c.resolvedAt || assignment?.resolvedAt || null,
    resolutionProofUrl: c.resolutionProofUrl || resolutionProof?.fileUrl || null,
    unableToResolveReason: assignment?.unableToResolveReason || null,
    rejectionReason: c.rejectionReason || null,
    isRepetitive: Boolean(c.isRepetitive), duplicateSuppressed: Boolean(c.duplicateSuppressed), relatedComplaintId: idOf(c.relatedComplaintId), repetitiveCount: c.repetitiveCount || 0,
    relatedComplaint: related ? {
      id: idOf(related), category: related.categoryId?.name || '', location: related.locationDescription || 'Not provided',
      description: related.description || '', status: statusMap[related.status] || related.status,
      photoUrl: relatedPhoto?.fileUrl || null, reportedAt: related.createdAt,
    } : null,
    photoUrl: c.photoUrl || complaintPhoto?.fileUrl || null,
    history: (c.history || []).map((h) => ({ status: statusMap[h.status] || h.status, at: h.at || h.createdAt, by: h.by || h.changedBy, note: h.note })),
  }
}

export function normalizeEvent(e) {
  return {
    id: idOf(e),
    title: e.title,
    category: e.eventType || e.category || 'Other',
    description: e.description,
    venue: e.location || e.venue || 'Not provided',
    startsAt: e.startsAt || e.date,
    createdBy: e.createdBy,
    status: e.isCancelled ? 'cancelled' : e.isPublished ? 'published' : 'draft',
    registrations: (e.registrations || []).map((r) => ({
      id: idOf(r),
      studentName: r.studentName,
      rollNo: r.rollNo,
      token: r.token,
      checkedIn: Boolean(r.checkedIn),
    })),
  }
}

export function normalizeProposal(p) {
  return {
    id: idOf(p),
    title: p.title,
    category: p.category,
    description: p.description,
    proposedBy: formatReporter(p.proposedBy),
    proposedAt: p.proposedAt,
    requestedDate: p.requestedDate,
    requestedVenue: p.requestedVenue,
    status: p.status,
    rejectionReason: p.rejectionReason || null,
  }
}

export function normalizeDuplicateAlert(a) {
  return {
    id: idOf(a),
    category: a.category,
    location: a.locationDescription,
    attemptedBy: formatReporter(a.attemptedBy),
    detectedAt: a.detectedAt,
    linkedTo: idOf(a.linkedTo),
  }
}
