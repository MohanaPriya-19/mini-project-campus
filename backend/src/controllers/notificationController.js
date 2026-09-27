const Notification = require('../models/Notification')
const Student = require('../models/Student')

// GET /api/notifications
async function getNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false })
    res.json({ success: true, notifications, unreadCount })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true }
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

module.exports = { getNotifications, markRead, markAllRead }
