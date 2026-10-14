<template>
  <section class="admin-surface space-y-5 p-5" aria-labelledby="titre-grille-objectifs">
    <div class="max-w-2xl">
      <h3 id="titre-grille-objectifs" class="text-base font-semibold text-slate-900 dark:text-white">Objectifs du trimestre (en %)</h3>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Part des points de vente visée par canal. Une case vide : pas d’objectif (produit pas encore lancé, PLV extérieure en supermarché).
        Le réalisé se lit dans
        <NuxtLink to="/admin/produits/objectifs" class="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-fc-red dark:text-white">Produits › Objectifs</NuxtLink>.
      </p>
    </div>

    <!-- Choix du trimestre d'abord, actions ensuite : le tout passe à la ligne
         dans la colonne étroite des référentiels (pas de défilement latéral). -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="flex flex-wrap items-end gap-3">
        <UFormGroup label="Trimestre" size="xs">
          <USelectMenu v-model="cle" :options="trimestreOptions" value-attribute="value" option-attribute="label" size="xs" class="w-56" />
        </UFormGroup>
        <UButton
          v-if="peutModifier"
          size="xs"
          color="gray"
          variant="outline"
          icon="i-heroicons-document-duplicate"
          :loading="reprise"
          @click="reprendrePrecedent"
        >
          Reprendre le {{ libellePrecedent }}
        </UButton>
      </div>
      <div v-if="peutModifier" class="flex flex-wrap items-center gap-2">
        <UButton color="gray" variant="ghost" :disabled="!modifie || enregistrement" @click="reinitialiser">Annuler les changements</UButton>
        <UButton icon="i-heroicons-check" :loading="enregistrement" :disabled="!modifie || !valide" @click="enregistrer">
          Enregistrer les objectifs
        </UButton>
      </div>
    </div>
    <p v-if="peutModifier && !valide" class="text-sm text-red-700 dark:text-red-300" role="alert">
      {{ casesInvalides }} case(s) en rouge : saisissez un pourcentage entre 0 et 100, ou laissez vide.
    </p>
    <p v-else-if="peutModifier && modifie" class="text-sm text-amber-800 dark:text-amber-200" aria-live="polite">
      Modifications non enregistrées pour le {{ libelleTrimestre }}.
    </p>

    <p v-if="!peutModifier" class="text-sm text-slate-600 dark:text-slate-300">Lecture seule : l’administrateur ou le superviseur modifie les objectifs.</p>
    <div v-if="erreur" class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      {{ erreur }}
    </div>

    <ChargementContenu v-if="chargement" variante="lignes" :nombre="6" libelle="Chargement des objectifs…" />
    <div v-else class="overflow-x-auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th scope="col">Indicateur</th>
            <th v-for="c in CANAUX" :key="c.code" scope="col" class="!text-right">
              <abbr :title="c.long" class="no-underline">{{ c.label }}</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in groupes" :key="g.titre">
            <tr>
              <th colspan="4" scope="colgroup" class="!bg-slate-50 !text-xs !font-semibold !text-slate-600 dark:!bg-slate-800/60 dark:!text-slate-300">{{ g.titre }}</th>
            </tr>
            <tr v-for="l in g.lignes" :key="l.cle">
              <th scope="row" class="!text-sm !font-semibold !text-slate-900 dark:!text-white">{{ l.label }}</th>
              <td v-for="c in CANAUX" :key="c.code" class="!px-2 !py-2 text-right">
                <UInput
                  v-model="valeurs[l.cle][c.code]"
                  inputmode="decimal"
                  size="sm"
                  class="ml-auto w-20"
                  placeholder="—"
                  :disabled="!peutModifier"
                  :aria-label="`${l.label}, ${c.long}, objectif en pourcentage`"
                  :aria-invalid="!valeurValide(valeurs[l.cle][c.code]) || undefined"
                  :color="valeurValide(valeurs[l.cle][c.code]) ? 'white' : 'red'"
                  :ui="{ base: 'text-right tabular-nums' }"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <AdminConfirmation v-bind="confirmation" @confirmer="confirmer" @annuler="annuler" />
  </section>
</template>

<script setup lang="ts">
// Saisie des objectifs de disponibilité (Paramètres › Référentiels), sur le
// modèle de la grille des quotas Atom. Table objectif_disponibilite (migration
// 20261014130000) : cible stockée de 0 à 1, saisie en %. Écriture réservée à
// l'admin et au superviseur (RLS). Les saisies non enregistrées sont protégées
// (changement de trimestre, de liste, de page).
import { messageUtilisateur } from '~/utils/supabaseErrors'
import {
  CANAUX, FAMILLES, PRODUITS, cleTrimestre, libelleIndicateur, lireCleTrimestre, trimestreDe, trimestrePrecedent, trimestresProposes,
  type CanalObjectif, type Famille, type Indicateur,
} from '~/utils/objectifsDisponibilite'

const supabase = useSupabaseClient()
const toast = useToast()
const authStore = useAuthStore()
const { confirmation, demanderConfirmation, confirmer, annuler } = useConfirmation()
const peutModifier = computed(() => authStore.isAdmin || authStore.isSuperviseur)

// Objectifs saisis à l'avance : jusqu'au T4 de l'année suivante.
const courant = trimestreDe()
const trimestreOptions = trimestresProposes({ annee: courant.annee + 1, trimestre: 4 }, courant)
const cle = ref(cleTrimestre(courant))
const periode = computed(() => lireCleTrimestre(cle.value) ?? courant)
const libelleTrimestre = computed(() => `T${periode.value.trimestre} ${periode.value.annee}`)
const libellePrecedent = computed(() => { const p = trimestrePrecedent(periode.value); return `T${p.trimestre} ${p.annee}` })

interface LigneGrille { cle: string, label: string, indicateur: Indicateur, reference_produit_id: number | null, categorie: Famille | null }
const groupes: { titre: string, lignes: LigneGrille[] }[] = [
  ...FAMILLES.map(f => ({
    titre: `Disponibilité : ${f.label}`,
    lignes: PRODUITS.filter(p => p.famille === f.code)
      .map(p => ({ cle: `dispo:${p.id}`, label: p.label, indicateur: 'dispo' as const, reference_produit_id: p.id, categorie: null })),
  })),
  {
    titre: 'Visibilité (PLV) et respect des prix',
    lignes: [
      { cle: 'plv_exterieure', label: libelleIndicateur('plv_exterieure'), indicateur: 'plv_exterieure', reference_produit_id: null, categorie: null },
      { cle: 'plv_interieure', label: libelleIndicateur('plv_interieure'), indicateur: 'plv_interieure', reference_produit_id: null, categorie: null },
      ...FAMILLES.map(f => ({ cle: `prix:${f.code}`, label: libelleIndicateur('prix', f.code), indicateur: 'prix' as const, reference_produit_id: null, categorie: f.code })),
    ],
  },
]
const toutes = groupes.flatMap(g => g.lignes)

type Valeurs = Record<string, Record<CanalObjectif, string>>
const vide = (): Valeurs => Object.fromEntries(toutes.map(l => [l.cle, { GT_ABIDJAN: '', GT_UPC: '', MT: '' }]))
const valeurs = reactive<Valeurs>(vide())
const initiale = ref(JSON.stringify(vide()))
// Ligne en base par case (pour mettre à jour ou supprimer la bonne ligne).
const ids = ref<Record<string, number>>({})
const chargement = ref(false)
const enregistrement = ref(false)
const reprise = ref(false)
const erreur = ref('')

const nombre = (v: string) => Number(String(v).replace(',', '.').replace('%', '').trim())
const valeurValide = (v: string) => !String(v).trim() || (Number.isFinite(nombre(v)) && nombre(v) >= 0 && nombre(v) <= 100)
const casesInvalides = computed(() => toutes.reduce((n, l) => n + CANAUX.filter(c => !valeurValide(valeurs[l.cle][c.code])).length, 0))
const valide = computed(() => casesInvalides.value === 0)
const modifie = computed(() => JSON.stringify(valeurs) !== initiale.value)
const cleCase = (cleL: string, canal: string) => `${cleL}|${canal}`
const cleLigneBase = (r: any) => r.indicateur === 'dispo' ? `dispo:${r.reference_produit_id}` : r.indicateur === 'prix' ? `prix:${r.categorie}` : r.indicateur

/** Objectifs d'un trimestre : valeurs saisissables (%) et identifiant de chaque case. */
async function lire(annee: number, trimestre: number) {
  const { data, error } = await supabase.from('objectif_disponibilite')
    .select('id, canal, indicateur, reference_produit_id, categorie, cible')
    .eq('annee', annee).eq('trimestre', trimestre)
  if (error) throw error
  const v = vide()
  const index: Record<string, number> = {}
  for (const r of (data || []) as any[]) {
    const cleL = cleLigneBase(r)
    if (!v[cleL] || !(r.canal in v[cleL])) continue
    v[cleL][r.canal as CanalObjectif] = String(Math.round(Number(r.cible) * 1000) / 10)
    index[cleCase(cleL, r.canal)] = r.id
  }
  return { v, index }
}

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    const { v, index } = await lire(periode.value.annee, periode.value.trimestre)
    Object.assign(valeurs, v)
    initiale.value = JSON.stringify(v)
    ids.value = index
  }
  catch (e) {
    erreur.value = `Objectifs indisponibles. ${messageUtilisateur(e)}`
  }
  finally {
    chargement.value = false
  }
}

function reinitialiser() {
  Object.assign(valeurs, JSON.parse(initiale.value))
}

/** Remplit la grille avec les objectifs du trimestre précédent (rien n'est enregistré). */
async function reprendrePrecedent() {
  reprise.value = true
  try {
    const p = trimestrePrecedent(periode.value)
    const { v } = await lire(p.annee, p.trimestre)
    const n = toutes.reduce((acc, l) => acc + CANAUX.filter(c => v[l.cle][c.code]).length, 0)
    if (!n) {
      toast.add({ title: `Aucun objectif au ${libellePrecedent.value}`, description: 'La grille n’a pas changé.', color: 'orange' })
      return
    }
    Object.assign(valeurs, v)
    toast.add({ title: `Objectifs du ${libellePrecedent.value} repris`, description: `${n} case(s) remplie(s). Vérifiez puis enregistrez.`, color: 'green' })
  }
  catch (e) {
    toast.add({ title: 'Reprise impossible', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    reprise.value = false
  }
}

/** Abandonner les saisies non enregistrées ? (vrai s'il n'y en a pas) */
async function abandonAccepte(): Promise<boolean> {
  if (!modifie.value) return true
  return demanderConfirmation({
    titre: `Abandonner les modifications du ${libelleTrimestre.value} ?`,
    message: 'Les objectifs saisis et pas encore enregistrés seront perdus.',
    libelleAction: 'Abandonner les modifications',
    libelleRetour: 'Continuer la saisie',
  })
}

async function enregistrer() {
  enregistrement.value = true
  try {
    const avant = JSON.parse(initiale.value) as Valeurs
    const ajouts: any[] = []
    const majs: { id: number, cible: number }[] = []
    const suppressions: number[] = []
    for (const l of toutes) {
      for (const c of CANAUX) {
        const v = String(valeurs[l.cle][c.code]).trim()
        const id = ids.value[cleCase(l.cle, c.code)]
        if (v === String(avant[l.cle][c.code]).trim() && (v === '' || id)) continue
        if (!v) { if (id) suppressions.push(id); continue }
        const cible = Math.round(nombre(v) * 100) / 10000
        if (id) majs.push({ id, cible })
        else ajouts.push({ annee: periode.value.annee, trimestre: periode.value.trimestre, canal: c.code, indicateur: l.indicateur, reference_produit_id: l.reference_produit_id, categorie: l.categorie, cible })
      }
    }
    if (suppressions.length) {
      const { error } = await (supabase.from('objectif_disponibilite') as any).delete().in('id', suppressions)
      if (error) throw error
    }
    for (const m of majs) {
      const { error } = await (supabase.from('objectif_disponibilite') as any).update({ cible: m.cible }).eq('id', m.id)
      if (error) throw error
    }
    if (ajouts.length) {
      const { error } = await (supabase.from('objectif_disponibilite') as any).insert(ajouts)
      if (error) throw error
    }
    await charger()
    toast.add({ title: 'Objectifs enregistrés', description: `${libelleTrimestre.value} : ${ajouts.length + majs.length} case(s) enregistrée(s), ${suppressions.length} objectif(s) retiré(s).`, color: 'green' })
  }
  catch (e) {
    toast.add({ title: 'Objectifs non enregistrés', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    enregistrement.value = false
  }
}

// Changement de trimestre : on demande avant de perdre des saisies. Le menu
// revient d'abord au trimestre saisi ; on n'avance qu'après accord.
let ignorer = false
watch(cle, async (nouvelle, ancienne) => {
  if (ignorer) { ignorer = false; return }
  if (modifie.value) {
    ignorer = true
    cle.value = ancienne
    if (!(await abandonAccepte())) return
    reinitialiser()
    cle.value = nouvelle
    return
  }
  await charger()
})

// Autre liste des référentiels ou autre page : même protection.
onBeforeRouteUpdate(async (to, from) => (to.query.liste === from.query.liste ? true : abandonAccepte()))
onBeforeRouteLeave(() => abandonAccepte())
function avantFermeture(e: BeforeUnloadEvent) {
  if (!modifie.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => {
  window.addEventListener('beforeunload', avantFermeture)
  void charger()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', avantFermeture))
</script>
