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
      <!-- Synthèse -->
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
              <td class="px-4 py-2.5 text-sm capitalize text-gray-600 dark:text-gray-300">{{ l.employeur || '—' }}</td>
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
              <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-400">Aucun compte pour ces filtres.</td>
            </tr>
          </tbody>
        </table>
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
import { LIBELLES_STATUT, ROLES_APP_MOBILE, joursDepuis, statutVersion, syntheseAdoption, type StatutVersion } from '~/utils/adoptionApp'
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
const filtreRole = ref('tous')
const tri = ref<'visite' | 'ouverture'>('visite')

const libelleCourt: Record<StatutVersion, string> = { a_jour: 'À jour', bloquee: 'Bloquée', non_declaree: 'Non déclarée' }
const couleurStatut: Record<StatutVersion, 'green' | 'orange' | 'red'> = { a_jour: 'green', bloquee: 'orange', non_declaree: 'red' }
const optionsStatut = [
  { label: 'Tous les statuts', value: 'tous' },
  ...(Object.keys(LIBELLES_STATUT) as StatutVersion[]).map(s => ({ label: LIBELLES_STATUT[s], value: s })),
]
const optionsEmployeur = [
  { label: 'Tous les employeurs', value: 'tous' },
  { label: 'Friesland', value: 'friesland' },
  { label: 'Atom', value: 'atom' },
]
const optionsRole = [{ label: 'Tous les rôles', value: 'tous' }, ...ROLES_APP_MOBILE.map(r => ({ label: r, value: r }))]

const synthese = computed(() => syntheseAdoption(lignes.value))

const lignesFiltrees = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  const cle = tri.value === 'visite' ? 'derniere_visite' : 'vu_le'
  return lignes.value
    .filter(l => filtreStatut.value === 'tous' || l.statut === filtreStatut.value)
    .filter(l => filtreEmployeur.value === 'tous' || l.employeur === filtreEmployeur.value)
    .filter(l => filtreRole.value === 'tous' || l.role === filtreRole.value)
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
      (supabase.from('profiles') as any)
        .select('id, nom, email, role, employeur, is_active').in('role', ROLES_APP_MOBILE as string[]).order('nom'),
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
    lignes.value = (profils.data || [])
      .filter((p: any) => p.is_active !== false)
      .map((p: any): Ligne => {
        const v = parUser.get(p.id)
        return {
          user_id: p.id,
          nom: p.nom,
          email: p.email,
          role: p.role,
          employeur: p.employeur ?? null,
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

onMounted(charger)
</script>
