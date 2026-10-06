<template>
  <!-- Calendrier mensuel des tournées d'une personne : un jour = une tournée
       (générée ou non), un clic ouvre la popup « Tournée du jour ». -->
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chevron-left" aria-label="Mois précédent" @click="mois = decalerMois(mois, -1)" />
      <h4 class="min-w-[9rem] text-center text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">{{ libelleMois }}</h4>
      <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chevron-right" aria-label="Mois suivant" @click="mois = decalerMois(mois, 1)" />
      <UButton v-if="mois !== moisCourant" size="xs" variant="soft" color="gray" @click="mois = moisCourant">Aujourd'hui</UButton>
      <p class="ml-auto text-xs text-gray-500 dark:text-gray-400">
        <template v-if="chargement">Chargement…</template>
        <template v-else>
          {{ resume.tournees }} tournée(s) ce mois · {{ resume.faits }}/{{ resume.pdv }} PDV faits
        </template>
      </p>
    </div>

    <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div class="grid grid-cols-7 bg-gray-50 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:bg-gray-800">
        <div v-for="j in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']" :key="j" class="py-1.5">{{ j }}</div>
      </div>

      <div class="relative">
        <div v-for="(semaine, i) in grille" :key="i" class="grid grid-cols-7 border-t border-gray-100 dark:border-gray-700">
          <button
            v-for="d in semaine"
            :key="d"
            type="button"
            class="flex min-h-[4.25rem] flex-col items-start gap-0.5 border-l border-gray-100 p-1.5 text-left text-xs transition first:border-l-0 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fc-red dark:border-gray-700 dark:hover:bg-gray-700/40 sm:p-2"
            :class="[moisDe(d) !== mois ? 'opacity-40' : '', jours[d]!.classe]"
            :title="jours[d]!.titre"
            :disabled="!jours[d]!.cliquable"
            @click="ouvrir(d)"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
              :class="d === aujourdhui ? 'bg-fc-red text-white' : 'text-gray-700 dark:text-gray-300'"
            >
              {{ Number(d.slice(8)) }}
            </span>
            <span v-if="jours[d]!.texte" class="text-[10px] leading-tight sm:text-[11px]" :class="jours[d]!.classeTexte">
              {{ jours[d]!.texte }}
            </span>
            <span v-if="jours[d]!.progression !== null" class="mt-auto h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <span class="block h-full rounded-full bg-current" :style="{ width: `${jours[d]!.progression}%` }" />
            </span>
          </button>
        </div>

        <div v-if="chargement" class="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/50">
          <ChargementContenu variante="compact" libelle="Chargement du mois…" />
        </div>
      </div>
    </div>

    <!-- Légende -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-sky-200 dark:bg-sky-500/40" />Planifiée</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-500/40" />Tout fait</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-amber-200 dark:bg-amber-500/40" />Incomplète</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm border border-dashed border-gray-400" />Prévue par une règle, à générer</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-gray-200 dark:bg-gray-600" />Suspendue / annulée</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Routing, RoutingTemplate } from '~/types'
import { toIsoJour } from '~/utils/periode'
import { grilleMois, decalerMois, moisDe, couvertureJour } from '~/utils/calendrierTournees'

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
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
    const r = tournees.value.get(d)
    const couv = couvertureJour(props.regles as any, d)
    const regle = (couv.regles[0] || couv.suspendues[0]?.regle || null) as RoutingTemplate | null
    const passe = d <= aujourdhui

    if (r) {
      const nb = r.nb_pdv ?? 0
      const faits = r.nb_faits ?? 0
      if (r.status === 'cancelled') {
        out[d] = { classe: 'bg-gray-100 dark:bg-gray-700/60', classeTexte: 'text-gray-500 line-through', texte: `${nb} PDV`, titre: 'Tournée annulée', progression: null, cliquable: true, regle }
      }
      else if (passe) {
        const complete = nb > 0 && faits >= nb
        out[d] = {
          classe: complete ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
          classeTexte: 'font-semibold',
          texte: `${faits}/${nb} faits`,
          titre: `${faits} PDV faits sur ${nb}`,
          progression: nb ? Math.round((faits / nb) * 100) : 0,
          cliquable: true,
          regle,
        }
      }
      else {
        out[d] = { classe: 'bg-sky-50 dark:bg-sky-500/10', classeTexte: 'font-semibold text-sky-700 dark:text-sky-300', texte: `${nb} PDV`, titre: `Tournée planifiée : ${nb} PDV`, progression: null, cliquable: true, regle }
      }
    }
    else if (couv.regles.length) {
      out[d] = d >= aujourdhui
        ? { classe: 'outline-dashed outline-1 -outline-offset-4 outline-gray-300 dark:outline-gray-600', classeTexte: 'text-gray-400', texte: 'à générer', titre: 'Prévue par une règle, pas encore générée', progression: null, cliquable: true, regle }
        : { classe: '', classeTexte: 'text-gray-400', texte: 'non générée', titre: 'Jour couvert par une règle, mais aucune tournée n\'a été générée', progression: null, cliquable: true, regle }
    }
    else if (couv.suspendues.length) {
      out[d] = { classe: 'bg-gray-100 dark:bg-gray-700/60', classeTexte: 'text-gray-500', texte: couv.suspendues[0]!.motif, titre: `Suspendue : ${couv.suspendues[0]!.motif}`, progression: null, cliquable: false, regle }
    }
    else {
      out[d] = { classe: '', classeTexte: '', texte: '', titre: '', progression: null, cliquable: false, regle: null }
    }
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
