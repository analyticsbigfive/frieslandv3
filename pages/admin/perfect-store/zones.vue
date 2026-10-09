<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <!-- Période + périmètre. Comme le tableau de bord principal : tout passe par
         des RPC qui comptent des PDV distincts, jamais des visites. -->
    <div class="admin-toolbar">
      <div class="mb-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <PeriodFilter v-model="periode" />
      </div>
      <div class="grid grid-cols-1 gap-x-2 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <UFormGroup label="Direction" size="xs">
          <USelectMenu v-model="fDivision" :options="divisionOptions" placeholder="Toutes" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <UFormGroup label="Distributeur" size="xs">
          <USelectMenu v-model="fDistrib" :options="distribOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <UFormGroup
          label="Fenêtre de suivi"
          size="xs"
          help="Un point de vente visité dans cette fenêtre est suivi ; au-delà, il passe à prospecter."
        >
          <USelectMenu
            v-model="fenetreMois"
            :options="fenetreOptions"
            value-attribute="value"
            option-attribute="label"
            size="xs"
          />
        </UFormGroup>
        <div class="flex items-start sm:pt-5">
          <UButton v-if="fDivision || fDistrib" size="xs" color="gray" variant="ghost" @click="fDivision = ''; fDistrib = ''">Réinitialiser</UButton>
        </div>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Chargement de la synthèse par zone">
      <div v-for="i in 4" :key="i" class="admin-surface h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else>
      <!-- Totaux réseau (somme des zones du périmètre) -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Points de vente du périmètre" :value="String(totaux.pdv_total)" icon="i-heroicons-building-storefront" color="blue" />
        <StatsCard title="Visités sur la période" :value="String(totaux.pdv_visites)" :subtitle="`${totaux.pdv_non_visites} non visités`" icon="i-heroicons-clipboard-document-check" color="green" />
        <StatsCard title="Alertes" :value="String(totaux.alertes)" subtitle="points de vente suivis en retard" icon="i-heroicons-exclamation-triangle" color="red" />
        <StatsCard title="À prospecter" :value="String(totaux.a_prospecter)" :subtitle="sousTitreProspecter" icon="i-heroicons-map-pin" color="orange" />
      </div>

      <!-- Une ligne par territoire, alertes en tête -->
      <section class="admin-surface overflow-hidden" aria-labelledby="territoires-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div class="min-w-0">
            <h2 id="territoires-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Par territoire</h2>
            <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Un point de vente suivi est en retard quand sa dernière visite dépasse la fréquence prévue (une fois par semaine par défaut, réglable dans les référentiels). Cliquez sur un territoire pour voir ses points de vente en alerte.
            </p>
          </div>
          <UButton size="xs" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exporter">Exporter (CSV)</UButton>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Territoire</th>
                <th class="text-right" title="Points de vente actifs du territoire">Points de vente</th>
                <th class="text-right" title="Visités au moins une fois sur la période choisie">Visités sur la période</th>
                <th class="text-right" title="Visités au moins une fois dans la fenêtre de suivi : à jour ou en retard">Suivis</th>
                <th class="text-right" title="Aucune visite dans la fenêtre de suivi">À prospecter</th>
                <th class="text-right" title="Disponibilité en rayon moyenne">Disponibilité</th>
                <th class="text-right" title="Part des points de vente visités au standard">Perfect Store</th>
                <th class="text-right" title="Points de vente suivis en retard">Alertes</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="z in zones"
                :key="z.zone"
                class="cursor-pointer"
                :class="zoneOuverte === z.zone ? 'bg-brand-50 hover:bg-brand-50 dark:bg-brand-950/30' : ''"
                @click="ouvrirZone(z.zone)"
              >
                <td>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 text-left font-semibold text-slate-900 hover:text-fc-red dark:text-white"
                    :aria-expanded="zoneOuverte === z.zone"
                    aria-controls="detail-zone"
                    @click.stop="ouvrirZone(z.zone)"
                  >
                    <UIcon
                      name="i-heroicons-chevron-right"
                      class="h-4 w-4 shrink-0 text-slate-600 transition-transform dark:text-slate-300"
                      :class="zoneOuverte === z.zone ? 'rotate-90' : ''"
                      aria-hidden="true"
                    />
                    {{ z.zone }}
                  </button>
                </td>
                <td class="text-right tabular-nums">{{ z.pdv_total }}</td>
                <td class="whitespace-nowrap text-right tabular-nums">
                  <span class="font-semibold text-slate-900 dark:text-white">{{ z.pdv_visites }}</span>
                  <span class="block text-xs text-slate-600 dark:text-slate-300">{{ z.pdv_non_visites }} non visités</span>
                </td>
                <td class="whitespace-nowrap text-right tabular-nums">
                  <span class="font-semibold text-slate-900 dark:text-white">{{ z.pdv_suivis }}</span>
                  <span class="block text-xs text-slate-600 dark:text-slate-300">
                    {{ z.a_jour }} à jour ·
                    <span :class="z.en_retard ? 'font-semibold text-amber-800 dark:text-amber-200' : ''">{{ z.en_retard }} en retard</span>
                  </span>
                </td>
                <td class="text-right tabular-nums">{{ z.a_prospecter }}</td>
                <td class="text-right tabular-nums">{{ fmtPct(z.dispo_moyenne) }}</td>
                <td class="text-right tabular-nums">{{ fmtPct(z.perfect_store_pct) }}</td>
                <td class="text-right">
                  <span
                    v-if="z.alertes"
                    class="inline-flex min-w-8 items-center justify-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold tabular-nums text-red-700 dark:bg-red-950/40 dark:text-red-200"
                  >{{ z.alertes }}</span>
                  <span v-else class="tabular-nums text-slate-600 dark:text-slate-300">0</span>
                </td>
              </tr>
              <tr v-if="!zones.length">
                <td colspan="8" class="py-10 text-center text-slate-600 dark:text-slate-300">
                  Aucun point de vente dans ce périmètre. Changez de direction ou de distributeur.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Détail des alertes de la zone ouverte -->
      <section v-if="zoneOuverte" id="detail-zone" class="admin-surface overflow-hidden" aria-labelledby="detail-zone-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div class="min-w-0">
            <h2 id="detail-zone-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Points de vente en alerte : {{ zoneOuverte }}</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ alertes.length }} point(s) de vente en retard ou jamais visités, les plus anciens d'abord.</p>
          </div>
          <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <USelectMenu v-model="filtreEtat" :options="etatOptions" option-attribute="label" value-attribute="value" size="xs" class="w-full sm:w-56" aria-label="État des points de vente affichés" />
            <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="zoneOuverte = ''">Fermer</UButton>
          </div>
        </div>
        <ChargementContenu v-if="alertesLoading" variante="lignes" :nombre="4" libelle="Chargement des points de vente en alerte…" class="px-5 py-4" />
        <div v-else class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Point de vente</th>
                <th>Type</th>
                <th>Dernière visite</th>
                <th>État</th>
                <th>Niveau</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in alertesPage" :key="p.pdv_id">
                <td>
                  <NuxtLink
                    :to="`/admin/pdv/historique?pdv_id=${p.pdv_id}`"
                    class="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-fc-red hover:decoration-current dark:text-white dark:decoration-slate-600"
                  >{{ p.nom_pdv || 'Point de vente sans nom' }}</NuxtLink>
                  <span v-if="p.quartier" class="block text-xs text-slate-600 dark:text-slate-300">{{ p.quartier }}</span>
                </td>
                <td>{{ p.sous_categorie_pdv || '—' }}</td>
                <td class="whitespace-nowrap">
                  <template v-if="p.derniere_visite">
                    {{ formatDateFr(p.derniere_visite, { day: '2-digit', month: '2-digit', year: 'numeric' }) }}
                    <span v-if="p.jours_depuis != null" class="block text-xs tabular-nums text-slate-600 dark:text-slate-300">il y a {{ p.jours_depuis }} jour(s)</span>
                  </template>
                  <span v-else class="text-slate-600 dark:text-slate-300">Jamais</span>
                </td>
                <td class="whitespace-nowrap">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="p.etat === 'jamais_visite' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'"
                  >
                    <UIcon :name="p.etat === 'jamais_visite' ? 'i-heroicons-exclamation-circle' : 'i-heroicons-clock'" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {{ etatLabel(p.etat) }}
                  </span>
                  <span v-if="p.frequence_jours != null" class="block text-xs text-slate-600 dark:text-slate-300">visite prévue tous les {{ p.frequence_jours }} j</span>
                </td>
                <td class="whitespace-nowrap">
                  <span v-if="p.niveau" class="inline-flex items-center gap-1.5">
                    <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(p.niveau) }" aria-hidden="true" />
                    {{ niveauCourt(p.niveau) }}
                  </span>
                  <span v-else class="text-slate-600 dark:text-slate-300">—</span>
                </td>
              </tr>
              <tr v-if="!alertes.length">
                <td colspan="5" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucun point de vente en alerte sur ce territoire pour cet état. Choisissez un autre état ou un autre territoire.
                </td>
              </tr>
            </tbody>
          </table>
          <div class="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            <AdminPagination :total="alertes.length" :page="alertesPageNo" :page-size="50" item-label="point(s) de vente" @update:page="(p) => alertesPageNo = p" />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NIVEAUX_PS as NIVEAUX, COULEUR_NON_CONFORME, niveauPerfectStore as niveauDe } from '~/utils/chartPalette'
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
  { value: '', label: 'En retard et jamais visités' },
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
const sousTitreProspecter = computed(() =>
  fenetreMois.value >= 999 ? 'jamais visités' : `aucune visite depuis ${fenetreMois.value} mois`,
)

function niveauCourt(code: string | null | undefined): string {
  const c = String(code || '').trim()
  if (!c || c.toUpperCase().startsWith('NON')) return 'Non conforme'
  return niveauDe(c)?.court ?? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}
function couleurNiveau(code: string | null | undefined): string {
  return niveauDe(code)?.couleur ?? COULEUR_NON_CONFORME
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
