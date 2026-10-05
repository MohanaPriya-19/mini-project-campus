const AwarenessEvent = require('../models/AwarenessEvent')
const Notification = require('../models/Notification')
const User = require('../models/User')
const { createNotification } = require('../services/notificationService')

// GET /api/events — published, non-cancelled only (students)
async function listEvents(req, res, next) {
  try {
    const events = await AwarenessEvent.find({ isPublished: true, isCancelled: false })
      .sort({ date: 1 })
      .lean()
    res.json({ success: true, events })
  } catch (err) {
    next(err)
  }
}

// GET /api/events/:id
async function getEventById(req, res, next) {
  try {
    const event = await AwarenessEvent.findOne({
      _id: req.params.id,
      isPublished: true,
      isCancelled: false,
    }).lean()
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' })
    res.json({ success: true, event })
  } catch (err) {
    next(err)
  }
}

// POST /api/admin/events
async function createEvent(req, res, next) {
  try {
    const event = await AwarenessEvent.create({ ...req.body, createdBy: req.user._id })
    if (event.isPublished) {
      const students = await User.find({ role: 'student', isActive: true }).select('_id').lean()
      await Promise.all(students.map((student) => createNotification({
        userId: student._id, eventId: event._id, title: 'New Sustainability Event',
        message: `A new sustainability event, "${event.title}", has been published.`, type: 'event_published',
      })))
    }
    res.status(201).json({ success: true, event })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/admin/events/:id
async function updateEvent(req, res, next) {
  try {
    const event = await AwarenessEvent.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' })

    // Notify all students if published event is updated or cancelled
    if (req.body.isCancelled) {
      const students = await User.find({ role: 'student', isActive: true }).select('_id')
      for (const s of students) {
        await createNotification({
          userId: s._id,
          eventId: event._id,
          title: 'Sustainability Event Cancelled',
          message: `The sustainability event "${event.title}" has been cancelled.`,
          type: 'event_cancelled',
        })
      }
    } else if (event.isPublished) {
      const students = await User.find({ role: 'student', isActive: true }).select('_id')
      for (const s of students) {
        await createNotification({
          userId: s._id,
          eventId: event._id,
          title: 'Sustainability Event Updated',
          message: `The sustainability event "${event.title}" has been updated.`,
          type: 'event_updated',
        })
      }
    }

    res.json({ success: true, event })
  } catch (err) {
    next(err)
  }
}

module.exports = { listEvents, getEventById, createEvent, updateEvent }
