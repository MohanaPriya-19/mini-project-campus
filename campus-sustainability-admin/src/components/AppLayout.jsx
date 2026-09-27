import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useComplaints } from '../context/ComplaintsContext'
import { useStaffDirectory } from '../context/StaffDirectoryContext'
import { useEvents } from '../context/EventsContext'
import Logo from './Logo'

const NAV_ITEMS = [
  { to: '/', label: 'Complaints', enabled: true, roles: ['admin', 'staff'] },
  { to: '/maintenance', label: 'Maintenance', enabled: true, roles: ['admin'] },
  { to: '/awareness', label: 'Awareness Events', enabled: true, roles: ['admin'] },
  { to: '/rca', label: 'RCA insights', enabled: true, roles: ['admin'] },
  { to: '/reports', label: 'Reports', enabled: true, roles: ['admin'] },
  { to: '/notifications', label: 'Notifications', enabled: true, roles: ['admin', 'staff'] },
]

export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const { resetToSeed: resetComplaints, actionFeedback } = useComplaints()
  const { resetToSeed: resetStaff } = useStaffDirectory()
  const { resetToSeed: resetEvents } = useEvents()
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role))

  const handleRefreshData = () => {
    resetComplaints()
    resetStaff()
    resetEvents()
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <Logo size={72} />
          <div><span className="app-sidebar__college">PSG College of Technology</span><span className="app-sidebar__product">Campus Infrastructure<br />Sustainability Reporter</span></div>
        </div>
        <nav className="app-nav" aria-label="Portal navigation">
          {visibleItems.map((item) => {
            const label = item.to === '/' && user?.role === 'staff' ? 'My tasks' : item.label
            return item.enabled ? (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => 'app-nav__link' + (isActive ? ' active' : '')}
              >
                {label}
              </NavLink>
            ) : (
              <span key={item.to} className="app-nav__link disabled" title="Coming in a later module">
                {label}
              </span>
            )
          })}
        </nav>
        <div className="app-sidebar__footer">
          <div className="app-topbar__user-info">
            <span className="app-topbar__user-name">{user?.name || user?.email}</span>
            <span className="app-topbar__user-role">{user?.role} portal</span>
          </div>
          <button className="btn-ghost" onClick={handleRefreshData}>Refresh data</button>
          <button className="btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <section className="app-content">
        <header className="app-mobilebar"><Logo size={38} /><span>Campus Infrastructure Sustainability Reporter</span></header>
        <main className="app-main">
          {actionFeedback && (
            <div className={`action-feedback action-feedback--${actionFeedback.state}`} role="status" aria-live="polite">
              {actionFeedback.state === 'working' ? 'Working: ' : ''}{actionFeedback.message}
            </div>
          )}
          {children}
        </main>
      </section>
    </div>
  )
}
