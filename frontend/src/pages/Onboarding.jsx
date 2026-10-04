import { useEffect, useMemo, useState } from 'react'
import { api, storage } from '../lib/api'
import { pick, STRINGS, useLang, useT } from '../lib/i18n'
import { speak, stopSpeaking } from '../lib/speech'

const MEMBER_ICON = { learner: '🧑‍🎓', mother: '👩', father: '👨', guardian: '🧓' }
const WHO = {
  learner: { icon: '🧑‍🎓', en: 'Learner answers', hi: 'बच्चा जवाब दे' },
  parents: { icon: '👨‍👩', en: 'Parents answer', hi: 'माता-पिता जवाब दें' },
  family: { icon: '👨‍👩‍👧', en: 'Whole family answers', hi: 'पूरा परिवार जवाब दे' },
}
const STEP_KEY = 'saath.onboarding'

// Opening flow: hook → how it works (+ consent) → family profile → "journey begins" → quiz → result.
export default function Onboarding({ meta, onStart }) {
  const { lang } = useLang()
  const saved = useMemo(() => {
    try { return JSON.parse(storage.get(STEP_KEY) || 'null') } catch { return null }
  }, [])
  const [step, setStep] = useState(saved?.step && saved.step !== 'begin' ? saved.step : 'hook')
  const [profile, setProfile] = useState(saved?.profile || {
    members: ['learner'], learner_gender: 'x', learner_age: 17, district_id: '', schooling: '10', income_bracket: 'lt10',
  })
  const [answers, setAnswers] = useState(saved?.answers || [])
  const [questions, setQuestions] = useState(null)

  useEffect(() => { api.quiz().then(setQuestions) }, [])
  useEffect(() => { storage.set(STEP_KEY, JSON.stringify({ step, profile, answers })) }, [step, profile, answers])
  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [step])

  const go = (s) => { stopSpeaking(); setStep(s) }
  const start = async (trade_id) => {
    const res = await api.createSession({ ...profile, trade_id, language: lang, consent: true, quiz_answers: answers })
    storage.remove(STEP_KEY)
    onStart(res.session.id)
  }

  return (
    <div className={`onb onb-${step}`}>
      {step === 'hook' && <Hook onNext={() => go('how')} />}
      {step === 'how' && <How onBack={() => go('hook')} onNext={() => go('profile')} />}
      {step === 'profile' && <Profile meta={meta} profile={profile} setProfile={setProfile} onBack={() => go('how')} onNext={() => go('begin')} />}
      {step === 'begin' && <Begin profile={profile} onNext={() => go('quiz')} />}
      {step === 'quiz' && questions && (
        <Quiz meta={meta} questions={questions} profile={profile} answers={answers} setAnswers={setAnswers}
          onBack={() => go('profile')} onDone={() => go('result')} />
      )}
      {step === 'result' && questions && (
        <Result meta={meta} questions={questions} answers={answers} onBack={() => go('quiz')} onStart={start} />
      )}
    </div>
  )
}

function Hook({ onNext }) {
  const t = useT()
  const { lang } = useLang()
  const stories = STRINGS.hookStories[lang]
  return (
    <section className="stage hook">
      <div className="hook-stories">
        {stories.map(([name, rest], i) => (
          <p key={i} className="rise" style={{ '--d': `${0.2 + i * 0.5}s` }}>
            “<strong className={`hl hl-${i}`}>{name}</strong>{rest}”
          </p>
        ))}
      </div>
      <h1 className="hook-q rise" style={{ '--d': '1.8s' }}>{t('hookQuestion')}</h1>
      <div className="hook-sub rise" style={{ '--d': '2.1s' }}>{t('hookSub')}</div>
      <button className="btn cta rise" style={{ '--d': '2.4s' }} onClick={onNext}>{t('hookCta')} →</button>
      <div className="hook-note rise" style={{ '--d': '2.6s' }}>{t('hookNote')}</div>
    </section>
  )
}

function How({ onBack, onNext }) {
  const t = useT()
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const rows = STRINGS.howRows[lang]
  const points = STRINGS.consentPoints[lang]
  return (
    <section className="stage how">
      <TopNav onBack={onBack} />
      <h1 className="rise">{t('howTitle')}</h1>
      <div className="how-rows">
        {rows.map(([icon, title, sub], i) => (
          <div key={i} className={`how-row rise how-${i}`} style={{ '--d': `${0.15 + i * 0.15}s` }}>
            <span className="how-icon">{icon}</span>
            <div><div className="how-title">{title}</div><div className="how-sub">{sub}</div></div>
          </div>
        ))}
      </div>
      <div className="privacy rise" style={{ '--d': '0.7s' }}>
        <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>🔒 {t('privacyTitle')} {open ? '▴' : '▾'}</button>
        {open && <ul>{points.map((p) => <li key={p}>{p}</li>)}</ul>}
      </div>
      <div className="row gap center rise" style={{ '--d': '0.8s' }}>
        <button className="btn ghost" onClick={() => speak([t('howTitle'), ...rows.map((r) => `${r[1]}. ${r[2]}`), ...points].join('. '), lang)}>🔊 {t('readAloud')}</button>
        <button className="btn cta" onClick={onNext}>{t('agreeContinue')} →</button>
      </div>
    </section>
  )
}

function Profile({ meta, profile, setProfile, onBack, onNext }) {
  const t = useT()
  const { lang } = useLang()
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }))
  const toggleMember = (m) =>
    set('members', profile.members.includes(m) ? profile.members.filter((x) => x !== m) : [...profile.members, m])
  const states = [...new Set(meta.districts.map((d) => d.state))]
  const ready = profile.members.length > 0 && profile.district_id
  const age = profile.learner_age
  const ageMarks = [14, 18, 22, 26, 30]

  return (
    <section className="stage profile">
      <TopNav onBack={onBack} />
      <h1 className="rise">{t('profileTitle')}</h1>
      <div className="muted center rise">{t('profileSub')}</div>
      <div className="profile-card rise" style={{ '--d': '0.15s' }}>
        <fieldset>
          <legend>{t('whoIsHere')}</legend>
          <div className="chips big">
            {['learner', 'mother', 'father', 'guardian'].map((m) => (
              <button key={m} className={`chip ${profile.members.includes(m) ? 'on' : ''}`} onClick={() => toggleMember(m)} aria-pressed={profile.members.includes(m)}>
                <span className="chip-icon">{MEMBER_ICON[m]}</span>{t(m)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t('learnerIs')}</legend>
          <div className="chips">
            {[['m', 'son', '👦'], ['f', 'daughter', '👧'], ['x', 'preferNot', '🙂']].map(([v, k, icon]) => (
              <button key={v} className={`chip ${profile.learner_gender === v ? 'on' : ''}`} onClick={() => set('learner_gender', v)} aria-pressed={profile.learner_gender === v}>
                <span className="chip-icon">{icon}</span>{t(k)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t('learnerAge')}</legend>
          <div className="age">
            <button className="age-btn" onClick={() => set('learner_age', Math.max(14, age - 1))} aria-label="−">‹</button>
            <div className="age-value"><span>{age}</span><small>{t('years')}</small></div>
            <button className="age-btn" onClick={() => set('learner_age', Math.min(30, age + 1))} aria-label="+">›</button>
          </div>
          <input type="range" min="14" max="30" value={age} onChange={(e) => set('learner_age', Number(e.target.value))} className="age-range" aria-label={t('learnerAge')} />
          <div className="age-marks">{ageMarks.map((m) => <span key={m} className={m === age ? 'on' : ''}>{m}</span>)}</div>
        </fieldset>
        <fieldset>
          <legend>{t('district')}</legend>
          <select value={profile.district_id} onChange={(e) => set('district_id', e.target.value)} className="select big">
            <option value="">{t('chooseDistrict')}</option>
            {states.map((s) => (
              <optgroup key={s} label={lang === 'hi' ? meta.districts.find((d) => d.state === s).state_hi : s}>
                {meta.districts.filter((d) => d.state === s).map((d) => <option key={d.id} value={d.id}>{pick(d, lang)}</option>)}
              </optgroup>
            ))}
          </select>
        </fieldset>
        <div className="two-col">
          <fieldset>
            <legend>{t('schooling')}</legend>
            <div className="chips">
              {meta.schooling.map((s) => (
                <button key={s.id} className={`chip ${profile.schooling === s.id ? 'on' : ''}`} onClick={() => set('schooling', s.id)}>{s[lang]}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('income')}</legend>
            <div className="chips">
              {meta.income_brackets.map((s) => (
                <button key={s.id} className={`chip ${profile.income_bracket === s.id ? 'on' : ''}`} onClick={() => set('income_bracket', s.id)}>{s[lang]}</button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <button className="btn cta wide" disabled={!ready} onClick={onNext}>{ready ? `${t('continue')} →` : t('pickDistrictFirst')}</button>
    </section>
  )
}

function familyName(profile, t, lang) {
  const g = profile.learner_gender
  const learner = g === 'f' ? t('daughter') : g === 'm' ? t('son') : t('learner')
  const names = profile.members.map((m) => (m === 'learner' ? learner : t(m)))
  return names.join(lang === 'hi' ? ' और ' : ' and ')
}

function Begin({ profile, onNext }) {
  const t = useT()
  const { lang } = useLang()
  useEffect(() => {
    const id = setTimeout(onNext, 2200)
    return () => clearTimeout(id)
  }, [])
  return (
    <section className="stage begin" onClick={onNext}>
      <h1 className="rise">{t('journeyBegins')}</h1>
      <div className="welcome rise" style={{ '--d': '0.4s' }}>{t('welcome')}, <strong>{familyName(profile, t, lang)}</strong></div>
    </section>
  )
}

export function scoreAnswers(questions, answers) {
  const trades = {}
  const worries = {}
  let keen = null
  questions.forEach((q, i) => {
    const a = answers[i]
    if (a === undefined || a === null) return
    const opt = q.options[a]
    Object.entries(opt.trades || {}).forEach(([k, v]) => { trades[k] = (trades[k] || 0) + v })
    if (opt.concern) worries[opt.concern] = (worries[opt.concern] || 0) + (q.id === 'worry' ? 2 : 1)
    if (q.id === 'sure') keen = opt.keen
  })
  const total = Object.values(trades).reduce((a, b) => a + b, 0) || 1
  const matches = Object.entries(trades).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, s]) => ({ trade_id: id, score: Math.round((100 * s) / total) }))
  return { matches, worries: Object.entries(worries).sort((a, b) => b[1] - a[1]).map(([c]) => c), keen }
}

function Quiz({ meta, questions, profile, answers, setAnswers, onBack, onDone }) {
  const t = useT()
  const { lang } = useLang()
  const [i, setI] = useState(Math.min(answers.length, questions.length - 1))
  const [chosen, setChosen] = useState(null)
  const [readAloud, setReadAloud] = useState(storage.get('saath.quizspeak') === '1')
  const q = questions[i]
  const live = scoreAnswers(questions, answers)

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [i])
  useEffect(() => {
    if (readAloud) speak(`${q[lang]} ${q.options.map((o, n) => `${n + 1}. ${o[lang]}`).join('. ')}`, lang)
  }, [i, lang, readAloud])

  const choose = (n) => {
    if (chosen !== null) return
    setChosen(n)
    const next = [...answers]
    next[i] = n
    setTimeout(() => {
      setAnswers(next)
      setChosen(null)
      if (i + 1 < questions.length) setI(i + 1)
      else onDone()
    }, 320)
  }
  useEffect(() => {
    const onKey = (e) => {
      const n = Number(e.key)
      if (n >= 1 && n <= q.options.length) choose(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const back = () => (i === 0 ? onBack() : setI(i - 1))
  const toggleRead = () => {
    storage.set('saath.quizspeak', readAloud ? '0' : '1')
    if (readAloud) stopSpeaking()
    setReadAloud(!readAloud)
  }

  return (
    <section className="stage quiz">
      <div className="quiz-card" key={i}>
        <div className="quiz-top">
          <button className="round-btn" onClick={back} aria-label={t('back')}>‹</button>
          <span className="pill">{i + 1} / {questions.length}</span>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={i + 1}>
            <span style={{ width: `${((i + 1) / questions.length) * 100}%` }} />
          </div>
          <button className={`round-btn ${readAloud ? 'on' : ''}`} onClick={toggleRead} title={t('readQuestions')} aria-pressed={readAloud}>🔊</button>
        </div>
        <div className={`who-chip who-${q.who}`}>{WHO[q.who].icon} {WHO[q.who][lang]}</div>
        <div className="q-icon" aria-hidden>{q.icon}</div>
        <h2 className="q-text">{q[lang]}</h2>
        <div className="q-options">
          {q.options.map((o, n) => (
            <button key={n} className={`q-opt ${chosen === n ? 'picked' : ''} ${answers[i] === n && chosen === null ? 'prev' : ''}`}
              onClick={() => choose(n)} style={{ '--d': `${0.05 + n * 0.06}s` }}>
              <span className="q-opt-icon">{o.icon}</span>
              <span className="q-opt-text">{o[lang]}</span>
              <kbd>{n + 1}</kbd>
            </button>
          ))}
        </div>
        <button className="link skip" onClick={onDone}>{t('skipQuiz')}</button>
      </div>

      <aside className="live-panel" aria-live="polite">
        <div className="live-title">{t('familyPicture')}</div>
        <div className="live-family">
          {profile.members.map((m) => <span key={m} className="avatar" title={t(m)}>{MEMBER_ICON[m]}</span>)}
          <span className="muted">{pick(meta.districts.find((d) => d.id === profile.district_id), lang)}</span>
        </div>
        <div className="live-sec">{t('matchingWork')}</div>
        {live.matches.length === 0 && <div className="muted small">{t('answerToSee')}</div>}
        {live.matches.map((m) => {
          const tr = meta.trades.find((x) => x.id === m.trade_id)
          return (
            <div key={m.trade_id} className="match">
              <div className="match-row"><span>{tr.icon} {pick(tr, lang)}</span><strong>{m.score}%</strong></div>
              <div className="bar"><span style={{ width: `${m.score}%` }} /></div>
            </div>
          )
        })}
        <div className="live-sec">{t('worriesHeard')}</div>
        <div className="chips">
          {live.worries.length === 0 && <span className="muted small">—</span>}
          {live.worries.map((c) => <span key={c} className="worry pop">{meta.concerns[c].icon} {meta.concerns[c][lang]}</span>)}
        </div>
      </aside>
    </section>
  )
}

function Result({ meta, questions, answers, onBack, onStart }) {
  const t = useT()
  const { lang } = useLang()
  const r = scoreAnswers(questions, answers)
  const [trade, setTrade] = useState(r.matches[0]?.trade_id || '')
  const [all, setAll] = useState(r.matches.length === 0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const options = all ? meta.trades.map((x) => ({ trade_id: x.id, score: r.matches.find((m) => m.trade_id === x.id)?.score })) : r.matches
  const keenLabel = r.keen === null ? null : r.keen >= 0.5 ? 'keenVery' : r.keen >= 0 ? 'keenOpen' : r.keen >= -0.5 ? 'keenDoubt' : 'keenAgainst'

  const go = async () => {
    setBusy(true)
    setErr('')
    try { await onStart(trade || null) } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <section className="stage result">
      <TopNav onBack={onBack} />
      <h1 className="rise">{t('resultTitle')}</h1>
      <div className="muted center rise">{t('resultSub')}</div>
      <div className="result-grid rise" style={{ '--d': '0.15s' }}>
        {options.map((m, n) => {
          const tr = meta.trades.find((x) => x.id === m.trade_id)
          return (
            <button key={m.trade_id} className={`result-tile ${trade === m.trade_id ? 'on' : ''}`} onClick={() => setTrade(m.trade_id)} aria-pressed={trade === m.trade_id}>
              {n === 0 && !all && <span className="best">{t('bestMatch')}</span>}
              <span className="trade-icon">{tr.icon}</span>
              <span className="result-name">{pick(tr, lang)}</span>
              <small>{pick(tr, lang, 'sector')} · NSQF {tr.nsqf_level} · {tr.duration_months} {t('months')}</small>
              {m.score !== undefined && <span className="result-score">{m.score}% {t('match')}</span>}
            </button>
          )
        })}
      </div>
      {!all && <button className="link center-block" onClick={() => setAll(true)}>{t('seeAllWork')}</button>}
      {r.worries.length > 0 && (
        <div className="result-worries rise" style={{ '--d': '0.3s' }}>
          <div className="live-sec">{t('weWillTalk')}</div>
          <div className="chips center">{r.worries.map((c) => <span key={c} className="worry">{meta.concerns[c].icon} {meta.concerns[c][lang]}</span>)}</div>
        </div>
      )}
      {keenLabel && <div className="keen rise" style={{ '--d': '0.4s' }}>{t('familyFeels')}: <strong>{t(keenLabel)}</strong></div>}
      {err && <div className="alert">{err}</div>}
      <button className="btn cta wide" disabled={busy || !trade} onClick={go}>💬 {t('startTalking')}</button>
    </section>
  )
}

function TopNav({ onBack }) {
  const t = useT()
  return (
    <div className="stage-nav">
      <button className="link-btn" onClick={onBack}>← {t('back')}</button>
    </div>
  )
}
