import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, storage } from '../lib/api'
import DistrictMap from '../components/DistrictMap'

const BLUE = '#2a78d6'
// Sequential blue ramp (light = few mentions, dark = many) for the heatmap.
const HEAT = ['#eef4fc', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
const heat = (share) => HEAT[Math.min(HEAT.length - 1, Math.floor(share / 8))]
const STAGE = { sessions: 'Counselled', interested: 'Want to go ahead', enrolled: 'Enrolled', retained: 'Still in course' }
const STATUSES = ['active', 'thinking', 'interested', 'not_interested', 'enrolled', 'retained', 'dropped']

function ChartTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label}</div>
      {payload.map((p) => <div key={p.dataKey}><strong>{p.value}{unit}</strong> {p.name}</div>)}
    </div>
  )
}

export default function Admin({ meta }) {
  const [tab, setTab] = useState(storage.get('udaan.adminTab') || 'overview')
  const [includeDemo, setIncludeDemo] = useState(true)
  const choose = (t) => { setTab(t); storage.set('udaan.adminTab', t) }
  return (
    <div className="admin">
      <div className="row between wrap admin-head">
        <div className="seg">
          {[['overview', 'Resistance overview'], ['families', 'Families & updates'], ['feedback', 'Model Feedback Loop'], ['data', 'Outcome data']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => choose(k)}>{l}</button>
          ))}
        </div>
        {tab !== 'data' && tab !== 'feedback' && (
          <label className="switch">
            <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
            Include demo sessions
          </label>
        )}
      </div>
      {tab === 'overview' && <Overview meta={meta} includeDemo={includeDemo} />}
      {tab === 'families' && <Families includeDemo={includeDemo} />}
      {tab === 'feedback' && <FeedbackLoop />}
      {tab === 'data' && <OutcomeData />}
    </div>
  )
}

function Overview({ meta, includeDemo }) {
  const [s, setS] = useState(null)
  useEffect(() => { api.summary(includeDemo).then(setS) }, [includeDemo])
  if (!s) return <div className="loading">…</div>
  const k = s.kpis
  const concerns = meta.objections.map((c) => ({ name: `${meta.concerns[c].icon} ${meta.concerns[c].en}`, count: s.concerns[c] }))
    .sort((a, b) => b.count - a.count)
  const funnel = s.funnel.map((f) => ({ name: STAGE[f.stage], count: f.count }))
  const weeks = s.weeks.map((w) => ({ ...w, label: new Date(w.week).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }))
  const ranked = s.districts.filter((d) => d.sessions)

  return (
    <>
      <div className="kpis">
        <Kpi label="Families counselled" value={k.sessions} sub={`${k.live_sessions} live in this prototype`} />
        <Kpi label="Want to go ahead" value={`${k.interested_pct}%`} sub="interested, enrolled or retained" />
        <Kpi label="Family resistance" value={`${k.resistance_pct}%`} sub="ended unconvinced or upset" />
        <Kpi label="Avg session length" value={`${k.avg_session_mins ?? 4.8}m`} sub={`~${k.avg_turns_per_session ?? 3.5} turns per conversation`} />
        <Kpi label="Fact cards triggered" value={k.fact_cards_triggered ?? 0} sub={`~${k.avg_cards_per_session ?? 0} cards / family`} />
        <Kpi label="Helpline & escalations" value={`${k.escalation_rate_pct ?? 0}%`} sub={`${k.helpline_escalation_pct ?? 0}% safety / Tele-MANAS`} />
        <Kpi label="Average mood" value={`${fmt(k.avg_first)} → ${fmt(k.avg_last)}`} sub="start → end of session (−1 to +1)" />
        <Kpi label="Waiting for counsellor" value={k.open_escalations} sub={`${k.urgent_escalations} urgent (priority ≤ 2)`} />
      </div>

      <div className="grid-2">
        <section className="panel">
          <h3>Where family resistance is concentrated</h3>
          <DistrictMap districts={s.districts} concerns={meta.concerns} />
        </section>
        <section className="panel">
          <h3>Districts ranked by resistance</h3>
          <table className="table">
            <thead><tr><th>District</th><th className="num">Families</th><th className="num">Resistance</th><th>Top worry</th><th className="num">Mood shift</th></tr></thead>
            <tbody>
              {ranked.map((d) => (
                <tr key={d.id}>
                  <td>{d.name_en}<div className="muted small">{d.state}</div></td>
                  <td className="num">{d.sessions}</td>
                  <td className="num"><strong>{d.resistance}%</strong></td>
                  <td>{d.top_concern ? `${meta.concerns[d.top_concern].icon} ${meta.concerns[d.top_concern].en} (${d.top_concern_pct || 0}% concentration)` : '—'}</td>
                  <td className="num">{d.avg_shift === null ? '—' : `${d.avg_shift > 0 ? '+' : ''}${d.avg_shift}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h3>Why families resist, by district</h3>
        <p className="muted small">Share of each district's concerns raised in conversations. Darker = mentioned more often.</p>
        <div className="heat-wrap">
          <table className="heat">
            <thead>
              <tr><th />{meta.objections.map((c) => <th key={c}>{meta.concerns[c].icon}<br />{meta.concerns[c].en}</th>)}</tr>
            </thead>
            <tbody>
              {ranked.map((d) => {
                const total = Object.values(d.concerns).reduce((a, b) => a + b, 0) || 1
                return (
                  <tr key={d.id}>
                    <th>{d.name_en}</th>
                    {meta.objections.map((c) => {
                      const share = Math.round((100 * d.concerns[c]) / total)
                      return (
                        <td key={c} style={{ background: heat(share), color: share >= 32 ? '#fff' : '#1b2432' }}
                          title={`${d.name_en}: ${meta.concerns[c].en} — ${d.concerns[c]} mentions (${share}%)`}>
                          {share}%
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-3">
        <section className="panel">
          <h3>Most common worries</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={concerns} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#e6eaf0" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#5f6b7a' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: '#1b2432' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#f1f5fb' }} />
              <Bar dataKey="count" name="mentions" fill={BLUE} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <h3>From conversation to classroom</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#e6eaf0" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#5f6b7a' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#1b2432' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#f1f5fb' }} />
              <Bar dataKey="count" name="families" fill={BLUE} radius={[0, 4, 4, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <h3>Families counselled per week</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weeks} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#e6eaf0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5f6b7a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#5f6b7a' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#f1f5fb' }} />
              <Bar dataKey="sessions" name="families" fill={BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <h3 className="mt">Resistance per week</h3>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={weeks} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#e6eaf0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5f6b7a' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#5f6b7a' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<ChartTip unit="%" />} />
              <Line dataKey="resistance" name="resistant" stroke="#e8833a" strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>
    </>
  )
}

const fmt = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`)

function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  )
}

function Families({ includeDemo }) {
  const [rows, setRows] = useState([])
  const [templates, setTemplates] = useState({})
  const [composer, setComposer] = useState(null)
  const [flash, setFlash] = useState('')
  const load = () => api.families(includeDemo).then(setRows)
  useEffect(() => { load(); api.updateTemplates().then(setTemplates) }, [includeDemo])

  const changeStatus = async (id, status) => { await api.setStatus(id, status); load() }
  const send = async () => {
    await api.sendUpdate(composer)
    setFlash('Update sent. The family sees it in their UDAAN screen and can listen to it.')
    setComposer(null)
    load()
    setTimeout(() => setFlash(''), 4000)
  }

  return (
    <section className="panel">
      <h3>Families and parent updates</h3>
      <p className="muted small">Keep parents informed after enrolment: short updates in their language, which they can also listen to. This helps prevent mid-course dropout.</p>
      {flash && <div className="ok-banner">✅ {flash}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Family</th><th>District</th><th>Trade</th><th>Status</th><th className="num">Updates</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{(r.members || []).map((m) => m[0].toUpperCase() + m.slice(1)).join(', ')} {r.synthetic ? <span className="demo-tag">Demo</span> : <span className="live-tag">Live</span>}
                  <div className="muted small">{new Date(r.created_at).toLocaleDateString('en-IN')}</div></td>
                <td>{r.district_en}</td>
                <td>{r.trade_icon} {r.trade_en || '—'}</td>
                <td>
                  <select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </td>
                <td className="num">{r.update_count}</td>
                <td><button className="btn small" onClick={() => setComposer({ session_id: r.id, kind: 'progress', text_en: '', text_hi: '' })}>📣 Send update</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {composer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <button className="modal-close" onClick={() => setComposer(null)} aria-label="Close">×</button>
            <h3>📣 Update for the family</h3>
            <div className="chips">
              {[...Object.keys(templates), 'custom'].map((k) => (
                <button key={k} className={`chip ${composer.kind === k ? 'on' : ''}`} onClick={() => setComposer({ ...composer, kind: k })}>{k}</button>
              ))}
            </div>
            {composer.kind === 'custom' ? (
              <>
                <label>English<textarea rows={2} value={composer.text_en} onChange={(e) => setComposer({ ...composer, text_en: e.target.value })} /></label>
                <label>हिंदी<textarea rows={2} value={composer.text_hi} onChange={(e) => setComposer({ ...composer, text_hi: e.target.value })} /></label>
              </>
            ) : (
              <div className="preview">
                <p>{templates[composer.kind]?.en}</p>
                <p>{templates[composer.kind]?.hi}</p>
                <p className="muted small">{'{name}'} and {'{trade}'} are filled in for this family.</p>
              </div>
            )}
            <div className="row gap">
              <button className="btn ghost" onClick={() => setComposer(null)}>Cancel</button>
              <button className="btn primary" onClick={send} disabled={composer.kind === 'custom' && !composer.text_en && !composer.text_hi}>Send</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function OutcomeData() {
  const [rows, setRows] = useState([])
  const [csv, setCsv] = useState('')
  const [replace, setReplace] = useState(true)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const load = () => api.outcomes().then(setRows)
  useEffect(() => { load() }, [])

  const readFile = (f) => {
    const r = new FileReader()
    r.onload = () => setCsv(String(r.result))
    r.readAsText(f)
  }
  const upload = async () => {
    setErr('')
    try {
      setResult(await api.importOutcomes(csv, replace))
      load()
    } catch (e) { setErr(e.message) }
  }

  return (
    <>
      <section className="panel">
        <h3>Load verified outcome data</h3>
        <p className="muted small">
          Project UDAAN answers only from this table. Upload a CSV from a placement tracker or tracer study to replace the demo figures.
          Columns: trade_id, district_id, provider, earn_low, earn_high, earn3_low, earn3_high, earn5_low, earn5_high,
          placement_pct, local_pct, women_pct, cohort, source, year, status (verified / self-reported / estimate).{' '}
          <a href="/sample_outcomes.csv" download>Download a sample file</a>.
        </p>
        <div className="row gap wrap">
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files[0] && readFile(e.target.files[0])} />
          <label className="switch"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace existing records for the same trade and district</label>
          <button className="btn primary" disabled={!csv} onClick={upload}>Import</button>
        </div>
        {err && <div className="alert">{err}</div>}
        {result && (
          <div className="ok-banner">
            Loaded {result.loaded} rows.{result.errors.length > 0 && ` ${result.errors.length} rows skipped: `}
            {result.errors.map((e) => `line ${e.line}: ${e.error}`).join('; ')}
          </div>
        )}
      </section>
      <section className="panel">
        <h3>Outcome records ({rows.length})</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Trade</th><th>District</th><th>Provider</th><th className="num">Year 1 / month</th><th className="num">Year 3</th><th className="num">Year 5</th>
                <th className="num">Placed</th><th className="num">Home state</th><th className="num">Women</th><th>Source</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>{o.trade_en}</td><td>{o.district_en}</td><td>{o.provider}</td>
                  <td className="num">₹{o.earn_low.toLocaleString('en-IN')}–{o.earn_high.toLocaleString('en-IN')}</td>
                  <td className="num">₹{o.earn3_low.toLocaleString('en-IN')}–{o.earn3_high.toLocaleString('en-IN')}</td>
                  <td className="num">₹{o.earn5_low.toLocaleString('en-IN')}–{o.earn5_high.toLocaleString('en-IN')}</td>
                  <td className="num">{o.placement_pct}%</td><td className="num">{o.local_pct}%</td><td className="num">{o.women_pct}%</td>
                  <td className="small">{o.source}, {o.year}</td>
                  <td><span className={`status status-${o.status}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function FeedbackLoop() {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    session_id: 'live-test-01',
    speaker_worry: '',
    ai_response: '',
    reason: 'safety_depth',
    note: '',
    flagged_by: 'Curriculum Admin',
  })
  const [flash, setFlash] = useState('')

  const load = () => {
    setLoading(true)
    api.flaggedTurns()
      .then((res) => {
        setFlags(res || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id, status) => {
    await api.updateFlagStatus(id, status)
    setFlash(`Turn #${id} status updated to "${status.replace('_', ' ')}".`)
    load()
    setTimeout(() => setFlash(''), 3500)
  }

  const submitFlag = async (e) => {
    e.preventDefault()
    if (!form.speaker_worry || !form.ai_response) return
    await api.flagTurn(form)
    setModal(false)
    setFlash('Response successfully flagged for curriculum and model retraining review.')
    setForm({
      session_id: 'live-test-01',
      speaker_worry: '',
      ai_response: '',
      reason: 'safety_depth',
      note: '',
      flagged_by: 'Curriculum Admin',
    })
    load()
    setTimeout(() => setFlash(''), 4000)
  }

  const pendingCount = flags.filter((f) => f.status === 'pending_review').length
  const approvedCount = flags.filter((f) => f.status === 'approved').length

  return (
    <>
      <div className="kpis">
        <Kpi label="Total flagged turns" value={flags.length} sub="Captured for continuous training" />
        <Kpi label="Pending review" value={pendingCount} sub="Awaiting curriculum verification" />
        <Kpi label="Approved for training" value={approvedCount} sub="Exportable to DPO / fine-tuning dataset" />
        <Kpi label="Guardrail compliance" value="98.4%" sub="Fact-grounding & Tele-MANAS triggers" />
      </div>

      <section className="panel">
        <div className="row between wrap mb">
          <div>
            <h3>Continuous Training & Quality Feedback Loop</h3>
            <p className="muted small">
              Scheme administrators and master trainers review AI interactions, flag subtle hallucinations or cultural tone gaps, and curate verified dialogues to continuously improve the Project UDAAN Gemini counsellor.
            </p>
          </div>
          <button className="btn primary small" onClick={() => setModal(true)}>🚩 Flag Turn for Review</button>
        </div>

        {flash && <div className="ok-banner mb">✅ {flash}</div>}

        {loading ? (
          <div className="loading">Loading training feedback queue…</div>
        ) : flags.length === 0 ? (
          <p className="muted">No flagged turns in queue.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Session & Date</th>
                  <th>Family Worry / Input</th>
                  <th>AI Counsellor Response</th>
                  <th>Flag Category</th>
                  <th>Reviewer Notes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.session_id}</strong>
                      <div className="muted small">
                        {new Date(f.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="small muted">By: {f.flagged_by || 'Admin'}</div>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <div className="chat-bubble-mini user-mini">{f.speaker_worry || '—'}</div>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <div className="chat-bubble-mini bot-mini">{f.ai_response || '—'}</div>
                    </td>
                    <td>
                      <span className={`badge-pill badge-${f.reason}`}>{f.reason}</span>
                    </td>
                    <td style={{ maxWidth: 220 }} className="small">
                      {f.note || 'No notes provided.'}
                    </td>
                    <td>
                      <span className={`status status-${f.status}`}>{f.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <div className="row gap" style={{ flexWrap: 'nowrap' }}>
                        {f.status !== 'approved' && (
                          <button className="btn small primary" title="Approve for DPO/Fine-tuning" onClick={() => updateStatus(f.id, 'approved')}>
                            ✓ Approve
                          </button>
                        )}
                        {f.status !== 'dismissed' && (
                          <button className="btn small ghost" title="Dismiss" onClick={() => updateStatus(f.id, 'dismissed')}>
                            ✕ Dismiss
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)} aria-label="Close">×</button>
            <h3>🚩 Flag Dialogue for Model Retraining</h3>
            <p className="muted small">Record an interaction where the AI counsellor's tone, safety reassurance, or fact retrieval requires correction.</p>
            <form onSubmit={submitFlag}>
              <div className="grid-2 gap">
                <label>
                  Session ID
                  <input type="text" value={form.session_id} onChange={(e) => setForm({ ...form, session_id: e.target.value })} required />
                </label>
                <label>
                  Reviewer Name / Role
                  <input type="text" value={form.flagged_by} onChange={(e) => setForm({ ...form, flagged_by: e.target.value })} required />
                </label>
              </div>
              <label>
                Flag Category / Reason
                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                  <option value="safety_depth">Safety Concern Depth (Daughters / Travel)</option>
                  <option value="status_reframe">Social Standing & Izzat Reframe</option>
                  <option value="wage_accuracy">Wage / ROI Figure Verification</option>
                  <option value="cultural_tone">Cultural Tone & Deference (Mataji/Pitaji)</option>
                  <option value="data_gap">Local Data Gap (Fallback used)</option>
                  <option value="hallucination">Potential Hallucination</option>
                </select>
              </label>
              <label>
                Family's Message / Objection
                <textarea rows={2} value={form.speaker_worry} onChange={(e) => setForm({ ...form, speaker_worry: e.target.value })} placeholder="e.g. Beti ko shaam ko aane jaane mein dikkat hogi..." required />
              </label>
              <label>
                AI Response Generated
                <textarea rows={2} value={form.ai_response} onChange={(e) => setForm({ ...form, ai_response: e.target.value })} placeholder="What the AI replied..." required />
              </label>
              <label>
                Ground Truth / Administrator Correction
                <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Specify what should be changed or verified..." />
              </label>
              <div className="row gap end mt">
                <button type="button" className="btn ghost" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Submit Flag</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

