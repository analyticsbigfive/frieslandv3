<template>
  <div class="space-y-5">
    <!-- Tournées -->
    <section class="admin-surface space-y-3 p-5" aria-labelledby="titre-maint-tournees">
      <h3 id="titre-maint-tournees" class="text-base font-semibold text-slate-900 dark:text-white">Tournées</h3>
      <p class="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        Les tournées sont générées chaque nuit pour les 7 jours suivants, à partir des règles (Routing › Règles), des quotas
        et du routing mensuel des agences. Après un changement, vous pouvez les recalculer tout de suite : seules les tournées à venir qui
        n’ont pas commencé sont refaites, celle du jour n’est jamais modifiée.
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <UFormGroup label="Merchandisers concernés" size="sm" class="w-full sm:w-56">
          <USelectMenu v-model="employeur" :options="EMPLOYEURS" option-attribute="label" value-attribute="value" class="w-full" />
        </UFormGroup>
        <UButton variant="outline" icon="i-heroicons-arrow-path" :loading="enCours === 'recalcul'" :disabled="!!enCours" @click="recalculer">
          Recalculer les tournées à venir
        </UButton>
        <UButton variant="outline" icon="i-heroicons-calendar-days" :loading="enCours === 'pregeneration'" :disabled="!!enCours" @click="pregenerer">
          Générer les tournées manquantes (7 jours)
        </UButton>
      </div>
      <p v-if="progression" class="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">{{ progression }}</p>
    </section>

    <!-- Statistiques -->
    <section class="admin-surface space-y-3 p-5" aria-labelledby="titre-maint-stats">
      <h3 id="titre-maint-stats" class="text-base font-semibold text-slate-900 dark:text-white">Statistiques des tableaux de bord</h3>
      <p class="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        Recalculées chaque heure. Après un import ou une correction importante, vous pouvez lancer le calcul tout de suite :
        il tourne en arrière-plan et les tableaux de bord sont à jour moins d’une minute plus tard.
      </p>
      <UButton variant="outline" icon="i-heroicons-chart-bar" :loading="enCours === 'stats'" :disabled="!!enCours" @click="rafraichirStats">
        Rafraîchir les statistiques maintenant
      </UButton>
    </section>

    <!-- Tâches planifiées -->
    <section class="admin-surface space-y-3 p-5" aria-labelledby="titre-maint-taches">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 id="titre-maint-taches" class="text-base font-semibold text-slate-900 dark:text-white">Tâches planifiées</h3>
        <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-arrow-path" :loading="chargementTaches" @click="chargerTaches">Actualiser</UButton>
      </div>
      <div class="max-w-3xl space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          L’horaire s’écrit avec cinq valeurs séparées par une espace : minute, heure, jour du mois, mois, jour de la semaine
          (0 = dimanche, 1 = lundi…). Une étoile « * » veut dire « tous ». Les heures sont celles d’Abidjan.
        </p>
        <ul class="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <li v-for="ex in EXEMPLES_HORAIRE" :key="ex.cron">
            <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800 dark:bg-slate-700 dark:text-slate-100">{{ ex.cron }}</code>
            : {{ ex.sens }}
          </li>
        </ul>
      </div>
      <p v-if="erreurTaches" class="text-sm text-amber-800 dark:text-amber-300">{{ erreurTaches }}</p>
      <div v-else class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Tâche</th>
              <th scope="col">Horaire</th>
              <th scope="col">Dernier passage</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in taches" :key="t.nom">
              <td>
                <p class="font-semibold text-slate-900 dark:text-white">{{ libelleTache(t.nom) }}</p>
                <UBadge v-if="!t.active" color="gray" variant="soft" size="xs" class="mt-1">Désactivée</UBadge>
              </td>
              <td>
                <div class="flex flex-wrap items-center gap-2">
                  <UInput v-model="horaires[t.nom]" size="sm" class="w-36 font-mono" :aria-label="`Horaire : ${libelleTache(t.nom)}`" />
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="horaires[t.nom] === t.horaire"
                    :loading="enCours === `horaire-${t.nom}`"
                    :aria-label="`Enregistrer l’horaire : ${libelleTache(t.nom)}`"
                    @click="enregistrerHoraire(t.nom)"
                  >
                    Enregistrer
                  </UButton>
                </div>
                <p v-if="cronEnClair(horaires[t.nom])" class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ cronEnClair(horaires[t.nom]) }}</p>
              </td>
              <td>
                <template v-if="t.dernier_debut">
                  <UBadge :color="t.dernier_statut === 'succeeded' ? 'green' : t.dernier_statut === 'running' ? 'blue' : 'red'" variant="soft" size="xs">
                    {{ STATUTS[t.dernier_statut] || t.dernier_statut }}
                  </UBadge>
                  <span class="ml-2 tabular-nums text-slate-600 dark:text-slate-300">{{ new Date(t.dernier_debut).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }}</span>
                  <p v-if="t.dernier_statut === 'failed'" class="mt-1 max-w-xs text-xs text-red-700 dark:text-red-300">{{ t.messageAffiche }}</p>
                </template>
                <span v-else class="text-slate-600 dark:text-slate-300">Pas encore exécutée</span>
              </td>
            </tr>
            <tr v-if="!taches.length && !chargementTaches">
              <td colspan="3" class="py-6 text-center text-slate-600 dark:text-slate-300">Aucune tâche planifiée trouvée sur le serveur. Prévenez l’administrateur technique.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { messageUtilisateur } from '~/utils/supabaseErrors'

const supabase = useSupabaseClient()
const toast = useToast()

// Agences (Référentiels › Agences), puis « Tous ».
const { options: optionsAgences, charger: chargerAgences } = useAgences()
const EMPLOYEURS = computed(() => [...optionsAgences.value, { value: 'tous', label: 'Toutes les agences' }])
void chargerAgences()
const LIBELLES: Record<string, string> = {
  pregenerer_tournees: 'Génération des tournées (7 jours)',
  refresh_stats_dashboard: 'Statistiques des tableaux de bord',
}
/** Nom lisible d'une tâche ; une tâche sans libellé garde un nom en mots, sans « _ ». */
function libelleTache(nom: string) {
  if (LIBELLES[nom]) return LIBELLES[nom]
  const mots = String(nom || '').replace(/_/g, ' ').trim()
  return mots ? mots.charAt(0).toUpperCase() + mots.slice(1) : 'Tâche sans nom'
}
const STATUTS: Record<string, string> = { succeeded: 'Réussie', failed: 'Échec', running: 'En cours', starting: 'Démarrage' }

// Aide à la saisie de l'horaire (format cron), sans changer la saisie.
const EXEMPLES_HORAIRE = [
  { cron: '0 5 * * *', sens: 'tous les jours à 5 h' },
  { cron: '30 2 * * *', sens: 'tous les jours à 2 h 30' },
  { cron: '0 * * * *', sens: 'toutes les heures, à l’heure pile' },
  { cron: '0 6 * * 1', sens: 'chaque lundi à 6 h' },
]
const JOURS_CRON = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const heureEnClair = (h: number, m: number) => `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`
/** Traduit les horaires simples (« 0 5 * * * » → « Tous les jours à 5 h ») ; null sinon. */
function cronEnClair(expr: string | undefined): string | null {
  const p = String(expr || '').trim().split(/\s+/)
  if (p.length !== 5) return null
  const [mi, h, jm, mo, js] = p
  const entier = (v: string) => /^\d+$/.test(v) ? Number(v) : null
  const m = entier(mi)
  const hh = entier(h)
  if (jm !== '*' || mo !== '*') return null
  if (m != null && hh != null && js === '*') return `Tous les jours à ${heureEnClair(hh, m)}`
  if (m != null && hh != null && entier(js) != null && JOURS_CRON[Number(js)]) return `Chaque ${JOURS_CRON[Number(js)]} à ${heureEnClair(hh, m)}`
  if (m != null && h === '*' && js === '*') return m ? `Toutes les heures, à la minute ${m}` : 'Toutes les heures, à l’heure pile'
  const pasH = /^\*\/(\d+)$/.exec(h)
  if (m != null && pasH && js === '*') return `Toutes les ${pasH[1]} heures`
  const pasM = /^\*\/(\d+)$/.exec(mi)
  if (pasM && h === '*' && js === '*') return `Toutes les ${pasM[1]} minutes`
  return null
}

const employeur = ref('atom')
const enCours = ref<string | null>(null)
const progression = ref('')
const taches = ref<any[]>([])
const horaires = reactive<Record<string, string>>({})
const chargementTaches = ref(false)
const erreurTaches = ref('')

const jourIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

async function merchandisers() {
  let q = supabase.from('profiles').select('id, nom').eq('role', 'merchandiser').neq('is_active', false).order('nom')
  if (employeur.value !== 'tous') q = q.eq('employeur', employeur.value)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as { id: string, nom: string }[]
}

async function recalculer() {
  const qui = employeur.value === 'tous' ? 'de tous les merchandisers' : `des merchandisers de ${EMPLOYEURS.value.find(e => e.value === employeur.value)?.label || employeur.value}`
  if (!confirm(`Recalculer les tournées ${qui} pour les 7 prochains jours ?\n\nLes tournées qui n’ont pas commencé sont refaites ; celle du jour ne change pas.`)) return
  enCours.value = 'recalcul'
  try {
    const agents = await merchandisers()
    let supprimees = 0
    let creees = 0
    for (const [i, a] of agents.entries()) {
      progression.value = `Recalcul : ${i + 1} sur ${agents.length} (${a.nom})`
      const { data, error } = await (supabase.rpc as any)('recalculer_tournees_a_venir', { p_user_id: a.id, p_jours: 7 })
      if (error) throw new Error(`Arrêté sur ${a.nom}. ${messageUtilisateur(error)}`)
      supprimees += data?.supprimees || 0
      creees += data?.creees || 0
    }
    progression.value = `${agents.length} merchandiser${agents.length > 1 ? 's' : ''} : ${supprimees} tournée${supprimees > 1 ? 's' : ''} recalculée${supprimees > 1 ? 's' : ''}, ${creees} générée${creees > 1 ? 's' : ''}.`
    toast.add({ title: 'Tournées recalculées', description: progression.value, color: 'green' })
  }
  catch (e: any) {
    toast.add({ title: 'Recalcul interrompu', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    enCours.value = null
  }
}

async function pregenerer() {
  enCours.value = 'pregeneration'
  try {
    const agents = await merchandisers()
    const debut = new Date()
    const fin = new Date()
    fin.setDate(fin.getDate() + 6)
    let creees = 0
    for (const [i, a] of agents.entries()) {
      progression.value = `Génération : ${i + 1} sur ${agents.length} (${a.nom})`
      const { data, error } = await (supabase.rpc as any)('materialiser_routings_periode', { p_user_id: a.id, p_date_debut: jourIso(debut), p_date_fin: jourIso(fin) })
      if (error) throw new Error(`Arrêté sur ${a.nom}. ${messageUtilisateur(error)}`)
      creees += data || 0
    }
    progression.value = `${agents.length} merchandiser${agents.length > 1 ? 's' : ''} : ${creees} tournée${creees > 1 ? 's' : ''} générée${creees > 1 ? 's' : ''} (les tournées existantes ne changent pas).`
    toast.add({ title: 'Tournées générées', description: progression.value, color: 'green' })
  }
  catch (e: any) {
    toast.add({ title: 'Génération interrompue', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    enCours.value = null
  }
}

async function rafraichirStats() {
  enCours.value = 'stats'
  try {
    const { error } = await (supabase.rpc as any)('programmer_rafraichissement_stats')
    if (error) throw error
    toast.add({ title: 'Calcul lancé', description: 'Les tableaux de bord seront à jour dans moins d’une minute.', color: 'green' })
    setTimeout(chargerTaches, 45000)
  }
  catch (e: any) {
    toast.add({ title: 'Calcul non lancé', description: messageUtilisateur(e), color: 'red' })
  }
  finally {
    enCours.value = null
  }
}

async function chargerTaches() {
  chargementTaches.value = true
  erreurTaches.value = ''
  const { data, error } = await (supabase.rpc as any)('etat_taches_planifiees')
  chargementTaches.value = false
  if (error) { erreurTaches.value = `État des tâches indisponible. ${messageUtilisateur(error)}`; return }
  // Le message d'échec vient du planificateur de la base : traduit pour l'affichage.
  taches.value = (data || []).map((t: any) => ({
    ...t,
    messageAffiche: t.dernier_statut === 'failed'
      ? messageUtilisateur({ message: t.dernier_message }, 'La dernière exécution a échoué. Prévenez l’administrateur technique si cela se répète.')
      : '',
  }))
  for (const t of taches.value) horaires[t.nom] = t.horaire
}

async function enregistrerHoraire(nom: string) {
  enCours.value = `horaire-${nom}`
  try {
    const { error } = await (supabase.rpc as any)('modifier_horaire_tache', { p_nom: nom, p_horaire: horaires[nom] })
    if (error) throw error
    toast.add({ title: 'Horaire enregistré', description: `${libelleTache(nom)} : ${cronEnClair(horaires[nom]) || horaires[nom]}`, color: 'green' })
    await chargerTaches()
  }
  catch (e: any) {
    toast.add({ title: 'Horaire non enregistré', description: messageUtilisateur(e, 'Horaire refusé. Vérifiez qu’il contient bien cinq valeurs, par exemple « 0 5 * * * ».'), color: 'red' })
  }
  finally {
    enCours.value = null
  }
}

onMounted(chargerTaches)
</script>
