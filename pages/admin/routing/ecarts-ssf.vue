<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Le merchandiser et le vendeur du distributeur (SSF) qui travaillent ensemble un jour donné doivent passer dans les mêmes points de vente. Pour le jour choisi, la page compte les points de vente de la tournée du merchandiser que ce vendeur ne suit pas."
    >
      <template #actions>
        <UInput v-model="date" type="date" size="sm" class="w-40" aria-label="Jour contrôlé" />
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-path" :loading="chargement" @click="charger">Actualiser</UButton>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!lignesFiltrees.length" @click="exporter">Exporter</UButton>
      </template>
    </AdminPageHeader>

    <div v-if="erreur" class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200" role="alert">
      <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{{ erreur }}</p>
    </div>

    <!-- Synthèse -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div v-for="s in STATUTS" :key="s" class="admin-surface p-4">
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">{{ LIBELLES_ECART[s].label }}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ compte(s) }}</p>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ LIBELLES_ECART[s].aide }}</p>
      </div>
    </div>

    <!-- Filtres -->
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="recherche" icon="i-heroicons-magnifying-glass" size="sm" placeholder="Merchandiser ou vendeur…" aria-label="Rechercher un merchandiser ou un vendeur" class="w-56" />
      <USelect v-model="filtreDirection" :options="optionsDirection" size="sm" aria-label="Filtrer par direction" />
      <USelect v-model="filtreCommercial" :options="optionsCommercial" size="sm" aria-label="Filtrer par commercial" />
      <USelect v-model="filtreStatut" :options="optionsStatut" size="sm" aria-label="Filtrer par statut" />
      <span class="text-sm text-slate-600 dark:text-slate-300">{{ lignesFiltrees.length }} tournée(s) le {{ dateLisible }}</span>
    </div>

    <!-- data-no-column-tools : chaque ligne peut déplier une ligne de détail ;
         un tri du tableau les séparerait. Recherche, filtres et tri par écart sont au-dessus. -->
    <div class="admin-surface overflow-x-auto">
      <table class="admin-table" data-no-column-tools>
        <thead>
          <tr>
            <th>Merchandiser</th>
            <th>Commercial</th>
            <th>Vendeur du jour (SSF)</th>
            <th class="!text-right">PDV de la tournée</th>
            <th class="!text-right">Hors routing du vendeur</th>
            <th>Statut</th>
            <th class="w-24"><span class="sr-only">Détail</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="l in lignesFiltrees" :key="l.merchandiser_id">
            <tr>
              <td>
                <p class="font-semibold text-slate-900 dark:text-white">{{ l.nom || l.email }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ nomAgence(l.employeur) }} · {{ libelleDirection(l.direction, true) }}</p>
              </td>
              <td>{{ nomCommercial(l.commercial_id) }}</td>
              <td>{{ l.ssf_noms || '—' }}</td>
              <td class="text-right tabular-nums">{{ l.nb_pdv }}</td>
              <td class="whitespace-nowrap text-right tabular-nums">
                <template v-if="l.nb_hors_routing != null">
                  <span :class="l.nb_hors_routing ? 'font-semibold text-red-700 dark:text-red-300' : ''">{{ l.nb_hors_routing }}</span>
                  <span v-if="tauxEcart(l.nb_hors_routing, l.nb_pdv)" class="text-xs text-slate-500 dark:text-slate-400"> ({{ tauxEcart(l.nb_hors_routing, l.nb_pdv) }} %)</span>
                </template>
                <span v-else>—</span>
              </td>
              <td class="whitespace-nowrap">
                <UBadge :color="LIBELLES_ECART[l.statut as StatutEcart]?.couleur || 'gray'" variant="soft" size="xs" :title="LIBELLES_ECART[l.statut as StatutEcart]?.aide">
                  {{ LIBELLES_ECART[l.statut as StatutEcart]?.label || l.statut }}
                </UBadge>
              </td>
              <td class="text-center">
                <UButton
                  v-if="l.statut === 'hors_routing_ssf'"
                  size="xs"
                  variant="ghost"
                  color="gray"
                  :icon="ouvert === l.merchandiser_id ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  :loading="chargementDetail === l.merchandiser_id"
                  :aria-expanded="ouvert === l.merchandiser_id"
                  :aria-label="`Détail des écarts de ${l.nom || l.email}`"
                  @click="basculer(l)"
                >
                  Détail
                </UButton>
              </td>
            </tr>
            <tr v-if="ouvert === l.merchandiser_id">
              <td colspan="7" class="bg-slate-50 dark:bg-slate-800/60">
                <p class="mb-2 text-xs text-slate-600 dark:text-slate-300">
                  Points de vente de la tournée que {{ l.ssf_noms }} ne suit pas, avec pour chacun le ou les vendeurs qui le suivent dans le fichier du distributeur (DMS).
                </p>
                <!-- Liste plutôt que tableau imbriqué : les styles de .admin-table
                     s'appliqueraient aussi aux cellules de ce détail. -->
                <div class="hidden gap-x-3 pb-1 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:grid sm:grid-cols-[2fr_2fr_1fr_2fr]" aria-hidden="true">
                  <span>Point de vente</span>
                  <span>Zone › quartier</span>
                  <span>Canal</span>
                  <span>Vendeur dans le fichier du distributeur</span>
                </div>
                <ul class="divide-y divide-slate-200 text-xs dark:divide-slate-700">
                  <li
                    v-for="d in (details[l.merchandiser_id] || []).filter(x => !x.dans_routing)"
                    :key="d.pdv_id"
                    class="grid gap-x-3 gap-y-0.5 py-1.5 sm:grid-cols-[2fr_2fr_1fr_2fr]"
                  >
                    <span class="font-medium text-slate-900 dark:text-white">{{ d.nom_pdv || 'Point de vente sans nom' }}</span>
                    <span class="text-slate-700 dark:text-slate-200"><span class="sr-only">Zone et quartier : </span>{{ d.zone || '—' }} › {{ d.quartier || '—' }}</span>
                    <span class="text-slate-700 dark:text-slate-200"><span class="sr-only">Canal : </span>{{ d.canal || '—' }}</span>
                    <span class="text-slate-700 dark:text-slate-200"><span class="sr-only">Vendeur dans le fichier du distributeur : </span>{{ d.ssf_du_pdv || 'Aucun (point de vente absent du fichier du distributeur)' }}</span>
                  </li>
                </ul>
              </td>
            </tr>
          </template>
          <tr v-if="!chargement && !lignesFiltrees.length">
            <td colspan="7" class="!py-10 text-center">
              Aucune tournée de merchandiser ce jour-là pour ces filtres. Choisissez un autre jour ou élargissez les filtres.
            </td>
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
import { messageUtilisateur } from '~/utils/supabaseErrors'

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
      ? 'Ce contrôle n’est pas encore disponible sur le serveur. Prévenez l’administrateur technique.'
      : `Le contrôle n’a pas pu être chargé. ${messageUtilisateur(e)}`
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
    erreur.value = `Le détail n’a pas pu être chargé. ${messageUtilisateur(e)}`
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
