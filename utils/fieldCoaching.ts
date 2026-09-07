// utils/fieldCoaching.ts
// Field coaching (lot 4) : questionnaire Kobo « Suivi des activités de
// prospection (Rooting) ». Les 13 questions à trois états gardent un code
// stable pour rester comparables avec l'historique Kobo.
export type ReponseCoaching = 'oui' | 'non' | 'na'

export interface QuestionCoaching {
  code: string
  bloc: 'visibilite' | 'promotion'
  libelle: string
}

export const BLOCS_COACHING = {
  visibilite: 'II_1.2 — Perfect Visibility',
  promotion: 'II_1.3 — Effective Promotion',
} as const

export const QUESTIONS_COACHING: QuestionCoaching[] = [
  { code: 'hot_spot', bloc: 'visibilite', libelle: 'Le PDV dispose-t-il d\'un hot spot Bonnet Rouge ?' },
  { code: 'maison_br_habillee', bloc: 'visibilite', libelle: 'La Maison Bonnet Rouge est-elle habillée ?' },
  { code: 'rangement', bloc: 'visibilite', libelle: 'Les produits sont-ils bien rangés ?' },
  { code: 'presentoir', bloc: 'visibilite', libelle: 'Un présentoir Bonnet Rouge est-il en place ?' },
  { code: 'emplacement_secondaire', bloc: 'visibilite', libelle: 'Existe-t-il un emplacement secondaire ?' },
  { code: 'visibilite_exterieure', bloc: 'visibilite', libelle: 'La visibilité extérieure est-elle assurée ?' },
  { code: 'qr_code', bloc: 'visibilite', libelle: 'Le QR code est-il présent ?' },
  { code: 'concept_3_hotspots', bloc: 'visibilite', libelle: 'Le concept 3 hotspots est-il appliqué ?' },
  { code: 'pdv_informe', bloc: 'promotion', libelle: 'Le PDV est-il informé de la promotion en cours ?' },
  { code: 'participation', bloc: 'promotion', libelle: 'Le PDV participe-t-il à la promotion ?' },
  { code: 'gratuit_gadget', bloc: 'promotion', libelle: 'Le PDV a-t-il reçu le gratuit ou le gadget ?' },
  { code: 'respect_mecanisme', bloc: 'promotion', libelle: 'Le mécanisme de la promotion est-il respecté ?' },
  { code: 'respect_prix', bloc: 'promotion', libelle: 'Les prix sont-ils respectés ?' },
]

export const ROUTE_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export const ENGINS_DEFAUT = [
  { code: 'van', libelle: 'Van', ordre: 10, actif: true },
  { code: 'mini_van', libelle: 'Mini Van', ordre: 20, actif: true },
  { code: 'tricycle', libelle: 'Tricycle', ordre: 30, actif: true },
  { code: 'moto', libelle: 'Moto', ordre: 40, actif: true },
  { code: 'truck', libelle: 'Truck', ordre: 50, actif: true },
]

export const REPONSES: { value: ReponseCoaching; label: string }[] = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'na', label: 'N/A' },
]

export function reponsesVides(): Record<string, ReponseCoaching | ''> {
  return Object.fromEntries(QUESTIONS_COACHING.map(q => [q.code, '']))
}

export function questionsDuBloc(bloc: QuestionCoaching['bloc']): QuestionCoaching[] {
  return QUESTIONS_COACHING.filter(q => q.bloc === bloc)
}

// Toutes les questions doivent être répondues (N/A compris).
export function evaluationComplete(reponses: Record<string, string | undefined>): boolean {
  return QUESTIONS_COACHING.every(q => ['oui', 'non', 'na'].includes(reponses[q.code] || ''))
}

// Score d'un bloc (ou global) : oui / (oui + non), les N/A sont exclus.
// null quand aucune question applicable.
export function scoreCoaching(
  reponses: Record<string, string | undefined>,
  bloc?: QuestionCoaching['bloc'],
): { oui: number; non: number; na: number; taux: number | null } {
  const qs = bloc ? questionsDuBloc(bloc) : QUESTIONS_COACHING
  let oui = 0, non = 0, na = 0
  for (const q of qs) {
    const r = reponses[q.code]
    if (r === 'oui') oui++
    else if (r === 'non') non++
    else if (r === 'na') na++
  }
  const total = oui + non
  return { oui, non, na, taux: total ? Math.round((oui / total) * 100) : null }
}

export interface IdentificationCoaching {
  pdv_id?: string
  distributeur_nom?: string
  engin_code?: string
  nb_sku_pdv?: number | null
  nb_sku_dispo?: number | null
}

// Contrôles de cohérence du formulaire.
export function erreursIdentification(f: IdentificationCoaching): string[] {
  const erreurs: string[] = []
  if (!f.pdv_id) erreurs.push('Le point de vente est obligatoire.')
  if (!f.distributeur_nom) erreurs.push('Le distributeur est obligatoire.')
  if (!f.engin_code) erreurs.push("L'engin de vente est obligatoire.")
  if (f.nb_sku_pdv != null && f.nb_sku_dispo != null && f.nb_sku_dispo > f.nb_sku_pdv) {
    erreurs.push('Le nombre de SKU disponibles ne peut pas dépasser le nombre de SKU en PDV.')
  }
  return erreurs
}
