<template>
  <div class="min-h-dvh bg-gray-50 text-slate-700 safe-area-top">
    <header class="sticky top-0 z-40 flex min-h-[56px] items-center gap-2 bg-fc-red px-4 py-2.5 text-white shadow-sm">
      <button
        v-if="etape !== 'noms' && etape !== 'fini'"
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

    <main class="mx-auto max-w-xl px-4 pb-32 pt-4">
      <!-- Erreur générale -->
      <div v-if="erreur" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {{ erreur }}
      </div>

      <!-- 1. Choisir son nom -->
      <section v-if="etape === 'noms'" class="space-y-4">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Qui êtes-vous ?</h2>
          <p class="mt-1 text-sm text-slate-500">Touchez votre nom. Vous taperez ensuite le code à 4 chiffres reçu de l'admin.</p>
        </div>
        <p v-if="chargement" class="text-sm text-slate-500">Chargement…</p>
        <p v-else-if="!campagne" class="rounded-lg bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          Aucune validation n'est ouverte pour le moment.
        </p>
        <ul v-else class="space-y-2">
          <li v-for="m in merchandisers" :key="m.id">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-4 py-3.5 text-left ring-1 ring-slate-200 transition hover:ring-fc-red/40 active:bg-slate-50"
              @click="choisir(m)"
            >
              <span class="font-semibold text-slate-900">{{ m.nom }}</span>
              <span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="pastille(m.statut).classe">{{ pastille(m.statut).texte }}</span>
            </button>
          </li>
        </ul>
      </section>

      <!-- 2. Code -->
      <section v-else-if="etape === 'code'" class="space-y-5">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">{{ choisi?.nom }}</h2>
          <p class="mt-1 text-sm text-slate-500">Tapez votre code à 4 chiffres.</p>
        </div>
        <form class="space-y-4" @submit.prevent="entrer">
          <label for="code" class="sr-only">Code à 4 chiffres</label>
          <input
            id="code"
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="4"
            pattern="[0-9]{4}"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] text-slate-900 focus:border-fc-red focus:outline-none focus:ring-2 focus:ring-fc-red/30"
            placeholder="••••"
          >
          <UButton type="submit" block size="xl" color="primary" :loading="envoi" :disabled="code.length !== 4">
            Entrer
          </UButton>
        </form>
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

        <div v-if="donnees.zones.quartiersFriesland.length" class="space-y-2">
          <h3 class="text-sm font-semibold text-slate-900">Mes quartiers chez Friesland</h3>
          <p class="text-sm text-slate-500">Touchez les quartiers que vous ne couvrez pas. Ils passent en rouge.</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="q in donnees.zones.quartiersFriesland" :key="`q-${q}`"
              type="button"
              class="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition"
              :class="zone('quartier_friesland', q) === 'non' ? 'bg-red-50 text-red-700 ring-red-300 line-through' : 'bg-white text-slate-700 ring-slate-200'"
              :aria-pressed="zone('quartier_friesland', q) === 'non'"
              @click="repondreZone('quartier_friesland', q, zone('quartier_friesland', q) === 'non' ? null : 'non')"
            >
              {{ q }}
            </button>
          </div>
        </div>

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
            Continuer vers ma tournée
          </UButton>
        </BarreAction>
      </section>

      <!-- 4. Jours de tournée -->
      <section v-else-if="etape === 'jours' && donnees" class="space-y-4">
        <Etapes :actuelle="2" />
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Ma tournée du mois</h2>
          <p class="mt-1 text-sm text-slate-500">Pour chaque jour, dites si le point de visite est bon.</p>
        </div>

        <div class="rounded-lg bg-white p-4 text-sm ring-1 ring-slate-200">
          <p class="font-semibold text-slate-900">Comment les boutiques du jour sont choisies</p>
          <p class="mt-1">
            Ce sont les boutiques de votre distributeur dans le quartier du point de visite du jour.
            S'il n'y en a pas assez pour le quota, on complète avec des boutiques du même distributeur
            dans le quartier voisin le plus proche. Elles sont marquées « quartier voisin ».
          </p>
        </div>

        <div class="flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm ring-1 ring-slate-200">
          <span v-if="maPosition">Distances calculées depuis votre position.</span>
          <span v-else-if="positionRefusee">Position refusée : les distances ne s'affichent pas.</span>
          <span v-else>Activez votre position pour voir à quelle distance sont les boutiques.</span>
          <UButton v-if="!maPosition" size="sm" color="primary" variant="soft" @click="activerPosition">Activer</UButton>
        </div>

        <div class="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Semaine">
          <button
            v-for="s in semaines" :key="s"
            type="button" role="tab" :aria-selected="semaine === s"
            class="flex-1 rounded-md px-2 py-2 text-sm font-semibold transition"
            :class="semaine === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
            @click="semaine = s"
          >
            S{{ s }}
            <span class="block text-[11px] font-normal" :class="restantSemaine(s) ? 'text-amber-700' : 'text-emerald-700'">
              {{ restantSemaine(s) ? `${restantSemaine(s)} à faire` : 'fait' }}
            </span>
          </button>
        </div>

        <article
          v-for="j in joursSemaine" :key="j.id"
          class="rounded-lg bg-white ring-1"
          :class="reponses[j.id] ? 'ring-slate-200' : 'ring-amber-300'"
        >
          <div class="space-y-3 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-slate-500">{{ j.nomJour }}, semaine {{ j.semaine }}</p>
                <p class="text-base font-semibold text-slate-900">{{ j.pointVisite }}</p>
                <p class="text-xs text-slate-500">
                  {{ j.distributeur }}<template v-if="j.ssf"> · SSF {{ j.ssf }}</template><template v-if="j.engin"> ({{ j.engin }})</template>
                </p>
              </div>
              <span class="shrink-0 text-right text-xs text-slate-500">
                <b class="block text-lg leading-none text-slate-900">{{ j.pdv.length }}</b> boutiques
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2" role="group" :aria-label="`Décision pour ${j.nomJour} ${j.pointVisite}`">
              <button
                v-for="d in DECISIONS" :key="d.valeur" type="button"
                class="rounded-md px-2 py-2.5 text-sm font-semibold ring-1 transition"
                :class="reponses[j.id]?.decision === d.valeur ? d.actif : 'bg-white text-slate-600 ring-slate-200'"
                :aria-pressed="reponses[j.id]?.decision === d.valeur"
                @click="repondreJour(j.id, d.valeur)"
              >
                {{ d.texte }}
              </button>
            </div>
            <textarea
              v-if="reponses[j.id] && reponses[j.id].decision !== 'ok'"
              v-model="reponses[j.id].commentaire" rows="2"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-fc-red focus:outline-none focus:ring-2 focus:ring-fc-red/30"
              :placeholder="reponses[j.id].decision === 'modifier' ? 'Quel point de visite à la place ? Pourquoi ?' : 'Pourquoi retirer ce jour ?'"
              :aria-label="`Commentaire pour ${j.nomJour} ${j.pointVisite}`"
              @blur="repondreJour(j.id, reponses[j.id].decision, true)"
            />

            <button
              v-if="j.pdv.length" type="button"
              class="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
              :aria-expanded="ouvert === j.id"
              @click="ouvert = ouvert === j.id ? null : j.id"
            >
              <span>Voir les boutiques<template v-if="nbVoisins(j)"> · dont {{ nbVoisins(j) }} du quartier voisin</template></span>
              <UIcon name="i-heroicons-chevron-down" class="h-4 w-4 transition-transform" :class="ouvert === j.id ? 'rotate-180' : ''" />
            </button>
            <p v-else class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Aucune boutique de votre distributeur pour ce jour. Dites-le avec « Modifier ».
            </p>

            <ul v-if="ouvert === j.id" class="divide-y divide-slate-100">
              <li v-for="p in pdvTries(j)" :key="p.id" class="flex items-center justify-between gap-3 py-2.5">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold" :class="retours[p.id] ? 'text-slate-400 line-through' : 'text-slate-900'">{{ p.nom }}</p>
                  <p class="text-xs text-slate-500">
                    <template v-if="distanceDeMoi(p) != null">à {{ formatDistance(distanceDeMoi(p)) }} de vous</template>
                    <template v-else>{{ p.type }}</template>
                    <span v-if="p.quartierVoisin" class="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">quartier voisin</span>
                  </p>
                </div>
                <label class="sr-only" :for="`retour-${p.id}`">Signaler {{ p.nom }}</label>
                <select
                  :id="`retour-${p.id}`"
                  class="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  :value="retours[p.id]?.motif || ''"
                  @change="signalerPdv(j.id, p.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">OK</option>
                  <option value="pas_ma_tournee">Pas chez moi</option>
                  <option value="position_fausse">Position fausse</option>
                  <option value="ferme">Fermé</option>
                </select>
              </li>
            </ul>
          </div>
        </article>

        <BarreAction :texte="joursRestants ? `${joursRestants} jour${joursRestants > 1 ? 's' : ''} à traiter` : 'Tous les jours sont traités'">
          <UButton block size="xl" color="primary" :disabled="joursRestants > 0" @click="etape = 'valider'">
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
        <p class="text-sm text-slate-600">Votre fiche a été envoyée à l'équipe. Elle reviendra vers vous si un jour doit changer.</p>
        <UButton color="gray" variant="soft" @click="deconnecter">Fermer</UButton>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'

definePageMeta({ layout: false })
useHead({ title: 'Validation de ma tournée', meta: [{ name: 'robots', content: 'noindex' }] })

type Pdv = { id: string; nom: string; type: string; quartierVoisin: boolean; distancePoint: number; lat: number | null; lng: number | null }
type Jour = { id: string; semaine: number; jour: number; nomJour: string; pointVisite: string; distributeur: string; ssf: string; engin: string; pdv: Pdv[] }

const DECISIONS = [
  { valeur: 'ok', texte: 'OK', actif: 'bg-emerald-50 text-emerald-800 ring-emerald-400' },
  { valeur: 'modifier', texte: 'Modifier', actif: 'bg-amber-50 text-amber-800 ring-amber-400' },
  { valeur: 'retirer', texte: 'Retirer', actif: 'bg-red-50 text-red-700 ring-red-400' },
]
const CLE_JETON = 'validation-tournee-jeton'

const etape = ref<'noms' | 'code' | 'zones' | 'jours' | 'valider' | 'fini'>('noms')
const chargement = ref(true)
const envoi = ref(false)
const erreur = ref('')
const campagne = ref<{ libelle: string; mois: string } | null>(null)
const merchandisers = ref<{ id: string; nom: string; statut: string }[]>([])
const choisi = ref<{ id: string; nom: string } | null>(null)
const code = ref('')
const jeton = ref('')
const donnees = ref<any>(null)
const reponses = ref<Record<string, { decision: string; commentaire: string }>>({})
const retours = ref<Record<string, { motif: string; commentaire: string }>>({})
const reponsesZones = ref<Record<string, { decision: string; commentaire: string }>>({})
const zonesRemarque = ref('')
const semaine = ref(1)
const ouvert = ref<string | null>(null)
const nomSaisi = ref('')
const remarque = ref('')
const maPosition = ref<{ lat: number; lng: number } | null>(null)
const positionRefusee = ref(false)

// --- Petits composants de la page -----------------------------------------
const Etapes = defineComponent({
  props: { actuelle: { type: Number, required: true } },
  setup: p => () => h('ol', { class: 'flex gap-2 text-xs font-semibold', 'aria-label': 'Étapes' },
    ['Zones', 'Tournée', 'Validation'].map((t, i) => h('li', {
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
    h('div', { class: 'mx-auto max-w-xl space-y-2' }, [h('p', { class: 'text-center text-xs text-slate-500' }, p.texte), slots.default?.()])),
})

// --- Appels -----------------------------------------------------------------
const message = (e: any) => e?.data?.message || e?.data?.statusMessage || e?.message || 'Erreur, réessayez'
const api = (url: string, options: any = {}) => $fetch(url, { ...options, headers: { ...(jeton.value ? { Authorization: `Bearer ${jeton.value}` } : {}), ...(options.headers || {}) } })

function pastille(statut: string) {
  if (statut === 'validee') return { texte: 'Validé', classe: 'bg-emerald-50 text-emerald-800' }
  if (statut === 'en_cours') return { texte: 'En cours', classe: 'bg-amber-50 text-amber-800' }
  return { texte: 'À faire', classe: 'bg-slate-100 text-slate-600' }
}

async function chargerNoms() {
  chargement.value = true
  try {
    const r: any = await $fetch('/api/validation-tournee')
    campagne.value = r.campagne
    merchandisers.value = r.merchandisers
  }
  catch (e) { erreur.value = message(e) }
  finally { chargement.value = false }
}

function choisir(m: { id: string; nom: string }) {
  choisi.value = m
  code.value = ''
  erreur.value = ''
  etape.value = 'code'
}

async function entrer() {
  if (!choisi.value) return
  envoi.value = true
  erreur.value = ''
  try {
    const r: any = await $fetch('/api/validation-tournee/acces', { method: 'POST', body: { id: choisi.value.id, code: code.value } })
    jeton.value = r.jeton
    try { localStorage.setItem(CLE_JETON, r.jeton) } catch {}
    await chargerDonnees()
  }
  catch (e) { erreur.value = message(e); code.value = '' }
  finally { envoi.value = false }
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
const zonesRestantes = computed(() => {
  if (!donnees.value) return 0
  const z = donnees.value.zones
  return [...z.secteursAtom.map((s: string) => ['secteur_atom', s]), ...z.territoiresFriesland.map((t: string) => ['territoire_friesland', t])]
    .filter(([t, l]) => !zone(t, l)).length
})
const zonesNon = computed(() => Object.values(reponsesZones.value).filter(z => z.decision === 'non').length)

// --- Jours ------------------------------------------------------------------
const jours = computed<Jour[]>(() => donnees.value?.jours || [])
const semaines = computed(() => [...new Set(jours.value.map(j => j.semaine))].sort())
const joursSemaine = computed(() => jours.value.filter(j => j.semaine === semaine.value))
const restantSemaine = (s: number) => jours.value.filter(j => j.semaine === s && !reponses.value[j.id]).length
const joursRestants = computed(() => jours.value.filter(j => !reponses.value[j.id]).length)
const nbVoisins = (j: Jour) => j.pdv.filter(p => p.quartierVoisin).length

function repondreJour(id: string, decision: string, commentaireSeul = false) {
  const avant = reponses.value[id]
  if (!commentaireSeul) reponses.value[id] = { decision, commentaire: decision === 'ok' ? '' : (avant?.commentaire || '') }
  enregistrer({ type: 'jour', ligneId: id, decision, commentaire: reponses.value[id]?.commentaire || '' })
}
function signalerPdv(ligneId: string, pdvId: string, motif: string) {
  if (motif) retours.value[pdvId] = { motif, commentaire: '' }
  else delete retours.value[pdvId]
  enregistrer({ type: 'pdv', ligneId, pdvId, motif: motif || null })
}

// --- Distance depuis le téléphone -------------------------------------------
function activerPosition() {
  if (!navigator.geolocation) { positionRefusee.value = true; return }
  navigator.geolocation.watchPosition(
    pos => { maPosition.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }; positionRefusee.value = false },
    () => { positionRefusee.value = true },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
  )
}
function distanceDeMoi(p: Pdv): number | null {
  if (!maPosition.value || p.lat == null || p.lng == null) return null
  const r = 6371000
  const rad = (x: number) => x * Math.PI / 180
  const dLat = rad(p.lat - maPosition.value.lat)
  const dLng = rad(p.lng - maPosition.value.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(maPosition.value.lat)) * Math.cos(rad(p.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}
const formatDistance = (m: number | null) => m == null ? '' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`
const pdvTries = (j: Jour) => maPosition.value
  ? [...j.pdv].sort((a, b) => (distanceDeMoi(a) ?? Infinity) - (distanceDeMoi(b) ?? Infinity))
  : j.pdv

// --- Validation -------------------------------------------------------------
const recap = computed(() => ['ok', 'modifier', 'retirer'].map(d => ({
  n: Object.values(reponses.value).filter(r => r.decision === d).length,
  texte: d === 'ok' ? 'jours OK' : d === 'modifier' ? 'à modifier' : 'à retirer',
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
  if (etape.value === 'code') etape.value = 'noms'
  else if (etape.value === 'zones') deconnecter()
  else if (etape.value === 'jours') etape.value = 'zones'
  else if (etape.value === 'valider') etape.value = 'jours'
}

function deconnecter() {
  jeton.value = ''
  donnees.value = null
  try { localStorage.removeItem(CLE_JETON) } catch {}
  etape.value = 'noms'
  chargerNoms()
}

onMounted(async () => {
  await chargerNoms()
  let garde = ''
  try { garde = localStorage.getItem(CLE_JETON) || '' } catch {}
  if (garde && campagne.value) {
    jeton.value = garde
    try { await chargerDonnees() }
    catch { deconnecter() }
  }
})
</script>
