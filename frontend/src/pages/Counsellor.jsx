import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const PRIORITY = {
  1: { label: 'Urgent', cls: 'critical', icon: '⛑️' },
  2: { label: 'High', cls: 'serious', icon: '▲' },
  3: { label: 'Normal', cls: 'warning', icon: '●' },
  4: { label: 'Low', cls: 'good', icon: '○' },
}
const MEMBER = { learner: 'Learner', mother: 'Mother', father: 'Father', guardian: 'Guardian' }

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  return `${Math.round(mins / 1440)} d ago`
}

function Mood({ value }) {
  if (value === null || value === undefined) return <span className="muted">—</span>
  const cls = value <= -0.4 ? 'neg' : value >= 0.3 ? 'pos' : 'mid'
  return <span className={`mood ${cls}`} title={`Sentiment ${value}`}>{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
}

export default function Counsellor({ meta }) {
  const [status, setStatus] = useState('open')
  const [list, setList] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [notes, setNotes] = useState('')

  const loadList = () => api.escalations(status).then((l) => {
    setList(l)
    if (!selected && l.length) setSelected(l[0].id)
  })
  useEffect(() => {
    loadList()
    const id = setInterval(loadList, 15000)
    return () => clearInterval(id)
  }, [status])
  useEffect(() => {
    if (selected) api.escalation(selected).then((d) => { setDetail(d); setNotes(d.notes || '') })
  }, [selected])

  const save = async (changes) => {
    const d = await api.patchEscalation(selected, changes)
    setDetail(d)
    loadList()
  }

  return (
    <div className="console">
      <aside className="queue panel">
        <div className="row between">
          <h2>Call queue</h2>
          <div className="seg">
            {['open', 'resolved'].map((s) => (
              <button key={s} className={status === s ? 'on' : ''} onClick={() => { setStatus(s); setSelected(null); setDetail(null) }}>
                {s === 'open' ? 'Open' : 'Resolved'}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 && <p className="muted">No families waiting.</p>}
        <ul>
          {list.map((e) => {
            const p = PRIORITY[e.priority] || PRIORITY[3]
            return (
              <li key={e.id}>
                <button className={`queue-item ${selected === e.id ? 'on' : ''}`} onClick={() => setSelected(e.id)}>
                  <span className={`prio prio-${p.cls}`}>{p.icon} {p.label}</span>
                  <span className="queue-title">{e.trade_icon} {e.trade_en || 'No trade yet'} · {e.district_en}</span>
                  <span className="queue-reason">{e.reason}</span>
                  <span className="queue-meta">
                    {(e.members || []).map((m) => MEMBER[m]).join(', ')} · {ago(e.created_at)}
                    {e.synthetic ? <span className="demo-tag">Demo</span> : <span className="live-tag">Live</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section className="case panel">
        {!detail ? <p className="muted">Select a family from the queue.</p> : (
          <>
            <div className="row between wrap">
              <div>
                <h2>{detail.trade_icon} {detail.trade_en} · {detail.district_en}, {detail.state}</h2>
                <div className="muted">
                  {(detail.members || []).map((m) => MEMBER[m]).join(', ')} · learner: {{ f: 'daughter', m: 'son' }[detail.learner_gender] || 'not given'}
                  {' '}· family language: {detail.language === 'hi' ? 'Hindi' : 'English'}
                </div>
              </div>
              <span className={`prio prio-${(PRIORITY[detail.priority] || PRIORITY[3]).cls}`}>
                {(PRIORITY[detail.priority] || PRIORITY[3]).icon} {(PRIORITY[detail.priority] || PRIORITY[3]).label}
              </span>
            </div>

            <div className="handover">
              <div className="card-kicker">Why SAATH escalated</div>
              <p><strong>{detail.reason}</strong></p>
              <div className="card-kicker">Handover note {detail.engine === 'gemini' ? '(written by Gemini)' : '(auto-generated)'}</div>
              <p>{detail.summary}</p>
              <div className="call-row">
                {detail.phone
                  ? <a className="btn primary" href={`tel:${detail.phone}`}>📞 Call {detail.phone}</a>
                  : <span className="muted">No phone number yet: the family can add one in the app.</span>}
                {detail.callback_time && <span className="muted">Preferred time: {detail.callback_time}</span>}
                <span className="muted">Mood: start <Mood value={detail.first_sentiment} /> → now <Mood value={detail.last_sentiment} /></span>
              </div>
            </div>

            <h3>Conversation</h3>
            <div className="transcript">
              {detail.messages.filter((m) => m.text).map((m) => (
                <div key={m.id} className={`t-row ${m.role}`}>
                  <div className="t-who">{m.role === 'assistant' ? 'SAATH' : MEMBER[m.speaker] || m.speaker}</div>
                  <div className="t-text">{m.text}</div>
                  {m.role === 'user' && (
                    <div className="t-tags">
                      {(m.concerns || []).map((c) => (
                        <span key={c} className="tag">{meta.concerns[c]?.icon} {meta.concerns[c]?.en}</span>
                      ))}
                      <Mood value={m.sentiment} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <h3>Counsellor notes</h3>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed on the call, next steps…" />
            <div className="row gap">
              <button className="btn" onClick={() => save({ notes })}>Save notes</button>
              {detail.status !== 'in_progress' && detail.status !== 'resolved' && (
                <button className="btn" onClick={() => save({ status: 'in_progress', notes })}>Mark in progress</button>
              )}
              {detail.status !== 'resolved'
                ? <button className="btn primary" onClick={() => save({ status: 'resolved', notes })}>✓ Resolve</button>
                : <button className="btn" onClick={() => save({ status: 'open' })}>Reopen</button>}
              <span className="muted">Status: {detail.status.replace('_', ' ')}</span>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
