<template>
  <div class="form-wizard">
    <!-- Progress Bar -->
    <div class="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
      <!-- Step indicators -->
      <div class="px-4 pt-3 pb-1">
        <div class="mb-2 flex items-center justify-between gap-3">
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400" aria-live="polite">
            Étape {{ currentStep + 1 }} sur {{ steps.length }}
          </span>
          <span class="truncate text-right text-[11px] font-semibold text-fc-red">
            <span v-if="currentPhaseNumber">Phase {{ currentPhaseNumber }}/{{ phases.length }} · </span>{{ currentPhaseLabel }}
          </span>
        </div>
        <!-- Animated progress bar -->
        <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-fc-red to-fc-red-400 rounded-full transition-all duration-500 ease-out"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
      </div>

      <!-- Compact section picker on small screens: all sections remain reachable. -->
      <div class="px-4 pb-2 sm:hidden">
        <label for="wizard-section" class="sr-only">Section de la visite</label>
        <select
          id="wizard-section"
          :value="currentStep"
          class="min-h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none transition focus:border-fc-red focus:ring-2 focus:ring-fc-red/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          @change="selectStep"
        >
          <option v-for="(step, idx) in steps" :key="step.key" :value="idx">
            {{ idx + 1 }} · {{ step.label }}{{ stepStateLabel(step.key) }}
          </option>
        </select>
      </div>

      <!-- Step tabs (scrollable) -->
      <div class="hidden overflow-x-auto scrollbar-hide sm:flex" role="tablist" aria-label="Étapes de la visite">
        <button
          v-for="(step, idx) in steps"
          :key="step.key"
          type="button"
          class="relative min-h-11 min-w-[88px] flex-none whitespace-nowrap border-b-2 px-2 py-2.5 text-center text-[11px] font-semibold transition-all duration-300 sm:min-w-[96px] sm:flex-1"
          role="tab"
          :aria-selected="idx === currentStep"
          :aria-current="idx === currentStep ? 'step' : undefined"
          :aria-label="`Aller à l'étape ${idx + 1}: ${step.label}`"
          :class="getStepClass(idx)"
          @click="goToStep(idx)"
        >
          <!-- Step number badge -->
          <span
            class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1 transition-all duration-300"
            :class="getStepBadgeClass(idx)"
          >
            <svg v-if="isStepCompleted(idx)" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>{{ idx + 1 }}</span>
          </span>
          {{ step.label }}
        </button>
      </div>
    </div>

    <!-- Step Content with slide animation (swipe gauche/droite au doigt) -->
    <div
      class="relative overflow-hidden"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <Transition :name="transitionName" mode="out-in">
        <div :key="currentStep" class="px-4 py-4 pb-32">
          <slot :name="steps[currentStep]?.key" />
        </div>
      </Transition>
    </div>

    <!-- Bottom Navigation -->
    <div class="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-gray-600 dark:bg-gray-900/95 safe-area-bottom">
      <div class="flex items-center justify-between px-4 pt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
        <span>{{ currentStep + 1 }} / {{ steps.length }} · {{ steps[currentStep]?.label }}</span>
        <span v-if="currentStep < steps.length - 1">Faites défiler ou utilisez la liste</span>
        <span v-else>Dernière vérification</span>
      </div>

      <div class="grid grid-cols-[auto_1fr] items-center gap-3 px-4 pb-3">
        <button
          type="button"
          class="touch-target whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 active:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          @click="$emit('cancel')"
        >
          Annuler
        </button>

        <div class="flex justify-end gap-2">
          <button
            v-if="currentStep > 0"
            type="button"
            class="touch-target inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            @click="prevStep"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            Précédent
          </button>

          <button
            v-if="currentStep < steps.length - 1"
            type="button"
            class="touch-target inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-fc-red px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-fc-red-600 active:scale-[0.98]"
            @click="nextStep"
          >
            Suivant
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            v-else
            type="button"
            class="touch-target inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-fc-red px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-fc-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            @click="$emit('submit')"
          >
            <svg v-if="!saving" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ saving ? 'Envoi...' : submitLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface WizardStep {
  key: string
  label: string
  phase?: string
  /** Optional: check if this step has been filled/completed */
  validate?: () => boolean
}

export type WizardStepState = 'empty' | 'partial' | 'complete' | 'warning'

const props = withDefaults(defineProps<{
  steps: WizardStep[]
  modelValue?: number
  saving?: boolean
  submitLabel?: string
  stepStates?: Record<string, WizardStepState>
}>(), {
  modelValue: 0,
  saving: false,
  submitLabel: 'Enregistrer',
  stepStates: () => ({}),
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'submit'): void
  (e: 'cancel'): void
  (e: 'step-change', step: number): void
}>()

const currentStep = ref(props.modelValue)
const direction = ref<'forward' | 'backward'>('forward')

watch(() => props.modelValue, (v) => {
  currentStep.value = v
})

const transitionName = computed(() =>
  direction.value === 'forward' ? 'wizard-slide-left' : 'wizard-slide-right',
)

const progressPercent = computed(() =>
  ((currentStep.value + 1) / props.steps.length) * 100,
)

const phases = computed(() => {
  const unique = new Set<string>()
  props.steps.forEach((step) => {
    if (step.phase) unique.add(step.phase)
  })
  return [...unique]
})

const currentPhaseLabel = computed(() => props.steps[currentStep.value]?.phase || '')
const currentPhaseNumber = computed(() => {
  if (!currentPhaseLabel.value) return 0
  return phases.value.indexOf(currentPhaseLabel.value) + 1
})

function isStepCompleted(idx: number) {
  if (idx >= currentStep.value) return false
  const key = props.steps[idx]?.key
  return !!key && props.stepStates[key] === 'complete'
}

function stepStateLabel(key: string) {
  const state = props.stepStates[key]
  if (state === 'complete') return ' · terminé'
  if (state === 'partial') return ' · en cours'
  if (state === 'warning') return ' · à vérifier'
  return ''
}

function getStepClass(idx: number) {
  if (idx === currentStep.value) {
    return 'border-fc-red text-fc-red bg-red-50/50'
  }
  if (isStepCompleted(idx)) {
    return 'border-transparent text-fc-red-300'
  }
  const key = props.steps[idx]?.key
  const state = key ? props.stepStates[key] : undefined
  if (state === 'warning') return 'border-transparent text-red-500'
  if (state === 'partial') return 'border-transparent text-amber-600'
  return 'border-transparent text-gray-400'
}

function getStepBadgeClass(idx: number) {
  if (idx === currentStep.value) {
    return 'bg-fc-red text-white'
  }
  if (isStepCompleted(idx)) {
    return 'bg-fc-red-100 text-fc-red'
  }
  const key = props.steps[idx]?.key
  const state = key ? props.stepStates[key] : undefined
  if (state === 'warning') return 'bg-red-100 text-red-600'
  if (state === 'partial') return 'bg-amber-100 text-amber-700'
  if (state === 'complete') return 'bg-emerald-100 text-emerald-700'
  return 'bg-gray-100 text-gray-400'
}

function selectStep(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (Number.isInteger(value)) goToStep(value)
}

function goToStep(idx: number) {
  if (idx === currentStep.value) return
  direction.value = idx > currentStep.value ? 'forward' : 'backward'
  currentStep.value = idx
  emit('update:modelValue', idx)
  emit('step-change', idx)
}

function prevStep() {
  if (currentStep.value > 0) {
    goToStep(currentStep.value - 1)
  }
}

// --- Swipe tactile entre étapes ---
const touchStartX = ref(0)
const touchStartY = ref(0)
function onTouchStart(e: TouchEvent) {
  const t = e.changedTouches[0]
  touchStartX.value = t.clientX
  touchStartY.value = t.clientY
}
function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX.value
  const dy = t.clientY - touchStartY.value
  // Ignorer si geste trop court ou plutôt vertical (scroll de la liste)
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  if (dx < 0) nextStep()
  else prevStep()
}

function nextStep() {
  const step = props.steps[currentStep.value]
  if (step.validate && !step.validate()) return

  if (currentStep.value < props.steps.length - 1) {
    goToStep(currentStep.value + 1)
  }
}

defineExpose({ goToStep, prevStep, nextStep })
</script>

<style scoped>
/* Slide left (forward) */
.wizard-slide-left-enter-active,
.wizard-slide-left-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.wizard-slide-left-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.wizard-slide-left-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}

/* Slide right (backward) */
.wizard-slide-right-enter-active,
.wizard-slide-right-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.wizard-slide-right-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}

.wizard-slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* Hide scrollbar for step tabs */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
