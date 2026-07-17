<template>
  <div class="relative">
    <UInput
      :model-value="modelValue"
      :placeholder="placeholder"
      :size="(size as any)"
      autocomplete="off"
      :loading="searching"
      @update:model-value="onInput"
      @focus="open = suggestions.length > 0"
      @blur="onBlur"
      @keydown.escape="open = false"
    />
    <ul
      v-if="open && suggestions.length"
      class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
    >
      <li v-for="s in suggestions" :key="s">
        <button
          type="button"
          class="block w-full truncate px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
          @mousedown.prevent="select(s)"
        >
          {{ s }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// Champ « Rechercher un PDV » avec autosuggestions (noms de PDV depuis la table
// pdv, ilike, débouncé). La valeur reste du texte libre : les suggestions ne
// font qu'accélérer la saisie. @select est émis quand une suggestion est choisie.
const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  size?: string
  /** Périmètre optionnel : restreint les suggestions aux PDV du territoire/area/quartier. */
  scopeZone?: string
  scopeAreaCode?: string
  scopeQuartier?: string
}>(), {
  placeholder: 'Nom du PDV…',
  size: 'sm',
  scopeZone: '',
  scopeAreaCode: '',
  scopeQuartier: '',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'select', value: string): void
}>()

const supabase = useSupabaseClient()
const suggestions = ref<string[]>([])
const open = ref(false)
const searching = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

function onInput(value: string) {
  emit('update:modelValue', value)
  if (timer) clearTimeout(timer)
  const q = value.trim()
  if (q.length < 2) {
    suggestions.value = []
    open.value = false
    return
  }
  timer = setTimeout(() => fetchSuggestions(q), 250)
}

async function fetchSuggestions(q: string) {
  const id = ++requestId
  searching.value = true
  try {
    let query = supabase
      .from('pdv')
      .select('nom_pdv')
      .ilike('nom_pdv', `%${q}%`)
    if (props.scopeZone) query = query.eq('zone', props.scopeZone)
    if (props.scopeAreaCode) query = query.eq('area_code', props.scopeAreaCode)
    if (props.scopeQuartier) query = query.eq('quartier', props.scopeQuartier)
    const { data, error } = await query.order('nom_pdv').limit(8)
    if (id !== requestId) return
    suggestions.value = error ? [] : [...new Set((data || []).map((r: any) => r.nom_pdv).filter(Boolean))] as string[]
    open.value = suggestions.value.length > 0
  }
  finally {
    if (id === requestId) searching.value = false
  }
}

function select(value: string) {
  emit('update:modelValue', value)
  open.value = false
  suggestions.value = []
  emit('select', value)
}

function onBlur() {
  // Laisse le mousedown de la suggestion s'exécuter avant la fermeture.
  setTimeout(() => { open.value = false }, 150)
}
</script>
