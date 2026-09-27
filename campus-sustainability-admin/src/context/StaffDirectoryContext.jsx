import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { normalizeStaff } from '../api/normalize'
import { useAuth } from './AuthContext'

const StaffDirectoryContext = createContext(null)
const categorySkills = { Water: ['Water', 'Plumbing'], Electrical: ['Electrical'], Infrastructure: ['Infrastructure', 'Civil Maintenance'], Cleanliness: ['Cleaning', 'Cleanliness', 'Waste Management'], Waste: ['Waste', 'Waste Management'], Energy: ['Electrical', 'Energy'], Safety: ['Civil Maintenance', 'Infrastructure'] }

export function StaffDirectoryProvider({ children }) {
  const { user, status: authStatus } = useAuth()
  const [staff, setStaff] = useState([])
  const refresh = useCallback(async () => {
    if (!user) { setStaff([]); return }
    try {
      const response = await api.get(user.role === 'admin' ? '/admin/staff' : '/staff/profile')
      setStaff((user.role === 'admin' ? response.staff : [response.staff]).map(normalizeStaff))
    } catch (error) { console.error('Failed to load staff records:', error.message) }
  }, [user])
  useEffect(() => { if (authStatus === 'ready') refresh() }, [authStatus, refresh])
  const updateProfile = async (update) => {
    try {
      const { staff: updated } = await api.patch('/staff/profile', update)
      const normalized = normalizeStaff(updated); setStaff([normalized]); return normalized
    } catch (error) { alert(`Action failed: ${error.message}`); throw error }
  }
  const getStaffById = (id) => staff.find((item) => item.id === id || item.userId === id)
  const getAvailableStaffForCategory = (category) => staff.filter((item) => item.available && (categorySkills[category] || [category]).some((skill) => item.skills.includes(skill)))
  const value = useMemo(() => ({ staff, profile: user?.role === 'staff' ? staff[0] || null : null, updateProfile, getStaffById, getAvailableStaffForCategory, resetToSeed: refresh }), [staff, user, refresh])
  return <StaffDirectoryContext.Provider value={value}>{children}</StaffDirectoryContext.Provider>
}

export function useStaffDirectory() { const value = useContext(StaffDirectoryContext); if (!value) throw new Error('useStaffDirectory must be used within a StaffDirectoryProvider'); return value }
