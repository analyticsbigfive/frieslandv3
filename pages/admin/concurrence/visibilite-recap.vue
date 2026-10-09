<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Une ligne par visite : marques concurrentes visibles à l'extérieur et à l'intérieur du point de vente."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" variante="lignes" libelle="Chargement des visites…" />

    <template v-else>
      <section class="admin-surface overflow-hidden">
        <div class="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Détail par visite</h2>
            <p class="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">
              <strong class="font-semibold text-slate-900 dark:text-white">{{ nombre(filteredRows.length) }}</strong>
              visite{{ filteredRows.length > 1 ? 's' : '' }}
              <template v-if="filtresActifs"> correspondent aux filtres, sur {{ nombre(dashboard.totalVisites.value) }}</template>
            </p>
          </div>
          <UButton v-if="filtresActifs" color="gray" variant="ghost" size="sm" icon="i-heroicons-x-mark" @click="effacerFiltres">
            Effacer les filtres du tableau
          </UButton>
        </div>

        <ul
          v-if="marques.length"
          class="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 px-5 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
          aria-label="Légende du tableau"
        >
          <li class="inline-flex items-center gap-1.5">
            <UIcon name="i-heroicons-check-circle-20-solid" class="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Marque visible
          </li>
          <li class="inline-flex items-center gap-1.5">
            <UIcon name="i-heroicons-minus-circle" class="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            Marque non visible
          </li>
        </ul>

        <div class="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
          <table class="admin-table" data-no-column-tools>
            <thead>
              <tr>
                <th rowspan="2" class="align-bottom">Date</th>
                <th rowspan="2" class="align-bottom">Point de vente</th>
                <th rowspan="2" class="align-bottom">Canal</th>
                <th rowspan="2" class="align-bottom">Sous-région</th>
                <th rowspan="2" class="align-bottom">Territoire</th>
                <th rowspan="2" class="align-bottom">Merchandiser</th>
                <th
                  v-if="marques.length"
                  :colspan="marques.length"
                  class="border-l border-slate-200 text-center dark:border-slate-700"
                >
                  Visible à l'extérieur
                </th>
                <th
                  v-if="marques.length"
                  :colspan="marques.length"
                  class="border-l border-slate-200 text-center dark:border-slate-700"
                >
                  Visible à l'intérieur
                </th>
              </tr>
              <tr>
                <th
                  v-for="(m, i) in marques"
                  :key="m.key + '_ext'"
                  class="whitespace-nowrap px-2 pt-0 text-center"
                  :class="{ 'border-l border-slate-200 dark:border-slate-700': i === 0 }"
                >
                  {{ m.label }}
                </th>
                <th
                  v-for="(m, i) in marques"
                  :key="m.key + '_int'"
                  class="whitespace-nowrap px-2 pt-0 text-center"
                  :class="{ 'border-l border-slate-200 dark:border-slate-700': i === 0 }"
                >
                  {{ m.label }}
                </th>
              </tr>
              <!-- Filtres par colonne -->
              <tr class="bg-white dark:bg-slate-800">
                <th class="py-2"><UInput v-model="colFilters.date" size="xs" placeholder="jj/mm" aria-label="Filtrer par date" class="w-24" /></th>
                <th class="py-2"><UInput v-model="colFilters.pdv" size="xs" placeholder="Nom" aria-label="Filtrer par point de vente" class="w-32" /></th>
                <th class="py-2">
                  <USelectMenu
                    v-model="colFilters.canal"
                    :options="optionsCanal"
                    option-attribute="label"
                    value-attribute="value"
                    size="xs"
                    aria-label="Filtrer par canal"
                    class="w-36"
                  />
                </th>
                <th class="py-2"><UInput v-model="colFilters.region" size="xs" placeholder="Sous-région" aria-label="Filtrer par sous-région" class="w-28" /></th>
                <th class="py-2"><UInput v-model="colFilters.zone" size="xs" placeholder="Territoire" aria-label="Filtrer par territoire" class="w-28" /></th>
                <th class="py-2">
                  <USelectMenu
                    v-model="colFilters.commercial"
                    :options="commercialColOptions"
                    size="xs"
                    class="w-36"
                    searchable
                    searchable-placeholder="Rechercher…"
                    value-attribute="value"
                    option-attribute="label"
                    aria-label="Filtrer par merchandiser"
                  />
                </th>
                <th
                  v-for="(m, i) in marques"
                  :key="m.key + '_ext_f'"
                  class="px-2 py-2"
                  :class="{ 'border-l border-slate-200 dark:border-slate-700': i === 0 }"
                >
                  <USelectMenu
                    v-model="colFilters[m.key + '_ext']"
                    :options="presenceOptions"
                    placeholder="Toutes"
                    option-attribute="label"
                    value-attribute="value"
                    size="xs"
                    :aria-label="`Filtrer : ${m.label} à l'extérieur`"
                    class="w-24"
                  />
                </th>
                <th
                  v-for="(m, i) in marques"
                  :key="m.key + '_int_f'"
                  class="px-2 py-2"
                  :class="{ 'border-l border-slate-200 dark:border-slate-700': i === 0 }"
                >
                  <USelectMenu
                    v-model="colFilters[m.key + '_int']"
                    :options="presenceOptions"
                    placeholder="Toutes"
                    option-attribute="label"
                    value-attribute="value"
                    size="xs"
                    :aria-label="`Filtrer : ${m.label} à l'intérieur`"
                    class="w-24"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!paginatedRows.length">
                <td :colspan="6 + marques.length * 2" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  {{ filtresActifs
                    ? 'Aucune visite ne correspond aux filtres du tableau. Effacez-les pour tout revoir.'
                    : 'Aucune visite sur la période. Élargissez la période ou changez les filtres.' }}
                </td>
              </tr>
              <tr v-for="row in paginatedRows" :key="row.visite_id">
                <td class="whitespace-nowrap tabular-nums">{{ formatDate(row.date_visite) }}</td>
                <td class="max-w-[220px] font-medium text-slate-900 dark:text-white">
                  <div class="flex items-center gap-1">
                    <span class="truncate" :title="row.pdv?.nom_pdv || undefined">{{ row.pdv?.nom_pdv || 'Point de vente sans nom' }}</span>
                    <PDVPhotoModal v-if="row.pdv?.pdv_id" :pdv-id="row.pdv.pdv_id" :pdv-name="row.pdv.nom_pdv" />
                  </div>
                </td>
                <td class="whitespace-nowrap">{{ libelleCanal(row.pdv?.canal) }}</td>
                <td>{{ row.pdv?.region || '—' }}</td>
                <td>{{ row.pdv?.zone || '—' }}</td>
                <td class="whitespace-nowrap">{{ row.commercial || '—' }}</td>
                <td
                  v-for="(m, i) in marques"
                  :key="m.key + '_ext_v'"
                  class="px-2 text-center"
                  :class="{ 'border-l border-slate-200 dark:border-slate-700': i === 0 }"
                >
                  <span class="inline-flex" :title="getExtVal(row, m.key) ? 'Visible' : 'Non visible'">
                    <UIcon
                      :name="getExtVal(row, m.key) ? 'i-heroicons-check-circle-20-solid' : 'i-heroicons-minus-circle'"
                      class="h-5 w-5"
                      :class="getExtVal(row, m.key) ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'"
                      aria-hidden="true"
                    />
                    <span class="sr-only">{{ m.label }} à l'extérieur : {{ getExtVal(row, m.key) ? 'visible' : 'non visible' }}</span>
                  </span>
                </td>
                <td
                  v-for="(m, i) in marques"
                  :key="m.key + '_int_v'"
                  class="px-2 text-center"
                  :class="{ 'border-l border-slate-200 dark:border-slate-700': i === 0 }"
                >
                  <span class="inline-flex" :title="getIntVal(row, m.key) ? 'Visible' : 'Non visible'">
                    <UIcon
                      :name="getIntVal(row, m.key) ? 'i-heroicons-check-circle-20-solid' : 'i-heroicons-minus-circle'"
                      class="h-5 w-5"
                      :class="getIntVal(row, m.key) ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'"
                      aria-hidden="true"
                    />
                    <span class="sr-only">{{ m.label }} à l'intérieur : {{ getIntVal(row, m.key) ? 'visible' : 'non visible' }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <AdminPagination
            :total="filteredRows.length"
            :page="page"
            :page-size="perPage"
            item-label="visite(s)"
            @update:page="(p) => page = p"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { visibiliteConcurrencePresente } from '~/utils/concurrence'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')
const { users: cachedUsers, fetchUsers: fetchCachedUsers } = useUsersCache()

// Liste complète des commerciaux (users), pas seulement ceux ayant une visite
// dans la fenêtre courante.
const commercialColOptions = computed(() => {
  const byNom = new Map(cachedUsers.value
    .filter(u => u.is_active !== false && u.nom)
    .map(u => [u.nom as string, u.nom as string]))
  return [{ value: '', label: 'Tous' }, ...[...byNom.keys()]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map(nom => ({ value: nom, label: nom }))]
})

// Marques du référentiel marque_concurrente (lot 6), plus de liste locale :
// la même liste que l'étape 9/11 du wizard, qui écrit
// visibilite.concurrence.<emplacement>.<cle>. Les visites d'avant septembre
// 2026 (clés plates nido_exterieur…) restent lues via
// visibiliteConcurrencePresente.
const { marquesVisibilite, charger: chargerMarques } = useMarquesConcurrentes()
const marques = computed(() =>
  marquesVisibilite.value.map(m => ({ key: m.cle, label: m.nom })),
)

// Valeurs inchangées ('Présent' / 'Absent'), libellés en clair.
const presenceOptions = [
  { value: '', label: 'Toutes' },
  { value: 'Présent', label: 'Visible' },
  { value: 'Absent', label: 'Non visible' },
]

// Valeurs de base inchangées ('General trade' / 'Modern trade') : seul
// l'affichage dit « boutiques (GT) » et « supermarchés (MT) ».
const optionsCanal = [
  { value: '', label: 'Tous' },
  { value: 'General trade', label: 'Boutiques (GT)' },
  { value: 'Modern trade', label: 'Supermarchés (MT)' },
]
const libelleCanal = (canal?: string | null) => optionsCanal.find(o => o.value && o.value === canal)?.label || canal || '—'

const colFilters = reactive<Record<string, string>>({
  date: '',
  pdv: '',
  canal: '',
  region: '',
  zone: '',
  commercial: '',
})

const filtresActifs = computed(() => Object.values(colFilters).some(Boolean))
function effacerFiltres() {
  for (const cle of Object.keys(colFilters)) colFilters[cle] = ''
}

const page = ref(1)
const perPage = 100

function getExtVal(row: any, marque: string) {
  return visibiliteConcurrencePresente(row.data?.visibilite?.concurrence, 'exterieure', marque)
}
function getIntVal(row: any, marque: string) {
  return visibiliteConcurrencePresente(row.data?.visibilite?.concurrence, 'interieure', marque)
}

function formatDate(d: string) {
  return formatDateFr(d, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const filteredRows = computed(() => {
  let rows = dashboard.visites.value

  if (colFilters.date) rows = rows.filter(r => formatDate(r.date_visite).includes(colFilters.date))
  if (colFilters.pdv) rows = rows.filter(r => r.pdv?.nom_pdv?.toLowerCase().includes(colFilters.pdv.toLowerCase()))
  if (colFilters.canal) rows = rows.filter(r => r.pdv?.canal === colFilters.canal)
  if (colFilters.region) rows = rows.filter(r => r.pdv?.region?.toLowerCase().includes(colFilters.region.toLowerCase()))
  if (colFilters.zone) rows = rows.filter(r => r.pdv?.zone?.toLowerCase().includes(colFilters.zone.toLowerCase()))
  if (colFilters.commercial) rows = rows.filter(r => r.commercial?.toLowerCase().includes(colFilters.commercial.toLowerCase()))

  for (const m of marques.value) {
    const extFilter = colFilters[m.key + '_ext']
    if (extFilter) {
      rows = rows.filter(r => {
        const present = getExtVal(r, m.key)
        return extFilter === 'Présent' ? present : !present
      })
    }
    const intFilter = colFilters[m.key + '_int']
    if (intFilter) {
      rows = rows.filter(r => {
        const present = getIntVal(r, m.key)
        return intFilter === 'Présent' ? present : !present
      })
    }
  }

  return rows
})

const paginatedRows = computed(() => {
  const start = (page.value - 1) * perPage
  return filteredRows.value.slice(start, start + perPage)
})

watch(filteredRows, () => { page.value = 1 })

onMounted(() => {
  fetchCachedUsers()
  Promise.all([dashboard.fetchVisites(), chargerMarques()])
})
</script>
