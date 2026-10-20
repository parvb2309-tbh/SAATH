// Zero-latency Voice Stack for Project UDAAN
// Listening: Web Speech API (Chrome/Edge) with 2-second VAD silence detection + Fallback Recorder with Web Audio RMS VAD.
// Speaking: Neural streaming voices (edge-tts) via FastAPI /tts-stream with strict debouncing and audio state lock.

import { api } from './api'

const LOCALE = { hi: 'hi-IN', en: 'en-IN' }
const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export const canListenInBrowser = Boolean(Recognition)
export const canRecord = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)

// -------------------------------------------------------------
// Audio State Lock & Queue Management
// -------------------------------------------------------------
let currentAudio = null
let activeAbortController = null
let currentSpeakingId = null
let audioState = 'idle' // 'idle' | 'loading' | 'playing'
const stateListeners = new Set()

export function getAudioState() {
  return { state: audioState, activeId: currentSpeakingId }
}

export function subscribeAudioState(fn) {
  stateListeners.add(fn)
  fn({ state: audioState, activeId: currentSpeakingId })
  return () => stateListeners.delete(fn)
}

function setAudioState(state, activeId = null) {
  audioState = state
  currentSpeakingId = activeId
  stateListeners.forEach((fn) => {
    try { fn({ state, activeId }) } catch (err) { console.error('Audio listener error:', err) }
  })
}

/**
 * Flush audio queue, abort active TTS network fetch, and immediately stop playback.
 */
export function stopSpeaking() {
  if (activeAbortController) {
    try { activeAbortController.abort() } catch { /* noop */ }
    activeAbortController = null
  }
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.currentTime = 0
      currentAudio.src = ''
    } catch { /* noop */ }
    currentAudio = null
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel() } catch { /* noop */ }
  }
  setAudioState('idle', null)
}

/**
 * Speak text with strict debouncing, state locking, and immediate queue interrupt.
 * Returns 'neural' or 'browser'.
 */
export async function speak(text, lang = 'hi', id = null) {
  if (!text) return 'none'

  // If already playing or loading the exact same item, clicking toggles it off.
  if (id !== null && currentSpeakingId === id && audioState !== 'idle') {
    stopSpeaking()
    return 'stopped'
  }

  // Interrupt and clear any prior audio
  stopSpeaking()

  // Acquire lock
  setAudioState('loading', id)
  const controller = new AbortController()
  activeAbortController = controller

  try {
    const blob = await api.tts(text, lang, controller.signal)
    if (controller.signal.aborted) return 'aborted'

    const audioUrl = URL.createObjectURL(blob)
    const audio = new Audio(audioUrl)
    currentAudio = audio

    await new Promise((resolve, reject) => {
      audio.onplay = () => setAudioState('playing', id)
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        setAudioState('idle', null)
        currentAudio = null
        resolve('done')
      }
      audio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl)
        setAudioState('idle', null)
        currentAudio = null
        reject(e)
      }
      // If stopped before onplay triggers
      if (controller.signal.aborted) {
        audio.pause()
        resolve('aborted')
      } else {
        audio.play().catch(reject)
      }
    })
    return 'neural'
  } catch (err) {
    if (controller.signal.aborted) return 'aborted'
    // Fall back to browser speech synthesis if neural edge-tts fails
    return speakBrowser(text, lang, id)
  } finally {
    if (activeAbortController === controller) {
      activeAbortController = null
    }
  }
}

function speakBrowser(text, lang, id) {
  const synth = window.speechSynthesis
  if (!synth) {
    setAudioState('idle', null)
    return 'none'
  }
  setAudioState('playing', id)
  const u = new SpeechSynthesisUtterance(text)
  u.lang = LOCALE[lang] || 'hi-IN'
  const voice = synth.getVoices().find((v) => v.lang === u.lang) || synth.getVoices().find((v) => v.lang.startsWith(lang))
  if (voice) u.voice = voice
  u.rate = 0.95

  u.onend = () => setAudioState('idle', null)
  u.onerror = () => setAudioState('idle', null)

  synth.speak(u)
  return 'browser'
}

// -------------------------------------------------------------
// Frictionless Mic Input with Voice Activity Detection (VAD)
// -------------------------------------------------------------

/**
 * Returns a controller { stop(), result: Promise<string> }.
 * Automatically triggers stop() after 2 seconds of silence (VAD).
 */
export function listen(lang, onPartial) {
  // Always interrupt any playing TTS before opening the mic
  stopSpeaking()

  if (Recognition) return listenBrowser(lang, onPartial)
  if (canRecord) return listenRecorded(lang)
  return { stop() {}, result: Promise.reject(new Error('Voice recording is not supported in this browser')) }
}

function listenBrowser(lang, onPartial) {
  const rec = new Recognition()
  rec.lang = LOCALE[lang] || 'hi-IN'
  rec.interimResults = true
  rec.continuous = false

  let finalText = ''
  let silenceTimer = null
  let hasSpoken = false

  const clearSilence = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  const resetSilenceTimer = () => {
    clearSilence()
    // 2-second VAD silence detection
    silenceTimer = setTimeout(() => {
      try { rec.stop() } catch { /* noop */ }
    }, 2000)
  }

  const result = new Promise((resolve, reject) => {
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      const combined = (finalText + interim).trim()
      if (combined) {
        hasSpoken = true
        onPartial?.(combined)
        resetSilenceTimer()
      }
    }

    rec.onerror = (e) => {
      clearSilence()
      if (e.error === 'no-speech' || e.error === 'aborted') resolve(finalText.trim())
      else reject(new Error(e.error))
    }

    rec.onend = () => {
      clearSilence()
      resolve(finalText.trim())
    }
  })

  rec.start()
  return {
    stop: () => {
      clearSilence()
      try { rec.stop() } catch { /* noop */ }
    },
    result,
  }
}

function listenRecorded(lang) {
  let recorder
  let stream
  let audioCtx
  let analyser
  let vadInterval = null
  let silenceTimer = null
  let hasSpoken = false
  const chunks = []
  let stopRequested = false

  const clearVad = () => {
    if (vadInterval) clearInterval(vadInterval)
    if (silenceTimer) clearTimeout(silenceTimer)
    try { audioCtx?.close() } catch { /* noop */ }
  }

  const result = (async () => {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorder = new MediaRecorder(stream)

    // Setup Web Audio VAD Analyser
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)

      const buffer = new Float32Array(analyser.fftSize)
      const SPEECH_THRESHOLD = 0.02

      vadInterval = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer)
        let sumSquares = 0
        for (let i = 0; i < buffer.length; i++) {
          sumSquares += buffer[i] * buffer[i]
        }
        const rms = Math.sqrt(sumSquares / buffer.length)

        if (rms > SPEECH_THRESHOLD) {
          hasSpoken = true
          if (silenceTimer) {
            clearTimeout(silenceTimer)
            silenceTimer = null
          }
        } else if (hasSpoken && !silenceTimer) {
          // 2-second silence after speech detected ➔ auto stop
          silenceTimer = setTimeout(() => {
            if (recorder?.state === 'recording') recorder.stop()
          }, 2000)
        }
      }, 100)
    } catch {
      // AudioContext not allowed or failed; fall back to normal timer
    }

    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise((r) => { recorder.onstop = r })
    recorder.start()
    if (stopRequested) recorder.stop()

    // Safety cap: 20 seconds maximum per utterance
    const cap = setTimeout(() => recorder.state === 'recording' && recorder.stop(), 20000)
    await done
    clearTimeout(cap)
    clearVad()

    stream.getTracks().forEach((t) => t.stop())
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
    const { text } = await api.stt(blob, lang)
    return text || ''
  })()

  return {
    stop: () => {
      stopRequested = true
      clearVad()
      if (recorder?.state === 'recording') recorder.stop()
    },
    result,
  }
}
