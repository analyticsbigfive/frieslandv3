<template>
  <div class="space-y-6">
    <AdminPageHeader>
      <template #description>
        <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Les boutiques d'un jour sont celles du distributeur dans le quartier du point de visite ; s'il en manque, le même distributeur dans le quartier voisin le plus proche.
        </p>
      </template>
      <template #actions>
        <USelect
          v-if="campagnes.length"
          v-model="campagneId"
          :options="campagnes.map(c => ({ value: c.id, label: `${c.libelle}${c.statut === 'fermee' ? ' (fermée)' : ''}` }))"
          size="sm" class="w-56" aria-label="Mois de validation"
        />
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-path" :loading="chargement" @click="charger">Actualiser</UButton>
      </template>
    </AdminPageHeader>

    <AdminErreurBloc v-if="erreur" titre="L'action sur la validation des tournées n'a pas abouti." :erreur="erreur" />

    <!-- Ouvrir un mois -->
    <section class="admin-surface flex flex-wrap items-end gap-3 p-4">
      <div class="space-y-1">
        <label for="mois-nouveau" class="text-sm font-medium text-slate-700 dark:text-slate-200">Ouvrir la validation d'un mois</label>
        <UInput id="mois-nouveau" v-model="moisNouveau" type="month" size="sm" class="w-44" />
      </div>
      <UButton size="sm" color="primary" icon="i-heroicons-plus" :loading="creation" :disabled="!moisNouveau" @click="ouvrirCampagne">
        Ouvrir la validation
      </UButton>
      <p class="text-xs text-slate-600 dark:text-slate-300">
        Un lien personnel est créé pour chaque merchandiser Atom actif. Un mois déjà ouvert ajoute seulement les merchandisers manquants.
      </p>
    </section>

    <template v-if="campagne">
      <!-- Lien public -->
      <section class="admin-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Lien à envoyer aux merchandisers</p>
          <p class="truncate text-sm text-slate-900 dark:text-white">{{ lienPublic }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton size="sm" variant="outline" icon="i-heroicons-clipboard-document" @click="copier(lienPublic, 'Lien copié')">Copier le lien</UButton>
          <UButton size="sm" variant="outline" icon="i-heroicons-chat-bubble-left-right" @click="copier(tousLesLiens, 'Les liens sont copiés')">Copier tous les liens</UButton>
          <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exporterRapportZones">Rapport des zones (CSV)</UButton>
          <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="exporterReponses">Exporter les réponses (CSV)</UButton>
          <UButton v-if="campagne.statut === 'ouverte'" size="sm" variant="ghost" color="gray" @click="basculerCampagne('fermee')">Fermer ce mois</UButton>
          <UButton v-else size="sm" variant="ghost" color="gray" @click="basculerCampagne('ouverte')">Rouvrir ce mois</UButton>
        </div>
      </section>

      <!-- Indicateurs -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div v-for="k in indicateurs" :key="k.libelle" class="admin-surface p-4">
          <p class="text-sm font-medium text-slate-600 dark:text-slate-300">{{ k.libelle }}</p>
          <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ k.valeur }}</p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ k.detail }}</p>
        </div>
      </div>

      <!-- Avancement des retours et application -->
      <section class="admin-surface space-y-4 p-4" aria-labelledby="avancement-titre">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="avancement-titre" class="text-base font-semibold text-slate-900 dark:text-white">Retours des merchandisers</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              <b class="tabular-nums text-slate-900 dark:text-white">{{ avancement.envoyees }} fiche{{ avancement.envoyees > 1 ? 's' : '' }} envoyée{{ avancement.envoyees > 1 ? 's' : '' }} sur {{ avancement.total }}</b>
              · {{ choixRetenus.decides }} choix retenu{{ choixRetenus.decides > 1 ? 's' : '' }} sur {{ choixRetenus.demandes }} correction{{ choixRetenus.demandes > 1 ? 's' : '' }} demandée{{ choixRetenus.demandes > 1 ? 's' : '' }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" variant="outline" icon="i-heroicons-clipboard-document-list" @click="vueEnsemble = true">Vue d'ensemble des retours</UButton>
            <UButton size="sm" variant="outline" icon="i-heroicons-eye" :loading="application === 'apercu'" :disabled="!!application" @click="lancer(true)">Voir l'aperçu</UButton>
            <UButton
              size="sm" color="primary" icon="i-heroicons-check-badge"
              :loading="application === 'appliquer'" :disabled="!!manquantes.length || !!application || !choixRetenus.decides"
              :title="manquantes.length ? `En attente de : ${manquantes.join(', ')}` : ''"
              @click="lancer(false)"
            >
              Appliquer les corrections
            </UButton>
          </div>
        </div>

        <div class="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" :aria-valuenow="avancement.envoyees" aria-valuemin="0" :aria-valuemax="avancement.total" aria-label="Fiches envoyées">
          <div class="h-full rounded-full bg-emerald-600 transition-all" :style="{ width: `${avancement.total ? 100 * avancement.envoyees / avancement.total : 0}%` }" />
        </div>
        <p v-if="manquantes.length" class="text-sm text-amber-800 dark:text-amber-300">
          Le bouton « Appliquer » attend toutes les fiches. En attente de : <b>{{ manquantes.join(', ') }}</b>.
        </p>

        <ul class="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="m in avancement.merchs" :key="m.id" class="space-y-1">
            <div class="flex items-center justify-between gap-2 text-sm">
              <span class="truncate font-medium text-slate-900 dark:text-white">{{ m.nom }}</span>
              <UBadge :color="statut(m.statut).couleur" variant="subtle" size="xs">{{ m.statut === 'validee' ? 'Envoyée' : statut(m.statut).texte }}</UBadge>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" :aria-valuenow="m.pct" aria-valuemin="0" aria-valuemax="100" :aria-label="`Fiche de ${m.nom}`">
              <div class="h-full rounded-full" :class="m.statut === 'validee' ? 'bg-emerald-600' : 'bg-amber-500'" :style="{ width: `${m.pct}%` }" />
            </div>
            <p class="text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ m.joursTraites }}/{{ m.joursTotal }} jours · {{ m.zonesFaites }}/{{ m.zonesTotal }} zones</p>
          </li>
        </ul>

        <div v-if="passages.length" class="border-t border-slate-200 pt-3 dark:border-slate-700">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Corrections déjà appliquées</h3>
          <ul class="mt-1 space-y-1 text-sm">
            <li v-for="p in passages" :key="p.lot" class="flex flex-wrap items-center gap-2">
              <span>Le {{ dateCourte(p.le) }} : {{ p.n }} changement{{ p.n > 1 ? 's' : '' }}</span>
              <UBadge v-if="p.annule" color="gray" variant="subtle" size="xs">Annulé</UBadge>
              <UButton v-else size="xs" variant="ghost" color="gray" :loading="application === 'annuler'" :disabled="!!application" @click="annulerPassage(p)">Annuler cette mise à jour</UButton>
            </li>
          </ul>
        </div>
      </section>

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <AdminValidationQuestions
        class="xl:sticky xl:top-4 xl:order-last"
        :campagne-id="campagne.id"
        :merchandisers="lignes.filter(l => !estTest(l.merchandiserId)).map(l => ({ id: l.merchandiserId, nom: l.nom }))"
      />
      <div class="min-w-0 space-y-6">
      <!-- Tableau des merchandisers -->
      <section class="admin-surface overflow-x-auto">
        <table class="admin-table w-full">
          <thead>
            <tr>
              <th>Merchandiser</th>
              <th>Fiche</th>
              <th class="text-right">Jours traités</th>
              <th class="text-right">Jours à corriger</th>
              <th class="text-right">Boutiques signalées</th>
              <th class="text-right">Zones non couvertes</th>
              <th class="text-right">Visites prévues</th>
              <th>Dernière activité</th>
              <th>Lien personnel</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!lignes.length">
              <td colspan="10" class="py-8 text-center text-slate-600">
                Aucun merchandiser dans ce mois. Ouvrez la validation ci-dessus.
              </td>
            </tr>
            <tr v-for="l in lignes" :key="l.id" :class="selection === l.id ? 'bg-slate-50 dark:bg-slate-800' : ''">
              <td class="font-medium text-slate-900 dark:text-white">{{ l.nom }}</td>
              <td><UBadge :color="statut(l.statut).couleur" variant="subtle" size="xs">{{ statut(l.statut).texte }}</UBadge></td>
              <td class="text-right tabular-nums">{{ l.joursTraites }} / {{ l.joursTotal }}</td>
              <td class="text-right tabular-nums" :class="l.joursACorriger ? 'font-semibold text-amber-700' : ''">{{ l.joursACorriger }}</td>
              <td class="text-right tabular-nums">{{ l.pdvSignales }}</td>
              <td class="text-right tabular-nums" :class="l.zonesNon ? 'font-semibold text-amber-700' : ''">{{ l.zonesNon }}</td>
              <td class="text-right tabular-nums">
                <template v-if="l.plan">
                  <span :class="l.plan.total < l.plan.besoin ? 'font-semibold text-amber-700' : ''">{{ l.plan.total }} / {{ l.plan.besoin }}</span>
                  <span class="block text-xs text-slate-500">{{ l.plan.voisins }} du quartier voisin</span>
                </template>
                <span v-else class="text-slate-400">…</span>
              </td>
              <td class="whitespace-nowrap text-sm">{{ l.derniereActivite ? dateCourte(l.derniereActivite) : '—' }}</td>
              <td>
                <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-link" :aria-label="`Copier le lien de ${l.nom}`" @click="copier(lienPersonnel(l), `Lien de ${l.nom} copié`)">Copier</UButton>
                <UButton size="xs" variant="ghost" color="gray" :aria-label="`Nouveau lien pour ${l.nom}`" @click="nouveauLien(l)">Nouveau</UButton>
              </td>
              <td class="whitespace-nowrap text-right">
                <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-chat-bubble-oval-left" :to="lienWhatsApp(l)" target="_blank" :aria-label="`Envoyer le message à ${l.nom} sur WhatsApp`">WhatsApp</UButton>
                <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-clipboard-document" :aria-label="`Copier le message de ${l.nom}`" @click="copier(message(l), `Message de ${l.nom} copié`)">Copier</UButton>
                <UButton size="xs" variant="ghost" color="gray" :aria-expanded="selection === l.id" @click="selection = selection === l.id ? null : l.id">
                  {{ selection === l.id ? 'Fermer' : 'Détail' }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Détail -->
      <section v-if="detail" class="admin-surface space-y-4 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ detail.nom }}</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              <template v-if="detail.statut === 'validee'">Validée le {{ dateCourte(detail.valideLe) }}, signée « {{ detail.nomSaisi }} ».</template>
              <template v-else>Fiche {{ statut(detail.statut).texte.toLowerCase() }}.</template>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Partie de la fiche">
              <button
                v-for="o in ONGLETS" :key="o.id" type="button" :aria-pressed="onglet === o.id"
                class="rounded px-3 py-1 text-xs font-medium transition-colors"
                :class="onglet === o.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
                @click="onglet = o.id"
              >
                {{ o.texte }}
              </button>
            </div>
            <UButton v-if="detail.statut === 'validee'" size="sm" variant="outline" @click="rouvrirFiche(detail)">Rouvrir la fiche</UButton>
          </div>
        </div>

        <p v-if="detail.remarque" class="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800"><b>Remarque :</b> {{ detail.remarque }}</p>

        <!-- Jours -->
        <div v-if="onglet === 'jours'" class="overflow-x-auto">
          <table class="admin-table w-full">
            <thead>
              <tr><th>Semaine</th><th>Jour</th><th>Point de visite</th><th class="text-right">Boutiques prévues</th><th>Réponse</th><th>Commentaire</th><th>Correction</th><th>Traité</th></tr>
            </thead>
            <tbody>
              <tr v-for="j in detail.jours" :key="j.id">
                <td class="tabular-nums">{{ j.semaine }}</td>
                <td>{{ JOURS[j.jour] }}</td>
                <td class="font-medium text-slate-900 dark:text-white">{{ j.pointVisite }}</td>
                <td class="text-right tabular-nums">
                  {{ j.prevues }}<span v-if="j.voisins" class="block text-xs text-slate-500">dont {{ j.voisins }} du quartier voisin</span>
                </td>
                <td>
                  <UBadge v-if="j.reponse" :color="decision(j.reponse.decision).couleur" variant="subtle" size="xs">{{ decision(j.reponse.decision).texte }}</UBadge>
                  <span v-else class="text-sm text-slate-400">Sans réponse</span>
                </td>
                <td class="max-w-xs text-sm font-medium text-slate-900 dark:text-white">{{ j.reponse?.commentaire || '' }}</td>
                <td class="min-w-[15rem]">
                  <template v-if="j.reponse && j.reponse.decision !== 'ok'">
                    <span v-if="j.reponse.traite" class="text-sm text-slate-600">Appliqué : {{ texteCorrection(j.reponse) }}</span>
                    <template v-else>
                      <USelect
                        size="xs" :model-value="valeurCorrection(j.reponse)" :options="optionsCorrection(detail.merchandiserId, j)"
                        :aria-label="`Correction : ${JOURS[j.jour]} semaine ${j.semaine}`"
                        @update:model-value="v => choisirCorrection(j.reponse, v)"
                      />
                      <button
                        v-if="suggestion(detail.merchandiserId, j)" type="button"
                        class="mt-1 text-left text-xs font-semibold text-fc-red underline-offset-2 hover:underline"
                        @click="choisirCorrection(j.reponse, suggestion(detail.merchandiserId, j)!.value)"
                      >
                        D'après son commentaire : {{ suggestion(detail.merchandiserId, j)!.label }} — retenir
                      </button>
                    </template>
                  </template>
                </td>
                <td>
                  <UCheckbox
                    v-if="j.reponse && j.reponse.decision !== 'ok'"
                    :model-value="j.reponse.traite" :aria-label="`Correction traitée : ${JOURS[j.jour]} semaine ${j.semaine}`"
                    @update:model-value="v => marquerTraite('validation_tournee_reponse', j.reponse.id, v)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Le choix est enregistré tout de suite ; il ne change le routing qu'avec « Appliquer les corrections ».
            Le nouveau point de visite reprend le nom, le GPS et le distributeur d'un autre jour du merchandiser ; le SSF reste celui du jour.
            Un point qui n'est dans aucun de ses jours se crée dans Paramètres › Référentiels, onglet Routing mensuel.
          </p>
        </div>

        <!-- Boutiques signalées -->
        <div v-else-if="onglet === 'pdv'" class="overflow-x-auto">
          <table class="admin-table w-full">
            <thead><tr><th>Boutique</th><th>Point de visite</th><th>Signalement</th><th>Commentaire</th><th>Correction</th><th>Traité</th></tr></thead>
            <tbody>
              <tr v-if="!detail.retours.length"><td colspan="6" class="py-6 text-center text-slate-600">Aucune boutique signalée.</td></tr>
              <tr v-for="r in detail.retours" :key="r.id">
                <td class="font-medium text-slate-900 dark:text-white">
                  {{ r.nom }}
                  <span v-if="r.doublon" class="block text-xs font-normal text-amber-700">Même nom plusieurs fois à ce point : doublon ?</span>
                </td>
                <td class="text-sm">{{ r.point }}</td>
                <td>{{ MOTIFS[r.motif] }}</td>
                <td class="text-sm">{{ r.commentaire || '' }}</td>
                <td class="min-w-[12rem]">
                  <span v-if="r.traite && r.correction" class="text-sm text-slate-600">Appliqué : {{ texteBoutique(r) }}</span>
                  <USelect
                    v-else-if="r.motif === 'ferme'" size="xs" :model-value="r.correction || ''"
                    :options="[{ value: '', label: 'À décider' }, { value: 'fermer', label: 'Fermer la boutique' }, { value: 'garder', label: 'Ne rien changer' }]"
                    :aria-label="`Correction : ${r.nom}`" @update:model-value="v => choisirBoutique(r, v)"
                  />
                  <span v-else class="text-xs text-slate-500">À voir avec Atom (pas de changement automatique)</span>
                </td>
                <td><UCheckbox :model-value="r.traite" :aria-label="`Signalement traité : ${r.nom}`" @update:model-value="v => marquerTraite('validation_tournee_pdv_retour', r.id, v)" /></td>
              </tr>
            </tbody>
          </table>
          <p v-if="detail.retours.length" class="mt-3 text-sm text-slate-600 dark:text-slate-300">Fermer une boutique la retire aussi des tournées Friesland.</p>
        </div>

        <!-- Zones -->
        <div v-else-if="onglet === 'zones'" class="space-y-4">
          <div class="grid gap-4 lg:grid-cols-2">
            <div v-for="bloc in detail.zones" :key="bloc.titre" class="space-y-2">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">{{ bloc.titre }}</h3>
              <p v-if="!bloc.lignes.length" class="text-sm text-slate-600">Rien d'enregistré.</p>
              <ul class="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                <li v-for="z in bloc.lignes" :key="z.libelle" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>{{ z.libelle }}</span>
                  <UBadge :color="z.decision === 'non' ? 'amber' : z.decision === 'oui' ? 'green' : 'gray'" variant="subtle" size="xs">
                    {{ z.decision === 'non' ? 'Ne couvre pas' : z.decision === 'oui' ? 'Couvre' : 'Sans réponse' }}
                  </UBadge>
                </li>
              </ul>
            </div>
          </div>
          <div class="space-y-2">
            <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Ce qu'il propose de changer</h3>
            <p v-if="!detail.ecarts.length" class="text-sm text-slate-600">
              {{ detail.aPropose ? 'Sa proposition correspond à ce qui est enregistré.' : 'Aucune proposition : il n\'a pas corrigé ses zones.' }}
            </p>
            <table v-else class="admin-table w-full">
              <thead><tr><th>Type</th><th>Zone</th><th>Changement</th></tr></thead>
              <tbody>
                <tr v-for="e in detail.ecarts" :key="`${e.type}-${e.libelle}-${e.action}`">
                  <td>{{ e.type }}</td>
                  <td class="font-medium text-slate-900 dark:text-white">{{ e.libelle }}</td>
                  <td><UBadge :color="e.action === 'Ajouter' ? 'green' : 'amber'" variant="subtle" size="xs">{{ e.action }}</UBadge></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="detail.zonesRemarque" class="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <b>Ce qu'il écrit sur ses zones :</b> {{ detail.zonesRemarque }}
          </p>

          <!-- Zones retenues pour son profil -->
          <div v-if="zonesEdition" class="space-y-3 rounded-md border border-slate-200 p-4 dark:border-slate-700">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Zones à garder dans son profil</h3>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                <template v-if="detail.zonesAppliqueesLe">Appliquées le {{ dateCourte(detail.zonesAppliqueesLe) }}.</template>
                <template v-else-if="detail.zonesRetenues">Retenues, appliquées avec le bouton « Appliquer les corrections ».</template>
                <template v-else>Rien de retenu : son profil ne changera pas.</template>
              </p>
            </div>
            <p v-if="detail.territoiresRouting.length" class="text-sm text-slate-700 dark:text-slate-200">
              D'après les quartiers de son routing (référentiel Friesland) :
              <b>{{ detail.territoiresRouting.map(t => `${t.nom} (${t.jours} jour${t.jours > 1 ? 's' : ''})`).join(', ') }}</b>.
              <span class="block text-xs text-slate-500">Les numéros des secteurs Atom ne suivent pas ceux des territoires Friesland (ex. Yopougon).</span>
            </p>
            <p v-if="zonesEdition.alerte && !detail.zonesRetenues" class="rounded-md bg-amber-50 p-2 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="status">{{ zonesEdition.alerte }}</p>
            <fieldset>
              <legend class="text-xs font-semibold text-slate-700 dark:text-slate-200">Territoires Friesland</legend>
              <div class="mt-1 flex flex-wrap gap-2">
                <button
                  v-for="t in zonesEdition.choixTerritoires" :key="t" type="button" :aria-pressed="zonesEdition.territoires.includes(t)"
                  class="rounded-full px-3 py-1 text-sm font-semibold ring-1 transition"
                  :class="zonesEdition.territoires.includes(t) ? 'bg-emerald-50 text-emerald-800 ring-emerald-400' : 'bg-white text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300'"
                  :disabled="!!detail.zonesAppliqueesLe"
                  @click="basculerListe('territoires', t)"
                >
                  {{ t }}
                </button>
              </div>
            </fieldset>
            <div class="flex flex-wrap items-center gap-2">
              <label :for="`zone-principale-${detail.id}`" class="text-xs font-semibold text-slate-700 dark:text-slate-200">Zone principale</label>
              <USelect :id="`zone-principale-${detail.id}`" v-model="zonesEdition.zone_assignee" :options="zonesEdition.territoires" size="xs" class="w-48" :disabled="!!detail.zonesAppliqueesLe" />
            </div>
            <details>
              <summary class="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">
                Quartiers : {{ zonesEdition.quartiers.length }} gardés sur {{ zonesEdition.choixQuartiers.length }}
              </summary>
              <div class="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                <label v-for="q in zonesEdition.choixQuartiers" :key="q" class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" class="h-4 w-4 rounded border-slate-300" :checked="zonesEdition.quartiers.includes(q)" :disabled="!!detail.zonesAppliqueesLe" @change="basculerListe('quartiers', q)">
                  <span>{{ q }}</span>
                </label>
              </div>
            </details>
            <div v-if="!detail.zonesAppliqueesLe" class="flex flex-wrap gap-2">
              <UButton size="xs" color="primary" :disabled="!zonesEdition.territoires.length" @click="retenirZones(detail)">Retenir ces zones</UButton>
              <UButton v-if="detail.zonesRetenues" size="xs" variant="ghost" color="gray" @click="retenirZones(detail, true)">Ne rien changer à son profil</UButton>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300">
              Proposé d'office : ce qu'il a coché s'il a modifié la liste pré-cochée, sinon son profil moins les territoires où il a répondu « non » ;
              un territoire où passe son routing reste coché. Aucun quartier n'est retiré d'office (ils décident des PDV qu'il voit). Le secteur Atom ne change pas.
            </p>
          </div>
        </div>

        <!-- Message -->
        <div v-else-if="onglet === 'message'" class="space-y-2">
          <UTextarea :model-value="message(detail)" :rows="12" readonly aria-label="Message à envoyer" />
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" color="primary" icon="i-heroicons-chat-bubble-oval-left" :to="lienWhatsApp(detail)" target="_blank">Envoyer sur WhatsApp</UButton>
            <UButton size="sm" variant="outline" icon="i-heroicons-clipboard-document" @click="copier(message(detail), 'Message copié')">Copier le message</UButton>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300">
            {{ detail.telephone ? `WhatsApp s'ouvre sur le ${detail.telephone}.` : 'Pas de téléphone enregistré : WhatsApp vous demandera à qui envoyer.' }}
          </p>
        </div>
      </section>

      <!-- Boutiques hors tournée -->
      <section class="admin-surface space-y-3 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">Boutiques Atom hors tournée</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">Ces boutiques n'entrent dans aucun jour : à corriger dans la fiche du point de vente ou avec Atom.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Raison">
              <button
                v-for="r in RAISONS" :key="r.id" type="button" :aria-pressed="raison === r.id"
                class="rounded px-3 py-1 text-xs font-medium transition-colors"
                :class="raison === r.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
                @click="raison = r.id"
              >
                {{ r.texte }} ({{ horsTournee.filter(x => x.raison === r.id).length }})
              </button>
            </div>
            <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!horsTournee.length" @click="exporterHorsTournee">Exporter (CSV)</UButton>
          </div>
        </div>
        <p v-if="chargementHors" class="text-sm text-slate-600" role="status">Chargement des boutiques hors tournée…</p>
        <div v-else class="overflow-x-auto">
          <table class="admin-table w-full">
            <thead><tr><th>Boutique</th><th>Distributeur</th><th>Quartier le plus proche</th><th class="text-right">Distance au point</th></tr></thead>
            <tbody>
              <tr v-if="!horsFiltre.length"><td colspan="4" class="py-6 text-center text-slate-600">Aucune boutique dans ce cas.</td></tr>
              <tr v-for="b in horsFiltre.slice(0, 100)" :key="b.pdv_id">
                <td class="font-medium text-slate-900 dark:text-white">{{ b.nom_pdv }}</td>
                <td>{{ b.distributeur || 'Inconnu' }}</td>
                <td>{{ b.point_visite ? `${b.point_visite} (${b.merchandiser})` : '—' }}</td>
                <td class="text-right tabular-nums">{{ b.distance_point_m != null ? `${b.distance_point_m} m` : '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="horsFiltre.length > 100" class="mt-2 text-xs text-slate-600">100 premières sur {{ horsFiltre.length }} : la liste complète est dans l'export.</p>
        </div>
      </section>

      <section class="admin-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <p class="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Les quartiers sont recalculés tout seuls quand le routing ou la position d'une boutique change.
          Relancez le calcul après un import fait en dehors de l'app.
        </p>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-path" :loading="recalcul" @click="recalculer">Recalculer les quartiers</UButton>
      </section>
      </div>
      </div>
    </template>

    <AdminValidationVueEnsemble v-model="vueEnsemble" :fiches="fichesVueEnsemble" :mois="campagne?.libelle || ''" />
    <AdminValidationApercu v-model="apercuOuvert" :resultat="apercu" />
    <AdminConfirmation v-bind="confirmation" @confirmer="confirmer" @annuler="annuler" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const toast = useToast()
const { confirmation, demanderConfirmation, confirmer, annuler } = useConfirmation()

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MOTIFS: Record<string, string> = { pas_ma_tournee: 'Pas dans sa tournée', position_fausse: 'Position fausse', ferme: 'Fermé' }
const ONGLETS = [
  { id: 'jours', texte: 'Jours' },
  { id: 'pdv', texte: 'Boutiques signalées' },
  { id: 'zones', texte: 'Zones et secteurs' },
  { id: 'message', texte: 'Message' },
]

const RAISONS = [
  { id: 'autre_distributeur', texte: 'Autre distributeur' },
  { id: 'sans_distributeur', texte: 'Sans distributeur' },
  { id: 'sans_gps', texte: 'Sans GPS' },
]
const horsTournee = ref<any[]>([])
const chargementHors = ref(false)
const raison = ref('autre_distributeur')
const horsFiltre = computed(() => horsTournee.value.filter(x => x.raison === raison.value))
const chargement = ref(false)
const creation = ref(false)
const recalcul = ref(false)
const erreur = ref('')
const campagnes = ref<any[]>([])
const campagneId = ref<string>('')
const fiches = ref<any[]>([])
const reponses = ref<any[]>([])
const retours = ref<any[]>([])
const zones = ref<any[]>([])
const routing = ref<any[]>([])
const profils = ref<any[]>([])
const plans = ref<Record<string, any[]>>({})
const territoires = ref<{ code: string; nom: string; sous_region_code?: string; zone?: { quartier: { nom: string }[] }[] }[]>([])
const applications = ref<{ lot: string; applique_le: string; annule_le: string | null }[]>([])
const selection = ref<string | null>(null)
const onglet = ref('jours')
const moisNouveau = ref(prochainMois())

function prochainMois() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const libelleMois = (mois: string) => {
  const t = new Date(`${mois.slice(0, 7)}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const dateCourte = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const statut = (s: string) => s === 'validee' ? { texte: 'Validée', couleur: 'green' } : s === 'en_cours' ? { texte: 'En cours', couleur: 'amber' } : { texte: 'À faire', couleur: 'gray' }
const decision = (d: string) => d === 'ok' ? { texte: 'OK', couleur: 'green' } : d === 'modifier' ? { texte: 'À modifier', couleur: 'amber' } : { texte: 'À retirer', couleur: 'red' }
const nouveauCodeAleatoire = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0')

const campagne = computed(() => campagnes.value.find(c => c.id === campagneId.value) || null)
const lienPublic = computed(() => (import.meta.client ? window.location.origin : '') + '/validation-tournee')

async function chargerCampagnes() {
  const { data, error } = await supabase.from('validation_tournee_campagne').select('id, mois, libelle, statut').order('mois', { ascending: false })
  if (error) throw error
  campagnes.value = data || []
  if (!campagneId.value || !campagnes.value.some(c => c.id === campagneId.value)) campagneId.value = campagnes.value[0]?.id || ''
}

// avecPlans = false : rafraîchissement léger (toutes les minutes), sans refaire les plans du mois.
async function charger(avecPlans = true) {
  chargement.value = true
  erreur.value = ''
  try {
    await chargerCampagnes()
    if (!campagneId.value) { fiches.value = []; return }
    const { data: f, error } = await supabase.from('validation_tournee_merch')
      .select('id, merchandiser_id, code, lien_jeton, statut, nom_saisi, remarque, zones_remarque, zones_proposees, zones_retenues, zones_appliquees_le, valide_le, derniere_activite')
      .eq('campagne_id', campagneId.value)
    if (error) throw error
    fiches.value = f || []
    const ids = fiches.value.map(x => x.id)
    const merchs = fiches.value.map(x => x.merchandiser_id)
    const vide = ['00000000-0000-0000-0000-000000000000']
    const [r, p, z, rm, pr, te, ap] = await Promise.all([
      supabase.from('validation_tournee_reponse').select('id, validation_merch_id, routing_mensuel_id, decision, commentaire, traite, correction').in('validation_merch_id', ids.length ? ids : vide),
      supabase.from('validation_tournee_pdv_retour').select('id, validation_merch_id, pdv_id, routing_mensuel_id, motif, commentaire, traite, correction, pdv:pdv(nom_pdv)').in('validation_merch_id', ids.length ? ids : vide),
      supabase.from('validation_tournee_zone').select('validation_merch_id, type, libelle, decision').in('validation_merch_id', ids.length ? ids : vide),
      supabase.from('routing_mensuel').select('id, merchandiser_id, jour_semaine, semaine_du_mois, point_visite, secteur, quartiers').eq('actif', true).in('merchandiser_id', merchs.length ? merchs : vide).order('semaine_du_mois').order('jour_semaine'),
      supabase.from('profiles').select('id, nom, email, telephone, zone_assignee, territoires_assignes, quartiers_assignes').in('id', merchs.length ? merchs : vide),
      supabase.from('territoire').select('code, nom, sous_region_code, zone(quartier(nom))'),
      (supabase.from('validation_tournee_application') as any).select('lot, applique_le, annule_le').eq('campagne_id', campagneId.value).order('applique_le', { ascending: false }),
    ])
    for (const x of [r, p, z, rm, pr, te, ap]) if (x.error) throw x.error
    territoires.value = te.data || []
    reponses.value = r.data || []
    retours.value = p.data || []
    zones.value = z.data || []
    routing.value = rm.data || []
    profils.value = pr.data || []
    applications.value = ap.data || []
    if (avecPlans) chargerPlans(merchs)
  }
  catch (e) { erreur.value = messageUtilisateur(e) }
  finally { chargement.value = false }
}

// Plan du mois (règle des quartiers) : un appel par merchandiser, en tâche de fond.
async function chargerPlans(merchs: string[]) {
  plans.value = {}
  for (const m of merchs) {
    const { data, error } = await supabase.rpc('plan_mensuel_atom', { p_user: m })
    if (!error) plans.value = { ...plans.value, [m]: data || [] }
  }
}

const besoinMois = (merch: string) => routing.value.filter(l => l.merchandiser_id === merch)
  .reduce((s, l) => s + ({ 1: 20, 2: 20, 3: 20, 4: 20, 5: 15, 6: 10 } as Record<number, number>)[l.jour_semaine] || 0, 0)

const lignes = computed(() => fiches.value.map((f) => {
  const prof = profils.value.find(p => p.id === f.merchandiser_id)
  const jours = routing.value.filter(l => l.merchandiser_id === f.merchandiser_id)
  const rep = reponses.value.filter(x => x.validation_merch_id === f.id)
  const plan = plans.value[f.merchandiser_id]
  return {
    id: f.id,
    merchandiserId: f.merchandiser_id,
    nom: prof?.nom || '—',
    code: f.code,
    lien: f.lien_jeton,
    telephone: prof?.telephone || '',
    statut: f.statut,
    derniereActivite: f.derniere_activite,
    joursTotal: jours.length,
    joursTraites: rep.length,
    joursACorriger: rep.filter(x => x.decision !== 'ok').length,
    pdvSignales: retours.value.filter(x => x.validation_merch_id === f.id).length,
    zonesNon: zones.value.filter(x => x.validation_merch_id === f.id && x.decision === 'non').length,
    plan: plan ? { total: plan.length, besoin: besoinMois(f.merchandiser_id), voisins: plan.filter((x: any) => x.quartier_voisin).length } : null,
  }
}).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))

const indicateurs = computed(() => {
  const n = (s: string) => lignes.value.filter(l => l.statut === s).length
  return [
    { libelle: 'Fiches validées', valeur: n('validee'), detail: `sur ${lignes.value.length} merchandisers` },
    { libelle: 'En cours', valeur: n('en_cours'), detail: 'ont commencé sans valider' },
    { libelle: 'À faire', valeur: n('a_faire'), detail: 'pas encore ouvert le lien' },
    { libelle: 'Corrections demandées', valeur: lignes.value.reduce((s, l) => s + l.joursACorriger, 0), detail: `${lignes.value.reduce((s, l) => s + l.pdvSignales, 0)} boutiques signalées` },
  ]
})

const detail = computed(() => {
  const f = fiches.value.find(x => x.id === selection.value)
  if (!f) return null
  const prof = profils.value.find(p => p.id === f.merchandiser_id) || {}
  const plan = plans.value[f.merchandiser_id] || []
  const rep = reponses.value.filter(x => x.validation_merch_id === f.id)
  const zs = zones.value.filter(x => x.validation_merch_id === f.id)
  const reponseZone = (type: string, libelle: string) => zs.find(z => z.type === type && z.libelle === libelle)?.decision || null
  const uniques = (l: any[]) => [...new Map(l.filter(Boolean).map((x: string) => [x.toUpperCase(), x])).values()]
  const lignesRouting = routing.value.filter(l => l.merchandiser_id === f.merchandiser_id)
  const retoursMerch = retours.value.filter(x => x.validation_merch_id === f.id)
  const memeNomMemePoint = (x: any) => retoursMerch.filter(y => y.routing_mensuel_id === x.routing_mensuel_id
    && cleZone(y.pdv?.nom_pdv) === cleZone(x.pdv?.nom_pdv)).length > 1
  return {
    id: f.id,
    merchandiserId: f.merchandiser_id,
    nom: (prof as any).nom || '—',
    code: f.code,
    lien: f.lien_jeton,
    telephone: (prof as any).telephone || '',
    statut: f.statut,
    zonesRetenues: f.zones_retenues,
    zonesAppliqueesLe: f.zones_appliquees_le,
    territoiresRouting: territoiresDuRouting(f.merchandiser_id),
    valideLe: f.valide_le,
    nomSaisi: f.nom_saisi,
    remarque: f.remarque,
    zonesRemarque: f.zones_remarque,
    aPropose: !!f.zones_proposees,
    ecarts: ecartsZones(f),
    jours: lignesRouting.map(l => ({
      id: l.id, semaine: l.semaine_du_mois, jour: l.jour_semaine, pointVisite: l.point_visite,
      prevues: plan.filter((x: any) => x.ligne_id === l.id).length,
      voisins: plan.filter((x: any) => x.ligne_id === l.id && x.quartier_voisin).length,
      reponse: rep.find(x => x.routing_mensuel_id === l.id) || null,
    })),
    retours: retoursMerch.map(x => ({
      ...x,
      nom: x.pdv?.nom_pdv || 'Boutique',
      point: routing.value.find(l => l.id === x.routing_mensuel_id)?.point_visite || '',
      doublon: memeNomMemePoint(x),
    })),
    zones: [
      { titre: 'Secteur Atom', lignes: uniques(lignesRouting.map(l => l.secteur)).map(s => ({ libelle: s, decision: reponseZone('secteur_atom', s) })) },
      { titre: 'Territoires Friesland', lignes: uniques([(prof as any).zone_assignee, ...((prof as any).territoires_assignes || [])]).map(t => ({ libelle: t, decision: reponseZone('territoire_friesland', t) })) },
    ],
  }
})

const lienPersonnel = (l: { lien?: string }) => `${lienPublic.value}?t=${l.lien || ''}`

function message(l: { nom: string; lien?: string }) {
  return `Validation de votre tournée de ${campagne.value?.libelle || ''} : touchez votre lien personnel.\n${lienPersonnel(l)}`
}

// WhatsApp : le numéro du compte s'il est connu (format international sans +),
// sinon WhatsApp demande à qui envoyer.
function lienWhatsApp(l: { nom: string; lien?: string; telephone?: string }) {
  const numero = String(l.telephone || '').replace(/\D/g, '')
  return `https://wa.me/${numero}?text=${encodeURIComponent(message(l))}`
}
// Un seul message pour le groupe : le nom de chacun et son lien.
const tousLesLiens = computed(() => [
  `Validation de votre tournée de ${campagne.value?.libelle || ''} : touchez le lien à votre nom.`,
  ...lignes.value.map(l => `${l.nom}\n${lienPersonnel(l)}`),
].join('\n\n'))

// --- Zones : enregistré aujourd'hui / proposé par le merchandiser -----------
const cleZone = (s: string) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim()
function ecartsZones(f: any) {
  const prop = f.zones_proposees
  if (!prop) return []
  const prof: any = profils.value.find(p => p.id === f.merchandiser_id) || {}
  const nomTerr = (code: string) => territoires.value.find(t => t.code === code)?.nom || code
  const codeTerr = (nom: string) => territoires.value.find(t => cleZone(t.nom) === cleZone(nom))?.code || nom
  const actuels = {
    'Secteur Atom': routing.value.filter(l => l.merchandiser_id === f.merchandiser_id).map(l => l.secteur).filter(Boolean),
    Territoire: [prof.zone_assignee, ...(prof.territoires_assignes || [])].filter(Boolean).map(codeTerr),
    Quartier: prof.quartiers_assignes || [],
  } as Record<string, string[]>
  const proposes = { 'Secteur Atom': prop.secteursAtom || [], Territoire: prop.territoires || [], Quartier: prop.quartiers || [] } as Record<string, string[]>
  const out: { type: string; libelle: string; action: string }[] = []
  for (const type of Object.keys(proposes)) {
    const a = new Set(actuels[type].map(cleZone))
    const p = new Set(proposes[type].map(cleZone))
    const libelle = (x: string) => type === 'Territoire' ? nomTerr(x) : x
    for (const x of [...new Set(proposes[type])]) if (!a.has(cleZone(x))) out.push({ type, libelle: libelle(x), action: 'Ajouter' })
    for (const x of [...new Set(actuels[type])]) if (!p.has(cleZone(x))) out.push({ type, libelle: libelle(x), action: 'Retirer' })
  }
  return out
}

function exporterRapportZones() {
  const lignesCsv: any[][] = []
  for (const f of fiches.value) {
    const nom = profils.value.find(p => p.id === f.merchandiser_id)?.nom || ''
    for (const e of ecartsZones(f)) lignesCsv.push([nom, e.type, e.libelle, e.action, f.zones_remarque || ''])
    if (!f.zones_proposees && f.zones_remarque) lignesCsv.push([nom, '', '', '', f.zones_remarque])
  }
  telechargerCsv(`rapport-zones-${campagne.value?.mois?.slice(0, 7) || 'mois'}.csv`,
    ['Merchandiser', 'Type', 'Zone', 'Changement', 'Remarque du merchandiser'], lignesCsv)
}

// --- Avancement des retours (hors comptes de test) --------------------------
const estTest = (merch: string) => /@friesland-test\.ci$/i.test(profils.value.find(p => p.id === merch)?.email || '')
function zonesAttendues(f: any) {
  const prof: any = profils.value.find(p => p.id === f.merchandiser_id) || {}
  const secteurs = routing.value.filter(l => l.merchandiser_id === f.merchandiser_id).map(l => l.secteur)
  const terr = [prof.zone_assignee, ...(prof.territoires_assignes || [])]
  return new Set([...secteurs.map(s => `secteur_atom|${cleZone(s)}`), ...terr.map(t => `territoire_friesland|${cleZone(t)}`)]
    .filter(k => !k.endsWith('|')))
}
const avancement = computed(() => {
  const merchs = lignes.value.filter(l => !estTest(l.merchandiserId)).map((l) => {
    const f = fiches.value.find(x => x.id === l.id)
    const attendues = zonesAttendues(f)
    const repondues = new Set(zones.value.filter(z => z.validation_merch_id === l.id).map(z => `${z.type}|${cleZone(z.libelle)}`))
    const zonesFaites = [...attendues].filter(k => repondues.has(k)).length
    const total = l.joursTotal + attendues.size
    const pct = l.statut === 'validee' ? 100 : total ? Math.round(100 * (l.joursTraites + zonesFaites) / total) : 0
    return { ...l, zonesFaites, zonesTotal: attendues.size, pct }
  })
  return { merchs, envoyees: merchs.filter(m => m.statut === 'validee').length, total: merchs.length }
})
const manquantes = computed(() => avancement.value.merchs.filter(m => m.statut !== 'validee').map(m => m.nom))

// --- Choix de correction pour chaque retour ---------------------------------
const nomJour = (l: any) => `semaine ${l.semaine_du_mois}, ${JOURS[l.jour_semaine].toLowerCase()}`
// Un point de visite par nom : ceux des autres jours du même merchandiser.
function pointsDuMerch(merch: string, sauf: string) {
  const vus = new Map<string, any>()
  for (const l of routing.value.filter(x => x.merchandiser_id === merch && x.id !== sauf)) {
    const k = cleZone(l.point_visite)
    if (!vus.has(k)) vus.set(k, l)
  }
  return [...vus.values()]
}
function optionsCorrection(merch: string, j: { id: string; reponse: any }) {
  const points = pointsDuMerch(merch, j.id).filter(l => cleZone(l.point_visite) !== cleZone(routing.value.find(x => x.id === j.id)?.point_visite))
  return [
    { value: '', label: 'À décider' },
    { value: 'garder', label: 'Ne rien changer' },
    ...(j.reponse.decision === 'retirer' ? [{ value: 'vider', label: 'Laisser le jour sans visite' }] : []),
    ...points.map(l => ({ value: `remplacer:${l.id}`, label: `${l.point_visite} (comme ${nomJour(l)})` })),
  ]
}
const valeurCorrection = (rep: any) => !rep?.correction ? '' : rep.correction.action === 'remplacer' ? `remplacer:${rep.correction.source_ligne_id}` : rep.correction.action
function texteCorrection(rep: any) {
  const c = rep?.correction
  if (!c) return 'à décider'
  if (c.action === 'garder') return 'rien à changer'
  if (c.action === 'vider') return 'jour laissé sans visite'
  return `remplacé par ${routing.value.find(l => l.id === c.source_ligne_id)?.point_visite || '?'}`
}
// Point cité dans le commentaire (« Faya », « Cité sir… ») : proposé, jamais retenu sans l'admin.
function suggestion(merch: string, j: { id: string; reponse: any }) {
  if (!j.reponse?.commentaire || j.reponse.correction) return null
  const mots = cleZone(j.reponse.commentaire).split(' ')
  let meilleur: any = null
  let score = 0
  for (const l of pointsDuMerch(merch, j.id)) {
    const morceaux = cleZone(l.point_visite).split(' ').filter(m => m.length >= 3 && !/^\d+$/.test(m))
    const s = morceaux.filter(m => mots.includes(m)).length + (morceaux[0] && mots[0] === morceaux[0] ? 1 : 0)
    if (s > score) { score = s; meilleur = l }
  }
  return meilleur ? { value: `remplacer:${meilleur.id}`, label: meilleur.point_visite } : null
}
async function choisirCorrection(rep: any, valeur: string) {
  const correction = !valeur ? null : valeur.startsWith('remplacer:')
    ? { action: 'remplacer', source_ligne_id: valeur.slice(10) }
    : { action: valeur }
  const { error } = await (supabase.from('validation_tournee_reponse') as any).update({ correction }).eq('id', rep.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  reponses.value = reponses.value.map(x => x.id === rep.id ? { ...x, correction } : x)
}
async function choisirBoutique(r: any, valeur: string) {
  const correction = valeur || null
  const { error } = await (supabase.from('validation_tournee_pdv_retour') as any).update({ correction }).eq('id', r.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  retours.value = retours.value.map(x => x.id === r.id ? { ...x, correction } : x)
}
const texteBoutique = (r: any) => r.motif !== 'ferme' ? 'à voir avec Atom' : r.correction === 'fermer' ? 'boutique fermée' : r.correction === 'garder' ? 'rien à changer' : 'à décider'
const choixRetenus = computed(() => {
  const envoyees = new Set(fiches.value.filter(f => f.statut === 'validee').map(f => f.id))
  const jours = reponses.value.filter(r => envoyees.has(r.validation_merch_id) && r.decision !== 'ok' && !r.traite)
  const boutiques = retours.value.filter(r => envoyees.has(r.validation_merch_id) && r.motif === 'ferme' && !r.traite)
  return { demandes: jours.length + boutiques.length, decides: jours.filter(r => r.correction).length + boutiques.filter(r => r.correction).length }
})

// --- Zones retenues pour le profil -------------------------------------------
const nomTerritoire = (codeOuNom: string) => territoires.value.find(t => t.code === codeOuNom || cleZone(t.nom) === cleZone(codeOuNom))?.nom || codeOuNom
const sansDoublon = (l: string[]) => [...new Map(l.filter(Boolean).map(x => [cleZone(x), x])).values()]
// Territoires d'Abidjan où tombent les quartiers de son routing (référentiel
// Friesland). Au moins 2 jours : un même nom de quartier existe dans d'autres villes.
const SOUS_REGIONS_ABIDJAN = ['SOUTH1', 'SOUTH2']
// Un nom de quartier présent dans plusieurs territoires (Sicogi, Zone industrielle…) ne compte pas.
const territoireDuQuartier = computed(() => {
  const parQuartier = new Map<string, Set<string>>()
  for (const t of territoires.value.filter(x => SOUS_REGIONS_ABIDJAN.includes(x.sous_region_code || ''))) {
    for (const z of t.zone || []) for (const q of z.quartier || []) {
      const k = cleZone(q.nom)
      parQuartier.set(k, (parQuartier.get(k) || new Set()).add(t.nom))
    }
  }
  return new Map([...parQuartier].filter(([, ts]) => ts.size === 1).map(([k, ts]) => [k, [...ts][0]]))
})
function territoiresDuRouting(merch: string) {
  const compte = new Map<string, number>()
  for (const l of routing.value.filter(x => x.merchandiser_id === merch)) {
    const ts = new Set((l.quartiers || []).map((q: string) => territoireDuQuartier.value.get(cleZone(q))).filter(Boolean) as string[])
    for (const t of ts) compte.set(t, (compte.get(t) || 0) + 1)
  }
  return [...compte.entries()].filter(([, jours]) => jours >= 2).sort((a, b) => b[1] - a[1]).map(([nom, jours]) => ({ nom, jours }))
}
// Ce qu'il a coché s'il a touché à la liste pré-cochée ; sinon ses « oui / non ».
function propositionZones(f: any) {
  const prof: any = profils.value.find(p => p.id === f.merchandiser_id) || {}
  const actuels = sansDoublon([prof.zone_assignee, ...(prof.territoires_assignes || [])].map(nomTerritoire))
  const quartiersActuels: string[] = prof.quartiers_assignes || []
  const prop = f.zones_proposees
  const meme = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.map(cleZone).includes(cleZone(x)))
  const aModifie = !!prop && (!meme(sansDoublon((prop.territoires || []).map(nomTerritoire)), actuels) || !meme(prop.quartiers || [], quartiersActuels))
  const non = new Set(zones.value.filter(z => z.validation_merch_id === f.id && z.type === 'territoire_friesland' && z.decision === 'non').map(z => cleZone(z.libelle)))
  const reponse = aModifie ? sansDoublon((prop.territoires || []).map(nomTerritoire)) : actuels.filter(t => !non.has(cleZone(t)))
  // Sa réponse retire un territoire où tombe son routing : on le garde coché et on prévient.
  const duRouting = territoiresDuRouting(f.merchandiser_id).map(t => t.nom)
  const oublies = duRouting.filter(t => !reponse.map(cleZone).includes(cleZone(t)))
  const terr = sansDoublon([...reponse, ...oublies])
  return {
    aModifie,
    alerte: oublies.length
      ? `Son routing passe aussi par ${oublies.join(', ')}, que sa réponse ne garde pas. Laissé coché : à confirmer avec lui.`
      : '',
    territoires: terr,
    // On ne retire jamais un quartier d'office : ils filtrent les PDV qu'il voit.
    quartiers: sansDoublon([...quartiersActuels, ...(aModifie ? prop.quartiers || [] : [])]),
    zone_assignee: terr.find(t => cleZone(t) === cleZone(prof.zone_assignee)) || terr[0] || '',
    choixTerritoires: sansDoublon([...actuels, ...(prop?.territoires || []).map(nomTerritoire), ...duRouting]),
    choixQuartiers: sansDoublon([...quartiersActuels, ...(prop?.quartiers || [])]).sort((a, b) => a.localeCompare(b, 'fr')),
  }
}
const zonesEdition = ref<{ alerte: string; territoires: string[]; quartiers: string[]; zone_assignee: string; choixTerritoires: string[]; choixQuartiers: string[] } | null>(null)
// Refait seulement si la fiche choisie ou ses zones retenues changent : le
// rafraîchissement de chaque minute ne doit pas effacer ce que l'admin coche.
watch(() => {
  const f = fiches.value.find(x => x.id === selection.value)
  return f ? `${f.id}|${JSON.stringify(f.zones_retenues ?? null)}` : ''
}, () => {
  const f = fiches.value.find(x => x.id === selection.value)
  if (!f) { zonesEdition.value = null; return }
  const p = propositionZones(f)
  const r = f.zones_retenues
  zonesEdition.value = r
    ? { ...p, territoires: r.territoires || p.territoires, quartiers: r.quartiers || p.quartiers, zone_assignee: r.zone_assignee || p.zone_assignee }
    : p
})
function basculerListe(liste: 'territoires' | 'quartiers', valeur: string) {
  if (!zonesEdition.value) return
  const l = zonesEdition.value[liste]
  zonesEdition.value[liste] = l.includes(valeur) ? l.filter(x => x !== valeur) : [...l, valeur]
}
async function retenirZones(d: { id: string }, effacer = false) {
  const z = zonesEdition.value
  const zones_retenues = effacer || !z ? null : { zone_assignee: z.zone_assignee, territoires: z.territoires, quartiers: z.quartiers }
  const { error } = await (supabase.from('validation_tournee_merch') as any).update({ zones_retenues }).eq('id', d.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  fiches.value = fiches.value.map(x => x.id === d.id ? { ...x, zones_retenues } : x)
  toast.add({ title: effacer ? 'Zones : rien ne sera changé' : 'Zones retenues', color: 'green' })
}

// --- Vue d'ensemble ------------------------------------------------------------
const vueEnsemble = ref(false)
const fichesVueEnsemble = computed(() => lignes.value.filter(l => !estTest(l.merchandiserId)).map((l) => {
  const f = fiches.value.find(x => x.id === l.id)
  const zs = zones.value.filter(z => z.validation_merch_id === l.id && z.type !== 'quartier_friesland')
  const prop = propositionZones(f)
  const r = f.zones_retenues
  return {
    id: l.id,
    nom: l.nom,
    statut: l.statut,
    statutTexte: statut(l.statut).texte,
    joursTraites: l.joursTraites,
    joursTotal: l.joursTotal,
    remarque: f.remarque,
    zonesRemarque: f.zones_remarque,
    jours: routing.value.filter(x => x.merchandiser_id === l.merchandiserId).flatMap((x) => {
      const rep = reponses.value.find(y => y.validation_merch_id === l.id && y.routing_mensuel_id === x.id)
      return rep && rep.decision !== 'ok'
        ? [{ id: rep.id, semaine: x.semaine_du_mois, jourTexte: JOURS[x.jour_semaine], point: x.point_visite, decision: rep.decision, commentaire: rep.commentaire || '', choix: rep.traite ? 'appliqué' : texteCorrection(rep) }]
        : []
    }),
    boutiques: retours.value.filter(x => x.validation_merch_id === l.id).map(x => ({
      id: x.id,
      nom: x.pdv?.nom_pdv || 'Boutique',
      motif: MOTIFS[x.motif] || x.motif,
      point: routing.value.find(y => y.id === x.routing_mensuel_id)?.point_visite || '',
      commentaire: x.commentaire || '',
      doublon: retours.value.filter(y => y.validation_merch_id === l.id && y.routing_mensuel_id === x.routing_mensuel_id && cleZone(y.pdv?.nom_pdv) === cleZone(x.pdv?.nom_pdv)).length > 1,
      choix: x.traite ? 'appliqué' : texteBoutique(x),
    })),
    zones: {
      oui: zs.filter(z => z.decision === 'oui').map(z => z.libelle),
      non: zs.filter(z => z.decision === 'non').map(z => z.libelle),
      ecarts: ecartsZones(f),
      aModifie: prop.aModifie,
      retenues: r ? `${(r.territoires || []).join(', ')} (${(r.quartiers || []).length} quartiers)` : '',
    },
  }
}))

// --- Aperçu, application, annulation -----------------------------------------
const apercu = ref<any>(null)
const apercuOuvert = ref(false)
const application = ref<'' | 'apercu' | 'appliquer' | 'annuler'>('')
const passages = computed(() => {
  const parLot = new Map<string, { lot: string; le: string; n: number; annule: boolean }>()
  for (const a of applications.value) {
    const p = parLot.get(a.lot) || { lot: a.lot, le: a.applique_le, n: 0, annule: !!a.annule_le }
    p.n++
    parLot.set(a.lot, p)
  }
  return [...parLot.values()].slice(0, 5)
})
async function lancer(simuler: boolean) {
  if (!campagne.value) return
  if (!simuler && !(await demanderConfirmation({
    titre: 'Appliquer les corrections retenues ?',
    message: `${choixRetenus.value.decides} choix sur ${choixRetenus.value.demandes}. Le routing, les boutiques et les profils changent dès maintenant, fin d'octobre comprise, et les tournées à venir sont refaites. La mise à jour pourra être annulée.`,
    libelleAction: 'Appliquer',
    destructif: false,
  }))) return
  application.value = simuler ? 'apercu' : 'appliquer'
  erreur.value = ''
  try {
    apercu.value = await $fetch('/api/admin/validation-tournee/appliquer', { method: 'POST', body: { campagneId: campagne.value.id, simuler } })
    apercuOuvert.value = true
    if (!simuler) await charger()
  }
  catch (e) { erreur.value = messageUtilisateur(e) }
  finally { application.value = '' }
}
async function annulerPassage(p: { lot: string; le: string }) {
  if (!(await demanderConfirmation({
    titre: `Annuler les corrections appliquées le ${dateCourte(p.le)} ?`,
    message: 'Le routing, les boutiques et les profils reviennent comme avant cette mise à jour ; les retours repassent « à traiter ».',
    libelleAction: 'Annuler cette mise à jour',
    destructif: true,
  }))) return
  application.value = 'annuler'
  try {
    const r: any = await $fetch('/api/admin/validation-tournee/annuler', { method: 'POST', body: { lot: p.lot } })
    toast.add({ title: 'Mise à jour annulée', description: `${r.annulees} changements défaits.`, color: 'green' })
    await charger()
  }
  catch (e) { erreur.value = messageUtilisateur(e) }
  finally { application.value = '' }
}

async function copier(texte: string, ok: string) {
  try {
    await navigator.clipboard.writeText(texte)
    toast.add({ title: ok, color: 'green' })
  }
  catch {
    toast.add({ title: 'Copie impossible', description: 'Sélectionnez le texte et copiez-le à la main.', color: 'amber' })
  }
}

async function ouvrirCampagne() {
  creation.value = true
  erreur.value = ''
  try {
    const mois = `${moisNouveau.value}-01`
    let { data: c, error } = await supabase.from('validation_tournee_campagne').select('id').eq('mois', mois).maybeSingle()
    if (error) throw error
    if (!c) {
      const res = await supabase.from('validation_tournee_campagne').insert({ mois, libelle: libelleMois(mois), statut: 'ouverte' }).select('id').single()
      if (res.error) throw res.error
      c = res.data
    }
    const { data: merchs, error: e2 } = await supabase.from('profiles').select('id').eq('employeur', 'atom').eq('role', 'merchandiser').eq('is_active', true)
    if (e2) throw e2
    const { data: lignesRouting, error: e3 } = await supabase.from('routing_mensuel').select('merchandiser_id').eq('actif', true).in('merchandiser_id', (merchs || []).map(m => m.id))
    if (e3) throw e3
    const avecRouting = new Set((lignesRouting || []).map(l => l.merchandiser_id))
    const { data: deja } = await supabase.from('validation_tournee_merch').select('merchandiser_id').eq('campagne_id', c!.id)
    const presents = new Set((deja || []).map(d => d.merchandiser_id))
    const nouvelles = (merchs || []).filter(m => avecRouting.has(m.id) && !presents.has(m.id))
      .map(m => ({ campagne_id: c!.id, merchandiser_id: m.id, code: nouveauCodeAleatoire() }))
    if (nouvelles.length) {
      const { error: e4 } = await supabase.from('validation_tournee_merch').insert(nouvelles)
      if (e4) throw e4
    }
    campagneId.value = c!.id
    toast.add({ title: `Validation de ${libelleMois(mois)} ouverte`, description: `${nouvelles.length} merchandiser${nouvelles.length > 1 ? 's' : ''} ajouté${nouvelles.length > 1 ? 's' : ''}.`, color: 'green' })
    await charger()
  }
  catch (e) { erreur.value = messageUtilisateur(e) }
  finally { creation.value = false }
}

async function basculerCampagne(nouveau: 'ouverte' | 'fermee') {
  if (!campagne.value) return
  if (nouveau === 'fermee' && !(await demanderConfirmation({
    titre: `Fermer la validation de « ${campagne.value.libelle} » ?`,
    message: 'Les merchandisers ne pourront plus ouvrir leur fiche avec le lien. Les réponses déjà données restent visibles ici.',
    libelleAction: 'Fermer la validation',
    destructif: false,
  }))) return
  const { error } = await supabase.from('validation_tournee_campagne').update({ statut: nouveau }).eq('id', campagne.value.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  await charger()
}

async function nouveauLien(l: { id: string; nom: string }) {
  if (!(await demanderConfirmation({
    titre: `Donner un nouveau lien à « ${l.nom} » ?`,
    message: 'L\'ancien lien ne marchera plus. Pensez à lui envoyer le nouveau.',
    libelleAction: 'Donner un nouveau lien',
    destructif: false,
  }))) return
  const lien = Array.from(crypto.getRandomValues(new Uint8Array(16)), o => o.toString(16).padStart(2, '0')).join('')
  const { error } = await supabase.from('validation_tournee_merch').update({ lien_jeton: lien }).eq('id', l.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  await charger()
}

async function rouvrirFiche(d: { id: string; nom: string }) {
  if (!(await demanderConfirmation({
    titre: `Rouvrir la fiche de « ${d.nom} » ?`,
    message: 'Il pourra de nouveau changer ses réponses avec son code, puis valider une seconde fois.',
    libelleAction: 'Rouvrir la fiche',
    destructif: false,
  }))) return
  const { error } = await supabase.from('validation_tournee_merch').update({ statut: 'en_cours', valide_le: null }).eq('id', d.id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  await charger()
}

async function marquerTraite(table: string, id: string, traite: boolean) {
  const { error } = await supabase.from(table).update({ traite }).eq('id', id)
  if (error) { erreur.value = messageUtilisateur(error); return }
  const liste = table === 'validation_tournee_reponse' ? reponses : retours
  liste.value = liste.value.map((x: any) => x.id === id ? { ...x, traite } : x)
}

async function recalculer() {
  recalcul.value = true
  try {
    const r: any = await $fetch('/api/admin/validation-tournee/recalculer', { method: 'POST' })
    toast.add({ title: 'Quartiers recalculés', description: `${r.pdv} boutiques rangées.`, color: 'green' })
    await Promise.all([charger(), chargerHorsTournee()])
  }
  catch (e) { erreur.value = messageUtilisateur(e) }
  finally { recalcul.value = false }
}

async function chargerHorsTournee() {
  chargementHors.value = true
  const { data, error } = await (supabase.rpc as any)('atom_pdv_hors_tournee')
  if (error) erreur.value = messageUtilisateur(error)
  else horsTournee.value = data || []
  chargementHors.value = false
}

function telechargerCsv(nom: string, entete: string[], lignesCsv: any[][]) {
  const champ = (v: unknown) => `"${String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`
  const texte = '\uFEFF' + [entete, ...lignesCsv].map(l => l.map(champ).join(';')).join('\n')
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(new Blob([texte], { type: 'text/csv;charset=utf-8' }))
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(lien.href)
}

function exporterHorsTournee() {
  const raisonTexte = (r: string) => RAISONS.find(x => x.id === r)?.texte || r
  telechargerCsv('boutiques-atom-hors-tournee.csv',
    ['Boutique', 'Raison', 'Distributeur', 'Quartier le plus proche', 'Merchandiser du quartier', 'Distance au point (m)', 'Latitude', 'Longitude'],
    horsTournee.value.map(b => [b.nom_pdv, raisonTexte(b.raison), b.distributeur, b.point_visite, b.merchandiser, b.distance_point_m, b.latitude, b.longitude]))
}

function exporterReponses() {
  const lignesCsv: any[][] = []
  for (const l of lignes.value) {
    for (const j of routing.value.filter(r => r.merchandiser_id === l.merchandiserId)) {
      const r = reponses.value.find(x => x.validation_merch_id === l.id && x.routing_mensuel_id === j.id)
      lignesCsv.push([l.nom, statut(l.statut).texte, j.semaine_du_mois, JOURS[j.jour_semaine], j.point_visite, r ? decision(r.decision).texte : 'Sans réponse', r?.commentaire || '', r?.traite ? 'oui' : ''])
    }
  }
  telechargerCsv(`validation-tournees-${campagne.value?.mois?.slice(0, 7) || 'mois'}.csv`,
    ['Merchandiser', 'Fiche', 'Semaine', 'Jour', 'Point de visite', 'Réponse', 'Commentaire', 'Traité'], lignesCsv)
}

watch(campagneId, (v, avant) => { if (avant && v !== avant) { selection.value = null; charger() } })
// Les fiches arrivent pendant la journée : relecture légère chaque minute.
let minuterie: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  charger()
  chargerHorsTournee()
  minuterie = setInterval(() => { if (!document.hidden && !chargement.value && !application.value) charger(false) }, 60_000)
})
onBeforeUnmount(() => { if (minuterie) clearInterval(minuterie) })
</script>
