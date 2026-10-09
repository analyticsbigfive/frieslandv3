// Réglages de Nuxt UI (DESIGN.md, « Registre net »).
// - primary = brand (rouge Bonnet Rouge) : sans ce fichier, Nuxt UI applique son
//   vert par défaut aux boutons, champs, cases, pagination et anneaux de focus.
// - gray = slate : toutes les classes gray-* du projet suivent la gamme slate
//   (une seule famille de gris).
// - Boutons : le rouge est réservé à l'action principale (variante pleine).
//   Les variantes contour et discrète sans couleur explicite servent aux
//   actions secondaires (Exporter, Importer, Réinitialiser…) : neutres.
export default defineAppConfig({
  ui: {
    primary: 'brand',
    gray: 'slate',
    button: {
      color: {
        primary: {
          outline: 'ring-1 ring-inset ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:bg-white aria-disabled:bg-white dark:disabled:bg-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400',
          ghost: 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:bg-transparent aria-disabled:bg-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400',
        },
      },
    },
  },
})
