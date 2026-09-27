const mongoose = require('mongoose')

const complaintAssignmentSchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deadline: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    resolvedAt: { type: Date },
    unableToResolveReason: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Active', 'Resolved', 'Unable to Resolve', 'Reassigned'],
      default: 'Active',
    },
    deadlineExtensions: [{
      oldDeadline: { type: Date, required: true },
      newDeadline: { type: Date, required: true },
      reason: { type: String, required: true, trim: true },
      extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      extendedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
)

complaintAssignmentSchema.index({ complaintId: 1, isActive: 1 })

module.exports = mongoose.model('ComplaintAssignment', complaintAssignmentSchema)
