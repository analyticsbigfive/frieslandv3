// utils/distributeurCreation.ts
// Création d'un PDV sur le terrain (components/PDVQuickCreateModal.vue) :
// distributeur proposé et points de visite tirés du routing du merchandiser.
//
// Depuis le 23/10, la synchronisation « vos PDV » vide zone_assignee et
// quartiers_assignes des comptes Atom : le formulaire retombait sur le premier
// distributeur national (ADIALEA RCI), d'où 138 boutiques chez le mauvais
// distributeur. Règle (05/11) :
//   - compte avec routing : seulement ses distributeurs du routing, champ
//     obligatoire ; un seul → choisi d'office ; plusieurs → aucun par défaut ;
//   - compte sans routing : distributeurs du territoire + nationaux, le premier
//     distributeur du territoire choisi d'office, jamais un national ;
//   - hors ligne, routing pas encore chargé : rien de choisi d'office.
import { codeTerritoireDuNom, resoudreTerritoirePdv, type AreaRef, type QuartierRef, type TerritoireAlias, type TerritoireRef } from './territoires'

/** Une ligne active de routing_mensuel (un jour d'une semaine du mois). */
export interface LigneRoutingMerch {
  distributeur: string | null
  commune: string | null
  point_visite: string | null
  zone?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface DistributeurRef { name: string, national: boolean }
export interface OptionDistributeur { value: string, label: string }

export interface ChoixDistributeur {
  /** D'où viennent les options : le routing du compte, ou le référentiel. */
  origine: 'routing' | 'referentiel'
  options: OptionDistributeur[]
  /** Distributeur pré-rempli ('' : aucun). */
  choixOffice: string
  /** Un seul distributeur dans le routing : affiché tel quel, sans menu. */
  impose: boolean
  /** Bloque la création tant qu'aucun distributeur n'est choisi. Faux quand il
   *  n'y a rien à choisir (hors ligne, référentiels pas chargés) : la création
   *  hors ligne reste possible, le trigger trg_pdv_creation_terrain corrige à
   *  l'insertion. */
  obligatoire: boolean
}

const nettoyer = (v: string | null | undefined) => (v || '').trim()
const cle = (v: string | null | undefined) =>
  nettoyer(v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')

/** Distributeurs distincts du routing, triés. */
export function distributeursDuRouting(routing: LigneRoutingMerch[] | null): string[] {
  const noms = new Set((routing || []).map(l => nettoyer(l.distributeur)).filter(Boolean))
  return [...noms].sort((a, b) => a.localeCompare(b, 'fr'))
}

/**
 * @param routing lignes du routing du compte ; null = pas encore chargé (hors ligne).
 * @param locaux distributeurs du territoire ou de l'area du PDV (non nationaux).
 * @param nationaux distributeurs nationaux.
 */
export function regleDistributeur(opts: {
  routing: LigneRoutingMerch[] | null
  locaux: DistributeurRef[]
  nationaux: DistributeurRef[]
}): ChoixDistributeur {
  const duRouting = distributeursDuRouting(opts.routing)
  if (duRouting.length) {
    return {
      origine: 'routing',
      options: duRouting.map(nom => ({ value: nom, label: nom })),
      choixOffice: duRouting.length === 1 ? duRouting[0] : '',
      impose: duRouting.length === 1,
      obligatoire: true,
    }
  }

  const options: OptionDistributeur[] = []
  const vus = new Set<string>()
  for (const d of [...opts.locaux, ...opts.nationaux]) {
    if (!d.name || vus.has(d.name)) continue
    vus.add(d.name)
    options.push({ value: d.name, label: d.national ? `${d.name} · national` : d.name })
  }
  const premierLocal = opts.locaux.find(d => d.name && !d.national)?.name || ''
  return {
    origine: 'referentiel',
    options,
    choixOffice: opts.routing === null ? '' : premierLocal,
    impose: false,
    obligatoire: options.length > 0,
  }
}

export interface OptionPointVisite {
  /** Valeur enregistrée dans pdv.quartier : le nom du point de visite. */
  value: string
  /** « Petit marché · Marcory » */
  label: string
  commune: string
  ligne: LigneRoutingMerch
}

/** Points de visite du routing, un par nom (le même point revient d'une semaine à l'autre). */
export function pointsDeVisite(routing: LigneRoutingMerch[] | null): OptionPointVisite[] {
  const parNom = new Map<string, OptionPointVisite>()
  for (const ligne of routing || []) {
    const point = nettoyer(ligne.point_visite)
    if (!point || parNom.has(cle(point))) continue
    const commune = nettoyer(ligne.commune)
    parNom.set(cle(point), { value: point, label: commune ? `${point} · ${commune}` : point, commune, ligne })
  }
  return [...parNom.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}

/**
 * Zone d'un PDV créé sur un point de visite : la commune du routing, résolue en
 * territoire du référentiel quand c'est possible (« Marcory » → « MARCORY »,
 * via territoire_alias) ; à défaut la zone de la ligne de routing ; à défaut la
 * commune telle quelle (« Abobo » : deux territoires, ABOBO 1 et ABOBO 2).
 */
export function zoneDuPointVisite(ligne: LigneRoutingMerch, refs: {
  territoiresProfil: string[]
  quartiers: QuartierRef[]
  areas: AreaRef[]
  territoires: TerritoireRef[]
  aliases?: TerritoireAlias[]
}): string {
  const { territoiresProfil, quartiers, areas, territoires, aliases = [] } = refs
  const commune = nettoyer(ligne.commune)
  const zoneLigne = nettoyer(ligne.zone)
  // Territoires admis : ceux de la commune, de la ligne et du profil. Un nom
  // de point identique à un quartier d'un autre secteur ne doit pas l'emporter.
  const admis = new Set(
    [commune, zoneLigne, ...territoiresProfil].map(n => codeTerritoireDuNom(n, territoires, aliases)).filter(Boolean),
  )
  const code = resoudreTerritoirePdv({
    zone: commune,
    quartier: nettoyer(ligne.point_visite),
    territoiresProfil: [zoneLigne, ...territoiresProfil].filter(Boolean),
    quartiers,
    areas,
    territoires,
    aliases,
  }) || codeTerritoireDuNom(zoneLigne, territoires, aliases)
  const territoire = code && admis.has(code) ? territoires.find(t => t.code === code) : undefined
  return territoire?.name || commune || zoneLigne
}
