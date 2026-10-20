import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText, FlaskConical, Quote, Volume2, X } from 'lucide-react'
import { inr, useLang, useT } from '../lib/i18n'
import { speak, stopSpeaking } from '../lib/speech'
import { SourceLine } from './Cards'
import Icon from './Icon'
import StoryScene from './StoryScene'

const S = {
  kicker: { en: 'Someone like you', hi: 'आप जैसा कोई' },
  likeYou: { en: 'Like you', hi: 'आपकी तरह' },
  now: { en: 'Now', hi: 'अब' },
  startedShe: { en: 'Where she started', hi: 'कहाँ से शुरुआत की' },
  startedHe: { en: 'Where he started', hi: 'कहाँ से शुरुआत की' },
  worry: { en: 'The family worry', hi: 'परिवार की चिंता' },
  didShe: { en: 'What she did', hi: 'उसने क्या किया' },
  didHe: { en: 'What he did', hi: 'उसने क्या किया' },
  thenNow: { en: 'Then and now', hi: 'तब और अब' },
  before: { en: 'Before', hi: 'पहले' },
  inSchool: { en: 'Studying, not earning', hi: 'पढ़ाई, कोई कमाई नहीं' },
  year1: { en: 'First year in the trade', hi: 'काम का पहला साल' },
  year3: { en: 'After three years', hi: 'तीन साल बाद' },
  perMonth: { en: 'a month', hi: 'हर महीना' },
  bandNote: { en: 'Typical monthly pay for this trade in {d}, from the outcome records.', hi: '{d} में इस काम की आम मासिक कमाई, रिकॉर्ड से।' },
  placed: { en: '{p}% of the last batch found a job within 6 months', hi: 'पिछले बैच में {p}% को 6 महीने में नौकरी मिली' },
  schemes: { en: 'Help used on the way', hi: 'रास्ते में मिली मदद' },
  trySim: { en: 'Try what {n} did', hi: 'वही करके देखें जो {n} ने किया' },
  report: { en: 'Proof report', hi: 'सबूत रिपोर्ट' },
  listen: { en: 'Listen', hi: 'सुनें' },
  stop: { en: 'Stop', hi: 'रोकें' },
  persona: { en: 'Illustrative story', hi: 'उदाहरण कहानी' },
}

export default function StoryInfographic({ story, simLinks = true, reportBase = '/student/report' }) {
  const t = useT(S)
  const { lang } = useLang()
  const [speaking, setSpeaking] = useState(false)
  const she = story.gender === 'f'
  const o = story.outcome
  const max = o ? o.year3[1] : 1
  const listen = () => {
    if (speaking) { stopSpeaking(); return setSpeaking(false) }
    speak([`${story.name}, ${story.district.name}.`, story.start, ...story.steps.map((s) => `${s.title}. ${s.text}`),
      `${t('now')}: ${story.now}.`, story.quote].join(' '), lang)
    setSpeaking(true)
  }

  return (
    <article className="story">
      <header className="story-hero">
        <StoryScene trade={story.trade.id} gender={story.gender} seedKey={story.id} className="story-hero-art" />
        <div className="story-hero-text">
          <div className="story-kicker">{t('kicker')}</div>
          <h2>{story.name}, {story.age}</h2>
          <div className="story-place">{story.district.name}, {story.district.state} · {story.education}</div>
          <div className="story-now"><span>{t('now')}</span>{story.now}</div>
          <div className="row wrap">
            <span className="tag solid-light"><Icon name={story.trade.icon} size={12} />{story.trade.name}</span>
            <span className="tag solid-light">NSQF {story.trade.nsqf_level}</span>
          </div>
          {story.matches.length > 0 && (
            <div className="story-matches">
              <span>{t('likeYou')}:</span>
              {story.matches.map((m) => <span key={m} className="story-chip">{m}</span>)}
            </div>
          )}
        </div>
      </header>

      <div className="story-body">
        <section className="story-start">
          <div>
            <div className="section-title">{t(she ? 'startedShe' : 'startedHe')}</div>
            <p className="story-lead">{story.start}</p>
          </div>
          <div className="story-worry">
            <span className="story-worry-ico"><Icon name={story.worry.icon} size={20} /></span>
            <div><div className="section-title">{t('worry')}</div><strong>{story.worry.label}</strong></div>
          </div>
        </section>

        <section>
          <div className="section-title">{t(she ? 'didShe' : 'didHe')}</div>
          <ol className="story-steps">
            {story.steps.map((s, i) => (
              <li key={s.title}>
                <span className="story-step-num">{i + 1}</span>
                <span className="story-step-ico"><Icon name={s.icon} size={20} /></span>
                <strong>{s.title}</strong>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="story-split">
          <section className="story-then-now">
            <div className="section-title">{t('thenNow')}</div>
            <div className="story-bars">
              <div className="story-bar-row">
                <span>{t('before')}</span>
                <div className="story-bar"><i style={{ width: '2%' }} /></div>
                <strong>{t('inSchool')}</strong>
              </div>
              {o && [['year1', o.year1], ['year3', o.year3]].map(([k, [lo, hi]]) => (
                <div key={k} className="story-bar-row">
                  <span>{t(k)}</span>
                  <div className="story-bar"><i style={{ width: `${(100 * hi) / max}%` }} /><b style={{ width: `${(100 * lo) / max}%` }} /></div>
                  <strong>{inr(lo)}–{inr(hi)} <small>{t('perMonth')}</small></strong>
                </div>
              ))}
            </div>
            {o && <p className="tiny muted">{t('bandNote', { d: o.meta.district })}{o.placement_pct ? ` ${t('placed', { p: o.placement_pct })}.` : ''}</p>}
            {o && <SourceLine meta={o.meta} />}
          </section>
          <figure className="story-quote">
            <Quote size={22} aria-hidden />
            <blockquote>{story.quote}</blockquote>
            <figcaption>{story.quote_by}</figcaption>
          </figure>
        </div>

        <footer className="story-foot">
          {story.schemes.length > 0 && (
            <div className="row wrap">
              <span className="section-title" style={{ margin: 0 }}>{t('schemes')}:</span>
              {story.schemes.map((s) => <a key={s.id} className="tag ok" href={s.link} target="_blank" rel="noreferrer">{s.name}</a>)}
            </div>
          )}
          <div className="row wrap">
            {simLinks && story.trade.sim && (
              <Link className="btn primary" to={`/student/lab/${story.trade.sim}`}><FlaskConical size={16} />{t('trySim', { n: story.name })}</Link>
            )}
            <Link className="btn" to={reportBase === '/student/report' ? `${reportBase}/${story.trade.id}` : reportBase}><FileText size={16} />{t('report')}</Link>
            <button className="btn ghost" onClick={listen}>{speaking ? <X size={16} /> : <Volume2 size={16} />}{speaking ? t('stop') : t('listen')}</button>
            <span className="tag demo">{t('persona')}</span>
          </div>
        </footer>
      </div>
    </article>
  )
}

export function StoryCard({ story, active, onOpen }) {
  const t = useT(S)
  return (
    <button className={`story-card ${active ? 'on' : ''}`} onClick={onOpen} aria-pressed={active}>
      <StoryScene trade={story.trade.id} gender={story.gender} seedKey={story.id} />
      <div className="story-card-body">
        <strong>{story.name}, {story.age} · {story.district.name}</strong>
        <span className="small">{story.now}</span>
        <span className="row wrap">
          <span className="tag"><Icon name={story.trade.icon} size={12} />{story.trade.name}</span>
          {story.matches.length > 0 && <span className="tag teal">{t('likeYou')}: {story.matches.length}</span>}
        </span>
      </div>
      <ArrowRight size={16} className="story-card-go" aria-hidden />
    </button>
  )
}
