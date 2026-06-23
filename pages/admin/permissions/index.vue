<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Permissions & accès</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Autorise chaque rôle à accéder à une section du dashboard. L'admin a toujours accès à tout.
      </p>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Section</th>
              <th
                v-for="role in MANAGED_ROLES"
                :key="role"
                class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
              >
                {{ role }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="section in DASHBOARD_SECTIONS" :key="section.key" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ section.title }}</td>
              <td v-for="role in MANAGED_ROLES" :key="role" class="px-4 py-3 text-center">
                <input
                  type="checkbox"
                  class="rounded border-gray-300 text-fc-blue focus:ring-fc-blue w-4 h-4 disabled:opacity-50"
                  :checked="isChecked(role, section.key)"
                  :disabled="role === 'admin' || savingKey === `${role}:${section.key}`"
                  @change="onToggle(role, section.key)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="text-xs text-gray-400">
      Les rôles <strong>merchandiser</strong> et <strong>commercial</strong> utilisent l'app mobile ; leur donner accès à une section
      les autorise aussi à ouvrir le dashboard correspondant.
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: [
    'auth',
    'admin',
    () => {
      const authStore = useAuthStore()
      if (!authStore.isAdmin) return navigateTo('/admin')
    },
  ],
})

const toast = useToast()
const { access, fetchAccess, canAccessSection, updateAccess, DASHBOARD_SECTIONS, MANAGED_ROLES } = useAccessControl()

const savingKey = ref<string | null>(null)

function isChecked(role: string, sectionKey: string): boolean {
  if (role === 'admin') return true
  return canAccessSection(sectionKey, role)
}

async function onToggle(role: string, sectionKey: string) {
  if (role === 'admin') return
  const current = !!access.value[role]?.[sectionKey]
  savingKey.value = `${role}:${sectionKey}`
  try {
    await updateAccess(role, sectionKey, !current)
    toast.add({ title: 'Permission mise à jour', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  } finally {
    savingKey.value = null
  }
}

onMounted(() => fetchAccess(true))
</script>
