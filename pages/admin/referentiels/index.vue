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
      <UButton icon="i-heroicons-plus" class="bg-fc-blue" @click="openCreate">Ajouter — {{ activeDef.label }}</UButton>
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
          v-for="d in sectionDefs"
          :key="d.id"
          type="button"
          class="whitespace-nowrap border-b-2 pb-2.5 text-sm font-medium transition-colors"
          :class="activeId === d.id
            ? 'border-fc-red text-fc-red'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'"
          @click="activeId = d.id"
        >
          {{ d.label }} <span class="text-xs text-gray-400">({{ (store[d.id] || []).length }})</span>
        </button>
      </nav>
    </div>

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
          <tr v-for="row in filteredRows" :key="activeDef.rowKey(row)" class="row">
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
              <UDropdown :items="rowActions(row)">
                <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
              </UDropdown>
            </td>
          </tr>
          <tr v-if="!loading && !filteredRows.length">
            <td :colspan="activeDef.columns.length + 1" class="px-4 py-10 text-center text-sm text-gray-400">Aucune donnée.</td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="p-8 text-center">
        <UIcon name="i-heroicons-arrow-path" class="mx-auto h-8 w-8 animate-spin text-fc-blue" />
      </div>
    </div>

    <!-- CRUD Modal -->
    <AdminFormModal
      v-model="showModal"
      :title="`${editing ? 'Modifier' : 'Ajouter'} — ${activeDef.label}`"
      description="Renseignez les propriétés de cet élément de référentiel."
      icon="i-heroicons-circle-stack"
      width="sm:max-w-xl"
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
            :options="f.opts ? f.opts() : []"
            :option-attribute="f.opts ? 'label' : undefined"
            :value-attribute="f.opts ? 'value' : undefined"
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
          class="bg-fc-blue text-white hover:bg-fc-blue-600 focus-visible:outline-fc-blue-500 dark:bg-fc-blue dark:text-white dark:hover:bg-fc-blue-600 dark:focus-visible:outline-fc-blue-400"
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
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const toast = useToast()

// -- Enumérations métier (Système B) --------------------------------------
const CANAUX = ['GT', 'MT']
const BASES = [{ value: 'taux_vente', label: 'Taux vente' }, { value: 'taux_revu', label: 'Taux revu' }]
const GRADES = ['A', 'B', 'C']
const DISPO_SEGMENTS = ['Boutique', 'Minimarket', 'Kiosque', 'Aboki', 'Pushcart', 'TableTop', 'Porridge']
const VISI_SEGMENTS = ['boutique', 'superette', 'table_top', 'pushcart', 'porridge', 'kiosque_aboki']
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
  maps.distributeur_id = byKey('distributeur', 'id')
  maps.categorie_pdv = byKey('categorie_pdv', 'id')
  maps.type_pdv = byKey('type_pdv', 'id')
  maps.categorie_produit = byKey('categorie_produit', 'id')
  maps.reference_produit = byKey('reference_produit', 'id')
  maps.element_visibilite = byKey('element_visibilite', 'id')
}

// Option builders ----------------------------------------------------------
const opt = <T,>(rows: T[], value: (r: T) => any, label: (r: T) => string) =>
  rows.map(r => ({ value: value(r), label: label(r) }))
const regionOpts = () => opt(store.region || [], r => r.code, r => `${r.nom_affichage || r.nom} · ${r.code}`)
const sousRegionOpts = () => opt(store.sous_region || [], r => r.code, r => `${r.nom_affichage || r.nom} · ${r.code}`)
const territoireOpts = () => opt(store.territoire || [], r => r.code, r => `${r.nom} · ${r.code}`)
const territoireIdOpts = () => opt(store.territoire || [], r => r.id, r => `${r.nom} · ${r.code}`)
const distributeurIdOpts = () => opt(store.distributeur || [], r => r.id, r => r.nom)
const categoriePdvOpts = () => opt(store.categorie_pdv || [], r => r.id, r => `${r.nom}${r.canal ? ' · ' + r.canal : ''}`)
const typePdvOpts = () => opt(store.type_pdv || [], r => r.id, r => r.nom)
const categorieProduitOpts = () => opt(store.categorie_produit || [], r => r.id, r => `${r.nom} (${r.code})`)
const referenceOpts = () => opt(store.reference_produit || [], r => r.id, r => `${r.nom} · ${catCodeOf(r.categorie_produit_id)}`)
const elementVisOpts = () => opt(store.element_visibilite || [], r => r.id, r => `${r.nom} · ${r.segment} · ${r.pilier}`)

const catCodeOf = (id: number) => maps.categorie_produit?.get(id)?.code || '—'
const refNameOf = (id: number) => maps.reference_produit?.get(id)?.nom || `#${id}`
const typePdvNameOf = (id: number) => maps.type_pdv?.get(id)?.nom || `#${id}`
const territoireNameOf = (id: number) => maps.territoire_id?.get(id)?.nom || `#${id}`
const distributeurNameOf = (id: number) => maps.distributeur_id?.get(id)?.nom || `#${id}`
const elementVisNameOf = (id: number) => { const e = maps.element_visibilite?.get(id); return e ? `${e.nom} (${e.segment})` : `#${id}` }

const tierColor = (v: string) => v === 'MT' ? 'purple' : 'blue'

// -- Référentiel definitions ----------------------------------------------
interface Col { label: string; cell: (r: any) => any; align?: 'c'; kind?: 'badge' | 'bool' | 'mono' | 'num'; color?: (r: any) => string; muted?: boolean }
interface Field { key: string; label: string; type: 'text' | 'num' | 'select' | 'bool'; opts?: () => any[]; required?: boolean; lockEdit?: boolean; step?: number; min?: number; max?: number; hint?: string }
interface Def {
  id: string; section: string; label: string; table: string; select: string
  order?: (q: any) => any
  columns: Col[]
  fields: Field[]
  blank: () => any
  fill: (row: any) => any
  rowKey: (row: any) => string
  search: (row: any) => string
  save: (form: any, editing: boolean) => Promise<{ error: any }>
  del: (row: any) => Promise<{ error: any }>
  valid: (f: any) => boolean
}

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
    select: 'id, code, nom, territoire_code', order: q => q.order('territoire_code').order('nom'),
    columns: [
      { label: 'Code', cell: r => r.code || '—', kind: 'mono' },
      { label: 'Zone / Area', cell: r => r.nom },
      { label: 'Territoire', cell: r => maps.territoire_code?.get(r.territoire_code)?.nom || r.territoire_code, muted: true },
    ],
    fields: [
      { key: 'code', label: 'Code Area', type: 'text' },
      { key: 'nom', label: 'Nom de la zone', type: 'text', required: true },
      { key: 'territoire_code', label: 'Territoire', type: 'select', opts: territoireOpts, required: true },
    ],
    blank: () => ({ code: '', nom: '', territoire_code: '' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => `${r.code} ${r.nom} ${r.territoire_code}`.toLowerCase(),
    valid: f => !!f.nom && !!f.territoire_code,
    save: (f, e) => e
      ? supabase.from('zone').update({ code: f.code || null, nom: f.nom, territoire_code: f.territoire_code }).eq('id', f.id)
      : supabase.from('zone').insert({ code: f.code || null, nom: f.nom, territoire_code: f.territoire_code }),
    del: r => supabase.from('zone').delete().eq('id', r.id),
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
      { key: 'nom', label: 'Nom', type: 'text', required: true, lockEdit: true },
      { key: 'national', label: 'Couverture nationale', type: 'bool' },
    ],
    blank: () => ({ nom: '', national: false }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => r.nom.toLowerCase(),
    valid: f => !!f.nom,
    save: (f, e) => e
      ? supabase.from('distributeur').update({ national: !!f.national }).eq('id', f.id)
      : supabase.from('distributeur').insert({ nom: f.nom, national: !!f.national }),
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
  // ===== POINTS DE VENTE =====
  {
    id: 'categorie_pdv', section: 'pdv', label: 'Catégories PDV', table: 'categorie_pdv',
    select: 'id, nom, canal', order: q => q.order('nom'),
    columns: [
      { label: 'Catégorie (niveau 3)', cell: r => r.nom },
      { label: 'Canal', cell: r => r.canal || '—', align: 'c', kind: 'badge', color: r => tierColor(r.canal) },
    ],
    fields: [
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'canal', label: 'Canal', type: 'select', opts: () => CANAUX, required: true },
    ],
    blank: () => ({ nom: '', canal: 'GT' }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => r.nom.toLowerCase(),
    valid: f => !!f.nom && !!f.canal,
    save: (f, e) => e
      ? supabase.from('categorie_pdv').update({ nom: f.nom, canal: f.canal }).eq('id', f.id)
      : supabase.from('categorie_pdv').insert({ nom: f.nom, canal: f.canal }),
    del: r => supabase.from('categorie_pdv').delete().eq('id', r.id),
  },
  {
    id: 'type_pdv', section: 'pdv', label: 'Types PDV', table: 'type_pdv',
    select: 'id, nom, categorie_pdv_id', order: q => q.order('nom'),
    columns: [
      { label: 'Type (niveau 4)', cell: r => r.nom },
      { label: 'Catégorie (niveau 3)', cell: r => maps.categorie_pdv?.get(r.categorie_pdv_id)?.nom || '—', muted: true },
      { label: 'Canal', cell: r => maps.categorie_pdv?.get(r.categorie_pdv_id)?.canal || '—', align: 'c', kind: 'badge', color: r => tierColor(maps.categorie_pdv?.get(r.categorie_pdv_id)?.canal) },
    ],
    fields: [
      { key: 'nom', label: 'Type', type: 'text', required: true },
      { key: 'categorie_pdv_id', label: 'Catégorie', type: 'select', opts: categoriePdvOpts, required: true },
    ],
    blank: () => ({ nom: '', categorie_pdv_id: null }),
    fill: r => ({ ...r }),
    rowKey: r => String(r.id), search: r => r.nom.toLowerCase(),
    valid: f => !!f.nom && !!f.categorie_pdv_id,
    save: (f, e) => e
      ? supabase.from('type_pdv').update({ nom: f.nom, categorie_pdv_id: f.categorie_pdv_id }).eq('id', f.id)
      : supabase.from('type_pdv').insert({ nom: f.nom, categorie_pdv_id: f.categorie_pdv_id }),
    del: r => supabase.from('type_pdv').delete().eq('id', r.id),
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
]

const section = ref('geo')
const activeId = ref(defs[0].id)
const search = ref('')
const showModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const form = ref<any>({})

const sectionDefs = computed(() => defs.filter(d => d.section === section.value))
const activeDef = computed(() => defs.find(d => d.id === activeId.value) || defs[0])

function selectSection(key: string) {
  section.value = key
  const first = defs.find(d => d.section === key)
  if (first) activeId.value = first.id
  search.value = ''
}

watch(activeId, () => { search.value = '' })

const filteredRows = computed(() => {
  const rows = store[activeId.value] || []
  const q = search.value.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(r => activeDef.value.search(r).includes(q))
})

const canSave = computed(() => activeDef.value.valid(form.value))

function openCreate() {
  editing.value = false
  form.value = activeDef.value.blank()
  showModal.value = true
}

function rowActions(row: any) {
  return [[
    { label: 'Modifier', icon: 'i-heroicons-pencil', click: () => openEdit(row) },
    { label: 'Supprimer', icon: 'i-heroicons-trash', click: () => remove(row) },
  ]]
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
  if (!confirm('Supprimer cet enregistrement ?')) return
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

onMounted(fetchAll)
</script>

<style scoped>
.th-l { @apply px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
.th-c { @apply px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
.row { @apply hover:bg-gray-50 dark:hover:bg-gray-700/50; }
</style>
