<template>
  <AdminFormModal v-model="ouvert" title="Vue d'ensemble des retours" :description="`${envoyees} fiche${envoyees > 1 ? 's' : ''} envoyée${envoyees > 1 ? 's' : ''} sur ${fiches.length}. Tous les commentaires des merchandisers.`" icon="i-heroicons-clipboard-document-list" width="sm:max-w-5xl" body-class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Fiches affichées">
        <button
          v-for="f in FILTRES" :key="f.id" type="button" :aria-pressed="filtre === f.id"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="filtre === f.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
          @click="filtre = f.id"
        >
          {{ f.texte }}
        </button>
      </div>
      <UButton size="sm" variant="outline" icon="i-heroicons-clipboard-document" @click="copierTexte">Copier le texte</UButton>
    </div>

    <p v-if="!affichees.length" class="text-sm text-slate-600">Aucune fiche dans ce filtre.</p>

    <article v-for="f in affichees" :key="f.id" class="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <header class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ f.nom }}</h3>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <UBadge :color="f.statut === 'validee' ? 'green' : f.statut === 'en_cours' ? 'amber' : 'gray'" variant="subtle" size="xs">{{ f.statutTexte }}</UBadge>
          · {{ f.joursTraites }} / {{ f.joursTotal }} jours répondus
        </p>
      </header>

      <p v-if="f.remarque" class="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800"><b>Remarque :</b> {{ f.remarque }}</p>

      <div v-if="f.jours.length">
        <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Jours à changer</h4>
        <ul class="mt-1 space-y-1 text-sm">
          <li v-for="j in f.jours" :key="j.id">
            <b>Semaine {{ j.semaine }}, {{ j.jourTexte.toLowerCase() }}</b> — {{ j.point }} :
            <span :class="j.decision === 'retirer' ? 'text-red-700' : 'text-amber-700'">{{ j.decision === 'retirer' ? 'à retirer' : 'à modifier' }}</span>
            <span v-if="j.commentaire"> · « {{ j.commentaire }} »</span>
            <span v-else class="text-slate-500"> · sans commentaire</span>
            <span class="text-slate-600 dark:text-slate-300"> → {{ j.choix }}</span>
          </li>
        </ul>
      </div>
      <p v-else-if="f.joursTraites" class="text-sm text-slate-600 dark:text-slate-300">Tous les jours répondus sont validés.</p>

      <div v-if="f.boutiques.length">
        <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Boutiques signalées</h4>
        <ul class="mt-1 space-y-1 text-sm">
          <li v-for="b in f.boutiques" :key="b.id">
            {{ b.nom }} ({{ b.motif }}<template v-if="b.point">, {{ b.point }}</template>)
            <span v-if="b.commentaire"> · « {{ b.commentaire }} »</span>
            <span v-if="b.doublon" class="font-semibold text-amber-700"> · même nom plusieurs fois au même point</span>
            <span class="text-slate-600 dark:text-slate-300"> → {{ b.choix }}</span>
          </li>
        </ul>
      </div>

      <div v-if="f.zones.non.length || f.zones.ecarts.length || f.zonesRemarque">
        <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Zones</h4>
        <ul class="mt-1 space-y-1 text-sm">
          <li v-if="f.zones.oui.length">Répond « oui » à : {{ f.zones.oui.join(', ') }}</li>
          <li v-if="f.zones.non.length">Répond « non » à : <span class="text-amber-700">{{ f.zones.non.join(', ') }}</span></li>
          <li v-if="f.zones.aModifie">
            A coché :
            <template v-if="f.zones.ecarts.length">
              <span v-for="(e, i) in f.zones.ecarts" :key="i">{{ i ? ', ' : '' }}<span :class="e.action === 'Ajouter' ? 'text-green-700' : 'text-amber-700'">{{ e.action === 'Ajouter' ? '+' : '−' }} {{ e.libelle }}</span><span v-if="e.type !== 'Territoire'" class="text-slate-500"> ({{ e.type.toLowerCase() }})</span></span>
            </template>
            <template v-else>pareil que son profil</template>
          </li>
          <li v-else-if="f.zones.non.length" class="text-slate-600 dark:text-slate-300">Liste des zones cochées non modifiée : ses « oui / non » font foi.</li>
          <li v-if="f.zonesRemarque">Texte libre : « {{ f.zonesRemarque }} »</li>
          <li v-if="f.zones.retenues" class="text-slate-600 dark:text-slate-300">→ Retenu pour le profil : {{ f.zones.retenues }}</li>
        </ul>
      </div>
    </article>
  </AdminFormModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type FicheVueEnsemble = {
  id: string
  nom: string
  statut: string
  statutTexte: string
  joursTraites: number
  joursTotal: number
  remarque: string | null
  zonesRemarque: string | null
  jours: { id: string; semaine: number; jourTexte: string; point: string; decision: string; commentaire: string; choix: string }[]
  boutiques: { id: string; nom: string; motif: string; point: string; commentaire: string; doublon: boolean; choix: string }[]
  zones: { oui: string[]; non: string[]; ecarts: { type: string; libelle: string; action: string }[]; aModifie: boolean; retenues: string }
}

const props = defineProps<{ modelValue: boolean; fiches: FicheVueEnsemble[]; mois: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const ouvert = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })

const FILTRES = [{ id: 'envoyees', texte: 'Fiches envoyées' }, { id: 'toutes', texte: 'Toutes' }]
const filtre = ref('envoyees')
const envoyees = computed(() => props.fiches.filter(f => f.statut === 'validee').length)
const affichees = computed(() => props.fiches.filter(f => filtre.value === 'toutes' || f.statut === 'validee'))

const toast = useToast()
async function copierTexte() {
  const lignes: string[] = [`Retours des merchandisers — ${props.mois}`]
  for (const f of affichees.value) {
    lignes.push('', `${f.nom} (${f.statutTexte}, ${f.joursTraites}/${f.joursTotal} jours)`)
    if (f.remarque) lignes.push(`Remarque : ${f.remarque}`)
    for (const j of f.jours) lignes.push(`- Semaine ${j.semaine}, ${j.jourTexte.toLowerCase()}, ${j.point} : ${j.decision === 'retirer' ? 'à retirer' : 'à modifier'}${j.commentaire ? ` « ${j.commentaire} »` : ''} → ${j.choix}`)
    for (const b of f.boutiques) lignes.push(`- Boutique ${b.nom} (${b.motif}${b.point ? `, ${b.point}` : ''})${b.doublon ? ' — même nom plusieurs fois au même point' : ''} → ${b.choix}`)
    if (f.zones.non.length) lignes.push(`- Zones « non » : ${f.zones.non.join(', ')}`)
    if (f.zones.aModifie && f.zones.ecarts.length) lignes.push(`- Zones cochées : ${f.zones.ecarts.map(e => `${e.action === 'Ajouter' ? '+' : '−'} ${e.libelle}`).join(', ')}`)
    if (f.zonesRemarque) lignes.push(`- Texte libre sur les zones : « ${f.zonesRemarque} »`)
  }
  try {
    await navigator.clipboard.writeText(lignes.join('\n'))
    toast.add({ title: 'Texte copié', color: 'green' })
  }
  catch {
    toast.add({ title: 'Copie impossible', color: 'amber' })
  }
}
</script>
