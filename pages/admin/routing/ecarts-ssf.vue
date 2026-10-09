<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Écarts SSF ↔ merchandiser"
      description="Le SSF (vendeur du distributeur) et le merchandiser qui travaillent ensemble un jour donné doivent passer dans les mêmes PDV. Pour un jour : les PDV de la tournée du merchandiser absents du routing DMS du SSF prévu ce jour-là (routing mensuel de l’agence)."
    >
      <template #actions>
        <UInput v-model="date" type="date" size="sm" class="w-40" aria-label="Jour" />
        <UButton size="sm" color="gray" variant="soft" icon="i-heroicons-arrow-path" :loading="chargement" @click="charger">Actualiser</UButton>
        <UButton size="sm" color="gray" variant="soft" icon="i-heroicons-arrow-down-tray" :disabled="!lignesFiltrees.length" @click="exporter">Exporter</UButton>
      </template>
    </AdminPageHeader>

    <div v-if="erreur" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      {{ erreur }}
    </div>

    <!-- Synthèse -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div v-for="s in STATUTS" :key="s" class="admin-surface p-4">
        <p class="text-xs font-semibold uppercase text-gray-500">{{ LIBELLES_ECART[s].label }}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{{ compte(s) }}</p>
        <p class="text-xs text-gray-500">{{ LIBELLES_ECART[s].aide }}</p>
      </div>
    </div>

    <!-- Filtres -->
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="recherche" icon="i-heroicons-magnifying-glass" size="sm" placeholder="Merchandiser ou SSF…" aria-label="Rechercher" class="w-56" />
      <USelect v-model="filtreDirection" :options="optionsDirection" size="sm" aria-label="Filtrer par direction" />
      <USelect v-model="filtreCommercial" :options="optionsCommercial" size="sm" aria-label="Filtrer par commercial" />
      <USelect v-model="filtreStatut" :options="optionsStatut" size="sm" aria-label="Filtrer par statut" />
      <span class="text-xs text-gray-400">{{ lignesFiltrees.length }} tournée(s) le {{ dateLisible }}</span>
    </div>

    <div class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="th-l">Merchandiser</th>
            <th class="th-l">Commercial</th>
            <th class="th-l">SSF du jour</th>
            <th class="th-c">PDV de la tournée</th>
            <th class="th-c">Hors routing SSF</th>
            <th class="th-l">Statut</th>
            <th class="th-c w-24" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <template v-for="l in lignesFiltrees" :key="l.merchandiser_id">
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="px-4 py-2.5 text-sm">
                <p class="font-semibold text-gray-900 dark:text-gray-100">{{ l.nom || l.email }}</p>
                <p class="text-xs text-gray-400">{{ nomAgence(l.employeur) }} · {{ libelleDirection(l.direction, true) }}</p>
              </td>
              <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ nomCommercial(l.commercial_id) }}</td>
              <td class="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{{ l.ssf_noms || '—' }}</td>
              <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ l.nb_pdv }}</td>
              <td class="px-4 py-2.5 text-center text-sm tabular-nums">
                <template v-if="l.nb_hors_routing != null">
                  <span :class="l.nb_hors_routing ? 'font-semibold text-red-600' : 'text-gray-500'">{{ l.nb_hors_routing }}</span>
                  <span v-if="tauxEcart(l.nb_hors_routing, l.nb_pdv)" class="text-xs text-gray-400"> ({{ tauxEcart(l.nb_hors_routing, l.nb_pdv) }} %)</span>
                </template>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-4 py-2.5 text-sm">
                <UBadge :color="LIBELLES_ECART[l.statut as StatutEcart]?.couleur || 'gray'" variant="soft" size="xs" :title="LIBELLES_ECART[l.statut as StatutEcart]?.aide">
                  {{ LIBELLES_ECART[l.statut as StatutEcart]?.label || l.statut }}
                </UBadge>
              </td>
              <td class="px-4 py-2.5 text-center">
                <UButton
                  v-if="l.statut === 'hors_routing_ssf'"
                  size="xs"
                  variant="ghost"
                  color="gray"
                  :icon="ouvert === l.merchandiser_id ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  :loading="chargementDetail === l.merchandiser_id"
                  @click="basculer(l)"
                >
                  Détail
                </UButton>
              </td>
            </tr>
            <tr v-if="ouvert === l.merchandiser_id">
              <td colspan="7" class="bg-gray-50 px-4 py-3 dark:bg-gray-800/60">
                <p class="mb-2 text-xs text-gray-500">
                  PDV de la tournée hors du routing de {{ l.ssf_noms }}. « SSF du DMS » : vendeur(s) qui suivent ce PDV dans l’export DMS.
                </p>
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-left text-gray-500">
                      <th class="py-1 pr-3 font-medium">PDV</th>
                      <th class="py-1 pr-3 font-medium">Zone › quartier</th>
                      <th class="py-1 pr-3 font-medium">Type</th>
                      <th class="py-1 font-medium">SSF du DMS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="d in (details[l.merchandiser_id] || []).filter(x => !x.dans_routing)" :key="d.pdv_id" class="border-t border-gray-100 dark:border-gray-700">
                      <td class="py-1 pr-3 text-gray-800 dark:text-gray-100">{{ d.nom_pdv }} <span class="text-gray-400">· {{ d.pdv_id }}</span></td>
                      <td class="py-1 pr-3 text-gray-600 dark:text-gray-300">{{ d.zone || '—' }} › {{ d.quartier || '—' }}</td>
                      <td class="py-1 pr-3 text-gray-600 dark:text-gray-300">{{ d.canal || '—' }}</td>
                      <td class="py-1 text-gray-600 dark:text-gray-300">{{ d.ssf_du_pdv || 'Aucun (PDV hors DMS)' }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
          <tr v-if="!chargement && !lignesFiltrees.length">
            <td colspan="7" class="px-4 py-10 text-center text-sm text-gray-400">Aucune tournée de merchandiser ce jour-là pour ces filtres.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- D'où viennent les données ; les liens ne s'affichent qu'à qui peut les ouvrir. -->
    <p class="text-sm text-slate-600 dark:text-slate-300">
      D'où viennent ces données : le vendeur du distributeur (SSF) prévu chaque jour vient du routing mensuel de l’agence
      (<NuxtLink v-if="peutOuvrir('/admin/referentiels')" to="/admin/referentiels?liste=routing_mensuel" class="font-semibold text-brand-600 underline underline-offset-2">Référentiels › Routing mensuel</NuxtLink><span v-else>Référentiels › Routing mensuel</span>) ;
      les clients de chaque vendeur viennent du fichier du distributeur (DMS), chargé dans
      <NuxtLink v-if="peutOuvrir('/admin/import-export')" to="/admin/import-export" class="font-semibold text-brand-600 underline underline-offset-2">Import / Export</NuxtLink><span v-else>Import / Export</span>.
      Ce fichier ne donne pas le jour de passage : un client d’un vendeur compte pour tous ses jours.
    </p>
  </div>
</template>

<script setup lang="ts">
const { peutOuvrir } = useAdminNavigation()
// Contrôle d'écart SSF ↔ merchandiser (réunion client du 08/10/2026). Données
// calculées en base (RPC ecarts_binome_resume / ecarts_binome, migration
// 20261008140000) : admin et superviseur voient tout, un commercial son équipe.
import { DIRECTIONS, libelleDirection } from '~/utils/agences'
import { LIBELLES_ECART, tauxEcart, type StatutEcart } from '~/utils/ecartsBinome'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const { exportToCsv } = useCsvExport()
const { nom: nomAgence, charger: chargerAgences } = useAgences()

const STATUTS: StatutEcart[] = ['hors_routing_ssf', 'ok', 'routing_ssf_absent', 'sans_binome']
const aujourdhui = new Date()
const date = ref(`${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`)
const lignes = ref<any[]>([])
const utilisateurs = ref<any[]>([])
const chargement = ref(false)
const erreur = ref('')
const recherche = ref('')
const filtreDirection = ref('tous')
const filtreCommercial = ref('tous')
const filtreStatut = ref('tous')
const ouvert = ref<string | null>(null)
const chargementDetail = ref<string | null>(null)
const details = reactive<Record<string, any[]>>({})

const dateLisible = computed(() => new Date(`${date.value}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))
const nomCommercial = (id: string | null) => (id ? utilisateurs.value.find(u => u.id === id)?.nom || '—' : '—')
const optionsDirection = [{ label: 'Toutes les directions', value: 'tous' }, ...DIRECTIONS.map(d => ({ label: d.label, value: d.value }))]
const optionsStatut = [{ label: 'Tous les statuts', value: 'tous' }, ...STATUTS.map(s => ({ label: LIBELLES_ECART[s].label, value: s }))]
const optionsCommercial = computed(() => [
  { label: 'Tous les commerciaux', value: 'tous' },
  ...[...new Set(lignes.value.map(l => l.commercial_id).filter(Boolean))]
    .map(id => ({ label: nomCommercial(id), value: id }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
])

const lignesFiltrees = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  return lignes.value
    .filter(l => filtreDirection.value === 'tous' || l.direction === filtreDirection.value)
    .filter(l => filtreCommercial.value === 'tous' || l.commercial_id === filtreCommercial.value)
    .filter(l => filtreStatut.value === 'tous' || l.statut === filtreStatut.value)
    .filter(l => !q || `${l.nom || ''} ${l.email || ''} ${l.ssf_noms || ''}`.toLowerCase().includes(q))
    // Écarts d'abord, puis par nombre de PDV hors routing.
    .sort((a, b) => STATUTS.indexOf(a.statut) - STATUTS.indexOf(b.statut) || (b.nb_hors_routing || 0) - (a.nb_hors_routing || 0))
})
const compte = (s: StatutEcart) => lignes.value
  .filter(l => filtreDirection.value === 'tous' || l.direction === filtreDirection.value)
  .filter(l => l.statut === s).length

async function charger() {
  chargement.value = true
  erreur.value = ''
  ouvert.value = null
  for (const k of Object.keys(details)) delete details[k]
  try {
    const { data, error } = await (supabase.rpc as any)('ecarts_binome_resume', { p_date: date.value })
    if (error) throw error
    lignes.value = data || []
  }
  catch (e: any) {
    lignes.value = []
    erreur.value = /ecarts_binome_resume|function|schema cache/i.test(e?.message || '')
      ? 'Contrôle d’écart disponible après la migration du routing SSF (20261008140000).'
      : `Contrôle indisponible : ${e?.message || e}`
  }
  finally {
    chargement.value = false
  }
}

async function basculer(l: any) {
  if (ouvert.value === l.merchandiser_id) { ouvert.value = null; return }
  ouvert.value = l.merchandiser_id
  if (details[l.merchandiser_id]) return
  chargementDetail.value = l.merchandiser_id
  try {
    const { data, error } = await (supabase.rpc as any)('ecarts_binome', { p_date: date.value, p_merchandiser: l.merchandiser_id })
    if (error) throw error
    details[l.merchandiser_id] = data || []
  }
  catch (e: any) {
    erreur.value = `Détail indisponible : ${e?.message || e}`
  }
  finally {
    chargementDetail.value = null
  }
}

function exporter() {
  exportToCsv(lignesFiltrees.value.map(l => ({
    jour: date.value,
    merchandiser: l.nom || '',
    email: l.email || '',
    agence: nomAgence(l.employeur),
    direction: libelleDirection(l.direction, true),
    commercial: nomCommercial(l.commercial_id),
    ssf_binome: l.ssf_noms || '',
    pdv_tournee: l.nb_pdv,
    hors_routing_ssf: l.nb_hors_routing ?? '',
    statut: LIBELLES_ECART[l.statut as StatutEcart]?.label || l.statut,
  })), `ecarts-ssf-merch-${date.value}.csv`)
}

watch(date, charger)
onMounted(async () => {
  void chargerAgences()
  utilisateurs.value = await useUsersCache().fetchUsers()
  await charger()
})
</script>

<style scoped>
.th-l { @apply px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
.th-c { @apply px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
</style>
