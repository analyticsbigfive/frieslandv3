<template>
  <div class="admin-pagination">
    <p class="admin-pagination__summary">
      {{ formattedTotal }} {{ itemLabel }}<template v-if="pageCount > 1"> · page {{ page }} / {{ pageCount }}</template>
    </p>
    <div class="admin-pagination__actions">
      <UButton
        size="xs"
        variant="outline"
        :disabled="page <= 1 || loading"
        @click="emit('previous')"
      >
        Précédent
      </UButton>
      <UButton
        size="xs"
        variant="outline"
        :disabled="page >= pageCount || loading"
        @click="emit('next')"
      >
        Suivant
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  total: number
  page: number
  pageSize: number
  loading?: boolean
  itemLabel?: string
}>(), {
  loading: false,
  itemLabel: 'résultat(s)',
})

const emit = defineEmits<{
  (event: 'previous'): void
  (event: 'next'): void
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const formattedTotal = computed(() => new Intl.NumberFormat('fr-FR').format(props.total))
</script>
