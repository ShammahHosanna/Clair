<template>
  <!-- ==================== C. Bannière d'accueil ==================== -->
  <v-row>
    <v-col cols="12">
      <div class="banner rounded-xl elevation-2 d-flex align-center pa-7 pl-8">
        <div class="flex-grow-1">
          <h1 class="banner-title text-white">{{ t('home.welcome', { name: userName }) }}</h1>
          <p class="banner-sub text-white mt-2 mb-5">{{ t('banner.subtitle') }}</p>

          <div class="d-flex flex-wrap ga-6">
            <div class="d-flex align-center" v-for="adv in advantages" :key="adv.key">
              <v-icon :icon="adv.icon" color="white" size="30" class="mr-3" />
              <div>
                <div class="adv-title text-white">{{ t(`banner.${adv.key}`) }}</div>
                <div class="adv-sub">{{ t(`banner.${adv.sub}`) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Illustration : smartphone avec SMS Mobile Money + symbole de protection -->
        <svg viewBox="0 0 190 190" width="190" class="ml-8 flex-shrink-0 d-none d-md-block" role="img" aria-hidden="true">
          <circle cx="95" cy="95" r="82" fill="rgba(255,255,255,0.08)" />
          <rect x="48" y="30" width="86" height="140" rx="14" fill="#12296B" stroke="rgba(255,255,255,0.4)" />
          <rect x="55" y="40" width="72" height="118" rx="8" fill="#FFFFFF" />
          <rect x="83" y="34" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
          <rect x="61" y="48" width="44" height="8" rx="3" fill="#0866E8" opacity="0.9" />
          <rect x="61" y="62" width="60" height="10" rx="2" fill="#1A1A2E" />
          <rect x="61" y="76" width="34" height="6" rx="2" fill="#00A86B" />
          <rect x="61" y="88" width="58" height="5" rx="2" fill="#D6E6FA" />
          <rect x="61" y="97" width="46" height="5" rx="2" fill="#D6E6FA" />
          <rect x="61" y="110" width="60" height="16" rx="4" fill="#F0F7FF" stroke="#D6E6FA" />
          <rect x="66" y="115" width="50" height="5" rx="2" fill="#0866E8" opacity="0.7" />
          <!-- bouclier de protection -->
          <circle cx="132" cy="152" r="24" fill="#FFFFFF" stroke="#00A86B" stroke-width="3" />
          <path d="M132 138 l13 5 v9 c0 8-5.5 14-13 17 c-7.5-3-13-9-13-17 v-9 z" fill="#00A86B" />
          <path d="M126 155 l5 5 9 -10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </v-col>
  </v-row>

  <v-row>
    <!-- ============ Actions rapides ============ -->
    <v-col cols="12" md="8">
      <v-row>
        <v-col v-for="q in quickActions" :key="q.key" cols="12" sm="4">
          <v-card
            class="quick-card pa-6 elevation-2 text-center fill-height d-flex flex-column align-center"
            :to="q.to"
            hover
          >
            <v-avatar :color="q.color" size="56" class="mb-3 elevation-2">
              <v-icon :icon="q.icon" color="white" size="30" />
            </v-avatar>
            <div class="quick-title font-weight-bold">{{ t(`home.${q.key}`) }}</div>
            <p class="quick-desc mt-1 mb-0">{{ t(`home.${q.key}Desc`) }}</p>
          </v-card>
        </v-col>
      </v-row>

      <!-- ============ Statistiques ============ -->
      <v-row>
        <v-col v-for="s in stats" :key="s.key" cols="12" sm="4">
          <v-card class="pa-5 elevation-2 d-flex align-center">
            <v-icon :icon="s.icon" :color="s.color" size="30" class="mr-3" />
            <div>
              <div class="stat-value">{{ s.value }}</div>
              <div class="stat-label">{{ t(`home.${s.key}`) }}</div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-col>

    <!-- ============ Bon à savoir ============ -->
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

  <v-row>
    <!-- ============ F. Derniers résultats ============ -->
    <v-col cols="12">
      <v-card class="pa-6 elevation-2">
        <div class="d-flex align-center justify-space-between mb-4">
          <h3 class="section-sub-title mb-0">
            <v-icon icon="mdi-clock-outline" class="mr-2" color="primary" />
            {{ t('results.title') }}
          </h3>
          <v-btn variant="text" color="primary" class="text-none" :to="'/history'">
            {{ t('results.seeAll') }}
            <v-icon icon="mdi-chevron-right" size="18" />
          </v-btn>
        </div>

        <div v-if="historyItems.length === 0" class="text-center py-8">
          <v-icon icon="mdi-inbox-outline" size="44" color="ink-soft" />
          <p class="text-medium-emphasis mt-2 mb-0">{{ t('results.empty') }}</p>
          <v-btn color="electric" class="text-none mt-4" prepend-icon="mdi-scan-helper" to="/scan">
            {{ t('home.scan') }}
          </v-btn>
        </div>

        <div
          v-for="entry in historyItems.slice(0, 5)"
          :key="entry.id"
          class="result-row d-flex align-center"
          :class="`v-${entry.verdict}`"
        >
          <v-avatar size="38" :color="colors[entry.verdict]" class="mr-3">
            <v-icon color="white" :icon="icons[entry.verdict]" size="22" />
          </v-avatar>
          <div class="flex-grow-1 min-width-0">
            <div class="result-type font-weight-bold">{{ t(`verdicts.${verdictKey(entry.verdict)}`) }}</div>
            <div class="result-meta">
              {{ fmtDate(entry.at) }} · {{ fmtAmount(entry.amount) }} FCFA
              <v-chip v-if="entry.isDemo" size="x-small" variant="tonal" color="warn-orange" class="ml-1">
                {{ t('results.demo') }}
              </v-chip>
            </div>
          </div>
          <v-menu location="start">
            <template #activator="{ props }">
              <v-btn icon="mdi-chevron-right" size="small" variant="text" v-bind="props" :aria-label="t('results.details')" />
            </template>
            <v-card class="pa-4" max-width="360">
              <div class="text-subtitle-2 font-weight-bold mb-2">{{ t('verdicts.' + verdictKey(entry.verdict)) }}</div>
              <div class="text-body-2 mb-1">{{ t('results.amount') }} : <strong>{{ fmtAmount(entry.amount) }} FCFA</strong></div>
              <code class="sms-snippet">{{ entry.sms }}</code>
              <div v-if="entry.resolved && entry.balanceOk != null" class="mt-2">
                <v-chip size="small" :color="entry.balanceOk ? 'ok-green' : 'danger-red'">
                  {{ entry.balanceOk ? t('results.proofDone') : t('results.proofFailed') }}
                </v-chip>
              </div>
              <v-btn size="small" variant="text" color="danger-red" class="text-none mt-2"
                     prepend-icon="mdi-delete-outline" @click="deleteEntry(entry.id)">
                {{ t('results.delete') }}
              </v-btn>
            </v-card>
          </v-menu>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { user } from '../services/auth'
import { api } from '../services/api'

const { t } = useI18n()

const historyItems = ref([])

const userName = computed(() => user.value?.name || '')

const advantages = [
  { key: 'fast', sub: 'fastSub', icon: 'mdi-speedometer' },
  { key: 'offline', sub: 'offlineSub', icon: 'mdi-cloud-off-outline' },
  { key: 'reliable', sub: 'reliableSub', icon: 'mdi-shield-check' }
]

const quickActions = [
  { key: 'scan', to: '/scan', color: '#0866E8', icon: 'mdi-scan-helper' },
  { key: 'history', to: '/history', color: '#00A86B', icon: 'mdi-history' },
  { key: 'help', to: '/help', color: '#FF8A00', icon: 'mdi-help-circle-outline' }
]

const colors = { coherent: '#00A86B', suspect: '#FF8A00', fraude: '#EF3038' }
const icons = {
  coherent: 'mdi-check-circle',
  suspect: 'mdi-alert-circle',
  fraude: 'mdi-alert-octagon'
}
function verdictKey(v) { return v }

const stats = computed(() => ([
  {
    key: 'checks', color: 'primary', icon: 'mdi-shield-check-outline',
    value: historyItems.value.length
  },
  {
    key: 'dangers', color: 'danger-red', icon: 'mdi-alert-octagon',
    value: historyItems.value.filter(e => e.verdict === 'fraude').length
  },
  {
    key: 'proofs', color: 'ok-green', icon: 'mdi-check-circle',
    value: historyItems.value.filter(e => e.resolved && e.balanceOk === true).length
  }
]))

function fmtAmount(a) {
  if (a == null) return '—'
  return Number(a).toLocaleString('fr-FR')
}
function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

async function loadHistory() {
  try { historyItems.value = await api.history() } catch { historyItems.value = [] }
}

async function deleteEntry(id) {
  try { await api.deleteEntry(id) } catch { /* silencieux */ }
  await loadHistory()
}

onMounted(loadHistory)
</script>

<style scoped>
/* ====== C. Bannière ====== */
.banner {
  background: linear-gradient(115deg, #12296B 0%, #0C3FA8 55%, #0866E8 100%);
  min-height: 190px;
}
.banner-title {
  font-size: 1.7rem; font-weight: 800;
  line-height: 1.25;
  max-width: 34rem;
}
.banner-sub { font-size: 1rem; opacity: 0.9; max-width: 30rem; }
.adv-title { font-weight: 700; font-size: 0.95rem; }
.adv-sub { font-size: 0.78rem; opacity: 0.85; }

/* ====== Sections ====== */
.section-sub-title { font-size: 1.05rem; font-weight: 800; color: #1A1A2E; }

/* ====== Actions rapides ====== */
.quick-card { border: 2px solid #D6E6FA; transition: transform .16s ease, box-shadow .16s ease; cursor: pointer; }
.quick-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(18, 41, 107, .14) !important; }
.quick-title { font-size: 1rem; color: #1A1A2E; }
.quick-desc { color: #5A5A72; font-size: 0.8rem; line-height: 1.4; }

/* ====== Statistiques ====== */
.stat-value { font-size: 1.5rem; font-weight: 800; color: #1A1A2E; line-height: 1.1; }
.stat-label { font-size: 0.78rem; color: #5A5A72; }

/* ====== F. Derniers résultats ====== */
.result-row { padding: 0.65rem 0.35rem; border-bottom: 1px solid #EDF3FC; }
.result-row:last-of-type { border-bottom: none; }
.result-type { font-size: 0.88rem; color: #1A1A2E; }
.result-meta { font-size: 0.76rem; color: #5A5A72; }
.min-width-0 { min-width: 0; }
.sms-snippet { display: block; font-size: 0.72rem; white-space: pre-wrap; background: #F0F7FF; padding: 0.5rem; border-radius: 8px; color: #1A1A2E; }

/* ====== G. Bon à savoir ====== */
.tips-card { border: 2px solid #FFE4C2; background: linear-gradient(180deg, #FFF9F0 0%, #FFFFFF 60%); }
.tips-list { margin: 0 0 1rem 1rem; padding: 0; }
.tips-list li { color: #1A1A2E; font-size: 0.9rem; padding: 0.25rem 0; }
</style>
