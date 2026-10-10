<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Permissions"
      description="Ce que chaque rôle peut ouvrir dans le back-office. Une case cochée ouvre les écrans listés sur la ligne, sauf ceux indiqués sous la case. L'administrateur a toujours accès à tout."
    />

    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Section</th>
              <th v-for="role in MANAGED_ROLES" :key="role" scope="col" class="text-center">
                {{ LIBELLES_ROLES[role] || role }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="section in DASHBOARD_SECTIONS" :key="section.key">
              <th scope="row" class="max-w-md align-top font-normal">
                <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ section.title }}</p>
                <p class="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{{ section.ecrans.join(' · ') }}</p>
              </th>
              <td v-for="role in MANAGED_ROLES" :key="role" class="p-1 text-center align-top">
                <!-- Toute la cellule est cliquable (44 px au moins) : l'étiquette
                     englobe la case. Cochée en encre, pas en rouge : cocher
                     n'est pas l'action principale de l'écran. -->
                <label
                  class="flex min-h-11 min-w-11 flex-col items-center justify-start gap-1 rounded-md px-2 py-3"
                  :class="role === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60'"
                >
                  <UCheckbox
                    :model-value="isChecked(role, section.key)"
                    :disabled="role === 'admin' || savingKey === `${role}:${section.key}`"
                    :aria-label="`${LIBELLES_ROLES[role] || role} : ${section.title}`"
                    :aria-describedby="section.exclusParRole[role] ? `exclus-${section.key}-${role}` : undefined"
                    input-class="text-slate-900 dark:text-slate-400"
                    @update:model-value="onToggle(role, section.key)"
                  />
                  <span
                    v-if="section.exclusParRole[role]"
                    :id="`exclus-${section.key}-${role}`"
                    class="max-w-40 text-xs leading-5 text-slate-600 dark:text-slate-300"
                  >
                    Sauf {{ section.exclusParRole[role]!.map(nomCourt).join(', ') }}
                  </span>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="space-y-2 text-sm text-slate-600 dark:text-slate-300">
      <p>
        <strong class="text-slate-900 dark:text-white">Merchandiser</strong> et <strong class="text-slate-900 dark:text-white">commercial</strong>
        travaillent surtout dans l'application mobile : leur ouvrir une section leur donne aussi les écrans correspondants du back-office.
      </p>
      <p v-if="ecransAgence.length">
        <strong class="text-slate-900 dark:text-white">Agence</strong> : en plus des cases cochées, le compte agence ouvre toujours
        {{ ecransAgence.join(', ') }}, limités au routing de ses merchandisers.
      </p>
      <p>Utilisateurs, Équipes et Permissions restent réservés à l'administrateur.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ecransOuvertsA } from '~/utils/adminNavigation'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({
  layout: 'admin',
  middleware: [
    'auth',
    'admin',
    () => {
      const authStore = useAuthStore()
      if (!authStore.isAdmin) return navigateTo('/admin')
    },
  ],
})

const toast = useToast()
const { access, fetchAccess, canAccessSection, updateAccess, DASHBOARD_SECTIONS, MANAGED_ROLES } = useAccessControl()

const LIBELLES_ROLES: Record<string, string> = {
  admin: 'Administrateur',
  superviseur: 'Superviseur',
  commercial: 'Commercial',
  agence: 'Agence',
  merchandiser: 'Merchandiser',
}
const ecransAgence = ecransOuvertsA('agence')

const savingKey = ref<string | null>(null)

// « Paramètres › Utilisateurs » → « Utilisateurs » : sous la case, le domaine
// est déjà dit par la ligne.
function nomCourt(ecran: string): string {
  return ecran.split(' › ').pop() || ecran
}

function isChecked(role: string, sectionKey: string): boolean {
  if (role === 'admin') return true
  return canAccessSection(sectionKey, role)
}

// Chaque case s'enregistre aussitôt : le message propose d'annuler.
async function onToggle(role: string, sectionKey: string, annulation = false) {
  if (role === 'admin') return
  const avant = !!access.value[role]?.[sectionKey]
  savingKey.value = `${role}:${sectionKey}`
  try {
    await updateAccess(role, sectionKey, !avant)
    const section = DASHBOARD_SECTIONS.find(s => s.key === sectionKey)?.title || sectionKey
    toast.add({
      title: annulation ? 'Modification annulée' : `${LIBELLES_ROLES[role] || role} : « ${section} » ${avant ? 'fermé' : 'ouvert'}`,
      color: 'green',
      actions: annulation ? [] : [{ label: 'Annuler', click: () => onToggle(role, sectionKey, true) }],
    })
  }
  catch (err) {
    toast.add({ title: 'Permission non enregistrée', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

onMounted(() => fetchAccess(true))
</script>
