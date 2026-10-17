import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ClipboardCheck, Ear, EarOff, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import './gda.css'

const L = {
  where: { en: (d) => `OPD intake · Community Health Centre${d ? `, ${d}` : ''}`, hi: (d) => `OPD पंजीकरण · सामुदायिक स्वास्थ्य केंद्र${d ? `, ${d}` : ''}` },
  stepTalk: { en: 'Talk to patient', hi: 'मरीज़ से बात' },
  stepBp: { en: 'Measure BP', hi: 'BP नापें' },
  stepRecord: { en: 'Record & report', hi: 'दर्ज करें, बताएँ' },
  kamla: { en: 'Kamla ji', hi: 'कमला जी' },
  son: { en: 'Ramesh (son)', hi: 'रमेश (बेटा)' },
  you: { en: 'You', hi: 'आप' },
  comfort: { en: 'Patient comfort', hi: 'मरीज़ का आराम' },
  turnOf: { en: (i, n) => `Reply ${i} of ${n}`, hi: (i, n) => `जवाब ${i} / ${n}` },
  fb2: { en: 'Protocol + empathy', hi: 'सही तरीका + अपनापन' },
  fb1: { en: 'Correct, but cold', hi: 'सही, पर रूखा' },
  fb0: { en: 'Unsafe / wrong', hi: 'असुरक्षित / गलत' },
  closeGood: { en: 'Thank you. I feel calmer now.', hi: 'शुक्रिया। अब मन थोड़ा शांत है।' },
  closeBad: { en: '(still anxious) Hmm... alright.', hi: '(अब भी घबराई हुई) हम्म... ठीक है।' },
  nextBp: { en: 'Next: measure BP', hi: 'आगे: BP नापें' },
  bpHow: {
    en: ['Hold Pump until the needle is near 180.', 'Let go. The valve lets air out slowly.', 'Tap First sound at the first beat.', 'Tap Sound stopped when the beats end.'],
    hi: ['सुई लगभग 180 तक आने तक पंप दबाकर रखें।', 'छोड़ दें। वाल्व धीरे-धीरे हवा निकालेगा।', 'पहली धड़कन पर "पहली आवाज़" दबाएँ।', 'धड़कन रुकते ही "आवाज़ बंद" दबाएँ।'],
  },
  pump: { en: 'Hold to pump', hi: 'पंप — दबाकर रखें' },
  valve: { en: 'Valve', hi: 'वाल्व' },
  slow: { en: 'Slow', hi: 'धीमा' },
  normal: { en: 'Normal', hi: 'सामान्य' },
  fast: { en: 'Fast', hi: 'तेज़' },
  korotkoff: { en: 'Korotkoff sound', hi: 'कोरोटकॉफ़ आवाज़' },
  soundOn: { en: 'Turn sound on', hi: 'आवाज़ चालू करें' },
  soundOff: { en: 'Turn sound off', hi: 'आवाज़ बंद करें' },
  first: { en: 'First sound', hi: 'पहली आवाज़' },
  stop: { en: 'Sound stopped', hi: 'आवाज़ बंद' },
  under: {
    en: 'Beats started at once: the cuff was not pumped high enough. Pump above 180 and let go again.',
    hi: 'धड़कन तुरंत सुनाई दी: कफ़ में हवा कम भरी। 180 से ऊपर पंप करें और फिर छोड़ें।',
  },
  over: { en: 'Above 250 mmHg hurts the patient. Do not over-inflate.', hi: '250 mmHg से ऊपर मरीज़ को दर्द होता है। ज़्यादा हवा न भरें।' },
  again: { en: 'Measure again', hi: 'फिर से नापें' },
  useReading: { en: 'Use this reading', hi: 'यह रीडिंग लें' },
  systolic: { en: 'Systolic (upper)', hi: 'सिस्टोलिक (ऊपर)' },
  diastolic: { en: 'Diastolic (lower)', hi: 'डायस्टोलिक (नीचे)' },
  recordTitle: { en: 'Record the reading', hi: 'रीडिंग दर्ज करें' },
  nextAction: { en: 'What do you do next?', hi: 'आगे क्या करेंगे?' },
  reportNurse: { en: 'Report to nurse', hi: 'नर्स को बताएँ' },
  tellFine: { en: 'Tell patient it is fine', hi: 'मरीज़ से कहें सब ठीक है' },
  fbNurse: {
    en: 'Right. Record every reading and report it to the nurse. Only the nurse or doctor interprets it.',
    hi: 'सही। हर रीडिंग दर्ज करके नर्स को बताएँ। उसका मतलब नर्स या डॉक्टर ही बताएँगे।',
  },
  fbFineHigh: {
    en: 'This BP is high (140/90 or above). Saying it is fine can delay care. Always report to the nurse.',
    hi: 'यह BP ज़्यादा है (140/90 या ऊपर)। "सब ठीक है" कहने से इलाज में देरी हो सकती है। हमेशा नर्स को बताएँ।',
  },
  fbFineOk: {
    en: 'The reading is in range, but a GDA does not judge results. Report every reading to the nurse.',
    hi: 'रीडिंग सामान्य है, पर GDA नतीजा तय नहीं करता। हर रीडिंग नर्स को बताएँ।',
  },
  finish: { en: 'Finish', hi: 'पूरा करें' },
  indProtocol: { en: 'Protocol compliance', hi: 'प्रोटोकॉल पालन' },
  indEmpathy: { en: 'Patient empathy index', hi: 'मरीज़ के प्रति अपनापन' },
  indBp: { en: 'BP reading vs actual', hi: 'BP रीडिंग बनाम असली' },
  indEscalate: { en: 'Escalation to nurse', hi: 'नर्स को सूचना' },
  reported: { en: 'Reported', hi: 'बताया' },
  notReported: { en: 'Not reported', hi: 'नहीं बताया' },
  vs: { en: 'vs', hi: 'बनाम' },
}

const STEP = {
  identify: { en: 'Greet & identify', hi: 'स्वागत व पहचान' },
  consent: { en: 'Consent', hi: 'अनुमति' },
  history: { en: 'Symptoms & history', hi: 'लक्षण व पुरानी बीमारी' },
  explain: { en: 'Explain the BP check', hi: 'BP जाँच समझाना' },
  handover: { en: 'Hand over to nurse', hi: 'नर्स को सौंपना' },
}

const TURNS = [
  {
    step: 'identify', who: 'son',
    line: { en: 'Namaste. This is my mother. She has been feeling dizzy since morning.', hi: 'नमस्ते। ये मेरी माँ हैं। सुबह से इन्हें चक्कर आ रहे हैं।' },
    options: [
      { q: 2, en: "Namaste ji, I'm the duty assistant. Please sit here. Can you tell me her full name and age?", hi: 'नमस्ते जी, मैं ड्यूटी असिस्टेंट हूँ। आराम से यहाँ बैठिए। माँ जी का पूरा नाम और उम्र बताइए?' },
      { q: 1, en: 'Sit there. Name and age?', hi: 'वहाँ बैठो। नाम और उम्र?' },
      { q: 0, unsafe: true, en: 'Dizziness is just weakness. Nothing serious.', hi: 'चक्कर तो कमज़ोरी से आते हैं। कोई बड़ी बात नहीं।' },
    ],
  },
  {
    step: 'consent', who: 'kamla',
    line: { en: 'Kamla Devi, 68 years.', hi: 'कमला देवी, 68 साल।' },
    anxious: { en: '(worried) Kamla Devi... 68. Is it something serious?', hi: '(घबराकर) कमला देवी... 68 साल। कुछ गंभीर तो नहीं?' },
    options: [
      { q: 2, en: 'Kamla ji, I need to ask a few questions and check your blood pressure. Is that alright with you?', hi: 'कमला जी, मुझे कुछ सवाल पूछने हैं और आपका BP देखना है। क्या आपकी अनुमति है?' },
      { q: 1, en: 'BP check is needed. Okay? Quickly.', hi: 'BP चेक होगा। ठीक है? जल्दी कीजिए।' },
      { q: 0, unsafe: true, en: 'No need to ask. Lie down, let me give you a dizziness injection.', hi: 'पूछने की ज़रूरत नहीं। लेट जाइए, चक्कर का इंजेक्शन लगा देते हैं।' },
    ],
  },
  {
    step: 'history', who: 'kamla',
    line: { en: 'Yes, that is fine.', hi: 'हाँ, ठीक है।' },
    anxious: { en: '(hesitant) ...Alright. Will it take long?', hi: '(झिझकते हुए) ...ठीक है। ज़्यादा देर लगेगी क्या?' },
    options: [
      { q: 2, en: 'When did the dizziness start? Do you have BP or sugar problems, or take any medicine? Take your time.', hi: 'चक्कर कब से आ रहे हैं? क्या BP या शुगर की तकलीफ़ है, कोई दवा लेती हैं? आराम से बताइए।' },
      { q: 1, en: 'Symptoms? Old illness? Medicines? Tell quickly.', hi: 'तकलीफ़? पुरानी बीमारी? दवाइयाँ? जल्दी बताइए।' },
      { q: 0, unsafe: true, en: 'This is surely low sugar. Eat something sweet.', hi: 'ये पक्का शुगर कम होने से है। कुछ मीठा खा लीजिए।' },
    ],
  },
  {
    step: 'explain', who: 'son',
    line: { en: 'She takes a BP tablet daily but missed it today. Will the BP check hurt her?', hi: 'ये रोज़ BP की गोली लेती हैं, आज छूट गई। BP चेक में दर्द तो नहीं होगा?' },
    anxious: { en: '(tense) She missed her BP tablet today. Will this check hurt her?', hi: '(तनाव में) आज इनकी BP की गोली छूट गई। इस जाँच में दर्द तो नहीं होगा?' },
    options: [
      { q: 2, en: "No pain. The cuff tightens on the arm for a few seconds, then loosens. Please sit relaxed, feet flat, and don't talk during the check.", hi: 'दर्द नहीं होगा। पट्टा कुछ सेकंड बाँह पर कसेगा, फिर ढीला होगा। आराम से बैठिए, पैर ज़मीन पर रखिए और जाँच के समय बात न कीजिए।' },
      { q: 1, en: "It's a normal check. Just sit still.", hi: 'नॉर्मल जाँच है। बस चुपचाप बैठिए।' },
      { q: 0, unsafe: true, en: 'She looks fine. We can skip the check.', hi: 'ये ठीक लग रही हैं। जाँच छोड़ देते हैं।' },
    ],
  },
  {
    step: 'handover', who: 'son',
    line: { en: 'Should I give her the BP tablet now? Or can you give something for the dizziness?', hi: 'क्या अभी BP की गोली दे दूँ? या आप चक्कर की कोई दवा दे देंगे?' },
    anxious: { en: '(worried) Please give her some medicine quickly. Or should I give her tablet now?', hi: '(परेशान होकर) जल्दी कोई दवा दे दीजिए। या मैं अभी गोली दे दूँ?' },
    options: [
      { q: 2, en: "Please don't give any medicine yet. I'll check her BP and tell the nurse right away. The nurse and doctor will decide.", hi: 'अभी कोई दवा मत दीजिए। BP देखकर तुरंत नर्स को बताते हैं। दवा नर्स और डॉक्टर तय करेंगे।' },
      { q: 1, en: 'Medicine is not my job. Wait for the nurse.', hi: 'दवा मेरा काम नहीं। नर्स का इंतज़ार कीजिए।' },
      { q: 0, unsafe: true, en: 'Yes, give her two tablets now. BP will come down fast.', hi: 'हाँ, अभी दो गोली दे दीजिए। BP जल्दी उतर जाएगा।' },
    ],
  },
]

const QUALITY = { 2: { protocol: 1, empathy: 2, comfort: 12 }, 1: { protocol: 1, empathy: 0, comfort: -4 }, 0: { protocol: 0, empathy: 0, comfort: -15 } }
const RATES = { slow: 2, normal: 3, fast: 5 }
const TICK = 50

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Gauge({ p }) {
  const cx = 120, cy = 120, R = 100
  const ang = (v) => ((135 + (v / 300) * 270) * Math.PI) / 180
  const pt = (v, r) => [cx + r * Math.cos(ang(v)), cy + r * Math.sin(ang(v))]
  const ticks = []
  for (let v = 0; v <= 300; v += 10) {
    const major = v % 50 === 0
    const [x1, y1] = pt(v, R - 2)
    const [x2, y2] = pt(v, R - (major ? 14 : 8))
    ticks.push(<line key={v} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'sim-gda-tick major' : 'sim-gda-tick'} />)
    if (major) {
      const [lx, ly] = pt(v, R - 28)
      ticks.push(<text key={`l${v}`} x={lx} y={ly} className="sim-gda-ticklabel">{v}</text>)
    }
  }
  const [ax, ay] = pt(0, R)
  const [bx, by] = pt(300, R)
  const [nx, ny] = pt(p, R - 18)
  return (
    <svg viewBox="0 0 240 240" className="sim-gda-gauge" role="img" aria-label={`${Math.round(p)} mmHg`}>
      <circle cx={cx} cy={cy} r={R + 12} className="sim-gda-dial" />
      <path d={`M ${ax} ${ay} A ${R} ${R} 0 1 1 ${bx} ${by}`} className="sim-gda-arc" />
      {ticks}
      <line x1={cx} y1={cy} x2={nx} y2={ny} className="sim-gda-needle" />
      <circle cx={cx} cy={cy} r={6} className="sim-gda-hub" />
      <text x={cx} y={cy + 52} className="sim-gda-digits">{Math.round(p)}</text>
      <text x={cx} y={cy + 70} className="sim-gda-unit">mmHg</text>
    </svg>
  )
}

function Steps({ items, current }) {
  return (
    <ol className="sim-gda-steps">
      {items.map((s, i) => (
        <li key={s} className={i === current ? 'on' : i < current ? 'done' : ''}>
          <span className="sim-gda-stepnum">{i + 1}</span> {s}
        </li>
      ))}
    </ol>
  )
}

export default function GdaSim({ lang, context, onComplete }) {
  const tx = (k, ...a) => {
    const v = L[k][lang]
    return typeof v === 'function' ? v(...a) : v
  }
  const district = context?.districtName || ''

  const [truth] = useState(() => {
    const sys = rnd(118, 150)
    return { sys, dia: Math.min(rnd(72, 96), sys - 30), hr: rnd(72, 88) }
  })
  const [order] = useState(() => TURNS.map(() => shuffle([0, 1, 2])))
  const [phase, setPhase] = useState('talk')
  const [answers, setAnswers] = useState([])
  const [comfort, setComfort] = useState(50)

  const [view, setView] = useState({ p: 0, beat: false })
  const [pumping, setPumping] = useState(false)
  const [rate, setRate] = useState('normal')
  const [sound, setSound] = useState(false)
  const [warn, setWarn] = useState(null)
  const [taps, setTaps] = useState({ first: null, stop: null })

  const [sysIn, setSysIn] = useState('')
  const [diaIn, setDiaIn] = useState('')
  const [decision, setDecision] = useState(null)

  const t0 = useRef(performance.now())
  const turnStart = useRef(performance.now())
  const phaseStart = useRef(performance.now())
  const phaseMs = useRef({})
  const steps = useRef([])
  const done = useRef(false)
  const optionsRef = useRef(null)

  const pRef = useRef(0)
  const pumpRef = useRef(false)
  const rateRef = useRef(RATES.normal)
  const peakRef = useRef(0)
  const beatClock = useRef(0)
  const lastBeatAt = useRef(-1e9)
  const lastBeatP = useRef(null)
  const firstTapAt = useRef(null)
  const beatsAfterFirst = useRef(0)
  const soundRef = useRef(false)
  const audioRef = useRef(null)
  const bpStats = useRef({ inflations: 0, under_inflations: 0, over_inflations: 0, max_pressure: 0, valve_changes: 0, measure_attempts: 0, taps: [] })

  const now = () => Math.round(performance.now() - t0.current)
  const logStep = (event, extra = {}) => steps.current.push({ t_ms: now(), event, ...extra })
  const enterPhase = (next) => {
    const t = performance.now()
    phaseMs.current[phase] = Math.round(t - phaseStart.current)
    phaseStart.current = t
    logStep(`phase_${next}`)
    setPhase(next)
  }

  const answeredAll = answers.length === TURNS.length
  useEffect(() => {
    if (phase === 'talk') optionsRef.current?.scrollIntoView({ block: 'nearest' })
  }, [answers.length, phase])

  const choose = (turnIdx, optIdx) => {
    const opt = TURNS[turnIdx].options[optIdx]
    const ms = Math.round(performance.now() - turnStart.current)
    turnStart.current = performance.now()
    setAnswers((a) => [...a, { turn: turnIdx, opt: optIdx, q: opt.q, unsafe: !!opt.unsafe, ms }])
    setComfort((c) => clamp(c + QUALITY[opt.q].comfort, 0, 100))
    logStep('reply', { turn: turnIdx, step: TURNS[turnIdx].step, quality: opt.q, unsafe: !!opt.unsafe, ms })
  }

  const playTick = () => {
    const ctx = audioRef.current
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    const t = ctx.currentTime
    o.type = 'triangle'
    o.frequency.value = 180
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.1)
  }

  const toggleSound = () => {
    const next = !sound
    if (next && !audioRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) audioRef.current = new AC()
    }
    audioRef.current?.resume?.()
    soundRef.current = next
    setSound(next)
    logStep(next ? 'sound_on' : 'sound_off')
  }

  useEffect(() => () => {
    audioRef.current?.close?.()
    audioRef.current = null
  }, [])

  useEffect(() => {
    if (phase !== 'bp') return
    const beatEvery = 60000 / truth.hr
    const id = setInterval(() => {
      const prev = pRef.current
      let p = prev
      if (pumpRef.current) p = Math.min(300, p + 7)
      else if (p > 0) p = Math.max(0, p - rateRef.current / 2)
      pRef.current = p
      if (p > peakRef.current) peakRef.current = p
      if (p > bpStats.current.max_pressure) bpStats.current.max_pressure = Math.round(p)

      const t = performance.now()
      const fire = () => {
        beatClock.current = 0
        lastBeatAt.current = t
        lastBeatP.current = p
        if (firstTapAt.current !== null) beatsAfterFirst.current += 1
        if (soundRef.current) playTick()
      }
      if (!pumpRef.current && p > 0) {
        if (prev > truth.sys && p <= truth.sys) fire()
        else if (p <= truth.sys && p >= truth.dia) {
          beatClock.current += TICK
          if (beatClock.current >= beatEvery) fire()
        } else if (prev >= truth.dia && p < truth.dia && t - lastBeatAt.current > 300) fire()
      }
      const beat = t - lastBeatAt.current < 140
      const rp = Math.round(p)
      setView((v) => (v.p === rp && v.beat === beat ? v : { p: rp, beat }))
    }, TICK)
    return () => clearInterval(id)
  }, [phase, truth])

  const startPump = () => {
    if (pumpRef.current) return
    pumpRef.current = true
    peakRef.current = pRef.current
    beatClock.current = 0
    lastBeatP.current = null
    firstTapAt.current = null
    beatsAfterFirst.current = 0
    bpStats.current.inflations += 1
    setPumping(true)
    setWarn(null)
    setTaps({ first: null, stop: null })
    logStep('pump_start', { from: Math.round(pRef.current) })
  }

  const stopPump = () => {
    if (!pumpRef.current) return
    pumpRef.current = false
    setPumping(false)
    const peak = Math.round(peakRef.current)
    logStep('pump_release', { peak })
    if (peak < 20) return
    if (peak < truth.sys) {
      bpStats.current.under_inflations += 1
      setWarn('under')
    } else if (peak > 250) {
      bpStats.current.over_inflations += 1
      setWarn('over')
    }
  }

  const pickRate = (k) => {
    rateRef.current = RATES[k]
    setRate(k)
    bpStats.current.valve_changes += 1
    logStep('valve', { rate: k })
  }

  const tapFirst = () => {
    const t = performance.now()
    const recent = lastBeatP.current !== null && t - lastBeatAt.current < (60000 / truth.hr) * 1.5
    const val = Math.round(recent ? lastBeatP.current : pRef.current)
    firstTapAt.current = t
    beatsAfterFirst.current = 0
    setTaps({ first: val, stop: null })
    bpStats.current.taps.push({ kind: 'first', t_ms: now(), recorded: val, gauge: Math.round(pRef.current) })
    logStep('tap_first', { recorded: val })
  }

  const tapStop = () => {
    const val = Math.round(beatsAfterFirst.current > 0 && lastBeatP.current !== null ? lastBeatP.current : pRef.current)
    setTaps((s) => ({ ...s, stop: val }))
    bpStats.current.measure_attempts += 1
    bpStats.current.taps.push({ kind: 'stop', t_ms: now(), recorded: val, gauge: Math.round(pRef.current) })
    logStep('tap_stop', { recorded: val })
  }

  const measureAgain = () => {
    setTaps({ first: null, stop: null })
    firstTapAt.current = null
    logStep('measure_again')
  }

  const acceptReading = () => {
    pumpRef.current = false
    pRef.current = 0
    setSysIn(String(taps.first))
    setDiaIn(String(taps.stop))
    enterPhase('record')
  }

  const decide = (d) => {
    setDecision(d)
    logStep('decision', { choice: d, sys: Number(sysIn), dia: Number(diaIn) })
  }

  const elevated = truth.sys >= 140 || truth.dia >= 90

  const finish = () => {
    if (done.current) return
    done.current = true
    phaseMs.current[phase] = Math.round(performance.now() - phaseStart.current)
    const protocolPts = answers.reduce((s, a) => s + QUALITY[a.q].protocol, 0)
    const empathyPts = answers.reduce((s, a) => s + QUALITY[a.q].empathy, 0)
    const protocolMax = TURNS.length
    const empathyMax = TURNS.length * 2
    const unsafeReplies = answers.filter((a) => a.unsafe).length
    const unsafeDecision = decision === 'fine' && elevated
    const rs = parseInt(sysIn, 10)
    const rd = parseInt(diaIn, 10)
    const valid = Number.isFinite(rs) && Number.isFinite(rd)
    const sysErr = valid ? Math.abs(rs - truth.sys) : null
    const diaErr = valid ? Math.abs(rd - truth.dia) : null
    const readingAcc = valid ? Math.max(0, 1 - (sysErr + diaErr) / 30) : 0
    const protocolNorm = protocolPts / protocolMax
    const empathyIndex = Math.round((empathyPts / empathyMax) * 100)
    const accuracy = (protocolNorm + readingAcc) / 2
    const safety = Math.max(0, 1 - 0.25 * (unsafeReplies + (unsafeDecision ? 1 : 0)))
    const recordedStr = valid ? `${rs}/${rd}` : '—'
    const actualStr = `${truth.sys}/${truth.dia}`

    onComplete?.({
      accuracy: Math.round(accuracy * 1000) / 1000,
      safety_score: Math.round(safety * 1000) / 1000,
      telemetry: {
        sim: 'gda_intake_bp',
        district: district || null,
        true_bp: { sys: truth.sys, dia: truth.dia, hr: truth.hr },
        tapped_bp: { sys: taps.first, dia: taps.stop },
        recorded_bp: { sys: valid ? rs : null, dia: valid ? rd : null },
        sys_error: sysErr,
        dia_error: diaErr,
        reading_accuracy: Math.round(readingAcc * 1000) / 1000,
        replies: answers.map((a) => ({ turn: a.turn, step: TURNS[a.turn].step, quality: a.q, unsafe: a.unsafe, ms: a.ms })),
        protocol_points: protocolPts,
        protocol_max: protocolMax,
        empathy_points: empathyPts,
        empathy_max: empathyMax,
        comfort_final: comfort,
        unsafe_replies: unsafeReplies,
        decision,
        decision_unsafe: unsafeDecision,
        bp_elevated: elevated,
        inflations: bpStats.current.inflations,
        under_inflations: bpStats.current.under_inflations,
        over_inflations: bpStats.current.over_inflations,
        max_pressure: bpStats.current.max_pressure,
        measure_attempts: bpStats.current.measure_attempts,
        valve_changes: bpStats.current.valve_changes,
        taps: bpStats.current.taps,
        sound_used: steps.current.some((s) => s.event === 'sound_on'),
        phase_ms: { ...phaseMs.current },
        total_ms: now(),
        steps: steps.current,
      },
      indicators: [
        { en: L.indProtocol.en, hi: L.indProtocol.hi, value: `${Math.round(protocolNorm * 100)}%`, good: protocolNorm >= 0.8 },
        { en: L.indEmpathy.en, hi: L.indEmpathy.hi, value: `${empathyIndex}/100`, good: empathyIndex >= 70 },
        { en: L.indBp.en, hi: L.indBp.hi, value: `${recordedStr} ${tx('vs')} ${actualStr}`, good: readingAcc >= 0.7 },
        { en: L.indEscalate.en, hi: L.indEscalate.hi, value: decision === 'nurse' ? tx('reported') : tx('notReported'), good: decision === 'nurse' },
      ],
    })
  }

  const stepIdx = phase === 'talk' ? 0 : phase === 'bp' ? 1 : 2
  const speaker = (who) => tx(who === 'son' ? 'son' : 'kamla')
  const lineFor = (i) => {
    const turn = TURNS[i]
    const prev = answers[i - 1]
    return prev && prev.q < 2 && turn.anxious ? turn.anxious[lang] : turn.line[lang]
  }
  const fbTag = (q) => (q === 2 ? 'tag ok' : q === 1 ? 'tag warn' : 'tag err')

  const p = view.p
  const canFirst = !pumping && p > 0 && warn !== 'under' && taps.first === null
  const canStop = taps.first !== null && taps.stop === null
  const comfortLow = comfort < 40

  return (
    <div className="sim-gda">
      <div className="row between wrap">
        <span className="small muted">{tx('where', district)}</span>
      </div>
      <Steps items={[tx('stepTalk'), tx('stepBp'), tx('stepRecord')]} current={stepIdx} />

      {phase === 'talk' && (
        <div className="panel tight stack">
          <div className="sim-gda-comfort">
            <div className="row between small">
              <span className="strong">{tx('comfort')}</span>
              <span className="mono">{comfort}/100</span>
            </div>
            <div className={`meter${comfortLow ? ' sim-gda-low' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={comfort} aria-label={tx('comfort')}>
              <span style={{ width: `${comfort}%` }} />
            </div>
          </div>

          <div className="sim-gda-chat" aria-live="polite">
            {answers.map((a, i) => (
              <div key={i} className="sim-gda-exchange">
                <div className="sim-gda-msg them">
                  <div className="sim-gda-who">{speaker(TURNS[i].who)}</div>
                  {lineFor(i)}
                </div>
                <div className="sim-gda-msg you">
                  <div className="sim-gda-who">{tx('you')}</div>
                  {TURNS[i].options[a.opt][lang]}
                  <div className="sim-gda-fb">
                    <span className={fbTag(a.q)}>{tx(`fb${a.q}`)}</span>
                  </div>
                </div>
              </div>
            ))}

            {!answeredAll && (
              <div className="sim-gda-msg them">
                <div className="sim-gda-who">{speaker(TURNS[answers.length].who)}</div>
                {lineFor(answers.length)}
              </div>
            )}
            {answeredAll && (
              <div className="sim-gda-msg them">
                <div className="sim-gda-who">{tx('kamla')}</div>
                {comfort >= 60 ? tx('closeGood') : tx('closeBad')}
              </div>
            )}
          </div>

          {!answeredAll ? (
            <div ref={optionsRef} className="stack-1">
              <div className="row between small muted">
                <span>{STEP[TURNS[answers.length].step][lang]}</span>
                <span>{tx('turnOf', answers.length + 1, TURNS.length)}</span>
              </div>
              <div className="sim-gda-options">
                {order[answers.length].map((oi) => (
                  <button key={oi} type="button" className="sim-gda-option" onClick={() => choose(answers.length, oi)}>
                    {TURNS[answers.length].options[oi][lang]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div ref={optionsRef} className="row end">
              <button type="button" className="btn primary" onClick={() => enterPhase('bp')}>
                {tx('nextBp')} <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'bp' && (
        <div className="panel tight stack">
          <ol className="sim-gda-how small">
            {L.bpHow[lang].map((s) => <li key={s}>{s}</li>)}
          </ol>

          <div className="sim-gda-bp">
            <Gauge p={p} />
            <div className="stack-1">
              <div className="row between">
                <div className="row">
                  <span className={`sim-gda-beat${view.beat ? ' on' : ''}`} aria-hidden="true" />
                  <span className="small strong">{tx('korotkoff')}</span>
                </div>
                <button
                  type="button"
                  className={`icon-btn${sound ? ' on' : ''}`}
                  onClick={toggleSound}
                  aria-pressed={sound}
                  aria-label={sound ? tx('soundOff') : tx('soundOn')}
                  title={sound ? tx('soundOff') : tx('soundOn')}
                >
                  {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
              </div>

              <button
                type="button"
                className={`btn primary big block sim-gda-pump${pumping ? ' active' : ''}`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId)
                  startPump()
                }}
                onPointerUp={stopPump}
                onPointerCancel={stopPump}
                onLostPointerCapture={stopPump}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault()
                    startPump()
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') stopPump()
                }}
                onBlur={stopPump}
              >
                {tx('pump')}
              </button>

              <div className="row between">
                <span className="small strong">{tx('valve')}</span>
                <div className="seg" role="group" aria-label={tx('valve')}>
                  {Object.keys(RATES).map((k) => (
                    <button key={k} type="button" className={rate === k ? 'on' : ''} aria-pressed={rate === k} onClick={() => pickRate(k)}>
                      {tx(k)}
                    </button>
                  ))}
                </div>
              </div>

              {warn && (
                <div className="note warn small" role="status">{tx(warn)}</div>
              )}

              <div className="sim-gda-taps">
                <button type="button" className="btn" disabled={!canFirst} onClick={tapFirst}>
                  <Ear size={18} aria-hidden="true" /> {tx('first')}
                </button>
                <button type="button" className="btn" disabled={!canStop} onClick={tapStop}>
                  <EarOff size={18} aria-hidden="true" /> {tx('stop')}
                </button>
                <div className="stat">
                  <span className="stat-label">{tx('systolic')}</span>
                  <span className="sim-gda-reading">{taps.first ?? '—'}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">{tx('diastolic')}</span>
                  <span className="sim-gda-reading">{taps.stop ?? '—'}</span>
                </div>
              </div>

              {taps.first !== null && taps.stop !== null && (
                <div className="row wrap">
                  <button type="button" className="btn primary" onClick={acceptReading}>
                    {tx('useReading')} <ArrowRight size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="btn ghost" onClick={measureAgain}>
                    <RotateCcw size={16} aria-hidden="true" /> {tx('again')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'record' && (
        <div className="panel tight stack">
          <h3 className="row"><ClipboardCheck size={18} aria-hidden="true" /> {tx('recordTitle')}</h3>
          <div className="sim-gda-record">
            <label className="field">
              <span>{tx('systolic')}</span>
              <input className="input mono" type="number" inputMode="numeric" min={40} max={300} value={sysIn} disabled={!!decision} onChange={(e) => setSysIn(e.target.value)} />
            </label>
            <span className="sim-gda-slash" aria-hidden="true">/</span>
            <label className="field">
              <span>{tx('diastolic')}</span>
              <input className="input mono" type="number" inputMode="numeric" min={20} max={200} value={diaIn} disabled={!!decision} onChange={(e) => setDiaIn(e.target.value)} />
            </label>
            <span className="sim-gda-unitlabel small muted">mmHg</span>
          </div>

          <div className="stack-1">
            <span className="label">{tx('nextAction')}</span>
            <div className="sim-gda-decide">
              <button type="button" className={`btn${decision === 'nurse' ? ' primary' : ''}`} disabled={!!decision || !sysIn || !diaIn} onClick={() => decide('nurse')}>
                {tx('reportNurse')}
              </button>
              <button type="button" className={`btn${decision === 'fine' ? ' primary' : ''}`} disabled={!!decision || !sysIn || !diaIn} onClick={() => decide('fine')}>
                {tx('tellFine')}
              </button>
            </div>
          </div>

          {decision === 'nurse' && <div className="note ok small" role="status">{tx('fbNurse')}</div>}
          {decision === 'fine' && elevated && <div className="alert small" role="status">{tx('fbFineHigh')}</div>}
          {decision === 'fine' && !elevated && <div className="note warn small" role="status">{tx('fbFineOk')}</div>}

          {decision && (
            <div className="row end">
              <button type="button" className="btn primary big" onClick={finish}>{tx('finish')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
