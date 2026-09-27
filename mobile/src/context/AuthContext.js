import React, { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, logout as apiLogout, getStoredUser, getStoredToken } from '../services/authService'
import { onUnauthorized } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function restore() {
      try {
        const token = await getStoredToken()
        const stored = await getStoredUser()
        if (token && stored?.role === 'student') setUser(stored)
        else if (token || stored) await apiLogout()
      } catch {
        // ignore — user will be asked to log in
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  useEffect(() => onUnauthorized(() => setUser(null)), [])

  async function login(identifier, password) {
    const data = await apiLogin(identifier, password)
    setUser(data.user)
    return data
  }

  async function logout() {
    await apiLogout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
