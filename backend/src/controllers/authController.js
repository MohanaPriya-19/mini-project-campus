const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const User = require('../models/User')
const Student = require('../models/Student')
const Staff = require('../models/Staff')

function issueToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

// POST /api/auth/login
// identifier can be:
//   student  → rollNumber (e.g. 21CS001)
//   staff    → employeeCode (e.g. EMP001) OR email (e.g. murugan@psgtech.ac.in)
//   admin    → email (e.g. admin@psgtech.ac.in)
async function login(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    const { identifier, password } = req.body
    const id = identifier.trim()

    let user = null
    let profile = null

    // ── 1. Try student by roll number (uppercase) ──────────────────────────
    const student = await Student.findOne({ rollNumber: id.toUpperCase() })
    if (student) {
      user = await User.findById(student.userId)
      profile = {
        rollNumber: student.rollNumber,
        name: student.name,
        department: student.department,
        year: student.year,
        points: student.points,
      }
    }

    // ── 2. Try staff by employee code (uppercase) ──────────────────────────
    if (!user) {
      const staff = await Staff.findOne({ employeeCode: id.toUpperCase() })
      if (staff) {
        user = await User.findById(staff.userId)
        profile = {
          employeeCode: staff.employeeCode,
          name: staff.name,
          skills: staff.skills,
          department: staff.department,
        }
      }
    }

    // ── 3. Try by email (admin or staff) ───────────────────────────────────
    if (!user) {
      user = await User.findOne({ email: id.toLowerCase() })
      if (user) {
        if (user.role === 'staff') {
          const staff = await Staff.findOne({ userId: user._id })
          profile = staff
            ? { employeeCode: staff.employeeCode, name: staff.name, skills: staff.skills, department: staff.department }
            : {}
        } else if (user.role === 'admin') {
          profile = { email: user.email }
        } else if (user.role === 'student') {
          const stu = await Student.findOne({ userId: user._id })
          profile = stu
            ? { rollNumber: stu.rollNumber, name: stu.name, department: stu.department, year: stu.year, points: stu.points }
            : {}
        }
      }
    }

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' })
    }

    const valid = await user.comparePassword(password)
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' })
    }

    const token = issueToken(user._id, user.role)

    res.json({
      success: true,
      token,
      user: { id: user._id, role: user.role, ...profile },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const user = req.user
    let profile = {}

    if (user.role === 'student') {
      const student = await Student.findOne({ userId: user._id })
      if (student) {
        profile = {
          rollNumber: student.rollNumber,
          name: student.name,
          department: student.department,
          year: student.year,
          points: student.points,
        }
      }
    } else if (user.role === 'staff') {
      const staff = await Staff.findOne({ userId: user._id })
      if (staff) {
        profile = {
          employeeCode: staff.employeeCode,
          name: staff.name,
          skills: staff.skills,
          department: staff.department,
        }
      }
    } else {
      profile = { email: user.email }
    }

    res.json({ success: true, user: { id: user._id, role: user.role, ...profile } })
  } catch (err) {
    next(err)
  }
}

module.exports = { login, me }
