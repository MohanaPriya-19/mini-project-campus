const mongoose = require('mongoose')

const NOTIFICATION_TYPES = [
  'complaint_submitted', 'complaint_verified', 'complaint_rejected',
  'token_generated', 'staff_assigned', 'status_changed', 'complaint_overdue',
  'unable_to_resolve', 'deadline_extended', 'complaint_reassigned',
  'complaint_resolved', 'resolution_proof_uploaded',
  'overdue_reminder', 'repetitive_complaint',
  'event_published', 'event_updated', 'event_cancelled',
]

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'AwarenessEvent', default: null },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
