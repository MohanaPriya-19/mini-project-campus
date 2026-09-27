import * as SecureStore from 'expo-secure-store'
import api from './api'

export async function login(identifier, password) {
  const res = await api.post('/api/auth/login', { identifier, password })
  if (res.data.user?.role !== 'student') {
    throw new Error('This application is for student accounts only.')
  }
  await SecureStore.setItemAsync('auth_token', res.data.token)
  await SecureStore.setItemAsync('auth_user', JSON.stringify(res.data.user))
  return res.data
}

export async function logout() {
  await SecureStore.deleteItemAsync('auth_token')
  await SecureStore.deleteItemAsync('auth_user')
}

export async function getStoredUser() {
  const raw = await SecureStore.getItemAsync('auth_user')
  return raw ? JSON.parse(raw) : null
}

export async function getStoredToken() {
  return SecureStore.getItemAsync('auth_token')
}
