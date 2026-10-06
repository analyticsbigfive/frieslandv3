<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Référentiels</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Géographie, distribution, points de vente, produits et paramètres Perfect Store <span class="text-xs">(Système B)</span>.
        </p>
      </div>
      <UButton v-if="!activeVue && !activeDef.lectureSeule" icon="i-heroicons-plus" class="bg-fc-blue" @click="openCreate">Ajouter — {{ activeDef.label }}</UButton>
    </div>

    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      Référentiels indisponibles — {{ error }}
    </div>

    <!-- Sections -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="s in sections"
        :key="s.key"
        type="button"
        class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
        :class="section === s.key
          ? 'bg-fc-red text-white shadow-sm'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
        @click="selectSection(s.key)"
      >
        {{ s.label }}
      </button>
    </div>

    <!-- Referentiels within section -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex flex-wrap gap-x-5 gap-y-1">
        <button
          v-for="d in sectionEntrees"
          :key="d.id"
          type="button"
          class="whitespace-nowrap border-b-2 pb-2.5 text-sm font-medium transition-colors"
          :class="activeId === d.id
            ? 'border-fc-red text-fc-red'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'"
          @click="activeId = d.id"
        >
          {{ d.label }} <span v-if="!('vue' in d)" class="text-xs text-gray-400">({{ (store[d.id] || []).length }})</span>
        </button>
      </nav>
    </div>

    <!-- Écrans dédiés (grille, actions) : pas de table générique -->
    <AdminQuotasAtom v-if="activeVue?.id === 'quotas_atom'" />
    <AdminMaintenance v-else-if="activeVue?.id === 'maintenance'" />
    <AdminPublierVersion v-else-if="activeVue?.id === 'publier_version'" />

    <template v-if="!activeVue">
    <!-- Toolbar -->
    <div class="admin-toolbar flex items-center justify-between gap-3">
      <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Rechercher..." size="sm" class="w-full sm:w-80" />
      <p class="whitespace-nowrap text-xs text-gray-400">{{ filteredRows.length }} / {{ (store[activeId] || []).length }}</p>
    </div>

    <!-- Table -->
    <div class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th v-for="col in activeDef.columns" :key="col.label" :class="col.align === 'c' ? 'th-c' : 'th-l'">{{ col.label }}</th>
            <th class="th-c w-20">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="row in paginatedRefRows" :key="activeDef.rowKey(row)" class="row">
            <td v-for="col in activeDef.columns" :key="col.label" class="px-4 py-2.5 text-sm" :class="col.align === 'c' ? 'text-center' : 'text-gray-900 dark:text-gray-100'">
              <template v-if="col.kind === 'badge'">
                <UBadge :color="col.color ? col.color(row) : 'gray'" variant="soft" size="xs">{{ col.cell(row) }}</UBadge>
              </template>
              <template v-else-if="col.kind === 'bool'">
                <UIcon
                  :name="col.cell(row) ? 'i-heroicons-check-circle-solid' : 'i-heroicons-minus-circle'"
                  class="h-5 w-5"
                  :class="col.cell(row) ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'"
                />
              </template>
              <span v-else-if="col.kind === 'mono'" class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ col.cell(row) || '—' }}</span>
              <span v-else :class="col.kind === 'num' ? 'font-semibold tabular-nums' : (col.muted ? 'text-gray-600 dark:text-gray-300' : '')">{{ col.cell(row) }}</span>
            </td>
            <td class="px-4 py-2.5 text-center">
              <UDropdown v-if="!activeDef.lectureSeule" :items="rowActions(row)">
                <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
              </UDropdown>
            </td>
          </tr>
          <tr v-if="!loading && !filteredRows.length">
            <td :colspan="activeDef.columns.length + 1" class="px-4 py-10 text-center text-sm text-gray-400">Aucune donnée.</td>
          </tr>
        </tbody>
      </table>
      <div class="border-t border-gray-100 px-4 py-3 dark:border-gray-700">
        <AdminPagination
          :total="filteredRows.length"
          :page="refPage"
          :page-size="refPerPage"
          item-label="ligne(s)"
          @update:page="(p) => refPage = p"
        />
      </div>
      <div v-if="loading" class="p-8 text-center">
        <UIcon name="i-heroicons-arrow-path" class="mx-auto h-8 w-8 animate-spin text-fc-blue" />
      </div>
    </div>
    <p v-if="activeDef.aide" class="text-xs text-gray-500 dark:text-gray-400">{{ activeDef.aide }}</p>
    </template>

    <!-- CRUD Modal -->
    <AdminFormModal
      v-model="showModal"
      :title="`${editing ? 'Modifier' : 'Ajouter'} — ${activeDef.label}`"
      description="Renseignez les propriétés de cet élément de référentiel."
      icon="i-heroicons-circle-stack"
      width="sm:max-w-3xl"
      body-class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2"
      required-note
    >
        <UFormGroup
          v-for="f in activeDef.fields"
          :key="f.key"
          :label="f.label"
          :required="f.required"
          :help="f.hint"
          size="md"
        >
          <USelectMenu
            v-if="f.type === 'select'"
            v-model="form[f.key]"
            :options="fieldOpts(f)"
            option-attribute="label"
            value-attribute="value"
            :disabled="editing && f.lockEdit"
            searchable
            searchable-placeholder="Rechercher..."
            :placeholder="f.label"
            size="md"
            class="w-full"
          />
          <USelectMenu
            v-else-if="f.type === 'bool'"
            v-model="form[f.key]"
            :options="[{ value: true, label: 'Oui' }, { value: false, label: 'Non' }]"
            option-attribute="label"
            value-attribute="value"
            size="md"
            class="w-full"
          />
          <UInput
            v-else-if="f.type === 'num'"
            v-model.number="form[f.key]"
            type="number"
            :step="f.step ?? 1"
            :min="f.min"
            :max="f.max"
            :disabled="editing && f.lockEdit"
            :placeholder="f.label"
            size="md"
            class="w-full"
          />
          <UInput
            v-else
            v-model="form[f.key]"
            :disabled="editing && f.lockEdit"
            :placeholder="f.label"
            size="md"
            class="w-full"
          />
        </UFormGroup>

      <template #footer>
        <UButton type="button" color="gray" variant="ghost" @click="showModal = false">
          Annuler
        </UButton>
        <UButton
          icon="i-heroicons-check"
          class="bg-fc-blue text-white hover:bg-fc-blue-600 disabled:bg-fc-blue-300 aria-disabled:bg-fc-blue-300 focus-visible:outline-fc-blue-500 dark:bg-fc-blue dark:text-white dark:hover:bg-fc-blue-600 dark:disabled:bg-fc-blue-700 dark:aria-disabled:bg-fc-blue-700 dark:focus-visible:outline-fc-blue-400"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        >
          {{ editing ? 'Mettre à jour' : 'Ajouter' }}
        </UButton>
      </template>
    </AdminFormModal>
  </div>
</template>

<script setup lang="ts">
import { fetchAllRows } from '~/utils/fetchAll'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
// Tables ajoutées après la génération des types Supabase : client non typé.
const table = (nom: string): any => (supabase as any).from(nom)
const toast = useToast()

// -- Enumérations métier (Système B) --------------------------------------
const CANAUX = ['GT', 'MT']
const BASES = [{ value: 'taux_vente', label: 'Taux vente' }, { value: 'taux_revu', label: 'Taux revu' }]
const GRADES = ['A', 'B', 'C']
const DISPO_SEGMENTS = ['Boutique', 'Minimarket', 'Kiosque', 'Aboki', 'Pushcart', 'TableTop', 'Porridge']
const MT_SEGMENTS = ['Hypermarche', 'MoyenSuper', 'PetitSuper']
const VISI_SEGMENTS = ['boutique', 'superette', 'mt', 'table_top', 'pushcart', 'porridge', 'kiosque_aboki']
const NIVEAUX = ['flagship', 'vip', 'core', 'basic']
const PILIERS = ['visibilite', 'promotion']
const EMPLACEMENTS = ['exterieure', 'interieure', 'promotion']
const ROLES = ['phare', 'soutien', 'croissance', 'nouveaute', 'a_retirer']
const JSONB_CATS = ['evap', 'imp', 'scm']

// -- Data store ------------------------------------------------------------
const store = reactive<Record<string, any[]>>({})
const loading = ref(true)
const error = ref<string | null>(null)

// Lookup maps (FK resolution + select options) rebuilt after every fetch.
const byKey = (id: string, key: string) => {
  const m = new Map<any, any>()
  for (const r of store[id] || []) m.set(r[key], r)
  return m
}
const maps = reactive<Record<string, Map<any, any>>>({})
function rebuildMaps() {
  maps.region = byKey('region', 'code')
  maps.sous_region = byKey('sous_region', 'code')
  maps.territoire_code = byKey('territoire', 'code')
  maps.territoire_id = byKey('territoire', 'id')
  maps.zone_id = byKey('zone', 'id')
  maps.distributeur_id = byKey('distributeur', 'id')
  maps.categorie_pdv = byKey('categorie_pdv', 'id')
  maps.type_pdv = byKey('type_pdv', 'id')
  maps.categorie_produit = byKey('categorie_produit', 'id')
  maps.reference_produit = byKey('reference_produit', 'id')
  maps.marque_concurrente = byKey('marque_concurrente', 'id')
  maps.element_visibilite = byKey('element_visibilite', 'id')
  maps.zoneDistrib = new Map((store.zone_distributeur || []).map((r: any) => [r.zone_id, r.distributeur_id]))
  maps.quartierCount = (store.quartier || []).reduce((m: Map<any, number>, q: any) => m.set(q.zone_id, (m.get(q.zone_id) || 0) + 1), new Map())
  maps.ssf_id = byKey('ssf', 'id')
  maps.ssfQuartierCount = (store.ssf_quartier || []).reduce((m: Map<any, number>, q: any) => m.set(q.ssf_id, (m.get(q.ssf_id) || 0) + 1), new Map())
  maps.parametreTous = new Map((store.parametre_app || []).filter((r: any) => r.portee === 'tous').map((r: any) => [r.cle, r]))
}

// Couples zone / quartier tels qu'écrits dans les PDV (v_quartiers_pdv, plus
// de 1 000 lignes : lecture paginée à part, pour le choix des sous-zones SSF).
const quartiersPdv = ref<{ zone: string, quartier: string, nb_pdv: number }[]>([])
async function chargerQuartiersPdv() {
  try {
    quartiersPdv.value = await fetchAllRows<any>((from, to) => table('v_quartiers_pdv')
      .select('zone, quartier, nb_pdv').order('zone').order('quartier').range(from, to))
  }
  catch { quartiersPdv.value = [] }
}

// Texte comparable : majuscules, sans accents ni ponctuation (comme les imports).
const normaliser = (t: string) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[’']/g, ' ').replace(/[^A-Z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim()
const codeDepuisLibelle = (t: string) => normaliser(t).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

// Option builders ----------------------------------------------------------
const opt = <T,>(rows: T[], value: (r: T) => any, label: (r: T) => string) =>
  rows.map(r => ({ value: value(r), label: label(r) }))
const JOURS_SEMAINE: Record<number, string> = { 0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' }
const CANAUX_ATOM = ['Superette', 'Boutique', 'Aboki & Kiosque', 'Pushcart', 'Porridge']
const regionOpts = () => opt(store.region || [], r => r.code, r => `${r.nom_affichage || r.nom} · ${r.code}`)
const sousRegionOpts = () => opt(store.sous_region || [], r => r.code, r => `${r.nom_affichage || r.nom} · ${r.code}`)
const territoireOpts = () => opt(store.territoire || [], r => r.code, r => `${r.nom} · ${r.code}`)
const territoireIdOpts = () => opt(store.territoire || [], r => r.id, r => `${r.nom} · ${r.code}`)
const distributeurIdOpts = () => opt(store.distributeur || [], r => r.id, r => r.nom)
const zoneIdOpts = () => opt(store.zone || [], r => r.id, r => `${r.code} · ${maps.territoire_code?.get(r.territoire_code)?.nom || r.territoire_code}`)
const categoriePdvOpts = () => opt(store.categorie_pdv || [], r => r.id, r => `${r.nom}${r.canal ? ' · ' + r.canal : ''}`)
const typePdvOpts = () => opt(store.type_pdv || [], r => r.id, r => r.nom)
const categorieProduitOpts = () => opt(store.categorie_produit || [], r => r.id, r => `${r.nom} (${r.code})`)
const referenceOpts = () => opt(store.reference_produit || [], r => r.id, r => `${r.nom} · ${catCodeOf(r.categorie_produit_id)}`)
const elementVisOpts = () => opt(store.element_visibilite || [], r => r.id, r => `${r.nom} · ${r.segment} · ${r.pilier}`)
const marqueConcurrenteOpts = () => opt(store.marque_concurrente || [], r => r.id, r => `${r.nom} · ${String(r.famille || '').toUpperCase()}`)
const marqueNomOf = (id: string) => { const m = maps.marque_concurrente?.get(id); return m ? `${m.nom} (${String(m.famille || '').toUpperCase()})` : '—' }
const marqueCodeOf = (id: string) => maps.marque_concurrente?.get(id)?.code || ''

const catCodeOf = (id: number) => maps.categorie_produit?.get(id)?.code || '—'
const refNameOf = (id: number) => maps.reference_produit?.get(id)?.nom || `#${id}`
const typePdvNameOf = (id: number) => maps.type_pdv?.get(id)?.nom || `#${id}`
const territoireNameOf = (id: number) => maps.territoire_id?.get(id)?.nom || `#${id}`
const distributeurNameOf = (id: number) => maps.distributeur_id?.get(id)?.nom || `#${id}`
// Une area (`zone`) n'est plus rendue via son `nom` (bloc de quartiers collés) :
// on l'affiche par code + territoire, et les quartiers vivent dans leur propre
// référentiel « Quartiers ». zoneNameOf reste pour le picker (options).
const zoneOf = (id: number) => maps.zone_id?.get(id)
const zoneCodeOf = (id: number) => zoneOf(id)?.code || `#${id}`
const zoneTerrLabelOf = (id: number) => { const z = zoneOf(id); return z ? (maps.territoire_code?.get(z.territoire_code)?.nom || z.territoire_code) : '—' }
const zoneDistribOf = (id: number) => { const did = maps.zoneDistrib?.get(id); return did ? distributeurNameOf(did) : '—' }
const quartierCountOf = (id: number) => maps.quartierCount?.get(id) || 0
const elementVisNameOf = (id: number) => { const e = maps.element_visibilite?.get(id); return e ? `${e.nom} (${e.segment})` : `#${id}` }
const ssfNomOf = (id: number) => maps.ssf_id?.get(id)?.nom || `#${id}`
const ssfQuartierCountOf = (id: number) => maps.ssfQuartierCount?.get(id) || 0
const ssfOpts = () => opt((store.ssf || []).filter((r: any) => r.actif !== false), r => r.id, r => `${r.nom}${r.distributeur_id ? ' · ' + distributeurNameOf(r.distributeur_id) : ''}`)
const quartierPdvOpts = () => quartiersPdv.value.map(q => ({ value: `${q.zone}|${q.quartier}`, label: `${q.zone} › ${q.quartier} (${q.nb_pdv})` }))
const ORIGINES_SOUS_ZONE: Record<string, { label: string, color: string }> = {
  derive: { label: 'Dérivée des visites', color: 'amber' },
  client: { label: 'Fichier client', color: 'green' },
  admin: { label: 'Saisie admin', color: 'blue' },
}
const origineSousZone = (source?: string) => (source?.startsWith('derive-') ? ORIGINES_SOUS_ZONE.derive
  : source?.startsWith('client-') ? ORIGINES_SOUS_ZONE.client : ORIGINES_SOUS_ZONE.admin)
const TYPES_ALIAS = [
  { value: 'merchandiser', label: 'Merchandiser → e-mail du compte' },
  { value: 'distributeur', label: 'Distributeur → nom du référentiel' },
  { value: 'ssf', label: 'SSF → nom du référentiel SSF' },
]
const MODES_ALIAS = [
  { value: 'exact', label: 'Texte exact' },
  { value: 'commence', label: 'Commence par' },
  { value: 'contient', label: 'Contient' },
]
const PORTEES = [
  { value: 'tous', label: 'Tous les utilisateurs' },
  { value: 'friesland', label: 'Friesland uniquement' },
  { value: 'atom', label: 'Atom uniquement' },
]
const libellePortee = (p: string) => PORTEES.find(x => x.value === p)?.label || p
const valeurParametre = (r: any) => (r.valeur == null ? 'Non défini' : `${r.valeur} ${r.unite || ''}`.trim())
const bornesParametre = (r: any) => (r.min == null && r.max == null ? '—' : `${r.min ?? '…'} → ${r.max ?? '…'} ${r.unite || ''}`.trim())

const tierColor = (v: string) => v === 'MT' ? 'purple' : 'blue'

// -- Référentiel definitions ----------------------------------------------
interface Col { label: string; cell: (r: any) => any; align?: 'c'; kind?: 'badge' | 'bool' | 'mono' | 'num'; color?: (r: any) => string; muted?: boolean }
interface Field { key: string; label: string; type: 'text' | 'num' | 'select' | 'bool'; opts?: () => any[]; required?: boolean; lockEdit?: boolean; step?: number; min?: number; max?: number; hint?: string }
interface Def {
  id: string; section: string; label: string; table: string; select: string
  order?: (q: any) => any
  /** Référentiel sans suppression : le code est structurel dans les visites, on désactive. */
  noDelete?: boolean
  /** Consultation seule : ni ajout ni modification (données écrites par l'app). */
  lectureSeule?: boolean
  columns: Col[]
  fields: Field[]
  blank: () => any
  fill: (row: any) => any
  rowKey: (row: any) => string
  search: (row: any) => string
  save: (form: any, editing: boolean) => Promise<{ error: any }>
  del: (row: any) => Promise<{ error: any }>
  valid: (f: any) => boolean
  /** Texte d'aide affiché sous la table. */
  aide?: string
}
/** Écran dédié (grille, actions) affiché à la place de la table générique. */
interface Vue { id: string, section: string, label: string, vue: true }

const defs: Def[] = [
  // ===== GÉOGRAPHIE =====
  {
    id: 'region', section: 'geo', label: 'Régions', table: 'region',
    select: 'id, code, nom, nom_affichage, pays_code', order: q => q.order('nom'),
    columns: [
      { label: 'Code', cell: r => r.code, kind: 'mono' },
      { label: 'Nom', cell: r => r.nom },
      { label: 'Affichage', cell: r => r.nom_affichage || '—', muted: true },
      { label: 'Pays', cell: r => r.pays_code || '—', muted: true },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, lockEdit: true },
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'nom_affichage', label: 'Nom affiché', type: 'text' },
      { key: 'pays_code', label: 'Code pays', type: 'text' },
    ],
    blank: () => ({ code: '', nom: '', nom_affichage: '', pays_code: '' }),
    fill: r => ({ ...r }),
    rowKey: r => r.code, search: r => `${r.code} ${r.nom} ${r.nom_affichage}`.toLowerCase(),
    valid: f => !!f.code && !!f.nom,
    save: (f, e) => e
      ? supabase.from('region').update({ nom: f.nom, nom_affichage: f.nom_affichage || null, pays_code: f.pays_code || null }).eq('code', f.code)
      : supabase.from('region').insert({ code: f.code, nom: f.nom, nom_affichage: f.nom_affichage || null, pays_code: f.pays_code || null }),
    del: r => supabase.from('region').delete().eq('code', r.code),
  },
  {
    id: 'sous_region', section: 'geo', label: 'Sous-régions', table: 'sous_region',
    select: 'id, code, nom, nom_affichage, region_code', order: q => q.order('nom'),
    columns: [
      { label: 'Code', cell: r => r.code, kind: 'mono' },
      { label: 'Nom', cell: r => r.nom },
      { label: 'Affichage', cell: r => r.nom_affichage || '—', muted: true },
      { label: 'Région', cell: r => maps.region?.get(r.region_code)?.nom || r.region_code || '—', muted: true },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, lockEdit: true },
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'nom_affichage', label: 'Nom affiché', type: 'text' },
      { key: 'region_code', label: 'Région', type: 'select', opts: regionOpts, required: true },
    ],
    blank: () => ({ code: '', nom: '', nom_affichage: '', region_code: '' }),
    fill: r => ({ ...r }),
    rowKey: r => r.code, search: r => `${r.code} ${r.nom} ${r.nom_affichage}`.toLowerCase(),
    valid: f => !!f.code && !!f.nom && !!f.region_code,
    save: (f, e) => e
      ? supabase.from('sous_region').update({ nom: f.nom, nom_affichage: f.nom_affichage || null, region_code: f.region_code }).eq('code', f.code)
      : supabase.from('sous_region').insert({ code: f.code, nom: f.nom, nom_affichage: f.nom_affichage || null, region_code: f.region_code }),
    del: r => supabase.from('sous_region').delete().eq('code', r.code),
  },
  {
    id: 'territoire', section: 'geo', label: 'Territoires', table: 'territoire',
    select: 'id, code, nom, sous_region_code', order: q => q.order('nom'),
    columns: [
      { label: 'Code', cell: r => r.code, kind: 'mono' },
      { label: 'Nom', cell: r => r.nom },
      { label: 'Sous-région', cell: r => maps.sous_region?.get(r.sous_region_code)?.nom || r.sous_region_code || '—', muted: true },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, lockEdit: true },
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'sous_region_code', label: 'Sous-région', type: 'select', opts: sousRegionOpts, required: true },
    ],
    blank: () => ({ code: '', nom: '', sous_region_code: '' }),
    fill: r => ({ ...r }),
    rowKey: r => r.code, search: r => `${r.code} ${r.nom}`.toLowerCase(),
    valid: f => !!f.code && !!f.nom && !!f.sous_region_code,
    save: (f, e) => e
      ? supabase.from('territoire').update({ nom: f.nom, sous_region_code: f.sous_region_code }).eq('code', f.code)
      : supabase.from('territoire').insert({ code: f.code, nom: f.nom, sous_region_code: f.sous_region_code }),
    del: r => supabase.from('territoire').delete().eq('code', r.code),
  },
  {
    id: 'zone', section: 'geo', label: 'Zones / Areas', table: 'zone',
    select: 'id, code, nom, territoire_code', order: q => q.order('territoire_code').order('code'),
    columns: [
      { label: 'Code area', cell: r => r.code || '—', kind: 'mono' },
      { label: 'Territoire', cell: r => maps.territoire_code?.get(r.territoire_code)?.nom || r.territoire_code, muted: true },
      { label: 'Distributeur', cell: r => zoneDistribOf(r.id), muted: true },
      { label: 'Quartiers', cell: r => quartierCountOf(r.id), align: 'c', kind: 'num' },
    ],
    fields: [
      { key: 'code', label: 'Code Area', type: 'text', required: true },
      { key: 'nom', label: 'Libellé area (legacy)', type: 'text', hint: 'Ancien libellé collé — les quartiers se gèrent dans le référentiel « Quartiers ».' },
      { key: 'territoire_code', label: 'Territoire', type: 'select', opts: territoireOpts, required: true },
    ],
    blank: () => ({ code: '', nom: '', territoire_code: '' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.code} ${maps.territoire_code?.get(r.territoire_code)?.nom || r.territoire_code}`.toLowerCase(),
    valid: f => !!f.code && !!f.territoire_code,
    save: (f, e) => e
      ? supabase.from('zone').update({ code: f.code || null, nom: f.nom || f.code, territoire_code: f.territoire_code }).eq('id', f.id)
      : supabase.from('zone').insert({ code: f.code || null, nom: f.nom || f.code, territoire_code: f.territoire_code }),
    del: r => supabase.from('zone').delete().eq('id', r.id),
  },
  {
    id: 'quartier', section: 'geo', label: 'Quartiers', table: 'quartier',
    select: 'id, zone_id, nom, ordre', order: q => q.order('zone_id').order('ordre'),
    columns: [
      { label: 'Territoire', cell: r => zoneTerrLabelOf(r.zone_id), muted: true },
      { label: 'Code area', cell: r => zoneCodeOf(r.zone_id), kind: 'mono' },
      { label: 'Quartier', cell: r => r.nom },
      { label: 'Distributeur', cell: r => zoneDistribOf(r.zone_id), muted: true },
    ],
    fields: [
      { key: 'zone_id', label: 'Area (zone)', type: 'select', opts: zoneIdOpts, required: true, lockEdit: true },
      { key: 'nom', label: 'Quartier', type: 'text', required: true },
      { key: 'ordre', label: 'Ordre', type: 'num', min: 1 },
    ],
    blank: () => ({ zone_id: null, nom: '', ordre: 1 }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${zoneCodeOf(r.zone_id)} ${r.nom} ${zoneTerrLabelOf(r.zone_id)}`.toLowerCase(),
    valid: f => !!f.zone_id && !!f.nom,
    save: (f, e) => e
      ? supabase.from('quartier').update({ nom: f.nom, ordre: f.ordre ?? 1 }).eq('id', f.id)
      : supabase.from('quartier').insert({ zone_id: f.zone_id, nom: f.nom, ordre: f.ordre ?? 1 }),
    del: r => supabase.from('quartier').delete().eq('id', r.id),
  },
  {
    id: 'territoire_alias', section: 'geo', label: 'Alias de territoire', table: 'territoire_alias',
    select: 'alias, territoire_code, created_at', order: q => q.order('alias'),
    columns: [
      { label: 'Libellé hors référentiel', cell: r => r.alias, kind: 'mono' },
      { label: 'Territoire réel', cell: r => maps.territoire_code?.get(r.territoire_code)?.nom || r.territoire_code },
      { label: 'Code', cell: r => r.territoire_code, muted: true },
    ],
    fields: [
      { key: 'alias', label: 'Libellé hors référentiel', type: 'text', required: true, lockEdit: true, hint: 'Tel qu\'il apparaît sur les PDV (pdv.zone) ou les profils, ex. MARCORY TREICHVILLE' },
      { key: 'territoire_code', label: 'Territoire réel', type: 'select', opts: territoireOpts, required: true },
    ],
    blank: () => ({ alias: '', territoire_code: '' }),
    fill: r => ({ ...r }),
    rowKey: r => r.alias, search: r => `${r.alias} ${r.territoire_code} ${maps.territoire_code?.get(r.territoire_code)?.nom || ''}`.toLowerCase(),
    valid: f => !!f.alias?.trim() && !!f.territoire_code,
    save: (f, e) => e
      ? supabase.from('territoire_alias').update({ territoire_code: f.territoire_code }).eq('alias', f.alias)
      : supabase.from('territoire_alias').insert({ alias: f.alias.trim().toUpperCase(), territoire_code: f.territoire_code }),
    del: r => supabase.from('territoire_alias').delete().eq('alias', r.alias),
  },
  // ===== DISTRIBUTION =====
  {
    id: 'distributeur', section: 'distrib', label: 'Distributeurs', table: 'distributeur',
    select: 'id, nom, national', order: q => q.order('nom'),
    columns: [
      { label: 'Distributeur', cell: r => r.nom },
      { label: 'Couverture', cell: r => r.national ? 'National' : 'Local', align: 'c', kind: 'badge', color: r => r.national ? 'purple' : 'blue' },
    ],
    fields: [
      { key: 'nom', label: 'Nom', type: 'text', required: true, hint: 'Renommer met aussi à jour les PDV et les règles de tournée qui portent l’ancien nom ; l’ancien nom reste reconnu dans les imports.' },
      { key: 'national', label: 'Couverture nationale', type: 'bool' },
    ],
    blank: () => ({ nom: '', national: false }),
    fill: r => ({ ...r, nomInitial: r.nom }),
    rowKey: r => String(r.id), search: r => r.nom.toLowerCase(),
    valid: f => !!f.nom,
    save: async (f, e) => {
      if (!e) return await table('distributeur').insert({ nom: f.nom.trim(), national: !!f.national })
      if (f.nom.trim() !== f.nomInitial) {
        const { error } = await (supabase.rpc as any)('renommer_distributeur', { p_id: f.id, p_nom: f.nom.trim() })
        if (error) return { error }
      }
      return await table('distributeur').update({ national: !!f.national }).eq('id', f.id)
    },
    del: r => supabase.from('distributeur').delete().eq('id', r.id),
  },
  {
    id: 'territoire_distributeur', section: 'distrib', label: 'Distrib ↔ Territoires', table: 'territoire_distributeur',
    select: 'territoire_id, distributeur_id',
    columns: [
      { label: 'Territoire', cell: r => territoireNameOf(r.territoire_id) },
      { label: 'Distributeur', cell: r => distributeurNameOf(r.distributeur_id) },
    ],
    fields: [
      { key: 'territoire_id', label: 'Territoire', type: 'select', opts: territoireIdOpts, required: true, lockEdit: true },
      { key: 'distributeur_id', label: 'Distributeur', type: 'select', opts: distributeurIdOpts, required: true, lockEdit: true },
    ],
    blank: () => ({ territoire_id: null, distributeur_id: null }),
    fill: r => ({ ...r }),
    rowKey: r => `${r.territoire_id}-${r.distributeur_id}`,
    search: r => `${territoireNameOf(r.territoire_id)} ${distributeurNameOf(r.distributeur_id)}`.toLowerCase(),
    valid: f => !!f.territoire_id && !!f.distributeur_id,
    save: (f, _e) => supabase.from('territoire_distributeur').upsert({ territoire_id: f.territoire_id, distributeur_id: f.distributeur_id }, { onConflict: 'territoire_id,distributeur_id' }),
    del: r => supabase.from('territoire_distributeur').delete().eq('territoire_id', r.territoire_id).eq('distributeur_id', r.distributeur_id),
  },
  {
    id: 'zone_distributeur', section: 'distrib', label: 'Distrib ↔ Areas', table: 'zone_distributeur',
    select: 'zone_id, distributeur_id',
    columns: [
      { label: 'Code area', cell: r => zoneCodeOf(r.zone_id), kind: 'mono' },
      { label: 'Territoire', cell: r => zoneTerrLabelOf(r.zone_id), muted: true },
      { label: 'Distributeur', cell: r => distributeurNameOf(r.distributeur_id) },
    ],
    fields: [
      { key: 'zone_id', label: 'Area (zone)', type: 'select', opts: zoneIdOpts, required: true, lockEdit: true },
      { key: 'distributeur_id', label: 'Distributeur', type: 'select', opts: distributeurIdOpts, required: true, lockEdit: true },
    ],
    blank: () => ({ zone_id: null, distributeur_id: null }),
    fill: r => ({ ...r }),
    rowKey: r => `${r.zone_id}-${r.distributeur_id}`,
    search: r => `${zoneCodeOf(r.zone_id)} ${zoneTerrLabelOf(r.zone_id)} ${distributeurNameOf(r.distributeur_id)}`.toLowerCase(),
    valid: f => !!f.zone_id && !!f.distributeur_id,
    save: (f, _e) => supabase.from('zone_distributeur').upsert({ zone_id: f.zone_id, distributeur_id: f.distributeur_id }, { onConflict: 'zone_id,distributeur_id' }),
    del: r => supabase.from('zone_distributeur').delete().eq('zone_id', r.zone_id).eq('distributeur_id', r.distributeur_id),
  },
  // ===== POINTS DE VENTE =====
  {
    id: 'categorie_pdv', section: 'pdv', label: 'Catégories PDV', table: 'categorie_pdv',
    select: 'id, nom, nom_fr, canal', order: q => q.order('nom'),
    columns: [
      { label: 'Catégorie (niveau 3)', cell: r => r.nom },
      { label: 'Libellé affiché', cell: r => r.nom_fr || '—', muted: true },
      { label: 'Canal', cell: r => r.canal || '—', align: 'c', kind: 'badge', color: r => tierColor(r.canal) },
    ],
    fields: [
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'nom_fr', label: 'Libellé affiché (français)', type: 'text', hint: 'Montré dans l’app et l’admin à la place du nom de référence.' },
      { key: 'canal', label: 'Canal', type: 'select', opts: () => CANAUX, required: true },
    ],
    blank: () => ({ nom: '', nom_fr: '', canal: 'GT' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.nom} ${r.nom_fr || ''}`.toLowerCase(),
    valid: f => !!f.nom && !!f.canal,
    save: (f, e) => e
      ? supabase.from('categorie_pdv').update({ nom: f.nom, nom_fr: f.nom_fr || null, canal: f.canal }).eq('id', f.id)
      : supabase.from('categorie_pdv').insert({ nom: f.nom, nom_fr: f.nom_fr || null, canal: f.canal }),
    del: r => supabase.from('categorie_pdv').delete().eq('id', r.id),
  },
  {
    id: 'type_pdv', section: 'pdv', label: 'Types PDV', table: 'type_pdv',
    select: 'id, nom, nom_fr, categorie_pdv_id', order: q => q.order('nom'),
    columns: [
      { label: 'Type (niveau 4)', cell: r => r.nom },
      { label: 'Libellé affiché', cell: r => r.nom_fr || '—', muted: true },
      { label: 'Catégorie (niveau 3)', cell: r => maps.categorie_pdv?.get(r.categorie_pdv_id)?.nom || '—', muted: true },
      { label: 'Canal', cell: r => maps.categorie_pdv?.get(r.categorie_pdv_id)?.canal || '—', align: 'c', kind: 'badge', color: r => tierColor(maps.categorie_pdv?.get(r.categorie_pdv_id)?.canal) },
    ],
    fields: [
      { key: 'nom', label: 'Type', type: 'text', required: true },
      { key: 'nom_fr', label: 'Libellé affiché (français)', type: 'text', hint: 'Montré dans l’app et l’admin à la place du nom de référence.' },
      { key: 'categorie_pdv_id', label: 'Catégorie', type: 'select', opts: categoriePdvOpts, required: true },
    ],
    blank: () => ({ nom: '', nom_fr: '', categorie_pdv_id: null }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.nom} ${r.nom_fr || ''}`.toLowerCase(),
    valid: f => !!f.nom && !!f.categorie_pdv_id,
    save: (f, e) => e
      ? supabase.from('type_pdv').update({ nom: f.nom, nom_fr: f.nom_fr || null, categorie_pdv_id: f.categorie_pdv_id }).eq('id', f.id)
      : supabase.from('type_pdv').insert({ nom: f.nom, nom_fr: f.nom_fr || null, categorie_pdv_id: f.categorie_pdv_id }),
    del: r => supabase.from('type_pdv').delete().eq('id', r.id),
  },
  {
    id: 'frequence_visite', section: 'pdv', label: 'Fréquence de visite', table: 'frequence_visite',
    select: 'id, zone, type_pdv, jours', order: q => q.order('zone', { nullsFirst: true }).order('type_pdv', { nullsFirst: true }),
    columns: [
      { label: 'Territoire', cell: r => r.zone || 'Tous', muted: true },
      { label: 'Type de PDV', cell: r => r.type_pdv || 'Tous', muted: true },
      { label: 'Jours entre deux visites', cell: r => r.jours, align: 'c', kind: 'num' },
    ],
    fields: [
      { key: 'zone', label: 'Territoire', type: 'select', opts: () => [{ value: '', label: 'Tous les territoires' }, ...territoireOpts().map(o => ({ value: o.label.split(' · ')[0], label: o.label }))], lockEdit: true, hint: 'Vide = tous. La surcharge la plus précise (territoire + type) gagne.' },
      { key: 'type_pdv', label: 'Type de PDV', type: 'select', opts: () => [{ value: '', label: 'Tous les types' }, ...typePdvOpts().map(o => ({ value: o.label, label: o.label }))], lockEdit: true },
      { key: 'jours', label: 'Jours entre deux visites', type: 'num', required: true, min: 1, hint: '7 = hebdomadaire. Au-delà, le PDV passe « en retard » dans la synthèse par zone.' },
    ],
    blank: () => ({ zone: '', type_pdv: '', jours: 7 }),
    fill: r => ({ ...r, zone: r.zone || '', type_pdv: r.type_pdv || '' }),
    rowKey: r => String(r.id), search: r => `${r.zone || 'tous'} ${r.type_pdv || 'tous'} ${r.jours}`.toLowerCase(),
    valid: f => typeof f.jours === 'number' && f.jours >= 1,
    save: (f, e) => e
      ? supabase.from('frequence_visite').update({ jours: f.jours }).eq('id', f.id)
      : supabase.from('frequence_visite').insert({ zone: f.zone || null, type_pdv: f.type_pdv || null, jours: f.jours }),
    // La ligne par défaut (tous / tous) n'est pas supprimable : sans elle, plus
    // aucun PDV n'a de fréquence et la fraîcheur devient incalculable.
    del: async (r) => (!r.zone && !r.type_pdv)
      ? { error: new Error('La fréquence par défaut ne peut pas être supprimée : modifiez sa valeur.') }
      : supabase.from('frequence_visite').delete().eq('id', r.id),
  },
  {
    // Une seule ligne, jamais supprimable et jamais créée à la main : seule sa
    // valeur se modifie. Sans elle, fenetre_suivi_mois() retomberait sur 12 —
    // les RPC continueraient de répondre, mais le réglage serait invisible.
    id: 'parametre_suivi', section: 'pdv', label: 'Fenêtre de suivi', table: 'parametre_suivi',
    select: 'cle, valeur, libelle, aide', order: q => q.order('cle'), noDelete: true,
    columns: [
      { label: 'Paramètre', cell: r => r.libelle },
      { label: 'Valeur (mois)', cell: r => r.valeur, align: 'c', kind: 'num' },
      { label: 'Effet', cell: r => r.aide, muted: true },
    ],
    fields: [
      { key: 'valeur', label: 'Fenêtre de suivi (mois)', type: 'num', required: true, min: 1, hint: 'Un PDV visité au moins une fois dans cette fenêtre compte dans les alertes. Au-delà, il bascule dans « à prospecter » sur la synthèse par zone.' },
    ],
    blank: () => ({ cle: 'fenetre_suivi_mois', valeur: 12 }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.cle), search: r => `${r.libelle} ${r.valeur}`.toLowerCase(),
    valid: f => typeof f.valeur === 'number' && f.valeur >= 1,
    save: (f, e) => e
      ? supabase.from('parametre_suivi').update({ valeur: f.valeur }).eq('cle', f.cle)
      : supabase.from('parametre_suivi').insert({ cle: f.cle, valeur: f.valeur, libelle: 'Fenêtre de suivi (mois)' }),
    del: async () => ({ error: new Error('Ce paramètre ne se supprime pas : modifiez sa valeur.') }),
  },
  {
    id: 'parametre_app', section: 'app', label: 'Paramètres terrain', table: 'parametre_app',
    select: 'cle, portee, valeur, libelle, description, unite, min, max, ordre', order: q => q.order('ordre').order('portee'),
    aide: 'Lus par l’application à son lancement et à chaque retour au premier plan (version 1.0.11 et suivantes). Une valeur « Atom » ou « Friesland » prime sur « Tous » pour ces utilisateurs.',
    columns: [
      { label: 'Paramètre', cell: r => r.libelle },
      { label: 'Portée', cell: r => libellePortee(r.portee), kind: 'badge', color: r => (r.portee === 'tous' ? 'gray' : r.portee === 'atom' ? 'purple' : 'blue') },
      { label: 'Valeur', cell: r => valeurParametre(r), align: 'c', kind: 'num' },
      { label: 'Bornes', cell: r => bornesParametre(r), align: 'c', muted: true },
      { label: 'Effet', cell: r => r.description, muted: true },
    ],
    fields: [
      { key: 'cle', label: 'Paramètre', type: 'select', opts: () => [...(maps.parametreTous?.values() || [])].map((r: any) => ({ value: r.cle, label: r.libelle })), required: true, lockEdit: true },
      { key: 'portee', label: 'Portée', type: 'select', opts: () => PORTEES, required: true, lockEdit: true },
      { key: 'valeur', label: 'Valeur', type: 'num', hint: 'Vide = non défini (pour l’objectif de visites : taille de la tournée du jour).' },
    ],
    blank: () => ({ cle: null, portee: 'atom', valeur: null }),
    fill: r => ({ ...r }),
    rowKey: r => `${r.cle}|${r.portee}`, search: r => `${r.libelle} ${r.cle} ${r.portee}`.toLowerCase(),
    valid: (f) => {
      if (!f.cle || !f.portee) return false
      const base = maps.parametreTous?.get(f.cle) || f
      const v = f.valeur === '' || f.valeur == null ? null : Number(f.valeur)
      if (v == null) return true
      return Number.isFinite(v) && (base.min == null || v >= base.min) && (base.max == null || v <= base.max)
    },
    save: (f, e) => {
      const valeur = f.valeur === '' || f.valeur == null ? null : Number(f.valeur)
      if (e) return table('parametre_app').update({ valeur }).eq('cle', f.cle).eq('portee', f.portee)
      const base = maps.parametreTous?.get(f.cle) || {}
      return table('parametre_app').insert({
        cle: f.cle, portee: f.portee, valeur,
        libelle: `${base.libelle || f.cle} (${libellePortee(f.portee)})`,
        description: base.description || null, unite: base.unite || null, min: base.min ?? null, max: base.max ?? null,
        ordre: (base.ordre ?? 100) + 1,
      })
    },
    del: async r => (r.portee === 'tous'
      ? { error: new Error('Valeur de référence : modifiez-la plutôt que de la supprimer.') }
      : await table('parametre_app').delete().eq('cle', r.cle).eq('portee', r.portee)),
  },
  {
    id: 'canal_atom_sous_categorie', section: 'app', label: 'Canal Atom', table: 'canal_atom_sous_categorie',
    select: 'sous_categorie, canal', order: q => q.order('sous_categorie'),
    aide: 'Canal de la grille de quotas Atom pour chaque sous-catégorie de PDV. « Hors quota » : jamais proposé dans les tournées Atom. Une sous-catégorie absente suit la règle par défaut (Boutique, Superette, Kiosque…).',
    columns: [
      { label: 'Sous-catégorie PDV', cell: r => r.sous_categorie },
      { label: 'Canal Atom', cell: r => r.canal || 'Hors quota', kind: 'badge', color: r => (r.canal ? 'purple' : 'gray') },
    ],
    fields: [
      { key: 'sous_categorie', label: 'Sous-catégorie PDV', type: 'text', required: true, lockEdit: true, hint: 'Texte exact de la sous-catégorie des PDV.' },
      { key: 'canal', label: 'Canal Atom', type: 'select', opts: () => [...CANAUX_ATOM.map(c => ({ value: c, label: c })), { value: 'hors', label: 'Hors quota' }], required: true },
    ],
    blank: () => ({ sous_categorie: '', canal: 'Boutique' }),
    fill: r => ({ ...r, canal: r.canal || 'hors' }),
    rowKey: r => r.sous_categorie, search: r => `${r.sous_categorie} ${r.canal || 'hors quota'}`.toLowerCase(),
    valid: f => !!String(f.sous_categorie || '').trim() && !!f.canal,
    save: (f, e) => {
      const canal = f.canal === 'hors' ? null : f.canal
      return e
        ? table('canal_atom_sous_categorie').update({ canal, updated_at: new Date().toISOString() }).eq('sous_categorie', f.sous_categorie)
        : table('canal_atom_sous_categorie').insert({ sous_categorie: String(f.sous_categorie).trim(), canal })
    },
    del: r => table('canal_atom_sous_categorie').delete().eq('sous_categorie', r.sous_categorie),
  },
  {
    id: 'type_action_commerciale', section: 'app', label: 'Types d’action', table: 'type_action_commerciale',
    select: 'code, libelle, ordre, actif', order: q => q.order('ordre'),
    noDelete: true,
    aide: 'Actions qu’un commercial peut décider après une visite (Actions commerciales).',
    columns: [
      { label: 'Action', cell: r => r.libelle },
      { label: 'Code', cell: r => r.code, kind: 'mono', muted: true },
      { label: 'Ordre', cell: r => r.ordre, align: 'c', kind: 'num' },
      { label: 'Active', cell: r => r.actif, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'libelle', label: 'Libellé', type: 'text', required: true },
      { key: 'ordre', label: 'Ordre', type: 'num', min: 0 },
      { key: 'actif', label: 'Active', type: 'bool', hint: 'Désactivée : n’est plus proposée ; les actions déjà créées sont conservées.' },
    ],
    blank: () => ({ libelle: '', ordre: 100, actif: true }),
    fill: r => ({ ...r }),
    rowKey: r => r.code, search: r => `${r.libelle} ${r.code}`.toLowerCase(),
    valid: f => !!String(f.libelle || '').trim(),
    save: (f, e) => e
      ? table('type_action_commerciale').update({ libelle: f.libelle, ordre: f.ordre ?? 100, actif: f.actif !== false }).eq('code', f.code)
      : table('type_action_commerciale').insert({ code: codeDepuisLibelle(f.libelle), libelle: f.libelle, ordre: f.ordre ?? 100, actif: f.actif !== false }),
    del: async () => ({ error: new Error('Suppression désactivée : désactivez le type.') }),
  },
  {
    id: 'engin_vente', section: 'app', label: 'Engins de vente', table: 'engin_vente',
    select: 'code, libelle, ordre, actif', order: q => q.order('ordre'),
    noDelete: true,
    aide: 'Engins proposés dans le field coaching des vendeurs.',
    columns: [
      { label: 'Engin', cell: r => r.libelle },
      { label: 'Code', cell: r => r.code, kind: 'mono', muted: true },
      { label: 'Ordre', cell: r => r.ordre, align: 'c', kind: 'num' },
      { label: 'Actif', cell: r => r.actif, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'libelle', label: 'Libellé', type: 'text', required: true },
      { key: 'ordre', label: 'Ordre', type: 'num', min: 0 },
      { key: 'actif', label: 'Actif', type: 'bool' },
    ],
    blank: () => ({ libelle: '', ordre: 100, actif: true }),
    fill: r => ({ ...r }),
    rowKey: r => r.code, search: r => `${r.libelle} ${r.code}`.toLowerCase(),
    valid: f => !!String(f.libelle || '').trim(),
    save: (f, e) => e
      ? table('engin_vente').update({ libelle: f.libelle, ordre: f.ordre ?? 100, actif: f.actif !== false }).eq('code', f.code)
      : table('engin_vente').insert({ code: codeDepuisLibelle(f.libelle), libelle: f.libelle, ordre: f.ordre ?? 100, actif: f.actif !== false }),
    del: async () => ({ error: new Error('Suppression désactivée : désactivez l’engin.') }),
  },
  {
    // Mise à jour obligatoire de l'app mobile (migration 20260930091000,
    // plugins/version-app.client.ts). Une ligne par plateforme.
    id: 'version_app', section: 'app', label: 'Version minimale', table: 'version_app',
    select: 'plateforme, version_code_min, version_nom_min, url_telechargement, message', order: q => q.order('plateforme'), noDelete: true,
    columns: [
      { label: 'Plateforme', cell: r => r.plateforme, kind: 'badge' },
      { label: 'Version minimale', cell: r => `${r.version_nom_min || '?'} (code ${r.version_code_min})` },
      { label: 'Lien de téléchargement', cell: r => r.url_telechargement || '—', muted: true },
    ],
    fields: [
      { key: 'version_code_min', label: 'Code de version minimal (versionCode)', type: 'num', required: true, min: 1, hint: 'En dessous, l’app est bloquée sur un écran de mise à jour. 1.0.9 = 11, 1.0.10 = 13. Vérifier d’abord la version installée dans « Versions installées ».' },
      { key: 'version_nom_min', label: 'Version affichée', type: 'text', hint: 'Ex. 1.0.10' },
      { key: 'url_telechargement', label: 'Lien de téléchargement', type: 'text', hint: 'Lien stable de l’APK, rempli par l’onglet « Publier une version ».' },
      { key: 'message', label: 'Message affiché', type: 'text' },
    ],
    blank: () => ({ plateforme: 'android', version_code_min: 11, version_nom_min: '1.0.9', url_telechargement: '', message: '' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.plateforme), search: r => `${r.plateforme} ${r.version_nom_min || ''}`.toLowerCase(),
    valid: f => typeof f.version_code_min === 'number' && f.version_code_min >= 1,
    save: (f, e) => {
      const valeurs = {
        version_code_min: f.version_code_min,
        version_nom_min: f.version_nom_min || null,
        url_telechargement: f.url_telechargement || null,
        message: f.message || null,
        updated_at: new Date().toISOString(),
      }
      return e
        ? supabase.from('version_app').update(valeurs).eq('plateforme', f.plateforme)
        : supabase.from('version_app').insert({ plateforme: f.plateforme || 'android', ...valeurs })
    },
    del: async () => ({ error: new Error('Ce paramètre ne se supprime pas : modifiez sa valeur.') }),
  },
  {
    // Lecture seule : version déclarée par l'app au lancement (version_installee).
    id: 'version_installee', section: 'app', label: 'Versions installées', table: 'version_installee',
    select: 'user_id, plateforme, version_code, version_nom, vu_le, profil:user_id(nom, email, role)', order: q => q.order('vu_le', { ascending: false }), noDelete: true, lectureSeule: true,
    columns: [
      { label: 'Utilisateur', cell: r => r.profil?.nom || r.profil?.email || r.user_id },
      { label: 'Rôle', cell: r => r.profil?.role, kind: 'badge' },
      { label: 'Version', cell: r => `${r.version_nom || '?'} (code ${r.version_code})`, kind: 'mono' },
      { label: 'Dernière ouverture', cell: r => r.vu_le ? new Date(r.vu_le).toLocaleString('fr-FR') : '—', muted: true },
    ],
    fields: [],
    blank: () => ({}),
    fill: r => ({ ...r }),
    rowKey: r => String(r.user_id), search: r => `${r.profil?.nom || ''} ${r.profil?.email || ''} ${r.version_nom || ''}`.toLowerCase(),
    valid: () => false,
    save: async () => ({ error: new Error('Déclarée automatiquement par l’application.') }),
    del: async () => ({ error: new Error('Déclarée automatiquement par l’application.') }),
  },
  {
    id: 'segment_grade_type_pdv', section: 'pdv', label: 'Segment / Grade', table: 'segment_grade_type_pdv',
    select: 'type_pdv_id, segment, grade',
    columns: [
      { label: 'Type PDV', cell: r => typePdvNameOf(r.type_pdv_id) },
      { label: 'Segment (dispo)', cell: r => r.segment, align: 'c', kind: 'badge' },
      { label: 'Grade', cell: r => r.grade, align: 'c', kind: 'badge' },
    ],
    fields: [
      { key: 'type_pdv_id', label: 'Type PDV', type: 'select', opts: typePdvOpts, required: true, lockEdit: true },
      { key: 'segment', label: 'Segment (disponibilité)', type: 'select', opts: () => DISPO_SEGMENTS, required: true },
      { key: 'grade', label: 'Grade', type: 'select', opts: () => GRADES, required: true },
    ],
    blank: () => ({ type_pdv_id: null, segment: 'Boutique', grade: 'A' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.type_pdv_id), search: r => `${typePdvNameOf(r.type_pdv_id)} ${r.segment} ${r.grade}`.toLowerCase(),
    valid: f => !!f.type_pdv_id && !!f.segment && !!f.grade,
    save: (f, e) => e
      ? supabase.from('segment_grade_type_pdv').update({ segment: f.segment, grade: f.grade }).eq('type_pdv_id', f.type_pdv_id)
      : supabase.from('segment_grade_type_pdv').insert({ type_pdv_id: f.type_pdv_id, segment: f.segment, grade: f.grade }),
    del: r => supabase.from('segment_grade_type_pdv').delete().eq('type_pdv_id', r.type_pdv_id),
  },
  {
    id: 'segment_visibilite_type_pdv', section: 'pdv', label: 'Segment Visibilité', table: 'segment_visibilite_type_pdv',
    select: 'type_pdv_id, segment',
    columns: [
      { label: 'Type PDV', cell: r => typePdvNameOf(r.type_pdv_id) },
      { label: 'Segment (visibilité)', cell: r => r.segment, align: 'c', kind: 'badge' },
    ],
    fields: [
      { key: 'type_pdv_id', label: 'Type PDV', type: 'select', opts: typePdvOpts, required: true, lockEdit: true },
      { key: 'segment', label: 'Segment (visibilité)', type: 'select', opts: () => VISI_SEGMENTS, required: true },
    ],
    blank: () => ({ type_pdv_id: null, segment: 'boutique' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.type_pdv_id), search: r => `${typePdvNameOf(r.type_pdv_id)} ${r.segment}`.toLowerCase(),
    valid: f => !!f.type_pdv_id && !!f.segment,
    save: (f, e) => e
      ? supabase.from('segment_visibilite_type_pdv').update({ segment: f.segment }).eq('type_pdv_id', f.type_pdv_id)
      : supabase.from('segment_visibilite_type_pdv').insert({ type_pdv_id: f.type_pdv_id, segment: f.segment }),
    del: r => supabase.from('segment_visibilite_type_pdv').delete().eq('type_pdv_id', r.type_pdv_id),
  },
  // ===== PRODUITS =====
  {
    id: 'categorie_produit', section: 'produit', label: 'Catégories produit', table: 'categorie_produit',
    select: 'id, code, nom', order: q => q.order('code'),
    columns: [
      { label: 'Code', cell: r => r.code, kind: 'mono' },
      { label: 'Nom', cell: r => r.nom },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'nom', label: 'Nom', type: 'text', required: true },
    ],
    blank: () => ({ code: '', nom: '' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.code} ${r.nom}`.toLowerCase(),
    valid: f => !!f.code && !!f.nom,
    save: (f, e) => e
      ? supabase.from('categorie_produit').update({ code: f.code, nom: f.nom }).eq('id', f.id)
      : supabase.from('categorie_produit').insert({ code: f.code, nom: f.nom }),
    del: r => supabase.from('categorie_produit').delete().eq('id', r.id),
  },
  {
    id: 'reference_produit', section: 'produit', label: 'Références', table: 'reference_produit',
    select: 'id, nom, categorie_produit_id, role', order: q => q.order('nom'),
    columns: [
      { label: 'Référence', cell: r => r.nom },
      { label: 'Catégorie', cell: r => catCodeOf(r.categorie_produit_id), align: 'c', kind: 'badge' },
      { label: 'Rôle', cell: r => r.role || '—', align: 'c', kind: 'badge', color: r => r.role === 'phare' ? 'amber' : 'gray' },
    ],
    fields: [
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'categorie_produit_id', label: 'Catégorie', type: 'select', opts: categorieProduitOpts, required: true },
      { key: 'role', label: 'Rôle', type: 'select', opts: () => ROLES, required: true },
    ],
    blank: () => ({ nom: '', categorie_produit_id: null, role: 'soutien' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.nom} ${r.role}`.toLowerCase(),
    valid: f => !!f.nom && !!f.categorie_produit_id && !!f.role,
    save: (f, e) => e
      ? supabase.from('reference_produit').update({ nom: f.nom, categorie_produit_id: f.categorie_produit_id, role: f.role }).eq('id', f.id)
      : supabase.from('reference_produit').insert({ nom: f.nom, categorie_produit_id: f.categorie_produit_id, role: f.role }),
    del: r => supabase.from('reference_produit').delete().eq('id', r.id),
  },
  {
    id: 'correspondance_reference', section: 'produit', label: 'Correspondance SKU', table: 'correspondance_reference',
    select: 'reference_produit_id, categorie_jsonb, sku_key',
    columns: [
      { label: 'Référence', cell: r => refNameOf(r.reference_produit_id) },
      { label: 'Catégorie JSONB', cell: r => r.categorie_jsonb, align: 'c', kind: 'badge' },
      { label: 'Clé SKU', cell: r => r.sku_key, kind: 'mono' },
    ],
    fields: [
      { key: 'reference_produit_id', label: 'Référence', type: 'select', opts: referenceOpts, required: true, lockEdit: true },
      { key: 'categorie_jsonb', label: 'Catégorie JSONB', type: 'select', opts: () => JSONB_CATS, required: true },
      { key: 'sku_key', label: 'Clé SKU (JSONB)', type: 'text', required: true, hint: 'ex. br_gold' },
    ],
    blank: () => ({ reference_produit_id: null, categorie_jsonb: 'evap', sku_key: '' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.reference_produit_id), search: r => `${refNameOf(r.reference_produit_id)} ${r.sku_key}`.toLowerCase(),
    valid: f => !!f.reference_produit_id && !!f.categorie_jsonb && !!f.sku_key,
    save: (f, e) => e
      ? supabase.from('correspondance_reference').update({ categorie_jsonb: f.categorie_jsonb, sku_key: f.sku_key }).eq('reference_produit_id', f.reference_produit_id)
      : supabase.from('correspondance_reference').insert({ reference_produit_id: f.reference_produit_id, categorie_jsonb: f.categorie_jsonb, sku_key: f.sku_key }),
    del: r => supabase.from('correspondance_reference').delete().eq('reference_produit_id', r.reference_produit_id),
  },
  {
    id: 'marque_concurrente', section: 'produit', label: 'Marques concurrentes', table: 'marque_concurrente',
    select: 'id, famille, code, nom, actif, ordre', order: q => q.order('famille').order('ordre').order('nom'),
    columns: [
      { label: 'Famille', cell: r => r.famille?.toUpperCase(), align: 'c', kind: 'badge' },
      { label: 'Marque', cell: r => r.nom },
      { label: 'Clé JSONB', cell: r => r.code, kind: 'mono', muted: true },
      { label: 'Ordre', cell: r => r.ordre, align: 'c', kind: 'num' },
      { label: 'Actif', cell: r => r.actif, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'famille', label: 'Famille', type: 'select', opts: () => FAMILLES_CONCURRENCE.map(f => ({ value: f.key, label: f.key.toUpperCase() })), required: true, lockEdit: true },
      { key: 'nom', label: 'Nom de la marque', type: 'text', required: true, hint: 'ex. Cowmilk — apparaît tel quel dans le formulaire mobile' },
      { key: 'ordre', label: 'Ordre d\'affichage', type: 'num', min: 0 },
      { key: 'actif', label: 'Actif', type: 'bool' },
    ],
    blank: () => ({ famille: 'evap', nom: '', ordre: 0, actif: true }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.famille} ${r.nom} ${r.code}`.toLowerCase(),
    valid: f => !!f.famille && !!f.nom,
    // La clé JSONB est dérivée du nom à la création puis figée : en changer
    // orphelinerait les statuts déjà relevés sous l'ancienne clé.
    save: (f, e) => e
      ? supabase.from('marque_concurrente').update({ nom: f.nom, ordre: f.ordre ?? 0, actif: !!f.actif }).eq('id', f.id)
      : supabase.from('marque_concurrente').insert({ famille: f.famille, code: normaliserNomConcurrent(f.nom), nom: f.nom, ordre: f.ordre ?? 0, actif: f.actif !== false }),
    del: r => supabase.from('marque_concurrente').delete().eq('id', r.id),
  },
  {
    id: 'marque_concurrente_sku', section: 'produit', label: 'SKU concurrents', table: 'marque_concurrente_sku',
    select: 'id, marque_id, code, libelle, grammage_g, format, colisage, image_url, actif, ordre', order: q => q.order('ordre').order('libelle'),
    columns: [
      { label: 'Marque', cell: r => marqueNomOf(r.marque_id) },
      { label: 'SKU', cell: r => r.libelle },
      { label: 'Grammage', cell: r => r.grammage_g ? `${r.grammage_g} g` : '—', align: 'c', kind: 'num' },
      { label: 'Format', cell: r => r.format || '—', muted: true },
      { label: 'Colisage', cell: r => r.colisage ?? '—', align: 'c', kind: 'num' },
      { label: 'Clé JSONB', cell: r => r.code, kind: 'mono', muted: true },
      { label: 'Photo', cell: r => !!r.image_url, align: 'c', kind: 'bool' },
      { label: 'Actif', cell: r => r.actif, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'marque_id', label: 'Marque', type: 'select', opts: marqueConcurrenteOpts, required: true, lockEdit: true },
      { key: 'libelle', label: 'Libellé', type: 'text', required: true, hint: 'ex. Nido 400g — affiché tel quel dans le formulaire mobile' },
      { key: 'grammage_g', label: 'Grammage (g)', type: 'num', min: 0 },
      { key: 'format', label: 'Format', type: 'text', hint: 'Sachet, Pouch, Boîte…' },
      { key: 'colisage', label: 'Colisage', type: 'num', min: 0 },
      { key: 'image_url', label: 'URL photo', type: 'text', hint: 'Lien public (bucket visite-images). Vide tant que le client n\'a pas fourni le visuel.' },
      { key: 'ordre', label: 'Ordre d\'affichage', type: 'num', min: 0 },
      { key: 'actif', label: 'Actif', type: 'bool' },
    ],
    blank: () => ({ marque_id: null, libelle: '', grammage_g: null, format: '', colisage: null, image_url: '', ordre: 0, actif: true }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${marqueNomOf(r.marque_id)} ${r.libelle} ${r.code}`.toLowerCase(),
    valid: f => !!f.marque_id && !!f.libelle,
    // Clé JSONB = <code marque>_<grammage>g (ou libellé normalisé), figée à la
    // création. Pas de suppression : un SKU déjà relevé se désactive.
    save: (f, e) => {
      const rec = {
        libelle: f.libelle,
        grammage_g: f.grammage_g ?? null,
        format: f.format || null,
        colisage: f.colisage ?? null,
        image_url: f.image_url || null,
        ordre: f.ordre ?? 0,
        actif: f.actif !== false,
      }
      if (e) return supabase.from('marque_concurrente_sku').update(rec).eq('id', f.id)
      const base = marqueCodeOf(f.marque_id) || normaliserNomConcurrent(f.libelle)
      const code = f.grammage_g ? `${base}_${f.grammage_g}g` : `${base}_${normaliserNomConcurrent(f.libelle)}`
      return supabase.from('marque_concurrente_sku').insert({ ...rec, marque_id: f.marque_id, code })
    },
    del: async () => ({ error: new Error('Suppression désactivée : désactivez le SKU.') }),
    noDelete: true,
  },
  {
    id: 'categorie_releve', section: 'produit', label: 'Catégories du relevé', table: 'categorie_releve',
    select: 'code, libelle, actif, ordre', order: q => q.order('ordre'),
    columns: [
      { label: 'Code', cell: r => r.code, kind: 'mono' },
      { label: 'Catégorie', cell: r => r.libelle },
      { label: 'Ordre', cell: r => r.ordre, align: 'c', kind: 'num' },
      { label: 'Active', cell: r => r.actif, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true, lockEdit: true },
      { key: 'libelle', label: 'Libellé', type: 'text', required: true },
      { key: 'ordre', label: 'Ordre', type: 'num', min: 0 },
      { key: 'actif', label: 'Active', type: 'bool', hint: 'Décochée : la catégorie disparaît du formulaire mobile et des onglets admin. Les visites déjà saisies sont conservées.' },
    ],
    blank: () => ({ code: '', libelle: '', ordre: 0, actif: true }),
    fill: r => ({ ...r }),
    rowKey: r => r.code, search: r => `${r.code} ${r.libelle}`.toLowerCase(),
    valid: f => !!f.code && !!f.libelle,
    // Le code est structurel dans visites.data.produits.<code> : pas de création
    // libre ni de suppression, seulement activation et ordre.
    save: (f, e) => e
      ? supabase.from('categorie_releve').update({ libelle: f.libelle, ordre: f.ordre ?? 0, actif: !!f.actif }).eq('code', f.code)
      : supabase.from('categorie_releve').insert({ code: f.code, libelle: f.libelle, ordre: f.ordre ?? 0, actif: f.actif !== false }),
    del: async () => ({ error: new Error('Suppression désactivée : désactivez la catégorie.') }),
    noDelete: true,
  },
  // ===== DISTRIBUTION : SSF et sous-zones =====
  {
    id: 'ssf', section: 'distrib', label: 'SSF (vendeurs)', table: 'ssf',
    select: 'id, nom, nom_brut, telephone, distributeur_id, actif, a_confirmer, source, commentaire', order: q => q.order('nom'),
    noDelete: true,
    aide: 'SSF : vendeur du distributeur qui accompagne le merchandiser. Sa sous-zone (onglet SSF ↔ Quartiers) borne les PDV des tournées des jours où il accompagne l’agent (Routing › Règles).',
    columns: [
      { label: 'SSF', cell: r => r.nom },
      { label: 'Distributeur', cell: r => (r.distributeur_id ? distributeurNameOf(r.distributeur_id) : '—'), muted: true },
      { label: 'Téléphone', cell: r => r.telephone, kind: 'mono' },
      { label: 'Quartiers', cell: r => ssfQuartierCountOf(r.id), align: 'c', kind: 'num' },
      { label: 'À confirmer', cell: r => r.a_confirmer, align: 'c', kind: 'bool' },
      { label: 'Actif', cell: r => r.actif, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'distributeur_id', label: 'Distributeur', type: 'select', opts: distributeurIdOpts },
      { key: 'telephone', label: 'Téléphone', type: 'text' },
      { key: 'nom_brut', label: 'Autres orthographes', type: 'text', hint: 'Variantes vues dans les fichiers, séparées par « | » (ex. Tra bi ta Arsène|TRA BI TA).' },
      { key: 'actif', label: 'Actif', type: 'bool', hint: 'Désactivé : n’est plus proposé dans l’app ni dans les règles. Les visites gardent leur SSF.' },
      { key: 'a_confirmer', label: 'Distributeur à confirmer', type: 'bool', hint: 'Rattachement déduit d’un export, à confirmer par le client.' },
      { key: 'commentaire', label: 'Commentaire', type: 'text' },
    ],
    blank: () => ({ nom: '', distributeur_id: null, telephone: '', nom_brut: '', actif: true, a_confirmer: false, commentaire: '' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id),
    search: r => `${r.nom} ${r.nom_brut || ''} ${r.distributeur_id ? distributeurNameOf(r.distributeur_id) : ''}`.toLowerCase(),
    valid: f => !!String(f.nom || '').trim(),
    save: (f, e) => {
      const rec = {
        nom: String(f.nom).trim(),
        distributeur_id: f.distributeur_id || null,
        telephone: f.telephone || null,
        nom_brut: f.nom_brut || null,
        actif: f.actif !== false,
        a_confirmer: !!f.a_confirmer,
        commentaire: f.commentaire || null,
        updated_at: new Date().toISOString(),
      }
      return e
        ? table('ssf').update(rec).eq('id', f.id)
        : table('ssf').insert({ ...rec, source: 'admin' })
    },
    del: async () => ({ error: new Error('Suppression désactivée : désactivez le SSF (ses visites gardent son nom).') }),
  },
  {
    id: 'ssf_quartier', section: 'distrib', label: 'SSF ↔ Quartiers', table: 'ssf_quartier',
    select: 'id, ssf_id, zone, quartier, source, a_confirmer', order: q => q.order('ssf_id').order('zone').order('quartier'),
    aide: 'Sous-zone d’un SSF : ses quartiers. « Dérivée des visites » = proposée d’après les visites passées, à confirmer ; une ligne modifiée ici devient une saisie admin et n’est plus recalculée par les imports.',
    columns: [
      { label: 'SSF', cell: r => ssfNomOf(r.ssf_id) },
      { label: 'Zone', cell: r => r.zone, muted: true },
      { label: 'Quartier', cell: r => r.quartier },
      { label: 'Origine', cell: r => origineSousZone(r.source).label, kind: 'badge', color: r => origineSousZone(r.source).color },
      { label: 'À confirmer', cell: r => r.a_confirmer, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'ssf_id', label: 'SSF', type: 'select', opts: ssfOpts, required: true },
      { key: 'zq', label: 'Zone › quartier', type: 'select', opts: quartierPdvOpts, required: true, hint: 'Libellés exacts des PDV ; entre parenthèses, le nombre de PDV actifs du quartier.' },
      { key: 'a_confirmer', label: 'À confirmer', type: 'bool' },
    ],
    blank: () => ({ ssf_id: null, zq: null, a_confirmer: false }),
    fill: r => ({ ...r, zq: `${r.zone}|${r.quartier}` }),
    rowKey: r => String(r.id), search: r => `${ssfNomOf(r.ssf_id)} ${r.zone} ${r.quartier}`.toLowerCase(),
    valid: f => !!f.ssf_id && !!f.zq,
    save: (f, e) => {
      const [zone, quartier] = String(f.zq).split('|')
      const rec = { ssf_id: f.ssf_id, zone, quartier, a_confirmer: !!f.a_confirmer, source: 'admin' }
      return e
        ? table('ssf_quartier').update(rec).eq('id', f.id)
        : table('ssf_quartier').insert(rec)
    },
    del: r => table('ssf_quartier').delete().eq('id', r.id),
  },
  {
    id: 'alias_import', section: 'distrib', label: 'Alias d’import', table: 'alias_import',
    select: 'id, type, motif, mode, cible, commentaire', order: q => q.order('type').order('motif'),
    aide: 'Orthographes rencontrées dans les fichiers d’import (export Atom, DMS, fichier SSF) et leur correspondance dans le référentiel. Le texte est comparé en majuscules, sans accents ni ponctuation.',
    columns: [
      { label: 'Type', cell: r => r.type, kind: 'badge' },
      { label: 'Texte du fichier', cell: r => r.motif, kind: 'mono' },
      { label: 'Correspondance', cell: r => MODES_ALIAS.find(m => m.value === r.mode)?.label || r.mode, muted: true },
      { label: 'Cible', cell: r => r.cible },
      { label: 'Commentaire', cell: r => r.commentaire || '—', muted: true },
    ],
    fields: [
      { key: 'type', label: 'Type', type: 'select', opts: () => TYPES_ALIAS, required: true },
      { key: 'motif', label: 'Texte du fichier', type: 'text', required: true, hint: 'Ex. DEHO WILFRIED, BOUSSOURA, NIARE…' },
      { key: 'mode', label: 'Correspondance', type: 'select', opts: () => MODES_ALIAS, required: true },
      { key: 'cible', label: 'Cible', type: 'text', required: true, hint: 'Merchandiser : e-mail du compte. Distributeur : nom exact du référentiel. SSF : nom exact du SSF.' },
      { key: 'commentaire', label: 'Commentaire', type: 'text' },
    ],
    blank: () => ({ type: 'merchandiser', motif: '', mode: 'exact', cible: '', commentaire: '' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.type} ${r.motif} ${r.cible}`.toLowerCase(),
    valid: f => !!f.type && !!normaliser(f.motif) && !!String(f.cible || '').trim() && !!f.mode,
    save: (f, e) => {
      const rec = { type: f.type, motif: normaliser(f.motif), mode: f.mode, cible: String(f.cible).trim(), commentaire: f.commentaire || null }
      return e ? table('alias_import').update(rec).eq('id', f.id) : table('alias_import').insert(rec)
    },
    del: r => table('alias_import').delete().eq('id', r.id),
  },
  // ===== PERFECT STORE =====
  {
    id: 'niveau_perfect_store', section: 'ps', label: 'Niveaux Perfect Store', table: 'niveau_perfect_store',
    select: 'code, rang, dispo_rayon_min, visibilite_min, promotion_min', order: q => q.order('rang', { ascending: false }),
    columns: [
      { label: 'Niveau', cell: r => r.code },
      { label: 'Rang', cell: r => r.rang, align: 'c', kind: 'num' },
      { label: 'Dispo min %', cell: r => r.dispo_rayon_min ?? '—', align: 'c', kind: 'num' },
      { label: 'Visi min %', cell: r => r.visibilite_min ?? '—', align: 'c', kind: 'num' },
      { label: 'Promo min %', cell: r => r.promotion_min ?? '—', align: 'c', kind: 'num' },
    ],
    fields: [
      { key: 'code', label: 'Code niveau', type: 'text', required: true, lockEdit: true },
      { key: 'rang', label: 'Rang (4=Flagship)', type: 'num', required: true, min: 1 },
      { key: 'dispo_rayon_min', label: 'Disponibilité min %', type: 'num', min: 0, max: 100 },
      { key: 'visibilite_min', label: 'Visibilité min %', type: 'num', min: 0, max: 100 },
      { key: 'promotion_min', label: 'Promotion min %', type: 'num', min: 0, max: 100 },
    ],
    blank: () => ({ code: '', rang: 1, dispo_rayon_min: null, visibilite_min: 100, promotion_min: 100 }),
    fill: r => ({ ...r }),
    rowKey: r => r.code, search: r => r.code.toLowerCase(),
    valid: f => !!f.code && typeof f.rang === 'number',
    save: (f, e) => {
      const rec = { rang: f.rang, dispo_rayon_min: f.dispo_rayon_min ?? null, visibilite_min: f.visibilite_min ?? null, promotion_min: f.promotion_min ?? null }
      return e
        ? supabase.from('niveau_perfect_store').update(rec).eq('code', f.code)
        : supabase.from('niveau_perfect_store').insert({ code: f.code, ...rec })
    },
    del: r => supabase.from('niveau_perfect_store').delete().eq('code', r.code),
  },
  {
    id: 'poids_reference', section: 'ps', label: 'Poids SKU', table: 'poids_reference',
    select: 'reference_produit_id, canal, base_calcul, poids',
    columns: [
      { label: 'Référence', cell: r => refNameOf(r.reference_produit_id) },
      { label: 'Catégorie', cell: r => catCodeOf(maps.reference_produit?.get(r.reference_produit_id)?.categorie_produit_id), align: 'c', kind: 'badge' },
      { label: 'Canal', cell: r => r.canal, align: 'c', kind: 'badge', color: r => tierColor(r.canal) },
      { label: 'Base', cell: r => r.base_calcul === 'taux_revu' ? 'Taux revu' : 'Taux vente', align: 'c', muted: true },
      { label: 'Poids', cell: r => `${(Number(r.poids) * 100).toFixed(1)}%`, align: 'c', kind: 'num' },
    ],
    fields: [
      { key: 'reference_produit_id', label: 'Référence', type: 'select', opts: referenceOpts, required: true, lockEdit: true },
      { key: 'canal', label: 'Canal', type: 'select', opts: () => CANAUX, required: true, lockEdit: true },
      { key: 'base_calcul', label: 'Base de calcul', type: 'select', opts: () => BASES, required: true, lockEdit: true },
      { key: 'poids', label: 'Poids (0 à 1)', type: 'num', required: true, step: 0.0001, min: 0, max: 1 },
    ],
    blank: () => ({ reference_produit_id: null, canal: 'GT', base_calcul: 'taux_vente', poids: 0 }),
    fill: r => ({ ...r }),
    rowKey: r => `${r.reference_produit_id}|${r.canal}|${r.base_calcul}`,
    search: r => `${refNameOf(r.reference_produit_id)} ${r.canal}`.toLowerCase(),
    valid: f => !!f.reference_produit_id && !!f.canal && !!f.base_calcul && typeof f.poids === 'number' && f.poids >= 0 && f.poids <= 1,
    save: (f, e) => e
      ? supabase.from('poids_reference').update({ poids: f.poids }).eq('reference_produit_id', f.reference_produit_id).eq('canal', f.canal).eq('base_calcul', f.base_calcul)
      : supabase.from('poids_reference').insert({ reference_produit_id: f.reference_produit_id, canal: f.canal, base_calcul: f.base_calcul, poids: f.poids }),
    del: r => supabase.from('poids_reference').delete().eq('reference_produit_id', r.reference_produit_id).eq('canal', r.canal).eq('base_calcul', r.base_calcul),
  },
  {
    id: 'seuil_disponibilite', section: 'ps', label: 'Seuils dispo', table: 'seuil_disponibilite',
    select: 'reference_produit_id, segment, grade, quantite_min',
    columns: [
      { label: 'Référence', cell: r => refNameOf(r.reference_produit_id) },
      { label: 'Segment', cell: r => r.segment, kind: 'badge' },
      { label: 'Grade', cell: r => r.grade, align: 'c', kind: 'badge' },
      { label: 'Qté min', cell: r => r.quantite_min, align: 'c', kind: 'num' },
    ],
    fields: [
      { key: 'reference_produit_id', label: 'Référence', type: 'select', opts: referenceOpts, required: true, lockEdit: true },
      { key: 'segment', label: 'Segment (disponibilité)', type: 'select', opts: () => DISPO_SEGMENTS, required: true, lockEdit: true },
      { key: 'grade', label: 'Grade', type: 'select', opts: () => GRADES, required: true, lockEdit: true },
      { key: 'quantite_min', label: 'Quantité minimale', type: 'num', required: true, min: 0 },
    ],
    blank: () => ({ reference_produit_id: null, segment: 'Boutique', grade: 'A', quantite_min: 0 }),
    fill: r => ({ ...r }),
    rowKey: r => `${r.reference_produit_id}|${r.segment}|${r.grade}`,
    search: r => `${refNameOf(r.reference_produit_id)} ${r.segment} ${r.grade}`.toLowerCase(),
    valid: f => !!f.reference_produit_id && !!f.segment && !!f.grade && typeof f.quantite_min === 'number' && f.quantite_min >= 0,
    save: (f, e) => e
      ? supabase.from('seuil_disponibilite').update({ quantite_min: f.quantite_min }).eq('reference_produit_id', f.reference_produit_id).eq('segment', f.segment).eq('grade', f.grade)
      : supabase.from('seuil_disponibilite').insert({ reference_produit_id: f.reference_produit_id, segment: f.segment, grade: f.grade, quantite_min: f.quantite_min }),
    del: r => supabase.from('seuil_disponibilite').delete().eq('reference_produit_id', r.reference_produit_id).eq('segment', r.segment).eq('grade', r.grade),
  },
  {
    id: 'seuil_disponibilite_mt', section: 'ps', label: 'Seuils dispo MT (facings)', table: 'seuil_disponibilite_mt',
    select: 'reference_produit_id, segment_mt, quantite_min, facings',
    columns: [
      { label: 'Référence', cell: r => refNameOf(r.reference_produit_id) },
      { label: 'Format MT', cell: r => r.segment_mt, kind: 'badge' },
      { label: 'Qté min', cell: r => r.quantite_min, align: 'c', kind: 'num' },
      { label: 'Facings min', cell: r => r.facings, align: 'c', kind: 'num' },
    ],
    fields: [
      { key: 'reference_produit_id', label: 'Référence', type: 'select', opts: referenceOpts, required: true, lockEdit: true },
      { key: 'segment_mt', label: 'Format supermarché', type: 'select', opts: () => MT_SEGMENTS, required: true, lockEdit: true, hint: 'Hypermarche = Hyper/Grand · MoyenSuper = Supermarket B · PetitSuper = Supermarket C' },
      { key: 'quantite_min', label: 'Quantité minimale', type: 'num', required: true, min: 0 },
      { key: 'facings', label: 'Facings minimum', type: 'num', required: true, min: 0 },
    ],
    blank: () => ({ reference_produit_id: null, segment_mt: 'Hypermarche', quantite_min: 0, facings: 0 }),
    fill: r => ({ ...r }),
    rowKey: r => `${r.reference_produit_id}|${r.segment_mt}`,
    search: r => `${refNameOf(r.reference_produit_id)} ${r.segment_mt}`.toLowerCase(),
    valid: f => !!f.reference_produit_id && !!f.segment_mt && typeof f.quantite_min === 'number' && f.quantite_min >= 0 && typeof f.facings === 'number' && f.facings >= 0,
    save: (f, e) => e
      ? supabase.from('seuil_disponibilite_mt').update({ quantite_min: f.quantite_min, facings: f.facings }).eq('reference_produit_id', f.reference_produit_id).eq('segment_mt', f.segment_mt)
      : supabase.from('seuil_disponibilite_mt').insert({ reference_produit_id: f.reference_produit_id, segment_mt: f.segment_mt, quantite_min: f.quantite_min, facings: f.facings }),
    del: r => supabase.from('seuil_disponibilite_mt').delete().eq('reference_produit_id', r.reference_produit_id).eq('segment_mt', r.segment_mt),
  },
  {
    id: 'standard_assortiment', section: 'ps', label: 'Assortiment', table: 'standard_assortiment',
    select: 'segment, grade, sku_cibles, min_sku_presents, heros_obligatoires',
    columns: [
      { label: 'Segment', cell: r => r.segment, kind: 'badge' },
      { label: 'Grade', cell: r => r.grade, align: 'c', kind: 'badge' },
      { label: 'SKU cibles', cell: r => r.sku_cibles, align: 'c', kind: 'num' },
      { label: 'Min SKU présents', cell: r => r.min_sku_presents, align: 'c', kind: 'num' },
      { label: 'Héros obligatoires', cell: r => r.heros_obligatoires, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'segment', label: 'Segment (disponibilité)', type: 'select', opts: () => DISPO_SEGMENTS, required: true, lockEdit: true },
      { key: 'grade', label: 'Grade', type: 'select', opts: () => GRADES, required: true, lockEdit: true },
      { key: 'sku_cibles', label: 'SKU cibles', type: 'num', required: true, min: 0 },
      { key: 'min_sku_presents', label: 'Min SKU présents', type: 'num', required: true, min: 0 },
      { key: 'heros_obligatoires', label: 'Héros obligatoires', type: 'bool' },
    ],
    blank: () => ({ segment: 'Boutique', grade: 'A', sku_cibles: 0, min_sku_presents: 0, heros_obligatoires: true }),
    fill: r => ({ ...r }),
    rowKey: r => `${r.segment}|${r.grade}`, search: r => `${r.segment} ${r.grade}`.toLowerCase(),
    valid: f => !!f.segment && !!f.grade && typeof f.sku_cibles === 'number' && typeof f.min_sku_presents === 'number',
    save: (f, e) => e
      ? supabase.from('standard_assortiment').update({ sku_cibles: f.sku_cibles, min_sku_presents: f.min_sku_presents, heros_obligatoires: !!f.heros_obligatoires }).eq('segment', f.segment).eq('grade', f.grade)
      : supabase.from('standard_assortiment').insert({ segment: f.segment, grade: f.grade, sku_cibles: f.sku_cibles, min_sku_presents: f.min_sku_presents, heros_obligatoires: !!f.heros_obligatoires }),
    del: r => supabase.from('standard_assortiment').delete().eq('segment', r.segment).eq('grade', r.grade),
  },
  {
    id: 'element_visibilite', section: 'ps', label: 'Éléments visibilité', table: 'element_visibilite',
    select: 'id, segment, code, nom, pilier, emplacement, optionnel', order: q => q.order('segment').order('id'),
    columns: [
      { label: 'Segment', cell: r => r.segment, kind: 'badge' },
      { label: 'Code', cell: r => r.code, kind: 'mono' },
      { label: 'Nom', cell: r => r.nom },
      { label: 'Pilier', cell: r => r.pilier, align: 'c', kind: 'badge', color: r => r.pilier === 'promotion' ? 'amber' : 'blue' },
      { label: 'Emplacement', cell: r => r.emplacement, align: 'c', muted: true },
      { label: 'Optionnel', cell: r => r.optionnel, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'segment', label: 'Segment (visibilité)', type: 'select', opts: () => VISI_SEGMENTS, required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'pilier', label: 'Pilier', type: 'select', opts: () => PILIERS, required: true },
      { key: 'emplacement', label: 'Emplacement', type: 'select', opts: () => EMPLACEMENTS, required: true },
      { key: 'optionnel', label: 'Optionnel', type: 'bool' },
    ],
    blank: () => ({ segment: 'boutique', code: '', nom: '', pilier: 'visibilite', emplacement: 'interieure', optionnel: false }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.segment} ${r.code} ${r.nom} ${r.pilier}`.toLowerCase(),
    valid: f => !!f.segment && !!f.code && !!f.nom && !!f.pilier && !!f.emplacement,
    save: (f, e) => {
      const rec = { segment: f.segment, code: f.code, nom: f.nom, pilier: f.pilier, emplacement: f.emplacement, optionnel: !!f.optionnel }
      return e
        ? supabase.from('element_visibilite').update(rec).eq('id', f.id)
        : supabase.from('element_visibilite').insert(rec)
    },
    del: r => supabase.from('element_visibilite').delete().eq('id', r.id),
  },
  {
    id: 'standard_visibilite', section: 'ps', label: 'Standards visibilité', table: 'standard_visibilite',
    select: 'segment, niveau_perfect_store, element_visibilite_id, requis',
    columns: [
      { label: 'Segment', cell: r => r.segment, kind: 'badge' },
      { label: 'Niveau', cell: r => r.niveau_perfect_store, align: 'c', kind: 'badge' },
      { label: 'Élément', cell: r => elementVisNameOf(r.element_visibilite_id) },
      { label: 'Requis', cell: r => r.requis, align: 'c', kind: 'bool' },
    ],
    fields: [
      { key: 'segment', label: 'Segment (visibilité)', type: 'select', opts: () => VISI_SEGMENTS, required: true, lockEdit: true },
      { key: 'niveau_perfect_store', label: 'Niveau', type: 'select', opts: () => NIVEAUX, required: true, lockEdit: true },
      { key: 'element_visibilite_id', label: 'Élément', type: 'select', opts: elementVisOpts, required: true, lockEdit: true },
      { key: 'requis', label: 'Requis', type: 'bool' },
    ],
    blank: () => ({ segment: 'boutique', niveau_perfect_store: 'flagship', element_visibilite_id: null, requis: true }),
    fill: r => ({ ...r }),
    rowKey: r => `${r.segment}|${r.niveau_perfect_store}|${r.element_visibilite_id}`,
    search: r => `${r.segment} ${r.niveau_perfect_store} ${elementVisNameOf(r.element_visibilite_id)}`.toLowerCase(),
    valid: f => !!f.segment && !!f.niveau_perfect_store && !!f.element_visibilite_id,
    save: (f, e) => e
      ? supabase.from('standard_visibilite').update({ requis: !!f.requis }).eq('segment', f.segment).eq('niveau_perfect_store', f.niveau_perfect_store).eq('element_visibilite_id', f.element_visibilite_id)
      : supabase.from('standard_visibilite').insert({ segment: f.segment, niveau_perfect_store: f.niveau_perfect_store, element_visibilite_id: f.element_visibilite_id, requis: !!f.requis }),
    del: r => supabase.from('standard_visibilite').delete().eq('segment', r.segment).eq('niveau_perfect_store', r.niveau_perfect_store).eq('element_visibilite_id', r.element_visibilite_id),
  },
]

const sections = [
  { key: 'geo', label: 'Géographie' },
  { key: 'distrib', label: 'Distribution' },
  { key: 'pdv', label: 'Points de vente' },
  { key: 'produit', label: 'Produits' },
  { key: 'ps', label: 'Perfect Store' },
  { key: 'app', label: 'Application mobile' },
]

const vues: Vue[] = [
  { id: 'quotas_atom', section: 'app', label: 'Quotas Atom', vue: true },
  { id: 'publier_version', section: 'app', label: 'Publier une version', vue: true },
  { id: 'maintenance', section: 'app', label: 'Maintenance', vue: true },
]

const section = ref('geo')
const activeId = ref(defs[0].id)
const search = ref('')
const showModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const form = ref<any>({})

const sectionEntrees = computed<(Def | Vue)[]>(() => [...defs, ...vues].filter(d => d.section === section.value))
const activeVue = computed(() => vues.find(v => v.id === activeId.value) || null)
const activeDef = computed(() => defs.find(d => d.id === activeId.value) || defs[0])

function selectSection(key: string) {
  section.value = key
  const first = [...defs, ...vues].find(d => d.section === key)
  if (first) activeId.value = first.id
  search.value = ''
}

// Lien direct vers un onglet : /admin/referentiels?onglet=ssf
const route = useRoute()
onMounted(() => {
  const onglet = String(route.query.onglet || '')
  const cible = [...defs, ...vues].find(d => d.id === onglet)
  if (cible) { section.value = cible.section; activeId.value = cible.id }
})

watch(activeId, () => { search.value = '' })

const filteredRows = computed(() => {
  const rows = store[activeId.value] || []
  const q = search.value.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(r => activeDef.value.search(r).includes(q))
})

const refPage = ref(1)
const refPerPage = 50
const paginatedRefRows = computed(() =>
  filteredRows.value.slice((refPage.value - 1) * refPerPage, refPage.value * refPerPage)
)
watch([activeId, search], () => { refPage.value = 1 })

// USelectMenu reçoit toujours option/value-attribute 'label'/'value' : les
// listes d'options en chaînes brutes (CANAUX, GRADES, …) doivent être
// normalisées en objets, sinon la sélection écrit `undefined` dans le form.
const fieldOpts = (f: Field) =>
  (f.opts ? f.opts() : []).map((o: any) =>
    typeof o === 'object' && o !== null ? o : { value: o, label: String(o) })

const canSave = computed(() => activeDef.value.valid(form.value))

function openCreate() {
  editing.value = false
  form.value = activeDef.value.blank()
  showModal.value = true
}

function rowActions(row: any) {
  const actions = [{ label: 'Modifier', icon: 'i-heroicons-pencil', click: () => openEdit(row) }]
  if (!activeDef.value.noDelete) actions.push({ label: 'Supprimer', icon: 'i-heroicons-trash', click: () => remove(row) })
  return [actions]
}

function openEdit(row: any) {
  editing.value = true
  form.value = activeDef.value.fill(row)
  showModal.value = true
}

async function save() {
  saving.value = true
  try {
    const { error: err } = await activeDef.value.save(form.value, editing.value)
    if (err) throw err
    toast.add({ title: 'Enregistré', color: 'green' })
    showModal.value = false
    await reload(activeDef.value)
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

async function remove(row: any) {
  // Nommer la ligne. Sur un retrait ciblé — les 17 seuils délistés de la V2,
  // au milieu de 125 lignes dont 42 SupermarcheMT à ne surtout pas toucher —
  // « Supprimer cet enregistrement ? » ne donnait aucun moyen de vérifier ce
  // qu'on s'apprête à supprimer.
  const quoi = activeDef.value.search(row)
  if (!confirm(`Supprimer définitivement :\n\n${quoi}\n\n(${activeDef.value.label})`)) return
  try {
    const { error: err } = await activeDef.value.del(row)
    if (err) throw err
    toast.add({ title: 'Supprimé', color: 'green' })
    await reload(activeDef.value)
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

async function reload(def: Def) {
  let query = supabase.from(def.table).select(def.select)
  if (def.order) query = def.order(query)
  const { data, error: err } = await query
  if (err) { toast.add({ title: 'Erreur de rechargement', description: err.message, color: 'red' }); return }
  store[def.id] = data || []
  rebuildMaps()
}

async function fetchAll() {
  loading.value = true
  error.value = null
  try {
    const results = await Promise.all(defs.map((d) => {
      let query = supabase.from(d.table).select(d.select)
      if (d.order) query = d.order(query)
      return query
    }))
    // Résilient : une table absente (ex. migration non exécutée) → tableau vide,
    // sans casser le chargement des autres référentiels.
    const missing: string[] = []
    defs.forEach((d, i) => {
      if (results[i].error) { store[d.id] = []; missing.push(d.label) }
      else store[d.id] = results[i].data || []
    })
    rebuildMaps()
    if (missing.length) error.value = `Table(s) non disponible(s) : ${missing.join(', ')} (migration à exécuter).`
  }
  catch (err: any) {
    error.value = err?.message || 'chargement impossible'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => { void fetchAll(); void chargerQuartiersPdv() })
</script>

<style scoped>
.th-l { @apply px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
.th-c { @apply px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
.row { @apply hover:bg-gray-50 dark:hover:bg-gray-700/50; }
</style>
