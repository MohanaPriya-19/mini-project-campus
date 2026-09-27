const Student = require('../models/Student')
const Complaint = require('../models/Complaint')
const Notification = require('../models/Notification')

// GET /api/students/dashboard
async function getDashboard(req, res, next) {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean()
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' })

    const [complaints, unreadCount] = await Promise.all([
      Complaint.find({ studentId: student._id })
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ])

    const statusSummary = complaints.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1
      return acc
    }, {})

    res.json({
      success: true,
      student: { name: student.name, rollNumber: student.rollNumber, department: student.department, points: student.points },
      recentComplaints: complaints,
      statusSummary,
      unreadNotifications: unreadCount,
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/leaderboard
async function getLeaderboard(req, res, next) {
  try {
    const top = await Student.find().sort({ points: -1 }).limit(20).select('name rollNumber department points').lean()
    res.json({ success: true, leaderboard: top })
  } catch (err) {
    next(err)
  }
}

module.exports = { getDashboard, getLeaderboard }
