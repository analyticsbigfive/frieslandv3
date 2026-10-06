// utils/routingImport.ts
// Logique pure de l'import / export des tournées (sans Nuxt ni Supabase), pour
// être testée : lecture CSV, dates, booléens, normalisation des en-têtes,
// regroupement par merchandiser + jour, lignes d'export.
//
// Formats rencontrés sur le terrain :
// - le modèle Excel généré par composables/useRoutingExcel.ts ;
// - l'ancien CSV (séparateur virgule), souvent ré-enregistré par un Excel
//   français : séparateur point-virgule, TRUE/FALSE devenus VRAI/FAUX, dates
//   jj/mm/aa ou numéros de série.
import type { RoutingObjectives, RoutingStatus } from '~/types'

export const ROUTING_ACTIONS = [
  { key: 'releve_stock', label: 'Relevé de stock' },
  { key: 'encaissement', label: 'Encaissement' },
  { key: 'photos', label: 'Photos' },
  { key: 'merchandising', label: 'Merchandising' },
  { key: 'prospection', label: 'Prospection' },
] as const

export const SEP_MERCH = ' — '
export const SEP_PDV = ' · '

const pad = (n: number) => String(n).padStart(2, '0')

// ---- CSV ----

// Séparateur le plus fréquent hors guillemets sur la ligne d'en-têtes.
function detecterSeparateur(entete: string): string {
  const compte: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let guillemets = false
  for (const c of entete) {
    if (c === '"') guillemets = !guillemets
    else if (!guillemets && c in compte) compte[c]!++
  }
  const [meilleur, n] = Object.entries(compte).sort((a, b) => b[1] - a[1])[0]!
  return n > 0 ? meilleur : ','
}

/**
 * CSV → objets (clé = en-tête). Séparateur détecté (virgule, point-virgule,
 * tabulation), guillemets doublés, retours à la ligne dans un champ entre
 * guillemets, BOM et fins de ligne Windows. Lignes entièrement vides ignorées.
 */
export function parseCsvTexte(texte: string): Record<string, string>[] {
  const t = texte.replace(/^﻿/, '')
  const finEntete = t.search(/\r?\n/)
  const sep = detecterSeparateur(finEntete < 0 ? t : t.slice(0, finEntete))

  const lignes: string[][] = []
  let ligne: string[] = []
  let champ = ''
  let guillemets = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i++ }
      else if (c === '"') guillemets = false
      else champ += c
    }
    else if (c === '"') guillemets = true
    else if (c === sep) { ligne.push(champ); champ = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      ligne.push(champ); champ = ''
      lignes.push(ligne); ligne = []
    }
    else champ += c
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne) }

  const utiles = lignes.filter(l => l.some(v => v.trim()))
  if (utiles.length < 2) return []
  const entetes = utiles[0]!.map(h => h.trim())
  return utiles.slice(1).map((valeurs) => {
    const obj: Record<string, string> = {}
    entetes.forEach((h, i) => { obj[h] = (valeurs[i] || '').trim() })
    return obj
  })
}

// ---- Valeurs ----

/** AAAA-MM-JJ d'un jour qui existe (refuse 2026-02-31). */
export function estJourIsoValide(s: string): boolean {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

// Numéro de série Excel (jours depuis le 30/12/1899) → AAAA-MM-JJ.
function depuisSerieExcel(n: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * Date de cellule → AAAA-MM-JJ. Accepte une Date (ExcelJS, minuit UTC), un
 * numéro de série Excel (« 46198 », cellule au format Standard), jj/mm/aaaa,
 * jj/mm/aa, jj.mm.aaaa, AAAA-MM-JJ avec ou sans heure. Toujours jour/mois
 * (format français). Sinon, renvoie le texte tel quel : l'appelant le refuse
 * avec estJourIsoValide.
 */
export function versIsoJour(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) return depuisSerieExcel(v)
  const s = String(v ?? '').trim()
  if (/^\d{5}(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 80000) return depuisSerieExcel(Number(s))
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/)
  if (fr) {
    const annee = fr[3]!.length === 2 ? 2000 + Number(fr[3]) : Number(fr[3])
    return `${annee}-${pad(Number(fr[2]))}-${pad(Number(fr[1]))}`
  }
  return s
}

/** Oui / Non d'une cellule : oui, x, 1, true, vrai (Excel français), yes. */
export function parseBool(v?: string): boolean {
  const s = (v || '').trim().toLowerCase()
  return ['true', 'vrai', '1', 'oui', 'o', 'yes', 'y', 'x'].includes(s)
}

const STATUTS: Record<string, RoutingStatus> = {
  'pending': 'pending', 'en attente': 'pending', 'a faire': 'pending',
  'in_progress': 'in_progress', 'in progress': 'in_progress', 'en cours': 'in_progress',
  'completed': 'completed', 'termine': 'completed', 'terminee': 'completed', 'fait': 'completed',
  'cancelled': 'cancelled', 'annule': 'cancelled', 'annulee': 'cancelled',
}
export const LIBELLES_STATUT: Record<RoutingStatus, string> = {
  pending: 'En attente', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé',
}
export const LIBELLES_STATUT_PDV: Record<string, string> = {
  pending: 'En attente', in_progress: 'En cours', completed: 'Fait', skipped: 'Passé',
}

/** Statut d'une tournée, code ou libellé français ; undefined si vide ou inconnu. */
export function statutDepuisTexte(v?: string): RoutingStatus | undefined {
  const s = cleEntete(v || '')
  return STATUTS[s] ?? STATUTS[s.replace(/ /g, '_')]
}

// Sans accents, minuscules : pour reconnaître les en-têtes quelle que soit la saisie.
export function cleEntete(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// ---- Normalisation d'une ligne lue ----

const CHAMPS: Record<string, string> = {
  'merchandiser': 'email', 'email': 'email',
  'date': 'date',
  'point de vente': 'pdv_id', 'pdv id': 'pdv_id', 'pdv': 'pdv_id',
  'ordre': 'ordre', 'notes': 'notes', 'statut': 'statut',
  ...Object.fromEntries(ROUTING_ACTIONS.flatMap(a => [[cleEntete(a.label), a.key], [cleEntete(a.key), a.key]])),
}

/**
 * Valeurs brutes d'une ligne (en-tête → valeur) → champs attendus par
 * l'import : email, date (AAAA-MM-JJ), pdv_id, ordre, actions, notes, statut.
 * null si la ligne ne porte ni merchandiser, ni date, ni point de vente.
 */
export function normaliserLigneTournee(valeurs: Record<string, unknown>, ligne: number): Record<string, string> | null {
  const out: Record<string, string> = { __ligne: String(ligne) }
  for (const [h, v] of Object.entries(valeurs)) {
    const k = CHAMPS[cleEntete(h)]
    if (!k) continue
    if (k === 'date') out.date = versIsoJour(v)
    else if (k === 'email') out.email = (String(v ?? '').match(/[^\s—<>()]+@[^\s—<>()]+/)?.[0] || String(v ?? '')).trim().toLowerCase()
    else if (k === 'pdv_id') {
      const s = String(v ?? '').trim()
      out.pdv_id = s.includes(SEP_PDV.trim()) ? s.split(SEP_PDV.trim()).pop()!.trim() : s
    }
    else out[k] = String(v ?? '').trim()
  }
  return ['email', 'date', 'pdv_id'].some(k => out[k]) ? out : null
}

// ---- Regroupement par merchandiser + jour ----

export interface GroupeTournee {
  email: string
  date: string
  /** undefined : le fichier ne dit rien, la valeur en base est conservée. */
  notes?: string
  status?: RoutingStatus
  items: { pdv_id: string; ordre: number; objectifs: RoutingObjectives }[]
}

/**
 * Lignes normalisées → une tournée par merchandiser et par jour. Refuse les
 * lignes incomplètes, les dates invalides et les PDV en double dans une même
 * tournée (contrainte unique routing_pdv) avec un message par ligne.
 */
export function regrouperLignesTournees(rows: Record<string, string>[]): { groupes: GroupeTournee[]; erreurs: string[] } {
  const erreurs: string[] = []
  const groupes = new Map<string, GroupeTournee>()

  rows.forEach((r, i) => {
    const lineNo = Number(r.__ligne) || i + 2
    const email = (r.email || '').trim().toLowerCase()
    const date = (r.date || '').trim()
    const pdvId = (r.pdv_id || '').trim()

    if (!email || !date || !pdvId) {
      const manque = [!email && 'merchandiser', !date && 'date', !pdvId && 'point de vente'].filter(Boolean).join(', ')
      erreurs.push(`Ligne ${lineNo} : ${manque} manquant(e)`)
      return
    }
    if (!estJourIsoValide(date)) {
      erreurs.push(`Ligne ${lineNo} : date « ${date} » non reconnue (attendu : 25/06/2026)`)
      return
    }

    const key = `${email}__${date}`
    let g = groupes.get(key)
    if (!g) {
      g = { email, date, items: [] }
      groupes.set(key, g)
    }
    if (g.items.some(it => it.pdv_id === pdvId)) {
      erreurs.push(`Ligne ${lineNo} : point de vente « ${pdvId} » déjà présent pour ${email} le ${date}, ligne ignorée`)
      return
    }
    if (r.notes && r.notes.trim() && g.notes === undefined) g.notes = r.notes.trim()
    if (r.statut && r.statut.trim()) {
      const s = statutDepuisTexte(r.statut)
      if (s) g.status = s
      else erreurs.push(`Ligne ${lineNo} : statut « ${r.statut} » inconnu, ignoré`)
    }

    g.items.push({
      pdv_id: pdvId,
      ordre: parseInt(r.ordre || '') || g.items.length + 1,
      objectifs: Object.fromEntries(ROUTING_ACTIONS.map(a => [a.key, parseBool(r[a.key])])) as RoutingObjectives,
    })
  })

  for (const g of groupes.values()) g.items.sort((a, b) => a.ordre - b.ordre)
  return { groupes: [...groupes.values()], erreurs }
}

// ---- Export ----

export const COLONNES_EXPORT = [
  'Merchandiser', 'Date', 'Territoire', 'Quartier', 'Point de vente', 'Ordre',
  ...ROUTING_ACTIONS.map(a => a.label), 'Notes', 'Statut', 'Statut PDV',
] as const

export interface TourneeExport {
  date_routing: string
  status: RoutingStatus
  notes?: string | null
  user?: { nom?: string | null; email?: string | null } | null
}
export interface EtapeExport {
  pdv_id: string
  position_order: number
  status?: string
  objectifs?: Record<string, unknown> | null
  pdv?: { nom_pdv?: string | null; zone?: string | null; quartier?: string | null } | null
}

/**
 * Une ligne par PDV, au format du modèle d'import : le fichier exporté se
 * réimporte tel quel (Statut repris, Statut PDV informatif).
 */
export function lignesExportTournees(tournees: { tournee: TourneeExport; etapes: EtapeExport[] }[]): Record<string, string | number>[] {
  const lignes: Record<string, string | number>[] = []
  for (const { tournee, etapes } of tournees) {
    const email = String(tournee.user?.email || '').toLowerCase()
    const merch = `${String(tournee.user?.nom || '').trim() || email}${SEP_MERCH}${email}`
    const [a, m, j] = tournee.date_routing.split('-')
    const date = `${j}/${m}/${a}`
    const triees = [...etapes].sort((x, y) => x.position_order - y.position_order)
    triees.forEach((e, idx) => {
      const nom = String(e.pdv?.nom_pdv || '').replace(/\s+/g, ' ').trim() || 'SANS NOM'
      const ligne: Record<string, string | number> = {
        'Merchandiser': merch,
        'Date': date,
        'Territoire': e.pdv?.zone || '',
        'Quartier': e.pdv?.quartier || '',
        'Point de vente': `${nom}${SEP_PDV}${e.pdv_id}`,
        'Ordre': idx + 1,
      }
      for (const act of ROUTING_ACTIONS) ligne[act.label] = e.objectifs?.[act.key] ? 'Oui' : 'Non'
      ligne['Notes'] = idx === 0 ? (tournee.notes || '') : ''
      ligne['Statut'] = LIBELLES_STATUT[tournee.status] || tournee.status
      ligne['Statut PDV'] = LIBELLES_STATUT_PDV[e.status || 'pending'] || e.status || ''
      lignes.push(ligne)
    })
  }
  return lignes
}
