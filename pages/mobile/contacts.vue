<template>
  <div class="mobile-page">
    <div class="p-4 space-y-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Contacts</h2>

      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Rechercher un contact..."
        size="lg"
        aria-label="Rechercher un contact"
      />

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="mobile-card p-4 animate-pulse">
          <div class="flex items-center gap-4">
            <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div class="flex-1 space-y-2">
              <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
              <div class="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-700" />
            </div>
          </div>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="contact in filteredContacts"
          :key="contact.id"
          class="mobile-card flex items-center gap-4 p-4"
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
            <a
              v-if="contact.telephone"
              :href="`tel:${contact.telephone}`"
              class="touch-target inline-flex items-center justify-center rounded-xl text-fc-red hover:bg-red-50 dark:hover:bg-red-950/30"
              :aria-label="`Appeler ${contact.nom}`"
            >
              <UIcon name="i-heroicons-phone" class="w-5 h-5" />
            </a>
            <a
              v-if="contact.email"
              :href="`mailto:${contact.email}`"
              class="touch-target inline-flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              :aria-label="`Envoyer un email à ${contact.nom}`"
            >
              <UIcon name="i-heroicons-envelope" class="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      <div v-if="!loading && filteredContacts.length === 0" class="py-12 text-center">
        <UIcon name="i-heroicons-users" class="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p class="font-semibold text-gray-700 dark:text-gray-200">Aucun contact trouvé</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Essayez un nom, une zone ou une adresse email.</p>
      </div>
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
const loading = ref(true)

const filteredContacts = computed(() => {
  if (!search.value) return contacts.value
  const q = search.value.toLowerCase()
  return contacts.value.filter(
    c => c.nom?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.zone?.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  loading.value = true
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
  finally {
    loading.value = false
  }
})
</script>
