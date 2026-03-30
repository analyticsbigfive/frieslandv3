<template>
  <div>
    <definePageMeta :middleware="['auth', 'admin']" :layout="'admin'" />

    <!-- KPI Cards Row -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatsCard
        title="Total Visites"
        :value="stats?.total_visites ?? 0"
        subtitle="Tous les temps"
        :icon="ClipboardList"
        color="blue"
      />
      <StatsCard
        title="Visites ce mois"
        :value="stats?.visites_month ?? 0"
        subtitle="Mois en cours"
        :icon="Calendar"
        color="green"
      />
      <StatsCard
        title="Points de Vente"
        :value="stats?.total_pdv ?? 0"
        subtitle="PDV actifs"
        :icon="MapPin"
        color="orange"
      />
      <StatsCard
        title="Commerciaux"
        :value="stats?.total_commerciaux ?? 0"
        subtitle="Actifs ce mois"
        :icon="Users"
        color="purple"
      />
    </div>

    <!-- Taux de présence produits -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <div
        v-for="cat in productCategories"
        :key="cat.key"
        class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center"
      >
        <p class="text-xs text-gray-500 font-medium mb-1">{{ cat.label }}</p>
        <p class="text-2xl font-bold" :class="getPercentColor(cat.value)">
          {{ cat.value }}%
        </p>
        <p class="text-[10px] text-gray-400 mt-0.5">présence</p>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <ClientOnly>
        <ChartsVisitesLineChart
          title="Évolution des visites"
          :data="stats?.visites_par_jour ?? []"
        />
      </ClientOnly>

      <ClientOnly>
        <ChartsDistributionChart
          title="Distribution par type de PDV"
          :data="stats?.distribution_pdv ?? []"
        />
      </ClientOnly>
    </div>

    <!-- Performance Commerciaux -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-700">Performance Commerciaux</h3>
        <NuxtLink to="/admin/users" class="text-xs text-fc-blue hover:underline">
          Voir tout →
        </NuxtLink>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commercial</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th class="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
              <th class="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ce mois</th>
              <th class="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Progression</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="com in stats?.performance_commerciaux?.slice(0, 10)"
              :key="com.email"
              class="hover:bg-gray-50"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-fc-blue-50 text-fc-blue flex items-center justify-center text-xs font-medium">
                    {{ com.nom?.substring(0, 2).toUpperCase() }}
                  </div>
                  <span class="text-sm font-medium text-gray-900">{{ com.nom }}</span>
                </div>
              </td>
              <td class="px-5 py-3 text-sm text-gray-500">{{ com.email }}</td>
              <td class="px-5 py-3 text-center text-sm font-semibold text-gray-900">{{ com.total_visites }}</td>
              <td class="px-5 py-3 text-center text-sm font-semibold text-fc-blue">{{ com.visites_mois }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-center">
                  <div class="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-fc-blue rounded-full transition-all"
                      :style="{ width: getProgressWidth(com) }"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!stats?.performance_commerciaux?.length" class="p-12 text-center text-gray-400">
        <ClipboardList class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Aucune donnée de performance disponible</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClipboardList, Calendar, MapPin, Users } from 'lucide-vue-next'

definePageMeta({
  middleware: ['auth'],
  layout: 'admin',
})

const visitesStore = useVisitesStore()

const stats = computed(() => visitesStore.stats)

const productCategories = computed(() => [
  { key: 'evap', label: 'EVAP', value: stats.value?.taux_evap ?? 0 },
  { key: 'imp', label: 'IMP', value: stats.value?.taux_imp ?? 0 },
  { key: 'scm', label: 'SCM', value: stats.value?.taux_scm ?? 0 },
  { key: 'uht', label: 'UHT', value: stats.value?.taux_uht ?? 0 },
  { key: 'yaourt', label: 'YAOURT', value: stats.value?.taux_yaourt ?? 0 },
])

function getPercentColor(val: number) {
  if (val >= 70) return 'text-emerald-600'
  if (val >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function getProgressWidth(com: any) {
  const max = stats.value?.performance_commerciaux?.[0]?.total_visites || 1
  return `${Math.round((com.total_visites / max) * 100)}%`
}

// Load stats on mount
onMounted(async () => {
  await visitesStore.fetchStats()
})
</script>
