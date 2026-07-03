<template>
  <section
    v-if="!hidden"
    aria-label="Commerciaux en tournée"
    class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
          <UIcon name="i-heroicons-signal" class="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-slate-400">En tournée maintenant</p>
          <p class="text-2xl font-bold text-slate-900 dark:text-white">
            {{ actifs.length }}
            <span class="text-sm font-normal text-slate-400">commercial(aux)</span>
          </p>
        </div>
      </div>
      <UButton to="/admin/trajets" size="xs" variant="ghost" trailing-icon="i-heroicons-arrow-right">
        Voir les trajets
      </UButton>
    </div>

    <ul v-if="actifs.length" class="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
      <li v-for="actif in actifs" :key="actif.userId" class="flex items-center justify-between gap-2 py-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="relative flex h-2.5 w-2.5 shrink-0">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{{ actif.nom }}</span>
        </div>
        <span class="shrink-0 text-xs text-slate-400">{{ actif.freshness }}</span>
      </li>
    </ul>
    <p v-else class="mt-3 text-sm text-slate-400">
      Aucune position reçue depuis {{ WINDOW_MIN }} min — personne en tournée.
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

const actifs = ref<Actif[]>([])
const hidden = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function freshnessLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  return minutes <= 1 ? 'à l\'instant' : `il y a ${minutes} min`
}

async function refresh() {
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
