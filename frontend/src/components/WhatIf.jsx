import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { inr, pick, useLang, useT } from '../lib/i18n'
import { SourceLine } from './Cards'
import { ErrorNote, Loading } from './Shell'

export const OPTION_COLORS = { A: '#657386', B: '#087F8C', C: '#C9821F' }
const S = {
  A: { en: 'A · Conventional', hi: 'A · पारंपरिक' },
  Asub: { en: 'Class 11–12, then a 3-year BA', hi: '11वीं–12वीं, फिर 3 साल का बीए' },
  B: { en: 'B · ITI + apprenticeship', hi: 'B · आईटीआई + अप्रेंटिसशिप' },
  Bsub: { en: '2-year ITI, 1-year paid NAPS apprenticeship, then work', hi: '2 साल आईटीआई, 1 साल वेतन वाली अप्रेंटिसशिप, फिर काम' },
  C: { en: 'C · Short course + diploma', hi: 'C · छोटा कोर्स + डिप्लोमा' },
  Csub: { en: '6-month PMKVY course, work, part-time diploma', hi: '6 महीने का PMKVY कोर्स, काम, साथ में डिप्लोमा' },
  net5: { en: 'Net after 5 years', hi: '5 साल बाद कुल बचत' },
  firstIncome: { en: 'First income in year {y}', hi: 'पहली कमाई साल {y} में' },
  noIncome: { en: 'No income within 5 years', hi: '5 साल में कोई कमाई नहीं' },
  cost: { en: 'Fees paid', hi: 'दी गई फ़ीस' },
  forgone: { en: 'Earnings given up while studying', hi: 'पढ़ाई के दौरान छोड़ी गई कमाई' },
  chartTitle: { en: 'Money in hand, year by year', hi: 'हाथ में पैसा, साल दर साल' },
  chartSub: { en: 'Earnings and stipends minus fees, added up. Below zero means the family is still paying.', hi: 'कमाई और स्टाइपेंड में से फ़ीस घटाकर जोड़ा गया। शून्य से नीचे मतलब परिवार अभी ख़र्च कर रहा है।' },
  year: { en: 'Year', hi: 'साल' },
  details: { en: 'Year-by-year details', hi: 'साल दर साल ब्योरा' },
  direct: { en: 'Fees', hi: 'फ़ीस' },
  stipend: { en: 'Stipend', hi: 'स्टाइपेंड' },
  earnings: { en: 'Earnings', hi: 'कमाई' },
  net: { en: 'Net', hi: 'शुद्ध' },
  total: { en: 'Running total', hi: 'कुल' },
  assumptions: { en: 'Change the assumptions', hi: 'मान्यताएँ बदलें' },
  wageBand: { en: 'Which earnings to assume', hi: 'कौन-सी कमाई मानें' },
  low: { en: 'Lower', hi: 'कम' },
  mid: { en: 'Typical', hi: 'आम' },
  high: { en: 'Higher', hi: 'ज़्यादा' },
  ba_fee: { en: 'BA fee per year', hi: 'बीए की सालाना फ़ीस' },
  iti_fee: { en: 'ITI fee per year', hi: 'आईटीआई की सालाना फ़ीस' },
  diploma_fee: { en: 'Part-time diploma fee per year', hi: 'डिप्लोमा की सालाना फ़ीस' },
  naps_stipend: { en: 'Apprenticeship stipend per month', hi: 'अप्रेंटिसशिप स्टाइपेंड, हर महीना' },
  trade: { en: 'Trade', hi: 'ट्रेड' },
  earningsFrom: { en: 'Trade earnings from the outcome record', hi: 'ट्रेड की कमाई रिकॉर्ड से' },
  otherAssume: { en: 'Fees, stipend and the BA route are editable demo estimates.', hi: 'फ़ीस, स्टाइपेंड और बीए का रास्ता बदलने लायक डेमो अनुमान हैं।' },
  unavailable: { en: 'No outcome record for this trade in your area yet.', hi: 'इस ट्रेड का आपके इलाक़े का रिकॉर्ड अभी नहीं है।' },
}
const SLIDERS = [['ba_fee', 0, 40000, 1000], ['iti_fee', 0, 20000, 500], ['diploma_fee', 0, 40000, 1000], ['naps_stipend', 5000, 15000, 500]]

function Tip({ active, payload, label }) {
  const t = useT(S)
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{t('year')} {label}</div>
      {payload.map((p) => <div key={p.dataKey}><span className="swatch" style={{ background: p.color }} />{p.dataKey}: <strong>{inr(p.value)}</strong></div>)}
    </div>
  )
}

export default function WhatIf({ fetcher, initialTrade }) {
  const t = useT(S)
  const { lang, meta } = useLang()
  const [trade, setTrade] = useState(initialTrade || 'electrician')
  const [params, setParams] = useState({ band: 'mid' })
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState('B')
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetcher({ trade, ...params }).then((d) => { setData(d); setErr('') }).catch((e) => setErr(e.message))
    }, 180)
    return () => clearTimeout(timer.current)
  }, [trade, params, lang])

  if (err) return <ErrorNote error={err} />
  if (!data) return <Loading />
  const a = data.assumptions || params
  const chart = data.available ? [0, 1, 2, 3, 4, 5].map((y) => ({
    year: y, ...Object.fromEntries(data.options.map((o) => [o.id, y === 0 ? 0 : o.rows[y - 1].cumulative])),
  })) : []
  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  return (
    <div className="stack">
      <div className="row wrap">
        <label className="field" style={{ minWidth: 240 }}><span>{t('trade')}</span>
          <select className="select" value={trade} onChange={(e) => setTrade(e.target.value)}>
            {meta.trades.map((x) => <option key={x.id} value={x.id}>{pick(x, lang)}</option>)}
          </select>
        </label>
      </div>
      {!data.available ? <div className="note warn"><span>{t('unavailable')}</span></div> : (
        <>
          <div className="options-3">
            {data.options.map((o) => (
              <div key={o.id} className="option" style={{ '--c': OPTION_COLORS[o.id] }}>
                <h3>{t(o.id)}</h3>
                <p className="small muted">{t(`${o.id}sub`)}</p>
                <div className="stat"><span className="stat-value">{inr(o.net_5y)}</span><span className="stat-label">{t('net5')}</span></div>
                <div className="small mt-1">{o.first_income_year ? t('firstIncome', { y: o.first_income_year }) : t('noIncome')}</div>
                <div className="small muted">{t('cost')}: {inr(o.total_cost)} · {t('forgone')}: {inr(o.total_opportunity)}</div>
              </div>
            ))}
          </div>

          <section className="panel">
            <div className="panel-head"><div><h3>{t('chartTitle')}</h3><p className="small muted">{t('chartSub')}</p></div></div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chart} margin={{ left: 8, right: 16, top: 8 }}>
                <CartesianGrid vertical={false} stroke="#e9edf2" />
                <XAxis dataKey="year" tickFormatter={(y) => `${t('year')} ${y}`} tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: '#657386' }} axisLine={false} tickLine={false} width={44} />
                <ReferenceLine y={0} stroke="#182230" strokeWidth={1} />
                <Tooltip content={<Tip />} />
                <Legend formatter={(v) => t(v)} iconType="plainline" />
                {data.options.map((o) => (
                  <Line key={o.id} dataKey={o.id} stroke={OPTION_COLORS[o.id]} strokeWidth={o.id === open ? 3 : 2} dot={{ r: 3 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </section>

          <div className="split">
            <section className="panel">
              <div className="panel-head"><h3>{t('details')}</h3>
                <div className="seg">{data.options.map((o) => <button key={o.id} className={open === o.id ? 'on' : ''} onClick={() => setOpen(o.id)}>{o.id}</button>)}</div>
              </div>
              <div className="table-wrap"><table className="table">
                <thead><tr><th>{t('year')}</th><th className="num">{t('direct')}</th><th className="num">{t('stipend')}</th><th className="num">{t('earnings')}</th><th className="num">{t('net')}</th><th className="num">{t('total')}</th></tr></thead>
                <tbody>{data.options.find((o) => o.id === open).rows.map((r) => (
                  <tr key={r.year}><td>{r.year}</td><td className="num">{r.direct_cost ? inr(-r.direct_cost) : '—'}</td><td className="num">{r.stipend ? inr(r.stipend) : '—'}</td>
                    <td className="num">{r.earnings ? inr(r.earnings) : '—'}</td><td className="num">{inr(r.net)}</td>
                    <td className="num"><strong style={{ color: r.cumulative < 0 ? 'var(--error)' : 'var(--navy)' }}>{inr(r.cumulative)}</strong></td></tr>
                ))}</tbody>
              </table></div>
            </section>
            <section className="panel stack">
              <h3>{t('assumptions')}</h3>
              <div className="field"><span>{t('wageBand')}</span>
                <div className="seg">{['low', 'mid', 'high'].map((b) => <button key={b} className={a.band === b ? 'on' : ''} onClick={() => set('band', b)}>{t(b)}</button>)}</div>
              </div>
              {SLIDERS.map(([k, min, max, step]) => (
                <div key={k} className="range-row">
                  <span className="label small">{t(k)}</span><span className="val small">{inr(params[k] ?? a[k])}</span>
                  <input type="range" min={min} max={max} step={step} value={params[k] ?? a[k]} onChange={(e) => set(k, Number(e.target.value))} aria-label={t(k)} />
                </div>
              ))}
              <div className="small muted">{t('earningsFrom')}:</div>
              <SourceLine meta={data.source} />
              <div className="tiny muted">{t('otherAssume')}</div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
