<template>
  <div class="min-h-dvh bg-gray-50 text-slate-700 safe-area-top">
    <header class="sticky top-0 z-40 flex min-h-[56px] items-center gap-2 bg-fc-red px-4 py-2.5 text-white shadow-sm">
      <button
        v-if="etape === 'jours' || etape === 'valider'"
        type="button"
        class="touch-target -ml-2 inline-flex items-center justify-center rounded-xl hover:bg-white/10"
        aria-label="Revenir à l'écran précédent"
        @click="retour"
      >
        <UIcon name="i-heroicons-chevron-left" class="h-6 w-6" />
      </button>
      <img src="~/assets/logo.png" alt="" class="h-7 w-7 rounded bg-white/90 object-contain p-0.5">
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-base font-semibold leading-tight">Validation de ma tournée</h1>
        <p v-if="donnees && etape !== 'fini'" class="truncate text-xs text-white/80">{{ donnees.merchandiser }} · {{ campagne?.libelle }}</p>
        <p v-else-if="campagne" class="truncate text-xs text-white/80">{{ campagne.libelle }}</p>
      </div>
      <button
        v-if="donnees && etape !== 'fini'"
        type="button"
        class="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-white/90 underline underline-offset-2 hover:bg-white/10"
        @click="deconnecter"
      >
        Ce n'est pas moi
      </button>
    </header>

    <main class="w-full px-4 pb-32 pt-4 sm:px-6">
      <!-- Erreur générale -->
      <div v-if="erreur" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {{ erreur }}
      </div>

      <!-- Sans lien personnel -->
      <section v-if="etape === 'accueil'" class="space-y-4 pt-6 text-center">
        <p v-if="chargement" class="text-sm text-slate-500" role="status">Ouverture de votre fiche…</p>
        <template v-else>
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <UIcon name="i-heroicons-link" class="h-7 w-7 text-slate-500" />
          </div>
          <h2 class="text-lg font-semibold text-slate-900">Ouvrez votre lien personnel</h2>
          <p class="text-sm text-slate-600">
            Touchez le lien à votre nom reçu sur WhatsApp. Il ouvre directement votre fiche.
          </p>
          <p v-if="!campagne" class="text-sm text-slate-500">Aucune validation n'est ouverte pour le moment.</p>
        </template>
      </section>

      <!-- 3. Zones et secteurs -->
      <section v-else-if="etape === 'zones' && donnees" class="space-y-6">
        <Etapes :actuelle="1" />
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Mes zones et secteurs</h2>
          <p class="mt-1 text-sm text-slate-500">
            Atom et Friesland ne découpent pas les zones de la même façon. Dites-nous ce que vous couvrez vraiment.
          </p>
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-slate-900">Mon secteur chez Atom</h3>
          <LigneZone
            v-for="s in donnees.zones.secteursAtom" :key="`a-${s}`"
            :libelle="s" :detail="donnees.zones.communesAtom.length ? `Communes : ${donnees.zones.communesAtom.join(', ')}` : ''"
            :decision="zone('secteur_atom', s)" @choisir="d => repondreZone('secteur_atom', s, d)"
          />
          <p v-if="!donnees.zones.secteursAtom.length" class="text-sm text-slate-500">Aucun secteur Atom enregistré.</p>
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-slate-900">Mes territoires chez Friesland</h3>
          <LigneZone
            v-for="t in donnees.zones.territoiresFriesland" :key="`f-${t}`"
            :libelle="t" :decision="zone('territoire_friesland', t)" @choisir="d => repondreZone('territoire_friesland', t, d)"
          />
          <p v-if="!donnees.zones.territoiresFriesland.length" class="text-sm text-slate-500">Aucun territoire Friesland enregistré.</p>
        </div>

        <!-- Ce que je couvre vraiment : même choix que dans l'admin -->
        <div v-if="zonesNon || choixOuvert" class="space-y-4 rounded-lg bg-white p-4 ring-1 ring-amber-300">
          <div>
            <h3 class="text-base font-semibold text-slate-900">Ce que je couvre vraiment</h3>
            <p class="mt-1 text-sm text-slate-600">
              Cochez vos secteurs, vos territoires, puis vos quartiers. C'est une proposition : l'équipe la vérifie avant de changer quoi que ce soit.
            </p>
          </div>

          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold text-slate-900">Secteurs Atom</legend>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="s in donnees.referentiel.secteursAtom" :key="`sa-${s}`" type="button"
                class="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition"
                :class="choix.secteursAtom.includes(s) ? 'bg-emerald-50 text-emerald-800 ring-emerald-400' : 'bg-white text-slate-600 ring-slate-200'"
                :aria-pressed="choix.secteursAtom.includes(s)"
                @click="basculer('secteursAtom', s)"
              >
                {{ s }}
              </button>
            </div>
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold text-slate-900">Territoires Friesland</legend>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in donnees.referentiel.territoires" :key="`t-${t.code}`" type="button"
                class="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition"
                :class="choix.territoires.includes(t.code) ? 'bg-emerald-50 text-emerald-800 ring-emerald-400' : 'bg-white text-slate-600 ring-slate-200'"
                :aria-pressed="choix.territoires.includes(t.code)"
                @click="basculerTerritoire(t.code)"
              >
                {{ t.nom }}
              </button>
            </div>
          </fieldset>

          <fieldset class="space-y-3">
            <legend class="text-sm font-semibold text-slate-900">Quartiers de mes territoires</legend>
            <p v-if="!territoiresChoisis.length" class="text-sm text-slate-500">Cochez au moins un territoire pour voir ses quartiers.</p>
            <div v-for="t in territoiresChoisis" :key="`qt-${t.code}`" class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-semibold text-slate-700">
                  {{ t.nom }} · <span class="tabular-nums">{{ t.quartiers.filter(q => choix.quartiers.includes(q)).length }} sur {{ t.quartiers.length }}</span>
                </p>
                <button v-if="t.quartiers.length" type="button" class="text-xs font-semibold text-fc-red underline-offset-2 hover:underline" @click="basculerGroupe(t.quartiers)">
                  {{ t.quartiers.every(q => choix.quartiers.includes(q)) ? 'Tout décocher' : 'Tout cocher' }}
                </button>
              </div>
              <p v-if="!t.quartiers.length" class="text-xs text-slate-500">Aucun quartier enregistré pour ce territoire.</p>
              <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <label v-for="q in t.quartiers" :key="`q-${t.code}-${q}`" class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-fc-red focus:ring-fc-red" :checked="choix.quartiers.includes(q)" @change="basculer('quartiers', q)">
                  <span>{{ q }}</span>
                </label>
              </div>
            </div>
          </fieldset>
          <p class="text-xs text-slate-500" role="status">{{ etatChoix }}</p>
        </div>
        <button
          v-else type="button"
          class="text-sm font-semibold text-fc-red underline underline-offset-2"
          @click="choixOuvert = true"
        >
          Corriger mes zones
        </button>

        <div class="space-y-2">
          <label for="zones-manquantes" class="text-sm font-semibold text-slate-900">Zones ou quartiers que je couvre et qui manquent</label>
          <textarea
            id="zones-manquantes" v-model="zonesRemarque" rows="3"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-fc-red focus:outline-none focus:ring-2 focus:ring-fc-red/30"
            placeholder="Ex. : je couvre aussi Niangon Lokoa"
            @blur="enregistrerZonesRemarque"
          />
        </div>

        <BarreAction :texte="zonesRestantes ? `${zonesRestantes} réponse${zonesRestantes > 1 ? 's' : ''} à donner` : 'Zones terminées'">
          <UButton block size="xl" color="primary" :disabled="zonesRestantes > 0" @click="etape = 'jours'">
            Continuer vers mes quartiers
          </UButton>
        </BarreAction>
      </section>

      <!-- 4. Quartiers du mois -->
      <section v-else-if="etape === 'jours' && donnees" class="space-y-4">
        <Etapes :actuelle="2" />
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Mes quartiers du mois</h2>
          <p class="mt-1 text-sm text-slate-500">Pour chaque quartier, dites s'il fait bien partie de votre tournée. Touchez « Voir les PDV » pour la liste des boutiques.</p>
        </div>

        <p v-if="!quartiers.length" class="rounded-lg bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          Aucun quartier n'est prévu pour vous ce mois-ci. Dites-le dans la remarque à l'étape suivante.
        </p>

        <article
          v-for="q in quartiers" :key="q.cle"
          class="rounded-lg bg-white ring-1"
          :class="reponseQuartier(q) ? 'ring-slate-200' : 'ring-amber-300'"
        >
          <div class="space-y-3 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-base font-semibold text-slate-900">{{ q.nom }}</p>
                <p class="text-xs text-slate-500">{{ joursTexte(q) }}</p>
                <p v-if="q.distributeur" class="text-xs text-slate-500">{{ q.distributeur }}</p>
              </div>
              <span class="shrink-0 text-right text-xs text-slate-500">
                <b class="block text-lg leading-none text-slate-900">{{ q.pdv.length }}</b> PDV
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2" role="group" :aria-label="`Décision pour le quartier ${q.nom}`">
              <button
                v-for="d in DECISIONS" :key="d.valeur" type="button"
                class="rounded-md px-2 py-2.5 text-sm font-semibold ring-1 transition"
                :class="reponseQuartier(q)?.decision === d.valeur ? d.actif : 'bg-white text-slate-600 ring-slate-200'"
                :aria-pressed="reponseQuartier(q)?.decision === d.valeur"
                @click="repondreQuartier(q, d.valeur)"
              >
                {{ d.texte }}
              </button>
            </div>
            <textarea
              v-if="reponseQuartier(q) && reponseQuartier(q)!.decision !== 'ok'"
              v-model="commentaires[q.cle]" rows="2"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-fc-red focus:outline-none focus:ring-2 focus:ring-fc-red/30"
              :placeholder="reponseQuartier(q)!.decision === 'modifier' ? 'Quel quartier à la place ? Pourquoi ?' : 'Pourquoi retirer ce quartier ?'"
              :aria-label="`Commentaire pour le quartier ${q.nom}`"
              @blur="repondreQuartier(q, reponseQuartier(q)!.decision)"
            />

            <button
              v-if="q.pdv.length" type="button"
              class="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
              :aria-expanded="ouvert === q.cle"
              @click="ouvert = ouvert === q.cle ? null : q.cle"
            >
              <span>{{ ouvert === q.cle ? 'Masquer les PDV' : 'Voir les PDV' }}</span>
              <UIcon name="i-heroicons-chevron-down" class="h-4 w-4 transition-transform" :class="ouvert === q.cle ? 'rotate-180' : ''" />
            </button>
            <p v-else class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Aucun PDV de votre distributeur dans ce quartier. Dites-le avec « Modifier ».
            </p>

            <ul v-if="ouvert === q.cle" class="divide-y divide-slate-100">
              <li v-for="p in q.pdv" :key="p.id" class="flex items-center justify-between gap-3 py-2.5">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold" :class="retours[p.id] ? 'text-slate-400 line-through' : 'text-slate-900'">{{ p.nom }}</p>
                  <p class="text-xs text-slate-500">{{ p.type }}</p>
                </div>
                <label class="sr-only" :for="`retour-${p.id}`">Signaler {{ p.nom }}</label>
                <select
                  :id="`retour-${p.id}`"
                  class="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  :value="retours[p.id]?.motif || ''"
                  @change="signalerPdv(q.lignes[0], p.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">OK</option>
                  <option value="pas_ma_tournee">Pas chez moi</option>
                  <option value="ferme">Fermé</option>
                </select>
              </li>
            </ul>
          </div>
        </article>

        <BarreAction :texte="quartiersRestants ? `${quartiersRestants} quartier${quartiersRestants > 1 ? 's' : ''} à traiter` : 'Tous les quartiers sont traités'">
          <UButton block size="xl" color="primary" :disabled="quartiersRestants > 0" @click="etape = 'valider'">
            Terminer
          </UButton>
        </BarreAction>
      </section>

      <!-- 5. Valider -->
      <section v-else-if="etape === 'valider' && donnees" class="space-y-5">
        <Etapes :actuelle="3" />
        <h2 class="text-lg font-semibold text-slate-900">Valider ma fiche</h2>
        <dl class="grid grid-cols-3 gap-2 text-center">
          <div v-for="c in recap" :key="c.texte" class="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <dd class="text-2xl font-bold tabular-nums text-slate-900">{{ c.n }}</dd>
            <dt class="text-xs text-slate-500">{{ c.texte }}</dt>
          </div>
        </dl>
        <p class="text-sm text-slate-600">
          {{ Object.keys(retours).length }} boutique{{ Object.keys(retours).length > 1 ? 's' : '' }} signalée{{ Object.keys(retours).length > 1 ? 's' : '' }},
          {{ zonesNon }} zone{{ zonesNon > 1 ? 's' : '' }} non couverte{{ zonesNon > 1 ? 's' : '' }}.
        </p>
        <form class="space-y-4" @submit.prevent="valider">
          <div class="space-y-1">
            <label for="nom" class="text-sm font-semibold text-slate-900">Mon nom et prénom</label>
            <input id="nom" v-model="nomSaisi" autocomplete="name" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-fc-red focus:outline-none focus:ring-2 focus:ring-fc-red/30">
          </div>
          <div class="space-y-1">
            <label for="remarque" class="text-sm font-semibold text-slate-900">Remarque (facultatif)</label>
            <textarea id="remarque" v-model="remarque" rows="3" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-fc-red focus:outline-none focus:ring-2 focus:ring-fc-red/30" />
          </div>
          <UButton type="submit" block size="xl" color="primary" :loading="envoi" :disabled="nomSaisi.trim().length < 2">
            Valider ma tournée
          </UButton>
        </form>
      </section>

      <!-- 6. Fini -->
      <section v-else-if="etape === 'fini'" class="space-y-4 pt-8 text-center">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <UIcon name="i-heroicons-check" class="h-9 w-9 text-emerald-700" />
        </div>
        <h2 class="text-xl font-bold text-slate-900">Merci, c'est validé</h2>
        <p class="text-sm text-slate-600">Votre fiche a été envoyée à l'équipe. Elle reviendra vers vous si un quartier doit changer.</p>
        <UButton color="gray" variant="soft" @click="deconnecter">Fermer</UButton>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'

definePageMeta({ layout: false })
useHead({ title: 'Validation de ma tournée', meta: [{ name: 'robots', content: 'noindex' }] })

type Pdv = { id: string; nom: string; type: string }
type Quartier = { cle: string; nom: string; lignes: string[]; jours: { nomJour: string; jour: number; semaine: number }[]; distributeur: string; pdv: Pdv[] }

const DECISIONS = [
  { valeur: 'ok', texte: 'OK', actif: 'bg-emerald-50 text-emerald-800 ring-emerald-400' },
  { valeur: 'modifier', texte: 'Modifier', actif: 'bg-amber-50 text-amber-800 ring-amber-400' },
  { valeur: 'retirer', texte: 'Retirer', actif: 'bg-red-50 text-red-700 ring-red-400' },
]
const CLE_JETON = 'validation-tournee-jeton'

const etape = ref<'accueil' | 'zones' | 'jours' | 'valider' | 'fini'>('accueil')
const chargement = ref(true)
const envoi = ref(false)
const erreur = ref('')
const campagne = ref<{ libelle: string; mois: string } | null>(null)
const jeton = ref('')
const donnees = ref<any>(null)
const reponses = ref<Record<string, { decision: string; commentaire: string }>>({})
const retours = ref<Record<string, { motif: string; commentaire: string }>>({})
const reponsesZones = ref<Record<string, { decision: string; commentaire: string }>>({})
const zonesRemarque = ref('')
const ouvert = ref<string | null>(null)
const nomSaisi = ref('')
const remarque = ref('')
const commentaires = ref<Record<string, string>>({})

// --- Petits composants de la page -----------------------------------------
const Etapes = defineComponent({
  props: { actuelle: { type: Number, required: true } },
  setup: p => () => h('ol', { class: 'flex gap-2 text-xs font-semibold', 'aria-label': 'Étapes' },
    ['Zones', 'Quartiers', 'Validation'].map((t, i) => h('li', {
      class: ['flex-1 rounded-full px-2 py-1 text-center', i + 1 === p.actuelle ? 'bg-fc-red text-white' : i + 1 < p.actuelle ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'],
      'aria-current': i + 1 === p.actuelle ? 'step' : undefined,
    }, `${i + 1}. ${t}`))),
})
const LigneZone = defineComponent({
  props: { libelle: { type: String, required: true }, detail: { type: String, default: '' }, decision: { type: String, default: null } },
  emits: ['choisir'],
  setup: (p, { emit }) => () => h('div', { class: 'flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 ring-1 ' + (p.decision ? 'ring-slate-200' : 'ring-amber-300') }, [
    h('div', { class: 'min-w-0' }, [
      h('p', { class: 'font-semibold text-slate-900' }, p.libelle),
      p.detail ? h('p', { class: 'text-xs text-slate-500' }, p.detail) : null,
    ]),
    h('div', { class: 'flex shrink-0 gap-2', role: 'group', 'aria-label': `Je couvre ${p.libelle}` }, [
      ['oui', 'Je couvre', 'bg-emerald-50 text-emerald-800 ring-emerald-400'],
      ['non', 'Non', 'bg-red-50 text-red-700 ring-red-400'],
    ].map(([v, t, actif]) => h('button', {
      type: 'button',
      class: ['rounded-md px-3 py-2 text-sm font-semibold ring-1', p.decision === v ? actif : 'bg-white text-slate-600 ring-slate-200'],
      'aria-pressed': p.decision === v,
      onClick: () => emit('choisir', v),
    }, t))),
  ]),
})
const BarreAction = defineComponent({
  props: { texte: { type: String, default: '' } },
  setup: (p, { slots }) => () => h('div', { class: 'fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur' },
    h('div', { class: 'space-y-2' }, [h('p', { class: 'text-center text-xs text-slate-500' }, p.texte), slots.default?.()])),
})

// --- Appels -----------------------------------------------------------------
const message = (e: any) => e?.data?.message || e?.data?.statusMessage || e?.message || 'Erreur, réessayez'
const api = (url: string, options: any = {}) => $fetch(url, { ...options, headers: { ...(jeton.value ? { Authorization: `Bearer ${jeton.value}` } : {}), ...(options.headers || {}) } })

async function chargerCampagne() {
  chargement.value = true
  try {
    const r: any = await $fetch('/api/validation-tournee')
    campagne.value = r.campagne
  }
  catch (e) { erreur.value = message(e) }
  finally { chargement.value = false }
}

async function chargerDonnees() {
  const d: any = await api('/api/validation-tournee/donnees')
  donnees.value = d
  campagne.value = d.campagne
  reponses.value = d.reponses
  retours.value = d.retoursPdv
  reponsesZones.value = d.reponsesZones
  zonesRemarque.value = d.zonesRemarque
  remarque.value = d.remarque
  const base = d.zonesProposees || d.zonesActuelles
  choix.value = {
    secteursAtom: [...(base?.secteursAtom || [])],
    territoires: [...(base?.territoires || [])],
    quartiers: [...(base?.quartiers || [])],
  }
  choixOuvert.value = !!d.zonesProposees
  commentaires.value = Object.fromEntries((d.quartiers || []).map((q: Quartier) => [q.cle, d.reponses[q.lignes[0]]?.commentaire || '']))
  etape.value = d.statut === 'validee' ? 'fini' : 'zones'
}

async function enregistrer(body: any) {
  erreur.value = ''
  try { await api('/api/validation-tournee/reponse', { method: 'POST', body }) }
  catch (e: any) {
    erreur.value = message(e)
    if (e?.statusCode === 401) deconnecter()
  }
}

// --- Zones ------------------------------------------------------------------
const cleZone = (type: string, libelle: string) => `${type}|${libelle}`
const zone = (type: string, libelle: string) => reponsesZones.value[cleZone(type, libelle)]?.decision || null
function repondreZone(type: string, libelle: string, decision: string | null) {
  const k = cleZone(type, libelle)
  if (decision) reponsesZones.value[k] = { decision, commentaire: '' }
  else delete reponsesZones.value[k]
  enregistrer({ type: 'zone', zoneType: type, libelle, decision })
}
const enregistrerZonesRemarque = () => enregistrer({ type: 'zones_remarque', commentaire: zonesRemarque.value })
const zonesNon = computed(() => Object.values(reponsesZones.value).filter(z => z.decision === 'non').length)
const zonesRestantes = computed(() => {
  if (!donnees.value) return 0
  const z = donnees.value.zones
  const sansReponse = [...z.secteursAtom.map((s: string) => ['secteur_atom', s]), ...z.territoiresFriesland.map((t: string) => ['territoire_friesland', t])]
    .filter(([t, l]) => !zone(t, l)).length
  // Un « Non » demande au moins un territoire coché dans « Ce que je couvre vraiment ».
  return sansReponse + (zonesNon.value && !choix.value.territoires.length ? 1 : 0)
})

// --- Ce que je couvre vraiment (proposition, même choix que dans l'admin) ---
const choixOuvert = ref(false)
const choix = ref<{ secteursAtom: string[]; territoires: string[]; quartiers: string[] }>({ secteursAtom: [], territoires: [], quartiers: [] })
const etatChoix = ref('')
const territoiresChoisis = computed(() => (donnees.value?.referentiel.territoires || []).filter((t: any) => choix.value.territoires.includes(t.code)))
let minuterie: ReturnType<typeof setTimeout> | null = null
function enregistrerChoix() {
  etatChoix.value = 'Enregistrement…'
  if (minuterie) clearTimeout(minuterie)
  minuterie = setTimeout(async () => {
    await enregistrer({ type: 'zones_proposees', zones: choix.value })
    etatChoix.value = erreur.value ? '' : 'Proposition enregistrée'
  }, 600)
}
function basculer(liste: 'secteursAtom' | 'quartiers', valeur: string) {
  const l = choix.value[liste]
  choix.value[liste] = l.includes(valeur) ? l.filter(x => x !== valeur) : [...l, valeur]
  enregistrerChoix()
}
function basculerTerritoire(code: string) {
  const t = (donnees.value?.referentiel.territoires || []).find((x: any) => x.code === code)
  if (choix.value.territoires.includes(code)) {
    // Décocher un territoire retire ses quartiers, comme dans l'admin.
    choix.value.territoires = choix.value.territoires.filter(x => x !== code)
    const siens = new Set(t?.quartiers || [])
    choix.value.quartiers = choix.value.quartiers.filter(q => !siens.has(q))
  }
  else choix.value.territoires = [...choix.value.territoires, code]
  enregistrerChoix()
}
function basculerGroupe(quartiers: string[]) {
  const tous = quartiers.every(q => choix.value.quartiers.includes(q))
  const set = new Set(choix.value.quartiers)
  for (const q of quartiers) tous ? set.delete(q) : set.add(q)
  choix.value.quartiers = [...set]
  enregistrerChoix()
}

// --- Quartiers du mois -------------------------------------------------------
const quartiers = computed<Quartier[]>(() => donnees.value?.quartiers || [])
// Réponse d'un quartier : celle de ses jours (enregistrée sur chacun).
const reponseQuartier = (q: Quartier) => q.lignes.every(id => reponses.value[id]) ? reponses.value[q.lignes[0]] : null
const quartiersRestants = computed(() => quartiers.value.filter(q => !reponseQuartier(q)).length)
const joursTexte = (q: Quartier) => {
  const parJour = new Map<string, number[]>()
  for (const j of q.jours) parJour.set(j.nomJour, [...(parJour.get(j.nomJour) || []), j.semaine])
  return [...parJour.entries()].map(([n, s]) => `${n.toLowerCase()} ${s.map(x => `S${x}`).join(', ')}`).join(' · ')
}
function repondreQuartier(q: Quartier, decision: string) {
  if (decision === 'ok') commentaires.value[q.cle] = ''
  const commentaire = commentaires.value[q.cle] || ''
  for (const id of q.lignes) reponses.value[id] = { decision, commentaire }
  enregistrer({ type: 'quartier', ligneIds: q.lignes, decision, commentaire })
}
function signalerPdv(ligneId: string, pdvId: string, motif: string) {
  if (motif) retours.value[pdvId] = { motif, commentaire: '' }
  else delete retours.value[pdvId]
  enregistrer({ type: 'pdv', ligneId, pdvId, motif: motif || null })
}

// --- Validation -------------------------------------------------------------
const recap = computed(() => ['ok', 'modifier', 'retirer'].map(d => ({
  n: quartiers.value.filter(q => reponseQuartier(q)?.decision === d).length,
  texte: d === 'ok' ? 'quartiers OK' : d === 'modifier' ? 'à modifier' : 'à retirer',
})))

async function valider() {
  envoi.value = true
  erreur.value = ''
  try {
    await api('/api/validation-tournee/valider', { method: 'POST', body: { nom: nomSaisi.value, remarque: remarque.value } })
    etape.value = 'fini'
  }
  catch (e) { erreur.value = message(e) }
  finally { envoi.value = false }
}

function retour() {
  erreur.value = ''
  if (etape.value === 'jours') etape.value = 'zones'
  else if (etape.value === 'valider') etape.value = 'jours'
}

function deconnecter() {
  jeton.value = ''
  donnees.value = null
  try { localStorage.removeItem(CLE_JETON) } catch {}
  etape.value = 'accueil'
}

async function entrerParLien(lien: string) {
  try {
    const r: any = await $fetch('/api/validation-tournee/acces-lien', { method: 'POST', body: { lien } })
    jeton.value = r.jeton
    try { localStorage.setItem(CLE_JETON, r.jeton) } catch {}
    await chargerDonnees()
    return true
  }
  catch (e) { erreur.value = message(e); return false }
  finally {
    // Le lien ne reste pas dans la barre d'adresse (partage d'écran, historique).
    navigateTo({ path: '/validation-tournee' }, { replace: true })
  }
}

onMounted(async () => {
  await chargerCampagne()
  chargement.value = true
  const lien = String(useRoute().query.t || '')
  if (lien && campagne.value && await entrerParLien(lien)) return
  let garde = ''
  try { garde = localStorage.getItem(CLE_JETON) || '' } catch {}
  if (garde && campagne.value) {
    jeton.value = garde
    try { await chargerDonnees() }
    catch { deconnecter() }
  }
  chargement.value = false
})
</script>
