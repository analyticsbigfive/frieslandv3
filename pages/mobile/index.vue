<template>
  <div class="bg-gray-50 min-h-full">
    <!-- Search & Filter -->
    <div class="px-4 pt-4 pb-2 flex items-center gap-2">
      <div class="flex-1 relative">
        <UInput
          v-model="search"
          placeholder="Rechercher une visite..."
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
        @click="loadVisites"
      />
    </div>

    <!-- Filter panel -->
    <div v-if="showFilters" class="px-4 pb-3 space-y-2">
      <UInput v-model="dateFilter" type="date" size="sm" placeholder="Date..." />
    </div>

    <!-- Visites List -->
    <div class="px-4 py-2 space-y-3">
      <div
        v-for="visite in filteredVisites"
        :key="visite.visite_id"
        class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50"
        @click="viewVisite(visite)"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="text-sm font-semibold text-gray-900">
              {{ getPDVName(visite) }}
            </p>
            <p class="text-xs text-gray-500 mt-0.5">
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
        v-if="!loading && !filteredVisites.length"
        class="text-center py-16"
      >
        <div class="w-20 h-20 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
          <UIcon name="i-heroicons-clipboard-document-list" class="w-10 h-10 text-fc-blue opacity-50" />
        </div>
        <p class="text-gray-500 font-medium">No items</p>
        <p class="text-gray-400 text-sm mt-1">Appuyez sur + pour créer une visite</p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue mx-auto" />
      </div>
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

const visites = ref<Visite[]>([])
const loading = ref(false)
const search = ref('')
const dateFilter = ref('')
const showFilters = ref(false)

const filteredVisites = computed(() => {
  let result = visites.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(v =>
      v.commercial?.toLowerCase().includes(q) ||
      v.pdv_id?.toLowerCase().includes(q)
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

async function loadVisites() {
  loading.value = true
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
  }
  catch (err) {
    console.error('Erreur chargement visites:', err)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadVisites()
})
</script>
