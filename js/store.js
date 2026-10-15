/* ============================================================
   Clair — store.js : historique et réglages (localStorage)
   Aucune donnée ne quitte le téléphone.
   ============================================================ */
const KEY_HISTORY = 'clair.history.v1';
const KEY_SETTINGS = 'clair.settings.v1';

const DEFAULT_SETTINGS = {
  lang: 'fr',
  theme: 'light',      // 'light' | 'sun' | 'dark'
  textScale: 'normal', // normal | lg | xl
  voice: true,
  vibrate: true
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const history = {
  all() {
    return read(KEY_HISTORY, []);
  },
  add(entry) {
    const list = this.all();
    const withId = { id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()), at: Date.now(), ...entry };
    list.unshift(withId);
    try {
      localStorage.setItem(KEY_HISTORY, JSON.stringify(list.slice(0, 200)));
    } catch { /* quota : silencieux */ }
    return withId;
  },
  remove(id) {
    const list = this.all().filter(e => e.id !== id);
    localStorage.setItem(KEY_HISTORY, JSON.stringify(list));
  },
  clear() {
    localStorage.removeItem(KEY_HISTORY);
  }
};

export const settings = {
  get() {
    return { ...DEFAULT_SETTINGS, ...read(KEY_SETTINGS, {}) };
  },
  update(patch) {
    const next = { ...this.get(), ...patch };
    try {
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(next));
    } catch { /* quota : silencieux */ }
    return next;
  },
  clear() {
    localStorage.removeItem(KEY_SETTINGS);
  }
};

/** Efface toutes les données Clair (US14). */
export function wipeAll() {
  history.clear();
  settings.clear();
}
