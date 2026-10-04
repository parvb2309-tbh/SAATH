import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { api, storage } from './lib/api'
import { LangContext, STRINGS } from './lib/i18n'
import EngineBadge from './components/EngineBadge'
import Family from './pages/Family'
import Counsellor from './pages/Counsellor'

const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  const [lang, setLangState] = useState(storage.get('saath.lang') || 'hi')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')

  const setLang = (l) => {
    setLangState(l)
    storage.set('saath.lang', l)
  }
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const loadMeta = () =>
    api.meta().then(setMeta).catch((e) => setError(`Cannot reach the SAATH server (${e.message}). Is the backend running on port 8000?`))
  useEffect(() => {
    loadMeta()
  }, [])

  const ctx = useMemo(() => ({ lang, setLang }), [lang])
  const t = (k) => STRINGS[k]?.[lang] ?? k

  return (
    <LangContext.Provider value={ctx}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>साथ</span>
          <div>
            <div className="brand-name">SAATH</div>
            <div className="brand-tag">{t('appTagline')}</div>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>{t('navFamily')}</NavLink>
          <NavLink to="/counsellor">{t('navCounsellor')}</NavLink>
          <NavLink to="/admin">{t('navAdmin')}</NavLink>
        </nav>
        <div className="topbar-right">
          {meta && <EngineBadge engine={meta.engine} />}
          <div className="lang-toggle" role="group" aria-label="Language">
            <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>
      <main>
        {error && (
          <div className="alert">
            {error} <button className="link" onClick={() => { setError(''); loadMeta() }}>Retry</button>
          </div>
        )}
        {meta && (
          <Routes>
            <Route path="/" element={<Family meta={meta} />} />
            <Route path="/counsellor" element={<Counsellor meta={meta} />} />
            <Route path="/admin" element={<Suspense fallback={<div className="loading">…</div>}><Admin meta={meta} /></Suspense>} />
          </Routes>
        )}
      </main>
    </LangContext.Provider>
  )
}
