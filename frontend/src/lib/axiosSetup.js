// Global axios auth setup — attaches the JWT to every request automatically
// and redirects to login on 401 (expired/invalid token).
import axios from "axios"

// Always send the httpOnly vos_session cookie (backend/security.py's
// set_auth_cookie) alongside the Authorization header below. The header
// stays primary; the cookie is a resilience fallback get_current_user()
// checks when localStorage lost its token (a privacy browser clearing
// site data, a fresh tab in a browser that never persisted it, etc).
axios.defaults.withCredentials = true

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
    // Only a *previously-authenticated* request going bad means the session
    // itself died (expired/invalidated) -- reload-to-login is the right
    // move there. A 401 on a request that carried no Bearer token to begin
    // with (e.g. App.jsx's bootstrap self-heal probing /auth/me with no
    // localStorage token, hoping the vos_session cookie still works) is an
    // expected, normal outcome, not a reason to nuke storage and reload --
    // doing so before caused an infinite reload loop for any visitor with
    // no session at all.
    const hadToken = !!err.config?.headers?.Authorization
    if (err.response && err.response.status === 401 && hadToken) {
      _handleUnauthorized()
    }
    return Promise.reject(err)
  }
)

// Several older pages use raw fetch() instead of axios — patch global fetch
// so every request (relative or absolute URL) also carries the Bearer token,
// and — like the axios interceptor above — a 401 on a request that DID carry
// a token clears the stale session and forces re-login instead of leaving
// the page stuck on "failed to load" forever. A 401 on a tokenless request
// (see the comment above) is left alone. Only inspects res.status; the body
// is left untouched for the caller to read.
const _origFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const token = localStorage.getItem("token")
  init = { ...init, credentials: init.credentials || "include" }
  if (token) {
    init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } }
  }
  return _origFetch(input, init).then((res) => {
    if (res.status === 401 && token) {
      _handleUnauthorized()
    }
    return res
  })
}

