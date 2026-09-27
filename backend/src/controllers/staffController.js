const { validationResult } = require('express-validator')
const Complaint = require('../models/Complaint')
const ComplaintAssignment = require('../models/ComplaintAssignment')
const ComplaintStatusHistory = require('../models/ComplaintStatusHistory')
const ComplaintAttachment = require('../models/ComplaintAttachment')
const Student = require('../models/Student')
const Staff = require('../models/Staff')
const { createNotification } = require('../services/notificationService')
const { validateTechnical, validateSemantic } = require('../services/imageValidationService')
const { verifyLocation } = require('../services/locationService')
const ALLOWED_SKILLS = ['Electrical', 'Water', 'Plumbing', 'Infrastructure', 'Civil Maintenance', 'Cleaning', 'Cleanliness', 'Waste', 'Waste Management']

async function notifyAdmins({ complaintId, title, message, type }) {
  const User = require('../models/User')
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean()
  await Promise.all(admins.map((admin) => createNotification({ userId: admin._id, complaintId, title, message, type })))
}

async function getProfile(req, res, next) {
  try {
    const staff = await Staff.findOne({ userId: req.user._id }).lean()
    if (!staff) return res.status(404).json({ success: false, message: 'Staff profile not found.' })
    res.json({ success: true, staff: { ...staff, email: req.user.email } })
  } catch (err) { next(err) }
}

async function updateProfile(req, res, next) {
  try {
    const update = {}
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      update.name = req.body.name.trim().slice(0, 100)
    }
    if (Array.isArray(req.body.skills)) {
      update.skills = [...new Set(req.body.skills.filter((skill) => ALLOWED_SKILLS.includes(skill)))]
    }
    if (typeof req.body.isAvailable === 'boolean') update.isAvailable = req.body.isAvailable
    if (typeof req.body.phone === 'string') update.phone = req.body.phone.trim().slice(0, 30)
    const staff = await Staff.findOneAndUpdate({ userId: req.user._id }, update, { new: true }).lean()
    if (!staff) return res.status(404).json({ success: false, message: 'Staff profile not found.' })
    res.json({ success: true, staff: { ...staff, email: req.user.email } })
  } catch (err) { next(err) }
}

// GET /api/staff/tasks
async function getMyTasks(req, res, next) {
  try {
    const staff = await Staff.findOne({ userId: req.user._id })
    if (!staff) return res.status(404).json({ success: false, message: 'Staff profile not found.' })

    const assignments = await ComplaintAssignment.find({ staffId: staff._id, isActive: true })
      .populate({
        path: 'complaintId',
        populate: [
          { path: 'categoryId', select: 'name' },
          { path: 'studentId', select: 'name rollNumber department' },
        ],
      })
      .sort({ deadline: 1 })
      .lean()

    // Task cards need the same evidence and timeline data staff act on.  The
    // assignment document deliberately only stores workflow metadata, so add
    // these related records instead of inventing duplicate complaint fields.
    // Legacy data can contain duplicate active assignments for one complaint.
    // Staff must receive one task card only: keep the most recently created
    // active assignment for each complaint.
    const latestAssignmentByComplaint = new Map()
    for (const assignment of assignments) {
      if (!assignment.complaintId || ['Reported', 'Rejected', 'Repetitive'].includes(assignment.complaintId.status)) continue
      const key = String(assignment.complaintId._id)
      const current = latestAssignmentByComplaint.get(key)
      if (!current || new Date(assignment.createdAt) > new Date(current.createdAt)) {
        latestAssignmentByComplaint.set(key, assignment)
      }
    }
    const actionableAssignments = Array.from(latestAssignmentByComplaint.values())
    const complaintIds = actionableAssignments.map((assignment) => assignment.complaintId._id)
    const [attachments, histories] = await Promise.all([
      ComplaintAttachment.find({ complaintId: { $in: complaintIds } }).lean(),
      ComplaintStatusHistory.find({ complaintId: { $in: complaintIds } }).sort({ createdAt: 1 }).lean(),
    ])
    const byComplaint = (items) => items.reduce((map, item) => {
      const key = String(item.complaintId)
      const list = map.get(key) || []
      list.push(item)
      map.set(key, list)
      return map
    }, new Map())
    const attachmentsByComplaint = byComplaint(attachments)
    const historyByComplaint = byComplaint(histories)
    const tasks = actionableAssignments.map((assignment) => {
      const complaint = assignment.complaintId
      return {
        ...assignment,
        complaintId: {
          ...complaint,
          attachments: attachmentsByComplaint.get(String(complaint._id)) || [],
          history: historyByComplaint.get(String(complaint._id)) || [],
        },
      }
    })

    res.json({ success: true, tasks })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/staff/tasks/:id/status
async function updateTaskStatus(req, res, next) {
  try {
    const { status, note } = req.body
    const ALLOWED_TRANSITIONS = ['In Progress']
    if (!ALLOWED_TRANSITIONS.includes(status)) {
      return res.status(400).json({ success: false, message: `Use this endpoint only to set status to: ${ALLOWED_TRANSITIONS.join(', ')}` })
    }

    const assignment = await ComplaintAssignment.findById(req.params.id)
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' })

    const staff = await Staff.findOne({ userId: req.user._id })
    if (!assignment.staffId.equals(staff._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    await Complaint.findByIdAndUpdate(assignment.complaintId, { status })
    await ComplaintStatusHistory.create({
      complaintId: assignment.complaintId,
      status,
      changedBy: req.user._id,
      note: note || `Status updated to ${status} by staff.`,
    })

    const complaint = await Complaint.findById(assignment.complaintId)
    const student = await Student.findById(complaint.studentId)
    if (student) {
      await createNotification({
        userId: student.userId,
        complaintId: complaint._id,
        title: 'Complaint Status Updated',
        message: `Your complaint status has been updated to: ${status}.`,
        type: 'status_changed',
      })
    }
    await notifyAdmins({ complaintId: complaint._id, title: 'Complaint Status Updated', message: 'A staff member changed a complaint to ' + status + '.', type: 'status_changed' })

    res.json({ success: true, message: `Status updated to ${status}.` })
  } catch (err) {
    next(err)
  }
}

// POST /api/staff/tasks/:id/work-update
// A staff member can report progress without changing the complaint's state.
async function addWorkUpdate(req, res, next) {
  try {
    const note = String(req.body.note || '').trim()
    if (note.length < 5 || note.length > 500) {
      return res.status(400).json({ success: false, message: 'Work update must be between 5 and 500 characters.' })
    }
    const assignment = await ComplaintAssignment.findById(req.params.id)
    if (!assignment || !assignment.isActive) return res.status(404).json({ success: false, message: 'Active assignment not found.' })
    const staff = await Staff.findOne({ userId: req.user._id })
    if (!staff || !assignment.staffId.equals(staff._id)) return res.status(403).json({ success: false, message: 'Access denied.' })
    const complaint = await Complaint.findById(assignment.complaintId)
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' })
    if (!['Assigned', 'In Progress', 'Overdue', 'Deadline Extended'].includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'Work updates are not allowed for this complaint status.' })
    }
    await ComplaintStatusHistory.create({
      complaintId: complaint._id, status: complaint.status, changedBy: req.user._id,
      note: `Work update: ${note}`,
    })
    const student = await Student.findById(complaint.studentId)
    if (student) await createNotification({
      userId: student.userId, complaintId: complaint._id, title: 'Work Update',
      message: `Maintenance staff update: ${note}`, type: 'status_changed',
    })
    await notifyAdmins({ complaintId: complaint._id, title: 'Staff Work Update', message: `${staff.name} updated the assigned work: ${note}`, type: 'status_changed' })
    res.json({ success: true, message: 'Work update shared with the student and administrators.' })
  } catch (err) { next(err) }
}

// POST /api/staff/tasks/:id/resolution-proof
async function uploadResolutionProof(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resolution proof photo is required.' })
    }

    const techCheck = await validateTechnical(req.file)
    if (!techCheck.valid) {
      return res.status(400).json({ success: false, message: techCheck.reason })
    }

    const { resolutionNote, latitude, longitude, gpsAccuracy } = req.body
    if (!resolutionNote || resolutionNote.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Resolution note is required.' })
    }

    const assignment = await ComplaintAssignment.findById(req.params.id)
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' })

    const staff = await Staff.findOne({ userId: req.user._id })
    if (!assignment.staffId.equals(staff._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    // Resolution proof must be captured from the PSG campus and verified on
    // the server; browser-side geolocation alone is never trusted.
    const locationResult = verifyLocation(parseFloat(latitude), parseFloat(longitude), gpsAccuracy)
    if (!locationResult.locationVerified) {
      return res.status(400).json({ success: false, message: locationResult.message })
    }

    const complaint = await Complaint.findById(assignment.complaintId).populate('categoryId', 'name')
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' })
    const proofDescription = `Original complaint: ${complaint.description}. Staff resolution note: ${resolutionNote.trim()}`
    const proofValidation = await validateSemantic(req.file.path, proofDescription, complaint.categoryId.name, { purpose: 'resolution' })
    if (!proofValidation.valid) {
      return res.status(422).json({ success: false, message: proofValidation.reason || 'The resolution proof does not appear to match this complaint.', validation: proofValidation })
    }

    // Save resolution photo
    const fileUrl = `/uploads/${req.file.filename}`
    await ComplaintAttachment.create({
      complaintId: assignment.complaintId,
      fileUrl,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      attachmentType: 'resolution_photo',
      uploadedBy: req.user._id,
    })

    // Update assignment and complaint
    assignment.status = 'Resolved'
    assignment.resolvedAt = new Date()
    await assignment.save()

    await Complaint.findByIdAndUpdate(assignment.complaintId, { status: 'Resolved' })
    await ComplaintStatusHistory.create({
      complaintId: assignment.complaintId,
      status: 'Resolved',
      changedBy: req.user._id,
      note: resolutionNote,
    })

    const student = await Student.findById(complaint.studentId)
    if (student) {
      await createNotification({
        userId: student.userId,
        complaintId: complaint._id,
        title: 'Complaint Resolved',
        message: `Your complaint has been resolved. Note: ${resolutionNote}`,
        type: 'complaint_resolved',
      })
      // Award points for valid resolved complaint
      await Student.findByIdAndUpdate(student._id, { $inc: { points: 10 } })
    }
    await notifyAdmins({ complaintId: complaint._id, title: 'Resolution Proof Uploaded', message: 'A staff member submitted a resolution proof for review.', type: 'resolution_proof_uploaded' })

    res.json({ success: true, message: 'Complaint marked as resolved with proof.' })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/staff/tasks/:id/unable-to-resolve
async function markUnableToResolve(req, res, next) {
  try {
    const { reason } = req.body
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'A reason is required when marking unable to resolve.' })
    }

    const assignment = await ComplaintAssignment.findById(req.params.id)
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' })

    const staff = await Staff.findOne({ userId: req.user._id })
    if (!assignment.staffId.equals(staff._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    assignment.status = 'Unable to Resolve'
    assignment.unableToResolveReason = reason
    assignment.isActive = false
    await assignment.save()

    await Complaint.findByIdAndUpdate(assignment.complaintId, { status: 'Unable to Resolve' })
    await ComplaintStatusHistory.create({
      complaintId: assignment.complaintId,
      status: 'Unable to Resolve',
      changedBy: req.user._id,
      note: reason,
    })

    const complaint = await Complaint.findById(assignment.complaintId)
    const student = await Student.findById(complaint.studentId)
    if (student) {
      await createNotification({
        userId: student.userId,
        complaintId: complaint._id,
        title: 'Unable to Resolve',
        message: `Your complaint could not be resolved. Reason: ${reason}`,
        type: 'unable_to_resolve',
      })
    }
    await notifyAdmins({ complaintId: complaint._id, title: 'Staff Unable to Resolve', message: 'A staff member reported they cannot resolve this complaint: ' + reason, type: 'unable_to_resolve' })

    res.json({ success: true, message: 'Marked as unable to resolve. Administrator has been notified.' })
  } catch (err) {
    next(err)
  }
}

module.exports = { getProfile, updateProfile, getMyTasks, updateTaskStatus, addWorkUpdate, uploadResolutionProof, markUnableToResolve }
