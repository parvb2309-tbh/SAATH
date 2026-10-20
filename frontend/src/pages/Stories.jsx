import { useEffect, useState } from 'react'
import { useLang, useT } from '../lib/i18n'
import { ErrorNote, Loading, PageHead } from '../components/Shell'
import StoryInfographic, { StoryCard } from '../components/StoryInfographic'

const S = {
  title: { en: 'Career stories', hi: 'करियर कहानियाँ' },
  subStudent: { en: 'Learners who started where you are, what they did, and where they are now.', hi: 'जो आपकी जगह से शुरू हुए, उन्होंने क्या किया, और आज कहाँ हैं।' },
  subParent: { en: 'Families like yours, the worry they had, and how their child got started.', hi: 'आप जैसे परिवार, उनकी चिंता, और उनके बच्चे ने कैसे शुरुआत की।' },
  more: { en: 'More stories', hi: 'और कहानियाँ' },
  all: { en: 'All trades', hi: 'सभी ट्रेड' },
}

// fetcher: api.studentStories or api.parentStories
export default function Stories({ fetcher, audience = 'student' }) {
  const t = useT(S)
  const { lang } = useLang()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  const [trade, setTrade] = useState('all')
  useEffect(() => { fetcher().then((d) => { setData(d); setOpen((o) => o ?? d.stories[0]?.id) }).catch((e) => setErr(e.message)) }, [lang])
  if (err) return <ErrorNote error={err} />
  if (!data) return <Loading />
  const featured = data.stories.find((s) => s.id === open) || data.stories[0]
  const trades = [...new Map(data.stories.map((s) => [s.trade.id, s.trade])).values()]
  const others = data.stories.filter((s) => trade === 'all' || s.trade.id === trade)
  const choose = (id) => { setOpen(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return (
    <>
      <PageHead title={t('title')} sub={t(audience === 'parent' ? 'subParent' : 'subStudent')} />
      <StoryInfographic story={featured} simLinks={audience === 'student'}
        reportBase={audience === 'parent' ? '/parent/report' : '/student/report'} />
      <div className="panel-head mt">
        <h3 style={{ margin: 0 }}>{t('more')}</h3>
        <select className="select" style={{ width: 'auto', minWidth: 200 }} value={trade} onChange={(e) => setTrade(e.target.value)} aria-label={t('all')}>
          <option value="all">{t('all')}</option>
          {trades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      <div className="story-grid">
        {others.map((s) => <StoryCard key={s.id} story={s} active={s.id === featured.id} onOpen={() => choose(s.id)} />)}
      </div>
    </>
  )
}
