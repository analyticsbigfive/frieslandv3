<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Synthèse par zone"
      eyebrow="Tableau de bord commerciaux"
    />

    <!-- Période + périmètre. Comme le tableau de bord principal : tout passe par
         des RPC qui comptent des PDV distincts, jamais des visites. -->
    <div class="admin-toolbar">
      <div class="mb-3 border-b border-slate-100 pb-3 dark:border-slate-700">
        <PeriodFilter v-model="periode" />
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <UFormGroup label="Division (North/South)" size="xs">
          <USelectMenu v-model="fDivision" :options="divisionOptions" placeholder="Toutes" size="xs" searchable />
        </UFormGroup>
        <UFormGroup label="Distributeur" size="xs">
          <USelectMenu v-model="fDistrib" :options="distribOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <UFormGroup label="Fenêtre de suivi" size="xs" hint="au-delà : à prospecter">
          <USelectMenu
            v-model="fenetreMois"
            :options="fenetreOptions"
            value-attribute="value"
            option-attribute="label"
            size="xs"
          />
        </UFormGroup>
        <div class="flex items-end">
          <UButton v-if="fDivision || fDistrib" size="xs" variant="ghost" @click="fDivision = ''; fDistrib = ''">Réinitialiser</UButton>
        </div>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-4">
      <div v-for="i in 4" :key="i" class="admin-surface h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else>
      <!-- Totaux réseau (somme des zones du périmètre) -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="PDV du périmètre" :value="String(totaux.pdv_total)" icon="i-heroicons-building-storefront" color="blue" />
        <StatsCard title="Visités sur la période" :value="String(totaux.pdv_visites)" :subtitle="`${totaux.pdv_non_visites} non visités`" icon="i-heroicons-clipboard-document-check" color="green" />
        <StatsCard title="Alertes" :value="String(totaux.alertes)" subtitle="PDV suivis en retard" icon="i-heroicons-exclamation-triangle" color="red" />
        <StatsCard title="À prospecter" :value="String(totaux.a_prospecter)" :subtitle="`aucune visite depuis ${fenetreMois} mois`" icon="i-heroicons-map-pin" color="orange" />
      </div>

      <!-- Une ligne par territoire, alertes en tête -->
      <div class="admin-surface overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div>
            <h2 class="font-bold text-slate-900 dark:text-white">Par territoire</h2>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Fraîcheur calculée sur la dernière visite de chaque PDV et la fréquence paramétrée (Référentiels › Fréquence de visite, défaut hebdomadaire).
            </p>
          </div>
          <UButton size="xs" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exporter">Exporter CSV</UButton>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead class="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th class="th-l">Territoire</th>
                <th class="th-c">PDV</th>
                <th class="th-c">Visités</th>
                <th class="th-c">Non visités</th>
                <th class="th-c">Suivis</th>
                <th class="th-c">À prospecter</th>
                <th class="th-c">À jour</th>
                <th class="th-c">En retard</th>
                <th class="th-c">Dispo moy.</th>
                <th class="th-c">Perfect Store</th>
                <th class="th-c">Alertes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              <tr
                v-for="z in zones"
                :key="z.zone"
                class="row cursor-pointer"
                :class="zoneOuverte === z.zone ? 'bg-red-50/60 dark:bg-red-900/10' : ''"
                @click="ouvrirZone(z.zone)"
              >
                <td class="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white">{{ z.zone }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ z.pdv_total }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums text-emerald-600">{{ z.pdv_visites }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums text-slate-500">{{ z.pdv_non_visites }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums font-medium">{{ z.pdv_suivis }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums text-slate-400">{{ z.a_prospecter }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ z.a_jour }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums" :class="z.en_retard ? 'font-semibold text-amber-600' : 'text-slate-400'">{{ z.en_retard }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ fmtPct(z.dispo_moyenne) }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums">{{ fmtPct(z.perfect_store_pct) }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span
                    class="inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold"
                    :class="z.alertes ? 'bg-fc-red text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'"
                  >
                    {{ z.alertes }}
                  </span>
                </td>
              </tr>
              <tr v-if="!zones.length">
                <td colspan="11" class="px-4 py-10 text-center text-sm text-slate-400">Aucun PDV dans ce périmètre.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Détail des alertes de la zone ouverte -->
      <div v-if="zoneOuverte" class="admin-surface overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div>
            <h2 class="font-bold text-slate-900 dark:text-white">{{ zoneOuverte }} — PDV en alerte</h2>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{{ alertes.length }} PDV en retard ou jamais visités, les plus anciens d'abord.</p>
          </div>
          <div class="flex items-center gap-2">
            <USelectMenu v-model="filtreEtat" :options="etatOptions" option-attribute="label" value-attribute="value" size="xs" class="w-44" />
            <UButton size="xs" variant="ghost" icon="i-heroicons-x-mark" @click="zoneOuverte = ''">Fermer</UButton>
          </div>
        </div>
        <div v-if="alertesLoading" class="p-8 text-center">
          <UIcon name="i-heroicons-arrow-path" class="mx-auto h-6 w-6 animate-spin text-fc-red" />
        </div>
        <div v-else class="overflow-x-auto">
          <table class="admin-table">
            <thead class="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th class="th-l">PDV</th>
                <th class="th-l">Quartier</th>
                <th class="th-l">Type</th>
                <th class="th-c">Dernière visite</th>
                <th class="th-c">Jours</th>
                <th class="th-c">Fréquence</th>
                <th class="th-c">État</th>
                <th class="th-c">Niveau</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              <tr v-for="p in alertesPage" :key="p.pdv_id" class="row">
                <td class="px-4 py-2 text-sm font-medium text-slate-900 dark:text-white">
                  <NuxtLink :to="`/admin/pdv/historique?pdv_id=${p.pdv_id}`" class="hover:text-fc-red">{{ p.nom_pdv }}</NuxtLink>
                </td>
                <td class="px-4 py-2 text-sm text-slate-500">{{ p.quartier || '—' }}</td>
                <td class="px-4 py-2 text-sm text-slate-500">{{ p.sous_categorie_pdv || '—' }}</td>
                <td class="px-4 py-2 text-center text-sm">{{ p.derniere_visite ? formatDateFr(p.derniere_visite, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">{{ p.jours_depuis ?? '—' }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums text-slate-500">{{ p.frequence_jours ?? '—' }} j</td>
                <td class="px-4 py-2 text-center">
                  <UBadge :color="p.etat === 'jamais_visite' ? 'red' : 'amber'" variant="soft" size="xs">{{ etatLabel(p.etat) }}</UBadge>
                </td>
                <td class="px-4 py-2 text-center text-sm">{{ p.niveau ? p.niveau.toUpperCase() : '—' }}</td>
              </tr>
              <tr v-if="!alertes.length">
                <td colspan="8" class="px-4 py-8 text-center text-sm text-slate-400">Aucune alerte sur ce territoire.</td>
              </tr>
            </tbody>
          </table>
          <div class="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
            <AdminPagination :total="alertes.length" :page="alertesPageNo" :page-size="50" item-label="PDV" @update:page="(p) => alertesPageNo = p" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Synthèse par zone (lot 5, 1.0.4) : ce que le commercial regarde chaque
// matin — PDV visités / non visités, retards, jamais visités, par territoire.
// Alertes rouges alimentées par la fraîcheur (RPC pdv_fraicheur_filtre).
import { formatDateFr } from '~/utils/dates'
import { plageDePeriode, type PeriodePreset } from '~/utils/periode'
import type { SyntheseZone, PdvFraicheur, FraicheurEtat } from '~/composables/usePerfectStore'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const { fetchSyntheseZones, fetchPdvFraicheur } = usePerfectStore()
const { regions, distributeurs, fetchReferentiels } = useReferentiels()
const { exportToCsv } = useCsvExport()

const periode = ref<{ preset: PeriodePreset; debut: string; fin: string }>({ preset: 'semaine', ...plageDePeriode('semaine') })
const fDivision = ref('')
const fDistrib = ref('')

// Fenêtre de suivi : un PDV visité au moins une fois dedans est « suivi » et
// compte dans les alertes ; au-delà il bascule dans « à prospecter ». Défaut lu
// dans le référentiel (Paramètres › Référentiels › Fenêtre de suivi), et
// surchargeable ici sans rien écrire en base.
const supabase = useSupabaseClient()
const fenetreMois = ref(12)
const fenetreOptions = [
  { value: 6, label: '6 mois' },
  { value: 12, label: '12 mois' },
  { value: 24, label: '24 mois' },
  { value: 999, label: 'Tout le parc' },
]
async function chargerFenetreParDefaut() {
  const { data } = await supabase
    .from('parametre_suivi')
    .select('valeur')
    .eq('cle', 'fenetre_suivi_mois')
    .maybeSingle()
  if (data?.valeur) fenetreMois.value = Number(data.valeur)
}
const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'fr'))
const divisionOptions = computed(() => ['', ...uniq(regions.value.map(r => r.nom_affichage || r.name))])
const distribOptions = computed(() => ['', ...uniq(distributeurs.value.map(d => d.name))])

const loading = ref(true)
const zones = ref<SyntheseZone[]>([])
const zoneOuverte = ref('')
const alertes = ref<PdvFraicheur[]>([])
const alertesLoading = ref(false)
const alertesPageNo = ref(1)
const filtreEtat = ref<FraicheurEtat | ''>('')
const etatOptions = [
  { value: '', label: 'Retard + jamais visités' },
  { value: 'en_retard', label: 'En retard seulement' },
  { value: 'jamais_visite', label: 'Jamais visités seulement' },
]

const filtres = computed(() => ({
  division: fDivision.value,
  distributeur: fDistrib.value,
  dateDebut: periode.value.debut,
  dateFin: periode.value.fin,
}))

const totaux = computed(() => zones.value.reduce((t, z) => ({
  pdv_total: t.pdv_total + Number(z.pdv_total),
  pdv_visites: t.pdv_visites + Number(z.pdv_visites),
  pdv_non_visites: t.pdv_non_visites + Number(z.pdv_non_visites),
  pdv_suivis: t.pdv_suivis + Number(z.pdv_suivis),
  a_prospecter: t.a_prospecter + Number(z.a_prospecter),
  en_retard: t.en_retard + Number(z.en_retard),
  jamais_visites: t.jamais_visites + Number(z.jamais_visites),
  alertes: t.alertes + Number(z.alertes),
}), { pdv_total: 0, pdv_visites: 0, pdv_non_visites: 0, pdv_suivis: 0, a_prospecter: 0, en_retard: 0, jamais_visites: 0, alertes: 0 }))

const alertesPage = computed(() => alertes.value.slice((alertesPageNo.value - 1) * 50, alertesPageNo.value * 50))

function fmtPct(v: number | null | undefined) {
  return v == null ? '—' : `${Number(v).toFixed(0)} %`
}
function etatLabel(e: string) {
  return e === 'jamais_visite' ? 'Jamais visité' : e === 'en_retard' ? 'En retard' : 'À jour'
}

async function charger() {
  loading.value = true
  try {
    zones.value = await fetchSyntheseZones(filtres.value, fenetreMois.value)
    if (zoneOuverte.value && !zones.value.some(z => z.zone === zoneOuverte.value)) zoneOuverte.value = ''
    if (zoneOuverte.value) await chargerAlertes()
  }
  finally {
    loading.value = false
  }
}

async function chargerAlertes() {
  if (!zoneOuverte.value) return
  alertesLoading.value = true
  alertesPageNo.value = 1
  try {
    // Sans état demandé : retards et jamais visités, en une seule liste.
    const rows = await fetchPdvFraicheur(
      { ...filtres.value, territoire: zoneOuverte.value },
      filtreEtat.value,
      { fenetreMois: fenetreMois.value },
    )
    alertes.value = filtreEtat.value ? rows : rows.filter(r => r.etat !== 'a_jour')
  }
  finally {
    alertesLoading.value = false
  }
}

function ouvrirZone(zone: string) {
  zoneOuverte.value = zoneOuverte.value === zone ? '' : zone
  if (zoneOuverte.value) void chargerAlertes()
}

function exporter() {
  exportToCsv(
    zones.value.map(z => ({
      Territoire: z.zone,
      PDV: z.pdv_total,
      Visités: z.pdv_visites,
      'Non visités': z.pdv_non_visites,
      Suivis: z.pdv_suivis,
      'À prospecter': z.a_prospecter,
      'À jour': z.a_jour,
      'En retard': z.en_retard,
      'Jamais visités': z.jamais_visites,
      'Dispo moyenne %': z.dispo_moyenne ?? '',
      'Perfect Store %': z.perfect_store_pct ?? '',
      Alertes: z.alertes,
      'Alertes (ancien calcul)': z.alertes_toutes,
    })),
    `synthese-zones-${periode.value.debut || 'tout'}-${periode.value.fin || 'tout'}.csv`,
  )
}

watch(filtres, charger, { deep: true })
watch(filtreEtat, chargerAlertes)
// La fenêtre change ce qui est « suivi » : synthèse ET détail se recalculent.
watch(fenetreMois, async () => {
  await charger()
  if (zoneOuverte.value) await chargerAlertes()
})

onMounted(async () => {
  void fetchReferentiels()
  // Avant le premier chargement : la fenêtre par défaut vient du référentiel.
  await chargerFenetreParDefaut()
  await charger()
})
</script>
