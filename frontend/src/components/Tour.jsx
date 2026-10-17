import { useEffect, useLayoutEffect, useState } from 'react'
import { useT } from '../lib/i18n'

// Coach marks: highlights one [data-tour] element at a time with a short note. steps: [{ target, title, text }]
export default function Tour({ steps, onClose }) {
  const t = useT({
    skip: { en: 'Skip tour', hi: 'टूर छोड़ें' },
    finish: { en: 'Got it', hi: 'समझ गया' },
    of: { en: '{n} of {m}', hi: '{m} में से {n}' },
  })
  const [i, setI] = useState(0)
  const [box, setBox] = useState(null)
  const step = steps[i]

  useLayoutEffect(() => {
    const find = () => [...document.querySelectorAll(`[data-tour="${step.target}"]`)].find((el) => el.offsetParent !== null)
    const place = () => {
      const el = find()
      setBox(el ? el.getBoundingClientRect() : null)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [step.target])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const last = i === steps.length - 1
  const pad = 4
  const cardTop = box ? Math.min(window.innerHeight - 200, box.bottom + 12 > window.innerHeight - 200 ? box.top - 190 : box.bottom + 12) : 120
  const cardLeft = box ? Math.max(16, Math.min(window.innerWidth - 356, box.left)) : 16
  return (
    <>
      {box && <div className="coach-ring" style={{ top: box.top - pad, left: box.left - pad, width: box.width + 2 * pad, height: box.height + 2 * pad }} />}
      <div className="coach" role="dialog" aria-live="polite" style={{ top: Math.max(64, cardTop), left: cardLeft }}>
        <div className="tiny" style={{ color: 'var(--saffron)', fontWeight: 650 }}>{t('of', { n: i + 1, m: steps.length })}</div>
        <h4>{step.title}</h4>
        <p>{step.text}</p>
        <div className="row between">
          <button className="btn ghost small" style={{ color: '#d3dde8' }} onClick={onClose}>{t('skip')}</button>
          <button className="btn accent small" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? t('finish') : t('next')}</button>
        </div>
      </div>
    </>
  )
}
