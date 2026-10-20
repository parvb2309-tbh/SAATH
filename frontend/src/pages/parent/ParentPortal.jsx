import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { ArrowRight, BookOpen, Calculator, Check, FileText, Handshake, Home, Landmark, Link2, MessageCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { inr, useLang, useT } from '../../lib/i18n'
import { useSession } from '../../lib/session'
import Chat from '../../components/Chat'
import { ConsensusBoard, PriorityScales } from '../../components/Consensus'
import Hexagon from '../../components/Hexagon'
import { TradeIcon } from '../../components/Icon'
import { ReportView } from '../../components/Report'
import Shell, { ErrorNote, Loading, PageHead, PrivacyFoot } from '../../components/Shell'
import WhatIf from '../../components/WhatIf'
import { StageStrip } from '../student/StudentPortal'
import Stories from '../Stories'

const S = {
  nav_home: { en: 'Family overview', hi: 'परिवार का हाल' },
  nav_report: { en: 'Proof report', hi: 'सबूत रिपोर्ट' },
  nav_stories: { en: 'Career stories', hi: 'करियर कहानियाँ' },
  nav_whatif: { en: 'What-If comparator', hi: 'ख़र्च की तुलना' },
  nav_consensus: { en: 'Consensus', hi: 'सहमति' },
  nav_finance: { en: 'Financial help', hi: 'आर्थिक मदद' },
  nav_chat: { en: 'Ask UDAAN', hi: 'उड़ान से पूछें' },
  linkTitle: { en: "Link your child's account", hi: 'बच्चे का खाता जोड़ें' },
  linkSub: { en: "Ask your child for the 6-letter family code shown in their Family Space.", hi: 'बच्चे से उसके फ़ैमिली स्पेस में दिखने वाला 6 अक्षरों का कोड माँगें।' },
  code: { en: 'Family code', hi: 'फ़ैमिली कोड' },
  link: { en: 'Link', hi: 'जोड़ें' },
  overviewOf: { en: "{name}'s journey", hi: '{name} की यात्रा' },
  overviewSub: { en: 'What your child has chosen to share with you.', hi: 'बच्चे ने आपके साथ जो साझा किया है।' },
  chosenTrade: { en: 'Chosen trade', hi: 'चुना गया ट्रेड' },
  noTrade: { en: 'Not chosen yet', hi: 'अभी चुना नहीं' },
  readReport: { en: 'Read the proof report', hi: 'सबूत रिपोर्ट पढ़ें' },
  interests: { en: 'What interests your child', hi: 'बच्चे की रुचि' },
  topMatches: { en: 'Best-fitting trades', hi: 'सबसे सही ट्रेड' },
  sims: { en: 'Tasks your child has tried', hi: 'बच्चे ने कौन-से काम करके देखे' },
  accuracy: { en: 'accuracy', hi: 'सटीकता' },
  safety: { en: 'safety', hi: 'सुरक्षा' },
  noSims: { en: 'No simulations yet.', hi: 'अभी कोई सिमुलेशन नहीं।' },
  pathway: { en: 'Pathway', hi: 'रास्ता' },
  stage: { en: 'Stage {n} of 8: {title}', hi: '8 में से चरण {n}: {title}' },
  hidden: { en: 'Your child has not shared this.', hi: 'बच्चे ने यह साझा नहीं किया है।' },
  consensusCard: { en: 'Agree on a plan together', hi: 'मिलकर योजना तय करें' },
  childAnswered: { en: 'Your child has answered. Your turn.', hi: 'बच्चे ने जवाब दे दिए हैं। अब आपकी बारी।' },
  bothAnswered: { en: 'You have both answered.', hi: 'आप दोनों ने जवाब दे दिए हैं।' },
  start: { en: 'Open', hi: 'खोलें' },
  reportSub: { en: 'Sixteen checks on the trade your child chose, from official and centre records.', hi: 'बच्चे के चुने ट्रेड की सोलह जाँचें, सरकारी और सेंटर रिकॉर्ड से।' },
  whatifSub: { en: 'Compare a degree, an ITI with paid apprenticeship, and a short course with a diploma over five years.', hi: 'पाँच साल में डिग्री, आईटीआई + वेतन वाली अप्रेंटिसशिप, और छोटे कोर्स + डिप्लोमा की तुलना करें।' },
  consensusSub: { en: 'Rate how much each thing matters to you. Your child has rated the same list on their own.', hi: 'हर बात आपके लिए कितनी ज़रूरी है, बताइए। बच्चे ने यही सूची अलग से भरी है।' },
  waitChild: { en: 'Your answers are saved. The plan appears when your child answers too.', hi: 'आपके जवाब सेव हैं। बच्चे के जवाब देने पर योजना दिखेगी।' },
  submit: { en: 'Save and see the plan', hi: 'सेव करें और योजना देखें' },
  accept: { en: 'We agree on this plan', hi: 'हम इस योजना पर सहमत हैं' },
  accepted: { en: 'Plan accepted. Your child can see it too.', hi: 'योजना मान ली गई। बच्चा भी इसे देख सकता है।' },
  asked: { en: 'A counsellor will call you about this.', hi: 'इस बारे में काउंसलर आपको फ़ोन करेंगे।' },
  financeSub: { en: 'Free training, stipends, scholarships and loans that apply to this trade.', hi: 'इस ट्रेड पर लागू मुफ़्त ट्रेनिंग, स्टाइपेंड, छात्रवृत्ति और लोन।' },
  fees: { en: 'Course fee', hi: 'कोर्स की फ़ीस' },
  govt: { en: 'Government / PMKVY', hi: 'सरकारी / PMKVY' },
  private: { en: 'Private', hi: 'निजी' },
  free: { en: 'Free', hi: 'मुफ़्त' },
  ownWork: { en: 'Starting own work later', hi: 'बाद में अपना काम' },
  chatSub: { en: 'Ask about safety, earnings, respect or costs. Answers come from verified records.', hi: 'सुरक्षा, कमाई, इज़्ज़त या ख़र्च के बारे में पूछें। जवाब पक्के रिकॉर्ड से।' },
}

export default function ParentPortal() {
  const t = useT(S)
  const { me } = useSession()
  const items = [
    { to: '/parent', end: true, icon: Home, label: t('nav_home') },
    { to: '/parent/report', icon: FileText, label: t('nav_report') },
    { to: '/parent/stories', icon: BookOpen, label: t('nav_stories') },
    { to: '/parent/whatif', icon: Calculator, label: t('nav_whatif') },
    { to: '/parent/consensus', icon: Handshake, label: t('nav_consensus') },
    { to: '/parent/finance', icon: Landmark, label: t('nav_finance') },
    { to: '/parent/chat', icon: MessageCircle, label: t('nav_chat') },
  ]
  return (
    <Shell items={items} foot={<PrivacyFoot />}>
      {!me.linked_student ? <LinkChild /> : (
        <Routes>
          <Route index element={<Overview />} />
          <Route path="report" element={<ParentReport />} />
          <Route path="stories" element={<Stories fetcher={api.parentStories} audience="parent" />} />
          <Route path="whatif" element={<><PageHead title={t('nav_whatif')} sub={t('whatifSub')} /><WhatIf fetcher={api.parentWhatIf} initialTrade={me.linked_student.chosen_trade} /></>} />
          <Route path="consensus" element={<Consensus />} />
          <Route path="finance" element={<Finance />} />
          <Route path="chat" element={<ParentChat />} />
        </Routes>
      )}
    </Shell>
  )
}

function LinkChild() {
  const t = useT(S)
  const { refresh } = useSession()
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    try { await api.linkChild(code); await refresh() } catch (x) { setErr(x.message) }
  }
  return (
    <>
      <PageHead title={t('linkTitle')} sub={t('linkSub')} />
      <form className="panel stack" style={{ maxWidth: 420 }} onSubmit={submit}>
        <label className="field"><span>{t('code')}</span>
          <input className="input otp" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" /></label>
        <ErrorNote error={err} />
        <button className="btn primary" disabled={code.length !== 6}><Link2 size={16} />{t('link')}</button>
      </form>
    </>
  )
}

function Overview() {
  const t = useT(S)
  const { lang, meta } = useLang()
  const [o, setO] = useState(null)
  useEffect(() => { api.parentOverview().then(setO) }, [lang])
  if (!o) return <Loading />
  const cur = o.pathway?.stages.find((s) => s.n === o.pathway.current)
  return (
    <>
      <PageHead title={t('overviewOf', { name: o.student.name })} sub={t('overviewSub')} />
      <div className="split">
        <div className="stack">
          <section className="panel">
            <div className="section-title">{t('chosenTrade')}</div>
            {o.chosen_trade ? (
              <div className="row between wrap">
                <div className="row"><TradeIcon trade={o.chosen_trade} teal /><h2 style={{ margin: 0 }}>{o.chosen_trade.name}</h2><span className="tag">NSQF {o.chosen_trade.nsqf_level}</span></div>
                <Link to="/parent/report" className="btn primary"><FileText size={16} />{t('readReport')}</Link>
              </div>
            ) : <p className="muted">{o.permissions.chosen_trade ? t('noTrade') : t('hidden')}</p>}
            {o.pathway && cur && (
              <div className="mt"><div className="small strong mb">{t('stage', { n: cur.n, title: cur.title })}</div><StageStrip stages={o.pathway.stages} /></div>
            )}
          </section>
          <section className="panel">
            <h3>{t('sims')}</h3>
            {!o.simulations ? <p className="muted">{t('hidden')}</p> : o.simulations.length === 0 ? <p className="muted">{t('noSims')}</p> : (
              <table className="table"><tbody>{o.simulations.map((s, i) => (
                <tr key={i}><td>{s.title}</td><td className="num">{Math.round(100 * s.accuracy)}% {t('accuracy')}</td><td className="num">{Math.round(100 * s.safety_score)}% {t('safety')}</td></tr>
              ))}</tbody></table>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <h3>{t('interests')}</h3>
            {o.dna?.riasec ? <Hexagon riasec={o.dna.riasec} labels={meta.riasec_labels} lang={lang} size={240} /> : <p className="muted">{t('hidden')}</p>}
            {o.top_matches?.length > 0 && (
              <>
                <div className="section-title mt">{t('topMatches')}</div>
                {o.top_matches.map((m) => <div key={m.trade_id} className="row between small" style={{ padding: '4px 0' }}><span>{m.name}</span><strong className="mono">{m.score}</strong></div>)}
              </>
            )}
          </section>
          <section className="panel">
            <h3>{t('consensusCard')}</h3>
            <p className="small">{o.consensus.completed ? t('accepted') : o.consensus.student_answered && o.consensus.parent_answered ? t('bothAnswered') : o.consensus.student_answered ? t('childAnswered') : ''}</p>
            <Link to="/parent/consensus" className="btn block"><Handshake size={16} />{t('start')}<ArrowRight size={14} /></Link>
          </section>
        </div>
      </div>
    </>
  )
}

function ParentReport() {
  const t = useT(S)
  const { lang } = useLang()
  const [rep, setRep] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.parentReport().then(setRep).catch((e) => setErr(e.message)) }, [lang])
  if (err) return <><PageHead title={t('nav_report')} /><ErrorNote error={err} /></>
  if (!rep) return <Loading />
  return <><PageHead title={t('nav_report')} sub={t('reportSub')} /><ReportView report={rep} /></>
}

function Consensus() {
  const t = useT(S)
  const { lang } = useLang()
  const [c, setC] = useState(null)
  const [answers, setAnswers] = useState({})
  const [asked, setAsked] = useState(false)
  useEffect(() => { api.parentConsensus().then((d) => { setC(d); setAnswers(d.my_answers || {}) }) }, [lang])
  if (!c) return <Loading />
  const submit = async () => setC(await api.putParentConsensus(answers))
  const accept = async () => setC(await api.acceptPlan())
  const ask = async (item) => { await api.escalateItem(item); setAsked(true) }
  return (
    <>
      <PageHead title={t('nav_consensus')} sub={t('consensusSub')} />
      <section className="panel">
        {c.plan ? (
          <div className="stack">
            {asked && <div className="note ok"><Check size={16} /><span>{t('asked')}</span></div>}
            <ConsensusBoard plan={c.plan} reportHref="/parent/report" onAsk={ask} simLinks={false} />
            {c.completed ? <div className="note ok"><Check size={16} /><span>{t('accepted')}</span></div>
              : <div><button className="btn primary" onClick={accept}><Handshake size={16} />{t('accept')}</button></div>}
          </div>
        ) : (
          <div className="stack">
            <PriorityScales priorities={c.priorities} value={answers} onChange={setAnswers} />
            <div><button className="btn primary" disabled={Object.keys(answers).length < c.priorities.length} onClick={submit}>{t('submit')}</button></div>
            {c.my_answers && !c.student_answered && <div className="note"><span>{t('waitChild')}</span></div>}
          </div>
        )}
      </section>
    </>
  )
}

function Finance() {
  const t = useT(S)
  const { lang } = useLang()
  const [rep, setRep] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.parentReport().then(setRep).catch((e) => setErr(e.message)) }, [lang])
  if (err) return <><PageHead title={t('nav_finance')} /><ErrorNote error={err} /></>
  if (!rep) return <Loading />
  const sec = Object.fromEntries(rep.sections.map((s) => [s.id, s.data]))
  return (
    <>
      <PageHead title={t('nav_finance')} sub={t('financeSub')} />
      <div className="grid-3 mb">
        <div className="panel"><div className="stat"><span className="stat-value">{sec.fees.govt_available ? (sec.fees.govt ? inr(sec.fees.govt) : t('free')) : '—'}</span><span className="stat-label">{t('fees')} · {t('govt')}</span></div></div>
        <div className="panel"><div className="stat"><span className="stat-value">{inr(sec.fees.private)}</span><span className="stat-label">{t('fees')} · {t('private')}</span></div></div>
        <div className="panel"><div className="stat"><span className="stat-value">{inr(sec.self_employment.capital_low)}+</span><span className="stat-label">{t('ownWork')}</span></div></div>
      </div>
      <div className="grid-auto">
        {sec.assistance.schemes.map((s) => (
          <div key={s.id} className="card scheme"><div className="strong">{s.name}</div><p>{s.text}</p>{s.link && <a href={s.link} target="_blank" rel="noreferrer" className="small">{s.link.replace(/^https?:\/\/(www\.)?/, '')}</a>}</div>
        ))}
      </div>
      <div className="mt"><Link to="/parent/whatif" className="btn"><Calculator size={16} />{t('nav_whatif')}</Link></div>
    </>
  )
}

function ParentChat() {
  const t = useT(S)
  const { me } = useSession()
  const [sid, setSid] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.myChat().then((r) => setSid(r.session_id)).catch((e) => setErr(e.message)) }, [])
  return (
    <>
      <PageHead title={t('nav_chat')} sub={t('chatSub')} />
      <ErrorNote error={err} />
      {sid && <Chat sessionId={sid} speaker={me.user.relation || 'guardian'} pathwayHref="/parent" />}
    </>
  )
}


