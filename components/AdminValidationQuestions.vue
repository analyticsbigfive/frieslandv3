<template>
  <aside class="admin-surface space-y-3 p-4" aria-labelledby="questions-titre">
    <div class="flex items-center justify-between gap-2">
      <h2 id="questions-titre" class="text-base font-semibold text-slate-900 dark:text-white">Questions à trancher</h2>
      <UBadge v-if="ouvertes.length" color="amber" variant="subtle" size="xs">{{ ouvertes.length }} ouverte{{ ouvertes.length > 1 ? 's' : '' }}</UBadge>
    </div>
    <p v-if="erreur" class="text-sm text-red-700" role="alert">{{ erreur }}</p>
    <p v-if="!questions.length && !chargement" class="text-sm text-slate-600 dark:text-slate-300">Aucune question pour ce mois.</p>

    <ol class="space-y-3">
      <li
        v-for="q in triees" :key="q.id"
        class="space-y-2 rounded-md border p-3 text-sm"
        :class="q.statut === 'repondue' ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60' : 'border-amber-300 bg-white dark:border-amber-700 dark:bg-slate-800'"
      >
        <p v-if="nomMerch(q.merchandiser_id)" class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ nomMerch(q.merchandiser_id) }}</p>
        <p class="text-slate-900 dark:text-white" :class="q.statut === 'repondue' ? 'text-slate-600 dark:text-slate-300' : ''">{{ q.question }}</p>
        <template v-if="q.statut === 'repondue'">
          <p class="rounded bg-white p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200"><b>Réponse :</b> {{ q.reponse }}</p>
          <button type="button" class="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline" @click="rouvrir(q)">Modifier la réponse</button>
        </template>
        <template v-else>
          <UTextarea v-model="brouillons[q.id]" :rows="2" autoresize size="sm" placeholder="Réponse…" :aria-label="`Réponse à : ${q.question}`" />
          <UButton size="xs" color="primary" :disabled="!(brouillons[q.id] || '').trim()" :loading="enCours === q.id" @click="repondre(q)">Répondu</UButton>
        </template>
      </li>
    </ol>

    <div v-if="ajout" class="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <USelect v-model="nouvelle.merchandiser" :options="[{ value: '', label: 'Tous les merchandisers' }, ...merchandisers.map(m => ({ value: m.id, label: m.nom }))]" size="sm" aria-label="Merchandiser concerné" />
      <UTextarea v-model="nouvelle.question" :rows="2" autoresize size="sm" placeholder="Question…" aria-label="Nouvelle question" />
      <div class="flex gap-2">
        <UButton size="xs" color="primary" :disabled="!nouvelle.question.trim()" @click="ajouter">Ajouter</UButton>
        <UButton size="xs" variant="ghost" color="gray" @click="ajout = false">Annuler</UButton>
      </div>
    </div>
    <button v-else type="button" class="text-sm font-semibold text-fc-red underline-offset-2 hover:underline" @click="ajout = true">Ajouter une question</button>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { messageUtilisateur } from '~/utils/supabaseErrors'

const props = defineProps<{
  campagneId: string
  merchandisers: { id: string; nom: string }[]
}>()

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const questions = ref<any[]>([])
const brouillons = ref<Record<string, string>>({})
const chargement = ref(false)
const enCours = ref<string | null>(null)
const erreur = ref('')
const ajout = ref(false)
const nouvelle = ref({ merchandiser: '', question: '' })

const ouvertes = computed(() => questions.value.filter(q => q.statut === 'ouverte'))
// Les questions répondues descendent en bas, grisées.
const triees = computed(() => [...questions.value].sort((a, b) =>
  (a.statut === 'repondue' ? 1 : 0) - (b.statut === 'repondue' ? 1 : 0) || a.ordre - b.ordre))
const nomMerch = (id: string | null) => props.merchandisers.find(m => m.id === id)?.nom || ''

async function charger() {
  if (!props.campagneId) { questions.value = []; return }
  chargement.value = true
  const { data, error } = await (supabase.from('validation_tournee_question') as any)
    .select('id, merchandiser_id, ordre, question, reponse, statut, repondu_le')
    .eq('campagne_id', props.campagneId).order('ordre')
  if (error) erreur.value = messageUtilisateur(error)
  else questions.value = data || []
  chargement.value = false
}

async function enregistrer(id: string, champs: Record<string, unknown>) {
  enCours.value = id
  erreur.value = ''
  const { error } = await (supabase.from('validation_tournee_question') as any).update(champs).eq('id', id)
  enCours.value = null
  if (error) { erreur.value = messageUtilisateur(error); return false }
  questions.value = questions.value.map(q => q.id === id ? { ...q, ...champs } : q)
  return true
}

const repondre = (q: any) => enregistrer(q.id, {
  reponse: (brouillons.value[q.id] || '').trim(), statut: 'repondue', repondu_le: new Date().toISOString(), repondu_par: user.value?.id || null,
})
function rouvrir(q: any) {
  brouillons.value[q.id] = q.reponse || ''
  enregistrer(q.id, { statut: 'ouverte' })
}

async function ajouter() {
  erreur.value = ''
  const ordre = Math.max(0, ...questions.value.map(q => q.ordre)) + 1
  const { error } = await (supabase.from('validation_tournee_question') as any).insert({
    campagne_id: props.campagneId, merchandiser_id: nouvelle.value.merchandiser || null, ordre, question: nouvelle.value.question.trim(),
  })
  if (error) { erreur.value = messageUtilisateur(error); return }
  nouvelle.value = { merchandiser: '', question: '' }
  ajout.value = false
  await charger()
}

watch(() => props.campagneId, charger, { immediate: true })
</script>
