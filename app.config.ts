// Réglages de Nuxt UI (DESIGN.md, « Registre net »).
// - primary = brand (rouge Bonnet Rouge) : sans ce fichier, Nuxt UI applique son
//   vert par défaut aux boutons, champs, cases, pagination et anneaux de focus.
// - gray = slate : toutes les classes gray-* du projet suivent la gamme slate
//   (une seule famille de gris).
// - Boutons : le rouge est réservé à l'action principale (variante pleine).
//   Les variantes contour et discrète sans couleur explicite servent aux
//   actions secondaires (Exporter, Importer, Réinitialiser…) : neutres.
// - Bouton plein en sombre : Nuxt UI passe à primary-400 avec un texte slate-900
//   (3,6:1). On garde primary-500 et un texte blanc (5,9:1) dans les deux thèmes.
// - Placeholders et valeur vide (« Tous », « Toutes », « Rôle ») : slate-500
//   sur blanc (4,8:1) et slate-400 sur slate-900 (7:1), au lieu de slate-400
//   (2,6:1) par défaut.
const PLACEHOLDER = 'placeholder-gray-500 dark:placeholder-gray-400'
const VALEUR_VIDE = 'text-gray-500 dark:text-gray-400'

export default defineAppConfig({
  ui: {
    primary: 'brand',
    gray: 'slate',
    button: {
      color: {
        primary: {
          solid: 'shadow-sm text-white dark:text-white bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500 aria-disabled:bg-primary-500 dark:bg-primary-500 dark:hover:bg-primary-600 dark:disabled:bg-primary-500 dark:aria-disabled:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:focus-visible:outline-primary-300',
          outline: 'ring-1 ring-inset ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:bg-white aria-disabled:bg-white dark:disabled:bg-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300',
          ghost: 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:bg-transparent aria-disabled:bg-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300',
        },
        // Rouge d'erreur : retirer un élément d'une liste (discret) ou confirmer
        // une suppression (plein, dans la fenêtre de confirmation seulement).
        // red-500 par défaut : 3,8:1 en texte blanc ou sur blanc. On passe à
        // red-700 en texte (6,5:1) et red-600 en fond plein (4,8:1).
        red: {
          solid: 'shadow-sm text-white dark:text-white bg-red-600 hover:bg-red-700 disabled:bg-red-600 aria-disabled:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 dark:disabled:bg-red-600 dark:aria-disabled:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:focus-visible:outline-red-300',
          ghost: 'text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600 dark:focus-visible:ring-red-300',
          soft: 'text-red-700 dark:text-red-300 bg-red-50 hover:bg-red-100 disabled:bg-red-50 aria-disabled:bg-red-50 dark:bg-red-950 dark:hover:bg-red-900 dark:disabled:bg-red-950 dark:aria-disabled:bg-red-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600 dark:focus-visible:ring-red-300',
        },
      },
    },
    input: {
      placeholder: PLACEHOLDER,
    },
    textarea: {
      placeholder: PLACEHOLDER,
    },
    select: {
      placeholder: VALEUR_VIDE,
    },
    inputMenu: {
      empty: `text-sm ${VALEUR_VIDE} px-2 py-1.5`,
      option: {
        empty: `text-sm ${VALEUR_VIDE} px-2 py-1.5`,
      },
    },
    selectMenu: {
      input: PLACEHOLDER,
      empty: `text-sm ${VALEUR_VIDE} px-2 py-1.5`,
      option: {
        empty: `text-sm ${VALEUR_VIDE} px-2 py-1.5`,
      },
    },
  },
})
