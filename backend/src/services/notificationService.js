const Notification = require('../models/Notification')

async function createNotification({ userId, complaintId, eventId, title, message, type }) {
  try {
    await Notification.create({ userId, complaintId: complaintId || null, eventId: eventId || null, title, message, type })
  } catch (err) {
    // Notifications are non-critical — log but don't crash the request
    console.error('Failed to create notification:', err.message)
  }
}

module.exports = { createNotification }
