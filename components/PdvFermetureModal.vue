<template>
  <UModal v-model="ouvert" :prevent-close="envoiEnCours" aria-label="Signaler un point de vente fermé">
    <div class="space-y-4 p-5">
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/30">
          <UIcon name="i-heroicons-lock-closed" class="h-5 w-5 text-fc-red" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">PDV fermé</h3>
          <p class="truncate text-sm text-gray-500 dark:text-gray-400">{{ pdvNom || pdvId }}</p>
        </div>
      </div>

      <p class="text-sm text-gray-600 dark:text-gray-300">
        Prenez {{ NB_PHOTOS_FERMETURE }} photos de la devanture, maintenant, devant la boutique.
        Sans ces photos, le point de vente ne peut pas être signalé fermé.
      </p>

      <div class="grid grid-cols-2 gap-3">
        <div v-for="(emplacement, i) in PHOTOS_FERMETURE" :key="emplacement.cle" class="space-y-1">
          <button
            type="button"
            class="relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 transition-colors"
            :class="photos[i]
              ? 'border-emerald-500'
              : refus[i]
                ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                : 'border-dashed border-gray-300 hover:border-fc-red hover:bg-red-50 active:bg-red-100 dark:border-gray-600 dark:hover:bg-red-950/20'"
            :aria-label="photos[i] ? `Reprendre la photo : ${emplacement.libelle}` : `Prendre la photo : ${emplacement.libelle}`"
            :disabled="envoiEnCours"
            @click="prendrePhoto(i)"
          >
            <img v-if="apercus[i]" :src="apercus[i]!" :alt="emplacement.libelle" class="absolute inset-0 h-full w-full object-cover" />
            <template v-else>
              <UIcon name="i-heroicons-camera" class="mb-1 h-8 w-8 text-gray-400" aria-hidden="true" />
              <span class="px-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Prendre la photo</span>
            </template>
            <span v-if="photos[i]" class="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">Reprendre</span>
          </button>
          <p class="text-xs font-semibold text-gray-800 dark:text-gray-200">{{ i + 1 }}. {{ emplacement.libelle }}</p>
          <p v-if="refus[i]" class="text-xs font-medium text-red-700 dark:text-red-300" role="alert">{{ refus[i] }}</p>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ emplacement.aide }}</p>
          <!-- Appareil photo seulement (capture), une photo à la fois : pas d'import depuis la galerie. -->
          <input
            :ref="el => { entrees[i] = el as HTMLInputElement | null }"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="onPhoto(i, $event)"
          >
        </div>
      </div>

      <UFormGroup label="Commentaire" hint="Optionnel">
        <UTextarea v-model="commentaire" :rows="2" placeholder="Rideau baissé, boutique vide, déménagée…" :disabled="envoiEnCours" />
      </UFormGroup>

      <p class="text-xs text-gray-500 dark:text-gray-400">
        Un responsable vérifie les photos avant de retirer le point de vente des tournées.
        <template v-if="routingPdvId">Cette étape de la tournée sera close.</template>
      </p>

      <div class="flex justify-end gap-3">
        <UButton variant="ghost" color="gray" :disabled="envoiEnCours" @click="ouvert = false">Annuler</UButton>
        <UButton
          class="bg-fc-red hover:bg-fc-red/90"
          icon="i-heroicons-paper-airplane"
          :disabled="!pret"
          :loading="envoiEnCours"
          @click="signaler"
        >
          Signaler fermé
        </UButton>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
// « PDV fermé » (migration 20261106120000) : deux photos de la devanture,
// prises à l'appareil photo, sont la condition pour signaler. Le bouton reste
// inactif sans elles ; la base refait le contrôle (declarer_pdv_ferme).
import { NB_PHOTOS_FERMETURE, PHOTOS_FERMETURE, fermeturePrete, refusPhotoFermeture } from '~/utils/fermeturePdv'
import { messageUtilisateur } from '~/utils/supabaseErrors'
import type { ResultatFermeture } from '~/composables/useFermeturePdv'

const props = defineProps<{
  modelValue: boolean
  pdvId: string
  pdvNom?: string | null
  /** Étape de la tournée du jour, si le signalement part de la tournée. */
  routingPdvId?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'signale', resultat: Exclude<ResultatFermeture, null>): void
}>()

const toast = useToast()
const { envoiEnCours, declarer } = useFermeturePdv()

const ouvert = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const photos = ref<(File | null)[]>(PHOTOS_FERMETURE.map(() => null))
const apercus = ref<(string | null)[]>(PHOTOS_FERMETURE.map(() => null))
const refus = ref<(string | null)[]>(PHOTOS_FERMETURE.map(() => null))
const entrees = ref<(HTMLInputElement | null)[]>([])
const commentaire = ref('')
// Le GPS est demandé modale fermée (son écran d'aide passe au premier plan) :
// si l'agent l'abandonne, la modale revient avec ses photos.
const reprise = ref(false)

const pret = computed(() => fermeturePrete(photos.value))

function liberer(i: number) {
  const url = apercus.value[i]
  if (url) URL.revokeObjectURL(url)
  apercus.value[i] = null
}

function reinitialiser() {
  PHOTOS_FERMETURE.forEach((_, i) => liberer(i))
  photos.value = PHOTOS_FERMETURE.map(() => null)
  refus.value = PHOTOS_FERMETURE.map(() => null)
  commentaire.value = ''
}

watch(() => props.modelValue, (v) => {
  if (v && !reprise.value) reinitialiser()
  reprise.value = false
})

function prendrePhoto(i: number) {
  entrees.value[i]?.click()
}

function onPhoto(i: number, e: Event) {
  const input = e.target as HTMLInputElement
  const fichier = input.files?.[0]
  input.value = ''
  if (!fichier) return
  const autres = photos.value.filter((p, j): p is File => j !== i && p != null)
  const motif = refusPhotoFermeture(fichier, Date.now(), autres)
  refus.value[i] = motif
  if (motif) return
  liberer(i)
  photos.value[i] = fichier
  apercus.value[i] = URL.createObjectURL(fichier)
}

async function signaler() {
  if (!pret.value) return
  const fichiers = photos.value as File[]
  ouvert.value = false
  try {
    const resultat = await declarer({
      pdvId: props.pdvId,
      routingPdvId: props.routingPdvId,
      photos: fichiers,
      commentaire: commentaire.value,
    })
    if (!resultat) {
      // GPS abandonné : rien n'est parti, on rend la main avec les photos.
      reprise.value = true
      ouvert.value = true
      return
    }
    toast.add(resultat === 'envoye'
      ? { title: 'Fermeture signalée', description: 'Un responsable va vérifier les photos.', color: 'green', icon: 'i-heroicons-check-circle' }
      : { title: 'Fermeture enregistrée', description: 'Elle partira avec ses photos dès que le réseau le permettra.', color: 'amber', icon: 'i-heroicons-arrow-path' })
    reinitialiser()
    emit('signale', resultat)
  }
  catch (err) {
    toast.add({ title: 'Signalement impossible', description: messageUtilisateur(err), color: 'red' })
    reprise.value = true
    ouvert.value = true
  }
}

onBeforeUnmount(() => PHOTOS_FERMETURE.forEach((_, i) => liberer(i)))
</script>
