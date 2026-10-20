import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpenCheck, Building2, ChevronRight, GraduationCap, Landmark, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import { useSession } from '../lib/session'
import { Loading, PageHead } from '../components/Shell'

const S = {
  title: { en: 'Try the UDAAN demo', hi: 'उड़ान का डेमो आज़माएँ' },
  sub: {
    en: 'Five ready accounts, one for each portal. Open one with a tap, or sign in with its email and password. All data is demo data.',
    hi: 'हर पोर्टल के लिए एक, पाँच तैयार खाते। एक टैप में खोलें, या ईमेल और पासवर्ड से साइन इन करें। सारा डेटा डेमो है।',
  },
  open: { en: 'Open', hi: 'खोलें' },
  opening: { en: 'Opening…', hi: 'खुल रहा है…' },
  email: { en: 'Email', hi: 'ईमेल' },
  password: { en: 'Password', hi: 'पासवर्ड' },
  link: { en: 'Direct link', hi: 'सीधा लिंक' },
  back: { en: 'Back to the start', hi: 'शुरुआत पर वापस' },
  n_student: { en: 'Riya Kumari, student in Gaya', hi: 'रिया कुमारी, गया की विद्यार्थी' },
  d_student: {
    en: 'Career DNA, the trade finder, six simulations, her pathway, career stories and the chat companion.',
    hi: 'करियर DNA, ट्रेड खोज, छह सिमुलेशन, उसका रास्ता, करियर कहानियाँ और चैट साथी।',
  },
  n_parent: { en: 'Sunita Devi, Riya’s mother', hi: 'सुनीता देवी, रिया की माँ' },
  d_parent: {
    en: 'The 16-point proof report, the 5-year What-If comparison and the family consensus board, in Hindi.',
    hi: '16 बिंदुओं की सबूत रिपोर्ट, 5 साल की तुलना और परिवार का सहमति बोर्ड, हिंदी में।',
  },
  n_counsellor: { en: 'Anjali Verma, counsellor in Patna', hi: 'अंजलि वर्मा, पटना की काउंसलर' },
  d_counsellor: {
    en: 'The referral queue with safety cases first, the 24-hour timer and consented case views.',
    hi: 'सुरक्षा वाले केस सबसे पहले, 24 घंटे का टाइमर और सहमति से साझा केस।',
  },
  n_teacher: { en: 'Rakesh Kumar, Class 10-B teacher', hi: 'राकेश कुमार, कक्षा 10-B के शिक्षक' },
  d_teacher: {
    en: 'Class interests, engagement and printable group-guidance sheets. Never private chats.',
    hi: 'कक्षा की रुचियाँ, भागीदारी और छापने लायक मार्गदर्शन शीट। निजी चैट कभी नहीं।',
  },
  n_admin: { en: 'District Skill Officer', hi: 'ज़िला कौशल अधिकारी' },
  d_admin: {
    en: 'The India map of users, the skill-gap map, family barriers and programme metrics.',
    hi: 'उपयोगकर्ताओं का भारत नक्शा, स्किल-गैप नक्शा, परिवारों की रुकावटें और कार्यक्रम के आँकड़े।',
  },
}

const ICONS = { student: GraduationCap, parent: Users, counsellor: BookOpenCheck, teacher: Building2, admin: Landmark }
export const DEMO_ROLES = Object.keys(ICONS)

// /demo: every demo account with its sign-in details. /demo/:role: signs that account in straight away.
export default function Demo() {
  const { role } = useParams()
  return role ? <DemoSignIn role={role} /> : <DemoList />
}

function useOpenDemo() {
  const { signIn } = useSession()
  const navigate = useNavigate()
  return async (role) => {
    const res = await api.demoLogin(role)
    signIn(res)
    navigate(`/${res.user.role}`, { replace: true })
  }
}

function DemoSignIn({ role }) {
  const open = useOpenDemo()
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!DEMO_ROLES.includes(role)) return setErr(`There is no demo account called “${role}”.`)
    open(role).catch((e) => setErr(e.message))
  }, [role])
  if (!err) return <Loading />
  return <div className="content"><div className="alert" role="alert">{err}</div><DemoList /></div>
}

function DemoList() {
  const t = useT(S)
  const open = useOpenDemo()
  const [accounts, setAccounts] = useState(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { api.demoAccounts().then(setAccounts).catch(() => setAccounts([])) }, [])

  const go = async (role) => {
    setBusy(role)
    setErr('')
    try { await open(role) } catch (e) { setErr(e.message); setBusy('') }
  }
  const creds = Object.fromEntries((accounts || []).map((a) => [a.role, a]))

  return (
    <div className="content demo-page">
      <PageHead title={t('title')} sub={t('sub')} />
      {err && <div className="alert" role="alert">{err}</div>}
      <ul className="demo-list">
        {DEMO_ROLES.map((role) => {
          const RoleIcon = ICONS[role]
          const c = creds[role]
          return (
            <li key={role} className="panel demo-row">
              <span className="demo-icon"><RoleIcon size={20} aria-hidden /></span>
              <div className="demo-text">
                <h3>{t(`n_${role}`)}</h3>
                <p className="muted">{t(`d_${role}`)}</p>
                {c && (
                  <dl className="demo-creds">
                    <dt>{t('email')}</dt><dd><code>{c.email}</code></dd>
                    <dt>{t('password')}</dt><dd><code>{c.password}</code></dd>
                    <dt>{t('link')}</dt><dd><Link to={`/demo/${role}`}><code>/demo/{role}</code></Link></dd>
                  </dl>
                )}
              </div>
              <button className="btn primary" disabled={!!busy} onClick={() => go(role)}>
                {busy === role ? t('opening') : t('open')} <ChevronRight size={16} aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
      <Link className="btn ghost" to="/">{t('back')}</Link>
    </div>
  )
}
