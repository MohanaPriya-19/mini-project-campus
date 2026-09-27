const router = require('express').Router()
const { body } = require('express-validator')
const { authenticate, requireRole } = require('../middleware/auth')
const upload = require('../middleware/upload')
const {
  submitComplaint, getMyComplaints, getComplaintById, getComplaintTimeline, sendOverdueReminder,
} = require('../controllers/complaintController')

const submitValidation = [
  body('categoryId').notEmpty().withMessage('Please select a category.'),
  body('description')
    .notEmpty().withMessage('Please enter a description.')
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters.')
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters.'),
  body('locationDescription')
    .trim().notEmpty().withMessage('Please enter the location or landmark, for example K Block, Ground Floor.')
    .isLength({ min: 2, max: 200 }).withMessage('Location must be between 2 and 200 characters.'),
  body('latitude')
    .notEmpty().withMessage('Unable to obtain your current location. Please enable location permission.')
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude.'),
  body('longitude')
    .notEmpty().withMessage('Unable to obtain your current location. Please enable location permission.')
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude.'),
  body('gpsAccuracy')
    .notEmpty().withMessage('GPS accuracy is required. Please capture your location again.')
    .isFloat({ min: 0, max: 10000 }).withMessage('Invalid GPS accuracy.'),
]

router.post(
  '/',
  authenticate,
  requireRole('student'),
  upload.single('image'),
  submitValidation,
  submitComplaint
)

router.get('/', authenticate, requireRole('student'), getMyComplaints)
router.post('/:id/overdue-reminder', authenticate, requireRole('student'), sendOverdueReminder)
router.get('/:id', authenticate, getComplaintById)
router.get('/:id/timeline', authenticate, getComplaintTimeline)

module.exports = router
