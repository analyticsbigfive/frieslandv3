<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Produits du formulaire</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-3xl">
        Produits relevés dans le formulaire de visite, par catégorie : libellé, ordre, seuil « stock bas » et présence dans le formulaire.
        En dessous du seuil (et au-dessus de 0), un produit est marqué « stock bas » ; à 0, en rupture.
      </p>
    </div>

    <UAlert
      v-if="!migrationAppliquee"
      color="amber"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      title="Migration à appliquer"
      description="La migration 20261007130000_friesland_catalogue_releve.sql n'est pas encore appliquée : seuls les seuils sont modifiables."
    />

    <div class="rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-4 text-sm text-gray-700 dark:text-gray-300 space-y-1">
      <p><strong>La clé d'un produit est figée</strong> : c'est elle qui range les quantités dans les visites. Pour remplacer un produit, retirez-le du formulaire et ajoutez-en un nouveau.</p>
      <p>Un produit retiré disparaît du formulaire ; ses relevés passés restent dans les tableaux et l'export.</p>
      <p>Un nouveau produit ne compte au Perfect Store qu'après une <NuxtLink to="/admin/referentiels?onglet=correspondance_reference" class="text-fc-blue underline">correspondance SKU</NuxtLink>. Les catégories se gèrent dans <NuxtLink to="/admin/referentiels?onglet=categorie_releve" class="text-fc-blue underline">Référentiels › Catégories du relevé</NuxtLink>.</p>
      <p>Les téléphones reçoivent les changements à l'ouverture de l'app (version 1.0.12 et suivantes).</p>
    </div>

    <div v-if="chargement" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <template v-else>
    <div
      v-for="cat in categories"
      :key="cat.code"
      class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
      :class="cat.actif === false ? 'opacity-70' : ''"
    >
      <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: couleur(cat.code) }" />
        <h2 class="font-bold text-gray-900 dark:text-gray-100">{{ cat.libelle }}</h2>
        <span class="font-mono text-xs text-gray-400">{{ cat.code }}</span>
        <UBadge v-if="cat.actif === false" color="gray" variant="soft" size="xs">Catégorie retirée du formulaire</UBadge>
        <UBadge v-if="cat.facings" color="blue" variant="soft" size="xs">Facings en Modern Trade</UBadge>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th class="text-left font-medium px-5 py-2">Libellé affiché</th>
              <th class="text-left font-medium px-3 py-2">Clé</th>
              <th class="text-center font-medium px-3 py-2">Ordre</th>
              <th class="text-center font-medium px-3 py-2">Seuil bas</th>
              <th class="text-center font-medium px-3 py-2">Dans le formulaire</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="sku in skusDe(cat.code)" :key="sku.sku" :class="sku.actif === false ? 'bg-gray-50/70 dark:bg-gray-900/30 text-gray-400' : ''">
              <td class="px-5 py-2">
                <input
                  type="text"
                  class="w-full min-w-[12rem] h-9 px-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-fc-blue focus:outline-none disabled:opacity-60"
                  :value="sku.label || ''"
                  :disabled="!migrationAppliquee || enCours === cleDe(sku)"
                  @change="modifier(sku, { label: texte($event) })"
                >
              </td>
              <td class="px-3 py-2 font-mono text-xs text-gray-500">{{ sku.sku }}</td>
              <td class="px-3 py-2 text-center">
                <input
                  type="number"
                  min="0"
                  class="w-16 h-9 text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-fc-blue focus:outline-none disabled:opacity-60"
                  :value="sku.ordre ?? 0"
                  :disabled="!migrationAppliquee || enCours === cleDe(sku)"
                  @change="modifier(sku, { ordre: entier($event) })"
                >
              </td>
              <td class="px-3 py-2 text-center">
                <input
                  type="number"
                  min="0"
                  class="w-20 h-9 text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-fc-blue focus:outline-none disabled:opacity-60"
                  :value="sku.seuil_bas ?? 3"
                  :disabled="enCours === cleDe(sku)"
                  @change="modifier(sku, { seuil_bas: entier($event) })"
                >
              </td>
              <td class="px-3 py-2">
                <div class="flex justify-center">
                  <UToggle
                    :model-value="sku.actif !== false"
                    :disabled="!migrationAppliquee || enCours === cleDe(sku)"
                    @update:model-value="modifier(sku, { actif: $event })"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!skusDe(cat.code).length">
              <td colspan="5" class="px-5 py-4 text-sm text-gray-400">Aucun produit : la catégorie n'apparaît pas dans le formulaire.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Ajout d'un produit -->
      <div v-if="migrationAppliquee" class="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30">
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex-1 min-w-[14rem]">
            <label class="block text-xs text-gray-500 mb-1">Nouveau produit</label>
            <UInput v-model="nouveaux[cat.code].label" placeholder="ex. BR 170g" size="sm" />
          </div>
          <div class="w-24">
            <label class="block text-xs text-gray-500 mb-1">Seuil bas</label>
            <UInput v-model.number="nouveaux[cat.code].seuil" type="number" min="0" size="sm" />
          </div>
          <UButton
            size="sm"
            icon="i-heroicons-plus"
            :disabled="!nouveaux[cat.code].label.trim()"
            :loading="enCours === `nouveau:${cat.code}`"
            @click="ajouter(cat.code)"
          >
            Ajouter
          </UButton>
        </div>
        <p v-if="nouveaux[cat.code].label.trim()" class="text-xs text-gray-500 mt-2">
          Clé générée, figée après l'ajout : <span class="font-mono">{{ cleProposee(cat.code) }}</span>
        </p>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PRODUCT_CATALOG } from '~/utils/products'
import { cleSkuDepuisLibelle } from '~/utils/catalogueSku'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

interface LigneCategorie { code: string, libelle: string, actif: boolean, ordre?: number | null, facings?: boolean | null }
interface LigneSku { category: string, sku: string, label: string | null, seuil_bas: number | null, ordre: number | null, actif?: boolean | null }

const supabase = useSupabaseClient() as any
const toast = useToast()
const { charger: chargerCatalogue } = useCatalogueReleve()

const categories = ref<LigneCategorie[]>([])
const skus = ref<LigneSku[]>([])
const migrationAppliquee = ref(true)
const chargement = ref(true)
const enCours = ref<string | null>(null)
const nouveaux = reactive<Record<string, { label: string, seuil: number }>>({})

function cleDe(s: LigneSku) { return `${s.category}:${s.sku}` }
function couleur(code: string) { return PRODUCT_CATALOG.find(c => c.key === code)?.color || '#6B7280' }
function texte(e: Event) { return (e.target as HTMLInputElement).value.trim() }
function entier(e: Event) { return Math.max(0, parseInt((e.target as HTMLInputElement).value, 10) || 0) }

function skusDe(code: string) {
  return skus.value.filter(s => s.category === code)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.label || a.sku).localeCompare(String(b.label || b.sku), 'fr'))
}

function cleProposee(code: string) {
  return cleSkuDepuisLibelle(nouveaux[code]?.label || '', skusDe(code).map(s => s.sku))
}

async function charger() {
  chargement.value = true
  try {
    let cat = await supabase.from('categorie_releve').select('code, libelle, actif, ordre, facings').order('ordre')
    if (cat.error) cat = await supabase.from('categorie_releve').select('code, libelle, actif, ordre').order('ordre')
    let sk = await supabase.from('sku_thresholds').select('category, sku, label, seuil_bas, ordre, actif')
    migrationAppliquee.value = !sk.error
    if (sk.error) sk = await supabase.from('sku_thresholds').select('category, sku, label, seuil_bas, ordre')
    if (cat.error) throw cat.error
    if (sk.error) throw sk.error
    categories.value = cat.data || []
    skus.value = sk.data || []
    for (const c of categories.value) if (!nouveaux[c.code]) nouveaux[c.code] = { label: '', seuil: 3 }
  }
  catch (err: any) {
    toast.add({ title: 'Chargement impossible', description: err.message, color: 'red' })
  }
  finally {
    chargement.value = false
  }
}

async function modifier(sku: LigneSku, changement: Partial<LigneSku>) {
  if (changement.label !== undefined && !changement.label) {
    toast.add({ title: 'Libellé obligatoire', color: 'amber' })
    return
  }
  enCours.value = cleDe(sku)
  try {
    const { data, error } = await supabase.from('sku_thresholds')
      .update(changement)
      .eq('category', sku.category).eq('sku', sku.sku)
      .select('category, sku, label, seuil_bas, ordre, actif')
    if (error) throw error
    if (data?.[0]) Object.assign(sku, data[0])
    toast.add({ title: 'Produit mis à jour', color: 'green' })
    void chargerCatalogue(true)
  }
  catch (err: any) {
    toast.add({ title: 'Modification refusée', description: err.message, color: 'red' })
    await charger()
  }
  finally {
    enCours.value = null
  }
}

async function ajouter(code: string) {
  const saisie = nouveaux[code]
  const label = saisie.label.trim()
  if (!label) return
  const cle = cleProposee(code)
  enCours.value = `nouveau:${code}`
  try {
    const ordre = Math.max(0, ...skusDe(code).map(s => s.ordre ?? 0)) + 1
    const { error } = await supabase.from('sku_thresholds').insert({
      category: code, sku: cle, label, seuil_bas: Math.max(0, Number(saisie.seuil) || 0), ordre, actif: true,
    })
    if (error) throw error
    toast.add({ title: 'Produit ajouté', description: `${label} (clé ${cle})`, color: 'green' })
    nouveaux[code] = { label: '', seuil: 3 }
    await charger()
    void chargerCatalogue(true)
  }
  catch (err: any) {
    toast.add({ title: 'Ajout refusé', description: err.message, color: 'red' })
  }
  finally {
    enCours.value = null
  }
}

onMounted(charger)
</script>
