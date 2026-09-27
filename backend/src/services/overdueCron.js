const cron = require('node-cron')
const Complaint = require('../models/Complaint')
const ComplaintAssignment = require('../models/ComplaintAssignment')
const ComplaintStatusHistory = require('../models/ComplaintStatusHistory')
const { createNotification } = require('../services/notificationService')
const Student = require('../models/Student')
const Staff = require('../models/Staff')
const User = require('../models/User')

const OPEN_STATUSES = ['Assigned', 'In Progress', 'Reassigned', 'Deadline Extended']

async function checkOverdueComplaints() {
  try {
    const now = new Date()
    const overdueAssignments = await ComplaintAssignment.find({
      isActive: true,
      deadline: { $lt: now },
      status: 'Active',
    }).populate({ path: 'complaintId', match: { status: { $in: OPEN_STATUSES } } })

    for (const assignment of overdueAssignments) {
      const complaint = assignment.complaintId
      if (!complaint) continue

      await Complaint.findByIdAndUpdate(complaint._id, { status: 'Overdue' })
      await ComplaintStatusHistory.create({
        complaintId: complaint._id,
        status: 'Overdue',
        changedBy: assignment.assignedBy,
        note: 'Deadline passed — automatically marked overdue.',
      })

      const student = await Student.findOne({ _id: complaint.studentId })
      if (student) {
        await createNotification({
          userId: student.userId,
          complaintId: complaint._id,
          title: 'Complaint Overdue',
          message: 'Your complaint has passed its resolution deadline and is now marked overdue.',
          type: 'complaint_overdue',
        })
      }

      const [assignedStaff, admins] = await Promise.all([
        Staff.findById(assignment.staffId).lean(),
        User.find({ role: 'admin', isActive: true }).select('_id').lean(),
      ])
      await Promise.all([
        ...admins.map((admin) => createNotification({
          userId: admin._id,
          complaintId: complaint._id,
          title: 'Complaint Overdue',
          message: 'A complaint assignment has passed its deadline. Review the overdue task and take action.',
          type: 'complaint_overdue',
        })),
        ...(assignedStaff ? [createNotification({
          userId: assignedStaff.userId,
          complaintId: complaint._id,
          title: 'Assigned Complaint Overdue',
          message: 'Your assigned complaint has passed its resolution deadline. Please update the task or contact an administrator.',
          type: 'complaint_overdue',
        })] : []),
      ])
    }
  } catch (err) {
    console.error('Overdue cron error:', err.message)
  }
}

function startOverdueCron() {
  // Runs every hour
  cron.schedule('0 * * * *', checkOverdueComplaints)
  checkOverdueComplaints()
  console.log('Overdue complaint cron job started.')
}

module.exports = { startOverdueCron }
