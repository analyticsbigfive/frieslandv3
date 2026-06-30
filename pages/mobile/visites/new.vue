<template>
  <div class="mobile-page">
    <FormWizard
      v-model="currentTab"
      :steps="wizardSteps"
      :saving="saving"
      submit-label="Enregistrer la visite"
      @submit="handleSave"
      @cancel="handleCancel"
      @step-change="onStepChange"
    >
      <!-- STEP: Général -->
      <template #general>
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PDV *</label>
            <USelectMenu
              v-model="form.pdv_id"
              :options="pdvOptions"
              placeholder="Sélectionner un PDV"
              searchable
              searchable-placeholder="Rechercher..."
              option-attribute="label"
              value-attribute="value"
              size="lg"
            />
            <p v-if="formError" class="mt-2 text-sm font-medium text-red-600" role="alert">
              {{ formError }}
            </p>
            <div v-if="canCreatePDV" class="mt-2 flex justify-end">
              <UButton
                size="xs"
                variant="soft"
                icon="i-heroicons-plus"
                @click="showCreatePDV = true"
              >
                PDV introuvable ? Créer un PDV
              </UButton>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
            <UInput v-model="form.date_visite" type="datetime-local" size="lg" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <UInput :model-value="userEmail" disabled size="lg" />
          </div>
        </div>
      </template>

      <!-- STEP: EVAP -->
      <template #evap>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <span class="text-lg font-bold text-fc-red">E</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">EVAP — Évaporé</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix des produits évaporés</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-1 shadow-sm">
            <div class="pb-3 mb-1 border-b border-gray-100 dark:border-gray-700">
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Prix respectés ?</label>
                <div class="w-36 shrink-0"><ToggleYesNo v-model="form.produits.evap.prix_respectes" /></div>
              </div>
            </div>
            <h4 class="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Quantités par produit</h4>
            <p class="text-xs text-gray-400 mb-2">Quantité en rayon. 0 = rupture. La présence est déduite des quantités.</p>
            <SkuQuantityInput
              v-for="prod in evapProducts"
              :key="prod.key"
              :label="prod.label"
              :seuil="getSeuil('evap', prod.key)"
              :model-value="form.produits.evap.quantites?.[prod.key]"
              @update:model-value="setQty('evap', prod.key, $event)"
            />
          </div>
        </div>
      </template>

      <!-- STEP: IMP -->
      <template #imp>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <span class="text-lg font-bold text-orange-600">I</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">IMP — Importé</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix des produits importés</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-1 shadow-sm">
            <div class="pb-3 mb-1 border-b border-gray-100 dark:border-gray-700">
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Prix respectés ?</label>
                <div class="w-36 shrink-0"><ToggleYesNo v-model="form.produits.imp.prix_respectes" /></div>
              </div>
            </div>
            <h4 class="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Quantités par produit</h4>
            <p class="text-xs text-gray-400 mb-2">Quantité en rayon. 0 = rupture. La présence est déduite des quantités.</p>
            <SkuQuantityInput
              v-for="prod in impProducts"
              :key="prod.key"
              :label="prod.label"
              :seuil="getSeuil('imp', prod.key)"
              :model-value="form.produits.imp.quantites?.[prod.key]"
              @update:model-value="setQty('imp', prod.key, $event)"
            />
          </div>
        </div>
      </template>

      <!-- STEP: SCM -->
      <template #scm>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <span class="text-lg font-bold text-emerald-600">S</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">SCM — Sweetened Condensed</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix SCM</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-1 shadow-sm">
            <div class="pb-3 mb-1 border-b border-gray-100 dark:border-gray-700">
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Prix respectés ?</label>
                <div class="w-36 shrink-0"><ToggleYesNo v-model="form.produits.scm.prix_respectes" /></div>
              </div>
            </div>
            <h4 class="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Quantités par produit</h4>
            <p class="text-xs text-gray-400 mb-2">Quantité en rayon. 0 = rupture. La présence est déduite des quantités.</p>
            <SkuQuantityInput
              v-for="prod in scmProducts"
              :key="prod.key"
              :label="prod.label"
              :seuil="getSeuil('scm', prod.key)"
              :model-value="form.produits.scm.quantites?.[prod.key]"
              @update:model-value="setQty('scm', prod.key, $event)"
            />
          </div>
        </div>
      </template>

      <!-- STEP: UHT -->
      <template #uht>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
              <span class="text-lg font-bold text-sky-600">U</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">UHT</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix UHT</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-1 shadow-sm">
            <div class="pb-3 mb-1 border-b border-gray-100 dark:border-gray-700">
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Prix respectés ?</label>
                <div class="w-36 shrink-0"><ToggleYesNo v-model="form.produits.uht.prix_respectes" /></div>
              </div>
            </div>
            <h4 class="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Quantités par produit</h4>
            <p class="text-xs text-gray-400 mb-2">Quantité en rayon. 0 = rupture. La présence est déduite des quantités.</p>
            <SkuQuantityInput
              v-for="prod in uhtProducts"
              :key="prod.key"
              :label="prod.label"
              :seuil="getSeuil('uht', prod.key)"
              :model-value="form.produits.uht.quantites?.[prod.key]"
              @update:model-value="setQty('uht', prod.key, $event)"
            />
          </div>
        </div>
      </template>

      <!-- STEP: YAOURT -->
      <template #yaourt>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
              <span class="text-lg font-bold text-pink-600">Y</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">YAOURT</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix yaourts</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-1 shadow-sm">
            <div class="pb-3 mb-1 border-b border-gray-100 dark:border-gray-700">
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Prix respectés ?</label>
                <div class="w-36 shrink-0"><ToggleYesNo v-model="form.produits.yaourt.prix_respectes" /></div>
              </div>
            </div>
            <h4 class="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Quantités par produit</h4>
            <p class="text-xs text-gray-400 mb-2">Quantité en rayon. 0 = rupture. La présence est déduite des quantités.</p>
            <SkuQuantityInput
              v-for="prod in yaourtProducts"
              :key="prod.key"
              :label="prod.label"
              :seuil="getSeuil('yaourt', prod.key)"
              :model-value="form.produits.yaourt.quantites?.[prod.key]"
              @update:model-value="setQty('yaourt', prod.key, $event)"
            />
          </div>
        </div>
      </template>

      <!-- STEP: CEREALES -->
      <template #cereales>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
              <span class="text-lg font-bold text-cyan-600">C</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">CÉRÉALES</h3>
              <p class="text-xs text-gray-400">Quantités et prix céréales</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-1 shadow-sm">
            <div class="pb-3 mb-1 border-b border-gray-100 dark:border-gray-700">
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Prix respectés ?</label>
                <div class="w-36 shrink-0"><ToggleYesNo v-model="form.produits.cereales.prix_respectes" /></div>
              </div>
            </div>
            <h4 class="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Quantités par produit</h4>
            <p class="text-xs text-gray-400 mb-2">Quantité en rayon. 0 = rupture. La présence est déduite des quantités.</p>
            <SkuQuantityInput
              v-for="prod in cerealesProducts"
              :key="prod.key"
              :label="prod.label"
              :seuil="getSeuil('cereales', prod.key)"
              :model-value="form.produits.cereales.quantites?.[prod.key]"
              @update:model-value="setQty('cereales', prod.key, $event)"
            />
          </div>
        </div>
      </template>

      <!-- STEP: Concurrence -->
      <template #concurrence>
        <div class="space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">Présence de concurrents *</h3>
            <ToggleYesNo v-model="form.concurrence.presence_concurrents" />
          </div>

          <template v-if="form.concurrence.presence_concurrents">
            <!-- Concurrent EVAP -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
              <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Concurrent EVAP présent? *</h4>
              <ToggleYesNo v-model="form.concurrence.evap.present" />
              <template v-if="form.concurrence.evap.present">
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Cowmilk présent? *</label>
                  <ToggleStatus v-model="form.concurrence.evap.cowmilk" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">NIDO 150g présent? *</label>
                  <ToggleStatus v-model="form.concurrence.evap.nido_150g" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Autre *</label>
                  <ToggleStatus v-model="form.concurrence.evap.autre" />
                </div>
                <div v-if="form.concurrence.evap.autre === 'Présent'" class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nom du concurrent EVAP *</label>
                  <UInput v-model="form.concurrence.evap.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
                </div>
              </template>
            </div>

            <!-- Concurrent IMP -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
              <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Concurrent IMP présent? *</h4>
              <ToggleYesNo v-model="form.concurrence.imp.present" />
              <template v-if="form.concurrence.imp.present">
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nido présent? *</label>
                  <ToggleStatus v-model="form.concurrence.imp.nido" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Laity présent? *</label>
                  <ToggleStatus v-model="form.concurrence.imp.laity" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Top lait présent? *</label>
                  <ToggleStatus v-model="form.concurrence.imp.top_lait" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Autre *</label>
                  <ToggleStatus v-model="form.concurrence.imp.autre" />
                </div>
                <div v-if="form.concurrence.imp.autre === 'Présent'" class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nom du concurrent IMP *</label>
                  <UInput v-model="form.concurrence.imp.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
                </div>
              </template>
            </div>

            <!-- Concurrent SCM -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
              <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Concurrent SCM présent? *</h4>
              <ToggleYesNo v-model="form.concurrence.scm.present" />
              <template v-if="form.concurrence.scm.present">
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Top Saho présent? *</label>
                  <ToggleStatus v-model="form.concurrence.scm.top_saho" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Autre *</label>
                  <ToggleStatus v-model="form.concurrence.scm.autre" />
                </div>
                <div v-if="form.concurrence.scm.autre === 'Présent'" class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nom du concurrent SCM *</label>
                  <UInput v-model="form.concurrence.scm.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
                </div>
              </template>
            </div>

            <!-- Concurrent UHT -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
              <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Concurrent UHT présent? *</h4>
              <ToggleYesNo v-model="form.concurrence.uht.present" />
              <template v-if="form.concurrence.uht.present">
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Candia présent? *</label>
                  <ToggleStatus v-model="form.concurrence.uht.candia" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Autre *</label>
                  <ToggleStatus v-model="form.concurrence.uht.autre" />
                </div>
                <div v-if="form.concurrence.uht.autre === 'Présent'" class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nom du concurrent UHT *</label>
                  <UInput v-model="form.concurrence.uht.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>

      <!-- STEP: Visibilité -->
      <template #visibilite>
        <div class="space-y-4">
          <div v-if="visibilitySegment" class="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-white/60">Standard applicable</p>
            <div class="mt-1 flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-bold">{{ visibilitySegmentLabel }}</h3>
                <p class="mt-1 text-xs text-white/70">Relevez chaque élément observé. Les éléments optionnels sont suivis mais ne bloquent pas le KPI.</p>
              </div>
              <UIcon name="i-heroicons-eye" class="h-8 w-8 shrink-0 text-white/50" />
            </div>
          </div>

          <template v-if="visibilitySegment">
            <div
              v-for="section in visibilitySections"
              :key="section.key"
              class="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800"
            >
              <div class="mb-4 flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-fc-red dark:bg-red-950/30">
                  <UIcon :name="section.icon" class="h-5 w-5" />
                </div>
                <div>
                  <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">{{ section.label }}</h3>
                  <p class="text-xs text-gray-400">{{ section.items.length }} élément(s) à contrôler</p>
                </div>
              </div>

              <div class="divide-y divide-gray-100 dark:divide-gray-700">
                <div
                  v-for="item in section.items"
                  :key="`${item.segment}-${item.code}`"
                  class="flex min-h-14 items-center justify-between gap-3 py-3"
                >
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ item.nom }}</p>
                    <p v-if="item.optionnel" class="mt-0.5 text-xs text-amber-600">Optionnel — suivi uniquement</p>
                  </div>
                  <ToggleYesNo v-model="form.visibilite.standards[item.code]" />
                </div>
              </div>
            </div>

            <div class="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">Promotion en cours</h3>
                  <p class="mt-1 text-xs text-gray-400">Activez uniquement si ce PDV bénéficie d’une promotion aujourd’hui.</p>
                </div>
                <ToggleYesNo v-model="form.visibilite.promotion_applicable" />
              </div>

              <div v-if="form.visibilite.promotion_applicable" class="mt-4 divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
                <div
                  v-for="item in promotionElements"
                  :key="`${item.segment}-${item.code}`"
                  class="flex min-h-14 items-center justify-between gap-3 py-3"
                >
                  <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ item.nom }}</p>
                  <ToggleYesNo v-model="form.visibilite.standards[item.code]" />
                </div>
              </div>
            </div>
          </template>

          <div v-else class="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">Aucun standard paramétré pour ce type de PDV</p>
            <p class="mt-1 text-xs text-amber-700 dark:text-amber-300">La visite sera enregistrée, mais aucun niveau Perfect Store ne sera attribué.</p>
          </div>

          <div class="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Visibilité concurrence</h3>
            <div class="space-y-1">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Présence de visibilité *</label>
              <ToggleYesNo v-model="form.visibilite.concurrence.presence_visibilite" />
            </div>

            <template v-if="form.visibilite.concurrence.presence_visibilite">
              <div v-for="item in visibConcurrenceItems" :key="item.key" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">{{ item.label }} *</label>
                <ToggleYesNo v-model="form.visibilite.concurrence[item.key]" />
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- STEP: Actions -->
      <template #actions>
        <div class="space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-4 shadow-sm">
            <div v-for="action in actionItems" :key="action.key" class="space-y-2">
              <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ action.label }} *</h3>
              <ToggleYesNo v-model="form.actions[action.key]" />
            </div>
          </div>
        </div>
      </template>

      <!-- STEP: Photos -->
      <template #photos>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <UIcon name="i-heroicons-camera" class="w-5 h-5 text-fc-red" />
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">Photos du PDV</h3>
              <p class="text-xs text-gray-400">Prenez des photos du rayon et de la visibilité</p>
            </div>
          </div>

          <!-- Camera capture -->
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-4">
            <button
              type="button"
              class="flex min-h-[150px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-8 transition-colors hover:border-fc-red hover:bg-red-50 active:bg-red-100 dark:border-gray-600 dark:hover:bg-red-950/20"
              aria-label="Prendre une photo ou importer depuis la galerie"
              @click="triggerCamera"
            >
              <UIcon name="i-heroicons-camera" class="w-10 h-10 text-gray-400 mb-2" />
              <span class="text-sm font-medium text-gray-600">Prendre une photo</span>
              <span class="text-xs text-gray-400 mt-1">ou importer depuis la galerie</span>
            </button>
            <input
              ref="cameraInput"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              class="hidden"
              @change="onPhotosSelected"
            />

            <!-- Thumbnails -->
            <div v-if="form.images.length > 0" class="grid grid-cols-3 gap-2">
              <div
                v-for="(img, idx) in photoThumbnails"
                :key="idx"
                class="relative group"
              >
                <img
                  :src="img"
                  :alt="`Photo ${idx + 1} du point de vente`"
                  class="h-24 w-full rounded-lg border border-gray-200 object-cover dark:border-gray-600"
                />
                <button
                  type="button"
                  class="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition-colors hover:bg-red-700"
                  :aria-label="`Retirer la photo ${idx + 1}`"
                  @click="removePhoto(idx)"
                >
                  <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
                </button>
              </div>
            </div>

            <p class="text-xs text-gray-400 text-center">
              {{ form.images.length }} photo{{ form.images.length !== 1 ? 's' : '' }} ajoutée{{ form.images.length !== 1 ? 's' : '' }}
            </p>
          </div>
        </div>
      </template>
    </FormWizard>

    <!-- Save Overlay -->
    <SaveOverlay
      :visible="showSaveOverlay"
      :status="saveStatus"
      :progress="saveProgress"
      saving-title="Enregistrement de la visite"
      saving-message="Synchronisation des données..."
      success-title="Visite enregistrée"
      success-message="Les données ont été sauvegardées avec succès."
      @update:visible="showSaveOverlay = $event"
      @closed="onSaveComplete"
      @retry="handleSave"
    />

    <!-- Modals -->
    <PDVQuickCreateModal
      v-model="showCreatePDV"
      @created="handlePDVCreated"
    />

    <UModal v-model="showGeofenceAlert">
      <div class="p-6 text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
          <UIcon name="i-heroicons-map-pin" class="w-8 h-8 text-red-500" />
        </div>
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Hors zone</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Vous êtes à {{ geofenceDistance }}m du PDV.
        </p>
        <p class="text-sm text-gray-400 mb-6">
          Distance maximum autorisée : {{ geofenceRadius }}m
        </p>
        <div class="flex gap-3 justify-center">
          <UButton variant="ghost" @click="showGeofenceAlert = false">Annuler</UButton>
          <UButton class="bg-fc-red" @click="showGeofenceAlert = false; forceSubmit()">
            Soumettre quand même
          </UButton>
        </div>
      </div>
    </UModal>

    <UModal v-model="showCancelConfirm">
      <div class="space-y-4 p-6">
        <div>
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Annuler la visite ?</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Les informations non enregistrées seront perdues.
          </p>
        </div>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" @click="showCancelConfirm = false">Continuer la saisie</UButton>
          <UButton color="red" @click="confirmCancel">Annuler la visite</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { getDefaultVisiteData } from '~/types'
import type { PDV, VisiteData, VisiteProduits, VisiteConcurrence, VisiteVisibilite, VisiteActions } from '~/types'
import { getSkus, quantityToLegacyStatus, categoryPresent } from '~/utils/products'

// Helper types: exclude 'present', 'prix_respectes' & 'quantites' so indexed access yields ProductStatus only
type ProductKey<T> = Exclude<keyof T, 'present' | 'prix_respectes' | 'quantites'>
type VisibConcKey = Exclude<keyof VisiteVisibilite['concurrence'], 'presence_visibilite' | 'nom_concurrent_ext' | 'nom_concurrent_int'>

definePageMeta({
  middleware: ['auth'],
  layout: false,
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const authStore = useAuthStore()
const pdvStore = usePDVStore()
const routingStore = useRoutingStore()
const { validateGeofence, grabPosition } = useGeofencing()
const { completeMission } = useRouting()
const { addToQueue, isOnline } = useOfflineSync()
const { uploadImages } = useImageUpload()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const config = useRuntimeConfig()

const geofenceRadius = config.public.geofenceRadius as number || 200

// Routing context (pre-selected PDV from routing page)
const routingPdvId = computed(() => route.query.routing_pdv_id as string || '')
const preselectedPdvId = computed(() => route.query.pdv_id as string || '')

const currentTab = ref(0)
const saving = ref(false)
const showGeofenceAlert = ref(false)
const geofenceDistance = ref(0)
const showCreatePDV = ref(false)
const showCancelConfirm = ref(false)
const formError = ref('')

// Save overlay state
const showSaveOverlay = ref(false)
const saveStatus = ref<'saving' | 'success' | 'error'>('saving')
const saveProgress = ref(0)

// Wizard steps — one per product type for Dispo & Prix
const wizardSteps = [
  { key: 'general', label: 'Général' },
  { key: 'evap', label: 'EVAP' },
  { key: 'imp', label: 'IMP' },
  { key: 'scm', label: 'SCM' },
  { key: 'uht', label: 'UHT' },
  { key: 'yaourt', label: 'Yaourt' },
  { key: 'cereales', label: 'Céréales' },
  { key: 'concurrence', label: 'Concurrence' },
  { key: 'visibilite', label: 'Visibilité' },
  { key: 'actions', label: 'Actions' },
  { key: 'photos', label: 'Photos' },
]

// Form state
const defaultData = getDefaultVisiteData()
const form = reactive({
  pdv_id: '',
  date_visite: new Date().toISOString().slice(0, 16),
  produits: defaultData.produits,
  concurrence: defaultData.concurrence,
  visibilite: defaultData.visibilite,
  actions: defaultData.actions,
  images: [] as File[],
})

// PDV list (filtered by user's zone/secteurs)
const pdvList = ref<any[]>([])
const filteredPdvList = computed(() => {
  const profile = authStore.profile
  if (!profile || profile.role === 'admin' || profile.role === 'superviseur') {
    return pdvList.value
  }
  let list = pdvList.value
  if (profile.zone_assignee) {
    list = list.filter(p => p.zone === profile.zone_assignee)
  }
  if (profile.secteurs_assignes && profile.secteurs_assignes.length > 0) {
    list = list.filter(p => profile.secteurs_assignes!.includes(p.secteur))
  }
  // Toujours inclure le PDV pré-sélectionné via routing
  if (preselectedPdvId.value && !list.some(p => p.pdv_id === preselectedPdvId.value)) {
    const routingPdv = pdvList.value.find(p => p.pdv_id === preselectedPdvId.value)
    if (routingPdv) list = [routingPdv, ...list]
  }
  return list
})
const pdvOptions = computed(() =>
  filteredPdvList.value.map(p => ({
    label: `${p.nom_pdv} (${p.zone || ''})`,
    value: p.pdv_id,
  }))
)
const canCreatePDV = computed(() => authStore.profile?.role === 'merchandiser')

const userEmail = computed(() => user.value?.email || '')

// Product definitions
const evapProducts: { key: ProductKey<VisiteProduits['evap']>; label: string }[] = [
  { key: 'br_gold', label: 'BR Gold' },
  { key: 'br_160g', label: 'BR 150g' },
  { key: 'brb_160g', label: 'BRB 150g' },
  { key: 'br_400g', label: 'BR 380g' },
  { key: 'brb_400g', label: 'BRB 380g' },
  { key: 'pearl_400g', label: 'Pearl 380g' },
]

const impProducts: { key: ProductKey<VisiteProduits['imp']>; label: string }[] = [
  { key: 'br_400g', label: 'BR tin 2500g' },
  { key: 'br_20g', label: 'BR 15g' },
  { key: 'brb_25g', label: 'BRB 16g' },
  { key: 'br_375g', label: 'BR 360g' },
  { key: 'br_900g', label: 'BR 400g Tin' },
  { key: 'brb_400g', label: 'BRB 360g' },
  { key: 'br_2_5kg', label: 'BR 900g Tin' },
  { key: 'brd_15g', label: 'BRD 15g' },
  { key: 'brd_350g', label: 'BR Délice Pouch 350g' },
]

const scmProducts: { key: ProductKey<VisiteProduits['scm']>; label: string }[] = [
  { key: 'pearl_1kg', label: 'Pearl 1Kg' },
  { key: 'br_1kg', label: 'BR 1Kg' },
  { key: 'brb_1kg', label: 'BRB 1Kg' },
  { key: 'br_397g', label: 'BR 397g' },
  { key: 'brb_397g', label: 'BRB 397g' },
]

const uhtProducts: { key: ProductKey<VisiteProduits['uht']>; label: string }[] = [
  { key: 'demi_ecreme', label: 'BR 516ml' },
  { key: 'elopack_500ml', label: 'Elopack 500 ml' },
  { key: 'brique_1l', label: 'Brique 1L' },
]

const yaourtProducts: { key: ProductKey<VisiteProduits['yaourt']>; label: string }[] = [
  { key: 'br_yogoo_fraise_mini_90ml', label: 'BR Yogoo fraise mini 90 ml' },
  { key: 'br_yogoo_fraise_maxi_318ml', label: 'BR Yogoo fraise maxi 318 ml' },
  { key: 'br_yogoo_nature_mini_90ml', label: 'BR Yogoo nature mini 90 ml' },
  { key: 'br_yogoo_nature_maxi_318ml', label: 'BR Yogoo nature maxi 318 ml' },
]

const cerealesProducts = getSkus('cereales').map(s => ({ key: s.key, label: s.label }))

// Seuils stock bas par SKU (couleur des steppers)
const { fetchThresholds, getSeuil } = useSkuThresholds()

// Saisie quantité par SKU → écrit dans form.produits[cat].quantites[sku] (réactif)
function setQty(cat: keyof VisiteProduits, sku: string, value: number) {
  const catData = form.produits[cat] as any
  if (!catData.quantites) catData.quantites = {}
  catData.quantites[sku] = Math.max(0, Math.round(value || 0))
}

const visibConcurrenceItems: { key: VisibConcKey; label: string }[] = [
  { key: 'nido_exterieur', label: 'Visibilité extérieure NIDO' },
  { key: 'nido_interieur', label: 'Visibilité intérieure NIDO' },
  { key: 'laity_exterieur', label: 'Visibilité extérieure LAITY' },
  { key: 'laity_interieur', label: 'Visibilité intérieure LAITY' },
  { key: 'candia_exterieur', label: 'Visibilité extérieure CANDIA' },
  { key: 'candia_interieur', label: 'Visibilité intérieure CANDIA' },
]

const actionItems: { key: keyof VisiteActions; label: string }[] = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Exécution d\'activités promotionnelles' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: 'Pose d\'affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose matériel de visibilité' },
]

const { fetchElements: fetchVisibilityElements, forPdv, visibilitySegmentForPdv } = useVisibilityStandards()
const selectedPDV = computed(() => pdvList.value.find(p => p.pdv_id === form.pdv_id) || null)
const visibilitySegment = computed(() => visibilitySegmentForPdv(selectedPDV.value?.sous_categorie_pdv))
const visibilitySegmentLabel = computed(() => ({
  boutique: 'Boutique',
  superette: 'Superette / commerce moderne',
  table_top: 'Table Top',
  pushcart: 'Pushcart',
  porridge: 'Porridge',
  kiosque_aboki: 'Kiosque / Aboki',
}[visibilitySegment.value || ''] || '—'))
const exteriorVisibilityElements = computed(() => forPdv(selectedPDV.value?.sous_categorie_pdv, 'exterieure'))
const interiorVisibilityElements = computed(() => forPdv(selectedPDV.value?.sous_categorie_pdv, 'interieure'))
const promotionElements = computed(() => forPdv(selectedPDV.value?.sous_categorie_pdv, 'promotion'))
const visibilitySections = computed(() => [
  { key: 'exterieure', label: 'Visibilité extérieure', icon: 'i-heroicons-building-storefront', items: exteriorVisibilityElements.value },
  { key: 'interieure', label: 'Visibilité intérieure', icon: 'i-heroicons-view-columns', items: interiorVisibilityElements.value },
].filter(section => section.items.length > 0))

watch([selectedPDV, () => visibilitySegment.value], () => {
  const allElements = [
    ...exteriorVisibilityElements.value,
    ...interiorVisibilityElements.value,
    ...promotionElements.value,
  ]
  for (const element of allElements) {
    if (typeof form.visibilite.standards[element.code] !== 'boolean') {
      form.visibilite.standards[element.code] = false
    }
  }
}, { immediate: true })

function onStepChange(_step: number) {
  // Hook for step-specific validation
}

// --- Photo handling ---
const cameraInput = ref<HTMLInputElement | null>(null)

const photoThumbnails = ref<string[]>([])

function rebuildPhotoThumbnails() {
  photoThumbnails.value.forEach(url => URL.revokeObjectURL(url))
  photoThumbnails.value = form.images.map(file => URL.createObjectURL(file))
}

function triggerCamera() {
  cameraInput.value?.click()
}

function onPhotosSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    form.images.push(...Array.from(input.files))
    rebuildPhotoThumbnails()
    input.value = '' // reset for re-select
  }
}

function removePhoto(idx: number) {
  form.images.splice(idx, 1)
  rebuildPhotoThumbnails()
}

function handleCancel() {
  showCancelConfirm.value = true
}

function confirmCancel() {
  showCancelConfirm.value = false
  router.push('/mobile')
}

function handlePDVCreated(pdv: PDV) {
  if (!pdvList.value.some(item => item.pdv_id === pdv.pdv_id)) {
    pdvList.value = [...pdvList.value, pdv].sort((a, b) =>
      (a.nom_pdv || '').localeCompare(b.nom_pdv || '')
    )
  }
  form.pdv_id = pdv.pdv_id
  toast.add({
    title: 'PDV sélectionné',
    description: `${pdv.nom_pdv} est prêt pour la visite.`,
    color: 'green',
  })
}

function animateProgress(targetPercent: number, durationMs: number) {
  const start = saveProgress.value
  const diff = targetPercent - start
  const startTime = Date.now()

  function tick() {
    const elapsed = Date.now() - startTime
    const t = Math.min(elapsed / durationMs, 1)
    saveProgress.value = start + diff * t
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function handleSave() {
  formError.value = ''

  if (!form.pdv_id) {
    formError.value = 'Sélectionnez un PDV avant d’enregistrer la visite.'
    toast.add({ title: 'Sélectionnez un PDV', color: 'red' })
    currentTab.value = 0
    return
  }

  saving.value = true
  showSaveOverlay.value = true
  saveStatus.value = 'saving'
  saveProgress.value = 0

  try {
    // Phase 1: Grab GPS (0→30%)
    animateProgress(30, 800)
    const position = await grabPosition()

    // Phase 2: Check geofence (30→50%)
    animateProgress(50, 400)
    const selectedPDV = pdvList.value.find(p => p.pdv_id === form.pdv_id)
    let geofenceOk = false

    if (selectedPDV?.geolocation_lat && position) {
      try {
        const result = await validateGeofence(selectedPDV.geolocation_lat, selectedPDV.geolocation_lng)
        geofenceOk = result.isWithinRange
        if (!geofenceOk) {
          geofenceDistance.value = result.distance
          showSaveOverlay.value = false
          showGeofenceAlert.value = true
          saving.value = false
          return
        }
      }
      catch {
        geofenceOk = false
      }
    }

    // Phase 3: Submit (50→100%)
    animateProgress(90, 600)
    await submitVisite(position, geofenceOk)

    saveProgress.value = 100
    saveStatus.value = 'success'
  }
  catch (err: any) {
    saveStatus.value = 'error'
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

async function forceSubmit() {
  saving.value = true
  showSaveOverlay.value = true
  saveStatus.value = 'saving'
  saveProgress.value = 0

  try {
    animateProgress(50, 600)
    const position = await grabPosition()
    animateProgress(90, 600)
    await submitVisite(position, false)
    saveProgress.value = 100
    saveStatus.value = 'success'
  }
  catch (err: any) {
    saveStatus.value = 'error'
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

function onSaveComplete() {
  router.push('/mobile')
}

async function submitVisite(
  position: { lat: number; lng: number; accuracy: number } | null,
  geofenceOk: boolean
) {
  const visiteId = crypto.randomUUID().substring(0, 8)

  const visiteData: VisiteData = {
    produits: JSON.parse(JSON.stringify(form.produits)),
    concurrence: JSON.parse(JSON.stringify(form.concurrence)),
    visibilite: JSON.parse(JSON.stringify(form.visibilite)),
    actions: JSON.parse(JSON.stringify(form.actions)),
  }

  // Les indicateurs historiques restent alimentés pour les dashboards existants.
  const observed = visiteData.visibilite.standards
  visiteData.visibilite.exterieure.poster = observed.affiche === true
  visiteData.visibilite.exterieure.guirlande = observed.guirlande === true
  visiteData.visibilite.exterieure.sign_board = observed.sign_board === true
  visiteData.visibilite.exterieure.panneau_privilege = observed.panneau_privilege === true
  visiteData.visibilite.exterieure.full_branding = observed.full_branding === true
  visiteData.visibilite.interieure.reglettes = observed.reglette === true
  visiteData.visibilite.interieure.maison_bonnet_rouge = observed.maison_br === true
  visiteData.visibilite.interieure.hanger = observed.hanger === true
  visiteData.visibilite.interieure.presentoirs = observed.presentoir === true
  visiteData.visibilite.interieure.tete_gondole = observed.tg === true
  visiteData.visibilite.interieure.merchandising = observed.merchandising === true
  visiteData.visibilite.exterieure.presence_visibilite = exteriorVisibilityElements.value
    .some(element => visiteData.visibilite.standards[element.code] === true)
  visiteData.visibilite.interieure.presence_visibilite = interiorVisibilityElements.value
    .some(element => visiteData.visibilite.standards[element.code] === true)

  // Dériver présence + statut hérité par SKU depuis les quantités saisies (compat dashboards/export)
  for (const cat of Object.keys(visiteData.produits) as (keyof VisiteProduits)[]) {
    const catData: any = (visiteData.produits as any)[cat]
    const q = catData.quantites || {}
    for (const sku of getSkus(cat)) {
      if (sku.key in catData) catData[sku.key] = quantityToLegacyStatus(q[sku.key] || 0)
    }
    catData.present = categoryPresent(catData, cat)
  }

  let imageUrls: string[] = []
  if (form.images.length > 0 && isOnline.value) {
    imageUrls = await uploadImages(form.images, `visites/${visiteId}`)
  }

  const visite = {
    visite_id: visiteId,
    pdv_id: form.pdv_id,
    user_id: user.value?.id,
    date_visite: new Date(form.date_visite).toISOString(),
    commercial: authStore.profile?.nom || '',
    email: user.value?.email || '',
    geolocation_lat: position?.lat || null,
    geolocation_lng: position?.lng || null,
    geofence_validated: geofenceOk,
    precision_gps: position?.accuracy || null,
    data: visiteData,
    image_urls: imageUrls,
    sync_status: 'synced',
  }

  if (isOnline.value) {
    const { error } = await supabase.from('visites').insert(visite as any)
    if (error) throw error
  }
  else {
    addToQueue({ type: 'visite', data: { ...visite, sync_status: 'pending' } })
  }

  // Complete routing PDV if from routing context
  if (routingPdvId.value) {
    const routingPdvItem = routingStore.routingPDVList.find(rp => rp.id === routingPdvId.value)
    if (routingPdvItem) {
      await completeMission(routingPdvItem, visiteId)
    }
  }
}

onMounted(async () => {
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }
  void fetchThresholds()
  void fetchVisibilityElements()
  pdvList.value = await pdvStore.fetchScopedPDV(authStore.profile)

  // Pre-select PDV from routing context
  if (preselectedPdvId.value) {
    // Si le PDV du routing n'est pas dans la liste scopée, l'ajouter
    const alreadyInList = pdvList.value.some(p => p.pdv_id === preselectedPdvId.value)
    if (!alreadyInList) {
      const { data: routingPdv } = await supabase
        .from('pdv')
        .select('*')
        .eq('pdv_id', preselectedPdvId.value)
        .single()
      if (routingPdv) {
        pdvList.value = [...pdvList.value, routingPdv].sort((a, b) =>
          (a.nom_pdv || '').localeCompare(b.nom_pdv || '')
        )
      }
    }
    form.pdv_id = preselectedPdvId.value

    // Passer automatiquement à l'étape suivante si PDV pré-sélectionné
    toast.add({
      title: 'PDV pré-sélectionné',
      description: pdvOptions.value.find(o => o.value === preselectedPdvId.value)?.label || preselectedPdvId.value,
      color: 'green',
      icon: 'i-heroicons-map-pin',
      timeout: 3000,
    })
  }
})

watch(() => form.pdv_id, () => {
  if (form.pdv_id) formError.value = ''
})

onUnmounted(() => {
  photoThumbnails.value.forEach(url => URL.revokeObjectURL(url))
})
</script>
