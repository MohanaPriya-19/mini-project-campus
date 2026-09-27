import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL, API_CONFIGURATION_ERROR } from '../constants/config'

const unauthorizedListeners = new Set()

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

// Attach JWT to every request
api.interceptors.request.use(async (config) => {
  if (!API_BASE_URL) return Promise.reject(new Error(API_CONFIGURATION_ERROR))
  const token = await SecureStore.getItemAsync('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Normalize error messages — never expose raw stack traces
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      SecureStore.deleteItemAsync('auth_token').catch(() => {})
      SecureStore.deleteItemAsync('auth_user').catch(() => {})
      unauthorizedListeners.forEach((listener) => listener())
    }
    if (err.message === API_CONFIGURATION_ERROR) {
      return Promise.reject(err)
    }
    if (!err.response) {
      return Promise.reject(new Error('Unable to connect to the server. Please check your internet connection.'))
    }
    const message = err.response.data?.message || 'An unexpected error occurred. Please try again.'
    return Promise.reject(new Error(message))
  }
)

export default api
