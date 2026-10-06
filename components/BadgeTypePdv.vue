<template>
  <span
    v-if="libelle"
    class="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold"
    :class="classes"
    :title="titre"
  >
    {{ libelle }}
  </span>
</template>

<script setup lang="ts">
// Badge du type de PDV : canal Atom (grille des tournées par quotas) s'il y en
// a un, sinon la sous-catégorie brute, sinon rien. Le mapping vit dans
// utils/canalAtom.ts (réplique de la fonction SQL canal_atom).
import { canalAtom, libelleTypePdv, type CanalAtom } from '~/utils/canalAtom'

const props = defineProps<{ sousCategorie?: string | null }>()

// Classes écrites en entier (pas de concaténation) : Tailwind ne génère que
// ce qu'il lit tel quel dans les fichiers scannés.
const COULEURS: Record<CanalAtom, string> = {
  'Superette': 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  'Boutique': 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  'Aboki & Kiosque': 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  'Pushcart': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Porridge': 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
}
const HORS_GRILLE = 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300'

const canal = computed(() => canalAtom(props.sousCategorie))
const libelle = computed(() => libelleTypePdv(props.sousCategorie))
const classes = computed(() => (canal.value ? COULEURS[canal.value] : HORS_GRILLE))
// La sous-catégorie exacte reste lisible au survol.
const titre = computed(() => (canal.value && props.sousCategorie ? `${canal.value} — ${props.sousCategorie}` : undefined))
</script>
