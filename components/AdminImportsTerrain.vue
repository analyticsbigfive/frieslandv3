<template>
  <section class="space-y-5">
    <div>
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Imports terrain</h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Chaque import se simule d’abord : rien n’est écrit tant que vous n’avez pas relu le rapport et cliqué « Appliquer ».
        Un lot appliqué peut être annulé depuis l’historique.
      </p>
    </div>

    <!-- Cartes -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div v-for="imp in IMPORTS" :key="imp.type" class="admin-surface space-y-3 p-4">
        <div>
          <p class="font-semibold text-gray-900 dark:text-gray-100">{{ imp.titre }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ imp.description }}</p>
        </div>
        <div v-for="f in imp.fichiers" :key="f.cle" class="text-sm">
          <label class="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">
            {{ f.libelle }}<span v-if="!f.requis" class="font-normal text-gray-400"> (facultatif)</span>
          </label>
          <input
            type="file"
            :accept="f.accept || '.xlsx'"
            class="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold dark:text-gray-300 dark:file:bg-gray-700"
            @change="(e: Event) => choisirFichier(imp.type, f.cle, e)"
          >
        </div>
        <div v-if="imp.type === 'dms-pdv'" class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span>Point GPS partagé par</span>
          <UInput v-model.number="options.seuilDepot" type="number" :min="2" size="xs" class="w-16" />
          <span>clients ou plus = dépôt du distributeur (coordonnées écartées)</span>
        </div>
        <div v-if="imp.type === 'merch-dms'" class="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
          <span>Règles à partir du</span>
          <UInput v-model="options.debut" type="date" size="xs" class="w-36" />
          <UCheckbox v-model="options.pregenererDms" label="Générer les tournées des 7 premiers jours" />
        </div>
        <div v-if="imp.type === 'ssf-sous-zones'" class="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
          <UCheckbox v-model="options.recalculerSsf" label="Recalculer les tournées des 7 prochains jours" />
        </div>
        <UButton
          size="sm"
          class="bg-fc-blue"
          icon="i-heroicons-beaker"
          :loading="simulationEnCours === imp.type"
          :disabled="!!simulationEnCours || !!application || !pret(imp)"
          @click="simuler(imp)"
        >
          Simuler
        </UButton>
        <p v-if="simulationEnCours === imp.type && etape" class="text-xs text-gray-500">{{ etape }}</p>
      </div>
    </div>

    <!-- Résultat de la simulation -->
    <div v-if="resultat" class="admin-surface space-y-4 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase text-gray-500">Simulation</p>
          <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ resultat.titre }} — {{ resultat.fichier || 'sans fichier' }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <UBadge v-for="(v, k) in resultat.res.resume" :key="k" color="gray" variant="soft" size="xs">{{ k }} : {{ v }}</UBadge>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton v-for="(texte, nom) in resultat.res.csv" :key="nom" size="xs" color="gray" variant="soft" icon="i-heroicons-arrow-down-tray" @click="telechargerCsv(String(nom), texte as string)">
            {{ nom }}
          </UButton>
        </div>
      </div>

      <div v-if="resultat.res.bloquants?.length" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        <p class="font-semibold">Application impossible :</p>
        <ul class="list-disc pl-5"><li v-for="b in resultat.res.bloquants" :key="b">{{ b }}</li></ul>
      </div>

      <div class="rapport-import max-h-[32rem] overflow-y-auto rounded-lg border border-gray-100 p-4 text-sm dark:border-gray-700" v-html="rapportHtml" />

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          color="red"
          icon="i-heroicons-check-circle"
          :loading="application"
          :disabled="application || !resultat.res.operations.length || !!resultat.res.bloquants?.length"
          @click="appliquer"
        >
          Appliquer ({{ resultat.res.operations.length }} opération{{ resultat.res.operations.length > 1 ? 's' : '' }})
        </UButton>
        <span v-if="!resultat.res.operations.length" class="text-sm text-gray-500">Rien à écrire : la base est déjà à jour pour ce fichier.</span>
        <span v-if="progression" class="text-sm text-gray-600 dark:text-gray-300">{{ progression }}</span>
      </div>
    </div>

    <!-- Historique -->
    <div class="admin-surface space-y-3 p-5">
      <div class="flex items-center justify-between">
        <p class="font-semibold text-gray-900 dark:text-gray-100">Historique des imports</p>
        <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-arrow-path" @click="chargerLots">Actualiser</UButton>
      </div>
      <p v-if="erreurLots" class="text-sm text-amber-700 dark:text-amber-300">{{ erreurLots }}</p>
      <div v-else class="overflow-x-auto">
        <table class="admin-table">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Import</th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Fichier</th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Avancement</th>
              <th class="px-3 py-2" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="l in lots" :key="l.id">
              <td class="px-3 py-2 text-sm">{{ new Date(l.cree_le).toLocaleString('fr-FR') }}</td>
              <td class="px-3 py-2 text-sm">{{ TITRES[l.type] || l.type }}</td>
              <td class="px-3 py-2 text-xs text-gray-500">{{ l.fichier || '—' }}</td>
              <td class="px-3 py-2 text-sm">
                <UBadge :color="COULEURS_STATUT[l.statut] || 'gray'" variant="soft" size="xs">{{ STATUTS[l.statut] || l.statut }}</UBadge>
                <p v-if="l.erreur" class="mt-1 max-w-xs text-xs text-red-600">{{ l.erreur }}</p>
              </td>
              <td class="px-3 py-2 text-xs tabular-nums text-gray-500">{{ l.operations_faites }} / {{ l.operations_total }}</td>
              <td class="px-3 py-2 text-right">
                <UButton
                  v-if="['applique', 'erreur', 'annulation'].includes(l.statut) && l.retour?.length"
                  size="xs"
                  color="gray"
                  variant="soft"
                  icon="i-heroicons-arrow-uturn-left"
                  :loading="annulation === l.id"
                  :disabled="!!annulation || application"
                  @click="annuler(l)"
                >
                  Annuler le lot
                </UButton>
              </td>
            </tr>
            <tr v-if="!lots.length">
              <td colspan="6" class="px-3 py-6 text-center text-sm text-gray-400">Aucun import lancé depuis l’admin.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { fetchAllRows } from '~/utils/fetchAll'
import { markdownVersHtml } from '~/utils/markdownSimple'
// @ts-ignore modules JS partagés avec les scripts (sans types)
import { decouperOperations } from '~/scripts/lib/imports/operations.mjs'

type TypeImport = 'dms-pdv' | 'merch-dms' | 'routing-atom' | 'ssf-sous-zones' | 'routing-ssf-dms'
interface DefImport {
  type: TypeImport
  titre: string
  description: string
  fichiers: { cle: string, libelle: string, requis: boolean, accept?: string }[]
}

const IMPORTS: DefImport[] = [
  {
    type: 'dms-pdv',
    titre: 'Clients DMS → points de vente',
    description: 'Export clients DMS : relie les PDV connus (code client) et crée les clients manquants, localisés par leurs voisins.',
    fichiers: [{ cle: 'principal', libelle: 'Export clients DMS (.xlsx)', requis: true }],
  },
  {
    type: 'merch-dms',
    titre: 'Affectation des merchandisers (DMS)',
    description: 'Colonne « Merchandiseur » de l’export DMS : périmètre de chaque merchandiser et règle « Portefeuille DMS ». À lancer après l’import des clients DMS.',
    fichiers: [
      { cle: 'principal', libelle: 'Export clients DMS (.xlsx)', requis: true },
      { cle: 'mails', libelle: 'Fichier des mails des merchandisers (.xlsx)', requis: false },
    ],
  },
  {
    type: 'routing-atom',
    titre: 'Visites Atom (export Bonnet Rouge)',
    description: 'Feuille « Routing détaillé » : visites des merchandisers Atom, PDV rapprochés ou créés, distributeur et SSF. Une visite déjà importée n’est jamais dupliquée.',
    fichiers: [{ cle: 'principal', libelle: 'Export Bonnet Rouge (.xlsx)', requis: true }],
  },
  {
    // Type technique inchangé (« ssf-sous-zones ») : l'historique et l'annulation des lots passés restent valables.
    type: 'ssf-sous-zones',
    titre: 'Binômes SSF ↔ merchandiser (fichier de l’agence)',
    description: 'Fichier « SSF – merch – zone » de l’agence : quel jour chaque merchandiser travaille avec quel SSF, dans quelle zone et quels quartiers. Met à jour les binômes sans doublon, les quartiers des SSF et les règles de tournée. Seuls les SSF et merchandisers cités changent.',
    fichiers: [{ cle: 'principal', libelle: 'Fichier de l’agence (.xlsx ou .csv) : colonnes SSF, Merchandiser, Jour(s), Zone, Quartier(s)', requis: true, accept: '.xlsx,.csv' }],
  },
  {
    type: 'routing-ssf-dms',
    titre: 'Routing des SSF (export DMS)',
    description: 'Export clients DMS : pour chaque SSF (salesman), les PDV de ses clients. Sert au contrôle d’écart avec la tournée du merchandiser de son binôme. À lancer après l’import des clients DMS.',
    fichiers: [{ cle: 'principal', libelle: 'Export clients DMS (.xlsx)', requis: true }],
  },
]
const TITRES: Record<string, string> = Object.fromEntries(IMPORTS.map(i => [i.type, i.titre]))
const STATUTS: Record<string, string> = { en_cours: 'En cours', applique: 'Appliqué', erreur: 'Erreur', annulation: 'Annulation en cours', annule: 'Annulé' }
const COULEURS_STATUT: Record<string, any> = { en_cours: 'blue', applique: 'green', erreur: 'red', annulation: 'amber', annule: 'gray' }

const supabase = useSupabaseClient()
const toast = useToast()
const authStore = useAuthStore()

const fichiers = reactive<Record<string, Record<string, File | null>>>({})
const maintenant = new Date()
const jourIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const options = reactive({
  seuilDepot: 10,
  debut: jourIso(maintenant),
  pregenererDms: false,
  recalculerSsf: true,
})
const simulationEnCours = ref<TypeImport | null>(null)
const etape = ref('')
const resultat = ref<{ type: TypeImport, titre: string, fichier: string | null, res: any } | null>(null)
const application = ref(false)
const progression = ref('')
const lots = ref<any[]>([])
const erreurLots = ref('')
const annulation = ref<string | null>(null)

const rapportHtml = computed(() => (resultat.value ? markdownVersHtml(resultat.value.res.rapport) : ''))
const pret = (imp: DefImport) => imp.fichiers.every(f => !f.requis || fichiers[imp.type]?.[f.cle])

function choisirFichier(type: TypeImport, cle: string, e: Event) {
  if (!fichiers[type]) fichiers[type] = {}
  fichiers[type][cle] = (e.target as HTMLInputElement).files?.[0] || null
}

async function lireClasseur(f: File) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await f.arrayBuffer())
  return wb
}

// Lecture paginée parallèle (fetchAllRows) pour les tables volumineuses.
const toutes = (requete: () => any) => fetchAllRows<any>((from, to) => requete().range(from, to))
const horodatage = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)

async function simuler(imp: DefImport) {
  simulationEnCours.value = imp.type
  resultat.value = null
  progression.value = ''
  etape.value = 'Lecture du fichier…'
  const onEtape = (m: string) => { etape.value = `${m}…` }
  const sb = supabase as any
  const principal = fichiers[imp.type]?.principal || null
  try {
    let res: any
    if (imp.type === 'dms-pdv') {
      const { chargerDonneesDmsPdv, simulerDmsPdv }: any = await import('~/scripts/lib/imports/dms-pdv.mjs')
      const classeur = await lireClasseur(principal!)
      const donnees = await chargerDonneesDmsPdv(sb, { onEtape, toutes })
      etape.value = 'Rapprochement…'
      res = simulerDmsPdv(classeur, donnees, { seuilDepot: options.seuilDepot, nomFichier: principal!.name, marqueur: `import-dms-${horodatage()}` })
    }
    else if (imp.type === 'merch-dms') {
      const { chargerDonneesMerchDms, clientsAffectes, simulerMerchDms }: any = await import('~/scripts/lib/imports/merch-dms.mjs')
      const classeur = await lireClasseur(principal!)
      const mails = fichiers[imp.type]?.mails ? await lireClasseur(fichiers[imp.type].mails!) : null
      const codes = clientsAffectes(classeur, principal!.name).map((c: any) => c.code)
      const donnees = await chargerDonneesMerchDms(sb, codes, { onEtape, toutes })
      res = simulerMerchDms(classeur, mails, donnees, {
        debut: options.debut, pregenerer: options.pregenererDms ? 7 : 0, auteurId: authStore.profile?.id || null, nomFichier: principal!.name,
      })
    }
    else if (imp.type === 'routing-atom') {
      const { chargerDonneesRoutingAtom, lireExcelRoutingAtom, simulerRoutingAtom }: any = await import('~/scripts/lib/imports/routing-atom.mjs')
      const lignes = lireExcelRoutingAtom(await lireClasseur(principal!))
      const donnees = await chargerDonneesRoutingAtom(sb, { onEtape, toutes })
      etape.value = 'Rapprochement…'
      res = simulerRoutingAtom(lignes, donnees, { fichier: principal!.name, marqueur: `import-atom-${horodatage()}` })
    }
    else if (imp.type === 'routing-ssf-dms') {
      const { chargerDonneesRoutingSsf, simulerRoutingSsf }: any = await import('~/scripts/lib/imports/routing-ssf-dms.mjs')
      const classeur = await lireClasseur(principal!)
      const donnees = await chargerDonneesRoutingSsf(sb, { onEtape, toutes })
      etape.value = 'Rapprochement…'
      res = simulerRoutingSsf(classeur, donnees, { nomFichier: principal!.name })
    }
    else {
      // Binômes : le fichier de l'agence fait foi, rien n'est déduit de l'historique.
      const { chargerDonneesSsf, deriverSsf, lireCsvClientSsf, lireExcelClientSsf }: any = await import('~/scripts/lib/imports/ssf-sous-zones.mjs')
      const lignesClient = /\.csv$/i.test(principal!.name)
        ? lireCsvClientSsf(await principal!.text(), principal!.name)
        : lireExcelClientSsf(await lireClasseur(principal!))
      const donnees = await chargerDonneesSsf(sb, { onEtape, toutes })
      if (!donnees.migrationAppliquee) throw new Error('La migration des sous-zones SSF (20261007100000) n’est pas encore appliquée.')
      res = deriverSsf(donnees, {
        pregenererJours: options.recalculerSsf ? 7 : 0, auteurId: authStore.profile?.id || null,
        lignesClient, fichierClient: principal!.name, deriverHistorique: false,
      })
    }
    resultat.value = { type: imp.type, titre: imp.titre, fichier: principal?.name || null, res }
  }
  catch (e: any) {
    toast.add({ title: 'Simulation impossible', description: e.message, color: 'red' })
  }
  finally {
    simulationEnCours.value = null
    etape.value = ''
  }
}

function telechargerCsv(nom: string, texte: string) {
  const url = URL.createObjectURL(new Blob([texte], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  URL.revokeObjectURL(url)
}

const messageErreur = (e: any) => e?.data?.statusMessage || e?.data?.message || e?.message || 'Erreur inconnue'

async function envoyer(type: TypeImport, operations: any[], lotId: string, sens: 'application' | 'retour', libelle: string) {
  const envois = decouperOperations(operations)
  let faites = 0
  for (const [i, envoi] of envois.entries()) {
    progression.value = `${libelle} : envoi ${i + 1} / ${envois.length} (${faites} / ${operations.length} opérations)`
    await $fetch(`/api/admin/imports/${type}/appliquer`, { method: 'POST', body: { operations: envoi, lot_id: lotId, sens } })
    faites += envoi.length
  }
  progression.value = `${libelle} : ${faites} / ${operations.length} opérations faites.`
}

async function appliquer() {
  const r = resultat.value
  if (!r || !r.res.operations.length) return
  if (!confirm(`Appliquer « ${r.titre} » (${r.res.operations.length} opérations) ?`)) return
  application.value = true
  try {
    const { data: lot, error } = await (supabase.from('import_lot' as any) as any).insert({
      type: r.type, fichier: r.fichier, statut: 'en_cours', resume: r.res.resume, rapport: r.res.rapport,
      operations_total: r.res.operations.length, retour: r.res.retour, cree_par: authStore.profile?.id || null,
    }).select('id').single()
    if (error) throw new Error(`Journal des imports indisponible (${error.message}) : appliquer la migration 20261007140000.`)
    await envoyer(r.type, r.res.operations, lot.id, 'application', 'Application')
    await (supabase.from('import_lot' as any) as any).update({ statut: 'applique', applique_le: new Date().toISOString() }).eq('id', lot.id)
    if (r.type === 'dms-pdv' || r.type === 'routing-atom') await (supabase.rpc as any)('programmer_rafraichissement_stats')
    toast.add({ title: 'Import appliqué', description: progression.value, color: 'green' })
    resultat.value = null
  }
  catch (e: any) {
    toast.add({ title: 'Import interrompu', description: messageErreur(e), color: 'red' })
  }
  finally {
    application.value = false
    void chargerLots()
  }
}

async function annuler(lot: any) {
  if (!confirm(`Annuler le lot « ${TITRES[lot.type] || lot.type} » du ${new Date(lot.cree_le).toLocaleString('fr-FR')} ? Les écritures de ce lot sont défaites.`)) return
  annulation.value = lot.id
  try {
    await (supabase.from('import_lot' as any) as any).update({ statut: 'annulation' }).eq('id', lot.id)
    await envoyer(lot.type, lot.retour || [], lot.id, 'retour', 'Annulation')
    await (supabase.from('import_lot' as any) as any).update({ statut: 'annule', annule_le: new Date().toISOString(), erreur: null }).eq('id', lot.id)
    if (lot.type === 'dms-pdv' || lot.type === 'routing-atom') await (supabase.rpc as any)('programmer_rafraichissement_stats')
    toast.add({ title: 'Lot annulé', color: 'green' })
  }
  catch (e: any) {
    toast.add({ title: 'Annulation interrompue', description: `${messageErreur(e)} — relancez « Annuler le lot » pour reprendre.`, color: 'red' })
  }
  finally {
    annulation.value = null
    void chargerLots()
  }
}

async function chargerLots() {
  erreurLots.value = ''
  const { data, error } = await (supabase.from('import_lot' as any) as any)
    .select('id, type, fichier, statut, operations_total, operations_faites, retour, erreur, cree_le')
    .order('cree_le', { ascending: false }).limit(20)
  if (error) { erreurLots.value = `Historique indisponible : ${error.message}`; lots.value = []; return }
  lots.value = data || []
}

onMounted(chargerLots)
</script>

<style scoped>
.rapport-import :deep(h2) { @apply mb-2 mt-1 text-base font-bold text-gray-900 dark:text-gray-100; }
.rapport-import :deep(h3) { @apply mb-2 mt-4 text-sm font-bold text-gray-900 dark:text-gray-100; }
.rapport-import :deep(h4) { @apply mb-1 mt-3 text-sm font-semibold text-gray-800 dark:text-gray-200; }
.rapport-import :deep(p) { @apply my-2 text-gray-700 dark:text-gray-300; }
.rapport-import :deep(ul) { @apply my-2 list-disc pl-5 text-gray-700 dark:text-gray-300; }
.rapport-import :deep(table) { @apply my-3 w-full border-collapse text-xs; }
.rapport-import :deep(th) { @apply border-b border-gray-200 bg-gray-50 px-2 py-1 text-left font-semibold dark:border-gray-700 dark:bg-gray-800; }
.rapport-import :deep(td) { @apply border-b border-gray-100 px-2 py-1 dark:border-gray-800; }
.rapport-import :deep(code) { @apply rounded bg-gray-100 px-1 text-xs dark:bg-gray-800; }
.rapport-import :deep(pre) { @apply my-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-800; }
</style>
