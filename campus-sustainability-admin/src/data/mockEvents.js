export const EVENT_CATEGORIES = [
  'Tree Plantation',
  'Rally',
  'Workshop',
  'Seminar',
  'Cleanliness Drive',
  'Sustainability Campaign',
]

// id, title, category, description, venue, startsAt, createdBy,
// status ('published' | 'cancelled'), registrations: [{ id, studentName, rollNo, token, checkedIn }]
export const MOCK_EVENTS = [
  {
    id: 'EVT-101',
    title: 'Campus-wide Tree Plantation Drive',
    category: 'Tree Plantation',
    description: 'Plant saplings along the new walkway behind the library. Gloves and tools provided.',
    venue: 'Library backyard',
    startsAt: '2026-08-05T08:00:00',
    createdBy: 'admin',
    status: 'published',
    registrations: [
      { id: 'r1', studentName: 'Ananya S', rollNo: '23CS041', token: 'EVT-101-A1B2', checkedIn: true },
      { id: 'r2', studentName: 'Karthik V', rollNo: '22CS089', token: 'EVT-101-C3D4', checkedIn: false },
      { id: 'r3', studentName: 'Sneha P', rollNo: '23ME077', token: 'EVT-101-E5F6', checkedIn: false },
    ],
  },
  {
    id: 'EVT-102',
    title: 'E-Waste Segregation Workshop',
    category: 'Workshop',
    description: 'Hands-on session on identifying and safely sorting electronic waste before disposal.',
    venue: 'Seminar hall 2',
    startsAt: '2026-08-12T14:00:00',
    createdBy: 'admin',
    status: 'published',
    registrations: [
      { id: 'r4', studentName: 'Rahul K', rollNo: '22EE102', token: 'EVT-102-G7H8', checkedIn: false },
      { id: 'r5', studentName: 'Priyanka D', rollNo: '24MX012', token: 'EVT-102-I9J0', checkedIn: false },
    ],
  },
  {
    id: 'EVT-103',
    title: 'Zero Waste Cleanliness Drive',
    category: 'Cleanliness Drive',
    description: 'Clean-up along the hostel block walkways, followed by a segregation demo.',
    venue: 'Hostel block B & C',
    startsAt: '2026-07-20T07:30:00',
    createdBy: 'admin',
    status: 'published',
    registrations: [
      { id: 'r6', studentName: 'Meena R', rollNo: '23BT033', token: 'EVT-103-K1L2', checkedIn: true },
      { id: 'r7', studentName: 'Vignesh T', rollNo: '24CH009', token: 'EVT-103-M3N4', checkedIn: true },
      { id: 'r8', studentName: 'Divya R', rollNo: '22CS118', token: 'EVT-103-O5P6', checkedIn: false },
    ],
  },
]
