<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <FormWizard
      v-model="currentTab"
      :steps="steps"
      :step-states="stepStates"
      :saving="saving"
      submit-label="Enregistrer le field coaching"
      @submit="handleSave"
      @cancel="handleCancel"
    >
      <template #identification>
        <div class="space-y-4">
          <div class="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">I_1 · Superviseur</h3>
            <UFormGroup label="Superviseur" help="Compte connecté par défaut">
              <USelectMenu v-model="form.superviseur_id" :options="superviseurs" value-attribute="id" option-attribute="nom" searchable size="lg" />
            </UFormGroup>
            <UFormGroup label="Date">
              <UInput v-model="form.date_coaching" type="datetime-local" size="lg" />
            </UFormGroup>
          </div>
          <div class="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">I_2 · Vendeur</h3>
            <UFormGroup label="Distributeur" required>
              <USelectMenu v-model="form.distributeur_nom" :options="distributeurs.map(d => d.nom)" searchable placeholder="Choisir…" size="lg" />
            </UFormGroup>
            <UFormGroup label="Engin" required>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="e in engins" :key="e.code" type="button"
                  class="min-h-10 rounded-full px-4 text-sm font-semibold transition-colors"
                  :class="form.engin_code === e.code ? 'bg-fc-red text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'"
                  :aria-pressed="form.engin_code === e.code"
                  @click="form.engin_code = e.code"
                >{{ e.libelle }}</button>
              </div>
            </UFormGroup>
          </div>
        </div>
      </template>

      <template #pdv>
        <div class="space-y-4">
          <div class="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">I_3 · Point de vente</h3>
            <UFormGroup label="PDV" required>
              <PDVSelector v-model="form.pdv_id" :pdv-list="pdvList" :loading="pdvLoading" />
            </UFormGroup>
            <UFormGroup label="Route du jour">
              <div class="flex flex-wrap gap-2">
                <button v-for="j in ROUTE_JOURS" :key="j" type="button" class="min-h-9 rounded-full px-3 text-xs font-semibold" :class="form.route_jour === j ? 'bg-fc-red text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'" @click="form.route_jour = j">{{ j }}</button>
              </div>
            </UFormGroup>
            <UFormGroup label="Type de PDV"><UInput v-model="form.type_pdv" size="lg" placeholder="Boutique, Aboki, Pushcart, Kiosk, Superette…" /></UFormGroup>
            <div class="grid grid-cols-2 gap-3">
              <UFormGroup label="Commune"><UInput v-model="form.commune" size="lg" /></UFormGroup>
              <UFormGroup label="Quartier"><UInput v-model="form.quartier" size="lg" /></UFormGroup>
              <UFormGroup label="Boulevard / rue"><UInput v-model="form.rue" size="lg" /></UFormGroup>
              <UFormGroup label="Proche de"><UInput v-model="form.proche_de" size="lg" /></UFormGroup>
            </div>
          </div>
          <div class="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">I_4 · Propriétaire</h3>
            <div class="grid grid-cols-2 gap-3">
              <UFormGroup label="Nom"><UInput v-model="form.proprietaire_nom" size="lg" /></UFormGroup>
              <UFormGroup label="Prénom"><UInput v-model="form.proprietaire_prenom" size="lg" /></UFormGroup>
            </div>
            <UFormGroup label="Téléphone"><UInput v-model="form.proprietaire_tel" type="tel" size="lg" /></UFormGroup>
          </div>
        </div>
      </template>

      <template #distribution>
        <div class="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">II_1.1 · Maximise Distribution</h3>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="SKU en PDV"><UInput v-model.number="form.nb_sku_pdv" type="number" min="0" size="lg" /></UFormGroup>
            <UFormGroup label="SKU disponibles"><UInput v-model.number="form.nb_sku_dispo" type="number" min="0" size="lg" /></UFormGroup>
          </div>
          <UFormGroup label="SKU disponibles (référentiel)">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="r in references" :key="r.id" type="button"
                class="min-h-9 rounded-full px-3 text-xs font-semibold transition-colors"
                :class="form.skus.includes(r.id) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'"
                :aria-pressed="form.skus.includes(r.id)"
                @click="toggleSku(r.id)"
              >{{ r.nom }}</button>
            </div>
          </UFormGroup>
        </div>
      </template>

      <template #visibilite>
        <CoachingBlocQuestions v-model="form.reponses" bloc="visibilite" />
      </template>

      <template #promotion>
        <CoachingBlocQuestions v-model="form.reponses" bloc="promotion">
          <UFormGroup label="Commentaire">
            <UTextarea v-model="form.commentaire" :rows="3" :maxlength="1000" placeholder="Observations, engagements pris…" />
          </UFormGroup>
        </CoachingBlocQuestions>
      </template>
    </FormWizard>

    <SaveOverlay
      :visible="showSaveOverlay"
      :status="saveStatus"
      :progress="saveProgress"
      saving-title="Enregistrement du field coaching"
      saving-message="Synchronisation des données..."
      success-title="Field coaching enregistré"
      success-message="Le questionnaire a été sauvegardé."
      @update:visible="showSaveOverlay = $event"
      @closed="router.push('/mobile/coaching')"
      @retry="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
// Field coaching (lot 4) : même enveloppe que la saisie de visite (wizard,
// brouillon local, file hors ligne, overlay), 13 questions Kobo.
import type { WizardStep } from '~/components/FormWizard.vue'
import { ROUTE_JOURS, erreursIdentification, evaluationComplete, questionsDuBloc, reponsesVides } from '~/utils/fieldCoaching'

definePageMeta({ middleware: ['auth', 'coaching-write'], layout: false })

const router = useRouter()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const authStore = useAuthStore()
const toast = useToast()
const pdvStore = usePDVStore()
const { addToQueue, isOnline } = useOfflineSync()
const { engins, distributeurs, references, chargerReferentiels } = useFieldCoaching()

const steps: WizardStep[] = [
  { key: 'identification', label: 'Superviseur & vendeur', phase: 'Identification' },
  { key: 'pdv', label: 'PDV & propriétaire', phase: 'Identification' },
  { key: 'distribution', label: 'Distribution', phase: 'Évaluation' },
  { key: 'visibilite', label: 'Perfect Visibility', phase: 'Évaluation' },
  { key: 'promotion', label: 'Effective Promotion', phase: 'Évaluation' },
]
const currentTab = ref(0)

const form = reactive({
  superviseur_id: '' as string,
  date_coaching: new Date().toISOString().slice(0, 16),
  distributeur_nom: '',
  engin_code: '',
  pdv_id: '',
  route_jour: '',
  type_pdv: '',
  commune: '',
  quartier: '',
  rue: '',
  proche_de: '',
  proprietaire_nom: '',
  proprietaire_prenom: '',
  proprietaire_tel: '',
  nb_sku_pdv: null as number | null,
  nb_sku_dispo: null as number | null,
  skus: [] as number[],
  reponses: reponsesVides(),
  commentaire: '',
})

const superviseurs = ref<{ id: string; nom: string }[]>([])
const pdvList = ref<any[]>([])
const pdvLoading = ref(true)

const stepStates = computed(() => ({
  identification: form.distributeur_nom && form.engin_code ? 'complete' : 'partial',
  pdv: form.pdv_id ? 'complete' : 'partial',
  distribution: form.nb_sku_pdv != null ? 'complete' : 'partial',
  visibilite: questionsDuBloc('visibilite').every(q => form.reponses[q.code]) ? 'complete' : 'partial',
  promotion: questionsDuBloc('promotion').every(q => form.reponses[q.code]) ? 'complete' : 'partial',
}))

function toggleSku(id: number) {
  form.skus = form.skus.includes(id) ? form.skus.filter(x => x !== id) : [...form.skus, id]
}

// Pré-remplissage depuis le PDV choisi (éditable ensuite).
watch(() => form.pdv_id, (id) => {
  const p = pdvList.value.find(x => x.pdv_id === id)
  if (!p) return
  if (!form.quartier) form.quartier = p.quartier || ''
  if (!form.commune) form.commune = p.zone || ''
  if (!form.rue) form.rue = p.adressage || ''
  if (!form.type_pdv) form.type_pdv = p.sous_categorie_pdv || p.categorie_pdv || ''
})

// Brouillon local
const draftKey = computed(() => `coaching-draft:${user.value?.id || 'anonymous'}`)
watch(form, () => {
  if (!import.meta.client) return
  try { localStorage.setItem(draftKey.value, JSON.stringify(form)) } catch { /* stockage indisponible */ }
}, { deep: true })
function restoreDraft() {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(draftKey.value)
    if (!raw) return
    const d = JSON.parse(raw)
    Object.assign(form, d, { reponses: { ...reponsesVides(), ...(d.reponses || {}) } })
  }
  catch { /* brouillon illisible */ }
}
function clearDraft() { if (import.meta.client) localStorage.removeItem(draftKey.value) }

// Sauvegarde
const saving = ref(false)
const showSaveOverlay = ref(false)
const saveStatus = ref<'saving' | 'success' | 'error'>('saving')
const saveProgress = ref(0)

async function handleSave() {
  const erreurs = erreursIdentification(form)
  if (!evaluationComplete(form.reponses)) erreurs.push('Les 13 questions doivent être renseignées (Oui, Non ou N/A).')
  if (erreurs.length) {
    toast.add({ title: 'Formulaire incomplet', description: erreurs.join(' '), color: 'red' })
    return
  }
  saving.value = true
  showSaveOverlay.value = true
  saveStatus.value = 'saving'
  saveProgress.value = 30
  const row = {
    id: crypto.randomUUID(),
    date_coaching: new Date(form.date_coaching).toISOString(),
    auteur_id: user.value!.id,
    superviseur_id: form.superviseur_id || user.value!.id,
    assigne_a: user.value!.id,
    distributeur_id: distributeurs.value.find(d => d.nom === form.distributeur_nom)?.id ?? null,
    distributeur_nom: form.distributeur_nom,
    engin_code: form.engin_code,
    pdv_id: form.pdv_id,
    route_jour: form.route_jour || null,
    type_pdv: form.type_pdv || null,
    commune: form.commune || null,
    quartier: form.quartier || null,
    rue: form.rue || null,
    proche_de: form.proche_de || null,
    proprietaire_nom: form.proprietaire_nom || null,
    proprietaire_prenom: form.proprietaire_prenom || null,
    proprietaire_tel: form.proprietaire_tel || null,
    nb_sku_pdv: form.nb_sku_pdv,
    nb_sku_dispo: form.nb_sku_dispo,
    skus_disponibles: references.value.filter(r => form.skus.includes(r.id)).map(r => ({ id: r.id, nom: r.nom })),
    reponses: { ...form.reponses },
    commentaire: form.commentaire?.trim() || null,
    statut: 'soumis',
  }
  try {
    if (isOnline.value) {
      const { error } = await (supabase.from('field_coaching') as any).insert(row)
      if (error) throw error
    }
    else {
      addToQueue({ type: 'field_coaching', data: row })
    }
    saveProgress.value = 100
    saveStatus.value = 'success'
    clearDraft()
  }
  catch (err: any) {
    saveStatus.value = 'error'
    toast.add({ title: 'Erreur', description: err?.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

function handleCancel() {
  router.push('/mobile/coaching')
}

onMounted(async () => {
  if (!authStore.profile) await authStore.fetchProfile()
  form.superviseur_id = user.value?.id || ''
  restoreDraft()
  void chargerReferentiels()
  const { data } = await supabase.from('profiles').select('id, nom').in('role', ['superviseur', 'admin']).eq('is_active', true).order('nom')
  superviseurs.value = (data || []) as any
  if (user.value?.id && !superviseurs.value.some(s => s.id === user.value!.id)) {
    superviseurs.value.unshift({ id: user.value.id, nom: authStore.profile?.nom || 'Moi' })
  }
  try {
    pdvList.value = await pdvStore.fetchScopedPDV(authStore.profile)
  }
  finally {
    pdvLoading.value = false
  }
})
</script>
