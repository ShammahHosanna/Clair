// Clair Desktop — synthèse vocale des verdicts (Web Speech API)
let voiceCache = null

function pickVoice(langCode) {
  if (typeof speechSynthesis === 'undefined') return null
  if (!voiceCache) voiceCache = speechSynthesis.getVoices()
  return voiceCache.find(v => v.lang?.toLowerCase().startsWith(langCode)) || null
}

export function speak(text, langCode = 'fr-FR') {
  if (typeof speechSynthesis === 'undefined') return false
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = langCode
    const v = pickVoice(langCode.slice(0, 2))
    if (v) u.voice = v
    u.rate = 0.95
    speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

export function stopSpeaking() {
  try { speechSynthesis?.cancel() } catch { /* ignore */ }
}
