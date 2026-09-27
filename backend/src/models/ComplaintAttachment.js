const mongoose = require('mongoose')

const complaintAttachmentSchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    attachmentType: {
      type: String,
      enum: ['complaint_photo', 'resolution_photo'],
      required: true,
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

complaintAttachmentSchema.index({ complaintId: 1, attachmentType: 1 })

module.exports = mongoose.model('ComplaintAttachment', complaintAttachmentSchema)
