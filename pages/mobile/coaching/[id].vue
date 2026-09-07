<template>
  <div class="mobile-page">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-fc-red" />
    </div>
    <div v-else-if="!c" class="px-4 py-20 text-center text-gray-400">Field coaching introuvable</div>
    <div v-else class="space-y-4 px-4 py-4">
      <div class="mobile-card space-y-2 p-4">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ c.pdv?.nom_pdv || c.pdv_id }}</h2>
            <p class="text-xs text-gray-500">{{ formatDate(c.date_coaching) }} · {{ c.pdv?.zone }}</p>
          </div>
          <UBadge :color="couleurScore(global.taux)" variant="subtle">{{ global.taux == null ? 'N/A' : global.taux + ' %' }}</UBadge>
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div><p class="text-xs text-gray-400">Superviseur</p><p>{{ c.superviseur?.nom || c.auteur?.nom || '—' }}</p></div>
          <div><p class="text-xs text-gray-400">En charge</p><p>{{ c.assigne?.nom || c.auteur?.nom || '—' }}</p></div>
          <div><p class="text-xs text-gray-400">Distributeur</p><p>{{ c.distributeur_nom || '—' }}</p></div>
          <div><p class="text-xs text-gray-400">Vendeur</p><p>{{ c.vendeur_nom || '—' }}</p></div>
          <div><p class="text-xs text-gray-400">Engin</p><p>{{ libelleEngin(c.engin_code) }}</p></div>
          <div><p class="text-xs text-gray-400">Route du jour</p><p>{{ c.route_jour || '—' }}</p></div>
          <div><p class="text-xs text-gray-400">Type de PDV</p><p>{{ c.type_pdv_detail || c.type_pdv || '—' }}</p></div>
        </div>
        <p class="text-xs text-gray-500">{{ [c.commune, c.quartier, c.rue, c.proche_de ? 'proche de ' + c.proche_de : ''].filter(Boolean).join(' · ') || '—' }}</p>
      </div>

      <div class="mobile-card space-y-2 p-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Propriétaire</h3>
        <p class="text-sm">{{ [c.proprietaire_prenom, c.proprietaire_nom].filter(Boolean).join(' ') || '—' }}<span v-if="c.proprietaire_tel"> · {{ c.proprietaire_tel }}</span></p>
      </div>

      <div class="mobile-card space-y-2 p-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Distribution</h3>
        <p class="text-sm">{{ c.nb_sku_dispo ?? '—' }} SKU disponibles sur {{ c.nb_sku_pdv ?? '—' }} en PDV</p>
        <div v-if="c.skus_disponibles?.length" class="flex flex-wrap gap-1">
          <UBadge v-for="s in c.skus_disponibles" :key="s.id" variant="subtle" color="green" size="xs">{{ s.nom }}</UBadge>
        </div>
      </div>

      <div v-for="bloc in (['visibilite', 'promotion'] as const)" :key="bloc" class="mobile-card space-y-2 p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ BLOCS_COACHING[bloc] }}</h3>
          <UBadge :color="couleurScore(scoreCoaching(c.reponses, bloc).taux)" variant="subtle" size="xs">{{ scoreCoaching(c.reponses, bloc).taux ?? 'N/A' }}<span v-if="scoreCoaching(c.reponses, bloc).taux != null"> %</span></UBadge>
        </div>
        <div v-for="q in questionsDuBloc(bloc)" :key="q.code" class="flex items-start justify-between gap-3 text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ q.libelle }}</span>
          <span class="shrink-0 font-semibold" :class="c.reponses[q.code] === 'oui' ? 'text-green-600' : c.reponses[q.code] === 'non' ? 'text-red-500' : 'text-gray-400'">
            {{ c.reponses[q.code] === 'oui' ? 'Oui' : c.reponses[q.code] === 'non' ? 'Non' : 'Not Applicable' }}
          </span>
        </div>
      </div>

      <div v-if="c.motif_non_participation" class="mobile-card space-y-2 p-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Motif de la non-participation à la promo</h3>
        <p class="whitespace-pre-line text-sm">{{ c.motif_non_participation }}</p>
      </div>

      <div v-if="c.commentaire" class="mobile-card space-y-2 p-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Commentaire</h3>
        <p class="whitespace-pre-line text-sm">{{ c.commentaire }}</p>
      </div>

      <div class="mobile-card space-y-3 p-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Transferts</h3>
          <UButton v-if="peutTransferer" size="xs" variant="soft" icon="i-heroicons-arrow-right-circle" @click="showTransfert = true">Transférer</UButton>
        </div>
        <p v-if="!historique.length" class="text-xs text-gray-400">Aucun transfert. L'auteur d'origine reste {{ c.auteur?.nom || '—' }}.</p>
        <div v-for="t in historique" :key="t.id" class="text-xs text-gray-600 dark:text-gray-300">
          {{ formatDate(t.created_at) }} : {{ t.de?.nom || '—' }} → <strong>{{ t.vers?.nom }}</strong> (par {{ t.par?.nom }})<span v-if="t.motif"> — {{ t.motif }}</span>
        </div>
      </div>
    </div>

    <UModal v-model="showTransfert">
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-bold">Transférer ce coaching</h3>
        <p class="text-sm text-gray-500">Le transfert déplace la charge, il ne change pas l'auteur d'origine.</p>
        <UFormGroup label="Vers" required>
          <USelectMenu v-model="transfertVers" :options="destinataires" value-attribute="id" option-attribute="nom" searchable placeholder="Choisir…" size="lg" />
        </UFormGroup>
        <UFormGroup label="Motif">
          <UTextarea v-model="transfertMotif" :rows="2" />
        </UFormGroup>
        <p v-if="transfertErreur" class="text-sm text-red-600">{{ transfertErreur }}</p>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="gray" @click="showTransfert = false">Annuler</UButton>
          <UButton class="bg-fc-red" :loading="transfertEnCours" :disabled="!transfertVers" @click="confirmerTransfert">Transférer</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { FieldCoaching } from '~/types'
import { BLOCS_COACHING, questionsDuBloc, scoreCoaching } from '~/utils/fieldCoaching'
import { isPrivilegedRole } from '~/utils/roles'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const route = useRoute()
const user = useSupabaseUser()
const authStore = useAuthStore()
const toast = useToast()
const { charger, transferts, transferer, destinatairesTransfert, engins, chargerReferentiels } = useFieldCoaching()

const c = ref<FieldCoaching | null>(null)
const loading = ref(true)
const historique = ref<any[]>([])
const destinataires = ref<any[]>([])
const showTransfert = ref(false)
const transfertVers = ref<string | null>(null)
const transfertMotif = ref('')
const transfertErreur = ref('')
const transfertEnCours = ref(false)

const global = computed(() => scoreCoaching(c.value?.reponses || {}))
const peutTransferer = computed(() => !!c.value && (c.value.auteur_id === user.value?.id || c.value.assigne_a === user.value?.id || isPrivilegedRole(authStore.profile?.role)))

function libelleEngin(code?: string | null) { return engins.value.find(e => e.code === code)?.libelle || code || '—' }
function couleurScore(t: number | null) { return t == null ? 'gray' : t >= 70 ? 'green' : t >= 40 ? 'orange' : 'red' }
function formatDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

async function recharger() {
  const id = route.params.id as string
  c.value = await charger(id)
  if (c.value) historique.value = await transferts(id)
}

async function confirmerTransfert() {
  if (!c.value || !transfertVers.value) return
  transfertEnCours.value = true
  transfertErreur.value = ''
  try {
    await transferer(c.value.id, transfertVers.value, transfertMotif.value)
    toast.add({ title: 'Coaching transféré', color: 'green' })
    showTransfert.value = false
    transfertMotif.value = ''
    await recharger()
  }
  catch (err: any) {
    transfertErreur.value = err?.message || 'Transfert impossible'
  }
  finally {
    transfertEnCours.value = false
  }
}

watch(showTransfert, async (open) => {
  if (open && !destinataires.value.length) destinataires.value = await destinatairesTransfert()
})

onMounted(async () => {
  if (!authStore.profile) await authStore.fetchProfile()
  void chargerReferentiels()
  try { await recharger() }
  catch { c.value = null }
  finally { loading.value = false }
})
</script>
