<template>
  <div class="pb-20">
    <!-- Search -->
    <div class="p-4 space-y-3">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Rechercher un PDV..."
        size="lg"
        class="w-full"
      />
      <div class="flex gap-2 overflow-x-auto pb-1">
        <UBadge
          v-for="zone in zones"
          :key="zone"
          :color="selectedZone === zone ? 'blue' : 'gray'"
          variant="solid"
          class="cursor-pointer whitespace-nowrap"
          @click="selectedZone = selectedZone === zone ? '' : zone"
        >
          {{ zone }}
        </UBadge>
      </div>
    </div>

    <!-- PDV List -->
    <div class="px-4 space-y-3">
      <div
        v-for="pdv in filteredPDV"
        :key="pdv.pdv_id"
        class="bg-white rounded-xl shadow-sm p-4"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-bold text-gray-900">{{ pdv.nom_pdv }}</h3>
            <p class="text-xs text-gray-400 mt-1">{{ pdv.zone }} — {{ pdv.region }}</p>
            <div class="flex gap-2 mt-2">
              <UBadge variant="subtle" color="blue" size="xs">{{ pdv.canal }}</UBadge>
              <UBadge variant="subtle" color="gray" size="xs">{{ pdv.categorie }}</UBadge>
            </div>
          </div>
          <NuxtLink
            v-if="pdv.geolocation_lat"
            :to="`https://www.google.com/maps?q=${pdv.geolocation_lat},${pdv.geolocation_lng}`"
            target="_blank"
          >
            <UIcon name="i-heroicons-map-pin" class="w-5 h-5 text-fc-blue" />
          </NuxtLink>
        </div>
      </div>
    </div>

    <p v-if="filteredPDV.length === 0" class="text-center text-gray-400 py-10 text-sm">Aucun PDV trouvé</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const pdvStore = usePDVStore()
const search = ref('')
const selectedZone = ref('')

const allPDV = ref<any[]>([])
const zones = computed(() => [...new Set(allPDV.value.map(p => p.zone).filter(Boolean))])

const filteredPDV = computed(() => {
  let list = allPDV.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p => p.nom_pdv?.toLowerCase().includes(q) || p.zone?.toLowerCase().includes(q))
  }
  if (selectedZone.value) {
    list = list.filter(p => p.zone === selectedZone.value)
  }
  return list.slice(0, 50)
})

onMounted(async () => {
  allPDV.value = await pdvStore.fetchAllPDV()
})
</script>
