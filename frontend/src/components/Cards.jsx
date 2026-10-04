import { STATUS, useLang, useT } from '../lib/i18n'

export function SourceLine({ meta }) {
  const t = useT()
  const { lang } = useLang()
  if (!meta) return null
  return (
    <div className="source">
      <span className={`status status-${meta.status}`}>{STATUS[meta.status]?.[lang] ?? meta.status}</span>
      {meta.scope === 'state' && <span className="status status-estimate">{t('stateLevel')}: {meta.district}</span>}
      <span>{t('source')}: {meta.source}, {meta.year}</span>
      <span className="demo-tag">{t('demoData')}</span>
    </div>
  )
}

function FactCard({ card }) {
  return (
    <div className="card fact">
      <div className="fact-title">{card.title}</div>
      <div className="fact-value">{card.value}</div>
      {card.sub && <div className="fact-sub">{card.sub}</div>}
      <SourceLine meta={card} />
    </div>
  )
}

function StoryCard({ card }) {
  const t = useT()
  return (
    <div className="card story">
      <div className="card-kicker">{card.kind === 'parent' ? t('storyLabel') : t('alumniLabel')} · {card.district}</div>
      <p>“{card.text}”</p>
      <div className="demo-tag">{t('demoData')}</div>
    </div>
  )
}

function SchemeCard({ card }) {
  const t = useT()
  return (
    <div className="card scheme">
      <div className="card-kicker">{t('schemeLabel')}</div>
      <div className="scheme-name">{card.name}</div>
      <p>{card.text}</p>
      {card.link && <a href={card.link} target="_blank" rel="noreferrer">{card.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>}
    </div>
  )
}

function HelplineCard({ card }) {
  const t = useT()
  return (
    <div className="card helpline">
      <div className="card-kicker">{t('helplineLabel')}</div>
      <a className="helpline-number" href={`tel:${card.number}`}>📞 {card.name} {card.number}</a>
      <p>{card.text}</p>
    </div>
  )
}

function LadderLink() {
  const t = useT()
  const go = () => {
    const el = document.getElementById('seedhi')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.classList.add('flash')
    setTimeout(() => el?.classList.remove('flash'), 1200)
  }
  return <button className="chip ladder-link" onClick={go}>🪜 {t('ladderTitle')}</button>
}

export default function Cards({ cards }) {
  if (!cards?.length) return null
  return (
    <div className="cards">
      {cards.map((c) => {
        if (c.type === 'fact') return <FactCard key={c.id} card={c} />
        if (c.type === 'story') return <StoryCard key={c.id} card={c} />
        if (c.type === 'scheme') return <SchemeCard key={c.id} card={c} />
        if (c.type === 'helpline') return <HelplineCard key={c.id} card={c} />
        if (c.type === 'ladder') return <LadderLink key={c.id} />
        return null
      })}
    </div>
  )
}
