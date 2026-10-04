async function request(method, url, body, headers = {}) {
  const isJson = body !== undefined && !(body instanceof Blob) && typeof body !== 'string'
  const res = await fetch(url, {
    method,
    headers: isJson ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: isJson ? JSON.stringify(body) : body,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch { /* not JSON */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  const type = res.headers.get('content-type') || ''
  return type.includes('application/json') ? res.json() : res.blob()
}

export const api = {
  meta: () => request('GET', '/api/meta'),
  quiz: () => request('GET', '/api/quiz'),
  createSession: (body) => request('POST', '/api/sessions', body),
  session: (id) => request('GET', `/api/sessions/${id}`),
  patchSession: (id, body) => request('PATCH', `/api/sessions/${id}`, body),
  send: (id, body) => request('POST', `/api/sessions/${id}/messages`, body),
  escalate: (id, body) => request('POST', `/api/sessions/${id}/escalate`, body),
  pathway: (id) => request('GET', `/api/sessions/${id}/pathway`),

  escalations: (status = 'open') => request('GET', `/api/escalations?status=${status}`),
  escalation: (id) => request('GET', `/api/escalations/${id}`),
  patchEscalation: (id, body) => request('PATCH', `/api/escalations/${id}`, body),

  summary: (includeDemo) => request('GET', `/api/admin/summary?include_demo=${includeDemo}`),
  families: (includeDemo) => request('GET', `/api/admin/families?include_demo=${includeDemo}`),
  setStatus: (id, status) => request('POST', `/api/admin/sessions/${id}/status`, { status }),
  updateTemplates: () => request('GET', '/api/admin/update-templates'),
  sendUpdate: (body) => request('POST', '/api/admin/updates', body),
  outcomes: () => request('GET', '/api/admin/outcomes'),
  importOutcomes: (csvText, replace) =>
    request('POST', `/api/admin/import-outcomes?replace=${replace}`, csvText, { 'Content-Type': 'text/csv' }),

  tts: (text, lang) => request('POST', '/api/speech/tts', { text, lang }),
  stt: (blob, lang) => request('POST', `/api/speech/stt?lang=${lang}`, blob, { 'Content-Type': blob.type || 'audio/webm' }),
}

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
