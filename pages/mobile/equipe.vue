<template>
  <div class="mobile-page">
    <div class="space-y-3 p-4">
      <div class="flex items-center gap-2">
        <UInput
          v-model="search"
          icon="i-heroicons-magnifying-glass"
          placeholder="PDV ou merchandiseur…"
          size="lg"
          class="min-w-0 flex-1"
          aria-label="Rechercher une visite de l'équipe"
        />
        <UInput v-model="dateFilter" type="date" size="lg" class="w-40" aria-label="Filtrer par date" />
      </div>
      <div v-if="aUneEquipe" class="flex gap-2" aria-label="Filtrer les visites">
        <button
          v-for="f in filtresEquipe"
          :key="f.value"
          type="button"
          class="min-h-9 rounded-full px-3 text-xs font-semibold transition-colors"
          :class="filtreEquipe === f.value ? 'bg-fc-red text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
          :aria-pressed="filtreEquipe === f.value"
          @click="filtreEquipe = f.value"
        >
          {{ f.label }}
        </button>
      </div>
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{{ filtered.length }} visite{{ filtered.length > 1 ? 's' : '' }} · {{ perimetreLabel }}</span>
        <span v-if="todayCount" class="font-semibold text-fc-red">{{ todayCount }} aujourd'hui</span>
      </div>
    </div>

    <div v-if="loading" class="space-y-3 px-4">
      <div v-for="i in 5" :key="i" class="mobile-card animate-pulse p-4">
        <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div class="mt-2 h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    </div>

    <div v-else-if="filtered.length" class="space-y-3 px-4">
      <article
        v-for="v in filtered"
        :key="v.visite_id"
        class="mobile-card cursor-pointer p-4 transition-colors hover:bg-red-50/40 dark:hover:bg-red-950/20"
        role="button"
        tabindex="0"
        :aria-label="`Ouvrir la visite de ${v.commercial} chez ${nomPdv(v)}`"
        @click="navigateTo(`/mobile/visites/${v.visite_id}`)"
        @keydown.enter="navigateTo(`/mobile/visites/${v.visite_id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate font-bold text-gray-900 dark:text-gray-100">{{ nomPdv(v) }}</h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              <UIcon name="i-heroicons-user" class="mr-0.5 inline h-3 w-3" />{{ v.commercial || v.email }}
            </p>
          </div>
          <UBadge :color="statutColor(v.status)" variant="subtle" size="xs">{{ statutLabel(v.status) }}</UBadge>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span><UIcon name="i-heroicons-calendar" class="mr-0.5 inline h-3 w-3" />{{ formatDate(v.date_visite) }}</span>
          <span><UIcon name="i-heroicons-clock" class="mr-0.5 inline h-3 w-3" />{{ formatTime(v.date_visite) }}</span>
          <span v-if="(v as any).pdv?.zone">{{ (v as any).pdv.zone }}</span>
          <span :class="v.geofence_validated ? 'text-green-600' : 'text-orange-500'">
            {{ v.geofence_validated ? 'GPS validé' : 'GPS non validé' }}
          </span>
        </div>
      </article>
    </div>

    <div v-else class="px-4 py-14 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
        <UIcon name="i-heroicons-users" class="h-8 w-8 text-fc-red" />
      </div>
      <p class="font-semibold text-gray-700 dark:text-gray-200">Aucune visite dans le périmètre</p>
      <p class="mx-auto mt-1 max-w-[260px] text-sm text-gray-500 dark:text-gray-400">
        Les visites des merchandiseurs de vos territoires apparaîtront ici.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Suivi des visites de l'équipe (lot 3.1). La RLS limite déjà les lignes au
// périmètre du commercial (territoires + quartiers) ; la requête ne filtre
// donc pas par user_id, contrairement à /mobile.
import type { Visite } from '~/types'
import { profileTerritories } from '~/composables/useUserScope'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const supabase = useSupabaseClient()
const authStore = useAuthStore()

const visites = ref<Visite[]>([])
const loading = ref(true)
const search = ref('')
const dateFilter = ref('')

const perimetreLabel = computed(() => {
  const t = profileTerritories(authStore.profile)
  if (!t.length) return 'tout le réseau'
  return t.length <= 2 ? t.join(', ') : `${t.length} territoires`
})

const todayCount = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return visites.value.filter(v => v.date_visite?.startsWith(today)).length
})

// Équipe assignée (profiles.commercial_id) : permet de distinguer « mes
// merchandiseurs » de « tous ceux qui passent sur mes territoires ».
const { aUneEquipe, estDeMonEquipe, charger: chargerEquipe } = useMonEquipe()
const filtreEquipe = ref<'tous' | 'equipe'>('tous')
const filtresEquipe = [
  { value: 'tous' as const, label: 'Tout le territoire' },
  { value: 'equipe' as const, label: 'Mon équipe' },
]

const filtered = computed(() => {
  let list = visites.value
  if (filtreEquipe.value === 'equipe') list = list.filter(v => estDeMonEquipe(v.user_id))
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(v => nomPdv(v).toLowerCase().includes(q) || v.commercial?.toLowerCase().includes(q))
  }
  if (dateFilter.value) list = list.filter(v => v.date_visite?.startsWith(dateFilter.value))
  return list
})

function nomPdv(v: Visite) {
  return (v as any).pdv?.nom_pdv || `PDV ${v.pdv_id?.substring(0, 8)}`
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function statutLabel(s?: string) {
  return s === 'validé' ? 'Validée' : s === 'rejeté' ? 'Rejetée' : 'Soumise'
}
function statutColor(s?: string) {
  return s === 'validé' ? 'green' : s === 'rejeté' ? 'red' : 'blue'
}

onMounted(async () => {
  try {
    if (!authStore.profile) await authStore.fetchProfile()
    void chargerEquipe()
    const { data, error } = await supabase
      .from('visites')
      .select('visite_id, pdv_id, user_id, commercial, email, date_visite, geofence_validated, status, pdv:pdv_id(nom_pdv, zone)')
      .order('date_visite', { ascending: false })
      .limit(200)
    if (error) throw error
    visites.value = (data || []) as Visite[]
  }
  catch (err) {
    console.warn('Suivi équipe : chargement impossible', err)
  }
  finally {
    loading.value = false
  }
})
</script>
