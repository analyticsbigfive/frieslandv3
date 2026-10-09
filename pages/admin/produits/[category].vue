<template>
  <div />
</template>

<script setup lang="ts">
// Ancien écran /admin/produits/<famille>?tab=… : la famille est désormais un
// filtre de Produits › Disponibilité / Prix / Détail par visite
// (pages/admin/produits/familles.vue). Les anciens liens et favoris y mènent.
definePageMeta({
  middleware: [
    (to) => {
      const famille = String(to.params.category || '').toLowerCase()
      const ancienOnglet = String(to.query.tab || '')
      const vue = ancienOnglet === 'prix' ? 'prix' : ancienOnglet === 'recap' ? 'releves' : undefined
      const { tab: _ancien, ...reste } = to.query
      return navigateTo(
        { path: '/admin/produits/familles', query: { ...reste, famille, ...(vue ? { vue } : {}) } },
        { replace: true, redirectCode: 301 },
      )
    },
  ],
})
</script>
