// Clair Desktop — amorçage de l'application
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'

// Langue choisie sur la page de connexion (ou dans les Paramètres), mémorisée localement.
i18n.global.locale.value = (() => {
  try { return localStorage.getItem('clair.desktop.lang') || 'fr' } catch { return 'fr' }
})()

const ThemeClair = {
  dark: false,
  colors: {
    primary: '#0866E8',
    'nav-dark': '#12296B',
    'electric': '#0866E8',
    'page-bg': '#F0F7FF',
    surface: '#FFFFFF',
    'ok-green': '#00A86B',
    'warn-orange': '#FF8A00',
    'danger-red': '#EF3038',
    'ink': '#1A1A2E',
    'ink-soft': '#5A5A72',
    'line-light': '#D6E6FA'
  }
}

// Langue choisie sur la page de connexion (ou dans les Paramètres), mémorisée localement.
let savedLang = 'fr'
try { savedLang = localStorage.getItem('clair.desktop.lang') || 'fr' } catch { /* sandbox */ }

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'clair',
    themes: { clair: ThemeClair }
  },
  defaults: {
    VBtn: { rounded: 'lg', style: 'text-transform:none;' },
    VCard: { rounded: 'xl' }
  }
})

createApp(App).use(vuetify).use(router).use(i18n).mount('#app')
