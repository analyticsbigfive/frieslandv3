<template>
  <div class="space-y-5">
    <!-- Tournées -->
    <section class="admin-surface space-y-3 p-5">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Tournées</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Les tournées sont générées chaque nuit pour les 7 jours suivants, à partir des règles (Routing › Règles), des quotas
        et du routing mensuel des agences. Après un changement, on peut les recalculer tout de suite : seules les tournées à venir qui
        n’ont pas commencé sont refaites, celle du jour n’est jamais modifiée.
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <UFormGroup label="Merchandisers" size="sm">
          <USelectMenu v-model="employeur" :options="EMPLOYEURS" option-attribute="label" value-attribute="value" class="w-56" />
        </UFormGroup>
        <UButton color="amber" variant="soft" icon="i-heroicons-arrow-path" :loading="enCours === 'recalcul'" :disabled="!!enCours" @click="recalculer">
          Recalculer les tournées à venir
        </UButton>
        <UButton color="gray" variant="soft" icon="i-heroicons-calendar-days" :loading="enCours === 'pregeneration'" :disabled="!!enCours" @click="pregenerer">
          Générer les tournées manquantes (7 jours)
        </UButton>
      </div>
      <p v-if="progression" class="text-xs text-gray-500 dark:text-gray-400">{{ progression }}</p>
    </section>

    <!-- Statistiques -->
    <section class="admin-surface space-y-3 p-5">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Statistiques des tableaux de bord</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Recalculées chaque heure. Après un import ou une correction importante, on peut lancer le calcul tout de suite :
        il tourne en arrière-plan et les tableaux de bord sont à jour moins d’une minute plus tard.
      </p>
      <UButton color="gray" variant="soft" icon="i-heroicons-chart-bar" :loading="enCours === 'stats'" :disabled="!!enCours" @click="rafraichirStats">
        Rafraîchir les statistiques maintenant
      </UButton>
    </section>

    <!-- Tâches planifiées -->
    <section class="admin-surface space-y-3 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Tâches planifiées</h2>
        <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-arrow-path" :loading="chargementTaches" @click="chargerTaches">Actualiser</UButton>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Horaire au format cron (minute, heure, jour, mois, jour de la semaine), en heure d’Abidjan (UTC). Exemple : « 0 3 * * * » = tous les jours à 3 h.
      </p>
      <p v-if="erreurTaches" class="text-sm text-amber-700 dark:text-amber-300">{{ erreurTaches }}</p>
      <div v-else class="overflow-x-auto">
        <table class="admin-table">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500">Tâche</th>
              <th class="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500">Horaire</th>
              <th class="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500">Dernier passage</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="t in taches" :key="t.nom">
              <td class="px-4 py-2.5 text-sm">
                <p class="font-semibold text-gray-900 dark:text-gray-100">{{ LIBELLES[t.nom] || t.nom }}</p>
                <p class="font-mono text-xs text-gray-400">{{ t.nom }}<span v-if="!t.active"> · désactivée</span></p>
              </td>
              <td class="px-4 py-2.5 text-sm">
                <div class="flex items-center gap-2">
                  <UInput v-model="horaires[t.nom]" size="sm" class="w-36 font-mono" />
                  <UButton size="xs" class="bg-fc-blue" :disabled="horaires[t.nom] === t.horaire" :loading="enCours === `horaire-${t.nom}`" @click="enregistrerHoraire(t.nom)">
                    Enregistrer
                  </UButton>
                </div>
              </td>
              <td class="px-4 py-2.5 text-sm">
                <template v-if="t.dernier_debut">
                  <UBadge :color="t.dernier_statut === 'succeeded' ? 'green' : t.dernier_statut === 'running' ? 'blue' : 'red'" variant="soft" size="xs">
                    {{ STATUTS[t.dernier_statut] || t.dernier_statut }}
                  </UBadge>
                  <span class="ml-2 text-gray-600 dark:text-gray-300">{{ new Date(t.dernier_debut).toLocaleString('fr-FR') }}</span>
                  <p v-if="t.dernier_statut === 'failed'" class="mt-1 text-xs text-red-600">{{ t.dernier_message }}</p>
                </template>
                <span v-else class="text-gray-400">Pas encore exécutée</span>
              </td>
            </tr>
            <tr v-if="!taches.length && !chargementTaches">
              <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-400">Aucune tâche trouvée.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const toast = useToast()

// Agences (Référentiels › Agences), puis « Tous ».
const { options: optionsAgences, charger: chargerAgences } = useAgences()
const EMPLOYEURS = computed(() => [...optionsAgences.value, { value: 'tous', label: 'Tous' }])
void chargerAgences()
const LIBELLES: Record<string, string> = {
  pregenerer_tournees: 'Génération des tournées (7 jours)',
  refresh_stats_dashboard: 'Statistiques des tableaux de bord',
}
const STATUTS: Record<string, string> = { succeeded: 'Réussie', failed: 'Échec', running: 'En cours', starting: 'Démarrage' }

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
  if (!confirm('Recalculer les tournées des 7 prochains jours qui n’ont pas commencé ?')) return
  enCours.value = 'recalcul'
  try {
    const agents = await merchandisers()
    let supprimees = 0
    let creees = 0
    for (const [i, a] of agents.entries()) {
      progression.value = `Recalcul ${i + 1} / ${agents.length} — ${a.nom}`
      const { data, error } = await (supabase.rpc as any)('recalculer_tournees_a_venir', { p_user_id: a.id, p_jours: 7 })
      if (error) throw new Error(`${a.nom} : ${error.message}`)
      supprimees += data?.supprimees || 0
      creees += data?.creees || 0
    }
    progression.value = `${agents.length} merchandiser(s) : ${supprimees} tournée(s) recalculée(s), ${creees} générée(s).`
    toast.add({ title: 'Tournées recalculées', description: progression.value, color: 'green' })
  }
  catch (e: any) {
    toast.add({ title: 'Erreur', description: e.message, color: 'red' })
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
      progression.value = `Génération ${i + 1} / ${agents.length} — ${a.nom}`
      const { data, error } = await (supabase.rpc as any)('materialiser_routings_periode', { p_user_id: a.id, p_date_debut: jourIso(debut), p_date_fin: jourIso(fin) })
      if (error) throw new Error(`${a.nom} : ${error.message}`)
      creees += data || 0
    }
    progression.value = `${agents.length} merchandiser(s) : ${creees} tournée(s) générée(s) (les existantes ne changent pas).`
    toast.add({ title: 'Tournées générées', description: progression.value, color: 'green' })
  }
  catch (e: any) {
    toast.add({ title: 'Erreur', description: e.message, color: 'red' })
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
    toast.add({ title: 'Erreur', description: e.message, color: 'red' })
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
  if (error) { erreurTaches.value = `État des tâches indisponible : ${error.message}`; return }
  taches.value = data || []
  for (const t of taches.value) horaires[t.nom] = t.horaire
}

async function enregistrerHoraire(nom: string) {
  enCours.value = `horaire-${nom}`
  try {
    const { error } = await (supabase.rpc as any)('modifier_horaire_tache', { p_nom: nom, p_horaire: horaires[nom] })
    if (error) throw error
    toast.add({ title: 'Horaire enregistré', color: 'green' })
    await chargerTaches()
  }
  catch (e: any) {
    toast.add({ title: 'Erreur', description: e.message, color: 'red' })
  }
  finally {
    enCours.value = null
  }
}

onMounted(chargerTaches)
</script>
