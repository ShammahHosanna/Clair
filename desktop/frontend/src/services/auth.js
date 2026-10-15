// Clair Desktop — session locale (démo).
// Pas de compte distant : le compte est créé automatiquement à la première
// connexion et mémorisé sur l'appareil. Ce n'est PAS une sécurité réelle,
// c'est un verrou de session pour la maquette.
import { ref } from 'vue'

const USERS_KEY = 'clair.desktop.users'
const SESSION_KEY = 'clair.desktop.session'

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || [] } catch { return [] }
}

function initUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

// Nom de l'utilisateur connecté (réactif : App.vue s'en sert pour l'avatar).
export const user = ref(initUser())

export function initials(name) {
  if (!name) return 'MM'
  return String(name).trim().split(/\s+/).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('') || 'MM'
}

/**
 * @returns {{ ok: true } | { ok: false, error: 'badName' | 'badPassword' | 'wrongPassword' }}
 */
export function login(name, password) {
  name = String(name || '').trim()
  password = String(password || '')
  if (name.length < 2) return { ok: false, error: 'badName' }
  if (password.length < 4) return { ok: false, error: 'badPassword' }

  const users = loadUsers()
  const existing = users.find(u => u.name.toLowerCase() === name.toLowerCase())
  if (existing && existing.password !== password) return { ok: false, error: 'wrongPassword' }
  if (!existing) {
    // première connexion : création automatique du compte local
    users.push({ name, password })
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)) } catch { /* quota */ }
  }

  user.value = { name }
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ name, at: Date.now() })) } catch { /* quota */ }
  return { ok: true }
}

export function logout() {
  user.value = null
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}
