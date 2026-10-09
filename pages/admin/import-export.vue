<template>
  <div class="space-y-6">
    <AdminPageHeader
      :description="authStore.isAgence
        ? 'Chargez le routing mensuel de vos merchandisers.'
        : 'Importez des points de vente, exportez les visites et les PDV, et chargez les fichiers du terrain.'"
    />

    <div v-if="!authStore.isAgence" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Import CSV des PDV : lecture, aperçu, confirmation, puis écriture -->
      <section class="admin-surface space-y-4 p-5" aria-labelledby="titre-import-pdv">
        <div>
          <h2 id="titre-import-pdv" class="text-base font-semibold text-slate-900 dark:text-white">Importer des points de vente</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Fichier CSV au format de l’export des PDV. Les fichiers du distributeur (DMS) et d’Atom passent par « Imports terrain » ci-dessous.
          </p>
        </div>

        <UFormGroup label="Fichier CSV" help="Une ligne dont le PDV ID existe déjà met ce PDV à jour ; les autres lignes créent un PDV.">
          <input
            ref="fileInput"
            type="file"
            accept=".csv"
            class="block w-full rounded-md text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-slate-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:file:border-slate-600 dark:file:bg-slate-800 dark:file:text-slate-200"
            @change="handleFileSelect"
          >
        </UFormGroup>

        <ChargementContenu v-if="lecture" variante="compact" libelle="Lecture du fichier…" />

        <!-- Aperçu : ce qui sera écrit, avant toute écriture -->
        <div v-if="apercu" class="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-700">
          <p class="text-sm text-slate-700 dark:text-slate-200">
            <strong class="tabular-nums text-slate-900 dark:text-white">{{ apercu.total.toLocaleString('fr-FR') }}</strong>
            ligne{{ apercu.total > 1 ? 's' : '' }} lue{{ apercu.total > 1 ? 's' : '' }}
            <template v-if="apercu.total">
              ·
              <span class="tabular-nums">{{ apercu.avecId.toLocaleString('fr-FR') }}</span> avec un PDV ID
              (mise à jour si le PDV existe),
              <span class="tabular-nums">{{ (apercu.total - apercu.avecId).toLocaleString('fr-FR') }}</span> sans PDV ID (nouveau PDV)
            </template>
          </p>
          <UAlert
            v-if="apercu.total && !apercu.colonneNom"
            color="amber"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="Colonne « Nom du PDV » introuvable"
            description="Vérifiez que le fichier suit le format de l’export des PDV : sans cette colonne, les PDV seront importés sans nom."
          />
          <div v-if="apercu.premieres.length" class="overflow-x-auto">
            <table class="admin-table">
              <caption class="mb-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
                {{ apercu.premieres.length > 1 ? `Les ${apercu.premieres.length} premières lignes` : 'La première ligne' }}
              </caption>
              <thead>
                <tr>
                  <th v-for="col in COLONNES_APERCU" :key="col" scope="col" class="whitespace-nowrap">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(ligne, i) in apercu.premieres" :key="i">
                  <td v-for="col in COLONNES_APERCU" :key="col" class="whitespace-nowrap">
                    {{ ligne[col] || (col === 'PDV ID' ? 'Nouveau' : 'Vide') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <UButton
          icon="i-heroicons-arrow-up-tray"
          :loading="importing"
          :disabled="!apercu?.total || lecture"
          @click="confirmationImport = true"
        >
          {{ apercu?.total ? `Importer ${apercu.total.toLocaleString('fr-FR')} point${apercu.total > 1 ? 's' : ''} de vente` : 'Importer' }}
        </UButton>

        <UAlert
          v-if="importResult"
          :color="importResult.success ? 'green' : 'red'"
          variant="soft"
          :icon="importResult.success ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'"
          :title="importResult.success ? 'Import terminé' : 'Import impossible'"
          :description="importResult.message"
        />
      </section>

      <!-- Export -->
      <section class="admin-surface space-y-4 p-5" aria-labelledby="titre-export">
        <div>
          <h2 id="titre-export" class="text-base font-semibold text-slate-900 dark:text-white">Exporter des données</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Fichiers Excel, lisibles aussi dans Google Sheets.</p>
        </div>

        <fieldset class="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-700">
          <legend class="px-1 text-sm font-semibold text-slate-900 dark:text-white">Visites</legend>
          <div class="flex flex-wrap gap-3">
            <UFormGroup label="Du" name="export-du" class="min-w-[9rem] flex-1">
              <UInput v-model="exportFrom" type="date" size="sm" />
            </UFormGroup>
            <UFormGroup label="Au" name="export-au" class="min-w-[9rem] flex-1">
              <UInput v-model="exportTo" type="date" size="sm" />
            </UFormGroup>
          </div>
          <UButton
            block
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            :loading="exporting === 'visites'"
            @click="handleExport('visites')"
          >
            Exporter les visites de la période
          </UButton>
        </fieldset>

        <div class="space-y-3">
          <UButton
            block
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            :loading="exporting === 'pdv'"
            @click="handleExport('pdv')"
          >
            Exporter tous les PDV
          </UButton>

          <!-- Les tournées s'exportent depuis Routing & Planning, au format du
               modèle d'import (fichier réimportable). L'ancien export lisait
               la table historique routing_data, absente du schéma actuel. -->
          <UButton
            block
            variant="outline"
            icon="i-heroicons-arrow-top-right-on-square"
            to="/admin/routing"
          >
            Exporter les tournées (depuis Routing)
          </UButton>
        </div>
      </section>
    </div>

    <!-- Imports terrain : écritures par la route serveur ; administrateur (tous
         les imports) ou compte agence (routing mensuel de ses merchandisers). -->
    <AdminImportsTerrain v-if="authStore.isAdmin || authStore.isAgence" />
    <p v-else class="text-sm text-slate-600 dark:text-slate-300">Les imports terrain (fichiers du distributeur, routing des agences) sont réservés aux administrateurs.</p>

    <!-- Confirmation avant d'écrire dans la liste des PDV -->
    <UModal v-model="confirmationImport">
      <div class="space-y-4 p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          Importer {{ apercu?.total.toLocaleString('fr-FR') }} point{{ (apercu?.total || 0) > 1 ? 's' : '' }} de vente ?
        </h2>
        <p class="text-sm leading-6 text-slate-700 dark:text-slate-200">
          Le fichier « {{ selectedFile?.name }} » sera écrit dans la liste des points de vente :
          {{ apercu?.avecId.toLocaleString('fr-FR') }} ligne{{ (apercu?.avecId || 0) > 1 ? 's' : '' }} avec un PDV ID
          {{ (apercu?.avecId || 0) > 1 ? 'mettent' : 'met' }} à jour le PDV correspondant s’il existe, les autres créent un nouveau PDV.
          Cet import ne s’annule pas depuis cet écran.
        </p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="confirmationImport = false">Annuler</UButton>
          <UButton icon="i-heroicons-arrow-up-tray" @click="lancerImport">Importer</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { fetchAllRows } from '~/utils/fetchAll'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const { exportVisitesToExcel, exportPDVToExcel, parseCsv } = useCsvExport()
const pdvStore = usePDVStore()
const authStore = useAuthStore()
const toast = useToast()

const selectedFile = ref<File | null>(null)
const importing = ref(false)
const exporting = ref('')
const importResult = ref<{ success: boolean; message: string } | null>(null)

// Aperçu du fichier lu : rien n'est écrit avant la confirmation.
const COLONNES_APERCU = ['PDV ID', 'Nom du PDV', 'Canal', 'Zone', 'Quartier']
const lecture = ref(false)
const lignesLues = ref<Record<string, string>[]>([])
const apercu = ref<{ total: number, avecId: number, colonneNom: boolean, premieres: Record<string, string>[] } | null>(null)
const confirmationImport = ref(false)

const exportFrom = ref(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10))
const exportTo = ref(new Date().toISOString().slice(0, 10))

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
  importResult.value = null
  apercu.value = null
  lignesLues.value = []
  if (!selectedFile.value) return
  lecture.value = true
  try {
    const records = parseCsv(await selectedFile.value.text())
    lignesLues.value = records
    apercu.value = {
      total: records.length,
      avecId: records.filter(r => String(r['PDV ID'] || '').trim()).length,
      colonneNom: records.some(r => 'Nom du PDV' in r),
      premieres: records.slice(0, 5),
    }
    if (!records.length) {
      importResult.value = { success: false, message: 'Le fichier ne contient aucune ligne de PDV. Vérifiez qu’il s’agit bien d’un export des PDV.' }
    }
  }
  catch (err) {
    console.error('[import PDV] lecture du fichier', err)
    importResult.value = { success: false, message: 'Le fichier n’a pas pu être lu. Choisissez un fichier CSV au format de l’export des PDV.' }
  }
  finally {
    lecture.value = false
  }
}

function lancerImport() {
  confirmationImport.value = false
  void handleImport()
}

async function handleImport() {
  if (!selectedFile.value || !lignesLues.value.length) return

  importing.value = true
  importResult.value = null

  try {
    const result = await pdvStore.importPDVFromCSV(lignesLues.value)
    importResult.value = { success: true, message: `${result.toLocaleString('fr-FR')} point${result > 1 ? 's' : ''} de vente importé${result > 1 ? 's' : ''}.` }
  }
  catch (err: any) {
    importResult.value = { success: false, message: messageUtilisateur(err) }
  }
  finally {
    importing.value = false
  }
}

async function handleExport(type: string) {
  exporting.value = type

  try {
    if (type === 'visites') {
      // Paginé : sans range(), PostgREST s'arrête à 1 000 visites, sans erreur.
      const data = await fetchAllRows<any>((from, to) => (supabase.from('visites') as any)
        .select('*')
        .gte('date_visite', exportFrom.value + 'T00:00:00')
        .lte('date_visite', exportTo.value + 'T23:59:59')
        .order('date_visite', { ascending: false })
        .order('id')
        .range(from, to))

      await exportVisitesToExcel(data)
      toast.add({ title: 'Export terminé', description: `${data.length.toLocaleString('fr-FR')} visite${data.length > 1 ? 's' : ''} exportée${data.length > 1 ? 's' : ''}.`, color: 'green' })
    }
    else if (type === 'pdv') {
      const allPDV = await pdvStore.fetchAllPDV()
      await exportPDVToExcel(allPDV)
      toast.add({ title: 'Export terminé', color: 'green' })
    }
  }
  catch (err: any) {
    toast.add({ title: 'Export impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    exporting.value = ''
  }
}
</script>
