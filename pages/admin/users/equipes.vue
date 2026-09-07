<template>
  <div class="space-y-6">
    <AdminPageHeader title="Équipes" eyebrow="Paramètres" />

    <div class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-900/10 dark:text-blue-200">
      Rattacher un merchandiseur à un commercial sert aux filtres « mon équipe » et aux relances WhatsApp.
      Cela ne modifie pas ce que chacun voit : le périmètre reste défini par les territoires assignés.
    </div>

    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <!-- Commerciaux -->
      <div class="admin-surface overflow-hidden">
        <div class="border-b border-gray-100 p-3 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Commerciaux</h3>
          <UInput v-model="rechercheCommercial" size="xs" class="mt-2" placeholder="Rechercher…" aria-label="Rechercher un commercial" />
        </div>
        <ul class="max-h-[60vh] divide-y divide-gray-100 overflow-auto dark:divide-gray-700">
          <li v-if="loading" class="p-4 text-sm text-gray-400">Chargement…</li>
          <li
            v-for="c in commerciauxFiltres"
            v-else
            :key="c.id"
            class="cursor-pointer p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            :class="{ 'bg-red-50 dark:bg-red-900/20': selection === c.id }"
            @click="choisirCommercial(c.id)"
          >
            <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ c.nom || c.email }}</p>
            <p class="text-xs text-gray-400">{{ compteEquipe(c.id) }} merchandiseur(s) · {{ territoiresDe(c) }}</p>
          </li>
          <li v-if="!loading && !commerciauxFiltres.length" class="p-4 text-sm text-gray-400">Aucun commercial actif.</li>
        </ul>
      </div>

      <!-- Merchandiseurs -->
      <div class="admin-surface overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3 dark:border-gray-700">
          <div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ commercialChoisi ? `Équipe de ${commercialChoisi.nom || commercialChoisi.email}` : 'Choisissez un commercial' }}
            </h3>
            <p v-if="commercialChoisi" class="text-xs text-gray-400">{{ coches.size }} coché(s) sur {{ merchandiseurs.length }} merchandiseur(s)</p>
          </div>
          <div v-if="commercialChoisi" class="flex items-center gap-2">
            <UCheckbox v-model="masquerAutres" label="Masquer ceux d'une autre équipe" />
            <UButton size="sm" class="bg-fc-red" :loading="enregistrement" :disabled="!modifie" @click="enregistrer">Enregistrer</UButton>
          </div>
        </div>

        <div v-if="!commercialChoisi" class="p-8 text-center text-sm text-gray-400">
          Sélectionnez un commercial à gauche pour composer son équipe.
        </div>
        <div v-else class="p-3">
          <UInput v-model="rechercheMerch" size="xs" class="mb-3" placeholder="Rechercher un merchandiseur…" aria-label="Rechercher un merchandiseur" />
          <div class="max-h-[55vh] space-y-1 overflow-auto">
            <label
              v-for="m in merchandiseursFiltres"
              :key="m.id"
              class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <UCheckbox :model-value="coches.has(m.id)" @update:model-value="basculer(m.id)" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-gray-800 dark:text-gray-100">{{ m.nom || m.email }}</span>
                <span class="block truncate text-xs text-gray-400">{{ territoiresDe(m) }}</span>
              </span>
              <span
                v-if="m.commercial_id && m.commercial_id !== selection"
                class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              >{{ nomDe(m.commercial_id) }}</span>
            </label>
            <p v-if="!merchandiseursFiltres.length" class="p-4 text-center text-sm text-gray-400">Aucun merchandiseur.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Composition des équipes commerciales : on choisit un commercial, on coche
// ses merchandiseurs, on enregistre en une fois. L'écriture passe par
// /api/admin/equipes (clé de service) car la RLS de profiles ne laisse pas
// réécrire les autres profils depuis le navigateur.
import type { Profile } from '~/types'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const toast = useToast()
const { fetchUsers, invalidate } = useUsersCache()

const tous = ref<Profile[]>([])
const loading = ref(true)
const selection = ref('')
const coches = ref<Set<string>>(new Set())
const initial = ref<Set<string>>(new Set())
const rechercheCommercial = ref('')
const rechercheMerch = ref('')
const masquerAutres = ref(false)
const enregistrement = ref(false)

const commerciaux = computed(() => tous.value.filter(u => u.role === 'commercial' && u.is_active !== false))
const merchandiseurs = computed(() => tous.value.filter(u => u.role === 'merchandiser' && u.is_active !== false))
const commercialChoisi = computed(() => commerciaux.value.find(c => c.id === selection.value) || null)

const commerciauxFiltres = computed(() => {
  const q = rechercheCommercial.value.toLowerCase()
  return commerciaux.value.filter(c => !q || (c.nom || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
})
const merchandiseursFiltres = computed(() => {
  const q = rechercheMerch.value.toLowerCase()
  return merchandiseurs.value.filter((m) => {
    if (masquerAutres.value && m.commercial_id && m.commercial_id !== selection.value) return false
    if (!q) return true
    return (m.nom || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q) || territoiresDe(m).toLowerCase().includes(q)
  })
})

const modifie = computed(() => {
  if (coches.value.size !== initial.value.size) return true
  for (const id of coches.value) if (!initial.value.has(id)) return true
  return false
})

function territoiresDe(u: Profile) {
  const t = (u.territoires_assignes || []).filter(Boolean)
  return t.length ? t.join(', ') : (u.zone_assignee || '—')
}
function nomDe(id?: string | null) {
  const c = tous.value.find(u => u.id === id)
  return c?.nom || c?.email || '—'
}
function compteEquipe(commercialId: string) {
  return merchandiseurs.value.filter(m => m.commercial_id === commercialId).length
}
function choisirCommercial(id: string) {
  selection.value = id
  const membres = merchandiseurs.value.filter(m => m.commercial_id === id).map(m => m.id)
  coches.value = new Set(membres)
  initial.value = new Set(membres)
  rechercheMerch.value = ''
}
function basculer(id: string) {
  const s = new Set(coches.value)
  s.has(id) ? s.delete(id) : s.add(id)
  coches.value = s
}

async function enregistrer() {
  if (!selection.value) return
  enregistrement.value = true
  try {
    const res = await $fetch<{ commercial: string; assignes: number }>('/api/admin/equipes', {
      method: 'POST',
      body: { commercial_id: selection.value, merchandiser_ids: [...coches.value] },
    })
    toast.add({ title: 'Équipe enregistrée', description: `${res.assignes} merchandiseur(s) rattaché(s) à ${res.commercial}.`, color: 'green' })
    invalidate()
    await charger()
    choisirCommercial(selection.value)
  }
  catch (err: any) {
    toast.add({ title: 'Enregistrement impossible', description: err?.data?.message || err?.message, color: 'red' })
  }
  finally {
    enregistrement.value = false
  }
}

async function charger() {
  tous.value = await fetchUsers(true)
}

onMounted(async () => {
  try { await charger() }
  finally { loading.value = false }
})
</script>
