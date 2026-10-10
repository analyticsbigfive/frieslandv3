<template>
  <div class="space-y-6">
    <AdminPageHeader description="Les coachings terrain faits par les commerciaux auprès des vendeurs du distributeur (SSF) et des merchandisers." />

    <AdminListToolbar :result-count="loading ? undefined : filtres.length" result-label="coaching(s)" :chips="chips" @reset="resetFilters" @remove-chip="removeChip">
      <template #filters>
        <PeriodFilter v-model="periode" />
        <UFormGroup label="Commercial" class="w-full min-w-48 sm:w-56">
          <USelectMenu v-model="filtreSuperviseur" :options="superviseurOptions" placeholder="Tous" size="sm" searchable searchable-placeholder="Rechercher un commercial…" value-attribute="value" option-attribute="label" />
        </UFormGroup>
        <UFormGroup label="Territoire" class="w-full min-w-44 sm:w-48">
          <USelectMenu v-model="filtreZone" :options="zoneOptions" placeholder="Tous" size="sm" searchable searchable-placeholder="Rechercher un territoire…" />
        </UFormGroup>
        <UFormGroup label="Canal" class="w-full min-w-44 sm:w-56">
          <USelectMenu v-model="filtreType" :options="TYPES_COACHING" placeholder="Tous" size="sm" value-attribute="value" option-attribute="label" />
        </UFormGroup>
      </template>
      <template #actions>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!filtres.length" @click="exporter">Exporter (CSV)</UButton>
        <UButton size="sm" color="gray" variant="ghost" icon="i-heroicons-printer" @click="imprimer">Imprimer</UButton>
      </template>
    </AdminListToolbar>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatsCard title="Coachings" :value="loading ? '—' : kpis.coachings" icon="i-heroicons-academic-cap" color="red" format="number" />
      <StatsCard title="Points de vente couverts" :value="loading ? '—' : kpis.pdv" icon="i-heroicons-map-pin" />
      <StatsCard title="Score de visibilité" :value="loading ? '—' : kpis.visibilite" subtitle="Moyenne des coachings" icon="i-heroicons-eye" format="none" />
      <StatsCard title="Score de promotion" :value="loading ? '—' : kpis.promotion" subtitle="Moyenne des coachings" icon="i-heroicons-tag" format="none" />
    </div>

    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Canal</th>
              <th>Point de vente</th>
              <th>Commercial</th>
              <th>Personne coachée</th>
              <th>Objectif</th>
              <th class="text-right" title="Références disponibles sur les références suivies au point de vente">Références (SKU) disponibles</th>
              <th class="text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8"><ChargementContenu variante="compact" libelle="Chargement des coachings…" /></td>
            </tr>
            <tr v-else-if="erreur">
              <td colspan="8" class="py-8 text-center text-slate-700 dark:text-slate-200" role="alert">
                Les coachings n’ont pas pu être chargés. {{ erreur }}
              </td>
            </tr>
            <tr v-else-if="!pagines.length">
              <td colspan="8" class="py-8 text-center text-slate-600 dark:text-slate-300">
                {{ rows.length ? 'Aucun coaching ne correspond aux filtres. Retirez un filtre pour en voir plus.' : 'Aucun coaching terrain sur la période. Élargissez la période pour en voir plus.' }}
              </td>
            </tr>
            <tr v-for="c in pagines" :key="c.id">
              <td class="whitespace-nowrap tabular-nums">{{ formatDate(c.date_coaching) }}</td>
              <td class="whitespace-nowrap">{{ c.type_coaching === 'mt' ? 'Supermarché (MT)' : 'Boutique (GT)' }}</td>
              <td>
                <p class="font-medium text-slate-900 dark:text-white">{{ c.pdv?.nom_pdv || 'Point de vente sans nom' }}</p>
                <p v-if="c.pdv?.zone" class="text-xs text-slate-500 dark:text-slate-400">{{ c.pdv.zone }}</p>
              </td>
              <td>
                <p>{{ c.superviseur?.nom || c.auteur?.nom || '—' }}</p>
                <p v-if="c.assigne?.nom" class="text-xs text-slate-500 dark:text-slate-400">En charge : {{ c.assigne.nom }}</p>
              </td>
              <td>
                <p>
                  {{ c.type_coaching === 'mt' ? (c.merchandiser?.nom || '—') : (c.ssf?.nom || c.vendeur_nom || '—') }}
                  <span
                    v-if="c.type_coaching !== 'mt' && c.ssf_id"
                    class="ml-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    title="Vendeur relié à la liste des vendeurs du distributeur (SSF)"
                  >Vendeur (SSF)</span>
                </p>
                <p v-if="c.distributeur_nom || c.engin_code" class="text-xs text-slate-500 dark:text-slate-400">
                  {{ [c.distributeur_nom, c.engin_code ? `Engin : ${c.engin_code}` : ''].filter(Boolean).join(' · ') }}
                </p>
              </td>
              <td>{{ libelleObjectif(c.objectif_code) }}</td>
              <td class="text-right tabular-nums">{{ c.nb_sku_dispo ?? '—' }} sur {{ c.nb_sku_pdv ?? '—' }}</td>
              <td class="whitespace-nowrap text-right">
                <UBadge :color="couleur(scoreCoaching(c.reponses).taux)" variant="subtle">{{ pct(scoreCoaching(c.reponses).taux) }}</UBadge>
                <p class="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  Visibilité {{ pct(scoreCoaching(c.reponses, 'visibilite').taux) }} · Promotion {{ pct(scoreCoaching(c.reponses, 'promotion').taux) }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminPagination
        v-if="!loading && filtres.length"
        :total="filtres.length"
        :page="page"
        :page-size="perPage"
        item-label="coaching(s)"
        @update:page="(p) => page = p"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Rapport des coachings terrain (field coaching) effectués (lot 4.5) :
// filtres, table, export, impression.
import type { FieldCoaching } from '~/types'
import type { PeriodeValue } from '~/components/PeriodFilter.vue'
import { plageDePeriode } from '~/utils/periode'
import { QUESTIONS_COACHING, scoreCoaching } from '~/utils/fieldCoaching'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const { exportToCsv } = useCsvExport()

const loading = ref(true)
const erreur = ref('')
const rows = ref<FieldCoaching[]>([])
const periode = ref<PeriodeValue>({ preset: '30j', ...plageDePeriode('30j') })
const filtreSuperviseur = ref('')
const filtreZone = ref('')
const filtreType = ref('')
const TYPES_COACHING = [
  { value: '', label: 'Tous' },
  { value: 'gt', label: 'Boutiques (GT), vendeurs' },
  { value: 'mt', label: 'Supermarchés (MT), merchandisers' },
]
// Objectifs de coaching (Référentiels › Objectifs de coaching).
const objectifs = ref<{ code: string, libelle: string }[]>([])
const libelleObjectif = (code?: string | null) => (code ? objectifs.value.find(o => o.code === code)?.libelle || code : '—')
const page = ref(1)
const perPage = 25

const superviseurOptions = computed(() => {
  const m = new Map<string, string>()
  for (const c of rows.value) {
    const id = c.superviseur_id || c.auteur_id
    const nom = c.superviseur?.nom || c.auteur?.nom
    if (id && nom) m.set(id, nom)
  }
  return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
const zoneOptions = computed(() => [...new Set(rows.value.map(c => c.pdv?.zone).filter(Boolean))].sort() as string[])

const filtres = computed(() => rows.value.filter(c =>
  (!filtreSuperviseur.value || (c.superviseur_id || c.auteur_id) === filtreSuperviseur.value)
  && (!filtreZone.value || c.pdv?.zone === filtreZone.value)
  && (!filtreType.value || (c.type_coaching || 'gt') === filtreType.value),
))
const pagines = computed(() => filtres.value.slice((page.value - 1) * perPage, page.value * perPage))

const chips = computed(() => [
  ...(filtreSuperviseur.value ? [{ key: 'superviseur', label: `Commercial : ${superviseurOptions.value.find(o => o.value === filtreSuperviseur.value)?.label}` }] : []),
  ...(filtreZone.value ? [{ key: 'zone', label: `Territoire : ${filtreZone.value}` }] : []),
  ...(filtreType.value ? [{ key: 'type', label: TYPES_COACHING.find(t => t.value === filtreType.value)?.label || '' }] : []),
])
function removeChip(key: string) {
  if (key === 'superviseur') filtreSuperviseur.value = ''
  if (key === 'zone') filtreZone.value = ''
  if (key === 'type') filtreType.value = ''
}
function resetFilters() {
  filtreSuperviseur.value = ''
  filtreZone.value = ''
  filtreType.value = ''
  periode.value = { preset: '30j', ...plageDePeriode('30j') }
}

const kpis = computed(() => {
  const n = filtres.value.length
  const moy = (bloc?: 'visibilite' | 'promotion') => {
    const t = filtres.value.map(c => scoreCoaching(c.reponses, bloc).taux).filter((x): x is number => x != null)
    return t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) + ' %' : '—'
  }
  // Visibilité et promotion : blocs « Perfect Visibility » et « Effective
  // Promotion » de la grille de coaching.
  return {
    coachings: n,
    pdv: new Set(filtres.value.map(c => c.pdv_id)).size,
    visibilite: moy('visibilite'),
    promotion: moy('promotion'),
  }
})

function pct(t: number | null) { return t == null ? '—' : `${t} %` }
function couleur(t: number | null) { return t == null ? 'gray' : t >= 70 ? 'green' : t >= 40 ? 'orange' : 'red' }
function formatDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

function exporter() {
  exportToCsv(filtres.value.map(c => ({
    date: formatDate(c.date_coaching),
    pdv: c.pdv?.nom_pdv || c.pdv_id,
    zone: c.pdv?.zone || '',
    quartier: c.quartier || '',
    superviseur: c.superviseur?.nom || c.auteur?.nom || '',
    en_charge: c.assigne?.nom || '',
    type: (c.type_coaching || 'gt').toUpperCase(),
    distributeur: c.distributeur_nom || '',
    vendeur: c.type_coaching === 'mt' ? '' : (c.ssf?.nom || c.vendeur_nom || ''),
    merchandiser_suivi: c.type_coaching === 'mt' ? (c.merchandiser?.nom || '') : '',
    objectif: c.objectif_code ? libelleObjectif(c.objectif_code) : '',
    engin: c.engin_code || '',
    route_jour: c.route_jour || '',
    type_pdv: c.type_pdv || '',
    sous_type_pdv: c.type_pdv_detail || '',
    proprietaire: [c.proprietaire_prenom, c.proprietaire_nom].filter(Boolean).join(' '),
    telephone: c.proprietaire_tel || '',
    sku_pdv: c.nb_sku_pdv ?? '',
    sku_dispo: c.nb_sku_dispo ?? '',
    skus: (c.skus_disponibles || []).map(s => s.nom).join(' | '),
    ...Object.fromEntries(QUESTIONS_COACHING.map(q => [q.code, c.reponses?.[q.code] || ''])),
    score_visibilite: scoreCoaching(c.reponses, 'visibilite').taux ?? '',
    score_promotion: scoreCoaching(c.reponses, 'promotion').taux ?? '',
    score_global: scoreCoaching(c.reponses).taux ?? '',
    motif_non_participation: c.motif_non_participation || '',
    commentaire: c.commentaire || '',
  })), `coaching-terrain-${periode.value.debut}-${periode.value.fin}.csv`)
}
function imprimer() { window.print() }

async function charger() {
  loading.value = true
  try {
    const BASE = 'id, date_coaching, auteur_id, superviseur_id, assigne_a, distributeur_nom, vendeur_nom, engin_code, pdv_id, route_jour, type_pdv, type_pdv_detail, quartier, proprietaire_nom, proprietaire_prenom, proprietaire_tel, nb_sku_pdv, nb_sku_dispo, skus_disponibles, reponses, commentaire, motif_non_participation, pdv:pdv_id(nom_pdv, zone), auteur:auteur_id(nom), assigne:assigne_a(nom), superviseur:superviseur_id(nom)'
    // Type, SSF, merchandiser suivi, objectif : migration 20261008160000 (repli sans).
    const requete = (colonnes: string) => (supabase.from('field_coaching') as any)
      .select(colonnes)
      .gte('date_coaching', `${periode.value.debut}T00:00:00`)
      .lte('date_coaching', `${periode.value.fin}T23:59:59`)
      .order('date_coaching', { ascending: false })
      .limit(2000)
    let { data, error } = await requete(`${BASE}, type_coaching, ssf_id, merchandiser_id, objectif_code, ssf:ssf_id(nom), merchandiser:merchandiser_id(nom)`)
    if (error) ({ data, error } = await requete(BASE))
    if (error) throw error
    erreur.value = ''
    rows.value = (data || []) as unknown as FieldCoaching[]
  }
  catch (err) {
    console.warn('Field coaching : chargement impossible', err)
    erreur.value = messageUtilisateur(err)
    rows.value = []
  }
  finally {
    loading.value = false
  }
}
watch(periode, charger, { deep: true })
watch([filtreSuperviseur, filtreZone, filtreType], () => { page.value = 1 })
onMounted(async () => {
  void charger()
  const { data } = await (supabase.from('coaching_objectif') as any).select('code, libelle').order('ordre')
  objectifs.value = data || []
})
</script>
