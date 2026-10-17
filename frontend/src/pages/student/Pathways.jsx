import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ExternalLink, Lock } from 'lucide-react'
import { api } from '../../lib/api'
import { inr, useLang, useT } from '../../lib/i18n'
import { TradeIcon } from '../../components/Icon'
import { Loading, PageHead } from '../../components/Shell'

const S = {
  title: { en: 'Your pathway', hi: 'आपका रास्ता' },
  sub: { en: 'Eight stages from finding a trade to growing in it. Open a stage to act on it.', hi: 'ट्रेड ढूँढने से उसमें आगे बढ़ने तक आठ चरण। किसी चरण को खोलकर काम करें।' },
  pickTrade: { en: 'Pick a trade in the Trade finder to begin.', hi: 'शुरू करने के लिए ट्रेड खोजें में एक ट्रेड चुनें।' },
  openFinder: { en: 'Open Trade finder', hi: 'ट्रेड खोजें खोलें' },
  change: { en: 'Change trade', hi: 'ट्रेड बदलें' },
  trySim: { en: 'Open the simulation', hi: 'सिमुलेशन खोलें' },
  anySim: { en: 'This trade has no simulation yet; any Lab simulation counts.', hi: 'इस ट्रेड का सिमुलेशन अभी नहीं है; लैब का कोई भी सिमुलेशन मान्य है।' },
  openLab: { en: 'Open the Lab', hi: 'लैब खोलें' },
  minimum: { en: 'Needs', hi: 'ज़रूरी' },
  you: { en: 'You', hi: 'आप' },
  eligibleYes: { en: 'You meet the entry requirement.', hi: 'आप प्रवेश की शर्त पूरी करते हैं।' },
  bridge: { en: 'Bridge step first:', hi: 'पहले यह क़दम:' },
  confirmCheck: { en: 'I have checked the centres', hi: 'मैंने सेंटर देख लिए' },
  nearby: { en: 'Accredited centres near you', hi: 'आपके पास मान्य सेंटर' },
  fees: { en: 'Government route fee', hi: 'सरकारी रास्ते की फ़ीस' },
  free: { en: 'Free', hi: 'मुफ़्त' },
  compare: { en: 'Compare 5-year costs', hi: '5 साल का ख़र्च तुलना करें' },
  reviewed: { en: 'I have reviewed the costs with my family', hi: 'मैंने परिवार के साथ ख़र्च देख लिया' },
  sidhIntro: { en: 'Register for the course on the Skill India Digital Hub. In this prototype the registration is simulated and returns a demo reference.', hi: 'स्किल इंडिया डिजिटल हब पर कोर्स के लिए रजिस्टर करें। इस प्रोटोटाइप में यह नक़ली रजिस्ट्रेशन है और डेमो नंबर देता है।' },
  register: { en: 'Register (demo)', hi: 'रजिस्टर करें (डेमो)' },
  registered: { en: 'Registered. Reference', hi: 'रजिस्टर हो गया। नंबर' },
  phase2: { en: 'Live SIDH API in Phase 2', hi: 'असली SIDH API चरण 2 में' },
  assessInfo: { en: 'At the end of training a Sector Skill Council or NCVET-approved body assesses you. Passing gives a certificate valid across India.', hi: 'ट्रेनिंग के अंत में सेक्टर स्किल काउंसिल या NCVET से मान्य संस्था मूल्यांकन करती है। पास होने पर पूरे भारत में मान्य सर्टिफ़िकेट मिलता है।' },
  apprInfo: { en: 'Apprentices earn a monthly stipend while they learn on the job, partly paid by the government under NAPS.', hi: 'अप्रेंटिस काम पर सीखते हुए हर महीने स्टाइपेंड पाते हैं, जिसका कुछ हिस्सा NAPS के तहत सरकार देती है।' },
  apprLink: { en: 'Apprenticeship India portal', hi: 'अप्रेंटिसशिप इंडिया पोर्टल' },
  status_done: { en: 'Done', hi: 'पूरा' },
  status_current: { en: 'Now', hi: 'अभी' },
  status_blocked: { en: 'Needs a bridge step', hi: 'पहले एक क़दम' },
  status_upcoming: { en: 'Later', hi: 'बाद में' },
}

export default function Pathways() {
  const t = useT(S)
  const { lang } = useLang()
  const [p, setP] = useState(null)
  const [open, setOpen] = useState(null)
  const load = () => api.pathway().then((d) => { setP(d); setOpen((o) => o ?? d.current) })
  useEffect(() => { load() }, [lang])
  const act = async (action) => setP(await api.pathwayAction(action))
  if (!p) return <Loading />
  const d = p.details || {}

  const body = (s) => {
    switch (s.id) {
      case 'discovery':
        return p.trade
          ? <div className="row"><TradeIcon trade={p.trade} teal /><strong>{p.trade.name}</strong><Link to="/student/find" className="btn small ghost">{t('change')}</Link></div>
          : <><p>{t('pickTrade')}</p><Link to="/student/find" className="btn small primary">{t('openFinder')}</Link></>
      case 'experience':
        return d.sim ? <Link to={`/student/lab/${d.sim}`} className="btn small primary">{t('trySim')}</Link>
          : <><p className="small">{t('anySim')}</p><Link to="/student/lab" className="btn small">{t('openLab')}</Link></>
      case 'prerequisites':
        if (!d.prerequisites) return null
        return (
          <div className="stack-1">
            <div className="row wrap"><span className="tag">{t('minimum')}: {d.prerequisites.min}</span><span className="tag">{t('you')}: {d.prerequisites.learner}</span></div>
            {d.prerequisites.eligible ? <div className="note ok"><Check size={16} /><span>{t('eligibleYes')}</span></div>
              : <div className="note warn"><span><strong>{t('bridge')}</strong> {d.prerequisites.bridge}</span></div>}
            {d.centres?.length > 0 && (
              <>
                <div className="section-title mt-1">{t('nearby')}</div>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{d.centres.map((c) => <li key={c.name}>{c.name} · {c.distance_km} {t('km')} <span className="tag">{c.kind}</span></li>)}</ul>
              </>
            )}
            {s.status !== 'done' && <button className="btn small" onClick={() => act('prereq_checked')}>{t('confirmCheck')}</button>}
          </div>
        )
      case 'finance':
        return (
          <div className="stack-1">
            {d.fees && <div className="small">{t('fees')}: <strong>{d.fees.govt_available ? (d.fees.govt === 0 ? t('free') : inr(d.fees.govt)) : '—'}</strong></div>}
            <div className="row wrap">{(d.schemes || []).map((x) => <span key={x.id} className="tag ok">{x.name}</span>)}</div>
            <div className="row wrap">
              <Link to="/student/whatif" className="btn small primary">{t('compare')}</Link>
              {s.status !== 'done' && <button className="btn small" onClick={() => act('finance_viewed')}>{t('reviewed')}</button>}
            </div>
          </div>
        )
      case 'enrolment':
        return d.sidh_ref ? <div className="note ok"><Check size={16} /><span>{t('registered')}: <strong className="mono">{d.sidh_ref}</strong></span></div> : (
          <div className="stack-1"><p className="small">{t('sidhIntro')}</p>
            <div className="row wrap"><button className="btn small primary" disabled={!p.trade} onClick={() => act('enrol')}>{t('register')}</button><span className="tag demo">{t('phase2')}</span></div></div>
        )
      case 'assessment':
        return <p className="small">{t('assessInfo')}</p>
      case 'apprenticeship':
        return <><p className="small">{t('apprInfo')}</p><a className="row small" href="https://www.apprenticeshipindia.gov.in/" target="_blank" rel="noreferrer">{t('apprLink')}<ExternalLink size={12} /></a></>
      case 'progression':
        return d.progression ? <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{d.progression.next.map((x) => <li key={x}>{x}</li>)}</ul> : null
      default:
        return null
    }
  }

  return (
    <>
      <PageHead title={t('title')} sub={t('sub')} />
      <section className="panel">
        <ol className="stepper">
          {p.stages.map((s) => (
            <li key={s.id} className={`stage ${s.status === 'done' ? 'done' : ''} ${s.status === 'current' || s.status === 'blocked' ? 'current' : ''}`}>
              <span className="stage-dot">{s.status === 'done' ? <Check size={18} /> : s.status === 'blocked' ? <Lock size={16} /> : s.n}</span>
              <div className="stage-body">
                <button className="link" style={{ textDecoration: 'none', textAlign: 'left' }} onClick={() => setOpen(open === s.n ? -1 : s.n)} aria-expanded={open === s.n}>
                  <h3>{s.title} <span className={`tag ${s.status === 'done' ? 'ok' : s.status === 'current' ? 'saffron' : s.status === 'blocked' ? 'warn' : ''}`}>{t(`status_${s.status}`)}</span></h3>
                </button>
                <p>{s.desc}</p>
                {open === s.n && <div className="stage-detail">{body(s)}</div>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
