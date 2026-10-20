import { useEffect, useRef, useState } from 'react'
import { canListenInBrowser, canRecord, listen, stopSpeaking, subscribeAudioState } from '../lib/speech'
import { useT } from '../lib/i18n'

export default function MicButton({ lang, onPartial, onText, onError, disabled }) {
  const t = useT()
  const [active, setActive] = useState(false)
  const [audioStatus, setAudioStatus] = useState({ state: 'idle', activeId: null })
  const ctl = useRef(null)
  const supported = canListenInBrowser || canRecord

  useEffect(() => {
    const unsubscribe = subscribeAudioState((status) => {
      setAudioStatus(status)
    })
    return () => unsubscribe()
  }, [])

  const toggle = async () => {
    // If user clicks while recording, stop immediately
    if (active) {
      ctl.current?.stop()
      return
    }

    // Strict audio state lock & queue flush: stop any currently playing or fetching TTS
    stopSpeaking()

    setActive(true)
    ctl.current = listen(lang, onPartial)

    try {
      const text = await ctl.current.result
      if (text && text.trim()) {
        onText(text.trim())
      }
    } catch (e) {
      if (onError) onError(e.message)
    } finally {
      setActive(false)
      ctl.current = null
    }
  }

  const isTtsPlaying = audioStatus.state === 'playing'
  const isTtsLoading = audioStatus.state === 'loading'

  return (
    <div className="mic-container">
      <button
        type="button"
        className={`mic ${active ? 'live vad-active' : ''} ${isTtsLoading ? 'tts-loading' : ''} ${isTtsPlaying ? 'tts-playing' : ''}`}
        onClick={toggle}
        disabled={disabled || !supported}
        title={
          supported
            ? active
              ? t('listening') + ' (2s silence auto-stops)'
              : isTtsPlaying
              ? 'Interrupt audio and speak'
              : 'Speak'
            : 'Voice input is not supported in this browser'
        }
        aria-label={active ? t('listening') : 'Speak'}
      >
        {active ? (
          <span className="wave-bars" aria-hidden="true">
            <span className="bar b1" />
            <span className="bar b2" />
            <span className="bar b3" />
            <span className="bar b4" />
          </span>
        ) : isTtsLoading ? (
          <span className="pulsing-spinner" aria-hidden="true">⏳</span>
        ) : isTtsPlaying ? (
          <span className="sound-wave" aria-hidden="true">🔊</span>
        ) : (
          '🎤'
        )}
      </button>
      {active && (
        <span className="vad-badge" aria-live="polite">
          {t('listening')} <small>(बोलना बंद करने पर 2s में स्वतः समाप्त)</small>
        </span>
      )}
    </div>
  )
}
