import { useEffect, useRef, useState } from 'react'
import { BookOpen, CalendarCheck, LifeBuoy, Phone, ShieldAlert, Volume2, VolumeX, X } from 'lucide-react'
import { api, storage } from '../lib/api'
import { useLang, useT } from '../lib/i18n'
import { speak, stopSpeaking } from '../lib/speech'
import Cards from './Cards'
import EngineBadge from './EngineBadge'
import Icon from './Icon'
import MicButton from './MicButton'

const S = {
  l1Title: { en: 'Feeling stuck between choices?', hi: 'विकल्पों में उलझे हुए हैं?' },
  l1Text: { en: 'A counsellor can help you compare options in a short session.', hi: 'काउंसलर एक छोटे सत्र में विकल्पों की तुलना में मदद कर सकते हैं।' },
  supportTitle: { en: 'Would you like to talk to a person?', hi: 'क्या आप किसी इंसान से बात करना चाहेंगे?' },
  supportText: {
    en: 'It sounds like a lot right now. A trained counsellor from your institution can call you. They will see a short summary of this chat and your Career DNA, only if you agree.',
    hi: 'अभी बहुत कुछ एक साथ लग रहा है। आपकी संस्था के प्रशिक्षित काउंसलर आपको फ़ोन कर सकते हैं। आपकी अनुमति हो तभी वे इस बातचीत का सार और आपका करियर DNA देखेंगे।',
  },
  yesConnect: { en: 'Yes, connect me', hi: 'हाँ, जोड़ दीजिए' },
  notNow: { en: 'Not now', hi: 'अभी नहीं' },
  referralMade: { en: 'Priority referral created. A counsellor will reach you within 24 hours.', hi: 'प्राथमिकता रेफ़रल बन गया। काउंसलर 24 घंटे में संपर्क करेंगे।' },
  haltedTitle: { en: 'Career chat is paused for your safety', hi: 'आपकी सुरक्षा के लिए करियर चैट रोकी गई है' },
  haltedText: { en: "Please talk to someone now. These calls are free. Our safeguarding desk has been alerted and will follow up.", hi: 'कृपया अभी किसी से बात करें। ये कॉल मुफ़्त हैं। हमारी सुरक्षा टीम को सूचना दी गई है और वे संपर्क करेंगे।' },
  emergency: { en: 'Emergency', hi: 'आपातकाल' },
  openCase: { en: 'A counsellor has your request', hi: 'काउंसलर के पास आपका अनुरोध है' },
}

export default function Chat({ sessionId, speaker, pathwayHref, quick = true }) {
  const t = useT(S)
  const { lang, meta } = useLang()
  const [data, setData] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(storage.get('udaan.autospeak') === '1')
  const [risk, setRisk] = useState(null)
  const [modal, setModal] = useState(null) // 'book' | 'support'
  const endRef = useRef(null)

  const load = async () => setData(await api.session(sessionId))
  useEffect(() => { load() }, [sessionId, lang])
  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [data?.messages.length, busy])

  if (!data) return <div className="panel chat"><div className="loading">…</div></div>
  const { session, messages, escalation } = data
  const halted = Boolean(session.halted)

  const send = async (msg) => {
    const clean = msg.trim()
    if (!clean || busy) return
    setBusy(true)
    setErr('')
    setText('')
    const pending = { id: `p${Date.now()}`, role: 'user', speaker, text: clean, pending: true }
    setData((d) => ({ ...d, messages: [...d.messages, pending] }))
    try {
      const r = await api.send(sessionId, { text: clean, speaker, lang })
      setData((d) => ({
        ...d,
        session: { ...d.session, halted: r.risk?.halted ? 1 : d.session.halted },
        messages: [...d.messages.filter((m) => m.id !== pending.id), r.user, r.assistant],
        escalation: r.escalation ?? d.escalation,
      }))
      setRisk(r.risk)
      if (r.risk?.level === 2 && r.risk.needs_consent) setModal('support')
      if (autoSpeak) speak(r.assistant.text, lang)
    } catch (e) {
      setErr(e.message)
      setData((d) => ({ ...d, messages: d.messages.filter((m) => m.id !== pending.id) }))
      setText(clean)
    } finally {
      setBusy(false)
    }
  }
  const toggleAuto = () => {
    storage.set('udaan.autospeak', autoSpeak ? '0' : '1')
    if (autoSpeak) stopSpeaking()
    setAutoSpeak(!autoSpeak)
  }
  const asks = [...meta.objections, 'course_info'].filter((c) => meta.concerns[c][`ask_${lang}`])

  return (
    <section className="panel chat">
      <div className="chat-head">
        <div className="row"><strong style={{ color: 'var(--navy)' }}>{t('saathName')}</strong><span className="small muted">· {lang === 'hi' ? 'आपकी करियर साथी' : 'your career companion'}</span></div>
        <div className="row">
          {!halted && !escalation && <button className="btn small" onClick={() => setModal('book')}><CalendarCheck size={14} />{t('talkToCounsellor')}</button>}
          <button className={`icon-btn ${autoSpeak ? 'on' : ''}`} onClick={toggleAuto} aria-pressed={autoSpeak} title={t('autoSpeak')}>
            {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      {risk?.level === 1 && !escalation && !halted && (
        <div className="risk-banner l1">
          <div><strong>{t('l1Title')}</strong><div className="small">{t('l1Text')}</div></div>
          <button className="btn small primary" onClick={() => setModal('book')}><CalendarCheck size={14} />{t('talkToCounsellor')}</button>
        </div>
      )}
      {escalation && !halted && (
        <div className="risk-banner l2"><div className="row"><LifeBuoy size={16} /><strong>{t('openCase')}</strong></div>
          <span className="small muted">{escalation.phone ? `${escalation.phone}` : ''}</span></div>
      )}

      <div className="messages" aria-live="polite">
        {messages.map((m) => <Message key={m.id} m={m} pathwayHref={pathwayHref} />)}
        {busy && <div className="msg bot typing"><div className="bubble">{t('thinkingDots')}</div></div>}
        <div ref={endRef} />
      </div>

      {halted ? <Halted /> : (
        <>
          {quick && (
            <div className="quick">
              <div className="section-title">{t('commonWorries')}</div>
              <div className="quick-grid">
                {asks.map((c) => (
                  <button key={c} className="quick-btn" disabled={busy} onClick={() => send(meta.concerns[c][`ask_${lang}`])}>
                    <Icon name={meta.concerns[c].icon} size={14} />{meta.concerns[c][`ask_${lang}`]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {err && <div className="alert" style={{ margin: '8px 16px' }}>{err}</div>}
          <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text) }}>
            <MicButton lang={lang} disabled={busy} onPartial={setText} onText={(x) => send(x)} onError={setErr} />
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('typeHere')} aria-label={t('typeHere')} />
            <button className="btn primary" disabled={busy || !text.trim()}>{t('send')}</button>
          </form>
        </>
      )}
      {modal === 'book' && <BookModal sessionId={sessionId} onClose={() => setModal(null)} onDone={() => { setModal(null); load() }} />}
      {modal === 'support' && <SupportModal sessionId={sessionId} onClose={() => setModal(null)} onDone={() => { setModal(null); load() }} />}
    </section>
  )
}

function Message({ m, pathwayHref }) {
  const t = useT()
  const { lang } = useLang()
  const bot = m.role === 'assistant'
  if (m.engine === 'quiz' || !m.text) return null
  return (
    <div className={`msg ${bot ? 'bot' : 'user'} ${m.pending ? 'pending' : ''}`}>
      <div className="who">{bot ? `${t('saathName')}` : t(m.speaker)}</div>
      <div className="bubble">
        {m.text}
        {bot && (
          <button className="icon-btn play" onClick={() => speak(m.text, m.lang || lang)} aria-label={t('readAloud')} title={t('readAloud')}>
            <Volume2 size={14} />
          </button>
        )}
      </div>
      {bot && <Cards cards={m.cards} pathwayHref={pathwayHref} />}
      {bot && m.sources?.length > 0 && (
        <div className="sources">
          <BookOpen size={12} aria-hidden />{t('sourcesUsed')}:
          {m.sources.map((s) => s.url
            ? <a key={s.id} className="tag" href={s.url} target="_blank" rel="noreferrer" title={s.source}>{s.title}</a>
            : <span key={s.id} className="tag">{s.title}</span>)}
        </div>
      )}
      {bot && m.engine && !['template', 'offline'].includes(m.engine) && <EngineBadge engine={m.engine} compact />}
    </div>
  )
}

function Halted() {
  const t = useT(S)
  const lines = [['Tele-MANAS', '14416'], ['KIRAN', '1800-599-0019'], [t('emergency'), '112']]
  return (
    <div className="halted">
      <div className="row" style={{ justifyContent: 'center' }}><ShieldAlert size={20} color="var(--error)" /><h3 style={{ margin: 0 }}>{t('haltedTitle')}</h3></div>
      <p className="small">{t('haltedText')}</p>
      <div className="helplines">
        {lines.map(([n, num]) => (
          <a key={num} className="helpline-row" href={`tel:${num.replace(/\D/g, '')}`}>
            <strong>{n}</strong><span className="row strong" style={{ color: 'var(--error)' }}><Phone size={16} />{num}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function SupportModal({ sessionId, onClose, onDone }) {
  const t = useT(S)
  const [phone, setPhone] = useState('')
  const [made, setMade] = useState(false)
  const yes = async () => {
    await api.referral(sessionId, { consent: true, phone })
    setMade(true)
    setTimeout(onDone, 1600)
  }
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <div className="modal">
        <button className="icon-btn modal-close" onClick={onClose} aria-label={t('close')}><X size={16} /></button>
        <h3 id="support-title">{t('supportTitle')}</h3>
        {made ? <div className="note ok">{t('referralMade')}</div> : (
          <>
            <p>{t('supportText')}</p>
            <label className="field"><span>{t('phone')}</span><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <div className="card helpline"><a className="helpline-number" href="tel:14416"><Phone size={16} />Tele-MANAS 14416</a></div>
            <div className="row end"><button className="btn ghost" onClick={onClose}>{t('notNow')}</button><button className="btn primary" onClick={yes}>{t('yesConnect')}</button></div>
          </>
        )}
      </div>
    </div>
  )
}

function BookModal({ sessionId, onClose, onDone }) {
  const t = useT(S)
  const [form, setForm] = useState({ phone: '', callback_time: '', note: '' })
  const [sent, setSent] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    await api.escalate(sessionId, form)
    setSent(true)
    setTimeout(onDone, 1200)
  }
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="book-title">
      <form className="modal" onSubmit={submit}>
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label={t('cancel')}><X size={16} /></button>
        <h3 id="book-title">{t('talkToCounsellor')}</h3>
        {sent ? <div className="note ok">{t('callRequested')}</div> : (
          <>
            <label className="field"><span>{t('phone')}</span><input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field"><span>{t('callbackTime')}</span><input className="input" value={form.callback_time} onChange={(e) => setForm({ ...form, callback_time: e.target.value })} /></label>
            <label className="field"><span>{t('note')}</span><textarea className="input" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            <div className="row end"><button type="button" className="btn ghost" onClick={onClose}>{t('cancel')}</button><button className="btn primary">{t('requestCall')}</button></div>
          </>
        )}
      </form>
    </div>
  )
}
