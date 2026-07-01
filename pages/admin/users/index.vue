<template>
  <div class="space-y-6">
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
      <UButton v-if="authStore.isAdmin" size="sm" @click="openCreateUser" icon="i-heroicons-plus" class="bg-fc-blue">
        Nouvel utilisateur
      </UButton>
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
              v-for="user in filteredUsers"
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
              <td class="px-4 py-3 text-sm text-gray-600">{{ user.zone_assignee || '-' }}</td>
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
            <p class="text-xs text-slate-500 dark:text-slate-400">Définissez la zone et les secteurs accessibles à l’utilisateur.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <UFormGroup label="Région" size="md">
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

          <UFormGroup label="Sous-région" size="md">
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
              @update:model-value="onSubRegionChange"
            />
          </UFormGroup>

          <UFormGroup label="Territoire" help="Zone principale assignée à l’utilisateur." size="md">
            <USelectMenu
              v-model="userForm.territory_code"
              :options="territoryOptions"
              option-attribute="label"
              value-attribute="value"
              :disabled="!userForm.sub_region_code"
              placeholder="Sélectionner un territoire"
              searchable
              searchable-placeholder="Rechercher..."
              size="md"
              class="w-full"
              @update:model-value="onTerritoryChange"
            />
          </UFormGroup>

          <UFormGroup label="Secteurs assignés" help="Laissez vide pour autoriser tout le territoire." size="md">
            <USelectMenu
              v-model="userForm.secteurs_assignes"
              :options="secteurOptions"
              multiple
              :disabled="!userForm.territory_code"
              placeholder="Sélectionner les secteurs"
              searchable
              searchable-placeholder="Rechercher..."
              size="md"
              class="w-full"
            />
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
          class="bg-fc-blue text-white hover:bg-fc-blue-600 focus-visible:outline-fc-blue-500 dark:bg-fc-blue dark:text-white dark:hover:bg-fc-blue-600 dark:focus-visible:outline-fc-blue-400"
          :loading="saving"
        >
          {{ editingUser ? 'Mettre à jour' : 'Créer l’utilisateur' }}
        </UButton>
      </template>
    </AdminFormModal>
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
  secteurs_assignes: [] as string[],
  telephone: '',
  // Cascade géo (UI) — non stockées telles quelles ; on dérive zone_assignee/region au save.
  region_code: '',
  sub_region_code: '',
  territory_code: '',
})

// Cascade géo Région → Sous-région → Territoire → Secteurs (areas), comme le formulaire PDV.
// Scoping pdv : pdv.zone = territoire.nom, pdv.secteur = area.nom, pdv.region = sous_region.nom_affichage.
const { regions, subRegions, territories, areas, fetchReferentiels } = useReferentiels()
const regionOptions = computed(() => regions.value.map(r => ({ value: r.code, label: r.nom_affichage ? `${r.nom_affichage} · ${r.name}` : r.name })))
const subRegionOptions = computed(() => subRegions.value
  .filter(s => s.region_code === userForm.value.region_code)
  .map(s => ({ value: s.code, label: s.nom_affichage ? `${s.nom_affichage} · ${s.name}` : s.name })))
const territoryOptions = computed(() => territories.value
  .filter(t => t.sub_region_code === userForm.value.sub_region_code)
  .map(t => ({ value: t.code, label: t.name })))
const secteurOptions = computed(() => [...new Set(areas.value
  .filter(a => a.territory_code === userForm.value.territory_code)
  .map(a => a.name).filter(Boolean))].sort())

function onRegionChange() {
  userForm.value.sub_region_code = ''
  userForm.value.territory_code = ''
  userForm.value.zone_assignee = ''
  userForm.value.secteurs_assignes = []
}
function onSubRegionChange() {
  userForm.value.territory_code = ''
  userForm.value.zone_assignee = ''
  userForm.value.secteurs_assignes = []
}
function onTerritoryChange() {
  const terr = territories.value.find(t => t.code === userForm.value.territory_code)
  const sr = subRegions.value.find(s => s.code === userForm.value.sub_region_code)
  userForm.value.zone_assignee = terr?.name || ''
  userForm.value.region = sr?.nom_affichage || sr?.name || userForm.value.region || ''
  userForm.value.secteurs_assignes = []
}
// Édition : reconstruit region_code/sub_region_code/territory_code depuis zone_assignee (nom territoire).
function hydrateUserGeo() {
  const terr = territories.value.find(t => t.name === userForm.value.zone_assignee)
  const sr = terr ? subRegions.value.find(s => s.code === terr.sub_region_code) : null
  userForm.value.territory_code = terr?.code || ''
  userForm.value.sub_region_code = sr?.code || ''
  userForm.value.region_code = sr?.region_code || ''
}

function openCreateUser() {
  editingUser.value = null
  userForm.value = {
    nom: '', email: '', password: '', role: 'merchandiser',
    zone_assignee: '', region: '', secteurs_assignes: [], telephone: '',
    region_code: '', sub_region_code: '', territory_code: '',
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
        userForm.value.secteurs_assignes = (user.secteurs_assignes || []).filter(Boolean)
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

async function handleSaveUser() {
  saving.value = true
  try {
    // Dérive zone_assignee (territoire) + region (sous-région) depuis la cascade géo.
    const terr = territories.value.find(t => t.code === userForm.value.territory_code)
    const sr = subRegions.value.find(s => s.code === userForm.value.sub_region_code)
    const zoneAssignee = terr?.name || userForm.value.zone_assignee || null
    const region = sr?.nom_affichage || sr?.name || userForm.value.region || null
    const secteurs = (userForm.value.secteurs_assignes || []).filter(Boolean)

    if (editingUser.value) {
      const { error } = await supabase
        .from('profiles')
        .update({
          nom: userForm.value.nom,
          role: userForm.value.role,
          zone_assignee: zoneAssignee,
          region,
          secteurs_assignes: secteurs,
          telephone: userForm.value.telephone,
        })
        .eq('id', editingUser.value.id)

      if (error) throw error
      toast.add({ title: 'Utilisateur mis à jour' })
    }
    else {
      await authStore.register(
        userForm.value.email,
        userForm.value.password,
        userForm.value.nom,
        userForm.value.role
      )
      // register ne pose pas la géo : on complète le profil créé (repéré par email).
      const { error: geoErr } = await supabase
        .from('profiles')
        .update({ zone_assignee: zoneAssignee, region, secteurs_assignes: secteurs, telephone: userForm.value.telephone })
        .eq('email', userForm.value.email)
      if (geoErr) throw geoErr
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

async function deleteUser(user: Profile) {
  if (!confirm('Supprimer cet utilisateur ?')) return

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', user.id)

  if (error) {
    toast.add({ title: 'Erreur', description: error.message, color: 'red' })
    return
  }
  toast.add({ title: 'Utilisateur supprimé' })
  fetchUsers()
}

onMounted(() => {
  fetchUsers()
  fetchReferentiels()
})
</script>
