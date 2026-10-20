// Offline demo. When the UDAAN server cannot be reached (asleep, crashed or not deployed), the five demo accounts
// replay a snapshot of real API responses: public/demo/offline-{hi,en}.json, recorded by
// backend/record_offline_demo.py. Edits made while offline (language, consents, profile) live in memory only.

const PREFIX = 'offline.'
let active = false
const listeners = new Set()
const snapshots = {}
const edits = {}

export const isOfflineActive = () => active
export const isOfflineToken = (token) => Boolean(token?.startsWith(PREFIX))

// The demo role a token belongs to: offline tokens, and the server's signed demo tokens (demo.<role>.<exp>.<sig>)
export function demoRole(token) {
  if (isOfflineToken(token)) return token.slice(PREFIX.length)
  if (token?.startsWith('demo.')) return token.split('.')[1]
  return null
}

export function goOffline() {
  if (active) return
  active = true
  listeners.forEach((fn) => fn(true))
}

export function onOfflineChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const fail = (message, status = 503) => Object.assign(new Error(message), { status })

const lang = () => {
  try { return window.localStorage.getItem('udaan.lang') === 'en' ? 'en' : 'hi' } catch { return 'hi' }
}

function snapshot(l) {
  snapshots[l] ??= fetch(`/demo/offline-${l}.json`).then((r) => {
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  }).catch((e) => {
    delete snapshots[l]
    throw fail(`Cannot reach the UDAAN server, and the offline demo could not load (${e.message}).`)
  })
  return snapshots[l]
}

// Same key as record_offline_demo.key(): method, path, then the query sorted by name
function parse(method, url) {
  const u = new URL(url, 'http://offline')
  const params = [...u.searchParams].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return { method, path: u.pathname, params, segs: u.pathname.split('/') }
}

// Two routes that differ only in one id: a middle segment (/sims/<id>/start) or one containing a digit (/cases/<id>),
// so /student/dna never stands in for /student/sims
function oneIdApart(a, b) {
  if (a.length !== b.length) return false
  const diff = a.flatMap((s, i) => (s === b[i] ? [] : [i]))
  return diff.length === 1 && (diff[0] < a.length - 1 || /\d/.test(a[diff[0]] + b[diff[0]]))
}

function lookup(table = {}, method, url) {
  const want = parse(method, url)
  const query = new URLSearchParams(want.params).toString()
  const exact = table[`${method} ${want.path}${query ? `?${query}` : ''}`]
  if (exact !== undefined) return exact
  // Nearest recording: same path with the most query values in common (a slider moved, a different trade), then
  // the same route with one differing path segment (another simulation or case id)
  let best, bestScore = -1
  for (const [k, v] of Object.entries(table)) {
    const [m, u] = k.split(' ')
    if (m !== method) continue
    const got = parse(m, u)
    let score
    if (got.path === want.path) score = 100
    else if (oneIdApart(got.segs, want.segs)) score = 50
    else continue
    score += got.params.filter(([gk, gv]) => want.params.some(([wk, wv]) => wk === gk && wv === gv)).length
    if (score > bestScore) [best, bestScore] = [v, score]
  }
  return best
}

const USER_FIELDS = ['name', 'preferred_lang', 'district_id', 'relation']

function withEdits(role, me) {
  const e = edits[role]
  if (!e || !me) return me
  return {
    ...me,
    user: { ...me.user, ...e.user },
    profile: me.profile && { ...me.profile, ...e.profile },
    consents: { ...me.consents, ...e.consents },
  }
}

const OFFLINE_REPLY = {
  en: 'UDAAN is in offline demo mode because the server cannot be reached, so it cannot answer new questions right now. '
    + 'You can still explore the saved reports, stories and plans. If you feel upset or unsafe, please call Tele-MANAS on '
    + '14416 (free, any time) or 112.',
  hi: 'सर्वर से संपर्क नहीं हो पा रहा, इसलिए उड़ान अभी ऑफ़लाइन डेमो में है और नए सवालों के जवाब नहीं दे सकता। '
    + 'आप सहेजी हुई रिपोर्ट, कहानियाँ और योजनाएँ देख सकते हैं। अगर आप परेशान या असुरक्षित महसूस कर रहे हैं, तो '
    + 'टेली-मानस 14416 (मुफ़्त, कभी भी) या 112 पर कॉल करें।',
}

const SIGN_IN_OFFLINE = 'The UDAAN server cannot be reached right now, so only the demo accounts can sign in.'

export async function offlineRequest(method, url, body, token) {
  const l = lang()
  const snap = await snapshot(l)
  const path = new URL(url, 'http://offline').pathname
  const role = demoRole(token)
  // The account's own recordings first, then the signed-out ones (meta, shared reports) by exact path
  const table = { ...snap.anon, ...((role && snap[role]) || {}) }
  const me = (r) => withEdits(r, structuredClone(snap[r]['GET /api/auth/me']))

  const demo = path.match(/^\/api\/auth\/demo\/(\w+)$/)
  if (method === 'POST' && demo && snap[demo[1]]) return { token: PREFIX + demo[1], is_new: false, ...me(demo[1]) }
  if (method === 'POST' && path === '/api/auth/login') {
    const email = String(body?.email || '').trim().toLowerCase()
    const match = (snap.anon['GET /api/auth/demo'] || []).find((d) => d.email === email && d.password === body?.password)
    if (match) return { token: PREFIX + match.role, is_new: false, ...me(match.role) }
    throw fail(SIGN_IN_OFFLINE)
  }
  if (path === '/api/auth/logout') return { ok: true }
  if (path.startsWith('/api/auth/') && method !== 'GET') throw fail(SIGN_IN_OFFLINE)
  if (path.startsWith('/api/speech/')) throw fail('Voice needs the UDAAN server, which cannot be reached right now.')

  if (!role) {
    const hit = lookup(snap.anon, method, url)
    if (hit === undefined) throw fail('The UDAAN server cannot be reached right now.')
    return structuredClone(hit)
  }

  if (method === 'GET' && (path === '/api/auth/me' || path === '/api/me')) return me(role)
  if (method === 'PATCH' && path === '/api/me') {
    const e = (edits[role] ??= { user: {}, profile: {}, consents: {} })
    for (const [k, v] of Object.entries(body || {})) (USER_FIELDS.includes(k) ? e.user : e.profile)[k] = v
    return me(role)
  }
  if (method === 'PUT' && path === '/api/me/consents') {
    const e = (edits[role] ??= { user: {}, profile: {}, consents: {} })
    Object.assign(e.consents, body, { updated_at: new Date().toISOString() })
    return me(role)
  }
  if (method === 'DELETE' && path === '/api/me') throw fail('Demo accounts are shared and cannot be deleted.', 403)

  if (method === 'POST' && /^\/api\/sessions\/[^/]+\/messages$/.test(path)) {
    const r = structuredClone(lookup(table, method, url))
    const now = new Date().toISOString()
    const id = Date.now()
    return {
      ...r,
      user: { ...r.user, id, created_at: now, text: body.text, speaker: body.speaker || r.user.speaker, cards: [], sources: [] },
      assistant: { ...r.assistant, id: id + 1, created_at: now, text: OFFLINE_REPLY[l], cards: [], sources: [], engine: 'offline' },
      escalation: null, risk: null, guard_blocked: [],
    }
  }

  if (method === 'PUT' && path === '/api/student/family/permissions') {
    const e = (edits[role] ??= { user: {}, profile: {}, consents: {} })
    e.permissions = { ...body }
  }
  if (method === 'GET' || SAVES_RETURN[path]) {
    const hit = lookup(table, 'GET', SAVES_RETURN[path] || url)
    if (hit !== undefined) {
      const out = structuredClone(hit)
      if (out?.link?.permissions && edits[role]?.permissions) out.link.permissions = { ...edits[role].permissions }
      return out
    }
  }
  if (method === 'GET') throw fail('This page is not part of the offline demo.')
  // An unrecorded save returns the matching page data (POST /pathway -> GET /pathway), else a plain success
  return structuredClone(lookup(table, method, url) ?? lookup(table, 'GET', url) ?? { ok: true })
}

// Saves whose reply is the whole page they belong to
const SAVES_RETURN = {
  '/api/student/family/permissions': '/api/student/family',
  '/api/student/consensus': '/api/student/family',
  '/api/parent/consensus/accept': '/api/parent/consensus',
}
