<template>
  <section
    v-if="!hidden"
    aria-labelledby="en-tournee-heading"
    class="admin-surface p-5"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/30" aria-hidden="true">
          <UIcon name="i-heroicons-signal" class="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
        </div>
        <div>
          <h2 id="en-tournee-heading" class="text-base font-semibold text-slate-900 dark:text-white">En tournée maintenant</h2>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            <strong class="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ actifs.length }}</strong>
            en tournée (position reçue il y a moins de {{ WINDOW_MIN }} min)
          </p>
        </div>
      </div>
      <UButton
        v-if="peutOuvrir('/admin/trajets')"
        to="/admin/trajets"
        size="xs"
        color="gray"
        variant="ghost"
        trailing-icon="i-heroicons-arrow-right"
      >
        Voir le suivi des équipes
      </UButton>
    </div>

    <ChargementContenu v-if="!charge" variante="compact" libelle="Recherche des commerciaux en tournée…" class="mt-3" />
    <ul v-else-if="actifs.length" class="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
      <li v-for="actif in actifs" :key="actif.userId" class="flex items-center justify-between gap-2 py-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
          </span>
          <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{{ actif.nom }}</span>
        </div>
        <span class="shrink-0 text-xs text-slate-600 dark:text-slate-300">{{ actif.freshness }}</span>
      </li>
    </ul>
    <p v-else class="mt-3 text-sm text-slate-600 dark:text-slate-300">
      Personne n'a envoyé de position depuis {{ WINDOW_MIN }} min : aucune tournée en cours.
    </p>
  </section>
</template>

<script setup lang="ts">
// « Connecté » = a envoyé une position de tournée récemment. Les positions
// arrivent par batch (~5 min depuis l'APK) : fenêtre de 15 min pour ne pas
// clignoter entre deux envois.
const WINDOW_MIN = 15
const REFRESH_MS = 60_000

interface Actif {
  userId: string
  nom: string
  lastAt: string
  freshness: string
}

const supabase = useSupabaseClient()
const { peutOuvrir } = useAdminNavigation()

const actifs = ref<Actif[]>([])
const hidden = ref(false)
// Faux jusqu'à la première réponse : « personne en tournée » ne doit pas
// s'afficher avant.
const charge = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function freshnessLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  return minutes <= 1 ? 'à l\'instant' : `il y a ${minutes} min`
}

async function refresh() {
  try {
    await chargerPositions()
  }
  finally {
    charge.value = true
  }
}

async function chargerPositions() {
  try {
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString()
    const { data, error } = await supabase
      .from('position_tournee')
      .select('user_id, captured_at, profiles(nom, email)')
      .gte('captured_at', since)
      .order('captured_at', { ascending: false })
      .limit(500)

    if (error) throw error

    const byUser = new Map<string, Actif>()
    for (const row of (data ?? []) as any[]) {
      if (!byUser.has(row.user_id)) {
        byUser.set(row.user_id, {
          userId: row.user_id,
          nom: row.profiles?.nom || row.profiles?.email || 'Commercial',
          lastAt: row.captured_at,
          freshness: freshnessLabel(row.captured_at),
        })
      }
    }
    actifs.value = [...byUser.values()]
    hidden.value = false
  }
  catch (err) {
    // Table absente ou droits insuffisants : on masque la carte sans casser
    // le dashboard.
    console.error('Erreur chargement commerciaux en tournée:', err)
    hidden.value = true
  }
}

onMounted(() => {
  void refresh()
  timer = setInterval(() => {
    void refresh()
  }, REFRESH_MS)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>
