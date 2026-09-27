const mongoose = require('mongoose')

const priorityRuleSchema = new mongoose.Schema(
  {
    categoryName: { type: String, required: true, trim: true },
    keywords: [{ type: String, lowercase: true, trim: true }],
    priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    weight: { type: Number, default: 1 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('PriorityRule', priorityRuleSchema)
