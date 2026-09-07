<template>
  <div v-if="actions.length" class="space-y-2">
    <article
      v-for="a in actions"
      :key="a.id"
      class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
      :class="estEnRetard(a) ? 'border-red-200 dark:border-red-900/60' : ''"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ a.type?.libelle || libelleType(a.type_code) }}</p>
          <p v-if="showPdv" class="truncate text-xs text-gray-500 dark:text-gray-400">{{ a.pdv?.nom_pdv || a.pdv_id }}<span v-if="a.pdv?.zone"> · {{ a.pdv.zone }}</span></p>
        </div>
        <UBadge :color="statutActionColor(a.statut)" variant="subtle" size="xs">{{ statutActionLabel(a.statut) }}</UBadge>
      </div>
      <p v-if="a.commentaire" class="mt-2 text-sm text-gray-700 dark:text-gray-300">{{ a.commentaire }}</p>
      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span v-if="a.assigne?.nom"><UIcon name="i-heroicons-user" class="mr-0.5 inline h-3 w-3" />{{ a.assigne.nom }}</span>
        <span v-if="a.echeance" :class="estEnRetard(a) ? 'font-semibold text-red-600' : ''">
          <UIcon name="i-heroicons-calendar" class="mr-0.5 inline h-3 w-3" />{{ formatDate(a.echeance) }}
        </span>
        <span v-if="a.auteur?.nom">par {{ a.auteur.nom }}</span>
      </div>
      <div v-if="peutAvancer(a)" class="mt-3 flex gap-2">
        <UButton
          v-for="s in transitionsAssigne(a.statut)"
          :key="s"
          size="xs"
          :variant="s === 'faite' ? 'solid' : 'soft'"
          :class="s === 'faite' ? 'bg-fc-red' : ''"
          :loading="busy === a.id"
          @click="avancer(a, s)"
        >
          {{ s === 'faite' ? 'Marquer faite' : 'Démarrer' }}
        </UButton>
      </div>
    </article>
  </div>
  <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ emptyText }}</p>
</template>

<script setup lang="ts">
import type { ActionCommerciale, ActionCommercialeStatut } from '~/types'
import { estEnRetard, statutActionColor, statutActionLabel, transitionsAssigne } from '~/utils/actionsCommerciales'
import { isPrivilegedRole } from '~/utils/roles'

const props = withDefaults(defineProps<{
  actions: ActionCommerciale[]
  showPdv?: boolean
  emptyText?: string
}>(), { showPdv: false, emptyText: 'Aucune action.' })
const emit = defineEmits<{ (e: 'changed', action: ActionCommerciale): void }>()

const user = useSupabaseUser()
const authStore = useAuthStore()
const toast = useToast()
const { libelleType, changerStatut } = useActionsCommerciales()
const busy = ref<string | null>(null)

function peutAvancer(a: ActionCommerciale) {
  const moi = user.value?.id
  if (!moi) return false
  return transitionsAssigne(a.statut).length > 0
    && (a.assigne_a === moi || a.auteur_id === moi || isPrivilegedRole(authStore.profile?.role))
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

async function avancer(a: ActionCommerciale, statut: ActionCommercialeStatut) {
  busy.value = a.id
  try {
    await changerStatut(a.id, statut)
    a.statut = statut
    emit('changed', a)
  }
  catch (err: any) {
    toast.add({ title: 'Mise à jour impossible', description: err?.message, color: 'red' })
  }
  finally {
    busy.value = null
  }
}
</script>
