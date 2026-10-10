<template>
  <!-- Planning d'équipe : une ligne par personne, une colonne par jour de la
       semaine. Une case = la tournée du jour (ou la règle qui la prévoit) ;
       un clic ouvre la popup « Tournée du jour » de la page. -->
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chevron-left" aria-label="Semaine précédente" @click="lundi = decalerSemaine(lundi, -1)" />
      <h2 class="min-w-[14rem] text-center text-base font-semibold text-slate-900 dark:text-white" aria-live="polite">{{ libelleSemaine }}</h2>
      <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chevron-right" aria-label="Semaine suivante" @click="lundi = decalerSemaine(lundi, 1)" />
      <UButton v-if="lundi !== lundiCourant" size="xs" variant="outline" @click="lundi = lundiCourant">Cette semaine</UButton>

      <div v-if="!authStore.isAgence" class="inline-flex flex-wrap rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Filtrer par agence">
        <button
          v-for="f in FILTRES"
          :key="f.k"
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="filtre === f.k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
          :aria-pressed="filtre === f.k"
          @click="filtre = f.k"
        >
          {{ f.l }}
        </button>
      </div>
      <UInput v-model="recherche" size="xs" icon="i-heroicons-magnifying-glass" placeholder="Personne ou zone" class="w-48" aria-label="Rechercher une personne ou une zone" />

      <p class="ml-auto text-xs tabular-nums text-slate-600 dark:text-slate-300">
        <template v-if="chargement">Chargement…</template>
        <template v-else>{{ resume.tournees }} tournée(s) · {{ resume.faits }}/{{ resume.pdv }} PDV faits</template>
      </p>
    </div>

    <!-- data-no-column-tools : grille personne × jour, déjà filtrée par agence et
         recherche ; le tri et les filtres par colonne d'AdminTableEnhancer n'y ont pas de sens. -->
    <div class="relative overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
      <table class="w-full min-w-[52rem] border-separate border-spacing-0 text-xs tabular-nums" data-no-column-tools>
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-800">
            <th scope="col" class="sticky left-0 z-10 w-56 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {{ grille.length }} personne(s)
            </th>
            <th
              v-for="d in jours"
              :key="d"
              scope="col"
              class="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold dark:border-slate-700"
              :class="d === aujourdhui ? 'text-brand-600 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'"
              :aria-current="d === aujourdhui ? 'date' : undefined"
            >
              {{ JOURS_COURTS[jourSemaine(d)] }}
              <span class="block text-sm" :class="d === aujourdhui ? 'text-brand-600 dark:text-brand-300' : 'text-slate-900 dark:text-white'">{{ Number(d.slice(8)) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ligne in grille" :key="ligne.id">
            <th scope="row" class="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left align-top font-normal dark:border-slate-700 dark:bg-slate-800">
              <!-- Largeur fixe : sans elle, une longue liste de zones élargit toute la colonne. -->
              <div class="w-52">
                <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ ligne.nom }}</p>
                <p class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" :title="ligne.zone || undefined">
                  <span class="shrink-0 rounded bg-slate-100 px-1.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">{{ ligne.agence }}</span>
                  <span class="truncate">{{ ligne.zone }}</span>
                </p>
              </div>
            </th>
            <td
              v-for="(c, i) in ligne.cases"
              :key="jours[i]"
              class="border-b border-slate-200 p-1 align-top dark:border-slate-700"
              :class="jours[i] === aujourdhui ? 'bg-brand-50/40 dark:bg-brand-500/5' : ''"
            >
              <button
                type="button"
                class="flex min-h-[3.5rem] w-full flex-col items-start gap-0.5 rounded-md p-1.5 text-left transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 disabled:cursor-default"
                :class="c.classes.fond"
                :title="c.titre || undefined"
                :disabled="!c.cliquable"
                @click="ouvrir(ligne, jours[i]!, c)"
              >
                <span v-if="c.texte" class="text-xs" :class="c.classes.texte">{{ c.texte }}</span>
                <span v-else class="text-xs text-slate-500 dark:text-slate-400"><span aria-hidden="true">—</span><span class="sr-only">Rien de prévu</span></span>
                <span v-if="c.ssf" class="max-w-full truncate text-xs text-slate-600 dark:text-slate-300">{{ c.ssf }}</span>
                <span v-if="c.progression !== null" class="mt-auto h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10" aria-hidden="true">
                  <span class="block h-full rounded-full bg-current" :style="{ width: `${c.progression}%` }" />
                </span>
              </button>
            </td>
          </tr>
          <tr v-if="!grille.length && !chargement">
            <td :colspan="jours.length + 1" class="px-3 py-8 text-center text-sm text-slate-600 dark:text-slate-300">
              Aucune tournée ni règle cette semaine pour ce filtre. Changez de semaine, d'agence ou videz la recherche.
            </td>
          </tr>
        </tbody>
        <tfoot v-if="grille.length">
          <tr class="bg-slate-50 dark:bg-slate-800">
            <td class="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Total du jour
            </td>
            <td v-for="(t, i) in totaux" :key="jours[i]" class="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-200">
              <template v-if="!t.n">—</template>
              <template v-else-if="jours[i]! <= aujourdhui">{{ t.faits }}/{{ t.pdv }} faits</template>
              <template v-else>{{ t.pdv }} PDV</template>
            </td>
          </tr>
        </tfoot>
      </table>

      <div v-if="chargement" class="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/50">
        <ChargementContenu variante="compact" libelle="Chargement de la semaine…" />
      </div>
    </div>

    <!-- Légende (mêmes couleurs que le calendrier par personne) -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      <span v-for="l in LEGENDE" :key="l.libelle" class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm" :class="l.pastille" aria-hidden="true" />{{ l.libelle }}
      </span>
      <span>Sous le nombre de points de vente : le vendeur du distributeur (SSF) prévu ce jour-là.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Profile, Routing, RoutingTemplate } from '~/types'
import { toIsoJour } from '~/utils/periode'
import { estMerchandiserProgramme } from '~/utils/agences'
import { couvertureJour, decalerSemaine, etatJourTournee, joursSemaine, lundiDe, type EtatJourTournee } from '~/utils/calendrierTournees'
import { CLASSES_ETAT_TOURNEE } from '~/composables/classesEtatTournee'
import { messageUtilisateur } from '~/utils/supabaseErrors'

// Légende : mêmes fonds que les cases (CLASSES_ETAT_TOURNEE), cerclés d'un
// trait pour que les voiles clairs restent visibles à 12 px.
const LEGENDE = [
  { libelle: 'À venir', pastille: `${CLASSES_ETAT_TOURNEE.planifiee.fond} ring-1 ring-inset ring-sky-300 dark:ring-sky-500/60` },
  { libelle: 'Tout fait', pastille: `${CLASSES_ETAT_TOURNEE.faite.fond} ring-1 ring-inset ring-emerald-300 dark:ring-emerald-500/60` },
  { libelle: 'Incomplète', pastille: `${CLASSES_ETAT_TOURNEE.incomplete.fond} ring-1 ring-inset ring-amber-300 dark:ring-amber-500/60` },
  { libelle: 'Prévue par une règle, à générer', pastille: 'border border-dashed border-slate-400 dark:border-slate-500' },
  { libelle: 'Suspendue ou annulée', pastille: `${CLASSES_ETAT_TOURNEE.suspendue.fond} ring-1 ring-inset ring-slate-300 dark:ring-slate-600` },
] as const

const props = withDefaults(defineProps<{
  /** Toutes les règles de tournée (la page les a déjà chargées). */
  regles?: RoutingTemplate[]
  /** Utilisateurs terrain (nom, employeur, territoires). */
  utilisateurs?: Profile[]
  /** Nom d'un SSF à partir de son identifiant. */
  nomSsf?: (id: number) => string
  /** Filtre « Utilisateur » de la page : une seule personne. */
  utilisateurId?: string
  /** Incrémenté par la page après une génération, un import, une modification. */
  rafraichir?: number
}>(), {
  regles: () => [],
  utilisateurs: () => [],
  nomSsf: undefined,
  utilisateurId: '',
  rafraichir: 0,
})

const emit = defineEmits<{
  (e: 'jour', payload: { userId: string; user: Profile | null; date: string; routing: Routing | null; regle: RoutingTemplate | null }): void
}>()

// Un filtre par agence active (Référentiels › Agences) : une nouvelle agence
// apparaît sans changer le code.
const { actives: agencesActives, nom: nomAgence, charger: chargerAgences } = useAgences()
// Le compte agence ne voit que ses merchandisers : pas de filtre par agence.
const authStore = useAuthStore()
void chargerAgences()
const FILTRES = computed(() => [{ k: 'tous', l: 'Tous' }, ...agencesActives.value.map(a => ({ k: a.code, l: a.nom }))])
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const routingStore = useRoutingStore()
const toast = useToast()

const aujourdhui = toIsoJour(new Date())
const lundiCourant = lundiDe(aujourdhui)
const lundi = ref(lundiCourant)
const filtre = ref<string>('tous')
const recherche = ref('')

const tournees = ref(new Map<string, Routing>())
const chargement = ref(false)
let jeton = 0

const jourSemaine = (d: string) => new Date(`${d}T00:00:00`).getDay()

async function charger() {
  const moi = ++jeton
  chargement.value = true
  try {
    const semaine = joursSemaine(lundi.value, true)
    const liste = await routingStore.fetchRoutings({
      dateFrom: semaine[0],
      dateTo: semaine[6],
      userId: props.utilisateurId || undefined,
      limite: 1000,
    })
    // Navigation rapide d'une semaine à l'autre : seule la dernière réponse compte.
    if (moi === jeton) tournees.value = new Map(liste.map(r => [`${r.user_id}|${r.date_routing}`, r]))
  }
  catch (err: any) {
    toast.add({ title: 'Semaine non chargée', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    if (moi === jeton) chargement.value = false
  }
}

watch([lundi, () => props.utilisateurId, () => props.rafraichir], charger, { immediate: true })

// Le dimanche n'apparaît que s'il porte une tournée.
const jours = computed(() => {
  const dimanche = joursSemaine(lundi.value, true)[6]!
  const avecDimanche = [...tournees.value.values()].some(r => r.date_routing === dimanche)
  return joursSemaine(lundi.value, avecDimanche)
})

const libelleSemaine = computed(() => {
  const debut = new Date(`${jours.value[0]}T00:00:00`)
  const fin = new Date(`${jours.value[jours.value.length - 1]}T00:00:00`)
  const memeMois = debut.getMonth() === fin.getMonth()
  const de = debut.toLocaleDateString('fr-FR', memeMois ? { day: 'numeric' } : { day: 'numeric', month: 'long' })
  return `Semaine du ${de} au ${fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
})

const reglesParPersonne = computed(() => {
  const m = new Map<string, RoutingTemplate[]>()
  for (const r of props.regles) {
    if (!m.has(r.user_id)) m.set(r.user_id, [])
    m.get(r.user_id)!.push(r)
  }
  return m
})

interface Case extends EtatJourTournee {
  classes: { fond: string, texte: string }
  routing: Routing | null
  regleJour: RoutingTemplate | null
  ssf: string | null
}

function caseDe(userId: string, d: string): Case {
  const routing = tournees.value.get(`${userId}|${d}`) || null
  const regles = reglesParPersonne.value.get(userId) || []
  const couverture = couvertureJour(regles as any, d)
  const e = etatJourTournee(routing, couverture, d, aujourdhui)
  // Règle du jour : celle qui a produit la tournée, sinon une règle SSF qui couvre ce jour.
  const regleJour = (routing?.template_id ? regles.find(r => r.id === routing.template_id) : undefined)
    || (couverture.regles.find(r => (r as any).ssf_id) as RoutingTemplate | undefined)
    || (e.regle as RoutingTemplate | null)
  const ssfId = regleJour?.ssf_id
  return {
    ...e,
    classes: CLASSES_ETAT_TOURNEE[e.etat],
    routing,
    regleJour,
    ssf: ssfId ? (props.nomSsf?.(ssfId) || `SSF ${ssfId}`) : null,
  }
}

const grille = computed(() => {
  // Personnes : une tournée cette semaine, ou une règle active qui couvre un des jours.
  const ids = new Set<string>()
  for (const r of tournees.value.values()) ids.add(r.user_id)
  for (const [userId, regles] of reglesParPersonne.value) {
    if (jours.value.some(d => couvertureJour(regles as any, d).regles.length)) ids.add(userId)
  }
  const q = recherche.value.trim().toLowerCase()
  const parId = new Map(props.utilisateurs.map(u => [u.id, u]))
  const joint = new Map([...tournees.value.values()].map(r => [r.user_id, (r as any).user as Profile | undefined]))
  return [...ids]
    .filter(id => !props.utilisateurId || id === props.utilisateurId)
    .map((id) => {
      const user = parId.get(id) || joint.get(id) || null
      const zones = user?.territoires_assignes?.length ? user.territoires_assignes : [user?.zone_assignee].filter(Boolean)
      return {
        id,
        user,
        nom: user?.nom || user?.email || 'Personne inconnue',
        employeur: user?.employeur || 'friesland',
        agence: nomAgence(user?.employeur || 'friesland'),
        programme: estMerchandiserProgramme(user?.employeur, agencesActives.value),
        zone: (zones as string[]).join(', '),
      }
    })
    .filter(p => filtre.value === 'tous' || p.employeur === filtre.value)
    .filter(p => !q || p.nom.toLowerCase().includes(q) || p.zone.toLowerCase().includes(q))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map(p => ({ ...p, cases: jours.value.map(d => caseDe(p.id, d)) }))
})

const totaux = computed(() => jours.value.map((_, i) => {
  let n = 0, pdv = 0, faits = 0
  for (const ligne of grille.value) {
    const r = ligne.cases[i]!.routing
    if (!r || r.status === 'cancelled') continue
    n++
    pdv += r.nb_pdv ?? 0
    faits += r.nb_faits ?? 0
  }
  return { n, pdv, faits }
}))

const resume = computed(() => totaux.value.reduce((s, t) => ({ tournees: s.tournees + t.n, pdv: s.pdv + t.pdv, faits: s.faits + t.faits }), { tournees: 0, pdv: 0, faits: 0 }))

function ouvrir(ligne: { id: string, user: Profile | null }, date: string, c: Case) {
  if (!c.cliquable) return
  emit('jour', { userId: ligne.id, user: ligne.user, date, routing: c.routing, regle: c.regleJour })
}
</script>
