import { useRef, useState } from 'react'
import { canListenInBrowser, canRecord, listen, stopSpeaking } from '../lib/speech'
import { useT } from '../lib/i18n'

export default function MicButton({ lang, onPartial, onText, onError, disabled }) {
  const t = useT()
  const [active, setActive] = useState(false)
  const ctl = useRef(null)
  const supported = canListenInBrowser || canRecord

  const toggle = async () => {
    if (active) {
      ctl.current?.stop()
      return
    }
    stopSpeaking()
    setActive(true)
    ctl.current = listen(lang, onPartial)
    try {
      const text = await ctl.current.result
      if (text) onText(text)
    } catch (e) {
      onError?.(e.message)
    } finally {
      setActive(false)
    }
  }

  return (
    <button
      type="button"
      className={`mic ${active ? 'live' : ''}`}
      onClick={toggle}
      disabled={disabled || !supported}
      title={supported ? (active ? t('listening') : 'Mic') : 'Voice input is not supported in this browser'}
      aria-label={active ? t('listening') : 'Speak'}
    >
      {active ? '■' : '🎤'}
    </button>
  )
}
