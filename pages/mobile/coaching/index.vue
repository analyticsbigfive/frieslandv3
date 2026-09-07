<template>
  <div class="mobile-page">
    <div class="space-y-3 p-4">
      <UButton v-if="peutCreer" block size="lg" icon="i-heroicons-plus" class="bg-fc-red" @click="navigateTo('/mobile/coaching/new')">
        Nouveau field coaching
      </UButton>
      <div class="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer">
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
    </div>

    <div v-if="loading" class="space-y-3 px-4">
      <div v-for="i in 4" :key="i" class="mobile-card animate-pulse p-4">
        <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        <div class="mt-2 h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    </div>

    <div v-else-if="filtres_.length" class="space-y-3 px-4">
      <article
        v-for="c in filtres_"
        :key="c.id"
        class="mobile-card cursor-pointer p-4 transition-colors hover:bg-red-50/40 dark:hover:bg-red-950/20"
        role="button"
        tabindex="0"
        @click="navigateTo(`/mobile/coaching/${c.id}`)"
        @keydown.enter="navigateTo(`/mobile/coaching/${c.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate font-bold text-gray-900 dark:text-gray-100">{{ c.pdv?.nom_pdv || c.pdv_id }}</h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ c.distributeur_nom || '—' }} · {{ libelleEngin(c.engin_code) }}</p>
          </div>
          <UBadge :color="couleurScore(scoreCoaching(c.reponses).taux)" variant="subtle" size="xs">
            {{ scoreCoaching(c.reponses).taux == null ? 'N/A' : scoreCoaching(c.reponses).taux + ' %' }}
          </UBadge>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span><UIcon name="i-heroicons-calendar" class="mr-0.5 inline h-3 w-3" />{{ formatDate(c.date_coaching) }}</span>
          <span v-if="c.pdv?.zone">{{ c.pdv.zone }}</span>
          <span v-if="c.assigne?.nom && c.assigne_a !== c.auteur_id"><UIcon name="i-heroicons-arrow-right-circle" class="mr-0.5 inline h-3 w-3" />{{ c.assigne.nom }}</span>
          <span v-else-if="c.auteur?.nom">par {{ c.auteur.nom }}</span>
        </div>
      </article>
    </div>

    <div v-else class="px-4 py-14 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
        <UIcon name="i-heroicons-academic-cap" class="h-8 w-8 text-fc-red" />
      </div>
      <p class="font-semibold text-gray-700 dark:text-gray-200">Aucun field coaching</p>
      <p class="mx-auto mt-1 max-w-[260px] text-sm text-gray-500 dark:text-gray-400">Les coachings de votre périmètre et ceux qui vous sont transférés apparaîtront ici.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FieldCoaching } from '~/types'
import { scoreCoaching } from '~/utils/fieldCoaching'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const authStore = useAuthStore()
const user = useSupabaseUser()
const { lister, engins, chargerReferentiels } = useFieldCoaching()

const coachings = ref<FieldCoaching[]>([])
const loading = ref(true)
const filtre = ref<'mes' | 'transferes' | 'tous'>('tous')
const filtres = [
  { value: 'tous' as const, label: 'Tous' },
  { value: 'mes' as const, label: 'Les miens' },
  { value: 'transferes' as const, label: 'Reçus' },
]
const peutCreer = computed(() => authStore.isCommercial || authStore.isSuperviseur)

function correspond(c: FieldCoaching, f: typeof filtre.value) {
  if (f === 'mes') return c.auteur_id === user.value?.id
  if (f === 'transferes') return c.assigne_a === user.value?.id && c.auteur_id !== user.value?.id
  return true
}
const filtres_ = computed(() => coachings.value.filter(c => correspond(c, filtre.value)))
function compte(f: typeof filtre.value) { return coachings.value.filter(c => correspond(c, f)).length }
function libelleEngin(code?: string | null) { return engins.value.find(e => e.code === code)?.libelle || code || '—' }
function couleurScore(t: number | null) { return t == null ? 'gray' : t >= 70 ? 'green' : t >= 40 ? 'orange' : 'red' }
function formatDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }

onMounted(async () => {
  if (!authStore.profile) await authStore.fetchProfile()
  void chargerReferentiels()
  try { coachings.value = await lister() }
  catch (err) { console.warn('Field coaching : chargement impossible', err) }
  finally { loading.value = false }
})
</script>
