<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="!isOnline || errorCount > 0"
      class="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UIcon name="i-heroicons-wifi" class="w-4 h-4 text-amber-600 shrink-0" />
        <span class="text-sm text-amber-800 truncate">
          <template v-if="!isOnline">
            Mode hors ligne
            <span v-if="pendingCount > 0" class="font-medium">
              — {{ pendingCount }} en attente
            </span>
          </template>
          <template v-else-if="errorCount > 0">
            {{ errorCount }} synchronisation(s) en erreur
          </template>
        </span>
      </div>

      <button
        v-if="errorCount > 0"
        class="shrink-0 text-xs font-medium text-amber-700 bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded-md transition-colors"
        @click="retryFailed()"
      >
        Réessayer
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { isOnline, pendingCount, errorCount, retryFailed } = useOfflineSync()
</script>
