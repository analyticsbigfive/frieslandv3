<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <UInput
          v-model="searchQuery"
          placeholder="Rechercher..."
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="w-64"
        />
        <USelectMenu
          v-model="roleFilter"
          :options="['', 'admin', 'superviseur', 'merchandiser', 'commercial']"
          placeholder="Rôle"
          size="sm"
          class="w-40"
        />
      </div>
      <UButton size="sm" @click="showCreate = true" icon="i-heroicons-plus" class="bg-fc-blue">
        Nouvel utilisateur
      </UButton>
    </div>

    <!-- Users Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    :class="getRoleBg(user.role)">
                    {{ user.nom?.substring(0, 2).toUpperCase() || '??' }}
                  </div>
                  <span class="text-sm font-medium text-gray-900">{{ user.nom || '-' }}</span>
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
                <UDropdown :items="getUserActions(user)">
                  <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
                </UDropdown>
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
    <UModal v-model="showCreate" :ui="{ width: 'max-w-lg' }">
      <div class="p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-6">
          {{ editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur' }}
        </h3>

        <form @submit.prevent="handleSaveUser" class="space-y-4">
          <UFormGroup label="Nom complet" required>
            <UInput v-model="userForm.nom" placeholder="Nom complet" />
          </UFormGroup>

          <UFormGroup label="Email" required>
            <UInput v-model="userForm.email" type="email" placeholder="email@example.com" />
          </UFormGroup>

          <UFormGroup v-if="!editingUser" label="Mot de passe" required>
            <UInput v-model="userForm.password" type="password" placeholder="Mot de passe" />
          </UFormGroup>

          <UFormGroup label="Rôle">
            <USelectMenu
              v-model="userForm.role"
              :options="['admin', 'superviseur', 'merchandiser', 'commercial']"
            />
          </UFormGroup>

          <UFormGroup label="Zone assignée">
            <UInput v-model="userForm.zone_assignee" placeholder="Zone..." />
          </UFormGroup>

          <UFormGroup label="Téléphone">
            <UInput v-model="userForm.telephone" placeholder="+225..." />
          </UFormGroup>

          <div class="flex justify-end gap-2 pt-4">
            <UButton variant="ghost" @click="showCreate = false">Annuler</UButton>
            <UButton type="submit" class="bg-fc-blue" :loading="saving">Enregistrer</UButton>
          </div>
        </form>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Profile, UserRole } from '~/types'

definePageMeta({
  middleware: ['auth'],
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
  telephone: '',
})

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
    superviseur: 'bg-fc-blue',
    merchandiser: 'bg-emerald-600',
    commercial: 'bg-amber-600',
  }
  return map[role] || 'bg-gray-600'
}

function getRoleBadge(role: string) {
  const map: Record<string, string> = {
    admin: 'bg-purple-50 text-purple-700',
    superviseur: 'bg-blue-50 text-blue-700',
    merchandiser: 'bg-emerald-50 text-emerald-700',
    commercial: 'bg-amber-50 text-amber-700',
  }
  return map[role] || 'bg-gray-50 text-gray-700'
}

function getUserActions(user: Profile) {
  return [[
    {
      label: 'Modifier',
      icon: 'i-heroicons-pencil',
      click: () => {
        editingUser.value = user
        Object.assign(userForm.value, user)
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
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
    if (editingUser.value) {
      const { error } = await supabase
        .from('profiles')
        .update({
          nom: userForm.value.nom,
          role: userForm.value.role,
          zone_assignee: userForm.value.zone_assignee,
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
})
</script>
