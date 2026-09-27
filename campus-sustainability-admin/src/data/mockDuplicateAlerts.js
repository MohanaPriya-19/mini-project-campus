// FR-4: when a student's submission matches an already-open complaint by
// category + location, no new ticket is created — the student is shown an
// "already reported" alert and linked to the existing one instead. That
// check happens at submission time in the mobile app; this is the record
// of those caught duplicates, kept only for the analytics/anomaly summary
// (FR-12) since they never became tickets in the main queue.
export const MOCK_DUPLICATE_ALERTS = [
  {
    id: 'DUP-001',
    category: 'Water',
    location: 'Block C, 2nd floor',
    attemptedBy: 'Divya R (22CS118)',
    detectedAt: '2026-07-24T14:00:00',
    linkedTo: 'WTR-014',
  },
  {
    id: 'DUP-002',
    category: 'Waste',
    location: 'Hostel block B, entrance',
    attemptedBy: 'Arjun P (23BT091)',
    detectedAt: '2026-07-25T08:20:00',
    linkedTo: 'WST-093',
  },
  {
    id: 'DUP-003',
    category: 'Water',
    location: 'Hostel block A, 3rd floor',
    attemptedBy: 'Sowmya T (22CS067)',
    detectedAt: '2026-07-22T11:10:00',
    linkedTo: 'WTR-015',
  },
]
