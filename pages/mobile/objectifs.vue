<template>
  <div class="mobile-page">
    <div class="p-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Objectifs du mois</h2>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">PDV à visiter par canal, comparés à vos visites.</p>

      <!-- Bascule Semaine / Mois -->
      <div class="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="group" aria-label="Période">
        <button
          v-for="p in PERIODES"
          :key="p.value"
          type="button"
          class="min-h-10 rounded-lg text-sm font-semibold transition"
          :class="periode === p.value ? 'bg-white text-fc-red shadow-sm dark:bg-gray-700 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'"
          :aria-pressed="periode === p.value"
          @click="periode = p.value"
        >
          {{ p.label }}
        </button>
      </div>
      <p class="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">{{ libellePlage(plage) }}</p>

      <!-- Chargement initial -->
      <div v-if="chargement && !resultat" class="mt-4 space-y-3">
        <div class="mobile-card h-28 animate-pulse" />
        <div v-for="i in 5" :key="i" class="mobile-card h-16 animate-pulse" />
      </div>

      <!-- Erreur sans donnée en cache -->
      <div v-else-if="erreur && !resultat" class="mobile-card mt-4 p-5 text-center">
        <UIcon name="i-heroicons-signal-slash" class="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
        <p class="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Objectifs indisponibles</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ isOnline ? 'Le chargement a échoué.' : 'Vous êtes hors ligne : les objectifs se chargent avec le réseau.' }}
        </p>
        <UButton class="mt-3" size="sm" variant="soft" icon="i-heroicons-arrow-path" @click="charger">Réessayer</UButton>
      </div>

      <!-- Pas de tournée par quotas : pas d'objectif par canal -->
      <div v-else-if="resultat && !resultat.estQuota" class="mobile-card mt-4 px-5 py-10 text-center">
        <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700">
          <UIcon name="i-heroicons-flag" class="h-8 w-8 text-gray-400" aria-hidden="true" />
        </div>
        <p class="font-semibold text-gray-700 dark:text-gray-200">Pas d'objectifs par canal</p>
        <p class="mx-auto mt-1 max-w-[280px] text-sm text-gray-500 dark:text-gray-400">
          Votre tournée n'est pas organisée par quotas. Ces objectifs concernent les merchandisers du programme Atom.
        </p>
      </div>

      <template v-else-if="resultat">
        <p v-if="erreur" class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Hors ligne ou erreur réseau : chiffres du dernier chargement.
        </p>

        <!-- Synthèse -->
        <section class="mobile-card mt-4 p-4" aria-label="Synthèse de la période">
          <div class="flex items-end justify-between">
            <div>
              <p class="text-xs uppercase tracking-wide text-gray-400">PDV visités</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {{ total.realise }}<span class="text-base font-semibold text-gray-400"> / {{ total.objectif }}</span>
              </p>
            </div>
            <span class="text-lg font-bold" :class="pourcent(total.realise, total.objectif) >= 100 ? 'text-emerald-600' : 'text-fc-red'">
              {{ pourcent(total.realise, total.objectif) }} %
            </span>
          </div>
          <div class="mt-2 h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              class="h-2.5 rounded-full transition-all duration-500"
              :class="pourcent(total.realise, total.objectif) >= 100 ? 'bg-emerald-500' : 'bg-fc-red'"
              :style="{ width: `${Math.min(pourcent(total.realise, total.objectif), 100)}%` }"
            />
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-gray-50 px-2 py-2 dark:bg-gray-700/50">
              <p class="text-base font-bold text-gray-900 dark:text-gray-100">{{ Math.max(total.objectif - total.realise, 0) }}</p>
              <p class="text-[10px] text-gray-500 dark:text-gray-400">reste à visiter</p>
            </div>
            <div class="rounded-xl bg-gray-50 px-2 py-2 dark:bg-gray-700/50">
              <p class="text-base font-bold text-gray-900 dark:text-gray-100">{{ total.planifie }}</p>
              <p class="text-[10px] text-gray-500 dark:text-gray-400">planifiés</p>
            </div>
            <div class="rounded-xl bg-gray-50 px-2 py-2 dark:bg-gray-700/50">
              <p class="text-base font-bold text-gray-900 dark:text-gray-100">{{ resultat.joursActifs }}</p>
              <p class="text-[10px] text-gray-500 dark:text-gray-400">jours de tournée</p>
            </div>
          </div>
        </section>

        <!-- Par canal -->
        <h3 class="mt-5 mb-2 text-sm font-bold text-gray-800 dark:text-gray-100">Par canal</h3>
        <ul class="space-y-2">
          <li v-for="c in lignesCanal" :key="c.canal" class="mobile-card p-3">
            <div class="flex items-center justify-between gap-2">
              <BadgeTypePdv :sous-categorie="c.canal" class="!text-xs" />
              <span class="text-sm font-bold" :class="c.objectif > 0 && c.realise >= c.objectif ? 'text-emerald-600' : 'text-gray-900 dark:text-gray-100'">
                {{ c.realise }}<span class="font-semibold text-gray-400"> / {{ c.objectif }}</span>
              </span>
            </div>
            <div class="mt-2 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                class="h-2 rounded-full transition-all duration-500"
                :class="c.objectif > 0 && c.realise >= c.objectif ? 'bg-emerald-500' : 'bg-fc-red'"
                :style="{ width: `${Math.min(pourcent(c.realise, c.objectif), 100)}%` }"
              />
            </div>
            <p class="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              {{ c.planifie }} planifié{{ c.planifie > 1 ? 's' : '' }}
              <template v-if="c.objectif > c.realise"> · reste {{ c.objectif - c.realise }}</template>
              <template v-else-if="c.objectif > 0"> · objectif atteint</template>
            </p>
          </li>
        </ul>

        <p v-if="resultat.realise['Hors grille'] || resultat.planifie['Hors grille']" class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Autres PDV (grossistes, supermarchés…, hors grille) : {{ resultat.realise['Hors grille'] }} visité{{ resultat.realise['Hors grille'] > 1 ? 's' : '' }},
          {{ resultat.planifie['Hors grille'] }} planifié{{ resultat.planifie['Hors grille'] > 1 ? 's' : '' }}.
        </p>

        <p class="mt-4 text-[11px] leading-relaxed text-gray-400">
          Objectif = quota journalier de chaque canal × jours de tournée de la période.
          Planifiés = PDV de vos tournées déjà préparées (environ une semaine à l'avance).
          Quand un canal manque de PDV, la tournée est complétée en boutiques.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CANAUX_ATOM } from '~/utils/canalAtom'
import { totalGrille } from '~/utils/objectifsAtom'
import { plageDePeriode, libellePlage } from '~/utils/periode'
import type { ObjectifsAtom } from '~/composables/useObjectifsAtom'

// Lecture seule : objectifs calculés depuis la grille routing_quota_canal et
// les règles quota du merchandiser connecté (voir composables/useObjectifsAtom.ts).
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const user = useSupabaseUser()
const { isOnline } = useOfflineSync()
const { chargerObjectifs, enCache } = useObjectifsAtom()

const PERIODES = [
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
] as const

const periode = ref<'semaine' | 'mois'>('mois')
const plage = computed(() => plageDePeriode(periode.value))
const resultat = ref<ObjectifsAtom | null>(null)
const chargement = ref(false)
const erreur = ref(false)
// Bascule rapide Semaine / Mois : seule la dernière demande s'affiche.
let jeton = 0

const total = computed(() => {
  const r = resultat.value
  if (!r) return { objectif: 0, planifie: 0, realise: 0 }
  return { objectif: totalGrille(r.objectif), planifie: totalGrille(r.planifie), realise: totalGrille(r.realise) }
})

const lignesCanal = computed(() => {
  const r = resultat.value
  if (!r) return []
  return CANAUX_ATOM.map(canal => ({ canal, objectif: r.objectif[canal], planifie: r.planifie[canal], realise: r.realise[canal] }))
})

function pourcent(fait: number, objectif: number) {
  if (objectif <= 0) return fait > 0 ? 100 : 0
  return Math.round((fait / objectif) * 100)
}

async function charger() {
  const userId = user.value?.id
  if (!userId) return
  const { debut, fin } = plage.value
  const demande = ++jeton
  // Le cache de session s'affiche tout de suite ; le réseau le remplace.
  resultat.value = enCache(userId, debut, fin)
  chargement.value = true
  erreur.value = false
  try {
    const r = await chargerObjectifs(userId, debut, fin)
    if (demande === jeton) resultat.value = r
  }
  catch (err) {
    console.warn('[Objectifs] chargement impossible (hors ligne ?)', err)
    if (demande === jeton) erreur.value = true
  }
  finally {
    if (demande === jeton) chargement.value = false
  }
}

watch(periode, charger)
watch(() => user.value?.id, (id) => { if (id) void charger() }, { immediate: true })
</script>
