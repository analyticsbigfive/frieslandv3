<template>
  <div class="pb-20">
    <div class="p-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Calendrier de visites</h2>

      <!-- Month nav -->
      <div class="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm mb-4">
        <button @click="prevMonth">
          <UIcon name="i-heroicons-chevron-left" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <span class="font-bold text-gray-800">{{ monthLabel }}</span>
        <button @click="nextMonth">
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      <!-- Days grid -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div class="grid grid-cols-7 text-center text-xs font-medium text-gray-400 py-2 border-b">
          <div v-for="d in ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']" :key="d">{{ d }}</div>
        </div>
        <div class="grid grid-cols-7 text-center">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            class="py-2 relative"
            :class="{
              'text-gray-300': !day.currentMonth,
              'text-gray-900 dark:text-gray-100': day.currentMonth,
              'bg-fc-red-50': day.isToday,
            }"
          >
            <span class="text-sm">{{ day.date }}</span>
            <div
              v-if="day.count > 0"
              class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              :class="day.count >= 5 ? 'bg-green-500' : day.count >= 3 ? 'bg-fc-red' : 'bg-orange-400'"
            />
          </div>
        </div>
      </div>

      <!-- Upcoming visits -->
      <div class="mt-6 space-y-3">
        <h3 class="font-bold text-gray-800 text-sm">Visites récentes ce mois</h3>
        <div v-if="monthVisites.length === 0" class="text-center text-gray-400 text-sm py-4">
          Aucune visite ce mois
        </div>
        <div
          v-for="v in monthVisites.slice(0, 10)"
          :key="v.visite_id"
          class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-sm text-gray-900 dark:text-gray-100">{{ v.pdv?.nom_pdv || v.pdv_id }}</span>
            <span class="text-xs text-gray-400">{{ new Date(v.date_visite).toLocaleDateString('fr-FR') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { getCachedVisitesFallback } = useOfflineData()

const currentMonth = ref(new Date())
const monthVisites = ref<any[]>([])
const visiteCounts = ref<Record<string, number>>({})

const monthLabel = computed(() =>
  currentMonth.value.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
)

function prevMonth() {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() - 1)
  currentMonth.value = d
}

function nextMonth() {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() + 1)
  currentMonth.value = d
}

const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const today = new Date()

  let startDay = firstDay.getDay() - 1
  if (startDay < 0) startDay = 6

  const days = []

  // Previous month fill
  const prevLast = new Date(year, month, 0)
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ date: prevLast.getDate() - i, currentMonth: false, isToday: false, count: 0 })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d
    days.push({ date: d, currentMonth: true, isToday, count: visiteCounts.value[key] || 0 })
  }

  // Next month fill
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: d, currentMonth: false, isToday: false, count: 0 })
  }

  return days
})

async function fetchMonthVisites() {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const start = new Date(year, month, 1).toISOString()
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

  let data: any[] | null = null

  try {
    const result = await supabase
      .from('visites')
      .select('visite_id, date_visite, pdv_id, pdv:pdv_id(nom_pdv)')
      .eq('user_id', user.value?.id)
      .gte('date_visite', start)
      .lte('date_visite', end)
      .order('date_visite', { ascending: false })

    data = result.data
  } catch {
    // Offline fallback: filter cached visites by month
    const cached = await getCachedVisitesFallback()
    if (cached) {
      data = cached.filter((v: any) => {
        const d = v.date_visite?.slice(0, 10)
        return d && d >= start.slice(0, 10) && d <= end.slice(0, 10)
      })
    }
  }

  monthVisites.value = data || []

  const counts: Record<string, number> = {}
  data?.forEach((v: any) => {
    const day = v.date_visite?.slice(0, 10)
    if (day) counts[day] = (counts[day] || 0) + 1
  })
  visiteCounts.value = counts
}

watch(currentMonth, fetchMonthVisites, { immediate: true })
</script>
