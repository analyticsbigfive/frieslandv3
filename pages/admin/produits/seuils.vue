<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Seuils de stock par SKU</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        En dessous de ce seuil (et au-dessus de 0), un SKU est marqué « stock bas ». À 0 = rupture.
      </p>
    </div>

    <div v-for="cat in catalog" :key="cat.key" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: cat.color }" />
        <h2 class="font-bold text-gray-900 dark:text-gray-100">{{ cat.label }}</h2>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div v-for="sku in cat.skus" :key="sku.key" class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ sku.label }}</span>
          <div class="flex items-center gap-2">
            <label class="text-xs text-gray-400">Seuil bas</label>
            <input
              type="number"
              min="0"
              class="w-20 h-9 text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-fc-blue focus:outline-none"
              :value="getSeuil(cat.key, sku.key)"
              :disabled="savingKey === `${cat.key}:${sku.key}`"
              @change="onSave(cat.key, sku.key, $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PRODUCT_CATALOG } from '~/utils/products'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const toast = useToast()
const { fetchThresholds, getSeuil, updateSeuil } = useSkuThresholds()

const catalog = PRODUCT_CATALOG
const savingKey = ref<string | null>(null)

async function onSave(category: string, sku: string, e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const val = Math.max(0, parseInt(raw, 10) || 0)
  savingKey.value = `${category}:${sku}`
  try {
    await updateSeuil(category, sku, val)
    toast.add({ title: 'Seuil mis à jour', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  } finally {
    savingKey.value = null
  }
}

onMounted(() => fetchThresholds(true))
</script>
