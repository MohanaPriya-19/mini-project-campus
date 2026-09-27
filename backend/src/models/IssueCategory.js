const mongoose = require('mongoose')

const issueCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    requiredSkill: { type: String, trim: true },
    defaultPriority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('IssueCategory', issueCategorySchema)
