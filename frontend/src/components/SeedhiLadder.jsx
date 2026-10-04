import { SourceLine } from './Cards'
import { useT } from '../lib/i18n'

const ICON = { pre: '📗', course: '🎓', job: '🧰', growth: '📈', next: '🧭' }

// Seedhi (ladder): the career path drawn as rising steps, each with its own earnings band.
export default function SeedhiLadder({ data }) {
  const t = useT()
  if (!data?.trade) return null
  const steps = data.steps
  return (
    <section id="seedhi" className="panel ladder">
      <h3>🪜 {t('ladderTitle')}</h3>
      <div className="ladder-trade">{data.trade.name}</div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.kind} className={`step step-${s.kind}`} style={{ '--i': i }}>
            <div className="step-icon" aria-hidden>{ICON[s.kind]}</div>
            <div className="step-body">
              <div className="step-title">{s.title}{s.sub && <span className="step-sub"> · {s.sub}</span>}</div>
              {s.text && <div className="step-text">{s.text}</div>}
              {s.earn && (
                <div className="earn"><span>{s.earn_label}</span><strong>{s.earn}</strong></div>
              )}
              {s.earn2 && (
                <div className="earn"><span>{s.earn2_label}</span><strong>{s.earn2}</strong></div>
              )}
              {s.options && (
                <ul className="options">{s.options.map((o) => <li key={o}>{o}</li>)}</ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      <SourceLine meta={data.outcome} />
    </section>
  )
}
