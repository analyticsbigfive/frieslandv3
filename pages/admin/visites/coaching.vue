<template>
  <div class="space-y-6">
    <AdminPageHeader title="Field coaching" eyebrow="Domaine visites" />

    <AdminListToolbar :result-count="filtres.length" result-label="coaching(s)" :chips="chips" @reset="resetFilters" @remove-chip="removeChip">
      <template #filters>
        <PeriodFilter v-model="periode" />
        <UFormGroup label="Superviseur" class="min-w-56">
          <USelectMenu v-model="filtreSuperviseur" :options="superviseurOptions" placeholder="Tous" size="sm" searchable value-attribute="value" option-attribute="label" />
        </UFormGroup>
        <UFormGroup label="Zone" class="min-w-48">
          <USelectMenu v-model="filtreZone" :options="zoneOptions" placeholder="Toutes" size="sm" searchable />
        </UFormGroup>
      </template>
      <template #actions>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exporter">Export CSV</UButton>
        <UButton size="sm" variant="outline" icon="i-heroicons-printer" @click="imprimer">Imprimer</UButton>
      </template>
    </AdminListToolbar>

    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div v-for="k in kpis" :key="k.label" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-xs uppercase tracking-wide text-gray-500">{{ k.label }}</p>
        <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{{ k.value }}</p>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table class="admin-table w-full">
        <thead>
          <tr>
            <th>Date</th><th>PDV</th><th>Zone</th><th>Superviseur</th><th>En charge</th><th>Distributeur</th><th>Engin</th>
            <th>SKU dispo</th><th>Visibilité</th><th>Promotion</th><th>Score</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="11" class="py-8 text-center text-gray-400">Chargement…</td></tr>
          <tr v-else-if="!pagines.length"><td colspan="11" class="py-8 text-center text-gray-400">Aucun field coaching sur la période.</td></tr>
          <tr v-for="c in pagines" :key="c.id">
            <td>{{ formatDate(c.date_coaching) }}</td>
            <td class="font-medium">{{ c.pdv?.nom_pdv || c.pdv_id }}</td>
            <td>{{ c.pdv?.zone || '—' }}</td>
            <td>{{ c.superviseur?.nom || c.auteur?.nom || '—' }}</td>
            <td>{{ c.assigne?.nom || '—' }}</td>
            <td>{{ c.distributeur_nom || '—' }}</td>
            <td>{{ c.engin_code || '—' }}</td>
            <td>{{ c.nb_sku_dispo ?? '—' }} / {{ c.nb_sku_pdv ?? '—' }}</td>
            <td>{{ pct(scoreCoaching(c.reponses, 'visibilite').taux) }}</td>
            <td>{{ pct(scoreCoaching(c.reponses, 'promotion').taux) }}</td>
            <td><UBadge :color="couleur(scoreCoaching(c.reponses).taux)" variant="subtle">{{ pct(scoreCoaching(c.reponses).taux) }}</UBadge></td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination v-model:page="page" :total="filtres.length" :per-page="perPage" />
  </div>
</template>

<script setup lang="ts">
// Rapport des field coaching effectués (lot 4.5) : filtres, table, export, impression.
import type { FieldCoaching } from '~/types'
import type { PeriodeValue } from '~/components/PeriodFilter.vue'
import { plageDePeriode } from '~/utils/periode'
import { QUESTIONS_COACHING, scoreCoaching } from '~/utils/fieldCoaching'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const { exportToCsv } = useCsvExport()

const loading = ref(true)
const rows = ref<FieldCoaching[]>([])
const periode = ref<PeriodeValue>({ preset: '30j', ...plageDePeriode('30j') })
const filtreSuperviseur = ref('')
const filtreZone = ref('')
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
  && (!filtreZone.value || c.pdv?.zone === filtreZone.value),
))
const pagines = computed(() => filtres.value.slice((page.value - 1) * perPage, page.value * perPage))

const chips = computed(() => [
  ...(filtreSuperviseur.value ? [{ key: 'superviseur', label: `Superviseur : ${superviseurOptions.value.find(o => o.value === filtreSuperviseur.value)?.label}` }] : []),
  ...(filtreZone.value ? [{ key: 'zone', label: `Zone : ${filtreZone.value}` }] : []),
])
function removeChip(key: string) {
  if (key === 'superviseur') filtreSuperviseur.value = ''
  if (key === 'zone') filtreZone.value = ''
}
function resetFilters() {
  filtreSuperviseur.value = ''
  filtreZone.value = ''
  periode.value = { preset: '30j', ...plageDePeriode('30j') }
}

const kpis = computed(() => {
  const n = filtres.value.length
  const moy = (bloc?: 'visibilite' | 'promotion') => {
    const t = filtres.value.map(c => scoreCoaching(c.reponses, bloc).taux).filter((x): x is number => x != null)
    return t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) + ' %' : '—'
  }
  return [
    { label: 'Coachings', value: n },
    { label: 'PDV couverts', value: new Set(filtres.value.map(c => c.pdv_id)).size },
    { label: 'Perfect Visibility', value: moy('visibilite') },
    { label: 'Effective Promotion', value: moy('promotion') },
  ]
})

function pct(t: number | null) { return t == null ? 'N/A' : `${t} %` }
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
    distributeur: c.distributeur_nom || '',
    engin: c.engin_code || '',
    route_jour: c.route_jour || '',
    type_pdv: c.type_pdv || '',
    proprietaire: [c.proprietaire_prenom, c.proprietaire_nom].filter(Boolean).join(' '),
    telephone: c.proprietaire_tel || '',
    sku_pdv: c.nb_sku_pdv ?? '',
    sku_dispo: c.nb_sku_dispo ?? '',
    skus: (c.skus_disponibles || []).map(s => s.nom).join(' | '),
    ...Object.fromEntries(QUESTIONS_COACHING.map(q => [q.code, c.reponses?.[q.code] || ''])),
    score_visibilite: scoreCoaching(c.reponses, 'visibilite').taux ?? '',
    score_promotion: scoreCoaching(c.reponses, 'promotion').taux ?? '',
    score_global: scoreCoaching(c.reponses).taux ?? '',
    commentaire: c.commentaire || '',
  })), `field-coaching-${periode.value.debut}-${periode.value.fin}.csv`)
}
function imprimer() { window.print() }

async function charger() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('field_coaching')
      .select('id, date_coaching, auteur_id, superviseur_id, assigne_a, distributeur_nom, engin_code, pdv_id, route_jour, type_pdv, quartier, proprietaire_nom, proprietaire_prenom, proprietaire_tel, nb_sku_pdv, nb_sku_dispo, skus_disponibles, reponses, commentaire, pdv:pdv_id(nom_pdv, zone), auteur:auteur_id(nom), assigne:assigne_a(nom), superviseur:superviseur_id(nom)')
      .gte('date_coaching', `${periode.value.debut}T00:00:00`)
      .lte('date_coaching', `${periode.value.fin}T23:59:59`)
      .order('date_coaching', { ascending: false })
      .limit(2000)
    if (error) throw error
    rows.value = (data || []) as unknown as FieldCoaching[]
  }
  catch (err) {
    console.warn('Field coaching : chargement impossible', err)
    rows.value = []
  }
  finally {
    loading.value = false
  }
}
watch(periode, charger, { deep: true })
watch([filtreSuperviseur, filtreZone], () => { page.value = 1 })
onMounted(charger)
</script>
