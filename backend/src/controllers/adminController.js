const { validationResult } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const Complaint = require('../models/Complaint')
const ComplaintAssignment = require('../models/ComplaintAssignment')
const ComplaintStatusHistory = require('../models/ComplaintStatusHistory')
const ComplaintAttachment = require('../models/ComplaintAttachment')
const Student = require('../models/Student')
const Staff = require('../models/Staff')
const IssueCategory = require('../models/IssueCategory')
const { createNotification } = require('../services/notificationService')
const { determinePriority } = require('../services/priorityService')

async function notifyAdmins({ complaintId, title, message, type }) {
  const User = require('../models/User')
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean()
  await Promise.all(admins.map((admin) => createNotification({ userId: admin._id, complaintId, title, message, type })))
}

function generateTokenId() {
  const prefix = 'PSG'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = uuidv4().split('-')[0].toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

async function responseComplaint(id) {
  return Complaint.findById(id)
    .populate('categoryId', 'name')
    .populate('studentId', 'rollNumber name department')
    .lean()
}

// GET /api/admin/complaints
async function listComplaints(req, res, next) {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query
    const filter = {}
    if (status) filter.status = status
    if (priority) filter.priority = priority
    if (category) {
      const cat = await IssueCategory.findOne({ name: category })
      if (cat) filter.categoryId = cat._id
    }

    const complaints = await Complaint.find(filter)
      .populate('categoryId', 'name')
      .populate('studentId', 'rollNumber name department')
      .sort({ priority: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean()
    const complaintPhotos = await ComplaintAttachment.find({
      complaintId: { $in: complaints.map((item) => item._id) },
      attachmentType: 'complaint_photo',
    }).select('complaintId fileUrl').lean()
    const photoByComplaint = new Map(complaintPhotos.map((photo) => [String(photo.complaintId), photo.fileUrl]))

    // Do not surface a stale assignment for a complaint that has not passed
    // administrator verification. The write endpoint enforces this too.
    const complaintIds = complaints
      .filter((complaint) => !['Reported', 'Rejected', 'Repetitive'].includes(complaint.status))
      .map((complaint) => complaint._id)
    const assignments = await ComplaintAssignment.find({ complaintId: { $in: complaintIds }, isActive: true })
      .populate('staffId', 'name employeeCode skills isAvailable')
      .lean()
    const assignmentByComplaint = new Map(assignments.map((assignment) => [String(assignment.complaintId), assignment]))
    const total = await Complaint.countDocuments(filter)
    res.json({
      success: true,
      complaints: complaints.map((complaint) => ({
        ...complaint,
        photoUrl: photoByComplaint.get(String(complaint._id)) || null,
        assignment: assignmentByComplaint.get(String(complaint._id)) || null,
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/admin/complaints/:id/verify
async function verifyComplaint(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id).populate('categoryId')
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' })
    if (complaint.status !== 'Reported') {
      return res.status(400).json({ success: false, message: 'Only reported complaints can be verified.' })
    }

    const tokenId = generateTokenId()
    const priority = await determinePriority(
      complaint.categoryId.name,
      complaint.description,
      complaint.categoryId.defaultPriority
    )

    await Complaint.findByIdAndUpdate(complaint._id, {
      status: 'Verified',
      tokenId,
      priority,
      verifiedAt: new Date(),
      verifiedBy: req.user._id,
    })

    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      status: 'Verified',
      changedBy: req.user._id,
      note: req.body.note || 'Complaint verified by administrator.',
    })

    const student = await Student.findById(complaint.studentId)
    if (student) {
      await createNotification({
        userId: student.userId,
        complaintId: complaint._id,
        title: 'Complaint Verified',
        message: `Your complaint has been verified. Your token ID is ${tokenId}.`,
        type: 'complaint_verified',
      })
    }

    res.json({ success: true, message: 'Complaint verified.', tokenId, priority, complaint: await responseComplaint(complaint._id) })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/admin/complaints/:id/reject
async function rejectComplaint(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    const { reason } = req.body
    const complaint = await Complaint.findById(req.params.id)
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' })
    if (!['Reported', 'Verified'].includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'Complaint cannot be rejected at this stage.' })
    }

    await Complaint.findByIdAndUpdate(complaint._id, { status: 'Rejected', rejectionReason: reason })
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      status: 'Rejected',
      changedBy: req.user._id,
      note: reason,
    })

    const student = await Student.findById(complaint.studentId)
    if (student) {
      await createNotification({
        userId: student.userId,
        complaintId: complaint._id,
        title: 'Complaint Rejected',
        message: `Your complaint was rejected. Reason: ${reason}`,
        type: 'complaint_rejected',
      })
    }

    res.json({ success: true, message: 'Complaint rejected.', complaint: await responseComplaint(complaint._id) })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/admin/complaints/:id/assign
async function assignComplaint(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    const { staffId, deadline } = req.body
    const complaint = await Complaint.findById(req.params.id)
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' })
    const currentAssignment = await ComplaintAssignment.findOne({ complaintId: complaint._id, isActive: true })
    const extensionLimitReached = currentAssignment && currentAssignment.deadlineExtensions.length >= 5
    if (!['Verified', 'Reassigned', 'Unable to Resolve'].includes(complaint.status) && !(['Deadline Extended', 'Overdue'].includes(complaint.status) && extensionLimitReached)) {
      return res.status(400).json({ success: false, message: 'Complaint must be verified before assignment.' })
    }

    const staff = await Staff.findById(staffId)
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' })
    if (!staff.isAvailable) return res.status(400).json({ success: false, message: 'Selected staff member is unavailable.' })
    const category = await IssueCategory.findById(complaint.categoryId)
    if (!category || !staff.skills.includes(category.requiredSkill)) {
      return res.status(400).json({ success: false, message: 'Selected staff member does not have the required skill for this complaint.' })
    }

    // Deactivate previous active assignment if reassigning
    await ComplaintAssignment.updateMany(
      { complaintId: complaint._id, isActive: true },
      { isActive: false, status: 'Reassigned' }
    )

    const selectedDeadline = new Date(deadline)
    if (Number.isNaN(selectedDeadline.getTime()) || selectedDeadline <= new Date()) {
      return res.status(400).json({ success: false, message: 'Choose an assignment deadline that is in the future.' })
    }
    await ComplaintAssignment.create({
      complaintId: complaint._id,
      staffId: staff._id,
      assignedBy: req.user._id,
      deadline: selectedDeadline,
    })

    const newStatus = complaint.status === 'Verified' ? 'Assigned' : 'Reassigned'
    await Complaint.findByIdAndUpdate(complaint._id, { status: newStatus })
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      status: newStatus,
      changedBy: req.user._id,
      note: `Assigned to ${staff.name}. Deadline: ${selectedDeadline.toISOString()}`,
    })

    const student = await Student.findById(complaint.studentId)
    await createNotification({
      userId: staff.userId,
      complaintId: complaint._id,
      title: 'New Complaint Assignment',
      message: `You have been assigned a ${category.name} complaint. Review its deadline and details.`,
      type: 'staff_assigned',
    })
    if (student) {
      await createNotification({
        userId: student.userId,
        complaintId: complaint._id,
        title: 'Staff Assigned',
        message: `A maintenance staff member has been assigned to your complaint.`,
        type: 'staff_assigned',
      })
    }

    res.json({ success: true, message: 'Staff assigned.', deadline: selectedDeadline, complaint: await responseComplaint(complaint._id) })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/admin/complaints/:id/deadline
async function extendDeadline(req, res, next) {
  try {
    const { deadline, note } = req.body

    const assignment = await ComplaintAssignment.findOne({ complaintId: req.params.id, isActive: true })
    if (!assignment) return res.status(404).json({ success: false, message: 'No active assignment found.' })
    if (!note || !note.trim()) return res.status(400).json({ success: false, message: 'An extension reason is required.' })
    if (assignment.deadlineExtensions.length >= 5) {
      return res.status(400).json({ success: false, message: 'This assignment has reached its five deadline extensions. Reassign the complaint to continue.' })
    }
    const oldDeadline = assignment.deadline
    const newDeadline = new Date(deadline)
    if (Number.isNaN(newDeadline.getTime()) || newDeadline <= oldDeadline || newDeadline <= new Date()) {
      return res.status(400).json({ success: false, message: 'Choose a new deadline later than the current due time.' })
    }
    const extensionHours = Math.round(((newDeadline.getTime() - oldDeadline.getTime()) / 3600000) * 10) / 10
    assignment.deadline = newDeadline
    assignment.deadlineExtensions.push({ oldDeadline, newDeadline, reason: note.trim(), extendedBy: req.user._id })
    await assignment.save()

    await Complaint.findByIdAndUpdate(req.params.id, { status: 'Deadline Extended' })
    await ComplaintStatusHistory.create({
      complaintId: req.params.id,
      status: 'Deadline Extended',
      changedBy: req.user._id,
      note: `Deadline extended by ${extensionHours} hour(s). Previous due: ${oldDeadline.toISOString()}. New due: ${newDeadline.toISOString()}. Reason: ${note.trim()}`,
    })

    const complaint = await Complaint.findById(req.params.id)
    const assignedStaff = await Staff.findById(assignment.staffId)
    const student = await Student.findById(complaint.studentId)
    if (student) {
      await createNotification({
        userId: student.userId,
        complaintId: complaint._id,
        title: 'Deadline Extended',
        message: `The resolution deadline for your complaint was extended by ${extensionHours} hour(s). New due time: ${newDeadline.toLocaleString('en-IN')}.`,
        type: 'deadline_extended',
      })
    }
    if (assignedStaff) {
      await createNotification({ userId: assignedStaff.userId, complaintId: complaint._id, title: 'Deadline Extended', message: `Your task deadline was extended by ${extensionHours} hour(s). New due time: ${newDeadline.toLocaleString('en-IN')}.`, type: 'deadline_extended' })
    }

    res.json({ success: true, message: `Deadline extended by ${extensionHours} hour(s).`, newDeadline, extensionsUsed: assignment.deadlineExtensions.length, extensionsRemaining: 5 - assignment.deadlineExtensions.length })
  } catch (err) {
    next(err)
  }
}

// GET /api/admin/analytics
async function getAnalytics(req, res, next) {
  try {
    const [byStatus, byPriority, byCategory] = await Promise.all([
      Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Complaint.aggregate([
        { $lookup: { from: 'issuecategories', localField: 'categoryId', foreignField: '_id', as: 'cat' } },
        { $unwind: '$cat' },
        { $group: { _id: '$cat.name', count: { $sum: 1 } } },
      ]),
    ])
    res.json({ success: true, analytics: { byStatus, byPriority, byCategory } })
  } catch (err) {
    next(err)
  }
}

module.exports = { listComplaints, verifyComplaint, rejectComplaint, assignComplaint, extendDeadline, getAnalytics }
