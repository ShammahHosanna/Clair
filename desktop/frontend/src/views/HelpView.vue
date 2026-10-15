<template>
  <v-row>
    <v-col cols="12" md="6">
      <v-card class="pa-7 elevation-2 fill-height">
        <h2 class="section-title mb-4">
          <v-icon icon="mdi-arm-flex" color="primary" class="mr-2" />
          {{ t('helpView.whatTitle') }}
        </h2>
        <p class="text-body-1" style="color:#1A1A2E">{{ t('helpView.whatBody') }}</p>

        <h2 class="section-title mt-6 mb-4">
          <v-icon icon="mdi-alert-circle-outline" color="warn-orange" class="mr-2" />
          {{ t('helpView.limitTitle') }}
        </h2>
        <p class="text-body-1" style="color:#1A1A2E">{{ t('helpView.limitBody') }}</p>
        <v-alert type="warning" variant="tonal" density="compact" class="mt-4">
          {{ t('verdicts.coherentWarn') }}
        </v-alert>
      </v-card>
    </v-col>

    <v-col cols="12" md="6">
      <v-card class="pa-7 elevation-2 fill-height">
        <h2 class="section-title mb-4">
          <v-icon icon="mdi-check-all" color="ok-green" class="mr-2" />
          {{ t('helpView.stepsTitle') }}
        </h2>
        <ol class="steps-list">
          <li v-for="(s, i) in steps" :key="i">{{ t(`helpView.steps.${i}`) }}</li>
        </ol>

        <v-divider class="my-5" />
        <h3 class="section-sub-title mb-2">{{ t('helpView.apiTitle') }}</h3>
        <v-alert :type="apiOk ? 'success' : 'error'" variant="tonal" density="compact">
          {{ apiOk ? t('helpView.apiOk') : t('helpView.apiKo') }}
        </v-alert>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../services/api'

const { t } = useI18n()
const steps = [0, 1, 2, 3, 4]
const apiOk = ref(false)

onMounted(async () => {
  try { await api.health(); apiOk.value = true } catch { apiOk.value = false }
})
</script>

<style scoped>
.section-title { font-size: 1.25rem; font-weight: 800; color: #1A1A2E; }
.section-sub-title { font-size: 1rem; font-weight: 800; color: #1A1A2E; }
.steps-list { margin: 0 0 0 1.1rem; padding: 0; }
.steps-list li { color: #1A1A2E; font-size: 0.95rem; padding: 0.3rem 0; }
</style>
