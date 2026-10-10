<template>
  <div class="space-y-6">
    <!-- Titre du registre (« Programme merchandiser ») : la direction est déjà
         dans le contrôle segmenté. -->
    <AdminPageHeader description="Couverture du mois des merchandisers d’agence : chaque point de vente une fois par mois.">
      <template #description>
        <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Agences {{ direction === 'north' ? 'de l’intérieur' : 'd’Abidjan' }}<template v-if="agencesTexte"> ({{ agencesTexte }})</template>.
          Objectif de chaque merchandiser : les quotas de la grille sur ses jours de tournée du mois<template v-if="lignes.length"> ({{ objectifAffiche }})</template>.
        </p>
      </template>
      <template #actions>
        <!-- Direction : un filtre de la page (pas deux entrées de menu). -->
        <div v-if="!directionImposee" class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="radiogroup" aria-label="Direction">
          <button
            v-for="d in OPTIONS_DIRECTION"
            :key="d.value"
            type="button"
            role="radio"
            :aria-checked="direction === d.value"
            class="rounded px-3 py-1 text-sm font-medium transition-colors"
            :class="direction === d.value ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
            @click="direction = d.value"
          >
            {{ d.label }}
          </button>
        </div>
        <UInput v-model="mois" type="month" size="sm" class="w-44" aria-label="Mois" />
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-path" :loading="chargement" @click="charger">Actualiser</UButton>
      </template>
    </AdminPageHeader>

    <div v-if="erreur" class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200" role="alert">
      <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{{ erreur }}</p>
    </div>

    <!-- Synthèse -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="admin-surface p-4">
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">PDV visités</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ total('nb_visites') }}</p>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">sur un objectif de {{ total('objectif_mensuel') }}</p>
      </div>
      <div class="admin-surface p-4">
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">Avancement</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ tauxGlobal }} %</p>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ joursEcoules }}</p>
      </div>
      <div class="admin-surface p-4">
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">PDV planifiés</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ total('nb_planifies') }}</p>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">dans les tournées du mois</p>
      </div>
      <div class="admin-surface p-4">
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">En Perfect Store</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ total('nb_perfect_store') }}</p>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">PDV visités au niveau requis</p>
      </div>
    </div>

    <!-- Par merchandiser -->
    <p class="-mb-3 text-sm text-slate-600 dark:text-slate-300">
      <strong class="font-semibold text-slate-700 dark:text-slate-200">Portefeuille</strong> : points de vente de ses règles par quotas.
      <strong class="font-semibold text-slate-700 dark:text-slate-200">Éligibles</strong> : ceux dont le canal figure dans la grille des quotas.
    </p>
    <div class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Merchandiser</th>
            <th v-if="plusieursAgences">Agence</th>
            <th class="!text-right">Portefeuille</th>
            <th class="!text-right">Éligibles</th>
            <th class="!text-right">Planifiés</th>
            <th class="!text-right">Visités</th>
            <th class="!text-right">Perfect Store</th>
            <th>Objectif du mois</th>
            <th class="!text-right">Reste à visiter</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in lignes" :key="r.user_id">
            <td>
              <p class="font-semibold text-slate-900 dark:text-white">{{ r.nom || r.email }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ r.email }}</p>
            </td>
            <td v-if="plusieursAgences">{{ r.agence || '—' }}</td>
            <td class="text-right tabular-nums">{{ r.nb_portefeuille }}</td>
            <td class="text-right tabular-nums">{{ r.nb_eligibles }}</td>
            <td class="text-right tabular-nums">{{ r.nb_planifies }}</td>
            <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ r.nb_visites }}</td>
            <td class="text-right tabular-nums">{{ r.nb_perfect_store }}</td>
            <td class="min-w-[12rem]">
              <div class="flex items-center gap-2">
                <div class="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                  <div class="h-2 rounded-full" :style="{ width: `${Math.min(taux(r), 100)}%`, backgroundColor: fondTaux(taux(r)) }" />
                </div>
                <span class="w-12 text-right text-xs font-semibold tabular-nums" :class="couleurTaux(taux(r))">{{ taux(r) }} %</span>
              </div>
            </td>
            <td class="text-right tabular-nums">{{ r.reste_a_visiter }}</td>
          </tr>
          <tr v-if="!chargement && !lignes.length">
            <td :colspan="plusieursAgences ? 9 : 8" class="!py-10 text-center">
              Aucun merchandiser actif dans une agence {{ libelleDirection(direction, true) }}<template v-if="!agencesTexte"> : créez ou rattachez l’agence dans
                <AdminLienEcran chemin="/admin/referentiels" liste="agence">Référentiels › Agences</AdminLienEcran>,
                puis ses merchandisers dans
                <AdminLienEcran chemin="/admin/users">Paramètres › Utilisateurs</AdminLienEcran></template>.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Liens vers les réglages : seulement ceux que ce compte peut ouvrir. -->
    <p v-if="peutOuvrir('/admin/referentiels')" class="text-sm text-slate-600 dark:text-slate-300">
      Réglages :
      <template v-if="!authStore.isAgence">
        la grille des quotas, commune aux directions (elle fixe aussi l'objectif du mois), dans
        <AdminLienEcran chemin="/admin/referentiels" liste="quotas_atom">Référentiels › Quotas du programme merchandiser</AdminLienEcran> ;
        les agences dans <AdminLienEcran chemin="/admin/referentiels" liste="agence">Référentiels › Agences</AdminLienEcran> ;
      </template>
      le routing mensuel de l’agence dans <AdminLienEcran chemin="/admin/referentiels" liste="routing_mensuel">Référentiels › Routing mensuel</AdminLienEcran>.
    </p>
  </div>
</template>

<script setup lang="ts">
import { DIRECTIONS, libelleDirection, type Direction } from '~/utils/agences'
import { STATUT } from '~/utils/chartPalette'
import { messageUtilisateur } from '~/utils/supabaseErrors'

// Programme merchandiser South (Abidjan, ex-« Programme Atom ») et North
// (intérieur) : même calcul, agences « programme » de la direction choisie.
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const { peutOuvrir } = useAdminNavigation()
const route = useRoute()
const router = useRouter()
const OPTIONS_DIRECTION = DIRECTIONS.filter(d => d.value !== 'mt').map(d => ({ value: d.value, label: d.court }))
const direction = ref<Direction>(route.query.direction === 'north' ? 'north' : 'south')
watch(() => route.query.direction, (d) => { direction.value = d === 'north' ? 'north' : 'south' })
watch(direction, (d) => { if (route.query.direction !== d) router.replace({ query: { ...route.query, direction: d } }) })
const { programmes, charger: chargerAgences } = useAgences()
// Compte agence : une seule direction, celle de son agence (pas de bascule).
const directionImposee = computed<Direction | null>(() => {
  if (!authStore.isAgence) return null
  const d = (authStore.profile as any)?.direction || programmes.value.find(a => a.code === authStore.agenceCourante)?.direction
  return d === 'north' || d === 'south' ? d : null
})
watch(directionImposee, (d) => { if (d && direction.value !== d) direction.value = d }, { immediate: true })
const agencesTexte = computed(() => programmes.value.filter(a => a.direction === direction.value).map(a => a.nom).join(', '))
const plusieursAgences = computed(() => new Set(lignes.value.map(r => r.agence).filter(Boolean)).size > 1)

const maintenant = new Date()
const mois = ref(`${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`)
const lignes = ref<any[]>([])
const chargement = ref(false)
const erreur = ref('')

const total = (cle: string) => lignes.value.reduce((n, r) => n + Number(r[cle] || 0), 0)
const taux = (r: any) => (Number(r.objectif_mensuel) > 0 ? Math.round((Number(r.nb_visites) / Number(r.objectif_mensuel)) * 100) : 0)
const tauxGlobal = computed(() => (total('objectif_mensuel') > 0 ? Math.round((total('nb_visites') / total('objectif_mensuel')) * 100) : 0))
// Objectifs du mois : souvent identiques (même grille, mêmes jours), sinon la fourchette.
const objectifAffiche = computed(() => {
  const valeurs = [...new Set(lignes.value.map(r => Number(r.objectif_mensuel) || 0))].sort((a, b) => a - b)
  if (!valeurs.length) return 'aucun agent'
  return valeurs.length === 1 ? `${valeurs[0]} PDV` : `de ${valeurs[0]} à ${valeurs[valeurs.length - 1]} PDV`
})

// Rythme attendu : part du mois écoulée (mois en cours seulement).
const joursEcoules = computed(() => {
  const [a, m] = mois.value.split('-').map(Number)
  const finMois = new Date(a, m, 0).getDate()
  const aujourdhui = new Date()
  if (aujourdhui.getFullYear() !== a || aujourdhui.getMonth() + 1 !== m) return 'mois complet'
  return `${Math.round((aujourdhui.getDate() / finMois) * 100)} % du mois écoulé`
})
// Texte du taux en -700 (contraste ≥ 4,5:1 sur blanc) ; barre aux couleurs de statut de la charte.
const couleurTaux = (t: number) => (t >= 90 ? 'text-emerald-700 dark:text-emerald-300' : t >= 50 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300')
const fondTaux = (t: number) => (t >= 90 ? STATUT.bon : t >= 50 ? STATUT.alerte : STATUT.critique)

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const { data, error } = await (supabase.rpc as any)('programme_merchandiser', { p_mois: `${mois.value}-01`, p_direction: direction.value })
    if (!error) { lignes.value = data || []; return }
    // Base sans la migration 20261008150000 : programme Atom (South) seulement.
    if (direction.value === 'south') {
      const ancien = await (supabase.rpc as any)('programme_atom', { p_mois: `${mois.value}-01` })
      if (!ancien.error) { lignes.value = ancien.data || []; return }
    }
    else { lignes.value = []; erreur.value = 'Le programme North n’est pas encore disponible sur le serveur. Prévenez l’administrateur technique.'; return }
    // Base sans la migration 20261007120000 : vue du mois en cours seulement.
    const repli = await (supabase.from('v_programme_atom') as any).select('*')
    if (repli.error) throw repli.error
    lignes.value = repli.data || []
    erreur.value = 'Seul le mois en cours peut être affiché pour l’instant : les autres mois ne sont pas encore disponibles sur le serveur.'
  }
  catch (e: any) {
    erreur.value = `Le programme n’a pas pu être chargé. ${messageUtilisateur(e)}`
    lignes.value = []
  }
  finally {
    chargement.value = false
  }
}

watch([mois, direction], charger)
onMounted(() => { void chargerAgences(); void charger() })
</script>
