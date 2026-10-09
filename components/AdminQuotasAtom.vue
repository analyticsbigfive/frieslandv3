<template>
  <section class="admin-surface space-y-5 p-5" aria-labelledby="titre-grille-quotas">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="max-w-2xl">
        <h3 id="titre-grille-quotas" class="text-base font-semibold text-slate-900 dark:text-white">Grille des quotas (programme merchandiser)</h3>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Nombre de PDV par canal et par jour dans la tournée de chaque merchandiser d’agence (Atom BTL, agence North…), commune aux directions South et North.
          Chaque PDV n’est proposé qu’une fois par mois. Quand un canal manque de PDV, les places restantes sont complétées par des boutiques.
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap gap-2">
        <UButton color="gray" variant="ghost" :disabled="!modifie || enregistrement" @click="reinitialiser">Annuler les changements</UButton>
        <UButton icon="i-heroicons-check" :loading="enregistrement" :disabled="!modifie || !valide" @click="enregistrer">
          Enregistrer la grille
        </UButton>
      </div>
    </div>

    <div v-if="erreur" class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      {{ erreur }}
    </div>

    <div class="overflow-x-auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th scope="col">Canal</th>
            <th v-for="j in JOURS" :key="j.num" scope="col" class="!px-2 !text-right">
              <abbr :title="j.long" class="no-underline">{{ j.court }}</abbr>
            </th>
            <th scope="col" class="!text-right">Semaine</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="canal in CANAUX" :key="canal">
            <th scope="row" class="!text-sm !font-semibold !text-slate-900 dark:!text-white">{{ canal }}</th>
            <td v-for="j in JOURS" :key="j.num" class="!px-2 !py-2 text-right">
              <UInput
                v-model.number="grille[canal][j.num]"
                type="number"
                :min="0"
                :max="100"
                size="sm"
                class="ml-auto w-16"
                :aria-label="`${canal} le ${j.long}`"
                :color="valeurValide(grille[canal][j.num]) ? 'white' : 'red'"
                :ui="{ base: 'text-right tabular-nums' }"
              />
            </td>
            <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ totalCanal(canal) }}</td>
          </tr>
        </tbody>
        <tfoot class="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/50">
          <tr>
            <th scope="row" class="!text-sm !font-semibold !text-slate-900 dark:!text-white">PDV par jour</th>
            <td v-for="j in JOURS" :key="j.num" class="!px-2 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ totalJour(j.num) }}</td>
            <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ totalSemaine }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p v-if="!valide" class="text-sm text-red-700 dark:text-red-300" role="alert">Chaque case doit contenir un nombre entier entre 0 et 100.</p>
    <p class="text-sm text-slate-600 dark:text-slate-300">Dimanche : pas de tournée. Le canal d’un PDV vient de sa sous-catégorie (liste « Canal des quotas »).</p>

    <div class="rounded-md border border-slate-200 p-4 dark:border-slate-700">
      <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Appliquer aux tournées à venir</h4>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Une grille enregistrée vaut pour les tournées générées ensuite. Les tournées des 7 prochains jours déjà générées et pas encore
        commencées peuvent être recalculées tout de suite (celle du jour n’est jamais modifiée).
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <UButton variant="outline" icon="i-heroicons-arrow-path" :loading="application" :disabled="modifie" @click="appliquer">
          Recalculer les tournées à venir des agences
        </UButton>
        <span v-if="modifie" class="text-sm text-amber-800 dark:text-amber-300">Enregistrez d’abord la grille.</span>
        <span v-if="progression" class="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">{{ progression }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { messageUtilisateur } from '~/utils/supabaseErrors'

const supabase = useSupabaseClient()
const toast = useToast()
const { charger: chargerAgences } = useAgences()

const CANAUX = ['Superette', 'Boutique', 'Aboki & Kiosque', 'Pushcart', 'Porridge']
const JOURS = [
  { num: 1, court: 'Lun', long: 'lundi' }, { num: 2, court: 'Mar', long: 'mardi' }, { num: 3, court: 'Mer', long: 'mercredi' },
  { num: 4, court: 'Jeu', long: 'jeudi' }, { num: 5, court: 'Ven', long: 'vendredi' }, { num: 6, court: 'Sam', long: 'samedi' },
]

const vide = () => Object.fromEntries(CANAUX.map(c => [c, Object.fromEntries(JOURS.map(j => [j.num, 0]))])) as Record<string, Record<number, number>>
const grille = reactive(vide())
const initiale = ref(JSON.stringify(vide()))
const erreur = ref('')
const enregistrement = ref(false)
const application = ref(false)
const progression = ref('')

const valeurValide = (v: any) => Number.isInteger(v) && v >= 0 && v <= 100
const valide = computed(() => CANAUX.every(c => JOURS.every(j => valeurValide(grille[c][j.num]))))
const modifie = computed(() => JSON.stringify(grille) !== initiale.value)
const totalCanal = (c: string) => JOURS.reduce((n, j) => n + (Number(grille[c][j.num]) || 0), 0)
const totalJour = (num: number) => CANAUX.reduce((n, c) => n + (Number(grille[c][num]) || 0), 0)
const totalSemaine = computed(() => CANAUX.reduce((n, c) => n + totalCanal(c), 0))

async function charger() {
  erreur.value = ''
  const { data, error } = await supabase.from('routing_quota_canal').select('canal, jour_semaine, quota')
  if (error) { erreur.value = `Grille indisponible. ${messageUtilisateur(error)}`; return }
  const g = vide()
  for (const r of (data || []) as any[]) if (g[r.canal] && r.jour_semaine in g[r.canal]) g[r.canal][r.jour_semaine] = r.quota
  Object.assign(grille, g)
  initiale.value = JSON.stringify(g)
}

function reinitialiser() {
  Object.assign(grille, JSON.parse(initiale.value))
}

async function enregistrer() {
  enregistrement.value = true
  try {
    const lignes = CANAUX.flatMap(canal => JOURS.map(j => ({ canal, jour_semaine: j.num, quota: Number(grille[canal][j.num]) || 0 })))
    const { error } = await (supabase.from('routing_quota_canal') as any).upsert(lignes, { onConflict: 'canal,jour_semaine' })
    if (error) throw error
    initiale.value = JSON.stringify(grille)
    toast.add({ title: 'Grille enregistrée', description: 'Elle s’applique aux prochaines tournées générées.', color: 'green' })
  }
  catch (e: any) {
    toast.add({ title: 'Grille non enregistrée', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    enregistrement.value = false
  }
}

async function appliquer() {
  if (!confirm('Recalculer les tournées des merchandisers d’agence pour les 7 prochains jours ?\n\nLes tournées qui n’ont pas commencé sont refaites avec la grille enregistrée ; celle du jour ne change pas.')) return
  application.value = true
  progression.value = ''
  try {
    // Merchandisers des agences « programme » (Référentiels › Agences).
    const codes = (await chargerAgences(true)).filter(a => a.programme && a.actif).map(a => a.code)
    const { data: agents, error } = await supabase.from('profiles').select('id, nom')
      .in('employeur', codes).eq('role', 'merchandiser').neq('is_active', false).order('nom')
    if (error) throw error
    let supprimees = 0
    let creees = 0
    const liste = (agents || []) as any[]
    for (const [i, a] of liste.entries()) {
      progression.value = `Recalcul : ${i + 1} sur ${liste.length} (${a.nom})`
      const { data, error: e } = await (supabase.rpc as any)('recalculer_tournees_a_venir', { p_user_id: a.id, p_jours: 7 })
      if (e) throw new Error(`Arrêté sur ${a.nom}. ${messageUtilisateur(e)}`)
      supprimees += data?.supprimees || 0
      creees += data?.creees || 0
    }
    progression.value = `${liste.length} merchandiser${liste.length > 1 ? 's' : ''} : ${supprimees} tournée${supprimees > 1 ? 's' : ''} recalculée${supprimees > 1 ? 's' : ''}, ${creees} générée${creees > 1 ? 's' : ''}.`
    toast.add({ title: 'Tournées recalculées', description: progression.value, color: 'green' })
  }
  catch (e: any) {
    toast.add({ title: 'Recalcul interrompu', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    application.value = false
  }
}

onMounted(charger)
</script>
