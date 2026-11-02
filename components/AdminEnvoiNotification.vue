<template>
  <AdminFormModal
    v-model="ouvert"
    title="Prévenir par notification"
    description="Une notification sur l'écran du téléphone, même application fermée. Un appui ouvre l'application : le message doit dire seul quoi faire."
    icon="i-heroicons-bell-alert"
    required-note
  >
    <div class="space-y-1">
      <UCheckbox v-model="merchandisersSeulement" name="merchandisers-seulement" label="Merchandisers seulement" />
      <p class="text-sm text-slate-700 dark:text-slate-200" aria-live="polite">
        <strong class="tabular-nums">{{ cibles.length }}</strong> compte{{ cibles.length > 1 ? 's' : '' }} parmi ceux affichés
        <template v-if="apercu">
          · <strong class="tabular-nums">{{ joignables.length }}</strong> joignable{{ joignables.length > 1 ? 's' : '' }}
        </template>
        <span v-else-if="chargementApercu" class="text-slate-500"> · recherche des téléphones…</span>
      </p>
      <p v-if="apercu && joignables.length" class="text-xs text-slate-600 dark:text-slate-300">{{ noms(joignables) }}</p>
      <p v-if="apercu && sansAppareil.length" class="text-xs text-amber-700 dark:text-amber-300">
        Pas de téléphone enregistré pour les notifications (notifications refusées sur le téléphone, par exemple) : {{ noms(sansAppareil) }}
      </p>
      <p v-if="erreurApercu" class="text-xs text-red-700 dark:text-red-300">{{ erreurApercu }}</p>
    </div>

    <UFormGroup label="Titre" required :help="`${form.titre.length} / ${TITRE_MAX}`" size="md">
      <UInput v-model="form.titre" :maxlength="TITRE_MAX" size="md" class="w-full" />
    </UFormGroup>
    <UFormGroup label="Message" required :help="`${form.texte.length} / ${TEXTE_MAX}`" size="md">
      <UTextarea v-model="form.texte" :maxlength="TEXTE_MAX" :rows="3" size="md" class="w-full" />
    </UFormGroup>

    <UAlert
      v-if="resultat"
      :color="resultat.envoyes ? 'green' : 'orange'"
      variant="soft"
      icon="i-heroicons-paper-airplane"
      :title="`${resultat.recus.length} personne${resultat.recus.length > 1 ? 's' : ''} prévenue${resultat.recus.length > 1 ? 's' : ''}`"
      :description="detailResultat"
    />

    <template #footer>
      <UButton color="gray" variant="ghost" @click="ouvert = false">Fermer</UButton>
      <UButton icon="i-heroicons-paper-airplane" :loading="envoi" :disabled="!peutEnvoyer" @click="envoyer">
        Envoyer{{ apercu ? ` à ${joignables.length}` : '' }}
      </UButton>
    </template>
  </AdminFormModal>
  <AdminConfirmation v-bind="confirmation" @confirmer="confirmer" @annuler="annuler" />
</template>

<script setup lang="ts">
// Notification push libre (fonction Edge notifier-message, réservée à l'admin).
// Les destinataires sont les comptes affichés par la page appelante ; l'aperçu
// dit qui a un téléphone enregistré (appareil_push n'est pas lisible ici).
export interface DestinataireNotification {
  user_id: string
  nom: string | null
  email: string | null
  role: string
}

const props = defineProps<{ destinataires: DestinataireNotification[] }>()
const ouvert = defineModel<boolean>({ default: false })

const TITRE_MAX = 65
const TEXTE_MAX = 240

const supabase = useSupabaseClient()
const toast = useToast()
const { confirmation, demanderConfirmation, confirmer, annuler } = useConfirmation()

const merchandisersSeulement = ref(true)
const form = reactive({
  titre: 'Mettez à jour l\'application',
  texte: 'Une nouvelle version de Friesland Bonnet Rouge est disponible. Ouvrez le Play Store, cherchez Friesland Bonnet Rouge et touchez « Mettre à jour ».',
})

const cibles = computed(() => props.destinataires.filter(d => !merchandisersSeulement.value || d.role === 'merchandiser'))
const parId = computed(() => new Map(props.destinataires.map(d => [d.user_id, d])))
function noms(ids: string[]) {
  return ids.map(id => parId.value.get(id)?.nom || parId.value.get(id)?.email || '?').join(', ')
}

// Erreur d'une fonction Edge : le message utile est dans le corps JSON.
async function messageErreur(error: any): Promise<string> {
  const corps = await error?.context?.json?.().catch(() => null)
  return corps?.erreur || error?.message || 'Erreur inconnue'
}

const apercu = ref(false)
const chargementApercu = ref(false)
const erreurApercu = ref('')
const joignables = ref<string[]>([])
const sansAppareil = ref<string[]>([])

async function chargerApercu() {
  apercu.value = false
  erreurApercu.value = ''
  if (!cibles.value.length) { joignables.value = []; sansAppareil.value = []; apercu.value = true; return }
  chargementApercu.value = true
  try {
    const { data, error } = await supabase.functions.invoke('notifier-message', {
      body: { apercu: true, user_ids: cibles.value.map(c => c.user_id) },
    })
    if (error) throw new Error(await messageErreur(error))
    joignables.value = data.joignables
    sansAppareil.value = data.sans_appareil
    apercu.value = true
  }
  catch (e: any) {
    erreurApercu.value = `Téléphones non vérifiés : ${e.message}`
  }
  finally {
    chargementApercu.value = false
  }
}

watch([ouvert, cibles], () => {
  if (ouvert.value) {
    resultat.value = null
    void chargerApercu()
  }
})

const peutEnvoyer = computed(() => apercu.value && joignables.value.length > 0 && !!form.titre.trim() && !!form.texte.trim())

const envoi = ref(false)
const resultat = ref<{ envoyes: number, echecs: number, perimes: number, recus: string[], sans_appareil: string[] } | null>(null)
const detailResultat = computed(() => {
  const r = resultat.value
  if (!r) return ''
  const parties = [`${r.envoyes} notification${r.envoyes > 1 ? 's' : ''} remise${r.envoyes > 1 ? 's' : ''} à Firebase.`]
  if (r.echecs) parties.push(`${r.echecs} refusée${r.echecs > 1 ? 's' : ''}.`)
  if (r.perimes) parties.push(`${r.perimes} téléphone${r.perimes > 1 ? 's' : ''} désinstallé${r.perimes > 1 ? 's' : ''}, retiré${r.perimes > 1 ? 's' : ''}.`)
  return parties.join(' ')
})

async function envoyer() {
  const n = joignables.value.length
  const ok = await demanderConfirmation({
    titre: `Envoyer la notification à ${n} personne${n > 1 ? 's' : ''} ?`,
    message: `« ${form.titre.trim()} » arrivera sur le téléphone de : ${noms(joignables.value)}. Une notification envoyée ne se retire pas.`,
    libelleAction: 'Envoyer la notification',
    destructif: false,
  })
  if (!ok) return
  envoi.value = true
  try {
    const { data, error } = await supabase.functions.invoke('notifier-message', {
      body: { titre: form.titre.trim(), texte: form.texte.trim(), user_ids: joignables.value },
    })
    if (error) throw new Error(await messageErreur(error))
    resultat.value = data
    toast.add({ title: 'Notification envoyée', description: detailResultat.value, color: data.envoyes ? 'green' : 'orange' })
  }
  catch (e: any) {
    toast.add({ title: 'Notification non envoyée', description: e.message, color: 'red' })
  }
  finally {
    envoi.value = false
  }
}
</script>
