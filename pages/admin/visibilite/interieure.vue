<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">VISIBILITÉ INTÉRIEURE</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- KPI global -->
    <div class="flex flex-wrap items-center gap-6">
      <div>
        <p class="text-sm text-gray-500 dark:text-gray-400">Présence de visibilité intérieure</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ visIntCount }}</p>
      </div>
      <ClientOnly>
        <ChartsPieChart
          :labels="presenceGlobal.labels"
          :values="presenceGlobal.values"
          :colors="['#F59E0B', '#FB923C']"
          height="sm"
          class="w-44"
        />
      </ClientOnly>
    </div>

    <!-- ======================== GENERAL TRADE ======================== -->
    <h2 class="text-xl font-bold text-gray-800 border-b pb-2">General trade</h2>

    <!-- Présence GT -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <ClientOnly>
        <ChartsPieChart
          v-for="item in gtItems"
          :key="item.key"
          :title="item.label"
          :labels="['Absent', 'Présent']"
          :values="[gtAbsent(item.key), gtPresent(item.key)]"
          :colors="['#FB923C', '#F59E0B']"
          height="sm"
          :show-legend="true"
        />
      </ClientOnly>
    </div>

    <!-- État GT -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <ClientOnly>
        <ChartsPieChart
          v-for="item in gtItems"
          :key="'etat-' + item.key"
          :title="item.label"
          :labels="gtEtat(item.etatKey).labels"
          :values="gtEtat(item.etatKey).values"
          :colors="gtEtat(item.etatKey).colors"
          height="sm"
        />
      </ClientOnly>
    </div>

    <!-- ======================== MODERN TRADE ======================== -->
    <h2 class="text-xl font-bold text-gray-800 border-b pb-2">Modern trade</h2>

    <!-- Présence MT -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <ClientOnly>
        <ChartsPieChart
          v-for="item in mtItems"
          :key="item.key"
          :title="item.label"
          :labels="['Absent', 'Présent']"
          :values="[mtAbsent(item.key), mtPresent(item.key)]"
          :colors="['#FB923C', '#EC4899']"
          height="sm"
        />
      </ClientOnly>
    </div>

    <!-- État MT -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <ClientOnly>
        <ChartsPieChart
          v-for="item in mtItems"
          :key="'etat-' + item.key"
          :title="item.label"
          :labels="mtEtat(item.etatKey).labels"
          :values="mtEtat(item.etatKey).values"
          :colors="mtEtat(item.etatKey).colors"
          height="sm"
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

const visIntCount = computed(() =>
  dashboard.countWhere(v => v.data?.visibilite?.interieure?.presence_visibilite)
)

const presenceGlobal = computed(() =>
  dashboard.presenceAbsence(v => v.data?.visibilite?.interieure?.presence_visibilite)
)

// GT items
const gtItems = [
  { key: 'hanger', label: 'Hanger', etatKey: 'etat_hanger' },
  { key: 'maison_bonnet_rouge', label: 'Maison Bonnet Rouge', etatKey: 'etat_maison_br' },
  { key: 'reglettes', label: 'Réglettes', etatKey: 'etat_reglettes' },
  { key: 'zone_chaude', label: 'Zone chaude', etatKey: 'etat_zone_chaude' },
  { key: 'presentoirs', label: 'Présentoirs', etatKey: 'etat_presentoirs' },
  { key: 'bacs_pouch', label: 'Bacs à Pouch', etatKey: 'etat_bacs' },
  { key: 'produits_frigo', label: 'Produits dans frigo', etatKey: 'etat_frigo' },
]

// MT items
const mtItems = [
  { key: 'habillage_rayon', label: 'Habillage rayon', etatKey: 'etat_habillage' },
  { key: 'merchandising', label: 'Merchandising', etatKey: 'etat_merchandising' },
  { key: 'tete_gondole', label: 'Tête de gondole', etatKey: 'etat_tete_gondole' },
  { key: 'autre_interieure', label: 'Autre (MT)', etatKey: 'etat_autre_int' },
]

function gtPresent(key: string) {
  return dashboard.countWhere(v => (v.data?.visibilite?.interieure as any)?.[key])
}
function gtAbsent(key: string) {
  return dashboard.totalVisites.value - gtPresent(key)
}
function gtEtat(etatKey: string) {
  return dashboard.etatBreakdown(
    v => (v.data?.visibilite?.interieure as any)?.[etatKey] as string,
    v => (v.data?.visibilite?.interieure as any)?.[etatKey.replace('etat_', '').replace('_br', '_bonnet_rouge').replace('_bacs', '_pouch')] as boolean || (v.data?.visibilite?.interieure as any)?.[etatKey] !== undefined
  )
}

function mtPresent(key: string) {
  return dashboard.countWhere(v => (v.data?.visibilite?.interieure as any)?.[key])
}
function mtAbsent(key: string) {
  return dashboard.totalVisites.value - mtPresent(key)
}
function mtEtat(etatKey: string) {
  return dashboard.etatBreakdown(
    v => (v.data?.visibilite?.interieure as any)?.[etatKey] as string,
    v => (v.data?.visibilite?.interieure as any)?.[etatKey] !== undefined
  )
}

onMounted(async () => {
  await dashboard.fetchZones()
  await dashboard.fetchVisites()
})
</script>
