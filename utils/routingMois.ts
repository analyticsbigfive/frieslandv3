// utils/routingMois.ts
// Export « Routing du mois » (Routing & Planning) : fichier à envoyer à
// l'agence et à Friesland (demande de Jean Luc du 05/11/2026). Les lignes
// viennent de la fonction export_routing_mois (migration 20261105170000) :
// une par étape de tournée, une par tournée sans étape (visite libre).
// Fonctions pures, testées hors Nuxt.

export interface LigneRoutingMois {
  user_id: string
  merchandiser: string | null
  employeur: string | null
  date_routing: string
  jour: string | null
  semaine: number | null
  point_visite: string | null
  commune: string | null
  quartiers_plan: string | null
  ssf: string | null
  distributeur_routing: string | null
  type_jour: string | null
  ordre: number | null
  pdv_id: string | null
  code_client: string | null
  nom_pdv: string | null
  type_pdv: string | null
  quartier: string | null
  territoire: string | null
  distributeur: string | null
  latitude: number | null
  longitude: number | null
  adresse: string | null
  statut: string | null
  origine: string | null
}

export interface ColonneRoutingMois {
  header: string
  key: keyof LigneRoutingMois | 'date'
  width: number
}

/** Colonnes d'une feuille de merchandiser (la feuille « Tout le mois » ajoute le merchandiser). */
export const COLONNES_ROUTING_MOIS: ColonneRoutingMois[] = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Jour', key: 'jour', width: 10 },
  { header: 'Semaine', key: 'semaine', width: 9 },
  { header: 'Point de visite', key: 'point_visite', width: 24 },
  { header: 'Commune', key: 'commune', width: 16 },
  { header: 'SSF', key: 'ssf', width: 20 },
  { header: 'Distributeur du routing', key: 'distributeur_routing', width: 24 },
  { header: 'Journée', key: 'type_jour', width: 26 },
  { header: 'Ordre', key: 'ordre', width: 7 },
  { header: 'Code PDV', key: 'pdv_id', width: 11 },
  { header: 'Code client', key: 'code_client', width: 13 },
  { header: 'Point de vente', key: 'nom_pdv', width: 32 },
  { header: 'Type', key: 'type_pdv', width: 18 },
  { header: 'Quartier', key: 'quartier', width: 20 },
  { header: 'Territoire', key: 'territoire', width: 18 },
  { header: 'Distributeur', key: 'distributeur', width: 24 },
  { header: 'Latitude', key: 'latitude', width: 11 },
  { header: 'Longitude', key: 'longitude', width: 11 },
  { header: 'Adresse', key: 'adresse', width: 30 },
  { header: 'Statut', key: 'statut', width: 10 },
  { header: 'Origine', key: 'origine', width: 16 },
]

/** Premier et dernier jour d'un mois « AAAA-MM ». */
export function bornesMois(mois: string): { debut: string, fin: string } {
  const [a, m] = mois.split('-').map(Number)
  if (!a || !m || m < 1 || m > 12) throw new Error(`Mois invalide : ${mois}`)
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { debut: `${a}-${mm}-01`, fin: `${a}-${mm}-${String(dernier).padStart(2, '0')}` }
}

/**
 * Jours à générer avant l'export : de aujourd'hui (ou du début du mois s'il
 * est à venir) à la fin du mois, découpés en tranches de `taille` jours pour
 * rester sous la limite de durée d'un appel. Rien pour un mois passé.
 */
export function tranchesGeneration(debut: string, fin: string, aujourdhui: string, taille = 7): { du: string, au: string }[] {
  const depart = debut > aujourdhui ? debut : aujourdhui
  if (depart > fin) return []
  const out: { du: string, au: string }[] = []
  const curseur = new Date(`${depart}T00:00:00Z`)
  const borne = new Date(`${fin}T00:00:00Z`)
  while (curseur <= borne) {
    const du = curseur.toISOString().slice(0, 10)
    const finTranche = new Date(curseur)
    finTranche.setUTCDate(finTranche.getUTCDate() + taille - 1)
    const au = (finTranche < borne ? finTranche : borne).toISOString().slice(0, 10)
    out.push({ du, au })
    curseur.setUTCDate(curseur.getUTCDate() + taille)
  }
  return out
}

/** « 2026-11-04 » → « 04/11/2026 ». */
export function dateFr(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}

const RESERVES = ['Résumé', 'Tout le mois']

/**
 * Noms de feuille Excel (31 caractères au plus, sans : \ / ? * [ ]),
 * uniques, distincts des feuilles « Résumé » et « Tout le mois ».
 */
export function nomsFeuilles(noms: string[]): string[] {
  const pris = new Set(RESERVES.map(n => n.toLowerCase()))
  return noms.map((nom) => {
    const base = (nom || 'Sans nom').replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sans nom'
    let candidat = base
    let i = 2
    while (pris.has(candidat.toLowerCase())) {
      const suffixe = ` (${i++})`
      candidat = base.slice(0, 31 - suffixe.length) + suffixe
    }
    pris.add(candidat.toLowerCase())
    return candidat
  })
}

export interface GroupeMerchandiser {
  userId: string
  nom: string
  employeur: string | null
  lignes: LigneRoutingMois[]
}

/** Lignes regroupées par merchandiser, dans l'ordre alphabétique des noms. */
export function grouperParMerchandiser(lignes: LigneRoutingMois[]): GroupeMerchandiser[] {
  const parId = new Map<string, GroupeMerchandiser>()
  for (const l of lignes) {
    let g = parId.get(l.user_id)
    if (!g) {
      g = { userId: l.user_id, nom: l.merchandiser || 'Sans nom', employeur: l.employeur, lignes: [] }
      parId.set(l.user_id, g)
    }
    g.lignes.push(l)
  }
  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

export interface ResumeMerchandiser {
  merchandiser: string
  agence: string
  distributeurs: string
  jours: number
  joursVisiteLibre: number
  pdvPrevus: number
  etapes: number
  faites: number
}

/** Une ligne de résumé par merchandiser. */
export function resumeMerchandiser(g: GroupeMerchandiser): ResumeMerchandiser {
  const jours = new Set<string>()
  const joursLibres = new Set<string>()
  const pdv = new Set<string>()
  const distributeurs = new Set<string>()
  let etapes = 0
  let faites = 0
  for (const l of g.lignes) {
    jours.add(l.date_routing)
    if (l.type_jour === 'Visite libre') joursLibres.add(l.date_routing)
    if (l.distributeur_routing) distributeurs.add(l.distributeur_routing)
    if (l.pdv_id) {
      pdv.add(l.pdv_id)
      etapes++
      if (l.statut === 'Fait') faites++
    }
  }
  return {
    merchandiser: g.nom,
    agence: libelleEmployeur(g.employeur),
    distributeurs: [...distributeurs].sort((a, b) => a.localeCompare(b, 'fr')).join(', '),
    jours: jours.size,
    joursVisiteLibre: joursLibres.size,
    pdvPrevus: pdv.size,
    etapes,
    faites,
  }
}

/** « atom » → « Atom », « hello-event » → « Hello Event ». */
export function libelleEmployeur(employeur: string | null | undefined): string {
  const v = (employeur || '').trim()
  if (!v) return ''
  return v.split(/[-_\s]+/).map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' ')
}

/** Valeur d'une cellule pour une colonne (la date en JJ/MM/AAAA). */
export function valeurCellule(l: LigneRoutingMois, key: ColonneRoutingMois['key']): string | number | null {
  if (key === 'date') return dateFr(l.date_routing)
  const v = l[key]
  return v === undefined ? null : (v as string | number | null)
}

/** « routing-2026-11.xlsx », « routing-2026-11-atom.xlsx ». */
export function nomFichierRoutingMois(mois: string, employeur?: string | null): string {
  const slug = (employeur || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `routing-${mois}${slug ? `-${slug}` : ''}.xlsx`
}
