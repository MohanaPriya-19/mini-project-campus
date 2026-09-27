const mongoose = require('mongoose')

const staffSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    department: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Staff', staffSchema)
