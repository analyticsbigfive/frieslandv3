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
      v-if="!isOnline || pendingCount > 0 || errorCount > 0"
      class="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900/60 dark:bg-amber-950/40"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UIcon :name="!isOnline ? 'i-heroicons-signal-slash' : errorCount > 0 ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-arrow-path'" class="w-4 h-4 text-amber-600 shrink-0" :class="isSyncing ? 'animate-spin' : ''" />
        <span class="truncate text-sm font-medium text-amber-900 dark:text-amber-100">
          <template v-if="!isOnline">
            Mode hors ligne
            <span v-if="pendingCount > 0" class="font-medium">
              - {{ pendingVisitCount }} visite(s) et {{ pendingImageCount }} photo(s) en attente
            </span>
          </template>
          <template v-else-if="errorCount > 0">
            {{ errorVisitCount }} visite(s) et {{ errorImageCount }} photo(s) en erreur
          </template>
          <template v-else>
            {{ pendingVisitCount }} visite(s) et {{ pendingImageCount }} photo(s) en attente de synchronisation
          </template>
          <span v-if="lastSyncError" class="ml-1 font-normal">{{ lastSyncError }}</span>
        </span>
      </div>

      <button
        v-if="errorCount > 0 || pendingCount > 0"
        type="button"
        class="touch-target shrink-0 rounded-lg bg-amber-200 px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-300 active:bg-amber-400"
        :disabled="isSyncing"
        @click="errorCount > 0 ? retryFailed() : processQueue()"
      >
        {{ errorCount > 0 ? 'Réessayer' : isSyncing ? 'Synchronisation...' : 'Synchroniser' }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { isOnline, isSyncing, pendingCount, errorCount, pendingVisitCount, pendingImageCount, errorVisitCount, errorImageCount, lastSyncError, retryFailed, processQueue } = useOfflineSync()
</script>
