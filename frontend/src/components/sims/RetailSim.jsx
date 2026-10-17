import { useEffect, useRef, useState } from 'react'
import { Ban, Check, CircleAlert, Clock, Flag, ReceiptText, Repeat, RotateCcw, Search, Store, Wrench } from 'lucide-react'
import './retail.css'

const DURATION = 90000
const START_MOOD = -60
const RETURN_DAYS = 7
const PHASES = ['t1', 't2', 'pos', 't3', 'resolve', 't4']

const L = {
  customer: { en: 'Customer', hi: 'ग्राहक' },
  you: { en: 'You', hi: 'आप' },
  angry: { en: 'Angry', hi: 'गुस्से में' },
  satisfied: { en: 'Satisfied', hi: 'संतुष्ट' },
  mood: { en: 'Customer mood', hi: 'ग्राहक का मूड' },
  timeLeft: { en: 'Time left', hi: 'बचा समय' },
  step: { en: 'Step', hi: 'चरण' },
  of: { en: 'of', hi: '/' },
  doReply: { en: 'Choose your reply', hi: 'अपना जवाब चुनें' },
  doPos: { en: "Find the customer's order in the POS and confirm it", hi: 'POS में ग्राहक का ऑर्डर ढूँढें और पुष्टि करें' },
  doResolve: { en: 'Decide the resolution as per the return policy', hi: 'रिटर्न पॉलिसी के अनुसार समाधान चुनें' },
  doClosed: { en: 'Interaction complete', hi: 'बातचीत पूरी हुई' },
  doLeft: { en: 'Time over. The customer left the counter.', hi: 'समय खत्म। ग्राहक काउंटर छोड़कर चला गया।' },
  finish: { en: 'Finish', hi: 'पूरा करें' },
  pos: { en: 'Store POS', hi: 'स्टोर POS' },
  today: { en: 'Today', hi: 'आज' },
  searchPh: { en: 'Order no. or last 4 digits of phone', hi: 'ऑर्डर नंबर या फ़ोन के आखिरी 4 अंक' },
  search: { en: 'Search', hi: 'खोजें' },
  showAll: { en: 'Show all', hi: 'सभी दिखाएँ' },
  noResults: { en: 'No orders found', hi: 'कोई ऑर्डर नहीं मिला' },
  colOrder: { en: 'Order', hi: 'ऑर्डर' },
  colDate: { en: 'Date', hi: 'तारीख' },
  colItem: { en: 'Item', hi: 'सामान' },
  colAmount: { en: 'Amount', hi: 'रकम' },
  colPay: { en: 'Payment', hi: 'भुगतान' },
  colStatus: { en: 'Status', hi: 'स्थिति' },
  phone: { en: 'Phone', hi: 'फ़ोन' },
  openHint: { en: 'Tap an order to open it', hi: 'ऑर्डर खोलने के लिए उस पर टैप करें' },
  confirm: { en: "This is the customer's order", hi: 'यही ग्राहक का ऑर्डर है' },
  wrongOrder: { en: 'This does not match what the customer told you.', hi: 'यह ग्राहक की बताई जानकारी से मेल नहीं खाता।' },
  policy: { en: 'Return policy', hi: 'रिटर्न पॉलिसी' },
  p1: { en: `Within ${RETURN_DAYS} days of purchase, defective item with bill: refund or replacement at the store.`, hi: `खरीद के ${RETURN_DAYS} दिन के अंदर, खराब सामान और बिल के साथ: दुकान पर पैसे वापस या बदली।` },
  p2: { en: `After ${RETURN_DAYS} days: no store return. Refer to the authorised service centre (1-year warranty).`, hi: `${RETURN_DAYS} दिन के बाद: दुकान पर वापसी नहीं। अधिकृत सर्विस सेंटर भेजें (1 साल की वारंटी)।` },
  p3: { en: 'Physical damage is not covered.', hi: 'टूट-फूट वारंटी में शामिल नहीं है।' },
  resolveTitle: { en: 'Resolution', hi: 'समाधान' },
  r_refund: { en: 'Refund', hi: 'पैसे वापस' },
  r_replace: { en: 'Replacement', hi: 'बदली (नया पीस)' },
  r_service: { en: 'Service centre referral', hi: 'सर्विस सेंटर भेजें' },
  r_refuse: { en: 'Refuse', hi: 'मना करें' },
  notFound: { en: 'Not found', hi: 'नहीं मिला' },
  correct: { en: 'Correct', hi: 'सही' },
  incorrect: { en: 'Incorrect', hi: 'गलत' },
  notReached: { en: 'Not reached', hi: 'नहीं पहुँचे' },
}

const ITEMS = {
  earphones: { en: 'Bluetooth earphones', hi: 'ब्लूटूथ ईयरफ़ोन', short: { en: 'pair of earphones', hi: 'ईयरफ़ोन' }, price: 1499 },
  charger: { en: 'Fast charger 33W', hi: 'फ़ास्ट चार्जर 33W', short: { en: 'charger', hi: 'चार्जर' }, price: 899 },
  cable: { en: 'USB-C cable', hi: 'USB-C केबल', price: 299 },
  powerbank: { en: 'Power bank 10000mAh', hi: 'पावर बैंक 10000mAh', price: 1299 },
  cover: { en: 'Phone cover', hi: 'फ़ोन कवर', price: 249 },
  guard: { en: 'Screen guard', hi: 'स्क्रीन गार्ड', price: 199 },
  card: { en: 'Memory card 64GB', hi: 'मेमोरी कार्ड 64GB', price: 549 },
  watch: { en: 'Smartwatch', hi: 'स्मार्टवॉच', price: 2499 },
}
const PAY = { upi: { en: 'UPI', hi: 'UPI' }, cash: { en: 'Cash', hi: 'नकद' }, card: { en: 'Card', hi: 'कार्ड' } }
const STATUS = { delivered: { en: 'Sold', hi: 'बिका' }, returned: { en: 'Returned', hi: 'वापस' }, cancelled: { en: 'Cancelled', hi: 'रद्द' } }

const REPLIES = {
  t1: {
    calm: { en: "I'm sorry for the trouble. Let's sort this out. Could you share your bill or order number?", hi: 'परेशानी के लिए माफ़ी चाहते हैं। चलिए, इसे ठीक करते हैं। क्या आप बिल या ऑर्डर नंबर बता सकते हैं?' },
    defensive: { en: 'Sir, we only sell original products. You must have dropped it.', hi: 'सर, हम सिर्फ़ ओरिजिनल सामान बेचते हैं। आपसे गिर गया होगा।' },
    dismissive: { en: 'Returns are not my job. Go somewhere else.', hi: 'रिटर्न मेरा काम नहीं है। कहीं और जाइए।' },
  },
  t2: {
    calm: { en: 'Thank you. Let me check your order in our system.', hi: 'धन्यवाद। एक मिनट, सिस्टम में आपका ऑर्डर देखते हैं।' },
    defensive: { en: 'Okay, but it will take time. The system is slow.', hi: 'ठीक है, पर टाइम लगेगा। सिस्टम धीमा है।' },
    dismissive: { en: "Why didn't you keep the box? Just wait there.", hi: 'डिब्बा क्यों नहीं रखा? वहीं रुकिए।' },
  },
  t3: {
    calm: { en: 'I found your order. Let me explain what our return policy allows.', hi: 'आपका ऑर्डर मिल गया। हमारी रिटर्न पॉलिसी में क्या हो सकता है, वह बताते हैं।' },
    defensive: { en: 'Policy is policy, sir. I did not make the rules.', hi: 'पॉलिसी तो पॉलिसी है सर। नियम मैंने नहीं बनाए।' },
    dismissive: { en: 'Read the bill yourself. Everything is written there.', hi: 'बिल खुद पढ़ लीजिए। सब लिखा है।' },
  },
  t4: {
    calm: { en: 'Here is your receipt and the next steps. Thank you for your patience.', hi: 'यह रही आपकी रसीद और आगे की जानकारी। धैर्य रखने के लिए धन्यवाद।' },
    defensive: { en: "That's all we can do.", hi: 'हम इतना ही कर सकते हैं।' },
    dismissive: { en: 'Next customer, please.', hi: 'अगला ग्राहक!' },
  },
}
const DELTA = {
  t1: { calm: 35, defensive: -15, dismissive: -30 },
  t2: { calm: 20, defensive: -10, dismissive: -20 },
  t3: { calm: 20, defensive: -10, dismissive: -20 },
  t4: { calm: 15, defensive: -5, dismissive: -15 },
}
const RESOLUTION_SAY = {
  refund: { en: "I'll process a full refund for you.", hi: 'आपका पूरा पैसा वापस कर देते हैं।' },
  replace: { en: 'We will replace it with a new piece right now.', hi: 'अभी इसे नए पीस से बदल देते हैं।' },
  service: { en: 'Please visit the authorised service centre. It is covered under warranty. Here is the address.', hi: 'कृपया अधिकृत सर्विस सेंटर जाइए, यह वारंटी में ठीक होगा। यह रहा पता।' },
  refuse: { en: 'Sorry, we cannot do anything.', hi: 'माफ़ कीजिए, हम कुछ नहीं कर सकते।' },
}
const RESOLUTION_ICON = { refund: RotateCcw, replace: Repeat, service: Wrench, refuse: Ban }

const rand = (n) => Math.floor(Math.random() * n)
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const clampMood = (m) => Math.max(-100, Math.min(100, m))
const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), s)

function makeScenario() {
  const kind = Math.random() < 0.5 ? 'within' : 'after'
  const days = kind === 'within' ? 3 + rand(3) : 12
  const item = Math.random() < 0.5 ? 'earphones' : 'charger'
  const used = new Set()
  const newNo = (n) => {
    let v = n ?? 4100 + rand(5800)
    while (used.has(v)) v = 4100 + rand(5800)
    used.add(v)
    return v
  }
  const target = newNo()
  const s = String(target)
  let swapped = +(s.slice(0, 2) + s[3] + s[2])
  if (swapped === target || used.has(swapped)) swapped = target + 10
  newNo(swapped)
  const phone = String(1000 + rand(9000))
  const otherPhone = () => { let p; do { p = String(1000 + rand(9000)) } while (p === phone); return p }
  const nearPhone = () => { let p; do { p = phone.slice(0, 2) + String(rand(90) + 10) } while (p === phone); return p }
  const fillers = shuffle(['cable', 'powerbank', 'cover', 'guard', 'card', 'watch'])
  const pays = ['upi', 'cash', 'card']
  const orders = [
    { no: target, days, item, pay: 'upi', status: 'delivered', phone },
    { no: swapped, days: kind === 'within' ? days + 1 : days - 1, item: fillers[0], pay: 'cash', status: 'delivered', phone: otherPhone() },
    { no: newNo(), days: kind === 'within' ? 13 : 4, item, pay: 'card', status: 'delivered', phone: nearPhone() },
    { no: newNo(), days: 1, item: fillers[1], pay: pays[rand(3)], status: 'delivered', phone: otherPhone() },
    { no: newNo(), days: 2, item: fillers[2], pay: pays[rand(3)], status: 'cancelled', phone: otherPhone() },
    { no: newNo(), days: 6, item: fillers[3], pay: pays[rand(3)], status: 'delivered', phone: otherPhone() },
    { no: newNo(), days: 9, item: fillers[4], pay: pays[rand(3)], status: 'returned', phone: otherPhone() },
    { no: newNo(), days: 15, item: fillers[5], pay: pays[rand(3)], status: 'delivered', phone: otherPhone() },
  ]
    .map((o) => ({ ...o, id: `SR-${o.no}`, amount: ITEMS[o.item].price }))
    .sort((a, b) => a.days - b.days)
  return { kind, days, item, orderId: `SR-${target}`, phone, orders }
}

function customerLine(key, sc, ctx = {}) {
  const item = ITEMS[sc.item].short
  const lines = {
    c1: { en: `This ${item.en} I bought from your shop has stopped working! I want my money back, right now.`, hi: `आपकी दुकान से लिया यह ${item.hi} खराब हो गया है! मुझे अभी के अभी पैसे वापस चाहिए।` },
    c2calm: { en: 'Okay. My order number is {no}. My phone number ends with {ph}.', hi: 'ठीक है। मेरा ऑर्डर नंबर {no} है। फ़ोन नंबर के आखिरी अंक {ph} हैं।' },
    c2upset: { en: "Don't talk to me like that! Fine. Order number {no}, phone ends with {ph}.", hi: 'मुझसे ऐसे बात मत कीजिए! ठीक है। ऑर्डर नंबर {no}, फ़ोन के आखिरी अंक {ph}।' },
    c3ok: { en: 'Did you find it? What can you do for me?', hi: 'मिल गया? अब आप मेरे लिए क्या कर सकते हैं?' },
    c3upset: { en: 'I have been standing here for ages. What is the decision?', hi: 'कब से खड़ा हूँ। अब बताइए, क्या फ़ैसला है?' },
    r_within_refund: { en: 'Okay, a refund is fair. Thank you.', hi: 'ठीक है, पैसे वापस मिल रहे हैं तो ठीक है। धन्यवाद।' },
    r_within_replace: { en: 'A new one? Okay, that works for me.', hi: 'नया मिल जाएगा? ठीक है, चलेगा।' },
    r_after_service: { en: 'So I have to go to the service centre. But it will be repaired free under warranty, right? Okay.', hi: 'तो सर्विस सेंटर जाना पड़ेगा। पर वारंटी में मुफ़्त ठीक होगा न? ठीक है।' },
    r_within_service: { en: 'Why should I run to a service centre? I bought it only a few days ago!', hi: 'मैं सर्विस सेंटर के चक्कर क्यों लगाऊँ? कुछ ही दिन पहले तो खरीदा था!' },
    r_after_refund: { en: 'Really? Great, thanks!', hi: 'सच में? बढ़िया, धन्यवाद!' },
    r_after_replace: { en: 'Really? Great, thanks!', hi: 'सच में? बढ़िया, धन्यवाद!' },
    r_refuse: { en: 'This is unacceptable. I will complain to your manager.', hi: 'यह बिल्कुल गलत है। मैं आपके मैनेजर से शिकायत करूँगा।' },
    byeGood: { en: 'Thank you for your help.', hi: 'मदद के लिए धन्यवाद।' },
    byeMid: { en: 'Hmm. Okay.', hi: 'हम्म, ठीक है।' },
    byeBad: { en: 'I will not shop here again.', hi: 'अब यहाँ से कभी नहीं खरीदूँगा।' },
    left: { en: 'I cannot wait any longer. I am leaving!', hi: 'अब और इंतज़ार नहीं कर सकता। मैं जा रहा हूँ!' },
  }
  const line = lines[key]
  const vars = { no: sc.orderId, ph: sc.phone, ...ctx }
  return { en: fill(line.en, vars), hi: fill(line.hi, vars) }
}

function resolutionCorrect(kind, choice) {
  if (kind === 'within') return choice === 'refund' || choice === 'replace'
  return choice === 'service'
}
function resolutionDelta(kind, choice) {
  if (choice === 'refuse') return -30
  if (resolutionCorrect(kind, choice)) return kind === 'within' ? 35 : 30
  return kind === 'within' ? -15 : 15
}

const fmtDate = (days, lang) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
const fmtMoney = (n) => `₹${n.toLocaleString('en-IN')}`
const fmtClock = (ms) => {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function RetailSim({ lang = 'en', context, onComplete }) {
  const tx = (k) => L[k][lang]
  const [sc] = useState(makeScenario)
  const [order] = useState(() => ({ t1: shuffle(['calm', 'defensive', 'dismissive']), t2: shuffle(['calm', 'defensive', 'dismissive']), t3: shuffle(['calm', 'defensive', 'dismissive']), t4: shuffle(['calm', 'defensive', 'dismissive']) }))
  const [phase, setPhase] = useState('t1')
  const [mood, setMood] = useState(START_MOOD)
  const [lines, setLines] = useState(() => [{ who: 'c', text: customerLine('c1', sc) }])
  const [elapsed, setElapsed] = useState(0)
  const [counts, setCounts] = useState({ calm: 0, defensive: 0, dismissive: 0 })
  const [resolution, setResolution] = useState(null)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [posMsg, setPosMsg] = useState(null)
  const [lookup, setLookup] = useState({ found: false, time_ms: null, wrong_lookups: 0, searches: 0, empty_searches: 0, opened: 0 })

  const startRef = useRef(performance.now())
  const posStartRef = useRef(null)
  const logRef = useRef([])
  const doneRef = useRef(false)
  const transcriptRef = useRef(null)

  const ended = phase === 'closed' || phase === 'left'
  const remaining = Math.max(0, DURATION - elapsed)
  const now = () => Math.round(performance.now() - startRef.current)
  const log = (entry) => { logRef.current.push({ t_ms: now(), ...entry }) }

  useEffect(() => {
    if (ended) return
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 200)
    return () => clearInterval(id)
  }, [ended])

  useEffect(() => {
    if (ended || elapsed < DURATION) return
    setMood((m) => clampMood(m - 20))
    setLines((ls) => [...ls, { who: 'c', text: customerLine('left', sc) }])
    log({ phase, action: 'timeout' })
    setPhase('left')
  }, [elapsed, ended])

  useEffect(() => {
    if (phase === 'pos' && posStartRef.current === null) posStartRef.current = performance.now()
  }, [phase])

  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])

  const choose = (turn, kind) => {
    if (ended) return
    const next = clampMood(mood + DELTA[turn][kind])
    const add = [{ who: 'me', text: REPLIES[turn][kind], kind }]
    let nextPhase
    if (turn === 't1') {
      add.push({ who: 'c', text: customerLine(kind === 'calm' ? 'c2calm' : 'c2upset', sc) })
      nextPhase = 't2'
    } else if (turn === 't2') nextPhase = 'pos'
    else if (turn === 't3') nextPhase = 'resolve'
    else {
      add.push({ who: 'c', text: customerLine(next >= 20 ? 'byeGood' : next >= -20 ? 'byeMid' : 'byeBad', sc) })
      nextPhase = 'closed'
    }
    log({ phase: turn, action: 'reply', choice: kind, mood_before: mood, mood_after: next })
    setCounts((c) => ({ ...c, [kind]: c[kind] + 1 }))
    setMood(next)
    setLines((ls) => [...ls, ...add])
    setPhase(nextPhase)
  }

  const runSearch = (e) => {
    e.preventDefault()
    const q = query.trim().toUpperCase().replace(/\s+/g, '')
    if (!q) { setFilter(null); return }
    const digits = q.replace(/^SR-?/, '')
    const hits = sc.orders.filter((o) => o.id.includes(q) || String(o.no).includes(digits) || (digits.length === 4 && o.phone === digits))
    setFilter(hits.map((o) => o.id))
    setLookup((l) => ({ ...l, searches: l.searches + 1, empty_searches: l.empty_searches + (hits.length ? 0 : 1) }))
    log({ phase: 'pos', action: 'search', query: q, hits: hits.length })
  }

  const openOrder = (id) => {
    setOpenId(id)
    setPosMsg(null)
    setLookup((l) => ({ ...l, opened: l.opened + 1 }))
    log({ phase: 'pos', action: 'open', order: id })
  }

  const confirmOrder = () => {
    if (openId === sc.orderId) {
      const ms = Math.round(performance.now() - (posStartRef.current ?? performance.now()))
      setLookup((l) => ({ ...l, found: true, time_ms: ms }))
      log({ phase: 'pos', action: 'confirm', order: openId, correct: true, lookup_ms: ms })
      setLines((ls) => [...ls, { who: 'c', text: customerLine(mood >= -20 ? 'c3ok' : 'c3upset', sc) }])
      setPhase('t3')
    } else {
      setLookup((l) => ({ ...l, wrong_lookups: l.wrong_lookups + 1 }))
      log({ phase: 'pos', action: 'confirm', order: openId, correct: false })
      setPosMsg(tx('wrongOrder'))
    }
  }

  const resolve = (choice) => {
    if (ended) return
    const correct = resolutionCorrect(sc.kind, choice)
    const next = clampMood(mood + resolutionDelta(sc.kind, choice))
    const key = choice === 'refuse' ? 'r_refuse' : `r_${sc.kind}_${choice}`
    log({ phase: 'resolve', action: 'resolution', choice, correct, mood_before: mood, mood_after: next })
    setResolution({ choice, correct })
    setMood(next)
    setLines((ls) => [...ls, { who: 'me', text: RESOLUTION_SAY[choice] }, { who: 'c', text: customerLine(key, sc) }])
    setPhase('t4')
  }

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    const lookupScore = lookup.found ? Math.max(0, Math.min(1, 1 - lookup.wrong_lookups * 0.25)) : 0
    const resScore = resolution?.correct ? 1 : 0
    const moodScore = (mood + 100) / 200
    const accuracy = (resScore + lookupScore + moodScore) / 3
    const safety = Math.max(0, 1 - 0.25 * counts.dismissive)
    const telemetry = {
      sim: 'retail_customer_service',
      district: context?.districtName ?? null,
      scenario: { kind: sc.kind, days_since_purchase: sc.days, item: sc.item, order_id: sc.orderId, return_window_days: RETURN_DAYS },
      steps: logRef.current,
      choices: counts,
      lookup: { ...lookup, score: lookupScore },
      resolution: resolution ? { ...resolution } : { choice: null, correct: false },
      mood: { start: START_MOOD, final: mood },
      timed_out: phase === 'left',
      total_ms: Math.round(Math.min(DURATION, performance.now() - startRef.current)),
    }
    const lookupValue = lookup.found ? `${(lookup.time_ms / 1000).toFixed(1)} s` : tx('notFound')
    const resValue = resolution ? (resolution.correct ? tx('correct') : tx('incorrect')) : tx('notReached')
    onComplete?.({
      accuracy: Math.round(accuracy * 1000) / 1000,
      safety_score: safety,
      telemetry,
      indicators: [
        { en: 'De-escalation (final customer mood)', hi: 'गुस्सा शांत करना (ग्राहक का अंतिम मूड)', value: `${mood > 0 ? '+' : ''}${mood}`, good: mood >= 20 },
        { en: 'POS order lookup speed', hi: 'POS में ऑर्डर ढूँढने की गति', value: lookupValue, good: lookup.found && lookup.time_ms <= 30000 && lookup.wrong_lookups === 0 },
        { en: 'Resolution as per policy', hi: 'पॉलिसी के अनुसार समाधान', value: resValue, good: !!resolution?.correct },
        { en: 'Professional conduct', hi: 'पेशेवर व्यवहार', value: `${Math.round(safety * 100)}%`, good: counts.dismissive === 0 },
      ],
    })
  }

  const stepIndex = ended ? PHASES.length : PHASES.indexOf(phase)
  const instruction = phase === 'pos' ? tx('doPos') : phase === 'resolve' ? tx('doResolve') : phase === 'closed' ? tx('doClosed') : phase === 'left' ? tx('doLeft') : tx('doReply')
  const timePct = (remaining / DURATION) * 100
  const timeTone = remaining < 15000 ? 'err' : remaining < 30000 ? 'warn' : ''
  const visible = filter ? sc.orders.filter((o) => filter.includes(o.id)) : sc.orders
  const open = sc.orders.find((o) => o.id === openId)

  return (
    <div className="sim-retail">
      <div className="sim-retail-status">
        <div className="sim-retail-time">
          <div className="row between small">
            <span className="row muted"><Clock size={14} aria-hidden="true" />{tx('timeLeft')}</span>
            <strong className="mono">{fmtClock(remaining)}</strong>
          </div>
          <div className={`sim-retail-timebar ${timeTone}`} role="progressbar" aria-valuemin={0} aria-valuemax={90} aria-valuenow={Math.ceil(remaining / 1000)}>
            <span style={{ width: `${timePct}%` }} />
          </div>
        </div>
        <div className="sim-retail-mood">
          <div className="row between small">
            <span className="muted">{tx('mood')}</span>
            <strong className={`mono ${mood >= 0 ? 'sim-retail-pos' : 'sim-retail-neg'}`}>{mood > 0 ? '+' : ''}{mood}</strong>
          </div>
          <div className="sim-retail-moodtrack" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={mood} aria-label={tx('mood')}>
            <span className={mood < 0 ? 'neg' : 'pos'} style={mood < 0 ? { right: '50%', width: `${-mood / 2}%` } : { left: '50%', width: `${mood / 2}%` }} />
            <i />
          </div>
          <div className="row between tiny muted"><span>{tx('angry')}</span><span>{tx('satisfied')}</span></div>
        </div>
      </div>

      <div className="sim-retail-steps" aria-hidden="true">
        {PHASES.map((p, i) => <span key={p} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''} />)}
      </div>
      <p className="sim-retail-instr">
        {!ended && <span className="muted small">{tx('step')} {Math.min(stepIndex + 1, PHASES.length)} {tx('of')} {PHASES.length} · </span>}
        <strong>{instruction}</strong>
      </p>

      <div className="sim-retail-transcript" ref={transcriptRef} aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={`sim-retail-line ${l.who === 'c' ? 'cust' : 'me'}`}>
            <span className="sim-retail-who">{l.who === 'c' ? tx('customer') : tx('you')}</span>
            <p>{l.text[lang]}</p>
          </div>
        ))}
      </div>

      {['t1', 't2', 't3', 't4'].includes(phase) && (
        <div className="sim-retail-options">
          {order[phase].map((kind) => (
            <button key={kind} type="button" className="sim-retail-opt" onClick={() => choose(phase, kind)}>
              {REPLIES[phase][kind][lang]}
            </button>
          ))}
        </div>
      )}

      {phase === 'pos' && (
        <section className="sim-retail-pos" aria-label={tx('pos')}>
          <div className="sim-retail-poshead">
            <span className="row"><Store size={16} aria-hidden="true" /><strong>{tx('pos')}</strong></span>
            <span className="small">{tx('today')}: {fmtDate(0, lang)}</span>
          </div>
          <div className="sim-retail-posbody">
            <form className="sim-retail-search" onSubmit={runSearch}>
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx('searchPh')} aria-label={tx('searchPh')} />
              <button type="submit" className="btn primary"><Search size={16} aria-hidden="true" />{tx('search')}</button>
            </form>
            {filter && (
              <button type="button" className="link small" onClick={() => { setFilter(null); setQuery('') }}>{tx('showAll')}</button>
            )}
            <div className="table-wrap sim-retail-orders">
              <table className="table">
                <thead>
                  <tr>
                    <th>{tx('colOrder')}</th><th>{tx('colDate')}</th><th>{tx('colItem')}</th>
                    <th className="num">{tx('colAmount')}</th><th>{tx('colPay')}</th><th>{tx('colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr key={o.id} className={`clickable ${openId === o.id ? 'on' : ''}`} onClick={() => openOrder(o.id)}>
                      <td><button type="button" className="sim-retail-orderbtn mono" onClick={(e) => { e.stopPropagation(); openOrder(o.id) }}>{o.id}</button></td>
                      <td className="sim-retail-nowrap">{fmtDate(o.days, lang)}</td>
                      <td>{ITEMS[o.item][lang]}</td>
                      <td className="num">{fmtMoney(o.amount)}</td>
                      <td>{PAY[o.pay][lang]}</td>
                      <td>{STATUS[o.status][lang]}</td>
                    </tr>
                  ))}
                  {!visible.length && <tr><td colSpan={6} className="muted">{tx('noResults')}</td></tr>}
                </tbody>
              </table>
            </div>
            {!open && <p className="small muted">{tx('openHint')}</p>}
            {open && (
              <div className="sim-retail-detail">
                <div className="sim-retail-bill">
                  <div className="row"><ReceiptText size={16} aria-hidden="true" /><strong className="mono">{open.id}</strong></div>
                  <dl>
                    <dt>{tx('colDate')}</dt><dd>{fmtDate(open.days, lang)}</dd>
                    <dt>{tx('colItem')}</dt><dd>{ITEMS[open.item][lang]}</dd>
                    <dt>{tx('colAmount')}</dt><dd>{fmtMoney(open.amount)}</dd>
                    <dt>{tx('colPay')}</dt><dd>{PAY[open.pay][lang]}</dd>
                    <dt>{tx('phone')}</dt><dd className="mono">xxxxxx{open.phone}</dd>
                    <dt>{tx('colStatus')}</dt><dd>{STATUS[open.status][lang]}</dd>
                  </dl>
                  <button type="button" className="btn primary block" onClick={confirmOrder}><Check size={16} aria-hidden="true" />{tx('confirm')}</button>
                  {posMsg && <div className="note warn small"><CircleAlert size={16} aria-hidden="true" />{posMsg}</div>}
                </div>
                <PolicyPanel tx={tx} />
              </div>
            )}
          </div>
        </section>
      )}

      {phase === 'resolve' && (
        <div className="sim-retail-resolve">
          <PolicyPanel tx={tx} />
          <div className="sim-retail-bill small">
            <strong className="mono">{sc.orderId}</strong> · {fmtDate(sc.days, lang)} · {ITEMS[sc.item][lang]} · {tx('today')}: {fmtDate(0, lang)}
          </div>
          <div className="sim-retail-choices">
            {['refund', 'replace', 'service', 'refuse'].map((c) => {
              const Icon = RESOLUTION_ICON[c]
              return (
                <button key={c} type="button" className="sim-retail-choice" onClick={() => resolve(c)}>
                  <Icon size={18} aria-hidden="true" />{tx(`r_${c}`)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {ended && (
        <div className="row end">
          <button type="button" className="btn primary" onClick={finish}><Flag size={16} aria-hidden="true" />{tx('finish')}</button>
        </div>
      )}
    </div>
  )
}

function PolicyPanel({ tx }) {
  return (
    <div className="sim-retail-policy">
      <h4>{tx('policy')}</h4>
      <ul>
        <li>{tx('p1')}</li>
        <li>{tx('p2')}</li>
        <li>{tx('p3')}</li>
      </ul>
    </div>
  )
}
