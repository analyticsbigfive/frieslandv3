<template>
  <div class="space-y-6">
    <AdminPageHeader title="Actions commerciales" eyebrow="Domaine actions" />

    <AdminListToolbar :result-count="filtrees.length" result-label="action(s)" :chips="chips" @reset="resetFilters" @remove-chip="removeChip">
      <template #filters>
        <UFormGroup label="Statut" class="min-w-40">
          <USelectMenu v-model="filtreStatut" :options="statutOptions" value-attribute="value" option-attribute="label" placeholder="Tous" size="sm" />
        </UFormGroup>
        <UFormGroup label="Merchandiseur" class="min-w-56">
          <USelectMenu v-model="filtreAssigne" :options="assigneOptions" value-attribute="value" option-attribute="label" placeholder="Tous" size="sm" searchable />
        </UFormGroup>
        <UFormGroup label="Zone" class="min-w-44">
          <USelectMenu v-model="filtreZone" :options="zoneOptions" placeholder="Toutes" size="sm" searchable />
        </UFormGroup>
      </template>
      <template #actions>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exporter">Export CSV</UButton>
      </template>
    </AdminListToolbar>

    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div v-for="k in kpis" :key="k.label" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-xs uppercase tracking-wide text-gray-500">{{ k.label }}</p>
        <p class="mt-1 text-2xl font-bold" :class="k.class">{{ k.value }}</p>
      </div>
    </div>

    <!-- Relance WhatsApp : un bouton par merchandiseur ayant des actions ouvertes -->
    <div v-if="envois.length" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p class="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Prévenir les merchandiseurs par WhatsApp</p>
      <p class="mb-3 text-xs text-gray-500">Le message liste les actions ouvertes du merchandiseur. Le numéro vient de sa fiche utilisateur.</p>
      <div class="flex flex-wrap gap-2">
        <a
          v-for="e in envois"
          :key="e.id"
          :href="e.lien || undefined"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
          :class="e.lien ? 'bg-green-600 text-white hover:bg-green-700' : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700'"
          :title="e.lien ? `${e.nb} action(s) ouverte(s)` : 'Numéro de téléphone manquant sur la fiche utilisateur'"
        >
          <UIcon name="i-simple-icons-whatsapp" class="h-4 w-4" />{{ e.nom }} · {{ e.nb }}
        </a>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table class="admin-table w-full">
        <thead>
          <tr><th>Créée le</th><th>PDV</th><th>Zone</th><th>Type</th><th>Décidée par</th><th>Merchandiseur</th><th>Échéance</th><th>Statut</th><th>Commentaire</th></tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="9" class="py-8 text-center text-gray-400">Chargement…</td></tr>
          <tr v-else-if="!pagines.length"><td colspan="9" class="py-8 text-center text-gray-400">Aucune action commerciale.</td></tr>
          <tr v-for="a in pagines" :key="a.id">
            <td>{{ formatDate(a.created_at) }}</td>
            <td class="font-medium">{{ a.pdv?.nom_pdv || a.pdv_id }}</td>
            <td>{{ a.pdv?.zone || '—' }}</td>
            <td>{{ a.type?.libelle || a.type_code }}</td>
            <td>{{ a.auteur?.nom || '—' }}</td>
            <td>{{ a.assigne?.nom || '—' }}</td>
            <td :class="estEnRetard(a) ? 'font-semibold text-red-600' : ''">{{ a.echeance ? formatDate(a.echeance) : '—' }}</td>
            <td><UBadge :color="statutActionColor(a.statut)" variant="subtle">{{ statutActionLabel(a.statut) }}</UBadge></td>
            <td class="max-w-xs truncate" :title="a.commentaire || ''">{{ a.commentaire || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination v-model:page="page" :total="filtrees.length" :per-page="perPage" />
  </div>
</template>

<script setup lang="ts">
// Actions décidées par les commerciaux (lot 3.5), vue administrateur :
// suivi, retards, relance WhatsApp par merchandiseur.
import type { ActionCommerciale } from '~/types'
import { STATUTS_ACTION, estEnRetard, estOuverte, lienWhatsApp, messageActionsPourMerchandiser, statutActionColor, statutActionLabel } from '~/utils/actionsCommerciales'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const authStore = useAuthStore()
const { listerMesActions, chargerTypes } = useActionsCommerciales()
const { exportToCsv } = useCsvExport()

const loading = ref(true)
const rows = ref<ActionCommerciale[]>([])
const filtreStatut = ref('')
const filtreAssigne = ref('')
const filtreZone = ref('')
const page = ref(1)
const perPage = 25

const statutOptions = [{ value: 'ouvertes', label: 'Ouvertes' }, ...STATUTS_ACTION.map(s => ({ value: s.value, label: s.label }))]
const assigneOptions = computed(() => {
  const m = new Map<string, string>()
  for (const a of rows.value) if (a.assigne_a && a.assigne?.nom) m.set(a.assigne_a, a.assigne.nom)
  return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
const zoneOptions = computed(() => [...new Set(rows.value.map(a => a.pdv?.zone).filter(Boolean))].sort() as string[])

const filtrees = computed(() => rows.value.filter(a =>
  (!filtreStatut.value || (filtreStatut.value === 'ouvertes' ? estOuverte(a) : a.statut === filtreStatut.value))
  && (!filtreAssigne.value || a.assigne_a === filtreAssigne.value)
  && (!filtreZone.value || a.pdv?.zone === filtreZone.value),
))
const pagines = computed(() => filtrees.value.slice((page.value - 1) * perPage, page.value * perPage))

const chips = computed(() => [
  ...(filtreStatut.value ? [{ key: 'statut', label: `Statut : ${statutOptions.find(o => o.value === filtreStatut.value)?.label}` }] : []),
  ...(filtreAssigne.value ? [{ key: 'assigne', label: `Merchandiseur : ${assigneOptions.value.find(o => o.value === filtreAssigne.value)?.label}` }] : []),
  ...(filtreZone.value ? [{ key: 'zone', label: `Zone : ${filtreZone.value}` }] : []),
])
function removeChip(key: string) {
  if (key === 'statut') filtreStatut.value = ''
  if (key === 'assigne') filtreAssigne.value = ''
  if (key === 'zone') filtreZone.value = ''
}
function resetFilters() { filtreStatut.value = ''; filtreAssigne.value = ''; filtreZone.value = '' }

const kpis = computed(() => {
  const ouvertes = rows.value.filter(estOuverte)
  const retard = ouvertes.filter(a => estEnRetard(a))
  return [
    { label: 'Actions', value: rows.value.length, class: '' },
    { label: 'Ouvertes', value: ouvertes.length, class: 'text-orange-600' },
    { label: 'En retard', value: retard.length, class: retard.length ? 'text-red-600' : '' },
    { label: 'Faites', value: rows.value.filter(a => a.statut === 'faite').length, class: 'text-green-600' },
  ]
})

const envois = computed(() => {
  const parAssigne = new Map<string, ActionCommerciale[]>()
  for (const a of filtrees.value) {
    if (!estOuverte(a) || !a.assigne_a) continue
    parAssigne.set(a.assigne_a, [...(parAssigne.get(a.assigne_a) || []), a])
  }
  return [...parAssigne.entries()].map(([id, liste]) => {
    const nom = liste[0].assigne?.nom || 'Merchandiseur'
    const msg = messageActionsPourMerchandiser(nom.split(' ')[0], liste, authStore.profile?.nom)
    return { id, nom, nb: liste.length, lien: lienWhatsApp(liste[0].assigne?.telephone, msg) }
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

function formatDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

function exporter() {
  exportToCsv(filtrees.value.map(a => ({
    creee_le: formatDate(a.created_at), pdv: a.pdv?.nom_pdv || a.pdv_id, zone: a.pdv?.zone || '', quartier: a.pdv?.quartier || '',
    type: a.type?.libelle || a.type_code, decidee_par: a.auteur?.nom || '', merchandiseur: a.assigne?.nom || '',
    echeance: a.echeance || '', statut: statutActionLabel(a.statut), commentaire: a.commentaire || '',
  })), `actions-commerciales-${new Date().toISOString().slice(0, 10)}.csv`)
}

watch([filtreStatut, filtreAssigne, filtreZone], () => { page.value = 1 })
onMounted(async () => {
  void chargerTypes()
  try { rows.value = await listerMesActions(2000) }
  catch (err) { console.warn('Actions commerciales : chargement impossible', err) }
  finally { loading.value = false }
})
</script>
