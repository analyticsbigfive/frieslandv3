<template>
  <div class="mobile-page">
    <div class="p-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Ma semaine</h2>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Votre lieu et votre SSF, chaque jour de la semaine.</p>

      <!-- Chargement initial -->
      <div v-if="chargement && !routingCharge" class="mt-4 space-y-3">
        <div v-for="i in 6" :key="i" class="mobile-card h-20 animate-pulse" />
      </div>

      <!-- Rien de prévu (ou hors ligne sans données) -->
      <div v-else-if="!routing.length" class="mobile-card mt-4 px-5 py-10 text-center">
        <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700">
          <UIcon name="i-heroicons-user-group" class="h-8 w-8 text-gray-400" aria-hidden="true" />
        </div>
        <p class="font-semibold text-gray-700 dark:text-gray-200">
          {{ routingCharge || isOnline ? 'Aucun lieu prévu cette semaine' : 'Planning indisponible hors ligne' }}
        </p>
        <p class="mx-auto mt-1 max-w-[280px] text-sm text-gray-500 dark:text-gray-400">
          {{ routingCharge || isOnline
            ? 'Votre tournée suit votre portefeuille. Le routing du mois (lieux et SSF) est préparé par votre agence.'
            : 'Ouvrez cet écran une fois avec du réseau : il restera disponible sans connexion.' }}
        </p>
      </div>

      <ul v-else class="mt-4 space-y-3" aria-label="Planning de la semaine">
        <li
          v-for="j in jours"
          :key="j.jour"
          class="mobile-card p-4"
          :class="j.jour === aujourdhui ? 'ring-2 ring-fc-red/60' : ''"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-bold text-gray-900 dark:text-gray-100">
              {{ j.libelle }}
              <span v-if="j.jour === aujourdhui" class="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-fc-red dark:bg-red-950/40 dark:text-red-300">Aujourd'hui</span>
            </p>
            <span v-if="j.cases[0]?.semaine" class="text-[11px] text-gray-400">Semaine {{ j.cases[0].semaine }} du mois</span>
          </div>

          <p v-if="!j.cases.length" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Pas de lieu prévu : tournée sur votre portefeuille.
          </p>

          <div v-for="(l, k) in j.cases" :key="`${j.jour}-${k}`" class="mt-2">
            <p v-if="l.point_visite" class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ l.point_visite }}</p>
            <div class="mt-1 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p v-if="l.ssf_nom" class="truncate text-sm text-gray-800 dark:text-gray-100">
                  Avec {{ l.ssf_nom }}<span v-if="l.type_engin" class="text-xs text-gray-400"> · {{ l.type_engin }}</span>
                </p>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400">Sans SSF ce jour-là</p>
                <p v-if="l.distributeur" class="truncate text-xs text-gray-500 dark:text-gray-400">{{ l.distributeur }}</p>
              </div>
              <a
                v-if="l.ssf_telephone"
                :href="`tel:${l.ssf_telephone.replace(/\s+/g, '')}`"
                class="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                :aria-label="`Appeler ${l.ssf_nom}`"
              >
                <UIcon name="i-heroicons-phone" class="h-4 w-4" aria-hidden="true" />
                {{ l.ssf_telephone }}
              </a>
            </div>
            <p v-if="l.zone" class="mt-2 text-xs font-medium text-gray-600 dark:text-gray-300">{{ l.zone }}</p>
            <div v-if="l.quartiers?.length" class="mt-1 flex flex-wrap gap-1.5">
              <span
                v-for="q in l.quartiers"
                :key="q"
                class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >{{ q }}</span>
            </div>
          </div>
        </li>
      </ul>

      <p v-if="routing.length && !isOnline" class="mt-3 text-center text-xs text-gray-400">
        Hors ligne : planning du dernier chargement.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { routingParJour } from '~/utils/ssfTerrain'

// Routing de la semaine du merchandiser (RPC routing_semaine : lieu du jour et
// SSF éventuel, routing mensuel de l'agence), gardé hors ligne. Préparé dans
// l'admin : Imports terrain › Routing mensuel.
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const user = useSupabaseUser()
const { isOnline } = useOfflineSync()
const { routing, routingCharge, chargerRouting } = useSsfTerrain()
const chargement = ref(false)
const jours = computed(() => routingParJour(routing.value))
const aujourdhui = new Date().getDay()

async function charger() {
  chargement.value = true
  try { await chargerRouting(user.value?.id) }
  finally { chargement.value = false }
}

onMounted(charger)
watch(isOnline, (enLigne) => { if (enLigne) void charger() })
</script>
