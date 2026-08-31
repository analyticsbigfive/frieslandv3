<template>
  <div class="admin-pagination">
    <p class="admin-pagination__summary">
      {{ formattedTotal }} {{ itemLabel }}<template v-if="pageCount > 1"> · page {{ page }} / {{ pageCount }}</template>
    </p>
    <div v-if="pageCount > 1" class="admin-pagination__actions">
      <UPagination
        :model-value="page"
        :total="total"
        :page-count="pageSize"
        :max="7"
        size="xs"
        :disabled="loading"
        @update:model-value="onPageChange"
      />
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
  (event: 'update:page', page: number): void
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const formattedTotal = computed(() => new Intl.NumberFormat('fr-FR').format(props.total))

function onPageChange(newPage: number) {
  if (newPage === props.page || props.loading) return
  emit('update:page', newPage)
}
</script>
