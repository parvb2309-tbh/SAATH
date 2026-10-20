import { useEffect, useState } from 'react'
import { Lock, Phone, PhoneCall } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import Hexagon from '../components/Hexagon'
import Icon from '../components/Icon'
import { Loading } from '../components/Shell'

const RISK = {
  0: { label: 'L0 · Exploring', c: 'var(--text-2)' },
  1: { label: 'L1 · Decision support', c: 'var(--warning)' },
  2: { label: 'L2 · Distress', c: '#b4561f' },
  3: { label: 'L3 · Safeguarding', c: 'var(--error)' },
}
const MEMBER = { learner: 'Learner', mother: 'Mother', father: 'Father', guardian: 'Guardian' }
const SLA_HOURS = 24

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  return `${Math.round(mins / 1440)} d ago`
}

function Sla({ e }) {
  if ((e.risk_level ?? 1) < 2 || e.status === 'resolved') return null
  if (e.first_contact_at) {
    const h = (new Date(e.first_contact_at) - new Date(e.created_at)) / 3600000
    return <span className={`sla ${h > SLA_HOURS ? 'late' : ''}`}>Contacted in {h.toFixed(1)} h</span>
  }
  const left = SLA_HOURS - (Date.now() - new Date(e.created_at).getTime()) / 3600000
  const mins = Math.floor(left * 60)
  return <span className={`sla ${left < 4 ? 'late' : ''}`}>{left > 0 ? `${Math.floor(mins / 60)} h ${mins % 60} m to first contact` : `SLA missed by ${Math.ceil(-left)} h`}</span>
}

function Mood({ value }) {
  if (value === null || value === undefined) return <span className="muted">—</span>
  const cls = value <= -0.4 ? 'neg' : value >= 0.3 ? 'pos' : 'mid'
  return <span className={`mood ${cls}`} title={`Sentiment ${value}`}>{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
}

export default function Counsellor() {
  const { meta } = useLang()
  const [status, setStatus] = useState('open')
  const [list, setList] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [notes, setNotes] = useState('')
  const [, tick] = useState(0)

  const loadList = () => api.escalations(status).then((l) => {
    setList(l)
    setSelected((s) => s ?? l[0]?.id ?? null)
  })
  useEffect(() => {
    loadList()
    const id = setInterval(() => { loadList(); tick((x) => x + 1) }, 30000)
    return () => clearInterval(id)
  }, [status])
  useEffect(() => {
    if (selected) api.escalation(selected).then((d) => { setDetail(d); setNotes(d.notes || '') })
  }, [selected])

  const save = async (changes) => {
    setDetail(await api.patchEscalation(selected, changes))
    loadList()
  }
  if (!list) return <div className="content"><Loading /></div>
  const counts = [3, 2, 1].map((l) => list.filter((e) => (e.risk_level ?? 1) === l).length)

  return (
    <div className="content" style={{ maxWidth: 1400 }}>
      <header className="page-head">
        <div><h1>Priority referral queue</h1><p>Safeguarding cases first, then distress referrals, then booked decision-support sessions.</p></div>
        <div className="row">
          {counts.map((n, i) => <span key={i} className={`risk risk-${3 - i}`}>{RISK[3 - i].label.split(' · ')[0]} · {n}</span>)}
        </div>
      </header>
      <div className="console">
        <aside className="panel flush">
          <div className="row between" style={{ padding: 12, borderBottom: '1px solid var(--line)' }}>
            <strong>{list.length} {status === 'open' ? 'open' : 'resolved'}</strong>
            <div className="seg">
              {['open', 'resolved'].map((s) => (
                <button key={s} className={status === s ? 'on' : ''} onClick={() => { setStatus(s); setSelected(null); setDetail(null) }}>{s === 'open' ? 'Open' : 'Resolved'}</button>
              ))}
            </div>
          </div>
          {list.length === 0 && <p className="muted" style={{ padding: 16 }}>No cases waiting.</p>}
          {list.map((e) => (
            <button key={e.id} className={`queue-item ${selected === e.id ? 'on' : ''}`} style={{ '--c': RISK[e.risk_level ?? 1].c }} onClick={() => setSelected(e.id)}>
              <span className="row between"><span className={`risk risk-${e.risk_level ?? 1}`}>{RISK[e.risk_level ?? 1].label}</span><Sla e={e} /></span>
              <span className="queue-title">{e.trade_en || 'No trade yet'} · {e.district_en}</span>
              <span className="queue-reason">{e.reason}</span>
              <span className="queue-meta">{(e.members || []).map((m) => MEMBER[m]).join(', ')} · {ago(e.created_at)}
                {e.synthetic ? <span className="tag demo">Demo</span> : <span className="tag ok">Live</span>}</span>
            </button>
          ))}
        </aside>

        <section className="panel">
          {!detail ? <p className="muted">Select a case from the queue.</p> : (
            <div className="stack">
              <div className="row between wrap top">
                <div>
                  <h2 style={{ marginBottom: 4 }}>{detail.profile?.name || (detail.members || []).map((m) => MEMBER[m]).join(', ')} · {detail.trade_en || 'No trade'} · {detail.district_en}</h2>
                  <div className="small muted">Language: {detail.language === 'hi' ? 'Hindi' : 'English'} · learner: {{ f: 'girl', m: 'boy' }[detail.learner_gender] || 'not given'}
                    {detail.profile?.age ? ` · ${detail.profile.age} yrs` : ''}{detail.halted ? ' · career chat paused' : ''}</div>
                </div>
                <div className="stack-1" style={{ justifyItems: 'end' }}>
                  <span className={`risk risk-${detail.risk_level ?? 1}`}>{RISK[detail.risk_level ?? 1].label}</span>
                  <Sla e={detail} />
                </div>
              </div>

              {(detail.risk_level ?? 1) >= 3 && (
                <div className="alert"><span><strong>Safeguarding protocol.</strong> Created automatically without waiting for consent. Follow the institution's safeguarding procedure today; the learner has been shown Tele-MANAS 14416 and KIRAN 1800-599-0019.</span></div>
              )}

              <div className="handover">
                <div className="section-title">Why this case is here</div>
                <p><strong>{detail.reason}</strong></p>
                <div className="section-title">Handover note {detail.engine === 'gemini' ? '(written by Gemini)' : '(auto-generated)'}</div>
                <p>{detail.summary}</p>
                <div className="row wrap">
                  {detail.phone ? <a className="btn primary" href={`tel:${detail.phone}`}><Phone size={16} />Call {detail.phone}</a>
                    : <span className="small muted">No phone number yet.</span>}
                  {!detail.first_contact_at && detail.status !== 'resolved' && <button className="btn" onClick={() => save({ first_contact: true })}><PhoneCall size={16} />Log first contact</button>}
                  {detail.callback_time && <span className="small muted">Preferred time: {detail.callback_time}</span>}
                  <span className="small muted">Mood: <Mood value={detail.first_sentiment} /> → <Mood value={detail.last_sentiment} /></span>
                </div>
              </div>

              <CaseProfile p={detail.profile} meta={meta} />

              <div>
                <h3>Conversation</h3>
                <div className="transcript">
                  {detail.messages.filter((m) => m.text).map((m) => (
                    <div key={m.id} className={`t-row ${m.role}`}>
                      <div className="t-who">{m.role === 'assistant' ? 'UDAAN' : MEMBER[m.speaker] || m.speaker}</div>
                      <div>{m.text}</div>
                      {m.role === 'user' && (
                        <div className="t-tags">
                          {(m.concerns || []).map((c) => <span key={c} className="tag"><Icon name={meta.concerns[c]?.icon} size={12} />{meta.concerns[c]?.en}</span>)}
                          <Mood value={m.sentiment} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3>Session notes</h3>
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed, agreed next steps…" />
                <div className="row wrap mt-1">
                  <button className="btn" onClick={() => save({ notes })}>Save notes</button>
                  {detail.status === 'open' && <button className="btn" onClick={() => save({ status: 'in_progress', notes })}>Mark in progress</button>}
                  {detail.status !== 'resolved'
                    ? <button className="btn primary" onClick={() => save({ status: 'resolved', notes })}>Resolve</button>
                    : <button className="btn" onClick={() => save({ status: 'open' })}>Reopen</button>}
                  <span className="small muted">Status: {detail.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function CaseProfile({ p, meta }) {
  if (!p) return null
  if (!p.consented) {
    return <div className="note warn"><Lock size={16} /><span>The learner has not agreed to share their Career DNA with counsellors. Ask them during the call.</span></div>
  }
  if (!p.dna) return <div className="note"><span>The learner has not built a Career DNA yet.</span></div>
  const trade = (id) => meta.trades.find((x) => x.id === id)?.name_en || id
  const max = Math.max(...p.attribution.map((a) => Math.abs(a.shap)), 0.01)
  const shown = p.attribution.filter((a) => Math.abs(a.shap) >= 0.002).slice(0, 10)
  return (
    <div className="grid-2">
      <div className="panel tight">
        <h3>Career DNA <span className="tag ok">Shared with consent</span></h3>
        <Hexagon riasec={p.dna.riasec} labels={meta.riasec_labels} lang="en" size={240} />
        <div className="small">Top matches: {p.matches.slice(0, 3).map((m) => `${trade(m.trade_id)} (${m.score})`).join(', ')}</div>
      </div>
      <div className="panel tight">
        <h3>Why {trade(p.focus_trade)} scores {p.focus_score}</h3>
        <p className="tiny muted">Each factor's contribution compared with the district cohort average. The score is a sum of these terms, so these are exact (SHAP-equivalent) attributions.</p>
        {shown.map((a) => (
          <div key={`${a.group}-${a.key}`} className="attr-row">
            <span className="small">{a.label} <span className="tiny muted">{a.group}</span></span>
            <div className="attr-track">
              <span className={a.shap >= 0 ? 'pos' : 'neg'} style={{ width: `${(50 * Math.abs(a.shap)) / max}%` }} />
            </div>
            <b className="small">{a.shap > 0 ? '+' : ''}{(100 * a.shap).toFixed(1)}</b>
          </div>
        ))}
        <div className="small muted mt-1">Limits: {Object.entries(p.constraints).filter(([, v]) => v !== null && v !== undefined && v !== 0).map(([k, v]) => `${k.replaceAll('_', ' ')}${v === 1 && k === 'needs_stipend' ? '' : ` ${v}`}`).join(' · ') || 'none set'}</div>
      </div>
    </div>
  )
}
