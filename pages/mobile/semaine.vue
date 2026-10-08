<template>
  <div class="mobile-page">
    <div class="p-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Ma semaine</h2>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Votre binôme SSF et vos quartiers, chaque jour.</p>

      <!-- Chargement initial -->
      <div v-if="chargement && !chargee" class="mt-4 space-y-3">
        <div v-for="i in 6" :key="i" class="mobile-card h-20 animate-pulse" />
      </div>

      <!-- Rien de prévu (ou hors ligne sans données) -->
      <div v-else-if="!semaine.length" class="mobile-card mt-4 px-5 py-10 text-center">
        <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700">
          <UIcon name="i-heroicons-user-group" class="h-8 w-8 text-gray-400" aria-hidden="true" />
        </div>
        <p class="font-semibold text-gray-700 dark:text-gray-200">
          {{ chargee || isOnline ? 'Aucun SSF prévu' : 'Planning indisponible hors ligne' }}
        </p>
        <p class="mx-auto mt-1 max-w-[280px] text-sm text-gray-500 dark:text-gray-400">
          {{ chargee || isOnline
            ? 'Votre tournée suit votre portefeuille. Les binômes avec les SSF sont planifiés par votre agence et votre commercial.'
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
          </div>

          <p v-if="!j.ssf.length" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Pas de SSF prévu : tournée sur votre portefeuille.
          </p>

          <div v-for="l in j.ssf" :key="`${l.ssf_id}-${l.jour_semaine}`" class="mt-2">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{{ l.ssf_nom }}</p>
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

      <p v-if="semaine.length && !isOnline" class="mt-3 text-center text-xs text-gray-400">
        Hors ligne : planning du dernier chargement.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { semaineParJour } from '~/utils/ssfTerrain'

// Planning SSF du merchandiser Atom (RPC ssf_semaine), gardé hors ligne.
// Préparé dans l'admin : Routing › Règles (une règle par SSF et ses jours).
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const user = useSupabaseUser()
const { isOnline } = useOfflineSync()
const { semaine, chargee, chargerSemaine } = useSsfTerrain()
const chargement = ref(false)
const jours = computed(() => semaineParJour(semaine.value))
const aujourdhui = new Date().getDay()

async function charger() {
  chargement.value = true
  try { await chargerSemaine(user.value?.id) }
  finally { chargement.value = false }
}

onMounted(charger)
watch(isOnline, (enLigne) => { if (enLigne) void charger() })
</script>
