// Maintenance staff directory (FR-7). Each staff member maintains their
// own skillset and availability; admins can only view it, not edit it —
// the admin's assignment list is filtered by this data, not overridden by it.
export const MOCK_STAFF = [
  { id: 's_003', name: 'Suresh Babu', skills: ['Waste'], available: true },
  { id: 's_002', name: 'Latha R', skills: ['Energy'], available: true },
  { id: 's_001', name: 'Ganesh Kumar', skills: ['Water'], available: true },
  { id: 's_004', name: 'Priya Dharshini', skills: ['Infrastructure'], available: false },
  { id: 's_005', name: 'Arun Prasad', skills: ['Safety', 'Infrastructure'], available: true },
]
