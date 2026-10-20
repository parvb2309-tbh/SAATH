import { useEffect, useState } from 'react'
import { Check, Copy, Lock, MessageCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { useLang, useT } from '../../lib/i18n'
import { useSession } from '../../lib/session'
import { ConsensusBoard, PriorityScales } from '../../components/Consensus'
import { Loading, PageHead } from '../../components/Shell'

const S = {
  title: { en: 'Family Space', hi: 'फ़ैमिली स्पेस' },
  sub: { en: 'Link a parent, choose what they can see, and build a plan you both agree on.', hi: 'माता-पिता को जोड़ें, तय करें वे क्या देखें, और मिलकर योजना बनाएँ।' },
  code: { en: 'Your family code', hi: 'आपका फ़ैमिली कोड' },
  codeHelp: { en: 'Your parent enters this code in their UDAAN app to link with you.', hi: 'माता-पिता अपने उड़ान ऐप में यह कोड डालकर आपसे जुड़ते हैं।' },
  copy: { en: 'Copy', hi: 'कॉपी' },
  copied: { en: 'Copied', hi: 'कॉपी हुआ' },
  sendWa: { en: 'Send on WhatsApp', hi: 'व्हाट्सऐप पर भेजें' },
  waText: { en: 'Join me on UDAAN to plan my career together. Our family code is {code}.', hi: 'मेरे करियर की योजना साथ बनाने के लिए उड़ान पर जुड़िए। हमारा फ़ैमिली कोड है {code}।' },
  linkedWith: { en: 'Linked with {who}', hi: '{who} से जुड़े हुए' },
  waiting: { en: 'Waiting for your parent to link', hi: 'माता-पिता के जुड़ने का इंतज़ार' },
  canSee: { en: 'What your parent can see', hi: 'माता-पिता क्या देख सकते हैं' },
  p_chosen_trade: { en: 'The trade you chose', hi: 'आपका चुना ट्रेड' },
  p_dna: { en: 'Your Career DNA and top matches', hi: 'आपका करियर DNA और सबसे अच्छे मेल' },
  p_simulations: { en: 'Your simulation results', hi: 'आपके सिमुलेशन के नतीजे' },
  p_pathway: { en: 'Your pathway stage', hi: 'आपके रास्ते का चरण' },
  never: { en: 'Never shared: your private notes and your chats with UDAAN.', hi: 'कभी साझा नहीं: आपके निजी नोट्स और उड़ान से बातचीत।' },
  consensusTitle: { en: 'Family Consensus Builder', hi: 'परिवार की सहमति' },
  consensusSub: { en: 'Rate how much each thing matters to you. Your parent rates the same list separately; you see where you agree and what to check.', hi: 'हर बात आपके लिए कितनी ज़रूरी है, बताइए। माता-पिता अलग से यही सूची भरते हैं; फिर दिखता है कहाँ सहमति है और क्या जाँचना है।' },
  notes: { en: 'Private notes (only you can see these)', hi: 'निजी नोट्स (सिर्फ़ आप देख सकते हैं)' },
  save: { en: 'Save my answers', hi: 'मेरे जवाब सेव करें' },
  saved: { en: 'Saved', hi: 'सेव हुआ' },
  waitingParent: { en: 'Your answers are saved. The plan appears when your parent answers too.', hi: 'आपके जवाब सेव हैं। माता-पिता के जवाब देने पर योजना दिखेगी।' },
  planAccepted: { en: 'Your family accepted this plan.', hi: 'आपके परिवार ने यह योजना मान ली है।' },
}
const PERMS = ['chosen_trade', 'dna', 'simulations', 'pathway']

export default function FamilySpace() {
  const t = useT(S)
  const { lang } = useLang()
  const { me } = useSession()
  const [f, setF] = useState(null)
  const [answers, setAnswers] = useState({})
  const [notes, setNotes] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    api.family().then((d) => { setF(d); setAnswers(d.my_answers || {}); setNotes(d.private_notes) })
  }, [lang])
  if (!f) return <Loading />
  const link = f.link
  const copy = async () => {
    try { await navigator.clipboard.writeText(link.code) } catch { /* blocked */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const togglePerm = async (k) => setF(await api.setPermissions({ ...link.permissions, [k]: !link.permissions[k] }))
  const save = async () => { setF(await api.studentConsensus({ answers, private_notes: notes })); setSaved(true) }

  return (
    <>
      <PageHead title={t('title')} sub={t('sub')} />
      <div className="split mb">
        <section className="panel">
          <div className="section-title">{t('code')}</div>
          <div className="row wrap">
            <span className="mono" style={{ fontSize: 34, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--navy)' }}>{link.code}</span>
            <button className="btn small" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t('copied') : t('copy')}</button>
            <a className="btn small" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(t('waText', { code: link.code }))}`}><MessageCircle size={14} />{t('sendWa')}</a>
          </div>
          <p className="small muted">{t('codeHelp')}</p>
          {link.status === 'linked'
            ? <div className="note ok"><Check size={16} /><span>{t('linkedWith', { who: link.parent?.name || t(link.parent?.relation || 'guardian') })}</span></div>
            : <div className="note warn"><span>{t('waiting')}</span></div>}
        </section>
        <section className="panel">
          <h3>{t('canSee')}</h3>
          {PERMS.map((k) => (
            <label key={k} className="toggle">
              <input type="checkbox" checked={!!link.permissions[k]} onChange={() => togglePerm(k)} />
              <span className="track" aria-hidden /><span className="small">{t(`p_${k}`)}</span>
            </label>
          ))}
          <div className="row small muted mt-1"><Lock size={14} />{t('never')}</div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head"><div><h2>{t('consensusTitle')}</h2><p className="muted small">{t('consensusSub')}</p></div></div>
        {f.plan ? (
          <>
            {f.completed && <div className="note ok mb"><Check size={16} /><span>{t('planAccepted')}</span></div>}
            <ConsensusBoard plan={f.plan} reportHref={me.profile?.chosen_trade ? `/student/report/${me.profile.chosen_trade}` : null} />
          </>
        ) : (
          <div className="stack">
            <PriorityScales priorities={f.priorities} value={answers} onChange={(v) => { setSaved(false); setAnswers(v) }} />
            <label className="field"><span className="row"><Lock size={14} />{t('notes')}</span>
              <textarea className="input" rows={3} value={notes} onChange={(e) => { setSaved(false); setNotes(e.target.value) }} /></label>
            <div className="row"><button className="btn primary" disabled={Object.keys(answers).length < f.priorities.length || saved} onClick={save}>{saved ? t('saved') : t('save')}</button></div>
            {f.my_answers && !f.parent_answered && <div className="note"><span>{t('waitingParent')}</span></div>}
          </div>
        )}
      </section>
    </>
  )
}
