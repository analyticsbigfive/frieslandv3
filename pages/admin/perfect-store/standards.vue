<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Standards Perfect Store</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Seuils de tier (gating) et pondérations du score composite. Valeurs par défaut à valider par le category management.
      </p>
    </div>

    <div v-if="!isAdmin" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
      Lecture seule : l'édition des seuils/pondérations est réservée à l'admin.
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-red" />
    </div>

    <template v-else>
      <!-- Seuils de tier (gating conjonctif) -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Seuils par tier (OSA / assortiment / visibilité minimums)</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OSA min</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assort min</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Visi min</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Promo min</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="t in tiers" :key="t.ps_tier">
                <td class="px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100">{{ t.ps_tier }}</td>
                <td class="px-4 py-2.5 text-center"><PctInput v-model="t.osa_min" :disabled="!isAdmin" @change="saveTier(t)" /></td>
                <td class="px-4 py-2.5 text-center"><PctInput v-model="t.assort_min" :disabled="!isAdmin" @change="saveTier(t)" /></td>
                <td class="px-4 py-2.5 text-center"><PctInput v-model="t.visi_min" :disabled="!isAdmin" @change="saveTier(t)" /></td>
                <td class="px-4 py-2.5 text-center text-xs text-gray-400">{{ t.promo_min == null ? 'off' : t.promo_min }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="px-5 py-2 text-xs text-gray-400">Valeurs entre 0 et 1 (ex. 0.95 = 95%). Promo désactivée par défaut.</p>
      </div>

      <!-- Pondérations du score composite -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-3">
        <h2 class="font-bold text-gray-900 dark:text-gray-100">Pondérations du score composite</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label class="text-sm"><span class="block text-gray-500 dark:text-gray-400 mb-1">OSA linéaire</span><PctInput v-model="score.w_osa_lineaire" :disabled="!isAdmin" /></label>
          <label class="text-sm"><span class="block text-gray-500 dark:text-gray-400 mb-1">OSA pondérée</span><PctInput v-model="score.w_osa_pondere" :disabled="!isAdmin" /></label>
          <label class="text-sm"><span class="block text-gray-500 dark:text-gray-400 mb-1">Assortiment</span><PctInput v-model="score.w_assortiment" :disabled="!isAdmin" /></label>
          <label class="text-sm"><span class="block text-gray-500 dark:text-gray-400 mb-1">Visibilité</span><PctInput v-model="score.w_visibilite" :disabled="!isAdmin" /></label>
        </div>
        <div class="flex items-center justify-between pt-2">
          <span class="text-xs" :class="Math.abs(sommePoids - 1) < 0.001 ? 'text-emerald-600' : 'text-amber-600'">
            Somme = {{ sommePoids.toFixed(2) }} {{ Math.abs(sommePoids - 1) < 0.001 ? '✓' : '(idéalement 1.00)' }}
          </span>
          <UButton v-if="isAdmin" size="sm" class="bg-fc-red" :loading="savingScore" @click="saveScore">Enregistrer pondérations</UButton>
        </div>
      </div>

      <!-- Standards de visibilité (PLV requise) -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Standards de visibilité (PLV requise)</h2>
          <div class="flex items-center gap-2">
            <USelectMenu v-model="visGroupFilter" :options="visGroupOptions" size="xs" class="w-44" />
            <UButton v-if="isAdmin" size="xs" icon="i-heroicons-plus" class="bg-fc-red" @click="openVisAdd">Ajouter</UButton>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Groupe</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Zone</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Élément PLV</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Requis</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="(v, i) in filteredVis" :key="i" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ v.standard_group }}</td>
                <td class="px-4 py-2"><UBadge size="xs" variant="soft" color="blue">{{ v.ps_tier }}</UBadge></td>
                <td class="px-4 py-2 text-gray-500 dark:text-gray-400">{{ v.zone }}</td>
                <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ v.element_key }}</td>
                <td class="px-4 py-2 text-center">{{ v.is_required ? '✓' : '—' }}</td>
                <td class="px-4 py-2 text-center">
                  <button v-if="isAdmin" class="text-red-400 hover:text-red-600" @click="removeVis(v)"><UIcon name="i-heroicons-trash" class="w-4 h-4" /></button>
                </td>
              </tr>
              <tr v-if="!filteredVis.length"><td colspan="6" class="px-4 py-6 text-center text-xs text-gray-400">Aucun standard de visibilité pour ce groupe. Ajoute les éléments PLV requis par tier.</td></tr>
            </tbody>
          </table>
        </div>
        <p class="px-5 py-2 text-xs text-gray-400">Définis quels éléments PLV (poster, sign_board, reglettes…) sont requis par groupe × niveau Perfect Store × zone. Clés alignées sur <code>data.visibilite.&lt;zone&gt;.&lt;element_key&gt;</code>.</p>
      </div>
    </template>

    <!-- Modal ajout visibilité -->
    <UModal v-model="showVis">
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Ajouter un standard de visibilité</h3>
        <UFormGroup label="Groupe standard *"><UInput v-model="visForm.standard_group" placeholder="ex. BOUTIQUE" /></UFormGroup>
        <UFormGroup label="Niveau Perfect Store *"><USelectMenu v-model="visForm.ps_tier" :options="['FLAGSHIP', 'VIP', 'CORE', 'BASIC']" /></UFormGroup>
        <UFormGroup label="Zone *"><USelectMenu v-model="visForm.zone" :options="['exterieure', 'interieure']" /></UFormGroup>
        <UFormGroup label="Élément PLV (clé) *"><UInput v-model="visForm.element_key" placeholder="ex. poster, sign_board, reglettes" /></UFormGroup>
        <UFormGroup label="Requis"><ToggleYesNo v-model="visForm.is_required" /></UFormGroup>
        <div class="flex justify-end gap-2 pt-2 border-t">
          <UButton variant="ghost" @click="showVis = false">Annuler</UButton>
          <UButton class="bg-fc-red" :loading="savingVis" :disabled="!visCanSave" @click="saveVis">Ajouter</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const toast = useToast()
const isAdmin = computed(() => authStore.isAdmin)

const loading = ref(true)
const savingScore = ref(false)
const tiers = ref<any[]>([])
const score = ref<any>({ w_osa_lineaire: 0.1, w_osa_pondere: 0.45, w_assortiment: 0.15, w_visibilite: 0.3 })

const sommePoids = computed(() =>
  Number(score.value.w_osa_lineaire) + Number(score.value.w_osa_pondere)
  + Number(score.value.w_assortiment) + Number(score.value.w_visibilite),
)

async function load() {
  loading.value = true
  try {
    const [t, s] = await Promise.all([
      supabase.from('perfect_store_tier_config').select('*').order('rang', { ascending: false }),
      supabase.from('perfect_store_score_config').select('*').eq('id', 1).maybeSingle(),
    ])
    tiers.value = t.data || []
    if (s.data) score.value = s.data
  } finally {
    loading.value = false
  }
}

async function saveTier(t: any) {
  if (!isAdmin.value) return
  const { error } = await supabase.from('perfect_store_tier_config')
    .update({ osa_min: t.osa_min, assort_min: t.assort_min, visi_min: t.visi_min })
    .eq('ps_tier', t.ps_tier)
  if (error) toast.add({ title: 'Erreur', description: error.message, color: 'red' })
  else toast.add({ title: `Tier ${t.ps_tier} mis à jour`, color: 'green' })
}

async function saveScore() {
  savingScore.value = true
  try {
    const { error } = await supabase.from('perfect_store_score_config').update({
      w_osa_lineaire: score.value.w_osa_lineaire,
      w_osa_pondere: score.value.w_osa_pondere,
      w_assortiment: score.value.w_assortiment,
      w_visibilite: score.value.w_visibilite,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    if (error) throw error
    toast.add({ title: 'Pondérations enregistrées', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  } finally {
    savingScore.value = false
  }
}

onMounted(load)
</script>
