const { validationResult } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const Complaint = require('../models/Complaint')
const ComplaintAttachment = require('../models/ComplaintAttachment')
const ComplaintStatusHistory = require('../models/ComplaintStatusHistory')
const IssueCategory = require('../models/IssueCategory')
const Student = require('../models/Student')
const { verifyLocation } = require('../services/locationService')
const { validateTechnical, validateSemantic } = require('../services/imageValidationService')
const { determinePriority } = require('../services/priorityService')
const { createNotification } = require('../services/notificationService')
const ComplaintAssignment = require('../models/ComplaintAssignment')
const Notification = require('../models/Notification')
const { ACTIVE_STATUSES, findRepetitiveComplaint } = require('../services/repetitiveComplaintService')

// POST /api/complaints
async function submitComplaint(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    const { categoryId, description, latitude, longitude, gpsAccuracy, locationDescription } = req.body
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)

    // Location verification (backend re-validates — never trust client alone)
    const locationResult = verifyLocation(lat, lng, gpsAccuracy)
    if (!locationResult.locationVerified) {
      return res.status(400).json({ success: false, message: locationResult.message })
    }

    // Image technical validation (async — includes sharp integrity check)
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please capture an image.' })
    }
    const techCheck = await validateTechnical(req.file)
    if (!techCheck.valid) {
      return res.status(400).json({ success: false, message: techCheck.reason })
    }

    // Category lookup
    const category = await IssueCategory.findById(categoryId)
    if (!category) {
      return res.status(400).json({ success: false, message: 'Invalid issue category.' })
    }

    // Student lookup
    const student = await Student.findOne({ userId: req.user._id })
    if (!student) {
      return res.status(403).json({ success: false, message: 'Student profile not found.' })
    }

    // AI semantic validation — pass disk path (multer disk storage, no buffer)
    const aiResult = await validateSemantic(req.file.path, description, category.name)
    if (!aiResult.valid && process.env.AI_ENABLED === 'true') {
      return res.status(422).json({ success: false, message: aiResult.reason || 'This complaint could not be verified. Please upload a relevant image and provide an accurate description.', validation: aiResult })
    }

    // Priority determination
    const priority = await determinePriority(category.name, description, category.defaultPriority)

    // Only active, same-category nearby issues are candidates. The final
    // similarity decision is server-side so clients cannot bypass it.
    const candidates = await Complaint.find({ categoryId: category._id, status: { $in: ACTIVE_STATUSES }, isRepetitive: { $ne: true } }).lean()
    const repetitiveMatch = findRepetitiveComplaint(candidates, { latitude: lat, longitude: lng, description })

    // Create complaint (repetitive reports are retained for RCA, without token/assignment)
    const complaint = await Complaint.create({
      studentId: student._id,
      categoryId: category._id,
      description,
      latitude: lat,
      longitude: lng,
      gpsAccuracy: Number(gpsAccuracy),
      locationVerified: true,
      locationDescription: locationDescription.trim(),
      priority,
      imageValidation: aiResult,
      ...(repetitiveMatch ? {
        status: 'Repetitive', isRepetitive: true, relatedComplaintId: repetitiveMatch.complaint._id,
        repetitiveConfidence: repetitiveMatch.confidence,
        repetitiveReason: 'A similar active complaint exists in the same campus area.',
      } : {}),
    })

    // Save complaint photo attachment
    const fileUrl = `/uploads/${req.file.filename}`
    await ComplaintAttachment.create({
      complaintId: complaint._id,
      fileUrl,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      attachmentType: 'complaint_photo',
      uploadedBy: req.user._id,
    })

    // Initial status history
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      status: complaint.status,
      changedBy: req.user._id,
      note: repetitiveMatch ? 'Repetitive complaint linked to an active issue.' : 'Complaint submitted by student.',
    })

    // Notify student
    await createNotification({
      userId: req.user._id,
      complaintId: complaint._id,
      title: 'Complaint Submitted',
      message: repetitiveMatch ? 'Your report was recorded and linked to an issue already being processed in this area. No separate token was generated.' : `Your complaint about ${category.name} has been submitted and is awaiting verification.`,
      type: repetitiveMatch ? 'repetitive_complaint' : 'complaint_submitted',
    })
    const User = require('../models/User')
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean()
    await Promise.all(admins.flatMap((admin) => repetitiveMatch ? [
      createNotification({ userId: admin._id, complaintId: complaint._id, title: 'Repetitive Complaint Reported', message: 'A new report was linked to an active ' + category.name + ' complaint.', type: 'repetitive_complaint' }),
    ] : [
      createNotification({ userId: admin._id, complaintId: complaint._id, title: 'New Complaint Received', message: 'A new ' + category.name + ' complaint requires verification.', type: 'complaint_submitted' }),
      createNotification({ userId: admin._id, complaintId: complaint._id, title: 'Complaint Requires Verification', message: 'Review the submitted complaint and approve or reject it.', type: 'complaint_submitted' }),
    ]))
    if (repetitiveMatch) {
      await Complaint.findByIdAndUpdate(repetitiveMatch.complaint._id, { $inc: { repetitiveCount: 1 } })
      const assignment = await ComplaintAssignment.findOne({ complaintId: repetitiveMatch.complaint._id, isActive: true }).populate('staffId', 'userId')
      if (assignment?.staffId?.userId) await createNotification({ userId: assignment.staffId.userId, complaintId: repetitiveMatch.complaint._id, title: 'Additional Report Received', message: 'Another student reported a similar issue in your assigned area.', type: 'repetitive_complaint' })
    }

    res.status(201).json({
      success: true,
      message: repetitiveMatch ? 'Repetitive complaint recorded and linked to the active issue.' : 'Complaint submitted successfully. Awaiting administrator verification.',
      complaint: {
        id: complaint._id,
        status: complaint.status,
        priority: complaint.priority,
        imageValidation: aiResult.flaggedForReview
          ? { flaggedForReview: true, reason: aiResult.reason }
          : { flaggedForReview: false },
        isRepetitive: Boolean(repetitiveMatch), relatedComplaintId: repetitiveMatch?.complaint._id || null,
      },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/complaints — student's own complaints
async function getMyComplaints(req, res, next) {
  try {
    const student = await Student.findOne({ userId: req.user._id })
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' })

    const complaints = await Complaint.find({ studentId: student._id })
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ success: true, complaints })
  } catch (err) {
    next(err)
  }
}

// GET /api/complaints/:id
async function getComplaintById(req, res, next) {
  try {
    const student = await Student.findOne({ userId: req.user._id })
    const complaint = await Complaint.findById(req.params.id)
      .populate('categoryId', 'name')
      .lean()

    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' })

    // Students can only view their own complaints
    if (req.user.role === 'student' && !complaint.studentId.equals(student._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const attachments = await ComplaintAttachment.find({ complaintId: complaint._id }).lean()
    res.json({ success: true, complaint: { ...complaint, attachments } })
  } catch (err) {
    next(err)
  }
}

// GET /api/complaints/:id/timeline
async function getComplaintTimeline(req, res, next) {
  try {
    const student = await Student.findOne({ userId: req.user._id })
    const complaint = await Complaint.findById(req.params.id).lean()

    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' })

    if (req.user.role === 'student' && !complaint.studentId.equals(student._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const history = await ComplaintStatusHistory.find({ complaintId: complaint._id })
      .sort({ createdAt: 1 })
      .lean()

    res.json({ success: true, timeline: history })
  } catch (err) {
    next(err)
  }
}

async function sendOverdueReminder(req, res, next) {
  try {
    const student = await Student.findOne({ userId: req.user._id })
    const complaint = await Complaint.findById(req.params.id)
    if (!student || !complaint || !complaint.studentId.equals(student._id)) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' })
    }
    if (complaint.status !== 'Overdue') {
      return res.status(400).json({ success: false, message: 'A reminder can be sent only after this complaint is marked overdue.' })
    }

    const cooldownMs = Number(process.env.OVERDUE_REMINDER_COOLDOWN_MS || 43200000)
    const lastReminder = await Notification.findOne({
      complaintId: complaint._id,
      type: 'overdue_reminder',
      title: 'Overdue Complaint Reminder',
    }).sort({ createdAt: -1 }).lean()
    if (lastReminder && Date.now() - new Date(lastReminder.createdAt).getTime() < cooldownMs) {
      return res.status(429).json({ success: false, message: 'Reminder already sent recently. Please try again later.' })
    }

    const assignment = await ComplaintAssignment.findOne({ complaintId: complaint._id, isActive: true }).lean()
    if (!assignment) {
      return res.status(400).json({ success: false, message: 'This overdue complaint has no active staff assignment.' })
    }
    const User = require('../models/User')
    const Staff = require('../models/Staff')
    const [admins, assignedStaff] = await Promise.all([
      User.find({ role: 'admin', isActive: true }).select('_id').lean(),
      Staff.findById(assignment.staffId).lean(),
    ])
    if (!assignedStaff) {
      return res.status(400).json({ success: false, message: 'The assigned staff member could not be found.' })
    }

    const token = complaint.tokenId || String(complaint._id)
    await Promise.all([
      ...admins.map((admin) => createNotification({
        userId: admin._id, complaintId: complaint._id, type: 'overdue_reminder',
        title: 'Overdue Complaint Reminder',
        message: `Student has sent a reminder for overdue complaint ${token}.`,
      })),
      createNotification({
        userId: assignedStaff.userId, complaintId: complaint._id, type: 'overdue_reminder',
        title: 'Overdue Complaint Reminder',
        message: `Student has sent a reminder regarding overdue complaint ${token}.`,
      }),
    ])
    await ComplaintStatusHistory.create({
      complaintId: complaint._id, status: 'Overdue', changedBy: req.user._id,
      note: 'Student sent an overdue reminder to the assigned staff member and administrators.',
    })
    res.json({ success: true, message: 'Reminder sent to Admin and assigned staff.' })
  } catch (err) {
    next(err)
  }
}

module.exports = { submitComplaint, getMyComplaints, getComplaintById, getComplaintTimeline, sendOverdueReminder }
