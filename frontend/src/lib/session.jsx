import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'
import { demoRole, isOfflineActive, isOfflineToken } from './offline'

const SessionContext = createContext(null)
export const useSession = () => useContext(SessionContext)

// Signed in and through onboarding: details, privacy choices and (for students) Career DNA.
export function isReady(me) {
  if (!me?.user) return false
  if (['counsellor', 'teacher', 'admin'].includes(me.user.role)) return true
  return Boolean(me.onboarded && me.consents?.updated_at && (me.user.role !== 'student' || me.has_dna))
}

// me === undefined while loading, null when signed out.
export function SessionProvider({ children }) {
  const [me, setMe] = useState(getToken() ? undefined : null)

  const refresh = useCallback(async () => {
    const token = getToken()
    if (!token) return setMe(null)
    try {
      // A saved offline-demo session: sign that demo account in again, live if the server is back
      if (isOfflineToken(token) && !isOfflineActive()) return signIn(await api.demoLogin(demoRole(token)))
      setMe(await api.me())
    } catch (e) {
      if (e.status === 401) setToken(null)
      setMe(null)
    }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const signIn = (res) => {
    setToken(res.token)
    const { token: _t, is_new: _n, ...rest } = res
    setMe(rest)
  }
  const signOut = async () => {
    try { await api.logout() } catch { /* already signed out */ }
    setToken(null)
    setMe(null)
  }
  return <SessionContext.Provider value={{ me, setMe, refresh, signIn, signOut }}>{children}</SessionContext.Provider>
}
