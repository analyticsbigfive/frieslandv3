<template>
  <div class="space-y-6">
    <AdminPageHeader description="Les résultats Perfect Store d’un point de vente, visite après visite, et la comparaison de deux périodes." />

    <!-- Choix du PDV : recherche par nom, PDV du périmètre actif -->
    <div class="admin-toolbar">
      <div class="grid gap-3 lg:grid-cols-3">
        <UFormGroup label="Point de vente" size="sm" class="lg:col-span-2">
          <div class="relative">
            <UInput
              v-model="recherche"
              icon="i-heroicons-magnifying-glass"
              placeholder="Tapez au moins deux lettres du nom…"
              size="sm"
              autocomplete="off"
              @focus="ouvert = true"
              @blur="fermerPlusTard"
            />
            <ul
              v-if="ouvert && suggestions.length"
              class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
            >
              <li
                v-for="p in suggestions"
                :key="p.pdv_id"
                class="cursor-pointer px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                @mousedown.prevent="choisir(p)"
              >
                <span class="font-medium text-slate-900 dark:text-white">{{ p.nom_pdv || 'Point de vente sans nom' }}</span>
                <span class="ml-2 text-xs text-slate-500 dark:text-slate-400">{{ [p.zone, p.quartier, typePdvLabel(p.sous_categorie_pdv)].filter(Boolean).join(' · ') }}</span>
              </li>
            </ul>
          </div>
        </UFormGroup>
        <UFormGroup label="Comparer avec un autre point de vente (facultatif)" size="sm">
          <div class="relative">
            <UInput
              v-model="recherche2"
              icon="i-heroicons-plus-circle"
              placeholder="Nom du second point de vente…"
              size="sm"
              autocomplete="off"
              :disabled="!pdv"
              @focus="ouvert2 = true"
              @blur="fermerPlusTard"
            />
            <ul
              v-if="ouvert2 && suggestions2.length"
              class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
            >
              <li
                v-for="p in suggestions2"
                :key="p.pdv_id"
                class="cursor-pointer px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                @mousedown.prevent="choisir2(p)"
              >
                <span class="font-medium text-slate-900 dark:text-white">{{ p.nom_pdv || 'Point de vente sans nom' }}</span>
                <span class="ml-2 text-xs text-slate-500 dark:text-slate-400">{{ [p.zone, p.quartier].filter(Boolean).join(' · ') }}</span>
              </li>
            </ul>
          </div>
        </UFormGroup>
      </div>
      <div v-if="pdv" class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span class="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-900 dark:bg-slate-700 dark:text-white">{{ pdv.nom_pdv }}</span>
        <span>{{ [pdv.zone, pdv.quartier, typePdvLabel(pdv.sous_categorie_pdv), pdv.distributor_name].filter(Boolean).join(' · ') }}</span>
        <template v-if="pdv2">
          <span class="ml-2">comparé à</span>
          <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 font-semibold text-slate-900 dark:bg-slate-700 dark:text-white">
            {{ pdv2.nom_pdv }}
            <button
              type="button"
              class="rounded-full p-0.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-600"
              :aria-label="`Retirer la comparaison avec ${pdv2.nom_pdv}`"
              @click="retirerPdv2"
            >
              <UIcon name="i-heroicons-x-mark" class="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        </template>
      </div>
    </div>

    <div v-if="!pdv" class="admin-surface px-6 py-12 text-center">
      <UIcon name="i-heroicons-magnifying-glass" class="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" aria-hidden="true" />
      <p class="mt-3 text-sm font-medium text-slate-900 dark:text-white">Choisissez un point de vente</p>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Tapez son nom dans le champ ci-dessus pour afficher son historique visite par visite.</p>
    </div>

    <ChargementContenu v-else-if="loading" variante="cartes" :nombre="2" classe-carte="admin-surface" libelle="Chargement de l’historique…" />

    <template v-else>
      <!-- Compteurs sur tout l'historique -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Visites enregistrées" :value="historique.length" icon="i-heroicons-clipboard-document-list" />
        <StatsCard title="Dernière visite" :value="derniere ? formatDateFr(derniere.date_visite, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'" :subtitle="derniere?.commercial || ''" icon="i-heroicons-calendar" color="orange" />
        <StatsCard title="Dernier niveau" :value="derniere ? (libelleNiveau(derniere.niveau) || 'Non conforme') : '—'" icon="i-heroicons-trophy" :color="derniere?.niveau ? 'green' : 'red'" />
        <StatsCard title="Dernier score" :value="derniere?.score_global == null ? '—' : `${Math.round(derniere.score_global)} %`" icon="i-heroicons-chart-bar" />
      </div>

      <!-- Courbes : les 4 métriques du PDV, ou le score de deux PDV côte à côte -->
      <ClientOnly>
        <ChartsMultiLineChart
          :title="pdv2 ? 'Score global : comparaison de deux points de vente' : 'Évolution visite par visite'"
          :subtitle="pdv2 ? `${pdv.nom_pdv} comparé à ${pdv2.nom_pdv}, aux dates de visite de l’un ou de l’autre.` : 'Disponibilité, visibilité, promotion et score global à chaque visite.'"
          :labels="labels"
          :series="series"
          unit=" %"
          :max="100"
          height="lg"
          empty-label="Aucune visite évaluée pour ce point de vente."
        />
      </ClientOnly>

      <!-- Comparaison de deux périodes -->
      <section class="admin-surface p-5">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">Comparer deux périodes</h2>
            <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Moyennes des visites de {{ pdv.nom_pdv }} sur chaque période.</p>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <UFormGroup label="Période 1 : du" size="xs"><UInput v-model="p1.debut" type="date" size="xs" /></UFormGroup>
            <UFormGroup label="au" size="xs"><UInput v-model="p1.fin" type="date" size="xs" /></UFormGroup>
            <UFormGroup label="Période 2 : du" size="xs"><UInput v-model="p2.debut" type="date" size="xs" /></UFormGroup>
            <UFormGroup label="au" size="xs"><UInput v-model="p2.fin" type="date" size="xs" /></UFormGroup>
          </div>
        </div>
        <div v-if="comparaison" class="mt-4 overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Indicateur</th>
                <th class="text-right">
                  Période 1
                  <span class="block font-normal text-slate-500 dark:text-slate-400">{{ plageCourte(p1) }}</span>
                </th>
                <th class="text-right">
                  Période 2
                  <span class="block font-normal text-slate-500 dark:text-slate-400">{{ plageCourte(p2) }}</span>
                </th>
                <th class="text-right">Écart</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ligne in lignesComparaison" :key="ligne.label">
                <td>{{ ligne.label }}</td>
                <td class="text-right tabular-nums">{{ ligne.v1 }}</td>
                <td class="text-right tabular-nums">{{ ligne.v2 }}</td>
                <td class="text-right font-semibold tabular-nums" :class="ligne.ecart == null ? 'text-slate-500' : ligne.ecart > 0 ? 'text-emerald-700 dark:text-emerald-300' : ligne.ecart < 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'">
                  {{ ligne.ecart == null ? '—' : (ligne.ecart > 0 ? '+' : '') + ligne.ecart + ligne.unit }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="mt-4 text-sm text-slate-600 dark:text-slate-300">
          {{ p1.debut && p1.fin && p2.debut && p2.fin
            ? 'La comparaison n’est pas disponible pour le moment. Réessayez plus tard ; si cela continue, prévenez l’administrateur.'
            : 'Choisissez les dates de début et de fin des deux périodes pour comparer les moyennes.' }}
        </p>
      </section>

      <!-- Tableau des visites -->
      <section class="admin-surface overflow-hidden">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Visites</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchandiser</th>
                <th>Niveau</th>
                <th class="text-right">Score</th>
                <th class="text-right">Disponibilité</th>
                <th class="text-right">Visibilité</th>
                <th class="text-right">Promotion</th>
                <th class="text-right">Assortiment</th>
                <th class="text-right"><span class="sr-only">Détail</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in [...historique].reverse()" :key="h.visite_id">
                <td class="whitespace-nowrap tabular-nums">{{ formatDateFr(h.date_visite, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</td>
                <td>{{ h.commercial || '—' }}</td>
                <td>
                  <UBadge v-if="h.niveau" color="green" variant="soft" size="xs">{{ libelleNiveau(h.niveau) }}</UBadge>
                  <span v-else class="text-slate-600 dark:text-slate-300">Non conforme</span>
                </td>
                <td class="text-right tabular-nums">{{ pct(h.score_global) }}</td>
                <td class="text-right tabular-nums">{{ pct(h.dispo_rayon) }}</td>
                <td class="text-right tabular-nums">{{ pct(h.visibilite) }}</td>
                <td class="text-right tabular-nums">{{ pct(h.promotion) }}</td>
                <td class="text-right tabular-nums">{{ pct(h.assortiment) }}</td>
                <td class="text-right">
                  <UButton
                    size="xs"
                    color="gray"
                    variant="ghost"
                    icon="i-heroicons-eye"
                    :aria-label="`Voir la visite du ${formatDateFr(h.date_visite, { day: '2-digit', month: 'long', year: 'numeric' })}`"
                    title="Voir le détail"
                    @click="ouvrirVisite(h.visite_id)"
                  />
                </td>
              </tr>
              <tr v-if="!historique.length">
                <td colspan="9" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucune visite enregistrée pour ce point de vente. Elles apparaîtront ici après le premier passage d’un merchandiseur.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <VisitDetailModal v-model="visiteOuverte" :visite="visiteDetail" />
  </div>
</template>

<script setup lang="ts">
// Historique et évolution par PDV (lot 5, 1.0.4). Rien de comparable
// n'existait : VisitesLineChart est mono-série. Ici, les quatre métriques
// Perfect Store visite par visite, la comparaison de deux périodes (moyennes
// calculées côté serveur) et, en option, le score de deux PDV superposés.
import { formatDateFr } from '~/utils/dates'
import { plageDePeriode } from '~/utils/periode'
import type { PdvHistoriquePoint, PdvComparaison } from '~/composables/usePerfectStore'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

interface PdvLite { pdv_id: string; nom_pdv: string; zone: string | null; quartier: string | null; sous_categorie_pdv: string | null; distributor_name: string | null }

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()
const { fetchPdvHistorique, fetchPdvComparaison } = usePerfectStore()
const visitesStore = useVisitesStore()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()

const recherche = ref('')
const recherche2 = ref('')
const suggestions = ref<PdvLite[]>([])
const suggestions2 = ref<PdvLite[]>([])
const ouvert = ref(false)
const ouvert2 = ref(false)
const pdv = ref<PdvLite | null>(null)
const pdv2 = ref<PdvLite | null>(null)
const loading = ref(false)
const historique = ref<PdvHistoriquePoint[]>([])
const historique2 = ref<PdvHistoriquePoint[]>([])
const comparaison = ref<PdvComparaison | null>(null)

// Période 1 = 30 derniers jours, période 2 = les 30 jours précédents.
const p1 = ref(plageDePeriode('30j'))
const p2 = ref((() => {
  const fin = new Date(p1.value.debut)
  fin.setDate(fin.getDate() - 1)
  return plageDePeriode('30j', fin)
})())

const SELECT = 'pdv_id, nom_pdv, zone, quartier, sous_categorie_pdv, distributor_name'
let timer: ReturnType<typeof setTimeout> | null = null
async function chercher(q: string): Promise<PdvLite[]> {
  const { data } = await supabase.from('pdv').select(SELECT).ilike('nom_pdv', `%${q}%`).order('nom_pdv').limit(20)
  return (data || []) as PdvLite[]
}
watch(recherche, (q) => {
  if (timer) clearTimeout(timer)
  if (q.trim().length < 2) { suggestions.value = []; return }
  timer = setTimeout(async () => { suggestions.value = await chercher(q.trim()); ouvert.value = true }, 250)
})
watch(recherche2, (q) => {
  if (timer) clearTimeout(timer)
  if (q.trim().length < 2) { suggestions2.value = []; return }
  timer = setTimeout(async () => { suggestions2.value = await chercher(q.trim()); ouvert2.value = true }, 250)
})
function fermerPlusTard() { setTimeout(() => { ouvert.value = false; ouvert2.value = false }, 150) }

async function choisir(p: PdvLite) {
  pdv.value = p
  recherche.value = p.nom_pdv
  suggestions.value = []
  ouvert.value = false
  // L'ancien paramètre `pdv` (lien entrant) est remplacé par `pdv_id`.
  const { pdv: _lienEntrant, ...autres } = route.query
  router.replace({ query: { ...autres, pdv_id: p.pdv_id } })
  await charger()
}
async function choisir2(p: PdvLite) {
  pdv2.value = p
  recherche2.value = p.nom_pdv
  suggestions2.value = []
  ouvert2.value = false
  historique2.value = await fetchPdvHistorique(p.pdv_id)
}
function retirerPdv2() { pdv2.value = null; recherche2.value = ''; historique2.value = [] }

async function charger() {
  if (!pdv.value) return
  loading.value = true
  try {
    const [h, c] = await Promise.all([
      fetchPdvHistorique(pdv.value.pdv_id),
      fetchPdvComparaison(pdv.value.pdv_id, p1.value, p2.value),
    ])
    historique.value = h
    comparaison.value = c
  }
  finally {
    loading.value = false
  }
}
async function rechargerComparaison() {
  if (!pdv.value || !p1.value.debut || !p1.value.fin || !p2.value.debut || !p2.value.fin) return
  comparaison.value = await fetchPdvComparaison(pdv.value.pdv_id, p1.value, p2.value)
}
watch([p1, p2], rechargerComparaison, { deep: true })

const derniere = computed(() => historique.value[historique.value.length - 1] || null)

const dateLabel = (d: string) => formatDateFr(d, { day: '2-digit', month: 'short', year: '2-digit' })
const arrondi = (v: number | null | undefined) => (v == null ? null : Math.round(Number(v)))

// Sans second PDV : 4 séries sur les dates du PDV. Avec : score global des deux
// PDV sur l'union triée des dates, null là où l'un n'a pas été visité.
const labels = computed(() => {
  if (!pdv2.value) return historique.value.map(h => dateLabel(h.date_visite))
  const dates = [...new Set([...historique.value, ...historique2.value].map(h => h.date_visite.slice(0, 10)))].sort()
  return dates.map(d => formatDateFr(d, { day: '2-digit', month: 'short', year: '2-digit' }))
})
const series = computed(() => {
  if (!pdv2.value) {
    return [
      { label: 'Score global', data: historique.value.map(h => arrondi(h.score_global)) },
      { label: 'Disponibilité', data: historique.value.map(h => arrondi(h.dispo_rayon)) },
      { label: 'Visibilité', data: historique.value.map(h => arrondi(h.visibilite)) },
      { label: 'Promotion', data: historique.value.map(h => arrondi(h.promotion)) },
    ]
  }
  const dates = [...new Set([...historique.value, ...historique2.value].map(h => h.date_visite.slice(0, 10)))].sort()
  const parJour = (hs: PdvHistoriquePoint[]) => {
    const m = new Map<string, number | null>()
    for (const h of hs) m.set(h.date_visite.slice(0, 10), arrondi(h.score_global))
    return dates.map(d => m.get(d) ?? null)
  }
  return [
    { label: pdv.value?.nom_pdv || 'PDV 1', data: parJour(historique.value) },
    { label: pdv2.value.nom_pdv, data: parJour(historique2.value) },
  ]
})

function pct(v: number | null | undefined) { return v == null ? '—' : `${Math.round(Number(v))} %` }

// Niveau Perfect Store en casse normale (« VIP », « Flagship »…).
function libelleNiveau(niveau?: string | null): string {
  const court = String(niveau || '').replace(/\s*PERFECT STORE\s*$/i, '').replace(/\s*STORE\s*$/i, '').trim()
  if (!court) return ''
  if (court.toUpperCase() === 'VIP') return 'VIP'
  return court.charAt(0).toUpperCase() + court.slice(1).toLowerCase()
}

// « 09/09/2026 au 08/10/2026 » : en-têtes du tableau de comparaison.
function plageCourte(p: { debut: string; fin: string }) {
  const jour = (d: string) => formatDateFr(`${d}T00:00:00`, { day: '2-digit', month: '2-digit', year: 'numeric' })
  return p.debut && p.fin ? `${jour(p.debut)} au ${jour(p.fin)}` : '—'
}

const lignesComparaison = computed(() => {
  const c = comparaison.value
  if (!c) return []
  const ligne = (label: string, k: keyof typeof c.periode1, unit = ' %') => {
    const v1 = c.periode1[k] as number | null | undefined
    const v2 = c.periode2[k] as number | null | undefined
    return {
      label,
      v1: v1 == null ? '—' : `${v1}${unit}`,
      v2: v2 == null ? '—' : `${v2}${unit}`,
      ecart: v1 == null || v2 == null ? null : Math.round((Number(v2) - Number(v1)) * 10) / 10,
      unit,
    }
  }
  return [
    ligne('Visites', 'visites', ''),
    ligne('Score global moyen', 'score_moyen'),
    ligne('Disponibilité moyenne', 'dispo_moyenne'),
    ligne('Visibilité moyenne', 'visibilite_moyenne'),
    ligne('Promotion moyenne', 'promotion_moyenne'),
    ligne('Taux de Perfect Store', 'perfect_store_pct'),
  ]
})

const visiteOuverte = ref(false)
const visiteDetail = ref<any>(null)
async function ouvrirVisite(id: string) {
  visiteDetail.value = await visitesStore.fetchVisiteByDatabaseId(id)
  visiteOuverte.value = !!visiteDetail.value
}

onMounted(async () => {
  fetchTypePdvLabels()
  // `pdv_id` (cette page, Perfect Store › Zones) ou `pdv` (Perfect Store › Écarts au standard).
  const brut = route.query.pdv_id ?? route.query.pdv
  const id = typeof brut === 'string' && brut ? brut : undefined
  if (!id) return
  const { data } = await supabase.from('pdv').select(SELECT).eq('pdv_id', id).maybeSingle()
  if (data) await choisir(data as PdvLite)
})
</script>
