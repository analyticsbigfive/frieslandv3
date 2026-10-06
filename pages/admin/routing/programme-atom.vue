<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Programme Atom"
      eyebrow="Routing & Planning"
      :description="`Couverture du mois par merchandiser Atom : chaque PDV une fois par mois, objectif de ${objectifAffiche} PDV par agent.`"
    >
      <template #actions>
        <UInput v-model="mois" type="month" size="sm" class="w-44" aria-label="Mois" />
        <UButton size="sm" color="gray" variant="soft" icon="i-heroicons-arrow-path" :loading="chargement" @click="charger">Actualiser</UButton>
      </template>
    </AdminPageHeader>

    <div v-if="erreur" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      {{ erreur }}
    </div>

    <!-- Synthèse -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="admin-surface p-4">
        <p class="text-xs font-semibold uppercase text-gray-500">PDV visités</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{{ total('nb_visites') }}</p>
        <p class="text-xs text-gray-500">sur un objectif de {{ total('objectif_mensuel') }}</p>
      </div>
      <div class="admin-surface p-4">
        <p class="text-xs font-semibold uppercase text-gray-500">Avancement</p>
        <p class="mt-1 text-2xl font-bold tabular-nums" :class="couleurTaux(tauxGlobal)">{{ tauxGlobal }} %</p>
        <p class="text-xs text-gray-500">{{ joursEcoules }}</p>
      </div>
      <div class="admin-surface p-4">
        <p class="text-xs font-semibold uppercase text-gray-500">PDV planifiés</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{{ total('nb_planifies') }}</p>
        <p class="text-xs text-gray-500">dans les tournées du mois</p>
      </div>
      <div class="admin-surface p-4">
        <p class="text-xs font-semibold uppercase text-gray-500">En Perfect Store</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{{ total('nb_perfect_store') }}</p>
        <p class="text-xs text-gray-500">PDV visités au niveau requis</p>
      </div>
    </div>

    <!-- Par merchandiser -->
    <div class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500">Merchandiser</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500" title="PDV des règles de tournée par quotas">Portefeuille</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500" title="PDV d’un canal de la grille de quotas">Éligibles</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500">Planifiés</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500">Visités</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500">Perfect Store</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500">Objectif</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500">Reste</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="r in lignes" :key="r.user_id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-2.5 text-sm">
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ r.nom || r.email }}</p>
              <p class="text-xs text-gray-400">{{ r.email }}</p>
            </td>
            <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ r.nb_portefeuille }}</td>
            <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ r.nb_eligibles }}</td>
            <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ r.nb_planifies }}</td>
            <td class="px-4 py-2.5 text-center text-sm font-semibold tabular-nums">{{ r.nb_visites }}</td>
            <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ r.nb_perfect_store }}</td>
            <td class="min-w-[12rem] px-4 py-2.5 text-sm">
              <div class="flex items-center gap-2">
                <div class="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-700">
                  <div class="h-2 rounded-full" :class="fondTaux(taux(r))" :style="{ width: `${Math.min(taux(r), 100)}%` }" />
                </div>
                <span class="w-12 text-right text-xs font-semibold tabular-nums" :class="couleurTaux(taux(r))">{{ taux(r) }} %</span>
              </div>
            </td>
            <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ r.reste_a_visiter }}</td>
          </tr>
          <tr v-if="!chargement && !lignes.length">
            <td colspan="8" class="px-4 py-10 text-center text-sm text-gray-400">Aucun merchandiser Atom actif.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400">
      Réglages : grille des quotas et canal des sous-catégories dans
      <NuxtLink to="/admin/referentiels?onglet=quotas_atom" class="font-semibold text-fc-red underline">Référentiels › Quotas Atom</NuxtLink>,
      objectif mensuel dans
      <NuxtLink to="/admin/referentiels?onglet=parametre_app" class="font-semibold text-fc-red underline">Paramètres terrain</NuxtLink>,
      planning par SSF dans <NuxtLink to="/admin/routing" class="font-semibold text-fc-red underline">Routing › Règles</NuxtLink>.
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()

const maintenant = new Date()
const mois = ref(`${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`)
const lignes = ref<any[]>([])
const chargement = ref(false)
const erreur = ref('')

const total = (cle: string) => lignes.value.reduce((n, r) => n + Number(r[cle] || 0), 0)
const taux = (r: any) => (Number(r.objectif_mensuel) > 0 ? Math.round((Number(r.nb_visites) / Number(r.objectif_mensuel)) * 100) : 0)
const tauxGlobal = computed(() => (total('objectif_mensuel') > 0 ? Math.round((total('nb_visites') / total('objectif_mensuel')) * 100) : 0))
const objectifAffiche = computed(() => lignes.value[0]?.objectif_mensuel ?? 420)

// Rythme attendu : part du mois écoulée (mois en cours seulement).
const joursEcoules = computed(() => {
  const [a, m] = mois.value.split('-').map(Number)
  const finMois = new Date(a, m, 0).getDate()
  const aujourdhui = new Date()
  if (aujourdhui.getFullYear() !== a || aujourdhui.getMonth() + 1 !== m) return 'mois complet'
  return `${Math.round((aujourdhui.getDate() / finMois) * 100)} % du mois écoulé`
})
const couleurTaux = (t: number) => (t >= 90 ? 'text-emerald-600' : t >= 50 ? 'text-amber-600' : 'text-red-600')
const fondTaux = (t: number) => (t >= 90 ? 'bg-emerald-500' : t >= 50 ? 'bg-amber-500' : 'bg-red-500')

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const { data, error } = await (supabase.rpc as any)('programme_atom', { p_mois: `${mois.value}-01` })
    if (!error) { lignes.value = data || []; return }
    // Base sans la migration 20261007120000 : vue du mois en cours seulement.
    const repli = await (supabase.from('v_programme_atom') as any).select('*')
    if (repli.error) throw repli.error
    lignes.value = repli.data || []
    erreur.value = 'Seul le mois en cours est disponible tant que la migration des paramètres terrain n’est pas appliquée.'
  }
  catch (e: any) {
    erreur.value = `Programme indisponible : ${e.message}`
    lignes.value = []
  }
  finally {
    chargement.value = false
  }
}

watch(mois, charger)
onMounted(charger)
</script>
