<template>
  <v-card class="pa-7 elevation-2" max-width="640">
    <h2 class="section-title mb-5">{{ t('settingsView.title') }}</h2>

    <div class="mb-6">
      <div class="setting-label mb-2">{{ t('settingsView.language') }}</div>
      <v-btn-toggle v-model="form.lang" color="primary" divided variant="outlined" mandatory @update:model-value="save">
        <v-btn value="fr" class="text-none">Français</v-btn>
        <v-btn value="en" class="text-none">English</v-btn>
      </v-btn-toggle>
    </div>

    <v-switch
      v-model="form.voice" color="primary" inset hide-details
      :label="t('settingsView.voice')" class="mb-2" @update:model-value="save"
    />
    <v-switch
      v-model="form.sound" color="primary" inset hide-details
      :label="t('settingsView.sound')" class="mb-2" @update:model-value="save"
    />
    <v-switch
      v-model="form.notifications" color="primary" inset hide-details
      :label="t('settingsView.notif')" class="mb-2" @update:model-value="onNotifToggle"
    />
    <v-alert v-if="errorNotif" type="warning" variant="tonal" density="compact" class="mt-n3 mb-4 text-body-2">
      {{ t(`settingsView.${errorNotif}`) }}
    </v-alert>
    <v-switch
      v-model="form.offlineMode" color="primary" inset hide-details
      :label="t('settingsView.offline')" class="mb-4" @update:model-value="save"
    />

    <v-divider class="my-4" />
    <p class="text-body-2 text-medium-emphasis d-flex align-center">
      <v-icon icon="mdi-shield-lock-outline" class="mr-2" color="primary" />
      {{ t('settingsView.privacy') }}
    </p>

    <v-snackbar v-model="saved" timeout="2500" color="ok-green">
      {{ t('settingsView.saved') }}
    </v-snackbar>
  </v-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../services/api'
import { requestNotifPermission, sendNotification, notifState } from '../composables/useNotifications'

const { t, locale } = useI18n()
const form = reactive({ lang: 'fr', voice: true, sound: true, notifications: true, offlineMode: false })
const saved = ref(false)
const errorNotif = ref(null)

function onNotifToggle() {
  askNotify(form.notifications)
  save()
}

onMounted(async () => {
  try { Object.assign(form, await api.getSettings()) } catch { /* valeurs par défaut */ }
  // réconciliation : si la permission n'a pas été accordée, on l'affiche franchement
  if (form.notifications) {
    const state = notifState()
    if (state === 'denied') errorNotif.value = 'notifDenied'
    else if (state === 'unsupported') errorNotif.value = 'notifUnsupported'
  }
})

/** Demande la permission uniquement sur l'action utilisateur (clic).
    Sans accord réel, on annule l'intention et on l'explique : pas de réglage
    qui fait semblant. */
async function askNotify(on) {
  if (!on) { saved.value = true; return }
  const state = await requestNotifPermission()
  if (state === 'granted') {
    sendNotification('CLAIR', t('settingsView.notifGranted'))
    errorNotif.value = null
  } else if (state === 'unsupported') {
    errorNotif.value = 'notifUnsupported'
    form.notifications = false
  } else {
    errorNotif.value = 'notifDenied'
    form.notifications = false
  }
}

async function save() {
  try {
    const updated = await api.putSettings({ ...form })
    Object.assign(form, updated)
    locale.value = form.lang
    saved.value = true
  } catch { /* silencieux : préférences locales conservées */ }
}
</script>

<style scoped>
.section-title { font-size: 1.3rem; font-weight: 800; color: #1A1A2E; }
.setting-label { font-weight: 700; color: #1A1A2E; }
</style>
