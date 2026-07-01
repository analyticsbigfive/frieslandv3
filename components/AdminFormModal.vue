<template>
  <UModal
    v-model="isOpen"
    :ui="{
      width: `w-full ${width}`,
      rounded: 'rounded-2xl',
      shadow: 'shadow-2xl shadow-slate-900/15',
    }"
  >
    <div class="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
      <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-7 dark:border-slate-700 dark:bg-slate-800/80">
        <div class="flex min-w-0 items-start gap-3.5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fc-blue-50 text-fc-blue-600 ring-1 ring-inset ring-fc-blue-100 dark:bg-fc-blue-900/30 dark:text-fc-blue-300 dark:ring-fc-blue-800">
            <UIcon :name="icon" class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <h2 class="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              {{ title }}
            </h2>
            <p v-if="description" class="mt-1 max-w-2xl text-sm leading-5 text-slate-500 dark:text-slate-400">
              {{ description }}
            </p>
          </div>
        </div>
        <UButton
          type="button"
          color="gray"
          variant="ghost"
          icon="i-heroicons-x-mark"
          aria-label="Fermer"
          class="-mr-2 shrink-0 rounded-lg focus-visible:ring-fc-blue-500 dark:focus-visible:ring-fc-blue-400"
          @click="isOpen = false"
        />
      </header>

      <component
        :is="asForm ? 'form' : 'div'"
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
        @submit="onSubmit"
      >
        <div
          class="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7"
          :class="bodyClass"
        >
          <slot />
        </div>

        <footer
          v-if="$slots.footer"
          class="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-7 dark:border-slate-700 dark:bg-slate-800"
          :class="requiredNote ? 'sm:justify-between' : 'sm:justify-end'"
        >
          <p v-if="requiredNote" class="text-xs text-slate-500 dark:text-slate-400">
            <span class="font-semibold text-fc-blue">*</span> Champ obligatoire
          </p>
          <div class="flex items-center justify-end gap-3">
            <slot name="footer" />
          </div>
        </footer>
      </component>
    </div>
  </UModal>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  description?: string
  icon?: string
  width?: string
  bodyClass?: string
  asForm?: boolean
  requiredNote?: boolean
}>(), {
  description: '',
  icon: 'i-heroicons-plus',
  width: 'sm:max-w-2xl',
  bodyClass: 'space-y-7',
  asForm: false,
  requiredNote: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit'): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function onSubmit(event: Event) {
  if (!props.asForm) return
  event.preventDefault()
  emit('submit')
}
</script>
