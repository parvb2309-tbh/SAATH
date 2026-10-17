import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LogOut, Plane } from 'lucide-react'
import { api, storage } from './lib/api'
import { LangContext, STRINGS } from './lib/i18n'
import { isReady, useSession } from './lib/session'
import EngineBadge from './components/EngineBadge'
import { Loading } from './components/Shell'
import Onboarding from './pages/Onboarding'

const StudentPortal = lazy(() => import('./pages/student/StudentPortal'))
const ParentPortal = lazy(() => import('./pages/parent/ParentPortal'))
const Counsellor = lazy(() => import('./pages/Counsellor'))
const Teacher = lazy(() => import('./pages/Teacher'))
const Admin = lazy(() => import('./pages/Admin'))
const PublicReport = lazy(() => import('./pages/PublicReport'))

export default function App() {
  const { me, setMe, signOut } = useSession()
  const [lang, setLangState] = useState(storage.get('udaan.lang') || 'hi')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const location = useLocation()

  const setLang = (l) => {
    storage.set('udaan.lang', l)
    setLangState(l)
  }
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  // the server writes reports, reasons and chat replies in the user's language, so keep it in step
  const [syncedLang, setSyncedLang] = useState(null)
  useEffect(() => {
    if (!me?.user) return setSyncedLang(lang)
    if (me.user.preferred_lang === lang) return setSyncedLang(lang)
    api.patchMe({ preferred_lang: lang })
      .then(() => setMe((m) => ({ ...m, user: { ...m.user, preferred_lang: lang } })))
      .finally(() => setSyncedLang(lang))
  }, [lang, me?.user?.id, me?.user?.preferred_lang])

  const loadMeta = () => api.meta().then(setMeta).catch((e) => setError(`Cannot reach the UDAAN server (${e.message}). Is the backend running on port 8000?`))
  useEffect(() => { loadMeta() }, [])

  const ctx = useMemo(() => ({ lang: syncedLang || lang, setLang, meta }), [syncedLang, lang, meta])
  const t = (k) => STRINGS[k]?.[lang] ?? k
  const role = me?.user?.role
  const publicPage = location.pathname.startsWith('/r/')

  return (
    <LangContext.Provider value={ctx}>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark"><Plane size={16} strokeWidth={2.25} aria-hidden /></span>
          <span className="brand-name">{lang === 'hi' ? 'उड़ान' : 'UDAAN'}</span>
        </Link>
        {role && !publicPage && <span className="brand-role">{t(`role_${role}`)}</span>}
        <div className="topbar-right">
          {meta && <EngineBadge engine={meta.engine} />}
          <div className="lang-toggle" role="group" aria-label="Language">
            <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          </div>
          {me?.user && !publicPage && (
            <button className="user-btn" onClick={signOut} title={t('signOut')}>
              <span>{me.user.name || t(`role_${role}`)}</span><LogOut size={14} aria-hidden />
            </button>
          )}
        </div>
      </header>
      {error && <div className="content"><div className="alert">{error} <button className="link" onClick={() => { setError(''); loadMeta() }}>{t('retry')}</button></div></div>}
      {meta && me !== undefined && syncedLang && (
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={isReady(me) ? <Navigate to={`/${role}`} replace /> : <Onboarding />} />
            <Route path="/r/:token" element={<PublicReport />} />
            <Route path="/student/*" element={<Guard role="student"><StudentPortal /></Guard>} />
            <Route path="/parent/*" element={<Guard role="parent"><ParentPortal /></Guard>} />
            <Route path="/counsellor/*" element={<Guard role="counsellor"><Counsellor /></Guard>} />
            <Route path="/teacher/*" element={<Guard role="teacher"><Teacher /></Guard>} />
            <Route path="/admin/*" element={<Guard role="admin"><Admin /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
      {(!meta || me === undefined) && !error && <Loading />}
    </LangContext.Provider>
  )
}

function Guard({ role, children }) {
  const { me } = useSession()
  if (!me?.user) return <Navigate to="/" replace />
  if (me.user.role !== role) return <Navigate to={`/${me.user.role}`} replace />
  if (!isReady(me)) return <Navigate to="/" replace />
  return children
}
