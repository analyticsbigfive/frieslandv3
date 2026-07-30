<template>
  <div class="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
    <div>
      <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Autre(s) concurrent(s)</h4>
      <p class="mt-0.5 text-xs text-gray-400">
        Un concurrent qui n'est pas dans les listes ci-dessus. Le nom est obligatoire :
        c'est lui qui permet de le retrouver agrégé dans le tableau de bord.
      </p>
    </div>

    <div
      v-for="(c, idx) in model"
      :key="idx"
      class="space-y-3 rounded-lg border border-gray-100 p-3 dark:border-gray-700"
    >
      <div class="flex items-start gap-2">
        <div class="flex-1 space-y-1">
          <label class="text-sm font-medium text-gray-600">Nom du concurrent *</label>
          <UInput
            :model-value="c.nom"
            placeholder="Ex. Cowmilk"
            size="lg"
            @update:model-value="majChamp(idx, 'nom', $event)"
          />
        </div>
        <UButton
          class="mt-6"
          color="red"
          variant="ghost"
          icon="i-heroicons-trash"
          :aria-label="`Retirer le concurrent ${idx + 1}`"
          @click="retirer(idx)"
        />
      </div>

      <ConcurrentActivite
        :en-activite="c.en_activite"
        :action="c.action_concurrence"
        @update:en-activite="majChamp(idx, 'en_activite', $event)"
        @update:action="majChamp(idx, 'action_concurrence', $event)"
      />

      <div class="space-y-1">
        <label class="text-sm font-medium text-gray-600">Photo (optionnelle)</label>
        <div class="flex items-center gap-3">
          <img v-if="c.photo_url" :src="c.photo_url" alt="" class="h-16 w-16 rounded-lg object-cover" />
          <input
            :id="`photo-concurrent-${idx}`"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="choisirPhoto(idx, $event)"
          />
          <UButton
            variant="outline"
            size="sm"
            icon="i-heroicons-camera"
            :loading="indexEnUpload === idx"
            @click="ouvrirSelecteur(idx)"
          >
            {{ c.photo_url ? 'Remplacer' : 'Ajouter une photo' }}
          </UButton>
        </div>
      </div>
    </div>

    <UButton variant="soft" size="sm" icon="i-heroicons-plus" @click="ajouter">
      Signaler un concurrent
    </UButton>
  </div>
</template>

<script setup lang="ts">
import type { ConcurrentSignale } from '~/types'

const props = defineProps<{ modelValue?: ConcurrentSignale[] }>()
const emit = defineEmits<{ 'update:modelValue': [ConcurrentSignale[]] }>()

const { uploadImage } = useImageUpload()
const toast = useToast()
const indexEnUpload = ref<number | null>(null)

const model = computed(() => props.modelValue || [])

function ecrire(liste: ConcurrentSignale[]) {
  emit('update:modelValue', liste)
}

function ajouter() {
  ecrire([...model.value, { nom: '', en_activite: false, action_concurrence: '' }])
}

function retirer(idx: number) {
  ecrire(model.value.filter((_, i) => i !== idx))
}

function majChamp(idx: number, cle: keyof ConcurrentSignale, valeur: unknown) {
  ecrire(model.value.map((c, i) => (i === idx ? { ...c, [cle]: valeur } : c)))
}

function ouvrirSelecteur(idx: number) {
  document.getElementById(`photo-concurrent-${idx}`)?.click()
}

async function choisirPhoto(idx: number, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  indexEnUpload.value = idx
  try {
    const url = await uploadImage(file, 'concurrence')
    if (url) majChamp(idx, 'photo_url', url)
    else toast.add({ title: 'Photo non envoyée', description: 'Réessayez une fois en ligne.', color: 'amber' })
  }
  finally {
    indexEnUpload.value = null
  }
}
</script>
