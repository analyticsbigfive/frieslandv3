<template>
  <Teleport to="body">
    <Transition name="save-overlay">
      <div
        v-if="visible"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      >
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mx-6 max-w-sm w-full text-center transform">
          <!-- Saving state -->
          <Transition name="save-state" mode="out-in">
            <div v-if="status === 'saving'" key="saving">
              <!-- Animated spinner -->
              <div class="relative w-20 h-20 mx-auto mb-5">
                <svg class="w-20 h-20 animate-spin-slow" viewBox="0 0 80 80">
                  <circle
                    class="text-gray-100"
                    cx="40" cy="40" r="34"
                    stroke="currentColor" stroke-width="6" fill="none"
                  />
                  <circle
                    class="text-fc-red"
                    cx="40" cy="40" r="34"
                    stroke="currentColor" stroke-width="6" fill="none"
                    stroke-linecap="round"
                    :stroke-dasharray="dashArray"
                    :stroke-dashoffset="dashOffset"
                    style="transition: stroke-dashoffset 0.4s ease"
                  />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-sm font-bold text-fc-red">{{ Math.round(progress) }}%</span>
                </div>
              </div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{{ savingTitle }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ savingMessage }}</p>

              <!-- Animated dots -->
              <div class="flex justify-center gap-1 mt-3">
                <span class="w-1.5 h-1.5 bg-fc-red rounded-full animate-bounce-dot" style="animation-delay: 0s" />
                <span class="w-1.5 h-1.5 bg-fc-red rounded-full animate-bounce-dot" style="animation-delay: 0.15s" />
                <span class="w-1.5 h-1.5 bg-fc-red rounded-full animate-bounce-dot" style="animation-delay: 0.3s" />
              </div>
            </div>

            <!-- Success state -->
            <div v-else-if="status === 'success'" key="success">
              <div class="w-20 h-20 mx-auto mb-5 bg-emerald-50 rounded-full flex items-center justify-center animate-success-pop">
                <svg class="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <path
                    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                    d="M5 13l4 4L19 7"
                    class="animate-check-draw"
                  />
                </svg>
              </div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{{ successTitle }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ successMessage }}</p>
            </div>

            <!-- Error state -->
            <div v-else-if="status === 'error'" key="error">
              <div class="w-20 h-20 mx-auto mb-5 bg-red-50 rounded-full flex items-center justify-center animate-success-pop">
                <svg class="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{{ errorTitle }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ errorMessage }}</p>
              <button
                class="mt-4 px-6 py-2 bg-fc-red text-white text-sm font-medium rounded-lg hover:bg-fc-red-600 transition-colors"
                @click="$emit('retry')"
              >
                Réessayer
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  visible: boolean
  status: 'saving' | 'success' | 'error'
  progress?: number
  savingTitle?: string
  savingMessage?: string
  successTitle?: string
  successMessage?: string
  errorTitle?: string
  errorMessage?: string
  autoClose?: number
}>(), {
  progress: 0,
  savingTitle: 'Enregistrement en cours',
  savingMessage: 'Veuillez patienter...',
  successTitle: 'Enregistré avec succès !',
  successMessage: 'Les données ont été sauvegardées.',
  errorTitle: 'Erreur',
  errorMessage: 'Une erreur est survenue.',
  autoClose: 1500,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'retry'): void
  (e: 'closed'): void
}>()

const circumference = 2 * Math.PI * 34 // r=34
const dashArray = `${circumference}`
const dashOffset = computed(() =>
  circumference - (props.progress / 100) * circumference,
)

// Auto-close on success
watch(() => props.status, (newStatus) => {
  if (newStatus === 'success' && props.autoClose > 0) {
    setTimeout(() => {
      emit('update:visible', false)
      emit('closed')
    }, props.autoClose)
  }
})
</script>

<style scoped>
/* Overlay transition */
.save-overlay-enter-active {
  transition: all 0.3s ease-out;
}
.save-overlay-leave-active {
  transition: all 0.2s ease-in;
}
.save-overlay-enter-from {
  opacity: 0;
}
.save-overlay-enter-from > div {
  transform: scale(0.9);
}
.save-overlay-leave-to {
  opacity: 0;
}

/* State swap transition */
.save-state-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.save-state-leave-active {
  transition: all 0.2s ease-in;
}
.save-state-enter-from {
  opacity: 0;
  transform: scale(0.85) translateY(10px);
}
.save-state-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Custom animations */
@keyframes spin-slow {
  to { transform: rotate(360deg); }
}
.animate-spin-slow {
  animation: spin-slow 2s linear infinite;
}

@keyframes bounce-dot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.animate-bounce-dot {
  animation: bounce-dot 1.2s ease-in-out infinite;
}

@keyframes success-pop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
.animate-success-pop {
  animation: success-pop 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes check-draw {
  0% { stroke-dashoffset: 30; }
  100% { stroke-dashoffset: 0; }
}
.animate-check-draw {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: check-draw 0.4s ease-out 0.3s forwards;
}
</style>
