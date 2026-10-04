// Free voice stack.
// Listening: the browser's Web Speech API (Chrome/Edge, hi-IN / en-IN). Without it we record audio
// and let the backend transcribe it with Gemini.
// Speaking: neural voices from the backend (edge-tts). If that fails, the browser's own voice.
import { api } from './api'

const LOCALE = { hi: 'hi-IN', en: 'en-IN' }
const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export const canListenInBrowser = Boolean(Recognition)
export const canRecord = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)

// Returns a controller { stop(), result: Promise<string> }.
export function listen(lang, onPartial) {
  if (Recognition) return listenBrowser(lang, onPartial)
  if (canRecord) return listenRecorded(lang)
  return { stop() {}, result: Promise.reject(new Error('This browser cannot record audio')) }
}

function listenBrowser(lang, onPartial) {
  const rec = new Recognition()
  rec.lang = LOCALE[lang] || 'hi-IN'
  rec.interimResults = true
  rec.continuous = false
  let finalText = ''
  const result = new Promise((resolve, reject) => {
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      onPartial?.(finalText + interim)
    }
    rec.onerror = (e) => (e.error === 'no-speech' || e.error === 'aborted' ? resolve(finalText) : reject(new Error(e.error)))
    rec.onend = () => resolve(finalText.trim())
  })
  rec.start()
  return { stop: () => rec.stop(), result }
}

function listenRecorded(lang) {
  let recorder
  let stream
  const chunks = []
  let stopRequested = false
  const result = (async () => {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise((r) => { recorder.onstop = r })
    recorder.start()
    if (stopRequested) recorder.stop()
    // safety cap: 20 seconds per utterance
    const cap = setTimeout(() => recorder.state === 'recording' && recorder.stop(), 20000)
    await done
    clearTimeout(cap)
    stream.getTracks().forEach((t) => t.stop())
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
    const { text } = await api.stt(blob, lang)
    return text
  })()
  return {
    stop: () => {
      stopRequested = true
      if (recorder?.state === 'recording') recorder.stop()
    },
    result,
  }
}

let current = null

export function stopSpeaking() {
  if (current) {
    current.pause()
    current = null
  }
  window.speechSynthesis?.cancel()
}

export async function speak(text, lang) {
  stopSpeaking()
  try {
    const blob = await api.tts(text, lang)
    const audio = new Audio(URL.createObjectURL(blob))
    current = audio
    await audio.play()
    return 'neural'
  } catch {
    return speakBrowser(text, lang)
  }
}

function speakBrowser(text, lang) {
  const synth = window.speechSynthesis
  if (!synth) return 'none'
  const u = new SpeechSynthesisUtterance(text)
  u.lang = LOCALE[lang] || 'hi-IN'
  const voice = synth.getVoices().find((v) => v.lang === u.lang) || synth.getVoices().find((v) => v.lang.startsWith(lang))
  if (voice) u.voice = voice
  u.rate = 0.95
  synth.speak(u)
  return 'browser'
}
