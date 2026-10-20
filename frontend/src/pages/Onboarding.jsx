import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpenCheck, Building2, Check, ChevronRight, GraduationCap, Info, Landmark, ShieldCheck, Users } from 'lucide-react'
import { api, storage } from '../lib/api'
import { pick, tr, useLang, useT } from '../lib/i18n'
import { useSession } from '../lib/session'
import Hexagon from '../components/Hexagon'
import Icon from '../components/Icon'

const S = {
  heroTitle: { en: 'Choose a trade with evidence, not guesswork.', hi: 'अंदाज़े से नहीं, सबूत से हुनर चुनें।' },
  heroLede: {
    en: 'UDAAN helps students try real trade tasks, and gives families verified figures on fees, earnings and growth, so the decision is made together.',
    hi: 'उड़ान विद्यार्थियों को असली काम करके देखने देता है, और परिवार को फ़ीस, कमाई और तरक़्क़ी के पक्के आँकड़े देता है, ताकि फ़ैसला मिलकर हो।',
  },
  p1: { en: 'Discover', hi: 'खोजें' },
  p1s: { en: 'Find what suits you through your Career DNA, not marks alone.', hi: 'सिर्फ़ नंबर नहीं, अपने करियर DNA से जानें कि क्या आपको जँचता है।' },
  p2: { en: 'Experience', hi: 'करके देखें' },
  p2s: { en: 'Wire a circuit, read a BP gauge or fix a solar array in a short simulation.', hi: 'छोटे सिमुलेशन में सर्किट जोड़ें, बीपी नापें या सोलर ठीक करें।' },
  p3: { en: 'Plan together', hi: 'मिलकर तय करें' },
  p3s: { en: 'Parents get a proof report and a 5-year cost comparison; the family agrees a plan.', hi: 'माता-पिता को सबूत वाली रिपोर्ट और 5 साल की तुलना मिलती है; परिवार मिलकर योजना बनाता है।' },
  getStarted: { en: 'Get started', hi: 'शुरू करें' },
  haveAccount: { en: 'I already have an account', hi: 'मेरा खाता पहले से है' },
  stepOf: { en: 'Step {n} of {m}', hi: 'चरण {n} / {m}' },
  whoAreYou: { en: 'Who is using UDAAN?', hi: 'उड़ान कौन इस्तेमाल कर रहा है?' },
  whoSub: { en: 'Each role sees different things. You stay in control of what is shared.', hi: 'हर भूमिका अलग चीज़ें देखती है। क्या साझा हो, यह आप तय करते हैं।' },
  r_student: { en: 'Explore trades, try simulations and plan your path. You decide what your family can see.', hi: 'ट्रेड देखें, सिमुलेशन करें, अपना रास्ता बनाएँ। परिवार क्या देखे, आप तय करें।' },
  r_parent: { en: "See your child's shared progress, proof reports and cost comparisons. Never their private notes.", hi: 'बच्चे की साझा प्रगति, सबूत रिपोर्ट और ख़र्च की तुलना देखें। उनके निजी नोट्स कभी नहीं।' },
  r_counsellor: { en: 'Priority referral queue and case summaries students agreed to share.', hi: 'प्राथमिकता वाली कतार और वे केस जिन्हें विद्यार्थी ने साझा करने दिया।' },
  r_teacher: { en: 'Class-level interest and engagement. No private conversations.', hi: 'कक्षा स्तर की रुचि और भागीदारी। कोई निजी बातचीत नहीं।' },
  r_admin: { en: 'District analytics only, anonymised and hidden below 50 people.', hi: 'सिर्फ़ ज़िला स्तर के आँकड़े, बिना नाम, 50 से कम लोगों पर छिपे हुए।' },
  langTitle: { en: 'Choose your language', hi: 'अपनी भाषा चुनें' },
  langSub: { en: 'You can switch at any time from the top bar.', hi: 'ऊपर की पट्टी से कभी भी बदल सकते हैं।' },
  soon: { en: 'Phase 3', hi: 'चरण 3' },
  loginTitle: { en: 'Sign in to UDAAN', hi: 'उड़ान में साइन इन करें' },
  loginSub: { en: 'Enter your email and password to continue.', hi: 'आगे बढ़ने के लिए अपना ईमेल और पासवर्ड दर्ज करें।' },
  signUpTitle: { en: 'Create your account', hi: 'अपना खाता बनाएँ' },
  signUpSub: { en: 'Sign up with your email to start exploring trades.', hi: 'ट्रेड खोजने के लिए अपने ईमेल से खाता बनाएँ।' },
  verifyTitle: { en: 'Verify your email address', hi: 'अपना ईमेल सत्यापित करें' },
  verifySub: { en: 'We sent a 6-digit code to {email}. It expires in 10 minutes.', hi: 'हमने {email} पर 6 अंकों का कोड भेजा है। यह 10 मिनट में समाप्त हो जाएगा।' },
  forgotTitle: { en: 'Reset your password', hi: 'अपना पासवर्ड रीसेट करें' },
  forgotSub: { en: "Enter your registered email and we'll send you a reset code.", hi: 'अपना पंजीकृत ईमेल दर्ज करें और हम आपको एक रीसेट कोड भेजेंगे।' },
  resetTitle: { en: 'Set a new password', hi: 'नया पासवर्ड सेट करें' },
  resetSub: { en: 'Enter the verification code and your new password.', hi: 'सत्यापन कोड और अपना नया पासवर्ड दर्ज करें।' },
  email: { en: 'Email address', hi: 'ईमेल पता' },
  password: { en: 'Password', hi: 'पासवर्ड' },
  newPassword: { en: 'New password (min 8 chars, letters & numbers)', hi: 'नया पासवर्ड (कम से कम 8 अक्षर, संख्या और अक्षर)' },
  code: { en: '6-digit verification code', hi: '6 अंकों का सत्यापन कोड' },
  verify: { en: 'Verify code and continue', hi: 'कोड सत्यापित करें और आगे बढ़ें' },
  yourName: { en: 'Your full name', hi: 'आपका पूरा नाम' },
  forgotPasswordLink: { en: 'Forgot password?', hi: 'पासवर्ड भूल गए?' },
  sendResetCode: { en: 'Send reset code', hi: 'रीसेट कोड भेजें' },
  resetPasswordBtn: { en: 'Reset password and sign in', hi: 'पासवर्ड रीसेट करें और साइन इन करें' },
  resendCode: { en: 'Resend code', hi: 'कोड दोबारा भेजें' },
  resendIn: { en: 'Resend in {s}s', hi: '{s}s में दोबारा भेजें' },
  backToLogin: { en: 'Back to sign in', hi: 'साइन इन पर वापस जाएँ' },
  dontHaveAccount: { en: "Don't have an account? Sign up", hi: 'खाता नहीं है? साइन अप करें' },
  alreadyHaveAccount: { en: 'Already have an account? Sign in', hi: 'पहले से खाता है? साइन इन करें' },
  orDemo: { en: 'Or open a demo account', hi: 'या डेमो खाता खोलें' },
  staffNote: { en: 'Staff accounts (counsellor, teacher, admin) are created by institutions. Use the demo accounts below for testing.', hi: 'स्टाफ़ खाते संस्था द्वारा बनाए जाते हैं। परीक्षण के लिए नीचे दिए गए डेमो खाते का उपयोग करें।' },
  openDemo: { en: 'Open demo {role} account', hi: 'डेमो {role} खाता खोलें' },
  demoRiya: { en: 'Riya, student in Gaya', hi: 'रिया, गया की विद्यार्थी' },
  demoSunita: { en: 'Sunita, her mother', hi: 'सुनीता, उसकी माँ' },
  demoDetails: { en: 'Demo sign-in details', hi: 'डेमो साइन-इन विवरण' },
  allDemos: { en: 'All demo accounts', hi: 'सभी डेमो खाते' },
  tapToFill: { en: 'Fill in this email and password', hi: 'यह ईमेल और पासवर्ड भरें' },
  aboutYou: { en: 'A little about you', hi: 'आपके बारे में थोड़ा' },
  aboutSub: { en: 'Used to find centres near you and courses you can join.', hi: 'पास के सेंटर और आपके लायक कोर्स ढूँढने के लिए।' },
  district: { en: 'District', hi: 'ज़िला' },
  chooseDistrict: { en: 'Choose district', hi: 'ज़िला चुनें' },
  education: { en: 'Education so far', hi: 'अब तक की पढ़ाई' },
  studyMode: { en: 'How would you like to study?', hi: 'कैसे पढ़ना चाहेंगे?' },
  age: { en: 'Age', hi: 'उम्र' },
  years: { en: 'years', hi: 'साल' },
  gender: { en: 'Gender', hi: 'लिंग' },
  girl: { en: 'Girl', hi: 'लड़की' },
  boy: { en: 'Boy', hi: 'लड़का' },
  noSay: { en: 'Prefer not to say', hi: 'नहीं बताना' },
  iAm: { en: 'I am the', hi: 'मैं हूँ' },
  consentTitle: { en: 'Your privacy choices', hi: 'आपकी निजता के विकल्प' },
  consentSub: { en: 'Each choice is separate. You can change them later in Settings.', hi: 'हर विकल्प अलग है। बाद में सेटिंग में बदल सकते हैं।' },
  c_ai: { en: 'AI guidance from UDAAN', hi: 'उड़ान से एआई सलाह' },
  c_ai_s: { en: 'UDAAN answers questions using verified records. Without this, the chat stays off.', hi: 'उड़ान पक्के रिकॉर्ड से जवाब देती है। इसके बिना चैट बंद रहेगी।' },
  c_counsellor: { en: 'Share my profile with a counsellor', hi: 'काउंसलर को मेरी प्रोफ़ाइल दिखे' },
  c_counsellor_s: { en: 'Only when you ask for help: your Career DNA and recommendation reasons.', hi: 'सिर्फ़ जब आप मदद माँगें: आपका करियर DNA और सुझाव के कारण।' },
  c_parent: { en: 'Link with a parent or guardian', hi: 'माता-पिता से जोड़ें' },
  c_parent_s: { en: 'They see only what you allow. Your private notes are never shared.', hi: 'वे वही देखेंगे जो आप चाहें। आपके निजी नोट्स कभी नहीं।' },
  c_research: { en: 'Help improve local training', hi: 'स्थानीय ट्रेनिंग बेहतर बनाने में मदद' },
  c_research_s: { en: 'Anonymised counts only, never shown for groups under 50 people. Never sold.', hi: 'सिर्फ़ बिना नाम की गिनती, 50 से कम के समूह पर कभी नहीं दिखती। कभी बेची नहीं जाती।' },
  minorNote: { en: 'You are under 18, so a parent or guardian must approve. After setup, share your family code with them.', hi: 'आप 18 से कम हैं, इसलिए माता-पिता की मंज़ूरी चाहिए। सेटअप के बाद उन्हें अपना फ़ैमिली कोड दें।' },
  dnaTitle: { en: 'Build your Career DNA', hi: 'अपना करियर DNA बनाएँ' },
  dnaSub: { en: 'How do you feel about each activity? Go with your first reaction.', hi: 'हर काम के बारे में आपको कैसा लगता है? पहली भावना से चुनें।' },
  like: { en: 'Like it', hi: 'पसंद' },
  meh: { en: 'Not sure', hi: 'पता नहीं' },
  no: { en: 'Not for me', hi: 'पसंद नहीं' },
  answered: { en: '{n} of {m} answered', hi: '{m} में से {n} जवाब' },
  confidence: { en: 'How confident are you with…', hi: 'आप कितने भरोसे में हैं…' },
  c_numerical: { en: 'Numbers and calculation', hi: 'गिनती और हिसाब' },
  c_spatial: { en: 'Shapes, maps and angles', hi: 'आकार, नक्शे और कोण' },
  c_digital: { en: 'Phones and computers', hi: 'फ़ोन और कंप्यूटर' },
  low: { en: 'Not yet', hi: 'अभी नहीं' },
  high: { en: 'Very', hi: 'बहुत' },
  seeResults: { en: 'See my matches', hi: 'मेरे मेल देखें' },
  needMore: { en: 'Answer at least 12 to continue', hi: 'आगे बढ़ने के लिए कम से कम 12 जवाब दें' },
  yourShape: { en: 'Your interest shape', hi: 'आपकी रुचि का आकार' },
  shapeHint: { en: 'Updates as you answer.', hi: 'जवाब देते ही बदलता है।' },
}

const ROLES = [
  ['student', GraduationCap], ['parent', Users], ['counsellor', BookOpenCheck], ['teacher', Building2], ['admin', Landmark],
]
const OTHER_LANGS = ['বাংলা', 'मराठी', 'తెలుగు', 'اردو']

export default function Onboarding() {
  const { me } = useSession()
  const initial = !me ? 'welcome' : !me.onboarded ? 'details' : !me.consents?.updated_at ? 'consent'
    : me.user.role === 'student' && !me.has_dna ? 'dna' : 'welcome'
  const [step, setStep] = useState(initial)
  const [role, setRole] = useState(me?.user?.role || 'student')
  const [authMode, setAuthMode] = useState('register')
  useEffect(() => { window.scrollTo({ top: 0 }) }, [step])

  const flow = role === 'student' ? ['welcome', 'role', 'language', 'login', 'details', 'consent', 'dna']
    : role === 'parent' ? ['welcome', 'role', 'language', 'login', 'details', 'consent']
      : ['welcome', 'role', 'language', 'login']
  const n = flow.indexOf(step)
  const go = (s) => setStep(s)

  return (
    <div className={`onb ${step === 'dna' ? 'wide' : ''}`}>
      {step !== 'dna' && <Aside done={n} total={flow.length} />}
      <main className="onb-main">
        {step === 'welcome' && (
          <Welcome
            onStart={() => { setAuthMode('register'); go('role') }}
            onLogin={() => { setAuthMode('login'); go('login') }}
          />
        )}
        {step === 'role' && <RolePick role={role} setRole={setRole} step={n} total={flow.length} onNext={() => go('language')} onBack={() => go('welcome')} />}
        {step === 'language' && <LanguagePick step={n} total={flow.length} onNext={() => go('login')} onBack={() => go('role')} />}
        {step === 'login' && (
          <AuthStep
            role={role}
            initialMode={authMode}
            onBack={() => go(authMode === 'login' ? 'welcome' : 'language')}
            onNew={() => go('details')}
            onDone={() => go('details')}
          />
        )}
        {step === 'details' && <Details role={me?.user?.role || role} onNext={() => go('consent')} />}
        {step === 'consent' && <Consent onNext={(r) => r === 'student' && go('dna')} />}
        {step === 'dna' && <DnaStep />}
      </main>
    </div>
  )
}

function Aside({ done, total }) {
  const t = useT(S)
  return (
    <aside className="onb-aside">
      <h1>{t('heroTitle')}</h1>
      <p className="lede">{t('heroLede')}</p>
      <div className="pillars">
        {[['p1', 'p1s'], ['p2', 'p2s'], ['p3', 'p3s']].map(([h, s], i) => (
          <div key={h} className="pillar">
            <span className="pillar-num">0{i + 1}</span>
            <div><h3>{t(h)}</h3><p>{t(s)}</p></div>
          </div>
        ))}
      </div>
      <div className="onb-steps" aria-hidden>
        {Array.from({ length: total }, (_, i) => <span key={i} className={i <= done ? 'done' : ''} />)}
      </div>
    </aside>
  )
}

function Welcome({ onStart, onLogin }) {
  const t = useT(S)
  return (
    <div className="stack">
      <h2>{t('appTagline')}</h2>
      <p className="muted">{t('heroLede')}</p>
      <button className="btn primary big" onClick={onStart}>{t('getStarted')} <ChevronRight size={18} /></button>
      <button className="btn" onClick={onLogin}>{t('haveAccount')}</button>
      <DemoAccounts />
    </div>
  )
}

function StepHead({ step, total, title, sub }) {
  const t = useT(S)
  return (
    <div>
      <div className="step-count">{t('stepOf', { n: step, m: total - 1 })}</div>
      <h2>{title}</h2>
      {sub && <p className="muted">{sub}</p>}
    </div>
  )
}

function RolePick({ role, setRole, step, total, onNext, onBack }) {
  const t = useT(S)
  return (
    <div className="stack">
      <StepHead step={step} total={total} title={t('whoAreYou')} sub={t('whoSub')} />
      <div className="role-list" role="radiogroup">
        {ROLES.map(([r, I]) => (
          <button key={r} className={`role-card ${role === r ? 'on' : ''}`} onClick={() => setRole(r)} role="radio" aria-checked={role === r}>
            <span className="role-ico"><I size={20} strokeWidth={1.75} /></span>
            <span><strong>{t(`role_${r}`)}</strong><span className="small muted">{t(`r_${r}`)}</span></span>
            {role === r ? <Check size={18} color="var(--teal)" /> : <span />}
          </button>
        ))}
      </div>
      <div className="row between"><button className="btn ghost" onClick={onBack}>{t('back')}</button><button className="btn primary" onClick={onNext}>{t('continue')}</button></div>
    </div>
  )
}

function LanguagePick({ step, total, onNext, onBack }) {
  const t = useT(S)
  const { lang, setLang } = useLang()
  return (
    <div className="stack">
      <StepHead step={step} total={total} title={t('langTitle')} sub={t('langSub')} />
      <div className="lang-cards">
        <button className={`lang-card ${lang === 'hi' ? 'on' : ''}`} onClick={() => setLang('hi')}><strong>हिंदी</strong><span className="small muted">Hindi</span></button>
        <button className={`lang-card ${lang === 'en' ? 'on' : ''}`} onClick={() => setLang('en')}><strong>English</strong><span className="small muted">अंग्रेज़ी</span></button>
        {OTHER_LANGS.map((l) => <button key={l} className="lang-card soon" disabled><strong>{l}</strong><span className="small muted">{t('soon')}</span></button>)}
      </div>
      <div className="row between"><button className="btn ghost" onClick={onBack}>{t('back')}</button><button className="btn primary" onClick={onNext}>{t('continue')}</button></div>
    </div>
  )
}

function DemoAccounts({ roles = ['student', 'parent', 'counsellor', 'teacher', 'admin'], link = true }) {
  const t = useT(S)
  const { signIn } = useSession()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const open = async (r) => {
    setBusy(r)
    setError('')
    try { signIn(await api.demoLogin(r)) } catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const label = {
    student: t('demoRiya') || 'Student (Riya)',
    parent: t('demoSunita') || 'Parent (Sunita)',
    counsellor: 'Counsellor (Anjali)',
    teacher: 'Teacher (Rakesh)',
    admin: 'District Admin',
  }
  return (
    <div className="stack-1 mt">
      <div className="row between">
        <div className="section-title">{t('orDemo')}</div>
        {link && <Link className="link small" to="/demo">{t('allDemos')}</Link>}
      </div>
      <div className="quick-login">
        {roles.map((r) => (
          <button key={r} type="button" className="btn small" disabled={!!busy} onClick={() => open(r)}>
            {label[r] || t('openDemo', { role: t(`role_${r}`).toLowerCase() })}
          </button>
        ))}
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
    </div>
  )
}

// The demo accounts' email and password; picking a row fills the sign-in form
function DemoFill({ roles, onPick }) {
  const t = useT(S)
  const [accounts, setAccounts] = useState([])
  useEffect(() => { api.demoAccounts().then(setAccounts).catch(() => {}) }, [])
  const shown = accounts.filter((a) => !roles || roles.includes(a.role))
  if (!shown.length) return null
  return (
    <div className="stack-1">
      <div className="row between">
        <div className="section-title">{t('demoDetails')}</div>
        <Link className="link small" to="/demo">{t('allDemos')}</Link>
      </div>
      <table className="demo-fill">
        <tbody>
          {shown.map((a) => (
            <tr key={a.role} tabIndex={0} onClick={() => onPick(a)} onKeyDown={(e) => e.key === 'Enter' && onPick(a)}
              title={t('tapToFill')}>
              <td className="hide-sm">{t(`role_${a.role}`)}</td>
              <td><code>{a.email}</code></td>
              <td><code>{a.password}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AuthStep({ role, initialMode = 'login', onBack, onNew, onDone }) {
  const t = useT(S)
  const { lang } = useLang()
  const { signIn } = useSession()

  const staff = ['counsellor', 'teacher', 'admin'].includes(role)
  const [mode, setMode] = useState(staff ? 'login' : initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Resend OTP countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleRegister = async (e) => {
    e.preventDefault()
    setErr('')
    setInfoMsg('')
    setBusy(true)
    try {
      const res = await api.register({ name, email, password, role, lang })
      setInfoMsg(res.message || t('codeSent'))
      setMode('verify_otp')
      setCooldown(60)
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setErr('')
    setInfoMsg('')
    setBusy(true)
    try {
      const res = await api.login({ email, password })
      signIn(res)
      if (res.is_new || !res.onboarded) onNew()
      else onDone?.()
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setErr('')
    setInfoMsg('')
    setBusy(true)
    try {
      const res = await api.otpVerify({ email, code, purpose: 'signup_verification' })
      signIn(res)
      if (res.is_new || !res.onboarded) onNew()
      else onDone?.()
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  const handleResendOtp = async () => {
    if (cooldown > 0 || busy) return
    setErr('')
    setInfoMsg('')
    setBusy(true)
    try {
      const res = await api.otpRequest({ email, purpose: 'signup_verification' })
      setInfoMsg(res.message || t('codeSent'))
      setCooldown(60)
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setErr('')
    setInfoMsg('')
    setBusy(true)
    try {
      const res = await api.forgotPassword({ email })
      setInfoMsg(res.message)
      setMode('reset')
      setCooldown(60)
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setErr('')
    setInfoMsg('')
    setBusy(true)
    try {
      const res = await api.resetPassword({ email, code, new_password: newPassword })
      setInfoMsg(res.message || t('pwdResetSuccess'))
      setMode('login')
      setPassword('')
      setCode('')
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      {/* Verify OTP Mode */}
      {mode === 'verify_otp' && (
        <>
          <div>
            <h2>{t('verifyTitle')}</h2>
            <p className="muted">{t('verifySub', { email })}</p>
          </div>
          <form className="stack" onSubmit={handleVerifyOtp}>
            <label className="field">
              <span>{t('code')}</span>
              <input
                className="input otp"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <button className="btn primary" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying...' : t('verify')}
            </button>
            <div className="row between">
              <button
                type="button"
                className="btn ghost small"
                disabled={busy || cooldown > 0}
                onClick={handleResendOtp}
              >
                {cooldown > 0 ? t('resendIn', { s: cooldown }) : t('resendCode')}
              </button>
              <button
                type="button"
                className="link small"
                onClick={() => { setMode('register'); setCode(''); setErr('') }}
              >
                Change email / Back
              </button>
            </div>
          </form>
        </>
      )}

      {/* Forgot Password Mode */}
      {mode === 'forgot' && (
        <>
          <div>
            <h2>{t('forgotTitle')}</h2>
            <p className="muted">{t('forgotSub')}</p>
          </div>
          <form className="stack" onSubmit={handleForgotPassword}>
            <label className="field">
              <span>{t('email')}</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="btn primary" disabled={busy || !email}>
              {busy ? 'Sending...' : t('sendResetCode')}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => { setMode('login'); setErr('') }}
            >
              {t('backToLogin')}
            </button>
          </form>
        </>
      )}

      {/* Reset Password Mode */}
      {mode === 'reset' && (
        <>
          <div>
            <h2>{t('resetTitle')}</h2>
            <p className="muted">{t('resetSub')}</p>
          </div>
          <form className="stack" onSubmit={handleResetPassword}>
            <label className="field">
              <span>{t('email')}</span>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('code')}</span>
              <input
                className="input otp"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <label className="field">
              <span>{t('newPassword')}</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <button className="btn primary" disabled={busy || code.length !== 6 || newPassword.length < 8}>
              {busy ? 'Resetting...' : t('resetPasswordBtn')}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => { setMode('login'); setErr('') }}
            >
              {t('backToLogin')}
            </button>
          </form>
        </>
      )}

      {/* Login Mode */}
      {mode === 'login' && (
        <>
          <div>
            <h2>{t('loginTitle')}</h2>
            <p className="muted">{t('loginSub')}</p>
          </div>
          {staff && (
            <div className="note">
              <Info size={16} />
              <span>{t('staffNote')}</span>
            </div>
          )}
          <form className="stack" onSubmit={handleLogin}>
            <label className="field">
              <span>{t('email')}</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <div className="row between">
                <span>{t('password')}</span>
                <button
                  type="button"
                  className="link small"
                  onClick={() => { setMode('forgot'); setErr(''); setInfoMsg('') }}
                >
                  {t('forgotPasswordLink')}
                </button>
              </div>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="btn primary" disabled={busy || !email || !password}>
              {busy ? 'Signing in...' : t('loginTitle')}
            </button>
          </form>
          {!staff && (
            <div className="row between">
              <span className="small muted">{t('dontHaveAccount')}</span>
              <button
                type="button"
                className="link small strong"
                onClick={() => { setMode('register'); setErr(''); setInfoMsg('') }}
              >
                Sign up
              </button>
            </div>
          )}
          <DemoFill roles={staff ? [role] : undefined} onPick={(d) => { setEmail(d.email); setPassword(d.password); setErr('') }} />
        </>
      )}

      {/* Register Mode */}
      {mode === 'register' && (
        <>
          {staff ? (
            <div>
              <h2>{t('loginTitle')}</h2>
              <div className="note">
                <Info size={16} />
                <span>{t('staffNote')}</span>
              </div>
              <button className="btn primary mt" onClick={() => setMode('login')}>
                Sign in to staff account
              </button>
            </div>
          ) : (
            <>
              <div>
                <h2>{t('signUpTitle')}</h2>
                <p className="muted">{t('signUpSub')}</p>
              </div>
              <form className="stack" onSubmit={handleRegister}>
                <label className="field">
                  <span>{t('yourName')}</span>
                  <input
                    className="input"
                    placeholder="Asha Sharma"
                    maxLength={60}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>{t('email')}</span>
                  <input
                    className="input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>{t('password')}</span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="btn primary" disabled={busy || !email || password.length < 8 || !name.trim()}>
                  {busy ? 'Creating account...' : t('signUpTitle')}
                </button>
              </form>
              <div className="row between">
                <span className="small muted">{t('alreadyHaveAccount')}</span>
                <button
                  type="button"
                  className="link small strong"
                  onClick={() => { setMode('login'); setErr(''); setInfoMsg('') }}
                >
                  Sign in
                </button>
              </div>
            </>
          )}
        </>
      )}

      {err && <div className="alert">{err}</div>}
      {infoMsg && <div className="note ok">{infoMsg}</div>}

      <DemoAccounts roles={staff ? [role] : ['student', 'parent', 'counsellor', 'teacher', 'admin']} link={mode !== 'login'} />
      <button className="btn ghost" onClick={onBack}>{t('back')}</button>
    </div>
  )
}

function DistrictSelect({ value, onChange }) {
  const t = useT(S)
  const { lang, meta } = useLang()
  const states = [...new Set(meta.districts.map((d) => d.state))]
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('chooseDistrict')}</option>
      {states.map((s) => (
        <optgroup key={s} label={lang === 'hi' ? meta.districts.find((d) => d.state === s).state_hi : s}>
          {meta.districts.filter((d) => d.state === s).map((d) => <option key={d.id} value={d.id}>{pick(d, lang)}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

function Chips({ options, value, onChange }) {
  return (
    <div className="chips" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={`chip ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  )
}

function Details({ role, onNext }) {
  const t = useT(S)
  const { lang, meta } = useLang()
  const { me, setMe } = useSession()
  const p = me?.profile || {}
  const [f, setF] = useState({
    name: me?.user?.name || '', district_id: p.district_id || me?.user?.district_id || '', education_level: p.education_level || '10',
    study_mode: p.study_mode || 'full_time', age: p.age || 16, gender: p.gender || 'x', relation: me?.user?.relation || 'mother',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const save = async () => {
    setBusy(true)
    const body = role === 'student'
      ? { name: f.name, district_id: f.district_id, education_level: f.education_level, study_mode: f.study_mode, age: f.age, gender: f.gender }
      : { name: f.name, district_id: f.district_id, relation: f.relation }
    try { setMe(await api.patchMe(body)); onNext() } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div><h2>{t('aboutYou')}</h2><p className="muted">{t('aboutSub')}</p></div>
      <label className="field"><span>{t('yourName')}</span><input className="input" value={f.name} onChange={(e) => set('name')(e.target.value)} maxLength={60} /></label>
      {role === 'parent' && (
        <div className="field"><span>{t('iAm')}</span>
          <Chips value={f.relation} onChange={set('relation')} options={[['mother', t('mother')], ['father', t('father')], ['guardian', t('guardian')]]} />
        </div>
      )}
      <label className="field"><span>{t('district')}</span><DistrictSelect value={f.district_id} onChange={set('district_id')} /></label>
      {role === 'student' && (
        <>
          <div className="field"><span>{t('education')}</span>
            <Chips value={f.education_level} onChange={set('education_level')} options={meta.education.map((e) => [e.id, e[lang]])} />
          </div>
          <div className="field"><span>{t('studyMode')}</span>
            <Chips value={f.study_mode} onChange={set('study_mode')} options={meta.study_modes.map((e) => [e.id, e[lang]])} />
          </div>
          <div className="field">
            <div className="range-row"><span className="label">{t('age')}</span><span className="val">{f.age} {t('years')}</span>
              <input type="range" min="14" max="30" value={f.age} onChange={(e) => set('age')(Number(e.target.value))} aria-label={t('age')} />
            </div>
          </div>
          <div className="field"><span>{t('gender')}</span>
            <Chips value={f.gender} onChange={set('gender')} options={[['f', t('girl')], ['m', t('boy')], ['x', t('noSay')]]} />
          </div>
        </>
      )}
      <button className="btn primary" disabled={busy || !f.district_id} onClick={save}>{t('continue')}</button>
    </div>
  )
}

function Toggle({ checked, onChange, title, sub }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden />
      <span><strong className="strong" style={{ color: 'var(--navy)' }}>{title}</strong><br /><span className="small muted">{sub}</span></span>
    </label>
  )
}

export function ConsentToggles({ value, onChange }) {
  const t = useT(S)
  const set = (k) => (v) => onChange({ ...value, [k]: v })
  return (
    <div>
      <Toggle checked={value.ai_guidance} onChange={set('ai_guidance')} title={t('c_ai')} sub={t('c_ai_s')} />
      <Toggle checked={value.counsellor_share} onChange={set('counsellor_share')} title={t('c_counsellor')} sub={t('c_counsellor_s')} />
      <Toggle checked={value.parent_link} onChange={set('parent_link')} title={t('c_parent')} sub={t('c_parent_s')} />
      <Toggle checked={value.research} onChange={set('research')} title={t('c_research')} sub={t('c_research_s')} />
    </div>
  )
}

function Consent({ onNext }) {
  const t = useT(S)
  const { me, setMe } = useSession()
  const [c, setC] = useState({ ai_guidance: true, counsellor_share: false, parent_link: true, research: false })
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      setMe(await api.setConsents(c))
      onNext(me.user.role)
    } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div><h2>{t('consentTitle')}</h2><p className="muted">{t('consentSub')}</p></div>
      <ConsentToggles value={c} onChange={setC} />
      {me?.user?.role === 'student' && (me.profile?.age || 18) < 18 && <div className="note saffron"><ShieldCheck size={16} /><span>{t('minorNote')}</span></div>}
      <button className="btn primary" disabled={busy} onClick={save}>{t('continue')}</button>
    </div>
  )
}

function DnaStep() {
  const t = useT(S)
  const { lang, meta } = useLang()
  const { setMe } = useSession()
  const navigate = useNavigate()
  const [answers, setAnswers] = useState({})
  const [conf, setConf] = useState({ numerical: 3, spatial: 3, digital: 3 })
  const [busy, setBusy] = useState(false)
  const items = meta.riasec_items
  const count = Object.keys(answers).length

  // same normalisation as the server, so the hexagon is exactly what will be saved
  const live = useMemo(() => {
    const w = { like: 2, meh: 1, no: 0 }
    const tot = Object.fromEntries(meta.riasec.map((d) => [d, 0]))
    items.forEach((i) => { if (answers[i.id]) tot[i.dim] += w[answers[i.id]] })
    const s = Object.values(tot).reduce((a, b) => a + b, 0)
    return s ? Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, v / s])) : null
  }, [answers])

  const submit = async () => {
    setBusy(true)
    try {
      await api.saveDna({ answers, confidence: conf })
      storage.set('udaan.tour', '1')
      setMe((m) => ({ ...m, has_dna: true }))
      navigate('/student')
    } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div><h2>{t('dnaTitle')}</h2><p className="muted">{t('dnaSub')}</p></div>
      <div className="row between"><span className="small strong">{t('answered', { n: count, m: items.length })}</span></div>
      <div className="meter"><span style={{ width: `${(100 * count) / items.length}%` }} /></div>
      <div className="dna-layout">
      <div className="stack-1">
        {items.map((it) => (
          <div key={it.id} className="activity">
            <span className="activity-ico"><Icon name={it.icon} size={22} /></span>
            <span className="activity-text">{tr(it, lang)}</span>
            <div className="vote" role="radiogroup" aria-label={tr(it, lang)}>
              {['like', 'meh', 'no'].map((v) => (
                <button key={v} role="radio" aria-checked={answers[it.id] === v} className={`${v} ${answers[it.id] === v ? 'on' : ''}`}
                  onClick={() => setAnswers((a) => ({ ...a, [it.id]: v }))}>{t(v)}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <aside className="panel tight dna-live">
        <div className="section-title">{t('yourShape')}</div>
        <Hexagon riasec={live} labels={meta.riasec_labels} lang={lang} size={260} />
        <div className="tiny muted">{t('shapeHint')}</div>
      </aside>
      </div>
      <div className="panel tight stack">
        <div className="section-title">{t('confidence')}</div>
        {['numerical', 'spatial', 'digital'].map((k) => (
          <div key={k} className="range-row">
            <span className="label">{t(`c_${k}`)}</span>
            <span className="val">{conf[k] <= 2 ? t('low') : conf[k] >= 4 ? t('high') : conf[k]}</span>
            <input type="range" min="1" max="5" value={conf[k]} onChange={(e) => setConf({ ...conf, [k]: Number(e.target.value) })} aria-label={t(`c_${k}`)} />
          </div>
        ))}
      </div>
      <button className="btn primary big" disabled={busy || count < 12} onClick={submit}>{count < 12 ? t('needMore') : t('seeResults')}</button>
    </div>
  )
}
