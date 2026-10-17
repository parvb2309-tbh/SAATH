import { Link } from 'react-router-dom'
import { ExternalLink, Phone, Route } from 'lucide-react'
import { STATUS, useLang, useT } from '../lib/i18n'

export function SourceLine({ meta, demo = true }) {
  const t = useT()
  const { lang } = useLang()
  if (!meta) return null
  return (
    <div className="source">
      <span className={`status status-${meta.status}`}>{STATUS[meta.status]?.[lang] ?? meta.status}</span>
      {meta.scope === 'state' && <span className="status status-estimate">{t('stateLevel')}: {meta.district}</span>}
      <span>{t('source')}: {meta.source}, {meta.year}</span>
      {demo && <span className="tag demo">{t('demoData')}</span>}
    </div>
  )
}

function FactCard({ card }) {
  return (
    <div className="card fact">
      <div className="card-kicker">{card.title}</div>
      <div className="fact-value">{card.value}</div>
      {card.sub && <div className="small">{card.sub}</div>}
      <SourceLine meta={card} />
    </div>
  )
}

function StoryCard({ card }) {
  const t = useT()
  return (
    <div className="card story">
      <div className="card-kicker">{card.kind === 'parent' ? t('storyLabel') : t('alumniLabel')} · {card.district}</div>
      <p>{card.text}</p>
      <span className="tag demo">{t('demoData')}</span>
    </div>
  )
}

function SchemeCard({ card }) {
  const t = useT()
  return (
    <div className="card scheme">
      <div className="card-kicker">{t('schemeLabel')}</div>
      <div className="strong">{card.name}</div>
      <p>{card.text}</p>
      {card.link && (
        <a href={card.link} target="_blank" rel="noreferrer" className="row small">
          {card.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}<ExternalLink size={12} aria-hidden />
        </a>
      )}
    </div>
  )
}

function HelplineCard({ card }) {
  const t = useT()
  return (
    <div className="card helpline">
      <div className="card-kicker">{t('helplineLabel')}</div>
      <a className="helpline-number" href={`tel:${card.number.replace(/\D/g, '')}`}><Phone size={18} aria-hidden />{card.name} {card.number}</a>
      <p>{card.text}</p>
    </div>
  )
}

export default function Cards({ cards, pathwayHref }) {
  const t = useT()
  if (!cards?.length) return null
  return (
    <div className="cards">
      {cards.map((c) => {
        if (c.type === 'fact') return <FactCard key={c.id} card={c} />
        if (c.type === 'story') return <StoryCard key={c.id} card={c} />
        if (c.type === 'scheme') return <SchemeCard key={c.id} card={c} />
        if (c.type === 'helpline') return <HelplineCard key={c.id} card={c} />
        if (c.type === 'ladder' && pathwayHref) {
          return <Link key={c.id} to={pathwayHref} className="btn small" style={{ justifySelf: 'start' }}><Route size={14} />{t('pathwayLink')}</Link>
        }
        return null
      })}
    </div>
  )
}
