<template>
  <div class="form-wizard">
    <!-- Progress Bar -->
    <div class="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 shadow-sm">
      <!-- Step indicators -->
      <div class="px-4 pt-3 pb-1">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Étape {{ currentStep + 1 }} / {{ steps.length }}
          </span>
          <span class="text-xs font-medium text-fc-red">
            {{ Math.round(progressPercent) }}%
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

      <!-- Step tabs (scrollable) -->
      <div class="flex overflow-x-auto scrollbar-hide">
        <button
          v-for="(step, idx) in steps"
          :key="step.key"
          class="flex-1 min-w-[90px] py-2.5 px-2 text-center text-[11px] font-medium border-b-2 transition-all duration-300 whitespace-nowrap relative"
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

    <!-- Step Content with slide animation -->
    <div class="relative overflow-hidden">
      <Transition :name="transitionName" mode="out-in">
        <div :key="currentStep" class="px-4 py-4 pb-32">
          <slot :name="steps[currentStep]?.key" />
        </div>
      </Transition>
    </div>

    <!-- Bottom Navigation -->
    <div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 z-50 safe-area-bottom">
      <!-- Mini progress dots -->
      <div class="flex justify-center gap-1.5 pt-2 pb-1">
        <span
          v-for="(step, idx) in steps"
          :key="'dot-' + step.key"
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="idx === currentStep ? 'bg-fc-red w-6' : idx < currentStep ? 'bg-fc-red-200' : 'bg-gray-200'"
        />
      </div>

      <div class="px-4 pb-3 flex items-center justify-between">
        <button
          class="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2.5 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
          :disabled="currentStep === 0"
          @click="prevStep"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Précédent
        </button>

        <button
          class="text-sm font-medium text-gray-400 px-4 py-2.5 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-600"
          @click="$emit('cancel')"
        >
          Annuler
        </button>

        <button
          v-if="currentStep < steps.length - 1"
          class="flex items-center gap-1 text-sm font-bold text-fc-red px-4 py-2.5 rounded-lg transition-colors hover:bg-red-50"
          @click="nextStep"
        >
          Suivant
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          v-else
          class="flex items-center gap-1.5 text-sm font-bold text-white bg-fc-red px-5 py-2.5 rounded-lg transition-all hover:bg-fc-red-600 disabled:opacity-50 shadow-sm"
          :disabled="saving"
          @click="$emit('submit')"
        >
          <svg v-if="!saving" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ saving ? 'Envoi...' : submitLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface WizardStep {
  key: string
  label: string
  /** Optional: check if this step has been filled/completed */
  validate?: () => boolean
}

const props = withDefaults(defineProps<{
  steps: WizardStep[]
  modelValue?: number
  saving?: boolean
  submitLabel?: string
}>(), {
  modelValue: 0,
  saving: false,
  submitLabel: 'Enregistrer',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'submit'): void
  (e: 'cancel'): void
  (e: 'step-change', step: number): void
}>()

const currentStep = ref(props.modelValue)
const direction = ref<'forward' | 'backward'>('forward')
const visitedSteps = ref(new Set<number>([0]))

watch(() => props.modelValue, (v) => {
  currentStep.value = v
})

const transitionName = computed(() =>
  direction.value === 'forward' ? 'wizard-slide-left' : 'wizard-slide-right',
)

const progressPercent = computed(() =>
  ((currentStep.value + 1) / props.steps.length) * 100,
)

function isStepCompleted(idx: number) {
  if (idx >= currentStep.value) return false
  return visitedSteps.value.has(idx)
}

function getStepClass(idx: number) {
  if (idx === currentStep.value) {
    return 'border-fc-red text-fc-red bg-red-50/50'
  }
  if (isStepCompleted(idx)) {
    return 'border-transparent text-fc-red-300'
  }
  return 'border-transparent text-gray-400'
}

function getStepBadgeClass(idx: number) {
  if (idx === currentStep.value) {
    return 'bg-fc-red text-white'
  }
  if (isStepCompleted(idx)) {
    return 'bg-fc-red-100 text-fc-red'
  }
  return 'bg-gray-100 text-gray-400'
}

function goToStep(idx: number) {
  if (idx === currentStep.value) return
  direction.value = idx > currentStep.value ? 'forward' : 'backward'
  currentStep.value = idx
  visitedSteps.value.add(idx)
  emit('update:modelValue', idx)
  emit('step-change', idx)
}

function prevStep() {
  if (currentStep.value > 0) {
    goToStep(currentStep.value - 1)
  }
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
