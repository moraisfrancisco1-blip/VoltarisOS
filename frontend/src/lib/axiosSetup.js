// Global axios auth setup — attaches the JWT to every request automatically
// and redirects to login on 401 (expired/invalid token).
import axios from "axios"

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Shared by both the axios interceptor and the fetch patch below, so a stale
// token behaves identically no matter which client a page happens to use.
// Guarded so a burst of parallel 401s (several widgets fetching at once)
// only clears storage and reloads once, not once per request.
let _handledUnauthorized = false
function _handleUnauthorized() {
  if (_handledUnauthorized) return
  if (window.location.pathname.includes("login")) return
  _handledUnauthorized = true
  localStorage.removeItem("token")
  localStorage.removeItem("company")
  localStorage.removeItem("color")
  window.location.reload()
}

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      // Token missing/expired/invalid — clear session and force re-login
      _handleUnauthorized()
    }
    return Promise.reject(err)
  }
)

// Several older pages use raw fetch() instead of axios — patch global fetch
// so every request (relative or absolute URL) also carries the Bearer token,
// and — like the axios interceptor above — a 401 response clears the stale
// session and forces re-login instead of leaving the page stuck on
// "failed to load" forever. Only inspects res.status; the body is left
// untouched for the caller to read.
const _origFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const token = localStorage.getItem("token")
  if (token) {
    init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } }
  }
  return _origFetch(input, init).then((res) => {
    if (res.status === 401) {
      _handleUnauthorized()
    }
    return res
  })
}

