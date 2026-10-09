<template>
  <div class="space-y-6">
    <AdminPageHeader>
      <template #actions>
        <UFormGroup label="Famille de produits" size="sm" class="w-56">
          <USelectMenu
            :model-value="famille"
            :options="optionsFamilles"
            option-attribute="label"
            value-attribute="value"
            size="sm"
            @update:model-value="choisirFamille"
          />
        </UFormGroup>
      </template>
    </AdminPageHeader>

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" variante="cartes" libelle="Chargement des relevés…" />

    <template v-else>
      <!-- ======= Disponibilité ======= -->
      <template v-if="vue === 'disponibilite'">
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard title="Visites analysées" :value="dashboard.totalVisites.value" icon="i-heroicons-clipboard-document-list" color="blue" />
          <StatsCard :title="`Visites avec ${nomFamille}`" :value="nbPresence" icon="i-heroicons-check-circle" color="green" />
          <StatsCard title="Présence de la famille" :value="`${pctPresence.toLocaleString('fr-FR')} %`" format="none" icon="i-heroicons-chart-bar" color="blue" />
          <StatsCard title="Prix respectés" :value="`${pctPrix} %`" format="none" icon="i-heroicons-banknotes" color="orange" />
        </div>

        <section class="space-y-3">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Disponibilité par référence</h2>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Part des visites où la référence était en rayon, parmi celles où la famille {{ nomFamille }} a été relevée.
          </p>
          <div v-if="nbPresence === 0" class="admin-surface p-8 text-center text-sm text-slate-600 dark:text-slate-300">
            Aucune visite de la période n'a relevé la famille {{ nomFamille }}. Élargissez la période ou changez de famille.
          </div>
          <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <ClientOnly>
              <div v-for="prod in prods" :key="`${famille}:${prod.key}`" class="admin-surface p-4">
                <h3 class="mb-2 truncate text-center text-sm font-semibold text-slate-700 dark:text-slate-200" :title="prod.name">{{ prod.name }}</h3>
                <ChartsPieChart
                  :labels="['En rupture', 'Présent']"
                  :values="[prodRupture(prod.key), prodPresent(prod.key)]"
                  :colors="[...COULEURS_PRESENCE]"
                  height="sm"
                  :show-percentages="true"
                  bare
                />
              </div>
            </ClientOnly>
          </div>
        </section>

        <!-- Le graphique porte sa propre carte : pas de carte dans une carte. -->
        <ClientOnly>
          <ChartsVisitesLineChart
            v-if="evoPresence.length"
            :title="`Évolution : visites où ${nomFamille} est présent`"
            subtitle="Nombre de visites par semaine."
            :data="evoPresence"
            series-label="Visites"
          />
          <div v-else class="admin-surface p-6">
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">Évolution : visites où {{ nomFamille }} est présent</h2>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Pas assez de visites sur la période pour tracer une évolution. Élargissez la période.</p>
          </div>
        </ClientOnly>
      </template>

      <!-- ======= Prix ======= -->
      <template v-else-if="vue === 'prix'">
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatsCard :title="`Visites avec ${nomFamille}`" :value="nbPresence" icon="i-heroicons-clipboard-document-list" color="blue" />
          <StatsCard title="Prix respectés" :value="`${pctPrix} %`" format="none" icon="i-heroicons-check-circle" color="green" />
          <StatsCard title="Prix non respectés" :value="`${nbPresence ? 100 - pctPrix : 0} %`" format="none" icon="i-heroicons-x-circle" color="red" />
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div class="admin-surface p-6">
            <h2 class="mb-4 text-base font-semibold text-slate-900 dark:text-white">Prix respectés : {{ nomFamille }}</h2>
            <ClientOnly>
              <ChartsPieChart
                v-if="nbPresence"
                :labels="['Non respecté', 'Respecté']"
                :values="[prixNonRespecte, prixRespecte]"
                :colors="[...COULEURS_RESPECT]"
                height="md"
                :show-percentages="true"
                bare
              />
              <p v-else class="py-8 text-center text-sm text-slate-600 dark:text-slate-300">Aucun relevé de prix sur la période.</p>
            </ClientOnly>
          </div>
          <ClientOnly>
            <ChartsVisitesLineChart
              v-if="evoPrix.length"
              title="Évolution des prix respectés"
              subtitle="Visites par semaine où le prix relevé est conforme."
              :data="evoPrix"
              series-label="Visites"
            />
            <div v-else class="admin-surface p-6">
              <h2 class="text-base font-semibold text-slate-900 dark:text-white">Évolution des prix respectés</h2>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Pas assez de visites sur la période pour tracer une évolution. Élargissez la période.</p>
            </div>
          </ClientOnly>
        </div>
      </template>

      <!-- ======= Détail par visite ======= -->
      <template v-else>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <strong class="tabular-nums text-slate-900 dark:text-white">{{ releves.length }}</strong> visite(s) · une ligne par visite, une colonne par référence de la famille {{ nomFamille }}.
        </p>

        <div class="admin-surface overflow-x-auto">
          <table class="admin-table text-sm">
            <thead class="sticky top-0">
              <tr>
                <th>Date</th>
                <th>Point de vente</th>
                <th>Canal</th>
                <th>Sous-région</th>
                <th>Merchandiser</th>
                <th class="text-center">Famille présente</th>
                <th class="text-center">Prix respectés</th>
                <th v-for="prod in prods" :key="prod.key" class="whitespace-nowrap text-center">{{ prod.name }}</th>
              </tr>
              <tr class="bg-white dark:bg-slate-800">
                <th><UInput v-model="filtres.date" size="xs" placeholder="jj/mm" aria-label="Filtrer par date" class="w-24" /></th>
                <th><UInput v-model="filtres.pdv" size="xs" placeholder="Nom" aria-label="Filtrer par point de vente" class="w-32" /></th>
                <th>
                  <USelectMenu v-model="filtres.canal" :options="optionsCanal" option-attribute="label" value-attribute="value" size="xs" aria-label="Filtrer par canal" class="w-32" />
                </th>
                <th><UInput v-model="filtres.region" size="xs" placeholder="Sous-région" aria-label="Filtrer par sous-région" class="w-28" /></th>
                <th>
                  <USelectMenu v-model="filtres.commercial" :options="optionsPersonnes" size="xs" searchable searchable-placeholder="Rechercher…" value-attribute="value" option-attribute="label" aria-label="Filtrer par merchandiser" class="w-32" />
                </th>
                <th><USelectMenu v-model="filtres.present" :options="optionsOuiNon" option-attribute="label" value-attribute="value" size="xs" aria-label="Filtrer : famille présente" class="w-24" /></th>
                <th><USelectMenu v-model="filtres.prix" :options="optionsOuiNon" option-attribute="label" value-attribute="value" size="xs" aria-label="Filtrer : prix respectés" class="w-24" /></th>
                <th v-for="prod in prods" :key="`${prod.key}_f`" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="!pageReleves.length">
                <td :colspan="7 + prods.length" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucune visite ne correspond à ces filtres.
                </td>
              </tr>
              <tr v-for="row in pageReleves" :key="row.visite_id">
                <td class="whitespace-nowrap tabular-nums">{{ formatDate(row.date_visite) }}</td>
                <td class="max-w-[220px] font-medium text-slate-900 dark:text-white">
                  <div class="flex items-center gap-1">
                    <span class="truncate">{{ row.pdv?.nom_pdv || 'Point de vente sans nom' }}</span>
                    <PDVPhotoModal v-if="row.pdv?.pdv_id" :pdv-id="row.pdv.pdv_id" :pdv-name="row.pdv.nom_pdv" />
                  </div>
                </td>
                <td>{{ libelleCanal(row.pdv?.canal) }}</td>
                <td>{{ row.pdv?.region || '—' }}</td>
                <td>{{ row.commercial || '—' }}</td>
                <td class="text-center"><Indicateur :oui="!!donnees(row)?.present" /></td>
                <td class="text-center"><Indicateur :oui="!!donnees(row)?.prix_respectes" /></td>
                <td v-for="prod in prods" :key="`${prod.key}_v`" class="text-center">
                  <Indicateur :oui="donnees(row)?.[prod.key] === 'Présent'" libelle-oui="En rayon" libelle-non="Absent" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <AdminPagination
          :total="releves.length"
          :page="page"
          :page-size="parPage"
          item-label="visite(s)"
          @update:page="(p) => page = p"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
// Produits › Disponibilité / Prix / Détail par visite (onglets du domaine,
// ?vue=). La famille de produits est un filtre (?famille=), plus un onglet :
// deux niveaux de navigation, pas trois. Remplace /admin/produits/<famille>,
// qui redirige ici.
import { getSkus, getCategoryDef } from '~/utils/products'
import { COULEURS_PRESENCE, COULEURS_RESPECT } from '~/utils/chartPalette'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const route = useRoute()
const router = useRouter()
const dashboard = useDashboardDirection()
const { users: cachedUsers, fetchUsers: fetchCachedUsers } = useUsersCache()
const { charger: chargerCatalogue, categoriesActives, charge: catalogueCharge } = useCatalogueReleve()

type Vue = 'disponibilite' | 'prix' | 'releves'
const vue = computed<Vue>(() => (route.query.vue === 'prix' || route.query.vue === 'releves' ? route.query.vue : 'disponibilite'))

// Famille : celle de l'URL si elle est active, sinon la première active.
// Tant que le catalogue n'est pas lu en base, une famille inconnue n'est pas
// rejetée (une famille créée dans l'admin n'existe pas dans le catalogue par défaut).
const famille = computed(() => {
  const demandee = String(route.query.famille || '').toLowerCase()
  const actives = categoriesActives.value
  if (demandee && (actives.some(c => c.key === demandee) || !catalogueCharge.value)) return demandee
  return actives[0]?.key || 'evap'
})
const nomFamille = computed(() => getCategoryDef(famille.value)?.label || famille.value.toUpperCase())
const optionsFamilles = computed(() => categoriesActives.value.map(c => ({ value: c.key, label: c.label })))

function choisirFamille(code: string) {
  router.replace({ query: { ...route.query, famille: code } })
}

// Une famille demandée mais fermée : on remplace l'URL par la famille retenue.
watch([() => route.query.famille, catalogueCharge], () => {
  const demandee = String(route.query.famille || '').toLowerCase()
  if (catalogueCharge.value && demandee && demandee !== famille.value) {
    router.replace({ query: { ...route.query, famille: famille.value } })
  }
})

// Références du catalogue (Paramètres › Produits du formulaire), retirées
// comprises : les anciennes visites restent lisibles.
const prods = computed(() => getSkus(famille.value, { inclureInactifs: true })
  .map(s => ({ key: s.key, name: s.actif === false ? `${s.label} (retirée)` : s.label })))

const donnees = (v: any) => v?.data?.produits?.[famille.value]

// --- Disponibilité ---
const nbPresence = computed(() => dashboard.countWhere(v => donnees(v)?.present))
const pctPresence = computed(() => dashboard.pctWhere(v => donnees(v)?.present))

function prodPresent(cle: string) {
  return dashboard.visites.value.filter(v => donnees(v)?.present && donnees(v)?.[cle] === 'Présent').length
}
function prodRupture(cle: string) {
  return nbPresence.value - prodPresent(cle)
}

const evoPresence = computed(() => {
  const evo = dashboard.evolutionParSemaine(v => donnees(v)?.present)
  return evo.labels.map((label, i) => ({ date: label, count: evo.counts[i] }))
})

// --- Prix ---
const prixRespecte = computed(() => dashboard.visites.value.filter(v => donnees(v)?.present && donnees(v)?.prix_respectes).length)
const prixNonRespecte = computed(() => nbPresence.value - prixRespecte.value)
const pctPrix = computed(() => (nbPresence.value > 0 ? Math.round(prixRespecte.value / nbPresence.value * 100) : 0))
const evoPrix = computed(() => {
  const evo = dashboard.evolutionParSemaine(v => donnees(v)?.present && donnees(v)?.prix_respectes)
  return evo.labels.map((label, i) => ({ date: label, count: evo.counts[i] }))
})

// --- Détail par visite ---
const filtres = reactive({ date: '', pdv: '', canal: '', region: '', commercial: '', present: '', prix: '' })
const page = ref(1)
const parPage = 100

const optionsOuiNon = [{ value: '', label: 'Tous' }, { value: 'Oui', label: 'Oui' }, { value: 'Non', label: 'Non' }]
const optionsCanal = [
  { value: '', label: 'Tous' },
  { value: 'General trade', label: 'Boutiques (GT)' },
  { value: 'Modern trade', label: 'Supermarchés (MT)' },
]
const libelleCanal = (canal?: string | null) => optionsCanal.find(o => o.value && o.value === canal)?.label || canal || '—'

// Liste complète des personnes actives, pas seulement celles qui ont une visite sur la période.
const optionsPersonnes = computed(() => {
  const noms = [...new Set(cachedUsers.value.filter(u => u.is_active !== false && u.nom).map(u => u.nom as string))]
    .sort((a, b) => a.localeCompare(b, 'fr'))
  return [{ value: '', label: 'Tous' }, ...noms.map(nom => ({ value: nom, label: nom }))]
})

function formatDate(d: string) {
  return formatDateFr(d, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const releves = computed(() => {
  let rows = dashboard.visites.value
  if (filtres.date) rows = rows.filter(r => formatDate(r.date_visite).includes(filtres.date))
  if (filtres.pdv) rows = rows.filter(r => r.pdv?.nom_pdv?.toLowerCase().includes(filtres.pdv.toLowerCase()))
  if (filtres.canal) rows = rows.filter(r => r.pdv?.canal === filtres.canal)
  if (filtres.region) rows = rows.filter(r => r.pdv?.region?.toLowerCase().includes(filtres.region.toLowerCase()))
  if (filtres.commercial) rows = rows.filter(r => r.commercial?.toLowerCase().includes(filtres.commercial.toLowerCase()))
  if (filtres.present) rows = rows.filter(r => !!donnees(r)?.present === (filtres.present === 'Oui'))
  if (filtres.prix) rows = rows.filter(r => !!donnees(r)?.prix_respectes === (filtres.prix === 'Oui'))
  return rows
})
const pageReleves = computed(() => releves.value.slice((page.value - 1) * parPage, page.value * parPage))
watch(releves, () => { page.value = 1 })

// Changement de famille : on repart des filtres vides.
watch(famille, () => {
  Object.assign(filtres, { date: '', pdv: '', canal: '', region: '', commercial: '', present: '', prix: '' })
  page.value = 1
})

// Pastille Oui / Non lisible sans la couleur (icône + texte pour lecteur d'écran).
const Indicateur = defineComponent({
  props: { oui: Boolean, libelleOui: { type: String, default: 'Oui' }, libelleNon: { type: String, default: 'Non' } },
  setup(props) {
    return () => h('span', { class: 'inline-flex items-center justify-center', title: props.oui ? props.libelleOui : props.libelleNon }, [
      h(resolveComponent('UIcon') as any, {
        name: props.oui ? 'i-heroicons-check-circle-20-solid' : 'i-heroicons-minus-circle',
        class: props.oui ? 'h-5 w-5 text-emerald-700 dark:text-emerald-400' : 'h-5 w-5 text-slate-500 dark:text-slate-400',
        'aria-hidden': 'true',
      }),
      h('span', { class: 'sr-only' }, props.oui ? props.libelleOui : props.libelleNon),
    ])
  },
})

onMounted(() => {
  fetchCachedUsers()
  void chargerCatalogue()
  void dashboard.fetchVisites()
})
</script>
