/* ============================================================
   Clair — speech.js : voix + vibration pour le verdict
   ============================================================ */

/** Vibration par verdict : 1 impulsion, 2, ou 3 longues. */
export function vibrate(verdict, enabled = true) {
  if (!enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
  const patterns = { ok: [120], warn: [120, 120, 120], danger: [300, 150, 300, 150, 300] };
  try {
    navigator.vibrate(patterns[verdict] || patterns.warn);
    return true;
  } catch {
    return false;
  }
}

let voicesCache = null;

function pickVoice(langCode) {
  if (typeof speechSynthesis === 'undefined') return null;
  if (!voicesCache) voicesCache = speechSynthesis.getVoices();
  const exact = voicesCache.find(v => v.lang?.toLowerCase().startsWith(langCode));
  if (exact) return exact;
  return voicesCache.find(v => v.lang?.startsWith('en')) || voicesCache[0] || null;
}

/** Lit le texte à voix haute dans la langue courante. */
export function speak(text, langCode = 'fr-FR', enabled = true) {
  if (!enabled || typeof speechSynthesis === 'undefined') return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langCode;
    const v = pickVoice(langCode.slice(0, 2));
    if (v) u.voice = v;
    u.rate = 0.95;
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** Chiffres en mots simples pour la lecture des montants (fr : "5 000" -> "cinq mille"). */
export function speakAmountPhrase(template, amount) {
  return template.replace('{amount}', String(amount));
}
