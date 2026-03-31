<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-fc-blue text-white px-4 py-3 flex items-center gap-3">
      <button @click="router.back()">
        <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
      </button>
      <h1 class="font-bold text-lg">Détail Visite</h1>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-fc-blue animate-spin" />
    </div>

    <div v-else-if="!visite" class="px-4 py-20 text-center text-gray-400">
      <UIcon name="i-heroicons-clipboard-document-list" class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>Visite introuvable</p>
    </div>

    <div v-else-if="visite" class="px-4 py-4 space-y-4 pb-24">
      <!-- Info card -->
      <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">#{{ visite.visite_id }}</span>
          <span
            class="text-xs font-medium px-2 py-1 rounded-full"
            :class="visite.geofence_validated ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'"
          >
            {{ visite.geofence_validated ? '✓ GPS validé' : '⚠ GPS non validé' }}
          </span>
        </div>
        <h2 class="text-lg font-bold text-gray-900">{{ pdvName }}</h2>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span class="text-gray-400 text-xs">Date</span>
            <p class="font-medium">{{ formatDate(visite.date_visite) }}</p>
          </div>
          <div>
            <span class="text-gray-400 text-xs">Commercial</span>
            <p class="font-medium">{{ visite.commercial }}</p>
          </div>
        </div>
      </div>

      <!-- Produits -->
      <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 class="font-bold text-sm text-gray-900">Produits</h3>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="cat in productCategories"
            :key="cat.key"
            class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
          >
            <span class="text-sm font-medium text-gray-700">{{ cat.label }}</span>
            <span
              :class="visite.data?.produits?.[cat.key]?.present ? 'text-green-500' : 'text-red-500'"
              class="text-xs font-bold"
            >
              {{ visite.data?.produits?.[cat.key]?.present ? 'OUI' : 'NON' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Concurrence -->
      <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 class="font-bold text-sm text-gray-900">Concurrence</h3>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">Présence de concurrents :</span>
          <span
            :class="visite.data?.concurrence?.presence_concurrents ? 'text-red-500' : 'text-green-500'"
            class="font-bold text-sm"
          >
            {{ visite.data?.concurrence?.presence_concurrents ? 'OUI' : 'NON' }}
          </span>
        </div>
        <div v-if="visite.data?.concurrence?.presence_concurrents" class="grid grid-cols-2 gap-2">
          <div
            v-for="cat in concurrenceCategories"
            :key="cat.key"
            class="bg-gray-50 rounded-lg px-3 py-2"
          >
            <span class="text-xs text-gray-500">{{ cat.label }}</span>
            <p
              :class="visite.data?.concurrence?.[cat.key]?.present ? 'text-red-500' : 'text-green-500'"
              class="text-sm font-bold"
            >
              {{ visite.data?.concurrence?.[cat.key]?.present ? 'Présent' : 'Absent' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 class="font-bold text-sm text-gray-900">Actions réalisées</h3>
        <div class="space-y-2">
          <div
            v-for="action in actionsList"
            :key="action.key"
            class="flex items-center gap-2"
          >
            <UIcon
              :name="visite.data?.actions?.[action.key] ? 'i-heroicons-check-circle-solid' : 'i-heroicons-x-circle-solid'"
              :class="visite.data?.actions?.[action.key] ? 'text-green-500' : 'text-gray-300'"
              class="w-5 h-5"
            />
            <span class="text-sm text-gray-700">{{ action.label }}</span>
          </div>
        </div>
      </div>

      <!-- Images -->
      <div v-if="visite.image_urls?.length" class="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 class="font-bold text-sm text-gray-900">Photos</h3>
        <div class="grid grid-cols-2 gap-2">
          <img
            v-for="(url, idx) in visite.image_urls"
            :key="idx"
            :src="url"
            class="w-full h-32 object-cover rounded-lg"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
  layout: false,
})

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const authStore = useAuthStore()
const user = useSupabaseUser()
const { isPrivileged, matchesVisiteScope } = useUserScope()

const visite = ref<any>(null)
const loading = ref(true)
const pdvName = ref('')

const productCategories = [
  { key: 'evap', label: 'EVAP' },
  { key: 'imp', label: 'IMP' },
  { key: 'scm', label: 'SCM' },
  { key: 'uht', label: 'UHT' },
  { key: 'yaourt', label: 'YAOURT' },
]

const concurrenceCategories = [
  { key: 'evap', label: 'EVAP' },
  { key: 'imp', label: 'IMP' },
  { key: 'scm', label: 'SCM' },
  { key: 'uht', label: 'UHT' },
]

const actionsList = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Exécution activités promo.' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: 'Pose d\'affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose matériel visibilité' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

onMounted(async () => {
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  const id = route.params.id as string
  let query = supabase
    .from('visites')
    .select('visite_id, pdv_id, user_id, commercial, email, date_visite, geofence_validated, data, image_urls, pdv:pdv_id(nom_pdv)')
    .eq('visite_id', id)
 
  if (!isPrivileged()) {
    query = query.eq('user_id', user.value?.id)
  }

  const { data } = await query.single()

  if (data && matchesVisiteScope(data)) {
    visite.value = data
    pdvName.value = data.pdv?.nom_pdv || data.pdv_id
  }
  else {
    visite.value = null
  }
  loading.value = false
})
</script>
