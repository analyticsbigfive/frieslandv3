<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">VISIBILITÉ EXTÉRIEURE</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      :show-nom-pdv="true"
      @filter="dashboard.fetchVisites()"
    />

    <!-- KPI + Pie global -->
    <div class="flex flex-wrap items-center gap-6 mb-2">
      <div>
        <p class="text-sm text-gray-500">Visites avec visibilité extérieure</p>
        <p class="text-3xl font-bold text-gray-900">{{ visExtCount }}</p>
      </div>
      <ClientOnly>
        <ChartsPieChart
          :labels="presenceData.labels"
          :values="presenceData.values"
          :colors="['#F59E0B', '#FB923C']"
          height="sm"
          class="w-48"
        />
      </ClientOnly>
    </div>

    <!-- Pie charts row: Présence -->
    <div>
      <h2 class="text-lg font-bold text-gray-800 mb-4">Présence</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <ClientOnly>
          <ChartsPieChart
            v-for="item in visibiliteItems"
            :key="item.key"
            :title="item.label"
            :labels="item.presence.labels"
            :values="item.presence.values"
            :colors="['#F59E0B', '#FB923C']"
            height="sm"
          />
        </ClientOnly>
      </div>
    </div>

    <!-- Pie charts row: État -->
    <div>
      <h2 class="text-lg font-bold text-gray-800 mb-4">État</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <ClientOnly>
          <ChartsPieChart
            v-for="item in visibiliteItems"
            :key="'etat-' + item.key"
            :title="item.label"
            :labels="item.etat.labels"
            :values="item.etat.values"
            :colors="item.etat.colors"
            height="sm"
          />
        </ClientOnly>
      </div>
    </div>

    <!-- Évolution chart -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-sm font-semibold text-gray-700 mb-4">Évolution des visites avec visibilité extérieure</h3>
      <ClientOnly>
        <ChartsVisitesLineChart
          v-if="evolutionData.length"
          title=""
          :data="evolutionData"
        />
      </ClientOnly>
    </div>

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const visExtCount = computed(() =>
  dashboard.countWhere(v => v.data?.visibilite?.exterieure?.presence_visibilite)
)

const presenceData = computed(() =>
  dashboard.presenceAbsence(v => v.data?.visibilite?.exterieure?.presence_visibilite)
)

const visItems = [
  { key: 'full_branding', label: 'Full branding', etatKey: 'etat_branding' },
  { key: 'poster', label: 'Poster', etatKey: 'etat_poster' },
  { key: 'panneau_privilege', label: 'Panneau privilège', etatKey: 'etat_panneau' },
  { key: 'sign_board', label: 'Sign board', etatKey: 'etat_sign_board' },
  { key: 'guirlande', label: 'Guirlande', etatKey: 'etat_guirlande' },
]

const visibiliteItems = computed(() => {
  return visItems.map(item => {
    const presence = dashboard.presenceAbsence(
      v => (v.data?.visibilite?.exterieure as any)?.[item.key]
    )
    const etat = dashboard.etatBreakdown(
      v => (v.data?.visibilite?.exterieure as any)?.[item.etatKey] as string,
      v => (v.data?.visibilite?.exterieure as any)?.[item.key] as boolean
    )
    return { ...item, presence, etat }
  })
})

const evolutionData = computed(() => {
  const evo = dashboard.evolutionParSemaine(
    v => v.data?.visibilite?.exterieure?.presence_visibilite
  )
  return evo.labels.map((label, i) => ({ date: label, count: evo.counts[i] }))
})

onMounted(async () => {
  await dashboard.fetchZones()
  await dashboard.fetchVisites()
})
</script>
