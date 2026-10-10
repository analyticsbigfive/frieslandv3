<template>
  <div class="space-y-6">
    <AdminPageHeader description="Les règles qui classent chaque point de vente : seuils des niveaux, assortiment, poids des références, visibilité exigée et rattachement des types de PDV.">
      <template #actions>
        <UButton
          v-if="canEdit"
          icon="i-heroicons-arrow-path"
          :loading="recalculating"
          color="gray"
          variant="solid"
          @click="confirmationRecalcul = true"
        >
          Recalculer toutes les visites
        </UButton>
      </template>
    </AdminPageHeader>

    <p v-if="!canEdit" class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <UIcon name="i-heroicons-eye" class="h-4 w-4" aria-hidden="true" />
      Consultation seule : seuls un administrateur ou un superviseur peuvent modifier les standards.
    </p>

    <!-- Les scores des visites ne changent qu'après le recalcul : on le rappelle
         tant qu'il n'a pas été lancé depuis la dernière modification. -->
    <div
      v-if="canEdit && (recalculEnAttente || recalculating)"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
      role="status"
    >
      <p v-if="recalculating">
        Recalcul en cours<span v-if="recalculTotal"> : <strong class="tabular-nums">{{ recalculProgression }} / {{ recalculTotal }}</strong> visites</span>. Gardez cette page ouverte.
      </p>
      <p v-else>Vous avez modifié des standards. Les scores des visites et les tableaux de bord ne changeront qu'après le recalcul.</p>
      <UButton v-if="!recalculating" size="sm" icon="i-heroicons-arrow-path" @click="confirmationRecalcul = true">Recalculer maintenant</UButton>
    </div>

    <ChargementContenu v-if="loading" variante="cartes" libelle="Chargement des standards…" />

    <div v-else class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_13rem]">
      <div class="min-w-0 space-y-6">
      <section id="niveaux" class="admin-surface scroll-mt-24 overflow-hidden" aria-labelledby="titre-niveaux">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="titre-niveaux" class="text-base font-semibold text-slate-900 dark:text-white">Seuils des niveaux</h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">Les seuils de disponibilité, de visibilité et de promotion pour qu’un magasin soit classé Flagship, VIP, Core ou Basic. La visibilité parfaite est exigée à 100 % ; la promotion n’est contrôlée que lorsqu’elle s’applique.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Niveau</th>
                <th scope="col" class="!text-right">Disponibilité minimale</th>
                <th scope="col" class="!text-right">Visibilité minimale</th>
                <th scope="col" class="!text-right">Promotion minimale</th>
                <th v-if="canEdit" scope="col"><span class="sr-only">Enregistrer</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="niveau in niveaux" :key="niveau.code">
                <td class="font-semibold text-slate-900 dark:text-white">{{ libelleNiveau(niveau.code) }}</td>
                <td class="text-right tabular-nums">
                  <UInput v-if="canEdit" v-model.number="niveau.dispo_rayon_min" type="number" min="0" max="100" size="sm" class="ml-auto w-24" :aria-label="`Disponibilité minimale, niveau ${libelleNiveau(niveau.code)} (%)`" />
                  <span v-else>{{ pct(niveau.dispo_rayon_min) }}</span>
                </td>
                <td class="text-right tabular-nums">
                  <UInput v-if="canEdit" v-model.number="niveau.visibilite_min" type="number" min="0" max="100" size="sm" class="ml-auto w-24" :aria-label="`Visibilité minimale, niveau ${libelleNiveau(niveau.code)} (%)`" />
                  <span v-else>{{ pct(niveau.visibilite_min) }}</span>
                </td>
                <td class="text-right tabular-nums">
                  <UInput v-if="canEdit" v-model.number="niveau.promotion_min" type="number" min="0" max="100" size="sm" class="ml-auto w-24" :aria-label="`Promotion minimale, niveau ${libelleNiveau(niveau.code)} (%)`" />
                  <span v-else>{{ pct(niveau.promotion_min) }} <span class="text-xs text-slate-600 dark:text-slate-300">(si elle s’applique)</span></span>
                </td>
                <td v-if="canEdit" class="text-right">
                  <UButton size="xs" variant="outline" :loading="savingKey === `niveau:${niveau.code}`" :aria-label="`Enregistrer le niveau ${libelleNiveau(niveau.code)}`" @click="saveNiveau(niveau)">Enregistrer</UButton>
                </td>
              </tr>
              <tr v-if="!niveaux.length">
                <td :colspan="canEdit ? 5 : 4" class="py-8 text-center text-slate-600 dark:text-slate-300">Aucun niveau défini. Ajoutez les niveaux Perfect Store avant de fixer leurs seuils.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="assortiment" class="admin-surface scroll-mt-24 overflow-hidden" aria-labelledby="titre-assortiment">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="titre-assortiment" class="text-base font-semibold text-slate-900 dark:text-white">Assortiment</h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">Le nombre minimum de références présentes et le contrôle des références prioritaires (hero SKU), selon le type et le grade du point de vente.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col" class="!text-center">Grade</th>
                <th scope="col" class="!text-right">Références cibles (SKU)</th>
                <th scope="col" class="!text-right">Références présentes, minimum</th>
                <th scope="col" class="!text-center">Références prioritaires (hero SKU) obligatoires</th>
                <th v-if="canEdit" scope="col"><span class="sr-only">Enregistrer</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in assortiments" :key="`${row.segment}-${row.grade}`">
                <td class="font-medium text-slate-900 dark:text-white">{{ row.segment }}</td>
                <td class="text-center">{{ row.grade }}</td>
                <td class="text-right tabular-nums">
                  <UInput v-if="canEdit" v-model.number="row.sku_cibles" type="number" min="1" size="sm" class="ml-auto w-20" :aria-label="`Références cibles, ${row.segment} ${row.grade}`" />
                  <span v-else>{{ row.sku_cibles }}</span>
                </td>
                <td class="text-right font-semibold tabular-nums">
                  <UInput v-if="canEdit" v-model.number="row.min_sku_presents" type="number" min="1" size="sm" class="ml-auto w-20" :aria-label="`Références présentes minimum, ${row.segment} ${row.grade}`" />
                  <span v-else>{{ row.min_sku_presents }}</span>
                </td>
                <td class="text-center">
                  <UCheckbox
                    v-if="canEdit"
                    v-model="row.heros_obligatoires"
                    class="inline-flex justify-center"
                    :aria-label="`Références prioritaires obligatoires, ${row.segment} ${row.grade}`"
                  />
                  <UBadge v-else :color="row.heros_obligatoires ? 'green' : 'gray'" variant="soft" size="xs">
                    {{ row.heros_obligatoires ? 'Obligatoires' : 'Non bloquantes' }}
                  </UBadge>
                </td>
                <td v-if="canEdit" class="text-right">
                  <UButton size="xs" variant="outline" :loading="savingKey === `assort:${row.segment}:${row.grade}`" :aria-label="`Enregistrer l’assortiment ${row.segment} ${row.grade}`" @click="saveAssortiment(row)">Enregistrer</UButton>
                </td>
              </tr>
              <tr v-if="!assortiments.length">
                <td :colspan="canEdit ? 6 : 5" class="py-8 text-center text-slate-600 dark:text-slate-300">Aucun standard d’assortiment défini.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="poids" class="admin-surface scroll-mt-24 overflow-hidden" aria-labelledby="titre-poids">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="titre-poids" class="text-base font-semibold text-slate-900 dark:text-white">Poids des références dans la disponibilité</h2>
          <div class="mt-1 max-w-3xl space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Le poids de chaque référence dans le score de disponibilité, pour les boutiques (GT) et les supermarchés (MT).
              Le total par famille et par canal doit faire 100 %.
            </p>
            <p>
              Les poids de ce tableau sont les poids cibles, appelés « taux revus » dans le fichier du client. Ils sont distincts
              des poids calculés sur les ventes (« taux de vente »). Pour ajouter une référence au calcul : Paramètres › Référentiels › Poids des références.
            </p>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Famille</th>
                <th scope="col">Référence</th>
                <th scope="col" class="!text-right">Poids cible, boutiques (GT)</th>
                <th scope="col" class="!text-right">Poids cible, supermarchés (MT)</th>
                <th v-if="canEdit" scope="col"><span class="sr-only">Enregistrer</span></th>
              </tr>
            </thead>
            <tbody v-for="famille in tauxCiblesParFamille" :key="famille.code">
              <tr v-for="(row, idx) in famille.rows" :key="row.reference_produit_id">
                <td class="font-medium text-slate-900 dark:text-white">
                  <span v-if="idx === 0">{{ famille.code }} <span class="text-xs font-normal text-slate-600 dark:text-slate-300">({{ famille.nom }})</span></span>
                </td>
                <td>{{ row.variante }}</td>
                <td class="text-right tabular-nums">
                  <UInput v-if="canEdit" v-model.number="row.gt" type="number" min="0" max="100" step="0.1" size="sm" class="ml-auto w-24" :aria-label="`Poids cible de ${row.variante} dans les boutiques (GT), en %`" />
                  <span v-else>{{ pctFine(row.gt) }}</span>
                </td>
                <td class="text-right tabular-nums">
                  <UInput v-if="canEdit" v-model.number="row.mt" type="number" min="0" max="100" step="0.1" size="sm" class="ml-auto w-24" :aria-label="`Poids cible de ${row.variante} dans les supermarchés (MT), en %`" />
                  <span v-else>{{ pctFine(row.mt) }}</span>
                </td>
                <td v-if="canEdit" class="text-right">
                  <UButton size="xs" variant="outline" :loading="savingKey === `taux:${row.reference_produit_id}`" :aria-label="`Enregistrer les poids de ${row.variante}`" @click="saveTauxCible(row)">Enregistrer</UButton>
                </td>
              </tr>
              <tr class="bg-slate-50 dark:bg-slate-700/30">
                <td class="!py-2 text-xs font-semibold text-slate-700 dark:text-slate-200" colspan="2">Total {{ famille.code }}</td>
                <td class="!py-2 text-right">
                  <UBadge size="xs" variant="soft" :color="sumOk(famille.sumGT) ? 'green' : 'red'" class="tabular-nums">
                    {{ pctTotal(famille.sumGT) }} · {{ sumOk(famille.sumGT) ? 'complet' : 'doit faire 100 %' }}
                  </UBadge>
                </td>
                <td class="!py-2 text-right">
                  <UBadge size="xs" variant="soft" :color="sumOk(famille.sumMT) ? 'green' : 'red'" class="tabular-nums">
                    {{ pctTotal(famille.sumMT) }} · {{ sumOk(famille.sumMT) ? 'complet' : 'doit faire 100 %' }}
                  </UBadge>
                </td>
                <td v-if="canEdit" />
              </tr>
            </tbody>
            <tbody v-if="!tauxCiblesParFamille.length">
              <tr>
                <td :colspan="canEdit ? 5 : 4" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucun poids cible défini. Ajoutez des références dans Paramètres › Référentiels › Poids des références.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="visibilite" class="admin-surface scroll-mt-24 overflow-hidden" aria-labelledby="titre-visibilite">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="titre-visibilite" class="text-base font-semibold text-slate-900 dark:text-white">Visibilité exigée</h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Les éléments de PLV exigés à chaque niveau, par type de magasin : une case cochée veut dire « exigé ». Ces exigences
            alimentent le score de visibilité et de promotion de chaque visite.
          </p>
        </div>
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormGroup label="Segment" size="sm">
              <USelectMenu v-model="segmentFilter" :options="matrixSegmentOptions" option-attribute="label" value-attribute="value" size="sm" />
            </UFormGroup>
            <UFormGroup label="Pilier" size="sm">
              <USelectMenu v-model="pillarFilter" :options="pillarOptions" option-attribute="label" value-attribute="value" size="sm" />
            </UFormGroup>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Élément</th>
                <th v-for="niveau in NIVEAUX" :key="niveau" scope="col" class="!text-center">{{ libelleNiveau(niveau) }}</th>
                <th scope="col" class="!text-center">Optionnel</th>
                <th v-if="canEdit" scope="col"><span class="sr-only">Enregistrer</span></th>
              </tr>
            </thead>
            <tbody v-for="group in matrixByEmplacement" :key="group.key">
              <tr class="bg-slate-50 dark:bg-slate-700/40">
                <th :colspan="canEdit ? 7 : 6" scope="colgroup" class="!py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {{ group.label }}
                </th>
              </tr>
              <tr v-for="row in group.rows" :key="row.element_id">
                <td class="text-slate-900 dark:text-white">{{ row.nom }}</td>
                <td v-for="niveau in NIVEAUX" :key="niveau" class="text-center">
                  <UCheckbox
                    v-if="canEdit"
                    v-model="row.requis[niveau]"
                    class="inline-flex justify-center"
                    :aria-label="`${row.nom} exigé au niveau ${libelleNiveau(niveau)}`"
                  />
                  <template v-else-if="row.requis[niveau]">
                    <UIcon name="i-heroicons-check-circle-20-solid" class="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    <span class="sr-only">Exigé</span>
                  </template>
                  <span v-else class="sr-only">Non exigé</span>
                </td>
                <td class="text-center">
                  <UCheckbox
                    v-if="canEdit"
                    v-model="row.optionnel"
                    class="inline-flex justify-center"
                    :aria-label="`${row.nom} optionnel`"
                  />
                  <UBadge v-else-if="row.optionnel" size="xs" variant="soft" color="amber">Oui</UBadge>
                  <span v-else class="sr-only">Non</span>
                </td>
                <td v-if="canEdit" class="text-right">
                  <UButton size="xs" variant="outline" :loading="savingKey === `standard:${row.element_id}`" :aria-label="`Enregistrer ${row.nom}`" @click="saveStandard(row)">Enregistrer</UButton>
                </td>
              </tr>
            </tbody>
            <tbody v-if="!matrixByEmplacement.length">
              <tr>
                <td :colspan="canEdit ? 7 : 6" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucun élément de visibilité pour ce segment{{ pillarFilter === 'all' ? '' : ' et ce pilier' }}. Choisissez un autre segment{{ pillarFilter === 'all' ? '' : ' ou « Tous les piliers »' }}.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="types-pdv" class="admin-surface scroll-mt-24 overflow-hidden" aria-labelledby="titre-types-pdv">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="titre-types-pdv" class="text-base font-semibold text-slate-900 dark:text-white">Types de PDV</h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Relier chaque type de point de vente à sa grille de visibilité et, si elle existe, à son segment et son grade de disponibilité.
            Un type sans grille affiche « Aucun standard paramétré » sur le terrain.
          </p>
        </div>
        <div class="max-h-[34rem] overflow-auto">
          <table class="admin-table">
            <thead class="sticky top-0 z-10">
              <tr>
                <th scope="col">Type de PDV</th>
                <th scope="col">Grille de visibilité</th>
                <th scope="col">Segment de disponibilité</th>
                <th scope="col">Grade</th>
                <th v-if="canEdit" scope="col"><span class="sr-only">Enregistrer</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in typeMappings" :key="row.type_pdv_id">
                <td class="font-medium text-slate-900 dark:text-white">{{ row.nom }}</td>
                <td>
                  <USelectMenu
                    v-if="canEdit"
                    v-model="row.visibility_segment"
                    :options="visibilityMappingOptions"
                    value-attribute="value"
                    option-attribute="label"
                    size="sm"
                    :aria-label="`Grille de visibilité de ${row.nom}`"
                  />
                  <span v-else>{{ segmentLabel(row.visibility_segment) || 'Non paramétré' }}</span>
                </td>
                <td>
                  <USelectMenu
                    v-if="canEdit"
                    v-model="row.availability_segment"
                    :options="availabilitySegmentOptions"
                    value-attribute="value"
                    option-attribute="label"
                    size="sm"
                    :aria-label="`Segment de disponibilité de ${row.nom}`"
                  />
                  <span v-else>{{ row.availability_segment || 'Non paramétré' }}</span>
                </td>
                <td>
                  <USelectMenu
                    v-if="canEdit"
                    v-model="row.grade"
                    :options="gradeOptions"
                    value-attribute="value"
                    option-attribute="label"
                    size="sm"
                    :aria-label="`Grade de ${row.nom}`"
                  />
                  <span v-else>{{ row.grade || 'Aucun' }}</span>
                </td>
                <td v-if="canEdit" class="text-right">
                  <UButton size="xs" variant="outline" :loading="savingKey === `mapping:${row.type_pdv_id}`" :aria-label="`Enregistrer le rattachement de ${row.nom}`" @click="demanderSaveTypeMapping(row)">Enregistrer</UButton>
                </td>
              </tr>
              <tr v-if="!typeMappings.length">
                <td :colspan="canEdit ? 5 : 4" class="py-8 text-center text-slate-600 dark:text-slate-300">Aucun type de PDV. Ajoutez-en dans Paramètres › Référentiels › Types de PDV.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <aside class="hidden xl:block" aria-label="Sur cette page">
        <nav class="sticky top-24 space-y-1 text-sm">
          <p class="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Sur cette page</p>
          <a v-for="sec in sommaire" :key="sec.id" :href="`#${sec.id}`" class="block rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">{{ sec.label }}</a>
        </nav>
      </aside>
    </div>

    <UModal v-model="confirmationRecalcul">
      <div class="space-y-4 p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Recalculer toutes les visites ?</h2>
        <p class="text-sm leading-6 text-slate-700 dark:text-slate-200">
          Le score Perfect Store de chaque visite enregistrée sera recalculé avec les standards actuels. Les tableaux de bord
          et les niveaux des points de vente changeront en conséquence. Le calcul prend plusieurs minutes : gardez la page ouverte.
        </p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="confirmationRecalcul = false">Annuler</UButton>
          <UButton icon="i-heroicons-arrow-path" @click="lancerRecalcul">Lancer le recalcul</UButton>
        </div>
      </div>
    </UModal>

    <!-- Vider une liste supprime le rattachement : on le dit avant d'écrire. -->
    <UModal v-model="retrait.ouvert">
      <div class="space-y-4 p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Retirer le rattachement de « {{ retrait.row?.nom }} » ?</h2>
        <div class="space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
          <p>Vous avez vidé {{ retrait.quoi.join(' et ') }}. En enregistrant, ce rattachement sera supprimé :</p>
          <ul class="list-disc space-y-1 pl-5">
            <li v-if="retrait.quoi.includes('la grille de visibilité')">ce type de PDV n’aura plus de grille de visibilité, et le terrain affichera « Aucun standard paramétré » ;</li>
            <li v-if="retrait.quoi.includes('le segment et le grade de disponibilité')">sa disponibilité ne sera plus comparée à un seuil de segment et de grade.</li>
          </ul>
        </div>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="retrait.ouvert = false">Annuler</UButton>
          <UButton color="red" icon="i-heroicons-link-slash" @click="confirmerRetrait">Retirer le rattachement</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const toast = useToast()
const loading = ref(true)
const recalculating = ref(false)
const savingKey = ref<string | null>(null)
const niveaux = ref<any[]>([])
const assortiments = ref<any[]>([])
const tauxCibles = ref<any[]>([])
const matrixElements = ref<any[]>([])
const typeMappings = ref<any[]>([])
const segmentFilter = ref('boutique')
const pillarFilter = ref('all')
const canEdit = computed(() => authStore.isAdmin || authStore.isSuperviseur)

// Sections empilées (plus d'onglets dans l'onglet Paramètres) ; sommaire sur grand écran.
const sommaire = [
  { id: 'niveaux', label: 'Seuils des niveaux' },
  { id: 'assortiment', label: 'Assortiment' },
  { id: 'poids', label: 'Poids des références' },
  { id: 'visibilite', label: 'Visibilité exigée' },
  { id: 'types-pdv', label: 'Types de PDV' },
]

// Une modification ne change les scores qu'après le recalcul global : on le
// rappelle (bandeau) jusqu'à ce qu'il soit lancé. Gardé pour la session.
const recalculEnAttente = useState('standards-recalcul-en-attente', () => false)
const confirmationRecalcul = ref(false)
function lancerRecalcul() {
  confirmationRecalcul.value = false
  void recalculateAll()
}

const segmentOptions = [
  { value: 'all', label: 'Tous les segments' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'superette', label: 'Superette' },
  { value: 'mt', label: 'Supermarchés (MT)' },
  { value: 'table_top', label: 'Table-top' },
  { value: 'pushcart', label: 'Pushcart' },
  { value: 'porridge', label: 'Porridge' },
  { value: 'kiosque_aboki', label: 'Kiosque et aboki' },
]
const NIVEAUX = ['basic', 'core', 'vip', 'flagship']
const LIBELLES_NIVEAU: Record<string, string> = { basic: 'Basic', core: 'Core', vip: 'VIP', flagship: 'Flagship' }
const libelleNiveau = (code: string) => LIBELLES_NIVEAU[String(code || '').toLowerCase()] || code
const matrixSegmentOptions = segmentOptions.filter(option => option.value !== 'all')
const pillarOptions = [
  { value: 'all', label: 'Tous les piliers' },
  { value: 'visibilite', label: 'Visibilité' },
  { value: 'promotion', label: 'Promotion' },
]
const visibilityMappingOptions = [
  { value: '', label: 'Non paramétré' },
  ...segmentOptions.filter(option => option.value !== 'all'),
]
const availabilitySegmentOptions = [
  { value: '', label: 'Non paramétré' },
  ...['Boutique', 'Minimarket', 'Kiosque', 'Aboki', 'Pushcart', 'TableTop', 'Porridge']
    .map(value => ({ value, label: value })),
]
const gradeOptions = [
  { value: '', label: 'Aucun' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
]

const EMPLACEMENTS = [
  { key: 'exterieure', label: 'Extérieure' },
  { key: 'interieure', label: 'Intérieure' },
  { key: 'promotion', label: 'Promotion' },
]
const matrixByEmplacement = computed(() => {
  const rows = matrixElements.value.filter(row =>
    row.segment === segmentFilter.value
    && (pillarFilter.value === 'all' || row.pilier === pillarFilter.value)
    && (canEdit.value || NIVEAUX.some(niveau => row.requis[niveau]) || row.optionnel))
  return EMPLACEMENTS
    .map(group => ({ ...group, rows: rows.filter(row => row.emplacement === group.key) }))
    .filter(group => group.rows.length)
})

const pct = (value: number | null) => value == null ? 'Non défini' : `${Number(value).toLocaleString('fr-FR')} %`
const pctFine = (value: number | null) => value == null ? 'Non défini' : `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
const pctTotal = (value: number) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
const sumOk = (sum: number) => Math.abs(sum - 100) < 0.5

const familleOrder = ['EVAP', 'IMP', 'SCM']
const tauxCiblesParFamille = computed(() => familleOrder
  .map((code) => {
    const rows = tauxCibles.value.filter(row => row.famille === code)
    return {
      code,
      nom: rows[0]?.famille_nom || '',
      rows,
      sumGT: rows.reduce((sum, row) => sum + (Number(row.gt) || 0), 0),
      sumMT: rows.reduce((sum, row) => sum + (Number(row.mt) || 0), 0),
    }
  })
  .filter(famille => famille.rows.length))
const segmentLabel = (value: string) => segmentOptions.find(option => option.value === value)?.label || value
const one = (value: any) => Array.isArray(value) ? value[0] : value

function validPercent(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100
}

async function saveNiveau(row: any) {
  if (!canEdit.value) return
  if (![row.dispo_rayon_min, row.visibilite_min, row.promotion_min].every(validPercent)) {
    toast.add({ title: 'Valeur invalide', description: 'Les seuils doivent être compris entre 0 et 100.', color: 'red' })
    return
  }
  savingKey.value = `niveau:${row.code}`
  try {
    const { error } = await supabase.from('niveau_perfect_store').update({
      dispo_rayon_min: Number(row.dispo_rayon_min),
      visibilite_min: Number(row.visibilite_min),
      promotion_min: Number(row.promotion_min),
    }).eq('code', row.code)
    if (error) throw error
    toast.add({ title: 'Niveau enregistré', description: libelleNiveau(row.code), color: 'green' })
    recalculEnAttente.value = true
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: messageUtilisateur(error), color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

async function saveAssortiment(row: any) {
  if (!canEdit.value) return
  const target = Number(row.sku_cibles)
  const minimum = Number(row.min_sku_presents)
  if (!Number.isInteger(target) || !Number.isInteger(minimum) || minimum < 1 || target < minimum) {
    toast.add({ title: 'Valeur invalide', description: 'Le minimum doit être positif et inférieur ou égal au nombre de références cibles.', color: 'red' })
    return
  }
  savingKey.value = `assort:${row.segment}:${row.grade}`
  try {
    const { error } = await supabase.from('standard_assortiment').update({
      sku_cibles: target,
      min_sku_presents: minimum,
      heros_obligatoires: !!row.heros_obligatoires,
    }).eq('segment', row.segment).eq('grade', row.grade)
    if (error) throw error
    toast.add({ title: 'Assortiment enregistré', description: `${row.segment} ${row.grade}`, color: 'green' })
    recalculEnAttente.value = true
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: messageUtilisateur(error), color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

async function saveTauxCible(row: any) {
  if (!canEdit.value) return
  if (![row.gt, row.mt].every(validPercent)) {
    toast.add({ title: 'Valeur invalide', description: 'Les poids cibles doivent être compris entre 0 et 100.', color: 'red' })
    return
  }
  savingKey.value = `taux:${row.reference_produit_id}`
  try {
    const [gtResult, mtResult] = await Promise.all([
      supabase.from('poids_reference')
        .update({ poids: Number(row.gt) / 100 })
        .eq('reference_produit_id', row.reference_produit_id)
        .eq('canal', 'GT')
        .eq('base_calcul', 'taux_revu'),
      supabase.from('poids_reference')
        .update({ poids: Number(row.mt) / 100 })
        .eq('reference_produit_id', row.reference_produit_id)
        .eq('canal', 'MT')
        .eq('base_calcul', 'taux_revu'),
    ])
    if (gtResult.error) throw gtResult.error
    if (mtResult.error) throw mtResult.error
    toast.add({ title: 'Poids cibles enregistrés', description: row.variante, color: 'green' })
    recalculEnAttente.value = true
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: messageUtilisateur(error), color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

async function saveStandard(row: any) {
  if (!canEdit.value) return
  savingKey.value = `standard:${row.element_id}`
  try {
    const [standardResult, elementResult] = await Promise.all([
      supabase.from('standard_visibilite').upsert(
        NIVEAUX.map(niveau => ({
          segment: row.segment,
          niveau_perfect_store: niveau,
          element_visibilite_id: row.element_id,
          requis: !!row.requis[niveau],
        })),
        { onConflict: 'niveau_perfect_store,element_visibilite_id' },
      ),
      supabase.from('element_visibilite')
        .update({ optionnel: !!row.optionnel })
        .eq('id', row.element_id),
    ])
    if (standardResult.error) throw standardResult.error
    if (elementResult.error) throw elementResult.error
    toast.add({ title: 'Visibilité exigée enregistrée', description: row.nom, color: 'green' })
    recalculEnAttente.value = true
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: messageUtilisateur(error), color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

// Vider une liste supprime le rattachement correspondant : on demande
// confirmation en le disant, au lieu de supprimer en silence.
const retrait = reactive<{ ouvert: boolean, row: any, quoi: string[] }>({ ouvert: false, row: null, quoi: [] })

function rattachementIncomplet(row: any) {
  return (row.availability_segment && !row.grade) || (!row.availability_segment && row.grade)
}

function demanderSaveTypeMapping(row: any) {
  if (!canEdit.value) return
  if (rattachementIncomplet(row)) {
    toast.add({ title: 'Rattachement incomplet', description: 'Choisissez ensemble le segment de disponibilité et le grade.', color: 'red' })
    return
  }
  const quoi: string[] = []
  if (!row.visibility_segment && row.initial_visibility) quoi.push('la grille de visibilité')
  if (!row.availability_segment && row.initial_availability) quoi.push('le segment et le grade de disponibilité')
  if (quoi.length) {
    Object.assign(retrait, { ouvert: true, row, quoi })
    return
  }
  void saveTypeMapping(row)
}

function confirmerRetrait() {
  const row = retrait.row
  retrait.ouvert = false
  if (row) void saveTypeMapping(row)
}

async function saveTypeMapping(row: any) {
  if (!canEdit.value) return
  if (rattachementIncomplet(row)) {
    toast.add({ title: 'Rattachement incomplet', description: 'Choisissez ensemble le segment de disponibilité et le grade.', color: 'red' })
    return
  }
  const retire = (!row.visibility_segment && !!row.initial_visibility) || (!row.availability_segment && !!row.initial_availability)
  savingKey.value = `mapping:${row.type_pdv_id}`
  try {
    const visibilityResult = row.visibility_segment
      ? await supabase.from('segment_visibilite_type_pdv').upsert({
          type_pdv_id: row.type_pdv_id,
          segment: row.visibility_segment,
        }, { onConflict: 'type_pdv_id' })
      : await supabase.from('segment_visibilite_type_pdv').delete().eq('type_pdv_id', row.type_pdv_id)
    if (visibilityResult.error) throw visibilityResult.error

    const availabilityResult = row.availability_segment && row.grade
      ? await supabase.from('segment_grade_type_pdv').upsert({
          type_pdv_id: row.type_pdv_id,
          segment: row.availability_segment,
          grade: row.grade,
        }, { onConflict: 'type_pdv_id' })
      : await supabase.from('segment_grade_type_pdv').delete().eq('type_pdv_id', row.type_pdv_id)
    if (availabilityResult.error) throw availabilityResult.error

    row.initial_visibility = row.visibility_segment
    row.initial_availability = row.availability_segment
    toast.add({
      title: retire ? 'Rattachement retiré' : 'Rattachement enregistré',
      description: `${row.nom} : le formulaire terrain en tiendra compte à son prochain chargement.`,
      color: 'green',
    })
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: messageUtilisateur(error), color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

// Recalcul PAR LOT. En un seul appel, les 26 000 visites dépassent le
// statement_timeout de 30 s d'`authenticated` (20260831200000:33) et le bouton
// échouait sans rien recalculer. On boucle donc sur recalculer_perfect_store_lot
// avec la session de l'admin — la clé de service ne convient pas non plus,
// est_gestionnaire_perfect_store() lisant profiles via auth.uid().
const LOT = 500
const recalculProgression = ref(0)
const recalculTotal = ref(0)

async function recalculateAll() {
  if (!canEdit.value) return
  recalculating.value = true
  recalculProgression.value = 0
  recalculTotal.value = 0
  try {
    const { data: total } = await supabase.rpc('compter_visites_a_recalculer' as any)
    recalculTotal.value = Number(total || 0)

    let traitees = 0
    for (let offset = 0; ; offset += LOT) {
      const { data, error } = await supabase.rpc('recalculer_perfect_store_lot' as any, {
        p_limit: LOT,
        p_offset: offset,
        p_base_calcul: 'taux_vente',
      })
      if (error) throw error
      const n = Number(data || 0)
      traitees += n
      recalculProgression.value = traitees
      if (n < LOT) break
    }
    toast.add({ title: 'Recalcul terminé', description: `${traitees.toLocaleString('fr-FR')} visite${traitees > 1 ? 's' : ''} recalculée${traitees > 1 ? 's' : ''}.`, color: 'green' })
    recalculEnAttente.value = false
  }
  catch (error: any) {
    // Dire où le recalcul s'est arrêté : un recalcul partiel laisse des scores
    // incohérents entre eux, il faut savoir qu'il est à reprendre.
    const ou = recalculProgression.value ? ` Arrêté après ${recalculProgression.value} visite(s) : à relancer.` : ''
    toast.add({ title: 'Recalcul interrompu', description: `${messageUtilisateur(error)}${ou}`, color: 'red' })
  }
  finally {
    recalculating.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const [
      niveauResult,
      assortimentResult,
      elementResult,
      standardResult,
      typeResult,
      visibilityMappingResult,
      availabilityMappingResult,
      tauxRevuResult,
    ] = await Promise.all([
      supabase.from('niveau_perfect_store')
        .select('code, rang, dispo_rayon_min, visibilite_min, promotion_min')
        .order('rang', { ascending: false }),
      supabase.from('standard_assortiment')
        .select('segment, grade, sku_cibles, min_sku_presents, heros_obligatoires')
        .order('segment')
        .order('grade'),
      supabase.from('element_visibilite')
        .select('id, code, nom, pilier, emplacement, optionnel, segment')
        .order('nom'),
      supabase.from('standard_visibilite')
        .select('niveau_perfect_store, element_visibilite_id, requis'),
      supabase.from('type_pdv').select('*').order('nom'),
      supabase.from('segment_visibilite_type_pdv').select('type_pdv_id, segment'),
      supabase.from('segment_grade_type_pdv').select('type_pdv_id, segment, grade'),
      supabase.from('poids_reference')
        .select('reference_produit_id, canal, poids, reference_produit(id, nom, categorie_produit(code, nom))')
        .eq('base_calcul', 'taux_revu'),
    ])
    if (niveauResult.error) throw niveauResult.error
    if (assortimentResult.error) throw assortimentResult.error
    if (elementResult.error) throw elementResult.error
    if (standardResult.error) throw standardResult.error
    if (typeResult.error) throw typeResult.error
    if (visibilityMappingResult.error) throw visibilityMappingResult.error
    if (availabilityMappingResult.error) throw availabilityMappingResult.error
    if (tauxRevuResult.error) throw tauxRevuResult.error
    niveaux.value = niveauResult.data || []
    assortiments.value = assortimentResult.data || []
    const requisByElement = new Map<number, Record<string, boolean>>()
    for (const row of (standardResult.data || []) as any[]) {
      const entry = requisByElement.get(row.element_visibilite_id) || {}
      entry[row.niveau_perfect_store] = !!row.requis
      requisByElement.set(row.element_visibilite_id, entry)
    }
    matrixElements.value = (elementResult.data || []).map((element: any) => ({
      ...element,
      element_id: element.id,
      requis: NIVEAUX.reduce((acc, niveau) => {
        acc[niveau] = !!requisByElement.get(element.id)?.[niveau]
        return acc
      }, {} as Record<string, boolean>),
    }))
    const tauxByRef = new Map<number, any>()
    for (const row of (tauxRevuResult.data || []) as any[]) {
      const ref = one(row.reference_produit)
      if (!ref) continue
      const cat = one(ref.categorie_produit)
      const entry = tauxByRef.get(row.reference_produit_id) || {
        reference_produit_id: row.reference_produit_id,
        variante: ref.nom,
        famille: cat?.code || '',
        famille_nom: cat?.nom || '',
        gt: null,
        mt: null,
      }
      entry[row.canal === 'MT' ? 'mt' : 'gt'] = Math.round(Number(row.poids) * 1000) / 10
      tauxByRef.set(row.reference_produit_id, entry)
    }
    tauxCibles.value = [...tauxByRef.values()].sort((a, b) =>
      familleOrder.indexOf(a.famille) - familleOrder.indexOf(b.famille)
      || (Number(b.gt) || 0) - (Number(a.gt) || 0))
    const visibilityByType = new Map((visibilityMappingResult.data || []).map((row: any) => [row.type_pdv_id, row.segment]))
    const availabilityByType = new Map((availabilityMappingResult.data || []).map((row: any) => [row.type_pdv_id, row]))
    typeMappings.value = (typeResult.data || []).map((row: any) => ({
      type_pdv_id: row.id,
      nom: row.nom_fr || row.nom,
      visibility_segment: visibilityByType.get(row.id) || '',
      availability_segment: availabilityByType.get(row.id)?.segment || '',
      grade: availabilityByType.get(row.id)?.grade || '',
      // Valeurs lues en base : servent à prévenir avant de retirer un rattachement.
      initial_visibility: visibilityByType.get(row.id) || '',
      initial_availability: availabilityByType.get(row.id)?.segment || '',
    }))
  }
  catch (error: any) {
    toast.add({ title: 'Standards non chargés', description: messageUtilisateur(error), color: 'red' })
  }
  finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
