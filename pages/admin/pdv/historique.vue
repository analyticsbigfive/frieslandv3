<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Historique d'un point de vente"
      eyebrow="Évolution Perfect Store"
    />

    <!-- Choix du PDV : recherche par nom, PDV du périmètre actif -->
    <div class="admin-toolbar">
      <div class="grid gap-3 lg:grid-cols-3">
        <UFormGroup label="Point de vente" size="sm" class="lg:col-span-2">
          <div class="relative">
            <UInput
              v-model="recherche"
              icon="i-heroicons-magnifying-glass"
              placeholder="Nom du PDV…"
              size="sm"
              @focus="ouvert = true"
              @blur="fermerPlusTard"
            />
            <ul
              v-if="ouvert && suggestions.length"
              class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
            >
              <li
                v-for="p in suggestions"
                :key="p.pdv_id"
                class="cursor-pointer px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                @mousedown.prevent="choisir(p)"
              >
                <span class="font-medium text-slate-900 dark:text-white">{{ p.nom_pdv }}</span>
                <span class="ml-2 text-xs text-slate-400">{{ [p.zone, p.quartier, p.sous_categorie_pdv].filter(Boolean).join(' · ') }}</span>
              </li>
            </ul>
          </div>
        </UFormGroup>
        <UFormGroup label="Comparer avec un second PDV (optionnel)" size="sm">
          <div class="relative">
            <UInput
              v-model="recherche2"
              icon="i-heroicons-plus-circle"
              placeholder="Nom du PDV…"
              size="sm"
              @focus="ouvert2 = true"
              @blur="fermerPlusTard"
            />
            <ul
              v-if="ouvert2 && suggestions2.length"
              class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
            >
              <li
                v-for="p in suggestions2"
                :key="p.pdv_id"
                class="cursor-pointer px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                @mousedown.prevent="choisir2(p)"
              >
                <span class="font-medium text-slate-900 dark:text-white">{{ p.nom_pdv }}</span>
                <span class="ml-2 text-xs text-slate-400">{{ [p.zone, p.quartier].filter(Boolean).join(' · ') }}</span>
              </li>
            </ul>
          </div>
        </UFormGroup>
      </div>
      <div v-if="pdv" class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span class="rounded-full bg-fc-red/10 px-2 py-1 font-semibold text-fc-red">{{ pdv.nom_pdv }}</span>
        <span>{{ [pdv.zone, pdv.quartier, pdv.sous_categorie_pdv, pdv.distributor_name].filter(Boolean).join(' · ') }}</span>
        <span v-if="pdv2" class="ml-2 rounded-full bg-blue-600/10 px-2 py-1 font-semibold text-blue-700">vs {{ pdv2.nom_pdv }}</span>
        <UButton v-if="pdv2" size="2xs" variant="ghost" icon="i-heroicons-x-mark" @click="retirerPdv2" />
      </div>
    </div>

    <div v-if="!pdv" class="admin-surface p-10 text-center text-sm text-slate-400">
      Recherchez un point de vente pour afficher son historique visite par visite.
    </div>

    <div v-else-if="loading" class="admin-surface h-72 animate-pulse bg-slate-100 dark:bg-slate-800" />

    <template v-else>
      <!-- Compteurs sur tout l'historique -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Visites enregistrées" :value="String(historique.length)" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard title="Dernière visite" :value="derniere ? formatDateFr(derniere.date_visite, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'" :subtitle="derniere?.commercial || ''" icon="i-heroicons-calendar" color="orange" />
        <StatsCard title="Dernier niveau" :value="derniere?.niveau ? derniere.niveau.toUpperCase() : 'Non conforme'" icon="i-heroicons-trophy" :color="derniere?.niveau ? 'green' : 'red'" />
        <StatsCard title="Dernier score" :value="derniere?.score_global == null ? '—' : `${Math.round(derniere.score_global)} %`" icon="i-heroicons-chart-bar" color="purple" />
      </div>

      <!-- Courbes : les 4 métriques du PDV, ou le score de deux PDV côte à côte -->
      <ClientOnly>
        <ChartsMultiLineChart
          :title="pdv2 ? 'Score global : comparaison de deux PDV' : 'Évolution visite par visite'"
          :subtitle="pdv2 ? `${pdv.nom_pdv} vs ${pdv2.nom_pdv}, sur l'union des dates de visite.` : 'Disponibilité, visibilité, promotion et score global à chaque visite.'"
          :labels="labels"
          :series="series"
          unit=" %"
          :max="100"
          height="lg"
        />
      </ClientOnly>

      <!-- Comparaison de deux périodes -->
      <div class="admin-surface p-5">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 class="font-bold text-slate-900 dark:text-white">Comparer deux périodes</h2>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Moyennes des visites de {{ pdv.nom_pdv }} sur chaque période (RPC serveur).</p>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <UFormGroup label="Période 1 — du" size="xs"><UInput v-model="p1.debut" type="date" size="xs" /></UFormGroup>
            <UFormGroup label="au" size="xs"><UInput v-model="p1.fin" type="date" size="xs" /></UFormGroup>
            <UFormGroup label="Période 2 — du" size="xs"><UInput v-model="p2.debut" type="date" size="xs" /></UFormGroup>
            <UFormGroup label="au" size="xs"><UInput v-model="p2.fin" type="date" size="xs" /></UFormGroup>
          </div>
        </div>
        <div v-if="comparaison" class="mt-4 overflow-x-auto">
          <table class="admin-table">
            <thead class="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th class="th-l">Indicateur</th>
                <th class="th-c">Période 1<br><span class="font-normal text-slate-400">{{ p1.debut }} → {{ p1.fin }}</span></th>
                <th class="th-c">Période 2<br><span class="font-normal text-slate-400">{{ p2.debut }} → {{ p2.fin }}</span></th>
                <th class="th-c">Écart</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              <tr v-for="ligne in lignesComparaison" :key="ligne.label" class="row">
                <td class="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">{{ ligne.label }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">{{ ligne.v1 }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">{{ ligne.v2 }}</td>
                <td class="px-4 py-2 text-center text-sm font-semibold tabular-nums" :class="ligne.ecart == null ? 'text-slate-400' : ligne.ecart > 0 ? 'text-emerald-600' : ligne.ecart < 0 ? 'text-fc-red' : 'text-slate-500'">
                  {{ ligne.ecart == null ? '—' : (ligne.ecart > 0 ? '+' : '') + ligne.ecart + ligne.unit }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tableau des visites -->
      <div class="admin-surface overflow-hidden">
        <div class="border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <h2 class="font-bold text-slate-900 dark:text-white">Visites</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead class="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th class="th-l">Date</th>
                <th class="th-l">Merchandiseur</th>
                <th class="th-c">Niveau</th>
                <th class="th-c">Score</th>
                <th class="th-c">Dispo</th>
                <th class="th-c">Visibilité</th>
                <th class="th-c">Promotion</th>
                <th class="th-c">Assortiment</th>
                <th class="th-c"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              <tr v-for="h in [...historique].reverse()" :key="h.visite_id" class="row">
                <td class="px-4 py-2 text-sm">{{ formatDateFr(h.date_visite, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</td>
                <td class="px-4 py-2 text-sm text-slate-500">{{ h.commercial || '—' }}</td>
                <td class="px-4 py-2 text-center text-sm">
                  <UBadge :color="h.niveau ? 'green' : 'gray'" variant="soft" size="xs">{{ h.niveau ? h.niveau.toUpperCase() : 'Non conforme' }}</UBadge>
                </td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">{{ pct(h.score_global) }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">{{ pct(h.dispo_rayon) }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">{{ pct(h.visibilite) }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">{{ pct(h.promotion) }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">{{ pct(h.assortiment) }}</td>
                <td class="px-4 py-2 text-center">
                  <UButton size="2xs" variant="ghost" icon="i-heroicons-eye" @click="ouvrirVisite(h.visite_id)" />
                </td>
              </tr>
              <tr v-if="!historique.length">
                <td colspan="9" class="px-4 py-8 text-center text-sm text-slate-400">Aucune visite enregistrée pour ce PDV.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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
  router.replace({ query: { ...route.query, pdv_id: p.pdv_id } })
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
  const id = route.query.pdv_id as string | undefined
  if (!id) return
  const { data } = await supabase.from('pdv').select(SELECT).eq('pdv_id', id).maybeSingle()
  if (data) await choisir(data as PdvLite)
})
</script>
