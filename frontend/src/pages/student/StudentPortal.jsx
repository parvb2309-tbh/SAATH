import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight, BookOpen, Calculator, Dna, Download, FlaskConical, LayoutDashboard, MessageCircle, Route as RouteIcon, Search,
  ShieldAlert, Trash2, TrendingUp, Users,
} from 'lucide-react'
import { api, storage } from '../../lib/api'
import { inr, pick, useLang, useT } from '../../lib/i18n'
import { useSession } from '../../lib/session'
import Chat from '../../components/Chat'
import Hexagon from '../../components/Hexagon'
import { TradeIcon } from '../../components/Icon'
import { ReportView } from '../../components/Report'
import Shell, { ErrorNote, Loading, PageHead, PrivacyFoot } from '../../components/Shell'
import StoryScene from '../../components/StoryScene'
import Stories from '../Stories'
import Tour from '../../components/Tour'
import WhatIf from '../../components/WhatIf'
import { ConsentToggles } from '../Onboarding'
import FamilySpace from './FamilySpace'
import Lab, { SimRunner } from './Lab'
import Pathways from './Pathways'

const S = {
  nav_home: { en: 'Dashboard', hi: 'डैशबोर्ड' },
  nav_dna: { en: 'Career DNA', hi: 'करियर DNA' },
  nav_find: { en: 'Trade finder', hi: 'ट्रेड खोजें' },
  nav_lab: { en: 'Exploration Lab', hi: 'एक्सप्लोरेशन लैब' },
  nav_path: { en: 'Pathway', hi: 'रास्ता' },
  nav_stories: { en: 'Career stories', hi: 'करियर कहानियाँ' },
  likeYou: { en: 'Someone like you', hi: 'आप जैसा कोई' },
  readStory: { en: 'Read the story', hi: 'कहानी पढ़ें' },
  nav_chat: { en: 'Ask UDAAN', hi: 'उड़ान से पूछें' },
  nav_family: { en: 'Family Space', hi: 'फ़ैमिली स्पेस' },
  nav_progress: { en: 'My progress', hi: 'मेरी प्रगति' },
  hello: { en: 'Namaste, {name}', hi: 'नमस्ते, {name}' },
  dashSub: { en: 'Here is where you are and what to do next.', hi: 'आप कहाँ हैं और आगे क्या करना है।' },
  stageNow: { en: 'Stage {n} of 8: {title}', hi: '8 में से चरण {n}: {title}' },
  nextStep: { en: 'Your next step', hi: 'आपका अगला क़दम' },
  goPathway: { en: 'Open pathway', hi: 'रास्ता खोलें' },
  topMatches: { en: 'Trades that fit you', hi: 'आपके लिए सही ट्रेड' },
  seeAll: { en: 'Adjust and see all', hi: 'बदलें और सब देखें' },
  match: { en: 'match', hi: 'मेल' },
  chosen: { en: 'Your choice', hi: 'आपकी पसंद' },
  labCard: { en: 'Try the work first', hi: 'पहले काम करके देखें' },
  labDone: { en: '{n} of 6 simulations done', hi: '6 में से {n} सिमुलेशन पूरे' },
  openLab: { en: 'Open the Lab', hi: 'लैब खोलें' },
  familyCard: { en: 'Family', hi: 'परिवार' },
  linked: { en: '{who} is linked', hi: '{who} जुड़े हुए हैं' },
  notLinked: { en: 'Not linked yet. Share your family code.', hi: 'अभी नहीं जुड़े। अपना फ़ैमिली कोड दें।' },
  guardianNeeded: { en: 'A parent or guardian needs to approve your account because you are under 18.', hi: 'आप 18 से कम हैं, इसलिए माता-पिता की मंज़ूरी चाहिए।' },
  shareCode: { en: 'Share family code', hi: 'फ़ैमिली कोड दें' },
  tour1: { en: 'Your Career DNA', hi: 'आपका करियर DNA' },
  tour1t: { en: 'Your interests, skills and limits in one place. It changes as you try things.', hi: 'आपकी रुचि, हुनर और सीमाएँ एक जगह। कुछ करके देखने पर यह बदलता है।' },
  tour2: { en: 'Trade finder', hi: 'ट्रेड खोजें' },
  tour2t: { en: 'Set how far you can travel, your budget and pay needs. Trades re-rank instantly, with reasons.', hi: 'कितनी दूर जा सकते हैं, बजट और कमाई की ज़रूरत बताएँ। ट्रेड तुरंत कारण सहित बदलते हैं।' },
  tour3: { en: 'Exploration Lab', hi: 'एक्सप्लोरेशन लैब' },
  tour3t: { en: 'Six hands-on simulations: wire a circuit, take a BP reading, clean a spreadsheet and more.', hi: 'छह सिमुलेशन: सर्किट जोड़ें, बीपी नापें, स्प्रेडशीट साफ़ करें और भी बहुत कुछ।' },
  tour4: { en: 'Your 8-stage pathway', hi: 'आपका 8 चरणों का रास्ता' },
  tour4t: { en: 'From discovery to enrolment and beyond. Each stage shows one clear action.', hi: 'खोज से दाख़िले और आगे तक। हर चरण में एक साफ़ काम।' },
  dnaSub: { en: 'Built from your activity choices and updated by every simulation you finish.', hi: 'आपकी पसंद से बना, और हर पूरे सिमुलेशन से अपडेट होता है।' },
  interests: { en: 'Interests (RIASEC)', hi: 'रुचियाँ (RIASEC)' },
  skills: { en: 'Skills', hi: 'हुनर' },
  measured: { en: 'measured in the Lab', hi: 'लैब में नापा गया' },
  selfRated: { en: 'your own rating', hi: 'आपका अपना अंदाज़ा' },
  explored: { en: 'Simulations tried', hi: 'आज़माए गए सिमुलेशन' },
  findTitle: { en: 'Trade finder', hi: 'ट्रेड खोजें' },
  findSub: { en: 'Tell us your limits. UDAAN scores every trade against your interests, skills and these limits, and shows why.', hi: 'अपनी सीमाएँ बताइए। उड़ान हर ट्रेड को आपकी रुचि, हुनर और इन सीमाओं से जाँचता है, और कारण बताता है।' },
  travel: { en: 'I can travel up to', hi: 'मैं इतनी दूर जा सकता/सकती हूँ' },
  budget: { en: 'Fee I can pay', hi: 'मैं इतनी फ़ीस दे सकता/सकती हूँ' },
  maxMonths: { en: 'Longest course I can do', hi: 'सबसे लंबा कोर्स जो कर सकते हैं' },
  earn: { en: 'I need to earn at least', hi: 'कम से कम इतनी कमाई चाहिए' },
  stipend: { en: 'I need a stipend while training', hi: 'ट्रेनिंग में स्टाइपेंड चाहिए' },
  setting: { en: 'Where I like to work', hi: 'कहाँ काम करना पसंद है' },
  indoor: { en: 'Indoors', hi: 'अंदर' },
  outdoor: { en: 'Outdoors', hi: 'बाहर' },
  any: { en: 'Either', hi: 'कोई भी' },
  noLimit: { en: 'No limit', hi: 'कोई सीमा नहीं' },
  saveLimits: { en: 'Save as my limits', hi: 'मेरी सीमाओं के रूप में सेव करें' },
  saved: { en: 'Saved', hi: 'सेव हुआ' },
  legendInterest: { en: 'Interest fit', hi: 'रुचि मेल' },
  legendSkill: { en: 'Skill fit', hi: 'हुनर मेल' },
  legendPenalty: { en: 'Limits not met', hi: 'सीमा से बाहर' },
  choose: { en: 'Choose', hi: 'चुनें' },
  report: { en: 'Proof report', hi: 'सबूत रिपोर्ट' },
  trySim: { en: 'Try it', hi: 'करके देखें' },
  noDna: { en: 'Build your Career DNA first.', hi: 'पहले अपना करियर DNA बनाएँ।' },
  reportSub: { en: 'Share this with your family. It has no personal details.', hi: 'इसे परिवार के साथ साझा करें। इसमें कोई निजी जानकारी नहीं है।' },
  whatifTitle: { en: 'What-If: 5 years, three routes', hi: 'क्या होगा अगर: 5 साल, तीन रास्ते' },
  whatifSub: { en: 'Compare a degree, an ITI with apprenticeship, and a short course with a diploma, in money terms.', hi: 'डिग्री, आईटीआई + अप्रेंटिसशिप, और छोटे कोर्स + डिप्लोमा की पैसों में तुलना करें।' },
  progressTitle: { en: 'My progress', hi: 'मेरी प्रगति' },
  attempts: { en: 'Simulation results', hi: 'सिमुलेशन के नतीजे' },
  accuracy: { en: 'Accuracy', hi: 'सटीकता' },
  safetyScore: { en: 'Safety', hi: 'सुरक्षा' },
  time: { en: 'Time', hi: 'समय' },
  none: { en: 'No simulations yet.', hi: 'अभी कोई सिमुलेशन नहीं।' },
  privacyTitle: { en: 'Privacy and your data', hi: 'निजता और आपका डेटा' },
  export: { en: 'Download my data', hi: 'मेरा डेटा डाउनलोड करें' },
  delete: { en: 'Delete my account', hi: 'मेरा खाता मिटाएँ' },
  deleteConfirm: { en: 'This permanently deletes your profile, Career DNA, results and chats. Type DELETE to confirm.', hi: 'इससे आपकी प्रोफ़ाइल, करियर DNA, नतीजे और बातचीत हमेशा के लिए मिट जाएँगे। पुष्टि के लिए DELETE लिखें।' },
  chatSub: { en: 'Ask anything about courses, fees, jobs or safety. Answers come from verified records, with sources.', hi: 'कोर्स, फ़ीस, नौकरी या सुरक्षा के बारे में कुछ भी पूछें। जवाब पक्के रिकॉर्ड से, स्रोत के साथ।' },
  aiOff: { en: 'AI guidance is off in your privacy choices.', hi: 'आपकी निजता के विकल्पों में एआई सलाह बंद है।' },
}

export default function StudentPortal() {
  const t = useT(S)
  const items = [
    { to: '/student', end: true, icon: LayoutDashboard, label: t('nav_home') },
    { to: '/student/dna', icon: Dna, label: t('nav_dna'), tour: 'dna' },
    { to: '/student/find', icon: Search, label: t('nav_find'), tour: 'find' },
    { to: '/student/lab', icon: FlaskConical, label: t('nav_lab'), tour: 'lab' },
    { to: '/student/pathway', icon: RouteIcon, label: t('nav_path'), tour: 'path' },
    { to: '/student/stories', icon: BookOpen, label: t('nav_stories') },
    { to: '/student/chat', icon: MessageCircle, label: t('nav_chat') },
    { to: '/student/family', icon: Users, label: t('nav_family') },
    { to: '/student/progress', icon: TrendingUp, label: t('nav_progress') },
  ]
  return (
    <Shell items={items} foot={<PrivacyFoot />}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dna" element={<DnaPage />} />
        <Route path="find" element={<Finder />} />
        <Route path="lab" element={<Lab />} />
        <Route path="lab/:simId" element={<SimRunner />} />
        <Route path="pathway" element={<Pathways />} />
        <Route path="stories" element={<Stories fetcher={api.studentStories} audience="student" />} />
        <Route path="report/:trade" element={<ReportPage />} />
        <Route path="whatif" element={<WhatIfPage />} />
        <Route path="family" element={<FamilySpace />} />
        <Route path="progress" element={<Progress />} />
        <Route path="chat" element={<ChatPage />} />
      </Routes>
    </Shell>
  )
}

export function StageStrip({ stages }) {
  return <div className="stage-strip" aria-hidden>{stages.map((s) => <span key={s.n} className={s.status === 'done' ? 'done' : s.status === 'current' || s.status === 'blocked' ? 'current' : ''} />)}</div>
}

function Dashboard() {
  const t = useT(S)
  const { lang, meta } = useLang()
  const { me } = useSession()
  const [tour, setTour] = useState(() => storage.get('udaan.tour') === '1')
  const [data, setData] = useState(null)
  useEffect(() => {
    Promise.all([api.pathway(), api.matches(), api.sims(), api.family(), api.studentStories()])
      .then(([pathway, matches, sims, family, stories]) => setData({ pathway, matches, sims, family, story: stories.stories[0] }))
  }, [lang])
  if (!data) return <Loading />
  const { pathway, matches, sims, family, story } = data
  const cur = pathway.stages.find((s) => s.n === pathway.current) || pathway.stages[0]
  const done = sims.filter((s) => s.attempts > 0).length
  const chosen = me.profile?.chosen_trade
  const tourSteps = [['dna', 'tour1'], ['find', 'tour2'], ['lab', 'tour3'], ['path', 'tour4']]
    .map(([target, k]) => ({ target, title: t(k), text: t(`${k}t`) }))

  return (
    <>
      <PageHead title={t('hello', { name: me.user.name || t('role_student') })} sub={t('dashSub')} />
      {me.guardian_needed && (
        <div className="note saffron mb"><ShieldAlert size={16} /><span className="grow">{t('guardianNeeded')}</span>
          <Link className="btn small" to="/student/family">{t('shareCode')}</Link></div>
      )}
      <section className="panel mb">
        <div className="panel-head">
          <div><div className="section-title">{t('nextStep')}</div><h2>{t('stageNow', { n: cur.n, title: cur.title })}</h2><p className="muted">{cur.desc}</p></div>
          <Link className="btn primary" to="/student/pathway">{t('goPathway')}<ArrowRight size={16} /></Link>
        </div>
        <StageStrip stages={pathway.stages} />
      </section>
      <div className="split">
        <section className="panel flush">
          <div className="panel-head" style={{ padding: '16px 16px 0' }}><h3>{t('topMatches')}</h3><Link to="/student/find" className="small">{t('seeAll')}</Link></div>
          {matches.results.slice(0, 4).map((r, i) => (
            <div key={r.trade_id} className="match-row">
              <span className="match-rank">{i + 1}</span>
              <TradeIcon trade={r} teal={r.trade_id === chosen} />
              <div className="grow">
                <div className="match-name">{r.name} {r.trade_id === chosen && <span className="tag teal">{t('chosen')}</span>}</div>
                <div className="match-why">{r.why}</div>
              </div>
              <div className="match-score">{r.score}<span className="tiny muted"> /100</span></div>
            </div>
          ))}
        </section>
        <div className="stack">
          {story && (
            <section className="panel">
              <div className="section-title">{t('likeYou')}</div>
              <div className="story-teaser">
                <StoryScene trade={story.trade.id} gender={story.gender} seedKey={story.id} />
                <div><strong style={{ color: 'var(--navy)' }}>{story.name}, {story.age} · {story.district.name}</strong>
                  <div className="small muted">{story.now}</div></div>
              </div>
              <Link to="/student/stories" className="btn block mt-1"><BookOpen size={16} />{t('readStory')}</Link>
            </section>
          )}
          <section className="panel">
            <h3>{t('labCard')}</h3>
            <p className="small muted">{t('labDone', { n: done })}</p>
            <div className="meter mb"><span style={{ width: `${(100 * done) / 6}%` }} /></div>
            <Link to="/student/lab" className="btn block"><FlaskConical size={16} />{t('openLab')}</Link>
          </section>
          <section className="panel">
            <h3>{t('familyCard')}</h3>
            <p className="small">{family.link.parent ? t('linked', { who: family.link.parent.name || t(family.link.parent.relation || 'guardian') }) : t('notLinked')}</p>
            <Link to="/student/family" className="btn block"><Users size={16} />{t('nav_family')}</Link>
          </section>
          {chosen && (
            <section className="panel">
              <h3><Calculator size={16} style={{ verticalAlign: -2 }} /> {t('whatifTitle')}</h3>
              <Link to="/student/whatif" className="small">{pick(meta.trades.find((x) => x.id === chosen), lang)} <ArrowRight size={12} /></Link>
            </section>
          )}
        </div>
      </div>
      {tour && <Tour steps={tourSteps} onClose={() => { storage.remove('udaan.tour'); setTour(false) }} />}
    </>
  )
}

function DnaPage() {
  const t = useT(S)
  const { lang, meta } = useLang()
  const [d, setD] = useState(null)
  useEffect(() => { api.dna().then(setD) }, [lang])
  if (!d) return <Loading />
  if (!d.dna?.riasec) return <div className="empty">{t('noDna')}</div>
  const R = d.dna.riasec
  const comp = d.dna.competencies || {}
  const order = [...meta.riasec].sort((a, b) => R[b] - R[a])
  return (
    <>
      <PageHead title={t('nav_dna')} sub={t('dnaSub')} />
      <div className="dna-layout">
        <section className="panel">
          <h3>{t('interests')}</h3>
          <div className="grid-2">
            <Hexagon riasec={R} labels={meta.riasec_labels} lang={lang} />
            <div className="dna-legend">
              {order.map((k) => (
                <div key={k}>
                  <div className="row between"><span><strong>{k}</strong> {meta.riasec_labels[k][lang]}</span><span className="mono strong">{Math.round(100 * R[k])}%</span></div>
                  <div className="meter"><span style={{ width: `${100 * R[k] / Math.max(...Object.values(R))}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel">
          <h3>{t('skills')}</h3>
          <div className="stack-1">
            {Object.entries(d.skills).map(([k, v]) => (
              <div key={k}>
                <div className="row between small"><span>{meta.competency_labels[k][lang]}</span>
                  <span className="muted tiny">{k in comp ? t('measured') : t('selfRated')}</span></div>
                <div className={`meter ${k in comp ? '' : 'navy'}`} style={{ opacity: k in comp ? 1 : 0.45 }}><span style={{ width: `${100 * v}%` }} /></div>
              </div>
            ))}
          </div>
          {d.dna.exploration?.sims?.length > 0 && <p className="small muted mt">{t('explored')}: {new Set(d.dna.exploration.sims).size} / 6</p>}
        </section>
      </div>
    </>
  )
}

const TRAVEL = [5, 10, 15, 20, 30, 50, 100, null]
const BUDGET = [0, 2000, 5000, 10000, 20000, 40000, null]
const MONTHS = [3, 6, 12, 24, null]
const EARN = [null, 8000, 10000, 12000, 15000]

function StepSlider({ label, steps, value, format, onChange }) {
  const t = useT(S)
  const idx = Math.max(0, steps.indexOf(value ?? null))
  return (
    <div className="range-row">
      <span className="label small">{label}</span>
      <span className="val small">{steps[idx] === null ? t('noLimit') : format(steps[idx])}</span>
      <input type="range" min={0} max={steps.length - 1} value={idx} onChange={(e) => onChange(steps[Number(e.target.value)])} aria-label={label} />
    </div>
  )
}

function Finder() {
  const t = useT(S)
  const { lang } = useLang()
  const { me, setMe } = useSession()
  const navigate = useNavigate()
  const p = me.profile || {}
  const [lim, setLim] = useState({
    max_travel_km: p.max_travel_km ?? null, budget_limit: p.budget_limit ?? null, max_months: p.max_months ?? null,
    min_earning: p.min_earning ?? null, needs_stipend: Boolean(p.needs_stipend), work_setting: p.work_setting || 'any',
  })
  const [data, setData] = useState(null)
  const [saved, setSaved] = useState(false)
  const timer = useRef(null)
  const query = () => ({
    max_travel_km: lim.max_travel_km ?? 500, budget_limit: lim.budget_limit ?? 500000, max_months: lim.max_months ?? 60,
    min_earning: lim.min_earning ?? 0, needs_stipend: lim.needs_stipend, work_setting: lim.work_setting,
  })
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => api.matches(query()).then(setData), 120)
    return () => clearTimeout(timer.current)
  }, [lim, lang])

  const set = (k) => (v) => { setSaved(false); setLim((x) => ({ ...x, [k]: v })) }
  const save = async () => { await api.matches({ ...query(), save: true }); setSaved(true) }
  const choose = async (trade) => { setMe(await api.patchMe({ chosen_trade: trade })) }
  const max = data ? Math.max(...data.results.map((r) => r.interest + r.skill), 0.01) : 1

  return (
    <>
      <PageHead title={t('findTitle')} sub={t('findSub')} />
      <div className="split left">
        <section className="panel stack sticky" style={{ alignSelf: 'start' }}>
          <StepSlider label={t('travel')} steps={TRAVEL} value={lim.max_travel_km} format={(v) => `${v} ${t('km')}`} onChange={set('max_travel_km')} />
          <StepSlider label={t('budget')} steps={BUDGET} value={lim.budget_limit} format={(v) => (v === 0 ? '₹0' : inr(v))} onChange={set('budget_limit')} />
          <StepSlider label={t('maxMonths')} steps={MONTHS} value={lim.max_months} format={(v) => `${v} ${t('months')}`} onChange={set('max_months')} />
          <StepSlider label={t('earn')} steps={EARN} value={lim.min_earning} format={(v) => `${inr(v)} ${t('perMonth')}`} onChange={set('min_earning')} />
          <label className="toggle" style={{ padding: 0, border: 0 }}>
            <input type="checkbox" checked={lim.needs_stipend} onChange={(e) => set('needs_stipend')(e.target.checked)} />
            <span className="track" aria-hidden /><span className="small strong">{t('stipend')}</span>
          </label>
          <div className="field"><span className="small">{t('setting')}</span>
            <div className="seg">{['indoor', 'outdoor', 'any'].map((s) => <button key={s} className={lim.work_setting === s ? 'on' : ''} onClick={() => set('work_setting')(s)}>{t(s)}</button>)}</div>
          </div>
          <button className="btn" onClick={save} disabled={saved}>{saved ? t('saved') : t('saveLimits')}</button>
        </section>
        <section className="panel flush">
          <div className="legend" style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
            <span><i style={{ background: 'var(--teal)' }} />{t('legendInterest')}</span>
            <span><i style={{ background: 'var(--teal-bright)' }} />{t('legendSkill')}</span>
            <span><i style={{ background: 'var(--error)' }} />{t('legendPenalty')}</span>
          </div>
          {!data ? <Loading /> : data.results.map((r, i) => (
            <div key={r.trade_id} className={`match-row ${r.violations.length > 1 ? 'excluded' : ''}`} style={{ gridTemplateColumns: '32px 40px minmax(0,1fr) 72px' }}>
              <span className="match-rank">{i + 1}</span>
              <TradeIcon trade={r} teal={r.trade_id === me.profile?.chosen_trade} />
              <div className="grow">
                <div className="match-name">{r.name} <span className="tag">NSQF {r.nsqf_level}</span>{' '}
                  {r.trade_id === me.profile?.chosen_trade && <span className="tag teal">{t('chosen')}</span>}</div>
                <div className="match-why">{r.why}</div>
                <div className="contrib" title={`${t('legendInterest')} ${r.interest.toFixed(2)} · ${t('legendSkill')} ${r.skill.toFixed(2)} · −${r.penalty.toFixed(2)}`}>
                  <span className="c-interest" style={{ width: `${(100 * r.interest) / max}%` }} />
                  <span className="c-skill" style={{ width: `${(100 * r.skill) / max}%` }} />
                  {r.penalty > 0 && <span className="c-penalty" style={{ width: `${(100 * r.penalty) / max}%`, marginLeft: 'auto' }} />}
                </div>
                <div className="row wrap mt-1">
                  {r.trade_id !== me.profile?.chosen_trade && <button className="btn small" onClick={() => choose(r.trade_id)}>{t('choose')}</button>}
                  <button className="btn small ghost" onClick={() => navigate(`/student/report/${r.trade_id}`)}>{t('report')}</button>
                  {r.sim && <button className="btn small ghost" onClick={() => navigate(`/student/lab/${r.sim}`)}>{t('trySim')}</button>}
                </div>
              </div>
              <div className="match-score">{r.score}</div>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

function ReportPage() {
  const t = useT(S)
  const { trade } = useParams()
  const { lang } = useLang()
  const [rep, setRep] = useState(null)
  const [token, setToken] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    api.studentReport(trade).then(setRep).catch((e) => setErr(e.message))
    api.shareReport(trade).then((s) => setToken(s.token)).catch(() => {})
  }, [trade, lang])
  if (err) return <ErrorNote error={err} />
  if (!rep) return <Loading />
  return <><PageHead title={t('report')} sub={t('reportSub')} /><ReportView report={rep} shareToken={token} /></>
}

function WhatIfPage() {
  const t = useT(S)
  const { me } = useSession()
  useEffect(() => { api.pathwayAction('finance_viewed').catch(() => {}) }, [])
  return (
    <>
      <PageHead title={t('whatifTitle')} sub={t('whatifSub')} />
      <WhatIf fetcher={api.studentWhatIf} initialTrade={me.profile?.chosen_trade} />
    </>
  )
}

function Progress() {
  const t = useT(S)
  const { lang } = useLang()
  const { me, setMe, signOut } = useSession()
  const [data, setData] = useState(null)
  const [consents, setConsents] = useState(null)
  const [confirm, setConfirm] = useState('')
  useEffect(() => { api.progress().then(setData) }, [lang])
  useEffect(() => {
    const c = me.consents
    setConsents({ ai_guidance: !!c.ai_guidance, counsellor_share: !!c.counsellor_share, parent_link: !!c.parent_link, research: !!c.research })
  }, [])
  const saveConsents = async (v) => { setConsents(v); setMe(await api.setConsents(v)) }
  const download = async () => {
    const blob = await api.exportMe()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }))
    a.download = 'udaan-my-data.json'
    a.click()
  }
  const remove = async () => { await api.deleteMe(); await signOut() }
  if (!data) return <Loading />
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  return (
    <>
      <PageHead title={t('progressTitle')} />
      <div className="split">
        <section className="panel">
          <h3>{t('attempts')}</h3>
          {data.attempts.length === 0 ? <div className="empty">{t('none')}</div> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th /><th className="num">{t('accuracy')}</th><th className="num">{t('safetyScore')}</th><th className="num">{t('time')}</th></tr></thead>
              <tbody>{data.attempts.map((a) => (
                <tr key={a.id}><td>{a.title}<div className="tiny muted">{new Date(a.completed_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}</div></td>
                  <td className="num">{Math.round(100 * a.accuracy)}%</td><td className="num">{Math.round(100 * a.safety_score)}%</td><td className="num">{fmt(a.time_s)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
          <h3 className="mt">{t('nav_path')}</h3>
          <StageStrip stages={data.pathway.stages} />
        </section>
        <section className="panel stack">
          <h3>{t('privacyTitle')}</h3>
          {consents && <ConsentToggles value={consents} onChange={saveConsents} />}
          <button className="btn" onClick={download}><Download size={16} />{t('export')}</button>
          <details>
            <summary className="link" style={{ color: 'var(--error)' }}>{t('delete')}</summary>
            <p className="small">{t('deleteConfirm')}</p>
            <div className="row"><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="DELETE" />
              <button className="btn danger" disabled={confirm !== 'DELETE'} onClick={remove}><Trash2 size={16} />{t('delete')}</button></div>
          </details>
        </section>
      </div>
    </>
  )
}

function ChatPage() {
  const t = useT(S)
  const { me } = useSession()
  const [sid, setSid] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.myChat().then((r) => setSid(r.session_id)).catch((e) => setErr(e.message)) }, [])
  if (!me.consents.ai_guidance) return <><PageHead title={t('nav_chat')} /><div className="note warn"><span>{t('aiOff')}</span></div></>
  return (
    <>
      <PageHead title={t('nav_chat')} sub={t('chatSub')} />
      <ErrorNote error={err} />
      {sid && <Chat sessionId={sid} speaker="learner" pathwayHref="/student/pathway" />}
    </>
  )
}

