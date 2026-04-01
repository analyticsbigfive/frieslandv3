<template>
  <div class="pb-20">
    <div class="p-4 space-y-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Contacts</h2>

      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Rechercher un contact..."
        size="lg"
      />

      <div class="space-y-3">
        <div
          v-for="contact in filteredContacts"
          :key="contact.id"
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-4"
        >
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            :class="contact.role === 'admin' ? 'bg-fc-red' : contact.role === 'superviseur' ? 'bg-amber-500' : 'bg-gray-400'"
          >
            {{ (contact.nom || '?')[0] }}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">{{ contact.nom }}</h3>
            <p class="text-xs text-gray-400">{{ contact.role }} {{ contact.zone ? `— ${contact.zone}` : '' }}</p>
          </div>
          <div class="flex gap-2">
            <a v-if="contact.telephone" :href="`tel:${contact.telephone}`" class="text-fc-red">
              <UIcon name="i-heroicons-phone" class="w-5 h-5" />
            </a>
            <a v-if="contact.email" :href="`mailto:${contact.email}`" class="text-gray-400">
              <UIcon name="i-heroicons-envelope" class="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      <p v-if="filteredContacts.length === 0" class="text-center text-gray-400 text-sm py-8">Aucun contact trouvé</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const authStore = useAuthStore()
const { filterContacts } = useUserScope()
const { getCachedContactsFallback } = useOfflineData()
const search = ref('')
const contacts = ref<any[]>([])

const filteredContacts = computed(() => {
  if (!search.value) return contacts.value
  const q = search.value.toLowerCase()
  return contacts.value.filter(
    c => c.nom?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.zone?.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  try {
    const { fetchUsers: fetchCachedUsers } = useUsersCache()
    const data = await fetchCachedUsers()
    const activeData = data.filter(u => u.is_active !== false)

    const mapped = filterContacts(activeData).map((contact: any) => ({
      ...contact,
      zone: contact.zone_assignee,
    }))
    contacts.value = mapped
    // Cache for offline
    const { cacheContacts } = useOfflineData()
    await cacheContacts(activeData)
  } catch {
    // Offline fallback
    const cached = await getCachedContactsFallback()
    if (cached) {
      contacts.value = filterContacts(cached).map((contact: any) => ({
        ...contact,
        zone: contact.zone_assignee,
      }))
    }
  }
})
</script>
