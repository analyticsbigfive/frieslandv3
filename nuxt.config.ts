// https://nuxt.com/docs/api/configuration/nuxt-config
const isProduction = process.env.NODE_ENV === 'production'
const devtoolsEnabled = process.env.NUXT_DEVTOOLS === 'true'
// Build natif Capacitor : SPA statique, sans service worker PWA
// (un SW dans la WebView provoque des caches fantômes après mise à jour d'APK).
const isCapacitor = process.env.CAPACITOR_BUILD === '1'

export default defineNuxtConfig({
  ssr: !isCapacitor,

  // buildDir isolé pour le build natif : évite d'écraser le .nuxt du
  // serveur `nuxt dev` (schéma corrompu si un build APK tourne en parallèle).
  ...(isCapacitor ? { buildDir: '.nuxt-native' } : {}),

  devtools: { enabled: devtoolsEnabled },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    ...(isProduction && !isCapacitor ? ['@vite-pwa/nuxt'] : []),
  ],

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    // Utilisée uniquement par les routes serveur /api/admin/* (bypass RLS).
    // Le module attend SUPABASE_SERVICE_KEY par défaut : on mappe notre variable.
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    redirect: false,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login'],
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
    clientOptions: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  },

  pinia: {
    storesDirs: ['./stores/**'],
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Friesland Bonnet Rouge',
      short_name: 'Friesland',
      description: 'Application de collecte terrain Friesland Bonnet Rouge',
      theme_color: '#C8102E',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
        { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
        { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
        { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
        { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/iirgolfjwdnnesamzcbd\.supabase\.co\/rest\/v1\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-api-cache',
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/iirgolfjwdnnesamzcbd\.supabase\.co\/storage\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'supabase-storage-cache',
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },

  app: {
    head: {
      title: 'Friesland Bonnet Rouge',
      meta: [
        { name: 'description', content: 'Application de collecte terrain Friesland Bonnet Rouge' },
        { name: 'theme-color', content: '#C8102E' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'referrer', content: 'strict-origin-when-cross-origin' },
        // Note: X-Frame-Options / X-Content-Type-Options sont servis en en-têtes HTTP (voir nitro.routeRules)
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192x192.png' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      geofenceRadius: 200, // TODO confirmer client (valeur réunion : 200 m)
      gpsMinAccuracy: 10,
      // Tracking de tournée (app native) : échantillonnage GPS régulier,
      // filtre distance mini entre points, envoi groupé par batch.
      // Intervalle à 2 min = compromis autonomie batterie / finesse du trajet.
      trackingIntervalMs: 120_000,
      trackingDistanceM: 15,
      trackingFlushMs: 5 * 60_000,
      trackingBatchMax: 200,
    },
  },

  // Désactive le manifeste d'app (évite l'erreur dev "#app-manifest" / 404 builds/meta/*.json).
  // L'app n'utilise pas les route rules basées sur le manifeste client.
  experimental: {
    appManifest: false,
  },

  // En-têtes de sécurité servis en HTTP (X-Frame-Options ne fonctionne pas en <meta>).
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    },
  },

  compatibilityDate: '2025-01-01',
})
