<template>
  <aside
    class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900 lg:translate-x-0"
    :class="[
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      collapsed ? 'lg:w-16' : 'lg:w-64',
    ]"
    aria-label="Menu principal"
  >
    <!-- Logo -->
    <div class="flex h-16 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-700" :class="collapsed ? 'justify-center' : 'gap-3'">
      <img src="~/assets/logo.png" alt="" class="h-9 w-9 shrink-0 rounded-md object-contain" />
      <div v-if="!collapsed" class="min-w-0">
        <p class="text-sm font-bold leading-tight text-slate-900 dark:text-white">Friesland</p>
        <p class="text-xs font-semibold leading-tight text-brand-600 dark:text-brand-300">Bonnet Rouge</p>
      </div>
    </div>

    <!-- Navigation : un domaine par entrée, les vues sont dans la barre d'onglets -->
    <nav class="flex-1 overflow-y-auto px-2 py-4" aria-label="Domaines">
      <template v-if="authStore.profile">
        <div v-for="(groupe, i) in groupes" :key="groupe.id" :class="i > 0 ? 'mt-5' : ''">
          <p v-if="!collapsed" class="mb-1 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {{ groupe.label }}
          </p>
          <div v-else-if="i > 0" class="mx-3 mb-3 border-t border-slate-200 dark:border-slate-700" aria-hidden="true" />

          <ul class="space-y-0.5">
            <li v-for="domaine in groupe.domaines" :key="domaine.id">
              <NuxtLink
                :to="arrivee(domaine) || '/admin'"
                class="group flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150"
                :class="[
                  estActif(domaine.id)
                    ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200'
                    : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                  collapsed ? 'lg:justify-center lg:px-0' : '',
                ]"
                :aria-current="estActif(domaine.id) ? 'page' : undefined"
                :aria-label="collapsed ? domaine.label : undefined"
                :title="collapsed ? domaine.label : undefined"
                @click="$emit('navigate')"
              >
                <UIcon
                  :name="domaine.icon"
                  class="h-5 w-5 shrink-0"
                  :class="estActif(domaine.id) ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'"
                  aria-hidden="true"
                />
                <span :class="collapsed ? 'lg:sr-only' : 'truncate'">{{ domaine.label }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </template>
      <!-- Profil pas encore chargé : squelette plutôt qu'un menu complet qui disparaîtrait. -->
      <div v-else class="space-y-2 px-1" aria-hidden="true">
        <div v-for="n in 8" :key="n" class="h-9 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
      </div>
    </nav>

    <!-- Réduire / déployer -->
    <div class="hidden border-t border-slate-200 p-2 dark:border-slate-700 lg:block">
      <button
        type="button"
        :aria-label="collapsed ? 'Déployer le menu' : 'Réduire le menu'"
        :aria-expanded="!collapsed"
        class="flex min-h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        @click="$emit('toggle')"
      >
        <UIcon
          name="i-heroicons-chevron-double-left"
          class="h-5 w-5 transition-transform"
          :class="collapsed ? 'rotate-180' : ''"
          aria-hidden="true"
        />
        <span v-if="!collapsed">Réduire</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{ collapsed: boolean; mobileOpen?: boolean }>()
defineEmits(['toggle', 'navigate'])

const authStore = useAuthStore()
const { fetchAccess } = useAccessControl()
const { groupes, courant, arrivee } = useAdminNavigation()

const estActif = (id: string) => courant.value?.domain.id === id

// La matrice est chargée par middleware/admin.ts (côté serveur pour les
// rôles non admin) ; ce rappel couvre une session restaurée côté client.
onMounted(() => { void fetchAccess() })
</script>
