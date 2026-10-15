/* ============================================================
   Clair — app.js : routeur par hash, flows, réglages, jury
   ============================================================ */
import { loadRules, analyze, VERDICTS, extractTransactionId } from './engine.js';
import { history, settings, wipeAll } from './store.js';
import { speak, vibrate } from './speech.js';
import { t, setLang, getLang, voiceCode } from './i18n.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ---------- État du flow courant ---------- */
let current = null; // { expectedAmount, senderAnswer, sms, result, entry }

/* ---------- Formattage des montants ---------- */
const fmt = (n) => (n == null ? '?' : n.toLocaleString('fr-FR'));

/* ============================================================
   i18n : application des textes explicites data-i18n
   ============================================================ */
function applyI18n() {
  document.documentElement.lang = getLang();
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $('#btn-lang').textContent = getLang().toUpperCase();
  // libellés d'interrupteurs d'état
  updateSwitch($('#sw-voice'), currentSettings.voice ? 'voice-label' : 'voice-off');
  updateSwitch($('#sw-vibrate'), currentSettings.vibrate ? 'vibrate-label' : 'vibrate-off');
}

let currentSettings = null;

/* ============================================================
   Router par hash
   ============================================================ */
const ROUTES = ['home', 'input', 'analyzing', 'verdict', 'proof', 'closed',
  'history', 'tips', 'refund', 'settings', 'a11y', 'jury'];

function route() {
  const hash = location.hash.replace('#', '') || 'home';
  const name = ROUTES.includes(hash) ? hash : 'home';

  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(name);
  if (el) {
    el.classList.add('active');
    // Focus sur le titre d'écran pour lecteur d'écran
    const title = el.querySelector('h1');
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
  }
  window.scrollTo(0, 0);
  // Verdict plein écran : masquer la barre basse sur les écrans de décision
  const fullscreen = ['analyzing', 'verdict', 'proof', 'closed'].includes(name);
  document.body.classList.toggle('no-nav', fullscreen);
  // nav basse : aria-current
  $$('.bottom-nav a').forEach(a => a.removeAttribute('aria-current'));
  if (['home', 'history', 'tips'].includes(name)) {
    $(`.bottom-nav a[data-nav="${name}"]`)?.setAttribute('aria-current', 'page');
  }
  if (name === 'home') renderHomeHistory();
  if (name === 'history') renderHistory();
  if (name === 'settings') applySettingsUI();
}

/* ============================================================
   Écran Accueil : historique récent
   ============================================================ */
const SHAPE_SVG = {
  ok: '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="shape-circle" cx="60" cy="60" r="48"/></svg>',
  warn: '<svg viewBox="0 0 120 120" aria-hidden="true"><path class="shape-triangle" d="M60 14 L110 104 H10 Z"/><line x1="60" y1="44" x2="60" y2="74" stroke="currentColor" stroke-width="10"/><circle cx="60" cy="90" r="5" fill="currentColor"/></svg>',
  danger: '<svg viewBox="0 0 120 120" aria-hidden="true"><path class="shape-octagon" d="M40 12 H80 L108 40 V80 L80 108 H40 L12 80 V40 Z"/><line x1="38" y1="38" x2="82" y2="82" stroke="currentColor" stroke-width="10"/><line x1="82" y1="38" x2="38" y2="82" stroke="currentColor" stroke-width="10"/></svg>'
};

function verdictWord(v) {
  return v === 'ok' ? t('v-ok') : v === 'warn' ? t('v-warn') : t('v-danger');
}

function renderHomeHistory() {
  const list = history.all().slice(0, 3);
  const ul = $('#home-history');
  ul.innerHTML = '';
  $('#home-history-empty').hidden = list.length > 0;
  for (const e of list) {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.dataset.v = e.verdict;
    const time = new Date(e.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `
      <span class="shape">${SHAPE_SVG[e.verdict]}</span>
      <span class="meta">
        <strong>${verdictWord(e.verdict)}</strong>
        <span class="muted">${fmt(e.amount)} F · ${time}</span>
      </span>`;
    ul.appendChild(li);
  }
}

/* ============================================================
   Écran S2 : saisie
   ============================================================ */
const QUICK = [500, 1000, 2000, 5000, 10000];

function renderQuickAmounts() {
  const group = $('#quick-amounts');
  group.innerHTML = '';
  for (const a of QUICK) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.amount = a;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.textContent = fmt(a);
    b.addEventListener('click', () => {
      $$('#quick-amounts .chip').forEach(c => c.setAttribute('aria-checked', 'false'));
      b.setAttribute('aria-checked', 'true');
      $('#amount').value = fmt(a);
    });
    group.appendChild(b);
  }
}

function setFieldError(fieldEl, errorEl, msgKey) {
  if (msgKey) {
    errorEl.textContent = t(msgKey);
    errorEl.hidden = false;
    fieldEl.classList.add('invalid');
  } else {
    errorEl.hidden = true;
    fieldEl.classList.remove('invalid');
  }
}

/* Séparateur de milliers automatique sur le champ montant */
$('#amount')?.addEventListener('input', (e) => {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
  e.target.value = digits ? Number(digits).toLocaleString('fr-FR') : '';
});

$('#sms')?.addEventListener('input', (e) => {
  $('#sms-count').textContent = String(e.target.value.length);
});

$('#sms-field')?.addEventListener('paste', () => setFieldError($('#sms-field'), $('#sms-error'), null));

$('#btn-paste')?.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) throw new Error('empty');
    $('#sms').value = text.trim();
    $('#sms-count').textContent = String(text.length);
    setFieldError($('#sms-field'), $('#sms-error'), null);
  } catch {
    toast('err-clipboard');
  }
});

/* ============================================================
   Analyse : roue de confiance puis verdict
   ============================================================ */
const RULE_LABELS = { R1: 'Format', R2: 'Expéditeur', R3: 'Montant', R4: 'Fraîcheur', R5: 'Doublon', R6: 'Mots-pièges', R7: 'Mise en forme' };

function buildWheel() {
  const svg = $('#wheel-svg');
  const labels = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];
  const n = labels.length;
  const dots = [];
  let html = '';
  labels.forEach((lb, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const x = 100 + 80 * Math.cos(angle);
    const y = 100 + 80 * Math.sin(angle);
    html += `<circle class="rule-dot" id="dot-${lb}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12"/>`;
    html += `<text class="rule-label" x="${x.toFixed(1)}" y="${(y + 26).toFixed(1)}" text-anchor="middle">${lb}</text>`;
    dots.push(lb);
  });
  html += '<circle cx="100" cy="100" r="30" fill="none" stroke="var(--clair-border)" stroke-width="2"/>';
  svg.innerHTML = html;
  const status = $('#rule-status');
  status.innerHTML = '';
  for (const lb of labels) {
    const li = document.createElement('li');
    li.id = `status-${lb}`;
    li.textContent = `${lb} — ${RULE_LABELS[lb]}`;
    status.appendChild(li);
  }
}

async function runAnalyze(sms, expectedAmount, senderAnswer, { demo = false } = {}) {
  location.hash = 'analyzing';
  if (demo) $('#analyzing-title').textContent = `${t('analyzing')} (${t('demo-marker')})`;
  else $('#analyzing-title').textContent = t('analyzing');

  buildWheel();
  const result = analyze({
    sms,
    expectedAmount,
    senderAnswer,
    history: history.all(),
    lang: getLang()
  });

  // Roue animée : les règles s'allument une à une (~1,2 s au total)
  for (const r of result.results) {
    await new Promise(res => setTimeout(res, 140));
    const dot = document.getElementById(`dot-${r.rule}`);
    const st = document.getElementById(`status-${r.rule}`);
    if (dot) {
      dot.classList.add(r.kind === 'hard' && r.pass === false ? 'fail'
        : (r.pass === false ? 'soft' : 'pass'));
    }
    if (st) {
      st.textContent = `${r.rule} — ${RULE_LABELS[r.rule]} : ${
        r.pass === false ? '✕' : '✓'}`;
    }
  }

  showVerdict({ sms, expectedAmount, senderAnswer }, result, demo);
}

/* ============================================================
   Écran S3 : verdict plein écran
   ============================================================ */
function reasonText(r) {
  const d = r.detail || {};
  const vars = { ...d };
  if (d.time) vars.time = `${String(d.time.h).padStart(2, '0')}:${String(d.time.min).padStart(2, '0')}`;
  if (d.smsAmount != null) vars.sms = fmt(d.smsAmount);
  if (d.expectedAmount != null) vars.amount = fmt(d.expectedAmount);
  if (d.dup) {
    const d2 = new Date(d.dup.at);
    vars.date = d2.toLocaleDateString('fr-FR');
    vars.time = d2.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (d.traps) vars.words = d.traps.join(', ');
  if (d.anomalies) vars.words = d.anomalies.join(', ');
  return t(d.key || 'r7-pass', vars);
}

function showVerdict(input, result, demo) {
  current = { ...input, result, demo,
    entry: null };
  const v = result.verdict;
  const hero = $('#verdict-hero');
  hero.className = `verdict-hero ${v}`;
  hero.dataset.state = v;
  $('#verdict-shape').innerHTML = SHAPE_SVG[v];
  const title = $('#verdict-title');
  title.textContent = verdictWord(v);
  $('#verdict-sentence').textContent = t(`v-${v}-s`);

  const reasons = $('#verdict-reasons');
  reasons.innerHTML = '';
  for (const r of result.results.filter(r => r.pass === false)) {
    const li = document.createElement('li');
    li.textContent = reasonText(r);
    reasons.appendChild(li);
  }
  $('#why-reasons').innerHTML = '';
  for (const r of result.results) {
    const li = document.createElement('li');
    li.textContent = `${r.rule} (${RULE_LABELS[r.rule]}) — ${r.pass === false ? '✕' : '✓'} ${reasonText(r)}`;
    $('#why-reasons').appendChild(li);
  }

  // Historique : on enregistre maintenant (avant preuve finale)
  current.entry = history.add({
    verdict: v,
    amount: input.expectedAmount,
    txId: result.txId,
    sms: input.sms,
    at: Date.now(),
    resolved: false,
    demo
  });

  // Annonce : focus titre + voix + vibration
  title.focus({ preventScroll: true });
  location.hash = 'verdict';
  const s = currentSettings;
  vibrate(v, s.vibrate);
  if (s.voice) {
    speak(`${verdictWord(v)}. ${t(`v-${v}-s`)}`, voiceCode(), true);
  }
  if (v === VERDICTS.DANGER) {
    const el = hero;
    el.setAttribute('role', 'alert');
  } else {
    hero.setAttribute('role', 'status');
  }
}

/* Bouton écouter */
$('#btn-speak')?.addEventListener('click', () => {
  speak(`${verdictWord(current.result.verdict)}. ${t(`v-${current.result.verdict}-s`)}`, voiceCode(), true);
});

/* ---------- Bottom sheet « Pourquoi ? » ---------- */
let sheetOpener = null;
function openSheet() {
  $('#why-sheet').hidden = false;
  $('#why-sheet').classList.add('open');
  $('#sheet-backdrop').classList.add('open');
  sheetOpener = document.activeElement;
  $('#why-sheet').querySelector('button')?.focus();
}
function closeSheet() {
  $('#why-sheet').hidden = true;
  $('#why-sheet').classList.remove('open');
  $('#sheet-backdrop').classList.remove('open');
  sheetOpener?.focus();
}
$('#btn-why')?.addEventListener('click', openSheet);
$('#sheet-close')?.addEventListener('click', closeSheet);
$('#sheet-backdrop')?.addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#why-sheet').hidden) closeSheet();
});

/* ---------- Écran S4 : preuve finale ---------- */
$('#btn-proof')?.addEventListener('click', () => {
  $('#proof-amount-line').textContent = t('proof-line', { amount: fmt(current.expectedAmount) });
  drawBalance();
  location.hash = 'proof';
});

function drawBalance() {
  const svg = $('#balance-svg');
  svg.innerHTML = `
    <path d="M20 30 H180" stroke="var(--clair-border)" stroke-width="3"/>
    <path d="M100 30 V90 M60 90 H140" stroke="var(--clair-border)" stroke-width="3"/>
    <path d="M40 55 L80 55 M40 55 L60 70 Z" fill="none" stroke="var(--clair-ink-soft)" stroke-width="3"/>
    <path d="M120 55 L160 65 M120 55 L140 80 Z" fill="var(--clair-ok)" stroke="var(--clair-ok)" stroke-width="3"/>
    <text x="100" y="112" text-anchor="middle" font-size="14">SMS + Solde</text>`;
}

$('#btn-balance-ok')?.addEventListener('click', () => {
  finishFlow(true);
});
$('#btn-balance-no')?.addEventListener('click', () => {
  finishFlow(false);
});

function finishFlow(balanceOk) {
  if (current.entry) {
    current.entry.resolved = true;
    current.entry.balanceOk = balanceOk;
    if (balanceOk && current.result.verdict !== 'danger') {
      current.entry.verdict = 'ok';
    } else if (!balanceOk) {
      current.entry.verdict = 'danger';
    }
    history.remove(current.entry.id);
    history.add(current.entry);
  }
  const hero = $('#closed-hero');
  const v = balanceOk ? 'ok' : 'danger';
  hero.className = `verdict-hero ${v}`;
  $('#closed-shape').innerHTML = SHAPE_SVG[v];
  $('#closed-title').textContent = t(balanceOk ? 'closed-ok-h' : 'closed-no-h');
  $('#closed-sentence').textContent = t(balanceOk ? 'closed-ok-s' : 'closed-no-s');
  const s = currentSettings;
  vibrate(v, s.vibrate);
  if (s.voice) speak(`${t(balanceOk ? 'closed-ok-h' : 'closed-no-h')}`, voiceCode(), true);
  location.hash = 'closed';
}

/* ============================================================
   Bouton Analyser (+ validation)
   ============================================================ */
$('#btn-analyze')?.addEventListener('click', () => {
  const amountRaw = $('#amount').value.replace(/\D/g, '');
  const sms = $('#sms').value.trim();
  const amount = amountRaw ? parseInt(amountRaw, 10) : null;
  const sender = document.querySelector('input[name="sender"]:checked')?.value
    || ($('#sms') ? 'unknown' : 'unknown');

  let ok = true;
  setFieldError($('#sms-field'), $('#sms-error'), null);
  if (!amount || amount < 100) {
    ok = false;
    $('#amount-help').textContent = t('err-amount');
    $('#amount-help').classList.add('field-error');
    $('#amount-help').classList.remove('muted');
  } else {
    $('#amount-help').textContent = t('amount-help');
    $('#amount-help').classList.remove('field-error');
    $('#amount-help').classList.add('muted');
  }
  if (!sms || sms.length < 8) {
    ok = false;
    setFieldError($('#sms-field'), $('#sms-error'), 'err-sms');
  }
  if (!ok) return;

  runAnalyze(sms, amount, sender, { demo: false });
});

/* ============================================================
   Mode jury (annexe D)
   ============================================================ */
const DEMO_SMS_1 = `MTN MoMo
Entreprise: ACHAT BOUTIQUE
Vous avez reçu 5000 FCFA de 2376XXXXXXXX
Transaction ID: MP26091.1423.A12345
Heure: ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')} ${new Date().getDate()}/${new Date().getMonth() + 1}`;
const DEMO_SMS_2 = DEMO_SMS_1.replace('5000', '1500')
  .replace('Infos compte', '')
  .replace('FCFA', 'FCFA URGENT erreur de transfert renvoyez vite');

const SCENARIOS = {
  '1': { sms: DEMO_SMS_1, amount: 5000, sender: 'yes', expected: 'ok' },
  '2': { sms: DEMO_SMS_2, amount: 5000, sender: 'yes', expected: 'danger' },
  '3': { sms: DEMO_SMS_1, amount: 5000, sender: 'yes', expected: 'ok-dup' }
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-scenario]');
  if (!btn) return;
  const s = SCENARIOS[btn.dataset.scenario];
  if (!s) return;
  if (btn.dataset.scenario === '3') {
    // S'assurer que le scénario 1 a été joué : sinon le jouer d'abord pour créer l'entrée
    const has = history.all().some(x => x.txId === extractTransactionId(s.sms));
    if (!has) {
      runAnalyze(s.sms, 5000, 'yes', { demo: true }).then(() => {
        // re-évaluer : le verdict 1 a créé l'entrée → rejouer pour montrer le doublon
        setTimeout(() => runAnalyze(s.sms, 5000, 'yes', { demo: true }), 800);
      });
      return;
    }
  }
  runAnalyze(s.sms, s.amount, s.sender, { demo: true });
});

/* ============================================================
   Historique et effacement
   ============================================================ */
function renderHistory() {
  const ul = $('#history-list');
  ul.innerHTML = '';
  const list = history.all();
  $('#history-empty').hidden = list.length > 0;
  for (const e of list) {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.dataset.v = e.verdict;
    const d = new Date(e.at);
    li.innerHTML = `
      <span class="shape">${SHAPE_SVG[e.verdict]}</span>
      <span class="meta">
        <strong>${verdictWord(e.verdict)} ${e.demo ? `· ${t('demo-marker')}` : ''}</strong>
        <span class="muted">${fmt(e.amount)} F · ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      </span>
      ${e.txId ? `<span class="badge-dup" style="visibility:hidden;">${t('dup-badge')}</span>` : ''}`;
    ul.appendChild(li);
  }
  // badges doublon : compter les txId répétés
  const seen = {};
  $$('#history-list li').forEach((li, i) => {
    const txId = list[i]?.txId;
    if (!txId) return;
    seen[txId] = (seen[txId] || 0) + 1;
    if (seen[txId] > 1) {
      li.querySelectorAll('.badge-dup, .muted').forEach(el => el.style.visibility = 'visible');
    }
  });
}

$('#btn-clear-data')?.addEventListener('click', () => {
  wipeAll();
  toast('toast-cleared');
  renderHistory();
  currentSettings = settings.get();
  currentSettings.lang = 'fr'; // retour par défaut FR
  setLang('fr');
  applyI18n();
  applyTheme();
});

/* ============================================================
   Conseils (5 arnaques)
   ============================================================ */
const TIPS = {
  fr: [
    ['SMS de confirmation falsifié', 'Une capture d’écran ou un SMS retouché annonce un versement qui n’a jamais eu lieu. La capture peut être modifiée en 30 secondes avec une application.', 'Ne jamais livrer sur la foi d’une capture. Vérifiez votre solde.'],
    ['Doublon de transaction', 'Le même identifiant de transaction est présenté deux fois, la nuit ou le lendemain.', 'Utilisez la détection de doublons de Clair et vérifiez l’historique.'],
    ['« Erreur de transfert, renvoyez-moi »', 'L’« error » de Mobile Money n’existe pas : aucune correction instantanée ne demande un renvoi immédiat.', 'Ne renvoyez jamais d’argent. Appelez l’opérateur sur son numéro officiel.'],
    ['Numéro d’appel frauduleux', 'Une personne se dit agent et demande votre code ou à valider une opération.', 'Ne communiquez jamais votre code. Aucun agent ne le demande.'],
    ['SMS trop fort ou trop ancien', 'Un message qui dit « urgent » ou qui date de hier peut être rejoué pour vous presser.', 'Vérifiez l’heure du message. Clair signale l’ancienneté.']
  ],
  en: [
    ['Forged confirmation SMS', 'A retouched screenshot or SMS claims a payment that never happened.', 'Never hand over goods on a screenshot. Check your balance.'],
    ['Transaction replay', 'The same transaction ID is shown twice, at night or the next day.', 'Use Clair’s duplicate detection and check your history.'],
    ['“Transfer error, please return”', 'Mobile Money does not self-correct: no transfer error asks for an immediate return.', 'Never return money. Call the operator on its official number.'],
    ['Fake agent call', 'Someone claims to be an agent and asks for your code.', 'Never share your code. No agent asks for it.'],
    ['Urgent or old SMS', 'A message saying “urgent” or dated yesterday can be replayed to pressure you.', 'Check the message time. Clair flags old messages.']
  ]
};

function renderTips() {
  const box = $('#tips-list');
  box.innerHTML = '';
  const items = TIPS[getLang()] || TIPS.fr;
  items.forEach(([title, body, action]) => {
    const div = document.createElement('div');
    div.className = 'card scam-item';
    div.innerHTML = `<h2>${title}</h2><p>${body}</p><p><strong>${action}</strong></p>`;
    box.appendChild(div);
  });
}

/* ============================================================
   Réglages
   ============================================================ */
function updateSwitch(el, labelKey) {
  if (!el) return;
  const on = el.getAttribute('aria-checked') === 'true';
  const stateSpan = el.querySelector('.state');
  if (stateSpan) stateSpan.textContent = t(on ? 'sun-label' : '') || '';
  const span = el.id === 'sw-voice' ? el.querySelector('#sw-voice-label') || el.querySelector('span:first-child') : el.querySelector('span:first-child');
  if (span && labelKey) span.textContent = t(labelKey);
}

function applyTheme() {
  const s = currentSettings;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = s.theme === 'dark' || (s.theme !== 'sun' && prefersDark) ? (s.theme === 'sun' ? 'sun' : 'dark') : s.theme;
  document.documentElement.dataset.textScale = s.textScale;
}

function applySettingsUI() {
  $('#sw-sun').setAttribute('aria-checked', String(currentSettings.theme === 'sun'));
  $('#sw-voice').setAttribute('aria-checked', String(currentSettings.voice));
  $('#sw-vibrate').setAttribute('aria-checked', String(currentSettings.vibrate));
  $$('#size-chips .chip').forEach(c =>
    c.setAttribute('aria-checked', String(c.dataset.setScale === currentSettings.textScale)));
  $('#chip-fr').setAttribute('aria-checked', String(currentSettings.lang === 'fr'));
  $('#chip-en').setAttribute('aria-checked', String(currentSettings.lang === 'en'));
}

function bindSwitch(id, onToggle) {
  const el = $(id);
  el?.addEventListener('click', () => {
    const next = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(next));
    onToggle(next);
  });
}

bindSwitch('#sw-sun', (v) => {
  currentSettings = settings.update({ theme: v ? 'sun' : 'light' });
  applyTheme();
});
bindSwitch('#sw-voice', (v) => {
  currentSettings = settings.update({ voice: v });
  updateSwitch($('#sw-voice'), v ? 'voice-label' : 'voice-off');
});
bindSwitch('#sw-vibrate', (v) => {
  currentSettings = settings.update({ vibrate: v });
  updateSwitch($('#sw-vibrate'), v ? 'vibrate-label' : 'vibrate-off');
});

$$('#size-chips .chip').forEach(c => c.addEventListener('click', () => {
  currentSettings = settings.update({ textScale: c.dataset.setScale });
  applyTheme();
  applySettingsUI();
}));
$('[data-set-lang]') && ['#chip-fr', '#chip-en'].forEach(sel => {
  const b = $(sel);
  b?.addEventListener('click', () => {
    currentSettings = settings.update({ lang: b.dataset.setLang });
    setLang(currentSettings.lang);
    applyI18n();
    renderTips();
    applySettingsUI();
  });
});

/* Changement de langue depuis l'en-tête */
$('#btn-lang')?.addEventListener('click', () => {
  const next = getLang() === 'fr' ? 'en' : 'fr';
  currentSettings = settings.update({ lang: next });
  setLang(next);
  applyI18n();
  renderTips();
});

/* ============================================================
   Toast
   ============================================================ */
let toastTimer = null;
function toast(key) {
  const el = $('#toast');
  el.textContent = t(key);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

/* ============================================================
   PWA
   ============================================================ */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* démo locale file:// */ });
  });
}

/* ============================================================
   Init
   ============================================================ */
async function init() {
  currentSettings = settings.get();
  setLang(currentSettings.lang);
  applyTheme();
  await loadRules();
  renderQuickAmounts();
  renderTips();
  applyI18n();
  route();
  window.addEventListener('hashchange', route);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
