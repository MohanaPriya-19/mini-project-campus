import { useState } from 'react'
import { useEvents } from '../context/EventsContext'
import EventFormModal from '../components/EventFormModal'

const formatDate = (value) => value ? new Date(value).toLocaleString('en-IN') : 'Not provided'
export default function AwarenessEventsPage() {
  const { events, createEvent, updateEvent } = useEvents(); const [showForm, setShowForm] = useState(false)
  const create = async (data) => { try { await createEvent(data); setShowForm(false) } catch (error) { alert(`Action failed: ${error.message}`) } }
  const cancel = async (id) => { if (!window.confirm('Cancel this event?')) return; try { await updateEvent(id, { isCancelled: true }) } catch (error) { alert(`Action failed: ${error.message}`) } }
  return <div className="page"><div className="page__header"><div><span className="eyebrow">Campus sustainability</span><h1 className="page__title">Awareness events</h1><p className="page__subtitle">Publish and manage events that students can view in the mobile app.</p></div><button className="btn-primary" onClick={() => setShowForm(true)}>Post event</button></div><div className="event-grid">{events.map((event) => <article key={event.id} className="event-card"><div className="event-card__top"><span className="event-category-pill">{event.category}</span>{event.status === 'published' && <button className="btn-ghost event-card__cancel" onClick={() => cancel(event.id)}>Cancel</button>}</div><h3>{event.title}</h3><p className="event-card__meta">{formatDate(event.startsAt)} · {event.venue}</p><p className="event-card__desc">{event.description || 'No description provided.'}</p><p>{event.status === 'cancelled' ? 'Cancelled' : event.status === 'published' ? 'Published' : 'Draft'}</p></article>)}{events.length === 0 && <p className="empty-note">No published events yet.</p>}</div>{showForm && <EventFormModal onConfirm={create} onCancel={() => setShowForm(false)} />}</div>
}
