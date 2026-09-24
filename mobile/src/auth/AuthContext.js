import { createContext, useContext, useState, useEffect, useCallback } from "react"
import * as api from "../../api"
import { queryClient } from "../lib/queryClient"

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

/**
 * Restores the persisted session on launch (SecureStore-backed, see api.js),
 * then exposes {user, token, restoring, login, logout} to the whole app.
 * login/logout also clear/invalidate the TanStack Query cache so a new
 * session never shows a previous tenant's cached data.
 */
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const token = await api.getStoredToken()
        const user = await api.getStoredUser()
        if (token && user) setAuth({ token, ...user })
      } finally {
        setRestoring(false)
      }
    })()
  }, [])

  const login = useCallback((data) => {
    setAuth(data)
    queryClient.invalidateQueries()
  }, [])

  const logout = useCallback(() => {
    api.logout()
    queryClient.clear()
    setAuth(null)
  }, [])

  const value = {
    token: auth?.token,
    user: auth,
    restoring,
    login,
    logout,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
