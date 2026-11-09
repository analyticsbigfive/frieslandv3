<template>
  <div class="space-y-6">
    <AdminPageHeader description="Points de vente signalés fermés sur le terrain. Chaque signalement porte deux photos de la devanture, prises sur place. Comparez-les à la photo du point de vente : fermer définitivement (il sort des listes et des tournées, ses visites restent), ou garder.">
      <template #actions>
        <UButton icon="i-heroicons-arrow-path" variant="outline" :loading="chargement" @click="charger">Actualiser</UButton>
      </template>
    </AdminPageHeader>

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

    <div v-if="erreur" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100" role="alert">
      {{ erreur }}
    </div>

    <ChargementContenu v-else-if="chargement && !lignes.length" variante="lignes" libelle="Chargement des fermetures signalées…" />

    <p v-else-if="!lignes.length" class="admin-surface p-6 text-sm text-slate-600 dark:text-slate-300">
      {{ tout ? 'Aucune fermeture signalée.' : 'Rien à vérifier : toutes les fermetures signalées ont été traitées.' }}
    </p>

    <section v-else class="admin-surface overflow-hidden" aria-label="Fermetures signalées">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Point de vente</th>
              <th scope="col">Photos de la devanture</th>
              <th scope="col">Signalement</th>
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
                      {{ l.pdv_id }}<template v-if="l.zone"> · {{ l.zone }}</template><template v-if="l.quartier"> · {{ l.quartier }}</template>
                    </p>
                    <p v-if="!l.pdv_actif" class="text-xs font-medium text-red-700 dark:text-red-300">Désactivé</p>
                  </div>
                </div>
              </td>
              <td>
                <div class="flex gap-2">
                  <a
                    v-for="(chemin, i) in l.photos"
                    :key="chemin"
                    :href="urlPhoto(chemin)"
                    target="_blank"
                    rel="noopener"
                    class="block shrink-0 overflow-hidden rounded-md border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fc-red dark:border-slate-600"
                    :title="`Photo ${i + 1}${l.photos_prises_le?.[i] ? `, prise à ${heure(l.photos_prises_le[i]!)}` : ''}`"
                  >
                    <img :src="urlPhoto(chemin)" :alt="`Devanture de ${l.nom_pdv || 'ce point de vente'}, photo ${i + 1}`" class="h-20 w-16 bg-slate-100 object-cover dark:bg-slate-700" loading="lazy">
                  </a>
                </div>
              </td>
              <td class="text-sm">
                <p class="text-slate-900 dark:text-white">
                  {{ l.declarant_nom || '—' }}, {{ formatDateFr(l.declare_le, { day: '2-digit', month: 'short' }) }} à {{ heure(l.declare_le) }}
                </p>
                <p class="text-xs" :class="lointain(l) ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'">
                  {{ libelleDistance(l) }}
                </p>
                <p v-if="l.en_tournee" class="text-xs text-slate-500 dark:text-slate-400">Depuis la tournée du jour</p>
                <p v-if="l.commentaire" class="mt-1 max-w-xs text-xs italic text-slate-600 dark:text-slate-300">« {{ l.commentaire }} »</p>
              </td>
              <td class="whitespace-nowrap text-right">
                <template v-if="!l.decision">
                  <UButton size="xs" variant="soft" :loading="enCours === `${l.id}-g`" :disabled="!!enCours" @click="traiter(l, false)">Garder ouvert</UButton>
                  <UButton size="xs" color="red" variant="ghost" class="ml-1" :loading="enCours === `${l.id}-f`" :disabled="!!enCours" @click="traiter(l, true)">
                    Fermer définitivement
                  </UButton>
                </template>
                <p v-else class="text-xs text-slate-500 dark:text-slate-400">
                  {{ l.decision === 'fermer' ? 'Fermé, PDV désactivé' : 'Gardé ouvert' }}{{ l.decide_par_nom ? ` par ${l.decide_par_nom}` : '' }}, {{ formatDateFr(l.decide_le!, { day: '2-digit', month: 'short' }) }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AdminConfirmation v-bind="confirmation" @confirmer="confirmer" @annuler="annuler" />
  </div>
</template>

<script setup lang="ts">
// Fermetures signalées (demande du 06/11/2026) : sur le terrain, « PDV fermé »
// n'est possible qu'avec deux photos de la devanture. Ici l'admin ou le
// superviseur décide. Fonctions fermetures_pdv_signalees et
// traiter_fermeture_pdv, migration 20261106120000.
import { formatDateFr } from '~/utils/dates'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

type LigneFermeture = {
  id: string
  pdv_id: string
  nom_pdv: string | null
  image_url: string | null
  zone: string | null
  quartier: string | null
  pdv_actif: boolean
  declare_le: string
  declarant_nom: string | null
  /** Chemins dans le bucket visite-images. */
  photos: string[]
  photos_prises_le: string[] | null
  precision_gps: number | null
  distance_pdv_m: number | null
  commentaire: string | null
  en_tournee: boolean
  decision: 'fermer' | 'garder' | null
  decide_le: string | null
  decide_par_nom: string | null
}

const OPTIONS_VUE = [
  { value: false, label: 'À vérifier' },
  { value: true, label: 'Toutes' },
]

const supabase = useSupabaseClient()
const toast = useToast()
const { parametres, charger: chargerParametres } = useParametresApp()
const { confirmation, demanderConfirmation, confirmer, annuler } = useConfirmation()

const tout = ref(false)
const lignes = ref<LigneFermeture[]>([])
const chargement = ref(false)
const erreur = ref('')
const enCours = ref('')

function urlPhoto(chemin: string): string {
  return supabase.storage.from('visite-images').getPublicUrl(chemin).data.publicUrl
}

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Au-delà du rayon de la tournée, l'agent n'était peut-être pas devant.
function lointain(l: LigneFermeture): boolean {
  return l.distance_pdv_m != null && l.distance_pdv_m > parametres.value.geofence_rayon_m
}

function libelleDistance(l: LigneFermeture): string {
  if (l.distance_pdv_m == null) return 'Point de vente sans position : distance inconnue'
  return `À ${l.distance_pdv_m} m du point de vente${l.precision_gps != null ? ` (GPS ± ${l.precision_gps} m)` : ''}`
}

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const { data, error } = await (supabase.rpc as any)('fermetures_pdv_signalees', { p_tout: tout.value })
    if (error) throw error
    lignes.value = (data || []) as LigneFermeture[]
  }
  catch (err) {
    lignes.value = []
    erreur.value = messageUtilisateur(err, 'Fermetures indisponibles. La migration 20261106120000 est-elle appliquée ?')
  }
  finally {
    chargement.value = false
  }
}

async function traiter(l: LigneFermeture, fermer: boolean) {
  const nom = l.nom_pdv || 'ce point de vente'
  if (fermer && !(await demanderConfirmation({
    titre: `Fermer « ${nom} » ?`,
    message: 'Il n’apparaîtra plus dans les listes ni dans les tournées. Ses visites restent.',
    libelleAction: 'Fermer définitivement',
  }))) return

  enCours.value = `${l.id}-${fermer ? 'f' : 'g'}`
  try {
    const { error } = await (supabase.rpc as any)('traiter_fermeture_pdv', { p_id: l.id, p_fermer: fermer })
    if (error) throw error
    toast.add({
      title: fermer ? 'Point de vente fermé' : 'Point de vente gardé ouvert',
      description: nom,
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
