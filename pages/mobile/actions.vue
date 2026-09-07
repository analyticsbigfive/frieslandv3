<template>
  <div class="mobile-page">
    <div class="space-y-3 p-4">
      <div class="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer par statut">
        <button
          v-for="f in filtres"
          :key="f.value"
          type="button"
          class="min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors"
          :class="filtre === f.value ? 'bg-fc-red text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
          :aria-pressed="filtre === f.value"
          @click="filtre = f.value"
        >
          {{ f.label }} <span class="opacity-70">{{ compte(f.value) }}</span>
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ authStore.isCommercial ? 'Actions que vous avez décidées pour vos merchandiseurs.' : 'Actions à réaliser sur vos points de vente.' }}
      </p>
    </div>

    <div v-if="loading" class="space-y-3 px-4">
      <div v-for="i in 4" :key="i" class="mobile-card animate-pulse p-4">
        <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        <div class="mt-2 h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    </div>
    <div v-else class="px-4">
      <ActionCommercialeList
        :actions="filtrees"
        show-pdv
        empty-text="Aucune action pour ce filtre."
        @changed="recharger"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ActionCommerciale } from '~/types'
import { estOuverte } from '~/utils/actionsCommerciales'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const authStore = useAuthStore()
const { listerMesActions, chargerTypes } = useActionsCommerciales()

const actions = ref<ActionCommerciale[]>([])
const loading = ref(true)
const filtre = ref<'ouvertes' | 'faites' | 'toutes'>('ouvertes')
const filtres = [
  { value: 'ouvertes' as const, label: 'Ouvertes' },
  { value: 'faites' as const, label: 'Faites' },
  { value: 'toutes' as const, label: 'Toutes' },
]

function correspond(a: ActionCommerciale, f: typeof filtre.value) {
  if (f === 'ouvertes') return estOuverte(a)
  if (f === 'faites') return a.statut === 'faite'
  return true
}
const filtrees = computed(() => actions.value.filter(a => correspond(a, filtre.value)))
function compte(f: typeof filtre.value) {
  return actions.value.filter(a => correspond(a, f)).length
}

async function recharger() {
  try {
    actions.value = await listerMesActions()
  }
  catch (err) {
    console.warn('Actions : chargement impossible', err)
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!authStore.profile) await authStore.fetchProfile()
  void chargerTypes()
  await recharger()
})
</script>
