import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Check, Database, FileBarChart, Globe, Map as MapIcon, Megaphone, ScanSearch, ShieldHalf, TrendingDown, Users, X } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { Link } from 'react-router-dom'
import DistrictMap, { RAMPS, SUPPRESSED, bucket } from '../components/DistrictMap'
import IndiaMap from '../components/IndiaMap'
import Icon from '../components/Icon'
import Shell, { Loading, PageHead } from '../components/Shell'

const NAVY = '#17324D'
const TEAL = '#087F8C'

function ChartTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label}</div>
      {payload.map((p) => <div key={p.dataKey}><strong>{p.value}{unit}</strong> {p.name}</div>)}
    </div>
  )
}

export default function Admin() {
  const items = [
    { to: '/admin', end: true, icon: Globe, label: 'India overview' },
    { to: '/admin/gap', icon: MapIcon, label: 'Skill gap map' },
    { to: '/admin/barriers', icon: ShieldHalf, label: 'Barrier analytics' },
    { to: '/admin/sidh', icon: Users, label: 'SIDH enrolment' },
    { to: '/admin/metrics', icon: FileBarChart, label: 'Policy outcomes' },
    { to: '/admin/drivers', icon: ScanSearch, label: 'Interest drivers' },
    { to: '/admin/resistance', icon: TrendingDown, label: 'Family resistance' },
    { to: '/admin/families', icon: Megaphone, label: 'Parent updates' },
    { to: '/admin/data', icon: Database, label: 'Outcome data' },
  ]
  return (
    <Shell items={items} foot={<span>Aggregates only. Cohorts under 50 people are hidden and counts carry calibrated noise.</span>}>
      <Routes>
        <Route index element={<IndiaOverview />} />
        <Route path="gap" element={<GapMap />} />
        <Route path="barriers" element={<Barriers />} />
        <Route path="sidh" element={<Sidh />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="resistance" element={<Resistance />} />
        <Route path="families" element={<Families />} />
        <Route path="data" element={<OutcomeData />} />
      </Routes>
    </Shell>
  )
}

const METRICS = [
  ['students', 'Students', (v) => `${v.toLocaleString('en-IN')} students`],
  ['parents', 'Parents', (v) => `${v.toLocaleString('en-IN')} parents`],
  ['active', 'Active (30 days)', (v) => `${v.toLocaleString('en-IN')} active in the last 30 days`],
  ['new_week', 'New this week', (v) => `${v.toLocaleString('en-IN')} joined this week`],
  ['girls_pct', 'Girls %', (v) => `${v}% of students are girls`],
]
const STATE_COLS = [['state', 'State'], ['students', 'Students'], ['parents', 'Parents'], ['active', 'Active 30d'],
  ['new_week', 'New 7d'], ['girls_pct', 'Girls %']]

function IndiaOverview() {
  const [d, setD] = useState(null)
  const [metric, setMetric] = useState('students')
  const [selected, setSelected] = useState('Uttar Pradesh')
  const [sort, setSort] = useState(['students', -1])
  useEffect(() => { api.states().then(setD) }, [])
  if (!d) return <Loading />
  const [, metricLabel, fmtValue] = METRICS.find((m) => m[0] === metric)
  const values = Object.fromEntries(d.states.filter((r) => !r.suppressed).map((r) => [r.state, r[metric]]))
  const suppressed = new Set(d.states.filter((r) => r.suppressed).map((r) => r.state))
  const pilot = new Set(d.totals.pilot_states)
  const sel = d.states.find((r) => r.state === selected)
  const tot = d.totals
  const [sk, dir] = sort
  const rows = [...d.states].sort((a, b) => {
    const x = a[sk] ?? -1
    const y = b[sk] ?? -1
    return (x > y ? 1 : x < y ? -1 : 0) * dir
  })
  const maxTrade = sel?.top_trades?.[0]?.students || 1
  return (
    <>
      <PageHead title="India overview" sub="Where UDAAN's students and parents are, state by state. Pilot states also have district-level analytics." />
      <div className="kpis mb">
        <div className="kpi stat"><span className="stat-label">States and UTs with users</span><span className="stat-value">{tot.states}</span></div>
        <div className="kpi stat"><span className="stat-label">Students</span><span className="stat-value">{tot.students.toLocaleString('en-IN')}</span></div>
        <div className="kpi stat"><span className="stat-label">Parents</span><span className="stat-value">{tot.parents.toLocaleString('en-IN')}</span></div>
        <div className="kpi stat"><span className="stat-label">Active in 30 days</span><span className="stat-value">{tot.active.toLocaleString('en-IN')}</span></div>
        <div className="kpi stat"><span className="stat-label">Joined this week</span><span className="stat-value">{tot.new_week.toLocaleString('en-IN')}</span></div>
      </div>
      <div className="india-layout">
        <section className="panel">
          <div className="panel-head">
            <h3>Users by state</h3>
            <div className="seg" role="group" aria-label="Map metric">
              {METRICS.map(([k, label]) => <button key={k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{label}</button>)}
            </div>
          </div>
          <IndiaMap values={values} suppressed={suppressed} pilot={pilot} selected={selected} onSelect={setSelected}
            format={fmtValue} legendTitle={metricLabel} metricKey={metric} />
          <PrivacyNote min={d.min_cohort} eps={d.epsilon} />
          <p className="tiny muted">State boundaries: india-state-boundries-geojson (Apache-2.0), simplified.</p>
        </section>
        <section className="panel state-panel">
          {!sel ? <p className="muted">Click a state on the map.</p> : (
            <>
              <div className="row between top">
                <h2>{sel.state}</h2>
                {sel.pilot ? <span className="tag saffron">Pilot state</span> : <span className="tag">Rollout</span>}
              </div>
              {sel.suppressed ? <div className="note warn mt"><span>Fewer than 50 users here, so the breakdown is hidden to protect privacy.</span></div> : (
                <>
                  <div className="state-kpis">
                    <div className="stat"><span className="stat-value">{sel.students.toLocaleString('en-IN')}</span><span className="stat-label">Students</span></div>
                    <div className="stat"><span className="stat-value">{sel.parents.toLocaleString('en-IN')}</span><span className="stat-label">Parents</span></div>
                    <div className="stat"><span className="stat-value">{sel.active.toLocaleString('en-IN')}</span><span className="stat-label">Active in 30 days</span></div>
                    <div className="stat"><span className="stat-value">{sel.girls_pct ?? '—'}%</span><span className="stat-label">Girls among students</span></div>
                  </div>
                  <div className="section-title">Most chosen trades</div>
                  <div className="stack-1">
                    {sel.top_trades.map((tr) => (
                      <div key={tr.id}>
                        <div className="row between small"><span>{tr.name}</span><strong className="mono">{tr.students}</strong></div>
                        <div className="meter"><span style={{ width: `${(100 * tr.students) / maxTrade}%` }} /></div>
                      </div>
                    ))}
                  </div>
                  <p className="small muted mt">{sel.new_week} joined in the last 7 days.</p>
                </>
              )}
              {sel.pilot && <Link to="/admin/gap" className="btn block mt">Open district gap map</Link>}
            </>
          )}
        </section>
      </div>
      <section className="panel flush mt">
        <div className="table-wrap"><table className="table">
          <thead><tr>{STATE_COLS.map(([k, l]) => (
            <th key={k} className={k === 'state' ? '' : 'num'}>
              <button className="link" style={{ textDecoration: 'none', color: 'inherit', font: 'inherit' }}
                onClick={() => setSort(([pk, pd]) => [k, pk === k ? -pd : -1])}>{l}{sk === k ? (dir > 0 ? ' ↑' : ' ↓') : ''}</button>
            </th>
          ))}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.state} className={`clickable ${r.state === selected ? 'on' : ''}`} onClick={() => setSelected(r.state)}>
              <td>{r.state} {r.pilot && <span className="tag saffron">Pilot</span>}</td>
              {r.suppressed ? <td className="num muted" colSpan={5}>Fewer than 50 users, hidden</td> : (
                <>
                  <td className="num">{r.students.toLocaleString('en-IN')}</td><td className="num">{r.parents.toLocaleString('en-IN')}</td>
                  <td className="num">{r.active.toLocaleString('en-IN')}</td><td className="num">{r.new_week}</td>
                  <td className="num">{r.girls_pct ?? '—'}%</td>
                </>
              )}
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    </>
  )
}

const PrivacyNote = ({ min = 50, eps = 1 }) => (
  <p className="tiny muted">Districts or cohorts with fewer than {min} students are hidden. Published counts include Laplace noise (ε = {eps}).</p>
)

function GapMap() {
  const { meta } = useLang()
  const [trade, setTrade] = useState('all')
  const [g, setG] = useState(null)
  useEffect(() => { api.gis(trade).then(setG) }, [trade])
  if (!g) return <Loading />
  const vals = g.districts.filter((d) => d.igi !== null).map((d) => d.igi).sort((a, b) => a - b)
  const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] ?? 0
  const breaks = [q(0.2), q(0.4), q(0.6), q(0.8)]
  const color = (d) => (d.suppressed ? SUPPRESSED : RAMPS.orange[bucket(d.igi, breaks)])
  const maxDemand = Math.max(...g.districts.map((d) => d.demand || 0), 1)
  return (
    <>
      <PageHead title="Infrastructure gap index" sub="IGI = students interested in a trade ÷ (accredited seats + ε). High values flag districts where skilling capacity lags demand.">
        <label className="field" style={{ minWidth: 220 }}><span className="small">Trade</span>
          <select className="select" value={trade} onChange={(e) => setTrade(e.target.value)}>
            <option value="all">All trades</option>
            {meta.trades.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}
          </select></label>
      </PageHead>
      <div className="grid-2">
        <section className="panel">
          <DistrictMap districts={g.districts} colorOf={color} sizeOf={(d) => 9 + 16 * Math.sqrt((d.demand || 0) / maxDemand)}
            tip={(d) => <><strong>{d.name_en}</strong>, {d.state}<br />{d.suppressed ? 'Hidden: fewer than 50 students' : <>IGI <strong>{d.igi.toFixed(2)}</strong> · {d.demand} interested · {d.seats} seats</>}</>}
            legend={{ title: 'Gap (IGI)', rows: [...RAMPS.orange.map((c, i) => ({ color: c, label: i === 0 ? `< ${breaks[0].toFixed(2)}` : i === 4 ? `≥ ${breaks[3].toFixed(2)}` : `${breaks[i - 1].toFixed(2)}–${breaks[i].toFixed(2)}` })), { color: SUPPRESSED, label: 'N < 50, hidden' }], note: 'Circle size = interested students' }} />
          <PrivacyNote min={g.min_cohort} eps={g.epsilon} />
        </section>
        <section className="panel flush">
          <table className="table">
            <thead><tr><th>District</th><th className="num">Students</th><th className="num">Interested</th><th className="num">Seats</th><th className="num">IGI</th></tr></thead>
            <tbody>{g.districts.map((d) => (
              <tr key={d.id}><td>{d.name_en}<div className="tiny muted">{d.state} · {d.centres} centres</div></td>
                <td className="num">{d.suppressed ? <span className="tag">N &lt; 50</span> : d.students}</td>
                <td className="num">{d.demand ?? '—'}</td><td className="num">{d.seats}</td>
                <td className="num"><strong>{d.igi === null ? '—' : d.igi.toFixed(2)}</strong></td></tr>
            ))}</tbody>
          </table>
        </section>
      </div>
    </>
  )
}

const BARRIER_COLORS = { stigma: '#17324D', spatial: '#087F8C', financial: '#C9821F', opacity: '#657386' }

function Barriers() {
  const [split, setSplit] = useState('all')
  const [b, setB] = useState(null)
  useEffect(() => { api.barriers(split).then(setB) }, [split])
  if (!b) return <Loading />
  const cats = Object.keys(b.categories)
  const totals = cats.map((k) => ({ name: b.categories[k].en, count: b.totals[k] || 0, k }))
  const heat = (share) => `rgba(8,127,140,${0.08 + (share / 100) * 0.9})`
  return (
    <>
      <PageHead title="Barrier taxonomy" sub="Concerns raised by families in conversations and consensus logs, grouped into four barriers.">
        <div className="seg"><button className={split === 'all' ? 'on' : ''} onClick={() => setSplit('all')}>By district</button><button className={split === 'gender' ? 'on' : ''} onClick={() => setSplit('gender')}>Girls / boys</button></div>
      </PageHead>
      <div className="split">
        <section className="panel">
          <h3>Share of each district cohort's concerns</h3>
          <div className="table-wrap"><table className="heat">
            <thead><tr><th />{split !== 'all' && <th>Cohort</th>}<th>N</th>{cats.map((k) => <th key={k}>{b.categories[k].en}</th>)}</tr></thead>
            <tbody>{b.rows.map((r) => (
              <tr key={`${r.district_id}-${r.cohort}`}>
                <th>{r.name_en}<div className="tiny muted">{r.state}</div></th>
                {split !== 'all' && <td style={{ textTransform: 'capitalize' }}>{r.cohort}</td>}
                <td className="mono">{r.suppressed ? '<50' : r.n}</td>
                {cats.map((k) => r.suppressed
                  ? <td key={k} className="suppressed" title="Hidden: fewer than 50 people">—</td>
                  : <td key={k} style={{ background: heat(r.shares[k]), color: r.shares[k] > 45 ? '#fff' : 'var(--text)', fontWeight: r.top === k ? 700 : 400 }}
                    title={`${r.counts[k]} mentions`}>{r.shares[k]}%</td>)}
              </tr>
            ))}</tbody>
          </table></div>
          <PrivacyNote min={b.min_cohort} eps={b.epsilon} />
        </section>
        <section className="panel">
          <h3>All visible cohorts</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={totals} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="#e9edf2" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: '#182230' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#f6f8fb' }} />
              <Bar dataKey="count" name="mentions" fill={NAVY} barSize={16} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <div className="stack-1 small mt">
            {cats.map((k) => <div key={k}><strong>{b.categories[k].en}:</strong> <span className="muted">{b.categories[k].concerns.map((c) => c.replace('_', ' ')).join(', ')}</span></div>)}
          </div>
        </section>
      </div>
    </>
  )
}

const STAGES = ['Discovery', 'Experiential testing', 'Prerequisites', 'Financial planning', 'Official enrolment', 'Assessment', 'Apprenticeship', 'Progression']

function Sidh() {
  const [s, setS] = useState(null)
  useEffect(() => { api.sidh().then(setS) }, [])
  if (!s) return <Loading />
  const funnel = s.funnel.map((f) => ({ name: `${f.stage}. ${STAGES[f.stage - 1]}`, reached: f.reached }))
  return (
    <>
      <PageHead title="SIDH enrolment tracker" sub="How far registered students have moved along the 8-stage pathway, and registrations sent to the Skill India Digital Hub.">
        <span className="tag demo">Demo SIDH references · live API in Phase 2</span>
      </PageHead>
      <div className="split">
        <section className="panel">
          <h3>Students reaching each stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#e9edf2" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12, fill: '#182230' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#f6f8fb' }} />
              <Bar dataKey="reached" name="students" fill={TEAL} barSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel flush">
          <table className="table">
            <thead><tr><th>District</th><th className="num">Students</th><th className="num">Enrolled+</th><th className="num">Rate</th></tr></thead>
            <tbody>{s.districts.map((d) => <tr key={d.id}><td>{d.name_en}</td><td className="num">{d.students}</td><td className="num">{d.enrolled}</td><td className="num">{d.rate}%</td></tr>)}</tbody>
          </table>
        </section>
      </div>
      {s.recent.length > 0 && (
        <section className="panel mt">
          <h3>Latest registrations from live users</h3>
          <table className="table"><tbody>{s.recent.map((r) => <tr key={r.ref}><td className="mono">{r.ref}</td><td>{r.trade}</td><td>{r.district_en}</td></tr>)}</tbody></table>
        </section>
      )}
    </>
  )
}

const METRIC_LABELS = {
  sim_completion: ['Student engagement', 'Simulation completion rate', 'Completed ÷ initiated micro-simulations × 100'],
  pathway_depth: ['Student progression', 'Pathway exploration depth', 'Students reaching stage 4+ ÷ registered students × 100'],
  report_use: ['Parent engagement', 'Evidence report utilisation', 'Parents viewing proof reports ÷ linked parent accounts × 100'],
  consensus: ['Family alignment', 'Consensus plan execution', 'Families completing the next-step plan ÷ families entering consensus × 100'],
  referral_sla: ['Counsellor SLA', 'Referral resolution time', 'Median of first contact − referral created, level 2+ referrals'],
  coverage: ['Public governance', 'District gap coverage', 'Districts with barrier reports ÷ programme districts × 100'],
}

function Metrics() {
  const [m, setM] = useState(null)
  useEffect(() => { api.metrics().then(setM) }, [])
  if (!m) return <Loading />
  const pass = (x) => x.value !== null && (x.op === '<' ? x.value < x.target : x.value >= x.target)
  return (
    <>
      <PageHead title="Policy outcome report" sub="The six success metrics from the programme's evaluation matrix, computed live from platform data." />
      <section className="panel flush">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Stakeholder</th><th>Metric</th><th>Formula</th><th className="num">Target</th><th className="num">Now</th><th>Status</th></tr></thead>
          <tbody>{m.metrics.map((x) => {
            const [who, name, formula] = METRIC_LABELS[x.id]
            const ok = pass(x)
            return (
              <tr key={x.id}>
                <td>{who}</td><td><strong>{name}</strong><div className="tiny muted">n = {x.n}</div></td>
                <td className="small muted">{formula}</td>
                <td className="num">{x.op === '<' ? '<' : '≥'} {x.target}{x.unit}</td>
                <td className="num"><strong style={{ fontSize: 18 }}>{x.value ?? '—'}{x.value !== null ? x.unit : ''}</strong>
                  {x.within !== undefined && x.within !== null && <div className="tiny muted">{x.within}% within 24 h</div>}</td>
                <td>{ok ? <span className="pass row"><Check size={14} />Meets</span> : <span className="fail row"><X size={14} />Below</span>}</td>
              </tr>
            )
          })}</tbody>
        </table></div>
      </section>
    </>
  )
}

const FEATURE_LABEL = {
  R: 'Realistic', I: 'Investigative', A: 'Artistic', S: 'Social', E: 'Enterprising', C: 'Conventional', skill: 'Skills',
  travel: 'Travel', budget: 'Fee', duration: 'Duration', stipend: 'Stipend', earnings: 'Earnings', setting: 'Setting',
}

function Drivers() {
  const { meta } = useLang()
  const [a, setA] = useState(null)
  useEffect(() => { api.attribution().then(setA) }, [])
  if (!a) return <Loading />
  const max = Math.max(...a.rows.flatMap((r) => (r.values ? Object.values(r.values).map(Math.abs) : [0])), 0.001)
  const cell = (v) => {
    const k = Math.min(1, Math.abs(v) / max)
    return { background: v >= 0 ? `rgba(8,127,140,${0.06 + 0.85 * k})` : `rgba(196,61,75,${0.06 + 0.85 * k})`, color: k > 0.55 ? '#fff' : 'var(--text)' }
  }
  return (
    <>
      <PageHead title="What drives recommendations, by district" sub="Average contribution of each factor to students' top trade match, relative to the state-wide cohort (SHAP values for the additive compatibility score). Teal pushes matches up; red pulls them down." />
      <section className="panel">
        <div className="table-wrap"><table className="heat">
          <thead><tr><th />{a.features.map((f) => <th key={f}>{FEATURE_LABEL[f]}</th>)}<th>Most common top match</th></tr></thead>
          <tbody>{a.rows.map((r) => (
            <tr key={r.id}>
              <th>{r.name_en}<div className="tiny muted">{r.suppressed ? 'N < 50' : `N = ${r.n}`}</div></th>
              {a.features.map((f) => r.suppressed
                ? <td key={f} className="suppressed">—</td>
                : <td key={f} style={cell(r.values[f])} title={r.values[f].toFixed(4)}>{(100 * r.values[f]).toFixed(1)}</td>)}
              <td className="small">{r.top_trade ? meta.trades.find((t) => t.id === r.top_trade)?.name_en : '—'}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <PrivacyNote min={a.min_cohort} />
      </section>
    </>
  )
}

// ---- Family resistance (from UDAAN chat conversations)
const STAGE = { sessions: 'Counselled', interested: 'Want to go ahead', enrolled: 'Enrolled', retained: 'Still in course' }
const STATUSES = ['active', 'thinking', 'interested', 'not_interested', 'enrolled', 'retained', 'dropped']
const fmt = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`)

function Resistance() {
  const { meta } = useLang()
  const [includeDemo, setIncludeDemo] = useState(true)
  const [s, setS] = useState(null)
  useEffect(() => { api.summary(includeDemo).then(setS) }, [includeDemo])
  if (!s) return <Loading />
  const k = s.kpis
  const label = (c) => meta.concerns[c].en
  const concerns = meta.objections.map((c) => ({ name: label(c), count: s.concerns[c] })).sort((a, b) => b.count - a.count)
  const funnel = s.funnel.map((f) => ({ name: STAGE[f.stage], count: f.count }))
  const weeks = s.weeks.map((w) => ({ ...w, label: new Date(w.week).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }))
  const ranked = s.districts.filter((d) => d.sessions)
  const breaks = [30, 40, 50, 60]
  return (
    <>
      <PageHead title="Family resistance" sub="Where and why families hesitate, from UDAAN chat conversations.">
        <label className="toggle" style={{ padding: 0, border: 0 }}><input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} /><span className="track" aria-hidden /><span className="small">Include demo sessions</span></label>
      </PageHead>
      <div className="kpis mb">
        <div className="kpi stat"><span className="stat-label">Families counselled</span><span className="stat-value">{k.sessions}</span><span className="stat-sub">{k.live_sessions} live</span></div>
        <div className="kpi stat"><span className="stat-label">Want to go ahead</span><span className="stat-value">{k.interested_pct}%</span></div>
        <div className="kpi stat"><span className="stat-label">Family resistance</span><span className="stat-value">{k.resistance_pct}%</span></div>
        <div className="kpi stat"><span className="stat-label">Mood start → end</span><span className="stat-value">{fmt(k.avg_first)} → {fmt(k.avg_last)}</span></div>
        <div className="kpi stat"><span className="stat-label">Waiting for a counsellor</span><span className="stat-value">{k.open_escalations}</span><span className="stat-sub">{k.urgent_escalations} urgent</span></div>
      </div>
      <div className="grid-2 mb">
        <section className="panel">
          <h3>Resistance by district</h3>
          <DistrictMap districts={s.districts} colorOf={(d) => (d.resistance === null ? SUPPRESSED : RAMPS.orange[bucket(d.resistance, breaks)])}
            sizeOf={(d) => 8 + Math.sqrt(d.sessions || 0) * 1.6}
            tip={(d) => <><strong>{d.name_en}</strong><br />Resistance {d.resistance ?? '—'}% of {d.sessions} families<br />Top worry: {d.top_concern ? label(d.top_concern) : '—'}</>}
            legend={{ title: 'Family resistance', rows: RAMPS.orange.map((c, i) => ({ color: c, label: ['< 30%', '30–40%', '40–50%', '50–60%', '≥ 60%'][i] })), note: 'Circle size = families' }} />
        </section>
        <section className="panel flush">
          <table className="table">
            <thead><tr><th>District</th><th className="num">Families</th><th className="num">Resistance</th><th>Top worry</th><th className="num">Mood shift</th></tr></thead>
            <tbody>{ranked.map((d) => (
              <tr key={d.id}><td>{d.name_en}<div className="tiny muted">{d.state}</div></td><td className="num">{d.sessions}</td><td className="num"><strong>{d.resistance}%</strong></td>
                <td>{d.top_concern ? <span className="row"><Icon name={meta.concerns[d.top_concern].icon} size={14} />{label(d.top_concern)}</span> : '—'}</td>
                <td className="num">{fmt(d.avg_shift)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      </div>
      <div className="grid-3">
        <section className="panel">
          <h3>Most common worries</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={concerns} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="#e9edf2" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#182230' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#f6f8fb' }} />
              <Bar dataKey="count" name="mentions" fill={NAVY} barSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <h3>From conversation to classroom</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="#e9edf2" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#182230' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#f6f8fb' }} />
              <Bar dataKey="count" name="families" fill={TEAL} barSize={20} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <h3>Families per week</h3>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={weeks} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#e9edf2" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#657386' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#657386' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#f6f8fb' }} />
              <Bar dataKey="sessions" name="families" fill={TEAL} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <h3 className="mt">Resistance per week</h3>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={weeks} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#e9edf2" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#657386' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#657386' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<ChartTip unit="%" />} />
              <Line dataKey="resistance" name="resistant" stroke="#C9821F" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>
    </>
  )
}

function Families() {
  const [includeDemo, setIncludeDemo] = useState(true)
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
    <>
      <PageHead title="Families and parent updates" sub="Short updates in the family's language after enrolment help prevent mid-course dropout.">
        <label className="toggle" style={{ padding: 0, border: 0 }}><input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} /><span className="track" aria-hidden /><span className="small">Include demo sessions</span></label>
      </PageHead>
      {flash && <div className="note ok"><Check size={16} /><span>{flash}</span></div>}
      <section className="panel flush">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Family</th><th>District</th><th>Trade</th><th>Status</th><th className="num">Updates</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td>{(r.members || []).map((m) => m[0].toUpperCase() + m.slice(1)).join(', ')} {r.synthetic ? <span className="tag demo">Demo</span> : <span className="tag ok">Live</span>}
                <div className="tiny muted">{new Date(r.created_at).toLocaleDateString('en-IN')}</div></td>
              <td>{r.district_en}</td><td>{r.trade_en || '—'}</td>
              <td><select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></td>
              <td className="num">{r.update_count}</td>
              <td><button className="btn small" onClick={() => setComposer({ session_id: r.id, kind: 'progress', text_en: '', text_hi: '' })}><Megaphone size={14} />Send update</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
      {composer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <button className="icon-btn modal-close" onClick={() => setComposer(null)} aria-label="Close"><X size={16} /></button>
            <h3>Update for the family</h3>
            <div className="chips">{[...Object.keys(templates), 'custom'].map((k) => <button key={k} className={`chip ${composer.kind === k ? 'on' : ''}`} onClick={() => setComposer({ ...composer, kind: k })}>{k}</button>)}</div>
            {composer.kind === 'custom' ? (
              <>
                <label className="field"><span>English</span><textarea className="input" rows={2} value={composer.text_en} onChange={(e) => setComposer({ ...composer, text_en: e.target.value })} /></label>
                <label className="field"><span>हिंदी</span><textarea className="input" rows={2} value={composer.text_hi} onChange={(e) => setComposer({ ...composer, text_hi: e.target.value })} /></label>
              </>
            ) : (
              <div className="stack-1"><p className="note">{templates[composer.kind]?.en}</p><p className="note">{templates[composer.kind]?.hi}</p></div>
            )}
            <div className="row end"><button className="btn ghost" onClick={() => setComposer(null)}>Cancel</button>
              <button className="btn primary" onClick={send} disabled={composer.kind === 'custom' && !composer.text_en && !composer.text_hi}>Send</button></div>
          </div>
        </div>
      )}
    </>
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
    try { setResult(await api.importOutcomes(csv, replace)); load() } catch (e) { setErr(e.message) }
  }
  const band = (lo, hi) => `₹${lo.toLocaleString('en-IN')}–${hi.toLocaleString('en-IN')}`
  return (
    <>
      <PageHead title="Verified outcome data" sub="The UDAAN chat, the proof reports and the What-If comparator answer only from this table. Upload placement-tracker or tracer-study CSVs to replace the demo figures." />
      <section className="panel mb stack-1">
        <p className="small muted">Columns: trade_id, district_id, provider, earn_low, earn_high, earn3_low, earn3_high, earn5_low, earn5_high, placement_pct, local_pct, women_pct, cohort, source, year, status (verified / self-reported / estimate). <a href="/sample_outcomes.csv" download>Download a sample file</a>.</p>
        <div className="row wrap">
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files[0] && readFile(e.target.files[0])} />
          <label className="toggle" style={{ padding: 0, border: 0 }}><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /><span className="track" aria-hidden /><span className="small">Replace records for the same trade and district</span></label>
          <button className="btn primary" disabled={!csv} onClick={upload}>Import</button>
        </div>
        {err && <div className="alert">{err}</div>}
        {result && <div className="note ok"><span>Loaded {result.loaded} rows.{result.errors.length > 0 && ` ${result.errors.length} skipped: `}{result.errors.map((e) => `line ${e.line}: ${e.error}`).join('; ')}</span></div>}
      </section>
      <section className="panel flush">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Trade</th><th>District</th><th>Provider</th><th className="num">Year 1 / month</th><th className="num">Year 3</th><th className="num">Year 5</th><th className="num">Placed</th><th className="num">Home state</th><th className="num">Women</th><th>Source</th><th>Status</th></tr></thead>
          <tbody>{rows.map((o) => (
            <tr key={o.id}><td>{o.trade_en}</td><td>{o.district_en}</td><td>{o.provider}</td>
              <td className="num">{band(o.earn_low, o.earn_high)}</td><td className="num">{band(o.earn3_low, o.earn3_high)}</td><td className="num">{band(o.earn5_low, o.earn5_high)}</td>
              <td className="num">{o.placement_pct}%</td><td className="num">{o.local_pct}%</td><td className="num">{o.women_pct}%</td>
              <td className="small">{o.source}, {o.year}</td><td><span className={`status status-${o.status}`}>{o.status}</span></td></tr>
          ))}</tbody>
        </table></div>
      </section>
    </>
  )
}
