<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <div class="admin-toolbar">
      <div class="grid grid-cols-1 gap-x-2 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <UFormGroup label="Rechercher" size="xs">
          <UInput v-model="recherche" icon="i-heroicons-magnifying-glass" placeholder="Nom du concurrent…" size="xs" />
        </UFormGroup>
        <div class="flex items-end pb-1">
          <UCheckbox v-model="masquerDansListe" label="Masquer ceux déjà dans la liste" />
        </div>
      </div>
    </div>

    <div v-if="loading" class="admin-surface h-64 animate-pulse bg-slate-100 dark:bg-slate-800" role="status" aria-label="Chargement des concurrents signalés" />

    <template v-else>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Noms signalés" :value="String(lignes.length)" :subtitle="`${totalSignalements} signalements au total`" icon="i-heroicons-chat-bubble-left-ellipsis" color="blue" />
        <StatsCard title="À ajouter à la liste" :value="String(aAjouter)" subtitle="pas encore dans la liste officielle" icon="i-heroicons-plus-circle" color="orange" />
        <StatsCard title="Déjà dans la liste" :value="String(lignes.length - aAjouter)" subtitle="reconnus par leur nom" icon="i-heroicons-check-circle" color="green" />
        <StatsCard title="Marques officielles" :value="String(marques.length)" subtitle="proposées dans le formulaire de visite" icon="i-heroicons-scale" color="purple" />
      </div>

      <section class="admin-surface overflow-hidden" aria-labelledby="signales-heading">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="signales-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Concurrents signalés par les merchandisers</h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Les noms saisis dans « Autre concurrent » pendant les visites, toutes périodes confondues. « Milko », « milko » et « MILKO » sont regroupés ; « oki,milko » compte pour Oki et pour Milko.
            Un concurrent ajouté à la liste apparaît dans le formulaire de visite au prochain chargement de l'application. Les visites passées ne sont pas modifiées : il compte à partir des visites suivantes.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Nom signalé</th>
                <th class="text-right">Signalements</th>
                <th class="text-right" title="Points de vente distincts où il a été signalé">Points de vente</th>
                <th>Dernier signalement</th>
                <th>Dans la liste</th>
                <th class="text-right"><span class="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in lignesPage" :key="l.cle">
                <td class="font-semibold text-slate-900 dark:text-white">{{ l.nom }}</td>
                <td class="text-right tabular-nums">{{ l.signalements }}</td>
                <td class="text-right tabular-nums">{{ l.nb_pdv }}</td>
                <td class="whitespace-nowrap">{{ l.derniere_date ? formatDateFr(l.derniere_date) : '—' }}</td>
                <td>
                  <span v-if="l.dans_la_liste.length" class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <UIcon name="i-heroicons-check" class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ l.dans_la_liste.map(libelleFamille).join(', ') }}
                  </span>
                  <span v-else class="text-xs text-slate-600 dark:text-slate-300">Non</span>
                </td>
                <td class="text-right">
                  <UButton
                    v-if="peutAjouter"
                    size="xs"
                    :variant="l.dans_la_liste.length ? 'ghost' : 'solid'"
                    icon="i-heroicons-plus"
                    @click="ouvrirAjout(l)"
                  >
                    {{ l.dans_la_liste.length ? 'Autre famille' : 'Ajouter à la liste' }}
                  </UButton>
                </td>
              </tr>
              <tr v-if="!lignesFiltrees.length">
                <td colspan="6" class="py-10 text-center text-slate-600 dark:text-slate-300">
                  {{ lignes.length ? 'Aucun concurrent ne correspond à la recherche.' : 'Aucun concurrent signalé pour l’instant.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="lignesFiltrees.length > TAILLE_PAGE" class="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <AdminPagination :total="lignesFiltrees.length" :page="page" :page-size="TAILLE_PAGE" item-label="concurrent(s)" @update:page="(p) => page = p" />
        </div>
      </section>
    </template>

    <AdminFormModal
      v-model="modalOuverte"
      title="Ajouter à la liste des concurrents"
      :description="choisi ? `« ${choisi.nom} » : ${choisi.signalements} signalement(s) dans ${choisi.nb_pdv} point(s) de vente.` : ''"
      icon="i-heroicons-plus-circle"
      body-class="grid grid-cols-1 gap-5 sm:grid-cols-2"
      required-note
    >
      <UFormGroup label="Famille" required help="La famille de produits où ce concurrent sera proposé dans le formulaire de visite.">
        <USelectMenu
          v-model="formFamille"
          :options="famillesProposees"
          option-attribute="label"
          value-attribute="key"
          placeholder="Choisir la famille"
          size="md"
          class="w-full"
        />
      </UFormGroup>
      <UFormGroup label="Nom affiché" required>
        <UInput v-model="formNom" size="md" />
      </UFormGroup>
      <p v-if="erreurAjout" role="alert" class="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {{ erreurAjout }}
      </p>
      <template #footer>
        <UButton type="button" color="gray" variant="ghost" @click="modalOuverte = false">Annuler</UButton>
        <UButton icon="i-heroicons-check" :loading="enregistrement" :disabled="!formFamille || !formNom.trim()" @click="ajouter">
          Ajouter
        </UButton>
      </template>
    </AdminFormModal>
  </div>
</template>

<script setup lang="ts">
// Concurrence › Concurrents signalés (05/11/2026, demande Friesland) : les noms
// saisis en texte libre pendant les visites, regroupés, et le bouton pour les
// ajouter à la liste officielle (marque_concurrente), proposée ensuite dans le
// formulaire de visite. RPC concurrents_signales_bruts (migration 20261105130000).
import { formatDateFr } from '~/utils/dates'
import { fetchAllRows } from '~/utils/fetchAll'
import { messageUtilisateur } from '~/utils/supabaseErrors'
import {
  agregerSignalementsConcurrents,
  normaliserNomConcurrent,
  type ConcurrentSignaleAgrege,
  type SignalementConcurrent,
} from '~/utils/concurrence'
import { FAMILLES_CONCURRENCE } from '~/composables/useMarquesConcurrentes'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const toast = useToast()
const authStore = useAuthStore()
const { marques, charger: chargerMarques } = useMarquesConcurrentes()

// L'écriture dans la liste est réservée aux gestionnaires Perfect Store (règle
// d'accès de marque_concurrente) : le bouton n'apparaît que pour eux.
const peutAjouter = computed(() => ['admin', 'superviseur'].includes(authStore.profile?.role || ''))

const TAILLE_PAGE = 50
const loading = ref(true)
const signalements = ref<SignalementConcurrent[]>([])
const recherche = ref('')
const masquerDansListe = ref(true)
const page = ref(1)

const lignes = computed<ConcurrentSignaleAgrege[]>(() => agregerSignalementsConcurrents(signalements.value, marques.value))
const totalSignalements = computed(() => lignes.value.reduce((t, l) => t + l.signalements, 0))
const aAjouter = computed(() => lignes.value.filter(l => !l.dans_la_liste.length).length)
const lignesFiltrees = computed(() => {
  const q = normaliserNomConcurrent(recherche.value)
  return lignes.value.filter(l => (!masquerDansListe.value || !l.dans_la_liste.length) && (!q || l.cle.includes(q)))
})
const lignesPage = computed(() => lignesFiltrees.value.slice((page.value - 1) * TAILLE_PAGE, page.value * TAILLE_PAGE))
watch([recherche, masquerDansListe], () => { page.value = 1 })

function libelleFamille(cle: string) {
  return cle.toUpperCase()
}

async function charger() {
  loading.value = true
  try {
    const [lignesBrutes] = await Promise.all([
      fetchAllRows<SignalementConcurrent>((from, to) => (supabase.rpc as any)('concurrents_signales_bruts').range(from, to)),
      chargerMarques(true),
    ])
    signalements.value = lignesBrutes
  }
  catch (err) {
    toast.add({ title: 'Chargement impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    loading.value = false
  }
}

// ---- Ajout à la liste ----
const modalOuverte = ref(false)
const choisi = ref<ConcurrentSignaleAgrege | null>(null)
const formFamille = ref('')
const formNom = ref('')
const erreurAjout = ref('')
const enregistrement = ref(false)

// Familles où il n'est pas encore : on n'ajoute pas deux fois la même marque.
const famillesProposees = computed(() =>
  FAMILLES_CONCURRENCE.filter(f => !choisi.value?.dans_la_liste.includes(f.key)),
)

function ouvrirAjout(l: ConcurrentSignaleAgrege) {
  choisi.value = l
  formNom.value = l.nom.charAt(0).toUpperCase() + l.nom.slice(1)
  formFamille.value = l.familles.find(f => !l.dans_la_liste.includes(f)) || ''
  erreurAjout.value = ''
  modalOuverte.value = true
}

async function ajouter() {
  const nom = formNom.value.trim()
  const famille = formFamille.value
  const code = normaliserNomConcurrent(nom)
  if (!nom || !famille || !code) return
  if (marques.value.some(m => m.famille === famille && (normaliserNomConcurrent(m.nom) === code || normaliserNomConcurrent(m.code) === code))) {
    erreurAjout.value = `« ${nom} » est déjà dans la liste de la famille ${libelleFamille(famille)}.`
    return
  }
  enregistrement.value = true
  erreurAjout.value = ''
  try {
    const ordre = Math.max(0, ...marques.value.filter(m => m.famille === famille).map(m => Number(m.ordre) || 0)) + 1
    const { error } = await (supabase.from('marque_concurrente') as any).insert({ famille, code, nom, actif: true, ordre })
    if (error) throw error
    modalOuverte.value = false
    toast.add({ title: 'Concurrent ajouté', description: `« ${nom} » est proposé dans la famille ${libelleFamille(famille)} du formulaire de visite.`, color: 'green' })
    await chargerMarques(true)
  }
  catch (err) {
    erreurAjout.value = messageUtilisateur(err)
  }
  finally {
    enregistrement.value = false
  }
}

onMounted(charger)
</script>
