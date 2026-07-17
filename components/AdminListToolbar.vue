<template>
  <section class="admin-list-toolbar" aria-label="Filtres de la liste">
    <div class="admin-list-toolbar__main">
      <div v-if="search !== undefined" class="admin-list-toolbar__search">
        <label class="sr-only" :for="searchId">{{ searchLabel }}</label>
        <UInput
          :id="searchId"
          :model-value="search"
          :placeholder="searchPlaceholder"
          icon="i-heroicons-magnifying-glass"
          size="sm"
          @update:model-value="emit('update:search', $event)"
        />
      </div>

      <div class="admin-list-toolbar__filters">
        <slot name="filters" />
      </div>

      <div class="admin-list-toolbar__actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="chips?.length" class="admin-list-toolbar__chips">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        class="admin-list-toolbar__chip"
        :title="`Retirer le filtre ${chip.label}`"
        @click="emit('remove-chip', chip.key)"
      >
        <span>{{ chip.label }}</span>
        <UIcon name="i-heroicons-x-mark" class="h-3.5 w-3.5" />
      </button>
    </div>

    <div class="admin-list-toolbar__footer">
      <span v-if="resultCount !== undefined" class="admin-list-toolbar__count">
        {{ formattedResultCount }}
      </span>
      <UButton
        v-if="showReset"
        size="xs"
        variant="ghost"
        icon="i-heroicons-arrow-path"
        @click="emit('reset')"
      >
        Réinitialiser
      </UButton>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface ToolbarChip { key: string; label: string }

const props = withDefaults(defineProps<{
  search?: string
  searchPlaceholder?: string
  searchLabel?: string
  resultCount?: number
  resultLabel?: string
  showReset?: boolean
  chips?: ToolbarChip[]
}>(), {
  searchPlaceholder: 'Rechercher…',
  searchLabel: 'Rechercher dans la liste',
  resultLabel: 'résultat(s)',
  showReset: true,
})

const emit = defineEmits<{
  (event: 'update:search', value: string): void
  (event: 'reset'): void
  (event: 'remove-chip', key: string): void
}>()

const searchId = 'admin-list-search'
const formattedResultCount = computed(() => `${new Intl.NumberFormat('fr-FR').format(props.resultCount ?? 0)} ${props.resultLabel}`)
</script>
