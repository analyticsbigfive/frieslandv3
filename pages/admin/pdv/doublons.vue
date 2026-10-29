<template>
  <div class="space-y-6">
    <AdminPageHeader description="Points de vente créés tout près d'un point de vente existant : créations sur le terrain, et paires ATOM déjà en base au nom presque identique. Comparez les devantures : deux points de vente différents, ou un doublon à désactiver.">
      <template #actions>
        <UButton icon="i-heroicons-arrow-path" variant="outline" :loading="chargement" @click="charger">Actualiser</UButton>
      </template>
    </AdminPageHeader>

    <div class="flex flex-wrap items-center gap-3">
      <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Afficher">
        <button
          v-for="o in OPTIONS_VUE"
          :key="String(o.value)"
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fc-red"
          :class="tout === o.value ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
          :aria-pressed="tout === o.value"
          @click="tout = o.value"
        >
          {{ o.label }}
        </button>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        À moins de {{ parametres.doublon_rayon_m }} m (Paramètres terrain › « Rayon des doublons »), sur les 90 derniers jours.
      </p>
    </div>

    <div v-if="erreur" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100" role="alert">
      {{ erreur }}
    </div>

    <ChargementContenu v-else-if="chargement && !lignes.length" variante="lignes" libelle="Chargement des doublons possibles…" />

    <p v-else-if="!lignes.length" class="admin-surface p-6 text-sm text-slate-600 dark:text-slate-300">
      {{ tout ? 'Aucun doublon possible sur la période.' : 'Rien à vérifier : tous les doublons possibles ont été traités.' }}
    </p>

    <section v-else class="admin-surface overflow-hidden" aria-label="Doublons possibles">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Le plus récent</th>
              <th scope="col">Déjà là avant</th>
              <th scope="col">Écart</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lignes" :key="l.id">
              <td>
                <div class="flex items-start gap-3">
                  <PDVPhotoModal :image-url="l.image_url" :pdv-id="l.pdv_id" :pdv-name="l.nom_pdv" />
                  <div class="min-w-0">
                    <p class="font-medium text-slate-900 dark:text-white">{{ l.nom_pdv || 'Point de vente sans nom' }}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      {{ l.auteur_nom || '—' }}, {{ formatDateFr(l.pdv_cree_le || l.cree_le, { day: '2-digit', month: 'short' }) }}
                      <template v-if="l.quartier"> · {{ l.quartier }}</template>
                    </p>
                    <p v-if="l.origine === 'rattrapage'" class="text-xs font-medium text-slate-600 dark:text-slate-300">Déjà en base</p>
                    <p v-if="!l.pdv_actif" class="text-xs font-medium text-red-700 dark:text-red-300">Désactivé</p>
                  </div>
                </div>
              </td>
              <td>
                <div class="flex items-start gap-3">
                  <PDVPhotoModal :image-url="l.voisin_image_url" :pdv-id="l.voisin_pdv_id" :pdv-name="l.voisin_nom" />
                  <div class="min-w-0">
                    <p class="font-medium text-slate-900 dark:text-white">{{ l.voisin_nom || 'Point de vente sans nom' }}</p>
                    <p v-if="!l.voisin_actif" class="text-xs text-slate-500 dark:text-slate-400">Désactivé</p>
                  </div>
                </div>
              </td>
              <td class="whitespace-nowrap">
                <p class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ l.distance_m }} m</p>
                <p class="text-xs" :class="Number(l.similarite_nom) >= 0.8 ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'">
                  {{ libelleNom(l.similarite_nom) }}
                </p>
              </td>
              <td class="whitespace-nowrap text-right">
                <template v-if="!l.verifie_le">
                  <UButton size="xs" variant="soft" :loading="enCours === `${l.id}-d`" :disabled="!!enCours" @click="traiter(l, false)">Deux PDV différents</UButton>
                  <UButton size="xs" color="red" variant="ghost" class="ml-1" :loading="enCours === `${l.id}-x`" :disabled="!!enCours || !l.pdv_actif" @click="traiter(l, true)">
                    Doublon : désactiver le nouveau
                  </UButton>
                </template>
                <p v-else class="text-xs text-slate-500 dark:text-slate-400">
                  {{ l.verifie_action === 'doublon' ? 'Doublon, nouveau désactivé' : 'Deux PDV différents' }}{{ l.verifie_par_nom ? ` par ${l.verifie_par_nom}` : '' }}, {{ formatDateFr(l.verifie_le, { day: '2-digit', month: 'short' }) }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Doublons possibles (1.0.17, demande du 29/10) : un agent a créé un PDV à
// moins de « Rayon des doublons » d'un PDV existant (il a répondu « C'est un
// nouveau PDV », ou son app est plus ancienne), ou paire ATOM déjà en base
// au nom presque identique (rattrapage). Fonction doublons_possibles,
// migration 20261029170000.
import { formatDateFr } from '~/utils/dates'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

type LigneDoublon = {
  id: number
  pdv_id: string
  nom_pdv: string | null
  image_url: string | null
  zone: string | null
  quartier: string | null
  pdv_actif: boolean
  cree_le: string
  /** 'rattrapage' : paire ATOM trouvée dans la base à l'application de la migration. */
  origine: 'creation' | 'rattrapage'
  pdv_cree_le: string | null
  auteur_nom: string | null
  voisin_pdv_id: string
  voisin_nom: string | null
  voisin_image_url: string | null
  voisin_actif: boolean
  distance_m: number
  similarite_nom: number | string | null
  verifie_le: string | null
  verifie_action: 'differents' | 'doublon' | null
  verifie_par_nom: string | null
}

const OPTIONS_VUE = [
  { value: false, label: 'À vérifier' },
  { value: true, label: 'Toutes' },
]

const supabase = useSupabaseClient()
const toast = useToast()
const { parametres, charger: chargerParametres } = useParametresApp()

const tout = ref(false)
const lignes = ref<LigneDoublon[]>([])
const chargement = ref(false)
const erreur = ref('')
const enCours = ref('')

function libelleNom(s: number | string | null): string {
  const n = Number(s)
  if (!Number.isFinite(n)) return ''
  if (n >= 0.8) return 'Nom presque identique'
  if (n >= 0.4) return 'Nom proche'
  return 'Nom différent'
}

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const { data, error } = await (supabase.rpc as any)('doublons_possibles', { p_tout: tout.value })
    if (error) throw error
    lignes.value = (data || []) as LigneDoublon[]
  }
  catch (err) {
    lignes.value = []
    erreur.value = messageUtilisateur(err, 'Doublons indisponibles. La migration 20261029170000 est-elle appliquée ?')
  }
  finally {
    chargement.value = false
  }
}

async function traiter(l: LigneDoublon, doublon: boolean) {
  enCours.value = `${l.id}-${doublon ? 'x' : 'd'}`
  try {
    const { error } = await (supabase.rpc as any)('traiter_doublon_possible', { p_id: l.id, p_doublon: doublon })
    if (error) throw error
    toast.add({
      title: doublon ? 'Doublon désactivé' : 'Deux points de vente gardés',
      description: l.nom_pdv || undefined,
      color: 'green',
    })
    await charger()
  }
  catch (err) {
    toast.add({ title: 'Action impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    enCours.value = ''
  }
}

watch(tout, () => { void charger() })
onMounted(() => {
  void chargerParametres()
  void charger()
})
</script>
