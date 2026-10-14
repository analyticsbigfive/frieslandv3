<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <!-- Trimestre + territoire (dans l'URL : ?trimestre=2026-T3&territoire=…) -->
    <div class="admin-toolbar">
      <div class="grid grid-cols-1 items-end gap-x-2 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <UFormGroup label="Trimestre" size="xs">
          <USelectMenu v-model="cle" :options="trimestreOptions" value-attribute="value" option-attribute="label" size="xs" />
        </UFormGroup>
        <UFormGroup label="Territoire" size="xs">
          <USelectMenu
            v-model="fTerritoire"
            :options="territoireOptions"
            value-attribute="value"
            option-attribute="label"
            placeholder="Tous les territoires"
            size="xs"
            searchable
            searchable-placeholder="Rechercher un territoire…"
          />
        </UFormGroup>
        <div>
          <UButton v-if="fTerritoire" size="xs" color="gray" variant="ghost" @click="fTerritoire = ''">Réinitialiser</UButton>
        </div>
        <div class="flex lg:justify-end">
          <UButton size="xs" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!synthese.pdv" @click="exporter">Exporter (CSV)</UButton>
        </div>
      </div>
    </div>

    <!-- Repli automatique : le trimestre en cours n'a pas encore assez de relevés -->
    <div
      v-if="repli"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
      role="status"
    >
      <p>
        Le {{ repli.libelle }} en cours n’a que {{ repli.pdv }} point(s) de vente relevé(s) : voici le {{ libelleTrimestre }}, dernier trimestre complet.
      </p>
      <UButton size="xs" color="gray" variant="ghost" @click="voirTrimestreEnCours">Voir le {{ repli.libelle }}</UButton>
    </div>
    <div
      v-else-if="enCours && !loading && !erreur && synthese.pdv"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
      role="status"
    >
      Trimestre en cours : {{ synthese.pdv }} point(s) de vente relevé(s) au {{ aujourdhui }}. Résultats provisoires, ils évoluent avec les visites.
    </div>

    <AdminErreurBloc v-if="erreur" titre="Les objectifs de disponibilité n’ont pas pu être chargés." :erreur="erreur" :en-cours="loading" @reessayer="charger" />

    <ChargementContenu v-else-if="loading" variante="lignes" :nombre="6" libelle="Calcul des objectifs du trimestre…" />

    <div v-else-if="!synthese.pdv" class="admin-surface px-5 py-10 text-center text-sm text-slate-600 dark:text-slate-300">
      Aucun relevé produit pour le {{ libelleTrimestre }}{{ fTerritoire ? ` à ${fTerritoire}` : '' }}.
      Les visites saisies dans l’application alimenteront cet écran ; choisissez un trimestre précédent pour voir un résultat.
    </div>

    <template v-else>
      <!-- Une colonne sur téléphone, quatre en grand écran (DESIGN.md). -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Objectifs atteints"
          :value="`${synthese.atteints} / ${synthese.jugees}`"
          :subtitle="synthese.jugees ? `produits × canaux jugés (base de ${BASE_FAIBLE} PDV ou plus)` : 'aucune case n’a encore une base suffisante'"
          icon="i-heroicons-flag"
          color="green"
        />
        <StatsCard
          title="En retard"
          :value="String(synthese.retard)"
          :subtitle="`à plus de ${ECART_PROCHE} points de l’objectif ; ${synthese.proche} proche(s)`"
          icon="i-heroicons-exclamation-circle"
          color="red"
        />
        <StatsCard
          title="Plus gros écart"
          :value="synthese.pire ? fmtEcart(synthese.pire.ecart) : '—'"
          :subtitle="synthese.pire ? `${synthese.pire.produit}, ${synthese.pire.canal}` : 'aucun retard sur une base suffisante'"
          icon="i-heroicons-arrow-trending-down"
          color="orange"
        />
        <StatsCard
          title="Points de vente relevés"
          :value="String(synthese.pdv)"
          :subtitle="`dernière visite avec relevé, ${libelleTrimestre}`"
          icon="i-heroicons-building-storefront"
          color="blue"
        />
      </div>

      <p v-if="synthese.inconnus" class="text-sm text-slate-600 dark:text-slate-300">
        <UIcon name="i-heroicons-information-circle" class="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
        {{ synthese.inconnus }} point(s) de vente relevé(s) sans région ne comptent dans aucun canal, ni dans le National.
      </p>

      <!-- Les plus gros retards, sur une base suffisante -->
      <section v-if="priorites.length" class="admin-surface overflow-hidden" aria-labelledby="priorites-heading">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="priorites-heading" class="text-lg font-semibold text-slate-900 dark:text-white">À rattraper en priorité</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Les {{ priorites.length }} plus gros écarts à l’objectif, par canal.</p>
        </div>
        <ol class="divide-y divide-slate-200 dark:divide-slate-700">
          <li v-for="(p, i) in priorites" :key="`${p.cle}-${p.canal}`" class="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-sm">
            <span class="w-5 shrink-0 tabular-nums text-slate-600 dark:text-slate-300">{{ i + 1 }}.</span>
            <span class="min-w-0 flex-1 font-semibold text-slate-900 dark:text-white">{{ p.produit }} <span class="font-normal text-slate-600 dark:text-slate-300">· {{ p.canalLong }}</span></span>
            <span class="tabular-nums text-slate-700 dark:text-slate-200">{{ fmtPct(p.taux) }} pour {{ fmtPct(p.cible) }}</span>
            <span class="w-16 text-right font-bold tabular-nums text-red-700 dark:text-red-300">{{ fmtEcart(p.ecart) }}</span>
          </li>
        </ol>
      </section>

      <details class="admin-surface px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
        <summary class="cursor-pointer font-semibold text-slate-900 dark:text-white">Comment c’est calculé</summary>
        <ul class="mt-3 list-disc space-y-1.5 pl-5">
          <li>Chaque point de vente compte une fois : sa dernière visite du trimestre avec un relevé produit. Les visites sans relevé ne comptent pas.</li>
          <li>Disponible : quantité au moins égale au seuil Perfect Store de son type de point de vente (en supermarché, le standard MT), ou relevé « Disponible » sans rupture pour les anciennes visites.</li>
          <li>La base d’un produit (« N PDV » dans la case) exclut les points de vente où ce produit n’est pas attendu : aucun seuil pour leur type.</li>
          <li>Canal : supermarchés (MT) d’après la catégorie du point de vente ; sinon boutiques d’Abidjan ou de l’intérieur (GT) d’après sa région.</li>
          <li>National : tous les canaux ensemble ; son objectif est la moyenne simple des objectifs des canaux, comme dans le fichier client.</li>
          <li>Atteint : réalisé arrondi au moins égal à l’objectif ; proche : à {{ ECART_PROCHE }} points ou moins ; sous {{ BASE_FAIBLE }} points de vente, la case n’est pas jugée (base faible).</li>
          <li>
            Les objectifs se modifient dans
            <NuxtLink to="/admin/referentiels?liste=objectifs_disponibilite" class="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-fc-red dark:text-white">Paramètres › Référentiels › Objectifs de disponibilité</NuxtLink>.
          </li>
        </ul>
      </details>

      <section
        v-for="bloc in blocs"
        :key="bloc.id"
        class="admin-surface overflow-hidden"
        :aria-labelledby="`bloc-${bloc.id}`"
      >
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 :id="`bloc-${bloc.id}`" class="text-lg font-semibold text-slate-900 dark:text-white">{{ bloc.titre }}</h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{{ bloc.aide }}</p>
        </div>
        <div class="overflow-x-auto">
          <!-- Pas de tri par colonne : le texte des cases mêle réalisé, objectif et
               base ; le classement par écart est dans « À rattraper en priorité ». -->
          <table class="admin-table" data-no-column-tools>
            <thead>
              <tr>
                <th scope="col" class="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">{{ bloc.colonne }}</th>
                <th v-for="c in COLONNES" :key="c.code" scope="col" class="text-right">
                  <abbr :title="c.long" class="no-underline">{{ c.label }}</abbr>
                  <span class="block text-xs font-normal tabular-nums text-slate-600 dark:text-slate-300">{{ basePdv(c.code) }} PDV</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ligne in bloc.lignes" :key="ligne.cle">
                <th scope="row" class="sticky left-0 z-10 min-w-36 bg-white !text-sm !font-semibold !text-slate-900 dark:bg-slate-800 dark:!text-white">{{ ligne.label }}</th>
                <td v-for="c in COLONNES" :key="c.code" class="whitespace-nowrap text-right align-top">
                  <template v-if="grille[ligne.cle][c.code].mesures">
                    <span class="block text-base font-bold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(grille[ligne.cle][c.code].taux) }}</span>
                    <span class="block text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      <template v-if="grille[ligne.cle][c.code].cible">objectif {{ fmtPct(grille[ligne.cle][c.code].cible) }}<template v-if="grille[ligne.cle][c.code].etat !== 'base_faible'"> · {{ fmtEcart(grille[ligne.cle][c.code].ecart) }}</template></template>
                      <template v-else>pas d’objectif</template>
                    </span>
                    <span class="mt-1 inline-flex items-center justify-end gap-1.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      <span
                        v-if="ETATS_JUGES.includes(grille[ligne.cle][c.code].etat)"
                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
                        :class="classeEtat(grille[ligne.cle][c.code].etat)"
                      >
                        <UIcon :name="iconeEtat(grille[ligne.cle][c.code].etat)" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {{ LIBELLE_ETAT[grille[ligne.cle][c.code].etat] }}
                      </span>
                      <span :class="grille[ligne.cle][c.code].etat === 'base_faible' ? 'font-semibold text-amber-800 dark:text-amber-200' : ''">
                        {{ grille[ligne.cle][c.code].mesures }} PDV{{ grille[ligne.cle][c.code].etat === 'base_faible' ? ', base faible' : '' }}
                      </span>
                    </span>
                  </template>
                  <template v-else>
                    <span class="block text-base text-slate-600 dark:text-slate-300" aria-hidden="true">—</span>
                    <span class="block text-xs text-slate-600 dark:text-slate-300">
                      {{ texteSansMesure(grille[ligne.cle][c.code]) }}
                    </span>
                  </template>
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
// Objectifs de disponibilité 2026 (fichier client du 14/10/2026) : réalisé du
// trimestre face aux objectifs, par canal. RPC dashboard_objectifs_disponibilite
// (migration 20261014130000) ; la RLS limite un compte agence à son périmètre.
import {
  BASE_FAIBLE, COLONNES, ECART_PROCHE, FAMILLES, LIBELLE_ETAT, PRODUITS,
  cleLigne, cleTrimestre, ecartPoints, etatObjectif, indexer, libelleIndicateur, lireCleTrimestre,
  trimestreDe, trimestrePrecedent, trimestresProposes,
  type ColonneObjectif, type EtatObjectif, type LigneObjectif,
} from '~/utils/objectifsDisponibilite'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()
const { territories, fetchReferentiels } = useReferentiels()
const { exportToCsv } = useCsvExport()

const courant = trimestreDe()
const cleCourante = cleTrimestre(courant)
const depuisUrl = lireCleTrimestre(route.query.trimestre)
const cle = ref(depuisUrl ? cleTrimestre(depuisUrl) : cleCourante)
const fTerritoire = ref(String(route.query.territoire || ''))
const periode = computed(() => lireCleTrimestre(cle.value) ?? courant)
const trimestreOptions = trimestresProposes(courant, courant)
const territoireOptions = computed(() => [
  { value: '', label: 'Tous les territoires' },
  ...[...new Set(territories.value.map(t => t.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')).map(n => ({ value: n, label: n })),
])
const libelleTrimestre = computed(() => `T${periode.value.trimestre} ${periode.value.annee}`)
const enCours = computed(() => cle.value === cleCourante)
const aujourdhui = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

const loading = ref(true)
const erreur = ref<unknown>(null)
const lignes = ref<LigneObjectif[]>([])
const index = computed(() => indexer(lignes.value))
// Repli du premier chargement : trimestre en cours sans base suffisante.
const repli = ref<{ libelle: string, pdv: number } | null>(null)
let repliAutomatique = false

const ETATS_JUGES: EtatObjectif[] = ['atteint', 'proche', 'retard']

const blocs = computed(() => [
  ...FAMILLES.map(f => ({
    id: f.code,
    titre: f.label,
    colonne: 'Produit',
    aide: 'Part des points de vente relevés où le produit est disponible, face à l’objectif du trimestre.',
    lignes: PRODUITS.filter(p => p.famille === f.code).map(p => ({ cle: `dispo:${p.id}`, label: p.label })),
  })),
  {
    id: 'visibilite-prix',
    titre: 'Visibilité (PLV) et respect des prix',
    colonne: 'Indicateur',
    aide: 'Part des points de vente avec de la publicité sur le lieu de vente (PLV), et part de ceux où les prix de la famille sont respectés.',
    lignes: [
      { cle: 'plv_exterieure', label: libelleIndicateur('plv_exterieure') },
      { cle: 'plv_interieure', label: libelleIndicateur('plv_interieure') },
      ...FAMILLES.map(f => ({ cle: cleLigne({ indicateur: 'prix', reference_produit_id: null, categorie: f.code }), label: libelleIndicateur('prix', f.code) })),
    ],
  },
])

interface Cellule { taux: number | null, cible: number | null, ecart: number | null, mesures: number, horsCalcul: number, etat: EtatObjectif }
function cellule(cleL: string, canal: ColonneObjectif): Cellule {
  const l = index.value.get(cleL)?.[canal]
  const taux = l?.taux == null ? null : Number(l.taux)
  const cible = l?.cible == null || Number(l.cible) <= 0 ? null : Number(l.cible)
  const mesures = Number(l?.mesures || 0)
  return { taux, cible, ecart: ecartPoints(taux, cible), mesures, horsCalcul: Number(l?.hors_calcul || 0), etat: etatObjectif(taux, cible, mesures) }
}
// Une case par ligne du tableau et par colonne, calculée une fois par chargement.
const grille = computed(() => Object.fromEntries(blocs.value.flatMap(b => b.lignes).map(l => [
  l.cle,
  Object.fromEntries(COLONNES.map(c => [c.code, cellule(l.cle, c.code)])) as Record<ColonneObjectif, Cellule>,
])))
const basePdv = (canal: ColonneObjectif | 'INCONNU') => Number(index.value.get('base')?.[canal]?.mesures || 0)
const libelles = Object.fromEntries(blocs.value.flatMap(b => b.lignes).map(l => [l.cle, l.label]))

// Cases produit × canal jugées (base suffisante), hors National.
const casesProduits = computed(() => PRODUITS.flatMap(p => COLONNES.filter(c => c.code !== 'NATIONAL').map(c => ({
  cle: `dispo:${p.id}`, produit: p.label, canal: c.label, canalLong: c.long, ...grille.value[`dispo:${p.id}`][c.code],
}))).filter(c => ETATS_JUGES.includes(c.etat)))

const priorites = computed(() => casesProduits.value
  .filter(c => c.etat === 'retard')
  .sort((a, b) => (a.ecart as number) - (b.ecart as number))
  .slice(0, 5))

const synthese = computed(() => ({
  jugees: casesProduits.value.length,
  atteints: casesProduits.value.filter(c => c.etat === 'atteint').length,
  retard: casesProduits.value.filter(c => c.etat === 'retard').length,
  proche: casesProduits.value.filter(c => c.etat === 'proche').length,
  pire: priorites.value[0] ?? null,
  pdv: basePdv('NATIONAL') + basePdv('INCONNU'),
  inconnus: basePdv('INCONNU'),
}))

function fmtPct(v: number | null | undefined) {
  return v == null ? '—' : `${Math.round(Number(v))} %`
}
// Signe moins typographique (−), pas le trait d'union.
function fmtEcart(v: number | null) {
  return v == null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} pts`
}
// Case sans mesure : produit relevé mais non attendu (aucun seuil pour ces
// types de PDV), ou rien de relevé du tout.
function texteSansMesure(cel: Cellule) {
  const objectif = cel.cible ? `objectif ${fmtPct(cel.cible)}, ` : ''
  if (cel.horsCalcul) return `${objectif}non attendu dans ces ${cel.horsCalcul} PDV`
  return cel.cible ? `${objectif}pas de relevé` : 'pas d’objectif'
}
function classeEtat(e: EtatObjectif) {
  if (e === 'atteint') return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
  if (e === 'proche') return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
  return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200'
}
function iconeEtat(e: EtatObjectif) {
  if (e === 'atteint') return 'i-heroicons-check-circle'
  if (e === 'proche') return 'i-heroicons-minus-circle'
  return 'i-heroicons-exclamation-circle'
}

async function charger() {
  loading.value = true
  erreur.value = null
  try {
    const { data, error } = await (supabase.rpc as any)('dashboard_objectifs_disponibilite', {
      p_annee: periode.value.annee,
      p_trimestre: periode.value.trimestre,
      p_territoire: fTerritoire.value || null,
    })
    if (error) throw error
    lignes.value = (data || []) as LigneObjectif[]
  }
  catch (e) {
    erreur.value = e
    lignes.value = []
  }
  finally {
    loading.value = false
  }
}

function voirTrimestreEnCours() {
  repli.value = null
  cle.value = cleCourante
}

function exporter() {
  const rows = blocs.value.flatMap(b => b.lignes.flatMap(l => COLONNES.map((c) => {
    const cel = grille.value[l.cle][c.code]
    return {
      Trimestre: libelleTrimestre.value,
      Territoire: fTerritoire.value || 'Tous',
      Bloc: b.titre,
      Indicateur: libelles[l.cle],
      Canal: c.long,
      'Réalisé %': cel.taux ?? '',
      'Objectif %': cel.cible ?? '',
      'Écart (pts)': cel.ecart ?? '',
      État: LIBELLE_ETAT[cel.etat],
      'PDV mesurés': cel.mesures,
      'PDV où le produit n’est pas attendu': cel.horsCalcul,
    }
  })))
  exportToCsv(rows, `objectifs-disponibilite-${cle.value}${fTerritoire.value ? `-${fTerritoire.value}` : ''}.csv`)
}

watch([cle, fTerritoire], () => {
  // Un choix de l'utilisateur efface le message de repli.
  if (!repliAutomatique) repli.value = null
  repliAutomatique = false
  router.replace({ query: { ...route.query, trimestre: cle.value, territoire: fTerritoire.value || undefined } })
  void charger()
})

onMounted(async () => {
  void fetchReferentiels()
  await charger()
  // Arrivée sans trimestre demandé : si le trimestre en cours n'a pas encore
  // une base suffisante, on montre le dernier trimestre complet.
  const pdv = basePdv('NATIONAL') + basePdv('INCONNU')
  if (!depuisUrl && enCours.value && !erreur.value && pdv < BASE_FAIBLE && !(courant.annee === 2026 && courant.trimestre === 1)) {
    repli.value = { libelle: libelleTrimestre.value, pdv }
    repliAutomatique = true
    cle.value = cleTrimestre(trimestrePrecedent(courant))
  }
})
</script>
