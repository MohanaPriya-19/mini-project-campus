import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { normalizeEvent } from '../api/normalize'
import { useAuth } from './AuthContext'

const EventsContext = createContext(null)
export function EventsProvider({ children }) {
  const { user, status } = useAuth(); const [events, setEvents] = useState([])
  const refresh = useCallback(async () => { if (!user) return; try { const { events: list } = await api.get('/events'); setEvents(list.map(normalizeEvent)) } catch (error) { console.error('Failed to load events:', error.message) } }, [user])
  useEffect(() => { if (status === 'ready') refresh() }, [status, refresh])
  const createEvent = async (data) => { const { event } = await api.post('/admin/events', data); setEvents((items) => [...items, normalizeEvent(event)]) }
  const updateEvent = async (id, data) => { const { event } = await api.patch(`/admin/events/${id}`, data); const normalized = normalizeEvent(event); setEvents((items) => items.map((item) => item.id === id ? normalized : item)) }
  const value = useMemo(() => ({ events, createEvent, updateEvent, resetToSeed: refresh }), [events, refresh])
  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
}
export function useEvents() { const value = useContext(EventsContext); if (!value) throw new Error('useEvents must be used within an EventsProvider'); return value }
