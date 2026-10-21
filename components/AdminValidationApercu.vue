<template>
  <AdminFormModal
    v-model="ouvert"
    :title="resultat?.simulation ? 'Aperçu des corrections' : 'Corrections appliquées'"
    :description="resultat?.simulation ? 'Rien n\'est encore écrit : voici ce qui changerait.' : 'Le routing, les boutiques et les profils sont à jour ; les tournées à venir ont été refaites.'"
    icon="i-heroicons-eye" width="sm:max-w-4xl" body-class="space-y-5"
  >
    <template v-if="resultat">
      <p v-if="!resultat.merchandisers.length && !resultat.boutiques_fermees.length" class="text-sm text-slate-600">
        Aucune correction retenue pour l'instant : choisissez quoi faire dans le détail de chaque merchandiser.
      </p>

      <section v-for="m in resultat.merchandisers" :key="m.merchandiser_id" class="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ m.nom }}</h3>
        <table v-if="m.jours.length" class="admin-table w-full">
          <thead><tr><th>Semaine</th><th>Jour</th><th>Avant</th><th>Après</th><th class="text-right">Boutiques avant → après</th></tr></thead>
          <tbody>
            <tr v-for="j in m.jours" :key="`${j.semaine}-${j.jour}`">
              <td class="tabular-nums">{{ j.semaine }}</td>
              <td>{{ JOURS[j.jour] }}</td>
              <td>{{ j.avant }}</td>
              <td class="font-medium text-slate-900 dark:text-white">{{ j.apres || 'Pas de visite' }}</td>
              <td class="text-right tabular-nums">{{ j.boutiques_avant }} → {{ j.boutiques_apres }}</td>
            </tr>
          </tbody>
        </table>
        <ul class="space-y-1 text-sm text-slate-700 dark:text-slate-200">
          <li>Boutiques du mois : {{ m.boutiques_avant }} → {{ m.boutiques_apres }}</li>
          <li v-if="m.boutiques_changent_de_jour">{{ m.boutiques_changent_de_jour }} boutiques changent de jour</li>
          <li v-if="m.boutiques_sorties || m.boutiques_entrees">{{ m.boutiques_sorties }} boutiques quittent son mois, {{ m.boutiques_entrees }} y entrent</li>
          <li v-if="m.zones">
            Territoires : {{ liste(m.zones.avant.territoires_assignes) }} → <b>{{ liste(m.zones.apres.territoires_assignes) }}</b>
            <span class="block text-xs text-slate-500">Quartiers : {{ (m.zones.avant.quartiers_assignes || []).length }} → {{ (m.zones.apres.quartiers_assignes || []).length }}</span>
          </li>
        </ul>
      </section>

      <section
        v-if="resultat.boutiques_autre_merchandiser.length" class="rounded-lg border p-4 text-sm"
        :class="resultat.boutiques_sans_tournee ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40' : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'"
      >
        <h3 class="font-semibold text-slate-900 dark:text-white">
          <template v-if="resultat.boutiques_sans_tournee">{{ resultat.boutiques_sans_tournee }} boutiques ne seraient plus dans aucune tournée</template>
          <template v-else>Boutiques qui changent de merchandiser</template>
        </h3>
        <p class="mt-1 text-slate-700 dark:text-slate-200">
          Une boutique va au point de visite le plus proche. En déplaçant un point, certaines tombent chez un collègue ;
          si ce collègue ne travaille pas avec leur distributeur, plus personne ne les visite.
        </p>
        <ul class="mt-2 space-y-1">
          <li v-for="(b, i) in resultat.boutiques_autre_merchandiser" :key="i">
            {{ b.boutiques }} boutiques de {{ nomPropre(b.de) }} vont vers {{ nomPropre(b.vers) }}
            <b v-if="b.sans_tournee" class="text-red-700 dark:text-red-400">— {{ b.sans_tournee === b.boutiques ? 'aucune' : `${b.boutiques - b.sans_tournee}` }} reprise{{ b.boutiques - b.sans_tournee > 1 ? 's' : '' }} (autre distributeur)</b>
          </li>
        </ul>
      </section>

      <section v-if="resultat.boutiques_fermees.length" class="text-sm">
        <h3 class="font-semibold text-slate-900 dark:text-white">Boutiques fermées ({{ resultat.boutiques_fermees.length }})</h3>
        <p class="text-slate-700 dark:text-slate-200">{{ resultat.boutiques_fermees.map((b: any) => b.nom).join(', ') }}</p>
      </section>

      <p v-if="resultat.simulation && resultat.fiches_manquantes.length" class="text-sm text-amber-800 dark:text-amber-300">
        « Appliquer » attend encore les fiches de : {{ resultat.fiches_manquantes.map(nomPropre).join(', ') }}.
      </p>
      <p v-if="resultat.tournees?.some((t: any) => !t.ok)" class="text-sm text-red-700" role="alert">
        Tournées à refaire à la main (Maintenance) pour : {{ resultat.tournees.filter((t: any) => !t.ok).map((t: any) => nomPropre(t.nom)).join(', ') }}.
      </p>
    </template>
  </AdminFormModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: boolean; resultat: any }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const ouvert = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const liste = (l: string[] | null) => (l || []).join(', ') || '—'
const nomPropre = (s: string) => String(s || '').toLowerCase().replace(/(^|[\s-])\p{L}/gu, c => c.toUpperCase())
</script>
