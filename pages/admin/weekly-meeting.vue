<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <div class="admin-toolbar">
      <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
        <UFormGroup label="Agence" size="xs">
          <USelect v-model="agenceCode" :options="optionsAgences" size="sm" class="w-56" />
        </UFormGroup>
        <UFormGroup label="Semaine (lundi au samedi)" size="xs">
          <div class="flex items-center gap-1">
            <UButton size="sm" color="gray" variant="outline" icon="i-heroicons-chevron-left" aria-label="Semaine précédente" @click="semaine = semainePrecedente(semaine)" />
            <UInput :model-value="semaine.debut" type="date" size="sm" aria-label="Un jour de la semaine" @update:model-value="choisirJour" />
            <UButton size="sm" color="gray" variant="outline" icon="i-heroicons-chevron-right" aria-label="Semaine suivante" :disabled="derniereSemaine" @click="semaine = semaineSuivante(semaine)" />
          </div>
        </UFormGroup>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <UButton
            icon="i-heroicons-presentation-chart-bar"
            :loading="generation === 'une'"
            :disabled="!rapport || loading || !!generation"
            @click="telecharger"
          >
            Télécharger le PowerPoint
          </UButton>
          <UButton
            color="gray"
            variant="outline"
            icon="i-heroicons-archive-box-arrow-down"
            :loading="generation === 'toutes'"
            :disabled="loading || !!generation || agencesActives.length < 2"
            @click="telechargerToutes"
          >
            Toutes les agences (.zip)
          </UButton>
        </div>
      </div>
      <p class="mt-3 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
        <template v-if="generation === 'toutes' && avancement">{{ avancement }}</template>
        <template v-else>Semaine {{ numeroSemaine(semaine) }}, {{ libelleSemaine(semaine) }}. Comparée à la semaine {{ libelleSemaine(semainePrecedente(semaine)) }}.</template>
      </p>
    </div>

    <AdminErreurBloc v-if="erreur" titre="La semaine de cette agence n'a pas pu être chargée." :erreur="erreur" :en-cours="loading" @reessayer="charger" />

    <div v-else-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Chargement de la semaine">
      <div v-for="i in 4" :key="i" class="admin-surface h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else-if="rapport">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Visites" :value="String(rapport.chiffres.visites)" :subtitle="sousTitre(evolution(rapport.chiffres.visites, rapport.avant.visites))" icon="i-heroicons-clipboard-document-check" color="blue" format="none" />
        <StatsCard title="Points de vente visités" :value="String(rapport.chiffres.pdv_visites)" :subtitle="`${rapport.chiffres.merchandisers_actifs} merchandisers actifs sur ${rapport.effectif}`" icon="i-heroicons-building-storefront" color="green" format="none" />
        <StatsCard title="Réalisation des tournées" :value="fmtPct(rapport.chiffres.realisation_pct)" :subtitle="`${rapport.chiffres.etapes_faites} étapes faites sur ${rapport.chiffres.pdv_programmes} programmées`" icon="i-heroicons-calendar-days" color="orange" format="none" />
        <StatsCard title="Perfect Store atteint" :value="fmtPct(rapport.chiffres.perfect_store_pct)" :subtitle="`${rapport.chiffres.pdv_perfect_store} PDV au standard sur ${rapport.chiffres.pdv_evalues} évalués`" icon="i-heroicons-trophy" color="purple" format="none" />
      </div>

      <section class="admin-surface p-5" aria-labelledby="contenu-heading">
        <h2 id="contenu-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Ce que contient la présentation</h2>
        <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Un fichier PowerPoint par agence. Les tableaux et les graphiques restent modifiables dans PowerPoint ; la dernière slide est à remplir en réunion.
        </p>
        <ol class="mt-4 grid gap-x-8 gap-y-2 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-200">
          <li v-for="(s, i) in sommaire" :key="s.titre" class="flex gap-3">
            <span class="w-5 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">{{ i + 1 }}</span>
            <span><span class="font-medium text-slate-900 dark:text-white">{{ s.titre }}</span><span v-if="s.detail" class="text-slate-600 dark:text-slate-300"> : {{ s.detail }}</span></span>
          </li>
        </ol>
      </section>

      <section class="admin-surface overflow-hidden" aria-labelledby="merch-heading">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="merch-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Performance par merchandiser</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Aperçu du tableau de la présentation, classé par nombre de visites.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Merchandiser</th>
                <th class="text-right" title="Jours avec au moins une visite">Jours</th>
                <th class="text-right">Visites</th>
                <th class="text-right">PDV visités</th>
                <th class="text-right" title="Points de vente des tournées de la semaine">Programmés</th>
                <th class="text-right" title="Étapes de tournée faites">Réalisés</th>
                <th class="text-right">Réalisation</th>
                <th class="text-right" title="PDV au standard sur PDV évalués">Au standard</th>
                <th class="text-right">Disponibilité</th>
                <th class="text-right">Visibilité</th>
                <th class="text-right">Hors tournée</th>
                <th class="text-right" title="Visites sans aucun relevé de produits ni de visibilité">Sans relevé</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in rapport.merchandisers" :key="m.id">
                <td class="font-semibold text-slate-900 dark:text-white">{{ m.nom }}</td>
                <td class="text-right tabular-nums">{{ m.jours_actifs }}</td>
                <td class="text-right tabular-nums">{{ m.visites }}</td>
                <td class="text-right tabular-nums">{{ m.pdv_visites }}</td>
                <td class="text-right tabular-nums">{{ m.pdv_programmes }}</td>
                <td class="text-right tabular-nums">{{ m.etapes_faites }}</td>
                <td class="text-right tabular-nums">{{ fmtPct(m.realisation_pct) }}</td>
                <td class="text-right tabular-nums">{{ m.pdv_evalues ? `${m.pdv_perfect_store} / ${m.pdv_evalues}` : '—' }}</td>
                <td class="text-right tabular-nums">{{ fmtPct(m.dispo_moyenne_pct) }}</td>
                <td class="text-right tabular-nums">{{ fmtPct(m.visibilite_moyenne_pct) }}</td>
                <td class="text-right tabular-nums">{{ rapport.situation.disponible ? m.hors_tournee : '—' }}</td>
                <td class="text-right tabular-nums">{{ m.visites_sans_releve }}</td>
              </tr>
              <tr v-if="!rapport.merchandisers.length">
                <td colspan="12" class="py-10 text-center text-slate-600 dark:text-slate-300">
                  Aucune visite ni tournée pour cette agence sur la semaine. Changez de semaine ou d'agence.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
// Weekly Meeting Merchandising Agency (17/11/2026) : pour une agence et une
// semaine (lundi → samedi), aperçu des chiffres et téléchargement de la
// présentation PowerPoint de la réunion hebdomadaire. Réservé aux admins
// (utils/adminNavigation.ts).
import type { Agence } from '~/utils/agences'
import { messageUtilisateur } from '~/utils/supabaseErrors'
import {
  derniereSemaineEcoulee, evolution, fmtPct, libelleSemaine, nomFichierWeekly, numeroSemaine,
  semaineHebdo, semainePrecedente, semaineSuivante,
  type Evolution, type RapportHebdo, type SemaineHebdo,
} from '~/utils/weeklyMeeting'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const toast = useToast()
const { actives: agencesActives, charger: chargerAgences } = useAgences()
const { chargerRapport, genererPptx } = useWeeklyMeeting()

const agenceCode = ref('')
const semaine = ref<SemaineHebdo>(derniereSemaineEcoulee())
const rapport = ref<RapportHebdo | null>(null)
const loading = ref(true)
const erreur = ref<unknown>(null)
const generation = ref<'' | 'une' | 'toutes'>('')
const avancement = ref('')

const optionsAgences = computed(() => agencesActives.value.map(a => ({ label: a.nom, value: a.code })))
const agence = computed<Agence | null>(() => agencesActives.value.find(a => a.code === agenceCode.value) ?? null)
// Pas de semaine au-delà de celle en cours.
const derniereSemaine = computed(() => semaine.value.debut >= semaineHebdo(new Date()).debut)

function choisirJour(jour: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return
  const choisie = semaineHebdo(jour)
  const courante = semaineHebdo(new Date())
  semaine.value = choisie.debut > courante.debut ? courante : choisie
}

const sousTitre = (e: Evolution) => (e.sens === 'inconnu' ? e.texte : `${e.texte} par rapport à la semaine précédente`)

const sommaire = computed(() => {
  const r = rapport.value
  if (!r) return []
  const references = r.skus.filter(s => s.releves > 0).length
  return [
    { titre: 'Couverture', detail: `${r.agence.nom}, semaine ${numeroSemaine(r.semaine)}` },
    { titre: 'Chiffres clés', detail: `${r.chiffres.visites} visites, ${r.chiffres.pdv_visites} points de vente` },
    { titre: 'Routing', detail: `${r.chiffres.tournees} tournées, ${fmtPct(r.chiffres.realisation_pct)} de réalisation` },
    { titre: 'Perfect Store', detail: `${fmtPct(r.chiffres.perfect_store_pct)} atteint, disponibilité ${fmtPct(r.chiffres.dispo_moyenne_pct)}` },
    { titre: 'Performance par merchandiser', detail: `${r.merchandisers.length} merchandisers` },
    { titre: 'Disponibilité des produits', detail: references ? `${references} références relevées` : 'aucun relevé de produits' },
    { titre: 'Visibilité et concurrence', detail: `${r.visibilite.length} éléments de visibilité, concurrent présent dans ${fmtPct(r.concurrence.presence_pct)} des visites` },
    { titre: 'Alertes', detail: `${r.fermetures.length} PDV signalés fermés, ${r.chiffres.visites_sans_releve} visites sans relevé, ${r.sans_visite.length} merchandisers sans visite` },
    { titre: 'Photos de la semaine', detail: r.photos.length ? 'jusqu’à 6 photos de visite' : 'aucune photo sur la semaine' },
    { titre: 'Actions pour la semaine suivante', detail: 'à remplir en réunion' },
  ]
})

// Un changement d'agence ou de semaine pendant un chargement : seule la
// dernière demande s'affiche.
let demande = 0
async function charger() {
  if (!agence.value) return
  const moi = ++demande
  loading.value = true
  erreur.value = null
  try {
    const r = await chargerRapport(agence.value, semaine.value)
    if (moi === demande) rapport.value = r
  }
  catch (err) {
    if (moi !== demande) return
    console.error('Weekly Meeting : chargement impossible', err)
    erreur.value = err
    rapport.value = null
  }
  finally {
    if (moi === demande) loading.value = false
  }
}

function enregistrer(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  URL.revokeObjectURL(url)
}

async function telecharger() {
  if (!rapport.value) return
  generation.value = 'une'
  try {
    enregistrer(await genererPptx(rapport.value), nomFichierWeekly(rapport.value.agence.nom, rapport.value.semaine))
  }
  catch (err) {
    console.error('Weekly Meeting : génération impossible', err)
    toast.add({ title: 'Présentation non générée', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    generation.value = ''
  }
}

/** Une présentation par agence active, dans une archive. Les agences sans visite sur la semaine sont laissées de côté. */
async function telechargerToutes() {
  generation.value = 'toutes'
  const s = semaine.value
  try {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const sansActivite: string[] = []
    for (const [i, a] of agencesActives.value.entries()) {
      avancement.value = `Présentation ${i + 1} sur ${agencesActives.value.length} : ${a.nom}…`
      const r = a.code === rapport.value?.agence.code && s.debut === rapport.value.semaine.debut ? rapport.value : await chargerRapport(a, s)
      if (!r.chiffres.visites) {
        sansActivite.push(a.nom)
        continue
      }
      zip.file(nomFichierWeekly(a.nom, s), await genererPptx(r))
    }
    const nb = agencesActives.value.length - sansActivite.length
    if (!nb) {
      toast.add({ title: 'Aucune présentation', description: 'Aucune agence n’a de visite sur cette semaine.', color: 'orange' })
      return
    }
    enregistrer(await zip.generateAsync({ type: 'blob' }), `weekly-meeting-${s.debut}.zip`)
    toast.add({
      title: `${nb} ${nb > 1 ? 'présentations générées' : 'présentation générée'}`,
      description: sansActivite.length ? `Sans visite sur la semaine, laissées de côté : ${sansActivite.join(', ')}.` : undefined,
      color: 'green',
    })
  }
  catch (err) {
    console.error('Weekly Meeting : archive impossible', err)
    toast.add({ title: 'Archive non générée', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    generation.value = ''
    avancement.value = ''
  }
}

watch([agenceCode, semaine], charger)

onMounted(async () => {
  await chargerAgences()
  // Première agence « programme » (Atom BTL…) : c'est elle que suit la réunion hebdomadaire.
  agenceCode.value = (agencesActives.value.find(a => a.programme) ?? agencesActives.value[0])?.code ?? ''
  if (!agenceCode.value) loading.value = false
})
</script>
