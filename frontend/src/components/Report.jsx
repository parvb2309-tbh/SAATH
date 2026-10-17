import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, MessageCircle, Printer, Volume2, X } from 'lucide-react'
import { inr, useLang, useT } from '../lib/i18n'
import { speak, stopSpeaking } from '../lib/speech'
import { SourceLine } from './Cards'
import { TradeIcon } from './Icon'

const S = {
  reportTitle: { en: 'Parent Proof report', hi: 'माता-पिता के लिए सबूत रिपोर्ट' },
  reportFor: { en: '{trade} in {district}', hi: '{district} में {trade}' },
  coverNote: { en: '16 checks on this trade, built from official and centre records. Figures marked "demo" are illustrative in this prototype.', hi: 'इस ट्रेड की 16 जाँचें, सरकारी और सेंटर रिकॉर्ड से। "डेमो" लिखे आँकड़े इस प्रोटोटाइप में उदाहरण हैं।' },
  print: { en: 'Print / PDF', hi: 'प्रिंट / PDF' },
  share: { en: 'Copy share link', hi: 'शेयर लिंक कॉपी करें' },
  copied: { en: 'Link copied', hi: 'लिंक कॉपी हुआ' },
  whatsapp: { en: 'Send on WhatsApp', hi: 'व्हाट्सऐप पर भेजें' },
  listen: { en: 'Listen to summary', hi: 'सार सुनें' },
  stop: { en: 'Stop', hi: 'रोकें' },
  roles: { en: 'Typical jobs', hi: 'आम नौकरियाँ' },
  minimum: { en: 'Minimum', hi: 'कम से कम' },
  yourChild: { en: 'Learner now', hi: 'विद्यार्थी अभी' },
  eligible: { en: 'Eligible', hi: 'योग्य' },
  notYet: { en: 'Not yet — first step:', hi: 'अभी नहीं — पहला क़दम:' },
  hours: { en: 'hours of training', hi: 'घंटे की ट्रेनिंग' },
  nsqfExplain: { en: 'Recognised by NCVET. Each level up the framework means more advanced work and opens the next course.', hi: 'NCVET से मान्य। ढाँचे में हर ऊँचा स्तर ज़्यादा उन्नत काम और अगला कोर्स खोलता है।' },
  govtRoute: { en: 'Government / PMKVY route', hi: 'सरकारी / PMKVY रास्ता' },
  privateRoute: { en: 'Private institute', hi: 'निजी संस्थान' },
  free: { en: 'Free', hi: 'मुफ़्त' },
  noGovt: { en: 'No government centre for this trade in your district yet.', hi: 'आपके ज़िले में अभी इस ट्रेड का सरकारी सेंटर नहीं है।' },
  stipendYes: { en: 'Apprenticeship stipend available under NAPS.', hi: 'NAPS के तहत अप्रेंटिसशिप स्टाइपेंड मिलता है।' },
  centre: { en: 'Centre', hi: 'सेंटर' },
  distance: { en: 'Distance', hi: 'दूरी' },
  seats: { en: 'Seats', hi: 'सीटें' },
  hostel: { en: "Women's hostel", hi: 'महिला हॉस्टल' },
  placed: { en: 'Placed within 6 months', hi: '6 महीने में नौकरी' },
  local: { en: 'Found work in home state', hi: 'अपने राज्य में काम' },
  women: { en: 'Women in last batch', hi: 'पिछले बैच में महिलाएँ' },
  demand: { en: 'Interested students per seat', hi: 'हर सीट पर इच्छुक विद्यार्थी' },
  perMonthShort: { en: 'per month', hi: 'हर महीना' },
  capital: { en: 'Start-up money usually needed', hi: 'शुरुआत में आम तौर पर लगने वाला पैसा' },
  mudra: { en: 'MUDRA loans without collateral can cover this.', hi: 'बिना गारंटी का मुद्रा लोन इसमें मदद कर सकता है।' },
  course: { en: 'Course', hi: 'कोर्स' },
  firstJob: { en: 'First job', hi: 'पहली नौकरी' },
  growth: { en: 'With experience', hi: 'अनुभव के साथ' },
  further: { en: 'Further options', hi: 'आगे के रास्ते' },
  official: { en: 'Check it yourself', hi: 'ख़ुद जाँचें' },
  outcomeSrc: { en: 'Earnings and placement figures', hi: 'कमाई और नौकरी के आँकड़े' },
  noData: { en: 'No verified figure for this district yet.', hi: 'इस ज़िले का पक्का आँकड़ा अभी नहीं है।' },
}

export function ReportView({ report, shareToken }) {
  const t = useT(S)
  const { lang } = useLang()
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const sec = Object.fromEntries(report.sections.map((s) => [s.id, s.data]))
  const shareUrl = shareToken ? `${window.location.origin}/r/${shareToken}` : null
  const title = t('reportFor', { trade: report.trade.name, district: report.district.name })
  useEffect(() => {
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
  }, [report])

  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl) } catch { /* clipboard blocked */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const listen = () => {
    if (speaking) { stopSpeaking(); return setSpeaking(false) }
    const bands = sec.salary.bands
    const summary = [title, sec.scope.text, bands.length ? `${bands[0].label}: ${inr(bands[0].low)} – ${inr(bands[0].high)}` : '',
      ...sec.faq.items.map((f) => `${f.q} ${f.a}`)].join('. ')
    speak(summary, lang)
    setSpeaking(true)
  }

  return (
    <div className="report">
      <nav className="report-index" aria-label="Sections">
        {report.sections.map((s) => <a key={s.id} href={`#sec-${s.id}`}><b>{s.n}</b>{s.title}</a>)}
      </nav>
      <article className="report-doc">
        <header className="report-cover">
          <div className="row" style={{ marginBottom: 12 }}><TradeIcon trade={report.trade} teal /><span className="tag solid">NSQF {report.trade.nsqf_level}</span></div>
          <div className="small" style={{ color: 'var(--saffron)', fontWeight: 650 }}>{t('reportTitle')}</div>
          <h1>{title}</h1>
          <p>{t('coverNote')}</p>
          <div className="share-bar no-print">
            <button className="btn small" onClick={() => window.print()}><Printer size={14} />{t('print')}</button>
            <button className="btn small" onClick={listen}>{speaking ? <X size={14} /> : <Volume2 size={14} />}{speaking ? t('stop') : t('listen')}</button>
            {shareUrl && <button className="btn small" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t('copied') : t('share')}</button>}
            {shareUrl && <a className="btn small" href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${shareUrl}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} />{t('whatsapp')}</a>}
          </div>
        </header>
        {report.sections.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="report-sec">
            <div className="report-num">{String(s.n).padStart(2, '0')}</div>
            <div><h2>{s.title}</h2><SectionBody id={s.id} d={s.data} outcome={report.outcome} /></div>
          </section>
        ))}
      </article>
    </div>
  )
}

function Stat({ value, label }) {
  return <div className="stat"><span className="stat-value">{value}</span><span className="stat-label">{label}</span></div>
}

function SectionBody({ id, d, outcome }) {
  const t = useT(S)
  switch (id) {
    case 'scope':
      return <><p>{d.text}</p><p className="small muted"><strong>{t('roles')}:</strong> {d.roles}</p></>
    case 'competencies':
      return <ul>{d.items.map((x) => <li key={x}>{x}</li>)}</ul>
    case 'prerequisites':
      return (
        <div className="stack-1">
          <div className="row wrap"><span className="tag">{t('minimum')}: {d.min}</span>{d.learner && <span className="tag">{t('yourChild')}: {d.learner}</span>}
            {d.eligible === true && <span className="tag ok"><Check size={12} />{t('eligible')}</span>}</div>
          {d.eligible === false && <div className="note warn"><span><strong>{t('notYet')}</strong> {d.bridge}</span></div>}
        </div>
      )
    case 'duration':
      return <div className="grid-2"><Stat value={`${d.months} ${t('months')}`} label="" /><Stat value={d.hours.toLocaleString('en-IN')} label={t('hours')} /></div>
    case 'nsqf':
      return <><div className="row"><span className="stat-value">NSQF {d.level}</span></div><p className="small">{d.qualification}</p><p className="small muted">{t('nsqfExplain')}</p></>
    case 'fees':
      return (
        <div className="stack-1">
          <div className="grid-2">
            <Stat value={d.govt_available ? (d.govt === 0 ? t('free') : inr(d.govt)) : '—'} label={t('govtRoute')} />
            <Stat value={inr(d.private)} label={t('privateRoute')} />
          </div>
          {!d.govt_available && <div className="note warn"><span>{t('noGovt')}</span></div>}
          <span className="tag demo">{t('demoData')}</span>
        </div>
      )
    case 'assistance':
      return (
        <div className="stack-1">
          {d.stipend && <div className="note ok"><span>{t('stipendYes')}</span></div>}
          {d.schemes.map((s) => (
            <div key={s.id} className="card scheme"><div className="strong">{s.name}</div><p>{s.text}</p>
              {s.link && <a className="row small" href={s.link} target="_blank" rel="noreferrer">{s.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}<ExternalLink size={12} /></a>}</div>
          ))}
        </div>
      )
    case 'accreditation':
      return d.centres.length ? (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>{t('centre')}</th><th className="num">{t('distance')}</th><th className="num">{t('seats')}</th><th>{t('hostel')}</th></tr></thead>
          <tbody>{d.centres.map((c) => (
            <tr key={c.name}><td>{c.name} <span className="tag">{c.kind}</span></td><td className="num">{c.distance_km} {t('km')}</td><td className="num">{c.capacity}</td><td>{c.women_hostel ? <Check size={14} color="var(--success)" /> : '—'}</td></tr>
          ))}</tbody>
        </table><span className="tag demo">{t('demoData')}</span></div>
      ) : <div className="note warn"><span>{t('noGovt')}</span></div>
    case 'hiring':
      return d.placement_pct !== undefined ? (
        <div className="stack-1">
          <div className="grid-4">
            <Stat value={`${d.placement_pct}%`} label={t('placed')} />
            <Stat value={`${d.local_pct}%`} label={t('local')} />
            <Stat value={`${d.women_pct}%`} label={t('women')} />
            <Stat value={d.seats ? (d.interested / d.seats).toFixed(2) : '—'} label={t('demand')} />
          </div>
          <SourceLine meta={outcome} />
        </div>
      ) : <p className="muted">{t('noData')}</p>
    case 'salary': {
      if (!d.bands.length) return <p className="muted">{t('noData')}</p>
      const max = Math.max(...d.bands.map((b) => b.high))
      return (
        <div>
          {d.bands.map((b) => (
            <div key={b.label} className="band">
              <span className="small strong">{b.label}</span>
              <div className="band-bar"><span style={{ left: `${(100 * b.low) / max}%`, width: `${(100 * (b.high - b.low)) / max}%` }} /></div>
              <strong>{inr(b.low)}–{inr(b.high)} <span className="tiny muted">{t('perMonthShort')}</span></strong>
            </div>
          ))}
          <SourceLine meta={outcome} />
        </div>
      )
    }
    case 'self_employment':
      return <><Stat value={`${inr(d.capital_low)} – ${inr(d.capital_high)}`} label={t('capital')} />{d.mudra && <p className="small mt-1">{t('mudra')}</p>}<span className="tag demo">{t('demoData')}</span></>
    case 'progression':
      return (
        <ol className="stepper" style={{ marginTop: 8 }}>
          {[[t('course'), d.course], [t('firstJob'), d.first_job], [t('growth'), d.growth]].map(([h, x], i) => (
            <li key={h} className="stage done"><span className="stage-dot">{i + 1}</span><div className="stage-body" style={{ paddingBottom: 12 }}><h3 style={{ margin: '0 0 2px' }}>{h}</h3><p style={{ margin: 0 }}>{x}</p></div></li>
          ))}
          <li className="stage"><span className="stage-dot">4</span><div className="stage-body" style={{ paddingBottom: 0 }}><h3 style={{ margin: '0 0 2px' }}>{t('further')}</h3><ul>{d.next.map((x) => <li key={x}>{x}</li>)}</ul></div></li>
        </ol>
      )
    case 'safety':
    case 'lateral':
      return <ul>{d.items.map((x) => <li key={x}>{x}</li>)}</ul>
    case 'faq':
      return <dl className="faq">{d.items.map((f) => <div key={f.q}><dt>{f.q}</dt><dd>{f.a}</dd></div>)}</dl>
    case 'sources':
      return (
        <div className="stack-1">
          <div className="section-title">{t('official')}</div>
          <ul>{d.official.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></li>)}</ul>
          {d.outcome && <><div className="section-title mt-1">{t('outcomeSrc')}</div><SourceLine meta={d.outcome} /></>}
        </div>
      )
    default:
      return null
  }
}
