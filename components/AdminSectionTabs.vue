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
        :to="tab.to"
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
type Section = 'visites' | 'perfect-store' | 'visibilite' | 'concurrence' | 'produits' | 'actions'

type Tab = {
  label: string
  to: string
  path: string
  icon?: string
}

const props = defineProps<{ section?: Section }>()
const route = useRoute()

const detectedSection = computed<Section | null>(() => {
  const path = route.path
  if (path === '/admin' || path.startsWith('/admin/perfect-store')) return 'perfect-store'
  if (path.startsWith('/admin/visites')) return 'visites'
  if (path.startsWith('/admin/visibilite')) return 'visibilite'
  if (path.startsWith('/admin/concurrence')) return 'concurrence'
  if (path.startsWith('/admin/produits')) return 'produits'
  if (path.startsWith('/admin/actions')) return 'actions'
  return null
})

const currentSection = computed(() => props.section ?? detectedSection.value)
const sectionLabels: Record<Section, string> = {
  visites: 'des visites',
  'perfect-store': 'du Perfect Store',
  visibilite: 'de la visibilité',
  concurrence: 'de la concurrence',
  produits: 'des produits',
  actions: 'des actions',
}

const productCategories = [
  { key: 'evap', label: 'EVAP' },
  { key: 'imp', label: 'IMP' },
  { key: 'scm', label: 'SCM' },
  { key: 'uht', label: 'UHT' },
  { key: 'yaourt', label: 'Yaourt' },
  { key: 'cereales', label: 'Céréales' },
]

const sectionLabel = computed(() => currentSection.value ? sectionLabels[currentSection.value] : '')

const tabs = computed<Tab[]>(() => {
  const tab = (label: string, to: string, icon?: string): Tab => ({
    label,
    to,
    path: to.split('?')[0],
    icon,
  })

  switch (currentSection.value) {
    case 'visites':
      return [
        tab('Toutes les visites', '/admin/visites', 'i-heroicons-clipboard-document-list'),
        tab('Évolution', '/admin/visites/evolution', 'i-heroicons-chart-bar'),
        tab('Par catégorie', '/admin/visites/categories', 'i-heroicons-squares-2x2'),
        tab('Commerciaux', '/admin/visites/commerciaux', 'i-heroicons-users'),
      ]
    case 'perfect-store':
      return [
        tab('Tableau de bord', '/admin', 'i-heroicons-trophy'),
        tab('Liste par niveau', '/admin/perfect-store/liste', 'i-heroicons-list-bullet'),
        tab('Standards', '/admin/perfect-store/standards', 'i-heroicons-adjustments-horizontal'),
      ]
    case 'visibilite':
      return [
        tab('Extérieure', '/admin/visibilite', 'i-heroicons-eye'),
        tab('Récap. extérieure', '/admin/visibilite/exterieure-recap', 'i-heroicons-clipboard-document-list'),
        tab('Intérieure', '/admin/visibilite/interieure', 'i-heroicons-eye'),
        tab('Évolution intérieure', '/admin/visibilite/interieure-evolution', 'i-heroicons-chart-bar'),
        tab('Intérieure GT', '/admin/visibilite/interieure-gt-recap', 'i-heroicons-building-storefront'),
        tab('Intérieure MT', '/admin/visibilite/interieure-mt-recap', 'i-heroicons-building-storefront'),
        tab('Promotion', '/admin/visibilite/promotion-recap', 'i-heroicons-megaphone'),
      ]
    case 'concurrence':
      return [
        tab('Évolution', '/admin/concurrence', 'i-heroicons-chart-bar'),
        tab('Récapitulatif', '/admin/concurrence/visibilite-recap', 'i-heroicons-clipboard-document-list'),
        tab('Visibilité', '/admin/concurrence/visibilite-evolution', 'i-heroicons-eye'),
      ]
    case 'produits':
      return [
        tab('Récapitulatif', '/admin/produits/recap', 'i-heroicons-clipboard-document-list'),
        tab('Inventaire SKU', '/admin/produits/inventaire', 'i-heroicons-cube'),
        ...productCategories.map(category => tab(category.label, `/admin/produits/${category.key}`, 'i-heroicons-squares-2x2')),
        tab('Seuils de stock', '/admin/produits/seuils', 'i-heroicons-adjustments-horizontal'),
      ]
    case 'actions':
      return [
        tab('Synthèse', '/admin/actions', 'i-heroicons-bolt'),
        tab('Visites terrain', '/admin/visites', 'i-heroicons-clipboard-document-list'),
      ]
    default:
      return []
  }
})

function isActive(tab: Tab) {
  return route.path === tab.path
}
</script>
