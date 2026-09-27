import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ComplaintsProvider } from './context/ComplaintsContext'
import { StaffDirectoryProvider } from './context/StaffDirectoryContext'
import { EventsProvider } from './context/EventsContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import ComplaintsDashboard from './pages/ComplaintsDashboard'
import StaffHome from './pages/StaffHome'
import StaffDirectoryPage from './pages/StaffDirectoryPage'
import RcaInsightsPage from './pages/RcaInsightsPage'
import ReportsPage from './pages/ReportsPage'
import AwarenessEventsPage from './pages/AwarenessEventsPage'
import NotificationsPage from './pages/NotificationsPage'

// Root route shows the right landing page for each role.
function RoleHome() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <ComplaintsDashboard /> : <StaffHome />
}

export default function App() {
  return (
    <AuthProvider>
      <StaffDirectoryProvider>
        <ComplaintsProvider>
          <EventsProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <RoleHome />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/maintenance"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <StaffDirectoryPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rca"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <RcaInsightsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <ReportsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={<ProtectedRoute><AppLayout><NotificationsPage /></AppLayout></ProtectedRoute>}
              />
              <Route
                path="/awareness"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout>
                      <AwarenessEventsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </EventsProvider>
        </ComplaintsProvider>
      </StaffDirectoryProvider>
    </AuthProvider>
  )
}
