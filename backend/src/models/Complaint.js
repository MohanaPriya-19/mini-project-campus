const mongoose = require('mongoose')

const STATUSES = [
  'Reported', 'Verified', 'Rejected', 'Assigned', 'In Progress',
  'Overdue', 'Unable to Resolve', 'Reassigned', 'Deadline Extended',
  'Resolved', 'Closed', 'Repetitive',
]

const complaintSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueCategory', required: true },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    status: { type: String, enum: STATUSES, default: 'Reported' },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    tokenId: { type: String, unique: true, sparse: true },
    // Client-generated key makes retries safe when an upload succeeds but its
    // response is lost or times out on a mobile connection.
    idempotencyKey: { type: String, unique: true, sparse: true, maxlength: 100 },

    // Location snapshot at submission time
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    gpsAccuracy: { type: Number, required: true, min: 0 },
    locationVerified: { type: Boolean, default: false },
    // Human-readable landmark supplied by the reporter; GPS is retained only
    // for backend campus-geofence verification.
    locationDescription: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },

    // Admin actions
    rejectionReason: { type: String, trim: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // AI image validation result
    imageValidation: {
      isRelevant: Boolean,
      confidence: Number,
      level: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'] },
      reason: String,
      flaggedForReview: { type: Boolean, default: false },
    },

    // Repetitive reports stay auditable but never receive an independent token
    relatedComplaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    isRepetitive: { type: Boolean, default: false },
    duplicateSuppressed: { type: Boolean, default: false },
    repetitiveCount: { type: Number, default: 0, min: 0 },
    repetitiveReason: { type: String, trim: true },
    repetitiveConfidence: { type: Number, min: 0, max: 1 },
  },
  { timestamps: true }
)

complaintSchema.index({ studentId: 1, status: 1 })
complaintSchema.index({ categoryId: 1, status: 1, latitude: 1, longitude: 1 })

module.exports = mongoose.model('Complaint', complaintSchema)
module.exports.STATUSES = STATUSES
