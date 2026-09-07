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

      <div v-if="aUneEquipe" class="flex gap-2" aria-label="Filtrer les contacts">
        <button
          v-for="f in filtres"
          :key="f.value"
          type="button"
          class="min-h-9 rounded-full px-3 text-xs font-semibold transition-colors"
          :class="filtre === f.value ? 'bg-fc-red text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
          :aria-pressed="filtre === f.value"
          @click="filtre = f.value"
        >
          {{ f.label }} <span class="opacity-70">{{ compte(f.value) }}</span>
        </button>
      </div>

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
            class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            :class="contact.role === 'admin' ? 'bg-fc-red' : contact.role === 'superviseur' ? 'bg-amber-500' : 'bg-gray-400'"
          >
            {{ (contact.nom || '?')[0] }}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">
              {{ contact.nom }}
              <span v-if="estDeMonEquipe(contact.id)" class="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-fc-red dark:bg-red-950/40 dark:text-red-200">mon équipe</span>
            </h3>
            <p class="text-xs text-gray-400">{{ contact.role }} {{ contact.zone ? `— ${contact.zone}` : '' }}</p>
            <p v-if="contact.telephone" class="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">{{ contact.telephone }}</p>
            <p v-else class="mt-0.5 text-xs italic text-amber-600 dark:text-amber-400">Numéro manquant</p>
          </div>
          <div class="flex shrink-0 gap-1">
            <a
              v-if="contact.telephone"
              :href="`tel:${contact.telephone}`"
              class="touch-target inline-flex items-center justify-center rounded-xl text-fc-red hover:bg-red-50 dark:hover:bg-red-950/30"
              :aria-label="`Appeler ${contact.nom}`"
            >
              <UIcon name="i-heroicons-phone" class="w-5 h-5" />
            </a>
            <a
              v-if="lienWhatsApp(contact.telephone, '')"
              :href="lienWhatsApp(contact.telephone, `Bonjour ${(contact.nom || '').split(' ')[0]},`) || undefined"
              target="_blank"
              rel="noopener"
              class="touch-target inline-flex items-center justify-center rounded-xl text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
              :aria-label="`Écrire à ${contact.nom} sur WhatsApp`"
            >
              <UIcon name="i-simple-icons-whatsapp" class="w-5 h-5" />
            </a>
            <a
              v-if="contact.email"
              :href="`mailto:${contact.email}`"
              class="touch-target inline-flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              :aria-label="`Envoyer un email à ${contact.nom}`"
            >
              <UIcon name="i-heroicons-envelope" class="w-5 h-5" />
            </a>
            <button
              v-if="peutModifier(contact)"
              type="button"
              class="touch-target inline-flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="`Corriger le numéro de ${contact.nom}`"
              @click="ouvrirEdition(contact)"
            >
              <UIcon name="i-heroicons-pencil-square" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="!loading && filteredContacts.length === 0" class="py-12 text-center">
        <UIcon name="i-heroicons-users" class="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p class="font-semibold text-gray-700 dark:text-gray-200">Aucun contact trouvé</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Essayez un nom, une zone, un numéro ou une adresse email.</p>
      </div>
    </div>

    <UModal v-model="showEdition">
      <div class="space-y-4 p-6">
        <div>
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Corriger le numéro</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ enEdition?.nom }}</p>
        </div>
        <UFormGroup label="Téléphone" required>
          <UInput v-model="telephoneEdite" type="tel" size="lg" placeholder="07 08 09 10 11" />
        </UFormGroup>
        <p v-if="erreurEdition" class="text-sm text-red-600">{{ erreurEdition }}</p>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="gray" @click="showEdition = false">Annuler</UButton>
          <UButton class="bg-fc-red" :loading="enregistrement" :disabled="!telephoneEdite.trim()" @click="enregistrerTelephone">Enregistrer</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// Annuaire du périmètre. Depuis le 8 septembre 2026 : le numéro est affiché en
// clair (il alimente les relances WhatsApp), et l'encadrement peut le corriger
// sans passer par l'administration.
import { lienWhatsApp } from '~/utils/actionsCommerciales'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const authStore = useAuthStore()
const user = useSupabaseUser()
const toast = useToast()
const { filterContacts } = useUserScope()
const { getCachedContactsFallback } = useOfflineData()
const { fetchUsers: fetchCachedUsers, invalidate } = useUsersCache()
const { aUneEquipe, estDeMonEquipe, charger: chargerEquipe } = useMonEquipe()

const search = ref('')
const contacts = ref<any[]>([])
const loading = ref(true)
const filtre = ref<'tous' | 'equipe'>('tous')
const filtres = [
  { value: 'tous' as const, label: 'Tous' },
  { value: 'equipe' as const, label: 'Mon équipe' },
]

function correspondFiltre(c: any, f: typeof filtre.value) {
  return f === 'equipe' ? estDeMonEquipe(c.id) : true
}
function compte(f: typeof filtre.value) {
  return contacts.value.filter(c => correspondFiltre(c, f)).length
}

const filteredContacts = computed(() => {
  let liste = contacts.value.filter(c => correspondFiltre(c, filtre.value))
  if (search.value) {
    const q = search.value.toLowerCase()
    liste = liste.filter(c =>
      c.nom?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q)
      || c.zone?.toLowerCase().includes(q)
      || c.telephone?.toLowerCase().includes(q),
    )
  }
  return liste
})

// Qui peut corriger quoi : miroir de server/api/contacts/[id].patch.ts.
function peutModifier(contact: any) {
  if (contact.id === user.value?.id) return true
  if (contact.role === 'admin') return false
  if (authStore.isSuperviseur) return true
  if (authStore.isCommercial) return contact.role === 'merchandiser'
  return false
}

const showEdition = ref(false)
const enEdition = ref<any>(null)
const telephoneEdite = ref('')
const erreurEdition = ref('')
const enregistrement = ref(false)

function ouvrirEdition(contact: any) {
  enEdition.value = contact
  telephoneEdite.value = contact.telephone || ''
  erreurEdition.value = ''
  showEdition.value = true
}

async function enregistrerTelephone() {
  if (!enEdition.value) return
  enregistrement.value = true
  erreurEdition.value = ''
  const numero = telephoneEdite.value.trim()
  try {
    if (enEdition.value.id === user.value?.id) {
      // Son propre profil : la RLS l'autorise déjà, pas besoin du serveur.
      await authStore.updateProfile({ telephone: numero })
    }
    else {
      await $fetch(`/api/contacts/${enEdition.value.id}`, { method: 'PATCH', body: { telephone: numero } })
    }
    enEdition.value.telephone = numero
    invalidate()
    toast.add({ title: 'Numéro mis à jour', color: 'green' })
    showEdition.value = false
  }
  catch (err: any) {
    erreurEdition.value = err?.data?.message || err?.data?.statusMessage || err?.message || 'Enregistrement impossible'
  }
  finally {
    enregistrement.value = false
  }
}

onMounted(async () => {
  loading.value = true
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }
  void chargerEquipe()

  try {
    const data = await fetchCachedUsers()
    const activeData = data.filter(u => u.is_active !== false)

    contacts.value = filterContacts(activeData).map((contact: any) => ({
      ...contact,
      zone: contact.zone_assignee,
    }))
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
