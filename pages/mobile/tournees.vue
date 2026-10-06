<template>
  <div class="mobile-page">
    <div class="p-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Calendrier des tournées</h2>
      <p class="mt-0.5 mb-4 text-xs text-gray-500 dark:text-gray-400">
        Vos tournées passées et à venir. Touchez un jour pour voir ses PDV.
      </p>

      <!-- Navigation par mois -->
      <div class="mobile-card mb-4 flex items-center justify-between p-3">
        <button type="button" class="touch-target inline-flex items-center justify-center rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Mois précédent" @click="changerMois(-1)">
          <UIcon name="i-heroicons-chevron-left" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <div class="text-center">
          <span class="block font-bold capitalize text-gray-800 dark:text-gray-100">{{ libelleMois }}</span>
          <span v-if="!chargement && !erreur" class="text-[11px] text-gray-500 dark:text-gray-400">
            {{ tournees.length }} tournée{{ tournees.length > 1 ? 's' : '' }} · {{ totalMois.faits }}/{{ totalMois.total }} PDV faits
          </span>
        </div>
        <button type="button" class="touch-target inline-flex items-center justify-center rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Mois suivant" @click="changerMois(1)">
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      <!-- Erreur de chargement (hors ligne le plus souvent) -->
      <div v-if="erreur" class="mobile-card mb-4 p-4 text-center">
        <UIcon name="i-heroicons-signal-slash" class="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
        <p class="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Tournées indisponibles</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ isOnline ? 'Le chargement a échoué.' : 'Vous êtes hors ligne : le calendrier se charge avec le réseau.' }}
        </p>
        <UButton class="mt-3" size="sm" variant="soft" icon="i-heroicons-arrow-path" @click="chargerMois">Réessayer</UButton>
      </div>

      <!-- Grille du mois -->
      <div class="mobile-card overflow-hidden" :class="{ 'opacity-60': chargement }" :aria-busy="chargement">
        <div class="grid grid-cols-7 border-b border-gray-100 py-2 text-center text-xs font-medium text-gray-400 dark:border-gray-700">
          <div v-for="d in ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']" :key="d">{{ d }}</div>
        </div>
        <div class="grid grid-cols-7 text-center">
          <template v-for="(jour, idx) in joursGrille" :key="idx">
            <div v-if="!jour.iso" class="min-h-14" />
            <button
              v-else
              type="button"
              class="relative flex min-h-14 flex-col items-center justify-start gap-0.5 py-1.5 transition disabled:cursor-default"
              :class="[
                jour.iso === jourSelectionne ? 'bg-red-50 ring-2 ring-inset ring-fc-red dark:bg-red-950/30' : jour.estAujourdhui ? 'bg-gray-50 dark:bg-gray-700/40' : '',
                jour.tournee ? 'hover:bg-gray-50 dark:hover:bg-gray-700/60' : '',
              ]"
              :disabled="!jour.tournee"
              :aria-pressed="jour.iso === jourSelectionne"
              :aria-label="libelleCellule(jour)"
              @click="selectionnerJour(jour.iso)"
            >
              <span
                class="text-sm"
                :class="[
                  jour.estAujourdhui ? 'font-bold text-fc-red' : 'text-gray-900 dark:text-gray-100',
                  !jour.tournee && !jour.estAujourdhui ? 'text-gray-400 dark:text-gray-500' : '',
                ]"
              >{{ jour.numero }}</span>
              <span
                v-if="jour.tournee"
                class="rounded-full px-1.5 text-[10px] font-semibold leading-4"
                :class="classeEtat(etatTournee(jour.tournee))"
              >{{ jour.tournee.nb_faits }}/{{ jour.tournee.nb_pdv }}</span>
            </button>
          </template>
        </div>
      </div>

      <!-- Légende -->
      <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400" aria-label="Légende">
        <span v-for="e in LEGENDE" :key="e.etat" class="inline-flex items-center gap-1">
          <span class="inline-block h-2.5 w-2.5 rounded-full" :class="classeEtat(e.etat)" />
          {{ e.libelle }}
        </span>
        <span>· faits / PDV</span>
      </div>

      <!-- Aucune tournée ce mois -->
      <div v-if="!chargement && !erreur && tournees.length === 0" class="mobile-card mt-4 py-8 text-center">
        <UIcon name="i-heroicons-calendar" class="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
        <p class="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Aucune tournée ce mois</p>
        <p class="mx-auto mt-1 max-w-[280px] text-xs text-gray-500 dark:text-gray-400">
          Les tournées sont préparées environ une semaine à l'avance.
        </p>
      </div>

      <!-- Détail du jour sélectionné (lecture seule) -->
      <section v-if="tourneeSelectionnee" class="mt-5" aria-live="polite">
        <div class="mb-2 flex items-end justify-between gap-2">
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-400">Tournée du</p>
            <h3 class="text-base font-bold capitalize text-gray-900 dark:text-gray-100">{{ libelleJour(tourneeSelectionnee.date_routing) }}</h3>
          </div>
          <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" :class="classeEtat(etatTournee(tourneeSelectionnee))">
            {{ tourneeSelectionnee.nb_faits }}/{{ tourneeSelectionnee.nb_pdv }} faits
          </span>
        </div>

        <!-- Répartition par type, sur les étapes chargées -->
        <div v-if="repartitionTypes.length" class="mb-3 flex flex-wrap gap-1.5">
          <span v-for="r in repartitionTypes" :key="r.libelle" class="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
            <BadgeTypePdv :sous-categorie="r.exemple" />
            <span class="font-semibold">× {{ r.nombre }}</span>
          </span>
        </div>

        <div v-if="chargementEtapes && !etapes.length" class="space-y-2">
          <div v-for="i in 3" :key="i" class="mobile-card h-14 animate-pulse" />
        </div>
        <p v-else-if="erreurEtapes" class="mobile-card p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Impossible de charger les PDV de cette tournée{{ isOnline ? '' : ' (hors ligne)' }}.
        </p>

        <ul v-else class="space-y-2">
          <li v-for="rp in etapes" :key="rp.id" class="mobile-card flex items-start gap-3 p-3">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              :class="rp.status === 'completed' ? 'bg-emerald-500 text-white' : rp.status === 'skipped' ? 'bg-gray-300 text-white dark:bg-gray-600' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
            >
              <UIcon v-if="rp.status === 'completed'" name="i-heroicons-check" class="h-4 w-4" />
              <template v-else>{{ rp.position_order }}</template>
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ rp.pdv?.nom_pdv || rp.pdv_id }}</p>
              <p v-if="rp.pdv?.quartier || rp.pdv?.zone" class="truncate text-xs text-gray-400">
                {{ rp.pdv?.quartier || rp.pdv?.zone }}
              </p>
              <BadgeTypePdv :sous-categorie="rp.pdv?.sous_categorie_pdv" class="mt-1" />
            </div>
            <UBadge :color="couleurStatut(rp.status)" variant="soft" size="xs" class="shrink-0">
              {{ libelleStatut(rp.status) }}
            </UBadge>
          </li>
        </ul>

        <div v-if="etapes.length && etapes.length < (tourneeSelectionnee.nb_pdv ?? 0)" class="py-3 text-center">
          <UButton variant="soft" color="gray" size="sm" :loading="chargementEtapes" @click="chargerEtapes()">
            Afficher la suite ({{ (tourneeSelectionnee.nb_pdv ?? 0) - etapes.length }} PDV restants)
          </UButton>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Routing, RoutingPDV } from '~/types'
import { toIsoJour } from '~/utils/periode'
import { canalAtom } from '~/utils/canalAtom'

// Lecture seule : aucun geste d'écriture ici (le démarrage des missions reste
// sur « Mon routing »), donc pas de garde terrain-write.
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

type TourneeJour = Pick<Routing, 'id' | 'date_routing' | 'status' | 'nb_pdv' | 'nb_faits'>
type EtatTournee = 'terminee' | 'partielle' | 'non_faite' | 'a_venir'

const user = useSupabaseUser()
const routingStore = useRoutingStore()
const { isOnline } = useOfflineSync()

const aujourdhui = toIsoJour(new Date())
const moisCourant = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const tournees = ref<TourneeJour[]>([])
const chargement = ref(false)
const erreur = ref(false)

const jourSelectionne = ref<string | null>(null)
const etapes = ref<RoutingPDV[]>([])
const chargementEtapes = ref(false)
const erreurEtapes = ref(false)
// Jeton : une page d'étapes encore en vol quand on change de jour est ignorée.
let jetonEtapes = 0

const LEGENDE: { etat: EtatTournee, libelle: string }[] = [
  { etat: 'terminee', libelle: 'Terminée' },
  { etat: 'partielle', libelle: 'Partielle' },
  { etat: 'non_faite', libelle: 'Non faite' },
  { etat: 'a_venir', libelle: 'À venir' },
]

const libelleMois = computed(() =>
  moisCourant.value.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
)

const parJour = computed(() => new Map(tournees.value.map(t => [t.date_routing, t])))

const totalMois = computed(() => tournees.value.reduce(
  (s, t) => ({ total: s.total + (t.nb_pdv ?? 0), faits: s.faits + (t.nb_faits ?? 0) }),
  { total: 0, faits: 0 },
))

// Grille lundi → dimanche ; cases vides avant le 1er et après le dernier jour.
const joursGrille = computed(() => {
  const annee = moisCourant.value.getFullYear()
  const mois = moisCourant.value.getMonth()
  const dernier = new Date(annee, mois + 1, 0).getDate()
  const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7
  const cases: { iso: string | null, numero: number, estAujourdhui: boolean, tournee?: TourneeJour }[] = []
  for (let i = 0; i < decalage; i++) cases.push({ iso: null, numero: 0, estAujourdhui: false })
  for (let j = 1; j <= dernier; j++) {
    const iso = toIsoJour(new Date(annee, mois, j))
    cases.push({ iso, numero: j, estAujourdhui: iso === aujourdhui, tournee: parJour.value.get(iso) })
  }
  while (cases.length % 7) cases.push({ iso: null, numero: 0, estAujourdhui: false })
  return cases
})

const tourneeSelectionnee = computed(() => (jourSelectionne.value ? parJour.value.get(jourSelectionne.value) ?? null : null))

// Répartition par type (canal Atom ou sous-catégorie) : seulement une fois
// toute la tournée chargée, sinon les chiffres seraient ceux d'une page.
const repartitionTypes = computed(() => {
  const tournee = tourneeSelectionnee.value
  if (!tournee || !etapes.value.length || etapes.value.length < (tournee.nb_pdv ?? 0)) return []
  const compte = new Map<string, { libelle: string, exemple: string, nombre: number }>()
  for (const rp of etapes.value) {
    const sc = (rp.pdv?.sous_categorie_pdv || '').trim()
    if (!sc) continue
    const libelle = canalAtom(sc) ?? sc
    const ligne = compte.get(libelle) ?? { libelle, exemple: sc, nombre: 0 }
    ligne.nombre++
    compte.set(libelle, ligne)
  }
  return [...compte.values()].sort((a, b) => b.nombre - a.nombre)
})

function etatTournee(t: TourneeJour): EtatTournee {
  const total = t.nb_pdv ?? 0
  const faits = t.nb_faits ?? 0
  if (t.status === 'completed' || (total > 0 && faits >= total)) return 'terminee'
  if (t.date_routing >= aujourdhui) return 'a_venir'
  return faits > 0 ? 'partielle' : 'non_faite'
}

function classeEtat(etat: EtatTournee) {
  return {
    terminee: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    partielle: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    non_faite: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    a_venir: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  }[etat]
}

function libelleCellule(jour: { iso: string | null, numero: number, tournee?: TourneeJour }) {
  if (!jour.tournee) return `${jour.numero} : pas de tournée`
  return `${jour.numero} : tournée de ${jour.tournee.nb_pdv} PDV, ${jour.tournee.nb_faits} faits`
}

function libelleJour(iso: string) {
  // T00:00:00 : interprétation en heure locale (voir utils/periode.ts).
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function couleurStatut(s: string): any {
  return { pending: 'gray', in_progress: 'amber', completed: 'green', skipped: 'orange' }[s] || 'gray'
}

function libelleStatut(s: string) {
  return { pending: 'À faire', in_progress: 'En cours', completed: 'Fait', skipped: 'Passé' }[s] || s
}

function changerMois(delta: number) {
  moisCourant.value = new Date(moisCourant.value.getFullYear(), moisCourant.value.getMonth() + delta, 1)
}

async function chargerMois() {
  if (!user.value?.id) return
  const annee = moisCourant.value.getFullYear()
  const mois = moisCourant.value.getMonth()
  const debut = toIsoJour(new Date(annee, mois, 1))
  const fin = toIsoJour(new Date(annee, mois + 1, 0))
  chargement.value = true
  erreur.value = false
  try {
    tournees.value = await routingStore.fetchCalendrierTournees(user.value.id, debut, fin)
  }
  catch (err) {
    console.warn('[Tournées] calendrier indisponible (hors ligne ?)', err)
    tournees.value = []
    erreur.value = true
  }
  finally {
    chargement.value = false
  }

  // Jour ouvert par défaut : aujourd'hui s'il a une tournée, sinon la
  // prochaine du mois, sinon la dernière passée.
  if (!jourSelectionne.value || !parJour.value.has(jourSelectionne.value)) {
    const prochaine = tournees.value.find(t => t.date_routing >= aujourdhui)
    const choix = prochaine ?? tournees.value[tournees.value.length - 1]
    if (choix) selectionnerJour(choix.date_routing)
    else { jourSelectionne.value = null; etapes.value = [] }
  }
}

function selectionnerJour(iso: string) {
  if (!parJour.value.has(iso)) return
  jourSelectionne.value = iso
  etapes.value = []
  erreurEtapes.value = false
  jetonEtapes++
  void chargerEtapes()
}

/** Page suivante des étapes du jour sélectionné (50 par 50, comme Mon routing). */
async function chargerEtapes() {
  const tournee = tourneeSelectionnee.value
  if (!tournee || chargementEtapes.value) return
  const jeton = jetonEtapes
  chargementEtapes.value = true
  try {
    const page = await routingStore.chargerEtapesRouting(tournee.id, etapes.value.length)
    if (jeton === jetonEtapes) {
      const vus = new Set(etapes.value.map(e => e.id))
      etapes.value = [...etapes.value, ...page.filter(e => !vus.has(e.id))]
    }
  }
  catch (err) {
    console.warn('[Tournées] étapes indisponibles', err)
    if (jeton === jetonEtapes) erreurEtapes.value = true
  }
  finally {
    chargementEtapes.value = false
  }
  // Jour changé pendant le chargement : la page reçue est jetée, on charge
  // celle du nouveau jour.
  if (jeton !== jetonEtapes && tourneeSelectionnee.value) void chargerEtapes()
}

watch(moisCourant, chargerMois)
watch(() => user.value?.id, (id) => { if (id) void chargerMois() }, { immediate: true })
</script>
