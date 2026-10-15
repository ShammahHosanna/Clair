<template>
  <div class="login-wrap d-flex align-center justify-center fill-height">
    <v-container fluid class="fill-height">
      <v-row align="center" justify="center">
        <v-col cols="12" sm="8" md="6" lg="4">
          <v-card class="login-card pa-8 elevation-4">
            <!-- Logo + nom -->
            <div class="text-center mb-6">
              <div class="brand-mark-lg mx-auto mb-3">
                <v-icon icon="mdi-shield-check" size="30" color="white" />
              </div>
              <div class="login-brand">CLAIR</div>
              <p class="login-tagline mt-1 mb-0">{{ t('auth.tagline') }}</p>
            </div>

            <h1 class="login-title mb-1">{{ t('auth.title') }}</h1>
            <p class="login-sub mb-6">{{ t('auth.subtitle') }}</p>

            <!-- Formulaire -->
            <v-form @submit.prevent="submit">
              <v-text-field
                v-model="name"
                :label="t('auth.nameLabel')"
                prepend-inner-icon="mdi-account-outline"
                variant="outlined"
                density="comfortable"
                autocomplete="username"
                :error-messages="fieldErrors.name"
                class="mb-2"
              />
              <v-text-field
                v-model="password"
                :label="t('auth.passwordLabel')"
                prepend-inner-icon="mdi-lock-outline"
                variant="outlined"
                density="comfortable"
                autocomplete="current-password"
                :type="showPwd ? 'text' : 'password'"
                :error-messages="fieldErrors.password"
                :append-inner-icon="showPwd ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showPwd = !showPwd"
              />

              <v-alert
                v-if="formError"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-3 mb-1 text-body-2"
              >
                {{ t(`auth.${formError}`) }}
              </v-alert>

              <v-btn
                type="submit"
                color="electric"
                size="x-large"
                block
                class="login-btn mt-4 text-none"
                :loading="loading"
                :disabled="loading"
                prepend-icon="mdi-login-variant"
              >
                {{ loading ? t('auth.logging') : t('auth.loginBtn') }}
              </v-btn>
            </v-form>

            <v-divider class="my-5" :opacity="0.3" />

            <p class="login-hint mb-3">
              <v-icon icon="mdi-information-outline" size="16" class="mr-1" />
              {{ t('auth.firstTime') }}
            </p>
            <p class="login-hint mb-0">
              <v-icon icon="mdi-shield-lock-outline" size="16" class="mr-1" />
              {{ t('auth.localOnly') }}
            </p>

            <!-- Bascule langue -->
            <div class="d-flex justify-center ga-2 mt-6">
              <v-btn
                v-for="l in ['fr', 'en']" :key="l"
                size="small" variant="text"
                class="text-none text-lowercase"
                :color="locale === l ? 'primary' : 'ink-soft'"
                @click="setLocale(l)"
              >{{ l.toUpperCase() }}</v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { login } from '../services/auth'

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()

const name = ref('')
const password = ref('')
const showPwd = ref(false)
const loading = ref(false)
const fieldErrors = ref({})
const formError = ref(null)

function setLocale(l) {
  locale.value = l
  try { localStorage.setItem('clair.desktop.lang', l) } catch { /* ignore */ }
}

function submit() {
  fieldErrors.value = {}
  formError.value = null
  if (!name.value || name.value.trim().length < 2) {
    fieldErrors.value.name = t('auth.badName')
    return
  }
  if (!password.value || password.value.length < 4) {
    fieldErrors.value.password = t('auth.badPassword')
    return
  }
  loading.value = true
  // session purement locale : bascule immédiate, pas d'appel réseau
  const res = login(name.value, password.value)
  loading.value = false
  if (!res.ok) { formError.value = res.error; return }
  // redirection vers l'accueil (ou la page d'où on venait)
  router.push(route.query.redirect || { name: 'home' })
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  background: linear-gradient(155deg, #12296B 0%, #0C3FA8 55%, #0866E8 100%);
  background-attachment: fixed;
}
.login-card { border-radius: 24px; }
.brand-mark-lg {
  width: 64px; height: 64px;
  border-radius: 18px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, #0866E8 0%, #12296B 100%);
  box-shadow: 0 8px 24px rgba(18, 41, 107, .35);
}
.login-brand {
  font-size: 1.7rem; font-weight: 800;
  letter-spacing: .14em; color: #1A1A2E;
  line-height: 1.1;
}
.login-tagline { color: #5A5A72; font-size: .85rem; }
.login-title { font-size: 1.35rem; font-weight: 800; color: #1A1A2E; }
.login-sub { color: #5A5A72; font-size: .95rem; }
.login-btn { font-weight: 800; box-shadow: 0 4px 14px rgba(8, 102, 232, .35); }
.login-hint { color: #5A5A72; font-size: .8rem; line-height: 1.5; }
.login-hint .v-icon { vertical-align: -2px; }
</style>
