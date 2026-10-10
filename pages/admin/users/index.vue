<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Les comptes du back-office et de l’application : rôle, équipe et territoires de chacun."
    >
      <template v-if="authStore.isAdmin" #actions>
        <UButton icon="i-heroicons-plus" @click="openCreateUser">
          Nouvel utilisateur
        </UButton>
      </template>
    </AdminPageHeader>

    <!-- Recherche, filtre et échanges de fichiers -->
    <div class="admin-toolbar flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <UInput
          v-model="searchQuery"
          placeholder="Nom ou e-mail"
          icon="i-heroicons-magnifying-glass"
          size="sm"
          aria-label="Rechercher un utilisateur par nom ou e-mail"
          class="w-full sm:w-64"
        />
        <USelectMenu
          v-model="roleFilter"
          :options="[{ value: '', label: 'Tous les rôles' }, ...ROLE_OPTIONS]"
          option-attribute="label"
          value-attribute="value"
          placeholder="Rôle"
          size="sm"
          aria-label="Filtrer par rôle"
          class="w-full sm:w-48"
        />
        <span class="text-xs tabular-nums text-slate-600 dark:text-slate-300" aria-live="polite">
          {{ filteredUsers.length }} utilisateur{{ filteredUsers.length > 1 ? 's' : '' }}
        </span>
      </div>
      <div v-if="authStore.isAdmin" class="flex flex-wrap items-center gap-2">
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exportUsers">
          Exporter
        </UButton>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-up-tray" @click="showImportModal = true">
          Importer un CSV
        </UButton>
      </div>
    </div>

    <!-- Demandes de suppression de compte (posées depuis /supprimer-compte) -->
    <div
      v-if="deletionRequests.length"
      class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
      role="status"
    >
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {{ deletionRequests.length }} demande{{ deletionRequests.length > 1 ? 's' : '' }} de suppression de compte en attente
          </p>
          <p class="mt-0.5 text-sm text-amber-800 dark:text-amber-200">
            À traiter sous 30 jours : ouvrez le menu Actions de la ligne concernée, puis choisissez « Supprimer définitivement ».
          </p>
          <ul class="mt-2 space-y-1">
            <li v-for="d in deletionRequests" :key="d.id" class="text-sm text-amber-900 dark:text-amber-100">
              <strong>{{ d.email }}</strong> · demandé le {{ formatDateFr(d.requested_at, { day: '2-digit', month: 'short', year: 'numeric' }) }}
              <span v-if="d.reason" class="text-amber-800 dark:text-amber-300"> · motif : « {{ d.reason }} »</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Users Table -->
    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Utilisateur</th>
              <th scope="col">E-mail</th>
              <th scope="col">Rôle</th>
              <th scope="col">Territoires</th>
              <th scope="col">Équipe</th>
              <th scope="col">Statut</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in paginatedUsers" :key="user.id">
              <td>
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    aria-hidden="true"
                  >
                    {{ initiales(user) }}
                  </div>
                  <span class="text-sm font-medium text-slate-900 dark:text-white">{{ user.nom || 'Sans nom' }}</span>
                  <span
                    v-if="deletionRequestById.has(user.id)"
                    class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    title="Suppression du compte demandée par l’utilisateur"
                  >Suppression demandée</span>
                </div>
              </td>
              <td class="text-slate-600 dark:text-slate-300">{{ user.email }}</td>
              <td>
                <div class="flex flex-wrap items-center gap-1">
                  <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {{ libelleRole(user.role) }}
                  </span>
                  <span
                    v-if="(user.role === 'merchandiser' && estMerchandiserProgramme(user.employeur, agences)) || user.role === 'agence'"
                    class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    :title="user.role === 'agence'
                      ? `Compte agence ${nomAgenceDe(user.employeur)} : ne voit que les merchandisers de son agence`
                      : `Merchandiser ${nomAgenceDe(user.employeur)} : tournée par quotas`"
                  >{{ nomAgenceDe(user.employeur) }}</span>
                  <span
                    v-if="user.direction"
                    class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    :title="libelleDirection(user.direction)"
                  >{{ libelleDirection(user.direction, true) }}</span>
                </div>
              </td>
              <td class="text-slate-600 dark:text-slate-300">{{ zoneLabel(user) }}</td>
              <td class="text-slate-600 dark:text-slate-300">{{ equipeLabel(user) }}</td>
              <td class="whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 text-sm" :class="user.is_active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'">
                  <span class="h-2 w-2 rounded-full" :class="user.is_active ? 'bg-emerald-600' : 'bg-slate-400'" aria-hidden="true" />
                  {{ user.is_active ? 'Actif' : 'Désactivé' }}
                </span>
              </td>
              <td class="text-right">
                <UDropdown v-if="authStore.isAdmin" :items="getUserActions(user)" :popper="{ placement: 'bottom-end' }">
                  <UButton color="gray" variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" :aria-label="`Actions pour ${user.nom || user.email}`" />
                </UDropdown>
              </td>
            </tr>
            <tr v-if="!loading && !paginatedUsers.length">
              <td colspan="7" class="py-10 text-center text-slate-600 dark:text-slate-300">
                {{ searchQuery || roleFilter ? 'Aucun utilisateur ne correspond à la recherche ou au rôle choisi. Effacez la recherche ou choisissez « Tous les rôles ».' : 'Aucun utilisateur pour l’instant. Créez le premier compte avec « Nouvel utilisateur ».' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
        <AdminPagination
          :total="filteredUsers.length"
          :page="usersPage"
          :page-size="usersPerPage"
          item-label="utilisateur(s)"
          @update:page="(p) => usersPage = p"
        />
      </div>

      <div v-if="loading" class="p-8">
        <ChargementContenu variante="compact" libelle="Chargement des utilisateurs…" />
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <AdminFormModal
      v-model="showCreate"
      :title="editingUser ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'"
      description="Identité, rôle et périmètre terrain du compte."
      icon="i-heroicons-user-plus"
      width="sm:max-w-3xl"
      body-class="space-y-8"
      as-form
      required-note
      @submit="handleSaveUser"
    >
      <section aria-labelledby="user-identity-title">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" aria-hidden="true">
            <UIcon name="i-heroicons-identification" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="user-identity-title" class="text-base font-semibold text-slate-900 dark:text-white">
              Identité
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Nom, coordonnées et informations de connexion.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <UFormGroup label="Nom complet" required size="md">
            <UInput v-model="userForm.nom" placeholder="Ex. Awa Koné" size="md" class="w-full" />
          </UFormGroup>
          <UFormGroup label="E-mail" required size="md">
            <UInput v-model="userForm.email" type="email" placeholder="nom@entreprise.com" size="md" class="w-full" />
          </UFormGroup>
          <UFormGroup v-if="!editingUser" label="Mot de passe" required help="8 caractères minimum." size="md">
            <UInput v-model="userForm.password" type="password" placeholder="Saisir un mot de passe" minlength="8" size="md" class="w-full" />
          </UFormGroup>
          <UFormGroup label="Téléphone" size="md" :class="editingUser ? 'sm:col-span-2' : ''">
            <UInput v-model="userForm.telephone" placeholder="Ex. +225 07 00 00 00 00" size="md" class="w-full" />
          </UFormGroup>
        </div>
      </section>

      <section aria-labelledby="user-role-title" class="border-t border-slate-200 pt-7 dark:border-slate-700">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" aria-hidden="true">
            <UIcon name="i-heroicons-user-group" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="user-role-title" class="text-base font-semibold text-slate-900 dark:text-white">
              Rôle et équipe
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Ce que le compte peut faire, et à qui il est rattaché.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <UFormGroup
            label="Rôle"
            :help="userForm.role === 'agence' ? 'Responsable du routing d\'une agence : ne voit et ne charge que les merchandisers de son agence.' : undefined"
            size="md"
          >
            <USelectMenu
              v-model="userForm.role"
              :options="ROLE_OPTIONS"
              option-attribute="label"
              value-attribute="value"
              size="md"
              class="w-full"
            />
          </UFormGroup>

          <UFormGroup
            v-if="userForm.role === 'merchandiser'"
            label="Commercial responsable"
            help="Rattachement d'équipe. N'élargit ni ne restreint le périmètre : celui-ci reste défini par les territoires."
            size="md"
          >
            <USelectMenu
              v-model="userForm.commercial_id"
              :options="commercialOptions"
              option-attribute="label"
              value-attribute="value"
              placeholder="Aucun"
              searchable
              searchable-placeholder="Rechercher un commercial…"
              size="md"
              class="w-full"
            />
          </UFormGroup>

          <!-- Deux logiques de tournée : FrieslandCampina = tout le périmètre chaque jour ;
               agence « programme » (Atom BTL, agence North…) = quotas journaliers par canal,
               chaque PDV une fois par mois. Agences : Référentiels › Agences. -->
          <UFormGroup
            v-if="userForm.role === 'merchandiser' || userForm.role === 'agence'"
            :label="userForm.role === 'agence' ? 'Agence' : 'Employeur (agence)'"
            :required="userForm.role === 'agence'"
            :help="userForm.role === 'agence'
              ? 'Le compte ne verra que les merchandisers de cette agence.'
              : 'Agence « programme » (Atom BTL, agence North…) : tournée par quotas depuis son portefeuille. FrieslandCampina : tout son périmètre chaque jour.'"
            size="md"
          >
            <USelectMenu
              v-model="userForm.employeur"
              :options="userForm.role === 'agence' ? agencesHorsFriesland : employeurOptions"
              option-attribute="label"
              value-attribute="value"
              size="md"
              class="w-full"
            />
          </UFormGroup>

          <!-- Direction : South / North se déduisent des territoires ; MT (Modern
               Trade) se choisit ici. Une personne à deux comptes a deux directions. -->
          <UFormGroup
            label="Direction"
            help="Par défaut, déduite des territoires : South pour Abidjan, North pour l’intérieur. Choisissez « Modern Trade » ici pour la direction des supermarchés (MT)."
            size="md"
          >
            <USelectMenu
              v-model="userForm.direction"
              :options="directionOptions"
              option-attribute="label"
              value-attribute="value"
              size="md"
              class="w-full"
            />
          </UFormGroup>
        </div>
      </section>

      <section aria-labelledby="user-scope-title" class="border-t border-slate-200 pt-7 dark:border-slate-700">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" aria-hidden="true">
            <UIcon name="i-heroicons-map" class="h-4 w-4" />
          </div>
          <div>
            <h3 id="user-scope-title" class="text-base font-semibold text-slate-900 dark:text-white">
              Périmètre terrain
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Les territoires et les quartiers que l’utilisateur suit.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <UFormGroup label="Région" help="Filtre la liste des territoires ci-dessous ; les territoires déjà cochés restent cochés." size="md">
            <USelectMenu
              v-model="userForm.region_code"
              :options="regionOptions"
              option-attribute="label"
              value-attribute="value"
              placeholder="Sélectionner une région"
              searchable
              searchable-placeholder="Rechercher…"
              size="md"
              class="w-full"
              @update:model-value="onRegionChange"
            />
          </UFormGroup>

          <UFormGroup label="Sous-région" help="Filtre la liste des territoires ci-dessous ; les territoires déjà cochés restent cochés." size="md">
            <USelectMenu
              v-model="userForm.sub_region_code"
              :options="subRegionOptions"
              option-attribute="label"
              value-attribute="value"
              :disabled="!userForm.region_code"
              placeholder="Sélectionner une sous-région"
              searchable
              searchable-placeholder="Rechercher…"
              size="md"
              class="w-full"
            />
          </UFormGroup>

          <UFormGroup label="Territoires assignés" help="Cochez un ou plusieurs territoires, y compris dans plusieurs sous-régions : changer les filtres ci-dessus ne décoche rien." size="md" class="sm:col-span-2">
            <div
              v-if="!userForm.sub_region_code"
              class="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400"
            >
              Choisissez d’abord une région et une sous-région pour afficher leurs territoires.
            </div>
            <div
              v-else-if="!territoryOptions.length"
              class="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400"
            >
              Aucun territoire dans cette sous-région. Choisissez-en une autre.
            </div>
            <div v-else>
              <div class="mb-2 flex items-center justify-end gap-3 text-xs">
                <button type="button" class="rounded font-semibold text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300" @click="toggleAllVisibleTerritories(true)">
                  Tout cocher
                </button>
                <button type="button" class="rounded font-semibold text-slate-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400" @click="toggleAllVisibleTerritories(false)">
                  Tout décocher
                </button>
              </div>
              <div class="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
                <label
                  v-for="opt in territoryOptions"
                  :key="opt.value"
                  class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <UCheckbox
                    :model-value="userForm.territory_codes.includes(opt.value)"
                    @update:model-value="toggleTerritory(opt.value)"
                  />
                  <span class="text-slate-700 dark:text-slate-200">{{ opt.label }}</span>
                </label>
              </div>
            </div>
            <p v-if="userForm.territory_codes.length" class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="code in userForm.territory_codes"
                :key="code"
                class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              >
                {{ territoryChipLabel(code) }}
                <button
                  type="button"
                  class="rounded-full hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  :aria-label="`Retirer ${territoryChipLabel(code)}`"
                  @click="toggleTerritory(code)"
                >
                  <UIcon name="i-heroicons-x-mark-20-solid" class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            </p>
            <div v-if="unmatchedTerritories.length" class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
              <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">Territoires absents de la liste des territoires</p>
              <p class="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                Rattachez chaque libellé à un territoire de la liste : le profil ne gardera que ce territoire, et les PDV qui portent encore l’ancien libellé resteront dans son périmètre.
              </p>
              <div v-for="nom in unmatchedTerritories" :key="nom" class="mt-2 flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-slate-800 dark:text-amber-200">{{ nom }}</span>
                <UIcon name="i-heroicons-arrow-right" class="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                <span class="sr-only">rattaché à</span>
                <USelectMenu
                  :model-value="rattachements[nom] || ''"
                  :options="allTerritoryOptions"
                  option-attribute="label"
                  value-attribute="value"
                  placeholder="Conserver tel quel"
                  searchable
                  searchable-placeholder="Rechercher un territoire…"
                  size="xs"
                  class="w-full sm:w-64"
                  :aria-label="`Territoire de rattachement pour ${nom}`"
                  @update:model-value="rattachements[nom] = $event"
                />
                <UButton
                  v-if="rattachements[nom]"
                  size="2xs"
                  variant="outline"
                  :loading="applyingAlias === nom"
                  title="Enregistre le rattachement et remplace ce libellé sur tous les profils qui le portent"
                  @click="appliquerAliasPartout(nom)"
                >
                  Appliquer à tous les profils
                </UButton>
              </div>
            </div>
          </UFormGroup>

          <UFormGroup label="Quartiers assignés" help="Les quartiers des territoires cochés. Laissez tout décoché pour autoriser tous les quartiers." size="md" class="sm:col-span-2">
            <div
              v-if="!userForm.territory_codes.length"
              class="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400"
            >
              Cochez au moins un territoire pour lister ses quartiers.
            </div>
            <div
              v-else-if="!quartierOptions.length"
              class="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400"
            >
              Aucun quartier enregistré pour les territoires cochés. Ajoutez-les dans Paramètres › Référentiels › Quartiers.
            </div>
            <div v-else class="max-h-72 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3 dark:border-slate-700">
              <div v-for="g in quartierGroupes" :key="g.code">
                <div class="mb-1 flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {{ g.territoire }} · <span class="tabular-nums">{{ g.quartiers.filter(q => userForm.quartiers_assignes.includes(q)).length }} sur {{ g.quartiers.length }}</span>
                  </span>
                  <button type="button" class="rounded text-xs font-semibold text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300" @click="toggleGroupeQuartiers(g.quartiers)">
                    {{ g.quartiers.every(q => userForm.quartiers_assignes.includes(q)) ? 'Tout décocher' : 'Tout cocher' }}
                  </button>
                </div>
                <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  <label
                    v-for="q in g.quartiers"
                    :key="q"
                    class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <UCheckbox
                      :model-value="userForm.quartiers_assignes.includes(q)"
                      @update:model-value="toggleQuartier(q)"
                    />
                    <span class="text-slate-700 dark:text-slate-200">{{ q }}</span>
                  </label>
                </div>
              </div>
            </div>
          </UFormGroup>
        </div>
      </section>

      <template #footer>
        <UButton type="button" color="gray" variant="ghost" @click="showCreate = false">
          Annuler
        </UButton>
        <UButton
          type="submit"
          icon="i-heroicons-check"
          :loading="saving"
        >
          {{ editingUser ? 'Enregistrer les modifications' : 'Créer l’utilisateur' }}
        </UButton>
      </template>
    </AdminFormModal>

    <!-- Import CSV utilisateurs -->
    <UModal v-model="showImportModal">
      <div class="space-y-4 p-6">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Importer des utilisateurs (CSV)</h2>
          <div class="mt-1 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Chaque ligne met à jour le compte qui a cet e-mail ; un e-mail inconnu crée un compte
              (mot de passe de la colonne <code class="font-mono text-xs">mot_de_passe</code>, sinon un mot de passe par défaut).
            </p>
            <p>
              Plusieurs territoires ou quartiers : séparez-les par une barre verticale « | », ex. ADJAME|PLATEAU.
              Les libellés sont gardés tels quels.
            </p>
          </div>
          <UButton variant="link" size="xs" class="px-0" icon="i-heroicons-document-arrow-down" @click="downloadUsersTemplate">
            Télécharger le modèle
          </UButton>
        </div>

        <div>
          <input ref="importFileInput" type="file" accept=".csv" class="hidden" @change="handleImportFileSelect" />
          <UButton variant="outline" icon="i-heroicons-document-text" @click="($refs.importFileInput as HTMLInputElement)?.click()">
            Choisir un fichier CSV
          </UButton>
          <p v-if="importFile" class="mt-2 text-sm text-slate-700 dark:text-slate-200">{{ importFile.name }}</p>
        </div>

        <div v-if="importSummary" class="space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-700/50" aria-live="polite">
          <div class="flex flex-wrap gap-3 text-sm">
            <span class="font-medium text-slate-900 dark:text-white"><span class="tabular-nums">{{ importSummary.created }}</span> créé{{ importSummary.created > 1 ? 's' : '' }}</span>
            <span class="font-medium text-slate-900 dark:text-white"><span class="tabular-nums">{{ importSummary.updated }}</span> mis à jour</span>
            <span v-if="importSummary.errors.length" class="font-medium text-red-700 dark:text-red-300"><span class="tabular-nums">{{ importSummary.errors.length }}</span> ligne{{ importSummary.errors.length > 1 ? 's' : '' }} en erreur</span>
          </div>
          <ul v-if="importSummary.errors.length" class="max-h-40 space-y-1 overflow-y-auto border-t border-slate-200 pt-2 dark:border-slate-600">
            <li v-for="(e, i) in importSummary.errors" :key="i" class="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
              <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Ligne {{ e.line }}<template v-if="e.email"> ({{ e.email }})</template> : {{ e.message }}</span>
            </li>
          </ul>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <UButton color="gray" variant="ghost" @click="closeImportModal">Fermer</UButton>
          <UButton icon="i-heroicons-arrow-up-tray" :disabled="!importFile" :loading="importing" @click="importUsers">
            Importer
          </UButton>
        </div>
      </div>
    </UModal>

    <UModal v-model="showResetPassword">
      <div v-if="resetTarget" class="space-y-4 p-6">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Réinitialiser le mot de passe</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {{ resetTarget.nom || 'Utilisateur sans nom' }} · {{ resetTarget.email }}
          </p>
        </div>

        <template v-if="!resetResult">
          <p class="text-sm text-slate-700 dark:text-slate-300">
            Un mot de passe provisoire sera appliqué immédiatement. L’utilisateur devra en
            choisir un nouveau à sa prochaine connexion. Aucun e-mail n’est envoyé :
            c’est à vous de lui transmettre le mot de passe affiché à l’étape suivante.
          </p>
          <UFormGroup label="Mot de passe provisoire" hint="Laissez vide pour en générer un automatiquement.">
            <UInput
              v-model="resetCustomPassword"
              type="text"
              autocomplete="off"
              placeholder="Généré automatiquement"
            />
          </UFormGroup>
          <div class="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <UButton color="gray" variant="ghost" @click="closeResetPassword">Annuler</UButton>
            <UButton color="red" icon="i-heroicons-key" :loading="resetting" @click="confirmResetPassword">
              Réinitialiser
            </UButton>
          </div>
        </template>

        <template v-else>
          <div class="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
            <p class="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Nouveau mot de passe provisoire</p>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <code class="select-all rounded-md bg-white px-3 py-2 font-mono text-lg tracking-wider text-slate-900 dark:bg-slate-900 dark:text-white">{{ resetResult }}</code>
              <UButton size="sm" variant="outline" :icon="resetCopied ? 'i-heroicons-check' : 'i-heroicons-clipboard'" @click="copyResetPassword">
                {{ resetCopied ? 'Copié' : 'Copier' }}
              </UButton>
            </div>
            <p class="mt-3 text-sm text-emerald-800 dark:text-emerald-200">
              Affiché une seule fois : notez-le avant de fermer. L’utilisateur devra le changer à sa prochaine connexion.
            </p>
          </div>
          <div class="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
            <UButton @click="closeResetPassword">Fermer</UButton>
          </div>
        </template>
      </div>
    </UModal>

    <!-- Confirmation : désactiver ou supprimer un compte (nomme le compte et dit la conséquence). -->
    <UModal v-model="confirmation.ouvert">
      <div v-if="confirmation.user" class="space-y-4 p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{ confirmation.type === 'supprimer'
            ? `Supprimer définitivement le compte de ${nomCompte(confirmation.user)} ?`
            : `Désactiver le compte de ${nomCompte(confirmation.user)} ?` }}
        </h2>
        <p v-if="confirmation.type === 'supprimer'" class="text-sm leading-6 text-slate-700 dark:text-slate-200">
          Le compte de connexion et le profil sont supprimés ; cette action ne peut pas être annulée.
          Pour seulement bloquer l’accès en gardant le compte, choisissez plutôt « Désactiver ».
        </p>
        <p v-else class="text-sm leading-6 text-slate-700 dark:text-slate-200">
          Il ne pourra plus se connecter. Ses visites et ses tournées sont conservées, et vous pourrez réactiver le compte à tout moment.
        </p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" :disabled="confirmation.enCours" @click="confirmation.ouvert = false">Annuler</UButton>
          <UButton
            color="red"
            :icon="confirmation.type === 'supprimer' ? 'i-heroicons-trash' : 'i-heroicons-no-symbol'"
            :loading="confirmation.enCours"
            @click="executerConfirmation"
          >
            {{ confirmation.type === 'supprimer' ? 'Supprimer le compte' : 'Désactiver le compte' }}
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { grouperQuartiersParTerritoire } from '~/utils/territoires'
import { DIRECTIONS, estMerchandiserProgramme, libelleDirection } from '~/utils/agences'
import type { Profile, UserRole, Employeur } from '~/types'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({
  middleware: ['auth', 'admin', 'admin-strict'],
  layout: 'admin',
})

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const toast = useToast()

const users = ref<Profile[]>([])
const loading = ref(false)
const searchQuery = ref('')
const roleFilter = ref('')
// Agences : table agence (Référentiels › Agences).
const { agences, options: employeurOptions, nom: nomAgenceDe, charger: chargerAgences } = useAgences()
// Un compte agence est toujours rattaché à une agence autre que FrieslandCampina
// (contrainte profiles_agence_rattachee).
const agencesHorsFriesland = computed(() => employeurOptions.value.filter(o => o.value !== 'friesland'))

const ROLE_OPTIONS: { value: UserRole, label: string }[] = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'superviseur', label: 'Superviseur' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'merchandiser', label: 'Merchandiser' },
  { value: 'agence', label: 'Agence' },
]
const libelleRole = (role: string) => ROLE_OPTIONS.find(r => r.value === role)?.label || role
/** Employeur enregistré : l'agence pour un merchandiser ou un compte agence, FrieslandCampina sinon. */
const employeurAEnregistrer = () =>
  userForm.value.role === 'merchandiser' || userForm.value.role === 'agence' ? userForm.value.employeur : 'friesland'
const directionOptions = [{ value: '', label: 'Déduite des territoires' }, ...DIRECTIONS.map(d => ({ value: d.value, label: d.label }))]
const showCreate = ref(false)
const editingUser = ref<Profile | null>(null)
const saving = ref(false)

const userForm = ref({
  nom: '',
  email: '',
  password: '',
  role: 'merchandiser' as UserRole,
  zone_assignee: '',
  region: '',
  territoires_assignes: [] as string[],
  quartiers_assignes: [] as string[],
  telephone: '',
  commercial_id: null as string | null,
  employeur: 'friesland' as Employeur,
  direction: '' as string,
  // Cascade géo (UI) — non stockées telles quelles ; on dérive zone_assignee/region au save.
  region_code: '',
  sub_region_code: '',
  territory_codes: [] as string[],
})

// Passage au rôle agence : FrieslandCampina n'est pas une agence possible.
watch(() => userForm.value.role, (role) => {
  if (role === 'agence' && (!userForm.value.employeur || userForm.value.employeur === 'friesland')) {
    userForm.value.employeur = agencesHorsFriesland.value[0]?.value || ''
  }
})

// Cascade géo Division → Sous-région → Territoire → Quartiers, alignée sur la
// hiérarchie référentiel. Scoping pdv : pdv.zone = territoire.nom,
// pdv.quartier = quartier.nom, pdv.region = sous_region.nom_affichage.
const { regions, subRegions, territories, areas, quartiers, territoireAliases, fetchReferentiels } = useReferentiels()
// Commerciaux actifs : responsables possibles d'un merchandiseur.
const commercialOptions = computed(() => users.value
  .filter(u => u.role === 'commercial' && u.is_active !== false)
  .map(u => ({ value: u.id, label: u.nom || u.email || u.id }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr')))

function equipeLabel(user: Profile) {
  if (!user.commercial_id) return user.role === 'merchandiser' ? 'Aucune' : ''
  const c = users.value.find(u => u.id === user.commercial_id)
  return c?.nom || c?.email || 'Commercial introuvable'
}

const regionOptions = computed(() => regions.value.map(r => ({ value: r.code, label: r.nom_affichage ? `${r.nom_affichage} · ${r.name}` : r.name })))
const subRegionOptions = computed(() => subRegions.value
  .filter(s => s.region_code === userForm.value.region_code)
  .map(s => ({ value: s.code, label: s.nom_affichage ? `${s.nom_affichage} · ${s.name}` : s.name })))
const territoryOptions = computed(() => territories.value
  .filter(t => t.sub_region_code === userForm.value.sub_region_code)
  .map(t => ({ value: t.code, label: t.name })))
// Quartiers agrégés sur TOUS les territoires cochés (via areas -> zone_id), triés, dédupliqués.
const quartierOptions = computed(() => {
  const selected = new Set(userForm.value.territory_codes)
  const zoneIds = new Set(areas.value.filter(a => selected.has(a.territory_code)).map(a => a.id))
  return [...new Set(quartiers.value.filter(q => zoneIds.has(q.zone_id)).map(q => q.nom).filter(Boolean))].sort()
})

// Rattachement des libellés hors référentiel (territoire_alias). Vide =
// conservé tel quel, comme avant.
const allTerritoryOptions = computed(() => territories.value
  .map(t => ({ value: t.code, label: territoryChipLabel(t.code) }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr')))
const rattachements = ref<Record<string, string>>({})
const applyingAlias = ref<string | null>(null)

async function enregistrerAlias(alias: string, code: string) {
  const { error } = await (supabase.from('territoire_alias') as any)
    .upsert({ alias, territoire_code: code }, { onConflict: 'alias' })
  if (error) throw error
  if (!territoireAliases.value.some(a => a.alias === alias)) {
    territoireAliases.value = [...territoireAliases.value, { alias, territoire_code: code }]
  }
}

// Alias + remplacement du libellé sur tous les profils (service role côté serveur).
async function appliquerAliasPartout(nom: string) {
  const code = rattachements.value[nom]
  if (!code) return
  applyingAlias.value = nom
  try {
    await enregistrerAlias(nom, code)
    const res = await $fetch<{ profils: number }>('/api/admin/territoire-alias', {
      method: 'POST', body: { alias: nom, territoire_code: code },
    })
    toast.add({ title: 'Rattachement appliqué', description: `${res.profils} profil${res.profils > 1 ? 's' : ''} mis à jour.`, color: 'green' })
    // Le formulaire courant suit : le libellé devient le territoire réel.
    unmatchedTerritories.value = unmatchedTerritories.value.filter(n => n !== nom)
    if (!userForm.value.territory_codes.includes(code)) userForm.value.territory_codes.push(code)
    delete rattachements.value[nom]
    await fetchUsers()
  }
  catch (err: any) {
    toast.add({ title: 'Rattachement impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    applyingAlias.value = null
  }
}

// Chip : le territoire peut venir d'une autre sous-région que celle filtrée,
// on rappelle donc son rattachement pour lever l'ambiguïté.
function territoryChipLabel(code: string) {
  const t = territories.value.find(t => t.code === code)
  if (!t) return code
  const sr = subRegions.value.find(s => s.code === t.sub_region_code)
  const srLabel = sr?.nom_affichage || sr?.name
  return srLabel ? `${t.name} · ${srLabel}` : t.name
}

// Coche/décoche un territoire. À la décoche, purge les quartiers devenus orphelins.
function toggleTerritory(code: string) {
  const list = userForm.value.territory_codes
  const idx = list.indexOf(code)
  if (idx === -1) list.push(code)
  else list.splice(idx, 1)
  const valid = new Set(quartierOptions.value)
  userForm.value.quartiers_assignes = userForm.value.quartiers_assignes.filter(q => valid.has(q))
}

// Coche/décoche uniquement les territoires visibles (sous-région filtrée) :
// les sélections des autres sous-régions ne bougent pas.
function toggleAllVisibleTerritories(select: boolean) {
  const visible = territoryOptions.value.map(o => o.value)
  const current = new Set(userForm.value.territory_codes)
  for (const code of visible) {
    if (select) current.add(code)
    else current.delete(code)
  }
  userForm.value.territory_codes = [...current]
  const valid = new Set(quartierOptions.value)
  userForm.value.quartiers_assignes = userForm.value.quartiers_assignes.filter(q => valid.has(q))
}
// Quartiers groupés par territoire (utils/territoires.ts).
const quartierGroupes = computed(() => grouperQuartiersParTerritoire(quartierOptions.value, quartiers.value, areas.value, territories.value))
function toggleGroupeQuartiers(liste: string[]) {
  const tous = liste.every(q => userForm.value.quartiers_assignes.includes(q))
  const set = new Set(userForm.value.quartiers_assignes)
  for (const q of liste) tous ? set.delete(q) : set.add(q)
  userForm.value.quartiers_assignes = [...set]
}
function toggleQuartier(q: string) {
  const list = userForm.value.quartiers_assignes
  const idx = list.indexOf(q)
  if (idx === -1) list.push(q)
  else list.splice(idx, 1)
}

// Région/sous-région = filtres d'affichage de la liste des territoires. Ils ne
// vident JAMAIS la sélection : un utilisateur peut couvrir des territoires de
// plusieurs sous-régions.
function onRegionChange() {
  userForm.value.sub_region_code = ''
}

// Territoires enregistrés mais absents du référentiel : conservés à l'identique
// au save plutôt que silencieusement perdus.
const unmatchedTerritories = ref<string[]>([])

// Libellé original du profil par code de territoire matché : au save on
// réécrit ce libellé (ex. "ADJAME") et non le nom du référentiel ("Adjame"),
// car le scoping SQL compare pdv.zone à l'identique.
const originalTerrNames = ref<Record<string, string>>({})

// Comparaison de noms de territoires insensible à la casse et aux accents :
// les zones importées du terrain sont en MAJUSCULES ("ADJAME") alors que le
// référentiel géo est en casse mixte ("Adjame").
const normTerrName = (v: string) =>
  (v || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Édition : reconstruit region_code/sub_region_code/territory_codes depuis territoires_assignes (noms).
// Fallback legacy : si territoires_assignes vide, part de zone_assignee (mono-territoire).
function hydrateUserGeo() {
  const names = userForm.value.territoires_assignes.length
    ? userForm.value.territoires_assignes
    : (userForm.value.zone_assignee ? [userForm.value.zone_assignee] : [])
  const matched = names.map(n => ({ name: n, terr: territories.value.find(t => normTerrName(t.name) === normTerrName(n)) }))
  userForm.value.territory_codes = matched.filter(m => m.terr).map(m => m.terr!.code)
  unmatchedTerritories.value = matched.filter(m => !m.terr).map(m => m.name)
  rattachements.value = Object.fromEntries(unmatchedTerritories.value
    .map(n => [n, territoireAliases.value.find(a => normTerrName(a.alias) === normTerrName(n))?.territoire_code || '']))
  originalTerrNames.value = Object.fromEntries(
    matched.filter(m => m.terr).map(m => [m.terr!.code, m.name]))
  const first = matched.find(m => m.terr)?.terr
  const sr = first ? subRegions.value.find(s => s.code === first.sub_region_code) : null
  userForm.value.sub_region_code = sr?.code || ''
  userForm.value.region_code = sr?.region_code || ''
}

function openCreateUser() {
  editingUser.value = null
  unmatchedTerritories.value = []
  originalTerrNames.value = {}
  userForm.value = {
    nom: '', email: '', password: '', role: 'merchandiser',
    zone_assignee: '', region: '', territoires_assignes: [], quartiers_assignes: [], telephone: '', commercial_id: null,
    employeur: 'friesland', direction: '',
    region_code: '', sub_region_code: '', territory_codes: [],
  }
  showCreate.value = true
}

const filteredUsers = computed(() => {
  let result = users.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(u =>
      u.nom?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    )
  }
  if (roleFilter.value) {
    result = result.filter(u => u.role === roleFilter.value)
  }
  return result
})

const usersPage = ref(1)
const usersPerPage = 25
const paginatedUsers = computed(() =>
  filteredUsers.value.slice((usersPage.value - 1) * usersPerPage, usersPage.value * usersPerPage)
)
watch([searchQuery, roleFilter], () => { usersPage.value = 1 })

// Colonne Zone : liste tous les territoires si multi, sinon le mono zone_assignee.
function zoneLabel(user: Profile) {
  const terrs = (user.territoires_assignes || []).filter(Boolean)
  if (terrs.length > 1) return `${terrs[0]} +${terrs.length - 1}`
  return terrs[0] || user.zone_assignee || 'Aucun territoire'
}

/** Deux premières lettres du nom, pour l'avatar (décoratif). */
function initiales(user: Profile) {
  return (user.nom || user.email || '').trim().substring(0, 2).toUpperCase() || '?'
}
const nomCompte = (user: Profile) => user.nom || user.email || 'cet utilisateur'

// Menu d'une ligne : actions courantes, puis l'accès au compte, puis la
// suppression, isolée et en rouge, loin de « Désactiver ».
function getUserActions(user: Profile) {
  return [[
    {
      label: 'Modifier',
      icon: 'i-heroicons-pencil',
      click: () => {
        editingUser.value = user
        userForm.value.password = ''
        Object.assign(userForm.value, user)
        userForm.value.employeur = user.employeur || 'friesland'
        userForm.value.direction = user.direction || ''
        userForm.value.territoires_assignes = (user.territoires_assignes || []).filter(Boolean)
        userForm.value.quartiers_assignes = (user.quartiers_assignes || []).filter(Boolean)
        hydrateUserGeo()
        showCreate.value = true
      },
    },
    {
      label: 'Réinitialiser le mot de passe',
      icon: 'i-heroicons-key',
      click: () => openResetPassword(user),
    },
  ], [
    user.is_active
      ? { label: 'Désactiver', icon: 'i-heroicons-no-symbol', click: () => demanderConfirmation('desactiver', user) }
      : { label: 'Réactiver', icon: 'i-heroicons-check-circle', click: () => toggleUserActive(user) },
  ], [
    {
      label: 'Supprimer définitivement',
      icon: 'i-heroicons-trash',
      class: 'text-red-700 dark:text-red-400',
      iconClass: 'text-red-600 dark:text-red-400',
      click: () => demanderConfirmation('supprimer', user),
    },
  ]]
}

// Confirmation nommée avant de désactiver ou de supprimer un compte.
const confirmation = reactive<{ ouvert: boolean, type: 'desactiver' | 'supprimer', user: Profile | null, enCours: boolean }>({
  ouvert: false, type: 'desactiver', user: null, enCours: false,
})
function demanderConfirmation(type: 'desactiver' | 'supprimer', user: Profile) {
  Object.assign(confirmation, { ouvert: true, type, user, enCours: false })
}
async function executerConfirmation() {
  const user = confirmation.user
  if (!user) return
  confirmation.enCours = true
  const ok = confirmation.type === 'supprimer' ? await deleteUser(user) : await toggleUserActive(user)
  confirmation.enCours = false
  if (ok) confirmation.ouvert = false
}

async function fetchUsers() {
  loading.value = true
  try {
    const { fetchUsers: fetchCachedUsers, invalidate } = useUsersCache()
    invalidate() // Admin users page always needs fresh data
    const data = await fetchCachedUsers(true)
    users.value = data as Profile[]
  }
  catch (err: any) {
    toast.add({ title: 'Utilisateurs non chargés', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    loading.value = false
  }
}

// ---- Export / Import CSV ----
const { exportToCsv, parseCsv, downloadUsersTemplate } = useCsvExport()
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const importing = ref(false)
const importSummary = ref<{ created: number; updated: number; errors: { line: number; email: string; message: string }[] } | null>(null)

// Export de la sélection courante (recherche + filtre rôle), enrichie des
// Colonne sous_region = profiles.region (qui stocke un libellé de sous-région,
// ex. "ABIDJAN 1"). La division (ABIDJAN / UP COUNTRY) est dérivée du
// référentiel et n'est pas réimportée.
function exportUsers() {
  const rows = filteredUsers.value.map((u) => {
    const terrs = (u.territoires_assignes || []).filter(Boolean)
    const matched = terrs
      .map(n => territories.value.find(t => normTerrName(t.name) === normTerrName(n)))
      .filter(Boolean)
    const divs = [...new Set(matched
      .map(t => subRegions.value.find(s => s.code === t!.sub_region_code))
      .filter(Boolean)
      .map(s => regions.value.find(r => r.code === s!.region_code))
      .filter(Boolean)
      .map(r => r!.nom_affichage || r!.name))]
    return {
      email: u.email || '',
      nom: u.nom || '',
      role: u.role || '',
      telephone: u.telephone || '',
      is_active: u.is_active === false ? 'FALSE' : 'TRUE',
      zone_assignee: u.zone_assignee || '',
      territoires_assignes: terrs.join('|'),
      quartiers_assignes: (u.quartiers_assignes || []).filter(Boolean).join('|'),
      commercial: users.value.find(c => c.id === u.commercial_id)?.email || '',
      agence: nomAgenceDe(u.employeur),
      direction: libelleDirection(u.direction, true).replace('—', ''),
      sous_region: u.region || '',
      division: divs.join('|'),
    }
  })
  if (!rows.length) {
    toast.add({ title: 'Aucun utilisateur à exporter', color: 'amber' })
    return
  }
  exportToCsv(rows, `utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`)
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
}

const splitList = (v: string) => (v || '').split('|').map(s => s.trim()).filter(Boolean)

async function importUsers() {
  if (!importFile.value) return
  importing.value = true
  try {
    const text = (await importFile.value.text()).replace(/^\uFEFF/, '')
    const parsed = parseCsv(text)
    if (!parsed.length) throw new Error('Le fichier est vide, ou sa première ligne ne contient pas les en-têtes du modèle.')
    // line = numéro de ligne dans le fichier (1 = en-têtes) ; colonnes
    // export-only (division, sous_region) ignorées côté serveur.
    const rows = parsed.map((r, i) => ({
      line: i + 2,
      email: r.email,
      nom: r.nom,
      role: r.role,
      telephone: r.telephone,
      is_active: r.is_active,
      zone_assignee: r.zone_assignee,
      territoires_assignes: splitList(r.territoires_assignes),
      quartiers_assignes: splitList(r.quartiers_assignes),
      // sous_region (nouvel intitulé) ou region (fichiers antérieurs)
      region: r.sous_region || r.region,
      // e-mail du commercial responsable, résolu en identifiant côté serveur
      commercial: r.commercial,
      mot_de_passe: r.mot_de_passe,
    }))
    const result = await $fetch<{ created: number; updated: number; errors: { line: number; email: string; message: string }[] }>(
      '/api/admin/users/import',
      { method: 'POST', body: { rows } },
    )
    importSummary.value = result
    toast.add({
      title: 'Import terminé',
      description: `${result.created} créé${result.created > 1 ? 's' : ''}, ${result.updated} mis à jour, ${result.errors.length} ligne${result.errors.length > 1 ? 's' : ''} en erreur.`,
      color: result.errors.length ? 'amber' : 'green',
    })
    await fetchUsers()
  } catch (err: any) {
    toast.add({ title: 'Import impossible', description: messageUtilisateur(err), color: 'red' })
  } finally {
    importing.value = false
  }
}

async function handleSaveUser() {
  if (userForm.value.role === 'agence' && (!userForm.value.employeur || userForm.value.employeur === 'friesland')) {
    toast.add({ title: 'Choisissez l\'agence de ce compte', description: 'Un compte agence ne voit que les merchandisers de son agence.', color: 'red' })
    return
  }
  saving.value = true
  try {
    // Dérive territoires (noms) depuis les codes cochés ; zone_assignee = 1er (compat legacy).
    // Un territoire déjà présent sur le profil garde son libellé d'origine
    // (originalTerrNames) pour ne pas casser le scoping exact sur pdv.zone.
    // Libellés hors référentiel rattachés : alias enregistré, territoire réel
    // ajouté au profil à la place du libellé. Les autres restent tels quels.
    const conserves: string[] = []
    const codesRattaches: string[] = []
    for (const nom of unmatchedTerritories.value) {
      const code = rattachements.value[nom]
      if (code) { await enregistrerAlias(nom, code); codesRattaches.push(code) }
      else conserves.push(nom)
    }
    const codes = [...new Set([...userForm.value.territory_codes, ...codesRattaches])]
    const terrs = [
      ...codes
        .map(code => originalTerrNames.value[code] || territories.value.find(t => t.code === code)?.name)
        .filter(Boolean) as string[],
      ...conserves,
    ]
    // Région dérivée du 1er territoire coché (et non du filtre affiché, qui peut
    // pointer une autre sous-région que celle du périmètre réel).
    const firstTerr = territories.value.find(t => t.code === userForm.value.territory_codes[0])
    const sr = subRegions.value.find(s => s.code === (firstTerr?.sub_region_code || userForm.value.sub_region_code))
    const zoneAssignee = terrs[0] || userForm.value.zone_assignee || null
    const region = sr?.nom_affichage || sr?.name || userForm.value.region || null
    const quartiers = (userForm.value.quartiers_assignes || []).filter(Boolean)

    if (editingUser.value) {
      const { error } = await supabase
        .from('profiles')
        .update({
          nom: userForm.value.nom,
          role: userForm.value.role,
          zone_assignee: zoneAssignee,
          territoires_assignes: terrs,
          region,
          quartiers_assignes: quartiers,
          telephone: userForm.value.telephone,
          commercial_id: userForm.value.role === 'merchandiser' ? (userForm.value.commercial_id || null) : null,
          employeur: employeurAEnregistrer(),
          direction: userForm.value.direction || null,
        })
        .eq('id', editingUser.value.id)

      if (error) throw error
      toast.add({ title: 'Utilisateur mis à jour', description: userForm.value.nom || userForm.value.email, color: 'green' })
    }
    else {
      // Compte + profil créés en une passe côté serveur (service_role) : pas de
      // mail de confirmation, donc pas de 429, et le rôle choisi est bien appliqué.
      await authStore.register({
        email: userForm.value.email,
        password: userForm.value.password,
        nom: userForm.value.nom,
        role: userForm.value.role,
        telephone: userForm.value.telephone,
        commercial_id: userForm.value.role === 'merchandiser' ? (userForm.value.commercial_id || null) : null,
        employeur: employeurAEnregistrer(),
        direction: userForm.value.direction || null,
        zone_assignee: zoneAssignee,
        territoires_assignes: terrs,
        quartiers_assignes: quartiers,
        region,
      })
      toast.add({ title: 'Utilisateur créé', description: userForm.value.nom || userForm.value.email, color: 'green' })
    }

    showCreate.value = false
    editingUser.value = null
    fetchUsers()
  }
  catch (err: any) {
    toast.add({ title: editingUser.value ? 'Modifications non enregistrées' : 'Utilisateur non créé', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    saving.value = false
  }
}

/** Active ou désactive le compte ; renvoie vrai si l'enregistrement a réussi. */
async function toggleUserActive(user: Profile): Promise<boolean> {
  const desactiver = !!user.is_active
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: !user.is_active })
    .eq('id', user.id)

  if (error) {
    toast.add({ title: desactiver ? 'Compte non désactivé' : 'Compte non réactivé', description: messageUtilisateur(error), color: 'red' })
    return false
  }
  toast.add({
    title: desactiver ? 'Compte désactivé' : 'Compte réactivé',
    description: desactiver ? `${nomCompte(user)} ne peut plus se connecter.` : `${nomCompte(user)} peut de nouveau se connecter.`,
    color: 'green',
  })
  fetchUsers()
  return true
}

// Supprime le compte auth ET le profil (cascade FK). Supprimer le seul profil
// laissait un compte auth orphelin encore capable de se connecter.
// La confirmation (nommée) est demandée avant l'appel : voir demanderConfirmation.
async function deleteUser(user: Profile): Promise<boolean> {
  try {
    await authStore.deleteUser(user.id)
    toast.add({ title: 'Compte supprimé', description: nomCompte(user), color: 'green' })
    fetchUsers()
    fetchDeletionRequests()
    return true
  }
  catch (err: any) {
    toast.add({ title: 'Compte non supprimé', description: messageUtilisateur(err), color: 'red' })
    return false
  }
}

// ---- Demandes de suppression de compte ----
interface DeletionRequest { id: string; email: string; requested_at: string; reason: string | null }
const deletionRequests = ref<DeletionRequest[]>([])
const deletionRequestById = computed(() => new Map(deletionRequests.value.map(d => [d.id, d])))

async function fetchDeletionRequests() {
  if (!authStore.isAdmin) return
  try {
    deletionRequests.value = await $fetch<DeletionRequest[]>('/api/admin/users/deletion-requests')
  }
  catch {
    deletionRequests.value = []
  }
}

// ---- Réinitialisation du mot de passe ----
// Le mot de passe est appliqué côté serveur (service_role) puis affiché UNE fois
// à l'admin, qui le transmet lui-même : pas de mail, et l'utilisateur devra en
// choisir un nouveau à sa prochaine connexion.
const showResetPassword = ref(false)
const resetTarget = ref<Profile | null>(null)
const resetCustomPassword = ref('')
const resetting = ref(false)
const resetResult = ref<string | null>(null)
const resetCopied = ref(false)

function openResetPassword(user: Profile) {
  resetTarget.value = user
  resetCustomPassword.value = ''
  resetResult.value = null
  resetCopied.value = false
  showResetPassword.value = true
}

function closeResetPassword() {
  showResetPassword.value = false
  resetTarget.value = null
  resetResult.value = null
}

async function confirmResetPassword() {
  if (!resetTarget.value) return
  if (resetCustomPassword.value && resetCustomPassword.value.length < 8) {
    toast.add({ title: 'Mot de passe trop court', description: '8 caractères minimum.', color: 'amber' })
    return
  }
  resetting.value = true
  try {
    resetResult.value = await authStore.resetUserPassword(resetTarget.value.id, resetCustomPassword.value || undefined)
    toast.add({ title: 'Mot de passe réinitialisé', description: `${resetTarget.value.nom || resetTarget.value.email} devra le changer à sa prochaine connexion.`, color: 'green' })
  }
  catch (err: any) {
    toast.add({ title: 'Mot de passe non réinitialisé', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    resetting.value = false
  }
}

async function copyResetPassword() {
  if (!resetResult.value) return
  try {
    await navigator.clipboard.writeText(resetResult.value)
    resetCopied.value = true
    setTimeout(() => { resetCopied.value = false }, 2000)
  }
  catch {
    toast.add({ title: 'Copie impossible', description: 'Sélectionnez le mot de passe et copiez-le manuellement.', color: 'amber' })
  }
}

onMounted(() => {
  fetchUsers()
  chargerAgences()
  fetchReferentiels()
  fetchDeletionRequests()
})
</script>
