// FR-parallel to duplicate alerts: students can also propose an event from
// the mobile app. These sit here awaiting admin review — approving one
// creates a real published event; rejecting requires a reason.
export const MOCK_EVENT_PROPOSALS = [
  {
    id: 'PROP-01',
    title: 'Plastic-Free Campus Pledge Rally',
    category: 'Rally',
    description: 'A short walk across campus followed by students signing a plastic-free pledge board.',
    proposedBy: 'Harish M (21CS004)',
    proposedAt: '2026-07-24T10:00:00',
    requestedDate: '2026-08-20T09:00:00',
    requestedVenue: 'Main gate to admin block',
    status: 'pending',
    rejectionReason: null,
  },
  {
    id: 'PROP-02',
    title: 'Solar Energy Awareness Seminar',
    category: 'Seminar',
    description: 'Guest talk from the college energy cell on rooftop solar adoption.',
    proposedBy: 'Deepak N (23EC055)',
    proposedAt: '2026-07-25T16:30:00',
    requestedDate: '2026-08-18T15:00:00',
    requestedVenue: 'Seminar hall 1',
    status: 'pending',
    rejectionReason: null,
  },
]
