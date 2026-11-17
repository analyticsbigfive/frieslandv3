// utils/weeklyMeeting.ts
// Weekly Meeting Merchandising Agency (17/11/2026) : ce qui s'est passé dans
// une agence sur une semaine, du lundi au samedi. Ce module calcule le rapport
// à partir des lignes lues en base (composables/useWeeklyMeeting.ts) ; la mise
// en slides est dans utils/weeklyMeetingPptx.ts.
//
// Mêmes règles que le reste du back-office :
//  - l'agence d'une visite est celle de son auteur (profiles.employeur), lu
//    par user_id, sinon par l'e-mail (visites d'avant le 31/08 sans user_id) ;
//  - Perfect Store : PDV distincts, dernière visite scorée de la semaine
//    (perfect_store_par_agence_filtre) ;
//  - disponibilité d'une référence : utils/products.ts (releveSku).
//
// Aucune dépendance Nuxt : module couvert par tests/weeklyMeeting.spec.ts.
import { NIVEAUX_PS, niveauPerfectStore } from './chartPalette'
import { agregerConcurrents } from './concurrence'
import { toIsoJour } from './periode'
import { releveSku } from './products'
import { photosAffichables } from './visitePhotos'

// ---- Semaine (lundi → samedi) ----------------------------------------------

export interface SemaineHebdo {
  /** Lundi, AAAA-MM-JJ. */
  debut: string
  /** Samedi, AAAA-MM-JJ. */
  fin: string
}

const jourLocal = (iso: string) => new Date(`${iso}T00:00:00`)

function decaler(iso: string, jours: number): string {
  const d = jourLocal(iso)
  d.setDate(d.getDate() + jours)
  return toIsoJour(d)
}

/** Semaine de travail (lundi → samedi) qui contient `date` ; un dimanche est rattaché à la semaine qui s'achève. */
export function semaineHebdo(date: Date | string): SemaineHebdo {
  const d = typeof date === 'string' ? jourLocal(date) : new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const jourSemaine = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (jourSemaine - 1))
  const debut = toIsoJour(d)
  return { debut, fin: decaler(debut, 5) }
}

export function semainePrecedente(s: SemaineHebdo): SemaineHebdo {
  return { debut: decaler(s.debut, -7), fin: decaler(s.fin, -7) }
}

export function semaineSuivante(s: SemaineHebdo): SemaineHebdo {
  return { debut: decaler(s.debut, 7), fin: decaler(s.fin, 7) }
}

/** Dernière semaine terminée : celle en cours le dimanche, la précédente du lundi au samedi. */
export function derniereSemaineEcoulee(reference: Date = new Date()): SemaineHebdo {
  const courante = semaineHebdo(reference)
  return reference.getDay() === 0 ? courante : semainePrecedente(courante)
}

/** Les six jours de la semaine, du lundi au samedi. */
export function joursDeSemaine(s: SemaineHebdo): string[] {
  return Array.from({ length: 6 }, (_, i) => decaler(s.debut, i))
}

/** Lendemain de la borne haute : `date_visite < lendemain` (borne stricte, comme les RPC). */
export function lendemainDe(iso: string): string {
  return decaler(iso, 1)
}

export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « du 9 au 14 novembre 2026 », « du 30 novembre au 5 décembre 2026 ». */
export function libelleSemaine(s: SemaineHebdo): string {
  const a = jourLocal(s.debut)
  const b = jourLocal(s.fin)
  const jour = (d: Date) => (d.getDate() === 1 ? '1er' : String(d.getDate()))
  const fin = `${jour(b)} ${MOIS[b.getMonth()]} ${b.getFullYear()}`
  if (a.getFullYear() !== b.getFullYear()) return `du ${jour(a)} ${MOIS[a.getMonth()]} ${a.getFullYear()} au ${fin}`
  if (a.getMonth() !== b.getMonth()) return `du ${jour(a)} ${MOIS[a.getMonth()]} au ${fin}`
  return `du ${jour(a)} au ${fin}`
}

/** Numéro de semaine ISO du lundi (« S46 »). */
export function numeroSemaine(s: SemaineHebdo): number {
  const d = jourLocal(s.debut)
  const jeudi = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3)
  const premierJanvier = new Date(jeudi.getFullYear(), 0, 1)
  return Math.ceil(((jeudi.getTime() - premierJanvier.getTime()) / 86400000 + 1) / 7)
}

// ---- Lignes lues en base ----------------------------------------------------

export interface MembreAgence {
  id: string
  nom: string | null
  email: string | null
  role: string | null
  is_active: boolean | null
}

export interface ResultatHebdo {
  niveau: string | null
  dispo_rayon: number | string | null
  visibilite: number | string | null
  score_global: number | string | null
  calcule_le?: string | null
}

export interface VisiteHebdo {
  id: string
  pdv_id: string | null
  user_id: string | null
  email: string | null
  commercial?: string | null
  date_visite: string
  geofence_validated?: boolean | null
  /** Absent pour la semaine précédente (comparaison : compteurs seuls). */
  data?: any
  image_urls?: unknown
  /** Null : jour sans tournée. Undefined : colonne non lue (migration 20261105120000 absente). */
  situation_tournee?: string | null
  pdv?: { nom_pdv?: string | null, zone?: string | null, quartier?: string | null } | null
  /** Null : visite sans résultat Perfect Store (ni produits ni visibilité saisis). */
  resultat?: ResultatHebdo | null
}

export interface TourneeHebdo {
  user_id: string
  date_routing: string
  nb_pdv: number
  nb_faits: number
}

export interface FermetureHebdo {
  pdv_id: string
  nom_pdv: string | null
  zone: string | null
  quartier: string | null
  declare_par: string | null
  declare_le: string
  decision: string | null
  commentaire: string | null
}

export interface CategorieCatalogue {
  key: string
  label: string
  skus: { key: string, label: string }[]
}

export interface ElementVisibilite {
  code: string
  nom: string
  emplacement?: string | null
  pilier?: string | null
}

// ---- Rapport ----------------------------------------------------------------

export interface ChiffresSemaine {
  visites: number
  pdv_visites: number
  merchandisers_actifs: number
  /** PDV dont la dernière visite scorée de la semaine a un résultat. */
  pdv_evalues: number
  pdv_perfect_store: number
  perfect_store_pct: number | null
  dispo_moyenne_pct: number | null
  visibilite_moyenne_pct: number | null
  score_moyen_pct: number | null
  /** Dernière visite sans disponibilité calculable : type de PDV sans seuil. */
  pdv_sans_seuil: number
  visites_sans_releve: number
  par_niveau: { cle: string, libelle: string, couleur: string, nb_pdv: number }[]
  pdv_programmes: number
  etapes_faites: number
  tournees: number
  /** Étapes faites / PDV programmés. Null sans tournée. */
  realisation_pct: number | null
}

export interface LigneMerchandiser {
  id: string
  nom: string
  visites: number
  pdv_visites: number
  jours_actifs: number
  pdv_programmes: number
  etapes_faites: number
  realisation_pct: number | null
  pdv_evalues: number
  pdv_perfect_store: number
  dispo_moyenne_pct: number | null
  visibilite_moyenne_pct: number | null
  visites_sans_releve: number
  hors_tournee: number
}

export interface JourHebdo {
  jour: string
  libelle: string
  visites: number
  visites_precedentes: number
  pdv_programmes: number
  etapes_faites: number
}

export interface SituationVisites {
  /** Faux : la base ne connaît pas encore visites.situation_tournee. */
  disponible: boolean
  prevues: number
  ajoutees_jour: number
  /** Comprend les visites sur un PDV créé sur place. */
  hors_tournee: number
  dont_pdv_cree: number
  sans_tournee: number
}

export interface LigneReference {
  categorie: string
  categorie_libelle: string
  sku: string
  libelle: string
  /** Points de vente avec un relevé renseigné (disponible, présent sans être en rayon, en rupture). */
  releves: number
  disponibles: number
  ruptures: number
  dispo_pct: number | null
}

export interface LigneFamille {
  categorie: string
  libelle: string
  releves: number
  disponibles: number
  dispo_pct: number | null
}

export interface LigneVisibilite {
  code: string
  nom: string
  emplacement: string | null
  releves: number
  presents: number
  pct: number | null
}

export interface ConcurrenceHebdo {
  visites_renseignees: number
  visites_avec_concurrent: number
  presence_pct: number | null
  familles: { categorie: string, libelle: string, presents: number, en_activite: number }[]
  actions: { libelle: string, nb: number }[]
  signales: { nom: string, signalements: number, en_activite: number }[]
}

export interface PhotoHebdo {
  url: string
  pdv: string
  merchandiser: string
  jour: string
}

export interface RapportHebdo {
  agence: { code: string, nom: string, direction: string | null }
  semaine: SemaineHebdo
  precedente: SemaineHebdo
  /** Merchandisers actifs de l'agence (comptes). */
  effectif: number
  chiffres: ChiffresSemaine
  avant: ChiffresSemaine
  jours: JourHebdo[]
  situation: SituationVisites
  merchandisers: LigneMerchandiser[]
  /** Merchandisers actifs de l'agence sans aucune visite sur la semaine. */
  sans_visite: string[]
  familles: LigneFamille[]
  skus: LigneReference[]
  visibilite: LigneVisibilite[]
  concurrence: ConcurrenceHebdo
  fermetures: (FermetureHebdo & { declarant: string })[]
  gps_non_valide: number
  photos: PhotoHebdo[]
}

// ---- Calcul -----------------------------------------------------------------

const nombre = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const pct = (num: number, den: number): number | null => (den ? Math.round((1000 * num) / den) / 10 : null)

function moyenne(valeurs: (number | null)[]): number | null {
  const xs = valeurs.filter((x): x is number => x !== null)
  return xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : null
}

const jourDe = (horodatage: string) => String(horodatage || '').slice(0, 10)

/** Rattache chaque visite à un compte de l'agence : user_id, sinon l'e-mail. */
export function indexAuteurs(membres: MembreAgence[]) {
  const parId = new Map(membres.map(m => [m.id, m]))
  const parEmail = new Map(membres.filter(m => m.email).map(m => [String(m.email).toLowerCase(), m]))
  return (v: Pick<VisiteHebdo, 'user_id' | 'email'>): MembreAgence | null => {
    if (v.user_id) return parId.get(v.user_id) ?? null
    return v.email ? parEmail.get(v.email.toLowerCase()) ?? null : null
  }
}

/** Dernière visite scorée de chaque PDV (date de visite, puis date de calcul). */
function dernieresScorees(visites: VisiteHebdo[]): VisiteHebdo[] {
  const parPdv = new Map<string, VisiteHebdo>()
  for (const v of visites) {
    if (!v.resultat || !v.pdv_id) continue
    const d = parPdv.get(v.pdv_id)
    if (!d || v.date_visite > d.date_visite
      || (v.date_visite === d.date_visite && String(v.resultat.calcule_le || '') > String(d.resultat?.calcule_le || ''))) {
      parPdv.set(v.pdv_id, v)
    }
  }
  return [...parPdv.values()]
}

function perfectStore(visites: VisiteHebdo[]) {
  const dernieres = dernieresScorees(visites)
  const auStandard = dernieres.filter(v => !!v.resultat?.niveau && !!niveauPerfectStore(v.resultat.niveau))
  return {
    pdv_evalues: dernieres.length,
    pdv_perfect_store: auStandard.length,
    perfect_store_pct: pct(auStandard.length, dernieres.length),
    dispo_moyenne_pct: moyenne(dernieres.map(v => nombre(v.resultat?.dispo_rayon))),
    visibilite_moyenne_pct: moyenne(dernieres.map(v => nombre(v.resultat?.visibilite))),
    score_moyen_pct: moyenne(dernieres.map(v => nombre(v.resultat?.score_global))),
    pdv_sans_seuil: dernieres.filter(v => nombre(v.resultat?.dispo_rayon) === null).length,
    par_niveau: NIVEAUX_PS.map(n => ({
      cle: n.cle,
      libelle: n.court,
      couleur: n.couleur,
      nb_pdv: auStandard.filter(v => niveauPerfectStore(v.resultat?.niveau)?.cle === n.cle).length,
    })),
  }
}

export function chiffresSemaine(visites: VisiteHebdo[], tournees: TourneeHebdo[], auteur: (v: VisiteHebdo) => MembreAgence | null): ChiffresSemaine {
  const programmes = tournees.reduce((s, t) => s + (t.nb_pdv || 0), 0)
  const faits = tournees.reduce((s, t) => s + (t.nb_faits || 0), 0)
  return {
    visites: visites.length,
    pdv_visites: new Set(visites.map(v => v.pdv_id).filter(Boolean)).size,
    merchandisers_actifs: new Set(visites.map(v => auteur(v)?.id).filter(Boolean)).size,
    ...perfectStore(visites),
    visites_sans_releve: visites.filter(v => !v.resultat).length,
    pdv_programmes: programmes,
    etapes_faites: faits,
    tournees: tournees.length,
    realisation_pct: pct(faits, programmes),
  }
}

const HORS_TOURNEE = ['hors_tournee', 'pdv_cree_sur_place']

function situationVisites(visites: VisiteHebdo[]): SituationVisites {
  const disponible = visites.some(v => v.situation_tournee !== undefined)
  const compter = (...valeurs: string[]) => visites.filter(v => valeurs.includes(String(v.situation_tournee))).length
  return {
    disponible,
    prevues: compter('prevue'),
    ajoutees_jour: compter('ajoutee_jour'),
    hors_tournee: compter(...HORS_TOURNEE),
    dont_pdv_cree: compter('pdv_cree_sur_place'),
    sans_tournee: disponible ? visites.filter(v => v.situation_tournee === null).length : 0,
  }
}

function lignesMerchandisers(visites: VisiteHebdo[], tournees: TourneeHebdo[], membres: MembreAgence[], auteur: (v: VisiteHebdo) => MembreAgence | null): LigneMerchandiser[] {
  const parAuteur = new Map<string, VisiteHebdo[]>()
  for (const v of visites) {
    const id = auteur(v)?.id
    if (!id) continue
    parAuteur.set(id, [...(parAuteur.get(id) || []), v])
  }
  const ids = new Set([...parAuteur.keys(), ...tournees.map(t => t.user_id)])
  const parId = new Map(membres.map(m => [m.id, m]))
  return [...ids].map((id) => {
    const vs = parAuteur.get(id) || []
    const ts = tournees.filter(t => t.user_id === id)
    const ps = perfectStore(vs)
    const programmes = ts.reduce((s, t) => s + (t.nb_pdv || 0), 0)
    const faits = ts.reduce((s, t) => s + (t.nb_faits || 0), 0)
    const m = parId.get(id)
    return {
      id,
      nom: String(m?.nom || '').trim() || m?.email || 'Sans nom',
      visites: vs.length,
      pdv_visites: new Set(vs.map(v => v.pdv_id).filter(Boolean)).size,
      jours_actifs: new Set(vs.map(v => jourDe(v.date_visite))).size,
      pdv_programmes: programmes,
      etapes_faites: faits,
      realisation_pct: pct(faits, programmes),
      pdv_evalues: ps.pdv_evalues,
      pdv_perfect_store: ps.pdv_perfect_store,
      dispo_moyenne_pct: ps.dispo_moyenne_pct,
      visibilite_moyenne_pct: ps.visibilite_moyenne_pct,
      visites_sans_releve: vs.filter(v => !v.resultat).length,
      hors_tournee: vs.filter(v => HORS_TOURNEE.includes(String(v.situation_tournee))).length,
    }
  }).sort((a, b) => b.visites - a.visites || a.nom.localeCompare(b.nom, 'fr'))
}

/**
 * Disponibilité par référence et par famille : la dernière visite de la
 * semaine de chaque point de vente, comme Produits › Inventaire. Le formulaire
 * enregistre « En rupture » pour une référence que le point de vente ne vend
 * pas : le taux se lit « part des points de vente où la référence est en rayon ».
 */
export function disponibiliteProduits(toutes: VisiteHebdo[], catalogue: CategorieCatalogue[]): { familles: LigneFamille[], skus: LigneReference[] } {
  const parPdv = new Map<string, VisiteHebdo>()
  for (const v of toutes) {
    if (!v.data?.produits) continue
    const cle = v.pdv_id || v.id
    const d = parPdv.get(cle)
    if (!d || v.date_visite > d.date_visite) parPdv.set(cle, v)
  }
  const visites = [...parPdv.values()]
  const skus: LigneReference[] = []
  for (const cat of catalogue) {
    for (const s of cat.skus) {
      let releves = 0
      let disponibles = 0
      let ruptures = 0
      for (const v of visites) {
        const etat = releveSku(v.data?.produits?.[cat.key], s.key).disponibilite
        if (etat === 'disponible') { releves++; disponibles++ }
        else if (etat === 'rupture') { releves++; ruptures++ }
        else if (etat === 'present') releves++
      }
      skus.push({ categorie: cat.key, categorie_libelle: cat.label, sku: s.key, libelle: s.label, releves, disponibles, ruptures, dispo_pct: pct(disponibles, releves) })
    }
  }
  const familles = catalogue.map((cat) => {
    const lignes = skus.filter(l => l.categorie === cat.key)
    const releves = lignes.reduce((n, l) => n + l.releves, 0)
    const disponibles = lignes.reduce((n, l) => n + l.disponibles, 0)
    return { categorie: cat.key, libelle: cat.label, releves, disponibles, dispo_pct: pct(disponibles, releves) }
  })
  return { familles, skus }
}

function visibilite(visites: VisiteHebdo[], elements: ElementVisibilite[]): LigneVisibilite[] {
  // Un même code existe dans plusieurs segments (boutiques, supermarchés) : une ligne par code.
  const parCode = new Map<string, LigneVisibilite>()
  for (const e of elements) {
    // Le pilier « promotion » (dégustation, hôtesses…) ne vaut que lorsqu'une promotion est en cours : hors de ce classement.
    if (e.pilier === 'promotion') continue
    if (!parCode.has(e.code)) parCode.set(e.code, { code: e.code, nom: e.nom, emplacement: e.emplacement ?? null, releves: 0, presents: 0, pct: null })
  }
  for (const v of visites) {
    const standards = v.data?.visibilite?.standards
    if (!standards || typeof standards !== 'object') continue
    for (const [code, valeur] of Object.entries(standards)) {
      const ligne = parCode.get(code)
      if (!ligne || typeof valeur !== 'boolean') continue
      ligne.releves++
      if (valeur) ligne.presents++
    }
  }
  return [...parCode.values()]
    .filter(l => l.releves > 0)
    .map(l => ({ ...l, pct: pct(l.presents, l.releves) }))
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.releves - a.releves)
}

const FAMILLES_CONCURRENCE: [string, string][] = [['evap', 'EVAP'], ['imp', 'IMP'], ['scm', 'SCM'], ['uht', 'UHT']]

function concurrence(visites: VisiteHebdo[]): ConcurrenceHebdo {
  const renseignees = visites.filter(v => v.data?.concurrence && typeof v.data.concurrence === 'object')
  const avec = renseignees.filter(v => v.data.concurrence.presence_concurrents === true)
  const actions = new Map<string, { libelle: string, nb: number }>()
  const familles = FAMILLES_CONCURRENCE.map(([categorie, libelle]) => {
    let presents = 0
    let enActivite = 0
    for (const v of avec) {
      const bloc = v.data.concurrence[categorie]
      if (!bloc?.present) continue
      presents++
      if (bloc.en_activite) enActivite++
      const action = String(bloc.action_concurrence || '').trim()
      if (bloc.en_activite && action) {
        const cle = action.toLowerCase()
        const a = actions.get(cle) || { libelle: action, nb: 0 }
        a.nb++
        actions.set(cle, a)
      }
    }
    return { categorie, libelle, presents, en_activite: enActivite }
  })
  return {
    visites_renseignees: renseignees.length,
    visites_avec_concurrent: avec.length,
    presence_pct: pct(avec.length, renseignees.length),
    familles,
    actions: [...actions.values()].sort((a, b) => b.nb - a.nb || a.libelle.localeCompare(b.libelle, 'fr')),
    signales: agregerConcurrents(renseignees).map(c => ({ nom: c.nom, signalements: c.signalements, en_activite: c.en_activite })),
  }
}

/**
 * Photos proposées pour la slide « Photos de la semaine » : la première photo
 * de chaque visite, en alternant les merchandisers (pas six photos du même).
 */
export function choisirPhotos(visites: VisiteHebdo[], auteur: (v: VisiteHebdo) => MembreAgence | null, max = 6): PhotoHebdo[] {
  const files = new Map<string, PhotoHebdo[]>()
  for (const v of [...visites].sort((a, b) => b.date_visite.localeCompare(a.date_visite))) {
    const url = photosAffichables(v.image_urls)[0]
    if (!url) continue
    const m = auteur(v)
    const nom = String(m?.nom || v.commercial || '').trim() || 'Merchandiser'
    const cle = m?.id || nom
    files.set(cle, [...(files.get(cle) || []), { url, pdv: String(v.pdv?.nom_pdv || v.pdv_id || 'Point de vente'), merchandiser: nom, jour: jourDe(v.date_visite) }])
  }
  const sortie: PhotoHebdo[] = []
  const listes = [...files.values()]
  for (let rang = 0; sortie.length < max && listes.some(l => l.length > rang); rang++) {
    for (const l of listes) {
      if (l[rang] && sortie.length < max) sortie.push(l[rang])
    }
  }
  return sortie
}

export interface EntreeRapport {
  agence: { code: string, nom: string, direction: string | null }
  semaine: SemaineHebdo
  membres: MembreAgence[]
  visites: VisiteHebdo[]
  visitesPrecedentes: VisiteHebdo[]
  tournees: TourneeHebdo[]
  tourneesPrecedentes: TourneeHebdo[]
  fermetures: FermetureHebdo[]
  catalogue: CategorieCatalogue[]
  elementsVisibilite: ElementVisibilite[]
  /** Photos à proposer (2 fois le nombre affiché : certaines ne se chargent pas). */
  maxPhotos?: number
}

export function construireRapport(e: EntreeRapport): RapportHebdo {
  const auteur = indexAuteurs(e.membres)
  const precedente = semainePrecedente(e.semaine)
  const merchandisers = lignesMerchandisers(e.visites, e.tournees, e.membres, auteur)
  const avecVisite = new Set(merchandisers.filter(m => m.visites > 0).map(m => m.id))
  const effectifs = e.membres.filter(m => m.role === 'merchandiser' && m.is_active !== false)
  const joursAvant = joursDeSemaine(precedente)
  const { familles, skus } = disponibiliteProduits(e.visites, e.catalogue)
  const parId = new Map(e.membres.map(m => [m.id, m]))

  return {
    agence: e.agence,
    semaine: e.semaine,
    precedente,
    effectif: effectifs.length,
    chiffres: chiffresSemaine(e.visites, e.tournees, auteur),
    avant: chiffresSemaine(e.visitesPrecedentes, e.tourneesPrecedentes, auteur),
    jours: joursDeSemaine(e.semaine).map((jour, i) => ({
      jour,
      libelle: JOURS_COURTS[i],
      visites: e.visites.filter(v => jourDe(v.date_visite) === jour).length,
      visites_precedentes: e.visitesPrecedentes.filter(v => jourDe(v.date_visite) === joursAvant[i]).length,
      pdv_programmes: e.tournees.filter(t => t.date_routing === jour).reduce((s, t) => s + (t.nb_pdv || 0), 0),
      etapes_faites: e.tournees.filter(t => t.date_routing === jour).reduce((s, t) => s + (t.nb_faits || 0), 0),
    })),
    situation: situationVisites(e.visites),
    merchandisers,
    sans_visite: effectifs.filter(m => !avecVisite.has(m.id))
      .map(m => String(m.nom || '').trim() || m.email || 'Sans nom')
      .sort((a, b) => a.localeCompare(b, 'fr')),
    familles,
    skus,
    visibilite: visibilite(e.visites, e.elementsVisibilite),
    concurrence: concurrence(e.visites),
    fermetures: [...e.fermetures]
      .sort((a, b) => b.declare_le.localeCompare(a.declare_le))
      .map(f => ({ ...f, declarant: String(parId.get(f.declare_par || '')?.nom || '').trim() || '—' })),
    gps_non_valide: e.visites.filter(v => v.geofence_validated === false).length,
    photos: choisirPhotos(e.visites, auteur, e.maxPhotos ?? 12),
  }
}

// ---- Mise en forme partagée (page et slides) --------------------------------

/** « 42,5 % », « — » sans valeur. */
export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${String(Math.round(v * 10) / 10).replace('.', ',')} %`
}

export interface Evolution {
  texte: string
  sens: 'hausse' | 'baisse' | 'stable' | 'inconnu'
}

/** Écart à la semaine précédente : en % pour un volume, en points pour un taux. */
export function evolution(actuel: number | null, avant: number | null, mode: 'volume' | 'points' = 'volume'): Evolution {
  if (actuel === null || avant === null) return { texte: 'pas de comparaison', sens: 'inconnu' }
  const ecart = actuel - avant
  if (mode === 'points') {
    const pts = Math.round(ecart * 10) / 10
    if (!pts) return { texte: 'stable', sens: 'stable' }
    return { texte: `${pts > 0 ? '+' : '−'}${String(Math.abs(pts)).replace('.', ',')} pt`, sens: pts > 0 ? 'hausse' : 'baisse' }
  }
  if (!ecart) return { texte: 'stable', sens: 'stable' }
  if (!avant) return { texte: `+${actuel}`, sens: 'hausse' }
  const signe = ecart > 0 ? '+' : '−'
  const p = Math.abs(Math.round((100 * ecart) / avant))
  // Écart trop petit pour un pourcentage (713 → 712) : l'écart seul, pas « −0 % ».
  return { texte: p ? `${signe}${p} % (${signe}${Math.abs(ecart)})` : `${signe}${Math.abs(ecart)}`, sens: ecart > 0 ? 'hausse' : 'baisse' }
}

/** Nom de fichier : weekly-meeting-atom-btl-2026-11-09.pptx. */
export function nomFichierWeekly(nomAgence: string, s: SemaineHebdo, extension = 'pptx'): string {
  const slug = nomAgence.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `weekly-meeting-${slug || 'agence'}-${s.debut}.${extension}`
}
