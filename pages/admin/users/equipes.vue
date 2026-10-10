<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Rattacher un merchandiser à un commercial sert aux filtres « mon équipe » et aux relances WhatsApp. Cela ne change pas ce que chacun voit : le périmètre reste défini par les territoires assignés."
    />

    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <!-- Commerciaux -->
      <section class="admin-surface overflow-hidden" aria-labelledby="titre-commerciaux">
        <div class="border-b border-slate-200 p-4 dark:border-slate-700">
          <h2 id="titre-commerciaux" class="text-base font-semibold text-slate-900 dark:text-white">Commerciaux</h2>
          <UInput v-model="rechercheCommercial" size="sm" class="mt-2" icon="i-heroicons-magnifying-glass" placeholder="Rechercher un commercial" aria-label="Rechercher un commercial" />
        </div>
        <ChargementContenu v-if="loading" variante="compact" libelle="Chargement des commerciaux…" class="p-4" />
        <ul v-else class="max-h-[60vh] divide-y divide-slate-200 overflow-auto dark:divide-slate-700">
          <li v-for="c in commerciauxFiltres" :key="c.id">
            <button
              type="button"
              class="w-full px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
              :class="selection === c.id ? 'bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'"
              :aria-pressed="selection === c.id"
              @click="choisirCommercial(c.id)"
            >
              <span class="block text-sm font-semibold" :class="selection === c.id ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-white'">{{ c.nom || c.email }}</span>
              <span class="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
                <span class="tabular-nums">{{ compteEquipe(c.id) }}</span> merchandiser{{ compteEquipe(c.id) > 1 ? 's' : '' }} · {{ territoiresDe(c) }}
              </span>
            </button>
          </li>
          <li v-if="!commerciauxFiltres.length" class="p-4 text-sm text-slate-600 dark:text-slate-300">
            {{ rechercheCommercial ? 'Aucun commercial ne correspond à la recherche.' : 'Aucun commercial actif. Créez un compte commercial dans Utilisateurs.' }}
          </li>
        </ul>
      </section>

      <!-- Merchandisers -->
      <section class="admin-surface overflow-hidden" aria-labelledby="titre-equipe">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
          <div class="min-w-0">
            <h2 id="titre-equipe" class="text-base font-semibold text-slate-900 dark:text-white">
              {{ commercialChoisi ? `Équipe de ${commercialChoisi.nom || commercialChoisi.email}` : 'Équipe' }}
            </h2>
            <p v-if="commercialChoisi" class="text-xs text-slate-600 dark:text-slate-300">
              <span class="tabular-nums">{{ coches.size }}</span> coché{{ coches.size > 1 ? 's' : '' }} sur <span class="tabular-nums">{{ merchandiseurs.length }}</span> merchandiser{{ merchandiseurs.length > 1 ? 's' : '' }}
            </p>
          </div>
          <div v-if="commercialChoisi" class="flex flex-wrap items-center gap-3">
            <UCheckbox v-model="masquerAutres" label="Masquer ceux d'une autre équipe" />
            <UButton size="sm" :loading="enregistrement" :disabled="!modifie" @click="enregistrer">Enregistrer l'équipe</UButton>
          </div>
        </div>

        <p v-if="!commercialChoisi" class="p-8 text-center text-sm text-slate-600 dark:text-slate-300">
          Choisissez un commercial dans la liste pour composer son équipe.
        </p>
        <div v-else class="p-4">
          <UInput v-model="rechercheMerch" size="sm" class="mb-3" icon="i-heroicons-magnifying-glass" placeholder="Rechercher un merchandiser" aria-label="Rechercher un merchandiser" />
          <div class="max-h-[55vh] space-y-1 overflow-auto">
            <label
              v-for="m in merchandiseursFiltres"
              :key="m.id"
              class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <UCheckbox :model-value="coches.has(m.id)" @update:model-value="basculer(m.id)" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium text-slate-900 dark:text-white">{{ m.nom || m.email }}</span>
                <span class="block truncate text-xs text-slate-600 dark:text-slate-300">{{ territoiresDe(m) }}</span>
              </span>
              <span
                v-if="m.commercial_id && m.commercial_id !== selection"
                class="max-w-[12rem] shrink-0 truncate rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                :title="`Déjà dans l'équipe de ${nomDe(m.commercial_id)}`"
              >Équipe de {{ nomDe(m.commercial_id) }}</span>
            </label>
            <p v-if="!merchandiseursFiltres.length" class="p-4 text-center text-sm text-slate-600 dark:text-slate-300">
              {{ rechercheMerch || masquerAutres ? 'Aucun merchandiser ne correspond. Effacez la recherche ou affichez ceux des autres équipes.' : 'Aucun merchandiser actif. Créez un compte merchandiser dans Utilisateurs.' }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Composition des équipes commerciales : on choisit un commercial, on coche
// ses merchandiseurs, on enregistre en une fois. L'écriture passe par
// /api/admin/equipes (clé de service) car la RLS de profiles ne laisse pas
// réécrire les autres profils depuis le navigateur.
import type { Profile } from '~/types'
import { messageUtilisateur } from '~/utils/supabaseErrors'

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
  return t.length ? t.join(', ') : (u.zone_assignee || 'Aucun territoire assigné')
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
    toast.add({ title: 'Équipe enregistrée', description: `${res.assignes} merchandiser${res.assignes > 1 ? 's' : ''} rattaché${res.assignes > 1 ? 's' : ''} à ${res.commercial}.`, color: 'green' })
    invalidate()
    await charger()
    choisirCommercial(selection.value)
  }
  catch (err: any) {
    toast.add({ title: 'Équipe non enregistrée', description: messageUtilisateur(err), color: 'red' })
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
  catch (err) { toast.add({ title: 'Chargement impossible', description: messageUtilisateur(err), color: 'red' }) }
  finally { loading.value = false }
})
</script>
