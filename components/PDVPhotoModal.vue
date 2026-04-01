<template>
  <div>
    <!-- Trigger button -->
    <button
      type="button"
      class="inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-fc-red hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      :title="pdvName ? `Photo de ${pdvName}` : 'Voir la photo'"
      @click.stop="openModal"
    >
      <UIcon name="i-heroicons-camera" class="w-4 h-4" />
    </button>

    <!-- Modal -->
    <UModal v-model="isOpen" :ui="{ width: 'max-w-lg' }">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
            {{ pdvName || 'Photo du PDV' }}
          </h3>
          <UButton variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="isOpen = false" />
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-red" />
        </div>

        <!-- Photo -->
        <div v-else-if="resolvedUrl" class="relative">
          <img
            :src="resolvedUrl"
            :alt="pdvName || 'Photo PDV'"
            class="w-full rounded-xl object-cover max-h-[400px] bg-gray-100 dark:bg-gray-700"
            @error="imgError = true"
          />
          <div v-if="imgError" class="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl">
            <UIcon name="i-heroicons-photo" class="w-16 h-16 text-gray-300 dark:text-gray-600" />
            <p class="text-sm text-gray-400 mt-2">Image indisponible</p>
          </div>
        </div>

        <!-- No photo -->
        <div v-else class="flex flex-col items-center justify-center py-12 text-gray-400">
          <UIcon name="i-heroicons-camera-slash" class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-3" />
          <p class="text-sm font-medium">Aucune photo disponible</p>
          <p class="text-xs mt-1">Ce point de vente n'a pas encore de photo associée.</p>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
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

const resolvedUrl = computed(() => {
  if (imgError.value) return null
  return props.imageUrl || fetchedUrl.value || null
})

async function openModal() {
  isOpen.value = true
  imgError.value = false

  // Si pas d'imageUrl fourni, charger depuis la base par pdv_id
  if (!props.imageUrl && props.pdvId && !fetchedUrl.value) {
    loading.value = true
    try {
      const { data } = await supabase
        .from('pdv')
        .select('image_url')
        .eq('pdv_id', props.pdvId)
        .single()
      fetchedUrl.value = (data as any)?.image_url || null
    } catch {
      fetchedUrl.value = null
    } finally {
      loading.value = false
    }
  }
}

// Reset fetched URL si le pdvId change
watch(() => props.pdvId, () => {
  fetchedUrl.value = null
  imgError.value = false
})

// Expose openModal pour usage programmatique (ex: carte Leaflet)
defineExpose({ openModal })
</script>
