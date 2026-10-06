// utils/objectifsAtom.ts
// Objectifs par canal d'un merchandiser Atom (tournées en mode quota), sur une
// période (semaine ou mois), et comptage du planifié / réalisé.
//
// L'OBJECTIF reproduit ce que la base demande jour après jour : pour chaque jour
// de la période où une règle quota s'applique (même filtre que la fonction SQL
// routing_regles_du_jour), on ajoute le quota de la grille routing_quota_canal
// pour ce jour de semaine. C'est exactement ce que etapes_quota_du_jour pioche
// quand le portefeuille suffit.
//
// Pourquoi pas le comptage des tournées planifiées ? Elles ne sont
// pré-générées que jusqu'à J+7 (le mois serait sous-estimé), et un déficit de
// canal est complété en boutiques (le planifié par canal ne reflète plus la
// grille). On l'affiche à côté, à titre d'information.
//
// Dates en AAAA-MM-JJ, calculées sur l'heure LOCALE (voir utils/periode.ts).

import { canalAtom, CANAUX_ATOM, type CanalAtom } from './canalAtom'

/** Ligne de public.routing_quota_canal (jour_semaine : 0 = dimanche … 6 = samedi). */
export interface QuotaCanal {
  canal: string
  jour_semaine: number
  quota: number
}

/** Champs d'une règle (routing_templates) utiles au filtre du jour. */
export interface RegleQuota {
  id: string
  days_of_week?: number[] | null
  day_of_week?: number | null
  date_debut?: string | null
  date_fin?: string | null
  is_active?: boolean | null
}

/** Suspension de toute une règle (routing_template_exception sans pdv_id). */
export interface SuspensionRegle {
  template_id: string
  pdv_id?: string | null
  date_debut: string
  date_fin: string
}

/** Compteurs par canal ; « Hors grille » = PDV sans canal Atom (grossiste…). */
export type ParCanal = Record<CanalAtom | 'Hors grille', number>

export function compteursVides(): ParCanal {
  return { 'Superette': 0, 'Boutique': 0, 'Aboki & Kiosque': 0, 'Pushcart': 0, 'Porridge': 0, 'Hors grille': 0 }
}

/** Jour de semaine (0 = dimanche, convention extract(dow) / getDay()) d'un AAAA-MM-JJ. */
export function jourSemaine(jourIso: string): number {
  const [a, m, j] = jourIso.split('-').map(Number)
  return new Date(a, m - 1, j).getDay()
}

/** Tous les jours de la plage, bornes incluses, en AAAA-MM-JJ. */
export function joursDeLaPlage(debut: string, fin: string): string[] {
  const [a, m, j] = debut.split('-').map(Number)
  const d = new Date(a, m - 1, j)
  const jours: string[] = []
  // Garde-fou : une plage inversée ou absurde ne boucle pas indéfiniment.
  for (let i = 0; i < 400; i++) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (iso > fin) break
    jours.push(iso)
    d.setDate(d.getDate() + 1)
  }
  return jours
}

/**
 * La règle s'applique-t-elle ce jour ? Même filtre que routing_regles_du_jour
 * (supabase/nouveau/20260730140000_friesland_routing_recurrent.sql) : active,
 * jour de semaine dans days_of_week (ou day_of_week historique), dans
 * [date_debut, date_fin], pas suspendue en entier par une exception.
 */
export function regleSAppliqueLe(regle: RegleQuota, jourIso: string, suspensions: SuspensionRegle[] = []): boolean {
  if (regle.is_active === false) return false
  const jours = regle.days_of_week ?? (regle.day_of_week != null ? [regle.day_of_week] : [])
  if (!jours.includes(jourSemaine(jourIso))) return false
  if (regle.date_debut && jourIso < regle.date_debut) return false
  if (regle.date_fin && jourIso > regle.date_fin) return false
  return !suspensions.some(s =>
    s.template_id === regle.id && !s.pdv_id && jourIso >= s.date_debut && jourIso <= s.date_fin)
}

/**
 * Objectif par canal sur la plage : somme, sur les jours où au moins une règle
 * quota s'applique, du quota de la grille pour ce jour de semaine. Plusieurs
 * règles le même jour ne cumulent pas : etapes_quota_du_jour applique la
 * grille une fois par jour et par merchandiser.
 */
export function objectifsParCanal(
  grille: QuotaCanal[],
  regles: RegleQuota[],
  debut: string,
  fin: string,
  suspensions: SuspensionRegle[] = [],
): { parCanal: ParCanal, joursActifs: number } {
  const parCanal = compteursVides()
  let joursActifs = 0
  for (const jour of joursDeLaPlage(debut, fin)) {
    if (!regles.some(r => regleSAppliqueLe(r, jour, suspensions))) continue
    const dow = jourSemaine(jour)
    let quotaDuJour = 0
    for (const q of grille) {
      if (q.jour_semaine !== dow) continue
      const canal = (CANAUX_ATOM as readonly string[]).includes(q.canal) ? q.canal as CanalAtom : null
      if (!canal) continue
      parCanal[canal] += q.quota
      quotaDuJour += q.quota
    }
    if (quotaDuJour > 0) joursActifs++
  }
  return { parCanal, joursActifs }
}

/** PDV distincts par canal (un PDV vu deux fois dans la période compte une fois). */
export function pdvDistinctsParCanal(lignes: { pdv_id: string, sous_categorie_pdv?: string | null }[]): ParCanal {
  const parCanal = compteursVides()
  const vus = new Set<string>()
  for (const l of lignes) {
    if (!l.pdv_id || vus.has(l.pdv_id)) continue
    vus.add(l.pdv_id)
    parCanal[canalAtom(l.sous_categorie_pdv) ?? 'Hors grille']++
  }
  return parCanal
}

/** Total des canaux de la grille (hors « Hors grille »). */
export function totalGrille(parCanal: ParCanal): number {
  return CANAUX_ATOM.reduce((s, c) => s + parCanal[c], 0)
}
