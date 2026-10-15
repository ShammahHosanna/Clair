<template>
  <!-- Page d'authentification : écran dédié, sans navigation -->
  <v-app v-if="isLogin" class="clair-app login-app">
    <v-main class="login-main fill-height">
      <router-view :key="$route.fullPath" />
    </v-main>
  </v-app>

  <v-app v-else class="clair-app">
    <!-- ==================== A. Menu latéral gauche ==================== -->
    <v-navigation-drawer
      permanent
      :width="272"
      class="side-nav-dark"
      color="nav-dark"
    >
      <!-- Logo + nom + slogan -->
      <div class="d-flex align-center pa-5">
        <div class="brand-mark elevation-2">
          <v-icon icon="mdi-shield-check" size="26" color="white" />
        </div>
        <div class="ml-3">
          <div class="brand-name text-white">CLAIR</div>
          <div class="brand-slogan">{{ t('slogan') }}</div>
        </div>
      </div>
      <v-divider :opacity="0.18" class="mb-2" />

      <!-- Navigation -->
      <v-list nav density="comfortable">
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :title="t(item.label)"
          :prepend-icon="item.icon"
          :active="isActive(item)"
          :to="item.to"
          class="nav-item rounded-lg"
          color="electric"
          base-color="rgba(255,255,255,.78)"
        />
      </v-list>

      <template #append>
        <!-- Illustration commerçant + message -->
        <div class="pa-4 pb-5">
          <svg viewBox="0 0 220 120" class="w-100" role="img" :aria-label="t('banner.reliable')">
            <rect x="6" y="8" width="208" height="106" rx="14" fill="rgba(255,255,255,0.07)" />
            <rect x="52" y="30" width="52" height="86" rx="8" fill="#0866E8" opacity="0.9"/>
            <rect x="56" y="36" width="44" height="66" rx="4" fill="#F0F7FF"/>
            <rect x="60" y="42" width="36" height="10" rx="2" fill="#12296B" opacity="0.85"/>
            <rect x="60" y="56" width="36" height="4" rx="2" fill="#00A86B"/>
            <rect x="60" y="64" width="24" height="4" rx="2" fill="#5A5A72"/>
            <path d="M120 96 q14 -22 34 -22 q20 0 34 22 z" fill="#F2B705" opacity="0.85"/>
            <circle cx="154" cy="62" r="10" fill="#F2B705"/>
            <path d="M146 60 a8 8 0 0 1 16 0 z" fill="#8A5A00"/>
            <circle cx="150" cy="50" r="12" fill="#F2B705"/>
            <path d="M138 50 a12 12 0 0 1 24 0 z" fill="#8A5A00"/>
            <path d="M62 96 h44" stroke="#00A86B" stroke-width="3" stroke-linecap="round"/>
            <path d="M180 40 l8 8 M188 40 l-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
            <path d="M40 30 h10 M45 25 v10" stroke="rgba(255,255,255,0.5)" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <p class="side-foot-text mt-2 mb-0 text-center">
            {{ t('side.protect') }}
          </p>
        </div>
      </template>
    </v-navigation-drawer>

    <!-- ==================== B. Barre supérieure ==================== -->
    <v-main class="page-bg flex-grow-1">
      <v-app-bar flat density="comfortable" color="page-bg" class="top-bar">
        <v-text-field
          v-model="search"
          :label="t('topbar.search')"
          prepend-inner-icon="mdi-magnify"
          density="comfortable"
          variant="outlined"
          hide-details
          max-width="420"
          class="ml-4 mt-3"
          rounded="lg"
        />
        <v-spacer />
        <v-btn icon class="mr-2" :aria-label="t('results.details')" to="/history">
          <v-badge v-if="fraudePending > 0" :content="fraudePending" color="danger-red" floating>
            <v-icon icon="mdi-bell-outline" />
          </v-badge>
          <v-icon v-else icon="mdi-bell-outline" />
        </v-btn>
        <div class="d-flex align-center mr-4">
          <v-avatar size="38" class="mr-3" color="electric">
            <span class="text-white font-weight-bold">{{ initials }}</span>
          </v-avatar>
          <div class="mr-4 d-none d-lg-block">
            <div class="user-name">{{ userName }}</div>
            <div class="user-role">{{ t('topbar.merchant') }}</div>
          </div>
          <v-chip
            :color="online ? 'ok-green' : 'danger-red'"
            variant="tonal" size="small" class="mr-3 font-weight-bold"
            :prepend-icon="online ? 'mdi-wifi' : 'mdi-wifi-off'"
          >
            {{ online ? t('topbar.online') : t('topbar.offline') }}
          </v-chip>
          <v-menu>
            <template #activator="{ props }">
              <v-btn icon="mdi-chevron-down" v-bind="props" variant="text" :aria-label="t('topbar.profile')" />
            </template>
            <v-list density="compact" class="rounded-lg">
              <v-list-item prepend-icon="mdi-account-outline" :title="userName" :subtitle="t('topbar.merchant')" />
              <v-list-item prepend-icon="mdi-database-outline" :title="t('topbar.myData')" to="/history" />
              <v-list-item prepend-icon="mdi-logout" :title="t('topbar.logout')" @click="onLogout" />
            </v-list>
          </v-menu>
        </div>
      </v-app-bar>

      <!-- Bandeau hors-ligne -->
      <v-banner v-if="!online" sticky class="offline-banner" bg="warn-orange" icon="mdi-wifi-off">
        {{ t('offline.banner') }}
      </v-banner>

      <v-container fluid class="pa-6 pt-4">
        <router-view :key="$route.fullPath" :search="search" />
      </v-container>

      <!-- ==================== H. Pied de page ==================== -->
      <v-footer class="app-footer bg-transparent px-6 pb-4">
        <div>
          <span class="font-weight-bold">{{ t('footer.version') }}</span>
          <span class="ml-2 footer-muted">· {{ t('footer.event') }}</span>
        </div>
        <v-spacer />
        <div class="d-flex align-center">
          <v-icon icon="mdi-shield-check" size="18" color="primary" class="mr-2" />
          <span class="footer-muted">{{ t('footer.shield') }}</span>
        </div>
      </v-footer>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from './services/api'
import { user, initials as toInitials, logout } from './services/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const search = ref('')
const online = ref(navigator.onLine)

// badge réel : analyse « fraude » sans preuve de solde confirmée, pas un 3 codé en dur
const fraudePending = ref(0)
async function refreshBadge() {
  try {
    const items = await api.history()
    fraudePending.value = items.filter(e => e.verdict === 'fraude' && e.balanceOk == null).length
  } catch { fraudePending.value = 0 }
}
watch(() => route.fullPath, refreshBadge)

const isLogin = computed(() => route.name === 'login')
const userName = computed(() => user.value?.name || '—')
const initials = computed(() => toInitials(user.value?.name))

window.addEventListener('online', () => (online.value = true))
window.addEventListener('offline', () => (online.value = false))

const navItems = [
  { to: '/', label: 'nav.home', icon: 'mdi-home-outline' },
  { to: '/scan', label: 'nav.scan', icon: 'mdi-scan-helper' },
  { to: '/history', label: 'nav.history', icon: 'mdi-history' },
  { to: '/settings', label: 'nav.settings', icon: 'mdi-cog-outline' },
  { to: '/help', label: 'nav.help', icon: 'mdi-help-circle-outline' }
]

function isActive(item) {
  if (item.to === '/') return ['home', 'scan'].includes(route.name)
  return route.name === item.to.replace('/', '')
}

function onLogout() {
  logout()               // ferme la session locale et vide la session réactive
  search.value = ''
  router.push({ name: 'login' })
}

// sonde d'état du backend (utilisée par la vue Aide aussi)
api.health().catch(() => {})
</script>

<style>
/* ====== Styles globaux Clair Desktop ====== */
.clair-app { background: #F0F7FF; }

/* A. Barre latérale */
.side-nav-dark { border-right: none !important; }
.brand-mark {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, #0866E8 0%, #12296B 100%);
}
.brand-name {
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 1.55rem; font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.1;
}
.brand-slogan {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.65);
  max-width: 12rem;
  line-height: 1.35;
}
.nav-item.v-list-item--active {
  background: linear-gradient(90deg, #0866E8 70%, #3D8BFF 100%);
  color: #fff !important;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(8, 102, 232, .35);
}
.nav-item.v-list-item--active .v-list-item-title { color: #fff !important; font-weight: 700; }
.side-foot-text {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.78rem;
  line-height: 1.4;
}

/* B. Barre supérieure */
.top-bar { border-bottom: 1px solid #D6E6FA; }
.user-name { font-size: 0.9rem; font-weight: 700; color: #1A1A2E; line-height: 1.15; }
.user-role { font-size: 0.76rem; color: #5A5A72; }
.offline-banner { color: #fff; font-weight: 600; }

/* Pied de page */
.app-footer { font-size: 0.8rem; }
.footer-muted { color: #5A5A72; }

/* Scrollbar discrète */
.page-bg::-webkit-scrollbar { width: 10px; }
.page-bg::-webkit-scrollbar-thumb { background: #C9DCF5; border-radius: 8px; }
</style>
