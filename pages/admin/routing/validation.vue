<template>
  <div class="space-y-6">
    <AdminPageHeader>
      <template #description>
        <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Les boutiques d'un jour sont celles du distributeur dans le quartier du point de visite ; s'il en manque, le même distributeur dans le quartier voisin le plus proche.
        </p>
      </template>
      <template #actions>
        <USelect
          v-if="campagnes.length"
          v-model="campagneId"
          :options="campagnes.map(c => ({ value: c.id, label: `${c.libelle}${c.statut === 'fermee' ? ' (fermée)' : ''}` }))"
          size="sm" class="w-56" aria-label="Mois de validation"
        />
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-path" :loading="chargement" @click="charger">Actualiser</UButton>
      </template>
    </AdminPageHeader>

    <AdminErreurBloc v-if="erreur" titre="L'action sur la validation des tournées n'a pas abouti." :erreur="erreur" />

    <!-- Ouvrir un mois -->
    <section class="admin-surface flex flex-wrap items-end gap-3 p-4">
      <div class="space-y-1">
        <label for="mois-nouveau" class="text-sm font-medium text-slate-700 dark:text-slate-200">Ouvrir la validation d'un mois</label>
        <UInput id="mois-nouveau" v-model="moisNouveau" type="month" size="sm" class="w-44" />
      </div>
      <UButton size="sm" color="primary" icon="i-heroicons-plus" :loading="creation" :disabled="!moisNouveau" @click="ouvrirCampagne">
        Ouvrir la validation
      </UButton>
      <p class="text-xs text-slate-600 dark:text-slate-300">
        Un code à 4 chiffres est créé pour chaque merchandiser Atom actif. Un mois déjà ouvert ajoute seulement les merchandisers manquants.
      </p>
    </section>

    <template v-if="campagne">
      <!-- Lien public -->
      <section class="admin-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Lien à envoyer aux merchandisers</p>
          <p class="truncate text-sm text-slate-900 dark:text-white">{{ lienPublic }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton size="sm" variant="outline" icon="i-heroicons-clipboard-document" @click="copier(lienPublic, 'Lien copié')">Copier le lien</UButton>
          <UButton size="sm" variant="outline" icon="i-heroicons-chat-bubble-left-right" @click="copier(tousLesMessages, 'Les messages sont copiés')">Copier tous les messages</UButton>
          <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exporterReponses">Exporter les réponses (CSV)</UButton>
          <UButton v-if="campagne.statut === 'ouverte'" size="sm" variant="ghost" color="gray" @click="basculerCampagne('fermee')">Fermer ce mois</UButton>
          <UButton v-else size="sm" variant="ghost" color="gray" @click="basculerCampagne('ouverte')">Rouvrir ce mois</UButton>
        </div>
      </section>

      <!-- Indicateurs -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div v-for="k in indicateurs" :key="k.libelle" class="admin-surface p-4">
          <p class="text-sm font-medium text-slate-600 dark:text-slate-300">{{ k.libelle }}</p>
          <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ k.valeur }}</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ k.detail }}</p>
        </div>
      </div>

      <!-- Tableau des merchandisers -->
      <section class="admin-surface overflow-x-auto">
        <table class="admin-table w-full">
          <thead>
            <tr>
              <th>Merchandiser</th>
              <th>Fiche</th>
              <th class="text-right">Jours traités</th>
              <th class="text-right">Jours à corriger</th>
              <th class="text-right">Boutiques signalées</th>
              <th class="text-right">Zones non couvertes</th>
              <th class="text-right">Visites prévues</th>
              <th>Dernière activité</th>
              <th>Code</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!lignes.length">
              <td colspan="10" class="py-8 text-center text-slate-600">
                Aucun merchandiser dans ce mois. Ouvrez la validation ci-dessus.
              </td>
            </tr>
            <tr v-for="l in lignes" :key="l.id" :class="selection === l.id ? 'bg-slate-50 dark:bg-slate-800' : ''">
              <td class="font-medium text-slate-900 dark:text-white">{{ l.nom }}</td>
              <td><UBadge :color="statut(l.statut).couleur" variant="subtle" size="xs">{{ statut(l.statut).texte }}</UBadge></td>
              <td class="text-right tabular-nums">{{ l.joursTraites }} / {{ l.joursTotal }}</td>
              <td class="text-right tabular-nums" :class="l.joursACorriger ? 'font-semibold text-amber-700' : ''">{{ l.joursACorriger }}</td>
              <td class="text-right tabular-nums">{{ l.pdvSignales }}</td>
              <td class="text-right tabular-nums" :class="l.zonesNon ? 'font-semibold text-amber-700' : ''">{{ l.zonesNon }}</td>
              <td class="text-right tabular-nums">
                <template v-if="l.plan">
                  <span :class="l.plan.total < l.plan.besoin ? 'font-semibold text-amber-700' : ''">{{ l.plan.total }} / {{ l.plan.besoin }}</span>
                  <span class="block text-xs text-slate-500">{{ l.plan.voisins }} du quartier voisin</span>
                </template>
                <span v-else class="text-slate-400">…</span>
              </td>
              <td class="whitespace-nowrap text-sm">{{ l.derniereActivite ? dateCourte(l.derniereActivite) : '—' }}</td>
              <td>
                <span class="font-semibold tabular-nums tracking-wider">{{ l.code }}</span>
                <UButton size="xs" variant="ghost" color="gray" class="ml-1" :aria-label="`Nouveau code pour ${l.nom}`" @click="nouveauCode(l)">Nouveau</UButton>
              </td>
              <td class="whitespace-nowrap text-right">
                <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chat-bubble-oval-left" :to="lienWhatsApp(l)" target="_blank" :aria-label="`Envoyer le message à ${l.nom} sur WhatsApp`">WhatsApp</UButton>
                <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-clipboard-document" :aria-label="`Copier le message de ${l.nom}`" @click="copier(message(l), `Message de ${l.nom} copié`)">Copier</UButton>
                <UButton size="xs" variant="ghost" color="gray" :aria-expanded="selection === l.id" @click="selection = selection === l.id ? null : l.id">
                  {{ selection === l.id ? 'Fermer' : 'Détail' }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Détail -->
      <section v-if="detail" class="admin-surface space-y-4 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ detail.nom }}</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              <template v-if="detail.statut === 'validee'">Validée le {{ dateCourte(detail.valideLe) }}, signée « {{ detail.nomSaisi }} ».</template>
              <template v-else>Fiche {{ statut(detail.statut).texte.toLowerCase() }}.</template>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Partie de la fiche">
              <button
                v-for="o in ONGLETS" :key="o.id" type="button" :aria-pressed="onglet === o.id"
                class="rounded px-3 py-1 text-xs font-medium transition-colors"
                :class="onglet === o.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
                @click="onglet = o.id"
              >
                {{ o.texte }}
              </button>
            </div>
            <UButton v-if="detail.statut === 'validee'" size="sm" variant="outline" @click="rouvrirFiche(detail)">Rouvrir la fiche</UButton>
          </div>
        </div>

        <p v-if="detail.remarque" class="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800"><b>Remarque :</b> {{ detail.remarque }}</p>

        <!-- Jours -->
        <div v-if="onglet === 'jours'" class="overflow-x-auto">
          <table class="admin-table w-full">
            <thead>
              <tr><th>Semaine</th><th>Jour</th><th>Point de visite</th><th class="text-right">Boutiques prévues</th><th>Réponse</th><th>Commentaire</th><th>Traité</th></tr>
            </thead>
            <tbody>
              <tr v-for="j in detail.jours" :key="j.id">
                <td class="tabular-nums">{{ j.semaine }}</td>
                <td>{{ JOURS[j.jour] }}</td>
                <td class="font-medium text-slate-900 dark:text-white">{{ j.pointVisite }}</td>
                <td class="text-right tabular-nums">
                  {{ j.prevues }}<span v-if="j.voisins" class="block text-xs text-slate-500">dont {{ j.voisins }} du quartier voisin</span>
                </td>
                <td>
                  <UBadge v-if="j.reponse" :color="decision(j.reponse.decision).couleur" variant="subtle" size="xs">{{ decision(j.reponse.decision).texte }}</UBadge>
                  <span v-else class="text-sm text-slate-400">Sans réponse</span>
                </td>
                <td class="max-w-xs text-sm">{{ j.reponse?.commentaire || '' }}</td>
                <td>
                  <UCheckbox
                    v-if="j.reponse && j.reponse.decision !== 'ok'"
                    :model-value="j.reponse.traite" :aria-label="`Correction traitée : ${JOURS[j.jour]} semaine ${j.semaine}`"
                    @update:model-value="v => marquerTraite('validation_tournee_reponse', j.reponse.id, v)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Pour corriger un jour : Paramètres › Référentiels, onglet Routing mensuel.
          </p>
        </div>

        <!-- Boutiques signalées -->
        <div v-else-if="onglet === 'pdv'" class="overflow-x-auto">
          <table class="admin-table w-full">
            <thead><tr><th>Boutique</th><th>Signalement</th><th>Commentaire</th><th>Traité</th></tr></thead>
            <tbody>
              <tr v-if="!detail.retours.length"><td colspan="4" class="py-6 text-center text-slate-600">Aucune boutique signalée.</td></tr>
              <tr v-for="r in detail.retours" :key="r.id">
                <td class="font-medium text-slate-900 dark:text-white">{{ r.nom }}</td>
                <td>{{ MOTIFS[r.motif] }}</td>
                <td class="text-sm">{{ r.commentaire || '' }}</td>
                <td><UCheckbox :model-value="r.traite" :aria-label="`Signalement traité : ${r.nom}`" @update:model-value="v => marquerTraite('validation_tournee_pdv_retour', r.id, v)" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Zones -->
        <div v-else-if="onglet === 'zones'" class="grid gap-4 lg:grid-cols-2">
          <div v-for="bloc in detail.zones" :key="bloc.titre" class="space-y-2">
            <h3 class="text-sm font-semibold text-slate-900 dark:text-white">{{ bloc.titre }}</h3>
            <p v-if="!bloc.lignes.length" class="text-sm text-slate-600">Rien d'enregistré.</p>
            <ul class="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              <li v-for="z in bloc.lignes" :key="z.libelle" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>{{ z.libelle }}</span>
                <UBadge :color="z.decision === 'non' ? 'amber' : z.decision === 'oui' ? 'green' : 'gray'" variant="subtle" size="xs">
                  {{ z.decision === 'non' ? 'Ne couvre pas' : z.decision === 'oui' ? 'Couvre' : 'Sans réponse' }}
                </UBadge>
              </li>
            </ul>
          </div>
          <p v-if="detail.zonesRemarque" class="rounded-md bg-slate-50 p-3 text-sm lg:col-span-2 dark:bg-slate-800">
            <b>Zones à ajouter selon le merchandiser :</b> {{ detail.zonesRemarque }}
          </p>
        </div>

        <!-- Message -->
        <div v-else-if="onglet === 'message'" class="space-y-2">
          <UTextarea :model-value="message(detail)" :rows="12" readonly aria-label="Message à envoyer" />
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" color="primary" icon="i-heroicons-chat-bubble-oval-left" :to="lienWhatsApp(detail)" target="_blank">Envoyer sur WhatsApp</UButton>
            <UButton size="sm" variant="outline" icon="i-heroicons-clipboard-document" @click="copier(message(detail), 'Message copié')">Copier le message</UButton>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300">
            {{ detail.telephone ? `WhatsApp s'ouvre sur le ${detail.telephone}.` : 'Pas de téléphone enregistré : WhatsApp vous demandera à qui envoyer.' }}
          </p>
        </div>
      </section>

      <!-- Boutiques hors tournée -->
      <section class="admin-surface space-y-3 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">Boutiques Atom hors tournée</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">Ces boutiques n'entrent dans aucun jour : à corriger dans la fiche du point de vente ou avec Atom.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Raison">
              <button
                v-for="r in RAISONS" :key="r.id" type="button" :aria-pressed="raison === r.id"
                class="rounded px-3 py-1 text-xs font-medium transition-colors"
                :class="raison === r.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
                @click="raison = r.id"
              >
                {{ r.texte }} ({{ horsTournee.filter(x => x.raison === r.id).length }})
              </button>
            </div>
            <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!horsTournee.length" @click="exporterHorsTournee">Exporter (CSV)</UButton>
          </div>
        </div>
        <p v-if="chargementHors" class="text-sm text-slate-600" role="status">Chargement des boutiques hors tournée…</p>
        <div v-else class="overflow-x-auto">
          <table class="admin-table w-full">
            <thead><tr><th>Boutique</th><th>Distributeur</th><th>Quartier le plus proche</th><th class="text-right">Distance au point</th></tr></thead>
            <tbody>
              <tr v-if="!horsFiltre.length"><td colspan="4" class="py-6 text-center text-slate-600">Aucune boutique dans ce cas.</td></tr>
              <tr v-for="b in horsFiltre.slice(0, 100)" :key="b.pdv_id">
                <td class="font-medium text-slate-900 dark:text-white">{{ b.nom_pdv }}</td>
                <td>{{ b.distributeur || 'Inconnu' }}</td>
                <td>{{ b.point_visite ? `${b.point_visite} (${b.merchandiser})` : '—' }}</td>
                <td class="text-right tabular-nums">{{ b.distance_point_m != null ? `${b.distance_point_m} m` : '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="horsFiltre.length > 100" class="mt-2 text-xs text-slate-600">100 premières sur {{ horsFiltre.length }} : la liste complète est dans l'export.</p>
        </div>
      </section>

      <section class="admin-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <p class="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Les quartiers sont recalculés tout seuls quand le routing ou la position d'une boutique change.
          Relancez le calcul après un import fait en dehors de l'app.
        </p>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-path" :loading="recalcul" @click="recalculer">Recalculer les quartiers</UButton>
      </section>
    </template>

    <AdminConfirmation v-bind="confirmation" @confirmer="confirmer" @annuler="annuler" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const toast = useToast()
const { confirmation, demanderConfirmation, confirmer, annuler } = useConfirmation()

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MOTIFS: Record<string, string> = { pas_ma_tournee: 'Pas dans sa tournée', position_fausse: 'Position fausse', ferme: 'Fermé' }
const ONGLETS = [
  { id: 'jours', texte: 'Jours' },
  { id: 'pdv', texte: 'Boutiques signalées' },
  { id: 'zones', texte: 'Zones et secteurs' },
  { id: 'message', texte: 'Message' },
]

const RAISONS = [
  { id: 'autre_distributeur', texte: 'Autre distributeur' },
  { id: 'sans_distributeur', texte: 'Sans distributeur' },
  { id: 'sans_gps', texte: 'Sans GPS' },
]
const horsTournee = ref<any[]>([])
const chargementHors = ref(false)
const raison = ref('autre_distributeur')
const horsFiltre = computed(() => horsTournee.value.filter(x => x.raison === raison.value))
const chargement = ref(false)
const creation = ref(false)
const recalcul = ref(false)
const erreur = ref('')
const campagnes = ref<any[]>([])
const campagneId = ref<string>('')
const fiches = ref<any[]>([])
const reponses = ref<any[]>([])
const retours = ref<any[]>([])
const zones = ref<any[]>([])
const routing = ref<any[]>([])
const profils = ref<any[]>([])
const plans = ref<Record<string, any[]>>({})
const selection = ref<string | null>(null)
const onglet = ref('jours')
const moisNouveau = ref(prochainMois())

function prochainMois() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const libelleMois = (mois: string) => {
  const t = new Date(`${mois.slice(0, 7)}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const dateCourte = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const statut = (s: string) => s === 'validee' ? { texte: 'Validée', couleur: 'green' } : s === 'en_cours' ? { texte: 'En cours', couleur: 'amber' } : { texte: 'À faire', couleur: 'gray' }
const decision = (d: string) => d === 'ok' ? { texte: 'OK', couleur: 'green' } : d === 'modifier' ? { texte: 'À modifier', couleur: 'amber' } : { texte: 'À retirer', couleur: 'red' }
const nouveauCodeAleatoire = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0')

const campagne = computed(() => campagnes.value.find(c => c.id === campagneId.value) || null)
const lienPublic = computed(() => (import.meta.client ? window.location.origin : '') + '/validation-tournee')

async function chargerCampagnes() {
  const { data, error } = await supabase.from('validation_tournee_campagne').select('id, mois, libelle, statut').order('mois', { ascending: false })
  if (error) throw error
  campagnes.value = data || []
  if (!campagneId.value || !campagnes.value.some(c => c.id === campagneId.value)) campagneId.value = campagnes.value[0]?.id || ''
}

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    await chargerCampagnes()
    if (!campagneId.value) { fiches.value = []; return }
    const { data: f, error } = await supabase.from('validation_tournee_merch')
      .select('id, merchandiser_id, code, lien_jeton, statut, nom_saisi, remarque, zones_remarque, valide_le, derniere_activite')
      .eq('campagne_id', campagneId.value)
    if (error) throw error
    fiches.value = f || []
    const ids = fiches.value.map(x => x.id)
    const merchs = fiches.value.map(x => x.merchandiser_id)
    const vide = ['00000000-0000-0000-0000-000000000000']
    const [r, p, z, rm, pr] = await Promise.all([
      supabase.from('validation_tournee_reponse').select('id, validation_merch_id, routing_mensuel_id, decision, commentaire, traite').in('validation_merch_id', ids.length ? ids : vide),
      supabase.from('validation_tournee_pdv_retour').select('id, validation_merch_id, pdv_id, motif, commentaire, traite, pdv:pdv(nom_pdv)').in('validation_merch_id', ids.length ? ids : vide),
      supabase.from('validation_tournee_zone').select('validation_merch_id, type, libelle, decision').in('validation_merch_id', ids.length ? ids : vide),
      supabase.from('routing_mensuel').select('id, merchandiser_id, jour_semaine, semaine_du_mois, point_visite, secteur').eq('actif', true).in('merchandiser_id', merchs.length ? merchs : vide).order('semaine_du_mois').order('jour_semaine'),
      supabase.from('profiles').select('id, nom, telephone, zone_assignee, territoires_assignes, quartiers_assignes').in('id', merchs.length ? merchs : vide),
    ])
    for (const x of [r, p, z, rm, pr]) if (x.error) throw x.error
    reponses.value = r.data || []
    retours.value = p.data || []
    zones.value = z.data || []
    routing.value = rm.data || []
    profils.value = pr.data || []
    chargerPlans(merchs)
  }
  catch (e) { erreur.value = messageUtilisateur(e) }
  finally { chargement.value = false }
}

// Plan du mois (règle des quartiers) : un appel par merchandiser, en tâche de fond.
async function chargerPlans(merchs: string[]) {
  plans.value = {}
  for (const m of merchs) {
    const { data, error } = await supabase.rpc('plan_mensuel_atom', { p_user: m })
    if (!error) plans.value = { ...plans.value, [m]: data || [] }
  }
}

const besoinMois = (merch: string) => routing.value.filter(l => l.merchandiser_id === merch)
  .reduce((s, l) => s + ({ 1: 20, 2: 20, 3: 20, 4: 20, 5: 15, 6: 10 } as Record<number, number>)[l.jour_semaine] || 0, 0)

const lignes = computed(() => fiches.value.map((f) => {
  const prof = profils.value.find(p => p.id === f.merchandiser_id)
  const jours = routing.value.filter(l => l.merchandiser_id === f.merchandiser_id)
  const rep = reponses.value.filter(x => x.validation_merch_id === f.id)
  const plan = plans.value[f.merchandiser_id]
  return {
    id: f.id,
    merchandiserId: f.merchandiser_id,
    nom: prof?.nom || '—',
    code: f.code,
    lien: f.lien_jeton,
    telephone: prof?.telephone || '',
    statut: f.statut,
    derniereActivite: f.derniere_activite,
    joursTotal: jours.length,
    joursTraites: rep.length,
    joursACorriger: rep.filter(x => x.decision !== 'ok').length,
    pdvSignales: retours.value.filter(x => x.validation_merch_id === f.id).length,
    zonesNon: zones.value.filter(x => x.validation_merch_id === f.id && x.decision === 'non').length,
    plan: plan ? { total: plan.length, besoin: besoinMois(f.merchandiser_id), voisins: plan.filter((x: any) => x.quartier_voisin).length } : null,
  }
}).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))

const indicateurs = computed(() => {
  const n = (s: string) => lignes.value.filter(l => l.statut === s).length
  return [
    { libelle: 'Fiches validées', valeur: n('validee'), detail: `sur ${lignes.value.length} merchandisers` },
    { libelle: 'En cours', valeur: n('en_cours'), detail: 'ont commencé sans valider' },
    { libelle: 'À faire', valeur: n('a_faire'), detail: 'pas encore ouvert le lien' },
    { libelle: 'Corrections demandées', valeur: lignes.value.reduce((s, l) => s + l.joursACorriger, 0), detail: `${lignes.value.reduce((s, l) => s + l.pdvSignales, 0)} boutiques signalées` },
  ]
})

const detail = computed(() => {
  const f = fiches.value.find(x => x.id === selection.value)
  if (!f) return null
  const prof = profils.value.find(p => p.id === f.merchandiser_id) || {}
  const plan = plans.value[f.merchandiser_id] || []
  const rep = reponses.value.filter(x => x.validation_merch_id === f.id)
  const zs = zones.value.filter(x => x.validation_merch_id === f.id)
  const reponseZone = (type: string, libelle: string) => zs.find(z => z.type === type && z.libelle === libelle)?.decision || null
  const uniques = (l: any[]) => [...new Map(l.filter(Boolean).map((x: string) => [x.toUpperCase(), x])).values()]
  const lignesRouting = routing.value.filter(l => l.merchandiser_id === f.merchandiser_id)
  return {
    id: f.id,
    nom: (prof as any).nom || '—',
    code: f.code,
    lien: f.lien_jeton,
    telephone: (prof as any).telephone || '',
    statut: f.statut,
    valideLe: f.valide_le,
    nomSaisi: f.nom_saisi,
    remarque: f.remarque,
    zonesRemarque: f.zones_remarque,
    jours: lignesRouting.map(l => ({
      id: l.id, semaine: l.semaine_du_mois, jour: l.jour_semaine, pointVisite: l.point_visite,
      prevues: plan.filter((x: any) => x.ligne_id === l.id).length,
      voisins: plan.filter((x: any) => x.ligne_id === l.id && x.quartier_voisin).length,
      reponse: rep.find(x => x.routing_mensuel_id === l.id) || null,
    })),
    retours: retours.value.filter(x => x.validation_merch_id === f.id).map(x => ({ ...x, nom: x.pdv?.nom_pdv || 'Boutique' })),
    zones: [
      { titre: 'Secteur Atom', lignes: uniques(lignesRouting.map(l => l.secteur)).map(s => ({ libelle: s, decision: reponseZone('secteur_atom', s) })) },
      { titre: 'Territoires Friesland', lignes: uniques([(prof as any).zone_assignee, ...((prof as any).territoires_assignes || [])]).map(t => ({ libelle: t, decision: reponseZone('territoire_friesland', t) })) },
      { titre: 'Quartiers Friesland qu\'il ne couvre pas', lignes: zs.filter(z => z.type === 'quartier_friesland' && z.decision === 'non').map(z => ({ libelle: z.libelle, decision: 'non' })) },
    ],
  }
})

const lienPersonnel = (l: { lien?: string }) => `${lienPublic.value}?t=${l.lien || ''}`

function message(l: { nom: string; code: string; lien?: string }) {
  const mois = campagne.value?.libelle || ''
  return `Bonjour ${l.nom},

L'équipe Friesland vous demande de vérifier votre tournée de ${mois} : vos zones et secteurs, votre point de visite pour chaque jour, et les boutiques prévues.

Touchez votre lien personnel (ne le transférez à personne) :
${lienPersonnel(l)}

Activez la localisation du téléphone pour voir à quelle distance sont les boutiques.
Pour chaque jour, répondez OK, Modifier ou Retirer, puis validez à la fin. Comptez environ 15 minutes.

Si le lien ne s'ouvre pas : allez sur ${lienPublic.value}, touchez votre nom et tapez le code ${l.code}.

Merci.`
}

// WhatsApp : le numéro du compte s'il est connu (format international sans +),
// sinon WhatsApp demande à qui envoyer.
function lienWhatsApp(l: { nom: string; code: string; lien?: string; telephone?: string }) {
  const numero = String(l.telephone || '').replace(/\D/g, '')
  return `https://wa.me/${numero}?text=${encodeURIComponent(message(l))}`
}
const tousLesMessages = computed(() => lignes.value.map(l => message(l)).join('\n\n----------\n\n'))

async function copier(texte: string, ok: string) {
  try {
    await navigator.clipboard.writeText(texte)
    toast.add({ title: ok, color: 'green' })
  }
  catch {
    toast.add({ title: 'Copie impossible', description: 'Sélectionnez le texte et copiez-le à la main.', color: 'amber' })
  }
}

async function ouvrirCampagne() {
  creation.value = true
  erreur.value = ''
  try {
    const mois = `${moisNouveau.value}-01`
    let { data: c, error } = await supabase.from('validation_tournee_campagne').select('id').eq('mois', mois).maybeSingle()
    if (error) throw error
    if (!c) {
      const res = await supabase.from('validation_tournee_campagne').insert({ mois, libelle: libelleMois(mois), statut: 'ouverte' }).select('id').single()
      if (res.error) throw res.error
      c = res.data
    }
    const { data: merchs, error: e2 } = await supabase.from('profiles').select('id').eq('employeur', 'atom').eq('role', 'merchandiser').eq('is_active', true)
    if (e2) throw e2
    const { data: lignesRouting, error: e3 } = await supabase.from('routing_mensuel').select('merchandiser_id').eq('actif', true).in('merchandiser_id', (merchs || []).map(m => m.id))
    if (e3) throw e3
    const avecRouting = new Set((lignesRouting || []).map(l => l.merchandiser_id))
    const { data: deja } = await supabase.from('validation_tournee_merch').select('merchandiser_id').eq('campagne_id', c!.id)
    const presents = new Set((deja || []).map(d => d.merchandiser_id))
    const nouvelles = (merchs || []).filter(m => avecRouting.has(m.id) && !presents.has(m.id))
      .map(m => ({ campagne_id: c!.id, merchandiser_id: m.id, code: nouveauCodeAleatoire() }))
    if (nouvelles.length) {
      const { error: e4 } = await supabase.from('validation_tournee_merch').insert(nouvelles)
      if (e4) throw e4
    }
    campagneId.value = c!.id
    toast.add({ title: `Validation de ${libelleMois(mois)} ouverte`, description: `${nouvelles.length} merchandiser${nouvelles.length > 1 ? 's' : ''} ajouté${nouvelles.length > 1 ? 's' : ''}.`, color: 'green' })
    await charger()
  }
  catch (e) { erreur.value = messageUtilisateur(e) }
  finally { creation.value = false }
}

async function basculerCampagne(nouveau: 'ouverte' | 'fermee') {
  if (!campagne.value) return
  if (nouveau === 'fermee' && !(await demanderConfirmation({
    titre: `Fermer la validation de « ${campagne.value.libelle} » ?`,
    message: 'Les merchandisers ne pourront plus ouvrir leur fiche avec le lien. Les réponses déjà données restent visibles ici.',
    libelleAction: 'Fermer la validation',
    destructif: false,
  }))) return
  const { error } = await supabase.from('validation_tournee_campagne').update({ statut: nouveau }).eq('id', campagne.value.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  await charger()
}

async function nouveauCode(l: { id: string; nom: string }) {
  if (!(await demanderConfirmation({
    titre: `Donner un nouveau code à « ${l.nom} » ?`,
    message: 'L\'ancien code et l\'ancien lien ne marcheront plus. Pensez à lui envoyer le nouveau message.',
    libelleAction: 'Donner un nouveau code',
    destructif: false,
  }))) return
  const lien = Array.from(crypto.getRandomValues(new Uint8Array(16)), o => o.toString(16).padStart(2, '0')).join('')
  const { error } = await supabase.from('validation_tournee_merch').update({ code: nouveauCodeAleatoire(), lien_jeton: lien, essais_rates: 0, bloque_jusqua: null }).eq('id', l.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  await charger()
}

async function rouvrirFiche(d: { id: string; nom: string }) {
  if (!(await demanderConfirmation({
    titre: `Rouvrir la fiche de « ${d.nom} » ?`,
    message: 'Il pourra de nouveau changer ses réponses avec son code, puis valider une seconde fois.',
    libelleAction: 'Rouvrir la fiche',
    destructif: false,
  }))) return
  const { error } = await supabase.from('validation_tournee_merch').update({ statut: 'en_cours', valide_le: null }).eq('id', d.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  await charger()
}

async function marquerTraite(table: string, id: string, traite: boolean) {
  const { error } = await supabase.from(table).update({ traite }).eq('id', id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  const liste = table === 'validation_tournee_reponse' ? reponses : retours
  liste.value = liste.value.map((x: any) => x.id === id ? { ...x, traite } : x)
}

async function recalculer() {
  recalcul.value = true
  try {
    const r: any = await $fetch('/api/admin/validation-tournee/recalculer', { method: 'POST' })
    toast.add({ title: 'Quartiers recalculés', description: `${r.pdv} boutiques rangées.`, color: 'green' })
    await Promise.all([charger(), chargerHorsTournee()])
  }
  catch (e) { erreur.value = messageUtilisateur(e) }
  finally { recalcul.value = false }
}

async function chargerHorsTournee() {
  chargementHors.value = true
  const { data, error } = await (supabase.rpc as any)('atom_pdv_hors_tournee')
  if (error) erreur.value = messageUtilisateur(error)
  else horsTournee.value = data || []
  chargementHors.value = false
}

function telechargerCsv(nom: string, entete: string[], lignesCsv: any[][]) {
  const champ = (v: unknown) => `"${String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`
  const texte = '\uFEFF' + [entete, ...lignesCsv].map(l => l.map(champ).join(';')).join('\n')
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(new Blob([texte], { type: 'text/csv;charset=utf-8' }))
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(lien.href)
}

function exporterHorsTournee() {
  const raisonTexte = (r: string) => RAISONS.find(x => x.id === r)?.texte || r
  telechargerCsv('boutiques-atom-hors-tournee.csv',
    ['Boutique', 'Raison', 'Distributeur', 'Quartier le plus proche', 'Merchandiser du quartier', 'Distance au point (m)', 'Latitude', 'Longitude'],
    horsTournee.value.map(b => [b.nom_pdv, raisonTexte(b.raison), b.distributeur, b.point_visite, b.merchandiser, b.distance_point_m, b.latitude, b.longitude]))
}

function exporterReponses() {
  const lignesCsv: any[][] = []
  for (const l of lignes.value) {
    for (const j of routing.value.filter(r => r.merchandiser_id === l.merchandiserId)) {
      const r = reponses.value.find(x => x.validation_merch_id === l.id && x.routing_mensuel_id === j.id)
      lignesCsv.push([l.nom, statut(l.statut).texte, j.semaine_du_mois, JOURS[j.jour_semaine], j.point_visite, r ? decision(r.decision).texte : 'Sans réponse', r?.commentaire || '', r?.traite ? 'oui' : ''])
    }
  }
  telechargerCsv(`validation-tournees-${campagne.value?.mois?.slice(0, 7) || 'mois'}.csv`,
    ['Merchandiser', 'Fiche', 'Semaine', 'Jour', 'Point de visite', 'Réponse', 'Commentaire', 'Traité'], lignesCsv)
}

watch(campagneId, (v, avant) => { if (avant && v !== avant) { selection.value = null; charger() } })
onMounted(() => { charger(); chargerHorsTournee() })
</script>
