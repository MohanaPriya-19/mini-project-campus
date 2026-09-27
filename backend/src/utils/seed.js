/**
 * Seed script — run once to populate initial data.
 * Usage: node src/utils/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const dns = require('dns')

// The seed command is its own Node process, so it must configure Atlas SRV
// DNS before Mongoose is loaded just as the backend server does.
dns.setServers(['8.8.8.8', '1.1.1.1'])
const mongoose = require('mongoose')
const User = require('../models/User')
const Student = require('../models/Student')
const Staff = require('../models/Staff')
const IssueCategory = require('../models/IssueCategory')
const PriorityRule = require('../models/PriorityRule')
const Complaint = require('../models/Complaint')
const ComplaintAssignment = require('../models/ComplaintAssignment')
const ComplaintStatusHistory = require('../models/ComplaintStatusHistory')
const Notification = require('../models/Notification')
const AwarenessEvent = require('../models/AwarenessEvent')

const CATEGORIES = [
  { name: 'Water', requiredSkill: 'Plumbing', defaultPriority: 'Medium' },
  { name: 'Infrastructure', requiredSkill: 'Civil Maintenance', defaultPriority: 'Medium' },
  { name: 'Electrical', requiredSkill: 'Electrical', defaultPriority: 'High' },
  { name: 'Waste', requiredSkill: 'Waste Management', defaultPriority: 'Low' },
  { name: 'Cleanliness', requiredSkill: 'Waste Management', defaultPriority: 'Low' },
  { name: 'Energy', requiredSkill: 'Electrical', defaultPriority: 'High' },
  { name: 'Safety', requiredSkill: 'Civil Maintenance', defaultPriority: 'High' },
]

const PRIORITY_RULES = [
  { categoryName: 'Electrical', keywords: ['sparking', 'exposed wire', 'fire', 'shock', 'burning'], priority: 'High', weight: 10 },
  { categoryName: 'Electrical', keywords: ['flickering', 'not working', 'bulb'], priority: 'Medium', weight: 5 },
  { categoryName: 'Water', keywords: ['flooding', 'burst pipe', 'overflow', 'sewage'], priority: 'High', weight: 10 },
  { categoryName: 'Water', keywords: ['dripping', 'leaking', 'tap'], priority: 'Medium', weight: 5 },
  { categoryName: 'Infrastructure', keywords: ['collapsed', 'broken wall', 'ceiling fell', 'crack'], priority: 'High', weight: 10 },
  { categoryName: 'Waste', keywords: ['overflow', 'blocking', 'hazardous'], priority: 'High', weight: 8 },
]

// Staff use @psgtech.ac.in emails
// Login identifier = employeeCode (e.g. EMP001) OR email (e.g. murugan@psgtech.ac.in)
const STAFF_SEED = [
  {
    email: 'murugan@psgtech.ac.in',
    code: 'EMP001',
    name: 'Murugan K',
    skills: ['Plumbing', 'Water'],
  },
  {
    email: 'latha@psgtech.ac.in',
    code: 'EMP002',
    name: 'Latha R',
    skills: ['Electrical', 'Energy'],
  },
  {
    email: 'suresh@psgtech.ac.in',
    code: 'EMP003',
    name: 'Suresh Babu',
    skills: ['Waste Management', 'Waste', 'Cleanliness'],
  },
  {
    email: 'priya@psgtech.ac.in',
    code: 'EMP004',
    name: 'Priya Dharshini',
    skills: ['Civil Maintenance', 'Infrastructure'],
  },
  {
    email: 'arun@psgtech.ac.in',
    code: 'EMP005',
    name: 'Arun Prasad',
    skills: ['Civil Maintenance', 'Safety', 'Infrastructure'],
  },
]

const SYNTHETIC_STUDENTS = [
  { email: 'student.arya@psgtech.example', rollNumber: '24CSA101', name: 'Arya N', department: 'Computer Science', year: 2, points: 25 },
  { email: 'student.kavin@psgtech.example', rollNumber: '24ECE112', name: 'Kavin R', department: 'Electronics', year: 2, points: 18 },
  { email: 'student.meera@psgtech.example', rollNumber: '23ME204', name: 'Meera S', department: 'Mechanical', year: 3, points: 12 },
]

const DEMO_STUDENTS = [
  { email: 'teststudent@psgtech.ac.in', rollNumber: '21CS001', name: 'Test Student', department: 'Computer Science', year: 3 },
  { email: 'ananya.s@psgtech.ac.in', rollNumber: '23IT014', name: 'Ananya S', department: 'Information Technology', year: 3 },
  { email: 'vignesh.k@psgtech.ac.in', rollNumber: '22ECE067', name: 'Vignesh K', department: 'Electronics and Communication', year: 4 },
  { email: 'nandhini.r@psgtech.ac.in', rollNumber: '24ME031', name: 'Nandhini R', department: 'Mechanical Engineering', year: 2 },
]

async function seedSyntheticData() {
  if (!process.argv.includes('--synthetic')) return
  const marker = 'Synthetic QA dataset:'
  if (process.argv.includes('--reset-synthetic')) {
    const existing = await Complaint.find({ description: new RegExp('^' + marker) }).select('_id').lean()
    const ids = existing.map((complaint) => complaint._id)
    if (ids.length) {
      await Promise.all([
        ComplaintAssignment.deleteMany({ complaintId: { $in: ids } }),
        ComplaintStatusHistory.deleteMany({ complaintId: { $in: ids } }),
        Notification.deleteMany({ complaintId: { $in: ids } }),
        Complaint.deleteMany({ _id: { $in: ids } }),
      ])
      console.log('Previous synthetic complaints removed.')
    }
  }
  if (await Complaint.exists({ description: new RegExp('^' + marker) })) {
    console.log('Synthetic dataset already exists; no duplicate records created.')
    return
  }

  for (const record of SYNTHETIC_STUDENTS) {
    let user = await User.findOne({ email: record.email })
    if (!user) {
      user = await User.create({ role: 'student', email: record.email, passwordHash: await User.hashPassword('student123') })
    }
    await Student.findOneAndUpdate({ rollNumber: record.rollNumber }, { ...record, userId: user._id }, { upsert: true, new: true })
  }

  const [admin, students, categories, staffMembers] = await Promise.all([
    User.findOne({ role: 'admin' }),
    Student.find({ rollNumber: { $in: SYNTHETIC_STUDENTS.map((student) => student.rollNumber) } }),
    IssueCategory.find(),
    Staff.find(),
  ])
  const studentByIndex = students
  const categoryByName = Object.fromEntries(categories.map((category) => [category.name, category]))
  const items = [
    ['Water', 'High', 'Water is leaking near the library drinking-water station.'],
    ['Electrical', 'High', 'A corridor light switch is sparking intermittently.'],
    ['Infrastructure', 'Medium', 'A damaged handrail needs inspection near the mechanical block stairs.'],
    ['Waste', 'Low', 'Waste bins near the canteen require collection.'],
    ['Cleanliness', 'Medium', 'Washroom cleaning is required in the academic block.'],
  ]

  for (let index = 0; index < items.length; index += 1) {
    const [categoryName, priority, detail] = items[index]
    const student = studentByIndex[index % studentByIndex.length]
    const complaint = await Complaint.create({
      studentId: student._id, categoryId: categoryByName[categoryName]._id, description: detail.startsWith(marker) ? detail : marker + ' ' + detail,
      status: index < 2 ? 'Assigned' : 'Reported', priority, latitude: 11.0238, longitude: 77.0066, gpsAccuracy: 10, locationVerified: true, locationDescription: 'PSG College of Technology campus',
    })
    await ComplaintStatusHistory.create({ complaintId: complaint._id, status: 'Reported', changedBy: student.userId, note: 'Synthetic complaint submitted for workflow testing.' })
    await Notification.create({ userId: student.userId, complaintId: complaint._id, title: 'Complaint Submitted', message: 'Your synthetic complaint is awaiting administrator verification.', type: 'complaint_submitted' })
    await Notification.create({ userId: admin._id, complaintId: complaint._id, title: 'Complaint Requires Verification', message: 'A synthetic complaint is ready for approval, assignment, and deadline testing.', type: 'complaint_submitted' })
    if (index < 2) {
      const requiredSkill = categoryByName[categoryName].requiredSkill
      const staff = staffMembers.find((member) => member.isAvailable && member.skills.includes(requiredSkill))
      if (staff) {
        const deadline = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000)
        await Complaint.updateOne({ _id: complaint._id }, { status: 'Assigned', tokenId: `SYN-${Date.now().toString(36).toUpperCase()}-${index + 1}`, verifiedAt: new Date(), verifiedBy: admin._id })
        await ComplaintAssignment.create({ complaintId: complaint._id, staffId: staff._id, assignedBy: admin._id, deadline })
        await ComplaintStatusHistory.create({ complaintId: complaint._id, status: 'Verified', changedBy: admin._id, note: 'Synthetic complaint verified for assignment testing.' })
        await ComplaintStatusHistory.create({ complaintId: complaint._id, status: 'Assigned', changedBy: admin._id, note: `Synthetic assignment to ${staff.name}.` })
        await Notification.create({ userId: staff.userId, complaintId: complaint._id, title: 'New Complaint Assignment', message: 'A synthetic complaint has been assigned for staff workflow testing.', type: 'staff_assigned' })
        await Notification.create({ userId: student.userId, complaintId: complaint._id, title: 'Staff Assigned', message: 'A staff member has been assigned to your synthetic complaint.', type: 'staff_assigned' })
      }
    }
  }

  const event = await AwarenessEvent.create({
    title: 'Campus Water Conservation Workshop', eventType: 'Workshop',
    description: 'Synthetic event for sustainability feature testing.', date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    startTime: '10:00', endTime: '12:00', location: 'Seminar Hall', organizer: 'Campus Sustainability Cell',
    audience: 'Students and staff', isPublished: true, createdBy: admin._id,
  })
  await Promise.all(students.map((student) => Notification.create({ userId: student.userId, eventId: event._id, title: 'New Sustainability Event', message: 'A campus water conservation workshop has been published.', type: 'event_published' })))
  console.log('Synthetic reported complaints created. Approve and assign them through the admin portal to test the workflow.')
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to NEW database: campus_grievance_new')

  // ── Issue categories ──────────────────────────────────────────────────────
  for (const cat of CATEGORIES) {
    await IssueCategory.findOneAndUpdate({ name: cat.name }, cat, { upsert: true, new: true })
  }
  console.log('✓ Issue categories seeded.')

  // ── Priority rules ────────────────────────────────────────────────────────
  await PriorityRule.deleteMany({})
  await PriorityRule.insertMany(PRIORITY_RULES)
  console.log('✓ Priority rules seeded.')

  // ── Test student ──────────────────────────────────────────────────────────
  const existingStudent = await User.findOne({ email: 'teststudent@psgtech.ac.in' })
  if (!existingStudent) {
    const passwordHash = await User.hashPassword('student123')
    const user = await User.create({
      role: 'student',
      email: 'teststudent@psgtech.ac.in',
      passwordHash,
    })
    await Student.create({
      userId: user._id,
      rollNumber: '21CS001',
      name: 'Test Student',
      department: 'Computer Science',
      year: 3,
    })
    console.log('✓ Test student created:')
    console.log('    Roll Number : 21CS001')
    console.log('    Password    : student123')
  } else {
    console.log('✓ Test student already exists (21CS001).')
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  for (const record of DEMO_STUDENTS.filter((student) => student.email !== 'teststudent@psgtech.ac.in')) {
    let user = await User.findOne({ email: record.email })
    if (!user) user = await User.create({ role: 'student', email: record.email, passwordHash: await User.hashPassword('student123') })
    await Student.findOneAndUpdate({ rollNumber: record.rollNumber }, { ...record, userId: user._id }, { upsert: true, new: true })
  }
  console.log('Additional named demo students available: Ananya S, Vignesh K, Nandhini R. Password: student123')

  const existingAdmin = await User.findOne({ email: 'admin@psgtech.ac.in' })
  if (!existingAdmin) {
    const passwordHash = await User.hashPassword('admin123')
    await User.create({ role: 'admin', email: 'admin@psgtech.ac.in', passwordHash })
    console.log('✓ Admin created:')
    console.log('    Email    : admin@psgtech.ac.in')
    console.log('    Password : admin123')
  } else {
    console.log('✓ Admin already exists (admin@psgtech.ac.in).')
  }

  // ── Staff ─────────────────────────────────────────────────────────────────
  // Staff can log in using:
  //   identifier = employeeCode  (e.g. EMP001)
  //   identifier = email         (e.g. murugan@psgtech.ac.in)
  for (const s of STAFF_SEED) {
    const existing = await User.findOne({ email: s.email })
    if (!existing) {
      const passwordHash = await User.hashPassword('staff123')
      const staffUser = await User.create({ role: 'staff', email: s.email, passwordHash })
      await Staff.create({
        userId: staffUser._id,
        employeeCode: s.code,
        name: s.name,
        department: 'Maintenance',
        skills: s.skills,
        isAvailable: true,
      })
      console.log(`✓ Staff created: ${s.code} | ${s.email} | password: staff123`)
    } else {
      console.log(`✓ Staff already exists: ${s.code} | ${s.email}`)
    }
  }

  await seedSyntheticData()

  await mongoose.disconnect()
  console.log('\nSeed complete.')
  console.log('─────────────────────────────────────────')
  console.log('LOGIN CREDENTIALS SUMMARY')
  console.log('─────────────────────────────────────────')
  console.log('STUDENT  → Roll: 21CS001        | Pass: student123')
  console.log('ADMIN    → Email: admin@psgtech.ac.in | Pass: admin123')
  console.log('STAFF    → Code: EMP001–EMP005  | Pass: staff123')
  console.log('         → OR email: murugan@psgtech.ac.in etc.')
  if (process.argv.includes('--synthetic')) {
    console.log('SYNTHETIC STUDENTS → 24CSA101, 24ECE112, 23ME204 | Pass: student123')
  }
  console.log('─────────────────────────────────────────')
}

seed().catch((err) => { console.error(err); process.exit(1) })
