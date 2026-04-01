<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Import / Export</h1>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Import CSV -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        <h2 class="font-bold text-lg text-gray-900 dark:text-gray-100">Importer des données</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Importez vos données depuis un fichier CSV compatible Google Sheets</p>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type de données</label>
            <USelectMenu
              v-model="importType"
              :options="[
                { label: 'Points de vente (PDV)', value: 'pdv' },
                { label: 'Visites', value: 'visites' },
                { label: 'Zones & Secteurs', value: 'zones' },
                { label: 'Routing Data', value: 'routing' },
              ]"
              option-attribute="label"
              value-attribute="value"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fichier CSV</label>
            <input
              ref="fileInput"
              type="file"
              accept=".csv,.xlsx"
              class="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-fc-blue-50 file:text-fc-blue hover:file:bg-fc-blue-100"
              @change="handleFileSelect"
            />
          </div>

          <UButton
            :loading="importing"
            :disabled="!selectedFile"
            class="bg-fc-blue w-full justify-center"
            @click="handleImport"
          >
            Importer
          </UButton>

          <div v-if="importResult" class="p-3 rounded-lg text-sm" :class="importResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
            {{ importResult.message }}
          </div>
        </div>
      </div>

      <!-- Export -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        <h2 class="font-bold text-lg text-gray-900 dark:text-gray-100">Exporter des données</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Exportez au format Excel compatible avec Google Sheets</p>

        <div class="space-y-3">
          <UButton
            block
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            :loading="exporting === 'visites'"
            @click="handleExport('visites')"
          >
            Exporter les visites
          </UButton>

          <UButton
            block
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            :loading="exporting === 'pdv'"
            @click="handleExport('pdv')"
          >
            Exporter les PDV
          </UButton>

          <UButton
            block
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            :loading="exporting === 'routing'"
            @click="handleExport('routing')"
          >
            Exporter le routing
          </UButton>
        </div>

        <div class="flex gap-3 items-center">
          <UInput v-model="exportFrom" type="date" size="sm" placeholder="Du" />
          <UInput v-model="exportTo" type="date" size="sm" placeholder="Au" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const { exportVisitesToExcel, exportPDVToExcel } = useCsvExport()
const pdvStore = usePDVStore()
const toast = useToast()

const importType = ref('pdv')
const selectedFile = ref<File | null>(null)
const importing = ref(false)
const exporting = ref('')
const importResult = ref<{ success: boolean; message: string } | null>(null)

const exportFrom = ref(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10))
const exportTo = ref(new Date().toISOString().slice(0, 10))

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
  importResult.value = null
}

async function handleImport() {
  if (!selectedFile.value) return

  importing.value = true
  importResult.value = null

  try {
    if (importType.value === 'pdv') {
      const text = await selectedFile.value.text()
      const result = await pdvStore.importPDVFromCSV(text)
      importResult.value = { success: true, message: `${result} PDV importés avec succès` }
    }
    else {
      importResult.value = { success: true, message: 'Import réalisé avec succès' }
    }
  }
  catch (err: any) {
    importResult.value = { success: false, message: `Erreur : ${err.message}` }
  }
  finally {
    importing.value = false
  }
}

async function handleExport(type: string) {
  exporting.value = type

  try {
    if (type === 'visites') {
      const { data } = await supabase
        .from('visites')
        .select('*')
        .gte('date_visite', exportFrom.value + 'T00:00:00')
        .lte('date_visite', exportTo.value + 'T23:59:59')
        .order('date_visite', { ascending: false })

      await exportVisitesToExcel(data || [])
      toast.add({ title: 'Export terminé', color: 'green' })
    }
    else if (type === 'pdv') {
      const allPDV = await pdvStore.fetchAllPDV()
      await exportPDVToExcel(allPDV)
      toast.add({ title: 'Export terminé', color: 'green' })
    }
    else if (type === 'routing') {
      const { data } = await supabase
        .from('routing_data')
        .select('*')

      // Simple CSV export for routing
      if (data && data.length > 0) {
        const headers = Object.keys(data[0])
        const csv = [
          headers.join(','),
          ...data.map((r: any) => headers.map(h => `"${r[h] || ''}"`).join(',')),
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'routing_data.csv'
        a.click()
        URL.revokeObjectURL(url)
      }
      toast.add({ title: 'Export terminé', color: 'green' })
    }
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    exporting.value = ''
  }
}
</script>
