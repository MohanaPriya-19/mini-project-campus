const router = require('express').Router()
const { body } = require('express-validator')
const { authenticate, requireRole } = require('../middleware/auth')
const upload = require('../middleware/upload')
const {
  listComplaints, verifyComplaint, rejectComplaint, assignComplaint, extendDeadline, getAnalytics,
} = require('../controllers/adminController')
const {
  getProfile, updateProfile, getMyTasks, updateTaskStatus, addWorkUpdate, uploadResolutionProof, markUnableToResolve,
} = require('../controllers/staffController')
const { getNotifications, markRead, markAllRead } = require('../controllers/notificationController')
const { verify: verifyLocation } = require('../controllers/locationController')
const { listEvents, getEventById, createEvent, updateEvent } = require('../controllers/eventController')
const { getDashboard, getLeaderboard } = require('../controllers/studentController')
const IssueCategory = require('../models/IssueCategory')
const Staff = require('../models/Staff')
const { validateTechnical, validateSemantic } = require('../services/imageValidationService')

// ── Categories ──────────────────────────────────────────────────────────────────
router.get('/categories', authenticate, async (req, res, next) => {
  try {
    const categories = await IssueCategory.find({ isActive: true }).select('_id name').lean()
    res.json({ success: true, categories })
  } catch (err) { next(err) }
})

// ── Image validation (pre-submission AI check) ─────────────────────────────────
router.post('/uploads/validate-image', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    console.log('[IMAGE VALIDATION] request received')
    if (!req.file) {
      console.warn('[IMAGE VALIDATION] image missing')
      return res.status(400).json({ success: false, message: 'No image was received by the server.' })
    }
    console.log('[IMAGE VALIDATION] image received')
    console.log('[IMAGE VALIDATION] image path:', req.file.path)
    console.log('[IMAGE VALIDATION] image size:', req.file.size)
    const { description, category } = req.body
    if (!description || !category) {
      return res.status(400).json({ success: false, message: 'description and category are required.' })
    }
    const techCheck = await validateTechnical(req.file)
    if (!techCheck.valid) return res.status(400).json({ success: false, message: techCheck.reason })
    const aiResult = await validateSemantic(req.file.path, description, category)
    res.json({ success: true, validation: aiResult })
  } catch (err) { next(err) }
})

// ── Staff list for admin assignment ──────────────────────────────────────────────
router.get('/admin/staff', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { skill } = req.query
    const filter = skill ? { skills: skill, isAvailable: true } : { isAvailable: true }
    const staff = await Staff.find(filter).select('_id name employeeCode department skills isAvailable').lean()
    res.json({ success: true, staff })
  } catch (err) { next(err) }
})

// ── Location ──────────────────────────────────────────────────────────────────
router.post('/location/verify', authenticate, verifyLocation)

// ── Student ───────────────────────────────────────────────────────────────────
router.get('/students/dashboard', authenticate, requireRole('student'), getDashboard)

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications', authenticate, getNotifications)
router.patch('/notifications/read-all', authenticate, markAllRead)
router.patch('/notifications/:id/read', authenticate, markRead)

// ── Events (student) ──────────────────────────────────────────────────────────
router.get('/events', authenticate, listEvents)
router.get('/events/:id', authenticate, getEventById)

// ── Leaderboard ───────────────────────────────────────────────────────────────
router.get('/leaderboard', authenticate, getLeaderboard)

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/complaints', authenticate, requireRole('admin'), listComplaints)

// GET /api/admin/complaints/:id
router.get('/admin/complaints/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const Complaint = require('../models/Complaint')
    const ComplaintAttachment = require('../models/ComplaintAttachment')
    const ComplaintAssignment = require('../models/ComplaintAssignment')
    const ComplaintStatusHistory = require('../models/ComplaintStatusHistory')
    const complaint = await Complaint.findById(req.params.id)
      .populate('categoryId', 'name requiredSkill')
      .populate('studentId', 'rollNumber name department year')
      .lean()
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' })
    const assignmentAllowed = !['Reported', 'Rejected', 'Repetitive'].includes(complaint.status)
    const [attachments, assignment, history] = await Promise.all([
      ComplaintAttachment.find({ complaintId: complaint._id }).lean(),
      assignmentAllowed
        ? ComplaintAssignment.findOne({ complaintId: complaint._id, isActive: true })
          .populate('staffId', 'name employeeCode skills').lean()
        : null,
      ComplaintStatusHistory.find({ complaintId: complaint._id }).sort({ createdAt: 1 }).lean(),
    ])
    res.json({ success: true, complaint: { ...complaint, attachments, assignment, history } })
  } catch (err) { next(err) }
})

router.patch(
  '/admin/complaints/:id/verify',
  authenticate, requireRole('admin'),
  verifyComplaint
)
router.patch(
  '/admin/complaints/:id/reject',
  authenticate, requireRole('admin'),
  [body('reason').notEmpty().withMessage('Rejection reason is required.')],
  rejectComplaint
)
router.patch(
  '/admin/complaints/:id/assign',
  authenticate, requireRole('admin'),
  [
    body('staffId').notEmpty().withMessage('Staff ID is required.'),
    body('deadline').isISO8601().withMessage('Choose a valid assignment date and time.'),
  ],
  assignComplaint
)
router.patch('/admin/complaints/:id/deadline', authenticate, requireRole('admin'), [
  body('deadline').isISO8601().withMessage('Choose a valid extended date and time.'),
  body('note').trim().notEmpty().withMessage('An extension reason is required.'),
], extendDeadline)
router.get('/admin/analytics', authenticate, requireRole('admin'), getAnalytics)
router.post('/admin/events', authenticate, requireRole('admin'), createEvent)
router.patch('/admin/events/:id', authenticate, requireRole('admin'), updateEvent)

// ── Staff ─────────────────────────────────────────────────────────────────────
router.get('/staff/profile', authenticate, requireRole('staff'), getProfile)
router.patch('/staff/profile', authenticate, requireRole('staff'), updateProfile)
router.patch('/staff/availability', authenticate, requireRole('staff'), updateProfile)
router.get('/staff/tasks', authenticate, requireRole('staff'), getMyTasks)
router.patch('/staff/tasks/:id/status', authenticate, requireRole('staff'), updateTaskStatus)
router.post('/staff/tasks/:id/work-update', authenticate, requireRole('staff'), addWorkUpdate)
router.post(
  '/staff/tasks/:id/resolution-proof',
  authenticate, requireRole('staff'),
  upload.single('photo'),
  [
    body('resolutionNote').notEmpty().withMessage('Resolution note is required.'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Current location is required for resolution proof.'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Current location is required for resolution proof.'),
    body('gpsAccuracy').isFloat({ min: 0, max: 10000 }).withMessage('GPS accuracy is required for resolution proof.'),
  ],
  uploadResolutionProof
)
router.patch('/staff/tasks/:id/unable-to-resolve', authenticate, requireRole('staff'), markUnableToResolve)

module.exports = router
