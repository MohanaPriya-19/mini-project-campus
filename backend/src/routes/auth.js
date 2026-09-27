const router = require('express').Router()
const { body } = require('express-validator')
const { login, me } = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')

router.post(
  '/login',
  [
    body('identifier').notEmpty().withMessage('Roll number or email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  login
)

router.get('/me', authenticate, me)

// POST /api/auth/logout — client-side token drop; server just confirms
router.post('/logout', authenticate, (req, res) => {
  res.json({ success: true, message: 'Logged out.' })
})

module.exports = router
