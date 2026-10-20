export const storage = {
  get(key) {
    try { return window.localStorage.getItem(key) } catch { return null }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value) } catch { /* private mode */ }
  },
  remove(key) {
    try { window.localStorage.removeItem(key) } catch { /* private mode */ }
  },
}

const TOKEN_KEY = 'udaan.token'
export const getToken = () => storage.get(TOKEN_KEY)
export const setToken = (t) => (t ? storage.set(TOKEN_KEY, t) : storage.remove(TOKEN_KEY))

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(method, url, body, headers = {}, signal = undefined) {
  const isJson = body !== undefined && !(body instanceof Blob) && typeof body !== 'string'
  const token = getToken()
  const res = await fetch(url, {
    method,
    headers: {
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isJson ? JSON.stringify(body) : body,
    signal,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch { /* not JSON */ }
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), res.status)
  }
  const type = res.headers.get('content-type') || ''
  return type.includes('application/json') ? res.json() : res.blob()
}

const qs = (params) => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return p.length ? `?${new URLSearchParams(p)}` : ''
}

export const api = {
  meta: () => request('GET', '/api/meta'),

  otpRequest: (mobile) => request('POST', '/api/auth/otp/request', { mobile }),
  otpVerify: (body) => request('POST', '/api/auth/otp/verify', body),
  demoLogin: (role) => request('POST', `/api/auth/demo/${role}`),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/me'),
  patchMe: (body) => request('PATCH', '/api/me', body),
  setConsents: (body) => request('PUT', '/api/me/consents', body),
  myChat: () => request('POST', '/api/me/chat'),
  exportMe: () => request('GET', '/api/me/export'),
  deleteMe: () => request('DELETE', '/api/me'),

  dna: () => request('GET', '/api/student/dna'),
  saveDna: (body) => request('PUT', '/api/student/dna', body),
  matches: (params) => request('GET', `/api/student/matches${qs(params)}`),
  sims: () => request('GET', '/api/student/sims'),
  startSim: (id) => request('POST', `/api/student/sims/${id}/start`),
  completeSim: (id, attemptId, body) => request('POST', `/api/student/sims/${id}/attempts/${attemptId}`, body),
  pathway: () => request('GET', '/api/student/pathway'),
  pathwayAction: (action) => request('POST', '/api/student/pathway', { action }),
  studentReport: (trade) => request('GET', `/api/student/report${qs({ trade })}`),
  shareReport: (trade) => request('POST', '/api/student/report/share', { trade }),
  studentWhatIf: (params) => request('GET', `/api/student/whatif${qs(params)}`),
  family: () => request('GET', '/api/student/family'),
  setPermissions: (body) => request('PUT', '/api/student/family/permissions', body),
  studentConsensus: (body) => request('PUT', '/api/student/consensus', body),
  progress: () => request('GET', '/api/student/progress'),
  studentStories: () => request('GET', '/api/student/stories'),

  linkChild: (code) => request('POST', '/api/parent/link', { code }),
  parentOverview: () => request('GET', '/api/parent/overview'),
  parentReport: (trade) => request('GET', `/api/parent/report${qs({ trade })}`),
  parentWhatIf: (params) => request('GET', `/api/parent/whatif${qs(params)}`),
  parentStories: () => request('GET', '/api/parent/stories'),
  parentConsensus: () => request('GET', '/api/parent/consensus'),
  putParentConsensus: (answers) => request('PUT', '/api/parent/consensus', { answers }),
  acceptPlan: () => request('POST', '/api/parent/consensus/accept'),
  escalateItem: (item) => request('POST', '/api/parent/consensus/escalate', { item }),

  sharedReport: (token, lang) => request('GET', `/api/reports/${token}${qs({ lang })}`),

  session: (id) => request('GET', `/api/sessions/${id}`),
  patchSession: (id, body) => request('PATCH', `/api/sessions/${id}`, body),
  send: (id, body) => request('POST', `/api/sessions/${id}/messages`, body),
  escalate: (id, body) => request('POST', `/api/sessions/${id}/escalate`, body),
  referral: (id, body) => request('POST', `/api/sessions/${id}/referral`, body),

  escalations: (status = 'open') => request('GET', `/api/escalations?status=${status}`),
  escalation: (id) => request('GET', `/api/escalations/${id}`),
  patchEscalation: (id, body) => request('PATCH', `/api/escalations/${id}`, body),

  teacherClass: () => request('GET', '/api/teacher/class'),
  toolkit: () => request('GET', '/api/teacher/toolkit'),

  summary: (includeDemo) => request('GET', `/api/admin/summary?include_demo=${includeDemo}`),
  states: () => request('GET', '/api/admin/states'),
  gis: (trade) => request('GET', `/api/admin/gis${qs({ trade })}`),
  barriers: (split) => request('GET', `/api/admin/barriers${qs({ split })}`),
  sidh: () => request('GET', '/api/admin/sidh'),
  metrics: () => request('GET', '/api/admin/metrics'),
  attribution: () => request('GET', '/api/admin/attribution'),
  families: (includeDemo) => request('GET', `/api/admin/families?include_demo=${includeDemo}`),
  setStatus: (id, status) => request('POST', `/api/admin/sessions/${id}/status`, { status }),
  updateTemplates: () => request('GET', '/api/admin/update-templates'),
  sendUpdate: (body) => request('POST', '/api/admin/updates', body),
  outcomes: () => request('GET', '/api/admin/outcomes'),
  importOutcomes: (csvText, replace) =>
    request('POST', `/api/admin/import-outcomes?replace=${replace}`, csvText, { 'Content-Type': 'text/csv' }),
  flaggedTurns: () => request('GET', '/api/admin/flagged-turns'),
  flagTurn: (body) => request('POST', '/api/admin/flag-turn', body),
  updateFlagStatus: (id, status) => request('POST', `/api/admin/flagged-turns/${id}/status`, { status }),

  tts: (text, lang, signal) => request('POST', '/api/speech/tts-stream', { text, lang }, {}, signal),
  stt: (blob, lang) => request('POST', `/api/speech/stt?lang=${lang}`, blob, { 'Content-Type': blob.type || 'audio/webm' }),
}
