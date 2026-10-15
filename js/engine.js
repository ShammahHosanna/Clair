/* ============================================================
   Clair — engine.js : moteur de règles R1–R8 (annexe C)
   Tourne entièrement dans le navigateur. Aucun réseau.
   Idéologie : détecter des incohérences, jamais "confirmer".
   ============================================================ */

export const VERDICTS = {
  CONSISTENT: 'ok',
  TO_CHECK: 'warn',
  DANGER: 'danger'
};

let rulesData = null;

export async function loadRules(url = 'js/rules.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('rules.json introuvable');
  rulesData = await res.json();
  return rulesData;
}

/** Normalise le montant : retire espaces, espaces insécables, points de milliers, virgules. */
export function parseAmount(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/[\s\u00a0\u202f'’]/g, '')
    .replace(/fcfa|xof|xaf/gi, '')
    .replace(/[.,](?=\d{3}\b)/g, '')
    .replace(/,/g, '.');
  const m = cleaned.match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  return Math.round(parseFloat(m[0]));
}

/** Extrait l'identifiant de transaction du SMS. */
export function extractTransactionId(sms) {
  const re = /(?:trans(?:action)?[\s_-]*(?:id|id\.|number|no|ref(?:[erence]?[\s_-]*)?)|ref(?:erence)?[\s_-]*(?:id|number|no)?)[\s:_.#-]*([A-Z0-9](?:[A-Z0-9.\/-]{4,18})[A-Z0-9])/i;
  const m = String(sms || '').match(re);
  if (!m) return null;
  return m[1].replace(/[.\/-]+$/, '').toUpperCase();
}

/** Extrait le montant reçu du SMS (première occurrence plausible). */
export function extractAmount(sms) {
  const raw = String(sms || '');
  const re = /(?:mnt|montant|amount|somme|received|re[çc]u[a-z]*|transf[ée]r[ée]|[vV]ous\s+(?:avez\s+)?re[çc]u)\s*[:\s'’|=]*\s*((?:\d[\d\s\u00a0\u202f.,']{0,11}))\s*(?:f(?:c?)fa?|xaf|xof)?/i;
  const m = raw.match(re);
  if (m) return parseAmount(m[1]);
  // repli : premier nombre isolé suivi de FCFA / F CFA
  const m2 = raw.match(/((?:\d[\d\s\u00a0\u202f.,']{0,11}))\s*fcfa?\s*f/i) ||
             raw.match(/((?:\d[\d\s\u00a0\u202f.,']{0,11}))\s*(?:fcfa|xof|xaf)/i);
  if (m2) return parseAmount(m2[1]);
  const m3 = raw.match(/\b((?:\d[\d\s\u00a0\u202f]{1,9}))\s*(?:f|F)(?:cfa?|CFA?)?(?![A-Za-z])/);
  if (m3) return parseAmount(m3[1]);
  return null;
}

/** Extrait l'heure du SMS au format HH:M(M) ou HH h MM (espaces admis). Renvoie {h, min}. */
export function extractTime(sms) {
  const m = String(sms || '').match(/(\d{1,2})\s*[:h]\s*(\d{2})/i);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return { h, min };
}

/** R4 : heure lisible dans les 10 dernières minutes (par rapport à "now"). */
export function isFresh(time, now = new Date(), windowMinutes = rulesData?.hardRules?.freshWindowMinutes ?? 10) {
  if (!time) return null; // pas d'heure lisible -> règle non applicable
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const smsMins = time.h * 60 + time.min;
  const diff = (nowMins - smsMins + 1440) % 1440;
  return diff <= windowMinutes;
}

/** R6 : mots-pièges d'urgence / remboursement. */
export function findTrapWords(sms, lang = 'fr') {
  const s = String(sms || '').toLowerCase();
  const lists = [
    ...(rulesData?.trapWords?.[lang] || []),
    ...(rulesData?.trapWords?.fr || []),
    ...(rulesData?.trapWords?.en || [])
  ];
  const found = new Set();
  for (const w of lists) {
    const word = w.replace(/^\./, '.');
    if (word.includes(' ') || word.startsWith('.')) {
      if (s.includes(word)) found.add(w);
    } else if (new RegExp(`\\b${w}\\w*`, 'i').test(s.replace(/^\./, ''))) {
      found.add(w);
    }
  }
  return [...found];
}

/** R5 : doublon — l'ID est-il déjà dans l'historique ? */
export function checkDuplicate(txId, history, ignoreId = null) {
  if (!txId) return null;
  const prev = (history || []).find(
    e => e.txId === txId && (!ignoreId || e.id !== ignoreId)
  );
  return prev || null;
}

/** R7 : anomalies de mise en forme. */
export function findAnomalies(sms) {
  const s = String(sms || '');
  const found = [];
  if (/\d{1,3}(?:[ \u00a0.]\d{3})+(?:[ \u00a0]?\d{3}){3,}/.test(s)) found.push('format-montant-inhabituel');
  if (/fcfa?\s*fcfa/i.test(s)) found.push('devise-doublee');
  if (/\d,{1,}\d/.test(s) && !/\d+\.\d/.test(s)) found.push('virgule-suspecte');
  if ((s.match(/f(?:c)?fa/gi) || []).length > 4) found.push('devise-repetee');
  return found;
}

/**
 * Analyse complète d'un SMS.
 * @param {Object} input
 * @param {string} input.sms        texte collé du SMS
 * @param {number|null} input.expectedAmount montant attendu (null = inconnu)
 * @param {string} input.senderAnswer 'yes' | 'no' | 'unknown'
 * @param {Array}  input.history    historique [{id, txId, ...}]
 * @param {string} [input.lang]     langue courante pour les mots-pièges
 * @param {Date}   [input.now]      date courante (injectable pour les tests)
 * @returns {{verdict:'ok'|'warn'|'danger', results:Array, txId:string|null}}
 *   results: [{ rule:'R1'..'R7', status:'hard'|'soft', pass:boolean|null, detail }]
 */
export function analyze(input) {
  const { sms, expectedAmount, senderAnswer, history, lang = 'fr', now = new Date() } = input;
  const results = [];
  const add = (rule, kind, pass, detail) => results.push({ rule, kind, pass, detail });

  const txId = extractTransactionId(sms);
  const smsAmount = extractAmount(sms);
  const smsTime = extractTime(sms);

  // R1 — Format : identifiant présent et extrait
  const idOk = !!txId;
  add('R1', 'hard', idOk,
    idOk ? { key: 'r1-pass', txId } : { key: 'r1-fail', txId: null });

  // R2 — Expéditeur (réponse utilisateur)
  if (senderAnswer === 'no') add('R2', 'hard', false, { key: 'r2-fail' });
  else if (senderAnswer === 'unknown') add('R2', 'soft', false, { key: 'r2-unknown' });
  else add('R2', 'soft', true, { key: 'r2-pass' });

  // R3 — Montant
  if (expectedAmount == null) {
    add('R3', 'hard', true, { key: 'r3-na' });
  } else if (smsAmount == null) {
    add('R3', 'hard', true, { key: 'r3-unknown' }); // montant non lisible : pas de faux positif dur
  } else if (Math.abs(smsAmount - expectedAmount) < 0.5) {
    add('R3', 'hard', true, { key: 'r3-pass', smsAmount });
  } else {
    add('R3', 'hard', false, { key: 'r3-fail', expectedAmount, smsAmount });
  }

  // R4 — Fraîcheur
  const fresh = isFresh(smsTime, now);
  add('R4', 'soft', fresh === null ? true : fresh,
    fresh === null ? { key: 'r4-unknown' }
      : fresh ? { key: 'r4-pass', time: smsTime }
      : { key: 'r4-fail', time: smsTime });

  // R5 — Doublon
  const dup = checkDuplicate(txId, history, null);
  if (dup) add('R5', 'hard', false, { key: 'r5-fail', dup });
  else if (txId) add('R5', 'soft', true, { key: 'r5-pass' });

  // R6 — Mots-pièges
  const traps = findTrapWords(sms, lang);
  if (traps.length) add('R6', 'soft', false, { key: 'r6-fail', traps });
  else add('R6', 'soft', true, { key: 'r6-pass' });

  // R7 — Anomalies de mise en forme
  const anomalies = findAnomalies(sms);
  if (anomalies.length) add('R7', 'soft', false, { key: 'r7-fail', anomalies });
  else add('R7', 'soft', true, { key: 'r7-pass' });

  // Décision (pseudo-code de l'annexe C)
  let verdict = VERDICTS.CONSISTENT;
  if (results.some(r => r.kind === 'hard' && r.pass === false)) verdict = VERDICTS.DANGER;
  else if (results.some((r) => r.kind === 'soft' && r.pass === false)) verdict = VERDICTS.TO_CHECK;

  return { verdict, results, txId, smsAmount, smsTime };
}
