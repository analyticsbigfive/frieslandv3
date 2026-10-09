<template>
  <div class="space-y-6">
    <AdminPageHeader description="La version minimale exigée, la publication d'une nouvelle version, et qui a installé quoi.">
      <template #actions>
        <UButton icon="i-heroicons-arrow-path" variant="outline" :loading="loading" @click="charger">Actualiser</UButton>
      </template>
    </AdminPageHeader>

    <div v-if="erreur" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
      {{ erreur }}
    </div>

    <!-- Version exigée -->
    <div class="admin-surface flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Version minimale exigée (Android)</h2>
        <p class="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
          {{ versionApp ? `${versionApp.version_nom_min || 'Version sans nom'} (numéro interne ${versionApp.version_code_min})` : 'Non définie' }}
        </p>
        <p class="text-sm text-slate-600 dark:text-slate-300">En dessous, l'application affiche un écran de mise à jour obligatoire.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="versionApp?.url_telechargement"
          icon="i-heroicons-clipboard-document"
          variant="outline"
          @click="copierLien"
        >
          Copier le lien de l'APK
        </UButton>
        <UButton v-if="authStore.isAdmin && versionApp" icon="i-heroicons-pencil-square" variant="outline" @click="ouvrirVersionMin">
          Modifier la version minimale
        </UButton>
      </div>
    </div>

    <ChargementContenu v-if="loading && !lignes.length" variante="lignes" libelle="Chargement des versions…" />

    <template v-else>
      <!-- Synthèse (sur la direction, l'employeur et le rôle choisis) -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Adoption" :value="`${synthese.taux} %`" :subtitle="`${synthese.a_jour} / ${synthese.total} comptes à jour`" format="none" :icon="Smartphone" color="green" />
        <StatsCard title="À jour" :value="synthese.a_jour" :icon="CheckCircle2" color="blue" />
        <StatsCard title="Bloqués" :value="synthese.bloquee" subtitle="Écran de mise à jour affiché" :icon="Lock" color="orange" />
        <StatsCard title="Non déclarés" :value="synthese.non_declaree" subtitle="Version trop ancienne pour être déclarée (avant 1.0.10), ou application jamais ouverte" :icon="HelpCircle" color="red" />
      </div>

      <div v-if="synthese.non_declaree" class="admin-surface flex gap-3 p-4 text-sm leading-6 text-slate-700 dark:text-slate-300">
        <UIcon name="i-heroicons-information-circle" class="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
        <p>
          « Non déclarée » : l'application ne déclare sa version, et n'affiche l'écran de mise à jour obligatoire, que depuis la 1.0.10.
          Un téléphone en 1.0.9 ou avant n'est donc <strong class="text-slate-900 dark:text-white">ni visible ni bloqué</strong> : la personne doit mettre à jour
          depuis le Play Store ou le lien de l'APK. Triez par « Dernière visite » pour relancer d'abord ceux qui travaillent.
        </p>
      </div>

      <!-- Filtres -->
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="recherche" icon="i-heroicons-magnifying-glass" size="sm" placeholder="Nom ou email…" aria-label="Rechercher un compte" class="w-full sm:w-56" />
        <USelect v-model="filtreStatut" :options="optionsStatut" size="sm" aria-label="Filtrer par statut" />
        <USelect v-model="filtreDirection" :options="optionsDirection" size="sm" aria-label="Filtrer par direction" />
        <USelect v-model="filtreEmployeur" :options="optionsEmployeur" size="sm" aria-label="Filtrer par employeur" />
        <USelect v-model="filtreRole" :options="optionsRole" size="sm" aria-label="Filtrer par rôle" />
        <span class="text-xs tabular-nums text-slate-600 dark:text-slate-300" aria-live="polite">{{ lignesFiltrees.length }} compte{{ lignesFiltrees.length > 1 ? 's' : '' }}</span>
      </div>

      <!-- Comptes -->
      <div class="admin-surface overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Compte</th>
              <th scope="col">Rôle</th>
              <th scope="col">Employeur</th>
              <th scope="col">Direction</th>
              <th scope="col">Statut</th>
              <th scope="col">Version</th>
              <th scope="col" :aria-sort="tri === 'ouverture' ? 'descending' : 'none'">
                <button type="button" class="tri-colonne" @click="tri = 'ouverture'">
                  Dernière ouverture
                  <UIcon v-if="tri === 'ouverture'" name="i-heroicons-arrow-down" class="h-3.5 w-3.5" aria-hidden="true" />
                  <span v-if="tri === 'ouverture'" class="sr-only">(tri : plus récente d'abord)</span>
                </button>
              </th>
              <th scope="col" :aria-sort="tri === 'visite' ? 'descending' : 'none'">
                <button type="button" class="tri-colonne" @click="tri = 'visite'">
                  Dernière visite (30 derniers jours)
                  <UIcon v-if="tri === 'visite'" name="i-heroicons-arrow-down" class="h-3.5 w-3.5" aria-hidden="true" />
                  <span v-if="tri === 'visite'" class="sr-only">(tri : plus récente d'abord)</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lignesFiltrees" :key="l.user_id">
              <td>
                <p class="font-medium text-slate-900 dark:text-white">{{ l.nom || l.email }}</p>
                <p v-if="l.nom" class="text-xs text-slate-500 dark:text-slate-400">{{ l.email }}</p>
              </td>
              <td><UBadge variant="soft" color="gray" size="xs">{{ libelleRole(l.role) }}</UBadge></td>
              <td>{{ nomAgence(l.employeur) }}</td>
              <td>{{ libelleDirection(l.direction, true) }}</td>
              <td>
                <UBadge variant="soft" :color="couleurStatut[l.statut]" size="xs">{{ libelleCourt[l.statut] }}</UBadge>
              </td>
              <td class="whitespace-nowrap tabular-nums">
                {{ l.version_code != null ? `${l.version_nom || 'Sans nom'} (${l.version_code})` : '—' }}
              </td>
              <td class="whitespace-nowrap tabular-nums">{{ formaterDate(l.vu_le) }}</td>
              <td class="whitespace-nowrap tabular-nums">
                {{ l.derniere_visite ? `${formaterDate(l.derniere_visite)} · ${ilYa(l.derniere_visite)}` : 'Aucune' }}
              </td>
            </tr>
            <tr v-if="!lignesFiltrees.length">
              <td colspan="8" class="py-8 text-center text-slate-600 dark:text-slate-300">Aucun compte pour ces filtres. Élargissez le statut, la direction, l'employeur ou le rôle.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inventaire des licences par direction et par rôle -->
      <div class="admin-surface p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">Comptes par direction et par rôle</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              {{ inventaire.total }} compte{{ inventaire.total > 1 ? 's' : '' }} actif{{ inventaire.total > 1 ? 's' : '' }}, hors comptes de test ({{ inventaire.tests }}).
              Direction : celle du compte (Paramètres › Utilisateurs), sinon déduite de ses territoires.
            </p>
          </div>
          <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exporterInventaire">Exporter les comptes</UButton>
        </div>
        <div class="mt-3 overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Direction</th>
                <th v-for="r in ROLES_INVENTAIRE" :key="r" scope="col" class="!text-right">{{ libelleRole(r) }}</th>
                <th scope="col" class="!text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in inventaire.lignes" :key="l.direction || 'aucune'">
                <td class="font-medium text-slate-900 dark:text-white">{{ l.direction ? libelleDirection(l.direction) : 'Non renseignée' }}</td>
                <td v-for="r in ROLES_INVENTAIRE" :key="r" class="text-right tabular-nums">{{ l.parRole[r] || 0 }}</td>
                <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ l.total }}</td>
              </tr>
              <tr v-if="!inventaire.lignes.length">
                <td :colspan="ROLES_INVENTAIRE.length + 2" class="py-6 text-center text-slate-600 dark:text-slate-300">Aucun compte actif à compter.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="inventaire.doubles.length" class="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Personnes avec plusieurs comptes (comptées une fois par compte) :
          {{ inventaire.doubles.map(cs => `${cs[0].nom} (${cs.map(c => libelleRole(c.role)).join(' + ')})`).join(' ; ') }}.
        </p>
      </div>
    </template>

    <!-- Publier une version : réservé à l'administrateur (dépôt de l'APK,
         vérifications, version obligatoire ou non). -->
    <section v-if="authStore.isAdmin" id="publier" class="space-y-3">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Publier une nouvelle version</h2>
      <AdminPublierVersion />
    </section>

    <AdminFormModal
      v-model="modaleVersionMin"
      title="Modifier la version minimale"
      description="Les téléphones sous cette version verront un écran de mise à jour obligatoire. Vérifiez d'abord dans le tableau ci-dessus que la plupart des comptes l'ont installée."
      icon="i-heroicons-device-phone-mobile"
      required-note
    >
      <UFormGroup label="Numéro interne de la version minimale" required help="Chaque version a un numéro interne : 1.0.10 = 13, 1.0.12 = 15…" size="md">
        <UInput v-model.number="formVersionMin.version_code_min" type="number" min="1" size="md" class="w-full" />
      </UFormGroup>
      <UFormGroup label="Version affichée" help="Le nom que voient les utilisateurs, ex. 1.0.12." size="md">
        <UInput v-model="formVersionMin.version_nom_min" size="md" class="w-full" />
      </UFormGroup>
      <UFormGroup label="Message affiché sur l'écran de mise à jour" size="md">
        <UInput v-model="formVersionMin.message" size="md" class="w-full" />
      </UFormGroup>
      <template #footer>
        <UButton color="gray" variant="ghost" @click="modaleVersionMin = false">Annuler</UButton>
        <UButton icon="i-heroicons-check" :loading="enregistrementVersionMin" :disabled="!(formVersionMin.version_code_min >= 1)" @click="enregistrerVersionMin">Enregistrer</UButton>
      </template>
    </AdminFormModal>
  </div>
</template>

<script setup lang="ts">
// Suivi de l'adoption de l'app mobile après une montée de version minimale.
// Croise les comptes terrain actifs (profiles), la version déclarée au
// lancement (version_installee) et la version exigée (version_app). La
// dernière visite (30 jours) sert à relancer d'abord ceux qui travaillent.
// Lecture seule ; la RLS de version_installee réserve la lecture à l'admin et
// au superviseur.
import { CheckCircle2, HelpCircle, Lock, Smartphone } from 'lucide-vue-next'
import { fetchAllRows } from '~/utils/fetchAll'
import { LIBELLES_STATUT, ROLES_APP_MOBILE, estCompteTest, inventaireComptes, joursDepuis, statutVersion, syntheseAdoption, type StatutVersion } from '~/utils/adoptionApp'
import { DIRECTIONS, libelleDirection } from '~/utils/agences'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const toast = useToast()
const authStore = useAuthStore()

// Version minimale (anciennement Référentiels › Application mobile › Version minimale).
const modaleVersionMin = ref(false)
const enregistrementVersionMin = ref(false)
const formVersionMin = reactive({ version_code_min: 0, version_nom_min: '', message: '' })
async function ouvrirVersionMin() {
  const { data } = await (supabase.from('version_app') as any).select('version_code_min, version_nom_min, message').eq('plateforme', 'android').maybeSingle()
  Object.assign(formVersionMin, {
    version_code_min: data?.version_code_min ?? versionApp.value?.version_code_min ?? 1,
    version_nom_min: data?.version_nom_min ?? '',
    message: data?.message ?? '',
  })
  modaleVersionMin.value = true
}
async function enregistrerVersionMin() {
  enregistrementVersionMin.value = true
  try {
    const { error } = await (supabase.from('version_app') as any).update({
      version_code_min: formVersionMin.version_code_min,
      version_nom_min: formVersionMin.version_nom_min || null,
      message: formVersionMin.message || null,
      updated_at: new Date().toISOString(),
    }).eq('plateforme', 'android')
    if (error) throw error
    toast.add({ title: 'Version minimale enregistrée', color: 'green' })
    modaleVersionMin.value = false
    await charger()
  }
  catch (error) {
    toast.add({ title: 'Version minimale non enregistrée', description: messageUtilisateur(error), color: 'red' })
  }
  finally {
    enregistrementVersionMin.value = false
  }
}

interface Ligne {
  user_id: string
  nom: string | null
  email: string | null
  role: string
  employeur: string | null
  direction: string | null
  version_code: number | null
  version_nom: string | null
  vu_le: string | null
  derniere_visite: string | null
  statut: StatutVersion
}

const versionApp = ref<{ version_code_min: number, version_nom_min: string | null, url_telechargement: string | null } | null>(null)
const lignes = ref<Ligne[]>([])
const loading = ref(true)
const erreur = ref('')

const recherche = ref('')
const filtreStatut = ref('tous')
const filtreEmployeur = ref('tous')
const filtreDirection = ref('tous')
// Inventaire : tous les comptes actifs (admin compris), pas seulement ceux de l'app.
const ROLES_INVENTAIRE = ['merchandiser', 'commercial', 'superviseur', 'admin'] as const
const comptes = ref<{ nom: string | null, email: string | null, role: string, direction: string | null, employeur: string | null }[]>([])
const { options: optionsAgences, nom: nomAgence, charger: chargerAgences } = useAgences()
const { exportToCsv } = useCsvExport()
const filtreRole = ref('tous')
const tri = ref<'visite' | 'ouverture'>('visite')

const libelleCourt: Record<StatutVersion, string> = { a_jour: 'À jour', bloquee: 'Bloquée', non_declaree: 'Non déclarée' }
const LIBELLES_ROLES: Record<string, string> = {
  admin: 'Administrateur',
  superviseur: 'Superviseur',
  commercial: 'Commercial',
  merchandiser: 'Merchandiser',
  agence: 'Agence',
}
function libelleRole(role: string) { return LIBELLES_ROLES[role] || role }
// Libellés du filtre de statut : la version d'avant 1.0.10 dite en clair.
const LIBELLES_FILTRE_STATUT: Record<StatutVersion, string> = {
  ...LIBELLES_STATUT,
  non_declaree: 'Non déclarée (version trop ancienne pour être déclarée, avant 1.0.10, ou jamais ouverte)',
}
const couleurStatut: Record<StatutVersion, 'green' | 'orange' | 'red'> = { a_jour: 'green', bloquee: 'orange', non_declaree: 'red' }
const optionsStatut = [
  { label: 'Tous les statuts', value: 'tous' },
  ...(Object.keys(LIBELLES_STATUT) as StatutVersion[]).map(s => ({ label: LIBELLES_FILTRE_STATUT[s], value: s })),
]
const optionsEmployeur = computed(() => [{ label: 'Tous les employeurs', value: 'tous' }, ...optionsAgences.value])
const optionsDirection = [
  { label: 'Toutes les directions', value: 'tous' },
  ...DIRECTIONS.map(d => ({ label: d.label, value: d.value })),
  { label: 'Direction non renseignée', value: 'aucune' },
]
const optionsRole = [{ label: 'Tous les rôles', value: 'tous' }, ...ROLES_APP_MOBILE.map(r => ({ label: libelleRole(r), value: r }))]

// Périmètre choisi (direction, employeur, rôle) : la synthèse le suit, pour
// répondre à « à Abidjan, qui a installé et qui n'a pas encore installé ».
const lignesPerimetre = computed(() => lignes.value
  .filter(l => filtreDirection.value === 'tous' || (filtreDirection.value === 'aucune' ? !l.direction : l.direction === filtreDirection.value))
  .filter(l => filtreEmployeur.value === 'tous' || l.employeur === filtreEmployeur.value)
  .filter(l => filtreRole.value === 'tous' || l.role === filtreRole.value))
const synthese = computed(() => syntheseAdoption(lignesPerimetre.value))
const inventaire = computed(() => inventaireComptes(comptes.value, ROLES_INVENTAIRE))

function exporterInventaire() {
  const statutDe = new Map(lignes.value.map(l => [l.email, l]))
  exportToCsv(comptes.value.map(c => ({
    nom: c.nom || '',
    email: c.email || '',
    role: c.role,
    agence: nomAgence(c.employeur),
    direction: c.direction ? libelleDirection(c.direction, true) : '',
    compte_test: estCompteTest(c.email) ? 'oui' : '',
    version_app: statutDe.get(c.email)?.version_nom || '',
    statut_app: statutDe.get(c.email) ? libelleCourt[statutDe.get(c.email)!.statut] : '',
  })), `comptes-par-direction-${new Date().toISOString().slice(0, 10)}.csv`)
}

const lignesFiltrees = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  const cle = tri.value === 'visite' ? 'derniere_visite' : 'vu_le'
  return lignesPerimetre.value
    .filter(l => filtreStatut.value === 'tous' || l.statut === filtreStatut.value)
    .filter(l => !q || `${l.nom || ''} ${l.email || ''}`.toLowerCase().includes(q))
    // Plus récent d'abord, sans date en dernier.
    .sort((a, b) => (b[cle] || '').localeCompare(a[cle] || ''))
})

function ilYa(iso: string) {
  const n = joursDepuis(iso) ?? 0
  if (n <= 0) return 'aujourd\'hui'
  return `il y a ${n} jour${n > 1 ? 's' : ''}`
}

function formaterDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

async function copierLien() {
  if (!versionApp.value?.url_telechargement) return
  try {
    await navigator.clipboard.writeText(versionApp.value.url_telechargement)
    toast.add({ title: 'Lien copié', description: 'À envoyer aux personnes dont l\'application n\'est pas à jour.', color: 'green' })
  }
  catch {
    toast.add({ title: 'Copie impossible', description: versionApp.value.url_telechargement, color: 'amber' })
  }
}

async function charger() {
  loading.value = true
  erreur.value = ''
  try {
    const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const [va, profils, installees, visites] = await Promise.all([
      (supabase.from('version_app') as any)
        .select('version_code_min, version_nom_min, url_telechargement').eq('plateforme', 'android').maybeSingle(),
      // direction : migration 20261008110000 (repli sans la colonne).
      (supabase.from('profiles') as any)
        .select('id, nom, email, role, employeur, direction, territoires_assignes, is_active').order('nom')
        .then(async (r: any) => (r.error && /direction/i.test(r.error.message || '')
          ? (supabase.from('profiles') as any).select('id, nom, email, role, employeur, territoires_assignes, is_active').order('nom')
          : r)),
      (supabase.from('version_installee') as any)
        .select('user_id, version_code, version_nom, vu_le').eq('plateforme', 'android'),
      // Visites récentes : seulement l'auteur et la date, pour la dernière par compte.
      fetchAllRows<{ user_id: string, date_visite: string }>((from, to) => (supabase.from('visites') as any)
        .select('user_id, date_visite').gte('date_visite', depuis)
        .order('date_visite', { ascending: false }).order('id').range(from, to)),
    ])
    for (const r of [va, profils, installees]) if (r.error) throw r.error

    versionApp.value = va.data || null
    const parUser = new Map<string, any>((installees.data || []).map((v: any) => [v.user_id, v]))
    const derniereVisite = new Map<string, string>()
    for (const v of visites) if (v.user_id && !derniereVisite.has(v.user_id)) derniereVisite.set(v.user_id, v.date_visite)

    const min = versionApp.value?.version_code_min ?? null
    const actifs = (profils.data || []).filter((p: any) => p.is_active !== false)
    comptes.value = actifs.map((p: any) => ({ nom: p.nom, email: p.email, role: p.role, direction: p.direction ?? null, employeur: p.employeur ?? null }))
    lignes.value = actifs
      .filter((p: any) => ROLES_APP_MOBILE.includes(p.role))
      .map((p: any): Ligne => {
        const v = parUser.get(p.id)
        return {
          user_id: p.id,
          nom: p.nom,
          email: p.email,
          role: p.role,
          employeur: p.employeur ?? null,
          direction: p.direction ?? null,
          version_code: v?.version_code ?? null,
          version_nom: v?.version_nom ?? null,
          vu_le: v?.vu_le ?? null,
          derniere_visite: derniereVisite.get(p.id) ?? null,
          statut: statutVersion(v?.version_code, min),
        }
      })
  }
  catch (e: any) {
    erreur.value = messageUtilisateur(e, 'Les versions installées n\'ont pas pu être chargées. Réessayez ; si le problème continue, prévenez l\'administrateur.')
  }
  finally {
    loading.value = false
  }
}

onMounted(() => { void chargerAgences(); void charger() })
</script>

<style scoped>
/* En-tête de colonne triable : bouton au clavier, même étiquette que les autres en-têtes. */
.tri-colonne {
  @apply inline-flex items-center gap-1 rounded text-left font-semibold hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:text-white;
}
</style>
