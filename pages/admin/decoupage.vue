<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <!-- Chiffres du découpage et couleurs des commerciaux -->
    <div v-if="donnees" class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
      <p>
        <b class="font-semibold text-slate-900 dark:text-white">{{ donnees.territoires.length }}</b> territoires ·
        <b class="font-semibold text-slate-900 dark:text-white">{{ nbZones }}</b> zones ·
        <b class="font-semibold text-slate-900 dark:text-white">{{ nbSecteurs }}</b> secteurs ·
        <b class="font-semibold text-slate-900 dark:text-white">{{ donnees.commerciaux.length }}</b> commerciaux ·
        <b class="font-semibold text-slate-900 dark:text-white">{{ fmt(donnees.boutiques.id.length) }}</b> boutiques rattachées, dont {{ fmt(nbAtom) }} Atom
      </p>
      <ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Couleurs des commerciaux">
        <li v-for="(c, i) in donnees.commerciaux" :key="c.nom" class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: couleurs[i] }" aria-hidden="true" />{{ nomAffiche(c.nom) }}
        </li>
        <li class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: AUTRE }" aria-hidden="true" />Partagé
        </li>
      </ul>
    </div>

    <div class="flex flex-col-reverse gap-4 lg:h-[calc(100dvh-300px)] lg:min-h-[560px] lg:flex-row">
      <aside class="admin-surface flex w-full shrink-0 flex-col overflow-hidden lg:w-96" aria-label="Découpage">
        <div class="flex gap-1 border-b border-slate-200 p-2 dark:border-slate-700" role="group" aria-label="Vue">
          <button
            v-for="v in VUES"
            :key="v.id"
            type="button"
            class="flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors"
            :class="vue === v.id
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
            :aria-pressed="vue === v.id"
            @click="choisirVue(v.id)"
          >
            {{ v.label }}
          </button>
        </div>

        <!-- Calques de la carte -->
        <fieldset class="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-200 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <legend class="sr-only">Calques de la carte</legend>
          <label v-for="c in COUCHES" :key="c.id" class="inline-flex cursor-pointer items-center gap-1.5">
            <input v-model="couches[c.id]" type="checkbox" class="h-3.5 w-3.5 accent-brand-600">{{ c.label }}
          </label>
        </fieldset>

        <ChargementContenu v-if="chargement" variante="lignes" :nombre="8" libelle="Chargement du découpage…" class="p-4" />
        <div v-else-if="erreur" class="p-4 text-sm text-red-700 dark:text-red-300" role="alert">
          {{ erreur }}
          <UButton size="xs" color="gray" class="mt-2" @click="charger">Réessayer</UButton>
        </div>

        <!-- Territoires -->
        <div v-else-if="donnees && vue === 'territoires'" class="flex-1 overflow-auto">
          <section v-for="g in groupesTerritoires" :key="g.titre" class="border-b border-slate-200 last:border-0 dark:border-slate-700">
            <h3 class="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ g.titre }}</h3>
            <ul class="divide-y divide-slate-100 dark:divide-slate-700/60">
              <li v-for="t in g.indices" :key="`${g.titre}-${t}`">
                <div
                  class="flex items-start gap-2 px-3 py-2"
                  :class="{ 'bg-brand-50 dark:bg-brand-950/40': territoire === t }"
                >
                  <input
                    type="checkbox"
                    class="mt-1 h-3.5 w-3.5 shrink-0 accent-brand-600"
                    :checked="!masques.has(t)"
                    :aria-label="`Afficher ${terr(t).nom} sur la carte`"
                    @change="basculerMasque(t)"
                  >
                  <button type="button" class="min-w-0 flex-1 text-left" :aria-pressed="territoire === t" @click="choisirTerritoire(t)">
                    <span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">{{ terr(t).nom }}</span>
                    <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                      <span v-for="c in terr(t).coms" :key="c" class="inline-flex items-center gap-1">
                        <span class="h-2 w-2 rounded-full" :style="{ background: couleurs[c] }" aria-hidden="true" />{{ nomAffiche(donnees.commerciaux[c]!.nom) }}
                      </span>
                      <span v-if="!terr(t).coms.length" class="text-slate-500">sans commercial</span>
                      <span>· {{ terr(t).zones.length }} zone{{ terr(t).zones.length > 1 ? 's' : '' }}</span>
                      <span>· {{ fmt(terr(t).n) }} boutique{{ terr(t).n > 1 ? 's' : '' }}<template v-if="terr(t).na"> dont {{ fmt(terr(t).na) }} Atom</template></span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
                    :aria-expanded="ouverts.has(t)"
                    :aria-label="`${ouverts.has(t) ? 'Replier' : 'Déplier'} les zones de ${terr(t).nom}`"
                    @click="basculerOuvert(t)"
                  >
                    <UIcon :name="ouverts.has(t) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="h-4 w-4" />
                  </button>
                </div>
                <div v-if="ouverts.has(t)" class="space-y-2 px-3 pb-3 pl-9">
                  <p v-if="!terr(t).n" class="text-xs text-slate-500 dark:text-slate-400">
                    Aucune boutique ne porte encore ce territoire : elles apparaîtront au reclassement.
                  </p>
                  <div v-for="z in terr(t).zones" :key="z.code">
                    <p class="text-xs font-semibold text-slate-800 dark:text-slate-100">{{ z.nom }} <span class="font-normal text-slate-500">· {{ z.code }}</span></p>
                    <p class="text-xs text-slate-600 dark:text-slate-300">{{ z.secteurs.join(', ') || '—' }}</p>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <!-- Merchandisers Atom -->
        <div v-else-if="donnees && vue === 'merchandisers'" class="flex-1 space-y-2 overflow-auto p-3">
          <p class="text-xs text-slate-600 dark:text-slate-300">
            Liste de chaque merchandiser Atom (boutiques de ses quartiers, de ses tournées et celles qu'il a créées), comparée au commercial de chaque boutique.
          </p>
          <button
            v-for="(m, i) in donnees.merchs"
            :key="m.id"
            type="button"
            class="w-full rounded-md border p-3 text-left transition-colors"
            :class="merch === i
              ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/40'
              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'"
            :aria-pressed="merch === i"
            @click="choisirMerch(i)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ nomAffiche(m.nom) }}</span>
              <span class="shrink-0 text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ fmt(m.total) }} boutiques</span>
            </span>
            <span class="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600 dark:text-slate-300">
              <span class="inline-flex items-center gap-1">
                binôme
                <span v-if="m.binome >= 0" class="h-2 w-2 rounded-full" :style="{ background: couleurs[m.binome] }" aria-hidden="true" />
                {{ m.binome >= 0 ? nomAffiche(donnees.commerciaux[m.binome]!.nom) : 'hors découpage' }}
              </span>
              <span v-if="m.binome >= 0" :class="pctHors(m) >= 10 ? 'font-semibold text-red-700 dark:text-red-300' : ''">
                · {{ pctHors(m) }} % chez un autre commercial
              </span>
            </span>
            <span v-if="m.total" class="mt-2 flex h-2 overflow-hidden rounded bg-slate-100 dark:bg-slate-700" aria-hidden="true">
              <i v-for="[c, n] in m.parCom" :key="c" class="block h-full" :style="{ width: `${(100 * n) / m.total}%`, background: c >= 0 ? couleurs[c] : c === PARTAGE ? AUTRE : STATUT.neutre }" />
            </span>
          </button>
        </div>
      </aside>

      <section class="admin-surface relative h-[60dvh] min-h-[360px] min-w-0 overflow-hidden lg:h-auto lg:flex-1" aria-label="Carte du découpage">
        <div v-if="selection" class="absolute left-12 top-2.5 z-[500] flex max-w-[calc(100%-4rem)] items-center gap-2 rounded-full bg-brand-600 py-1 pl-3 pr-1 text-sm text-white">
          <span class="truncate">{{ selection }}</span>
          <button type="button" class="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-xs hover:bg-white/30" @click="toutVoir">Tout voir</button>
        </div>
        <ClientOnly>
          <DecoupageCarteDecoupage
            v-if="donnees"
            :donnees="donnees"
            :couleurs="couleurs"
            :territoire="territoire"
            :merch="merch"
            :masques="masques"
            :couches="couches"
            @choisir-territoire="choisirTerritoire"
          />
        </ClientOnly>
        <div v-if="chargement" class="absolute inset-0 z-[500] grid place-items-center bg-white/70 dark:bg-slate-900/70">
          <ChargementContenu variante="compact" libelle="Chargement du découpage…" />
        </div>
      </section>
    </div>
    <p v-if="donnees" class="text-xs text-slate-500 dark:text-slate-400">
      Boutiques rattachées par leur territoire (libellé de la boutique ou ancien libellé), pas encore par secteur : les territoires créés le 28/10
      (Bonoua, Anyama, Agboville, périphéries de Yopougon…) se rempliront au reclassement. Données du {{ dateMaj }}.
    </p>
  </div>
</template>

<script setup lang="ts">
// Découpage sectoriel en vigueur (South 1 et South 2), lu en direct :
// territoires → zones → secteurs → commercial, boutiques sur la carte,
// merchandisers Atom et points de visite. Un commercial voit tout le
// découpage, ses territoires en tête.
import { AUTRE, SERIES, STATUT } from '~/utils/chartPalette'
import { PARTAGE, nomAffiche, type CouchesDecoupage, type DecoupageDonnees, type DecoupageMerch } from '~/utils/decoupage'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

type Vue = 'territoires' | 'merchandisers'
const VUES: { id: Vue, label: string }[] = [
  { id: 'territoires', label: 'Territoires' },
  { id: 'merchandisers', label: 'Merchandisers Atom' },
]
const COUCHES: { id: keyof CouchesDecoupage, label: string }[] = [
  { id: 'friesland', label: 'Boutiques Friesland' },
  { id: 'atom', label: 'Boutiques Atom' },
  { id: 'emprises', label: 'Emprise des territoires' },
  { id: 'points', label: 'Points de visite' },
  { id: 'noms', label: 'Noms' },
]
const SOUS_REGIONS: Record<string, string> = { SOUTH1: 'South 1', SOUTH2: 'South 2' }

const route = useRoute()
const router = useRouter()

const donnees = shallowRef<(DecoupageDonnees & { moi: number }) | null>(null)
const chargement = ref(true)
const erreur = ref('')
const vue = ref<Vue>(route.query.vue === 'merchandisers' ? 'merchandisers' : 'territoires')
const territoire = ref(-1)
const merch = ref(-1)
const masques = ref(new Set<number>())
const ouverts = ref(new Set<number>())
const couches = reactive<CouchesDecoupage>({ friesland: true, atom: true, emprises: true, points: false, noms: true })

const couleurs = computed(() => (donnees.value?.commerciaux || []).map((_, i) => SERIES[i] ?? AUTRE))
const terr = (t: number) => donnees.value!.territoires[t]!
const nbZones = computed(() => donnees.value?.territoires.reduce((n, t) => n + t.zones.length, 0) ?? 0)
const nbSecteurs = computed(() => donnees.value?.territoires.reduce((n, t) => n + t.zones.reduce((m, z) => m + z.secteurs.length, 0), 0) ?? 0)
const nbAtom = computed(() => donnees.value?.boutiques.a.reduce((n, a) => n + a, 0) ?? 0)
const fmt = (n: number) => n.toLocaleString('fr-FR')
const pctHors = (m: DecoupageMerch) => m.total ? Math.round((100 * m.hors) / m.total) : 0
const dateMaj = computed(() => donnees.value ? new Date(donnees.value.maj).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '')

// Sous-régions dans l'ordre du fichier ; pour un commercial, ses territoires d'abord.
const groupesTerritoires = computed(() => {
  const D = donnees.value
  if (!D) return []
  const tous = D.territoires.map((_, i) => i)
  const groupes: { titre: string, indices: number[] }[] = []
  if (D.moi >= 0) groupes.push({ titre: 'Vos territoires', indices: tous.filter(t => D.territoires[t]!.coms.includes(D.moi)) })
  for (const [code, titre] of Object.entries(SOUS_REGIONS)) {
    groupes.push({ titre, indices: tous.filter(t => D.territoires[t]!.sousRegion === code) })
  }
  return groupes.filter(g => g.indices.length)
})

const selection = computed(() => {
  const D = donnees.value
  if (!D) return ''
  if (merch.value >= 0) return `Liste de ${nomAffiche(D.merchs[merch.value]!.nom)}`
  if (territoire.value >= 0) return D.territoires[territoire.value]!.nom
  return ''
})

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const D = await $fetch<DecoupageDonnees & { moi: number }>('/api/admin/decoupage')
    donnees.value = D
    // Commercial connecté : ses territoires en évidence au chargement.
    if (D.moi >= 0) {
      const siens = D.territoires.map((t, i) => t.coms.includes(D.moi) ? i : -1).filter(i => i >= 0)
      if (siens.length === 1) territoire.value = siens[0]!
    }
  }
  catch (err: any) {
    erreur.value = err?.data?.message || messageUtilisateur(err, 'Le découpage n\'a pas pu être chargé. Rechargez la page dans quelques instants.')
  }
  finally {
    chargement.value = false
  }
}

function choisirVue(v: Vue) {
  vue.value = v
  merch.value = -1
  router.replace({ query: { ...route.query, vue: v === 'territoires' ? undefined : v } })
}

function choisirTerritoire(t: number) {
  merch.value = -1
  territoire.value = territoire.value === t ? -1 : t
  if (territoire.value >= 0 && masques.value.has(t)) basculerMasque(t)
}

function choisirMerch(i: number) {
  territoire.value = -1
  merch.value = merch.value === i ? -1 : i
}

function toutVoir() {
  territoire.value = -1
  merch.value = -1
}

function basculerMasque(t: number) {
  const s = new Set(masques.value)
  if (s.has(t)) s.delete(t)
  else s.add(t)
  masques.value = s
}

function basculerOuvert(t: number) {
  const s = new Set(ouverts.value)
  if (s.has(t)) s.delete(t)
  else s.add(t)
  ouverts.value = s
}

onMounted(charger)
</script>
