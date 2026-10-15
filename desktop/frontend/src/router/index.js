import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { user } from '../services/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true }
  },
  { path: '/', name: 'home', component: HomeView },        // tableau de bord
  {
    path: '/scan',                                          // scanner séparé
    name: 'scan',
    component: () => import('../views/ScanView.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/HistoryView.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue')
  },
  {
    path: '/help',
    name: 'help',
    component: () => import('../views/HelpView.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Garde : toute page sauf /login exige une session ; une session déjà
// ouverte n'a rien à faire sur /login.
router.beforeEach((to) => {
  const authed = !!user.value
  if (to.name === 'login' && authed) return { name: 'home' }
  if (to.meta.public) return true
  if (!authed) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})

export default router
