<template>
  <div class="pb-20 min-h-full bg-gray-50">
    <!-- Date header -->
    <div class="px-4 pt-4 pb-2">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Mon routing</p>
            <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ todayLabel }}</p>
          </div>
          <UButton variant="ghost" icon="i-heroicons-arrow-path" size="sm" :loading="routingStore.loading" @click="refreshRouting" />
        </div>

        <!-- Progress bar -->
        <template v-if="routingStore.todayRouting">
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="text-gray-500 dark:text-gray-400">Progression</span>
            <span class="font-bold" :class="routingStore.progressPercent >= 100 ? 'text-emerald-600' : 'text-fc-red'">
              {{ routingStore.completedCount }}/{{ routingStore.totalCount }}
            </span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2.5">
            <div
              class="h-2.5 rounded-full transition-all duration-500"
              :class="routingStore.progressPercent >= 100 ? 'bg-emerald-500' : 'bg-fc-red'"
              :style="{ width: `${routingStore.progressPercent}%` }"
            />
          </div>
          <UBadge :color="routingStatusColor" variant="soft" size="xs" class="mt-2">
            {{ routingStatusLabel }}
          </UBadge>
        </template>
      </div>
    </div>

    <!-- No routing -->
    <div v-if="!routingStore.loading && !routingStore.todayRouting" class="px-4 py-12 text-center">
      <div class="w-20 h-20 mx-auto mb-4 bg-red-50 rounded-2xl flex items-center justify-center">
        <UIcon name="i-heroicons-map" class="w-10 h-10 text-fc-red opacity-50" />
      </div>
      <p class="text-gray-500 dark:text-gray-400 font-medium">Aucun routing prévu</p>
      <p class="text-gray-400 text-sm mt-1">Votre superviseur n'a pas encore assigné de visites pour aujourd'hui</p>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="routingStore.loading" class="px-4 py-4 space-y-3">
      <div v-for="i in 4" :key="i" class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm animate-pulse">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gray-200" />
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-gray-200 rounded w-2/3" />
            <div class="h-3 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
      </div>
    </div>

    <!-- PDV routing list -->
    <div v-else class="px-4 py-2 space-y-3">
      <div
        v-for="(rp, idx) in routingStore.routingPDVList"
        :key="rp.id"
        class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border-l-4 transition-all"
        :class="borderClass(rp)"
      >
        <div class="p-4">
          <div class="flex items-start gap-3">
            <!-- Step number -->
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              :class="stepCircleClass(rp)"
            >
              <template v-if="rp.status === 'completed'">
                <UIcon name="i-heroicons-check" class="w-5 h-5" />
              </template>
              <template v-else-if="rp.status === 'skipped'">
                <UIcon name="i-heroicons-minus" class="w-5 h-5" />
              </template>
              <template v-else>
                {{ idx + 1 }}
              </template>
            </div>

            <!-- PDV Info -->
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-gray-900 dark:text-gray-100 text-sm">{{ rp.pdv?.nom_pdv || rp.pdv_id }}</h3>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ rp.pdv?.zone || '' }}{{ rp.pdv?.secteur ? ` — ${rp.pdv.secteur}` : '' }}
              </p>
              <p v-if="rp.pdv?.adressage" class="text-xs text-gray-400">{{ rp.pdv.adressage }}</p>

              <!-- Objectifs -->
              <div v-if="hasObjectifs(rp)" class="flex flex-wrap gap-1 mt-2">
                <UBadge v-if="rp.objectifs.releve_stock" variant="soft" color="blue" size="xs">📦 Stock</UBadge>
                <UBadge v-if="rp.objectifs.encaissement" variant="soft" color="green" size="xs">💰 Encais.</UBadge>
                <UBadge v-if="rp.objectifs.photos" variant="soft" color="purple" size="xs">📸 Photos</UBadge>
                <UBadge v-if="rp.objectifs.merchandising" variant="soft" color="amber" size="xs">🏪 Merch.</UBadge>
                <UBadge v-if="rp.objectifs.prospection" variant="soft" color="cyan" size="xs">🔍 Prosp.</UBadge>
                <span v-if="rp.objectifs.custom" class="text-xs text-gray-500 dark:text-gray-400">{{ rp.objectifs.custom }}</span>
              </div>

              <!-- Timestamps -->
              <div v-if="rp.arrived_at || rp.completed_at" class="flex gap-3 mt-2 text-[10px] text-gray-400">
                <span v-if="rp.arrived_at">⏱ Arrivée {{ formatTime(rp.arrived_at) }}</span>
                <span v-if="rp.completed_at">✅ Terminé {{ formatTime(rp.completed_at) }}</span>
              </div>

              <!-- Geofence validated -->
              <div v-if="rp.geofence_validated" class="mt-1">
                <span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">GPS ✓ validé</span>
              </div>
            </div>

            <!-- Status badge -->
            <UBadge :color="pdvStatusColor(rp.status)" variant="soft" size="xs">
              {{ pdvStatusLabel(rp.status) }}
            </UBadge>
          </div>

          <!-- Action buttons -->
          <div v-if="rp.status === 'pending' || rp.status === 'in_progress'" class="mt-4 flex gap-2">
            <template v-if="rp.status === 'pending'">
              <UButton
                size="sm"
                class="flex-1 bg-fc-red hover:bg-fc-red/90"
                icon="i-heroicons-play"
                :loading="isValidating && activeRpId === rp.id"
                @click="handleStartMission(rp)"
              >
                Démarrer
              </UButton>
              <UButton
                size="sm"
                variant="soft"
                color="gray"
                icon="i-heroicons-forward"
                @click="handleSkip(rp)"
              >
                Passer
              </UButton>
            </template>
            <template v-if="rp.status === 'in_progress'">
              <UButton
                size="sm"
                class="flex-1 bg-emerald-600 hover:bg-emerald-700"
                icon="i-heroicons-clipboard-document-check"
                @click="handleStartVisite(rp)"
              >
                Remplir la visite
              </UButton>
              <UButton
                size="sm"
                variant="soft"
                color="green"
                icon="i-heroicons-check"
                @click="handleCompleteDirect(rp)"
              >
                Terminer
              </UButton>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Geofence alert modal -->
    <UModal v-model="showGeofenceAlert">
      <div class="p-6 text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
          <UIcon name="i-heroicons-map-pin" class="w-8 h-8 text-red-500" />
        </div>
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Hors zone</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ geofenceAlertMessage }}</p>
        <UButton variant="ghost" @click="showGeofenceAlert = false">Compris</UButton>
      </div>
    </UModal>

    <!-- Skip reason modal -->
    <UModal v-model="showSkipModal">
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Passer ce PDV</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Indiquez une raison (optionnel)</p>
        <UTextarea v-model="skipReason" placeholder="PDV fermé, inaccessible..." :rows="2" />
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="showSkipModal = false">Annuler</UButton>
          <UButton color="amber" @click="confirmSkip">Confirmer</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { RoutingPDV } from '~/types'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const user = useSupabaseUser()
const authStore = useAuthStore()
const routingStore = useRoutingStore()
const { startMission, skipMission, completeMission, isValidating, validationError } = useRouting()

const showGeofenceAlert = ref(false)
const geofenceAlertMessage = ref('')
const showSkipModal = ref(false)
const skipReason = ref('')
const skipTarget = ref<RoutingPDV | null>(null)
const activeRpId = ref('')

const todayLabel = computed(() =>
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })
)

const routingStatusColor = computed(() => {
  const s = routingStore.todayRouting?.status
  if (s === 'completed') return 'green'
  if (s === 'in_progress') return 'blue'
  return 'amber'
})

const routingStatusLabel = computed(() => {
  const s = routingStore.todayRouting?.status
  if (s === 'completed') return '✅ Terminé'
  if (s === 'in_progress') return '🔄 En cours'
  return '⏳ En attente'
})

function borderClass(rp: RoutingPDV) {
  if (rp.status === 'completed') return 'border-emerald-500'
  if (rp.status === 'in_progress') return 'border-amber-500'
  if (rp.status === 'skipped') return 'border-gray-300'
  return 'border-gray-200 dark:border-gray-600'
}

function stepCircleClass(rp: RoutingPDV) {
  if (rp.status === 'completed') return 'bg-emerald-500 text-white'
  if (rp.status === 'in_progress') return 'bg-amber-500 text-white'
  if (rp.status === 'skipped') return 'bg-gray-300 text-white'
  return 'bg-gray-100 text-gray-600'
}

function pdvStatusColor(s: string): any {
  return { pending: 'gray', in_progress: 'amber', completed: 'green', skipped: 'orange' }[s] || 'gray'
}

function pdvStatusLabel(s: string) {
  return { pending: 'En attente', in_progress: 'En cours', completed: 'Fait', skipped: 'Passé' }[s] || s
}

function hasObjectifs(rp: RoutingPDV) {
  const o = rp.objectifs
  return o && (o.releve_stock || o.encaissement || o.photos || o.merchandising || o.prospection || o.custom)
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

async function handleStartMission(rp: RoutingPDV) {
  activeRpId.value = rp.id
  const ok = await startMission(rp)

  if (!ok && validationError.value) {
    geofenceAlertMessage.value = validationError.value
    showGeofenceAlert.value = true
  }
  activeRpId.value = ''
}

function handleSkip(rp: RoutingPDV) {
  skipTarget.value = rp
  skipReason.value = ''
  showSkipModal.value = true
}

async function confirmSkip() {
  if (skipTarget.value) {
    await skipMission(skipTarget.value, skipReason.value || undefined)
    showSkipModal.value = false
    skipTarget.value = null
  }
}

function handleStartVisite(rp: RoutingPDV) {
  // Navigate to visite creation with pre-selected PDV + routing context
  navigateTo({
    path: '/mobile/visites/new',
    query: {
      pdv_id: rp.pdv_id,
      routing_pdv_id: rp.id,
    },
  })
}

async function handleCompleteDirect(rp: RoutingPDV) {
  await completeMission(rp)
}

async function refreshRouting() {
  if (!authStore.profile) await authStore.fetchProfile()
  if (user.value?.id) {
    await routingStore.fetchTodayRouting(user.value.id)
  }
}

onMounted(async () => {
  await refreshRouting()
})
</script>
