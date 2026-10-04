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
  const [tab, setTab] = useState(storage.get('saath.adminTab') || 'overview')
  const [includeDemo, setIncludeDemo] = useState(true)
  const choose = (t) => { setTab(t); storage.set('saath.adminTab', t) }
  return (
    <div className="admin">
      <div className="row between wrap admin-head">
        <div className="seg">
          {[['overview', 'Resistance overview'], ['families', 'Families & updates'], ['data', 'Outcome data']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => choose(k)}>{l}</button>
          ))}
        </div>
        {tab !== 'data' && (
          <label className="switch">
            <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
            Include demo sessions
          </label>
        )}
      </div>
      {tab === 'overview' && <Overview meta={meta} includeDemo={includeDemo} />}
      {tab === 'families' && <Families includeDemo={includeDemo} />}
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
        <Kpi label="Average mood" value={`${fmt(k.avg_first)} → ${fmt(k.avg_last)}`} sub="start → end of session (−1 to +1)" />
        <Kpi label="Waiting for a counsellor" value={k.open_escalations} sub={`${k.urgent_escalations} urgent or high priority`} />
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
                  <td>{d.top_concern ? `${meta.concerns[d.top_concern].icon} ${meta.concerns[d.top_concern].en}` : '—'}</td>
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
    setFlash('Update sent. The family sees it in their SAATH screen and can listen to it.')
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
          SAATH answers only from this table. Upload a CSV from a placement tracker or tracer study to replace the demo figures.
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
