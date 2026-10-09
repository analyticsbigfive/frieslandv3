<template>
  <div class="space-y-6">
    <!-- Tournées / Règles récurrentes : onglets du domaine Planning (?vue=regles),
         plus de barre d'onglets dans la page. -->
    <AdminPageHeader
      :description="activeTab === 'templates'
        ? 'Les règles qui génèrent les tournées chaque semaine ou chaque mois, mois suivant compris.'
        : 'Les tournées prévues pour chaque merchandiser, générées par les règles récurrentes.'"
    >
      <!-- Actions de l'onglet courant ; l'action principale (rouge) en dernier. -->
      <template #actions>
        <template v-if="activeTab === 'routings'">
          <UButton v-if="authStore.isAdmin" variant="outline" icon="i-heroicons-arrow-down-tray" :loading="downloadingTemplate" @click="handleDownloadTemplate">
            Modèle de fichier (Excel)
          </UButton>
          <UButton v-if="authStore.isAdmin" variant="outline" icon="i-heroicons-arrow-up-tray" @click="showImportModal = true">
            Importer
          </UButton>
          <UButton variant="outline" icon="i-heroicons-document-arrow-down" :loading="exportEnCours" :disabled="!routings.length" @click="handleExportTournees">
            Exporter
          </UButton>
          <UButton v-if="!lectureSeule" icon="i-heroicons-plus" @click="openCreateRouting">
            Nouvelle tournée
          </UButton>
        </template>
        <template v-else-if="!lectureSeule">
          <UButton icon="i-heroicons-bolt" variant="outline" :loading="preGenerating" @click="handlePreGenerer">
            Générer les 7 prochains jours
          </UButton>
          <UButton icon="i-heroicons-calendar-days" variant="outline" @click="showGenerateModal = true">
            Générer sur une période
          </UButton>
          <UButton icon="i-heroicons-plus" @click="showTemplateCreateModal = true">
            Nouvelle règle
          </UButton>
        </template>
      </template>
    </AdminPageHeader>
    <p v-if="lectureSeule" class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <UIcon name="i-heroicons-eye" class="h-4 w-4 shrink-0" aria-hidden="true" />
      Consultation : le routing de vos merchandisers se charge dans Paramètres › Import / Export, et se corrige dans Paramètres › Référentiels › Routing mensuel.
    </p>

    <!-- ==================== TAB 1: ROUTINGS PONCTUELS ==================== -->
    <template v-if="activeTab === 'routings'">
      <!-- Filtres -->
      <div class="admin-toolbar flex flex-wrap items-end gap-4">
        <div v-if="vueTournees === 'personnes'">
          <label for="filtre-tournees-du" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Date début</label>
          <UInput id="filtre-tournees-du" v-model="filters.dateFrom" type="date" size="sm" />
        </div>
        <div v-if="vueTournees === 'personnes'">
          <label for="filtre-tournees-au" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Date fin</label>
          <UInput id="filtre-tournees-au" v-model="filters.dateTo" type="date" size="sm" />
        </div>
        <div>
          <label for="filtre-tournees-personne" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Personne</label>
          <USelectMenu
            id="filtre-tournees-personne"
            v-model="filters.userId"
            :options="userOptions"
            placeholder="Toute l'équipe"
            option-attribute="label"
            value-attribute="value"
            size="sm"
            class="w-56"
          />
        </div>
        <div v-if="vueTournees === 'personnes'">
          <label for="filtre-tournees-statut" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Statut</label>
          <USelectMenu
            id="filtre-tournees-statut"
            v-model="filters.status"
            :options="statusOptions"
            placeholder="Tous"
            option-attribute="label"
            value-attribute="value"
            size="sm"
            class="w-40"
          />
        </div>
        <UButton variant="outline" size="sm" icon="i-heroicons-arrow-path" @click="loadRoutings">
          Actualiser
        </UButton>
      </div>

      <!-- Affichage (pas une navigation) : planning d'équipe (une ligne par
           personne, une colonne par jour), liste par personne, ou calendrier
           du mois d'une personne. -->
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm font-medium text-slate-600 dark:text-slate-300">Affichage</span>
        <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="radiogroup" aria-label="Affichage des tournées">
          <button
            v-for="v in VUES_TOURNEES"
            :key="v.k"
            type="button"
            role="radio"
            :aria-checked="vueTournees === v.k"
            class="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors"
            :class="vueTournees === v.k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
            @click="choisirVueTournees(v.k)"
          >
            <UIcon :name="v.i" class="h-4 w-4" aria-hidden="true" />{{ v.l }}
          </button>
        </div>
      </div>

      <div v-if="vueTournees === 'calendrier'" class="admin-surface p-3 sm:p-4">
        <CalendrierTournees
          v-if="filters.userId"
          :user-id="filters.userId"
          :regles="reglesDe(filters.userId)"
          :rafraichir="rafraichirCalendrier"
          @jour="ouvrirJourCalendrier(filters.userId, profilDe(filters.userId), $event)"
        />
        <p v-else class="py-8 text-center text-sm text-slate-600 dark:text-slate-300">
          Choisissez une personne dans le filtre « Personne » pour voir son calendrier du mois.
        </p>
      </div>

      <div v-else-if="vueTournees === 'planning'" class="admin-surface p-3 sm:p-4">
        <PlanningEquipe
          :regles="groupedTemplates"
          :utilisateurs="users"
          :nom-ssf="nomSsf"
          :utilisateur-id="filters.userId"
          :rafraichir="rafraichirCalendrier"
          @jour="ouvrirJourCalendrier($event.userId, $event.user, $event)"
        />
      </div>

      <!-- Tournées regroupées par personne : une carte dépliable par merchandiser -->
      <div v-else class="space-y-4">
        <ChargementContenu v-if="loading" libelle="Chargement des tournées…" />

        <div v-else-if="routings.length === 0" class="admin-surface p-8 text-center">
          <UIcon name="i-heroicons-map" class="mx-auto mb-3 h-10 w-10 text-slate-400" aria-hidden="true" />
          <p class="font-semibold text-slate-900 dark:text-white">Aucune tournée sur cette période</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Élargissez les dates ou choisissez « Toute l'équipe ».<template v-if="!lectureSeule"> Vous pouvez aussi créer une tournée, ou la générer depuis une règle récurrente.</template>
          </p>
        </div>

        <template v-else>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            {{ tourneesParPersonne.length }} personne(s) · {{ routings.length }} tournée(s). Cliquez sur une personne pour voir ses tournées.
          </p>

          <div
            v-for="p in tourneesParPersonne"
            :key="p.id"
            class="admin-surface overflow-hidden"
          >
            <!-- En-tête personne -->
            <div
              class="flex cursor-pointer select-none flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40"
              role="button"
              tabindex="0"
              :aria-expanded="personneTourneesOuverte(p.id)"
              @click="basculer(personnesTourneesOuvertes, p.id)"
              @keydown.enter.self.prevent="basculer(personnesTourneesOuvertes, p.id)"
              @keydown.space.self.prevent="basculer(personnesTourneesOuvertes, p.id)"
            >
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200" aria-hidden="true">
                {{ initiales(p.user) }}
              </div>
              <div class="min-w-[12rem] flex-1">
                <h3 class="text-base font-semibold leading-tight text-slate-900 dark:text-white">{{ nomPersonne(p.user) }}</h3>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">
                  {{ profileTerritories(p.user).join(', ') || 'Aucun territoire assigné' }}
                </p>
              </div>

              <!-- Portefeuille tiré du fichier du distributeur (DMS) -->
              <div v-if="p.dms" class="min-w-[14rem] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
                <p class="text-xs font-medium text-slate-600 dark:text-slate-300">Portefeuille (fichier du distributeur)</p>
                <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ libelleDms(p.dms) }}</p>
                <p class="text-xs text-slate-600 dark:text-slate-300">
                  {{ p.dms.nb_pdv ?? 0 }} PDV · {{ libelleJours(p.dms) }}
                  <span v-if="nbSansGpsRegle(p.dms)" class="font-semibold text-red-700 dark:text-red-300"> · {{ nbSansGpsRegle(p.dms) }} sans GPS</span>
                </p>
              </div>
              <div v-else class="min-w-[14rem] rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
                <p class="font-medium">Portefeuille (fichier du distributeur)</p>
                <p>Pas de portefeuille du distributeur</p>
              </div>

              <div class="text-sm tabular-nums sm:text-right">
                <p class="font-semibold text-slate-900 dark:text-white">{{ p.routings.length }} tournée(s)</p>
                <p class="text-xs text-slate-600 dark:text-slate-300">{{ p.nbFaits }}/{{ p.nbPdv }} PDV faits</p>
              </div>

              <div class="ml-auto flex flex-wrap items-center gap-2">
                <UButton size="xs" variant="outline" icon="i-heroicons-calendar-days" @click.stop="voirCalendrier(p.id)">
                  Voir son calendrier
                </UButton>
                <UButton v-if="!lectureSeule" size="xs" variant="outline" icon="i-heroicons-plus" @click.stop="openCreateRoutingPour(p.id)">
                  Nouvelle tournée
                </UButton>
                <UIcon
                  :name="personneTourneesOuverte(p.id) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  class="h-5 w-5 text-slate-500"
                  aria-hidden="true"
                />
              </div>
            </div>

            <!-- Tournées de la personne : une ligne par jour, sans carte dans la carte -->
            <ul v-if="personneTourneesOuverte(p.id)" class="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              <li
                v-for="routing in p.routings"
                :key="routing.id"
                class="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div class="min-w-0">
                  <h4 class="text-sm font-semibold text-slate-900 first-letter:uppercase dark:text-white">{{ formatDate(routing.date_routing) }}</h4>
                  <p v-if="routing.creator" class="text-xs text-slate-500 dark:text-slate-400">Créée par {{ routing.creator.nom }}</p>
                  <p v-if="routing.notes" class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Note : {{ routing.notes }}</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                  <UBadge :color="statusColor(routing.status)" variant="soft" size="sm">
                    {{ statusLabel(routing.status) }}
                  </UBadge>
                  <span class="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
                    {{ routing.nb_faits ?? completedPdvCount(routing) }}/{{ routing.nb_pdv ?? routing.routing_pdv?.length ?? 0 }} PDV faits
                  </span>
                  <UButton size="xs" variant="ghost" icon="i-heroicons-list-bullet" @click="ouvrirTournee(routing, p.user)">
                    Voir les points de vente
                  </UButton>
                  <UDropdown v-if="!lectureSeule" :items="routingActions(routing)" :popper="{ placement: 'bottom-end' }">
                    <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" :aria-label="`Actions sur la tournée du ${formatDate(routing.date_routing)}`" />
                  </UDropdown>
                </div>
              </li>
            </ul>
          </div>
        </template>
      </div>
    </template>

    <!-- ==================== TAB 2: TEMPLATES PERMANENTS ==================== -->
    <template v-if="activeTab === 'templates'">
      <!-- Filtres -->
      <div class="admin-toolbar flex flex-wrap items-end gap-4">
        <div>
          <label for="filtre-regles-personne" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Personne</label>
          <USelectMenu
            id="filtre-regles-personne"
            v-model="templateFilterUser"
            :options="userOptions"
            placeholder="Toute l'équipe"
            option-attribute="label"
            value-attribute="value"
            size="sm"
            class="w-56"
          />
        </div>
        <UButton variant="outline" size="sm" icon="i-heroicons-arrow-path" @click="loadTemplates">
          Actualiser
        </UButton>
      </div>

      <ChargementContenu v-if="templateLoading || !reglesChargees" libelle="Chargement des règles récurrentes…" />

      <div v-else-if="groupedTemplates.length === 0" class="admin-surface p-8 text-center">
        <UIcon name="i-heroicons-calendar" class="mx-auto mb-3 h-10 w-10 text-slate-400" aria-hidden="true" />
        <p class="font-semibold text-slate-900 dark:text-white">Aucune règle récurrente</p>
        <p v-if="lectureSeule" class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Aucune règle pour vos merchandisers : le routing se charge dans Paramètres › Import / Export.
        </p>
        <p v-else class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Créez une règle (« ce merchandiser visite ces points de vente chaque lundi et jeudi ») : les tournées se génèrent ensuite toutes seules.
        </p>
      </div>

      <!-- Règles regroupées par personne : une carte dépliable par merchandiser -->
      <div v-else class="space-y-4">
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ reglesParPersonne.length }} personne(s) · {{ groupedTemplates.length }} règle(s). Cliquez sur une personne pour {{ lectureSeule ? 'voir' : 'voir et modifier' }} ses règles.
        </p>

        <div
          v-for="p in reglesParPersonne"
          :key="p.id"
          class="admin-surface overflow-hidden"
        >
          <!-- En-tête personne -->
          <div
            class="flex cursor-pointer select-none flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40"
            role="button"
            tabindex="0"
            :aria-expanded="personneReglesOuverte(p.id)"
            @click="basculer(personnesOuvertes, p.id)"
            @keydown.enter.self.prevent="basculer(personnesOuvertes, p.id)"
            @keydown.space.self.prevent="basculer(personnesOuvertes, p.id)"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200" aria-hidden="true">
              {{ initiales(p.user) }}
            </div>
            <div class="min-w-[12rem] flex-1">
              <h3 class="text-base font-semibold leading-tight text-slate-900 dark:text-white">{{ nomPersonne(p.user) }}</h3>
              <p class="truncate text-xs text-slate-500 dark:text-slate-400">
                {{ profileTerritories(p.user).join(', ') || 'Aucun territoire assigné' }}
              </p>
            </div>

            <!-- Portefeuille tiré du fichier du distributeur (DMS) -->
            <div v-if="p.dms" class="min-w-[14rem] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
              <p class="text-xs font-medium text-slate-600 dark:text-slate-300">Portefeuille (fichier du distributeur)</p>
              <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ libelleDms(p.dms) }}</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                {{ p.dms.nb_pdv ?? 0 }} PDV · {{ libelleJours(p.dms) }}
                <span v-if="nbSansGpsRegle(p.dms)" class="font-semibold text-red-700 dark:text-red-300"> · {{ nbSansGpsRegle(p.dms) }} sans GPS</span>
              </p>
            </div>
            <div v-else class="min-w-[14rem] rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
              <p class="font-medium">Portefeuille (fichier du distributeur)</p>
              <p>Pas de portefeuille du distributeur</p>
            </div>

            <div class="text-sm tabular-nums sm:text-right">
              <p class="font-semibold text-slate-900 dark:text-white">{{ p.regles.length }} règle(s)</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                {{ p.nbPdv }} PDV
                <span v-if="p.nbSansGps" class="font-semibold text-red-700 dark:text-red-300">· {{ p.nbSansGps }} sans GPS</span>
              </p>
            </div>
            <div class="ml-auto flex items-center gap-2">
              <UButton size="xs" variant="outline" icon="i-heroicons-calendar-days" @click.stop="voirCalendrier(p.id)">
                Voir son calendrier
              </UButton>
              <UIcon
                :name="personneReglesOuverte(p.id) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="h-5 w-5 text-slate-500"
                aria-hidden="true"
              />
            </div>
          </div>

          <!-- Règles de la personne : une section par règle, séparées d'un trait -->
          <div v-if="personneReglesOuverte(p.id)" class="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            <section
              v-for="tpl in p.regles"
              :key="tpl.id"
              class="space-y-4 px-5 py-4"
              :aria-label="`Règle ${titreRegle(tpl)}`"
            >
              <!-- En-tête règle -->
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                  <div class="flex shrink-0 flex-wrap gap-1" aria-hidden="true">
                    <span
                      v-for="j in joursDeRegle(tpl)"
                      :key="j"
                      class="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {{ dayShort[j] }}
                    </span>
                  </div>
                  <div class="min-w-0">
                    <h4 class="text-sm font-semibold text-slate-900 dark:text-white">
                      <span v-if="tpl.label">{{ titreRegle(tpl) }}</span>
                      <span v-else>{{ libelleJours(tpl) }}</span>
                      <span v-if="tpl.label" class="font-normal text-slate-600 dark:text-slate-300"> — {{ libelleJours(tpl) }}</span>
                    </h4>
                    <p class="text-xs text-slate-600 dark:text-slate-300">
                      {{ tpl.nb_pdv ?? tpl.routing_template_pdv?.length ?? 0 }} PDV
                      <span v-if="nbSansGpsRegle(tpl)" class="font-semibold text-red-700 dark:text-red-300">dont {{ nbSansGpsRegle(tpl) }} sans GPS</span>
                      <template v-if="tpl.territoire"> · {{ tpl.territoire }}</template>
                      <template v-if="tpl.distributeur"> · {{ tpl.distributeur }}</template>
                      ·
                      <template v-if="tpl.date_fin">du {{ dateFr(tpl.date_debut) }} au {{ dateFr(tpl.date_fin) }}</template>
                      <template v-else>à partir du {{ dateFr(tpl.date_debut) }}, sans date de fin</template>
                    </p>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge v-if="estRegleDms(tpl)" color="gray" variant="soft" size="sm">Portefeuille du distributeur</UBadge>
                  <UBadge v-if="tpl.mode === 'quota'" color="gray" variant="soft" size="sm" title="Chaque jour, un nombre fixe de points de vente par canal ; chacun est vu une fois par mois (merchandisers d’agence)">
                    Quotas
                  </UBadge>
                  <UBadge v-if="tpl.ssf_id" color="gray" variant="soft" size="sm" :title="quartiersSsfTexte(tpl.ssf_id)">
                    Avec {{ nomSsf(tpl.ssf_id) }} (SSF)
                  </UBadge>
                  <UBadge :color="tpl.is_active ? 'green' : 'gray'" variant="soft" size="sm">
                    {{ tpl.is_active ? 'Active' : 'Inactive' }}
                  </UBadge>
                  <UButton v-if="!lectureSeule" size="xs" variant="outline" icon="i-heroicons-no-symbol" @click="openExceptionModal(tpl)">
                    Décocher une semaine
                  </UButton>
                  <UDropdown v-if="!lectureSeule" :items="templateActions(tpl)" :popper="{ placement: 'bottom-end' }">
                    <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" :aria-label="`Actions sur la règle ${titreRegle(tpl)}`" />
                  </UDropdown>
                </div>
              </div>

              <!-- Jours couverts, semaine par semaine : un clic montre les PDV du jour -->
              <div>
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Points de vente prévus par jour
                  <span class="font-normal text-slate-600 dark:text-slate-300">· cliquez sur un jour pour voir sa liste</span>
                </p>
                <div v-if="semainesDeRegle(tpl).length" class="mt-2 space-y-1.5">
                  <div v-for="sem in semainesDeRegle(tpl)" :key="sem.lundi" class="flex flex-wrap items-center gap-1.5">
                    <span class="w-28 shrink-0 text-xs text-slate-600 dark:text-slate-300">{{ sem.libelle }}</span>
                    <button
                      v-for="d in sem.jours"
                      :key="d"
                      type="button"
                      class="flex min-w-[5.5rem] flex-col items-start rounded-md border px-2 py-1 text-left text-xs transition-colors hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      :class="classeJour(p.id, d)"
                      :title="`Voir les points de vente du ${jourLong(d)}`"
                      @click="ouvrirJour(p.id, p.user, d, tpl)"
                    >
                      <span class="font-semibold">{{ jourCourt(d) }}</span>
                      <span>{{ etatJour(p.id, d) }}</span>
                    </button>
                  </div>
                </div>
                <p v-else class="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Aucun jour prévu sur les 4 prochaines semaines (règle inactive, dates de la règle ou exceptions).
                </p>
              </div>

              <div v-if="tpl.routing_template_exception?.length">
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">Exceptions</p>
                <div class="mt-1 flex flex-wrap gap-1.5">
                  <template v-for="e in tpl.routing_template_exception" :key="e.id">
                    <span
                      v-if="lectureSeule"
                      class="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                    >
                      {{ exceptionLabel(e, tpl) }}
                    </span>
                    <button
                      v-else
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200"
                      :title="`Retirer l'exception : ${exceptionLabel(e, tpl)}`"
                      @click="retirerException(e, tpl)"
                    >
                      {{ exceptionLabel(e, tpl) }}
                      <UIcon name="i-heroicons-x-mark" class="h-3 w-3" aria-hidden="true" />
                      <span class="sr-only">(retirer l'exception)</span>
                    </button>
                  </template>
                </div>
              </div>

              <!-- Affectation des PDV : en popups -->
              <div class="flex flex-wrap items-center gap-2">
                <UButton v-if="!lectureSeule" size="sm" variant="outline" icon="i-heroicons-plus" @click="regleAjoutId = tpl.id">
                  Ajouter des PDV
                </UButton>
                <UButton size="sm" variant="outline" icon="i-heroicons-list-bullet" @click="ouvrirGestionPdv(tpl)">
                  {{ lectureSeule ? 'Voir' : 'Gérer' }} les {{ tpl.nb_pdv ?? tpl.routing_template_pdv?.length ?? 0 }} PDV du portefeuille
                </UButton>
                <p v-if="tpl.notes" class="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <UIcon name="i-heroicons-document-text" class="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span><span class="sr-only">Note : </span>{{ tpl.notes }}</span>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== CREATE ROUTING MODAL ==================== -->
    <AdminFormModal
      v-model="showCreateModal"
      :title="editingRoutingId ? 'Modifier la tournée' : 'Nouvelle tournée'"
      description="Planifiez la tournée, puis composez la liste ordonnée des points de vente."
      icon="i-heroicons-map"
      width="sm:max-w-4xl"
      body-class="space-y-8"
      required-note
    >
      <section aria-labelledby="routing-planning-title">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" aria-hidden="true">
            <UIcon name="i-heroicons-calendar-days" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="routing-planning-title" class="text-sm font-semibold text-slate-900 dark:text-white">
              Planification
            </h3>
            <p class="text-xs text-slate-600 dark:text-slate-300">Personne, date et instructions destinées au terrain.</p>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormGroup label="Personne" required size="md">
            <USelectMenu
              v-model="newRouting.userId"
              :options="merchandiserOptions"
              placeholder="Choisir une personne"
              option-attribute="label"
              value-attribute="value"
              searchable
              searchable-placeholder="Rechercher…"
              size="md"
              class="w-full"
            />
          </UFormGroup>
          <UFormGroup label="Date" required size="md">
            <UInput v-model="newRouting.date" type="date" size="md" class="w-full" />
          </UFormGroup>
          <UFormGroup v-if="editingRoutingId" label="Statut" size="md">
            <USelectMenu
              v-model="newRouting.status"
              :options="editStatusOptions"
              option-attribute="label"
              value-attribute="value"
              size="md"
              class="w-full"
            />
          </UFormGroup>
        </div>

        <UFormGroup label="Notes" class="mt-5" size="md">
          <UTextarea v-model="newRouting.notes" placeholder="Instructions pour le terrain…" :rows="2" />
        </UFormGroup>
      </section>

      <section aria-labelledby="routing-pdv-title" class="border-t border-slate-200 pt-7 dark:border-slate-700">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" aria-hidden="true">
            <UIcon name="i-heroicons-building-storefront" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="routing-pdv-title" class="text-sm font-semibold text-slate-900 dark:text-white">
              Points de vente à visiter
            </h3>
            <p class="text-xs text-slate-600 dark:text-slate-300">Filtrez, ajoutez puis réordonnez les étapes de la tournée.</p>
          </div>
        </div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Points de vente de la tournée <span class="text-red-700 dark:text-red-300" aria-hidden="true">*</span></span>
            <span class="text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ newRouting.pdvItems.length }} sélectionné(s)</span>
          </div>

          <!-- Périmètre : on ne peut cocher que les PDV des territoires du merchandiser choisi. -->
          <div
            v-if="!newRouting.userId"
            class="mb-3 rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          >
            Choisissez d’abord une personne pour voir les points de vente de ses territoires.
          </div>
          <div
            v-else-if="!scopedPdvList.length"
            class="mb-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            Aucun point de vente dans le périmètre de cette personne
            ({{ profileTerritories(selectedMerchandiser).join(', ') || 'aucun territoire assigné' }}) : assignez-lui un territoire dans Paramètres › Utilisateurs.
          </div>

          <!-- Préselection par colonnes PDV -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <USelectMenu v-model="pdvFilter.canal" :options="pdvFilterCanalOptions" option-attribute="label" value-attribute="value" placeholder="Canal" size="sm" />
            <USelectMenu v-model="pdvFilter.region" :options="pdvFilterRegionOptions" option-attribute="label" value-attribute="value" placeholder="Région" size="sm" />
            <USelectMenu v-model="pdvFilter.zone" :options="pdvFilterZoneOptions" option-attribute="label" value-attribute="value" placeholder="Zone" size="sm" />
            <USelectMenu v-model="pdvFilter.quartier" :options="pdvFilterQuartierOptions" option-attribute="label" value-attribute="value" placeholder="Quartier" size="sm" />
          </div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ filteredAvailablePdv.length }} point(s) de vente disponible(s)</span>
            <div class="flex flex-wrap gap-2">
              <UButton v-if="hasPdvFilter" size="xs" variant="ghost" icon="i-heroicons-x-mark" @click="clearPdvFilter">
                Réinitialiser
              </UButton>
              <UButton
                size="xs"
                variant="outline"
                icon="i-heroicons-plus-circle"
                :disabled="!filteredAvailablePdv.length"
                @click="addFilteredPDV"
              >
                Tout ajouter ({{ filteredAvailablePdv.length }})
              </UButton>
            </div>
          </div>

          <!-- Liste cochable des PDV filtrés -->
          <div
            v-if="hasPdvFilter"
            class="mb-3 max-h-48 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-700 dark:border-slate-700"
          >
            <label
              v-for="p in filteredPdvForSelection"
              :key="p.pdv_id"
              class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <input
                type="checkbox"
                :checked="selectedPdvIds.has(p.pdv_id)"
                class="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                @change="togglePdvSelection(p.pdv_id)"
              />
              <span class="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-white">{{ p.nom_pdv || 'Point de vente sans nom' }}</span>
              <span class="shrink-0 text-xs text-slate-500 dark:text-slate-400">{{ [p.zone, p.quartier].filter(Boolean).join(' / ') }}</span>
            </label>
            <p v-if="!filteredPdvForSelection.length" class="px-3 py-4 text-center text-xs text-slate-600 dark:text-slate-300">
              Aucun point de vente pour ces filtres : changez un filtre ou cliquez sur « Réinitialiser ».
            </p>
          </div>

          <div class="flex gap-2 mb-3">
            <USelectMenu
              v-model="selectedPdvToAdd"
              :options="filteredAvailablePdvOptions"
              placeholder="Ajouter un point de vente…"
              searchable
              searchable-placeholder="Rechercher un point de vente…"
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="flex-1"
            />
            <UButton
              size="sm"
              variant="outline"
              icon="i-heroicons-plus"
              :disabled="!selectedPdvToAdd"
              @click="addPDV"
            >
              Ajouter
            </UButton>
          </div>

          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="(item, idx) in newRouting.pdvItems"
              :key="item.pdv_id"
              class="flex flex-wrap items-center gap-3 rounded-md bg-slate-50 px-3 py-2 transition-all dark:bg-slate-700/50"
              :class="[
                dragIndex === idx ? 'opacity-40' : '',
                dragOverIndex === idx && dragIndex !== idx ? 'ring-2 ring-fc-red ring-inset' : '',
              ]"
              draggable="true"
              @dragstart="onDragStart(idx)"
              @dragenter.prevent="onDragEnter(idx)"
              @dragover.prevent
              @drop="onDrop(idx)"
              @dragend="onDragEnd"
            >
              <UIcon name="i-heroicons-bars-3" class="h-4 w-4 shrink-0 cursor-grab text-slate-500 active:cursor-grabbing" title="Glisser pour réordonner" aria-hidden="true" />
              <div class="flex flex-col gap-0.5">
                <button type="button" class="text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white" :disabled="idx === 0" :aria-label="`Monter ${getPDVName(item.pdv_id)}`" @click="movePDV(idx, -1)">
                  <UIcon name="i-heroicons-chevron-up" class="h-3 w-3" aria-hidden="true" />
                </button>
                <button type="button" class="text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white" :disabled="idx === newRouting.pdvItems.length - 1" :aria-label="`Descendre ${getPDVName(item.pdv_id)}`" @click="movePDV(idx, 1)">
                  <UIcon name="i-heroicons-chevron-down" class="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold tabular-nums text-slate-800 dark:bg-slate-600 dark:text-white">{{ idx + 1 }}</span>
              <div class="min-w-[10rem] flex-1">
                <p class="truncate text-sm font-medium text-slate-900 dark:text-white">{{ getPDVName(item.pdv_id) }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label v-for="obj in objectifOptions" :key="obj.key" class="flex items-center gap-1">
                  <input
                    type="checkbox"
                    :checked="!!(item.objectifs as Record<string, boolean>)[obj.key]"
                    class="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    @change="toggleObjectif(idx, obj.key)"
                  />
                  <span class="text-xs text-slate-700 dark:text-slate-200">{{ obj.short }}</span>
                </label>
              </div>
              <button type="button" class="text-red-600 hover:text-red-800 dark:text-red-400" :aria-label="`Retirer ${getPDVName(item.pdv_id)} de la tournée`" @click="removePDV(idx)">
                <UIcon name="i-heroicons-x-mark" class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
      </section>

      <template #footer>
        <UButton type="button" color="gray" variant="ghost" @click="closeRoutingModal">
          Annuler
        </UButton>
        <UButton
          icon="i-heroicons-check"
          :loading="creating"
          :disabled="!canCreate"
          @click="handleSaveRouting"
        >
          {{ editingRoutingId ? 'Enregistrer la tournée' : 'Créer la tournée' }}
        </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== DUPLICATE ROUTING MODAL ==================== -->
    <AdminFormModal
      v-model="showDuplicateModal"
      title="Dupliquer la tournée"
      description="Créez une nouvelle tournée à partir de la sélection actuelle."
      icon="i-heroicons-document-duplicate"
      width="sm:max-w-xl"
      body-class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2"
      required-note
    >
        <UFormGroup label="Nouvelle date" required size="md">
          <UInput v-model="duplicateDate" type="date" size="md" class="w-full" />
        </UFormGroup>
        <UFormGroup label="Personne" help="Laissez vide pour garder la même personne." size="md">
          <USelectMenu
            v-model="duplicateUserId"
            :options="merchandiserOptions"
            placeholder="Même personne"
            option-attribute="label"
            value-attribute="value"
            searchable
            size="md"
            class="w-full"
          />
        </UFormGroup>

      <template #footer>
          <UButton type="button" color="gray" variant="ghost" @click="showDuplicateModal = false">Annuler</UButton>
          <UButton
            icon="i-heroicons-document-duplicate"
            :disabled="!duplicateDate"
            @click="handleDuplicate"
          >
            Dupliquer
          </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== CREATE TEMPLATE MODAL ==================== -->
    <AdminFormModal
      v-model="showTemplateCreateModal"
      :title="regleEditionId ? 'Modifier la règle' : 'Nouvelle règle récurrente'"
      :description="regleEditionId
        ? 'Les tournées déjà générées ne changent pas ; Référentiels › Maintenance › « Recalculer les tournées à venir » applique tout de suite la règle modifiée.'
        : '« Ce merchandiser visite ces PDV chaque lundi et chaque jeudi. » La règle se répète d’elle-même, mois suivant compris.'"
      icon="i-heroicons-arrow-path-rounded-square"
      width="sm:max-w-2xl"
      body-class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2"
      required-note
    >
        <UFormGroup label="Merchandiser" required size="md">
          <USelectMenu
            v-model="newTemplate.userId"
            :options="merchandiserOptions"
            placeholder="Choisir une personne"
            option-attribute="label"
            value-attribute="value"
            :disabled="!!regleEditionId"
            searchable
            searchable-placeholder="Rechercher…"
            size="md"
            class="w-full"
          />
        </UFormGroup>
        <UFormGroup label="Nom de la règle" size="md">
          <UInput v-model="newTemplate.label" placeholder="Ex. Tournée Appolo" size="md" class="w-full" />
        </UFormGroup>

        <UFormGroup label="Jours de la semaine" required size="md" class="sm:col-span-2">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="j in JOURS_SEMAINE"
              :key="j.value"
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
              :class="newTemplate.daysOfWeek.includes(j.value)
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'"
              :aria-pressed="newTemplate.daysOfWeek.includes(j.value)"
              @click="toggleJour(j.value)"
            >
              {{ j.label }}
            </button>
          </div>
        </UFormGroup>

        <!-- Territoire et distributeur portés par LA RÈGLE : un merchandiser peut
             couvrir Abobo/Distributeur A une semaine, Adjamé/Distributeur B la
             suivante. Il suffit de créer deux règles. -->
        <UFormGroup label="Territoire" help="Limite les points de vente que cette règle peut contenir." size="md">
          <USelectMenu
            v-model="newTemplate.territoire"
            :options="territoireOptionsRegle"
            placeholder="Tous"
            size="md"
            searchable
            class="w-full"
          />
        </UFormGroup>
        <UFormGroup label="Distributeur" size="md">
          <UInput v-model="newTemplate.distributeur" placeholder="Ex. Distributeur A" size="md" class="w-full" />
        </UFormGroup>

        <!-- Binôme : le SSF (vendeur du distributeur) avec qui le merchandiser
             travaille les jours choisis ; ses quartiers bornent les PDV de la règle. -->
        <UFormGroup v-if="sousZonesSsf.length" label="Vendeur du distributeur (SSF) qui accompagne" :help="aideSsf" size="md" class="sm:col-span-2">
          <USelectMenu
            v-model="ssfChoisi"
            :options="ssfOptions"
            option-attribute="label"
            value-attribute="value"
            searchable
            searchable-placeholder="Rechercher un vendeur…"
            size="md"
            class="w-full"
          />
        </UFormGroup>

        <UFormGroup
          label="Composition de la tournée du jour"
          help="Le nombre de points de vente par canal se règle dans Référentiels › Quotas."
          size="md"
          class="sm:col-span-2"
        >
          <USelectMenu
            v-model="newTemplate.mode"
            :options="modeOptions"
            option-attribute="label"
            value-attribute="value"
            size="md"
            class="w-full"
          />
        </UFormGroup>

        <UFormGroup label="À partir du" size="md">
          <UInput v-model="newTemplate.dateDebut" type="date" size="md" class="w-full" />
        </UFormGroup>
        <UFormGroup label="Jusqu'au" help="Laissez vide pour une règle sans fin." size="md">
          <UInput v-model="newTemplate.dateFin" type="date" size="md" class="w-full" />
        </UFormGroup>

        <UFormGroup label="Notes" size="md" class="sm:col-span-2">
          <UTextarea v-model="newTemplate.notes" placeholder="Instructions récurrentes…" :rows="2" />
        </UFormGroup>

      <template #footer>
          <UButton type="button" color="gray" variant="ghost" @click="showTemplateCreateModal = false">Annuler</UButton>
          <UButton
            icon="i-heroicons-check"
            :disabled="!newTemplate.userId || !newTemplate.daysOfWeek.length"
            :loading="creating"
            @click="handleCreateTemplate"
          >
            {{ regleEditionId ? 'Enregistrer' : 'Créer la règle' }}
          </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== EXCEPTION (décocher une semaine) ==================== -->
    <AdminFormModal
      v-model="showExceptionModal"
      title="Décocher une période"
      description="Suspend la tournée, ou un seul point de vente, sur une période. La règle n'est pas supprimée : elle reprend d'elle-même après."
      icon="i-heroicons-no-symbol"
      width="sm:max-w-xl"
      body-class="space-y-5"
    >
      <UFormGroup label="Portée" size="md">
        <USelectMenu
          v-model="newException.pdvId"
          :options="exceptionPdvOptions"
          option-attribute="label"
          value-attribute="value"
          size="md"
          class="w-full"
        />
      </UFormGroup>

      <div class="flex flex-wrap gap-2">
        <UButton size="xs" variant="outline" @click="setSemaineException(0)">Cette semaine</UButton>
        <UButton size="xs" variant="outline" @click="setSemaineException(1)">Semaine prochaine</UButton>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <UFormGroup label="Du" required size="md">
          <UInput v-model="newException.dateDebut" type="date" size="md" class="w-full" />
        </UFormGroup>
        <UFormGroup label="Au" required size="md">
          <UInput v-model="newException.dateFin" type="date" size="md" class="w-full" />
        </UFormGroup>
      </div>

      <UFormGroup label="Motif" size="md">
        <UInput v-model="newException.motif" placeholder="Ex. congés, PDV fermé" size="md" class="w-full" />
      </UFormGroup>

      <template #footer>
        <UButton type="button" color="gray" variant="ghost" @click="showExceptionModal = false">Annuler</UButton>
        <UButton
          icon="i-heroicons-check"
          :disabled="!newException.dateDebut || !newException.dateFin"
          @click="handleAddException"
        >
          Enregistrer l'exception
        </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== GENERATE ROUTINGS MODAL ==================== -->
    <AdminFormModal
      v-model="showGenerateModal"
      title="Générer les tournées"
      description="Crée les tournées de chaque jour à partir des règles récurrentes. Les journées déjà planifiées ne sont pas touchées."
      icon="i-heroicons-arrow-path-rounded-square"
      width="sm:max-w-2xl"
      body-class="space-y-5"
      required-note
    >
        <UFormGroup label="Personne" required size="md">
          <USelectMenu
            v-model="generateConfig.userId"
            :options="merchandiserOptions"
            placeholder="Choisir une personne"
            option-attribute="label"
            value-attribute="value"
            searchable
            size="md"
            class="w-full"
          />
        </UFormGroup>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <UFormGroup label="Du" required size="md">
            <UInput v-model="generateConfig.dateFrom" type="date" size="md" class="w-full" />
          </UFormGroup>
          <UFormGroup label="Au" required size="md">
            <UInput v-model="generateConfig.dateTo" type="date" size="md" class="w-full" />
          </UFormGroup>
        </div>

        <p v-if="generateMessage" class="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-200" role="status">
          {{ generateMessage }}
        </p>

      <template #footer>
          <UButton type="button" color="gray" variant="ghost" @click="showGenerateModal = false; generateMessage = ''">Fermer</UButton>
          <UButton
            icon="i-heroicons-sparkles"
            :disabled="!generateConfig.userId || !generateConfig.dateFrom || !generateConfig.dateTo"
            :loading="generating"
            @click="handleGenerate"
          >
            Générer
          </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== AJOUT DE PDV À UNE RÈGLE ==================== -->
    <AdminFormModal
      :model-value="!!regleAjout && !lectureSeule"
      :title="`Ajouter des PDV — ${nomPersonne(regleAjout?.user)}`"
      :description="regleAjout ? `Règle « ${titreRegle(regleAjout)} » · ${regleAjout.nb_pdv ?? 0} PDV. Seuls les points de vente de son périmètre sont proposés ; la fenêtre reste ouverte pour enchaîner les ajouts.` : ''"
      icon="i-heroicons-plus"
      width="sm:max-w-xl"
      body-class="space-y-4"
      @update:model-value="(v: boolean) => { if (!v) regleAjoutId = null }"
    >
      <div v-if="regleAjout" class="flex flex-wrap gap-2">
        <USelectMenu
          v-model="templateAddPdvId[regleAjout.id]"
          :options="availableTemplatePdvOptions(regleAjout)"
          placeholder="Rechercher un point de vente du périmètre…"
          searchable
          searchable-placeholder="Nom ou zone…"
          option-attribute="label"
          value-attribute="value"
          size="md"
          class="min-w-[14rem] flex-1"
        />
        <UButton
          icon="i-heroicons-plus"
          :disabled="!templateAddPdvId[regleAjout.id]"
          @click="handleAddTemplatePDV(regleAjout)"
        >
          Ajouter
        </UButton>
      </div>
      <template #footer>
        <UButton color="gray" variant="ghost" @click="regleAjoutId = null">Fermer</UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== GESTION DES PDV D'UNE RÈGLE ==================== -->
    <AdminFormModal
      :model-value="!!regleGestion"
      :title="`PDV du portefeuille — ${nomPersonne(regleGestion?.user)}`"
      :description="regleGestion ? `Règle « ${titreRegle(regleGestion)} » · ${regleGestion.nb_pdv ?? 0} PDV${nbSansGpsRegle(regleGestion) ? `, dont ${nbSansGpsRegle(regleGestion)} sans GPS` : ''}.${lectureSeule ? '' : ' Ordre, objectifs et retrait de chaque point de vente.'}` : ''"
      icon="i-heroicons-list-bullet"
      width="sm:max-w-4xl"
      body-class="space-y-4"
      @update:model-value="(v: boolean) => { if (!v) regleGestionId = null }"
    >
      <template v-if="regleGestion">
        <div v-if="!lectureSeule" class="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <p class="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">Ajouter un point de vente</p>
          <div class="flex flex-wrap gap-2">
            <USelectMenu
              v-model="templateAddPdvId[regleGestion.id]"
              :options="availableTemplatePdvOptions(regleGestion)"
              placeholder="Rechercher un point de vente du périmètre…"
              searchable
              searchable-placeholder="Nom ou zone…"
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="min-w-[14rem] flex-1"
            />
            <UButton
              size="sm"
              icon="i-heroicons-plus"
              :disabled="!templateAddPdvId[regleGestion.id]"
              @click="handleAddTemplatePDV(regleGestion)"
            >
              Ajouter
            </UButton>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <UInput v-model="rechercheGestion" icon="i-heroicons-magnifying-glass" placeholder="Filtrer par nom, code, zone ou quartier" size="sm" class="min-w-[14rem] flex-1" aria-label="Filtrer les points de vente de la règle" />
          <span class="text-xs tabular-nums text-slate-600 dark:text-slate-300">
            {{ pdvGestionFiltres.length }} affiché(s) sur {{ regleGestion.routing_template_pdv?.length || 0 }} chargé(s), {{ regleGestion.nb_pdv ?? 0 }} au total
          </span>
        </div>
        <p v-if="rechercheGestion && !lectureSeule" class="text-xs text-slate-600 dark:text-slate-300">Le filtre porte sur les points de vente chargés ; videz-le pour changer l'ordre.</p>

        <ul class="space-y-2">
          <li
            v-for="{ tp, idx } in pdvGestionFiltres"
            :key="tp.id"
            class="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-700/50"
          >
            <div v-if="!lectureSeule" class="flex flex-col gap-0.5">
              <button
                type="button"
                class="text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white"
                :disabled="idx === 0 || !!rechercheGestion"
                :aria-label="`Monter ${tp.pdv?.nom_pdv || 'ce point de vente'}`"
                title="Monter"
                @click="moveTemplatePDV(regleGestion, idx, -1)"
              >
                <UIcon name="i-heroicons-chevron-up" class="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white"
                :disabled="idx === (regleGestion.routing_template_pdv?.length || 1) - 1 || !!rechercheGestion"
                :aria-label="`Descendre ${tp.pdv?.nom_pdv || 'ce point de vente'}`"
                title="Descendre"
                @click="moveTemplatePDV(regleGestion, idx, 1)"
              >
                <UIcon name="i-heroicons-chevron-down" class="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold tabular-nums text-slate-800 dark:bg-slate-600 dark:text-white">{{ idx + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-slate-900 dark:text-white">{{ tp.pdv?.nom_pdv || 'Point de vente sans nom' }}</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                {{ tp.pdv?.zone || '' }} {{ tp.pdv?.quartier ? `— ${tp.pdv.quartier}` : '' }}
                <span v-if="tp.pdv && !pdvAGps(tp.pdv)" class="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">Sans GPS</span>
              </p>
            </div>
            <div class="hidden flex-wrap items-center gap-1 sm:flex">
              <template v-for="(val, key) in tp.objectifs" :key="key">
                <UBadge v-if="val" variant="soft" size="xs" color="gray">{{ objectifLabel(key as string) }}</UBadge>
              </template>
            </div>
            <template v-if="!lectureSeule">
              <UDropdown :items="templatePDVObjectifActions(regleGestion, tp)" :popper="{ placement: 'bottom-end' }">
                <UButton variant="ghost" size="xs" icon="i-heroicons-cog-6-tooth" title="Modifier les objectifs" :aria-label="`Modifier les objectifs de ${tp.pdv?.nom_pdv || 'ce point de vente'}`" />
              </UDropdown>
              <UButton variant="ghost" color="red" size="xs" icon="i-heroicons-x-mark" title="Retirer de la règle" :aria-label="`Retirer ${tp.pdv?.nom_pdv || 'ce point de vente'} de la règle`" @click="handleRemoveTemplatePDV(regleGestion, tp)" />
            </template>
          </li>
          <li v-if="!pdvGestionFiltres.length" class="py-6 text-center text-sm text-slate-600 dark:text-slate-300">
            Aucun point de vente ne correspond : modifiez ou videz le filtre.
          </li>
        </ul>

        <div v-if="(regleGestion.routing_template_pdv?.length || 0) < (regleGestion.nb_pdv ?? 0)" class="text-center">
          <UButton size="xs" variant="outline" :loading="chargementRegles.has(regleGestion.id)" @click="chargerSuiteRegle(regleGestion)">
            Afficher la suite ({{ (regleGestion.nb_pdv ?? 0) - (regleGestion.routing_template_pdv?.length || 0) }} PDV restants)
          </UButton>
        </div>
      </template>
      <template #footer>
        <UButton color="gray" variant="ghost" @click="regleGestionId = null">Fermer</UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== TOURNÉE DU JOUR ==================== -->
    <AdminFormModal
      :model-value="jourModal.ouvert"
      :title="`${jourLong(jourModal.date || aujourdhui)} — ${nomPersonne(jourModal.user)}`"
      :description="jourModal.routing
        ? `Tournée ${statusLabel(jourModal.routing.status).toLowerCase()} · ${jourModal.routing.nb_pdv ?? jourModal.etapes.length} PDV. Une seule tournée par jour réunit toutes les règles de la personne.`
        : 'Cette journée n\'est pas encore générée.'"
      icon="i-heroicons-calendar-days"
      width="sm:max-w-3xl"
      body-class="space-y-4"
      @update:model-value="(v: boolean) => { if (!v) jourModal.ouvert = false }"
    >
      <template v-if="jourModal.routing">
        <div class="flex flex-wrap items-center gap-3">
          <p class="rounded-md bg-emerald-50 px-3 py-2 text-sm tabular-nums text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            <strong>{{ nbFaitsJour }}</strong> / {{ jourModal.etapes.length }} PDV faits
          </p>
          <div class="ml-auto inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="radiogroup" aria-label="Points de vente affichés">
            <button
              v-for="f in [{ v: 'tous', l: 'Tous' }, { v: 'afaire', l: 'À faire' }, { v: 'faits', l: 'Faits' }]"
              :key="f.v"
              type="button"
              role="radio"
              :aria-checked="jourModal.filtre === f.v"
              class="rounded px-3 py-1 text-xs font-medium transition-colors"
              :class="jourModal.filtre === f.v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
              @click="jourModal.filtre = f.v as any"
            >
              {{ f.l }}
            </button>
          </div>
        </div>

        <ChargementContenu v-if="jourModal.chargement" variante="lignes" libelle="Chargement des points de vente…" />
        <ul v-else class="space-y-2">
          <li
            v-for="rp in etapesJourFiltrees"
            :key="rp.id"
            class="flex items-center gap-3 rounded-md px-3 py-2"
            :class="rp.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10' : rp.status === 'skipped' ? 'bg-slate-100 dark:bg-slate-700/50' : rp.status === 'in_progress' ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-slate-50 dark:bg-slate-800'"
          >
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
              :class="rp.status === 'completed' ? 'bg-emerald-700 text-white' : rp.status === 'skipped' ? 'bg-slate-600 text-white' : rp.status === 'in_progress' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-white'"
            >
              {{ rp.position_order }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-slate-900 dark:text-white">{{ rp.pdv?.nom_pdv || 'Point de vente sans nom' }}</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                {{ rp.pdv?.zone || '' }} {{ rp.pdv?.quartier ? `— ${rp.pdv.quartier}` : '' }}
                <span v-if="rp.pdv && !pdvAGps(rp.pdv)" class="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">Sans GPS</span>
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-1.5">
              <template v-for="(val, key) in rp.objectifs" :key="key">
                <UBadge v-if="val" variant="soft" size="xs" color="gray" class="hidden sm:inline-flex">{{ objectifLabel(key as string) }}</UBadge>
              </template>
              <span v-if="rp.geofence_validated" class="inline-flex items-center text-emerald-700 dark:text-emerald-300" title="Position GPS validée sur place">
                <UIcon name="i-heroicons-map-pin-solid" class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Position GPS validée sur place</span>
              </span>
              <UBadge :color="pdvStatusColor(rp.status)" variant="soft" size="xs">{{ pdvStatusLabel(rp.status) }}</UBadge>
            </div>
          </li>
          <li v-if="!etapesJourFiltrees.length" class="py-6 text-center text-sm text-slate-600 dark:text-slate-300">
            Aucun point de vente pour ce filtre : choisissez « Tous ».
          </li>
        </ul>
        <p v-if="jourModal.routing.notes" class="text-xs text-slate-600 dark:text-slate-300">Note : {{ jourModal.routing.notes }}</p>
      </template>

      <div v-else class="space-y-3 text-sm text-slate-700 dark:text-slate-200">
        <p v-if="jourModal.date < aujourdhui">Aucune tournée n'a été planifiée ce jour-là.</p>
        <template v-else>
          <p v-if="jourModal.regle?.mode === 'quota'">
            Règle <strong>par quotas</strong> : la liste du jour est choisie au moment de la génération, parmi les points de vente
            du portefeuille pas encore prévus ni visités ce mois-ci. Le nombre par canal se règle dans Référentiels › Quotas.
          </p>
          <p v-else-if="jourModal.regle">
            Règle <strong>tout le portefeuille</strong> : ses {{ jourModal.regle.nb_pdv ?? 0 }} points de vente seront à visiter ce jour-là, sauf exceptions.
          </p>
          <p class="text-xs text-slate-600 dark:text-slate-300">
            Les tournées se génèrent automatiquement chaque nuit pour les 7 jours suivants.<template v-if="!lectureSeule"> Vous pouvez générer celle-ci dès maintenant pour voir sa liste.</template>
          </p>
        </template>
      </div>

      <template #footer>
        <UButton color="gray" variant="ghost" @click="jourModal.ouvert = false">Fermer</UButton>
        <!-- Compte agence (lectureSeule) : ni modification ni génération depuis cette fenêtre. -->
        <UButton v-if="jourModal.routing && !lectureSeule" variant="outline" icon="i-heroicons-pencil-square" @click="modifierTourneeDuJour">
          Modifier cette tournée
        </UButton>
        <UButton
          v-else-if="!jourModal.routing && jourModal.date >= aujourdhui && !lectureSeule"
          icon="i-heroicons-sparkles"
          :loading="jourModal.generation"
          @click="genererJour"
        >
          Générer cette journée
        </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== IMPORT ROUTINGS MODAL ==================== -->
    <UModal v-model="showImportModal" :ui="{ width: 'max-w-xl' }">
      <div class="space-y-4 p-6">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Importer des tournées</h2>

        <ol class="space-y-2 text-sm text-slate-700 dark:text-slate-200">
          <li class="flex gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-800 dark:bg-slate-600 dark:text-white" aria-hidden="true">1</span>
            <span>
              <UButton variant="link" size="sm" class="p-0 align-baseline" :loading="downloadingTemplate" @click="handleDownloadTemplate">Téléchargez le modèle de fichier (Excel)</UButton>
              : il contient les merchandisers et les points de vente à jour.
            </span>
          </li>
          <li class="flex gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-800 dark:bg-slate-600 dark:text-white" aria-hidden="true">2</span>
            <span>Remplissez l'onglet <strong>Tournées</strong> : une ligne par point de vente à visiter, en choisissant chaque valeur dans les listes. L'onglet <em>Mode d'emploi</em> détaille chaque colonne.</span>
          </li>
          <li class="flex gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-800 dark:bg-slate-600 dark:text-white" aria-hidden="true">3</span>
            <span>Enregistrez-le, choisissez-le ci-dessous et cliquez sur <strong>Importer</strong>. Une journée déjà planifiée est mise à jour, jamais dupliquée.</span>
          </li>
        </ol>

        <UFormGroup label="Que faire des points de vente déjà prévus mais absents du fichier ?" size="sm">
          <div class="space-y-2">
            <label class="flex cursor-pointer items-start gap-2">
              <input v-model="importMode" type="radio" value="fusion" class="mt-1 text-brand-500 focus:ring-brand-500" />
              <span class="text-sm">
                <strong class="text-slate-900 dark:text-white">Les garder</strong>
                <span class="block text-xs text-slate-600 dark:text-slate-300">
                  À utiliser pour corriger un mois déjà importé sans rien perdre.
                </span>
              </span>
            </label>
            <label class="flex cursor-pointer items-start gap-2">
              <input v-model="importMode" type="radio" value="remplacement" class="mt-1 text-brand-500 focus:ring-brand-500" />
              <span class="text-sm">
                <strong class="text-slate-900 dark:text-white">Les retirer</strong>
                <span class="block text-xs text-slate-600 dark:text-slate-300">
                  La tournée devient exactement le contenu du fichier.
                </span>
              </span>
            </label>
          </div>
        </UFormGroup>

        <div class="rounded-md border-2 border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
          <input ref="importFileInput" type="file" accept=".xlsx,.csv" class="hidden" @change="handleImportFileSelect" />
          <UButton variant="outline" @click="($refs.importFileInput as HTMLInputElement)?.click()">
            Choisir le fichier
          </UButton>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Excel (.xlsx) ou ancien format CSV</p>
          <p v-if="importFile" class="mt-2 text-sm text-slate-700 dark:text-slate-200">{{ importFile.name }}</p>
        </div>

        <!-- Résultat import -->
        <div v-if="importSummary" class="space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-700/50" role="status">
          <div class="flex flex-wrap gap-3 text-sm tabular-nums">
            <span class="font-medium text-slate-900 dark:text-white">{{ importSummary.created }} créée(s)</span>
            <span class="font-medium text-slate-900 dark:text-white">{{ importSummary.updated }} mise(s) à jour</span>
            <span class="text-slate-600 dark:text-slate-300">{{ importSummary.pdvCount }} point(s) de vente</span>
            <span v-if="importSummary.errors.length" class="font-medium text-red-700 dark:text-red-300">{{ importSummary.errors.length }} ligne(s) à corriger</span>
          </div>
          <ul v-if="importSummary.errors.length" class="max-h-40 space-y-1 overflow-y-auto border-t border-slate-200 pt-2 dark:border-slate-600">
            <li v-for="(e, i) in importSummary.errors" :key="i" class="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
              <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{{ e }}</span>
            </li>
          </ul>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <UButton color="gray" variant="ghost" @click="closeImportModal">Fermer</UButton>
          <UButton :disabled="!importFile" :loading="importing" @click="handleImportRoutings">
            Importer
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Profile, Routing, RoutingPDV, RoutingObjectives, RoutingTemplate, RoutingTemplatePDV, RoutingTemplateException, RoutingTemplateMode } from '~/types'
import { toIsoJour, debutDeSemaine } from '~/utils/periode'
import { fetchAllRows } from '~/utils/fetchAll'
import { JOURS_SEMAINE, joursDeRegle, libelleJours, datesDeRegle } from '~/utils/routingRecurrence'
import { messageUtilisateur } from '~/utils/supabaseErrors'

// Écran de PLANIFICATION : création et édition de routings, de templates et
// d'exceptions. La matrice RBAC le range dans la section « principal », ouverte
// au commercial — qui consulte en lecture seule. Une garde de route plutôt
// qu'une dizaine de `v-if` : les contrôles d'écriture sont disséminés dans tout
// le fichier, en manquer un rouvrirait le trou en silence.
definePageMeta({
  middleware: [
    'auth',
    'admin',
    () => {
      const authStore = useAuthStore()
      if (!authStore.isSuperviseur && !authStore.isAgence) return navigateTo('/admin')
    },
  ],
  layout: 'admin',
})

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const routingStore = useRoutingStore()
const toast = useToast()
const { parseCsv } = useCsvExport()
const { downloadRoutingExcelTemplate, readRoutingFile, exporterTournees } = useRoutingExcel()

// ---- Import CSV routings ----
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const importing = ref(false)
const importSummary = ref<{ created: number; updated: number; pdvCount: number; errors: string[] } | null>(null)
// Fusion par défaut : réimporter pour corriger un mois déjà chargé ne doit
// jamais supprimer les PDV absents du fichier (demande client du 23 juillet).
const importMode = ref<'fusion' | 'remplacement'>('fusion')

const downloadingTemplate = ref(false)
async function handleDownloadTemplate() {
  downloadingTemplate.value = true
  try {
    await downloadRoutingExcelTemplate()
  } catch (err: any) {
    toast.add({ title: 'Modèle indisponible', description: messageUtilisateur(err), color: 'red' })
  } finally {
    downloadingTemplate.value = false
  }
}

function handleImportFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  importFile.value = target.files?.[0] || null
  importSummary.value = null
}

function closeImportModal() {
  showImportModal.value = false
  importFile.value = null
  importSummary.value = null
  importMode.value = 'fusion'
}

// ---- Export des tournées affichées (format du modèle, réimportable) ----
const exportEnCours = ref(false)
async function handleExportTournees() {
  if (!routings.value.length) return
  exportEnCours.value = true
  try {
    const lot: { tournee: Routing; etapes: RoutingPDV[] }[] = []
    for (let i = 0; i < routings.value.length; i += 5) {
      const tranche = routings.value.slice(i, i + 5)
      const etapes = await Promise.all(tranche.map(r => routingStore.toutesEtapesRouting(r.id)))
      tranche.forEach((r, j) => lot.push({ tournee: r, etapes: etapes[j]! }))
    }
    lot.sort((a, b) => a.tournee.date_routing.localeCompare(b.tournee.date_routing)
      || nomPersonne(a.tournee.user).localeCompare(nomPersonne(b.tournee.user), 'fr'))
    const du = filters.dateFrom || lot[0]?.tournee.date_routing || aujourdhui
    const au = filters.dateTo || lot[lot.length - 1]?.tournee.date_routing || aujourdhui
    await exporterTournees(lot as any, `tournees-${du}-au-${au}.xlsx`)
    toast.add({
      title: 'Export terminé',
      description: routings.value.length >= 200
        ? 'Limité aux 200 tournées les plus récentes : réduisez la période ou filtrez par utilisateur pour tout exporter.'
        : `${lot.length} tournée(s), ${lot.reduce((n, t) => n + t.etapes.length, 0)} PDV.`,
      color: routings.value.length >= 200 ? 'amber' : 'green',
    })
  }
  catch (err: any) {
    toast.add({ title: 'Export impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    exportEnCours.value = false
  }
}

async function handleImportRoutings() {
  if (!importFile.value) return
  importing.value = true
  try {
    const rows = await readRoutingFile(importFile.value, parseCsv)
    if (!rows.length) throw new Error('Aucune ligne remplie dans le fichier.')
    const result = await routingStore.importRoutingsFromCSV(rows, authStore.profile!.id, importMode.value)
    importSummary.value = result
    toast.add({
      title: 'Import terminé',
      description: `${result.created} créé(s), ${result.updated} mis à jour, ${result.errors.length} erreur(s)`,
      color: result.errors.length ? 'amber' : 'green',
    })
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Import impossible', description: messageUtilisateur(err), color: 'red' })
  } finally {
    importing.value = false
  }
}

// ---- Onglets du domaine Planning (utils/adminNavigation.ts) ----
// Tournées = /admin/routing, Règles récurrentes = /admin/routing?vue=regles :
// la barre d'onglets du layout change la requête, la page reste montée
// (fenêtres et données conservées).
const route = useRoute()
const activeTab = computed(() => (route.query.vue === 'regles' ? 'templates' : 'routings'))
// Compte agence : consultation (les règles de la base limitent aussi les écritures).
const lectureSeule = computed(() => authStore.isAgence)

// ---- Shared state ----
// true d'emblée : sans ça, « Aucun routing trouvé » s'affichait le temps du
// premier chargement.
const loading = ref(true)
const creating = ref(false)
const users = ref<any[]>([])
const pdvList = ref<any[]>([])

// ---- Routing state ----
const routings = ref<Routing[]>([])
const showCreateModal = ref(false)
const showDuplicateModal = ref(false)
const duplicateDate = ref('')
const duplicateUserId = ref('')
const duplicateRoutingId = ref('')
const selectedPdvToAdd = ref('')

const filters = reactive({
  dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  dateTo: '',
  userId: '',
  status: '',
})

const editingRoutingId = ref<string | null>(null)
const newRouting = reactive({
  userId: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  status: 'pending',
  pdvItems: [] as { pdv_id: string; objectifs: RoutingObjectives }[],
})

// ---- Template state ----
const templateLoading = computed(() => routingStore.templateLoading)
const showTemplateCreateModal = ref(false)
const showGenerateModal = ref(false)
const generating = ref(false)
const generateMessage = ref('')
const templateFilterUser = ref('')
const templateAddPdvId = reactive<Record<string, string>>({})

const newTemplate = reactive({
  userId: '',
  // Multi-jours : « chaque lundi ET chaque jeudi » en une seule règle.
  daysOfWeek: [] as number[],
  label: '',
  notes: '',
  // Portés par la règle, pas par le profil : un merchandiser peut changer de
  // zone et de distributeur en cours de mois (tâche 4.4).
  territoire: '',
  distributeur: '',
  dateDebut: toIsoJour(new Date()),
  dateFin: '',
  // perimetre = tout le portefeuille chaque jour ; quota = Atom (grille Référentiels › Quotas Atom).
  mode: 'perimetre' as RoutingTemplateMode,
  // SSF (vendeur du distributeur) de la règle : sa sous-zone borne les PDV.
  ssfId: null as number | null,
})

// ---- SSF et sous-zones (règles Atom) ----
interface SousZoneSsf { ssf_id: number, nom: string, distributeur: string | null, zone: string | null, quartiers: string[], actif: boolean }
const sousZonesSsf = ref<SousZoneSsf[]>([])
const quartiersParSsf = ref(new Map<number, { cles: Set<string>, zones: Set<string> }>())
async function chargerSousZonesSsf() {
  // Base sans la migration 20261007100000 : pas de SSF, le champ est masqué.
  const [vue, lignes] = await Promise.all([
    (supabase.from('v_ssf_sous_zone' as any) as any).select('ssf_id, nom, distributeur, zone, quartiers, actif').order('nom'),
    fetchAllRows<any>((from, to) => (supabase.from('ssf_quartier' as any) as any).select('ssf_id, zone, quartier').order('id').range(from, to)).catch(() => []),
  ])
  sousZonesSsf.value = vue.error ? [] : (vue.data || [])
  const m = new Map<number, { cles: Set<string>, zones: Set<string> }>()
  for (const q of lignes as any[]) {
    if (!m.has(q.ssf_id)) m.set(q.ssf_id, { cles: new Set(), zones: new Set() })
    m.get(q.ssf_id)!.cles.add(`${q.zone}|${q.quartier}`)
    m.get(q.ssf_id)!.zones.add(q.zone)
  }
  quartiersParSsf.value = m
}
const ssfParId = computed(() => new Map(sousZonesSsf.value.map(s => [s.ssf_id, s])))
const nomSsf = (id: number) => ssfParId.value.get(id)?.nom || `SSF ${id}`
const quartiersSsfTexte = (id: number) => {
  const s = ssfParId.value.get(id)
  return s?.quartiers?.length ? `Quartiers suivis${s.zone ? ` (${s.zone})` : ''} : ${s.quartiers.join(', ')}` : 'Quartiers non renseignés (Référentiels › Quartiers des vendeurs)'
}
const ssfOptions = computed(() => [
  { value: 0, label: 'Aucun vendeur' },
  ...sousZonesSsf.value.filter(s => s.actif !== false).map(s => ({
    value: s.ssf_id,
    label: `${s.nom}${s.zone ? ` · ${s.zone}` : ''}${s.distributeur ? ` · ${s.distributeur}` : ''}`,
  })),
])
// USelectMenu ne prend pas null : « aucun SSF » = 0 dans le sélecteur.
const ssfChoisi = computed<number>({
  get: () => newTemplate.ssfId ?? 0,
  set: (v) => { newTemplate.ssfId = v || null },
})
const aideSsf = computed(() => (newTemplate.ssfId
  ? `${quartiersSsfTexte(newTemplate.ssfId)}. Seuls les points de vente de ces quartiers peuvent entrer dans la règle.`
  : 'Le vendeur avec qui le merchandiser travaille ces jours-là. Seuls les points de vente de ses quartiers pourront entrer dans la règle.'))

// ---- Modification d'une règle (même formulaire que la création) ----
const regleEditionId = ref<string | null>(null)
let remplissageRegle = false
watch(() => newTemplate.ssfId, (id) => {
  if (!id || remplissageRegle) return
  const s = ssfParId.value.get(id)
  if (!s) return
  if (s.zone) newTemplate.territoire = s.zone
  if (s.distributeur) newTemplate.distributeur = s.distributeur
  if (!newTemplate.label || newTemplate.label.startsWith('SSF — ')) newTemplate.label = `SSF — ${s.nom}`
  newTemplate.mode = 'quota'
})
async function ouvrirEditionRegle(tpl: RoutingTemplate) {
  remplissageRegle = true
  regleEditionId.value = tpl.id
  Object.assign(newTemplate, {
    userId: tpl.user_id,
    daysOfWeek: joursDeRegle(tpl),
    label: tpl.label || '',
    notes: tpl.notes || '',
    territoire: tpl.territoire || '',
    distributeur: tpl.distributeur || '',
    dateDebut: tpl.date_debut || '',
    dateFin: tpl.date_fin || '',
    mode: tpl.mode || 'perimetre',
    ssfId: tpl.ssf_id ?? null,
  })
  showTemplateCreateModal.value = true
  await nextTick()
  remplissageRegle = false
}
function reinitialiserFormulaireRegle() {
  remplissageRegle = true
  regleEditionId.value = null
  Object.assign(newTemplate, {
    userId: '', daysOfWeek: [], label: '', notes: '', territoire: '', distributeur: '',
    dateDebut: toIsoJour(new Date()), dateFin: '', mode: 'perimetre', ssfId: null,
  })
  void nextTick(() => { remplissageRegle = false })
}
watch(showTemplateCreateModal, (ouvert) => { if (!ouvert && regleEditionId.value) reinitialiserFormulaireRegle() })
const modeOptions = [
  { value: 'perimetre', label: 'Tout le portefeuille : chaque jour de la règle, il visite tous ses points de vente (FrieslandCampina).' },
  { value: 'quota', label: 'Quotas : chaque jour, un nombre fixe de points de vente par canal, chacun vu une fois par mois (agences).' },
]

// ---- Exceptions : « cette semaine, il ne visite pas ce PDV » ----
const showExceptionModal = ref(false)
const exceptionTemplate = ref<RoutingTemplate | null>(null)
const newException = reactive({
  pdvId: '',
  dateDebut: '',
  dateFin: '',
  motif: '',
})

function openExceptionModal(tpl: RoutingTemplate) {
  exceptionTemplate.value = tpl
  const lundi = debutDeSemaine(new Date())
  const dimanche = new Date(lundi)
  dimanche.setDate(lundi.getDate() + 6)
  newException.pdvId = ''
  newException.dateDebut = toIsoJour(lundi)
  newException.dateFin = toIsoJour(dimanche)
  newException.motif = ''
  showExceptionModal.value = true
}

// Raccourcis : la demande type est « cette semaine » ou « la semaine prochaine ».
function setSemaineException(decalage: number) {
  const lundi = debutDeSemaine(new Date())
  lundi.setDate(lundi.getDate() + decalage * 7)
  const dimanche = new Date(lundi)
  dimanche.setDate(lundi.getDate() + 6)
  newException.dateDebut = toIsoJour(lundi)
  newException.dateFin = toIsoJour(dimanche)
}

async function handleAddException() {
  if (!exceptionTemplate.value) return
  try {
    await routingStore.addTemplateException(
      exceptionTemplate.value.id,
      newException.dateDebut,
      newException.dateFin,
      { pdvId: newException.pdvId || undefined, motif: newException.motif, createdBy: authStore.profile!.id },
    )
    toast.add({
      title: 'Exception enregistrée',
      description: newException.pdvId ? 'Ce point de vente est retiré de la tournée sur la période.' : 'La tournée est suspendue sur la période.',
      color: 'green',
    })
    showExceptionModal.value = false
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Exception non enregistrée', description: messageUtilisateur(err), color: 'red' })
  }
}

async function handleRemoveException(exceptionId: string) {
  try {
    await routingStore.removeTemplateException(exceptionId)
    toast.add({ title: 'Exception retirée', color: 'green' })
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Exception non retirée', description: messageUtilisateur(err), color: 'red' })
  }
}

// Prochaines occurrences d'une règle sur 4 semaines, exceptions déduites.
function exceptionLabel(e: RoutingTemplateException, tpl: RoutingTemplate): string {
  const cible = e.pdv_id
    ? (tpl.routing_template_pdv?.find(p => p.pdv_id === e.pdv_id)?.pdv?.nom_pdv || 'Un point de vente')
    : 'Toute la tournée'
  return `${cible} — du ${dateFr(e.date_debut)} au ${dateFr(e.date_fin)}`
}

// Retrait d'une exception : la tournée (ou le PDV) reprend sur la période.
function retirerException(e: RoutingTemplateException, tpl: RoutingTemplate) {
  const consequence = e.pdv_id ? 'Ce point de vente sera de nouveau prévu' : 'La tournée sera de nouveau générée'
  if (!confirm(`Retirer l'exception « ${exceptionLabel(e, tpl)} » de la règle « ${titreRegle(tpl)} » ? ${consequence} sur cette période.`)) return
  void handleRemoveException(e.id)
}

// Date ISO (2026-10-06) → 06/10/2026.
function dateFr(d?: string | null) {
  if (!d) return '—'
  const [a, m, j] = d.slice(0, 10).split('-')
  return a && m && j ? `${j}/${m}/${a}` : d
}

// ---- Pré-génération de l'horizon (chemin principal de matérialisation) ----
const preGenerating = ref(false)
async function handlePreGenerer() {
  preGenerating.value = true
  try {
    const { users, tournees } = await routingStore.preGenererHorizon(7)
    toast.add({
      title: `${tournees} tournée(s) générée(s)`,
      description: `${users} personne(s) couverte(s) sur les 7 prochains jours.`,
      color: 'green',
    })
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Génération impossible', description: messageUtilisateur(err), color: 'red' })
  } finally {
    preGenerating.value = false
  }
}

const generateConfig = reactive({
  userId: '',
  dateFrom: new Date().toISOString().slice(0, 10),
  dateTo: '',
})

// ---- Constants ----
const objectifOptions = [
  { key: 'releve_stock', short: 'Stock', label: 'Relevé de stock' },
  { key: 'encaissement', short: 'Encaissement', label: 'Encaissement' },
  { key: 'photos', short: 'Photos', label: 'Photos' },
  { key: 'merchandising', short: 'Merchandising', label: 'Merchandising' },
  { key: 'prospection', short: 'Prospection', label: 'Prospection' },
]

const statusOptions = [
  { value: '', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
]

const editStatusOptions = statusOptions.filter(o => o.value)

const dayShort: Record<number, string> = {
  0: 'Dim', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam',
}

// Territoires proposés pour une règle : ceux réellement portés par des PDV actifs.
const territoireOptionsRegle = computed(() =>
  ['', ...[...new Set(pdvList.value.map(p => p.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))]
)

// Portée d'une exception : toute la tournée, ou un PDV précis de la règle.
const exceptionPdvOptions = computed(() => [
  { value: '', label: 'Toute la tournée' },
  ...(exceptionTemplate.value?.routing_template_pdv || []).map(p => ({
    value: p.pdv_id,
    label: p.pdv?.nom_pdv || 'Point de vente sans nom',
  })),
])

// ---- Computed ----
const userOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...users.value.map(u => ({ value: u.id, label: u.nom || u.email }))
])

const merchandiserOptions = computed(() =>
  users.value
    .filter(u => u.role === 'merchandiser' || u.role === 'commercial')
    .map(u => ({ value: u.id, label: `${u.nom || u.email} (${profileTerritories(u).join(', ') || 'aucun territoire'})` }))
)

// Merchandiser actuellement choisi pour la tournée en cours d'édition.
const selectedMerchandiser = computed(() => users.value.find(u => u.id === newRouting.userId) || null)

// PDV éligibles = uniquement ceux du périmètre (territoires + quartiers) du merchandiser choisi.
// Sans merchandiser choisi, aucun PDV n'est proposable : on ne connaît pas le périmètre.
const scopedPdvList = computed(() =>
  selectedMerchandiser.value
    ? pdvList.value.filter(p => pdvInScope(p, selectedMerchandiser.value))
    : []
)

// ---- Préselection PDV par colonnes (canal / région / zone / quartier) ----
const pdvFilter = reactive({ canal: '', region: '', zone: '', quartier: '' })

function filterOpts(values: (string | null | undefined)[]) {
  return [
    { value: '', label: 'Tous' },
    ...[...new Set(values.filter(Boolean) as string[])].sort().map(v => ({ value: v, label: v })),
  ]
}

const pdvFilterCanalOptions = computed(() => filterOpts(scopedPdvList.value.map(p => p.canal)))
const pdvFilterRegionOptions = computed(() =>
  filterOpts(scopedPdvList.value.filter(p => !pdvFilter.canal || p.canal === pdvFilter.canal).map(p => p.region))
)
const pdvFilterZoneOptions = computed(() =>
  filterOpts(scopedPdvList.value
    .filter(p => (!pdvFilter.canal || p.canal === pdvFilter.canal) && (!pdvFilter.region || p.region === pdvFilter.region))
    .map(p => p.zone))
)
const pdvFilterQuartierOptions = computed(() =>
  filterOpts(scopedPdvList.value
    .filter(p => (!pdvFilter.canal || p.canal === pdvFilter.canal) && (!pdvFilter.region || p.region === pdvFilter.region) && (!pdvFilter.zone || p.zone === pdvFilter.zone))
    .map(p => p.quartier))
)

const filteredAvailablePdv = computed(() => {
  const usedIds = new Set(newRouting.pdvItems.map(i => i.pdv_id))
  return scopedPdvList.value.filter(p =>
    !usedIds.has(p.pdv_id) &&
    (!pdvFilter.canal || p.canal === pdvFilter.canal) &&
    (!pdvFilter.region || p.region === pdvFilter.region) &&
    (!pdvFilter.zone || p.zone === pdvFilter.zone) &&
    (!pdvFilter.quartier || p.quartier === pdvFilter.quartier)
  )
})

const filteredAvailablePdvOptions = computed(() =>
  filteredAvailablePdv.value.map(p => ({
    value: p.pdv_id,
    label: `${p.nom_pdv} — ${[p.zone, p.quartier].filter(Boolean).join(' / ') || p.region || ''}`,
  }))
)

const hasPdvFilter = computed(() => !!(pdvFilter.canal || pdvFilter.region || pdvFilter.zone || pdvFilter.quartier))

function clearPdvFilter() {
  pdvFilter.canal = ''
  pdvFilter.region = ''
  pdvFilter.zone = ''
  pdvFilter.quartier = ''
}

// Reset filtres enfants quand un filtre parent change
watch(() => pdvFilter.canal, () => { pdvFilter.region = ''; pdvFilter.zone = ''; pdvFilter.quartier = '' })
watch(() => pdvFilter.region, () => { pdvFilter.zone = ''; pdvFilter.quartier = '' })
watch(() => pdvFilter.zone, () => { pdvFilter.quartier = '' })

// Changement de merchandiser : purge les PDV déjà sélectionnés qui sortent de son périmètre,
// et remet les filtres colonnes à zéro (leurs options dépendent du nouveau périmètre).
watch(() => newRouting.userId, () => {
  const scopedIds = new Set(scopedPdvList.value.map(p => p.pdv_id))
  newRouting.pdvItems = newRouting.pdvItems.filter(i => scopedIds.has(i.pdv_id))
  clearPdvFilter()
})

function addFilteredPDV() {
  const usedIds = new Set(newRouting.pdvItems.map(i => i.pdv_id))
  for (const p of filteredAvailablePdv.value) {
    if (!usedIds.has(p.pdv_id)) {
      newRouting.pdvItems.push({ pdv_id: p.pdv_id, objectifs: { releve_stock: true, photos: true } })
    }
  }
}

// Liste cochable des PDV correspondant aux filtres (inclut les déjà sélectionnés, affichés cochés)
const filteredPdvForSelection = computed(() =>
  scopedPdvList.value.filter(p =>
    (!pdvFilter.canal || p.canal === pdvFilter.canal) &&
    (!pdvFilter.region || p.region === pdvFilter.region) &&
    (!pdvFilter.zone || p.zone === pdvFilter.zone) &&
    (!pdvFilter.quartier || p.quartier === pdvFilter.quartier)
  )
)

const selectedPdvIds = computed(() => new Set(newRouting.pdvItems.map(i => i.pdv_id)))

function togglePdvSelection(pdvId: string) {
  const idx = newRouting.pdvItems.findIndex(i => i.pdv_id === pdvId)
  if (idx !== -1) {
    newRouting.pdvItems.splice(idx, 1)
  } else {
    newRouting.pdvItems.push({ pdv_id: pdvId, objectifs: { releve_stock: true, photos: true } })
  }
}

// ---- Drag & drop natif pour réordonner les PDV sélectionnés ----
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(idx: number) {
  dragIndex.value = idx
}

function onDragEnter(idx: number) {
  dragOverIndex.value = idx
}

function onDrop(idx: number) {
  const from = dragIndex.value
  dragIndex.value = null
  dragOverIndex.value = null
  if (from === null || from === idx) return
  const items = [...newRouting.pdvItems]
  const [moved] = items.splice(from, 1)
  items.splice(idx, 0, moved)
  newRouting.pdvItems = items
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

const canCreate = computed(() => {
  if (!newRouting.userId || !newRouting.date || newRouting.pdvItems.length === 0) return false
  // Filet UI : tous les PDV de la tournée doivent être dans le périmètre du merchandiser.
  const scopedIds = new Set(scopedPdvList.value.map(p => p.pdv_id))
  return newRouting.pdvItems.every(i => scopedIds.has(i.pdv_id))
})

// Tri par premier jour d'application (lundi → dimanche), une règle pouvant
// désormais couvrir plusieurs jours.
const groupedTemplates = computed(() => {
  const rang = (t: RoutingTemplate) => {
    const jours = joursDeRegle(t).map(j => (j === 0 ? 7 : j))
    return jours.length ? Math.min(...jours) : 99
  }
  return [...(routingStore.templates || [])].sort((a, b) => rang(a) - rang(b))
})

// ---- Regroupement par personne (cartes dépliables) ----
// Une carte par merchandiser dans chaque onglet : nom en exergue, portefeuille
// DMS (règle « Portefeuille DMS — <distributeur> » posée par
// scripts/affecter-merch-dms.mjs) et zone de saisie, sans dérouler les
// centaines de PDV de chaque règle.
const PREFIXE_REGLE_DMS = 'Portefeuille DMS'
const personnesOuvertes = ref(new Set<string>())
const personnesTourneesOuvertes = ref(new Set<string>())

function basculer(ensemble: Set<string>, id: string) {
  if (ensemble.has(id)) ensemble.delete(id)
  else ensemble.add(id)
}

function estRegleDms(t: RoutingTemplate) {
  return (t.label || '').startsWith(PREFIXE_REGLE_DMS)
}

function libelleDms(t: RoutingTemplate) {
  const suffixe = (t.label || '').slice(PREFIXE_REGLE_DMS.length).replace(/^\s*[—–-]\s*/, '').trim()
  return t.distributeur || suffixe || 'Distributeur non précisé'
}

// Titre affiché d'une règle : le libellé technique « Portefeuille DMS — X »
// (posé par les scripts d'affectation) se lit « Portefeuille du distributeur — X ».
function titreRegle(t: RoutingTemplate) {
  if (estRegleDms(t)) return `Portefeuille du distributeur — ${libelleDms(t)}`
  return t.label || libelleJours(t)
}

function nomPersonne(u?: Profile | null) {
  return u?.nom || u?.email || 'Sans utilisateur'
}

function initiales(u?: Profile | null) {
  const mots = nomPersonne(u).split(/[\s@._-]+/).filter(Boolean)
  return mots.slice(0, 2).map(m => m[0]!.toUpperCase()).join('') || '?'
}

interface PersonneRegles {
  id: string
  user: Profile | null
  regles: RoutingTemplate[]
  dms?: RoutingTemplate
  nbPdv: number
  nbSansGps: number
}

const reglesParPersonne = computed<PersonneRegles[]>(() => {
  const parId = new Map<string, PersonneRegles>()
  for (const tpl of groupedTemplates.value) {
    const id = tpl.user_id || 'sans-utilisateur'
    let p = parId.get(id)
    if (!p) {
      p = { id, user: tpl.user || users.value.find(u => u.id === id) || null, regles: [], nbPdv: 0, nbSansGps: 0 }
      parId.set(id, p)
    }
    p.regles.push(tpl)
    if (!p.dms && estRegleDms(tpl)) p.dms = tpl
    p.nbPdv += tpl.nb_pdv ?? tpl.routing_template_pdv?.length ?? 0
    p.nbSansGps += nbSansGpsRegle(tpl)
  }
  // Portefeuille DMS en tête, le reste dans l'ordre de groupedTemplates (tri stable).
  for (const p of parId.values()) p.regles.sort((a, b) => Number(estRegleDms(b)) - Number(estRegleDms(a)))
  return [...parId.values()].sort((a, b) => nomPersonne(a.user).localeCompare(nomPersonne(b.user), 'fr'))
})

interface PersonneTournees {
  id: string
  user: Profile | null
  routings: Routing[]
  dms?: RoutingTemplate
  nbPdv: number
  nbFaits: number
}

const tourneesParPersonne = computed<PersonneTournees[]>(() => {
  const parId = new Map<string, PersonneTournees>()
  for (const r of routings.value) {
    const id = r.user_id || r.user?.id || 'sans-utilisateur'
    let p = parId.get(id)
    if (!p) {
      p = {
        id,
        user: r.user || users.value.find(u => u.id === id) || null,
        routings: [],
        dms: reglesParPersonne.value.find(x => x.id === id)?.dms,
        nbPdv: 0,
        nbFaits: 0,
      }
      parId.set(id, p)
    }
    p.routings.push(r)
    p.nbPdv += r.nb_pdv ?? r.routing_pdv?.length ?? 0
    p.nbFaits += r.nb_faits ?? completedPdvCount(r)
  }
  for (const p of parId.values()) p.routings.sort((a, b) => a.date_routing.localeCompare(b.date_routing))
  return [...parId.values()].sort((a, b) => nomPersonne(a.user).localeCompare(nomPersonne(b.user), 'fr'))
})

// Une seule personne affichée (filtre utilisateur) : sa carte est ouverte d'office.
function personneReglesOuverte(id: string) {
  return personnesOuvertes.value.has(id) || reglesParPersonne.value.length === 1
}
function personneTourneesOuverte(id: string) {
  return personnesTourneesOuvertes.value.has(id) || tourneesParPersonne.value.length === 1
}
watch(templateFilterUser, (id) => { if (id) personnesOuvertes.value.add(id) })
watch(() => filters.userId, (id) => { if (id) personnesTourneesOuvertes.value.add(id) })

function openCreateRoutingPour(userId: string) {
  openCreateRouting()
  newRouting.userId = userId
}

// ---- Helper functions ----
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })
}

function statusColor(s: string): any {
  const map: Record<string, string> = { pending: 'amber', in_progress: 'blue', completed: 'green', cancelled: 'gray' }
  return map[s] || 'gray'
}

function statusLabel(s: string) {
  const map: Record<string, string> = { pending: 'En attente', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' }
  return map[s] || s
}

function pdvStatusColor(s: string): any {
  const map: Record<string, string> = { pending: 'gray', in_progress: 'amber', completed: 'green', skipped: 'orange' }
  return map[s] || 'gray'
}

function pdvStatusLabel(s: string) {
  const map: Record<string, string> = { pending: 'En attente', in_progress: 'En cours', completed: 'Fait', skipped: 'Passé' }
  return map[s] || s
}

function objectifLabel(key: string) {
  const obj = objectifOptions.find(o => o.key === key)
  return obj?.short || key
}

function completedPdvCount(routing: Routing) {
  return routing.routing_pdv?.filter(rp => rp.status === 'completed').length || 0
}

function sortedTemplatePDVs(tpl: RoutingTemplate): RoutingTemplatePDV[] {
  return [...(tpl.routing_template_pdv || [])].sort((a, b) => a.position_order - b.position_order)
}

function pdvAGps(pdv: { geolocation_lat?: number | null; geolocation_lng?: number | null }) {
  return pdv.geolocation_lat != null && pdv.geolocation_lng != null
}

function nbSansGpsRegle(tpl: RoutingTemplate) {
  return tpl.nb_sans_gps ?? (tpl.routing_template_pdv || []).filter(tp => tp.pdv && !pdvAGps(tp.pdv)).length
}

// Règles « portefeuille » de plusieurs milliers de PDV : chargées par pages
// depuis la base (fetchTemplates n'en ramène que la première).
const chargementRegles = ref(new Set<string>())
async function chargerSuiteRegle(tpl: RoutingTemplate) {
  if (chargementRegles.value.has(tpl.id)) return
  chargementRegles.value.add(tpl.id)
  try {
    await routingStore.chargerPdvRegle(tpl)
  }
  catch (err: any) {
    toast.add({ title: 'Chargement impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    chargementRegles.value.delete(tpl.id)
  }
}

// ---- PDV visités par jour ----
// La liste d'un jour n'existe qu'une fois la journée générée (routings +
// routing_pdv, une tournée par merchandiser et par jour) : en mode Quotas, la
// base tire N PDV par canal au moment de la génération (cron J → J+7,
// « Pré-générer 7 jours »). Aucun aperçu calculé : sur un jour lointain, il
// serait faux tant que les jours intermédiaires ne sont pas générés.
const NB_JOURS_VUE = 28
const aujourdhui = toIsoJour(new Date())
const lundiVue = toIsoJour(debutDeSemaine(new Date()))
const finVue = (() => {
  const d = debutDeSemaine(new Date())
  d.setDate(d.getDate() + NB_JOURS_VUE - 1)
  return toIsoJour(d)
})()

// userId → (date → tournée) sur la fenêtre affichée.
const tourneesParJour = ref(new Map<string, Map<string, Routing>>())
const chargementJours = ref(new Set<string>())

async function chargerJoursPersonne(userId: string) {
  if (chargementJours.value.has(userId)) return
  chargementJours.value.add(userId)
  try {
    const liste = await routingStore.fetchRoutings({ userId, dateFrom: lundiVue, dateTo: finVue })
    tourneesParJour.value.set(userId, new Map(liste.map(r => [r.date_routing, r])))
  }
  catch (err: any) {
    toast.add({ title: 'Jours non chargés', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    chargementJours.value.delete(userId)
  }
}

// Charge les jours de chaque personne dès que sa carte est ouverte.
watchEffect(() => {
  for (const p of reglesParPersonne.value) {
    if (personneReglesOuverte(p.id) && !tourneesParJour.value.has(p.id) && !chargementJours.value.has(p.id)) {
      void chargerJoursPersonne(p.id)
    }
  }
})

function semainesDeRegle(tpl: RoutingTemplate) {
  const jours = datesDeRegle(tpl, lundiVue, finVue, tpl.routing_template_exception || [])
  const parLundi = new Map<string, string[]>()
  for (const d of jours) {
    const lundi = toIsoJour(debutDeSemaine(new Date(`${d}T00:00:00`)))
    if (!parLundi.has(lundi)) parLundi.set(lundi, [])
    parLundi.get(lundi)!.push(d)
  }
  return [...parLundi.entries()].map(([lundi, js]) => ({
    lundi,
    jours: js,
    libelle: lundi === lundiVue ? 'Cette semaine' : `Semaine du ${jourCourt(lundi).split(' ')[1]}`,
  }))
}

function jourCourt(d: string) {
  const date = new Date(`${d}T00:00:00`)
  const j = date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
  return `${j.charAt(0).toUpperCase()}${j.slice(1)} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

function jourLong(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function etatJour(userId: string, d: string) {
  const parJour = tourneesParJour.value.get(userId)
  if (!parJour) return '…'
  const r = parJour.get(d)
  if (!r) return d < aujourdhui ? 'aucune tournée' : 'à générer'
  const nb = r.nb_pdv ?? 0
  return d <= aujourdhui ? `${r.nb_faits ?? 0}/${nb} faits` : `${nb} PDV`
}

function classeJour(userId: string, d: string) {
  const r = tourneesParJour.value.get(userId)?.get(d)
  const base = d === aujourdhui ? 'ring-2 ring-fc-red/40 ' : ''
  if (!r) return `${base}border-dashed border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300`
  if (d < aujourdhui && (r.nb_faits ?? 0) < (r.nb_pdv ?? 0)) {
    return `${base}border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200`
  }
  return `${base}border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200`
}

// Popup « Tournée du jour »
const jourModal = reactive({
  ouvert: false,
  date: '',
  userId: '',
  user: null as Profile | null,
  regle: null as RoutingTemplate | null,
  routing: null as Routing | null,
  etapes: [] as RoutingPDV[],
  chargement: false,
  generation: false,
  filtre: 'tous' as 'tous' | 'afaire' | 'faits',
})

const etapesJourFiltrees = computed(() => {
  const triees = [...jourModal.etapes].sort((a, b) => a.position_order - b.position_order)
  if (jourModal.filtre === 'faits') return triees.filter(e => e.status === 'completed')
  if (jourModal.filtre === 'afaire') return triees.filter(e => e.status === 'pending' || e.status === 'in_progress')
  return triees
})
const nbFaitsJour = computed(() => jourModal.etapes.filter(e => e.status === 'completed').length)

async function chargerEtapesJour() {
  if (!jourModal.routing) { jourModal.etapes = []; return }
  jourModal.chargement = true
  try {
    jourModal.etapes = await routingStore.toutesEtapesRouting(jourModal.routing.id)
  }
  catch (err: any) {
    toast.add({ title: 'Points de vente non chargés', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    jourModal.chargement = false
  }
}

// `routing` fourni par le calendrier, qui couvre n'importe quel mois ; sinon
// lu dans la fenêtre des 4 semaines du bandeau.
function ouvrirJour(userId: string, user: Profile | null, date: string, regle: RoutingTemplate | null = null, routing?: Routing | null) {
  Object.assign(jourModal, {
    ouvert: true, date, userId, user, regle, filtre: 'tous', etapes: [],
    routing: routing !== undefined ? routing : (tourneesParJour.value.get(userId)?.get(date) || null),
  })
  void chargerEtapesJour()
}

function ouvrirTournee(routing: Routing, user: Profile | null) {
  Object.assign(jourModal, {
    ouvert: true, date: routing.date_routing, userId: routing.user_id, user: user || routing.user || null,
    regle: null, filtre: 'tous', etapes: [], routing,
  })
  void chargerEtapesJour()
}

async function genererJour() {
  jourModal.generation = true
  try {
    await routingStore.materialiserPeriode(jourModal.userId, jourModal.date, jourModal.date)
    // Lecture directe du jour : il peut être hors de la fenêtre du bandeau (calendrier).
    const [genere] = await routingStore.fetchRoutings({ userId: jourModal.userId, dateFrom: jourModal.date, dateTo: jourModal.date })
    jourModal.routing = genere || null
    if (jourModal.routing) await chargerEtapesJour()
    else toast.add({ title: 'Aucune tournée générée', description: 'Aucun point de vente à visiter ce jour : quotas du mois déjà couverts, ou exception en cours.', color: 'amber' })
    loadRoutings()
  }
  catch (err: any) {
    toast.add({ title: 'Génération impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    jourModal.generation = false
  }
}

function modifierTourneeDuJour() {
  if (!jourModal.routing) return
  const r = jourModal.routing
  jourModal.ouvert = false
  void openEditRouting(r)
}

// ---- Planning d'équipe ou cartes par personne (onglet Tournées) ----
const VUES_TOURNEES = [
  { k: 'planning', l: 'Planning d\'équipe', i: 'i-heroicons-table-cells' },
  { k: 'personnes', l: 'Liste par personne', i: 'i-heroicons-user-group' },
  { k: 'calendrier', l: 'Calendrier', i: 'i-heroicons-calendar-days' },
] as const
type VueTournees = typeof VUES_TOURNEES[number]['k']
const CLE_VUE_TOURNEES = 'admin-routing-vue'
const vueTournees = ref<VueTournees>('planning')
function choisirVueTournees(v: VueTournees) {
  vueTournees.value = v
  try { localStorage.setItem(CLE_VUE_TOURNEES, v) }
  catch { /* stockage indisponible : le choix vaut pour la session */ }
}
onMounted(() => {
  try {
    const v = localStorage.getItem(CLE_VUE_TOURNEES)
    if (v === 'planning' || v === 'personnes' || v === 'calendrier') vueTournees.value = v
  }
  catch { /* stockage indisponible */ }
})

// ---- Calendrier d'une personne ----
// « Voir son calendrier » (carte d'une personne) : la personne devient le
// filtre et l'affichage passe au calendrier, dans l'onglet Tournées.
const router = useRouter()
function voirCalendrier(userId: string) {
  filters.userId = userId
  choisirVueTournees('calendrier')
  if (activeTab.value !== 'routings') router.push({ query: { ...route.query, vue: undefined } })
}
function profilDe(userId: string) {
  return (users.value as Profile[]).find(u => u.id === userId) || null
}
// Incrémenté à chaque rechargement des tournées : les calendriers ouverts se rechargent.
const rafraichirCalendrier = ref(0)
function reglesDe(userId: string) {
  return groupedTemplates.value.filter(t => t.user_id === userId)
}
function ouvrirJourCalendrier(userId: string, user: Profile | null, j: { date: string; routing: Routing | null; regle: RoutingTemplate | null }) {
  ouvrirJour(userId, user, j.date, j.regle, j.routing)
}

// ---- Popups d'affectation des PDV d'une règle ----
// Par identifiant : loadTemplates remplace les objets règle après chaque ajout.
const regleAjoutId = ref<string | null>(null)
const regleGestionId = ref<string | null>(null)
const rechercheGestion = ref('')
const regleAjout = computed(() => groupedTemplates.value.find(t => t.id === regleAjoutId.value) || null)
const regleGestion = computed(() => groupedTemplates.value.find(t => t.id === regleGestionId.value) || null)

function ouvrirGestionPdv(tpl: RoutingTemplate) {
  rechercheGestion.value = ''
  regleGestionId.value = tpl.id
}

// Index d'origine conservé : les flèches d'ordre travaillent sur la liste complète.
const pdvGestionFiltres = computed(() => {
  const tpl = regleGestion.value
  if (!tpl) return []
  const q = rechercheGestion.value.trim().toLowerCase()
  return sortedTemplatePDVs(tpl)
    .map((tp, idx) => ({ tp, idx }))
    .filter(({ tp }) => !q || [tp.pdv?.nom_pdv, tp.pdv_id, tp.pdv?.zone, tp.pdv?.quartier]
      .some(v => String(v || '').toLowerCase().includes(q)))
})

function getPDVName(pdvId: string) {
  return pdvList.value.find(p => p.pdv_id === pdvId)?.nom_pdv
    || (pdvList.value.length ? 'Point de vente sans nom' : 'Chargement…')
}

function addPDV() {
  if (selectedPdvToAdd.value) {
    newRouting.pdvItems.push({ pdv_id: selectedPdvToAdd.value, objectifs: { releve_stock: true, photos: true } })
    selectedPdvToAdd.value = ''
  }
}

function removePDV(idx: number) { newRouting.pdvItems.splice(idx, 1) }

function movePDV(idx: number, dir: number) {
  const target = idx + dir
  if (target < 0 || target >= newRouting.pdvItems.length) return
  const items = [...newRouting.pdvItems]
  ;[items[idx], items[target]] = [items[target], items[idx]]
  newRouting.pdvItems = items
}

function toggleObjectif(idx: number, key: string) {
  const obj = newRouting.pdvItems[idx].objectifs as any
  obj[key] = !obj[key]
}

// ---- Routing actions ----
function routingActions(routing: Routing) {
  return [[
    {
      label: 'Modifier',
      icon: 'i-heroicons-pencil-square',
      click: () => openEditRouting(routing),
    },
    {
      label: 'Dupliquer',
      icon: 'i-heroicons-document-duplicate',
      click: () => {
        duplicateRoutingId.value = routing.id
        duplicateDate.value = ''
        duplicateUserId.value = ''
        showDuplicateModal.value = true
      },
    },
    {
      label: 'Supprimer',
      icon: 'i-heroicons-trash',
      click: async () => {
        const nb = routing.nb_pdv ?? routing.routing_pdv?.length ?? 0
        if (!confirm(`Supprimer la tournée de ${nomPersonne(routing.user)} du ${formatDate(routing.date_routing)} ? Ses ${nb} point(s) de vente prévu(s) disparaissent de son application ; les visites déjà faites restent enregistrées.`)) return
        try {
          await routingStore.deleteRouting(routing.id)
          toast.add({ title: 'Tournée supprimée', color: 'green' })
          loadRoutings()
        }
        catch (err: any) {
          toast.add({ title: 'Tournée non supprimée', description: messageUtilisateur(err), color: 'red' })
        }
      },
    },
  ]]
}

// ---- Template actions ----
function templateActions(tpl: RoutingTemplate) {
  return [[
    {
      label: 'Modifier',
      icon: 'i-heroicons-pencil-square',
      click: () => ouvrirEditionRegle(tpl),
    },
    {
      label: tpl.is_active ? 'Désactiver' : 'Activer',
      icon: tpl.is_active ? 'i-heroicons-pause' : 'i-heroicons-play',
      click: async () => {
        try {
          await routingStore.updateTemplate(tpl.id, { is_active: !tpl.is_active })
          toast.add({ title: `Règle ${tpl.is_active ? 'désactivée' : 'activée'}`, color: 'green' })
          loadTemplates()
        }
        catch (err: any) {
          toast.add({ title: 'Règle non modifiée', description: messageUtilisateur(err), color: 'red' })
        }
      },
    },
    {
      label: 'Supprimer',
      icon: 'i-heroicons-trash',
      click: async () => {
        const nom = tpl.label ? `« ${titreRegle(tpl)} » (${libelleJours(tpl)})` : `du ${libelleJours(tpl)}`
        if (!confirm(`Supprimer la règle ${nom} de ${nomPersonne(tpl.user)} et ses ${tpl.nb_pdv ?? tpl.routing_template_pdv?.length ?? 0} point(s) de vente ? Plus aucune tournée ne sera générée par cette règle ; les tournées déjà générées restent.`)) return
        try {
          await routingStore.deleteTemplate(tpl.id)
          toast.add({ title: 'Règle supprimée', color: 'green' })
          loadTemplates()
        }
        catch (err: any) {
          toast.add({ title: 'Règle non supprimée', description: messageUtilisateur(err), color: 'red' })
        }
      },
    },
  ]]
}

function templatePDVObjectifActions(tpl: RoutingTemplate, tp: RoutingTemplatePDV) {
  return [objectifOptions.map(obj => ({
    label: obj.label,
    icon: (tp.objectifs as Record<string, boolean>)?.[obj.key] ? 'i-heroicons-check-circle-solid' : 'i-heroicons-circle-stack',
    click: async () => {
      const updated = { ...tp.objectifs } as any
      updated[obj.key] = !updated[obj.key]
      try {
        await routingStore.updateTemplatePDVObjectifs(tp.id, updated)
        tp.objectifs = updated
        toast.add({ title: 'Objectif mis à jour', color: 'green' })
      }
      catch (err: any) {
        toast.add({ title: 'Objectif non modifié', description: messageUtilisateur(err), color: 'red' })
      }
    },
  }))]
}

// Le PDV reste choisi dans une liste fermée, jamais saisi en texte libre.
// Si la règle porte un territoire, la liste s'y restreint : c'est le garde de
// périmètre côté règle (le store le revalide de toute façon avant insertion).
// Sans territoire sur la règle, on se limite au périmètre du merchandiser :
// la liste complète (25 000+ PDV) figerait l'écran à l'ouverture du menu.
function availableTemplatePdvOptions(tpl: RoutingTemplate) {
  const usedIds = new Set((tpl.routing_template_pdv || []).map(p => p.pdv_id))
  // Règle liée à un SSF : seuls les PDV de sa sous-zone (un PDV sans quartier
  // est proposé s'il est dans une zone de la sous-zone).
  const sousZone = tpl.ssf_id ? quartiersParSsf.value.get(tpl.ssf_id) : null
  if (sousZone?.cles.size) {
    return pdvList.value
      .filter(p => !usedIds.has(p.pdv_id))
      .filter(p => (p.quartier ? sousZone.cles.has(`${p.zone}|${p.quartier}`) : sousZone.zones.has(p.zone || '')))
      .map(p => ({ value: p.pdv_id, label: `${p.nom_pdv} (${p.zone || ''}${p.quartier ? ` › ${p.quartier}` : ''})` }))
  }
  const titulaire = tpl.territoire ? null : users.value.find(u => u.id === tpl.user_id)
  return pdvList.value
    .filter(p => !usedIds.has(p.pdv_id))
    .filter(p => tpl.territoire ? p.zone === tpl.territoire : (!titulaire || pdvInScope(p, titulaire)))
    .map(p => ({ value: p.pdv_id, label: `${p.nom_pdv} (${p.zone || ''})` }))
}

async function handleAddTemplatePDV(tpl: RoutingTemplate) {
  const pdvId = templateAddPdvId[tpl.id]
  if (!pdvId) return
  try {
    await routingStore.addTemplatePDV(tpl.id, pdvId)
    templateAddPdvId[tpl.id] = ''
    toast.add({ title: 'Point de vente ajouté à la règle', color: 'green' })
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Point de vente non ajouté', description: messageUtilisateur(err), color: 'red' })
  }
}

async function handleRemoveTemplatePDV(tpl: RoutingTemplate, tp: RoutingTemplatePDV) {
  if (!confirm(`Retirer « ${tp.pdv?.nom_pdv || 'ce point de vente'} » de la règle « ${titreRegle(tpl)} » ? Il ne sera plus prévu dans les prochaines tournées de cette règle ; les tournées déjà générées ne changent pas.`)) return
  try {
    await routingStore.removeTemplatePDV(tpl.id, tp.id)
    toast.add({ title: 'Point de vente retiré de la règle', color: 'green' })
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Point de vente non retiré', description: messageUtilisateur(err), color: 'red' })
  }
}

async function moveTemplatePDV(tpl: RoutingTemplate, idx: number, dir: number) {
  const sorted = sortedTemplatePDVs(tpl)
  const target = idx + dir
  if (target < 0 || target >= sorted.length) return
  const ids = sorted.map(p => p.id)
  ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
  try {
    await routingStore.reorderTemplatePDV(tpl.id, ids)
  }
  catch (err: any) {
    toast.add({ title: 'Ordre non enregistré', description: messageUtilisateur(err), color: 'red' })
  }
}

// ---- Load functions ----
async function loadRoutings() {
  loading.value = true
  // Les compteurs par jour des cartes Règles et les calendriers se rechargent avec les tournées.
  tourneesParJour.value = new Map()
  rafraichirCalendrier.value++
  try {
    routings.value = await routingStore.fetchRoutings({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      userId: filters.userId || undefined,
      status: filters.status || undefined,
    })
  }
  catch (err: any) {
    toast.add({ title: 'Tournées non chargées', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    loading.value = false
  }
}

// Faux tant que le premier chargement des règles n'est pas fini : l'état
// « Aucune règle récurrente » ne doit pas s'afficher avant.
const reglesChargees = ref(false)
async function loadTemplates() {
  try {
    await routingStore.fetchTemplates(templateFilterUser.value || undefined)
  }
  finally {
    reglesChargees.value = true
  }
}

// ---- Create / Edit routing ----
function resetRoutingForm() {
  newRouting.userId = ''
  newRouting.date = new Date().toISOString().slice(0, 10)
  newRouting.notes = ''
  newRouting.status = 'pending'
  newRouting.pdvItems = []
  selectedPdvToAdd.value = ''
  clearPdvFilter()
}

function openCreateRouting() {
  editingRoutingId.value = null
  resetRoutingForm()
  showCreateModal.value = true
}

async function openEditRouting(routing: Routing) {
  // Toutes les étapes, pas seulement les pages affichées : l'enregistrement
  // remplace la liste, une étape non chargée serait supprimée.
  let etapes: RoutingPDV[]
  try {
    etapes = await routingStore.toutesEtapesRouting(routing.id)
  }
  catch (err: any) {
    toast.add({ title: 'Tournée non chargée', description: messageUtilisateur(err), color: 'red' })
    return
  }
  editingRoutingId.value = routing.id
  newRouting.userId = routing.user_id || routing.user?.id || ''
  newRouting.date = routing.date_routing
  newRouting.notes = routing.notes || ''
  newRouting.status = routing.status
  newRouting.pdvItems = etapes.map(rp => ({
    pdv_id: rp.pdv_id,
    objectifs: { ...(rp.objectifs || {}) } as RoutingObjectives,
  }))
  selectedPdvToAdd.value = ''
  clearPdvFilter()
  showCreateModal.value = true
}

function closeRoutingModal() {
  showCreateModal.value = false
  editingRoutingId.value = null
  resetRoutingForm()
}

async function handleSaveRouting() {
  creating.value = true
  try {
    if (editingRoutingId.value) {
      await routingStore.updateRouting(
        editingRoutingId.value,
        {
          user_id: newRouting.userId,
          date_routing: newRouting.date,
          notes: newRouting.notes || null,
          status: newRouting.status,
        },
        newRouting.pdvItems,
      )
      toast.add({ title: 'Tournée mise à jour', description: `${newRouting.pdvItems.length} point(s) de vente`, color: 'green' })
    } else {
      await routingStore.createRouting(newRouting.userId, newRouting.date, newRouting.pdvItems, authStore.profile!.id, newRouting.notes)
      toast.add({ title: 'Tournée créée', description: `${newRouting.pdvItems.length} point(s) de vente`, color: 'green' })
    }
    closeRoutingModal()
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Tournée non enregistrée', description: messageUtilisateur(err), color: 'red' })
  } finally {
    creating.value = false
  }
}

async function handleDuplicate() {
  try {
    await routingStore.duplicateRouting(duplicateRoutingId.value, duplicateDate.value, duplicateUserId.value || undefined)
    toast.add({ title: 'Tournée dupliquée', color: 'green' })
    showDuplicateModal.value = false
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Duplication impossible', description: messageUtilisateur(err), color: 'red' })
  }
}

// ---- Create template (règle récurrente) ----
async function handleCreateTemplate() {
  if (!newTemplate.userId || !newTemplate.daysOfWeek.length) return
  creating.value = true
  try {
    if (regleEditionId.value) {
      await routingStore.updateTemplate(regleEditionId.value, {
        label: newTemplate.label,
        notes: newTemplate.notes,
        days_of_week: [...newTemplate.daysOfWeek] as any,
        territoire: newTemplate.territoire || null,
        distributeur: newTemplate.distributeur || null,
        date_debut: newTemplate.dateDebut || null,
        date_fin: newTemplate.dateFin || null,
        mode: newTemplate.mode,
        // Colonne ssf_id écrite seulement quand les SSF sont disponibles (migration appliquée).
        ...(sousZonesSsf.value.length ? { ssf_id: newTemplate.ssfId } : {}),
      })
      toast.add({ title: 'Règle modifiée', description: 'Les tournées déjà générées ne changent pas : Référentiels › Maintenance › « Recalculer les tournées à venir » les met à jour.', color: 'green' })
      showTemplateCreateModal.value = false
      reinitialiserFormulaireRegle()
      loadTemplates()
      return
    }
    await routingStore.createTemplate(
      newTemplate.userId,
      [...newTemplate.daysOfWeek],
      newTemplate.label,
      authStore.profile!.id,
      {
        notes: newTemplate.notes,
        territoire: newTemplate.territoire,
        distributeur: newTemplate.distributeur,
        dateDebut: newTemplate.dateDebut,
        dateFin: newTemplate.dateFin,
        mode: newTemplate.mode,
        ssfId: newTemplate.ssfId,
      },
    )
    toast.add({
      title: 'Règle créée',
      description: `${libelleJours({ days_of_week: newTemplate.daysOfWeek })} : ajoutez maintenant ses points de vente.`,
      color: 'green',
    })
    showTemplateCreateModal.value = false
    newTemplate.userId = ''
    newTemplate.daysOfWeek = []
    newTemplate.label = ''
    newTemplate.notes = ''
    newTemplate.territoire = ''
    newTemplate.distributeur = ''
    newTemplate.dateFin = ''
    newTemplate.mode = 'perimetre'
    newTemplate.ssfId = null
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Règle non enregistrée', description: messageUtilisateur(err), color: 'red' })
  } finally {
    creating.value = false
  }
}

function toggleJour(jour: number) {
  const idx = newTemplate.daysOfWeek.indexOf(jour)
  if (idx === -1) newTemplate.daysOfWeek.push(jour)
  else newTemplate.daysOfWeek.splice(idx, 1)
}

// ---- Generate routings from templates ----
async function handleGenerate() {
  generating.value = true
  generateMessage.value = ''
  try {
    // La RPC est idempotente : les tournées déjà créées sont laissées telles
    // quelles, avancement terrain compris. Seules les manquantes sont ajoutées.
    const { crees } = await routingStore.generateFromTemplates(
      generateConfig.userId,
      generateConfig.dateFrom,
      generateConfig.dateTo,
    )
    generateMessage.value = crees
      ? `${crees} tournée(s) créée(s). Les journées déjà planifiées n'ont pas été touchées.`
      : 'Aucune tournée à créer : soit elles existent déjà, soit aucune règle ne couvre cette période.'
    toast.add({ title: `${crees} tournée(s) générée(s)`, color: 'green' })
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Génération impossible', description: messageUtilisateur(err), color: 'red' })
  } finally {
    generating.value = false
  }
}

// ---- Init ----
onMounted(async () => {
  // Tournées et règles n'attendent pas les ~25 000 PDV : ceux-ci ne servent
  // qu'aux sélecteurs des popups.
  loadRoutings()
  loadTemplates()
  void chargerSousZonesSsf()

  const { fetchUsers: fetchCachedUsers } = useUsersCache()
  const [cachedUsers, pdvResult] = await Promise.all([
    fetchCachedUsers(),
    // Paginé : sans range(), PostgREST s'arrête à 1 000 PDV sur 25 000+, et
    // les sélecteurs de PDV n'offraient que les 1 000 premiers par nom.
    fetchAllRows<any>((from, to) => supabase.from('pdv')
      .select('pdv_id, nom_pdv, canal, region, zone, quartier, geolocation_lat, geolocation_lng')
      .eq('is_active', true)
      .order('nom_pdv').order('pdv_id')
      .range(from, to)),
  ])
  users.value = cachedUsers.filter(u => u.is_active !== false)
  pdvList.value = pdvResult
})
</script>
