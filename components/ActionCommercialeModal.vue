<template>
  <UModal v-model="isOpen" :ui="{ width: 'max-w-lg' }">
    <div class="p-6">
      <div class="mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nouvelle action</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ pdvNom || pdvId }}<span v-if="visiteId"> · à partir de la visite consultée</span>
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSave">
        <UFormGroup label="Type d'action" required>
          <USelectMenu
            v-model="form.type_code"
            :options="typesActifs"
            value-attribute="code"
            option-attribute="libelle"
            placeholder="Choisir…"
            size="lg"
          />
        </UFormGroup>

        <UFormGroup label="Merchandiseur assigné">
          <USelectMenu
            v-model="form.assigne_a"
            :options="merchandiseurs"
            value-attribute="id"
            option-attribute="nom"
            searchable
            searchable-placeholder="Rechercher…"
            placeholder="Personne (optionnel)"
            size="lg"
          />
        </UFormGroup>

        <UFormGroup label="Échéance">
          <UInput v-model="form.echeance" type="date" size="lg" />
        </UFormGroup>

        <UFormGroup label="Commentaire">
          <UTextarea v-model="form.commentaire" :rows="3" placeholder="Consigne pour le merchandiseur…" />
        </UFormGroup>

        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" color="gray" type="button" @click="isOpen = false">Annuler</UButton>
          <UButton type="submit" class="bg-fc-red" :loading="saving" :disabled="!form.type_code">Créer l'action</UButton>
        </div>
      </form>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import type { ActionCommerciale } from '~/types'
import { profileTerritories } from '~/composables/useUserScope'

const props = defineProps<{
  modelValue: boolean
  pdvId: string
  pdvNom?: string
  pdvZone?: string | null
  visiteId?: string | null
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'created', action: ActionCommerciale): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const authStore = useAuthStore()
const toast = useToast()
const { typesActifs, chargerTypes, creer, merchandiseursPour } = useActionsCommerciales()
const { estDeMonEquipe, charger: chargerEquipe } = useMonEquipe()

const merchandiseurs = ref<{ id: string; nom: string }[]>([])
const saving = ref(false)
const errorMessage = ref('')
const form = reactive({
  type_code: '',
  assigne_a: null as string | null,
  echeance: '',
  commentaire: '',
})

watch(isOpen, async (open) => {
  if (!open) return
  errorMessage.value = ''
  await chargerTypes()
  if (!form.type_code && typesActifs.value.length) form.type_code = typesActifs.value[0].code
  const zones = props.pdvZone ? [props.pdvZone] : profileTerritories(authStore.profile)
  try {
    const liste = await merchandiseursPour(zones)
    await chargerEquipe()
    // Mon équipe assignée d'abord : c'est le choix attendu neuf fois sur dix.
    merchandiseurs.value = [...liste].sort((a, b) => {
      const ea = estDeMonEquipe(a.id) ? 0 : 1
      const eb = estDeMonEquipe(b.id) ? 0 : 1
      return ea - eb || (a.nom || '').localeCompare(b.nom || '', 'fr')
    })
  }
  catch {
    merchandiseurs.value = []
  }
}, { immediate: true })

async function handleSave() {
  if (!form.type_code) return
  saving.value = true
  errorMessage.value = ''
  try {
    const action = await creer({
      pdv_id: props.pdvId,
      visite_id: props.visiteId || null,
      type_code: form.type_code,
      assigne_a: form.assigne_a,
      echeance: form.echeance || null,
      commentaire: form.commentaire,
    })
    toast.add({ title: 'Action créée', color: 'green' })
    emit('created', action)
    form.commentaire = ''
    form.echeance = ''
    isOpen.value = false
  }
  catch (err: any) {
    errorMessage.value = err?.message || 'Création impossible'
  }
  finally {
    saving.value = false
  }
}
</script>
