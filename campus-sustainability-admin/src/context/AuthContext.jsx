import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from '../api/client'
import { normalizeUser } from '../api/normalize'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready

  // On first load, if a token is already saved, restore the session by
  // asking the backend who it belongs to — rather than trusting stale
  // local data the way the mock version did.
  useEffect(() => {
    const restore = async () => {
      const token = getToken()
      if (!token) {
        setStatus('ready')
        return
      }
      try {
        const { user: me } = await api.get('/auth/me')
        setUser(normalizeUser(me))
      } catch {
        setToken(null)
      } finally {
        setStatus('ready')
      }
    }
    restore()
  }, [])

  const login = async ({ email, password }) => {
    const { token, user: apiUser } = await api.post(
      '/auth/login',
      { identifier: email, password },
      { auth: false }
    )
    setToken(token)
    const normalized = normalizeUser(apiUser)
    setUser(normalized)
    return normalized
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const value = useMemo(() => ({ user, status, login, logout }), [user, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
