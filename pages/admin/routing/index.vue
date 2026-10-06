<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Routing & Planning</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Les règles récurrentes génèrent les tournées automatiquement, mois suivant compris.
        </p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 dark:border-gray-600">
      <nav class="flex gap-6">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.key ? 'border-fc-red text-fc-red' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- ==================== TAB 1: ROUTINGS PONCTUELS ==================== -->
    <template v-if="activeTab === 'routings'">
      <!-- Action bar -->
      <div class="flex items-center justify-between">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-4 flex-1">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date début</label>
            <UInput v-model="filters.dateFrom" type="date" size="sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date fin</label>
            <UInput v-model="filters.dateTo" type="date" size="sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Utilisateur</label>
            <USelectMenu
              v-model="filters.userId"
              :options="userOptions"
              placeholder="Tous"
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="w-48"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Statut</label>
            <USelectMenu
              v-model="filters.status"
              :options="statusOptions"
              placeholder="Tous"
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="w-36"
            />
          </div>
          <UButton variant="soft" size="sm" icon="i-heroicons-arrow-path" @click="loadRoutings">
            Actualiser
          </UButton>
        </div>
        <div class="flex gap-2 ml-4">
          <UButton v-if="authStore.isAdmin" variant="outline" icon="i-heroicons-arrow-down-tray" :loading="downloadingTemplate" @click="handleDownloadTemplate">
            Modèle Excel
          </UButton>
          <UButton v-if="authStore.isAdmin" variant="outline" icon="i-heroicons-arrow-up-tray" @click="showImportModal = true">
            Importer
          </UButton>
          <UButton variant="outline" icon="i-heroicons-document-arrow-down" :loading="exportEnCours" :disabled="!routings.length" @click="handleExportTournees">
            Exporter
          </UButton>
          <UButton icon="i-heroicons-plus" class="bg-fc-red hover:bg-fc-red/90" @click="openCreateRouting">
            Nouveau routing
          </UButton>
        </div>
      </div>

      <!-- Tournées regroupées par personne : une carte dépliable par merchandiser -->
      <div class="space-y-4">
        <ChargementContenu v-if="loading" libelle="Chargement des tournées…" />

        <div v-else-if="routings.length === 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <UIcon name="i-heroicons-map" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p class="text-gray-500 dark:text-gray-400 font-medium">Aucun routing trouvé</p>
          <p class="text-gray-400 text-sm mt-1">Créez un routing ou générez depuis un template permanent</p>
        </div>

        <template v-else>
          <p class="text-xs text-gray-400">
            {{ tourneesParPersonne.length }} personne(s) · {{ routings.length }} tournée(s). Cliquez sur une carte pour voir ses tournées.
          </p>

          <div
            v-for="p in tourneesParPersonne"
            :key="p.id"
            class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
          >
            <!-- En-tête personne -->
            <div
              class="flex flex-wrap items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-gray-50/70 dark:hover:bg-gray-700/40 transition-colors"
              role="button"
              :aria-expanded="personneTourneesOuverte(p.id)"
              @click="basculer(personnesTourneesOuvertes, p.id)"
            >
              <div class="w-11 h-11 shrink-0 rounded-full bg-fc-red/10 text-fc-red flex items-center justify-center text-sm font-bold">
                {{ initiales(p.user) }}
              </div>
              <div class="flex-1 min-w-[12rem]">
                <h3 class="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">{{ nomPersonne(p.user) }}</h3>
                <p class="text-xs text-gray-400 truncate">
                  {{ profileTerritories(p.user).join(', ') || 'Aucun territoire assigné' }}
                </p>
              </div>

              <!-- Portefeuille DMS -->
              <div v-if="p.dms" class="min-w-[14rem] rounded-lg border border-fc-red/20 bg-fc-red/5 px-3 py-2 dark:border-fc-red/30 dark:bg-fc-red/10">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-fc-red">Portefeuille DMS</p>
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ libelleDms(p.dms) }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ p.dms.nb_pdv ?? 0 }} PDV · {{ libelleJours(p.dms) }}
                  <span v-if="nbSansGpsRegle(p.dms)" class="font-semibold text-red-600 dark:text-red-400"> · {{ nbSansGpsRegle(p.dms) }} sans GPS</span>
                </p>
              </div>
              <div v-else class="min-w-[14rem] rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 dark:border-gray-600">
                <p class="text-[10px] font-semibold uppercase tracking-wide">Portefeuille DMS</p>
                <p>Aucun portefeuille DMS</p>
              </div>

              <div class="text-right text-sm">
                <p class="font-semibold text-gray-900 dark:text-gray-100">{{ p.routings.length }} tournée(s)</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ p.nbFaits }}/{{ p.nbPdv }} PDV faits</p>
              </div>

              <UButton size="xs" variant="soft" icon="i-heroicons-plus" @click.stop="openCreateRoutingPour(p.id)">
                Nouveau routing
              </UButton>
              <UIcon
                :name="personneTourneesOuverte(p.id) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-400"
              />
            </div>

            <!-- Tournées de la personne -->
            <div v-if="personneTourneesOuverte(p.id)" class="border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 px-5 py-4 space-y-3">
              <div
                v-for="routing in p.routings"
                :key="routing.id"
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                <div class="px-4 py-3 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-fc-red/10 flex items-center justify-center">
                      <UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-fc-red" />
                    </div>
                    <div>
                      <h4 class="font-semibold text-gray-900 dark:text-gray-100 capitalize">{{ formatDate(routing.date_routing) }}</h4>
                      <p v-if="routing.creator" class="text-xs text-gray-400">par {{ routing.creator.nom }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <UBadge :color="statusColor(routing.status)" variant="soft" size="sm">
                      {{ statusLabel(routing.status) }}
                    </UBadge>
                    <span class="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {{ routing.nb_faits ?? completedPdvCount(routing) }}/{{ routing.nb_pdv ?? routing.routing_pdv?.length ?? 0 }} PDV
                    </span>
                    <UDropdown :items="routingActions(routing)" :popper="{ placement: 'bottom-end' }">
                      <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
                    </UDropdown>
                  </div>
                </div>

                <p v-if="routing.notes" class="px-4 pb-2 text-xs text-gray-400">Note : {{ routing.notes }}</p>
                <button
                  class="w-full py-2 text-xs text-gray-500 hover:text-fc-red hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                  @click="ouvrirTournee(routing, p.user)"
                >
                  Voir les PDV du jour et leur statut
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- ==================== TAB 2: TEMPLATES PERMANENTS ==================== -->
    <template v-if="activeTab === 'templates'">
      <!-- Action bar -->
      <div class="flex items-center justify-between">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-end gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Utilisateur</label>
            <USelectMenu
              v-model="templateFilterUser"
              :options="userOptions"
              placeholder="Tous"
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="w-56"
            />
          </div>
          <UButton variant="soft" size="sm" icon="i-heroicons-arrow-path" @click="loadTemplates">
            Actualiser
          </UButton>
        </div>
        <div class="flex gap-2">
          <UButton icon="i-heroicons-bolt" variant="outline" :loading="preGenerating" @click="handlePreGenerer">
            Pré-générer 7 jours
          </UButton>
          <UButton icon="i-heroicons-calendar-days" variant="outline" @click="showGenerateModal = true">
            Générer sur une période
          </UButton>
          <UButton icon="i-heroicons-plus" class="bg-fc-red hover:bg-fc-red/90" @click="showTemplateCreateModal = true">
            Nouvelle règle
          </UButton>
        </div>
      </div>

      <ChargementContenu v-if="templateLoading || !reglesChargees" libelle="Chargement des règles récurrentes…" />

      <div v-else-if="groupedTemplates.length === 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
        <UIcon name="i-heroicons-calendar" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p class="text-gray-500 dark:text-gray-400 font-medium">Aucune règle récurrente</p>
        <p class="text-gray-400 text-sm mt-1">
          Créez une règle (« ce merchandiser visite ces PDV chaque lundi et jeudi ») : les tournées se génèrent ensuite toutes seules.
        </p>
      </div>

      <!-- Règles regroupées par personne : une carte dépliable par merchandiser -->
      <div v-else class="space-y-4">
        <p class="text-xs text-gray-400">
          {{ reglesParPersonne.length }} personne(s) · {{ groupedTemplates.length }} règle(s). Cliquez sur une carte pour voir et modifier ses règles.
        </p>

        <div
          v-for="p in reglesParPersonne"
          :key="p.id"
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
        >
          <!-- En-tête personne -->
          <div
            class="flex flex-wrap items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-gray-50/70 dark:hover:bg-gray-700/40 transition-colors"
            role="button"
            :aria-expanded="personneReglesOuverte(p.id)"
            @click="basculer(personnesOuvertes, p.id)"
          >
            <div class="w-11 h-11 shrink-0 rounded-full bg-fc-red/10 text-fc-red flex items-center justify-center text-sm font-bold">
              {{ initiales(p.user) }}
            </div>
            <div class="flex-1 min-w-[12rem]">
              <h3 class="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">{{ nomPersonne(p.user) }}</h3>
              <p class="text-xs text-gray-400 truncate">
                {{ profileTerritories(p.user).join(', ') || 'Aucun territoire assigné' }}
              </p>
            </div>

            <!-- Portefeuille DMS -->
            <div v-if="p.dms" class="min-w-[14rem] rounded-lg border border-fc-red/20 bg-fc-red/5 px-3 py-2 dark:border-fc-red/30 dark:bg-fc-red/10">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-fc-red">Portefeuille DMS</p>
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ libelleDms(p.dms) }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ p.dms.nb_pdv ?? 0 }} PDV · {{ libelleJours(p.dms) }}
                <span v-if="nbSansGpsRegle(p.dms)" class="font-semibold text-red-600 dark:text-red-400"> · {{ nbSansGpsRegle(p.dms) }} sans GPS</span>
              </p>
            </div>
            <div v-else class="min-w-[14rem] rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 dark:border-gray-600">
              <p class="text-[10px] font-semibold uppercase tracking-wide">Portefeuille DMS</p>
              <p>Aucun portefeuille DMS</p>
            </div>

            <div class="text-right text-sm">
              <p class="font-semibold text-gray-900 dark:text-gray-100">{{ p.regles.length }} règle(s)</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ p.nbPdv }} PDV
                <span v-if="p.nbSansGps" class="font-semibold text-red-600 dark:text-red-400">· {{ p.nbSansGps }} sans GPS</span>
              </p>
            </div>
            <UIcon
              :name="personneReglesOuverte(p.id) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              class="w-5 h-5 text-gray-400"
            />
          </div>

          <!-- Règles de la personne -->
          <div v-if="personneReglesOuverte(p.id)" class="border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 px-5 py-4 space-y-4">
            <div
              v-for="tpl in p.regles"
              :key="tpl.id"
              class="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden"
              :class="estRegleDms(tpl) ? 'border-fc-red/30' : 'border-gray-100 dark:border-gray-700'"
            >
              <!-- En-tête règle -->
              <div class="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700">
                <div class="flex items-center gap-3">
                  <div class="flex gap-1">
                    <span
                      v-for="j in joursDeRegle(tpl)"
                      :key="j"
                      class="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                      :class="dayColors[j]"
                    >
                      {{ dayShort[j] }}
                    </span>
                  </div>
                  <div>
                    <h4 class="font-semibold text-gray-900 dark:text-gray-100">
                      <span v-if="tpl.label">{{ tpl.label }}</span>
                      <span v-else>{{ libelleJours(tpl) }}</span>
                      <span v-if="tpl.label" class="font-normal text-gray-500 dark:text-gray-400"> — {{ libelleJours(tpl) }}</span>
                    </h4>
                    <p class="text-xs text-gray-400">
                      {{ tpl.nb_pdv ?? tpl.routing_template_pdv?.length ?? 0 }} PDV
                      <span v-if="nbSansGpsRegle(tpl)" class="font-semibold text-red-600 dark:text-red-400">dont {{ nbSansGpsRegle(tpl) }} sans GPS</span>
                      <template v-if="tpl.territoire"> · {{ tpl.territoire }}</template>
                      <template v-if="tpl.distributeur"> · {{ tpl.distributeur }}</template>
                      ·
                      <template v-if="tpl.date_fin">du {{ tpl.date_debut || '—' }} au {{ tpl.date_fin }}</template>
                      <template v-else>à partir du {{ tpl.date_debut || '—' }}, sans date de fin</template>
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge v-if="estRegleDms(tpl)" color="red" variant="soft" size="sm">Portefeuille DMS</UBadge>
                  <UBadge v-if="tpl.mode === 'quota'" color="violet" variant="soft" size="sm" title="N PDV par canal et par jour, chaque PDV une fois par mois (Atom)">
                    Quotas
                  </UBadge>
                  <UBadge :color="tpl.is_active ? 'green' : 'gray'" variant="soft" size="sm">
                    {{ tpl.is_active ? 'Actif' : 'Inactif' }}
                  </UBadge>
                  <UButton size="xs" variant="outline" icon="i-heroicons-no-symbol" @click="openExceptionModal(tpl)">
                    Décocher une semaine
                  </UButton>
                  <UDropdown :items="templateActions(tpl)" :popper="{ placement: 'bottom-end' }">
                    <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
                  </UDropdown>
                </div>
              </div>

              <!-- Jours couverts, semaine par semaine : un clic montre les PDV du jour -->
              <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  PDV visités par jour
                  <span class="font-normal normal-case">· cliquez sur un jour pour voir sa liste</span>
                </p>
                <div v-if="semainesDeRegle(tpl).length" class="mt-2 space-y-1.5">
                  <div v-for="sem in semainesDeRegle(tpl)" :key="sem.lundi" class="flex flex-wrap items-center gap-1.5">
                    <span class="w-20 shrink-0 text-[11px] text-gray-400">{{ sem.libelle }}</span>
                    <button
                      v-for="d in sem.jours"
                      :key="d"
                      type="button"
                      class="flex min-w-[5.5rem] flex-col items-start rounded-lg border px-2 py-1 text-left text-xs transition hover:border-fc-red"
                      :class="classeJour(p.id, d)"
                      :title="`Voir les PDV du ${jourLong(d)}`"
                      @click="ouvrirJour(p.id, p.user, d, tpl)"
                    >
                      <span class="font-semibold">{{ jourCourt(d) }}</span>
                      <span class="text-[11px]">{{ etatJour(p.id, d) }}</span>
                    </button>
                  </div>
                </div>
                <p v-else class="mt-1 text-xs text-gray-400">Aucun jour couvert sur les 4 semaines à venir.</p>
              </div>

              <div v-if="tpl.routing_template_exception?.length" class="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Exceptions</p>
                <div class="mt-1 flex flex-wrap gap-1.5">
                  <button
                    v-for="e in tpl.routing_template_exception"
                    :key="e.id"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"
                    title="Retirer cette exception"
                    @click="handleRemoveException(e.id)"
                  >
                    {{ exceptionLabel(e, tpl) }}
                    <UIcon name="i-heroicons-x-mark" class="h-3 w-3" />
                  </button>
                </div>
              </div>

              <!-- Affectation des PDV : en popups -->
              <div class="flex flex-wrap items-center gap-2 px-4 py-3">
                <UButton
                  size="sm"
                  icon="i-heroicons-plus"
                  class="bg-fc-red text-white hover:bg-fc-red/90"
                  @click="regleAjoutId = tpl.id"
                >
                  Ajouter des PDV
                </UButton>
                <UButton size="sm" variant="outline" icon="i-heroicons-list-bullet" @click="ouvrirGestionPdv(tpl)">
                  Gérer les {{ tpl.nb_pdv ?? tpl.routing_template_pdv?.length ?? 0 }} PDV du portefeuille
                </UButton>
                <p v-if="tpl.notes" class="ml-auto text-xs text-gray-400">📝 {{ tpl.notes }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== CREATE ROUTING MODAL ==================== -->
    <AdminFormModal
      v-model="showCreateModal"
      :title="editingRoutingId ? 'Modifier le routing' : 'Nouveau routing'"
      description="Planifiez la tournée, puis composez la liste ordonnée des points de vente."
      icon="i-heroicons-map"
      width="sm:max-w-4xl"
      body-class="space-y-8"
      required-note
    >
      <section aria-labelledby="routing-planning-title">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <UIcon name="i-heroicons-calendar-days" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="routing-planning-title" class="text-sm font-semibold text-slate-900 dark:text-white">
              Planification
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Affectation, date et instructions destinées au terrain.</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <UFormGroup label="Utilisateur" required size="md">
            <USelectMenu
              v-model="newRouting.userId"
              :options="merchandiserOptions"
              placeholder="Sélectionner un utilisateur"
              option-attribute="label"
              value-attribute="value"
              searchable
              searchable-placeholder="Rechercher..."
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
          <UTextarea v-model="newRouting.notes" placeholder="Instructions pour le terrain..." :rows="2" />
        </UFormGroup>
      </section>

      <section aria-labelledby="routing-pdv-title" class="border-t border-slate-200 pt-7 dark:border-slate-700">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <UIcon name="i-heroicons-building-storefront" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="routing-pdv-title" class="text-sm font-semibold text-slate-900 dark:text-white">
              Points de vente à visiter
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Filtrez, ajoutez puis réordonnez les étapes de la tournée.</p>
          </div>
        </div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Sélection des PDV <span class="text-fc-red">*</span></span>
            <span class="text-xs text-gray-400">{{ newRouting.pdvItems.length }} PDV sélectionnés</span>
          </div>

          <!-- Périmètre : on ne peut cocher que les PDV des territoires du merchandiser choisi. -->
          <div
            v-if="!newRouting.userId"
            class="mb-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
          >
            Sélectionnez d’abord un merchandiser pour voir les PDV de ses territoires.
          </div>
          <div
            v-else-if="!scopedPdvList.length"
            class="mb-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800"
          >
            Aucun PDV dans le périmètre de ce merchandiser
            ({{ profileTerritories(selectedMerchandiser).join(', ') || 'aucun territoire assigné' }}).
          </div>

          <!-- Préselection par colonnes PDV -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <USelectMenu v-model="pdvFilter.canal" :options="pdvFilterCanalOptions" option-attribute="label" value-attribute="value" placeholder="Canal" size="sm" />
            <USelectMenu v-model="pdvFilter.region" :options="pdvFilterRegionOptions" option-attribute="label" value-attribute="value" placeholder="Région" size="sm" />
            <USelectMenu v-model="pdvFilter.zone" :options="pdvFilterZoneOptions" option-attribute="label" value-attribute="value" placeholder="Zone" size="sm" />
            <USelectMenu v-model="pdvFilter.quartier" :options="pdvFilterQuartierOptions" option-attribute="label" value-attribute="value" placeholder="Quartier" size="sm" />
          </div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-gray-400">{{ filteredAvailablePdv.length }} PDV disponibles</span>
            <div class="flex gap-2">
              <UButton v-if="hasPdvFilter" size="xs" variant="ghost" icon="i-heroicons-x-mark" @click="clearPdvFilter">
                Réinitialiser
              </UButton>
              <UButton
                size="xs"
                color="red"
                variant="soft"
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
            class="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto mb-3 divide-y divide-gray-100 dark:divide-gray-700"
          >
            <label
              v-for="p in filteredPdvForSelection"
              :key="p.pdv_id"
              class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <input
                type="checkbox"
                :checked="selectedPdvIds.has(p.pdv_id)"
                class="rounded border-gray-300 text-fc-red focus:ring-fc-red"
                @change="togglePdvSelection(p.pdv_id)"
              />
              <span class="text-sm text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">{{ p.nom_pdv }}</span>
              <span class="text-xs text-gray-400 shrink-0">{{ [p.zone, p.quartier].filter(Boolean).join(' / ') }}</span>
            </label>
            <p v-if="!filteredPdvForSelection.length" class="px-3 py-4 text-center text-xs text-gray-400">
              Aucun PDV pour ces filtres
            </p>
          </div>

          <div class="flex gap-2 mb-3">
            <USelectMenu
              v-model="selectedPdvToAdd"
              :options="filteredAvailablePdvOptions"
              placeholder="Ajouter un PDV..."
              searchable
              searchable-placeholder="Rechercher un PDV..."
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="flex-1"
            />
            <UButton
              size="sm"
              icon="i-heroicons-plus"
              class="bg-fc-red text-white hover:bg-fc-red-600 disabled:bg-fc-red-300 aria-disabled:bg-fc-red-300 dark:bg-fc-red dark:text-white dark:hover:bg-fc-red-600 dark:disabled:bg-fc-red-700 dark:aria-disabled:bg-fc-red-700"
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
              class="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 transition-all"
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
              <UIcon name="i-heroicons-bars-3" class="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing shrink-0" title="Glisser pour réordonner" />
              <div class="flex flex-col gap-0.5">
                <button class="text-gray-400 hover:text-gray-600 disabled:opacity-30" :disabled="idx === 0" @click="movePDV(idx, -1)">
                  <UIcon name="i-heroicons-chevron-up" class="w-3 h-3" />
                </button>
                <button class="text-gray-400 hover:text-gray-600 disabled:opacity-30" :disabled="idx === newRouting.pdvItems.length - 1" @click="movePDV(idx, 1)">
                  <UIcon name="i-heroicons-chevron-down" class="w-3 h-3" />
                </button>
              </div>
              <span class="w-6 h-6 rounded-full bg-fc-red text-white text-xs flex items-center justify-center font-bold shrink-0">{{ idx + 1 }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ getPDVName(item.pdv_id) }}</p>
              </div>
              <div class="flex items-center gap-2">
                <label v-for="obj in objectifOptions" :key="obj.key" class="flex items-center gap-1">
                  <input
                    type="checkbox"
                    :checked="!!(item.objectifs as Record<string, boolean>)[obj.key]"
                    class="rounded border-gray-300 text-fc-red focus:ring-fc-red"
                    @change="toggleObjectif(idx, obj.key)"
                  />
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ obj.short }}</span>
                </label>
              </div>
              <button class="text-red-400 hover:text-red-600" @click="removePDV(idx)">
                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
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
          class="bg-fc-red text-white hover:bg-fc-red-600 disabled:bg-fc-red-300 aria-disabled:bg-fc-red-300 focus-visible:outline-fc-red-500 dark:bg-fc-red dark:text-white dark:hover:bg-fc-red-600 dark:disabled:bg-fc-red-700 dark:aria-disabled:bg-fc-red-700 dark:focus-visible:outline-fc-red-400"
          :loading="creating"
          :disabled="!canCreate"
          @click="handleSaveRouting"
        >
          {{ editingRoutingId ? 'Mettre à jour' : 'Créer le routing' }}
        </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== DUPLICATE ROUTING MODAL ==================== -->
    <AdminFormModal
      v-model="showDuplicateModal"
      title="Dupliquer le routing"
      description="Créez une nouvelle tournée à partir de la sélection actuelle."
      icon="i-heroicons-document-duplicate"
      width="sm:max-w-xl"
      body-class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2"
      required-note
    >
        <UFormGroup label="Nouvelle date" required size="md">
          <UInput v-model="duplicateDate" type="date" size="md" class="w-full" />
        </UFormGroup>
        <UFormGroup label="Utilisateur" help="Laissez vide pour conserver l’utilisateur actuel." size="md">
          <USelectMenu
            v-model="duplicateUserId"
            :options="merchandiserOptions"
            placeholder="Même utilisateur"
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
            class="bg-fc-red text-white hover:bg-fc-red-600 disabled:bg-fc-red-300 aria-disabled:bg-fc-red-300 focus-visible:outline-fc-red-500 dark:bg-fc-red dark:text-white dark:hover:bg-fc-red-600 dark:disabled:bg-fc-red-700 dark:aria-disabled:bg-fc-red-700 dark:focus-visible:outline-fc-red-400"
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
      title="Nouvelle règle récurrente"
      description="« Ce merchandiser visite ces PDV chaque lundi et chaque jeudi. » La règle se répète d'elle-même, mois suivant compris."
      icon="i-heroicons-arrow-path-rounded-square"
      width="sm:max-w-2xl"
      body-class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2"
      required-note
    >
        <UFormGroup label="Merchandiser" required size="md">
          <USelectMenu
            v-model="newTemplate.userId"
            :options="merchandiserOptions"
            placeholder="Sélectionner un utilisateur"
            option-attribute="label"
            value-attribute="value"
            searchable
            searchable-placeholder="Rechercher..."
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
              class="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
              :class="newTemplate.daysOfWeek.includes(j.value)
                ? 'border-fc-red bg-fc-red text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'"
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
        <UFormGroup label="Territoire" help="Restreint les PDV que cette règle peut contenir." size="md">
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

        <UFormGroup
          label="Logique de tournée"
          help="Quotas : la tournée du jour pioche dans le portefeuille selon la grille Référentiels › Quotas Atom ; un PDV déjà planifié ou visité dans le mois n'est pas repris."
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
        <UFormGroup label="Jusqu'au" help="Vide = la règle court indéfiniment." size="md">
          <UInput v-model="newTemplate.dateFin" type="date" size="md" class="w-full" />
        </UFormGroup>

        <UFormGroup label="Notes" size="md" class="sm:col-span-2">
          <UTextarea v-model="newTemplate.notes" placeholder="Instructions récurrentes..." :rows="2" />
        </UFormGroup>

      <template #footer>
          <UButton type="button" color="gray" variant="ghost" @click="showTemplateCreateModal = false">Annuler</UButton>
          <UButton
            icon="i-heroicons-check"
            class="bg-fc-red text-white hover:bg-fc-red-600 disabled:bg-fc-red-300 aria-disabled:bg-fc-red-300 focus-visible:outline-fc-red-500 dark:bg-fc-red dark:text-white dark:hover:bg-fc-red-600 dark:disabled:bg-fc-red-700 dark:aria-disabled:bg-fc-red-700 dark:focus-visible:outline-fc-red-400"
            :disabled="!newTemplate.userId || !newTemplate.daysOfWeek.length"
            :loading="creating"
            @click="handleCreateTemplate"
          >
            Créer la règle
          </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== EXCEPTION (décocher une semaine) ==================== -->
    <AdminFormModal
      v-model="showExceptionModal"
      title="Décocher une période"
      description="Suspend la tournée, ou un PDV seul, sur une période donnée. La règle n'est pas supprimée : elle reprend d'elle-même après."
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

      <div class="flex gap-2">
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
          class="bg-fc-red text-white hover:bg-fc-red-600"
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
      title="Générer les routings"
      description="Créez automatiquement les tournées quotidiennes depuis les templates permanents."
      icon="i-heroicons-arrow-path-rounded-square"
      width="sm:max-w-2xl"
      body-class="space-y-5"
      required-note
    >
        <UFormGroup label="Utilisateur" required size="md">
          <USelectMenu
            v-model="generateConfig.userId"
            :options="merchandiserOptions"
            placeholder="Sélectionner un utilisateur"
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

        <p v-if="generateMessage" class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-700/50 dark:text-gray-300">
          {{ generateMessage }}
        </p>

      <template #footer>
          <UButton type="button" color="gray" variant="ghost" @click="showGenerateModal = false; generateMessage = ''">Fermer</UButton>
          <UButton
            icon="i-heroicons-sparkles"
            class="bg-fc-red text-white hover:bg-fc-red-600 disabled:bg-fc-red-300 aria-disabled:bg-fc-red-300 focus-visible:outline-fc-red-500 dark:bg-fc-red dark:text-white dark:hover:bg-fc-red-600 dark:disabled:bg-fc-red-700 dark:aria-disabled:bg-fc-red-700 dark:focus-visible:outline-fc-red-400"
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
      :model-value="!!regleAjout"
      :title="`Ajouter des PDV — ${nomPersonne(regleAjout?.user)}`"
      :description="regleAjout ? `Règle « ${regleAjout.label || libelleJours(regleAjout)} » · ${regleAjout.nb_pdv ?? 0} PDV. Seuls les PDV du périmètre sont proposés ; la popup reste ouverte pour enchaîner les ajouts.` : ''"
      icon="i-heroicons-plus"
      width="sm:max-w-xl"
      body-class="space-y-4"
      @update:model-value="(v: boolean) => { if (!v) regleAjoutId = null }"
    >
      <div v-if="regleAjout" class="flex gap-2">
        <USelectMenu
          v-model="templateAddPdvId[regleAjout.id]"
          :options="availableTemplatePdvOptions(regleAjout)"
          placeholder="Rechercher un PDV du périmètre..."
          searchable
          searchable-placeholder="Nom ou zone..."
          option-attribute="label"
          value-attribute="value"
          size="md"
          class="flex-1"
        />
        <UButton
          icon="i-heroicons-plus"
          class="bg-fc-red text-white hover:bg-fc-red/90 disabled:bg-fc-red/40"
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
      :description="regleGestion ? `Règle « ${regleGestion.label || libelleJours(regleGestion)} » · ${regleGestion.nb_pdv ?? 0} PDV${nbSansGpsRegle(regleGestion) ? `, dont ${nbSansGpsRegle(regleGestion)} sans GPS` : ''}. Ordre, objectifs et retrait de chaque PDV.` : ''"
      icon="i-heroicons-list-bullet"
      width="sm:max-w-4xl"
      body-class="space-y-4"
      @update:model-value="(v: boolean) => { if (!v) regleGestionId = null }"
    >
      <template v-if="regleGestion">
        <div class="rounded-lg bg-fc-red/5 p-3 dark:bg-fc-red/10">
          <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fc-red">Ajouter un PDV</p>
          <div class="flex gap-2">
            <USelectMenu
              v-model="templateAddPdvId[regleGestion.id]"
              :options="availableTemplatePdvOptions(regleGestion)"
              placeholder="Rechercher un PDV du périmètre..."
              searchable
              searchable-placeholder="Nom ou zone..."
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="flex-1"
            />
            <UButton
              size="sm"
              icon="i-heroicons-plus"
              class="bg-fc-red text-white hover:bg-fc-red/90 disabled:bg-fc-red/40"
              :disabled="!templateAddPdvId[regleGestion.id]"
              @click="handleAddTemplatePDV(regleGestion)"
            >
              Ajouter
            </UButton>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <UInput v-model="rechercheGestion" icon="i-heroicons-magnifying-glass" placeholder="Filtrer par nom, code, zone ou quartier" size="sm" class="flex-1 min-w-[14rem]" />
          <span class="text-xs text-gray-400">
            {{ pdvGestionFiltres.length }} affiché(s) sur {{ regleGestion.routing_template_pdv?.length || 0 }} chargé(s) / {{ regleGestion.nb_pdv ?? 0 }}
          </span>
        </div>
        <p v-if="rechercheGestion" class="text-xs text-gray-400">Le filtre porte sur les PDV chargés ; videz-le pour réordonner.</p>

        <div class="space-y-2">
          <div
            v-for="{ tp, idx } in pdvGestionFiltres"
            :key="tp.id"
            class="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"
          >
            <div class="flex flex-col gap-0.5">
              <button
                class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                :disabled="idx === 0 || !!rechercheGestion"
                title="Monter"
                @click="moveTemplatePDV(regleGestion, idx, -1)"
              >
                <UIcon name="i-heroicons-chevron-up" class="w-3 h-3" />
              </button>
              <button
                class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                :disabled="idx === (regleGestion.routing_template_pdv?.length || 1) - 1 || !!rechercheGestion"
                title="Descendre"
                @click="moveTemplatePDV(regleGestion, idx, 1)"
              >
                <UIcon name="i-heroicons-chevron-down" class="w-3 h-3" />
              </button>
            </div>
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fc-red text-xs font-bold text-white">{{ idx + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ tp.pdv?.nom_pdv || tp.pdv_id }}</p>
              <p class="text-xs text-gray-400">
                {{ tp.pdv?.zone || '' }} {{ tp.pdv?.quartier ? `— ${tp.pdv.quartier}` : '' }}
                <span v-if="tp.pdv && !pdvAGps(tp.pdv)" class="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">Sans GPS</span>
              </p>
            </div>
            <div class="hidden items-center gap-1 sm:flex">
              <template v-for="(val, key) in tp.objectifs" :key="key">
                <UBadge v-if="val" variant="soft" size="xs" color="blue">{{ objectifLabel(key as string) }}</UBadge>
              </template>
            </div>
            <UDropdown :items="templatePDVObjectifActions(regleGestion, tp)" :popper="{ placement: 'bottom-end' }">
              <UButton variant="ghost" size="xs" icon="i-heroicons-cog-6-tooth" title="Modifier les objectifs" />
            </UDropdown>
            <UButton variant="ghost" color="red" size="xs" icon="i-heroicons-x-mark" title="Retirer de la règle" @click="handleRemoveTemplatePDV(regleGestion, tp)" />
          </div>
          <p v-if="!pdvGestionFiltres.length" class="py-6 text-center text-sm text-gray-400">Aucun PDV ne correspond.</p>
        </div>

        <div v-if="(regleGestion.routing_template_pdv?.length || 0) < (regleGestion.nb_pdv ?? 0)" class="text-center">
          <UButton size="xs" variant="soft" color="gray" :loading="chargementRegles.has(regleGestion.id)" @click="chargerSuiteRegle(regleGestion)">
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
          <div class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            <strong>{{ nbFaitsJour }}</strong> / {{ jourModal.etapes.length }} PDV faits
          </div>
          <div class="ml-auto flex gap-1">
            <UButton
              v-for="f in [{ v: 'tous', l: 'Tous' }, { v: 'afaire', l: 'À faire' }, { v: 'faits', l: 'Faits' }]"
              :key="f.v"
              size="xs"
              :variant="jourModal.filtre === f.v ? 'solid' : 'ghost'"
              :color="jourModal.filtre === f.v ? 'red' : 'gray'"
              @click="jourModal.filtre = f.v as any"
            >
              {{ f.l }}
            </UButton>
          </div>
        </div>

        <div v-if="jourModal.chargement" class="py-8 text-center">
          <UIcon name="i-heroicons-arrow-path" class="mx-auto h-6 w-6 animate-spin text-fc-red" />
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="rp in etapesJourFiltrees"
            :key="rp.id"
            class="flex items-center gap-3 rounded-lg px-3 py-2"
            :class="rp.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10' : rp.status === 'skipped' ? 'bg-gray-50 dark:bg-gray-700/50' : rp.status === 'in_progress' ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-gray-50/60 dark:bg-gray-800'"
          >
            <div
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              :class="rp.status === 'completed' ? 'bg-emerald-500 text-white' : rp.status === 'skipped' ? 'bg-gray-400 text-white' : rp.status === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'"
            >
              {{ rp.position_order }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ rp.pdv?.nom_pdv || rp.pdv_id }}</p>
              <p class="text-xs text-gray-400">
                {{ rp.pdv?.zone || '' }} {{ rp.pdv?.quartier ? `— ${rp.pdv.quartier}` : '' }}
                <span v-if="rp.pdv && !pdvAGps(rp.pdv)" class="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">Sans GPS</span>
              </p>
            </div>
            <div class="flex items-center gap-1.5">
              <template v-for="(val, key) in rp.objectifs" :key="key">
                <UBadge v-if="val" variant="soft" size="xs" color="blue" class="hidden sm:inline-flex">{{ objectifLabel(key as string) }}</UBadge>
              </template>
              <UIcon v-if="rp.geofence_validated" name="i-heroicons-map-pin-solid" class="h-4 w-4 text-emerald-500" title="GPS validé" />
              <UBadge :color="pdvStatusColor(rp.status)" variant="soft" size="xs">{{ pdvStatusLabel(rp.status) }}</UBadge>
            </div>
          </div>
          <p v-if="!etapesJourFiltrees.length" class="py-6 text-center text-sm text-gray-400">Aucun PDV pour ce filtre.</p>
        </div>
        <p v-if="jourModal.routing.notes" class="text-xs text-gray-400">Note : {{ jourModal.routing.notes }}</p>
      </template>

      <div v-else class="space-y-3 text-sm text-gray-600 dark:text-gray-300">
        <p v-if="jourModal.date < aujourdhui">Aucune tournée n'a été planifiée ce jour-là.</p>
        <template v-else>
          <p v-if="jourModal.regle?.mode === 'quota'">
            Règle en mode <strong>Quotas</strong> : la liste du jour est tirée au moment de la génération, selon la grille
            Référentiels › Quotas Atom (N PDV par canal), parmi les PDV du portefeuille pas encore planifiés ni visités dans le mois.
          </p>
          <p v-else-if="jourModal.regle">
            Règle en mode <strong>Périmètre</strong> : tout le portefeuille ({{ jourModal.regle.nb_pdv ?? 0 }} PDV) sera visité ce jour-là, hors exceptions.
          </p>
          <p class="text-xs text-gray-400">
            Les tournées se génèrent automatiquement chaque nuit pour les 7 jours suivants. Vous pouvez générer celle-ci dès maintenant pour voir sa liste.
          </p>
        </template>
      </div>

      <template #footer>
        <UButton color="gray" variant="ghost" @click="jourModal.ouvert = false">Fermer</UButton>
        <UButton v-if="jourModal.routing" variant="outline" icon="i-heroicons-pencil-square" @click="modifierTourneeDuJour">
          Modifier cette tournée
        </UButton>
        <UButton
          v-else-if="jourModal.date >= aujourdhui"
          icon="i-heroicons-sparkles"
          class="bg-fc-red text-white hover:bg-fc-red/90"
          :loading="jourModal.generation"
          @click="genererJour"
        >
          Générer cette journée
        </UButton>
      </template>
    </AdminFormModal>

    <!-- ==================== IMPORT ROUTINGS MODAL ==================== -->
    <UModal v-model="showImportModal" :ui="{ width: 'max-w-xl' }">
      <div class="p-6 space-y-4">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Importer des tournées</h2>

        <ol class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li class="flex gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fc-red text-xs font-bold text-white">1</span>
            <span>
              <UButton variant="link" size="sm" class="p-0 align-baseline" :loading="downloadingTemplate" @click="handleDownloadTemplate">Téléchargez le modèle Excel</UButton>
              — il contient les merchandisers et points de vente à jour.
            </span>
          </li>
          <li class="flex gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fc-red text-xs font-bold text-white">2</span>
            <span>Remplissez l'onglet <strong>Tournées</strong> : une ligne par point de vente à visiter, en choisissant chaque valeur dans les listes. L'onglet <em>Mode d'emploi</em> détaille chaque colonne.</span>
          </li>
          <li class="flex gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fc-red text-xs font-bold text-white">3</span>
            <span>Enregistrez-le, choisissez-le ci-dessous et cliquez sur <strong>Importer</strong>. Une journée déjà planifiée est mise à jour, jamais dupliquée.</span>
          </li>
        </ol>

        <UFormGroup label="Que faire des PDV déjà présents et absents du fichier ?" size="sm">
          <div class="space-y-2">
            <label class="flex items-start gap-2 cursor-pointer">
              <input v-model="importMode" type="radio" value="fusion" class="mt-1 text-fc-red focus:ring-fc-red" />
              <span class="text-sm">
                <strong class="text-gray-900 dark:text-gray-100">Fusionner</strong>
                <span class="block text-xs text-gray-500 dark:text-gray-400">
                  Les conserver. À utiliser pour corriger un mois déjà importé sans rien perdre.
                </span>
              </span>
            </label>
            <label class="flex items-start gap-2 cursor-pointer">
              <input v-model="importMode" type="radio" value="remplacement" class="mt-1 text-fc-red focus:ring-fc-red" />
              <span class="text-sm">
                <strong class="text-gray-900 dark:text-gray-100">Remplacer</strong>
                <span class="block text-xs text-gray-500 dark:text-gray-400">
                  Les supprimer. La tournée devient exactement le contenu du fichier.
                </span>
              </span>
            </label>
          </div>
        </UFormGroup>

        <div class="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-6 text-center">
          <input ref="importFileInput" type="file" accept=".xlsx,.csv" class="hidden" @change="handleImportFileSelect" />
          <UButton variant="outline" @click="($refs.importFileInput as HTMLInputElement)?.click()">
            Choisir le fichier
          </UButton>
          <p class="text-xs text-gray-400 mt-1">Excel (.xlsx) ou ancien format CSV</p>
          <p v-if="importFile" class="text-sm text-gray-600 mt-2">{{ importFile.name }}</p>
        </div>

        <!-- Résultat import -->
        <div v-if="importSummary" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div class="flex flex-wrap gap-3 text-sm">
            <span class="text-emerald-600 font-medium">{{ importSummary.created }} créé(s)</span>
            <span class="text-blue-600 font-medium">{{ importSummary.updated }} mis à jour</span>
            <span class="text-gray-500 dark:text-gray-400">{{ importSummary.pdvCount }} point(s) de vente</span>
            <span v-if="importSummary.errors.length" class="text-red-600 font-medium">{{ importSummary.errors.length }} message(s)</span>
          </div>
          <div v-if="importSummary.errors.length" class="max-h-40 overflow-y-auto space-y-1 border-t border-gray-200 dark:border-gray-600 pt-2">
            <p v-for="(e, i) in importSummary.errors" :key="i" class="text-xs text-red-600">⚠ {{ e }}</p>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t">
          <UButton variant="ghost" @click="closeImportModal">Fermer</UButton>
          <UButton class="bg-fc-red hover:bg-fc-red/90" :disabled="!importFile" :loading="importing" @click="handleImportRoutings">
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
      if (!authStore.isSuperviseur) return navigateTo('/admin')
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
    toast.add({ title: 'Modèle indisponible', description: err.message, color: 'red' })
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
    toast.add({ title: 'Erreur d\'export', description: err.message, color: 'red' })
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
    toast.add({ title: 'Erreur d\'import', description: err.message, color: 'red' })
  } finally {
    importing.value = false
  }
}

// ---- Tabs ----
const tabs = [
  { key: 'routings', label: '📋 Tournées planifiées' },
  { key: 'templates', label: '🔁 Règles récurrentes' },
]
const activeTab = ref('routings')

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
})
const modeOptions = [
  { value: 'perimetre', label: 'Périmètre — tout le portefeuille chaque jour (Friesland)' },
  { value: 'quota', label: 'Quotas — N PDV par canal et par jour, chaque PDV une fois par mois (Atom)' },
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
      description: newException.pdvId ? 'Ce PDV est retiré sur la période.' : 'La tournée est suspendue sur la période.',
      color: 'green',
    })
    showExceptionModal.value = false
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

async function handleRemoveException(exceptionId: string) {
  try {
    await routingStore.removeTemplateException(exceptionId)
    toast.add({ title: 'Exception retirée', color: 'green' })
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

// Prochaines occurrences d'une règle sur 4 semaines, exceptions déduites.
function exceptionLabel(e: RoutingTemplateException, tpl: RoutingTemplate): string {
  const cible = e.pdv_id
    ? (tpl.routing_template_pdv?.find(p => p.pdv_id === e.pdv_id)?.pdv?.nom_pdv || e.pdv_id)
    : 'Toute la tournée'
  return `${cible} — du ${e.date_debut} au ${e.date_fin}`
}

// ---- Pré-génération de l'horizon (chemin principal de matérialisation) ----
const preGenerating = ref(false)
async function handlePreGenerer() {
  preGenerating.value = true
  try {
    const { users, tournees } = await routingStore.preGenererHorizon(7)
    toast.add({
      title: `${tournees} tournée(s) pré-générée(s)`,
      description: `${users} merchandiser(s) couverts sur les 7 prochains jours.`,
      color: 'green',
    })
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
  { key: 'encaissement', short: 'Encais.', label: 'Encaissement' },
  { key: 'photos', short: 'Photos', label: 'Photos' },
  { key: 'merchandising', short: 'Merch.', label: 'Merchandising' },
  { key: 'prospection', short: 'Prosp.', label: 'Prospection' },
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
const dayColors: Record<number, string> = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-emerald-100 text-emerald-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-purple-100 text-purple-700',
  5: 'bg-pink-100 text-pink-700',
  6: 'bg-orange-100 text-orange-700',
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
    label: p.pdv?.nom_pdv || p.pdv_id,
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
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
    libelle: lundi === lundiVue ? 'Cette semaine' : `Sem. ${jourCourt(lundi).split(' ')[1]}`,
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
  if (!r) return `${base}border-dashed border-gray-200 text-gray-400 dark:border-gray-600`
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
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    jourModal.chargement = false
  }
}

function ouvrirJour(userId: string, user: Profile | null, date: string, regle: RoutingTemplate | null = null) {
  Object.assign(jourModal, {
    ouvert: true, date, userId, user, regle, filtre: 'tous', etapes: [],
    routing: tourneesParJour.value.get(userId)?.get(date) || null,
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
    tourneesParJour.value.delete(jourModal.userId)
    await chargerJoursPersonne(jourModal.userId)
    jourModal.routing = tourneesParJour.value.get(jourModal.userId)?.get(jourModal.date) || null
    if (jourModal.routing) await chargerEtapesJour()
    else toast.add({ title: 'Aucune tournée générée', description: 'Aucun PDV à visiter ce jour : quotas déjà couverts dans le mois, ou exceptions.', color: 'amber' })
    loadRoutings()
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
  return pdvList.value.find(p => p.pdv_id === pdvId)?.nom_pdv || pdvId
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
        if (confirm('Supprimer ce routing ?')) {
          await routingStore.deleteRouting(routing.id)
          toast.add({ title: 'Routing supprimé', color: 'green' })
          loadRoutings()
        }
      },
    },
  ]]
}

// ---- Template actions ----
function templateActions(tpl: RoutingTemplate) {
  return [[
    {
      label: tpl.is_active ? 'Désactiver' : 'Activer',
      icon: tpl.is_active ? 'i-heroicons-pause' : 'i-heroicons-play',
      click: async () => {
        await routingStore.updateTemplate(tpl.id, { is_active: !tpl.is_active })
        toast.add({ title: `Template ${tpl.is_active ? 'désactivé' : 'activé'}`, color: 'green' })
        loadTemplates()
      },
    },
    {
      label: 'Supprimer',
      icon: 'i-heroicons-trash',
      click: async () => {
        if (confirm('Supprimer ce template permanent ? Les routings déjà générés ne seront pas affectés.')) {
          await routingStore.deleteTemplate(tpl.id)
          toast.add({ title: 'Template supprimé', color: 'green' })
          loadTemplates()
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
      await routingStore.updateTemplatePDVObjectifs(tp.id, updated)
      tp.objectifs = updated
      toast.add({ title: 'Objectif mis à jour', color: 'green' })
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
    toast.add({ title: 'PDV ajouté au template', color: 'green' })
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

async function handleRemoveTemplatePDV(tpl: RoutingTemplate, tp: RoutingTemplatePDV) {
  if (!confirm(`Retirer "${tp.pdv?.nom_pdv || tp.pdv_id}" du template ?`)) return
  try {
    await routingStore.removeTemplatePDV(tpl.id, tp.id)
    toast.add({ title: 'PDV retiré du template', color: 'green' })
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

async function moveTemplatePDV(tpl: RoutingTemplate, idx: number, dir: number) {
  const sorted = sortedTemplatePDVs(tpl)
  const target = idx + dir
  if (target < 0 || target >= sorted.length) return
  const ids = sorted.map(p => p.id)
  ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
  await routingStore.reorderTemplatePDV(tpl.id, ids)
}

// ---- Load functions ----
async function loadRoutings() {
  loading.value = true
  // Les compteurs par jour des cartes Règles se rechargent avec les tournées.
  tourneesParJour.value = new Map()
  try {
    routings.value = await routingStore.fetchRoutings({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      userId: filters.userId || undefined,
      status: filters.status || undefined,
    })
  }
  catch (err: any) {
    toast.add({ title: 'Erreur de chargement des tournées', description: err.message, color: 'red' })
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
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
      toast.add({ title: 'Routing mis à jour', description: `${newRouting.pdvItems.length} PDV`, color: 'green' })
    } else {
      await routingStore.createRouting(newRouting.userId, newRouting.date, newRouting.pdvItems, authStore.profile!.id, newRouting.notes)
      toast.add({ title: 'Routing créé', description: `${newRouting.pdvItems.length} PDV assignés`, color: 'green' })
    }
    closeRoutingModal()
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  } finally {
    creating.value = false
  }
}

async function handleDuplicate() {
  try {
    await routingStore.duplicateRouting(duplicateRoutingId.value, duplicateDate.value, duplicateUserId.value || undefined)
    toast.add({ title: 'Routing dupliqué', color: 'green' })
    showDuplicateModal.value = false
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

// ---- Create template (règle récurrente) ----
async function handleCreateTemplate() {
  if (!newTemplate.userId || !newTemplate.daysOfWeek.length) return
  creating.value = true
  try {
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
      },
    )
    toast.add({
      title: 'Règle créée',
      description: `${libelleJours({ days_of_week: newTemplate.daysOfWeek })} — ajoutez maintenant les PDV`,
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
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
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
