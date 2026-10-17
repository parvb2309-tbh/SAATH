import { Link } from 'react-router-dom'
import { FileText, FlaskConical, Phone } from 'lucide-react'
import { tr, useLang, useT } from '../lib/i18n'
import Icon from './Icon'

const S = {
  notAtAll: { en: 'Not important', hi: 'ज़रूरी नहीं' },
  very: { en: 'Very important', hi: 'बहुत ज़रूरी' },
  col_agreed: { en: 'Fully agreed', hi: 'पूरी सहमति' },
  col_verify: { en: 'Needs verification', hi: 'जाँचना ज़रूरी' },
  col_simulate: { en: 'Try it in a simulation', hi: 'सिमुलेशन में करके देखें' },
  col_counsellor: { en: 'Talk to a counsellor', hi: 'काउंसलर से बात' },
  you: { en: 'Student', hi: 'विद्यार्थी' },
  parent: { en: 'Parent', hi: 'माता-पिता' },
  seeSection: { en: 'Report section {n}', hi: 'रिपोर्ट भाग {n}' },
  openSim: { en: 'Open simulation', hi: 'सिमुलेशन खोलें' },
  askCounsellor: { en: 'Ask a counsellor', hi: 'काउंसलर से पूछें' },
  agreement: { en: '{p}% of priorities agreed', hi: '{p}% बातों पर सहमति' },
  childTries: { en: 'Your child tries this in the Lab', hi: 'बच्चा इसे लैब में करके देखेगा' },
}
export const COLUMN_COLORS = { agreed: 'var(--success)', verify: 'var(--warning)', simulate: 'var(--teal)', counsellor: 'var(--error)' }

export function PriorityScales({ priorities, value, onChange }) {
  const t = useT(S)
  const { lang } = useLang()
  return (
    <div>
      <div className="row between tiny muted" style={{ justifyContent: 'flex-end', gap: 24 }}><span>1 = {t('notAtAll')}</span><span>5 = {t('very')}</span></div>
      {priorities.map((p) => (
        <div key={p.id} className="prio-q">
          <span className="row"><Icon name={p.icon} size={18} /><span>{tr(p, lang)}</span></span>
          <div className="scale" role="radiogroup" aria-label={tr(p, lang)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={value[p.id] === n} className={value[p.id] === n ? 'on' : ''}
                onClick={() => onChange({ ...value, [p.id]: n })}>{n}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConsensusBoard({ plan, reportHref, onAsk, simLinks = true }) {
  const t = useT(S)
  const { lang } = useLang()
  return (
    <div className="stack">
      <div className="row"><strong>{t('agreement', { p: plan.agreement_pct })}</strong></div>
      <div className="meter"><span style={{ width: `${plan.agreement_pct}%`, background: 'var(--success)' }} /></div>
      <div className="board">
        {['agreed', 'verify', 'simulate', 'counsellor'].map((col) => {
          const items = plan.items.filter((i) => i.column === col)
          return (
            <div key={col} className="board-col" style={{ '--c': COLUMN_COLORS[col] }}>
              <h3>{t(`col_${col}`)}<span className="muted">{items.length}</span></h3>
              {items.map((i) => (
                <div key={i.id} className="board-item">
                  <div className="row"><Icon name={i.icon} size={14} /><strong>{tr(i, lang)}</strong></div>
                  <div className="gap"><span>{t('you')}: {i.student}</span><span>{t('parent')}: {i.parent}</span></div>
                  {col === 'verify' && i.evidence && reportHref && (
                    <Link className="btn small" to={`${reportHref}#sec-${['', 'scope', 'competencies', 'prerequisites', 'duration', 'nsqf', 'fees', 'assistance', 'accreditation', 'hiring', 'salary', 'self_employment', 'progression', 'safety', 'lateral', 'faq', 'sources'][i.evidence]}`}>
                      <FileText size={12} />{t('seeSection', { n: i.evidence })}
                    </Link>
                  )}
                  {col === 'simulate' && i.sim && (simLinks
                    ? <Link className="btn small" to={`/student/lab/${i.sim}`}><FlaskConical size={12} />{t('openSim')}</Link>
                    : <span className="tag teal"><FlaskConical size={12} />{t('childTries')}</span>)}
                  {col === 'counsellor' && onAsk && <button className="btn small" onClick={() => onAsk(i.id)}><Phone size={12} />{t('askCounsellor')}</button>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
