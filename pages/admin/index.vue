<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Perfect Store"
      eyebrow="Vue de synthèse"
    />

    <!-- Filtres cascade Division → Territoire → Quartier + Distributeur (pilotent KPI + tableaux) -->
    <div class="admin-toolbar">
      <!-- Période : un PDV peut être Perfect Store cette semaine et plus la
           suivante — le KPI n'a pas de sens sans fenêtre de temps explicite. -->
      <div class="mb-3 border-b border-slate-100 pb-3 dark:border-slate-700">
        <PeriodFilter v-model="periode" />
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <UFormGroup label="Division (North/South)" size="xs">
          <USelectMenu v-model="fDivision" :options="divisionOptions" placeholder="Toutes" size="xs" searchable :loading="loading" />
        </UFormGroup>
        <UFormGroup label="Territoire" size="xs">
          <USelectMenu v-model="fTerritoire" :options="territoireOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" :loading="loading" />
        </UFormGroup>
        <UFormGroup label="Quartier" size="xs">
          <USelectMenu v-model="fArea" :options="areaOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" :loading="loading" />
        </UFormGroup>
        <UFormGroup label="Distributeur" size="xs">
          <USelectMenu v-model="fDistrib" :options="distribOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" :loading="loading" />
        </UFormGroup>
        <div class="flex items-end">
          <UButton v-if="filtersActive" size="xs" variant="ghost" @click="resetManqueFilters">Réinitialiser</UButton>
        </div>
      </div>
      <div v-if="filtersActive" class="admin-list-toolbar__chips">
        <button
          v-for="chip in dashFilterChips"
          :key="chip.key"
          type="button"
          class="admin-list-toolbar__chip"
          :title="`Retirer le filtre ${chip.label}`"
          @click="removeDashFilterChip(chip.key)"
        >
          <span>{{ chip.label }}</span>
          <UIcon name="i-heroicons-x-mark" class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4 lg:grid-cols-3">
      <div class="admin-surface h-44 animate-pulse bg-slate-100 dark:bg-slate-800 lg:col-span-2" />
      <div class="admin-surface h-44 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else-if="global">
      <!-- Compteur global : le NOMBRE de Perfect Stores d'abord, le taux ensuite.
           Un pourcentage seul ne dit pas sur quoi il porte. -->
      <div class="admin-surface relative overflow-hidden p-4 sm:p-5">
        <div class="absolute inset-y-0 left-0 w-1 bg-fc-red" />
        <div class="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-fc-red">Perfect Stores · {{ periodeLabel }}</p>
            <p class="mt-1.5 text-5xl font-semibold leading-none tracking-tight tabular-nums text-slate-950 dark:text-white">
              {{ global.pdv_perfect_stores }}
            </p>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {{ fmtPct(global.pdv_perfect_store_pct) }} des {{ global.pdv_scores }} PDV visités
            </p>
          </div>

          <!-- Ventilation par niveau, remontée de l'onglet « niveaux » -->
          <div v-if="niveauBreakdown.length" class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span v-for="n in niveauBreakdown" :key="n.niveau" class="inline-flex items-baseline gap-1.5">
              <span class="h-2 w-2 shrink-0 self-center rounded-full" :class="tierDotClass(n.niveau)" />
              <strong class="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{{ n.nb_pdv }}</strong>
              <span class="text-xs text-slate-500 dark:text-slate-400">{{ n.label }}</span>
            </span>
            <span v-if="global.pdv_non_conformes" class="inline-flex items-baseline gap-1.5">
              <span class="h-2 w-2 shrink-0 self-center rounded-full bg-slate-300 dark:bg-slate-600" />
              <strong class="text-lg font-semibold tabular-nums text-slate-400">{{ global.pdv_non_conformes }}</strong>
              <span class="text-xs text-slate-400">Non conformes</span>
            </span>
          </div>

          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-fc-red dark:bg-red-950/30">
            <UIcon name="i-heroicons-trophy" class="h-5 w-5" />
          </div>
        </div>
      </div>

      <!-- Liste des PDV Perfect Store (tâche 1.3 : disponible dès la page 1) -->
      <section class="admin-surface overflow-hidden" aria-labelledby="ps-liste-heading">
        <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 id="ps-liste-heading" class="font-bold text-gray-900 dark:text-gray-100">Points de vente Perfect Store</h2>
          <span class="text-xs text-slate-400">{{ psList.total }} PDV · {{ periodeLabel }}</span>
        </div>

        <div v-if="psList.loading" class="space-y-2 px-5 py-4">
          <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/60" />
        </div>

        <ul v-else-if="psList.items.length" class="divide-y divide-slate-100 dark:divide-slate-700">
          <li v-for="store in psList.items" :key="store.pdv_id">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40"
              @click="openStoreDetail(store)"
            >
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="h-2 w-2 shrink-0 rounded-full" :class="tierDotClass(store.niveau)" />
                  <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ store.nom_pdv || store.pdv_id }}</span>
                </span>
                <span class="mt-1 block truncate pl-4 text-xs text-slate-500 dark:text-slate-400">
                  {{ niveauCourt(store.niveau) }} · {{ typePdvLabel(store.type_pdv) }}<template v-if="store.zone"> · {{ store.zone }}</template>
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(store.score_global) }}</span>
                <span class="mt-1 block text-xs text-slate-400">{{ formatDate(store.date_visite) }}</span>
              </span>
            </button>
          </li>
        </ul>

        <div v-else class="px-5 py-10 text-center text-sm text-slate-400">
          Aucun Perfect Store sur cette période et ce périmètre.
        </div>

        <div v-if="psList.total > psListPerPage" class="border-t border-slate-100 px-5 py-3 dark:border-slate-700">
          <AdminPagination
            :total="psList.total"
            :page="psList.page"
            :page-size="psListPerPage"
            :loading="psList.loading"
            item-label="magasin(s)"
            @update:page="loadPerfectStoreList"
          />
        </div>
      </section>

      <!-- KPI prioritaires.
           Deux couvertures distinctes, volontairement côte à côte :
           - effective = combien de PDV du parc ont été touchés (PDV uniques) ;
           - des visites = combien de passages ont été faits (doublons compris),
             seule mesure qui reflète l'activité quotidienne d'un merchandiser. -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard title="Couverture effective" :value="coverageLabel" :subtitle="coverageSub" format="none" :icon="MapPinned" color="purple" />
        <StatsCard title="Couverture des visites" :value="String(global.visites_total)" :subtitle="visitesSub" format="none" :icon="Footprints" color="red" />
        <StatsCard title="Taux de présence" :value="fmtPct(global.presence_moyenne_pct)" subtitle="produit relevé (qté ≥ 1)" format="none" :icon="PackageCheck" color="orange" />
        <StatsCard title="Taux de disponibilité" :value="fmtPct(global.osa_moyen_pct)" subtitle="qté ≥ seuil paramétré" format="none" :icon="Package" color="green" />
        <StatsCard title="Score global moyen" :value="fmtPct(global.score_global_moyen_pct)" format="none" :icon="BarChart3" color="blue" />
        <StatsCard title="Assortiment moyen" :value="fmtPct(global.assortiment_moyen_pct)" format="none" :icon="ListChecks" color="purple" />
      </div>

      <!-- Présence vs disponibilité : d'abord la catégorie, puis les SKU clés
           (tâche 3.3). Présence = le produit est là ; disponibilité = il est là
           en quantité suffisante. L'écart entre les deux est l'information. -->
      <section class="admin-surface overflow-hidden" aria-labelledby="presence-heading">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 id="presence-heading" class="font-bold text-gray-900 dark:text-gray-100">Présence et disponibilité</h2>
          <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-amber-500" />Présence (qté ≥ 1)</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-emerald-500" />Disponibilité (qté ≥ seuil)</span>
          </div>
        </div>

        <div class="grid gap-x-8 gap-y-6 p-5 lg:grid-cols-2">
          <div>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Par catégorie</h3>
            <ul class="space-y-3">
              <li v-for="c in global.par_categorie" :key="c.categorie">
                <div class="mb-1 flex items-baseline justify-between gap-3">
                  <span class="text-sm font-medium uppercase text-slate-700 dark:text-slate-300">{{ c.categorie }}</span>
                  <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    <span class="text-amber-600">{{ fmtPct(c.presence_pct) }}</span>
                    <span class="mx-1 text-slate-300">/</span>
                    <span class="text-emerald-600">{{ fmtPct(c.disponibilite_pct) }}</span>
                  </span>
                </div>
                <div class="relative h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div class="absolute inset-y-0 left-0 rounded-full bg-amber-400" :style="{ width: (c.presence_pct ?? 0) + '%' }" />
                  <div class="absolute inset-y-0 left-0 rounded-full bg-emerald-500" :style="{ width: (c.disponibilite_pct ?? 0) + '%' }" />
                </div>
              </li>
              <li v-if="!global.par_categorie?.length" class="text-sm text-slate-400">Aucune donnée sur cette période.</li>
            </ul>
          </div>

          <div>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">SKU clés et gamme Délice</h3>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs uppercase text-slate-400">
                  <th class="pb-2 text-left font-medium">Référence</th>
                  <th class="pb-2 text-right font-medium">Présence</th>
                  <th class="pb-2 text-right font-medium">Dispo.</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                <tr v-for="sku in presenceSkus" :key="sku.reference_nom">
                  <td class="py-2">
                    <span class="font-medium text-slate-900 dark:text-white">{{ sku.reference_nom }}</span>
                    <span class="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                      {{ sku.role === 'phare' ? 'SKU clé' : 'Délice' }}
                    </span>
                  </td>
                  <td class="py-2 text-right tabular-nums text-amber-600">{{ fmtPct(sku.presence_pct) }}</td>
                  <td class="py-2 text-right tabular-nums text-emerald-600">{{ fmtPct(sku.disponibilite_pct) }}</td>
                </tr>
                <tr v-if="!presenceSkus.length">
                  <td colspan="3" class="py-4 text-center text-sm text-slate-400">Aucun relevé sur cette période.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Détail des visites par merchandiser (tâche 2.2) -->
      <section class="admin-surface overflow-hidden" aria-labelledby="couverture-merch-heading">
        <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 id="couverture-merch-heading" class="font-bold text-gray-900 dark:text-gray-100">Visites par merchandiser</h2>
          <span class="text-xs text-slate-400">{{ periodeLabel }}</span>
        </div>

        <div v-if="!couvertureCommerciaux.length" class="px-5 py-10 text-center text-sm text-slate-400">
          Aucune visite sur cette période et ce périmètre.
        </div>

        <div v-else class="divide-y divide-slate-100 dark:divide-slate-700">
          <div v-for="c in couvertureCommerciaux" :key="c.commercial">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/40"
              :aria-expanded="openCommerciaux.has(c.commercial)"
              @click="toggleCommercial(c.commercial)"
            >
              <UIcon
                name="i-heroicons-chevron-right"
                class="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200"
                :class="openCommerciaux.has(c.commercial) ? 'rotate-90 text-fc-red' : ''"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">{{ c.commercial }}</span>
                <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {{ c.nb_pdv }} PDV distincts · {{ c.nb_jours }} jour(s) travaillé(s)
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ c.nb_visites }} visite(s)</span>
                <span class="mt-0.5 block text-xs tabular-nums text-slate-400">{{ c.visites_par_jour ?? '—' }} / jour</span>
              </span>
            </button>

            <div v-show="openCommerciaux.has(c.commercial)" class="bg-slate-50/60 px-5 pb-4 dark:bg-slate-900/20">
              <ul class="divide-y divide-slate-100 dark:divide-slate-700">
                <li v-for="p in c.pdv_visites" :key="p.pdv_id" class="flex items-center justify-between gap-4 py-2">
                  <span class="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{{ p.nom_pdv }}</span>
                  <span class="shrink-0 text-xs text-slate-400">
                    <span v-if="p.passages > 1" class="mr-2 font-medium text-amber-600">{{ p.passages }} passages</span>
                    {{ formatDate(p.derniere_visite) }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Indicateurs secondaires, conservés sans ajouter deux cartes hautes -->
      <div class="admin-surface flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-5">
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Autres piliers</p>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span class="inline-flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
            <span class="text-slate-500 dark:text-slate-400">Visibilité</span>
            <strong class="tabular-nums text-slate-900 dark:text-white">{{ fmtPct(global.visibilite_moyenne_pct) }}</strong>
          </span>
          <span class="inline-flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-fc-red" aria-hidden="true" />
            <span class="text-slate-500 dark:text-slate-400">Promotion</span>
            <strong class="tabular-nums text-slate-900 dark:text-white">{{ fmtPct(global.promotion_moyenne_pct) }}</strong>
          </span>
        </div>
      </div>

      <!-- Évolution du taux de Perfect Stores -->
      <div v-if="evolution.length">
        <ClientOnly>
          <ChartsVisitesLineChart
            title="Évolution du taux de Perfect Stores (%)"
            subtitle="Taux de Perfect Stores par jour sur la période disponible."
            series-label="Perfect Stores (%)"
            :data="evolution"
          />
        </ClientOnly>
      </div>

      <!-- Ventilation par type de PDV (accordéons) -->
      <div class="admin-surface overflow-hidden">
        <div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Perfect Store par type de magasin</h2>
          <span class="text-xs text-gray-400">{{ parType.length }} type(s)</span>
        </div>

        <div v-if="!parType.length" class="px-4 py-8 text-center text-sm text-gray-400">Aucune visite scorée.</div>

        <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
          <div v-for="row in parType" :key="row.type_pdv">
            <!-- En-tête accordéon -->
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
              :aria-expanded="isTypeOpen(row.type_pdv)"
              @click="toggleType(row.type_pdv)"
            >
              <UIcon
                name="i-heroicons-chevron-right"
                class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200"
                :class="isTypeOpen(row.type_pdv) ? 'rotate-90 text-fc-red' : ''"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ typePdvLabel(row.type_pdv) }}</span>
                <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  {{ row.pdv_scores }} PDV · <span class="text-emerald-600 font-medium">{{ row.pdv_perfect_stores }} perfect</span>
                  <span class="text-gray-400"> · {{ row.visites_scorees }} visite(s)</span>
                </span>
              </span>
              <span class="hidden w-44 items-center gap-2 sm:flex">
                <span class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <span
                    class="block h-full rounded-full transition-all"
                    :class="(row.perfect_store_pct ?? 0) >= 50 ? 'bg-emerald-500' : (row.perfect_store_pct ?? 0) > 0 ? 'bg-amber-500' : 'bg-red-500'"
                    :style="{ width: (row.perfect_store_pct ?? 0) + '%' }"
                  />
                </span>
                <span class="w-10 text-right text-xs text-gray-500 dark:text-gray-400">{{ fmtPct(row.perfect_store_pct) }}</span>
              </span>
              <span class="w-16 shrink-0 text-right text-sm font-medium tabular-nums text-gray-600 dark:text-gray-300">{{ fmtPct(row.score_global_moyen_pct) }}</span>
            </button>

            <!-- Panneau : liste paginée (client, sans rechargement) -->
            <div v-show="isTypeOpen(row.type_pdv)" class="bg-gray-50/60 px-4 pb-4 dark:bg-gray-900/20">
              <div v-if="typeState(row.type_pdv).loading" class="space-y-2 pt-3">
                <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/60" />
              </div>

              <ul v-else-if="typeState(row.type_pdv).items.length" class="divide-y divide-gray-100 dark:divide-gray-700">
                <li v-for="store in typeState(row.type_pdv).items" :key="store.visite_id">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-4 rounded-lg px-2 py-3 text-left transition hover:bg-white focus-visible:bg-white dark:hover:bg-gray-700/40 dark:focus-visible:bg-gray-700/40"
                    @click="openStoreDetail(store)"
                  >
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-2">
                        <span class="h-2 w-2 shrink-0 rounded-full" :class="tierDotClass(store.niveau)" />
                        <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ store.nom_pdv || store.pdv_id }}</span>
                      </span>
                      <span class="mt-1 block truncate pl-4 text-xs text-gray-500 dark:text-gray-400">
                        {{ store.niveau }}<template v-if="store.zone"> · {{ store.zone }}</template><template v-if="store.commercial"> · {{ store.commercial }}</template>
                      </span>
                    </span>
                    <span class="shrink-0 text-right">
                      <span class="block text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ fmtPct(store.score_global) }}</span>
                      <span class="mt-1 block text-xs text-gray-400">{{ formatDate(store.date_visite) }}</span>
                    </span>
                  </button>
                </li>
              </ul>

              <div v-else class="pt-6 pb-2 text-center text-sm text-gray-400">Aucun magasin dans ce type.</div>

              <div v-if="typeState(row.type_pdv).total > typePerPage" class="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                <AdminPagination
                  :total="typeState(row.type_pdv).total"
                  :page="typeState(row.type_pdv).page"
                  :page-size="typePerPage"
                  :loading="typeState(row.type_pdv).loading"
                  item-label="magasin(s)"
                  @update:page="(p) => changeTypePage(row.type_pdv, p)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PDV classés par niveau -->
      <section class="admin-surface overflow-hidden" aria-labelledby="stores-by-tier-heading">
        <div class="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 id="stores-by-tier-heading" class="font-bold text-gray-900 dark:text-gray-100">Points de vente par niveau</h2>
        </div>

        <div class="grid xl:grid-cols-2">
          <article
            v-for="tier in tierStoreLists"
            :key="tier.code"
            class="border-b border-slate-100 p-5 odd:xl:border-r dark:border-slate-700"
          >
            <div class="mb-4 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full" :class="tierDotClass(tier.code)" />
                <h3 class="font-semibold text-slate-900 dark:text-white">{{ tier.code }}</h3>
              </div>
              <span class="text-xs font-medium text-slate-400">{{ tier.total }} magasin(s)</span>
            </div>

            <div v-if="tier.loading" class="space-y-2">
              <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/60" />
            </div>

            <ul v-else-if="tier.items.length" class="divide-y divide-slate-100 dark:divide-slate-700">
              <li v-for="store in tier.items" :key="store.pdv_id">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-4 rounded-lg py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40"
                  @click="openStoreDetail(store)"
                >
                  <div class="min-w-0 px-2">
                    <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ store.nom_pdv || store.pdv_id }}</p>
                    <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {{ typePdvLabel(store.type_pdv) }}<template v-if="store.zone"> · {{ store.zone }}</template>
                    </p>
                  </div>
                  <div class="shrink-0 px-2 text-right">
                    <p class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(store.score_global) }}</p>
                    <p class="mt-1 text-xs text-slate-400">{{ formatDate(store.date_visite) }}</p>
                  </div>
                </button>
              </li>
            </ul>

            <div v-else class="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 dark:bg-slate-700/30">
              Aucun magasin dans ce niveau.
            </div>

            <div v-if="tier.total > storesPerPage" class="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
              <AdminPagination
                :total="tier.total"
                :page="tier.page"
                :page-size="storesPerPage"
                :loading="tier.loading"
                item-label="magasin(s)"
                @update:page="(p) => changeTierPage(tier.code, p)"
              />
            </div>
          </article>
        </div>

        <div v-if="storesError" class="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
          La liste détaillée sera disponible après l’application de la migration Perfect Store la plus récente.
        </div>
      </section>

      <!-- Critères manquants pour le niveau supérieur -->
      <section v-if="manques.length" class="admin-surface overflow-hidden" aria-labelledby="manques-heading">
        <div class="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 id="manques-heading" class="font-bold text-gray-900 dark:text-gray-100">Passer au niveau supérieur</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Point de vente</th>
                <th class="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Actuel</th>
                <th class="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Cible</th>
                <th class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Critères manquants</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="!filteredManques.length">
                <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-400">Aucun PDV pour ce filtre.</td>
              </tr>
              <tr v-for="m in filteredManques" :key="m.visite_id">
                <td class="px-4 py-2">
                  <span class="block font-medium text-gray-900 dark:text-white">{{ m.nom_pdv || m.pdv_id }}</span>
                  <span class="block text-xs text-gray-400">{{ typePdvLabel(m.type_pdv) }}<template v-if="m.zone"> · {{ m.zone }}</template></span>
                </td>
                <td class="px-4 py-2 text-center">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full" :class="tierDotClass(m.niveau_actuel || '')" />
                    <span class="text-xs text-gray-600 dark:text-gray-300">{{ niveauCourt(m.niveau_actuel) }}</span>
                  </span>
                </td>
                <td class="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-200">{{ niveauCourt(m.niveau_cible) }}</td>
                <td class="px-4 py-2">
                  <div v-if="manqueBadges(m).length" class="flex flex-wrap gap-1.5">
                    <span v-for="b in manqueBadges(m)" :key="b" class="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{{ b }}</span>
                  </div>
                  <span v-else class="text-xs text-emerald-600">Aucun — prêt à monter de niveau</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <div v-else class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-sm text-amber-800 dark:text-amber-200">
      Vues Perfect Store indisponibles. Lance les migrations <code>supabase/nouveau</code> dans Supabase.
    </div>

    <!-- Seuils par niveau -->
    <div class="admin-surface overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 class="font-bold text-gray-900 dark:text-gray-100">Seuils par niveau</h2>
      </div>
      <div class="p-5 space-y-4">
        <div class="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-lg">
          <table class="admin-table text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Niveau</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Disponibilité</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assortiment</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Visibilité</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Promotion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="t in tiers" :key="t.ps_tier">
                <td class="px-4 py-2 font-bold text-gray-900 dark:text-gray-100">{{ t.ps_tier }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.osa_min) }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.assort_min) }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.visi_min) }}</td>
                <td class="px-4 py-2 text-center text-gray-400">{{ t.promo_min == null ? 'Non évaluée' : fmtRatio(t.promo_min) }}</td>
              </tr>
              <tr v-if="!tiers.length">
                <td colspan="5" class="px-4 py-6 text-center text-xs text-gray-400">Seuils indisponibles — lance les migrations Big Five.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-400">
          <NuxtLink to="/admin/perfect-store/standards" class="text-fc-red underline">Modifier les standards</NuxtLink>
        </p>
      </div>
    </div>

    <VisitDetailModal
      v-model="showStoreDetail"
      :visite="selectedStoreVisite"
      :perfect-store="selectedStorePerfect"
    />
  </div>
</template>

<script setup lang="ts">
import { BarChart3, Package, PackageCheck, MapPinned, ListChecks, Footprints } from 'lucide-vue-next'
import type {
  CouvertureCommercial,
  CoverageKpi,
  PerfectStoreDashboardKpi,
  PerfectStoreListItem,
  PerfectStoreManqueItem,
  PerfectStoreTypeKpi,
  PresenceSku,
} from '~/composables/usePerfectStore'
import type { PeriodeValue } from '~/components/PeriodFilter.vue'
import type { Visite } from '~/types'
import type { PerfectStoreResultB } from '~/utils/perfectStore'
import { plageDePeriode, libellePlage } from '~/utils/periode'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const visitesStore = useVisitesStore()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const {
  refs,
  fetchRefs,
  scoreVisite,
  fetchKpiParType,
  fetchStoresByTier,
  fetchPerfectStoreListe,
  fetchPerfectStoreEvolution,
  fetchPerfectStoreManques,
  fetchGlobalKpiFiltre,
  fetchCouvertureParCommercial,
  fetchPresenceSkus,
} = usePerfectStore()

const loading = ref(true)
const global = ref<PerfectStoreDashboardKpi | null>(null)
const parType = ref<PerfectStoreTypeKpi[]>([])
const coverage = ref<CoverageKpi | null>(null)
const evolution = ref<{ date: string; count: number }[]>([])
const manques = ref<PerfectStoreManqueItem[]>([])
const storesPerPage = 5

// Filtre de période (tâches 1.4 et 6). Défaut : le mois en cours — c'est la
// maille de pilotage habituelle, le jour et la semaine servent au suivi
// quotidien des merchandisers.
const periode = ref<PeriodeValue>({ preset: 'mois', ...plageDePeriode('mois') })

// Filtres cascade Division → Territoire → Quartier + Distributeur.
// Les options viennent du RÉFÉRENTIEL géographique COMPLET (useReferentiels),
// pas des lignes chargées : sinon seuls les territoires/quartiers/distributeurs
// déjà présents dans v_perfect_store_manques apparaissaient (listes tronquées).
// Les noms du référentiel correspondent aux valeurs pdv.zone/quartier/
// distributor_name (géo reconstruite depuis la même source) → le filtrage
// (RPC + tableau manques) matche toujours.
const { regions, subRegions, territories, areas, quartiers, distributeurs, territoireDistributeurs, zoneDistributeurs, fetchReferentiels } = useReferentiels()
const fDivision = ref('')
const fTerritoire = ref('')
const fArea = ref('')
const fDistrib = ref('')
const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'fr'))
const regionLabel = (r: { name: string; nom_affichage: string | null }) => r.nom_affichage || r.name

const divisionOptions = computed(() => ['', ...uniq(regions.value.map(regionLabel))])
// Codes région/sous-région du périmètre Division, pour cascader.
const scopedRegionCodes = computed(() => regions.value
  .filter(r => !fDivision.value || regionLabel(r) === fDivision.value).map(r => r.code))
const scopedSrCodes = computed(() => subRegions.value
  .filter(sr => scopedRegionCodes.value.includes(sr.region_code || '')).map(sr => sr.code))
const scopedTerritories = computed(() => territories.value
  .filter(t => scopedSrCodes.value.includes(t.sub_region_code || '')))
const territoireOptions = computed(() => ['', ...uniq(scopedTerritories.value.map(t => t.name))])
// Quartiers du périmètre (territoire sélectionné, sinon toute la division).
const scopedAreaIds = computed(() => {
  const terrCodes = scopedTerritories.value
    .filter(t => !fTerritoire.value || t.name === fTerritoire.value).map(t => t.code)
  return areas.value.filter(a => terrCodes.includes(a.territory_code)).map(a => a.id)
})
const areaOptions = computed(() => ['', ...uniq(quartiers.value
  .filter(q => scopedAreaIds.value.includes(q.zone_id)).map(q => q.nom))])
// Area (zone.id) du quartier sélectionné : clé pour dériver le distributeur.
const selectedQuartierAreaId = computed(() => {
  if (!fArea.value) return null
  return quartiers.value.find(q => scopedAreaIds.value.includes(q.zone_id) && q.nom === fArea.value)?.zone_id ?? null
})
// Distributeurs : liste complète, restreinte au périmètre choisi. Priorité à
// l'AREA du quartier sélectionné (zone_distributeur), sinon territoire, sinon tout.
// Les distributeurs nationaux couvrent tout le périmètre.
const distribOptions = computed(() => {
  const national = distributeurs.value.filter(d => d.national).map(d => d.name)
  if (selectedQuartierAreaId.value) {
    const local = zoneDistributeurs.value
      .filter(zd => zd.zone_id === selectedQuartierAreaId.value).map(zd => zd.distributor_name)
    return ['', ...uniq([...local, ...national])]
  }
  if (fTerritoire.value) {
    const local = territoireDistributeurs.value
      .filter(td => td.territory_name === fTerritoire.value).map(td => td.distributor_name)
    return ['', ...uniq([...local, ...national])]
  }
  return ['', ...uniq(distributeurs.value.map(d => d.name))]
})
watch(fDivision, () => { if (!territoireOptions.value.includes(fTerritoire.value)) fTerritoire.value = '' })
watch(fTerritoire, () => { if (!areaOptions.value.includes(fArea.value)) fArea.value = '' })
watch([fDivision, fTerritoire, fArea], () => { if (fDistrib.value && !distribOptions.value.includes(fDistrib.value)) fDistrib.value = '' })
const filteredManques = computed(() => manques.value.filter(m =>
  (!fDivision.value || m.division === fDivision.value)
  && (!fTerritoire.value || m.zone === fTerritoire.value)
  && (!fArea.value || m.quartier === fArea.value)
  && (!fDistrib.value || m.distributor_name === fDistrib.value),
))
function resetManqueFilters() { fDivision.value = ''; fTerritoire.value = ''; fArea.value = ''; fDistrib.value = '' }

// Chips des filtres actifs — clic = retirer ce filtre seul (le watch refetch tout).
const dashFilterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (fDivision.value) chips.push({ key: 'division', label: `Division : ${fDivision.value}` })
  if (fTerritoire.value) chips.push({ key: 'territoire', label: `Territoire : ${fTerritoire.value}` })
  if (fArea.value) chips.push({ key: 'area', label: `Quartier : ${fArea.value}` })
  if (fDistrib.value) chips.push({ key: 'distributeur', label: `Distributeur : ${fDistrib.value}` })
  return chips
})
function removeDashFilterChip(key: string) {
  if (key === 'division') fDivision.value = ''
  if (key === 'territoire') fTerritoire.value = ''
  if (key === 'area') fArea.value = ''
  if (key === 'distributeur') fDistrib.value = ''
}

// Les filtres pilotent les KPI agrégés du haut (RPC serveur) ET les blocs
// détaillés : évolution, ventilation par type, listes par niveau, accordéons.
const filtersActive = computed(() => !!(fDivision.value || fTerritoire.value || fArea.value || fDistrib.value))
// Toujours défini : la période est active par défaut, et les vues globales sans
// paramètre ne savent pas filtrer par date. Tout passe donc par les RPC.
const dashFilters = computed(() => ({
  division: fDivision.value,
  territoire: fTerritoire.value,
  area: fArea.value,
  distributeur: fDistrib.value,
  dateDebut: periode.value.debut,
  dateFin: periode.value.fin,
}))
async function applyDashboardFilters() {
  const f = dashFilters.value
  const [k, ev, t, cc, skus, mq] = await Promise.all([
    fetchGlobalKpiFiltre(f),
    fetchPerfectStoreEvolution(f),
    fetchKpiParType(f),
    fetchCouvertureParCommercial(f),
    fetchPresenceSkus(f),
    fetchPerfectStoreManques(f),
    loadPerfectStoreList(1),
  ])
  couvertureCommerciaux.value = cc
  presenceSkus.value = skus
  manques.value = mq
  if (k) {
    global.value = k
    coverage.value = { periode: coverage.value?.periode ?? '', pdv_vus: k.pdv_vus, pdv_total: k.pdv_total, couverture_pct: k.couverture_pct }
  }
  evolution.value = ev.map(p => ({ date: p.date, count: p.perfect_store_pct ?? 0 }))
  parType.value = t
  // Listes « PDV par niveau » : rechargées page 1 sur le nouveau périmètre.
  // Accordéons par type : cache vidé, seuls les panneaux ouverts sont rechargés.
  const openList = [...openTypes]
  Object.keys(typeStoreState).forEach(key => delete typeStoreState[key])
  await Promise.all([
    ...tiers.value.map(tier => loadTierStores(tier.ps_tier, 1)),
    ...openList.map(type => loadTypeStores(type, 1)),
  ])
}
watch([fDivision, fTerritoire, fArea, fDistrib, periode], applyDashboardFilters, { deep: true })
const storesError = ref(false)
const showStoreDetail = ref(false)
const selectedStoreVisite = ref<Visite | null>(null)
const selectedStorePerfect = ref<PerfectStoreResultB | null>(null)
const tierStoreState = reactive<Record<string, {
  items: PerfectStoreListItem[]
  total: number
  page: number
  loading: boolean
}>>({})

// ---- Liste des PDV Perfect Store, en page 1 du dashboard (tâche 1.3) ----
// 'CONFORMES' = tous niveaux Perfect Store confondus, non conformes exclus.
const psListPerPage = 10
const psList = reactive({
  items: [] as PerfectStoreListItem[],
  total: 0,
  page: 1,
  loading: true,
})

async function loadPerfectStoreList(page = 1) {
  psList.loading = true
  try {
    const result = await fetchPerfectStoreListe({
      niveau: 'CONFORMES',
      page,
      perPage: psListPerPage,
      filters: dashFilters.value,
    })
    psList.items = result.items
    psList.total = result.total
    psList.page = page
  }
  catch {
    psList.items = []
    psList.total = 0
  }
  finally {
    psList.loading = false
  }
}

const psListPageCount = computed(() => Math.max(1, Math.ceil(psList.total / psListPerPage)))

// ---- Présence vs disponibilité par SKU clé (tâche 3.3) ----
const presenceSkus = ref<PresenceSku[]>([])

// ---- Visites par merchandiser (tâche 2.2) ----
const couvertureCommerciaux = ref<CouvertureCommercial[]>([])
const openCommerciaux = reactive(new Set<string>())
function toggleCommercial(nom: string) {
  if (openCommerciaux.has(nom)) openCommerciaux.delete(nom)
  else openCommerciaux.add(nom)
}

// Ventilation « 5 Flagship · 3 VIP · 2 Basic » remontée depuis la RPC.
const niveauBreakdown = computed(() =>
  (global.value?.par_niveau || []).map(n => ({ ...n, label: niveauCourt(n.niveau) })),
)

const periodeLabel = computed(() => libellePlage({ debut: periode.value.debut, fin: periode.value.fin }))

// Seuils de tier (live depuis les référentiels), triés du + exigeant au - exigeant
const tiers = computed(() => [...(refs.value?.tierConfig || [])].sort((a, b) => b.rang - a.rang))
const tierStoreLists = computed(() => tiers.value.map(tier => ({
  code: tier.ps_tier,
  ...(tierStoreState[tier.ps_tier] || { items: [], total: 0, page: 1, loading: true }),
})))

// Couverture effective : PDV UNIQUES visités sur l'univers assigné. Un PDV
// visité trois fois compte une fois.
const coverageLabel = computed(() =>
  `${coverage.value?.pdv_vus ?? 0}/${coverage.value?.pdv_total ?? 0}`,
)
const coverageSub = computed(() =>
  coverage.value?.couverture_pct != null
    ? `${coverage.value.couverture_pct} % du parc · PDV uniques`
    : 'PDV uniques visités / parc actif',
)
// Couverture des visites : TOUS les passages. Mesure l'activité, pas la
// couverture du parc.
const visitesSub = computed(() => {
  const passages = global.value?.visites_total ?? 0
  const pdv = global.value?.pdv_vus ?? 0
  if (!passages) return 'passages, doublons compris'
  return pdv && passages > pdv
    ? `passages sur ${pdv} PDV (repassages inclus)`
    : 'passages, doublons compris'
})

function fmtPct(v: number | null | undefined): string {
  return v == null ? '—' : `${v}%`
}

// "FLAGSHIP STORE" -> "Flagship", "VIP PERFECT STORE" -> "VIP", etc.
function niveauCourt(code: string | null): string {
  if (!code) return 'Non conforme'
  if (code.startsWith('FLAGSHIP')) return 'Flagship'
  if (code.startsWith('VIP')) return 'VIP'
  if (code.startsWith('CORE')) return 'Core'
  return 'Basic'
}

// Liste à plat des critères manquants pour le niveau cible (badges).
function manqueBadges(m: PerfectStoreManqueItem): string[] {
  const out: string[] = []
  if (m.dispo_manque) out.push(`Disponibilité ${m.dispo_rayon ?? 0}% < ${m.dispo_rayon_min ?? 0}%`)
  if (m.assortiment_manque) out.push('Assortiment < 100%')
  out.push(...m.visibilite_manques, ...m.promotion_manques)
  return out
}
function fmtRatio(v: number | null | undefined): string {
  return v == null ? 'off' : `${Math.round(v * 100)}%`
}

function formatDate(value: string): string {
  return formatDateFr(value, { day: '2-digit', month: 'short', year: 'numeric' })
}

function tierDotClass(tier: string): string {
  if (tier.startsWith('FLAGSHIP')) return 'bg-violet-500'
  if (tier.startsWith('VIP')) return 'bg-emerald-500'
  if (tier.startsWith('CORE')) return 'bg-blue-500'
  return 'bg-amber-500'
}

function tierPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / storesPerPage))
}

async function loadTierStores(tier: string, page = 1) {
  const state = tierStoreState[tier] || { items: [], total: 0, page: 1, loading: false }
  tierStoreState[tier] = state
  state.loading = true
  try {
    const result = await fetchStoresByTier(tier, page, storesPerPage, dashFilters.value)
    state.items = result.items
    state.total = result.total
    state.page = page
  }
  catch {
    storesError.value = true
    state.items = []
    state.total = 0
  }
  finally {
    state.loading = false
  }
}

function changeTierPage(tier: string, page: number) {
  loadTierStores(tier, page)
}

// ---- Accordéons "par type de magasin" : liste paginée par 10, client-side ----
const typePerPage = 10
type TypeStore = { items: PerfectStoreListItem[]; total: number; page: number; loading: boolean }
const EMPTY_TYPE_STATE: TypeStore = { items: [], total: 0, page: 1, loading: false }
const openTypes = reactive(new Set<string>())
const typeStoreState = reactive<Record<string, TypeStore>>({})

function typeState(type: string): TypeStore {
  return typeStoreState[type] || EMPTY_TYPE_STATE
}
function isTypeOpen(type: string): boolean {
  return openTypes.has(type)
}
function typePageCount(total: number): number {
  return Math.max(1, Math.ceil(total / typePerPage))
}

async function loadTypeStores(type: string, page = 1) {
  if (!typeStoreState[type]) typeStoreState[type] = { items: [], total: 0, page: 1, loading: false }
  const state = typeStoreState[type]
  state.loading = true
  try {
    const result = await fetchPerfectStoreListe({ type, page, perPage: typePerPage, filters: dashFilters.value })
    state.items = result.items
    state.total = result.total
    state.page = page
  }
  catch {
    state.items = []
    state.total = 0
  }
  finally {
    state.loading = false
  }
}

function toggleType(type: string) {
  if (openTypes.has(type)) {
    openTypes.delete(type)
    return
  }
  openTypes.add(type)
  if (!typeStoreState[type]) loadTypeStores(type, 1)
}

function changeTypePage(type: string, page: number) {
  loadTypeStores(type, page)
}

async function openStoreDetail(store: PerfectStoreListItem) {
  try {
    const visite = await visitesStore.fetchVisiteByDatabaseId(store.visite_id)
    selectedStoreVisite.value = visite
    selectedStorePerfect.value = refs.value ? scoreVisite(visite.data, visite.pdv || {}) : null
    showStoreDetail.value = true
  }
  catch {
    selectedStoreVisite.value = null
    selectedStorePerfect.value = null
  }
}

onMounted(async () => {
  void fetchTypePdvLabels()
  void fetchReferentiels()
  // Les seuils de niveau doivent être chargés avant applyDashboardFilters, qui
  // itère sur `tiers` pour peupler les listes « PDV par niveau ».
  await fetchRefs()
  try {
    // Un seul chemin de chargement, filtres + période compris (manques inclus) :
    // les vues globales sans paramètre ne savent pas filtrer par date.
    await applyDashboardFilters()
  } finally {
    loading.value = false
  }
})
</script>
