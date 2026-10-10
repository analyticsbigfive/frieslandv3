<template>
  <!-- Calendrier mensuel des tournées d'une personne : un jour = une tournée
       (générée ou non), un clic ouvre la popup « Tournée du jour ». -->
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chevron-left" aria-label="Mois précédent" @click="mois = decalerMois(mois, -1)" />
      <h2 class="min-w-[9rem] text-center text-base font-semibold capitalize text-slate-900 dark:text-white" aria-live="polite">{{ libelleMois }}</h2>
      <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chevron-right" aria-label="Mois suivant" @click="mois = decalerMois(mois, 1)" />
      <UButton v-if="mois !== moisCourant" size="xs" variant="outline" @click="mois = moisCourant">Ce mois-ci</UButton>
      <p class="ml-auto text-xs tabular-nums text-slate-600 dark:text-slate-300">
        <template v-if="chargement">Chargement…</template>
        <template v-else>
          {{ resume.tournees }} tournée(s) ce mois · {{ resume.faits }}/{{ resume.pdv }} PDV faits
        </template>
      </p>
    </div>

    <div class="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <div class="grid grid-cols-7 bg-slate-50 text-center text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <div v-for="j in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']" :key="j" class="py-1.5">{{ j }}</div>
      </div>

      <div class="relative">
        <div v-for="(semaine, i) in grille" :key="i" class="grid grid-cols-7 border-t border-slate-200 dark:border-slate-700">
          <button
            v-for="d in semaine"
            :key="d"
            type="button"
            class="flex min-h-[4.25rem] flex-col items-start gap-0.5 border-l border-slate-200 p-1.5 text-left text-xs transition first:border-l-0 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:border-slate-700 dark:hover:bg-slate-700/40 sm:p-2"
            :class="[moisDe(d) !== mois ? 'opacity-50' : '', jours[d]!.classe]"
            :title="jours[d]!.titre"
            :disabled="!jours[d]!.cliquable"
            :aria-current="d === aujourdhui ? 'date' : undefined"
            @click="ouvrir(d)"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
              :class="d === aujourdhui ? 'bg-brand-500 text-white' : 'text-slate-700 dark:text-slate-200'"
            >
              {{ Number(d.slice(8)) }}
            </span>
            <span v-if="jours[d]!.texte" class="text-xs leading-tight" :class="jours[d]!.classeTexte">
              {{ jours[d]!.texte }}
            </span>
            <span v-if="jours[d]!.progression !== null" class="mt-auto h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10" aria-hidden="true">
              <span class="block h-full rounded-full bg-current" :style="{ width: `${jours[d]!.progression}%` }" />
            </span>
          </button>
        </div>

        <div v-if="chargement" class="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/50">
          <ChargementContenu variante="compact" libelle="Chargement du mois…" />
        </div>
      </div>
    </div>

    <!-- Légende (mêmes couleurs que le planning d'équipe) -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-sky-200 dark:bg-sky-500/40" aria-hidden="true" />À venir</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-500/40" aria-hidden="true" />Tout fait</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-amber-200 dark:bg-amber-500/40" aria-hidden="true" />Incomplète</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-400" aria-hidden="true" />Prévue par une règle, à générer</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-slate-200 dark:bg-slate-600" aria-hidden="true" />Suspendue ou annulée</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Routing, RoutingTemplate } from '~/types'
import { toIsoJour } from '~/utils/periode'
import { grilleMois, decalerMois, moisDe, couvertureJour, etatJourTournee } from '~/utils/calendrierTournees'
import { CLASSES_ETAT_TOURNEE } from '~/composables/classesEtatTournee'
import { messageUtilisateur } from '~/utils/supabaseErrors'

const props = withDefaults(defineProps<{
  userId: string
  regles?: RoutingTemplate[]
  /** Incrémenté par la page après une génération, un import, une modification. */
  rafraichir?: number
}>(), {
  regles: () => [],
  rafraichir: 0,
})

const emit = defineEmits<{
  (e: 'jour', payload: { date: string; routing: Routing | null; regle: RoutingTemplate | null }): void
}>()

const routingStore = useRoutingStore()
const toast = useToast()

const aujourdhui = toIsoJour(new Date())
const moisCourant = moisDe(aujourdhui)
const mois = ref(moisCourant)
const grille = computed(() => grilleMois(mois.value))
const libelleMois = computed(() => {
  const [a, m] = mois.value.split('-').map(Number)
  return new Date(a!, m! - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

const tournees = ref(new Map<string, Routing>())
const chargement = ref(false)
let jeton = 0

async function charger() {
  const jours = grille.value.flat()
  const moi = ++jeton
  chargement.value = true
  try {
    const liste = await routingStore.fetchRoutings({ userId: props.userId, dateFrom: jours[0], dateTo: jours[jours.length - 1] })
    // Un changement de mois rapide : seule la dernière réponse compte.
    if (moi === jeton) tournees.value = new Map(liste.map(r => [r.date_routing, r]))
  }
  catch (err: any) {
    toast.add({ title: 'Mois non chargé', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    if (moi === jeton) chargement.value = false
  }
}

watch([mois, () => props.userId, () => props.rafraichir], charger, { immediate: true })

interface EtatJour {
  classe: string
  classeTexte: string
  texte: string
  titre: string
  progression: number | null
  cliquable: boolean
  regle: RoutingTemplate | null
}

const jours = computed<Record<string, EtatJour>>(() => {
  const out: Record<string, EtatJour> = {}
  for (const d of grille.value.flat()) {
    const e = etatJourTournee(tournees.value.get(d), couvertureJour(props.regles as any, d), d, aujourdhui)
    const c = CLASSES_ETAT_TOURNEE[e.etat]
    out[d] = { classe: c.fond, classeTexte: c.texte, texte: e.texte, titre: e.titre, progression: e.progression, cliquable: e.cliquable, regle: e.regle as RoutingTemplate | null }
  }
  return out
})

const resume = computed(() => {
  let nbTournees = 0, pdv = 0, faits = 0
  for (const [d, r] of tournees.value) {
    if (moisDe(d) !== mois.value || r.status === 'cancelled') continue
    nbTournees++
    pdv += r.nb_pdv ?? 0
    faits += r.nb_faits ?? 0
  }
  return { tournees: nbTournees, pdv, faits }
})

function ouvrir(d: string) {
  emit('jour', { date: d, routing: tournees.value.get(d) || null, regle: jours.value[d]?.regle || null })
}
</script>
