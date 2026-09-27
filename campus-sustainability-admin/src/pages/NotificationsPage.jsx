import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function NotificationsPage() {
  const [items, setItems] = useState([]); const [unread, setUnread] = useState(0)
  const load = async () => { const response = await api.get('/notifications'); setItems(response.notifications || []); setUnread(response.unreadCount || 0) }
  useEffect(() => { load().catch((error) => console.error('Failed to load notifications:', error.message)) }, [])
  const read = async (item) => { if (item.isRead) return; await api.patch(`/notifications/${item._id}/read`); setItems((list) => list.map((value) => value._id === item._id ? { ...value, isRead: true } : value)); setUnread((value) => Math.max(0, value - 1)) }
  const readAll = async () => { await api.patch('/notifications/read-all'); setItems((list) => list.map((item) => ({ ...item, isRead: true }))); setUnread(0) }
  return <div className="page"><div className="page__header"><div><span className="eyebrow">Updates</span><h1 className="page__title">Notifications</h1><p className="page__subtitle">{unread} unread</p></div>{unread > 0 && <button className="btn-ghost" onClick={readAll}>Mark all read</button>}</div><div className="task-list">{items.map((item) => <button key={item._id} className="task-card" onClick={() => read(item)} style={{ textAlign: 'left', borderColor: item.isRead ? undefined : 'var(--forest)' }}><h3>{item.title}</h3><p>{item.message}</p><p className="task-card__meta">{new Date(item.createdAt).toLocaleString('en-IN')}</p></button>)}{items.length === 0 && <p className="empty-note">No notifications.</p>}</div></div>
}
