<template>
  <!-- Planning d'équipe : une ligne par personne, une colonne par jour de la
       semaine. Une case = la tournée du jour (ou la règle qui la prévoit) ;
       un clic ouvre la popup « Tournée du jour » de la page. -->
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chevron-left" aria-label="Semaine précédente" @click="lundi = decalerSemaine(lundi, -1)" />
      <h4 class="min-w-[14rem] text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{{ libelleSemaine }}</h4>
      <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chevron-right" aria-label="Semaine suivante" @click="lundi = decalerSemaine(lundi, 1)" />
      <UButton v-if="lundi !== lundiCourant" size="xs" variant="soft" color="gray" @click="lundi = lundiCourant">Aujourd'hui</UButton>

      <div class="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700" role="group" aria-label="Employeur">
        <button
          v-for="f in FILTRES"
          :key="f.k"
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition"
          :class="filtre === f.k ? 'bg-fc-red text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'"
          :aria-pressed="filtre === f.k"
          @click="filtre = f.k"
        >
          {{ f.l }}
        </button>
      </div>
      <UInput v-model="recherche" size="xs" icon="i-heroicons-magnifying-glass" placeholder="Personne ou zone" class="w-48" aria-label="Rechercher une personne ou une zone" />

      <p class="ml-auto text-xs text-gray-500 dark:text-gray-400">
        <template v-if="chargement">Chargement…</template>
        <template v-else>{{ resume.tournees }} tournée(s) · {{ resume.faits }}/{{ resume.pdv }} PDV faits</template>
      </p>
    </div>

    <div class="relative overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table class="w-full min-w-[52rem] border-separate border-spacing-0 text-xs tabular-nums">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-800">
            <th scope="col" class="sticky left-0 z-10 w-56 border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              {{ grille.length }} personne(s)
            </th>
            <th
              v-for="d in jours"
              :key="d"
              scope="col"
              class="border-b border-gray-200 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide dark:border-gray-700"
              :class="d === aujourdhui ? 'text-fc-red' : 'text-gray-400'"
            >
              {{ JOURS_COURTS[jourSemaine(d)] }}
              <span class="block text-sm normal-case" :class="d === aujourdhui ? 'text-fc-red' : 'text-gray-900 dark:text-gray-100'">{{ Number(d.slice(8)) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ligne in grille" :key="ligne.id">
            <th scope="row" class="sticky left-0 z-10 border-b border-r border-gray-100 bg-white px-3 py-2 text-left align-top font-normal dark:border-gray-700 dark:bg-gray-800">
              <p class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ ligne.nom }}</p>
              <p class="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                <span
                  class="rounded px-1 text-[10px] font-semibold uppercase tracking-wide"
                  :class="ligne.atom ? 'bg-fc-red/10 text-fc-red' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'"
                >{{ ligne.atom ? 'Atom' : 'Friesland' }}</span>
                <span class="truncate">{{ ligne.zone }}</span>
              </p>
            </th>
            <td
              v-for="(c, i) in ligne.cases"
              :key="jours[i]"
              class="border-b border-gray-100 p-1 align-top dark:border-gray-700"
              :class="jours[i] === aujourdhui ? 'bg-fc-red/[0.03]' : ''"
            >
              <button
                type="button"
                class="flex min-h-[3.5rem] w-full flex-col items-start gap-0.5 rounded-md p-1.5 text-left transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fc-red disabled:cursor-default"
                :class="c.classes.fond"
                :title="c.titre || undefined"
                :disabled="!c.cliquable"
                @click="ouvrir(ligne, jours[i]!, c)"
              >
                <span class="text-[11px] sm:text-xs" :class="c.texte ? c.classes.texte : 'text-gray-300 dark:text-gray-600'">{{ c.texte || '—' }}</span>
                <span v-if="c.ssf" class="max-w-full truncate text-[10px] font-medium text-gray-500 dark:text-gray-400">{{ c.ssf }}</span>
                <span v-if="c.progression !== null" class="mt-auto h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <span class="block h-full rounded-full bg-current" :style="{ width: `${c.progression}%` }" />
                </span>
              </button>
            </td>
          </tr>
          <tr v-if="!grille.length && !chargement">
            <td :colspan="jours.length + 1" class="px-3 py-8 text-center text-sm text-gray-400">
              Aucune tournée ni règle cette semaine pour ce filtre.
            </td>
          </tr>
        </tbody>
        <tfoot v-if="grille.length">
          <tr class="bg-gray-50 dark:bg-gray-800">
            <td class="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              Total du jour
            </td>
            <td v-for="(t, i) in totaux" :key="jours[i]" class="px-2 py-2 text-center font-semibold text-gray-500 dark:text-gray-400">
              <template v-if="!t.n">—</template>
              <template v-else-if="jours[i]! <= aujourdhui">{{ t.faits }}/{{ t.pdv }} faits</template>
              <template v-else>{{ t.pdv }} PDV</template>
            </td>
          </tr>
        </tfoot>
      </table>

      <div v-if="chargement" class="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/50">
        <ChargementContenu variante="compact" libelle="Chargement de la semaine…" />
      </div>
    </div>

    <!-- Légende (mêmes couleurs que le calendrier par personne) -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-sky-200 dark:bg-sky-500/40" />À venir</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-500/40" />Tout fait</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-amber-200 dark:bg-amber-500/40" />Incomplète</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm border border-dashed border-gray-400" />Prévue par une règle, à générer</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-gray-200 dark:bg-gray-600" />Suspendue / annulée</span>
      <span>Sous le nombre de PDV : le SSF du jour (merchandisers Atom).</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Profile, Routing, RoutingTemplate } from '~/types'
import { toIsoJour } from '~/utils/periode'
import { couvertureJour, decalerSemaine, etatJourTournee, joursSemaine, lundiDe, type EtatJourTournee } from '~/utils/calendrierTournees'
import { CLASSES_ETAT_TOURNEE } from '~/composables/classesEtatTournee'

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

const FILTRES = [
  { k: 'tous', l: 'Tous' },
  { k: 'atom', l: 'Atom' },
  { k: 'friesland', l: 'Friesland' },
] as const
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const routingStore = useRoutingStore()
const toast = useToast()

const aujourdhui = toIsoJour(new Date())
const lundiCourant = lundiDe(aujourdhui)
const lundi = ref(lundiCourant)
const filtre = ref<'tous' | 'atom' | 'friesland'>('tous')
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
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
        atom: user?.employeur === 'atom',
        zone: (zones as string[]).join(', '),
      }
    })
    .filter(p => filtre.value === 'tous' || (filtre.value === 'atom') === p.atom)
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
