<template>
  <!-- ==================== D. Module principal de vérification ==================== -->
  <v-row>
    <v-col cols="12" md="8">
      <v-card class="pa-7 elevation-2">
        <h2 class="section-title">{{ t('scanner.title') }}</h2>
        <p class="section-sub mb-5">{{ t('scanner.instruction') }}</p>

        <v-textarea
          v-model="sms"
          :label="t('scanner.placeholder')"
          rows="5"
          variant="outlined"
          density="comfortable"
          :error-messages="errors.sms"
          persistent-placeholder
        >
          <template #details>
            <v-btn variant="tonal" size="small" color="primary" prepend-icon="mdi-text-box-outline"
                   @click="fillExample" class="text-none">
              {{ t('scanner.example') }}
            </v-btn>
          </template>
        </v-textarea>

        <v-row class="mt-1">
          <v-col cols="7">
            <v-text-field
              v-model="expectedAmount"
              :label="t('scanner.amountLabel')"
              variant="outlined"
              density="comfortable"
              inputmode="numeric"
              :error-messages="errors.amount"
              hide-spin-buttons
            />
          </v-col>
          <v-col cols="5" class="d-flex align-center">
            <v-file-input
              :label="t('scanner.attach')"
              prepend-icon="mdi-paperclip"
              variant="outlined"
              density="comfortable"
              accept="image/*"
              show-size
              v-model="screenshot"
            />
          </v-col>
        </v-row>

        <v-row align="center">
          <v-col cols="12" md="7">
            <div class="text-body-2 font-weight-bold mb-2">{{ t('scanner.senderLabel') }}</div>
            <v-btn-toggle v-model="senderAnswer" color="primary" divided variant="outlined" class="w-100">
              <v-btn value="yes" class="text-none flex-grow-1">{{ t('scanner.yes') }}</v-btn>
              <v-btn value="no" class="text-none flex-grow-1">{{ t('scanner.no') }}</v-btn>
              <v-btn value="unknown" class="text-none flex-grow-1">{{ t('scanner.unknown') }}</v-btn>
            </v-btn-toggle>
          </v-col>
          <v-col cols="12" md="5" class="d-flex ga-3 justify-end">
            <v-btn variant="text" color="ink" class="text-none" @click="clearAll">
              {{ t('scanner.clear') }}
            </v-btn>
            <v-btn
              color="electric" size="x-large" class="analyze-btn text-none flex-grow-1"
              :loading="loading" :disabled="loading"
              prepend-icon="mdi-barcode-scan"
              @click="analyzeSms"
            >
              {{ loading ? t('scanner.analyzing') : t('scanner.analyze') }}
            </v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="errorApi" type="warning" variant="tonal" class="mt-4" density="compact">
          {{ t('scanner.errApi') }}
        </v-alert>
      </v-card>

      <!-- ============ E. Trois cartes de verdict ============ -->
      <v-row class="mt-1">
        <v-col v-for="card in verdictCards" :key="card.state" cols="12" md="4">
          <v-card
            class="verdict-card pa-6 elevation-2 fill-height d-flex flex-column"
            :class="{ 'verdict-card-active': result && card.state === result.verdict }"
            :color="result && card.state === result.verdict ? card.bg : undefined"
          >
            <div class="d-flex align-center mb-3">
              <v-avatar :color="card.color" size="46" class="mr-3 elevation-2">
                <v-icon :icon="card.icon" color="white" size="26" />
              </v-avatar>
              <div class="verdict-title font-weight-bold" :style="titleStyle(card)">
                {{ t(`verdicts.${card.state}`) }}
              </div>
            </div>
            <p class="verdict-desc">{{ t(`verdicts.${card.state}Desc`) }}</p>
            <p class="verdict-advice" v-html="advise(card.state)" />
            <v-spacer />
            <v-btn
              :color="card.color" variant="tonal" block class="text-none mt-4"
              :prepend-icon="result && card.state === result.verdict && result.isDemo ? 'mdi-information-outline' : 'mdi-volume-high'"
              @click="listenCard(card.state)"
            >
              {{ result && card.state === result.verdict && result.isDemo
                  ? t('verdicts.demoBadge') : t(`verdicts.${card.listen}`) }}
            </v-btn>
          </v-card>
        </v-col>
      </v-row>

      <!-- Raisons du verdict + preuve finale -->
      <template v-if="result">
        <v-card class="pa-6 mt-1 elevation-2">
          <div class="d-flex align-center justify-space-between mb-3">
            <h3 class="section-sub-title mb-0">
              <v-icon icon="mdi-list-status" class="mr-2" color="primary" />
              {{ t('verdicts.reasons') }}
            </h3>
            <v-chip v-if="result.entry?.isDemo" color="warn-orange" size="small" label>
              {{ t('verdicts.demoBadge') }}
            </v-chip>
          </div>
          <ul class="reason-list">
            <li v-for="r in result.results" :key="r.rule" :class="reasonClass(r)">
              <strong>{{ r.rule }}</strong> — {{ reasonText(r) }}
            </li>
          </ul>
          <div class="disclaimer mt-4">
            <v-icon icon="mdi-shield-alert-outline" class="mr-2" />
            {{ result.disclaimer }}
          </div>
        </v-card>

        <!-- Preuve finale (R8 humain) -->
        <v-card class="pa-6 mt-3 elevation-2 proof-card" :class="proofDone ? 'proof-ok' : 'proof-neutral'">
          <h3 class="section-sub-title">
            <v-icon icon="mdi-wallet" class="mr-2" color="primary" />
            {{ t('verdicts.proofTitle') }}
          </h3>
          <p>
            {{ t('verdicts.proofText', { amount: fmtAmount(proofAmount) }) }}
          </p>
          <div class="d-flex ga-3 flex-wrap">
            <v-btn color="ok-green" class="text-none" prepend-icon="mdi-check-circle"
                   @click="setProof(true)" :disabled="proofDone || !result.entry">
              {{ t('verdicts.balanceOk') }}
            </v-btn>
            <v-btn color="danger-red" variant="tonal" class="text-none" prepend-icon="mdi-alert-octagon"
                   @click="setProof(false)" :disabled="proofDone || !result.entry">
              {{ t('verdicts.balanceNo') }}
            </v-btn>
          </div>
          <v-alert v-if="proofStatus" :type="proofStatus" variant="tonal" density="compact" class="mt-4">
            {{ proofStatus === 'success' ? t('verdicts.canDeliver') : t('verdicts.doNotDeliver') }}
          </v-alert>
        </v-card>
      </template>
    </v-col>

    <!-- Colonne droite : rappel des règles -->
    <v-col cols="12" md="4">
      <v-card class="pa-6 elevation-2 tips-card">
        <h3 class="section-sub-title">
          <v-icon icon="mdi-lightbulb-on-outline" class="mr-2" color="warn-orange" />
          {{ t('tips.title') }}
        </h3>
        <ul class="tips-list">
          <li>{{ t('tips.t1') }}</li>
          <li>{{ t('tips.t2') }}</li>
          <li>{{ t('tips.t3') }}</li>
        </ul>
        <v-btn variant="tonal" color="warn-orange" class="text-none" :to="'/help'">
          {{ t('tips.more') }}
          <v-icon icon="mdi-arrow-right" size="18" class="ml-1" />
        </v-btn>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { api, sessionCache } from '../services/api'
import { speak } from '../composables/useSpeech'
import { sendNotification } from '../composables/useNotifications'

const { t, locale } = useI18n()

const sms = ref('')
const expectedAmount = ref('')
const senderAnswer = ref('unknown')
const screenshot = ref(null)
const loading = ref(false)
const errors = ref({})
const errorApi = ref(false)
const result = ref(null)
const proofAmount = ref(null)
const proofDone = ref(false)
const proofStatus = ref(null)

const verdictCards = [
  { state: 'coherent', color: '#00A86B', icon: 'mdi-check-circle', listen: 'listenOk' },
  { state: 'suspect', color: '#FF8A00', icon: 'mdi-alert-circle', listen: 'listenWarn' },
  { state: 'fraude', color: '#EF3038', icon: 'mdi-alert-octagon', listen: 'listenDanger' }
]

function titleStyle(card) { return { color: card.color } }

// Les conseils, enrichis avec les raisons réelles quand disponibles
function advise(state) {
  return t(`verdicts.${state === 'coherent' ? 'coherentWarn' : state === 'suspect' ? 'suspectAdvice' : 'fraudeAdvice'}`)
}

let demoData = null
async function loadDemo() {
  try { demoData = await api.demoSms() } catch { demoData = null }
}
function fillExample() {
  if (!demoData) return
  sms.value = demoData.ok
  expectedAmount.value = '5000'
}

function clearAll() {
  sms.value = ''
  expectedAmount.value = ''
  senderAnswer.value = 'unknown'
  screenshot.value = null
  errors.value = {}
  result.value = null
  errorApi.value = false
  proofDone.value = false
  proofStatus.value = null
}

function fmtAmount(a) {
  if (a == null) return '—'
  return Number(a).toLocaleString('fr-FR')
}

const REASON_KEYS = {
  r1: 'r1fail', r2: 'r2fail', r3: 'r3fail', r4: 'r4fail',
  r5: 'r5fail', r6: 'r6fail', r7: 'r7fail'
}

function reasonText(r) {
  // Clé i18n = clé backend sans tiret : 'r1-pass' -> 'r1pass', 'r3-na' -> 'r3na'
  const key = 'verdicts.' + String(r.key || '').replace('-', '')
  const d = r.detail || {}
  const vars = {}
  if (d.smsAmount != null) vars.sms = fmtAmount(d.smsAmount)
  if (d.expectedAmount != null) vars.amount = fmtAmount(d.expectedAmount)
  if (d.words?.length) vars.words = d.words.join(', ')
  if (d.duplicate) {
    const dd = new Date(d.duplicate.at)
    vars.date = dd.toLocaleDateString('fr-FR')
    vars.time = dd.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return t(key, vars)
}
function reasonClass(r) {
  if (r.passed === false) return r.kind === 'hard' ? 'reason-fail' : 'reason-soft'
  return 'reason-ok'
}

async function analyzeSms() {
  errors.value = {}
  errorApi.value = false
  proofDone.value = false
  proofStatus.value = null
  if (!sms.value || sms.value.trim().length < 8) {
    errors.value.sms = t('scanner.errSms')
    return
  }
  const amount = parseInt(String(expectedAmount.value).replace(/\D/g, ''), 10)
  if (expectedAmount.value !== '' && (Number.isNaN(amount) || amount <= 0)) {
    errors.value.amount = t('scanner.errAmount')
    return
  }
  loading.value = true
  try {
    const body = {
      sms: sms.value.trim(),
      expectedAmount: Number.isNaN(amount) ? null : amount,
      senderAnswer: senderAnswer.value || 'unknown',
      lang: locale.value
    }
    const res = await api.analyze(body)
    result.value = res
    proofAmount.value = body.expectedAmount ?? res.smsAmount
    sessionCache.save(res)
    speakResult(res)
    // alerte système uniquement sur le verdict le plus critique :
    // inutile de noyer la commerçante de notifications
    if (res.verdict === 'fraude') {
      sendNotification(t('verdicts.dangerNotifTitle'), t('verdicts.dangerNotifBody'))
    }
  } catch (e) {
    errorApi.value = true
    // repli honnête : on ne recrée PAS un verdict hors-ligne, on signale l'indisponibilité
    const cached = sessionCache.load()
    if (cached) result.value = { ...cached, disclaimer: t('offline.banner'), fromCache: true }
  } finally {
    loading.value = false
  }
}

function speakResult(res, stateOverride = null) {
  const state = stateOverride || res.verdict
  const text = {
    coherent: t('verdicts.coherent') + '. ' + t('verdicts.coherentWarn'),
    suspect: t('verdicts.suspect') + '. ' + t('verdicts.suspectAdvice'),
    fraude: t('verdicts.fraude') + '. ' + t('verdicts.fraudeAdvice')
  }[state]
  speak(text, locale.value === 'en' ? 'en-US' : 'fr-FR')
}

function listenCard(state) {
  // sur une carte non active : lecture de la définition générique
  const text = {
    coherent: t('verdicts.coherent') + '. ' + t('verdicts.coherentDesc'),
    suspect: t('verdicts.suspect') + '. ' + t('verdicts.suspectDesc'),
    fraude: t('verdicts.fraude') + '. ' + t('verdicts.fraudeDesc')
  }[state]
  speak(text, locale.value === 'en' ? 'en-US' : 'fr-FR')
}

async function setProof(ok) {
  if (!result.value?.entry) return
  try {
    const patched = await api.patchEntry(result.value.entry.id, { balanceOk: ok })
    result.value.entry = { ...result.value.entry, ...patched }
    proofDone.value = true
    proofStatus.value = ok ? 'success' : 'error'
  } catch { proofStatus.value = 'error' }
}

loadDemo()
</script>

<style scoped>
.section-title { font-size: 1.3rem; font-weight: 800; color: #1A1A2E; }
.section-sub { color: #5A5A72; font-size: 0.95rem; }
.section-sub-title { font-size: 1.05rem; font-weight: 800; color: #1A1A2E; }

.verdict-card { border: 2px solid #D6E6FA; transition: transform .16s ease, box-shadow .16s ease; }
.verdict-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(18, 41, 107, .14) !important; }
.verdict-card-active { transform: scale(1.02); box-shadow: 0 10px 28px rgba(18, 41, 107, .2) !important; }
.verdict-title { font-size: 1rem; line-height: 1.2; }
.verdict-desc { color: #1A1A2E; font-size: 0.92rem; }
.verdict-advice { color: #5A5A72; font-size: 0.82rem; line-height: 1.45; }
.analyze-btn { font-weight: 800; box-shadow: 0 4px 14px rgba(8, 102, 232, .35); }

.reason-list { list-style: none; padding: 0; margin: 0; }
.reason-list li { padding: 0.35rem 0; font-size: 0.9rem; border-bottom: 1px dashed #D6E6FA; }
.reason-fail { color: #EF3038; font-weight: 600; }
.reason-soft { color: #B85A00; }
.reason-ok { color: #5A5A72; }
.disclaimer { color: #5A5A72; font-size: 0.84rem; background: #F0F7FF; border-radius: 8px; padding: 0.75rem 1rem; }

.proof-neutral { border: 2px solid #D6E6FA; }
.proof-ok { border: 2px solid #00A86B; }

.tips-card { border: 2px solid #FFE4C2; background: linear-gradient(180deg, #FFF9F0 0%, #FFFFFF 60%); }
.tips-list { margin: 0 0 1rem 1rem; padding: 0; }
.tips-list li { color: #1A1A2E; font-size: 0.9rem; padding: 0.25rem 0; }
</style>
