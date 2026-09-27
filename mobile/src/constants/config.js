/**
 * API_BASE_URL — automatically resolves to the correct backend host.
 *
 * How it works:
 *  - In Expo Go (dev), Expo embeds the dev-server host in the manifest.
 *    We extract that host and point port 5001 at it.
 *    This means the app works on ANY network without ever changing this file.
 *  - In a production/EAS build, set EXPO_PUBLIC_API_URL in your EAS
 *    environment variables and it will be used instead.
 */
import Constants from 'expo-constants'

function normalizeApiUrl(value) {
  if (!value) return null
  const url = value.trim().replace(/\/$/, '')
  if (!/^https?:\/\/[^/]+(?::\d+)?(?:\/.*)?$/.test(url)) return null
  if (/\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(url)) return null
  if (!/:5001(?:\/|$)/.test(url)) return null
  return url
}

function resolveApiUrl() {
  // 1. Explicit override — set EXPO_PUBLIC_API_URL for production builds
  const configuredUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL)
  if (configuredUrl) return configuredUrl

  // 2. Expo Go / dev client — derive host from the Expo manifest
  //    Works on ANY WiFi network automatically — no hardcoded IP needed
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost

  if (debuggerHost) {
    // debuggerHost is "192.168.x.x:8081" — replace Expo port with backend port 5001
    const host = debuggerHost.split(':')[0]
    return normalizeApiUrl(`http://${host}:5001`)
  }

  // 3. Last resort fallback (works only on simulators/emulators)
  return null
}

export const API_BASE_URL = resolveApiUrl()
export const API_CONFIGURATION_ERROR =
  'Backend address is not configured. Set EXPO_PUBLIC_API_URL to your laptop LAN URL on port 5001, then rebuild the APK.'

export const CATEGORIES = ['Water', 'Infrastructure', 'Electrical', 'Waste', 'Cleanliness']

export const COMPLAINT_STATUSES = {
  Reported: { label: 'Reported', color: '#6b7280' },
  Verified: { label: 'Verified', color: '#3b82f6' },
  Rejected: { label: 'Rejected', color: '#ef4444' },
  Assigned: { label: 'Assigned', color: '#8b5cf6' },
  'In Progress': { label: 'In Progress', color: '#f59e0b' },
  Overdue: { label: 'Overdue', color: '#dc2626' },
  'Unable to Resolve': { label: 'Unable to Resolve', color: '#991b1b' },
  Reassigned: { label: 'Reassigned', color: '#7c3aed' },
  'Deadline Extended': { label: 'Deadline Extended', color: '#d97706' },
  Resolved: { label: 'Resolved', color: '#10b981' },
  Closed: { label: 'Closed', color: '#374151' },
  Repetitive: { label: 'Repetitive Complaint', color: '#7c3aed' },
}

export const COLORS = {
  primary: '#1a3c6e',
  primaryLight: '#2563eb',
  secondary: '#10b981',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  textSecondary: '#64748b',
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
}
