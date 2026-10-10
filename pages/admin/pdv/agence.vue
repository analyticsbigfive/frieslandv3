<template>
  <div class="space-y-6">
    <AdminPageHeader>
      <template #actions>
        <UButton icon="i-heroicons-arrow-path" variant="outline" :loading="chargement" @click="charger">Actualiser</UButton>
        <UButton icon="i-heroicons-arrow-down-tray" :disabled="!filtres.length" :loading="exportEnCours" @click="exporter">
          Exporter ({{ formatNombre(filtres.length) }})
        </UButton>
      </template>
    </AdminPageHeader>

    <!-- Admin, superviseur : l'agence à afficher. Un compte agence voit la sienne. -->
    <div v-if="!authStore.isAgence" class="flex flex-wrap items-center gap-2">
      <label for="pdv-agence-choix" class="text-sm font-medium text-slate-700 dark:text-slate-200">Agence</label>
      <USelect id="pdv-agence-choix" v-model="agence" :options="optionsAgence" size="sm" class="w-56" />
    </div>

    <div v-if="erreur" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100" role="alert">
      {{ erreur }}
    </div>

    <ChargementContenu v-else-if="chargement && !lignes.length" variante="lignes" libelle="Chargement des points de vente de l'agence…" />

    <section v-else class="admin-surface overflow-hidden" aria-label="Points de vente de l'agence">
      <!-- États : un clic filtre la liste (et l'URL, pour partager « Sans GPS »). -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div class="inline-flex flex-wrap rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Filtrer par état">
          <button
            v-for="e in ETATS_PDV_AGENCE"
            :key="e.value"
            type="button"
            class="rounded px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fc-red"
            :class="etat === e.value ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
            :aria-pressed="etat === e.value"
            @click="etat = e.value"
          >
            {{ e.label }}
            <span class="ml-1 tabular-nums" :class="etat === e.value ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'">{{ formatNombre(comptes[e.value]) }}</span>
          </button>
        </div>
        <p class="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">{{ etatCourant.aide }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <UInput v-model="recherche" icon="i-heroicons-magnifying-glass" size="sm" placeholder="Nom, téléphone, quartier…" aria-label="Rechercher un point de vente" class="w-full sm:w-64" />
        <USelectMenu v-model="zone" :options="optionsZone" value-attribute="value" option-attribute="label" searchable searchable-placeholder="Rechercher…" size="sm" class="w-full sm:w-48" aria-label="Filtrer par zone" />
        <USelectMenu v-model="merchandiser" :options="optionsMerchandiser" value-attribute="value" option-attribute="label" searchable searchable-placeholder="Rechercher…" size="sm" class="w-full sm:w-56" aria-label="Filtrer par merchandiser" />
        <UButton v-if="filtresActifs" size="xs" variant="ghost" color="gray" icon="i-heroicons-x-mark" @click="reinitialiser">Effacer les filtres</UButton>
        <span class="ml-auto text-xs tabular-nums text-slate-600 dark:text-slate-300" aria-live="polite">{{ formatNombre(filtres.length) }} point{{ filtres.length > 1 ? 's' : '' }} de vente</span>
      </div>

      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Point de vente</th>
              <th scope="col">Zone › quartier</th>
              <th scope="col">Distributeur</th>
              <th scope="col">Téléphone</th>
              <th scope="col">Position</th>
              <th scope="col">Visites</th>
              <th scope="col">Merchandiser</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in page" :key="p.pdv_id">
              <td>
                <p class="font-medium text-slate-900 dark:text-white">{{ p.nom_pdv || 'Point de vente sans nom' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ [libelleCanal(p.canal), typePdvLabel(p.sous_categorie_pdv)].filter(Boolean).join(' · ') || '—' }}</p>
              </td>
              <td>{{ [p.zone, p.quartier].filter(Boolean).join(' › ') || '—' }}</td>
              <td>{{ p.distributor_name || '—' }}</td>
              <td class="whitespace-nowrap tabular-nums">{{ p.adressage || '—' }}</td>
              <td class="whitespace-nowrap">
                <NuxtLink
                  v-if="aGps(p)"
                  :to="{ path: '/admin/map', query: { lat: String(p.geolocation_lat), lng: String(p.geolocation_lng) } }"
                  class="inline-flex items-center gap-1 text-sm font-medium text-fc-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fc-red"
                  :aria-label="`Voir ${p.nom_pdv || 'ce point de vente'} sur la carte`"
                >
                  <UIcon name="i-heroicons-map-pin" class="h-4 w-4 shrink-0" aria-hidden="true" />
                  Voir sur la carte
                </NuxtLink>
                <UBadge v-else variant="soft" color="amber" size="xs">Sans GPS</UBadge>
              </td>
              <td class="whitespace-nowrap tabular-nums">
                <template v-if="p.nb_visites">
                  {{ p.nb_visites }} · {{ formatDateFr(p.derniere_visite) }}
                </template>
                <span v-else class="text-slate-500 dark:text-slate-400">Jamais</span>
              </td>
              <td>
                <p>{{ merchandiserDe(p) || '—' }}</p>
                <p v-if="!p.nb_visites && p.recense_par" class="text-xs text-slate-500 dark:text-slate-400">l'a recensé</p>
              </td>
            </tr>
            <tr v-if="!filtres.length">
              <td colspan="7" class="py-8 text-center text-slate-600 dark:text-slate-300">
                <template v-if="!lignes.length">Aucun point de vente visité ou recensé par les merchandisers de cette agence.</template>
                <template v-else-if="etat === 'sans-gps' && !filtresActifs">Tous les points de vente de l'agence ont une position GPS.</template>
                <template v-else>Aucun point de vente pour ces filtres. Changez l'état ou effacez les filtres.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
        <AdminPagination :total="filtres.length" :page="numeroPage" :page-size="PAR_PAGE" :loading="chargement" item-label="PDV" @update:page="(n) => { numeroPage = n }" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { fetchAllRows } from '~/utils/fetchAll'
import { isModernTrade } from '~/utils/canal'
import { messageUtilisateur } from '~/utils/supabaseErrors'
import { EMPLOYEUR_FRIESLAND } from '~/utils/agences'
import { formatDateFr } from '~/utils/dates'
import {
  aGps, compterEtats, ETATS_PDV_AGENCE, filtrerPdvAgence, lireEtat, merchandiserDe,
  type EtatPdvAgence, type PdvAgence,
} from '~/utils/pdvAgence'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const PAR_PAGE = 50
const supabase = useSupabaseClient()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const { actives: agencesActives, charger: chargerAgences } = useAgences()
const { exportPdvAgenceToExcel } = useCsvExport()

const lignes = ref<PdvAgence[]>([])
const chargement = ref(true)
const erreur = ref('')
const exportEnCours = ref(false)

// Filtres : l'état et l'agence vont dans l'URL (lien « Sans GPS » à envoyer).
const etat = ref<EtatPdvAgence>(lireEtat(route.query.etat))
const agence = ref(typeof route.query.agence === 'string' ? route.query.agence : '')
const recherche = ref('')
const zone = ref('')
const merchandiser = ref('')
const numeroPage = ref(1)

const optionsAgence = computed(() => agencesActives.value
  .filter(a => a.code !== EMPLOYEUR_FRIESLAND)
  .map(a => ({ label: a.nom, value: a.code })))

const etatCourant = computed(() => ETATS_PDV_AGENCE.find(e => e.value === etat.value) || ETATS_PDV_AGENCE[0]!)
const comptes = computed(() => compterEtats(lignes.value))
const optionsZone = computed(() => [
  { label: 'Toutes les zones', value: '' },
  ...[...new Set(lignes.value.map(p => p.zone).filter((z): z is string => !!z))]
    .sort((a, b) => a.localeCompare(b, 'fr')).map(z => ({ label: z, value: z })),
])
const optionsMerchandiser = computed(() => [
  { label: 'Tous les merchandisers', value: '' },
  ...[...new Set(lignes.value.map(merchandiserDe).filter((m): m is string => !!m))]
    .sort((a, b) => a.localeCompare(b, 'fr')).map(m => ({ label: m, value: m })),
])
const filtresActifs = computed(() => !!(recherche.value.trim() || zone.value || merchandiser.value))
const filtres = computed(() => filtrerPdvAgence(lignes.value, {
  etat: etat.value, recherche: recherche.value, zone: zone.value, merchandiser: merchandiser.value,
}))
const page = computed(() => filtres.value.slice((numeroPage.value - 1) * PAR_PAGE, numeroPage.value * PAR_PAGE))

watch([etat, recherche, zone, merchandiser], () => { numeroPage.value = 1 })
watch([etat, agence], ([e, a]) => {
  const query = { ...route.query, etat: e === 'tous' ? undefined : e, agence: authStore.isAgence || !a ? undefined : a }
  router.replace({ query })
})
watch(agence, () => { void charger() })

const nombreFr = new Intl.NumberFormat('fr-FR')
function formatNombre(n: number) {
  return nombreFr.format(n)
}

// Affichage seulement : la valeur de base reste General trade / Modern trade.
function libelleCanal(canal: string | null | undefined) {
  if (!canal) return ''
  return isModernTrade(canal) ? 'Supermarchés (MT)' : 'Boutiques (GT)'
}

function reinitialiser() {
  recherche.value = ''
  zone.value = ''
  merchandiser.value = ''
}

async function charger() {
  if (!authStore.isAgence && !agence.value) return
  chargement.value = true
  erreur.value = ''
  try {
    lignes.value = await fetchAllRows<PdvAgence>((from, to) => (supabase.rpc as any)('pdv_agence', { p_agence: authStore.isAgence ? null : agence.value })
      .order('nom_pdv').order('pdv_id').range(from, to))
  }
  catch (err: any) {
    lignes.value = []
    erreur.value = err?.code === 'PGRST202'
      ? 'Cet écran sera disponible après la mise à jour du serveur. Prévenez l\'administrateur technique.'
      : messageUtilisateur(err, 'Les points de vente de l\'agence n\'ont pas pu être chargés. Réessayez dans quelques instants.')
  }
  finally {
    chargement.value = false
  }
}

async function exporter() {
  exportEnCours.value = true
  try {
    const nomAgence = authStore.isAgence ? (authStore.agenceCourante || 'agence') : agence.value
    const suffixe = etat.value === 'tous' ? '' : `-${etat.value}`
    await exportPdvAgenceToExcel(filtres.value, `pdv-${nomAgence}${suffixe}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  catch (err) {
    toast.add({ title: 'Export impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    exportEnCours.value = false
  }
}

onMounted(async () => {
  void fetchTypePdvLabels()
  if (!authStore.isAgence) {
    await chargerAgences()
    // Sans agence dans l'URL : la première agence (Atom aujourd'hui) ; le watch charge.
    if (!agence.value) agence.value = optionsAgence.value[0]?.value || ''
    else await charger()
    if (!agence.value) chargement.value = false
    return
  }
  await charger()
})
</script>
