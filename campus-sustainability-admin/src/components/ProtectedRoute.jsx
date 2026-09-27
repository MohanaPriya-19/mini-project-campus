import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Wrap any route that requires a signed-in session.
// Pass allowedRoles to further restrict by role (e.g. ['admin']).
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return null

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
