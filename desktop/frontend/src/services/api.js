// Clair Desktop — client API (backend Flask). Un seul point d'entrée :
// en dev, Vite proxifie /api vers http://127.0.0.1:5000.
const BASE = '/api'

async function handle(res) {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { msg = (await res.json()).message || msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json()
}

export const api = {
  health: () => fetch(`${BASE}/health`).then(handle),

  analyze: ({ sms, expectedAmount, senderAnswer = 'unknown', lang = 'fr', demo = false }) =>
    fetch(`${BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sms, expectedAmount, senderAnswer, lang, demo })
    }).then(handle),

  analyzeDemo: (scenario = 'ok') =>
    fetch(`${BASE}/analyze/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario })
    }).then(handle),

  demoSms: () => fetch(`${BASE}/demo/sms`).then(handle),

  history: () => fetch(`${BASE}/history`).then(handle),

  patchEntry: (id, patch) =>
    fetch(`${BASE}/history/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).then(handle),

  deleteEntry: (id) => fetch(`${BASE}/history/${id}`, { method: 'DELETE' }).then(handle),

  clearHistory: () => fetch(`${BASE}/history`, { method: 'DELETE' }).then(handle),

  getSettings: () => fetch(`${BASE}/settings`).then(handle),

  putSettings: (patch) =>
    fetch(`${BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).then(handle)
}

/**
 * Cache hors-ligne du dernier verdict connu.
 * Le moteur réel tourne côté backend ; si le backend est injoignable,
 * on fournit le dernier résultat en le signalant explicitement.
 */
const LAST_KEY = 'clair.desktop.last'
export const sessionCache = {
  save(result) {
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...result, cachedAt: Date.now(), fromCache: true })) } catch { /* quota */ }
  },
  load() {
    try { return JSON.parse(localStorage.getItem(LAST_KEY)) } catch { return null }
  }
}
