import { useEffect, useMemo, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, ClipboardList, Printer, Siren, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import Shell, { Loading, PageHead } from '../components/Shell'

const RIASEC_COLOR = '#087F8C'

export default function Teacher() {
  const [data, setData] = useState(null)
  useEffect(() => { api.teacherClass().then(setData) }, [])
  const items = [
    { to: '/teacher', end: true, icon: BarChart3, label: 'Class metrics' },
    { to: '/teacher/students', icon: Users, label: 'Engagement' },
    { to: '/teacher/toolkit', icon: ClipboardList, label: 'Guidance toolkit' },
    { to: '/teacher/referrals', icon: Siren, label: 'Referrals' },
  ]
  return (
    <Shell items={items} foot={<span>Teachers see class-level data and engagement only. Conversations stay private.</span>}>
      {!data ? <Loading /> : (
        <Routes>
          <Route index element={<Metrics d={data} />} />
          <Route path="students" element={<Students d={data} />} />
          <Route path="toolkit" element={<Toolkit d={data} />} />
          <Route path="referrals" element={<Referrals d={data} />} />
        </Routes>
      )}
    </Shell>
  )
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><div className="chart-tip-label">{label}</div><strong>{payload[0].value}</strong> {payload[0].name}</div>
}

function Metrics({ d }) {
  const { meta } = useLang()
  const riasec = meta.riasec.map((k) => ({ name: `${k} · ${meta.riasec_labels[k].short_en}`, share: Math.round(100 * (d.riasec_mean[k] || 0)) }))
  const trades = Object.entries(d.trade_interest).map(([id, n]) => ({ name: meta.trades.find((x) => x.id === id)?.name_en || id, students: n }))
  const stages = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ name: `Stage ${n}`, students: d.students.filter((s) => s.stage + 1 === n || (n === 8 && s.stage >= 8)).length }))
  return (
    <>
      <PageHead title={`${d.class.name} · ${d.class.school}`} sub="Aggregate interests and engagement for your class." />
      <div className="kpis mb">
        <div className="kpi stat"><span className="stat-label">Students</span><span className="stat-value">{d.size}</span></div>
        <div className="kpi stat"><span className="stat-label">Career DNA completed</span><span className="stat-value">{d.dna_completion}%</span></div>
        <div className="kpi stat"><span className="stat-label">Simulations completed / started</span><span className="stat-value">{d.sim_completion}%</span></div>
        <div className="kpi stat"><span className="stat-label">Open referrals</span><span className="stat-value">{d.referrals.filter((r) => r.status !== 'resolved').length}</span></div>
      </div>
      <div className="grid-2 mb">
        <section className="panel">
          <h3>Class interest profile (RIASEC average)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={riasec} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#e9edf2" />
              <XAxis type="number" unit="%" tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: '#182230' }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} cursor={{ fill: '#f6f8fb' }} />
              <Bar dataKey="share" name="% of interest" fill={RIASEC_COLOR} barSize={16} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <h3>Trades students chose</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trades} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#e9edf2" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12, fill: '#182230' }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} cursor={{ fill: '#f6f8fb' }} />
              <Bar dataKey="students" name="students" fill="#17324D" barSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="panel">
        <h3>Where students are on their pathway</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stages} margin={{ left: -12, right: 8 }}>
            <CartesianGrid vertical={false} stroke="#e9edf2" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} cursor={{ fill: '#f6f8fb' }} />
            <Bar dataKey="students" name="students" fill="#19B5A5" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </>
  )
}

const COLS = [['name', 'Student'], ['dna_done', 'Career DNA'], ['top', 'Top interests'], ['chosen_trade', 'Chosen trade'],
  ['sims_completed', 'Simulations'], ['stage', 'Stages done']]

function Students({ d }) {
  const { meta } = useLang()
  const [sort, setSort] = useState(['stage', -1])
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const [k, dir] = sort
    const val = (r) => (k === 'top' ? r.top.join('') : r[k] ?? '')
    return d.students.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (val(a) > val(b) ? dir : val(a) < val(b) ? -dir : 0))
  }, [d, sort, q])
  return (
    <>
      <PageHead title="Engagement" sub="Who has started, who is stuck, and who may need a nudge.">
        <input className="input" placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
      </PageHead>
      <section className="panel flush">
        <div className="table-wrap"><table className="table">
          <thead><tr>{COLS.map(([k, l]) => (
            <th key={k}><button className="link" style={{ textDecoration: 'none', color: 'inherit', font: 'inherit' }}
              onClick={() => setSort(([sk, dir]) => [k, sk === k ? -dir : -1])} aria-sort={sort[0] === k ? (sort[1] > 0 ? 'ascending' : 'descending') : 'none'}>
              {l}{sort[0] === k ? (sort[1] > 0 ? ' ↑' : ' ↓') : ''}</button></th>
          ))}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.dna_done ? <span className="tag ok">Done</span> : <span className="tag warn">Not yet</span>}</td>
              <td className="mono">{r.top.join(' ') || '—'}</td>
              <td>{meta.trades.find((x) => x.id === r.chosen_trade)?.name_en || '—'}</td>
              <td className="num">{r.sims_completed}{r.sims_started > r.sims_completed && <span className="tiny muted"> ({r.sims_started - r.sims_completed} unfinished)</span>}</td>
              <td className="num"><div className="stage-strip" style={{ width: 120, marginLeft: 'auto' }}>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <span key={n} className={n <= r.stage ? 'done' : ''} />)}</div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    </>
  )
}

function Toolkit({ d }) {
  const { meta } = useLang()
  const [sheets, setSheets] = useState(null)
  const [lang, setLang] = useState('en')
  useEffect(() => { api.toolkit().then(setSheets) }, [])
  if (!sheets) return <Loading />
  const total = Object.values(sheets.top_dims).reduce((a, b) => a + b, 0) || 1
  const ordered = [...sheets.sheets].sort((a, b) => (sheets.top_dims[b.dim] || 0) - (sheets.top_dims[a.dim] || 0))
  return (
    <>
      <PageHead title="Group guidance toolkit" sub="Classroom activities, one per interest cluster, ordered by how many of your students lead with that interest.">
        <div className="seg"><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button><button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button></div>
        <button className="btn" onClick={() => window.print()}><Printer size={16} />Print sheets</button>
      </PageHead>
      <div className="grid-auto">
        {ordered.map((s) => (
          <article key={s.dim} className="sheet" style={{ '--c': (sheets.top_dims[s.dim] || 0) / total > 0.2 ? 'var(--saffron)' : 'var(--teal)' }}>
            <div className="row between"><span className="tag solid">{s.dim} · {meta.riasec_labels[s.dim].en}</span><span className="tiny muted">{s.minutes} min</span></div>
            <h3 className="mt-1">{s[`title_${lang}`]}</h3>
            <div className="small muted">{sheets.top_dims[s.dim] || 0} students lead with this interest</div>
            <ol>{s[`steps_${lang}`].map((x) => <li key={x}>{x}</li>)}</ol>
          </article>
        ))}
      </div>
    </>
  )
}

function Referrals({ d }) {
  return (
    <>
      <PageHead title="Institutional referral tracking" sub="Status only. Reasons and conversations are visible to the assigned counsellor, not to teachers." />
      <section className="panel flush">
        {d.referrals.length === 0 ? <p className="muted" style={{ padding: 16 }}>No referrals from this class.</p> : (
          <table className="table">
            <thead><tr><th>Student</th><th>Raised</th><th>Priority</th><th>First contact</th><th>Status</th></tr></thead>
            <tbody>{d.referrals.map((r) => (
              <tr key={r.id}><td>{r.student}</td><td>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                <td>{r.urgent ? <span className="tag err">Urgent</span> : <span className="tag">Routine</span>}</td>
                <td>{r.first_contact_at ? new Date(r.first_contact_at).toLocaleString('en-IN') : '—'}</td>
                <td><span className={`tag ${r.status === 'resolved' ? 'ok' : 'warn'}`}>{r.status.replace('_', ' ')}</span></td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  )
}
