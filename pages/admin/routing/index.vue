<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Routing & Planning</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Gérez les itinéraires ponctuels et les templates permanents</p>
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
        <UButton icon="i-heroicons-plus" class="bg-fc-red hover:bg-fc-red/90 ml-4" @click="showCreateModal = true">
          Nouveau routing
        </UButton>
      </div>

      <!-- Routing list -->
      <div class="space-y-4">
        <div v-if="loading" class="text-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-red mx-auto" />
        </div>

        <div v-else-if="routings.length === 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <UIcon name="i-heroicons-map" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p class="text-gray-500 dark:text-gray-400 font-medium">Aucun routing trouvé</p>
          <p class="text-gray-400 text-sm mt-1">Créez un routing ou générez depuis un template permanent</p>
        </div>

        <!-- Routing cards -->
        <div
          v-for="routing in routings"
          :key="routing.id"
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
        >
          <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-full bg-fc-red/10 flex items-center justify-center">
                <UIcon name="i-heroicons-map" class="w-5 h-5 text-fc-red" />
              </div>
              <div>
                <h3 class="font-bold text-gray-900 dark:text-gray-100">{{ routing.user?.nom || routing.user?.email }}</h3>
                <p class="text-xs text-gray-400">
                  {{ formatDate(routing.date_routing) }}
                  <span v-if="routing.creator"> — par {{ routing.creator.nom }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <UBadge :color="statusColor(routing.status)" variant="soft" size="sm">
                {{ statusLabel(routing.status) }}
              </UBadge>
              <span class="text-sm font-medium text-gray-600">
                {{ completedPdvCount(routing) }}/{{ routing.routing_pdv?.length || 0 }} PDV
              </span>
              <UDropdown :items="routingActions(routing)" :popper="{ placement: 'bottom-end' }">
                <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
              </UDropdown>
            </div>
          </div>

          <div v-if="expandedRoutings.has(routing.id)" class="px-5 py-3">
            <div class="space-y-2">
              <div
                v-for="(rp, idx) in sortedPDVs(routing)"
                :key="rp.id"
                class="flex items-center gap-3 py-2 px-3 rounded-lg"
                :class="rp.status === 'completed' ? 'bg-emerald-50' : rp.status === 'skipped' ? 'bg-gray-50 dark:bg-gray-700/50' : rp.status === 'in_progress' ? 'bg-amber-50' : 'bg-white dark:bg-gray-800'"
              >
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  :class="rp.status === 'completed' ? 'bg-emerald-500 text-white' : rp.status === 'skipped' ? 'bg-gray-400 text-white' : rp.status === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'"
                >
                  {{ idx + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ rp.pdv?.nom_pdv || rp.pdv_id }}</p>
                  <p class="text-xs text-gray-400">{{ rp.pdv?.zone || '' }} {{ rp.pdv?.secteur ? `— ${rp.pdv.secteur}` : '' }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <template v-for="(val, key) in rp.objectifs" :key="key">
                    <UBadge v-if="val" variant="soft" size="xs" color="blue">
                      {{ objectifLabel(key as string) }}
                    </UBadge>
                  </template>
                  <UIcon
                    v-if="rp.geofence_validated"
                    name="i-heroicons-map-pin-solid"
                    class="w-4 h-4 text-emerald-500"
                    title="GPS validé"
                  />
                  <UBadge :color="pdvStatusColor(rp.status)" variant="soft" size="xs">
                    {{ pdvStatusLabel(rp.status) }}
                  </UBadge>
                </div>
              </div>
            </div>
            <div v-if="routing.notes" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p class="text-xs text-gray-400">Note : {{ routing.notes }}</p>
            </div>
          </div>

          <button
            class="w-full py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="toggleExpand(routing.id)"
          >
            {{ expandedRoutings.has(routing.id) ? '▲ Masquer les détails' : '▼ Voir les PDV assignés' }}
          </button>
        </div>
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
          <UButton icon="i-heroicons-calendar-days" variant="outline" @click="showGenerateModal = true">
            Générer routings
          </UButton>
          <UButton icon="i-heroicons-plus" class="bg-fc-red hover:bg-fc-red/90" @click="showTemplateCreateModal = true">
            Nouveau template
          </UButton>
        </div>
      </div>

      <!-- Templates grid by day of week -->
      <div v-if="templateLoading" class="text-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-red mx-auto" />
      </div>

      <div v-else-if="groupedTemplates.length === 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
        <UIcon name="i-heroicons-calendar" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p class="text-gray-500 dark:text-gray-400 font-medium">Aucun template permanent</p>
        <p class="text-gray-400 text-sm mt-1">Créez un template pour définir les routings récurrents par jour de semaine</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="tpl in groupedTemplates"
          :key="tpl.id"
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
        >
          <!-- Template header -->
          <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                :class="dayColors[tpl.day_of_week]">
                {{ dayShort[tpl.day_of_week] }}
              </div>
              <div>
                <h3 class="font-bold text-gray-900 dark:text-gray-100">
                  {{ dayNames[tpl.day_of_week] }}
                  <span v-if="tpl.label" class="font-normal text-gray-500 dark:text-gray-400"> — {{ tpl.label }}</span>
                </h3>
                <p class="text-xs text-gray-400">
                  {{ tpl.user?.nom || tpl.user?.email }}
                  · {{ tpl.routing_template_pdv?.length || 0 }} PDV
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <UBadge :color="tpl.is_active ? 'green' : 'gray'" variant="soft" size="sm">
                {{ tpl.is_active ? 'Actif' : 'Inactif' }}
              </UBadge>
              <UDropdown :items="templateActions(tpl)" :popper="{ placement: 'bottom-end' }">
                <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
              </UDropdown>
            </div>
          </div>

          <!-- Template PDV list (always visible) -->
          <div class="px-5 py-3">
            <div class="space-y-2">
              <div
                v-for="(tp, idx) in sortedTemplatePDVs(tpl)"
                :key="tp.id"
                class="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 group"
              >
                <!-- Reorder arrows -->
                <div class="flex flex-col gap-0.5">
                  <button
                    class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    :disabled="idx === 0"
                    @click="moveTemplatePDV(tpl, idx, -1)"
                  >
                    <UIcon name="i-heroicons-chevron-up" class="w-3 h-3" />
                  </button>
                  <button
                    class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    :disabled="idx === (tpl.routing_template_pdv?.length || 1) - 1"
                    @click="moveTemplatePDV(tpl, idx, 1)"
                  >
                    <UIcon name="i-heroicons-chevron-down" class="w-3 h-3" />
                  </button>
                </div>

                <span class="w-6 h-6 rounded-full bg-fc-red text-white text-xs flex items-center justify-center font-bold">
                  {{ idx + 1 }}
                </span>

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ tp.pdv?.nom_pdv || tp.pdv_id }}</p>
                  <p class="text-xs text-gray-400">{{ tp.pdv?.zone || '' }} {{ tp.pdv?.secteur ? `— ${tp.pdv.secteur}` : '' }}</p>
                </div>

                <!-- Objectifs badges -->
                <div class="flex items-center gap-1">
                  <template v-for="(val, key) in tp.objectifs" :key="key">
                    <UBadge v-if="val" variant="soft" size="xs" color="blue">
                      {{ objectifLabel(key as string) }}
                    </UBadge>
                  </template>
                </div>

                <!-- Edit objectifs -->
                <UDropdown :items="templatePDVObjectifActions(tpl, tp)" :popper="{ placement: 'bottom-end' }">
                  <UButton variant="ghost" size="xs" icon="i-heroicons-cog-6-tooth" title="Modifier objectifs" />
                </UDropdown>

                <!-- Remove PDV -->
                <button
                  class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="handleRemoveTemplatePDV(tpl, tp)"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Add PDV to template -->
            <div class="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <USelectMenu
                v-model="templateAddPdvId[tpl.id]"
                :options="availableTemplatePdvOptions(tpl)"
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
                :disabled="!templateAddPdvId[tpl.id]"
                @click="handleAddTemplatePDV(tpl)"
              >
                Ajouter
              </UButton>
            </div>

            <div v-if="tpl.notes" class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <p class="text-xs text-gray-400">📝 {{ tpl.notes }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== CREATE ROUTING MODAL ==================== -->
    <UModal v-model="showCreateModal" :ui="{ width: 'max-w-3xl' }">
      <div class="p-6 space-y-5">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nouveau routing</h2>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Utilisateur *</label>
            <USelectMenu
              v-model="newRouting.userId"
              :options="merchandiserOptions"
              placeholder="Sélectionner un utilisateur"
              option-attribute="label"
              value-attribute="value"
              searchable
              searchable-placeholder="Rechercher..."
              size="lg"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
            <UInput v-model="newRouting.date" type="date" size="lg" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optionnel)</label>
          <UTextarea v-model="newRouting.notes" placeholder="Instructions pour le terrain..." :rows="2" />
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">PDV à visiter *</label>
            <span class="text-xs text-gray-400">{{ newRouting.pdvItems.length }} PDV sélectionnés</span>
          </div>

          <div class="flex gap-2 mb-3">
            <USelectMenu
              v-model="selectedPdvToAdd"
              :options="availablePdvOptions"
              placeholder="Ajouter un PDV..."
              searchable
              searchable-placeholder="Rechercher un PDV..."
              option-attribute="label"
              value-attribute="value"
              size="sm"
              class="flex-1"
            />
            <UButton size="sm" icon="i-heroicons-plus" :disabled="!selectedPdvToAdd" @click="addPDV">
              Ajouter
            </UButton>
          </div>

          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="(item, idx) in newRouting.pdvItems"
              :key="item.pdv_id"
              class="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2"
            >
              <div class="flex flex-col gap-0.5">
                <button class="text-gray-400 hover:text-gray-600 disabled:opacity-30" :disabled="idx === 0" @click="movePDV(idx, -1)">
                  <UIcon name="i-heroicons-chevron-up" class="w-3 h-3" />
                </button>
                <button class="text-gray-400 hover:text-gray-600 disabled:opacity-30" :disabled="idx === newRouting.pdvItems.length - 1" @click="movePDV(idx, 1)">
                  <UIcon name="i-heroicons-chevron-down" class="w-3 h-3" />
                </button>
              </div>
              <span class="w-6 h-6 rounded-full bg-fc-red text-white text-xs flex items-center justify-center font-bold">{{ idx + 1 }}</span>
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
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t">
          <UButton variant="ghost" @click="showCreateModal = false">Annuler</UButton>
          <UButton class="bg-fc-red hover:bg-fc-red/90" :loading="creating" :disabled="!canCreate" @click="handleCreate">
            Créer le routing
          </UButton>
        </div>
      </div>
    </UModal>

    <!-- ==================== DUPLICATE ROUTING MODAL ==================== -->
    <UModal v-model="showDuplicateModal">
      <div class="p-6 space-y-4">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Dupliquer le routing</h2>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nouvelle date *</label>
          <UInput v-model="duplicateDate" type="date" size="lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Utilisateur (optionnel)</label>
          <USelectMenu
            v-model="duplicateUserId"
            :options="merchandiserOptions"
            placeholder="Même utilisateur"
            option-attribute="label"
            value-attribute="value"
            searchable
            size="lg"
          />
        </div>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="showDuplicateModal = false">Annuler</UButton>
          <UButton class="bg-fc-red hover:bg-fc-red/90" :disabled="!duplicateDate" @click="handleDuplicate">
            Dupliquer
          </UButton>
        </div>
      </div>
    </UModal>

    <!-- ==================== CREATE TEMPLATE MODAL ==================== -->
    <UModal v-model="showTemplateCreateModal">
      <div class="p-6 space-y-4">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nouveau template permanent</h2>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Utilisateur *</label>
          <USelectMenu
            v-model="newTemplate.userId"
            :options="merchandiserOptions"
            placeholder="Sélectionner un utilisateur"
            option-attribute="label"
            value-attribute="value"
            searchable
            searchable-placeholder="Rechercher..."
            size="lg"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jour de la semaine *</label>
          <USelectMenu
            v-model="newTemplate.dayOfWeek"
            :options="dayOfWeekOptions"
            placeholder="Choisir le jour"
            option-attribute="label"
            value-attribute="value"
            size="lg"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du template</label>
          <UInput v-model="newTemplate.label" placeholder="Ex: Tournée Appolo..." size="lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optionnel)</label>
          <UTextarea v-model="newTemplate.notes" placeholder="Instructions récurrentes..." :rows="2" />
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t">
          <UButton variant="ghost" @click="showTemplateCreateModal = false">Annuler</UButton>
          <UButton
            class="bg-fc-red hover:bg-fc-red/90"
            :disabled="!newTemplate.userId || newTemplate.dayOfWeek === undefined"
            :loading="creating"
            @click="handleCreateTemplate"
          >
            Créer le template
          </UButton>
        </div>
      </div>
    </UModal>

    <!-- ==================== GENERATE ROUTINGS MODAL ==================== -->
    <UModal v-model="showGenerateModal">
      <div class="p-6 space-y-4">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Générer les routings depuis les templates</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Crée automatiquement les routings quotidiens à partir des templates permanents pour la période sélectionnée.</p>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Utilisateur *</label>
          <USelectMenu
            v-model="generateConfig.userId"
            :options="merchandiserOptions"
            placeholder="Sélectionner un utilisateur"
            option-attribute="label"
            value-attribute="value"
            searchable
            size="lg"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Du *</label>
            <UInput v-model="generateConfig.dateFrom" type="date" size="lg" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Au *</label>
            <UInput v-model="generateConfig.dateTo" type="date" size="lg" />
          </div>
        </div>

        <div v-if="generateResults.length" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
          <div v-for="r in generateResults" :key="r.date" class="flex items-center gap-2 text-sm">
            <UIcon
              :name="r.status === 'created' ? 'i-heroicons-check-circle' : r.status === 'exists' ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-minus-circle'"
              :class="r.status === 'created' ? 'text-emerald-500' : r.status === 'exists' ? 'text-amber-500' : 'text-gray-400'"
              class="w-4 h-4"
            />
            <span class="text-gray-700 dark:text-gray-300">{{ r.date }}</span>
            <span :class="r.status === 'created' ? 'text-emerald-600' : r.status === 'exists' ? 'text-amber-600' : 'text-gray-400'" class="text-xs">
              {{ r.status === 'created' ? 'Créé' : r.status === 'exists' ? 'Existe déjà' : 'Pas de template' }}
            </span>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t">
          <UButton variant="ghost" @click="showGenerateModal = false; generateResults = []">Fermer</UButton>
          <UButton
            class="bg-fc-red hover:bg-fc-red/90"
            :disabled="!generateConfig.userId || !generateConfig.dateFrom || !generateConfig.dateTo"
            :loading="generating"
            @click="handleGenerate"
          >
            Générer
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Routing, RoutingPDV, RoutingObjectives, RoutingTemplate, RoutingTemplatePDV } from '~/types'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const routingStore = useRoutingStore()
const toast = useToast()

// ---- Tabs ----
const tabs = [
  { key: 'routings', label: '📋 Routings ponctuels' },
  { key: 'templates', label: '🔁 Templates permanents' },
]
const activeTab = ref('routings')

// ---- Shared state ----
const loading = ref(false)
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
const expandedRoutings = ref(new Set<string>())
const selectedPdvToAdd = ref('')

const filters = reactive({
  dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  dateTo: '',
  userId: '',
  status: '',
})

const newRouting = reactive({
  userId: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  pdvItems: [] as { pdv_id: string; objectifs: RoutingObjectives }[],
})

// ---- Template state ----
const templateLoading = computed(() => routingStore.templateLoading)
const showTemplateCreateModal = ref(false)
const showGenerateModal = ref(false)
const generating = ref(false)
const generateResults = ref<{ date: string; status: string }[]>([])
const templateFilterUser = ref('')
const templateAddPdvId = reactive<Record<string, string>>({})

const newTemplate = reactive({
  userId: '',
  dayOfWeek: undefined as number | undefined,
  label: '',
  notes: '',
})

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

const dayNames: Record<number, string> = {
  0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi',
  4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi',
}
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

const dayOfWeekOptions = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
]

// ---- Computed ----
const userOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...users.value.map(u => ({ value: u.id, label: u.nom || u.email }))
])

const merchandiserOptions = computed(() =>
  users.value
    .filter(u => u.role === 'merchandiser' || u.role === 'commercial')
    .map(u => ({ value: u.id, label: `${u.nom || u.email} (${u.zone_assignee || 'N/A'})` }))
)

const availablePdvOptions = computed(() => {
  const usedIds = new Set(newRouting.pdvItems.map(i => i.pdv_id))
  return pdvList.value
    .filter(p => !usedIds.has(p.pdv_id))
    .map(p => ({ value: p.pdv_id, label: `${p.nom_pdv} (${p.zone || ''})` }))
})

const canCreate = computed(() =>
  newRouting.userId && newRouting.date && newRouting.pdvItems.length > 0
)

const groupedTemplates = computed(() => {
  const list = routingStore.templates || []
  return [...list].sort((a, b) => {
    // Sort Mon-Sun (1,2,3,4,5,6,0)
    const orderA = a.day_of_week === 0 ? 7 : a.day_of_week
    const orderB = b.day_of_week === 0 ? 7 : b.day_of_week
    return orderA - orderB
  })
})

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

function sortedPDVs(routing: Routing): RoutingPDV[] {
  return [...(routing.routing_pdv || [])].sort((a, b) => a.position_order - b.position_order)
}

function sortedTemplatePDVs(tpl: RoutingTemplate): RoutingTemplatePDV[] {
  return [...(tpl.routing_template_pdv || [])].sort((a, b) => a.position_order - b.position_order)
}

function toggleExpand(id: string) {
  if (expandedRoutings.value.has(id)) expandedRoutings.value.delete(id)
  else expandedRoutings.value.add(id)
}

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

function availableTemplatePdvOptions(tpl: RoutingTemplate) {
  const usedIds = new Set((tpl.routing_template_pdv || []).map(p => p.pdv_id))
  return pdvList.value
    .filter(p => !usedIds.has(p.pdv_id))
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
  routings.value = await routingStore.fetchRoutings({
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    userId: filters.userId || undefined,
    status: filters.status || undefined,
  })
  loading.value = false
}

async function loadTemplates() {
  await routingStore.fetchTemplates(templateFilterUser.value || undefined)
}

// ---- Create routing ----
async function handleCreate() {
  creating.value = true
  try {
    await routingStore.createRouting(newRouting.userId, newRouting.date, newRouting.pdvItems, authStore.profile!.id, newRouting.notes)
    toast.add({ title: 'Routing créé', description: `${newRouting.pdvItems.length} PDV assignés`, color: 'green' })
    showCreateModal.value = false
    newRouting.userId = ''
    newRouting.pdvItems = []
    newRouting.notes = ''
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

// ---- Create template ----
async function handleCreateTemplate() {
  if (!newTemplate.userId || newTemplate.dayOfWeek === undefined) return
  creating.value = true
  try {
    await routingStore.createTemplate(
      newTemplate.userId,
      newTemplate.dayOfWeek,
      newTemplate.label,
      authStore.profile!.id,
      newTemplate.notes
    )
    toast.add({ title: 'Template créé', description: `${dayNames[newTemplate.dayOfWeek]} — Ajoutez des PDV maintenant`, color: 'green' })
    showTemplateCreateModal.value = false
    newTemplate.userId = ''
    newTemplate.dayOfWeek = undefined
    newTemplate.label = ''
    newTemplate.notes = ''
    loadTemplates()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  } finally {
    creating.value = false
  }
}

// ---- Generate routings from templates ----
async function handleGenerate() {
  generating.value = true
  generateResults.value = []
  try {
    const results = await routingStore.generateFromTemplates(
      generateConfig.userId,
      generateConfig.dateFrom,
      generateConfig.dateTo,
      authStore.profile!.id
    )
    generateResults.value = results
    const created = results.filter(r => r.status === 'created').length
    toast.add({
      title: `${created} routing(s) généré(s)`,
      description: `${results.filter(r => r.status === 'exists').length} déjà existants, ${results.filter(r => r.status === 'skipped').length} jours sans template`,
      color: 'green'
    })
    loadRoutings()
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  } finally {
    generating.value = false
  }
}

// ---- Init ----
onMounted(async () => {
  const { fetchUsers: fetchCachedUsers } = useUsersCache()
  const [cachedUsers, pdvResult] = await Promise.all([
    fetchCachedUsers(),
    supabase.from('pdv').select('pdv_id, nom_pdv, zone, secteur, geolocation_lat, geolocation_lng').eq('is_active', true).order('nom_pdv'),
  ])
  users.value = cachedUsers.filter(u => u.is_active !== false)
  pdvList.value = pdvResult.data || []

  loadRoutings()
  loadTemplates()
})
</script>
