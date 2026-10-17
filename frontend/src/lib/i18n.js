// Hindi + English. Shared strings live here; page-specific strings sit next to their page and go through useT(local).
import { createContext, useContext } from 'react'

export const STRINGS = {
  appName: { en: 'UDAAN', hi: 'उड़ान' },
  appTagline: { en: 'Career guidance with your family', hi: 'परिवार के साथ करियर की राह' },
  demoData: { en: 'Demo data', hi: 'डेमो डेटा' },
  back: { en: 'Back', hi: 'पीछे' },
  next: { en: 'Next', hi: 'आगे' },
  continue: { en: 'Continue', hi: 'आगे बढ़ें' },
  save: { en: 'Save', hi: 'सेव करें' },
  cancel: { en: 'Cancel', hi: 'रद्द करें' },
  close: { en: 'Close', hi: 'बंद करें' },
  signOut: { en: 'Sign out', hi: 'साइन आउट' },
  loading: { en: 'Loading…', hi: 'लोड हो रहा है…' },
  retry: { en: 'Retry', hi: 'फिर कोशिश करें' },
  months: { en: 'months', hi: 'महीने' },
  perMonth: { en: '/ month', hi: '/ महीना' },
  km: { en: 'km', hi: 'किमी' },
  open: { en: 'Open', hi: 'खोलें' },
  done: { en: 'Done', hi: 'पूरा' },
  readAloud: { en: 'Listen', hi: 'सुनें' },
  source: { en: 'Source', hi: 'स्रोत' },
  stateLevel: { en: 'State-level figure', hi: 'राज्य स्तर का आँकड़ा' },

  role_student: { en: 'Student', hi: 'विद्यार्थी' },
  role_parent: { en: 'Parent / guardian', hi: 'माता-पिता / अभिभावक' },
  role_counsellor: { en: 'Counsellor', hi: 'काउंसलर' },
  role_teacher: { en: 'Teacher', hi: 'शिक्षक' },
  role_admin: { en: 'Administrator', hi: 'प्रशासक' },

  learner: { en: 'Learner', hi: 'विद्यार्थी' },
  mother: { en: 'Mother', hi: 'माँ' },
  father: { en: 'Father', hi: 'पिता' },
  guardian: { en: 'Guardian', hi: 'अभिभावक' },
  family: { en: 'Family', hi: 'परिवार' },
  son: { en: 'Son', hi: 'बेटा' },
  daughter: { en: 'Daughter', hi: 'बेटी' },

  // SAATH chat
  saathName: { en: 'SAATH', hi: 'साथ' },
  typeHere: { en: 'Type, or press the mic and speak…', hi: 'लिखें, या माइक दबाकर बोलें…' },
  send: { en: 'Send', hi: 'भेजें' },
  listening: { en: 'Listening… tap to stop', hi: 'सुन रहे हैं… रोकने के लिए दबाएँ' },
  commonWorries: { en: 'Ask about', hi: 'इसके बारे में पूछें' },
  talkToCounsellor: { en: 'Book a counsellor', hi: 'काउंसलर से बात' },
  autoSpeak: { en: 'Speak replies', hi: 'जवाब सुनाएँ' },
  thinkingDots: { en: 'SAATH is checking the records…', hi: 'साथ रिकॉर्ड देख रही है…' },
  phone: { en: 'Phone number', hi: 'फ़ोन नंबर' },
  callbackTime: { en: 'Good time to call', hi: 'फ़ोन करने का सही समय' },
  note: { en: 'Anything the counsellor should know (optional)', hi: 'काउंसलर के लिए कोई बात (ज़रूरी नहीं)' },
  requestCall: { en: 'Book the session', hi: 'सत्र बुक करें' },
  callRequested: { en: 'Booked. A counsellor will call you.', hi: 'बुक हो गया। काउंसलर आपको फ़ोन करेंगे।' },
  storyLabel: { en: 'A family like yours', hi: 'आप जैसा एक परिवार' },
  alumniLabel: { en: 'Someone who did this course', hi: 'जिसने यह कोर्स किया' },
  schemeLabel: { en: 'Government scheme', hi: 'सरकारी योजना' },
  helplineLabel: { en: 'Free helpline', hi: 'मुफ़्त हेल्पलाइन' },
  sourcesUsed: { en: 'Grounded in', hi: 'आधार' },
  pathwayLink: { en: 'See the full pathway', hi: 'पूरा रास्ता देखें' },
}

export const STATUS = {
  verified: { en: 'Verified', hi: 'सत्यापित' },
  'self-reported': { en: 'Centre-reported', hi: 'सेंटर द्वारा बताया' },
  estimate: { en: 'Estimate', hi: 'अनुमान' },
}

export const LangContext = createContext({ lang: 'hi', setLang: () => {} })
export const useLang = () => useContext(LangContext)

// t('key') looks in the page's own strings first, then the shared ones.
export function useT(local) {
  const { lang } = useLang()
  return (key, vars) => {
    const entry = local?.[key] ?? STRINGS[key]
    let s = entry ? (entry[lang] ?? entry.en) : key
    if (vars && typeof s === 'string') Object.entries(vars).forEach(([k, v]) => { s = s.replaceAll(`{${k}}`, v) })
    return s
  }
}

export const tr = (pair, lang) => (pair ? pair[lang] ?? pair.en : '')
export const pick = (obj, lang, field = 'name') => (obj ? obj[`${field}_${lang}`] ?? obj[`${field}_en`] : '')
export const inr = (n) => {
  if (n === null || n === undefined) return '—'
  const v = Math.round(n)
  return `${v < 0 ? '−' : ''}₹${Math.abs(v).toLocaleString('en-IN')}`
}
