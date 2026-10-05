const { validationResult } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const mongoose = require('mongoose')
const fs = require('fs/promises')
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

async function removeUploadedFile(file) {
  if (file?.path) await fs.unlink(file.path).catch(() => {})
}

async function getIssueSummary(complaint, categoryName) {
  if (!complaint) return null
  const attachment = await ComplaintAttachment.findOne({ complaintId: complaint._id, attachmentType: 'complaint_photo' })
    .select('fileUrl').lean()
  return {
    id: complaint._id,
    category: categoryName || complaint.categoryId?.name || 'Campus issue',
    description: complaint.description,
    imageUrl: attachment?.fileUrl || null,
    status: complaint.status,
    reportedAt: complaint.createdAt,
  }
}

function submittedResponse(complaint, { message, duplicate = false, duplicateType, existingIssue } = {}) {
  return {
    success: true,
    message: message || 'Complaint submitted successfully. Awaiting administrator verification.',
    duplicate,
    ...(duplicateType ? { duplicateType } : {}),
    ...(existingIssue ? { existingIssue } : {}),
    complaint: {
      id: complaint._id,
      status: complaint.status,
      priority: complaint.priority,
      imageValidation: complaint.imageValidation?.flaggedForReview
        ? { flaggedForReview: true, reason: complaint.imageValidation.reason }
        : { flaggedForReview: false },
      isRepetitive: Boolean(complaint.isRepetitive),
      relatedComplaintId: complaint.relatedComplaintId || null,
    },
  }
}

// POST /api/complaints
async function submitComplaint(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    const { categoryId, description, latitude, longitude, gpsAccuracy, locationDescription } = req.body
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim().slice(0, 100)

    // A request can reach the database while its response is lost on mobile.
    // Return that saved result for retries instead of creating another record.
    const student = await Student.findOne({ userId: req.user._id })
    if (!student) {
      return res.status(403).json({ success: false, message: 'Student profile not found.' })
    }
    if (idempotencyKey) {
      const prior = await Complaint.findOne({ studentId: student._id, idempotencyKey }).lean()
      if (prior) {
        await removeUploadedFile(req.file)
        const related = prior.isRepetitive
          ? await Complaint.findById(prior.relatedComplaintId).populate('categoryId', 'name').lean()
          : null
        const existingIssue = related ? await getIssueSummary(related, related.categoryId?.name).catch(() => null) : null
        return res.status(200).json(submittedResponse(prior, {
          message: prior.isRepetitive
            ? 'This issue has already been reported by another student, and it is being looked into.'
            : 'Your complaint was submitted successfully and is awaiting administrator verification.',
          duplicate: Boolean(prior.isRepetitive),
          duplicateType: prior.isRepetitive ? 'other_reporter' : undefined,
          existingIssue,
        }))
      }
    }
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
    const repetitiveMatch = findRepetitiveComplaint(candidates, {
      latitude: lat, longitude: lng, description, locationDescription,
    })

    const alreadyReportedByStudent = repetitiveMatch && (
      String(repetitiveMatch.complaint.studentId) === String(student._id) ||
      await Complaint.exists({
        studentId: student._id,
        relatedComplaintId: repetitiveMatch.complaint._id,
        isRepetitive: true,
      })
    )
    if (alreadyReportedByStudent) {
      await removeUploadedFile(req.file)
      const ownMatches = candidates.filter((candidate) =>
        String(candidate.studentId) === String(student._id) &&
        Boolean(findRepetitiveComplaint([candidate], {
          latitude: lat, longitude: lng, description, locationDescription,
        }))
      ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      const canonical = ownMatches[0] || repetitiveMatch.complaint
      const duplicateIds = ownMatches
        .filter((candidate) => String(candidate._id) !== String(canonical._id) && candidate.status === 'Reported' && !candidate.isRepetitive)
        .map((candidate) => candidate._id)
      if (duplicateIds.length) {
        try {
          await Complaint.updateMany({ _id: { $in: duplicateIds } }, {
            $set: {
              status: 'Repetitive', isRepetitive: true, duplicateSuppressed: true,
              relatedComplaintId: canonical._id,
              repetitiveReason: 'Duplicate submission from the same student; retained for audit but excluded from issue counts.',
            },
          })
          await ComplaintStatusHistory.insertMany(duplicateIds.map((complaintId) => ({
            complaintId, status: 'Repetitive', changedBy: req.user._id,
            note: 'Duplicate submission from the same student was linked to the original report.',
          })))
        } catch (err) {
          console.error('[DUPLICATE RECONCILIATION]', err.message)
        }
      }
      const existingIssue = await getIssueSummary(canonical, category.name).catch(() => null)
      return res.status(200).json({
        success: true,
        message: 'You have already reported this issue. It is being looked into.',
        duplicate: true,
        duplicateType: 'same_reporter',
        existingIssue,
        complaint: {
          id: canonical._id,
          status: canonical.status,
          priority: canonical.priority,
          isRepetitive: false,
          relatedComplaintId: null,
        },
      })
    }

    // Create complaint (repetitive reports are retained for RCA, without token/assignment)
    const complaint = new Complaint({
      _id: new mongoose.Types.ObjectId(),
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
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(repetitiveMatch ? {
        status: 'Repetitive', isRepetitive: true, relatedComplaintId: repetitiveMatch.complaint._id,
        repetitiveConfidence: repetitiveMatch.confidence,
        repetitiveReason: 'A similar active complaint exists in the same campus area.',
      } : {}),
    })

    // Persist all required supporting records before the complaint itself.
    // The complaint is the success marker, so a failed response never follows
    // a partially saved complaint that would appear submitted to administrators.
    const fileUrl = `/uploads/${req.file.filename}`
    try {
      await ComplaintAttachment.create({
        complaintId: complaint._id,
        fileUrl,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        attachmentType: 'complaint_photo',
        uploadedBy: req.user._id,
      })
      await ComplaintStatusHistory.create({
        complaintId: complaint._id,
        status: complaint.status,
        changedBy: req.user._id,
        note: repetitiveMatch ? 'Repetitive complaint linked to an active issue.' : 'Complaint submitted by student.',
      })
      await complaint.save()
    } catch (err) {
      await Promise.all([
        ComplaintAttachment.deleteMany({ complaintId: complaint._id }).catch(() => {}),
        ComplaintStatusHistory.deleteMany({ complaintId: complaint._id }).catch(() => {}),
        removeUploadedFile(req.file),
      ])
      if (err.code !== 11000 || !idempotencyKey) throw err
      const prior = await Complaint.findOne({ studentId: student._id, idempotencyKey }).lean()
      if (!prior) throw err
      const related = prior.isRepetitive
        ? await Complaint.findById(prior.relatedComplaintId).populate('categoryId', 'name').lean()
        : null
      const existingIssue = related ? await getIssueSummary(related, related.categoryId?.name).catch(() => null) : null
      return res.status(200).json(submittedResponse(prior, {
        message: prior.isRepetitive
          ? 'This issue has already been reported by another student, and it is being looked into.'
          : 'Your complaint was submitted successfully and is awaiting administrator verification.',
        duplicate: Boolean(prior.isRepetitive),
        duplicateType: prior.isRepetitive ? 'other_reporter' : undefined,
        existingIssue,
      }))
    }

    const existingIssue = repetitiveMatch
      ? await getIssueSummary(repetitiveMatch.complaint, category.name).catch(() => null)
      : null
    res.status(201).json(submittedResponse(complaint, {
      message: repetitiveMatch
        ? 'This issue has already been reported by another student, and it is being looked into.'
        : 'Complaint submitted successfully. Awaiting administrator verification.',
      duplicate: Boolean(repetitiveMatch),
      duplicateType: repetitiveMatch ? 'other_reporter' : undefined,
      existingIssue,
    }))

    // Notification failures must never turn a successfully stored complaint
    // into a failure response that prompts a student to submit it again.
    Promise.resolve().then(async () => {
      await createNotification({
        userId: req.user._id,
        complaintId: complaint._id,
        title: repetitiveMatch ? 'Additional Issue Reported' : 'Complaint Submitted',
        message: repetitiveMatch
          ? 'Your report was linked to an issue another student already reported. It is being looked into.'
          : `Your complaint about ${category.name} has been submitted and is awaiting verification.`,
        type: repetitiveMatch ? 'repetitive_complaint' : 'complaint_submitted',
      })
      const User = require('../models/User')
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean()
      await Promise.all(admins.map((admin) => createNotification({
        userId: admin._id,
        complaintId: complaint._id,
        title: repetitiveMatch ? 'Repetitive Complaint Reported' : 'New Complaint Received',
        message: repetitiveMatch
          ? `A student reported an additional ${category.name} issue that matches an active complaint.`
          : `A new ${category.name} complaint requires verification.`,
        type: repetitiveMatch ? 'repetitive_complaint' : 'complaint_submitted',
      })))
      if (repetitiveMatch) {
        await Complaint.findByIdAndUpdate(repetitiveMatch.complaint._id, { $inc: { repetitiveCount: 1 } })
        const assignment = await ComplaintAssignment.findOne({ complaintId: repetitiveMatch.complaint._id, isActive: true }).populate('staffId', 'userId')
        if (assignment?.staffId?.userId) await createNotification({
          userId: assignment.staffId.userId,
          complaintId: repetitiveMatch.complaint._id,
          title: 'Additional Report Received',
          message: 'Another student reported a similar issue in your assigned area.',
          type: 'repetitive_complaint',
        })
      }
    }).catch((err) => console.error('[COMPLAINT FOLLOW-UP]', err.message))
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
