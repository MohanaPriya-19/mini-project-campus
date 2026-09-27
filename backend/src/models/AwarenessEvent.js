const mongoose = require('mongoose')

const EVENT_TYPES = [
  'Awareness Campaign', 'Tree Plantation', 'Sustainability Drive',
  'Cleanliness Drive', 'Rally', 'Workshop', 'Seminar',
  'Environmental Program', 'Other',
]

const awarenessEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    description: { type: String, trim: true },
    date: { type: Date, required: true },
    startTime: { type: String },
    endTime: { type: String },
    location: { type: String, trim: true },
    organizer: { type: String, trim: true },
    audience: { type: String, trim: true },
    maxParticipants: { type: Number },
    imageUrl: { type: String },
    isPublished: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

awarenessEventSchema.index({ isPublished: 1, isCancelled: 1, date: 1 })

module.exports = mongoose.model('AwarenessEvent', awarenessEventSchema)
