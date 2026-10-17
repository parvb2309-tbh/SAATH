import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock, FileText, Play, RotateCcw, Timer } from 'lucide-react'
import { api } from '../../lib/api'
import { pick, useLang, useT } from '../../lib/i18n'
import { useSession } from '../../lib/session'
import Icon from '../../components/Icon'
import { ErrorNote, Loading, PageHead } from '../../components/Shell'

const SIMS = {
  solar: lazy(() => import('../../components/sims/SolarSim')),
  electrician: lazy(() => import('../../components/sims/ElectricianSim')),
  gda: lazy(() => import('../../components/sims/GdaSim')),
  auto_tech: lazy(() => import('../../components/sims/AutoSim')),
  retail: lazy(() => import('../../components/sims/RetailSim')),
  data_entry: lazy(() => import('../../components/sims/DataSim')),
}

const S = {
  labTitle: { en: 'Career Exploration Lab', hi: 'करियर एक्सप्लोरेशन लैब' },
  labSub: { en: 'Short simulations of real trade tasks. Your results update your Career DNA; nothing here is a test you can fail.', hi: 'असली काम के छोटे सिमुलेशन। नतीजों से आपका करियर DNA अपडेट होता है; यह कोई परीक्षा नहीं जिसमें फ़ेल हों।' },
  minutes: { en: 'about {n} min', hi: 'लगभग {n} मिनट' },
  measures: { en: 'Measures', hi: 'क्या नापा जाता है' },
  best: { en: 'Best: {a}% accuracy', hi: 'सबसे अच्छा: {a}% सटीकता' },
  start: { en: 'Start', hi: 'शुरू करें' },
  again: { en: 'Try again', hi: 'फिर से करें' },
  task: { en: 'Your task', hi: 'आपका काम' },
  qual: { en: 'Real qualification', hi: 'असली योग्यता' },
  backLab: { en: 'All simulations', hi: 'सभी सिमुलेशन' },
  resultTitle: { en: 'How you did', hi: 'आपने कैसा किया' },
  accuracy: { en: 'Task accuracy', hi: 'काम की सटीकता' },
  safety: { en: 'Safety', hi: 'सुरक्षा' },
  time: { en: 'Time taken', hi: 'लगा समय' },
  dnaUpdate: { en: 'Your Career DNA was updated', hi: 'आपका करियर DNA अपडेट हुआ' },
  before: { en: 'before', hi: 'पहले' },
  after: { en: 'now', hi: 'अब' },
  stageDone: { en: 'Pathway stage 2, Experiential testing, is complete.', hi: 'रास्ते का चरण 2, करके देखना, पूरा हुआ।' },
  report: { en: 'Proof report for this trade', hi: 'इस ट्रेड की सबूत रिपोर्ट' },
  choose: { en: 'Make this my trade', hi: 'यही मेरा ट्रेड' },
  saving: { en: 'Saving your result…', hi: 'नतीजा सेव हो रहा है…' },
}

const mmss = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Lab() {
  const t = useT(S)
  const { lang, meta } = useLang()
  const [sims, setSims] = useState(null)
  useEffect(() => { api.sims().then(setSims) }, [lang])
  if (!sims) return <Loading />
  return (
    <>
      <PageHead title={t('labTitle')} sub={t('labSub')} />
      <div className="grid-auto">
        {sims.map((s) => {
          const trade = meta.trades.find((x) => x.id === s.trade_id)
          return (
            <Link key={s.id} to={`/student/lab/${s.id}`} className="sim-card">
              <div className="row between">
                <span className="trade-ico"><Icon name={s.icon} size={20} /></span>
                <span className="row tiny muted"><Clock size={12} />{t('minutes', { n: s.minutes })}</span>
              </div>
              <div>
                <h3>{s[`title_${lang}`]}</h3>
                <div className="small muted">{pick(trade, lang)} · NSQF {s.nsqf_level}</div>
                <p className="measures mt-1">{t('measures')}: {s[`measures_${lang}`]}</p>
              </div>
              <div className="row between">
                {s.attempts > 0 ? <span className="tag ok"><Check size={12} />{t('best', { a: Math.round(100 * s.best_accuracy) })}</span> : <span />}
                <span className="btn small primary"><Play size={14} />{s.attempts > 0 ? t('again') : t('start')}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}

export function SimRunner() {
  const t = useT(S)
  const { simId } = useParams()
  const navigate = useNavigate()
  const { lang, meta } = useLang()
  const { me, setMe } = useSession()
  const sim = meta.simulations.find((s) => s.id === simId)
  const [phase, setPhase] = useState('brief')
  const [attempt, setAttempt] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const started = useRef(0)
  const district = meta.districts.find((d) => d.id === me.profile?.district_id)

  useEffect(() => {
    if (phase !== 'running') return undefined
    const id = setInterval(() => setElapsed(Date.now() - started.current), 1000)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => { setPhase('brief'); setResult(null) }, [simId])

  if (!sim || !SIMS[simId]) return <ErrorNote error="Unknown simulation" />
  const Sim = SIMS[simId]

  const begin = async () => {
    setErr('')
    try {
      const { attempt_id } = await api.startSim(simId)
      setAttempt(attempt_id)
      started.current = Date.now()
      setElapsed(0)
      setPhase('running')
    } catch (e) { setErr(e.message) }
  }
  const finish = async (r) => {
    const time_s = (Date.now() - started.current) / 1000
    setPhase('saving')
    try {
      const saved = await api.completeSim(simId, attempt, {
        time_s, accuracy: r.accuracy, safety_score: r.safety_score, telemetry: r.telemetry || {}, indicators: r.indicators || [],
      })
      setResult({ ...r, time_s, saved })
      setPhase('result')
      window.scrollTo({ top: 0 })
    } catch (e) { setErr(e.message); setPhase('running') }
  }
  const choose = async () => setMe(await api.patchMe({ chosen_trade: sim.trade_id }))

  return (
    <>
      <PageHead title={sim[`title_${lang}`]} crumb={<Link to="/student/lab"><ArrowLeft size={12} /> {t('backLab')}</Link>} />
      <ErrorNote error={err} />
      {phase === 'brief' && (
        <div className="stack">
          <div className="brief">
            <div><div className="section-title">{t('task')}</div><p>{sim[`task_${lang}`]}</p></div>
            <div><div className="section-title">{t('measures')}</div><p>{sim[`measures_${lang}`]}</p></div>
            <div><div className="section-title">{t('qual')}</div><p>{sim[`qual_${lang}`]}</p><span className="tiny muted">{t('minutes', { n: sim.minutes })}</span></div>
          </div>
          <div><button className="btn primary big" onClick={begin}><Play size={18} />{t('start')}</button></div>
        </div>
      )}
      {(phase === 'running' || phase === 'saving') && (
        <div className="sim-shell">
          <div>
            <div className="sim-head">
              <h2>{pick(meta.trades.find((x) => x.id === sim.trade_id), lang)}</h2>
              <div className="row"><span className="tag">NSQF {sim.nsqf_level}</span><span className="tag mono"><Timer size={12} />{mmss(elapsed)}</span></div>
            </div>
            <div className="sim-stage">
              {phase === 'saving' ? <div className="loading">{t('saving')}</div> : (
                <Suspense fallback={<Loading />}>
                  <Sim lang={lang} context={{ districtName: pick(district, lang), districtLat: district?.lat ?? 25 }} onComplete={finish} />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      )}
      {phase === 'result' && result && <Result sim={sim} result={result} chosen={me.profile?.chosen_trade === sim.trade_id}
        onAgain={() => { setPhase('brief'); setResult(null) }} onChoose={choose} onReport={() => navigate(`/student/report/${sim.trade_id}`)} />}
    </>
  )
}

function Result({ sim, result, chosen, onAgain, onChoose, onReport }) {
  const t = useT(S)
  const { lang, meta } = useLang()
  const pct = (v) => `${Math.round(100 * v)}%`
  const { competencies_before: before, competencies: after, pathway } = result.saved
  const changed = Object.keys(after).filter((k) => after[k] !== before[k])
  const stage2 = pathway.stages.find((s) => s.id === 'experience')?.status === 'done'
  return (
    <div className="stack">
      <section className="panel">
        <h2>{t('resultTitle')}</h2>
        <div className="result-grid mt-1">
          <div className="stat"><span className={`stat-value ${result.accuracy >= 0.7 ? 'good' : ''}`}>{pct(result.accuracy)}</span><span className="stat-label">{t('accuracy')}</span></div>
          <div className="stat"><span className={`stat-value ${result.safety_score >= 0.8 ? 'good' : 'bad'}`}>{pct(result.safety_score)}</span><span className="stat-label">{t('safety')}</span></div>
          <div className="stat"><span className="stat-value">{mmss(result.time_s * 1000)}</span><span className="stat-label">{t('time')}</span></div>
        </div>
        {result.indicators?.length > 0 && (
          <table className="table mt">
            <tbody>{result.indicators.map((ind) => (
              <tr key={ind.en}><td>{ind[lang] ?? ind.en}</td><td className="num"><strong style={{ color: ind.good ? 'var(--success)' : 'var(--error)' }}>{ind.value}</strong></td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <section className="panel">
        <h3>{t('dnaUpdate')}</h3>
        <div className="stack-1">
          {changed.map((k) => (
            <div key={k} className="attr-row" style={{ gridTemplateColumns: '160px 1fr 110px' }}>
              <span>{meta.competency_labels[k][lang]}</span>
              <div className="meter" style={{ position: 'relative' }}>
                <span style={{ width: `${100 * after[k]}%` }} />
                {k in before && <i style={{ position: 'absolute', top: -3, bottom: -3, left: `${100 * before[k]}%`, width: 2, background: 'var(--navy)' }} title={t('before')} />}
              </div>
              <span className="small mono">{k in before ? `${pct(before[k])} → ` : ''}<strong>{pct(after[k])}</strong></span>
            </div>
          ))}
        </div>
        {stage2 && <div className="note ok mt"><Check size={16} /><span>{t('stageDone')}</span></div>}
      </section>
      <div className="row wrap">
        <button className="btn" onClick={onAgain}><RotateCcw size={16} />{t('again')}</button>
        {!chosen && <button className="btn primary" onClick={onChoose}>{t('choose')}</button>}
        <button className="btn" onClick={onReport}><FileText size={16} />{t('report')}</button>
        <Link to="/student/lab" className="btn ghost">{t('backLab')}</Link>
      </div>
    </div>
  )
}
