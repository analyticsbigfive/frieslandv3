<template>
  <div
    class="bg-gray-50 dark:bg-gray-700/50 min-h-full"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
  >
    <!-- Pull-to-refresh indicator -->
    <Transition name="pull">
      <div v-if="pullDistance > 0" class="flex justify-center pt-2 pb-1 overflow-hidden" :style="{ height: `${Math.min(pullDistance, 60)}px` }">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-6 h-6 text-fc-red transition-transform"
          :class="{ 'animate-spin': refreshing }"
          :style="{ transform: `rotate(${Math.min(pullDistance * 3, 360)}deg)` }"
        />
      </div>
    </Transition>

    <!-- Mini Dashboard -->
    <div class="px-4 pt-3 pb-2">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center justify-between mb-2">
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Aujourd'hui</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ todayCount }}<span class="text-sm font-normal text-gray-400"> / {{ dailyTarget }} visites</span></p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <UIcon name="i-heroicons-clipboard-document-check" class="w-6 h-6 text-fc-red" />
          </div>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-500"
            :class="progressPercent >= 100 ? 'bg-emerald-500' : 'bg-fc-red'"
            :style="{ width: `${Math.min(progressPercent, 100)}%` }"
          />
        </div>
        <p class="text-[11px] text-gray-400 mt-1">{{ progressPercent >= 100 ? '🎉 Objectif atteint !' : `${Math.round(progressPercent)}% de l'objectif` }}</p>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="px-4 pt-2 pb-2 flex items-center gap-2">
      <div class="flex-1 relative">
        <UInput
          v-model="search"
          placeholder="Rechercher par PDV, commercial..."
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="w-full"
        />
      </div>
      <UButton
        variant="ghost"
        icon="i-heroicons-funnel"
        size="sm"
        @click="showFilters = !showFilters"
      />
      <UButton
        variant="ghost"
        icon="i-heroicons-arrow-path"
        size="sm"
        :loading="refreshing"
        @click="loadVisites"
      />
    </div>

    <!-- Offline indicator -->
    <div v-if="isOfflineData" class="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
      <UIcon name="i-heroicons-signal-slash" class="w-4 h-4 text-amber-500" />
      <span class="text-xs text-amber-700">Données hors-ligne (cache)</span>
    </div>

    <!-- Filter panel -->
    <div v-if="showFilters" class="px-4 pb-3 space-y-2">
      <UInput v-model="dateFilter" type="date" size="sm" placeholder="Date..." />
    </div>

    <!-- Visites List -->
    <div class="px-4 py-2 space-y-3">
      <!-- Skeleton loaders -->
      <template v-if="loading">
        <div
          v-for="i in 4"
          :key="i"
          class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 rounded w-3/4" />
              <div class="h-3 bg-gray-100 rounded w-1/2" />
            </div>
            <div class="h-5 w-12 bg-gray-100 rounded-full" />
          </div>
          <div class="flex gap-1.5 mt-3">
            <div v-for="j in 4" :key="j" class="h-4 w-10 bg-gray-100 rounded-full" />
          </div>
        </div>
      </template>

      <!-- Real visites -->
      <template v-else>
        <div
          v-for="visite in filteredVisites"
          :key="visite.visite_id"
          class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700"
          @click="viewVisite(visite)"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ getPDVName(visite) }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ formatDate(visite.date_visite) }}
              </p>
            </div>
            <div class="flex items-center gap-1">
              <span
                v-if="visite.geofence_validated"
                class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full"
              >
                GPS ✓
              </span>
              <span
                v-if="visite.sync_status === 'pending'"
                class="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full"
              >
                En attente
              </span>
            </div>
          </div>

          <!-- Product indicators -->
          <div class="flex gap-1.5 mt-3">
            <span
              v-for="cat in ['evap', 'imp', 'scm', 'uht']"
              :key="cat"
              class="text-[10px] px-2 py-0.5 rounded-full font-medium"
              :class="visite.data?.produits?.[cat]?.present
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-400'"
            >
              {{ cat.toUpperCase() }}
            </span>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="!filteredVisites.length"
          class="text-center py-16"
        >
          <div class="w-20 h-20 mx-auto mb-4 bg-red-50 rounded-2xl flex items-center justify-center">
            <UIcon name="i-heroicons-clipboard-document-list" class="w-10 h-10 text-fc-red opacity-50" />
          </div>
          <p class="text-gray-500 dark:text-gray-400 font-medium">Aucune visite</p>
          <p class="text-gray-400 text-sm mt-1">Appuyez sur + pour créer une visite</p>
        </div>
      </template>
    </div>

    <!-- FAB: New Visit -->
    <button
      class="fixed bottom-24 right-4 w-14 h-14 bg-fc-red rounded-full shadow-lg flex items-center justify-center text-white z-40 active:scale-95 transition-transform"
      @click="navigateTo('/mobile/visites/new')"
    >
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Visite } from '~/types'

definePageMeta({
  middleware: ['auth'],
  layout: 'mobile',
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const authStore = useAuthStore()
const { cacheVisites, getCachedVisitesFallback } = useOfflineData()

const visites = ref<Visite[]>([])
const loading = ref(true)
const refreshing = ref(false)
const search = ref('')
const dateFilter = ref('')
const showFilters = ref(false)
const isOfflineData = ref(false)

// Pull-to-refresh state
const pullDistance = ref(0)
const pulling = ref(false)
const startY = ref(0)

const dailyTarget = 10

const todayCount = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return visites.value.filter(v => v.date_visite?.startsWith(today)).length
})

const progressPercent = computed(() => (todayCount.value / dailyTarget) * 100)

const filteredVisites = computed(() => {
  let result = visites.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(v =>
      v.commercial?.toLowerCase().includes(q) ||
      (v as any).pdv?.nom_pdv?.toLowerCase().includes(q) ||
      getPDVName(v).toLowerCase().includes(q)
    )
  }
  if (dateFilter.value) {
    result = result.filter(v =>
      v.date_visite?.startsWith(dateFilter.value)
    )
  }
  return result
})

function formatDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPDVName(visite: Visite) {
  return (visite as any).pdv?.nom_pdv || `PDV ${visite.pdv_id?.substring(0, 8)}`
}

function viewVisite(visite: Visite) {
  navigateTo(`/mobile/visites/${visite.visite_id}`)
}

// Pull-to-refresh handlers
function onTouchStart(e: TouchEvent) {
  if (window.scrollY === 0) {
    startY.value = e.touches[0].clientY
    pulling.value = true
  }
}

function onTouchMove(e: TouchEvent) {
  if (!pulling.value) return
  const diff = e.touches[0].clientY - startY.value
  pullDistance.value = Math.max(0, diff * 0.4)
}

async function onTouchEnd() {
  if (pullDistance.value > 50) {
    refreshing.value = true
    await loadVisites()
    refreshing.value = false
  }
  pullDistance.value = 0
  pulling.value = false
}

async function loadVisites() {
  if (!refreshing.value) loading.value = true
  isOfflineData.value = false

  try {
    if (!authStore.profile) {
      await authStore.fetchProfile()
    }

    const { data, error } = await supabase
      .from('visites')
      .select('visite_id, pdv_id, user_id, commercial, email, date_visite, geofence_validated, sync_status, data, pdv:pdv_id(nom_pdv)')
      .eq('user_id', user.value?.id)
      .order('date_visite', { ascending: false })
      .limit(100)

    if (error) throw error
    visites.value = (data || []) as Visite[]

    // Cache for offline
    if (data?.length) {
      await cacheVisites(data as Visite[])
    }
  }
  catch (err) {
    console.warn('Erreur chargement visites, tentative cache:', err)
    // Offline fallback
    const cached = await getCachedVisitesFallback()
    if (cached) {
      visites.value = cached
      isOfflineData.value = true
    }
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadVisites()
})
</script>
