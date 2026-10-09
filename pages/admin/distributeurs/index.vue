<template>
  <div class="space-y-6">
    <AdminPageHeader description="Les distributeurs, les territoires qu’ils couvrent, leurs points de vente actifs et les visites chez leurs clients." />

    <AdminListToolbar
      :search="search"
      search-placeholder="Nom du distributeur…"
      search-label="Rechercher un distributeur"
      :result-count="loading ? undefined : filtered.length"
      result-label="distributeur(s)"
      :show-reset="!!search"
      @update:search="search = $event"
      @reset="search = ''"
    />

    <div class="admin-surface overflow-hidden">
      <ChargementContenu v-if="loading" variante="lignes" :nombre="6" libelle="Chargement des distributeurs…" class="p-5" />

      <div v-else-if="erreur" class="p-6 text-sm text-slate-700 dark:text-slate-200" role="alert">
        <p class="font-semibold text-slate-900 dark:text-white">Les distributeurs n’ont pas pu être chargés.</p>
        <p class="mt-1">{{ erreur }}</p>
      </div>

      <div v-else-if="!filtered.length" class="px-6 py-12 text-center">
        <UIcon name="i-heroicons-truck" class="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        <template v-if="search">
          <p class="mt-3 text-sm font-medium text-slate-900 dark:text-white">Aucun distributeur ne correspond à « {{ search }} »</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Vérifiez l’orthographe ou effacez la recherche.</p>
        </template>
        <template v-else>
          <p class="mt-3 text-sm font-medium text-slate-900 dark:text-white">Aucun distributeur enregistré</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Les distributeurs se déclarent dans
            <NuxtLink v-if="peutOuvrir('/admin/referentiels')" to="/admin/referentiels" class="font-medium text-slate-900 underline underline-offset-2 hover:text-brand-700 dark:text-white">Paramètres › Référentiels</NuxtLink>
            <template v-else>Paramètres › Référentiels</template>.
          </p>
        </template>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Distributeur</th>
              <th>Portée</th>
              <th>Territoires</th>
              <th class="text-right">Points de vente actifs</th>
              <th class="text-right">Visites enregistrées</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="d in paginated" :key="d.name">
              <tr class="cursor-pointer" @click="toggle(d.name)">
                <td>
                  <button
                    type="button"
                    class="flex items-center gap-2 rounded text-left font-medium text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-white"
                    :aria-expanded="expanded === d.name"
                    :aria-label="`${expanded === d.name ? 'Masquer' : 'Afficher'} les visites de ${d.name}`"
                    @click.stop="toggle(d.name)"
                  >
                    <UIcon
                      :name="expanded === d.name ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                      class="h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                    <span>{{ d.name }}</span>
                  </button>
                </td>
                <td>
                  <UBadge color="gray" variant="soft" size="xs">
                    {{ d.national ? 'National' : 'Territoire' }}
                  </UBadge>
                </td>
                <td>{{ d.territories.join(', ') || '—' }}</td>
                <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ d.pdvCount.toLocaleString('fr-FR') }}</td>
                <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ d.visites.length.toLocaleString('fr-FR') }}</td>
              </tr>
              <tr v-if="expanded === d.name" class="hover:bg-transparent">
                <td colspan="5" class="bg-slate-50 px-6 py-4 dark:bg-slate-900/40">
                  <template v-if="d.visites.length">
                    <p class="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {{ d.visites.length > VISITES_AFFICHEES ? `Les ${VISITES_AFFICHEES} visites les plus récentes sur ${d.visites.length.toLocaleString('fr-FR')}` : 'Visites les plus récentes' }}
                    </p>
                    <ul class="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                      <li
                        v-for="v in d.visites.slice(0, VISITES_AFFICHEES)"
                        :key="v.visite_id"
                        class="grid grid-cols-1 gap-1 px-3 py-2 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:gap-4"
                      >
                        <span class="font-medium text-slate-900 dark:text-white">{{ v.pdv_nom }}</span>
                        <span class="text-slate-600 dark:text-slate-300">{{ v.commercial || '—' }}</span>
                        <span class="tabular-nums text-slate-600 dark:text-slate-300">{{ formatDate(v.date_visite) }}</span>
                      </li>
                    </ul>
                  </template>
                  <p v-else class="text-sm text-slate-600 dark:text-slate-300">Aucune visite enregistrée chez les clients de ce distributeur.</p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <AdminPagination
        v-if="!loading && filtered.length"
        :total="filtered.length"
        :page="page"
        :page-size="perPage"
        item-label="distributeur(s)"
        @update:page="(p) => page = p"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const { peutOuvrir } = useAdminNavigation()
const { distributeurs, territoireDistributeurs, fetchReferentiels } = useReferentiels()

const loading = ref(true)
const erreur = ref('')
// La ligne dépliée montre les visites les plus récentes, pas tout l'historique.
const VISITES_AFFICHEES = 20
const search = ref('')
const page = ref(1)
const perPage = 20
const expanded = ref<string | null>(null)

interface VisiteRow { visite_id: string; commercial: string; date_visite: string; pdv_nom: string; distributor_name: string }
const visiteRows = ref<VisiteRow[]>([])
const pdvCountByDistrib = ref<Record<string, number>>({})

// Agrégat par distributeur : territoires rattachés, nb PDV, visites.
const grouped = computed(() => {
  const terrByDistrib = new Map<string, Set<string>>()
  for (const td of territoireDistributeurs.value) {
    if (!terrByDistrib.has(td.distributor_name)) terrByDistrib.set(td.distributor_name, new Set())
    terrByDistrib.get(td.distributor_name)!.add(td.territory_name || td.territory_code)
  }
  const visitesByDistrib = new Map<string, VisiteRow[]>()
  for (const v of visiteRows.value) {
    if (!v.distributor_name) continue
    if (!visitesByDistrib.has(v.distributor_name)) visitesByDistrib.set(v.distributor_name, [])
    visitesByDistrib.get(v.distributor_name)!.push(v)
  }
  return distributeurs.value.map(d => ({
    name: d.name,
    national: d.national,
    territories: [...(terrByDistrib.get(d.name) || [])].sort(),
    pdvCount: pdvCountByDistrib.value[d.name] || 0,
    visites: visitesByDistrib.get(d.name) || [],
  }))
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const base = q ? grouped.value.filter(d => d.name.toLowerCase().includes(q)) : grouped.value
  // Tri : distributeurs avec activité (visites) d'abord, puis alpha.
  return [...base].sort((a, b) => b.visites.length - a.visites.length || a.name.localeCompare(b.name))
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPage)))
const paginated = computed(() => filtered.value.slice((page.value - 1) * perPage, page.value * perPage))

watch(search, () => { page.value = 1 })

function toggle(name: string) {
  expanded.value = expanded.value === name ? null : name
}

function formatDate(value: string): string {
  return formatDateFr(value, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function load() {
  loading.value = true
  try {
    await fetchReferentiels()
    const [{ data: visitesData }, { data: pdvData }] = await Promise.all([
      supabase
        .from('visites')
        .select('visite_id, commercial, date_visite, pdv:pdv_id(nom_pdv, distributor_name)')
        .order('date_visite', { ascending: false }),
      supabase
        .from('pdv')
        .select('distributor_name')
        .eq('is_active', true),
    ])
    visiteRows.value = (visitesData || []).map((r: any) => ({
      visite_id: r.visite_id,
      commercial: r.commercial,
      date_visite: r.date_visite,
      pdv_nom: r.pdv?.nom_pdv || 'Point de vente sans nom',
      distributor_name: r.pdv?.distributor_name || '',
    }))
    const counts: Record<string, number> = {}
    for (const p of (pdvData || []) as any[]) {
      if (p.distributor_name) counts[p.distributor_name] = (counts[p.distributor_name] || 0) + 1
    }
    pdvCountByDistrib.value = counts
  }
  catch (err) {
    console.error('Distributeurs : chargement impossible', err)
    erreur.value = messageUtilisateur(err)
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>
