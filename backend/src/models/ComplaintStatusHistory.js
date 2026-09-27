const mongoose = require('mongoose')

const complaintStatusHistorySchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
)

complaintStatusHistorySchema.index({ complaintId: 1, createdAt: 1 })

module.exports = mongoose.model('ComplaintStatusHistory', complaintStatusHistorySchema)
