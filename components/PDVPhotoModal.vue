<template>
  <div>
    <!-- Déclencheur : icône seule dans une cellule de tableau, nommée pour les lecteurs d'écran. -->
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:focus-visible:ring-brand-400"
      :title="libelleOuvrir"
      :aria-label="libelleOuvrir"
      @click.stop="openModal"
    >
      <UIcon name="i-heroicons-camera" class="h-4 w-4" aria-hidden="true" />
    </button>

    <UModal v-model="isOpen" :ui="{ width: 'w-full sm:max-w-lg' }" :aria-label="titre">
      <div class="p-5 sm:p-6">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ titre }}</h2>
            <p v-if="pdvName" class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Photo du point de vente</p>
          </div>
          <UButton aria-label="Fermer" color="gray" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="isOpen = false" />
        </div>

        <ChargementContenu v-if="loading" variante="compact" libelle="Chargement de la photo…" class="flex justify-center py-10" />

        <!-- Photo enregistrée mais impossible à afficher (fichier introuvable, connexion) -->
        <div v-else-if="imgError || erreurChargement" class="flex flex-col items-center justify-center rounded-lg bg-slate-50 px-4 py-10 text-center dark:bg-slate-700/40" role="alert">
          <UIcon name="i-heroicons-exclamation-triangle" class="mb-3 h-10 w-10 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <p class="text-sm font-semibold text-slate-900 dark:text-white">La photo n'a pas pu s'afficher</p>
          <p class="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-300">
            Vérifiez votre connexion, puis rouvrez la photo. Si le problème continue, le fichier n'est peut-être plus disponible.
          </p>
        </div>

        <img
          v-else-if="resolvedUrl"
          :src="resolvedUrl"
          :alt="pdvName ? `Photo du point de vente ${pdvName}` : 'Photo du point de vente'"
          class="max-h-[400px] w-full rounded-lg bg-slate-100 object-cover dark:bg-slate-700"
          @error="imgError = true"
        />

        <div v-else class="flex flex-col items-center justify-center rounded-lg bg-slate-50 px-4 py-10 text-center dark:bg-slate-700/40">
          <UIcon name="i-heroicons-camera" class="mb-3 h-10 w-10 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Pas de photo pour ce point de vente</p>
          <p class="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-300">
            Les photos prises pendant les visites restent visibles dans le détail de chaque visite.
          </p>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { photosAffichables } from '~/utils/visitePhotos'

const props = defineProps<{
  /** URL directe de l'image (si déjà disponible) */
  imageUrl?: string | null
  /** pdv_id pour charger l'image depuis la base si imageUrl non fourni */
  pdvId?: string | null
  /** Nom du PDV pour le titre */
  pdvName?: string | null
}>()

const supabase = useSupabaseClient()
const isOpen = ref(false)
const loading = ref(false)
const fetchedUrl = ref<string | null>(null)
const imgError = ref(false)
// Lecture de la photo en base impossible (réseau, droits) : distinct de « pas de photo ».
const erreurChargement = ref(false)

const titre = computed(() => props.pdvName || 'Photo du point de vente')
const libelleOuvrir = computed(() => props.pdvName ? `Voir la photo de ${props.pdvName}` : 'Voir la photo du point de vente')

const resolvedUrl = computed(() => {
  if (imgError.value) return null
  // Même règle que les photos de visite (photosAffichables) : un chemin
  // AppSheet relatif non migré donne "Aucune photo", pas une vignette cassée.
  return photosAffichables([props.imageUrl || fetchedUrl.value])[0] ?? null
})

async function openModal() {
  isOpen.value = true
  imgError.value = false
  erreurChargement.value = false

  // Si pas d'imageUrl fourni, charger depuis la base par pdv_id
  if (!props.imageUrl && props.pdvId && !fetchedUrl.value) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('pdv')
        .select('image_url')
        .eq('pdv_id', props.pdvId)
        .single()
      // PGRST116 : point de vente introuvable, traité comme « pas de photo ».
      if (error && error.code !== 'PGRST116') throw error
      fetchedUrl.value = (data as any)?.image_url || null
    } catch (err) {
      console.error('Photo du point de vente illisible', err)
      fetchedUrl.value = null
      erreurChargement.value = true
    } finally {
      loading.value = false
    }
  }
}

// Reset fetched URL si le pdvId change
watch(() => props.pdvId, () => {
  fetchedUrl.value = null
  imgError.value = false
  erreurChargement.value = false
})

// Expose openModal pour usage programmatique (ex: carte Leaflet)
defineExpose({ openModal })
</script>
