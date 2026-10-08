<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Versions de l'app"
      eyebrow="Paramètres"
      description="Qui a installé la version minimale exigée, qui est bloqué, qui tourne encore sur une ancienne version."
    >
      <template #actions>
        <UButton icon="i-heroicons-arrow-path" variant="soft" color="gray" :loading="loading" @click="charger">Actualiser</UButton>
      </template>
    </AdminPageHeader>

    <div v-if="erreur" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      {{ erreur }}
    </div>

    <!-- Version exigée -->
    <div class="admin-surface flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p class="text-xs uppercase tracking-wide text-gray-400">Version minimale exigée (Android)</p>
        <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ versionApp ? `${versionApp.version_nom_min || '?'} (code ${versionApp.version_code_min})` : '—' }}
        </p>
        <p class="text-xs text-gray-400">Modifiable dans Référentiels › Application mobile › Version minimale.</p>
      </div>
      <UButton
        v-if="versionApp?.url_telechargement"
        icon="i-heroicons-clipboard-document"
        variant="soft"
        @click="copierLien"
      >
        Copier le lien de l'APK
      </UButton>
    </div>

    <ChargementContenu v-if="loading && !lignes.length" variante="lignes" libelle="Chargement des versions…" />

    <template v-else>
      <!-- Synthèse (sur la direction, l'employeur et le rôle choisis) -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Adoption" :value="`${synthese.taux} %`" :subtitle="`${synthese.a_jour} / ${synthese.total} comptes à jour`" format="none" :icon="Smartphone" color="green" />
        <StatsCard title="À jour" :value="synthese.a_jour" :icon="CheckCircle2" color="blue" />
        <StatsCard title="Bloqués" :value="synthese.bloquee" subtitle="Écran de mise à jour affiché" :icon="Lock" color="orange" />
        <StatsCard title="Non déclarés" :value="synthese.non_declaree" subtitle="Avant 1.0.10 ou jamais ouverte" :icon="HelpCircle" color="red" />
      </div>

      <div v-if="synthese.non_declaree" class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-900/10 dark:text-blue-200">
        « Non déclarée » : l'app ne déclare sa version et n'affiche l'écran de mise à jour obligatoire que depuis la 1.0.10.
        Un téléphone en 1.0.9 ou avant n'est donc <strong>ni visible ni bloqué</strong> : il faut que la personne mette à jour
        depuis le Play Store ou le lien de l'APK. Triez par « Dernière visite » pour relancer d'abord ceux qui travaillent.
      </div>

      <!-- Filtres -->
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="recherche" icon="i-heroicons-magnifying-glass" size="sm" placeholder="Nom ou email…" aria-label="Rechercher un compte" class="w-56" />
        <USelect v-model="filtreStatut" :options="optionsStatut" size="sm" aria-label="Filtrer par statut" />
        <USelect v-model="filtreDirection" :options="optionsDirection" size="sm" aria-label="Filtrer par direction" />
        <USelect v-model="filtreEmployeur" :options="optionsEmployeur" size="sm" aria-label="Filtrer par employeur" />
        <USelect v-model="filtreRole" :options="optionsRole" size="sm" aria-label="Filtrer par rôle" />
        <span class="text-xs text-gray-400">{{ lignesFiltrees.length }} compte(s)</span>
      </div>

      <!-- Comptes -->
      <div class="admin-surface overflow-x-auto">
        <table class="admin-table">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="th-l">Compte</th>
              <th class="th-l">Rôle</th>
              <th class="th-l">Employeur</th>
              <th class="th-l">Direction</th>
              <th class="th-l">Statut</th>
              <th class="th-l">Version</th>
              <th class="th-l cursor-pointer select-none" @click="tri = 'ouverture'">Dernière ouverture {{ tri === 'ouverture' ? '↓' : '' }}</th>
              <th class="th-l cursor-pointer select-none" @click="tri = 'visite'">Dernière visite (30 j) {{ tri === 'visite' ? '↓' : '' }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="l in lignesFiltrees" :key="l.user_id" class="row">
              <td class="px-4 py-2.5 text-sm">
                <p class="font-medium text-gray-900 dark:text-gray-100">{{ l.nom || l.email }}</p>
                <p v-if="l.nom" class="text-xs text-gray-400">{{ l.email }}</p>
              </td>
              <td class="px-4 py-2.5 text-sm"><UBadge variant="soft" color="gray" size="xs">{{ l.role }}</UBadge></td>
              <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ nomAgence(l.employeur) }}</td>
              <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ libelleDirection(l.direction, true) }}</td>
              <td class="px-4 py-2.5 text-sm">
                <UBadge variant="soft" :color="couleurStatut[l.statut]" size="xs">{{ libelleCourt[l.statut] }}</UBadge>
              </td>
              <td class="px-4 py-2.5 font-mono text-sm text-gray-700 dark:text-gray-200">
                {{ l.version_code != null ? `${l.version_nom || '?'} (${l.version_code})` : '—' }}
              </td>
              <td class="px-4 py-2.5 text-sm text-gray-500">{{ formaterDate(l.vu_le) }}</td>
              <td class="px-4 py-2.5 text-sm text-gray-500">
                {{ l.derniere_visite ? `${formaterDate(l.derniere_visite)} · il y a ${joursDepuis(l.derniere_visite)} j` : '—' }}
              </td>
            </tr>
            <tr v-if="!lignesFiltrees.length">
              <td colspan="8" class="px-4 py-8 text-center text-sm text-gray-400">Aucun compte pour ces filtres.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inventaire des licences par direction et par rôle -->
      <div class="admin-surface p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Comptes par direction et par rôle</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ inventaire.total }} compte(s) actif(s), comptes de test exclus ({{ inventaire.tests }}).
              Direction : celle du compte (Paramètres › Utilisateurs), sinon déduite de ses territoires.
            </p>
          </div>
          <UButton size="sm" variant="soft" color="gray" icon="i-heroicons-arrow-down-tray" @click="exporterInventaire">Exporter les comptes</UButton>
        </div>
        <div class="mt-3 overflow-x-auto">
          <table class="admin-table">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="th-l">Direction</th>
                <th v-for="r in ROLES_INVENTAIRE" :key="r" class="th-l text-right">{{ r }}</th>
                <th class="th-l text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="l in inventaire.lignes" :key="l.direction || 'aucune'">
                <td class="px-4 py-2 text-sm font-medium">{{ l.direction ? libelleDirection(l.direction) : 'Non renseignée' }}</td>
                <td v-for="r in ROLES_INVENTAIRE" :key="r" class="px-4 py-2 text-right text-sm tabular-nums">{{ l.parRole[r] || 0 }}</td>
                <td class="px-4 py-2 text-right text-sm font-semibold tabular-nums">{{ l.total }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="inventaire.doubles.length" class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Personnes avec plusieurs comptes (comptées une fois par compte) :
          {{ inventaire.doubles.map(cs => `${cs[0].nom} (${cs.map(c => c.role).join(' + ')})`).join(' ; ') }}.
        </p>
      </div>
    </template>
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
import { describeSupabaseError } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const toast = useToast()

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
const couleurStatut: Record<StatutVersion, 'green' | 'orange' | 'red'> = { a_jour: 'green', bloquee: 'orange', non_declaree: 'red' }
const optionsStatut = [
  { label: 'Tous les statuts', value: 'tous' },
  ...(Object.keys(LIBELLES_STATUT) as StatutVersion[]).map(s => ({ label: LIBELLES_STATUT[s], value: s })),
]
const optionsEmployeur = computed(() => [{ label: 'Tous les employeurs', value: 'tous' }, ...optionsAgences.value])
const optionsDirection = [
  { label: 'Toutes les directions', value: 'tous' },
  ...DIRECTIONS.map(d => ({ label: d.label, value: d.value })),
  { label: 'Direction non renseignée', value: 'aucune' },
]
const optionsRole = [{ label: 'Tous les rôles', value: 'tous' }, ...ROLES_APP_MOBILE.map(r => ({ label: r, value: r }))]

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

function formaterDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

async function copierLien() {
  if (!versionApp.value?.url_telechargement) return
  try {
    await navigator.clipboard.writeText(versionApp.value.url_telechargement)
    toast.add({ title: 'Lien copié', description: 'À envoyer aux agents non à jour.', color: 'green' })
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
    erreur.value = describeSupabaseError(e)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => { void chargerAgences(); void charger() })
</script>
