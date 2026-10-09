<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Produits relevés dans le formulaire de visite, par catégorie. Sous le seuil (et au-dessus de 0), un produit est marqué « stock bas » ; à 0, il est en rupture."
    />

    <UAlert
      v-if="!migrationAppliquee"
      color="amber"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      title="Seuls les seuils sont modifiables pour l'instant"
      description="Le libellé, l'ordre et la présence dans le formulaire seront modifiables après une mise à jour du serveur. Prévenez l'administrateur technique."
    />

    <div class="admin-surface space-y-1.5 p-4 text-sm leading-6 text-slate-700 dark:text-slate-300">
      <p><strong class="text-slate-900 dark:text-white">Le code d'un produit ne change plus après l'ajout</strong> : il range les quantités dans les visites. Pour remplacer un produit, retirez-le du formulaire et ajoutez-en un nouveau.</p>
      <p>Un produit retiré disparaît du formulaire ; ses relevés passés restent dans les tableaux et l'export.</p>
      <p>
        Un nouveau produit ne compte au Perfect Store qu'après sa
        <NuxtLink to="/admin/referentiels?liste=correspondance_reference" class="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-300">correspondance avec une référence (SKU)</NuxtLink>.
        Les catégories se gèrent dans
        <NuxtLink to="/admin/referentiels?liste=categorie_releve" class="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-300">Référentiels, Catégories du relevé</NuxtLink>.
      </p>
      <p>Les téléphones reçoivent les changements à l'ouverture de l'application (version 1.0.12 et suivantes).</p>
    </div>

    <ChargementContenu v-if="chargement" variante="lignes" libelle="Chargement des produits du formulaire…" />

    <template v-else>
      <section
        v-for="cat in categories"
        :key="cat.code"
        class="admin-surface overflow-hidden"
        :aria-labelledby="`categorie-${cat.code}`"
      >
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: couleur(cat.code) }" aria-hidden="true" />
          <h2 :id="`categorie-${cat.code}`" class="text-base font-semibold text-slate-900 dark:text-white">{{ cat.libelle }}</h2>
          <UBadge v-if="cat.actif === false" color="gray" variant="soft" size="xs">Catégorie retirée du formulaire</UBadge>
          <UBadge v-if="cat.facings" color="gray" variant="soft" size="xs">Faces en rayon (facings) relevées en supermarché (MT)</UBadge>
        </div>

        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col" class="!px-5">Libellé affiché</th>
                <th scope="col">Code</th>
                <th scope="col" class="!text-right">Ordre</th>
                <th scope="col" class="!text-right">Seuil « stock bas »</th>
                <th scope="col" class="!text-center">Dans le formulaire</th>
                <th scope="col"><span class="sr-only">Enregistrement</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sku in skusDe(cat.code)" :key="sku.sku" :class="sku.actif === false ? 'bg-slate-50 dark:bg-slate-900/30' : ''">
                <td class="!px-5 !py-2">
                  <input
                    type="text"
                    class="champ-ligne w-full min-w-[12rem]"
                    :value="sku.label || ''"
                    :aria-label="`Libellé affiché du produit ${sku.label || sku.sku}`"
                    :disabled="!migrationAppliquee || enCours === cleDe(sku)"
                    @change="modifier(sku, { label: texte($event) })"
                  >
                </td>
                <td class="!py-2 font-mono text-xs !text-slate-500 dark:!text-slate-400">{{ sku.sku }}</td>
                <td class="!py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    class="champ-ligne w-16 text-right tabular-nums"
                    :value="sku.ordre ?? 0"
                    :aria-label="`Ordre du produit ${sku.label || sku.sku}`"
                    :disabled="!migrationAppliquee || enCours === cleDe(sku)"
                    @change="modifier(sku, { ordre: entier($event) })"
                  >
                </td>
                <td class="!py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    class="champ-ligne w-20 text-right font-medium tabular-nums"
                    :value="sku.seuil_bas ?? 3"
                    :aria-label="`Seuil « stock bas » du produit ${sku.label || sku.sku}`"
                    :disabled="enCours === cleDe(sku)"
                    @change="modifier(sku, { seuil_bas: entier($event) })"
                  >
                </td>
                <td class="!py-2">
                  <div class="flex justify-center">
                    <UToggle
                      :model-value="sku.actif !== false"
                      :aria-label="`${sku.label || sku.sku} dans le formulaire`"
                      :disabled="!migrationAppliquee || enCours === cleDe(sku)"
                      @update:model-value="modifier(sku, { actif: $event })"
                    />
                  </div>
                </td>
                <td class="!py-2 w-32 whitespace-nowrap" aria-live="polite">
                  <span v-if="enCours === cleDe(sku)" class="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                    <UIcon name="i-heroicons-arrow-path" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Enregistrement…
                  </span>
                  <span v-else-if="enregistre === cleDe(sku)" class="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <UIcon name="i-heroicons-check-circle" class="h-3.5 w-3.5" aria-hidden="true" />
                    Enregistré
                  </span>
                </td>
              </tr>
              <tr v-if="!skusDe(cat.code).length">
                <td colspan="6" class="!px-5 text-slate-600 dark:text-slate-300">Aucun produit : la catégorie n'apparaît pas dans le formulaire. Ajoutez un produit ci-dessous.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Ajout d'un produit -->
        <div v-if="migrationAppliquee" class="border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-900/30">
          <div class="flex flex-wrap items-end gap-3">
            <div class="min-w-[14rem] flex-1">
              <label :for="`nouveau-${cat.code}`" class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Nouveau produit</label>
              <UInput :id="`nouveau-${cat.code}`" v-model="nouveaux[cat.code].label" placeholder="ex. BR 170g" size="sm" />
            </div>
            <div class="w-28">
              <label :for="`nouveau-seuil-${cat.code}`" class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Seuil « stock bas »</label>
              <UInput :id="`nouveau-seuil-${cat.code}`" v-model.number="nouveaux[cat.code].seuil" type="number" min="0" size="sm" />
            </div>
            <UButton
              size="sm"
              variant="outline"
              icon="i-heroicons-plus"
              :disabled="!nouveaux[cat.code].label.trim()"
              :loading="enCours === `nouveau:${cat.code}`"
              @click="ajouter(cat.code)"
            >
              Ajouter
            </UButton>
          </div>
          <p v-if="nouveaux[cat.code].label.trim()" class="mt-2 text-xs text-slate-600 dark:text-slate-300">
            Code attribué, définitif après l'ajout : <span class="font-mono text-slate-700 dark:text-slate-200">{{ cleProposee(cat.code) }}</span>
          </p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { cleSkuDepuisLibelle } from '~/utils/catalogueSku'
import { couleurFamille } from '~/utils/chartPalette'
import { messageUtilisateur } from '~/utils/supabaseErrors'

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
// Ligne dont la dernière modification vient d'être enregistrée (repère discret, quelques secondes).
const enregistre = ref<string | null>(null)
let minuteurEnregistre: ReturnType<typeof setTimeout> | undefined
const nouveaux = reactive<Record<string, { label: string, seuil: number }>>({})

function cleDe(s: LigneSku) { return `${s.category}:${s.sku}` }
function couleur(code: string) { return couleurFamille(code) }
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
    toast.add({ title: 'Chargement impossible', description: messageUtilisateur(err), color: 'red' })
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
    enregistre.value = cleDe(sku)
    clearTimeout(minuteurEnregistre)
    minuteurEnregistre = setTimeout(() => { enregistre.value = null }, 3000)
    void chargerCatalogue(true)
  }
  catch (err: any) {
    toast.add({ title: 'Modification non enregistrée', description: messageUtilisateur(err), color: 'red' })
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
    toast.add({ title: 'Produit ajouté', description: `${label} (code ${cle})`, color: 'green' })
    nouveaux[code] = { label: '', seuil: 3 }
    await charger()
    void chargerCatalogue(true)
  }
  catch (err: any) {
    toast.add({ title: 'Produit non ajouté', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    enCours.value = null
  }
}

onMounted(charger)
onBeforeUnmount(() => clearTimeout(minuteurEnregistre))
</script>

<style scoped>
/* Champ natif d'une ligne de tableau : même trait et même anneau de focus que les champs Nuxt UI. */
.champ-ligne {
  @apply h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 transition-colors
    focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
    disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500
    dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900;
}
</style>
