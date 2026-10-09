<template>
  <div class="space-y-6">
    <AdminPageHeader description="Comment se répartissent les points de vente actifs : par canal, territoire, catégorie et sous-région." />

    <ChargementContenu v-if="loading" variante="cartes" :nombre="3" classe-carte="admin-surface" libelle="Chargement des points de vente…" />

    <div v-else-if="erreur" class="admin-surface p-6 text-sm text-slate-700 dark:text-slate-200" role="alert">
      <p class="font-semibold text-slate-900 dark:text-white">Les points de vente n’ont pas pu être chargés.</p>
      <p class="mt-1">{{ erreur }}</p>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Points de vente actifs" :value="allPDV.length" icon="i-heroicons-map-pin" color="red" />
        <StatsCard title="Territoires" :value="uniqueZones" icon="i-heroicons-map" />
        <StatsCard title="Sous-régions" :value="uniqueRegions" icon="i-heroicons-globe-alt" />
        <StatsCard title="Canaux" :value="uniqueCanaux" icon="i-heroicons-building-storefront" />
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section v-for="graphique in graphiques" :key="graphique.titre" class="admin-surface p-5">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">{{ graphique.titre }}</h2>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ graphique.aide }}</p>
          <ClientOnly>
            <ChartsPieChart
              v-if="graphique.donnees.length"
              class="mt-4"
              bare
              :labels="graphique.donnees.map(d => d.type)"
              :values="graphique.donnees.map(d => d.count)"
              :colors="couleursRepartition(graphique.donnees)"
              height="lg"
            />
          </ClientOnly>
          <p v-if="!graphique.donnees.length" class="mt-4 flex h-40 items-center justify-center rounded-md bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
            {{ graphique.vide }}
          </p>
        </section>
      </div>

      <section class="admin-surface overflow-hidden">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Détail par territoire</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Territoire</th>
                <th class="text-right">Points de vente</th>
                <th class="text-right">Part du parc</th>
                <th class="text-right"><span class="sr-only">Lien vers la liste</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in zoneTable" :key="row.zone">
                <td class="font-medium text-slate-900 dark:text-white">{{ row.zone }}</td>
                <td class="text-right tabular-nums">{{ row.count.toLocaleString('fr-FR') }}</td>
                <td class="text-right tabular-nums">{{ row.pct }} %</td>
                <td class="text-right">
                  <UButton
                    size="xs"
                    color="gray"
                    variant="ghost"
                    trailing-icon="i-heroicons-arrow-right"
                    :aria-label="`Voir les points de vente : ${row.zone}`"
                    @click="openPDVList(row.zone)"
                  >
                    Voir les points de vente
                  </UButton>
                </td>
              </tr>
              <tr v-if="!zoneTable.length">
                <td colspan="4" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucun point de vente actif. Ajoutez-en depuis l’onglet Liste.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { AUTRE, SERIES } from '~/utils/chartPalette'
import { isModernTrade } from '~/utils/canal'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const pdvStore = usePDVStore()
const { categoriePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const allPDV = ref<any[]>([])
const loading = ref(true)
const erreur = ref('')

// Valeur du filtre « Sans territoire » de la liste (pages/admin/pdv/index.vue, SANS_ZONE_LABEL).
const SANS_TERRITOIRE_FILTRE = '— Sans territoire —'
const NON_RENSEIGNE = 'Non renseigné'
const AUTRES = 'Autres'

const uniqueZones = computed(() => new Set(allPDV.value.map(p => p.zone).filter(Boolean)).size)
const uniqueRegions = computed(() => new Set(allPDV.value.map(p => p.region).filter(Boolean)).size)
const uniqueCanaux = computed(() => new Set(allPDV.value.map(p => p.canal).filter(Boolean)).size)

// Huit parts au plus (palette commune), le reste regroupé en « Autres ».
// Sans aucune valeur renseignée, pas de graphique : l'état vide l'explique.
function buildDistribution(field: string, libelle: (v: string) => string = v => v): { type: string; count: number }[] {
  const counts = new Map<string, number>()
  let renseignes = 0
  allPDV.value.forEach((p: any) => {
    const brut = p[field]
    if (brut) renseignes++
    const key = brut ? libelle(String(brut)) : NON_RENSEIGNE
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  if (!renseignes) return []
  const tries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const tete = tries.slice(0, SERIES.length)
  const reste = tries.slice(SERIES.length).reduce((n, [, c]) => n + c, 0)
  return [
    ...tete.map(([type, count]) => ({ type, count })),
    ...(reste ? [{ type: AUTRES, count: reste }] : []),
  ]
}

function couleursRepartition(donnees: { type: string }[]): string[] {
  let i = 0
  return donnees.map(d => (d.type === AUTRES || d.type === NON_RENSEIGNE ? AUTRE : SERIES[i++] ?? AUTRE))
}

const libelleCanal = (v: string) => (isModernTrade(v) ? 'Supermarchés (MT)' : 'Boutiques (GT)')

const graphiques = computed(() => [
  { titre: 'Par canal', aide: 'Boutiques (GT) et supermarchés (MT).', donnees: buildDistribution('canal', libelleCanal), vide: 'Le canal n’est renseigné pour aucun point de vente.' },
  { titre: 'Par territoire', aide: 'Les huit territoires les plus fournis ; les autres sont regroupés.', donnees: buildDistribution('zone'), vide: 'Aucun point de vente n’est rattaché à un territoire.' },
  { titre: 'Par catégorie', aide: 'Grandes familles de commerce.', donnees: buildDistribution('categorie_pdv', v => categoriePdvLabel(v)), vide: 'La catégorie n’est pas disponible pour ces points de vente.' },
  { titre: 'Par sous-région', aide: 'Les huit sous-régions les plus fournies ; les autres sont regroupées.', donnees: buildDistribution('region'), vide: 'Aucun point de vente n’est rattaché à une sous-région.' },
])

const zoneTable = computed(() => {
  const counts = new Map<string, number>()
  allPDV.value.forEach((p: any) => {
    const key = p.zone || 'Sans territoire'
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  const total = allPDV.value.length || 1
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([zone, count]) => ({ zone, count, pct: Math.round(count / total * 100) }))
})

function openPDVList(zone: string) {
  // « Sans territoire » ouvre la liste filtrée sur les PDV sans territoire.
  const query = zone === 'Sans territoire' ? { zone: SANS_TERRITOIRE_FILTRE } : zone ? { zone } : {}
  navigateTo({ path: '/admin/pdv', query })
}

onMounted(async () => {
  fetchTypePdvLabels()
  try {
    allPDV.value = await pdvStore.fetchAllPDV(false, 'pdv_id,zone,region,canal,categorie_pdv')
  } catch (err) {
    console.error('Erreur chargement PDV:', err)
    erreur.value = messageUtilisateur(err)
  } finally {
    loading.value = false
  }
})
</script>
