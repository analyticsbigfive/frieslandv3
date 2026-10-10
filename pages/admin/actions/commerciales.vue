<template>
  <div class="space-y-6">
    <AdminPageHeader description="Les actions décidées par les commerciaux et confiées aux merchandiseurs : suivi, retards et relance." />

    <AdminListToolbar :result-count="loading ? undefined : filtrees.length" result-label="action(s)" :chips="chips" @reset="resetFilters" @remove-chip="removeChip">
      <template #filters>
        <UFormGroup label="Statut" class="w-full min-w-40 sm:w-44">
          <USelectMenu v-model="filtreStatut" :options="statutOptions" value-attribute="value" option-attribute="label" placeholder="Tous" size="sm" />
        </UFormGroup>
        <UFormGroup label="Merchandiser" class="w-full min-w-48 sm:w-56">
          <USelectMenu v-model="filtreAssigne" :options="assigneOptions" value-attribute="value" option-attribute="label" placeholder="Tous" size="sm" searchable searchable-placeholder="Rechercher un merchandiseur…" />
        </UFormGroup>
        <UFormGroup label="Décidée par" class="w-full min-w-48 sm:w-52">
          <USelectMenu v-model="filtreAuteur" :options="auteurOptions" value-attribute="value" option-attribute="label" placeholder="Tous" size="sm" searchable searchable-placeholder="Rechercher un commercial…" />
        </UFormGroup>
        <UFormGroup label="Territoire" class="w-full min-w-44 sm:w-48">
          <USelectMenu v-model="filtreZone" :options="zoneOptions" placeholder="Tous" size="sm" searchable searchable-placeholder="Rechercher un territoire…" />
        </UFormGroup>
      </template>
      <template #actions>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!filtrees.length" @click="exporter">Exporter (CSV)</UButton>
      </template>
    </AdminListToolbar>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatsCard title="Actions" :value="loading ? '—' : kpis.total" icon="i-heroicons-clipboard-document-check" />
      <StatsCard title="Ouvertes" :value="loading ? '—' : kpis.ouvertes" icon="i-heroicons-clock" color="orange" />
      <StatsCard title="En retard" :value="loading ? '—' : kpis.retard" subtitle="Ouvertes, échéance dépassée" icon="i-heroicons-exclamation-triangle" color="red" />
      <StatsCard title="Faites" :value="loading ? '—' : kpis.faites" icon="i-heroicons-check-circle" color="green" />
    </div>

    <!-- Relance WhatsApp : un lien par merchandiseur ayant des actions ouvertes -->
    <section v-if="envois.length" class="admin-surface p-5">
      <h2 class="text-base font-semibold text-slate-900 dark:text-white">Prévenir les merchandiseurs par WhatsApp</h2>
      <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Le message liste les actions ouvertes du merchandiseur. Le numéro vient de sa fiche utilisateur.</p>
      <ul class="mt-3 flex flex-wrap gap-2">
        <li v-for="e in envois" :key="e.id">
          <a
            v-if="e.lien"
            :href="e.lien"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <UIcon name="i-simple-icons-whatsapp" class="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            {{ e.nom }}
            <span class="tabular-nums text-slate-600 dark:text-slate-300">· {{ e.nb }} action(s)</span>
            <span class="sr-only">(ouvre WhatsApp dans un nouvel onglet)</span>
          </a>
          <span
            v-else
            class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            title="Ajoutez son numéro de téléphone sur sa fiche utilisateur pour pouvoir le prévenir."
          >
            <UIcon name="i-heroicons-phone-x-mark" class="h-4 w-4" aria-hidden="true" />
            {{ e.nom }} · numéro manquant
          </span>
        </li>
      </ul>
    </section>

    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Créée le</th>
              <th>Point de vente</th>
              <th>Type</th>
              <th>Décidée par</th>
              <th>Merchandiser</th>
              <th>Échéance</th>
              <th>Statut</th>
              <th>Commentaire</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8"><ChargementContenu variante="compact" libelle="Chargement des actions…" /></td>
            </tr>
            <tr v-else-if="erreur">
              <td colspan="8" class="py-8 text-center text-slate-700 dark:text-slate-200" role="alert">
                Les actions n’ont pas pu être chargées. {{ erreur }}
              </td>
            </tr>
            <tr v-else-if="!pagines.length">
              <td colspan="8" class="py-8 text-center text-slate-600 dark:text-slate-300">
                {{ rows.length ? 'Aucune action ne correspond aux filtres. Retirez un filtre pour en voir plus.' : 'Aucune action commerciale pour le moment. Elles apparaissent ici dès qu’un commercial en décide une sur le terrain.' }}
              </td>
            </tr>
            <tr v-for="a in pagines" :key="a.id">
              <td class="whitespace-nowrap tabular-nums">{{ formatDate(a.created_at) }}</td>
              <td>
                <p class="font-medium text-slate-900 dark:text-white">{{ a.pdv?.nom_pdv || 'Point de vente sans nom' }}</p>
                <p v-if="a.pdv?.zone" class="text-xs text-slate-500 dark:text-slate-400">{{ a.pdv.zone }}</p>
              </td>
              <td>{{ a.type?.libelle || a.type_code }}</td>
              <td>{{ a.auteur?.nom || '—' }}</td>
              <td>{{ a.assigne?.nom || '—' }}</td>
              <td class="whitespace-nowrap">
                <span class="tabular-nums" :class="estEnRetard(a) ? 'font-semibold text-red-700 dark:text-red-300' : ''">{{ a.echeance ? formatDate(a.echeance) : '—' }}</span>
                <span v-if="estEnRetard(a)" class="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300">
                  <UIcon name="i-heroicons-exclamation-triangle" class="h-3.5 w-3.5" aria-hidden="true" />
                  En retard
                </span>
              </td>
              <td><UBadge :color="statutActionColor(a.statut)" variant="subtle">{{ statutActionLabel(a.statut) }}</UBadge></td>
              <td class="max-w-xs truncate" :title="a.commentaire || ''">{{ a.commentaire || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminPagination
        v-if="!loading && filtrees.length"
        :total="filtrees.length"
        :page="page"
        :page-size="perPage"
        item-label="action(s)"
        @update:page="(p) => page = p"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Actions décidées par les commerciaux (lot 3.5), vue administrateur :
// suivi, retards, relance WhatsApp par merchandiseur.
import type { ActionCommerciale } from '~/types'
import { STATUTS_ACTION, estEnRetard, estOuverte, lienWhatsApp, messageActionsPourMerchandiser, statutActionColor, statutActionLabel } from '~/utils/actionsCommerciales'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const authStore = useAuthStore()
const { listerMesActions, chargerTypes } = useActionsCommerciales()
const { exportToCsv } = useCsvExport()

const loading = ref(true)
const erreur = ref('')
const rows = ref<ActionCommerciale[]>([])
const filtreStatut = ref('')
const filtreAssigne = ref('')
const filtreAuteur = ref('')
const filtreZone = ref('')
const page = ref(1)
const perPage = 25

const statutOptions = [{ value: 'ouvertes', label: 'Ouvertes' }, ...STATUTS_ACTION.map(s => ({ value: s.value, label: s.label }))]
const assigneOptions = computed(() => {
  const m = new Map<string, string>()
  for (const a of rows.value) if (a.assigne_a && a.assigne?.nom) m.set(a.assigne_a, a.assigne.nom)
  return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
const auteurOptions = computed(() => {
  const m = new Map<string, string>()
  for (const a of rows.value) if (a.auteur_id && a.auteur?.nom) m.set(a.auteur_id, a.auteur.nom)
  return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
const zoneOptions = computed(() => [...new Set(rows.value.map(a => a.pdv?.zone).filter(Boolean))].sort() as string[])

const filtrees = computed(() => rows.value.filter(a =>
  (!filtreStatut.value || (filtreStatut.value === 'ouvertes' ? estOuverte(a) : a.statut === filtreStatut.value))
  && (!filtreAssigne.value || a.assigne_a === filtreAssigne.value)
  && (!filtreAuteur.value || a.auteur_id === filtreAuteur.value)
  && (!filtreZone.value || a.pdv?.zone === filtreZone.value),
))
const pagines = computed(() => filtrees.value.slice((page.value - 1) * perPage, page.value * perPage))

const chips = computed(() => [
  ...(filtreStatut.value ? [{ key: 'statut', label: `Statut : ${statutOptions.find(o => o.value === filtreStatut.value)?.label}` }] : []),
  ...(filtreAssigne.value ? [{ key: 'assigne', label: `Merchandiser : ${assigneOptions.value.find(o => o.value === filtreAssigne.value)?.label}` }] : []),
  ...(filtreAuteur.value ? [{ key: 'auteur', label: `Décidée par : ${auteurOptions.value.find(o => o.value === filtreAuteur.value)?.label}` }] : []),
  ...(filtreZone.value ? [{ key: 'zone', label: `Territoire : ${filtreZone.value}` }] : []),
])
function removeChip(key: string) {
  if (key === 'statut') filtreStatut.value = ''
  if (key === 'assigne') filtreAssigne.value = ''
  if (key === 'auteur') filtreAuteur.value = ''
  if (key === 'zone') filtreZone.value = ''
}
function resetFilters() { filtreStatut.value = ''; filtreAssigne.value = ''; filtreAuteur.value = ''; filtreZone.value = '' }

const kpis = computed(() => {
  const ouvertes = rows.value.filter(estOuverte)
  const retard = ouvertes.filter(a => estEnRetard(a))
  return {
    total: rows.value.length,
    ouvertes: ouvertes.length,
    retard: retard.length,
    faites: rows.value.filter(a => a.statut === 'faite').length,
  }
})

const envois = computed(() => {
  const parAssigne = new Map<string, ActionCommerciale[]>()
  for (const a of filtrees.value) {
    if (!estOuverte(a) || !a.assigne_a) continue
    parAssigne.set(a.assigne_a, [...(parAssigne.get(a.assigne_a) || []), a])
  }
  return [...parAssigne.entries()].map(([id, liste]) => {
    const nom = liste[0].assigne?.nom || 'Merchandiser'
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

watch([filtreStatut, filtreAssigne, filtreAuteur, filtreZone], () => { page.value = 1 })
onMounted(async () => {
  void chargerTypes()
  try { rows.value = await listerMesActions(2000) }
  catch (err) {
    console.warn('Actions commerciales : chargement impossible', err)
    erreur.value = messageUtilisateur(err)
  }
  finally { loading.value = false }
})
</script>
