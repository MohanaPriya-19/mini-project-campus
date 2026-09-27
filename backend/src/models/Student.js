const mongoose = require('mongoose')

const studentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    rollNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    year: { type: Number, min: 1, max: 5 },
    phone: { type: String, trim: true },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Student', studentSchema)
