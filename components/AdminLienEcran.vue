<template>
  <!-- Renvoi vers un autre écran du back-office (« Référentiels › Quotas du
       programme merchandiser ») : un lien si le compte peut l'ouvrir, sinon le
       nom seul, pour savoir à qui demander. -->
  <NuxtLink
    v-if="ouvrable"
    :to="cible"
    class="rounded font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
  ><slot /></NuxtLink>
  <span v-else class="font-semibold"><slot /></span>
</template>

<script setup lang="ts">
const props = defineProps<{
  /** Chemin de l'écran, sans paramètres : /admin/referentiels, /admin/import-export… */
  chemin: string
  /** Liste des référentiels à ouvrir (identifiant de pages/admin/referentiels). */
  liste?: string
}>()

const { peutOuvrir } = useAdminNavigation()
const query = computed(() => (props.liste ? { liste: props.liste } : undefined))
const cible = computed(() => ({ path: props.chemin, query: query.value }))
const ouvrable = computed(() => peutOuvrir(props.chemin, query.value))
</script>
