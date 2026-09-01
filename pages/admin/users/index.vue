<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Utilisateurs"
      eyebrow="Paramètres"
    />

    <!-- Header -->
    <div class="admin-toolbar flex-col items-stretch sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <UInput
          v-model="searchQuery"
          placeholder="Rechercher..."
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="w-full sm:w-64"
        />
        <USelectMenu
          v-model="roleFilter"
          :options="['', 'admin', 'superviseur', 'merchandiser', 'commercial']"
          placeholder="Rôle"
          size="sm"
          class="w-full sm:w-40"
        />
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <UButton v-if="authStore.isAdmin" size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exportUsers">
          Exporter
        </UButton>
        <UButton v-if="authStore.isAdmin" size="sm" variant="outline" icon="i-heroicons-arrow-up-tray" @click="showImportModal = true">
          Importer CSV
        </UButton>
        <UButton v-if="authStore.isAdmin" size="sm" @click="openCreateUser" icon="i-heroicons-plus" class="bg-fc-blue">
          Nouvel utilisateur
        </UButton>
      </div>
    </div>

    <!-- Users Table -->
    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Utilisateur</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rôle</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Zone</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="user in paginatedUsers"
              :key="user.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    :class="getRoleBg(user.role)">
                    {{ user.nom?.substring(0, 2).toUpperCase() || '??' }}
                  </div>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ user.nom || '-' }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ user.email }}</td>
              <td class="px-4 py-3">
                <span
                  class="text-xs font-medium px-2.5 py-1 rounded-full"
                  :class="getRoleBadge(user.role)"
                >
                  {{ user.role }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ zoneLabel(user) }}</td>
              <td class="px-4 py-3 text-center">
                <span
                  class="w-2.5 h-2.5 rounded-full inline-block"
                  :class="user.is_active ? 'bg-emerald-500' : 'bg-gray-300'"
                />
              </td>
              <td class="px-4 py-3 text-center">
                <UDropdown v-if="authStore.isAdmin" :items="getUserActions(user)">
                  <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
                </UDropdown>
                <span v-else class="text-xs text-gray-400">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-gray-100 px-4 py-3 dark:border-gray-700">
        <AdminPagination
          :total="filteredUsers.length"
          :page="usersPage"
          :page-size="usersPerPage"
          item-label="utilisateur(s)"
          @update:page="(p) => usersPage = p"
        />
      </div>

      <div v-if="loading" class="p-8 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue mx-auto" />
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <AdminFormModal
      v-model="showCreate"
      :title="editingUser ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'"
      description="Configurez le compte, le rôle et le périmètre terrain de l’utilisateur."
      icon="i-heroicons-user-plus"
      width="sm:max-w-3xl"
      body-class="space-y-8"
      as-form
      required-note
      @submit="handleSaveUser"
    >
      <section aria-labelledby="user-account-title">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <UIcon name="i-heroicons-identification" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="user-account-title" class="text-sm font-semibold text-slate-900 dark:text-white">
              Compte et accès
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Informations de connexion et niveau d’autorisation.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <UFormGroup label="Nom complet" required size="md">
            <UInput v-model="userForm.nom" placeholder="Ex. Awa Koné" size="md" class="w-full" />
          </UFormGroup>
          <UFormGroup label="Email" required size="md">
            <UInput v-model="userForm.email" type="email" placeholder="nom@entreprise.com" size="md" class="w-full" />
          </UFormGroup>
          <UFormGroup v-if="!editingUser" label="Mot de passe" required help="8 caractères minimum." size="md">
            <UInput v-model="userForm.password" type="password" placeholder="Saisir un mot de passe" minlength="8" size="md" class="w-full" />
          </UFormGroup>
          <UFormGroup label="Rôle" size="md">
            <USelectMenu
              v-model="userForm.role"
              :options="['admin', 'superviseur', 'merchandiser', 'commercial']"
              size="md"
              class="w-full"
            />
          </UFormGroup>
          <UFormGroup label="Téléphone" size="md" class="sm:col-span-2">
            <UInput v-model="userForm.telephone" placeholder="Ex. +225 07 00 00 00 00" size="md" class="w-full" />
          </UFormGroup>
        </div>
      </section>

      <section aria-labelledby="user-scope-title" class="border-t border-slate-200 pt-7 dark:border-slate-700">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <UIcon name="i-heroicons-map" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="user-scope-title" class="text-sm font-semibold text-slate-900 dark:text-white">
              Périmètre terrain
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Définissez les territoires et les quartiers accessibles à l’utilisateur.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <UFormGroup label="Région" help="Filtre d’affichage — n’efface pas les territoires cochés." size="md">
            <USelectMenu
              v-model="userForm.region_code"
              :options="regionOptions"
              option-attribute="label"
              value-attribute="value"
              placeholder="Sélectionner une région"
              searchable
              searchable-placeholder="Rechercher..."
              size="md"
              class="w-full"
              @update:model-value="onRegionChange"
            />
          </UFormGroup>

          <UFormGroup label="Sous-région" help="Filtre d’affichage — n’efface pas les territoires cochés." size="md">
            <USelectMenu
              v-model="userForm.sub_region_code"
              :options="subRegionOptions"
              option-attribute="label"
              value-attribute="value"
              :disabled="!userForm.region_code"
              placeholder="Sélectionner une sous-région"
              searchable
              searchable-placeholder="Rechercher..."
              size="md"
              class="w-full"
            />
          </UFormGroup>

          <UFormGroup label="Territoires assignés" help="Cochez un ou plusieurs territoires, y compris dans plusieurs sous-régions : changer les filtres ci-dessus ne désélectionne rien." size="md" class="sm:col-span-2">
            <div
              v-if="!userForm.sub_region_code"
              class="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-400 dark:border-slate-600"
            >
              Sélectionnez d’abord une sous-région.
            </div>
            <div
              v-else-if="!territoryOptions.length"
              class="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-400 dark:border-slate-600"
            >
              Aucun territoire pour cette sous-région.
            </div>
            <div v-else>
              <div class="mb-2 flex items-center justify-end gap-3 text-xs">
                <button type="button" class="font-medium text-fc-blue hover:underline" @click="toggleAllVisibleTerritories(true)">
                  Tout cocher
                </button>
                <button type="button" class="font-medium text-slate-500 hover:underline dark:text-slate-400" @click="toggleAllVisibleTerritories(false)">
                  Tout décocher
                </button>
              </div>
              <div class="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
                <label
                  v-for="opt in territoryOptions"
                  :key="opt.value"
                  class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <UCheckbox
                    :model-value="userForm.territory_codes.includes(opt.value)"
                    @update:model-value="toggleTerritory(opt.value)"
                  />
                  <span class="text-slate-700 dark:text-slate-200">{{ opt.label }}</span>
                </label>
              </div>
            </div>
            <p v-if="userForm.territory_codes.length" class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="code in userForm.territory_codes"
                :key="code"
                class="inline-flex items-center gap-1 rounded-full bg-fc-blue/10 px-2.5 py-0.5 text-xs font-medium text-fc-blue"
              >
                {{ territoryChipLabel(code) }}
                <button type="button" class="hover:text-fc-red" @click="toggleTerritory(code)">
                  <UIcon name="i-heroicons-x-mark-20-solid" class="h-3.5 w-3.5" />
                </button>
              </span>
            </p>
            <p v-if="unmatchedTerritories.length" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Territoires hors référentiel, conservés tels quels : {{ unmatchedTerritories.join(', ') }}
            </p>
          </UFormGroup>

          <UFormGroup label="Quartiers assignés" help="Agrégés sur les territoires cochés. Laissez vide pour tout autoriser." size="md" class="sm:col-span-2">
            <div
              v-if="!userForm.territory_codes.length"
              class="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-400 dark:border-slate-600"
            >
              Cochez au moins un territoire pour lister ses quartiers.
            </div>
            <div
              v-else-if="!quartierOptions.length"
              class="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-400 dark:border-slate-600"
            >
              Aucun quartier référencé sur les territoires sélectionnés.
            </div>
            <div
              v-else
              class="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700"
            >
              <label
                v-for="q in quartierOptions"
                :key="q"
                class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <UCheckbox
                  :model-value="userForm.quartiers_assignes.includes(q)"
                  @update:model-value="toggleQuartier(q)"
                />
                <span class="text-slate-700 dark:text-slate-200">{{ q }}</span>
              </label>
            </div>
          </UFormGroup>
        </div>
      </section>

      <template #footer>
        <UButton type="button" color="gray" variant="ghost" @click="showCreate = false">
          Annuler
        </UButton>
        <UButton
          type="submit"
          icon="i-heroicons-check"
          class="bg-fc-blue text-white hover:bg-fc-blue-600 disabled:bg-fc-blue-300 aria-disabled:bg-fc-blue-300 focus-visible:outline-fc-blue-500 dark:bg-fc-blue dark:text-white dark:hover:bg-fc-blue-600 dark:disabled:bg-fc-blue-700 dark:aria-disabled:bg-fc-blue-700 dark:focus-visible:outline-fc-blue-400"
          :loading="saving"
        >
          {{ editingUser ? 'Mettre à jour' : 'Créer l’utilisateur' }}
        </UButton>
      </template>
    </AdminFormModal>

    <!-- Import CSV utilisateurs -->
    <UModal v-model="showImportModal">
      <div class="p-6 space-y-4">
        <div>
          <h3 class="text-lg font-semibold">Importer des utilisateurs (CSV)</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Mise à jour par email ; les emails inconnus créent un compte
            (colonne <code>mot_de_passe</code>, sinon mot de passe par défaut).
            Territoires et quartiers séparés par <code>|</code>, libellés préservés tels quels.
          </p>
          <UButton variant="link" size="xs" class="px-0" icon="i-heroicons-document-arrow-down" @click="downloadUsersTemplate">
            Télécharger le modèle
          </UButton>
        </div>

        <div>
          <input ref="importFileInput" type="file" accept=".csv" class="hidden" @change="handleImportFileSelect" />
          <UButton variant="outline" @click="($refs.importFileInput as HTMLInputElement)?.click()">
            Choisir un fichier CSV
          </UButton>
          <p v-if="importFile" class="text-sm text-gray-600 mt-2">{{ importFile.name }}</p>
        </div>

        <div v-if="importSummary" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div class="flex flex-wrap gap-3 text-sm">
            <span class="text-emerald-600 font-medium">{{ importSummary.created }} créé(s)</span>
            <span class="text-blue-600 font-medium">{{ importSummary.updated }} mis à jour</span>
            <span v-if="importSummary.errors.length" class="text-red-600 font-medium">{{ importSummary.errors.length }} erreur(s)</span>
          </div>
          <div v-if="importSummary.errors.length" class="max-h-40 overflow-y-auto space-y-1 border-t border-gray-200 dark:border-gray-600 pt-2">
            <p v-for="(e, i) in importSummary.errors" :key="i" class="text-xs text-red-600">
              ⚠ Ligne {{ e.line }}<template v-if="e.email"> ({{ e.email }})</template> : {{ e.message }}
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t">
          <UButton variant="ghost" @click="closeImportModal">Fermer</UButton>
          <UButton class="bg-fc-blue hover:bg-fc-blue-600 text-white" :disabled="!importFile" :loading="importing" @click="importUsers">
            Importer
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Profile, UserRole } from '~/types'

definePageMeta({
  middleware: ['auth', 'admin', 'admin-strict'],
  layout: 'admin',
})

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const toast = useToast()

const users = ref<Profile[]>([])
const loading = ref(false)
const searchQuery = ref('')
const roleFilter = ref('')
const showCreate = ref(false)
const editingUser = ref<Profile | null>(null)
const saving = ref(false)

const userForm = ref({
  nom: '',
  email: '',
  password: '',
  role: 'merchandiser' as UserRole,
  zone_assignee: '',
  region: '',
  territoires_assignes: [] as string[],
  quartiers_assignes: [] as string[],
  telephone: '',
  // Cascade géo (UI) — non stockées telles quelles ; on dérive zone_assignee/region au save.
  region_code: '',
  sub_region_code: '',
  territory_codes: [] as string[],
})

// Cascade géo Division → Sous-région → Territoire → Quartiers, alignée sur la
// hiérarchie référentiel. Scoping pdv : pdv.zone = territoire.nom,
// pdv.quartier = quartier.nom, pdv.region = sous_region.nom_affichage.
const { regions, subRegions, territories, areas, quartiers, fetchReferentiels } = useReferentiels()
const regionOptions = computed(() => regions.value.map(r => ({ value: r.code, label: r.nom_affichage ? `${r.nom_affichage} · ${r.name}` : r.name })))
const subRegionOptions = computed(() => subRegions.value
  .filter(s => s.region_code === userForm.value.region_code)
  .map(s => ({ value: s.code, label: s.nom_affichage ? `${s.nom_affichage} · ${s.name}` : s.name })))
const territoryOptions = computed(() => territories.value
  .filter(t => t.sub_region_code === userForm.value.sub_region_code)
  .map(t => ({ value: t.code, label: t.name })))
// Quartiers agrégés sur TOUS les territoires cochés (via areas -> zone_id), triés, dédupliqués.
const quartierOptions = computed(() => {
  const selected = new Set(userForm.value.territory_codes)
  const zoneIds = new Set(areas.value.filter(a => selected.has(a.territory_code)).map(a => a.id))
  return [...new Set(quartiers.value.filter(q => zoneIds.has(q.zone_id)).map(q => q.nom).filter(Boolean))].sort()
})

// Chip : le territoire peut venir d'une autre sous-région que celle filtrée,
// on rappelle donc son rattachement pour lever l'ambiguïté.
function territoryChipLabel(code: string) {
  const t = territories.value.find(t => t.code === code)
  if (!t) return code
  const sr = subRegions.value.find(s => s.code === t.sub_region_code)
  const srLabel = sr?.nom_affichage || sr?.name
  return srLabel ? `${t.name} · ${srLabel}` : t.name
}

// Coche/décoche un territoire. À la décoche, purge les quartiers devenus orphelins.
function toggleTerritory(code: string) {
  const list = userForm.value.territory_codes
  const idx = list.indexOf(code)
  if (idx === -1) list.push(code)
  else list.splice(idx, 1)
  const valid = new Set(quartierOptions.value)
  userForm.value.quartiers_assignes = userForm.value.quartiers_assignes.filter(q => valid.has(q))
}

// Coche/décoche uniquement les territoires visibles (sous-région filtrée) :
// les sélections des autres sous-régions ne bougent pas.
function toggleAllVisibleTerritories(select: boolean) {
  const visible = territoryOptions.value.map(o => o.value)
  const current = new Set(userForm.value.territory_codes)
  for (const code of visible) {
    if (select) current.add(code)
    else current.delete(code)
  }
  userForm.value.territory_codes = [...current]
  const valid = new Set(quartierOptions.value)
  userForm.value.quartiers_assignes = userForm.value.quartiers_assignes.filter(q => valid.has(q))
}
function toggleQuartier(q: string) {
  const list = userForm.value.quartiers_assignes
  const idx = list.indexOf(q)
  if (idx === -1) list.push(q)
  else list.splice(idx, 1)
}

// Région/sous-région = filtres d'affichage de la liste des territoires. Ils ne
// vident JAMAIS la sélection : un utilisateur peut couvrir des territoires de
// plusieurs sous-régions.
function onRegionChange() {
  userForm.value.sub_region_code = ''
}

// Territoires enregistrés mais absents du référentiel : conservés à l'identique
// au save plutôt que silencieusement perdus.
const unmatchedTerritories = ref<string[]>([])

// Libellé original du profil par code de territoire matché : au save on
// réécrit ce libellé (ex. "ADJAME") et non le nom du référentiel ("Adjame"),
// car le scoping SQL compare pdv.zone à l'identique.
const originalTerrNames = ref<Record<string, string>>({})

// Comparaison de noms de territoires insensible à la casse et aux accents :
// les zones importées du terrain sont en MAJUSCULES ("ADJAME") alors que le
// référentiel géo est en casse mixte ("Adjame").
const normTerrName = (v: string) =>
  (v || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Édition : reconstruit region_code/sub_region_code/territory_codes depuis territoires_assignes (noms).
// Fallback legacy : si territoires_assignes vide, part de zone_assignee (mono-territoire).
function hydrateUserGeo() {
  const names = userForm.value.territoires_assignes.length
    ? userForm.value.territoires_assignes
    : (userForm.value.zone_assignee ? [userForm.value.zone_assignee] : [])
  const matched = names.map(n => ({ name: n, terr: territories.value.find(t => normTerrName(t.name) === normTerrName(n)) }))
  userForm.value.territory_codes = matched.filter(m => m.terr).map(m => m.terr!.code)
  unmatchedTerritories.value = matched.filter(m => !m.terr).map(m => m.name)
  originalTerrNames.value = Object.fromEntries(
    matched.filter(m => m.terr).map(m => [m.terr!.code, m.name]))
  const first = matched.find(m => m.terr)?.terr
  const sr = first ? subRegions.value.find(s => s.code === first.sub_region_code) : null
  userForm.value.sub_region_code = sr?.code || ''
  userForm.value.region_code = sr?.region_code || ''
}

function openCreateUser() {
  editingUser.value = null
  unmatchedTerritories.value = []
  originalTerrNames.value = {}
  userForm.value = {
    nom: '', email: '', password: '', role: 'merchandiser',
    zone_assignee: '', region: '', territoires_assignes: [], quartiers_assignes: [], telephone: '',
    region_code: '', sub_region_code: '', territory_codes: [],
  }
  showCreate.value = true
}

const filteredUsers = computed(() => {
  let result = users.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(u =>
      u.nom?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    )
  }
  if (roleFilter.value) {
    result = result.filter(u => u.role === roleFilter.value)
  }
  return result
})

const usersPage = ref(1)
const usersPerPage = 25
const paginatedUsers = computed(() =>
  filteredUsers.value.slice((usersPage.value - 1) * usersPerPage, usersPage.value * usersPerPage)
)
watch([searchQuery, roleFilter], () => { usersPage.value = 1 })

// Colonne Zone : liste tous les territoires si multi, sinon le mono zone_assignee.
function zoneLabel(user: Profile) {
  const terrs = (user.territoires_assignes || []).filter(Boolean)
  if (terrs.length > 1) return `${terrs[0]} +${terrs.length - 1}`
  return terrs[0] || user.zone_assignee || '-'
}

function getRoleBg(role: string) {
  const map: Record<string, string> = {
    admin: 'bg-purple-600',
    superviseur: 'bg-fc-red',
    merchandiser: 'bg-emerald-600',
    commercial: 'bg-amber-600',
  }
  return map[role] || 'bg-gray-600'
}

function getRoleBadge(role: string) {
  const map: Record<string, string> = {
    admin: 'bg-purple-50 text-purple-700',
    superviseur: 'bg-red-50 text-red-700',
    merchandiser: 'bg-emerald-50 text-emerald-700',
    commercial: 'bg-amber-50 text-amber-700',
  }
  return map[role] || 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
}

function getUserActions(user: Profile) {
  return [[
    {
      label: 'Modifier',
      icon: 'i-heroicons-pencil',
      click: () => {
        editingUser.value = user
        userForm.value.password = ''
        Object.assign(userForm.value, user)
        userForm.value.territoires_assignes = (user.territoires_assignes || []).filter(Boolean)
        userForm.value.quartiers_assignes = (user.quartiers_assignes || []).filter(Boolean)
        hydrateUserGeo()
        showCreate.value = true
      },
    },
    {
      label: user.is_active ? 'Désactiver' : 'Activer',
      icon: user.is_active ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle',
      click: () => toggleUserActive(user),
    },
    {
      label: 'Supprimer',
      icon: 'i-heroicons-trash',
      click: () => deleteUser(user),
    },
  ]]
}

async function fetchUsers() {
  loading.value = true
  try {
    const { fetchUsers: fetchCachedUsers, invalidate } = useUsersCache()
    invalidate() // Admin users page always needs fresh data
    const data = await fetchCachedUsers(true)
    users.value = data as Profile[]
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    loading.value = false
  }
}

// ---- Export / Import CSV ----
const { exportToCsv, parseCsv, downloadUsersTemplate } = useCsvExport()
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const importing = ref(false)
const importSummary = ref<{ created: number; updated: number; errors: { line: number; email: string; message: string }[] } | null>(null)

// Export de la sélection courante (recherche + filtre rôle), enrichie des
// division/sous_region dérivées du référentiel (vides si territoire non matché).
function exportUsers() {
  const rows = filteredUsers.value.map((u) => {
    const terrs = (u.territoires_assignes || []).filter(Boolean)
    const matched = terrs
      .map(n => territories.value.find(t => normTerrName(t.name) === normTerrName(n)))
      .filter(Boolean)
    const srs = [...new Set(matched
      .map(t => subRegions.value.find(s => s.code === t!.sub_region_code))
      .filter(Boolean)
      .map(s => s!.nom_affichage || s!.name))]
    const divs = [...new Set(matched
      .map(t => subRegions.value.find(s => s.code === t!.sub_region_code))
      .filter(Boolean)
      .map(s => regions.value.find(r => r.code === s!.region_code))
      .filter(Boolean)
      .map(r => r!.nom_affichage || r!.name))]
    return {
      email: u.email || '',
      nom: u.nom || '',
      role: u.role || '',
      telephone: u.telephone || '',
      is_active: u.is_active === false ? 'FALSE' : 'TRUE',
      zone_assignee: u.zone_assignee || '',
      territoires_assignes: terrs.join('|'),
      quartiers_assignes: (u.quartiers_assignes || []).filter(Boolean).join('|'),
      region: u.region || '',
      division: divs.join('|'),
      sous_region: srs.join('|'),
    }
  })
  if (!rows.length) {
    toast.add({ title: 'Aucun utilisateur à exporter', color: 'amber' })
    return
  }
  exportToCsv(rows, `utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`)
}

function handleImportFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  importFile.value = target.files?.[0] || null
  importSummary.value = null
}

function closeImportModal() {
  showImportModal.value = false
  importFile.value = null
  importSummary.value = null
}

const splitList = (v: string) => (v || '').split('|').map(s => s.trim()).filter(Boolean)

async function importUsers() {
  if (!importFile.value) return
  importing.value = true
  try {
    const text = (await importFile.value.text()).replace(/^\uFEFF/, '')
    const parsed = parseCsv(text)
    if (!parsed.length) throw new Error('Fichier vide ou en-têtes manquants')
    // line = numéro de ligne dans le fichier (1 = en-têtes) ; colonnes
    // export-only (division, sous_region) ignorées côté serveur.
    const rows = parsed.map((r, i) => ({
      line: i + 2,
      email: r.email,
      nom: r.nom,
      role: r.role,
      telephone: r.telephone,
      is_active: r.is_active,
      zone_assignee: r.zone_assignee,
      territoires_assignes: splitList(r.territoires_assignes),
      quartiers_assignes: splitList(r.quartiers_assignes),
      region: r.region,
      mot_de_passe: r.mot_de_passe,
    }))
    const result = await $fetch<{ created: number; updated: number; errors: { line: number; email: string; message: string }[] }>(
      '/api/admin/users/import',
      { method: 'POST', body: { rows } },
    )
    importSummary.value = result
    toast.add({
      title: 'Import terminé',
      description: `${result.created} créé(s), ${result.updated} mis à jour, ${result.errors.length} erreur(s)`,
      color: result.errors.length ? 'amber' : 'green',
    })
    await fetchUsers()
  } catch (err: any) {
    toast.add({ title: 'Erreur d\'import', description: err?.data?.message || err.message, color: 'red' })
  } finally {
    importing.value = false
  }
}

async function handleSaveUser() {
  saving.value = true
  try {
    // Dérive territoires (noms) depuis les codes cochés ; zone_assignee = 1er (compat legacy).
    // Un territoire déjà présent sur le profil garde son libellé d'origine
    // (originalTerrNames) pour ne pas casser le scoping exact sur pdv.zone.
    const terrs = [
      ...userForm.value.territory_codes
        .map(code => originalTerrNames.value[code] || territories.value.find(t => t.code === code)?.name)
        .filter(Boolean) as string[],
      ...unmatchedTerritories.value,
    ]
    // Région dérivée du 1er territoire coché (et non du filtre affiché, qui peut
    // pointer une autre sous-région que celle du périmètre réel).
    const firstTerr = territories.value.find(t => t.code === userForm.value.territory_codes[0])
    const sr = subRegions.value.find(s => s.code === (firstTerr?.sub_region_code || userForm.value.sub_region_code))
    const zoneAssignee = terrs[0] || userForm.value.zone_assignee || null
    const region = sr?.nom_affichage || sr?.name || userForm.value.region || null
    const quartiers = (userForm.value.quartiers_assignes || []).filter(Boolean)

    if (editingUser.value) {
      const { error } = await supabase
        .from('profiles')
        .update({
          nom: userForm.value.nom,
          role: userForm.value.role,
          zone_assignee: zoneAssignee,
          territoires_assignes: terrs,
          region,
          quartiers_assignes: quartiers,
          telephone: userForm.value.telephone,
        })
        .eq('id', editingUser.value.id)

      if (error) throw error
      toast.add({ title: 'Utilisateur mis à jour' })
    }
    else {
      // Compte + profil créés en une passe côté serveur (service_role) : pas de
      // mail de confirmation, donc pas de 429, et le rôle choisi est bien appliqué.
      await authStore.register({
        email: userForm.value.email,
        password: userForm.value.password,
        nom: userForm.value.nom,
        role: userForm.value.role,
        telephone: userForm.value.telephone,
        zone_assignee: zoneAssignee,
        territoires_assignes: terrs,
        quartiers_assignes: quartiers,
        region,
      })
      toast.add({ title: 'Utilisateur créé' })
    }

    showCreate.value = false
    editingUser.value = null
    fetchUsers()
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

async function toggleUserActive(user: Profile) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: !user.is_active })
    .eq('id', user.id)

  if (error) {
    toast.add({ title: 'Erreur', description: error.message, color: 'red' })
    return
  }
  fetchUsers()
}

// Supprime le compte auth ET le profil (cascade FK). Supprimer le seul profil
// laissait un compte auth orphelin encore capable de se connecter.
async function deleteUser(user: Profile) {
  if (!confirm(`Supprimer définitivement ${user.nom || user.email} ? Le compte de connexion est également supprimé.`)) return

  try {
    await authStore.deleteUser(user.id)
    toast.add({ title: 'Utilisateur supprimé' })
    fetchUsers()
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

onMounted(() => {
  fetchUsers()
  fetchReferentiels()
})
</script>
