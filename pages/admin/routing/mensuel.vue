<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <!-- Parcours du routing mensuel en trois étapes. Rien ne s'écrit ici : chaque
         étape mène à l'écran qui fait le travail (Import / Export, Référentiels,
         Tournées), avec un lien seulement si le compte peut l'ouvrir. -->
    <ol class="admin-surface divide-y divide-slate-200 dark:divide-slate-700">
      <li v-for="(etape, i) in ETAPES" :key="etape.titre" class="flex gap-4 p-5 sm:p-6">
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-sm font-bold tabular-nums text-slate-700 dark:border-slate-600 dark:text-slate-200"
          aria-hidden="true"
        >{{ i + 1 }}</span>
        <div class="min-w-0 space-y-2">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">
            <span class="sr-only">Étape {{ i + 1 }} : </span>{{ etape.titre }}
          </h2>

          <template v-if="i === 0">
            <p class="max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              Une ligne par merchandiser, par jour et par semaine du mois : le lieu de visite (commune, quartier ou point de visite) et le vendeur du distributeur qui l’accompagne, ou « Aucun SSF ».
              Un fichier Excel (.xlsx) ou CSV convient.
            </p>
            <p class="text-sm text-slate-700 dark:text-slate-300">
              Colonnes attendues : <span class="font-medium text-slate-900 dark:text-white">Merchandiser, Jour, Occurrence</span> (la semaine du mois),
              <span class="font-medium text-slate-900 dark:text-white">Commune, Quartier, Point de visite, SSF</span>, et si vous les avez Latitude, Longitude, Rayon.
            </p>
            <a
              href="/guides/exemple-routing-mensuel.csv"
              download
              class="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
              Télécharger un exemple de fichier
            </a>
          </template>

          <template v-else-if="i === 1">
            <p class="max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              Dans
              <AdminLienEcran chemin="/admin/import-export">Paramètres › Import / Export</AdminLienEcran>,
              carte « Routing mensuel des merchandisers » : choisissez le fichier puis cliquez « Simuler ».
              Rien n’est écrit tant que vous n’avez pas relu le rapport et cliqué « Appliquer ».
            </p>
            <p class="max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              Seuls les merchandisers présents dans le fichier sont modifiés. Un import appliqué peut être annulé depuis l’historique, sous la carte.
            </p>
          </template>

          <template v-else>
            <p class="max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              Les tournées des 7 prochains jours apparaissent dans
              <AdminLienEcran chemin="/admin/routing">Planning › Tournées</AdminLienEcran>
              et la couverture du mois dans
              <AdminLienEcran chemin="/admin/routing/programme-merchandiser">Planning › Programme merchandiser</AdminLienEcran>.
            </p>
            <p class="max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              Pour corriger une ligne sans réimporter :
              <AdminLienEcran chemin="/admin/referentiels" liste="routing_mensuel">Référentiels › Routing mensuel</AdminLienEcran>.
              Un quartier ou un nom mal orthographié dans le fichier se rattache une fois pour toutes dans
              <AdminLienEcran chemin="/admin/referentiels" liste="alias_import">Référentiels › Alias d’import</AdminLienEcran>.
            </p>
          </template>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
// Planning › Routing du mois : le mode d'emploi du fichier mensuel de l'agence,
// sans données. Ouvert à l'admin et au compte agence (utils/adminNavigation.ts).
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

const ETAPES = [
  { titre: 'Préparer le fichier du mois' },
  { titre: 'Le simuler, puis l’appliquer' },
  { titre: 'Vérifier les tournées' },
] as const
</script>
