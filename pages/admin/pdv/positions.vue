<template>
  <div class="space-y-6">
    <AdminPageHeader description="Points de vente déplacés de loin depuis le terrain : une visite où l'agent a confirmé être devant, ou une position tapée à la main. Gardez la nouvelle position ou remettez l'ancienne.">
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
        Au-delà de {{ formatNombre(parametres.gps_deplacement_verif_m) }} m (Paramètres terrain › « Déplacement à vérifier »), sur les 90 derniers jours.
      </p>
    </div>

    <div v-if="erreur" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100" role="alert">
      {{ erreur }}
    </div>

    <ChargementContenu v-else-if="chargement && !lignes.length" variante="lignes" libelle="Chargement des positions à vérifier…" />

    <p v-else-if="!lignes.length" class="admin-surface p-6 text-sm text-slate-600 dark:text-slate-300">
      {{ tout ? 'Aucun déplacement de cette taille sur la période.' : 'Rien à vérifier : tous les déplacements ont été traités.' }}
    </p>

    <section v-else class="admin-surface overflow-hidden" aria-label="Positions à vérifier">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Point de vente</th>
              <th scope="col">Déplacement</th>
              <th scope="col">Par</th>
              <th scope="col">Positions</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lignes" :key="l.id">
              <td>
                <p class="font-medium text-slate-900 dark:text-white">{{ l.nom_pdv || 'Point de vente sans nom' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ [l.zone, l.quartier].filter(Boolean).join(' › ') || '—' }}</p>
              </td>
              <td class="whitespace-nowrap">
                <p class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ formatDistance(l.ecart_m) }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ libelleOrigine(l) }}</p>
              </td>
              <td>
                <p>{{ l.auteur_nom || '—' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDateFr(l.date_visite || l.cree_le, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
                  <template v-if="l.precision_m != null"> · précision {{ Math.round(Number(l.precision_m)) }} m</template>
                  <template v-if="l.appareil_modele"> · {{ l.appareil_modele }}</template>
                </p>
              </td>
              <td class="whitespace-nowrap text-sm">
                <a v-if="l.ancien_lat != null" :href="lienCarte(l.ancien_lat, l.ancien_lng)" target="_blank" rel="noopener" class="text-fc-red underline underline-offset-2">Ancienne</a>
                <span v-else class="text-slate-400">Pas d'ancienne</span>
                <span class="mx-1 text-slate-400" aria-hidden="true">→</span>
                <a :href="lienCarte(l.nouveau_lat, l.nouveau_lng)" target="_blank" rel="noopener" class="text-fc-red underline underline-offset-2">Nouvelle</a>
                <p v-if="l.deplace_depuis" class="text-xs text-amber-700 dark:text-amber-300">A encore bougé depuis</p>
              </td>
              <td class="whitespace-nowrap text-right">
                <template v-if="!l.verifie_le">
                  <UButton size="xs" variant="soft" :loading="enCours === `${l.id}-g`" :disabled="!!enCours" @click="traiter(l, false)">Garder</UButton>
                  <UButton
                    size="xs"
                    color="red"
                    variant="ghost"
                    class="ml-1"
                    :loading="enCours === `${l.id}-r`"
                    :disabled="!!enCours || l.ancien_lat == null || l.deplace_depuis"
                    @click="traiter(l, true)"
                  >
                    Remettre l'ancienne
                  </UButton>
                </template>
                <p v-else class="text-xs text-slate-500 dark:text-slate-400">
                  {{ l.verifie_action === 'remise' ? 'Ancienne remise' : 'Gardée' }}{{ l.verifie_par_nom ? ` par ${l.verifie_par_nom}` : '' }}, {{ formatDateFr(l.verifie_le, { day: '2-digit', month: 'short' }) }}
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
// Positions à vérifier (1.0.17) : depuis que la distance ne bloque plus la
// visite, un agent loin du repère peut répondre « Oui, je suis devant » et
// déplacer le PDV jusqu'à lui. Les grands déplacements arrivent ici
// (fonction positions_a_verifier, migration 20261029170000).
import { formatDateFr } from '~/utils/dates'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

type LignePosition = {
  id: number
  pdv_id: string
  nom_pdv: string | null
  zone: string | null
  quartier: string | null
  ancien_lat: number | null
  ancien_lng: number | null
  ancienne_source: string | null
  nouveau_lat: number
  nouveau_lng: number
  ecart_m: number
  precision_m: number | string | null
  visite_id: string | null
  date_visite: string | null
  confirmation: string | null
  appareil_modele: string | null
  auteur_nom: string | null
  cree_le: string
  source_actuelle: string | null
  deplace_depuis: boolean
  verifie_le: string | null
  verifie_action: 'gardee' | 'remise' | null
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
const lignes = ref<LignePosition[]>([])
const chargement = ref(false)
const erreur = ref('')
const enCours = ref('')

const nombre = new Intl.NumberFormat('fr-FR')
const formatNombre = (n: number) => nombre.format(n)
const formatDistance = (m: number) => (m >= 1000 ? `${nombre.format(Math.round(m / 100) / 10)} km` : `${nombre.format(m)} m`)
const lienCarte = (lat: number | null, lng: number | null) => `https://www.google.com/maps?q=${lat},${lng}`

function libelleOrigine(l: LignePosition): string {
  if (l.confirmation === 'devant') return 'Visite : « je suis devant »'
  if (l.visite_id) return 'Première visite'
  return 'Position tapée à la main'
}

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const { data, error } = await (supabase.rpc as any)('positions_a_verifier', { p_tout: tout.value })
    if (error) throw error
    lignes.value = (data || []) as LignePosition[]
  }
  catch (err) {
    lignes.value = []
    erreur.value = messageUtilisateur(err, 'Positions indisponibles. La migration 20261029170000 est-elle appliquée ?')
  }
  finally {
    chargement.value = false
  }
}

async function traiter(l: LignePosition, remettre: boolean) {
  enCours.value = `${l.id}-${remettre ? 'r' : 'g'}`
  try {
    const { error } = await (supabase.rpc as any)('traiter_position_a_verifier', { p_id: l.id, p_remettre: remettre })
    if (error) throw error
    toast.add({
      title: remettre ? 'Ancienne position remise' : 'Nouvelle position gardée',
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
