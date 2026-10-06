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

// ---- Semaine (planning d'équipe) --------------------------------------------

/** Lundi (ISO) de la semaine qui contient `date`. */
export function lundiDe(date: string): string {
  return toIsoJour(debutDeSemaine(new Date(`${date}T00:00:00`)))
}

/** Décale un lundi « AAAA-MM-JJ » de `n` semaines. */
export function decalerSemaine(lundi: string, n: number): string {
  const d = new Date(`${lundi}T00:00:00`)
  d.setDate(d.getDate() + 7 * n)
  return toIsoJour(d)
}

/** Jours affichés d'une semaine : lundi → samedi, et le dimanche si demandé. */
export function joursSemaine(lundi: string, avecDimanche = false): string[] {
  const debut = new Date(`${lundi}T00:00:00`)
  return Array.from({ length: avecDimanche ? 7 : 6 }, (_, i) => {
    const d = new Date(debut)
    d.setDate(debut.getDate() + i)
    return toIsoJour(d)
  })
}

// ---- État d'un jour de tournée (calendrier par personne, planning d'équipe) ----

export type EtatTournee = 'annulee' | 'faite' | 'incomplete' | 'planifiee' | 'a_generer' | 'non_generee' | 'suspendue' | 'vide'

export interface TourneeDuJour {
  status?: string | null
  nb_pdv?: number | null
  nb_faits?: number | null
}

export interface EtatJourTournee {
  etat: EtatTournee
  texte: string
  titre: string
  /** Part des PDV faits (jours passés et jour même), sinon null. */
  progression: number | null
  cliquable: boolean
  regle: RegleCalendrier | null
}

/**
 * État d'un jour pour une personne : sa tournée générée (faite, incomplète,
 * planifiée, annulée) ou, sans tournée, la règle qui couvre ce jour. Les
 * couleurs vivent dans composables/classesEtatTournee.ts (Tailwind ne lit pas
 * utils/).
 */
export function etatJourTournee(
  tournee: TourneeDuJour | null | undefined,
  couverture: CouvertureJour,
  date: string,
  aujourdhui: string,
): EtatJourTournee {
  const regle = couverture.regles[0] || couverture.suspendues[0]?.regle || null
  if (tournee) {
    const nb = tournee.nb_pdv ?? 0
    const faits = tournee.nb_faits ?? 0
    if (tournee.status === 'cancelled') {
      return { etat: 'annulee', texte: `${nb} PDV`, titre: 'Tournée annulée', progression: null, cliquable: true, regle }
    }
    if (date <= aujourdhui) {
      const complete = nb > 0 && faits >= nb
      return {
        etat: complete ? 'faite' : 'incomplete',
        texte: `${faits}/${nb} faits`,
        titre: `${faits} PDV faits sur ${nb}`,
        progression: nb ? Math.round((faits / nb) * 100) : 0,
        cliquable: true,
        regle,
      }
    }
    return { etat: 'planifiee', texte: `${nb} PDV`, titre: `Tournée planifiée : ${nb} PDV`, progression: null, cliquable: true, regle }
  }
  if (couverture.regles.length) {
    return date >= aujourdhui
      ? { etat: 'a_generer', texte: 'à générer', titre: 'Prévue par une règle, pas encore générée', progression: null, cliquable: true, regle }
      : { etat: 'non_generee', texte: 'non générée', titre: 'Jour couvert par une règle, mais aucune tournée n\'a été générée', progression: null, cliquable: true, regle }
  }
  if (couverture.suspendues.length) {
    const motif = couverture.suspendues[0]!.motif
    return { etat: 'suspendue', texte: motif, titre: `Suspendue : ${motif}`, progression: null, cliquable: false, regle }
  }
  return { etat: 'vide', texte: '', titre: '', progression: null, cliquable: false, regle: null }
}
