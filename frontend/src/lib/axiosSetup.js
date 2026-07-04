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

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      // Token missing/expired/invalid — clear session and force re-login
      localStorage.removeItem("token")
      localStorage.removeItem("company")
      localStorage.removeItem("color")
      if (!window.location.pathname.includes("login")) {
        window.location.reload()
      }
    }
    return Promise.reject(err)
  }
)

// Several older pages use raw fetch() instead of axios — patch global fetch
// so every request (relative or absolute URL) also carries the Bearer token.
const _origFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const token = localStorage.getItem("token")
  if (token) {
    init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } }
  }
  return _origFetch(input, init)
}

