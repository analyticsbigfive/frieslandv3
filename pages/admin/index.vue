<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <!-- Filtres cascade Direction → Territoire → Quartier + Distributeur (pilotent indicateurs + listes) -->
    <div class="admin-toolbar">
      <!-- Période : un PDV peut être Perfect Store cette semaine et plus la
           suivante — l'indicateur n'a pas de sens sans fenêtre de temps explicite. -->
      <div class="mb-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <PeriodFilter v-model="periode" />
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <UFormGroup label="Direction" size="xs">
          <USelectMenu v-model="fDivision" :options="divisionOptions" placeholder="Toutes" size="xs" searchable searchable-placeholder="Rechercher…" :loading="loading" />
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
          <UButton v-if="filtersActive" size="xs" color="gray" variant="ghost" @click="resetManqueFilters">Réinitialiser</UButton>
        </div>
      </div>
      <div v-if="filtersActive" class="admin-list-toolbar__chips">
        <button
          v-for="chip in dashFilterChips"
          :key="chip.key"
          type="button"
          class="admin-list-toolbar__chip"
          :title="`Retirer le filtre ${chip.label}`"
          :aria-label="`Retirer le filtre ${chip.label}`"
          @click="removeDashFilterChip(chip.key)"
        >
          <span>{{ chip.label }}</span>
          <UIcon name="i-heroicons-x-mark" class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="space-y-3" role="status" aria-label="Chargement des indicateurs Perfect Store">
      <div class="admin-surface h-28 animate-pulse bg-slate-100 dark:bg-slate-800" />
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="i in 4" :key="i" class="admin-surface h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>

    <template v-else-if="global">
      <!-- Réponse d'abord : combien de points de vente sont au standard, et à
           quel niveau. Le NOMBRE avant le taux : un pourcentage seul ne dit pas
           sur quoi il porte. -->
      <section class="admin-surface p-4 sm:p-5" aria-label="Perfect Stores sur la période">
        <div class="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
          <div>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Perfect Stores</p>
            <p class="mt-1.5 text-3xl font-bold leading-none tabular-nums text-slate-900 dark:text-white">
              {{ fmtNombre(global.pdv_perfect_stores) }}
            </p>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {{ fmtPct(global.pdv_perfect_store_pct) }} des {{ fmtNombre(global.pdv_scores) }} points de vente visités · {{ periodeLabel }}
            </p>
          </div>

          <!-- Répartition par niveau : échelle ordonnée, du plus exigeant au non conforme. -->
          <div v-if="repartitionNiveaux.length" class="w-full min-w-0 lg:w-auto lg:max-w-2xl lg:flex-1">
            <div class="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              <span
                v-for="n in repartitionNiveaux.filter(x => x.nb > 0)"
                :key="n.cle"
                class="h-full first:rounded-l-full last:rounded-r-full"
                :style="{ width: `${n.part}%`, minWidth: '4px', backgroundColor: n.couleur }"
              />
            </div>
            <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <li v-for="n in repartitionNiveaux" :key="n.cle" class="inline-flex items-baseline gap-1.5">
                <span class="h-2.5 w-2.5 shrink-0 self-center rounded-full" :style="{ backgroundColor: n.couleur }" aria-hidden="true" />
                <strong class="text-base font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtNombre(n.nb) }}</strong>
                <span class="text-sm text-slate-600 dark:text-slate-300">{{ n.libelle }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Quatre indicateurs. Couverture = PDV UNIQUES visités sur le parc actif ;
           les passages (doublons compris) passent dans « Autres mesures ». -->
      <div class="space-y-3">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Points de vente visités" :value="coverageLabel" :subtitle="coverageSub" format="none" icon="i-heroicons-map-pin" color="blue" />
          <StatsCard title="Disponibilité en rayon" :value="fmtPct(global.osa_moyen_pct)" subtitle="références relevées « Disponible »" format="none" icon="i-heroicons-cube" color="green" />
          <StatsCard title="Assortiment moyen" :value="fmtPct(global.assortiment_moyen_pct)" subtitle="références attendues présentes" format="none" icon="i-heroicons-list-bullet" color="blue" />
          <StatsCard title="Score global moyen" :value="fmtPct(global.score_global_moyen_pct)" subtitle="tous piliers confondus" format="none" icon="i-heroicons-chart-bar" color="blue" />
        </div>
        <dl class="flex flex-wrap items-baseline gap-x-6 gap-y-2 px-1 text-sm">
          <div v-for="m in mesuresSecondaires" :key="m.libelle" class="inline-flex items-baseline gap-1.5">
            <dt class="text-slate-600 dark:text-slate-300">{{ m.libelle }}</dt>
            <dd class="font-semibold tabular-nums text-slate-900 dark:text-white">
              {{ m.valeur }}<template v-if="m.detail">{{ ' ' }}<span class="font-normal text-slate-600 dark:text-slate-300">{{ m.detail }}</span></template>
            </dd>
          </div>
        </dl>
      </div>

      <!-- À traiter : ce qui manque aux points de vente pour monter d'un niveau. -->
      <section class="admin-surface overflow-hidden" aria-labelledby="manques-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div class="min-w-0">
            <h2 id="manques-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Passer au niveau supérieur</h2>
            <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Les points de vente les moins conformes d'abord, et ce qui leur manque à la dernière visite pour atteindre le niveau suivant.
            </p>
          </div>
          <UButton
            v-if="peutOuvrir('/admin/perfect-store/gaps')"
            to="/admin/perfect-store/gaps"
            size="xs"
            variant="outline"
            trailing-icon="i-heroicons-arrow-right"
          >
            Tous les écarts au standard
          </UButton>
        </div>

        <ChargementContenu
          v-if="(vague2EnCours || rechargement.manques) && !manques.length"
          variante="lignes"
          :nombre="5"
          libelle="Chargement des points de vente à faire progresser…"
          class="px-5 py-4"
        />
        <AdminErreurBloc
          v-else-if="erreurs.manques"
          titre="Les points de vente à faire progresser n’ont pas pu être chargés."
          :erreur="erreurs.manques"
          :en-cours="rechargement.manques"
          @reessayer="recharger('manques')"
        />
        <div v-else-if="!filteredManques.length" class="px-5 py-10 text-center">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Aucun point de vente à faire progresser</p>
          <p class="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">
            Aucune visite évaluée sur cette période et ce périmètre. Élargissez la période ou retirez un filtre.
          </p>
        </div>
        <template v-else>
          <div class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Point de vente</th>
                  <th>Niveau actuel</th>
                  <th>Niveau visé</th>
                  <th>Critères manquants</th>
                  <th><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in manquesPage" :key="m.visite_id">
                  <td>
                    <span class="block font-medium text-slate-900 dark:text-white">{{ m.nom_pdv || 'Point de vente sans nom' }}</span>
                    <span class="block text-xs text-slate-600 dark:text-slate-300">{{ typePdvLabel(m.type_pdv) }}<template v-if="m.zone"> · {{ m.zone }}</template></span>
                  </td>
                  <td class="whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5">
                      <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(m.niveau_actuel) }" aria-hidden="true" />
                      <!-- Sans disponibilité relevée, le niveau n'a pas pu être calculé. -->
                      {{ m.dispo_rayon == null && estNonConforme(m.niveau_actuel) ? 'Non évalué' : niveauCourt(m.niveau_actuel) }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap font-semibold text-slate-900 dark:text-white">{{ niveauCourt(m.niveau_cible) }}</td>
                  <td>
                    <div v-if="manqueBadges(m).length" class="flex flex-wrap gap-1.5">
                      <span
                        v-for="b in manqueBadges(m)"
                        :key="b"
                        class="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                      >{{ b }}</span>
                    </div>
                    <span
                      v-else-if="m.dispo_rayon == null"
                      class="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"
                      title="Aucune quantité relevée en rayon à la dernière visite : le niveau ne peut pas être calculé."
                    >
                      <UIcon name="i-heroicons-information-circle" class="h-4 w-4 shrink-0" aria-hidden="true" />
                      Disponibilité non relevée
                    </span>
                    <span v-else class="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
                      <UIcon name="i-heroicons-check-circle" class="h-4 w-4 shrink-0" aria-hidden="true" />
                      Aucun critère manquant relevé
                    </span>
                  </td>
                  <td class="whitespace-nowrap text-right">
                    <div class="inline-flex items-center gap-1">
                      <UButton
                        size="xs"
                        color="gray"
                        variant="ghost"
                        :loading="visiteEnOuverture === m.visite_id"
                        :aria-label="`Voir la dernière visite chez ${m.nom_pdv || 'ce point de vente'}`"
                        @click="openStoreDetail(m)"
                      >
                        Dernière visite
                      </UButton>
                      <UButton
                        v-if="peutOuvrir('/admin/pdv/historique')"
                        size="xs"
                        color="gray"
                        variant="ghost"
                        :to="{ path: '/admin/pdv/historique', query: { pdv_id: m.pdv_id } }"
                        :aria-label="`Historique de ${m.nom_pdv || 'ce point de vente'}`"
                      >
                        Historique
                      </UButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredManques.length > manquesParPage" class="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            <AdminPagination
              :total="filteredManques.length"
              :page="manquesPageNo"
              :page-size="manquesParPage"
              :item-label="pluriel(filteredManques.length, 'point de vente', 'points de vente')"
              @update:page="manquesPageNo = $event"
            />
          </div>
        </template>
      </section>

      <!-- Points de vente au standard, tous niveaux ou un seul (une seule liste
           au lieu de la liste globale + quatre listes par niveau). -->
      <section class="admin-surface overflow-hidden" aria-labelledby="ps-liste-heading">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="ps-liste-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Points de vente Perfect Store</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Dernière visite de chaque point de vente au standard · {{ periodeLabel }}</p>
          <div class="mt-3 inline-flex flex-wrap rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Niveau affiché">
            <button
              v-for="opt in optionsNiveauListe"
              :key="opt.code || 'tous'"
              type="button"
              class="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors"
              :class="niveauListe === opt.code
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
              :aria-pressed="niveauListe === opt.code"
              @click="niveauListe = opt.code"
            >
              <span v-if="opt.couleur" class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: opt.couleur }" aria-hidden="true" />
              {{ opt.libelle }}
              <span v-if="opt.total != null" class="tabular-nums opacity-80">{{ fmtNombre(opt.total) }}</span>
            </button>
          </div>
        </div>

        <ChargementContenu v-if="listeAffichee.loading" variante="lignes" :nombre="4" libelle="Chargement des points de vente…" class="px-5 py-4" />

        <AdminErreurBloc
          v-else-if="listeAffichee.erreur"
          titre="La liste des points de vente n’a pas pu être chargée."
          :erreur="listeAffichee.erreur"
          @reessayer="changerPageListe(listeAffichee.page)"
        />

        <ul v-else-if="listeAffichee.items.length" class="divide-y divide-slate-200 dark:divide-slate-700">
          <li v-for="store in listeAffichee.items" :key="store.pdv_id">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40"
              @click="openStoreDetail(store)"
            >
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(store.niveau) }" aria-hidden="true" />
                  <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ store.nom_pdv || 'Point de vente sans nom' }}</span>
                </span>
                <span class="mt-1 block truncate pl-[18px] text-xs text-slate-600 dark:text-slate-300">
                  {{ niveauCourt(store.niveau) }} · {{ typePdvLabel(store.type_pdv) }}<template v-if="store.zone"> · {{ store.zone }}</template>
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(store.score_global) }}</span>
                <span class="mt-1 block text-xs text-slate-600 dark:text-slate-300">{{ formatDate(store.date_visite) }}</span>
              </span>
            </button>
          </li>
        </ul>

        <div v-else class="px-5 py-10 text-center text-sm text-slate-600 dark:text-slate-300">
          <template v-if="niveauListe">Aucun point de vente à ce niveau sur cette période et ce périmètre.</template>
          <template v-else>Aucun Perfect Store sur cette période et ce périmètre.</template>
          Élargissez la période ou retirez un filtre.
        </div>

        <div v-if="listeAffichee.total > listeAffichee.parPage" class="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <AdminPagination
            :total="listeAffichee.total"
            :page="listeAffichee.page"
            :page-size="listeAffichee.parPage"
            :loading="listeAffichee.loading"
            :item-label="pluriel(listeAffichee.total, 'point de vente', 'points de vente')"
            @update:page="changerPageListe"
          />
        </div>
      </section>

      <!-- Évolution du taux de Perfect Stores -->
      <section v-if="erreurs.evolution" class="admin-surface" aria-labelledby="evolution-erreur-heading">
        <h2 id="evolution-erreur-heading" class="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900 dark:border-slate-700 dark:text-white">Évolution du taux de Perfect Stores (%)</h2>
        <AdminErreurBloc
          titre="La courbe n’a pas pu être chargée."
          :erreur="erreurs.evolution"
          :en-cours="rechargement.evolution"
          @reessayer="recharger('evolution')"
        />
      </section>
      <ClientOnly v-else>
        <ChartsVisitesLineChart
          title="Évolution du taux de Perfect Stores (%)"
          subtitle="Part des points de vente visités au standard, jour par jour."
          series-label="Perfect Stores (%)"
          :data="evolution"
        />
      </ClientOnly>

      <!-- Présence vs disponibilité : d'abord la catégorie, puis les références
           clés (tâche 3.3). Présence = le produit est là ; disponibilité = il est
           là en quantité suffisante. L'écart entre les deux est l'information. -->
      <section class="admin-surface overflow-hidden" aria-labelledby="presence-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 id="presence-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Présence et disponibilité</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">L'écart entre les deux montre les produits présents mais en quantité insuffisante.</p>
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: COULEUR_PRESENCE }" aria-hidden="true" />Présence (quantité ≥ 1)</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: COULEUR_DISPO }" aria-hidden="true" />Disponibilité (quantité ≥ seuil)</span>
          </div>
        </div>

        <div class="grid gap-x-8 gap-y-6 p-5 lg:grid-cols-2">
          <div>
            <h3 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">Par catégorie</h3>
            <ul class="space-y-4">
              <li v-for="c in global.par_categorie" :key="c.categorie">
                <div class="mb-1.5 flex items-baseline justify-between gap-3">
                  <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ libelleCategorie(c.categorie) }}</span>
                  <span class="text-sm tabular-nums text-slate-700 dark:text-slate-200">
                    <span class="sr-only">Présence </span>{{ fmtPct(c.presence_pct) }}
                    <span class="mx-1 text-slate-500" aria-hidden="true">/</span>
                    <span class="sr-only">, disponibilité </span><strong class="font-semibold text-slate-900 dark:text-white">{{ fmtPct(c.disponibilite_pct) }}</strong>
                  </span>
                </div>
                <div class="relative h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                  <div class="absolute inset-y-0 left-0 rounded-full" :style="{ width: (c.presence_pct ?? 0) + '%', backgroundColor: COULEUR_PRESENCE }" />
                  <div class="absolute inset-y-0 left-0 rounded-full" :style="{ width: (c.disponibilite_pct ?? 0) + '%', backgroundColor: COULEUR_DISPO }" />
                </div>
              </li>
              <li v-if="!global.par_categorie?.length" class="text-sm text-slate-600 dark:text-slate-300">
                Aucun relevé sur cette période. Élargissez la période ou retirez un filtre.
              </li>
            </ul>
          </div>

          <div class="min-w-0">
            <h3 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">Références clés et gamme Délice</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-700">
                    <th class="pb-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Référence</th>
                    <th class="pb-2 pl-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Présence</th>
                    <th class="pb-2 pl-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Disponibilité</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
                  <tr v-for="sku in presenceSkus" :key="sku.reference_nom">
                    <td class="py-2 text-slate-700 dark:text-slate-200">
                      <span class="font-medium text-slate-900 dark:text-white">{{ sku.reference_nom }}</span>
                      <span class="ml-2 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {{ sku.role === 'phare' ? 'Référence clé' : 'Délice' }}
                      </span>
                    </td>
                    <td class="py-2 pl-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{{ fmtPct(sku.presence_pct) }}</td>
                    <td class="py-2 pl-3 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(sku.disponibilite_pct) }}</td>
                  </tr>
                  <tr v-if="(vague2EnCours || rechargement.presenceSkus) && !presenceSkus.length">
                    <td colspan="3" class="py-4"><ChargementContenu variante="compact" libelle="Chargement des relevés par référence…" /></td>
                  </tr>
                  <tr v-else-if="erreurs.presenceSkus">
                    <td colspan="3" class="py-4">
                      <AdminErreurBloc
                        compact
                        titre="Les relevés par référence n’ont pas pu être chargés."
                        :erreur="erreurs.presenceSkus"
                        :en-cours="rechargement.presenceSkus"
                        @reessayer="recharger('presenceSkus')"
                      />
                    </td>
                  </tr>
                  <tr v-else-if="!presenceSkus.length">
                    <td colspan="3" class="py-4 text-center text-slate-600 dark:text-slate-300">Aucun relevé sur cette période. Élargissez la période ou retirez un filtre.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Ventilation par type de PDV (accordéons, un seul ouvert à la fois) -->
      <section class="admin-surface overflow-hidden" aria-labelledby="par-type-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 id="par-type-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Perfect Store par type de magasin</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Ouvrez un type pour voir ses points de vente.</p>
          </div>
          <span v-if="!erreurs.parType" class="text-sm text-slate-600 dark:text-slate-300">{{ compte(parType.length, 'type') }}</span>
        </div>

        <AdminErreurBloc
          v-if="erreurs.parType"
          titre="La répartition par type de magasin n’a pas pu être chargée."
          :erreur="erreurs.parType"
          :en-cours="rechargement.parType"
          @reessayer="recharger('parType')"
        />
        <div v-else-if="!parType.length" class="px-5 py-10 text-center text-sm text-slate-600 dark:text-slate-300">
          Aucune visite évaluée sur cette période et ce périmètre. Élargissez la période ou retirez un filtre.
        </div>

        <div v-else class="divide-y divide-slate-200 dark:divide-slate-700">
          <div v-for="(row, index) in parType" :key="row.type_pdv">
            <button
              :id="`type-entete-${index}`"
              type="button"
              class="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40"
              :aria-expanded="isTypeOpen(row.type_pdv)"
              :aria-controls="`type-panneau-${index}`"
              @click="toggleType(row.type_pdv)"
            >
              <UIcon
                name="i-heroicons-chevron-right"
                class="h-4 w-4 shrink-0 text-slate-600 transition-transform duration-200 dark:text-slate-300"
                :class="isTypeOpen(row.type_pdv) ? 'rotate-90' : ''"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">{{ typePdvLabel(row.type_pdv) }}</span>
                <span class="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
                  {{ compte(row.pdv_scores, 'point de vente', 'points de vente') }} · {{ compte(row.pdv_perfect_stores, 'Perfect Store') }} · {{ compte(row.visites_scorees, 'visite') }}
                </span>
              </span>
              <span class="hidden w-48 shrink-0 sm:block">
                <span class="flex items-baseline justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>Perfect Stores</span>
                  <span class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(row.perfect_store_pct) }}</span>
                </span>
                <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                  <span class="block h-full rounded-full bg-slate-600 dark:bg-slate-300" :style="{ width: (row.perfect_store_pct ?? 0) + '%' }" />
                </span>
              </span>
              <span class="w-20 shrink-0 text-right">
                <span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(row.score_global_moyen_pct) }}</span>
                <span class="block text-xs text-slate-600 dark:text-slate-300">score moyen</span>
              </span>
            </button>

            <!-- Panneau : liste paginée -->
            <div
              v-show="isTypeOpen(row.type_pdv)"
              :id="`type-panneau-${index}`"
              role="region"
              :aria-labelledby="`type-entete-${index}`"
              class="border-t border-slate-200 bg-slate-50 px-5 pb-4 dark:border-slate-700 dark:bg-slate-900/20"
            >
              <ChargementContenu v-if="typeState(row.type_pdv).loading" variante="lignes" :nombre="3" libelle="Chargement des points de vente…" class="pt-3" />

              <AdminErreurBloc
                v-else-if="typeState(row.type_pdv).erreur"
                compact
                class="pt-4"
                titre="Les points de vente de ce type n’ont pas pu être chargés."
                :erreur="typeState(row.type_pdv).erreur"
                @reessayer="loadTypeStores(row.type_pdv, typeState(row.type_pdv).page)"
              />

              <ul v-else-if="typeState(row.type_pdv).items.length" class="divide-y divide-slate-200 dark:divide-slate-700">
                <li v-for="store in typeState(row.type_pdv).items" :key="store.visite_id">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-4 rounded-md px-2 py-3 text-left transition-colors hover:bg-white focus-visible:bg-white dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40"
                    @click="openStoreDetail(store)"
                  >
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-2">
                        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(store.niveau) }" aria-hidden="true" />
                        <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ store.nom_pdv || 'Point de vente sans nom' }}</span>
                      </span>
                      <span class="mt-1 block truncate pl-[18px] text-xs text-slate-600 dark:text-slate-300">
                        {{ niveauCourt(store.niveau) }}<template v-if="store.zone"> · {{ store.zone }}</template><template v-if="store.commercial"> · {{ store.commercial }}</template>
                      </span>
                    </span>
                    <span class="shrink-0 text-right">
                      <span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(store.score_global) }}</span>
                      <span class="mt-1 block text-xs text-slate-600 dark:text-slate-300">{{ formatDate(store.date_visite) }}</span>
                    </span>
                  </button>
                </li>
              </ul>

              <p v-else class="pb-2 pt-6 text-center text-sm text-slate-600 dark:text-slate-300">Aucun point de vente de ce type sur la période.</p>

              <div v-if="typeState(row.type_pdv).total > typePerPage" class="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                <AdminPagination
                  :total="typeState(row.type_pdv).total"
                  :page="typeState(row.type_pdv).page"
                  :page-size="typePerPage"
                  :loading="typeState(row.type_pdv).loading"
                  :item-label="pluriel(typeState(row.type_pdv).total, 'point de vente', 'points de vente')"
                  @update:page="(p) => changeTypePage(row.type_pdv, p)"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Détail des visites par merchandiser (tâche 2.2), un seul ouvert à la fois -->
      <section class="admin-surface overflow-hidden" aria-labelledby="couverture-merch-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 id="couverture-merch-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Visites par merchandiser</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Ouvrez un nom pour voir les points de vente visités · {{ periodeLabel }}</p>
          </div>
        </div>

        <ChargementContenu
          v-if="(vague2EnCours || rechargement.couvertureCommerciaux) && !couvertureCommerciaux.length"
          variante="lignes"
          :nombre="5"
          libelle="Chargement des visites par merchandiser…"
          class="px-5 py-4"
        />
        <AdminErreurBloc
          v-else-if="erreurs.couvertureCommerciaux"
          titre="Les visites par merchandiser n’ont pas pu être chargées."
          :erreur="erreurs.couvertureCommerciaux"
          :en-cours="rechargement.couvertureCommerciaux"
          @reessayer="recharger('couvertureCommerciaux')"
        />
        <div v-else-if="!couvertureCommerciaux.length" class="px-5 py-10 text-center text-sm text-slate-600 dark:text-slate-300">
          Aucune visite sur cette période et ce périmètre. Élargissez la période ou retirez un filtre.
        </div>

        <div v-else class="divide-y divide-slate-200 dark:divide-slate-700">
          <div v-for="(c, index) in couvertureCommerciaux" :key="c.commercial">
            <button
              :id="`merch-entete-${index}`"
              type="button"
              class="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40"
              :aria-expanded="openCommerciaux.has(c.commercial)"
              :aria-controls="`merch-panneau-${index}`"
              @click="toggleCommercial(c.commercial)"
            >
              <UIcon
                name="i-heroicons-chevron-right"
                class="h-4 w-4 shrink-0 text-slate-600 transition-transform duration-200 dark:text-slate-300"
                :class="openCommerciaux.has(c.commercial) ? 'rotate-90' : ''"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">{{ c.commercial }}</span>
                <span class="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
                  {{ compte(c.nb_pdv, 'point de vente différent', 'points de vente différents') }} · {{ compte(c.nb_jours, 'jour travaillé', 'jours travaillés') }}
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ compte(c.nb_visites, 'visite') }}</span>
                <span class="mt-0.5 block text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ c.visites_par_jour == null ? '—' : Number(c.visites_par_jour).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }} par jour</span>
              </span>
            </button>

            <div
              v-show="openCommerciaux.has(c.commercial)"
              :id="`merch-panneau-${index}`"
              role="region"
              :aria-labelledby="`merch-entete-${index}`"
              class="border-t border-slate-200 bg-slate-50 px-5 pb-3 dark:border-slate-700 dark:bg-slate-900/20"
            >
              <ul class="divide-y divide-slate-200 dark:divide-slate-700">
                <li v-for="p in c.pdv_visites" :key="p.pdv_id" class="flex items-center justify-between gap-4 py-2">
                  <span class="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{{ p.nom_pdv || 'Point de vente sans nom' }}</span>
                  <span class="shrink-0 text-xs text-slate-600 dark:text-slate-300">
                    <span v-if="p.passages > 1" class="mr-2 font-semibold text-amber-800 dark:text-amber-200">{{ p.passages }} passages</span>
                    {{ formatDate(p.derniere_visite) }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </template>

    <div v-else class="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100" role="alert">
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <div>
          <template v-if="dashboardTimeout">
            <p class="font-semibold">Le serveur a mis trop de temps à répondre.</p>
            <p class="mt-1">Les indicateurs n'ont pas pu être calculés. Réessayez dans quelques secondes, ou choisissez une période plus courte.</p>
          </template>
          <template v-else-if="dashboardError">
            <p class="font-semibold">Les indicateurs Perfect Store ne sont pas disponibles.</p>
            <p class="mt-1">{{ dashboardMessage }}</p>
          </template>
          <template v-else>
            <p class="font-semibold">Les indicateurs Perfect Store ne sont pas encore disponibles.</p>
            <p class="mt-1">Réessayez dans quelques instants ; si le problème continue, prévenez l'administrateur technique.</p>
          </template>
          <UButton class="mt-3" size="xs" variant="outline" icon="i-heroicons-arrow-path" :loading="retrying" @click="retryDashboard">Réessayer</UButton>
        </div>
      </div>
    </div>

    <!-- Seuils par niveau (référence, en bas de page) -->
    <section class="admin-surface overflow-hidden" aria-labelledby="seuils-heading">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div>
          <h2 id="seuils-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Seuils par niveau</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Le minimum à atteindre sur chaque pilier pour obtenir le niveau.</p>
        </div>
        <UButton
          v-if="peutOuvrir('/admin/perfect-store/standards')"
          to="/admin/perfect-store/standards"
          size="xs"
          variant="outline"
          icon="i-heroicons-adjustments-horizontal"
        >
          Modifier les standards
        </UButton>
      </div>
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Niveau</th>
              <th class="text-right">Disponibilité</th>
              <th class="text-right">Assortiment</th>
              <th class="text-right">Visibilité</th>
              <th class="text-right">Promotion</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tiers" :key="t.ps_tier">
              <td class="font-semibold text-slate-900 dark:text-white">
                <span class="inline-flex items-center gap-2">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(t.ps_tier) }" aria-hidden="true" />
                  {{ niveauLibelle(t.ps_tier) }}
                </span>
              </td>
              <td class="text-right tabular-nums">{{ fmtRatio(t.osa_min) }}</td>
              <td class="text-right tabular-nums">{{ fmtRatio(t.assort_min) }}</td>
              <td class="text-right tabular-nums">{{ fmtRatio(t.visi_min) }}</td>
              <td class="text-right tabular-nums">{{ t.promo_min == null ? 'Non évaluée' : fmtRatio(t.promo_min) }}</td>
            </tr>
            <tr v-if="!refsChargees && !tiers.length">
              <td colspan="5"><ChargementContenu variante="compact" libelle="Chargement des seuils…" /></td>
            </tr>
            <tr v-else-if="refsEnErreur">
              <td colspan="5">
                <AdminErreurBloc
                  compact
                  titre="Les seuils par niveau n’ont pas pu être chargés."
                  :en-cours="rechargementRefs"
                  @reessayer="rechargerRefs"
                />
              </td>
            </tr>
            <tr v-else-if="!tiers.length">
              <td colspan="5" class="text-center text-slate-600 dark:text-slate-300">
                Les seuils par niveau ne sont pas encore définis. Ils se règlent dans les standards Perfect Store.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <VisitDetailModal
      v-model="showStoreDetail"
      :visite="selectedStoreVisite"
      :perfect-store="selectedStorePerfect"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  BlocPerfectStore,
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
import { isTimeoutError, messageUtilisateur } from '~/utils/supabaseErrors'
import { compte, pluriel } from '~/utils/pluriel'
import { SERIES, NIVEAUX_PS as NIVEAUX, COULEUR_NON_CONFORME, niveauPerfectStore as niveauDe } from '~/utils/chartPalette'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const visitesStore = useVisitesStore()
const toast = useToast()
const { peutOuvrir } = useAdminNavigation()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const {
  refs,
  dashboardError,
  erreurs,
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
// Seconde vague (listes) et référentiels : leurs états vides attendent la fin
// du chargement au lieu de s'afficher pendant.
const vague2EnCours = ref(true)
const refsChargees = ref(false)
// fetchRefs() garde l'erreur pour lui : des référentiels absents une fois le
// chargement fini veulent dire « échec », pas « aucun seuil défini ».
const refsEnErreur = computed(() => refsChargees.value && !refs.value)
const rechargementRefs = ref(false)
async function rechargerRefs() {
  rechargementRefs.value = true
  try { await fetchRefs(true) }
  catch (err) { console.error('Tableau de bord : référentiels indisponibles', err) }
  finally { rechargementRefs.value = false }
}
const global = ref<PerfectStoreDashboardKpi | null>(null)
// Cause de l'absence de KPI : base saturée (504 / 57014) ou vraie erreur.
const dashboardTimeout = computed(() => isTimeoutError(dashboardError.value))
const dashboardMessage = computed(() => messageUtilisateur(dashboardError.value))
const retrying = ref(false)
async function retryDashboard() {
  retrying.value = true
  loading.value = true
  try {
    await applyDashboardFilters()
  }
  finally {
    retrying.value = false
    loading.value = false
  }
}
// Relance d'un seul bloc en échec (bouton « Réessayer » dans sa carte).
const rechargement = reactive<Partial<Record<BlocPerfectStore, boolean>>>({})
async function recharger(bloc: BlocPerfectStore) {
  rechargement[bloc] = true
  const f = dashFilters.value
  try {
    if (bloc === 'manques') manques.value = await fetchPerfectStoreManques(f)
    else if (bloc === 'presenceSkus') presenceSkus.value = await fetchPresenceSkus(f)
    else if (bloc === 'couvertureCommerciaux') couvertureCommerciaux.value = await fetchCouvertureParCommercial(f)
    else if (bloc === 'parType') parType.value = await fetchKpiParType(f)
    else if (bloc === 'evolution') evolution.value = (await fetchPerfectStoreEvolution(f)).map(p => ({ date: p.date, count: p.perfect_store_pct ?? 0 }))
  }
  finally {
    rechargement[bloc] = false
  }
}
const parType = ref<PerfectStoreTypeKpi[]>([])
const coverage = ref<CoverageKpi | null>(null)
const evolution = ref<{ date: string; count: number }[]>([])
const manques = ref<PerfectStoreManqueItem[]>([])
const storesPerPage = 5

// Filtre de période (tâches 1.4 et 6). Défaut : 30 derniers jours glissants —
// le « mois en cours » donnait un dashboard vide chaque début de mois. Le jour
// et la semaine servent au suivi quotidien des merchandisers.
const periode = ref<PeriodeValue>({ preset: '30j', ...plageDePeriode('30j') })

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
// « Passer au niveau supérieur » en tête de page : dix lignes à la fois pour
// que le reste de la page reste à portée.
const manquesParPage = 10
const manquesPageNo = ref(1)
const manquesPage = computed(() => filteredManques.value.slice((manquesPageNo.value - 1) * manquesParPage, manquesPageNo.value * manquesParPage))
watch(filteredManques, () => { manquesPageNo.value = 1 })
function resetManqueFilters() { fDivision.value = ''; fTerritoire.value = ''; fArea.value = ''; fDistrib.value = '' }

// Chips des filtres actifs — clic = retirer ce filtre seul (le watch refetch tout).
const dashFilterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (fDivision.value) chips.push({ key: 'division', label: `Direction : ${fDivision.value}` })
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
// Chargement en deux vagues. Tout lancer d'un coup (une quinzaine de requêtes
// lourdes) saturait le serveur de base de données : les requêtes se
// ralentissaient mutuellement jusqu'à dépasser la limite de 30 s, et c'est le
// bloc KPI qui tombait le plus souvent — d'où « indicateurs indisponibles »
// une fois sur deux. Les KPI et la courbe d'abord, les listes ensuite.
async function applyDashboardFilters() {
  const f = dashFilters.value
  const [k, ev, t] = await Promise.all([
    fetchGlobalKpiFiltre(f),
    fetchPerfectStoreEvolution(f),
    fetchKpiParType(f),
  ])
  if (k) {
    global.value = k
    coverage.value = { periode: coverage.value?.periode ?? '', pdv_vus: k.pdv_vus, pdv_total: k.pdv_total, couverture_pct: k.couverture_pct }
  }
  // k null : la cause est dans dashboardError (délai dépassé, objet manquant…).
  evolution.value = ev.map(p => ({ date: p.date, count: p.perfect_store_pct ?? 0 }))
  parType.value = t
  loading.value = false

  vague2EnCours.value = true
  try {
    const [cc, skus, mq] = await Promise.all([
      fetchCouvertureParCommercial(f),
      fetchPresenceSkus(f),
      fetchPerfectStoreManques(f),
      loadPerfectStoreList(1),
    ])
    couvertureCommerciaux.value = cc
    presenceSkus.value = skus
    manques.value = mq
  }
  finally {
    vague2EnCours.value = false
  }
  // Listes « PDV par niveau » : rechargées page 1 sur le nouveau périmètre.
  // Accordéons par type : cache vidé, seuls les panneaux ouverts sont rechargés.
  const openList = [...openTypes]
  Object.keys(typeStoreState).forEach(key => delete typeStoreState[key])
  // Une liste à la fois : quatre appels perfect_store_liste_filtre simultanés
  // dépassaient chacun 20 s en production (mesuré le 24 sept.), là où un seul
  // prend ~1,5 s. En série, la page reste utilisable pendant le chargement.
  for (const tier of tiers.value) await loadTierStores(tier.ps_tier, 1)
  for (const type of openList) await loadTypeStores(type, 1)
}
watch([fDivision, fTerritoire, fArea, fDistrib, periode], applyDashboardFilters, { deep: true })
const showStoreDetail = ref(false)
const selectedStoreVisite = ref<Visite | null>(null)
const selectedStorePerfect = ref<PerfectStoreResultB | null>(null)
const tierStoreState = reactive<Record<string, {
  items: PerfectStoreListItem[]
  total: number
  page: number
  loading: boolean
  erreur?: unknown
}>>({})

// ---- Liste des PDV Perfect Store, en page 1 du dashboard (tâche 1.3) ----
// 'CONFORMES' = tous niveaux Perfect Store confondus, non conformes exclus.
const psListPerPage = 10
const psList = reactive({
  items: [] as PerfectStoreListItem[],
  total: 0,
  page: 1,
  loading: true,
  erreur: null as unknown,
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
    psList.erreur = null
  }
  catch (err) {
    // Échec ≠ liste vide : la carte affiche l'erreur et « Réessayer ».
    psList.items = []
    psList.total = 0
    psList.page = page
    psList.erreur = err
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
// Un seul détail ouvert à la fois : la page ne s'allonge pas d'un bloc par clic.
function toggleCommercial(nom: string) {
  const etaitOuvert = openCommerciaux.has(nom)
  openCommerciaux.clear()
  if (!etaitOuvert) openCommerciaux.add(nom)
}

// Répartition « 5 Flagship · 3 VIP · 2 Basic · 40 Non conformes » remontée
// depuis la RPC (niveaux du référentiel, du plus exigeant au moins exigeant).
const repartitionNiveaux = computed(() => {
  const g = global.value
  if (!g) return []
  const niveaux = (g.par_niveau || [])
    .filter(n => n.niveau && !String(n.niveau).toUpperCase().startsWith('NON'))
    .map(n => ({ cle: n.niveau, nb: Number(n.nb_pdv) || 0, libelle: niveauCourt(n.niveau), couleur: couleurNiveau(n.niveau) }))
  if (!niveaux.length && !g.pdv_non_conformes) return []
  const lignes = [
    ...niveaux,
    { cle: 'non-conforme', nb: Number(g.pdv_non_conformes) || 0, libelle: (Number(g.pdv_non_conformes) || 0) > 1 ? 'Non conformes' : 'Non conforme', couleur: COULEUR_NON_CONFORME },
  ]
  const total = lignes.reduce((t, l) => t + l.nb, 0) || 1
  return lignes.map(l => ({ ...l, part: Math.round((l.nb / total) * 1000) / 10 }))
})

// Mesures gardées en texte sous les quatre indicateurs.
const mesuresSecondaires = computed(() => {
  const g = global.value
  if (!g) return []
  const passages = g.visites_total ?? 0
  const pdv = g.pdv_vus ?? 0
  return [
    { libelle: 'Visites', valeur: fmtNombre(g.visites_total), detail: pdv && passages > pdv ? `sur ${fmtNombre(pdv)} points de vente, repassages compris` : 'repassages compris' },
    { libelle: 'Présence en rayon', valeur: fmtPct(g.presence_moyenne_pct), detail: '' },
    { libelle: 'Visibilité', valeur: fmtPct(g.visibilite_moyenne_pct), detail: '' },
    { libelle: 'Promotion', valeur: fmtPct(g.promotion_moyenne_pct), detail: '' },
  ]
})

const periodeLabel = computed(() => libellePlage({ debut: periode.value.debut, fin: periode.value.fin }))

// Seuils de tier (live depuis les référentiels), triés du + exigeant au - exigeant
const tiers = computed(() => [...(refs.value?.tierConfig || [])].sort((a, b) => b.rang - a.rang))
const tierStoreLists = computed(() => tiers.value.map(tier => ({
  code: tier.ps_tier,
  ...(tierStoreState[tier.ps_tier] || { items: [], total: 0, page: 1, loading: true }),
})))

// Liste « Points de vente Perfect Store » : tous niveaux (liste CONFORMES) ou
// un seul niveau (listes par niveau), au choix. '' = tous les niveaux.
const niveauListe = ref('')
const optionsNiveauListe = computed(() => [
  { code: '', libelle: 'Tous les niveaux', couleur: '', total: psList.loading ? null : psList.total },
  ...tierStoreLists.value.map(t => ({
    code: t.code,
    libelle: niveauCourt(t.code),
    couleur: couleurNiveau(t.code),
    total: t.loading ? null : t.total,
  })),
])
const listeAffichee = computed(() => {
  if (niveauListe.value) {
    const t = tierStoreLists.value.find(x => x.code === niveauListe.value)
    if (t) return { items: t.items, total: t.total, page: t.page, loading: t.loading, erreur: t.erreur ?? null, parPage: storesPerPage }
  }
  return { items: psList.items, total: psList.total, page: psList.page, loading: psList.loading, erreur: psList.erreur, parPage: psListPerPage }
})
function changerPageListe(page: number) {
  if (niveauListe.value) changeTierPage(niveauListe.value, page)
  else loadPerfectStoreList(page)
}

// Couverture effective : PDV UNIQUES visités sur l'univers assigné. Un PDV
// visité trois fois compte une fois.
const coverageLabel = computed(() =>
  `${fmtNombre(coverage.value?.pdv_vus)} / ${fmtNombre(coverage.value?.pdv_total)}`,
)
const coverageSub = computed(() =>
  coverage.value?.couverture_pct != null
    ? `${fmtPct(coverage.value.couverture_pct)} du parc actif, chacun compté une fois`
    : 'sur le parc actif, chacun compté une fois',
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
  return v == null ? '—' : `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
}
const formatNombre = new Intl.NumberFormat('fr-FR')
// Une valeur absente (non calculée) s'écrit « — », jamais 0.
function fmtNombre(v: number | null | undefined): string {
  return v == null || Number.isNaN(Number(v)) ? '—' : formatNombre.format(Number(v))
}

function estNonConforme(code: string | null | undefined): boolean {
  const c = String(code || '').trim().toUpperCase()
  return !c || c.startsWith('NON')
}
// Valeur brute en casse normale pour un niveau inconnu du front.
function casseNormale(code: string): string {
  const c = code.trim().toLowerCase()
  return c.charAt(0).toUpperCase() + c.slice(1)
}
// "FLAGSHIP STORE" -> "Flagship", "VIP PERFECT STORE" -> "VIP", null -> "Non conforme".
function niveauCourt(code: string | null | undefined): string {
  if (estNonConforme(code)) return 'Non conforme'
  return niveauDe(code)?.court ?? casseNormale(String(code))
}
// "FLAGSHIP STORE" -> "Flagship Store", "VIP PERFECT STORE" -> "VIP Perfect Store".
function niveauLibelle(code: string | null | undefined): string {
  if (estNonConforme(code)) return 'Non conforme'
  return niveauDe(code)?.long ?? casseNormale(String(code))
}
function couleurNiveau(code: string | null | undefined): string {
  if (estNonConforme(code)) return COULEUR_NON_CONFORME
  return niveauDe(code)?.couleur ?? COULEUR_NON_CONFORME
}

// Présence et disponibilité : deux séries de la palette commune.
const COULEUR_PRESENCE = SERIES[1]
const COULEUR_DISPO = SERIES[0]
const LIBELLES_CATEGORIE: Record<string, string> = { evap: 'EVAP', imp: 'IMP', scm: 'SCM', uht: 'UHT', yaourt: 'Yaourt', cereales: 'Céréales' }
function libelleCategorie(code: string): string {
  return LIBELLES_CATEGORIE[String(code || '').toLowerCase()] ?? code
}

// Liste à plat des critères manquants pour le niveau cible (badges).
function manqueBadges(m: PerfectStoreManqueItem): string[] {
  const out: string[] = []
  if (m.dispo_manque) out.push(`Disponibilité ${Math.round(Number(m.dispo_rayon ?? 0))} % (minimum ${m.dispo_rayon_min ?? 0} %)`)
  if (m.assortiment_manque) out.push('Assortiment incomplet')
  out.push(...m.visibilite_manques, ...m.promotion_manques)
  return out
}
function fmtRatio(v: number | null | undefined): string {
  return v == null ? 'Non exigé' : `${Math.round(v * 100)} %`
}

function formatDate(value: string): string {
  return formatDateFr(value, { day: '2-digit', month: 'short', year: 'numeric' })
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
    state.erreur = null
  }
  catch (err) {
    state.items = []
    state.total = 0
    state.page = page
    state.erreur = err
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
type TypeStore = { items: PerfectStoreListItem[]; total: number; page: number; loading: boolean; erreur?: unknown }
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
    state.erreur = null
  }
  catch (err) {
    state.items = []
    state.total = 0
    state.page = page
    state.erreur = err
  }
  finally {
    state.loading = false
  }
}

// Un seul type ouvert à la fois (même règle que les merchandisers).
function toggleType(type: string) {
  if (openTypes.has(type)) {
    openTypes.delete(type)
    return
  }
  openTypes.clear()
  openTypes.add(type)
  if (!typeStoreState[type]) loadTypeStores(type, 1)
}

function changeTypePage(type: string, page: number) {
  loadTypeStores(type, page)
}

// Ouvre la fiche d'une visite (liste Perfect Store ou dernière visite d'un
// point de vente à faire progresser).
const visiteEnOuverture = ref<string | null>(null)
async function openStoreDetail(store: { visite_id: string }) {
  visiteEnOuverture.value = store.visite_id
  try {
    const visite = await visitesStore.fetchVisiteByDatabaseId(store.visite_id)
    selectedStoreVisite.value = visite
    selectedStorePerfect.value = refs.value ? scoreVisite(visite.data, visite.pdv || {}) : null
    showStoreDetail.value = true
  }
  catch (err) {
    selectedStoreVisite.value = null
    selectedStorePerfect.value = null
    toast.add({ title: 'Visite non ouverte', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    visiteEnOuverture.value = null
  }
}

onMounted(async () => {
  void fetchTypePdvLabels()
  void fetchReferentiels()
  // Les seuils de niveau doivent être chargés avant applyDashboardFilters, qui
  // itère sur `tiers` pour peupler les listes « PDV par niveau ».
  try {
    await fetchRefs()
  }
  catch (err) {
    // Sans référentiels, le tableau « Seuils » l'indique ; le reste se charge.
    console.error('Tableau de bord : référentiels indisponibles', err)
  }
  finally {
    refsChargees.value = true
  }
  try {
    // Un seul chemin de chargement, filtres + période compris (manques inclus) :
    // les vues globales sans paramètre ne savent pas filtrer par date.
    await applyDashboardFilters()
  } finally {
    loading.value = false
    vague2EnCours.value = false
  }
})
</script>
