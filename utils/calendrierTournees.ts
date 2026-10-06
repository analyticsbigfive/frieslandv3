// utils/calendrierTournees.ts
// Calendrier mensuel des tournées d'une personne (page admin Routing) :
// grille lundi → dimanche et couverture des jours par les règles récurrentes.
import { joursDeRegle, dansException, type RegleRecurrente } from './routingRecurrence'
import { toIsoJour, debutDeSemaine } from './periode'

export interface RegleCalendrier extends RegleRecurrente {
  label?: string | null
  routing_template_exception?: { pdv_id?: string | null; date_debut: string; date_fin: string; motif?: string | null }[] | null
}

/** Mois « AAAA-MM » d'une date ISO. */
export function moisDe(iso: string): string {
  return iso.slice(0, 7)
}

/** Décale un mois « AAAA-MM » de `delta` mois. */
export function decalerMois(mois: string, delta: number): string {
  const [a, m] = mois.split('-').map(Number)
  const d = new Date(a!, m! - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Semaines complètes (lundi → dimanche) couvrant le mois : 4 à 6 lignes de
 * 7 dates ISO, jours des mois voisins compris.
 */
export function grilleMois(mois: string): string[][] {
  const [a, m] = mois.split('-').map(Number)
  const premier = new Date(a!, m! - 1, 1)
  const dernier = new Date(a!, m!, 0)
  const curseur = debutDeSemaine(premier)
  const semaines: string[][] = []
  while (curseur <= dernier) {
    const semaine: string[] = []
    for (let i = 0; i < 7; i++) {
      semaine.push(toIsoJour(curseur))
      curseur.setDate(curseur.getDate() + 1)
    }
    semaines.push(semaine)
  }
  return semaines
}

export interface CouvertureJour {
  /** Règles actives qui s'appliquent ce jour-là. */
  regles: RegleCalendrier[]
  /** Règles qui s'appliqueraient, mais suspendues par une exception. */
  suspendues: { regle: RegleCalendrier; motif: string }[]
}

/** Quelles règles couvrent `date`, et lesquelles y sont suspendues (semaine décochée). */
export function couvertureJour(regles: RegleCalendrier[], date: string): CouvertureJour {
  const jourSemaine = new Date(`${date}T00:00:00`).getDay()
  const out: CouvertureJour = { regles: [], suspendues: [] }
  for (const r of regles) {
    if (r.is_active === false) continue
    if (!joursDeRegle(r).includes(jourSemaine)) continue
    if (r.date_debut && date < r.date_debut) continue
    if (r.date_fin && date > r.date_fin) continue
    const exception = (r.routing_template_exception || []).find(e => !e.pdv_id && dansException(e, date))
    if (exception) out.suspendues.push({ regle: r, motif: exception.motif || 'Suspendue' })
    else out.regles.push(r)
  }
  return out
}
