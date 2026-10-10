<template>
  <section class="space-y-5" aria-labelledby="titre-imports-terrain">
    <div>
      <h2 id="titre-imports-terrain" class="text-lg font-semibold text-slate-900 dark:text-white">Imports terrain</h2>
      <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        Chaque import se simule d’abord : rien n’est écrit tant que vous n’avez pas relu le rapport et cliqué « Appliquer ».
        Un lot appliqué peut être annulé depuis l’historique.
      </p>
    </div>

    <!-- Cartes -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div v-for="imp in importsVisibles" :key="imp.type" class="admin-surface space-y-3 p-4">
        <div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ imp.titre }}</h3>
          <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{{ imp.description }}</p>
        </div>
        <div v-for="f in imp.fichiers" :key="f.cle" class="text-sm">
          <label :for="`fichier-${imp.type}-${f.cle}`" class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {{ f.libelle }}<span v-if="!f.requis" class="font-normal text-slate-600 dark:text-slate-400"> (facultatif)</span>
          </label>
          <input
            :id="`fichier-${imp.type}-${f.cle}`"
            type="file"
            :accept="f.accept || '.xlsx'"
            class="block w-full rounded-md text-xs text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:file:border-slate-600 dark:file:bg-slate-800 dark:file:text-slate-200"
            @change="(e: Event) => choisirFichier(imp.type, f.cle, e)"
          >
          <p v-if="f.aide" class="mt-1 text-xs text-slate-600 dark:text-slate-400">{{ f.aide }}</p>
        </div>
        <div v-if="imp.type === 'dms-pdv'" class="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <span id="libelle-seuil-depot">Un point GPS partagé par</span>
          <UInput v-model.number="options.seuilDepot" type="number" :min="2" size="xs" class="w-16" aria-labelledby="libelle-seuil-depot libelle-seuil-depot-suite" />
          <span id="libelle-seuil-depot-suite">clients ou plus est le dépôt du distributeur : ces coordonnées sont écartées.</span>
        </div>
        <div v-if="imp.type === 'merch-dms'" class="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
          <label for="debut-regles-dms">Tournées à partir du</label>
          <UInput id="debut-regles-dms" v-model="options.debut" type="date" size="xs" class="w-36" />
          <UCheckbox v-model="options.pregenererDms" label="Générer les tournées des 7 premiers jours" />
        </div>
        <div v-if="imp.type === 'routing-mensuel'" class="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
          <UCheckbox v-model="options.recalculerSsf" label="Recalculer les tournées des 7 prochains jours" />
          <!-- Exemple fictif (merchandiser « EXEMPLE ») : le simuler n'écrit rien. -->
          <a
            href="/guides/exemple-routing-mensuel.csv"
            download
            class="inline-flex items-center gap-1 font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300"
          >
            <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
            Télécharger un exemple de fichier
          </a>
        </div>
        <UButton
          size="sm"
          variant="outline"
          icon="i-heroicons-beaker"
          :loading="simulationEnCours === imp.type"
          :disabled="!!simulationEnCours || !!application || !pret(imp)"
          @click="simuler(imp)"
        >
          Simuler
        </UButton>
        <p v-if="simulationEnCours === imp.type && etape" class="text-xs text-slate-600 dark:text-slate-300" aria-live="polite">{{ etape }}</p>
      </div>
    </div>

    <!-- Résultat de la simulation -->
    <div v-if="resultat" class="admin-surface space-y-4 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">Simulation : {{ resultat.titre }}</h3>
          <p class="text-sm text-slate-600 dark:text-slate-300">{{ resultat.fichier || 'Sans fichier' }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="(v, k) in resultat.res.resume"
              :key="k"
              class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200"
            >{{ libelleResume(String(k)) }} : <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ valeurResume(v) }}</strong></span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="(texte, nom) in resultat.res.csv"
            :key="nom"
            size="xs"
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            :title="String(nom)"
            @click="telechargerCsv(String(nom), texte as string)"
          >
            {{ LIBELLES_CSV[String(nom)] || String(nom) }} (CSV)
          </UButton>
        </div>
      </div>

      <div v-if="resultat.res.bloquants?.length" class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        <p class="font-semibold">Application impossible :</p>
        <ul class="list-disc pl-5"><li v-for="b in resultat.res.bloquants" :key="b">{{ b }}</li></ul>
      </div>

      <div class="rapport-import max-h-[32rem] overflow-y-auto rounded-md border border-slate-200 p-4 text-sm dark:border-slate-700" v-html="rapportHtml" />

      <!-- Le rapport cite des listes à corriger : on y mène directement. -->
      <p v-if="LISTES_LIEES[resultat.type]?.length" class="text-sm text-slate-600 dark:text-slate-300">
        Pour corriger ce que le rapport signale :
        <template v-for="(l, i) in LISTES_LIEES[resultat.type]" :key="l.liste">
          <template v-if="i"> · </template>
          <AdminLienEcran chemin="/admin/referentiels" :liste="l.liste">Référentiels › {{ l.libelle }}</AdminLienEcran>
        </template>
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          icon="i-heroicons-check-circle"
          :loading="application"
          :disabled="application || !resultat.res.operations.length || !!resultat.res.bloquants?.length"
          @click="appliquer"
        >
          Appliquer ({{ resultat.res.operations.length.toLocaleString('fr-FR') }} écriture{{ resultat.res.operations.length > 1 ? 's' : '' }})
        </UButton>
        <span v-if="!resultat.res.operations.length" class="text-sm text-slate-600 dark:text-slate-300">Rien à écrire : les données sont déjà à jour pour ce fichier.</span>
        <span v-if="progression" class="text-sm text-slate-700 dark:text-slate-300" aria-live="polite">{{ progression }}</span>
      </div>
    </div>

    <!-- Historique -->
    <div class="admin-surface space-y-3 p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Historique des imports</h3>
        <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-arrow-path" @click="chargerLots">Actualiser</UButton>
      </div>
      <p v-if="erreurLots" class="text-sm text-amber-800 dark:text-amber-300">{{ erreurLots }}</p>
      <div v-else class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Import</th>
              <th scope="col">Fichier</th>
              <th scope="col">Statut</th>
              <th scope="col" class="!text-right">Avancement</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lots" :key="l.id">
              <td class="whitespace-nowrap tabular-nums">{{ new Date(l.cree_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }}</td>
              <td>{{ TITRES[l.type] || l.type }}</td>
              <td class="text-xs text-slate-600 dark:text-slate-300">{{ l.fichier || 'Sans fichier' }}</td>
              <td>
                <UBadge :color="COULEURS_STATUT[l.statut] || 'gray'" variant="soft" size="xs">{{ STATUTS[l.statut] || l.statut }}</UBadge>
                <p v-if="l.erreurAffichee" class="mt-1 max-w-xs text-xs text-red-700 dark:text-red-300">{{ l.erreurAffichee }}</p>
              </td>
              <td class="whitespace-nowrap text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">
                {{ (l.operations_faites || 0).toLocaleString('fr-FR') }} sur {{ (l.operations_total || 0).toLocaleString('fr-FR') }}
              </td>
              <td class="text-right">
                <UButton
                  v-if="['applique', 'erreur', 'annulation'].includes(l.statut) && l.retour?.length"
                  size="xs"
                  color="gray"
                  variant="ghost"
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
              <td colspan="6" class="py-6 text-center text-slate-600 dark:text-slate-300">Aucun import lancé depuis le back-office. Simulez un fichier ci-dessus pour commencer.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AdminConfirmation v-bind="confirmation" @confirmer="confirmerFenetre" @annuler="annulerFenetre" />
  </section>
</template>

<script setup lang="ts">
import { fetchAllRows } from '~/utils/fetchAll'
import { markdownVersHtml } from '~/utils/markdownSimple'
import { messageUtilisateur } from '~/utils/supabaseErrors'
import { compte, pluriel } from '~/utils/pluriel'
// @ts-ignore modules JS partagés avec les scripts (sans types)
import { decouperOperations } from '~/scripts/lib/imports/operations.mjs'

type TypeImport = 'dms-pdv' | 'merch-dms' | 'routing-atom' | 'ssf-sous-zones' | 'routing-ssf-dms' | 'routing-mensuel'
interface DefImport {
  type: TypeImport
  titre: string
  description: string
  fichiers: { cle: string, libelle: string, requis: boolean, accept?: string, aide?: string }[]
}

const IMPORTS: DefImport[] = [
  {
    type: 'dms-pdv',
    titre: 'Clients du distributeur (DMS) vers les points de vente',
    description: 'Fichier des clients du distributeur (DMS) : relie chaque client à son point de vente grâce au code client, et crée les clients qui manquent en les plaçant près de leurs voisins.',
    fichiers: [{ cle: 'principal', libelle: 'Fichier des clients du distributeur (.xlsx)', requis: true }],
  },
  {
    type: 'merch-dms',
    titre: 'Affectation des merchandisers (DMS)',
    description: 'Colonne « Merchandiseur » du fichier du distributeur : fixe le périmètre de chaque merchandiser et sa tournée « Portefeuille DMS ». À faire après l’import des clients du distributeur.',
    fichiers: [
      { cle: 'principal', libelle: 'Fichier des clients du distributeur (.xlsx)', requis: true },
      { cle: 'mails', libelle: 'Fichier des mails des merchandisers (.xlsx)', requis: false },
    ],
  },
  {
    type: 'routing-atom',
    titre: 'Visites Atom (export Bonnet Rouge)',
    description: 'Feuille « Routing détaillé » : reprend les visites des merchandisers Atom avec leur point de vente (retrouvé ou créé), leur distributeur et leur vendeur (SSF). Une visite déjà importée n’est jamais ajoutée deux fois.',
    fichiers: [{ cle: 'principal', libelle: 'Export Bonnet Rouge (.xlsx)', requis: true }],
  },
  {
    type: 'routing-mensuel',
    titre: 'Routing mensuel des merchandisers (fichier de l’agence)',
    description: 'Le planning du mois envoyé par l’agence : pour chaque merchandiser, chaque jour et chaque semaine du mois, le lieu de visite et le vendeur du distributeur (SSF) qui l’accompagne. Les lieux sont cherchés seulement dans la commune et le portefeuille du merchandiser ; un quartier introuvable donne, ce jour-là, son portefeuille dans la commune. Seuls les merchandisers du fichier sont modifiés.',
    fichiers: [{
      cle: 'principal',
      libelle: 'Fichier de l’agence (.xlsx ou .csv)',
      requis: true,
      accept: '.xlsx,.csv',
      aide: 'Colonnes attendues : Merchandiser, Jour, Occurrence (la semaine du mois), Commune, Quartier, Point de visite, SSF (ou « Aucun SSF »)…',
    }],
  },
  {
    type: 'routing-ssf-dms',
    titre: 'Tournées des vendeurs du distributeur (SSF)',
    description: 'Fichier des clients du distributeur (DMS) : pour chaque vendeur (SSF), les points de vente de ses clients. Sert à comparer sa tournée avec celle du merchandiser qui travaille avec lui. À faire après l’import des clients du distributeur.',
    fichiers: [{ cle: 'principal', libelle: 'Fichier des clients du distributeur (.xlsx)', requis: true }],
  },
]
// Imports retirés de l'écran : leurs lots passés restent lisibles et annulables.
const TITRES: Record<string, string> = { 'ssf-sous-zones': 'Sous-zones SSF (ancien import)', ...Object.fromEntries(IMPORTS.map(i => [i.type, i.titre])) }
const STATUTS: Record<string, string> = { en_cours: 'En cours', applique: 'Appliqué', erreur: 'Erreur', annulation: 'Annulation en cours', annule: 'Annulé' }
const COULEURS_STATUT: Record<string, any> = { en_cours: 'blue', applique: 'green', erreur: 'red', annulation: 'amber', annule: 'gray' }
// Listes des référentiels que cite le rapport de simulation (scripts/lib/imports).
const LISTES_LIEES: Partial<Record<TypeImport, { liste: string, libelle: string }[]>> = {
  'merch-dms': [
    { liste: 'alias_import', libelle: 'Alias d’import (orthographes)' },
    { liste: 'maintenance', libelle: 'Tâches automatiques' },
  ],
  'routing-mensuel': [
    { liste: 'routing_mensuel', libelle: 'Routing mensuel' },
    { liste: 'alias_import', libelle: 'Alias d’import (orthographes)' },
  ],
  'routing-ssf-dms': [{ liste: 'ssf', libelle: 'Vendeurs des distributeurs (SSF)' }],
}

// Libellés des chiffres du rapport : les scripts d'import (scripts/lib/imports)
// renvoient des clés internes (lignesDms, ssfACreer…) qu'on traduit ici.
const LIBELLES_RESUME: Record<string, string> = {
  lignes: 'Lignes du fichier',
  lignesDms: 'Lignes du fichier',
  clients: 'Clients',
  dejaRelies: 'Déjà reliés à un PDV',
  relies: 'Reliés à un PDV',
  crees: 'PDV créés',
  sansGps: 'Sans coordonnées GPS',
  territoireInconnu: 'Territoire non reconnu',
  merchandisers: 'Merchandisers',
  merchandisersInconnus: 'Merchandisers non reconnus',
  merchandisersAvecRegles: 'Merchandisers avec tournées',
  affectes: 'Merchandisers affectés',
  sansCompte: 'Sans compte dans l’application',
  bloquants: 'Points bloquants',
  dejaImportees: 'Visites déjà importées',
  ecartees: 'Lignes écartées',
  visites: 'Visites',
  pdvCrees: 'PDV créés',
  ssfRapproches: 'Vendeurs (SSF) reconnus',
  distributeursRapproches: 'Distributeurs reconnus',
  cases: 'Cases du planning',
  casesSansSsf: 'Cases sans vendeur (SSF)',
  casesPoint: 'Cases par point GPS',
  casesCommune: 'Cases à l’échelle de la commune',
  casesSansLieu: 'Cases sans lieu',
  regles: 'Règles de tournée',
  lieuxExacts: 'Lieux reconnus',
  lieuxAlias: 'Lieux reconnus par une autre orthographe',
  lieuxApproches: 'Lieux approchés, à relire',
  lieuxCommune: 'Lieux ramenés à la commune',
  lieuxIntrouvables: 'Lieux introuvables',
  vendeurs: 'Vendeurs (SSF)',
  ssf: 'Vendeurs (SSF)',
  ssfReconnus: 'Vendeurs (SSF) reconnus',
  ssfACreer: 'Vendeurs (SSF) à créer',
  ssfARelier: 'Vendeurs (SSF) à relier',
  ssfBruit: 'Vendeurs (SSF) écartés',
  clientsSansPdv: 'Clients sans PDV',
  clientsSansVendeur: 'Clients sans vendeur',
  sousZonesDerivees: 'Quartiers déduits des visites',
  sousZonesClient: 'Quartiers du fichier client',
  sousZonesConservees: 'Quartiers conservés',
  joursNonCouverts: 'Jours sans tournée',
  reglesPasseesEnQuotas: 'Tournées passées aux quotas',
  rejetsClient: 'Lignes refusées',
  moisReference: 'Mois de référence',
  operations: 'Écritures prévues',
}
/** Clé inconnue : « motsCollesEnCamel » devient « Mots colles en camel ». */
function libelleResume(cle: string) {
  if (LIBELLES_RESUME[cle]) return LIBELLES_RESUME[cle]
  const mots = cle.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return mots.charAt(0).toUpperCase() + mots.slice(1)
}
const valeurResume = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('fr-FR') : String(v ?? ''))

// Fichiers de détail produits par la simulation.
const LIBELLES_CSV: Record<string, string> = {
  'import-dms-pdv.csv': 'Détail des clients',
  'pdv-sans-gps-dms.csv': 'Clients sans GPS',
  'affectation-merch-dms.csv': 'Détail par merchandiser',
  'import-routing-atom-pdv-crees.csv': 'PDV créés',
  'import-routing-atom-ecartes.csv': 'Lignes écartées',
  'routing-mensuel.csv': 'Détail des cases',
  'lieux-a-rattacher.csv': 'Lieux à rattacher',
  'routing-ssf.csv': 'Détail par vendeur',
}

const supabase = useSupabaseClient()
const toast = useToast()
const authStore = useAuthStore()
const { confirmation, demanderConfirmation, confirmer: confirmerFenetre, annuler: annulerFenetre } = useConfirmation()
// Compte agence : seulement le routing mensuel de ses merchandisers ; la route
// serveur (requireAdminOuAgence) vérifie chaque opération.
const importsVisibles = computed(() => (authStore.isAgence ? IMPORTS.filter(i => i.type === 'routing-mensuel') : IMPORTS))

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
      // Routing mensuel : le fichier de l'agence fait foi.
      const { chargerDonneesRoutingMensuel, lireRoutingMensuelCsv, lireRoutingMensuelExcel, simulerRoutingMensuel }: any = await import('~/scripts/lib/imports/routing-mensuel.mjs')
      const lignes = /\.csv$/i.test(principal!.name)
        ? lireRoutingMensuelCsv(await principal!.text(), principal!.name)
        : lireRoutingMensuelExcel(await lireClasseur(principal!))
      const donnees = await chargerDonneesRoutingMensuel(sb, { onEtape, toutes })
      etape.value = 'Rapprochement…'
      res = simulerRoutingMensuel(lignes, donnees, {
        fichier: principal!.name, pregenererJours: options.recalculerSsf ? 7 : 0, auteurId: authStore.profile?.id || null,
      })
    }
    resultat.value = { type: imp.type, titre: imp.titre, fichier: principal?.name || null, res }
  }
  catch (e: any) {
    toast.add({ title: 'Simulation impossible', description: messageUtilisateur(e), color: 'red' })
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

async function envoyer(type: TypeImport, operations: any[], lotId: string, sens: 'application' | 'retour', libelle: string) {
  const envois = decouperOperations(operations)
  let faites = 0
  for (const [i, envoi] of envois.entries()) {
    progression.value = `${libelle} : envoi ${i + 1} sur ${envois.length} (${faites.toLocaleString('fr-FR')} écritures faites sur ${operations.length.toLocaleString('fr-FR')})`
    await $fetch(`/api/admin/imports/${type}/appliquer`, { method: 'POST', body: { operations: envoi, lot_id: lotId, sens } })
    faites += envoi.length
  }
  progression.value = `${libelle} : ${faites.toLocaleString('fr-FR')} écritures faites sur ${operations.length.toLocaleString('fr-FR')}.`
}

async function appliquer() {
  const r = resultat.value
  if (!r || !r.res.operations.length) return
  const n = r.res.operations.length
  const ok = await demanderConfirmation({
    titre: `Appliquer l’import « ${r.titre} » ?`,
    message: `${compte(n, 'écriture')} ${pluriel(n, 'sera faite', 'seront faites')}${r.fichier ? ` à partir de « ${r.fichier} »` : ''}. Vous pourrez annuler ce lot depuis l’historique des imports.`,
    libelleAction: 'Appliquer l’import',
    destructif: false,
  })
  if (!ok) return
  application.value = true
  try {
    const { data: lot, error } = await (supabase.from('import_lot' as any) as any).insert({
      type: r.type, fichier: r.fichier, statut: 'en_cours', resume: r.res.resume, rapport: r.res.rapport,
      operations_total: r.res.operations.length, retour: r.res.retour, cree_par: authStore.profile?.id || null,
    }).select('id').single()
    if (error) {
      console.error('[imports terrain] journal des imports', error)
      throw new Error('Le journal des imports n’est pas disponible sur le serveur : rien n’a été écrit. Prévenez l’administrateur technique.')
    }
    await envoyer(r.type, r.res.operations, lot.id, 'application', 'Application')
    await (supabase.from('import_lot' as any) as any).update({ statut: 'applique', applique_le: new Date().toISOString() }).eq('id', lot.id)
    if (r.type === 'dms-pdv' || r.type === 'routing-atom') await (supabase.rpc as any)('programmer_rafraichissement_stats')
    toast.add({ title: 'Import appliqué', description: progression.value, color: 'green' })
    resultat.value = null
  }
  catch (e: any) {
    toast.add({ title: 'Import interrompu', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    application.value = false
    void chargerLots()
  }
}

async function annuler(lot: any) {
  const ok = await demanderConfirmation({
    titre: `Annuler le lot « ${TITRES[lot.type] || lot.type} » du ${new Date(lot.cree_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} ?`,
    message: `Les écritures de ce lot seront défaites${lot.fichier ? ` (fichier « ${lot.fichier} »)` : ''}.`,
    libelleAction: 'Annuler le lot',
    libelleRetour: 'Garder le lot',
  })
  if (!ok) return
  annulation.value = lot.id
  try {
    await (supabase.from('import_lot' as any) as any).update({ statut: 'annulation' }).eq('id', lot.id)
    await envoyer(lot.type, lot.retour || [], lot.id, 'retour', 'Annulation')
    await (supabase.from('import_lot' as any) as any).update({ statut: 'annule', annule_le: new Date().toISOString(), erreur: null }).eq('id', lot.id)
    if (lot.type === 'dms-pdv' || lot.type === 'routing-atom') await (supabase.rpc as any)('programmer_rafraichissement_stats')
    toast.add({ title: 'Lot annulé', description: TITRES[lot.type] || lot.type, color: 'green' })
  }
  catch (e: any) {
    toast.add({ title: 'Annulation interrompue', description: `${messageUtilisateur(e)} Relancez « Annuler le lot » pour reprendre.`, color: 'red' })
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
  if (error) { erreurLots.value = `Historique indisponible. ${messageUtilisateur(error)}`; lots.value = []; return }
  // L'erreur notée sur un lot peut être un message brut de la base : on la traduit.
  lots.value = (data || []).map((l: any) => ({
    ...l,
    erreurAffichee: l.erreur ? messageUtilisateur({ message: l.erreur }, 'L’import s’est arrêté avant la fin. Relancez-le, ou annulez le lot.') : '',
  }))
}

onMounted(chargerLots)
</script>

<style scoped>
/* Rapport de simulation (Markdown des scripts d'import) aux couleurs du back-office. */
.rapport-import :deep(h1),
.rapport-import :deep(h2) { @apply mb-2 mt-1 text-base font-semibold text-slate-900 dark:text-white; }
.rapport-import :deep(h3) { @apply mb-2 mt-4 text-sm font-semibold text-slate-900 dark:text-white; }
.rapport-import :deep(h4) { @apply mb-1 mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200; }
.rapport-import :deep(p) { @apply my-2 text-slate-700 dark:text-slate-300; }
.rapport-import :deep(ul) { @apply my-2 list-disc pl-5 text-slate-700 dark:text-slate-300; }
.rapport-import :deep(table) { @apply my-3 w-full border-collapse text-xs tabular-nums; }
.rapport-import :deep(th) { @apply border-b border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200; }
.rapport-import :deep(td) { @apply border-b border-slate-200 px-2 py-1 text-slate-700 dark:border-slate-800 dark:text-slate-300; }
.rapport-import :deep(code) { @apply rounded bg-slate-100 px-1 text-xs dark:bg-slate-800; }
.rapport-import :deep(pre) { @apply my-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-800; }
</style>
