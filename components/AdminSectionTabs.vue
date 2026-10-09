<template>
  <!-- Second et dernier niveau de navigation : les vues du domaine courant
       (utils/adminNavigation.ts). Masquée quand le domaine n'a qu'une vue. -->
  <nav
    v-if="onglets.length > 1 && courant"
    class="admin-section-tabs relative"
    :aria-label="`Vues : ${courant.domain.label}`"
  >
    <div
      ref="defilement"
      class="admin-section-tabs__scroll"
      @scroll.passive="mesurer"
    >
      <NuxtLink
        v-for="tab in onglets"
        :key="tab.id"
        :to="lienOnglet(tab)"
        class="admin-section-tabs__link"
        :class="estActif(tab.id) ? 'admin-section-tabs__link--active' : ''"
        :aria-current="estActif(tab.id) ? 'page' : undefined"
        :data-actif="estActif(tab.id) || undefined"
      >
        {{ tab.label }}
      </NuxtLink>
    </div>
    <!-- Fondu au bord quand d'autres onglets sont hors champ (barre de défilement masquée). -->
    <div
      v-if="debordeGauche"
      class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--admin-bg)] to-transparent dark:from-slate-950"
      aria-hidden="true"
    />
    <div
      v-if="debordeDroite"
      class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--admin-bg)] to-transparent dark:from-slate-950"
      aria-hidden="true"
    />
  </nav>
</template>

<script setup lang="ts">
const { courant, ongletsCourants: onglets, lienOnglet } = useAdminNavigation()

const estActif = (id: string) => courant.value?.tab?.id === id

const defilement = ref<HTMLElement | null>(null)
const debordeGauche = ref(false)
const debordeDroite = ref(false)

function mesurer() {
  const el = defilement.value
  if (!el) return
  debordeGauche.value = el.scrollLeft > 4
  debordeDroite.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

// L'onglet actif reste visible sur petit écran.
function centrerActif() {
  const actif = defilement.value?.querySelector<HTMLElement>('[data-actif]')
  actif?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  mesurer()
}

watch(() => courant.value?.tab?.id, () => nextTick(centrerActif))
onMounted(() => {
  nextTick(centrerActif)
  window.addEventListener('resize', mesurer, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', mesurer))
</script>
