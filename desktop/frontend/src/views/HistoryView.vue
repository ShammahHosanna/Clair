<template>
  <v-card class="pa-7 elevation-2">
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4">
      <h2 class="section-title mb-0">{{ t('historyView.title') }}</h2>
      <v-btn color="danger-red" variant="tonal" class="text-none" prepend-icon="mdi-delete-sweep-outline"
             @click="confirmClear = true" :disabled="items.length === 0">
        {{ t('historyView.clearAll') }}
      </v-btn>
    </div>

    <div v-if="items.length === 0" class="text-center py-10">
      <v-icon icon="mdi-inbox-outline" size="52" color="ink-soft" />
      <p class="text-medium-emphasis mt-3 mb-0">{{ t('historyView.empty') }}</p>
    </div>

    <div v-for="e in items" :key="e.id" class="hist-row d-flex align-center" :class="`v-${e.verdict}`">
      <v-avatar size="42" :color="colors[e.verdict]" class="mr-4">
        <v-icon color="white" :icon="icons[e.verdict]" />
      </v-avatar>
      <div class="flex-grow-1 min-width-0">
        <div class="font-weight-bold hist-type">
          {{ t('verdicts.' + e.verdict) }}
          <v-chip v-if="e.isDemo" size="x-small" color="warn-orange" variant="tonal" class="ml-2">
            {{ t('verdicts.demoBadge') }}
          </v-chip>
          <v-chip v-if="e.resolved" size="x-small" :color="e.balanceOk ? 'ok-green' : 'danger-red'" variant="tonal" class="ml-1">
            {{ e.balanceOk ? t('results.proofDone') : t('results.proofFailed') }}
          </v-chip>
        </div>
        <div class="hist-meta">{{ fmtDate(e.at) }} · {{ fmtAmount(e.amount) }} FCFA</div>
      </div>
      <v-btn icon="mdi-delete-outline" size="small" variant="text" color="danger-red"
             :aria-label="t('results.delete')" @click="del(e.id)" />
    </div>

    <v-dialog v-model="confirmClear" max-width="420">
      <v-card class="pa-5">
        <div class="font-weight-bold mb-3">{{ t('historyView.confirmClear') }}</div>
        <div class="d-flex justify-end ga-3">
          <v-btn variant="text" class="text-none" @click="confirmClear = false">Annuler</v-btn>
          <v-btn color="danger-red" class="text-none" @click="clearAll">OK</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../services/api'

const { t } = useI18n()
const items = ref([])
const confirmClear = ref(false)

const colors = { coherent: '#00A86B', suspect: '#FF8A00', fraude: '#EF3038' }
const icons = { coherent: 'mdi-check-circle', suspect: 'mdi-alert-circle', fraude: 'mdi-alert-octagon' }

function fmtAmount(a) { return a == null ? '—' : Number(a).toLocaleString('fr-FR') }
function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  try { items.value = await api.history() } catch { items.value = [] }
}
async function del(id) {
  try { await api.deleteEntry(id) } catch { /* silencieux */ }
  await load()
}
async function clearAll() {
  try { await api.clearHistory() } catch { /* silencieux */ }
  confirmClear.value = false
  await load()
}

onMounted(load)
</script>

<style scoped>
.section-title { font-size: 1.3rem; font-weight: 800; color: #1A1A2E; }
.hist-row { padding: 0.8rem 0.5rem; border-bottom: 1px solid #EDF3FC; }
.hist-type { font-size: 0.95rem; color: #1A1A2E; }
.hist-meta { font-size: 0.8rem; color: #5A5A72; }
.min-width-0 { min-width: 0; }
</style>
