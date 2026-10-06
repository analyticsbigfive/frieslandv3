<template>
  <nav
    v-if="tabs.length"
    class="admin-section-tabs"
    :aria-label="`Navigation ${sectionLabel}`"
  >
    <div class="admin-section-tabs__scroll">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.label"
        :to="linkTo(tab.to)"
        class="admin-section-tabs__link"
        :class="isActive(tab) ? 'admin-section-tabs__link--active' : ''"
        :aria-current="isActive(tab) ? 'page' : undefined"
      >
        <UIcon v-if="tab.icon" :name="tab.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{{ tab.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import {
  adminSectionLabels,
  adminSectionTabs,
  detectAdminSection,
  type AdminSection,
  type AdminSectionTab,
} from '~/utils/adminSectionTabs'
import { categoriesProduitsActives } from '~/utils/products'

const props = defineProps<{ section?: AdminSection }>()
const route = useRoute()

const detectedSection = computed(() => detectAdminSection(route.path))

const currentSection = computed(() => props.section ?? detectedSection.value)
const sectionLabel = computed(() => currentSection.value ? adminSectionLabels[currentSection.value] : '')
// Les onglets produits (/admin/produits/<code>) suivent le catalogue
// (Paramètres › Produits du formulaire) : une catégorie active par onglet,
// dans l'ordre de l'admin ; une catégorie retirée n'a plus d'onglet.
const { charger: chargerCatalogue } = useCatalogueReleve()
onMounted(() => { void chargerCatalogue() })

const tabs = computed<AdminSectionTab[]>(() => {
  if (!currentSection.value) return []
  const liste = adminSectionTabs[currentSection.value]
  if (currentSection.value !== 'produits') return liste
  return [
    ...liste,
    ...categoriesProduitsActives().map(c => ({ label: c.label, to: `/admin/produits/${c.key}`, icon: 'i-heroicons-squares-2x2' })),
  ]
})

function isActive(tab: AdminSectionTab) {
  return route.path === tab.to.split('?')[0]
}

function linkTo(to: string) {
  const [path, rawQuery] = to.split('?')
  const query = new URLSearchParams(rawQuery || '')

  Object.entries(route.query).forEach(([key, value]) => {
    if (query.has(key)) return
    if (Array.isArray(value)) value.forEach(item => query.append(key, item || ''))
    else if (value != null) query.set(key, value)
  })

  const queryString = query.toString()
  return queryString ? `${path}?${queryString}` : path
}
</script>
