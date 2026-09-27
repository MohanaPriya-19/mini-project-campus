// Thin fetch wrapper for the NEW backend in ../backend.
// Every context that used to read/write localStorage directly now goes
// through here instead — this is the only file that knows the API's base
// URL and how auth tokens get attached.

// This is the NEW Express backend in ../backend. Keep `/api` here so every
// browser request shares one API contract with the student mobile app.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
const TOKEN_KEY = 'csr_auth_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const isFormData = body instanceof FormData
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
  } catch (networkErr) {
    throw new Error(`Could not reach the new backend at ${BASE_URL}. Start ../backend with npm run dev.`)
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await response.json().catch(() => ({})) : null

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed with status ${response.status}`)
  }

  return data
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  postForm: (path, body) => request(path, { method: 'POST', body }),
}
