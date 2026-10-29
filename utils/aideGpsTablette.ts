// utils/aideGpsTablette.ts
// Tous les textes de l'écran d'aide GPS (components/AideGpsTablette.vue), à
// un seul endroit : l'écran les affiche, et la fiche envoyée à ATOM
// (aide_gps_galaxy_tab.md) est produite à partir de ce fichier. Données
// seules : pas d'import Nuxt ni d'alias « ~ ».
// Écrits pour la Samsung Galaxy Tab A11 (One UI) des merchandisers ATOM.
import type { CauseBlocageGps } from './gpsVisite'

/** A : localisation coupée. B : autorisation refusée ou approximative. C : position lente ou imprécise. */
export type CasAideGps = 'A' | 'B' | 'C'

export function casAideGps(cause: CauseBlocageGps): CasAideGps {
  if (cause === 'desactive') return 'A'
  if (cause === 'permission' || cause === 'approximative') return 'B'
  return 'C'
}

export type EtapeAideGps = {
  /** Ce qu'il faut faire, en une phrase. */
  texte: string
  /** Le chemin exact dans les menus, ou une précision. */
  detail?: string
}

export const NOM_APP_TABLETTE = 'Friesland Bonnet Rouge'

export const TEXTES_GPS = {
  titreBloque: 'Pas de position, pas de visite',
  recherche: 'Recherche de la position…',
  precisionActuelle: (m: number) => `précision actuelle : ${Math.round(m)} m`,
  precisionDemandee: (m: number) => `${Math.round(m)} m demandés`,
  meilleurePrecision: (m: number) => `Meilleure précision obtenue : ${Math.round(m)} m`,
  attente: 'Restez immobile, si possible près d\'une porte ou d\'une fenêtre.',
  reessayer: 'Réessayer',
  fermer: 'Fermer',
  noteMenus: 'Selon la version de la tablette, le nom des menus peut changer un peu. Cherchez le mot le plus proche.',
  menuPlus: 'Aide GPS de la tablette',
  menuPlusDescription: 'Que faire si la tablette ne trouve pas la position',
  verifier: 'Vérifier ma position',
  positionTrouvee: (m: number) => `Position trouvée, précision ${Math.round(m)} m : la visite peut démarrer.`,
  modeleChemin: 'Numéro de modèle : Paramètres → À propos de la tablette → Numéro de modèle.',
  modeleWifi: 'Cette tablette est un modèle Wi-Fi seul, sans puce GPS : la position vient du Wi-Fi. Gardez le Wi-Fi et la Recherche Wi-Fi allumés (cas C).',
  modeleGps: 'Cette tablette a une puce GPS.',
}

/**
 * Galaxy Tab A11 : SM-X130 = Wi-Fi seul (pas de puce GPS) ; SM-X135 et
 * SM-X133 = cellulaire, avec GPS. Autre modèle : on ne sait pas.
 */
export function typeTablette(modele: string | null | undefined): 'wifi' | 'gps' | null {
  const m = (modele || '').toUpperCase()
  if (/SM-X130\b/.test(m)) return 'wifi'
  if (/SM-X13[35]\b/.test(m)) return 'gps'
  return null
}

export const CAS_AIDE_GPS: Record<CasAideGps, { titre: string, explication: string }> = {
  A: {
    titre: 'La localisation de la tablette est coupée',
    explication: 'Sans localisation, l\'application ne peut pas savoir où vous êtes. Allumez-la, puis appuyez sur « Réessayer ».',
  },
  B: {
    titre: 'L\'application n\'a pas le droit de lire votre position',
    explication: 'Il faut autoriser la position, et la position exacte. Une position « approximative » se trompe de plusieurs centaines de mètres.',
  },
  C: {
    titre: 'La tablette ne trouve pas une position assez précise',
    explication: 'La position arrive lentement ou reste imprécise, surtout à l\'intérieur. Ces réglages aident la tablette à la trouver plus vite.',
  },
}

export const ETAPES_AIDE_GPS: Record<CasAideGps, EtapeAideGps[]> = {
  A: [
    { texte: 'Faites glisser votre doigt du haut de l\'écran vers le bas, deux fois.', detail: 'Les boutons rapides s\'ouvrent en grand.' },
    { texte: 'Appuyez sur le bouton « Localisation » pour qu\'il devienne bleu.', detail: 'S\'il n\'est pas visible, faites glisser les boutons vers la gauche. Ou : Paramètres → Localisation → Activé.' },
    { texte: 'Revenez dans l\'application et appuyez sur « Réessayer ».' },
  ],
  B: [
    { texte: 'Ouvrez les Paramètres de la tablette (la roue dentée).' },
    { texte: 'Appuyez sur « Applications », puis sur « ' + NOM_APP_TABLETTE + ' ».', detail: 'Si vous utilisez le site dans Chrome, choisissez « Chrome ».' },
    { texte: 'Appuyez sur « Autorisations », puis sur « Localisation ».' },
    { texte: 'Choisissez « Autoriser uniquement pendant l\'utilisation de l\'application ».' },
    { texte: 'Allumez « Utiliser la position exacte ».', detail: 'Sans ce réglage, la position est approximative et la visite ne démarre pas.' },
    { texte: 'Revenez dans l\'application et appuyez sur « Réessayer ».' },
  ],
  C: [
    { texte: 'Ouvrez Paramètres → Localisation → Services de localisation.' },
    { texte: 'Allumez « Précision de la localisation Google ».' },
    { texte: 'Allumez « Recherche Wi-Fi ».', detail: 'Elle aide même sans être connecté à un réseau Wi-Fi.' },
    { texte: 'Laissez le Wi-Fi allumé.' },
    { texte: 'Coupez « Économie d\'énergie ».', detail: 'Paramètres → Batterie (ou Entretien de l\'appareil) → Économie d\'énergie.' },
    { texte: 'Approchez-vous de la porte du point de vente et attendez 30 secondes, puis appuyez sur « Réessayer ».' },
  ],
}

/** Cas B dans Chrome (site web) : en plus des étapes ci-dessus, autoriser le site. */
export const ETAPES_AIDE_GPS_CHROME: EtapeAideGps[] = [
  { texte: 'Dans Chrome, appuyez sur ⋮ (en haut à droite), puis sur « Paramètres ».' },
  { texte: 'Appuyez sur « Paramètres des sites », puis sur « Position ».' },
  { texte: 'Autorisez le site de Bonnet Rouge (retirez-le de la liste « Bloqués »).' },
]
