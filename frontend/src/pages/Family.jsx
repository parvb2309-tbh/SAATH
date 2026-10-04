import { useEffect, useRef, useState } from 'react'
import { api, storage } from '../lib/api'
import { pick, useLang, useT } from '../lib/i18n'
import { speak, stopSpeaking } from '../lib/speech'
import Cards from '../components/Cards'
import EngineBadge from '../components/EngineBadge'
import MicButton from '../components/MicButton'
import SeedhiLadder from '../components/SeedhiLadder'
import Onboarding from './Onboarding'

const MEMBER_ICON = { learner: '🧑‍🎓', mother: '👩', father: '👨', guardian: '🧓' }
const SESSION_KEY = 'saath.session'

export default function Family({ meta }) {
  const [sessionId, setSessionId] = useState(storage.get(SESSION_KEY))

  const begin = (id) => {
    storage.set(SESSION_KEY, id)
    setSessionId(id)
  }
  const reset = () => {
    stopSpeaking()
    storage.remove(SESSION_KEY)
    setSessionId(null)
  }

  if (sessionId) return <Chat meta={meta} sessionId={sessionId} onReset={reset} />
  return <Onboarding meta={meta} onStart={begin} />
}

function Chat({ meta, sessionId, onReset }) {
  const t = useT()
  const { lang } = useLang()
  const [data, setData] = useState(null)
  const [pathway, setPathway] = useState(null)
  const [speaker, setSpeaker] = useState('learner')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(storage.get('saath.autospeak') !== '0')
  const [showCall, setShowCall] = useState(false)
  const endRef = useRef(null)

  const load = async () => {
    try {
      const d = await api.session(sessionId)
      setData(d)
      setSpeaker((s) => (d.session.members.includes(s) ? s : d.session.members.find((m) => m !== 'learner') || d.session.members[0]))
      setPathway(await api.pathway(sessionId))
    } catch {
      onReset()
    }
  }
  useEffect(() => { load() }, [sessionId])

  // keep the session language in step with the header toggle
  useEffect(() => {
    if (data && data.session.language !== lang) {
      api.patchSession(sessionId, { language: lang }).then((d) => {
        setData(d)
        api.pathway(sessionId).then(setPathway)
      })
    }
  }, [lang, data?.session.language])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [data?.messages.length, busy])

  if (!data) return <div className="loading">…</div>
  const { session, messages, escalation, updates } = data
  const district = meta.districts.find((d) => d.id === session.district_id)
  const trade = meta.trades.find((x) => x.id === session.trade_id)

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
        messages: [...d.messages.filter((m) => m.id !== pending.id), r.user, r.assistant],
        escalation: r.escalation ?? d.escalation,
      }))
      if (r.escalation?.new) setShowCall(true)
      if (autoSpeak) speak(r.assistant.text, lang)
    } catch (e) {
      setErr(e.message)
      setData((d) => ({ ...d, messages: d.messages.filter((m) => m.id !== pending.id) }))
      setText(clean)
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (status) => setData(await api.patchSession(sessionId, { status }))
  const changeTrade = async (trade_id) => {
    setData(await api.patchSession(sessionId, { trade_id }))
    setPathway(await api.pathway(sessionId))
  }
  const toggleAuto = () => {
    storage.set('saath.autospeak', autoSpeak ? '0' : '1')
    if (autoSpeak) stopSpeaking()
    setAutoSpeak(!autoSpeak)
  }

  const quick = [...meta.objections, 'course_info', 'human_request']

  return (
    <div className="chat-layout">
      <section className="chat panel">
        <div className="chat-head">
          <div className="speaker-pick">
            <span>{t('speaking')}</span>
            {session.members.map((m) => (
              <button key={m} className={`chip ${speaker === m ? 'on' : ''}`} onClick={() => setSpeaker(m)}>
                <span className="chip-icon">{MEMBER_ICON[m]}</span>{t(m)}
              </button>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" checked={autoSpeak} onChange={toggleAuto} /> 🔊 {t('autoSpeak')}
          </label>
        </div>

        {escalation && (
          <EscalationBanner sessionId={sessionId} escalation={escalation} open={showCall}
            setOpen={setShowCall} onDone={load} />
        )}

        <div className="messages" aria-live="polite">
          {messages.map((m) => (
            <Message key={m.id} m={m} />
          ))}
          {busy && <div className="msg bot typing"><div className="bubble">{t('thinkingDots')}</div></div>}
          <div ref={endRef} />
        </div>

        <div className="quick">
          <div className="quick-title">{t('commonWorries')}</div>
          <div className="quick-grid">
            {quick.map((c) => (
              <button key={c} className="quick-btn" disabled={busy}
                onClick={() => (c === 'human_request' ? setShowCall(true) : send(meta.concerns[c][`ask_${lang}`]))}>
                <span className="quick-icon">{meta.concerns[c].icon}</span>
                <span>{meta.concerns[c][`ask_${lang}`]}</span>
              </button>
            ))}
          </div>
        </div>

        {err && <div className="alert">{err}</div>}
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text) }}>
          <MicButton lang={lang} disabled={busy} onPartial={setText} onText={(x) => send(x)} onError={setErr} />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('typeHere')} aria-label={t('typeHere')} />
          <button className="btn primary" disabled={busy || !text.trim()}>{t('send')}</button>
        </form>
      </section>

      <aside className="side">
        <section className="panel family">
          <div className="row between">
            <h3>{t('familyCard')}</h3>
            <button className="btn ghost small" onClick={onReset}>↺ {t('newSession')}</button>
          </div>
          <div className="family-line">{session.members.map((m) => `${MEMBER_ICON[m]} ${t(m)}`).join('  ·  ')}</div>
          <div className="family-line">📍 {pick(district, lang)}, {lang === 'hi' ? district?.state_hi : district?.state}</div>
          <div className="family-line trade-line">
            <span>{trade ? `${trade.icon} ${pick(trade, lang)}` : '—'}</span>
            <select value={session.trade_id || ''} onChange={(e) => changeTrade(e.target.value)} aria-label={t('changeTrade')}>
              <option value="" disabled>{t('changeTrade')}</option>
              {meta.trades.map((x) => <option key={x.id} value={x.id}>{x.icon} {pick(x, lang)}</option>)}
            </select>
          </div>
          <button className="btn counsel" onClick={() => setShowCall(true)}>🙋 {t('talkToCounsellor')}</button>
        </section>

        <SeedhiLadder data={pathway} />

        <section className="panel decision">
          <h3>{t('decisionTitle')}</h3>
          <div className="decision-btns">
            {[['interested', '👍'], ['thinking', '🤔'], ['not_interested', '✋']].map(([s, icon]) => (
              <button key={s} className={`btn decision-${s} ${session.status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>
                {icon} {t(s === 'not_interested' ? 'notInterested' : s)}
              </button>
            ))}
          </div>
        </section>

        {updates?.length > 0 && (
          <section className="panel updates">
            <h3>📣 {t('updatesTitle')}</h3>
            {updates.map((u) => (
              <div key={u.id} className="update">
                <p>{lang === 'hi' ? u.text_hi : u.text_en}</p>
                <button className="btn ghost small" onClick={() => speak(lang === 'hi' ? u.text_hi : u.text_en, lang)}>🔊</button>
              </div>
            ))}
          </section>
        )}
      </aside>
      {showCall && !escalation && (
        <CallModal sessionId={sessionId} onClose={() => setShowCall(false)} onDone={() => { setShowCall(false); load() }} />
      )}
    </div>
  )
}

function Message({ m }) {
  const t = useT()
  const { lang } = useLang()
  const bot = m.role === 'assistant'
  if (m.engine === 'quiz') {
    const lines = m.text.split('\n').slice(1)
    return (
      <details className="quiz-record">
        <summary>👨‍👩‍👧 {t('quizAnswers')} ({lines.length})</summary>
        <ul>{lines.map((l) => <li key={l}>{l.replace(/^• /, '')}</li>)}</ul>
      </details>
    )
  }
  return (
    <div className={`msg ${bot ? 'bot' : 'user'} ${m.pending ? 'pending' : ''}`}>
      <div className="who">
        {bot ? 'साथ · SAATH' : `${MEMBER_ICON[m.speaker] ?? ''} ${t(m.speaker)}`}
      </div>
      <div className="bubble">
        {m.text}
        {bot && (
          <button className="play" onClick={() => speak(m.text, m.lang || lang)} aria-label={t('readAloud')} title={t('readAloud')}>🔊</button>
        )}
      </div>
      {bot && <Cards cards={m.cards} />}
      {bot && m.engine && m.engine !== 'template' && <EngineBadge engine={m.engine} compact />}
    </div>
  )
}

function EscalationBanner({ sessionId, escalation, open, setOpen, onDone }) {
  const t = useT()
  return (
    <div className="escalation-banner">
      <div>
        <strong>🙋 {t('escalatedTitle')}</strong>
        <div className="muted">{escalation.reason_local || escalation.reason}</div>
        {escalation.phone && <div className="muted">📞 {escalation.phone} {escalation.callback_time && `· ${escalation.callback_time}`}</div>}
      </div>
      {!escalation.phone && <button className="btn small" onClick={() => setOpen(true)}>{t('requestCall')}</button>}
      {open && !escalation.phone && <CallModal sessionId={sessionId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onDone() }} />}
    </div>
  )
}

function CallModal({ sessionId, onClose, onDone }) {
  const t = useT()
  const [form, setForm] = useState({ phone: '', callback_time: '', note: '' })
  const [sent, setSent] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    await api.escalate(sessionId, form)
    setSent(true)
    setTimeout(onDone, 1200)
  }
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('cancel')}>×</button>
        <h3>🙋 {t('talkToCounsellor')}</h3>
        {sent ? <p className="ok">✅ {t('callRequested')}</p> : (
          <>
            <label>{t('phone')}<input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>{t('callbackTime')}<input value={form.callback_time} onChange={(e) => setForm({ ...form, callback_time: e.target.value })} /></label>
            <label>{t('note')}<textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            <div className="row gap">
              <button type="button" className="btn ghost" onClick={onClose}>{t('cancel')}</button>
              <button className="btn primary">{t('requestCall')}</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
