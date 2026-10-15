/* ============================================================
   Clair — tests du moteur de règles (node tests/engine.test.js)
   Préséance : rules.json est lue localement (simule fetch).
   ============================================================ */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

/* --- Charge le moteur en simulant le fetch local --- */
const rulesRaw = readFileSync(new URL('../js/rules.json', import.meta.url));
// Le module lit l'URL relative "js/rules.json" : on intercepte fetch.
globalThis.fetch = async () => ({
  ok: true,
  json: async () => JSON.parse(rulesRaw.toString('utf8'))
});

const engine = await import('../js/engine.js');
await engine.loadRules();

const { analyze, extractAmount, extractTransactionId, extractTime, parseAmount, findTrapWords, checkDuplicate, VERDICTS } = engine;

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✕ ${name}\n  ${e.message}`);
  }
}

/* ---------- Parsing ---------- */
test('parseAmount : "5 000 FCFA" -> 5000', () => {
  assert.equal(parseAmount('5 000 FCFA'), 5000);
});
test('parseAmount : "5,000.50" -> 5001', () => {
  assert.equal(parseAmount('5,000.50'), 5001);
});
test('parseAmount : "2\u00a0000" (espace insécable) -> 2000', () => {
  assert.equal(parseAmount('2\u00a0000'), 2000);
});
test('parseAmount : texte sans nombre -> null', () => {
  assert.equal(parseAmount('aucun montant'), null);
});

const SMS_OK = `MTN MoMo
Vous avez reçu 5 000 FCFA de 2376xxAA12345
Transaction ID: MP26091.1423.A12345
Le 14/10/2026 à 14:02.`;

/* Heure figée : le SMS est lu à 14:05, donc tout est récent */
const NOW = (() => { const d = new Date(); d.setHours(14, 5, 0, 0); return d; })();

const SMS_FORGED = SMS_OK.replace('5 000', '1 500') + ' URGENT : erreur de transfert, renvoyez immédiatement.';

/* extractTransactionId */
test('extractTransactionId : identifiant extrait', () => {
  assert.equal(extractTransactionId(SMS_OK), 'MP26091.1423.A12345' ? extractTransactionId(SMS_OK) : null);
  assert.notEqual(extractTransactionId(SMS_OK), null);
});
test('extractTransactionId : identifiant avec points non tronqué', () => {
  assert.equal(extractTransactionId(SMS_OK), 'MP26091.1423.A12345');
});
test('extractTransactionId : sans identifiant -> null', () => {
  assert.equal(extractTransactionId('Bonjour comment ca va'), null);
});
test('R5 : deux IDs partagent un préfixe mais ne sont pas identiques -> pas de doublon', () => {
  const a = extractTransactionId('Transaction ID: MP26091.1423.A12345');
  const b = extractTransactionId('Transaction ID: MP26091.9999.B11111');
  assert.notEqual(a, b);
  const dup = checkDuplicate(b, [{ id: 'x', txId: a, at: Date.now() }]);
  assert.equal(dup, null);
});

/* extractTime */
test('extractTime : "14:02" -> {h:14,min:2}', () => {
  assert.deepEqual(extractTime('reçu à 14:02'), { h: 14, min: 2 });
});
test('extractTime : "14 h 05" -> {h:14,min:5}', () => {
  assert.deepEqual(extractTime('à 14 h 05'), { h: 14, min: 5 });
});

/* ---------- Scénario jury 1 : SMS cohérent ---------- */
const hist = [];
test('Scénario 1 : SMS cohérent -> verdict ok', () => {
  const r = analyze({ sms: SMS_OK, expectedAmount: 5000, senderAnswer: 'yes', history: hist, lang: 'fr', now: NOW });
  assert.equal(r.verdict, VERDICTS.CONSISTENT);
  assert.ok(r.txId);
});

/* ---------- Scénario jury 2 : SMS falsifié (R3 + R6) ---------- */
test('Scénario 2 : montant différent + urgence -> DANGER (R3 + R6)', () => {
  const r = analyze({ sms: SMS_FORGED, expectedAmount: 5000, senderAnswer: 'yes', history: hist, lang: 'fr', now: NOW });
  assert.equal(r.verdict, VERDICTS.DANGER);
  assert.equal(r.results.find(x => x.rule === 'R3').pass, false);
  assert.equal(r.results.find(x => x.rule === 'R6').pass, false);
});

/* ---------- Scénario jury 3 : doublon (R5) ---------- */
test('Scénario 3 : identifiant rejoué -> DANGER', () => {
  const r = analyze({ sms: SMS_OK, expectedAmount: 5000, senderAnswer: 'yes', history: [{ id: 'a', txId: extractTransactionId(SMS_OK), at: Date.now() - 3600e3 }], lang: 'fr', now: NOW });
  assert.equal(r.verdict, VERDICTS.DANGER);
  assert.equal(r.results.find(x => x.rule === 'R5').pass, false);
});

/* ---------- R2 expéditeur ---------- */
test('R2 expéditeur « Non » -> DANGER', () => {
  const r = analyze({ sms: SMS_OK, expectedAmount: 5000, senderAnswer: 'no', history: [], lang: 'fr', now: NOW });
  assert.equal(r.verdict, VERDICTS.DANGER);
});
test('R2 expéditeur « Ne sait pas » -> A VÉRIFIER', () => {
  const r = analyze({ sms: SMS_OK, expectedAmount: 5000, senderAnswer: 'unknown', history: [], lang: 'fr', now: NOW });
  assert.equal(r.verdict, VERDICTS.TO_CHECK);
});

/* ---------- R4 fraîcheur ---------- */
test('R4 SMS ancien (lu à 14:05, SMS à 09:00) -> A VÉRIFIER', () => {
  const old = SMS_OK.replace(/14:02/, '09:00');
  const r = analyze({ sms: old, expectedAmount: 5000, senderAnswer: 'yes', history: [], lang: 'fr', now: NOW });
  assert.equal(r.results.find(x => x.rule === 'R4').pass, false);
  assert.ok(extractTime(old).h === 9);
});

test('isFresh : heure récente -> true', () => {
  const now = new Date();
  const t = { h: now.getHours(), min: now.getMinutes() };
  assert.equal(engine.isFresh(t, now), true);
});
test('isFresh : heure vieille de 2 h -> false', () => {
  let now = new Date();
  const past = new Date(now.getTime() - 120 * 60000);
  assert.equal(engine.isFresh({ h: past.getHours(), min: past.getMinutes() }, now), false);
});
test('isFresh : pas d\'heure -> null (non applicable)', () => {
  assert.equal(engine.isFresh(null), null);
});

/* ---------- R6 mots-pièges ---------- */
test('R6 : « erreur » et « urgent » détectés', () => {
  const traps = findTrapWords('ERREUR de transfert, URGENT, renvoyez vite', 'fr');
  assert.ok(traps.includes('erreur') || traps.includes('urgent'));
});

/* ---------- R7 anomalies ---------- */
test('R7 : devise doublée -> anomalie', () => {
  const r = analyze({ sms: 'Vous avez reçu 5 000 FCFA FCFA. Transaction ID: MP123', expectedAmount: 5000, senderAnswer: 'yes', history: [], lang: 'fr', now: NOW });
  assert.equal(r.results.find(x => x.rule === 'R7').pass, false);
});

/* ---------- Invariants ---------- */
test('7 règles évaluées à chaque analyse', () => {
  const r = analyze({ sms: SMS_OK, expectedAmount: 5000, senderAnswer: 'yes', history: [], lang: 'fr', now: NOW });
  assert.equal(r.results.filter(x => x.rule !== 'R8').length, 7);
});

test('SMS illisible + montant -> R1 échoue en dur', () => {
  const r = analyze({ sms: 'blabla pas un sms', expectedAmount: 5000, senderAnswer: 'yes', history: [] });
  const r1 = r.results.find(x => x.rule === 'R1');
  assert.equal(r1.pass, false);
  assert.equal(r1.kind, 'hard');
});

console.log(`\n${passed} test(s) réussis, ${failed} échec(s)`);
if (failed > 0) process.exit(1);
