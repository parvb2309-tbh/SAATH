import { NavLink } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useT } from '../lib/i18n'

// Portal layout: sidebar on desktop, bottom tab bar on phones. items: [{ to, icon: LucideComponent, label, tour? }]
export default function Shell({ items, foot, children }) {
  return (
    <div className="shell">
      <nav className="sidenav" aria-label="Sections">
        {items.map(({ to, icon: I, label, tour, end }) => (
          <NavLink key={to} to={to} end={end} data-tour={tour}>
            <I size={18} strokeWidth={1.75} aria-hidden />{label}
          </NavLink>
        ))}
        {foot && <div className="nav-foot">{foot}</div>}
      </nav>
      <div className="content">{children}</div>
      <nav className="tabbar" aria-label="Sections">
        {items.map(({ to, icon: I, label, tour, end }) => (
          <NavLink key={to} to={to} end={end} data-tour={tour}>
            <I size={20} strokeWidth={1.75} aria-hidden />{label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function PageHead({ title, sub, crumb, children }) {
  return (
    <header className="page-head">
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </header>
  )
}

export function PrivacyFoot() {
  const t = useT({ privacy: { en: 'Your data is never sold or used for ads.', hi: 'आपका डेटा न बेचा जाता है, न विज्ञापन में लगता है।' } })
  return <span className="row top"><ShieldCheck size={14} aria-hidden />{t('privacy')}</span>
}

export function Loading() {
  const t = useT()
  return <div className="loading">{t('loading')}</div>
}

export function ErrorNote({ error, onRetry }) {
  const t = useT()
  if (!error) return null
  return (
    <div className="alert" role="alert">
      <span className="grow">{error}</span>
      {onRetry && <button className="link" onClick={onRetry}>{t('retry')}</button>}
    </div>
  )
}
