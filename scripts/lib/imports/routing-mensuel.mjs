/**
 * Routing mensuel des merchandisers (fichier de l'agence, Admin › Imports terrain).
 *
 * Réunion client du 08/10/2026 : le SSF (vendeur du distributeur) et le
 * merchandiser (agence) dépendent tous deux du commercial ; aucun ne dirige
 * l'autre. L'agence (Elias, Atom) envoie « le déploiement mensuel des
 * merchandisers par zone et par SSF » : une ligne par case merchandiser ×
 * jour × semaine du mois (« Occurrence » 1 à 4), avec le point de visite, le
 * SSF du jour (ou « Aucun SSF »), son engin, le distributeur et le commercial
 * (« Sales rep »). Sans colonne Occurrence, la ligne vaut pour les 4 semaines.
 *
 * L'import :
 *   - écrit le routing (table routing_mensuel, upsert sur merchandiser × jour
 *     × semaine : pas de doublon ; une case absente du nouveau fichier est
 *     désactivée) ;
 *   - remplace les règles « SSF — » / « Routing mensuel — » du merchandiser
 *     par une règle par (jour, lieu, SSF) avec ses semaines : la tournée du
 *     jour reste dans les quartiers du point de visite ;
 *   - passe sa règle de portefeuille en « repli » (tous les jours, utilisée
 *     seulement quand aucune case ne s'applique : 5e semaine, case vide, lieu
 *     non reconnu) ;
 *   - met à jour les quartiers des SSF, rattache un SSF sans commercial au
 *     commercial de ses cases, élargit le périmètre du merchandiser.
 * Il ne change PAS le commercial des merchandisers : les écarts entre le
 * fichier et la base sont signalés (décision du client attendue).
 *
 * Rapprochements (le fichier n'écrit pas les noms comme la base) :
 *   - merchandiser, SSF, commercial : trouverPersonne (nom exact dans
 *     n'importe quel ordre, alias, puis nom tolérant) ; SSF cherché d'abord
 *     parmi ceux du distributeur de la ligne ;
 *   - point de visite → quartier(s) des PDV, TOUJOURS dans le territoire de
 *     la ligne : zones de sa commune (colonne « Commune » ; à défaut, du
 *     secteur) et zones principales du portefeuille du merchandiser. Jamais
 *     ailleurs (09/10 : « Kennedy 2 » d'Abobo était parti à Daloa). Dans
 *     l'ordre : alias « quartier » validé (« Port-Bouët 2 » est un quartier
 *     de Yopougon), libellé identique, puis libellé approché (numéro,
 *     parenthèses, « X et Y », une faute ; 4 quartiers au plus), signalé
 *     dans le rapport. Quartier introuvable : la case vaut pour la commune
 *     (portefeuille du merchandiser dans la commune).
 *
 * Module pur (aucune dépendance Node) : Admin › Imports terrain, et
 * Référentiels › Routing mensuel (reglesDuRouting après une correction).
 * Sortie : { resume, rapport (markdown), csv, operations, retour, bloquants }.
 */
import {
  chargerAlias, cleNom, csvTexte, distributeurCanonique, feuillesDepuisClasseur, feuillesDepuisCsv, motsPersonne, motsProches,
  norm, ordreGps, resoudreAlias, toutesLesLignes, trouverPersonne, uniques,
} from '../commun.mjs'
import { lireJours } from './ssf-sous-zones.mjs'

export const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const SEMAINES = [1, 2, 3, 4]
const PREFIXE_REGLE = 'Routing mensuel — '
const SANS_SSF = new Set(['', '-', 'AUCUN', 'AUCUN SSF', 'SANS SSF', 'NEANT', 'NON', 'PAS DE SSF'])
const SSF_A_PRECISER = new Set(['NON NOMME', 'A PRECISER', '?', 'INCONNU', 'A DEFINIR'])
const cleTexte = (s) => norm(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const MOTS_LIEU_VIDES = new Set(['QUARTIER', 'CITE', 'MARCHE', 'DE', 'DU', 'DES', 'ET', 'LA', 'LE', 'LES', 'ZONE'])
const motsLieu = (s) => cleTexte(s).split(' ').filter(w => w.length >= 3 && !MOTS_LIEU_VIDES.has(w))
const sansParentheses = (s) => String(s || '').replace(/\([^)]*\)/g, ' ')
const entreParentheses = (s) => [...String(s || '').matchAll(/\(([^)]*)\)/g)].map(m => m[1])
// Zone d'un PDV dans un portefeuille : « principale » à partir de 10 PDV (les
// affectations DMS traînent un PDV isolé à Bouaké ou Aboisso).
const MIN_PDV_ZONE_PORTEFEUILLE = 10
const MAX_QUARTIERS_APPROCHES = 4
// Deux mots de lieu voisins : une faute, une lettre doublée (« APOLLO » /
// « APPOLO »), un mot qui commence l'autre, ou six lettres de tête communes
// (« LUBAFRIK » / « LUBAFRIQUE »).
const sansDoubles = (w) => w.replace(/(.)\1+/g, '$1')
const motsVoisins = (a, b) => {
  if (motsProches(a, b) || (Math.min(a.length, b.length) >= 4 && sansDoubles(a) === sansDoubles(b))) return true
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i >= 6 && i >= Math.min(a.length, b.length) - 2
}

// ---------------------------------------------------------------------------
// Lecture du fichier
// ---------------------------------------------------------------------------
/** Semaines du mois d'une cellule (« 1 », « 1, 3 », « Toutes », vide → 1 à 4). */
export function lireSemaines(texte) {
  const t = cleTexte(texte)
  if (!t || /TOUT|CHAQUE/.test(t)) return [...SEMAINES]
  const n = uniques(t.split(' ').filter(x => /^[1-5]$/.test(x))).map(Number)
  return n.length ? n.sort((a, b) => a - b) : [...SEMAINES]
}

/** Feuilles (feuillesDepuisClasseur / feuillesDepuisCsv) → lignes du routing. */
export function lireRoutingMensuel(feuilles) {
  const lignes = []
  for (const f of feuilles) {
    let cols = null
    for (const { n, cellules } of f.lignes) {
      const v = (i) => (i ? String(cellules[i] ?? '').trim() : '')
      if (!cols) {
        const idx = {}
        cellules.forEach((c, i) => {
          const h = cleTexte(c)
          if (!h) return
          if (/^(MERCH|E ?MAIL|AGENT)/.test(h) && !idx.merch) idx.merch = i
          else if (/^(TYPE|ENGIN)/.test(h) && !idx.typeSsf) idx.typeSsf = i
          else if (/^(SALES ?REP|COMMERCIAL|SALES OFFICER)/.test(h) && !idx.salesRep) idx.salesRep = i
          else if (/^(SSF|VENDEUR|SALESMAN)/.test(h) && !idx.ssf) idx.ssf = i
          else if (/^(OCCURR?ENCE|SEMAINE|OCC)/.test(h) && !idx.semaine) idx.semaine = i
          else if (/^JOUR/.test(h) && !idx.jour) idx.jour = i
          else if (/^COMMUNE/.test(h) && !idx.commune) idx.commune = i
          else if (/^QUARTIER/.test(h) && !idx.quartier) idx.quartier = i
          else if (/^(POINT|LIEU|SOUS ?ZONE)/.test(h) && !idx.point) idx.point = i
          else if (/^(ZONE|SECTEUR|TERRITOIRE)/.test(h) && !idx.secteur) idx.secteur = i
          else if (/^DISTRIB/.test(h) && !idx.distributeur) idx.distributeur = i
        })
        if (idx.merch && idx.jour && (idx.point || idx.quartier || idx.secteur)) cols = idx
        continue
      }
      const merch = v(cols.merch)
      if (!merch) continue
      const ssfBrut = v(cols.ssf)
      const ssfCle = cleTexte(ssfBrut)
      lignes.push({
        feuille: f.nom, ligne: n,
        secteur: v(cols.secteur), commune: v(cols.commune), merch, distributeur: v(cols.distributeur), salesRep: v(cols.salesRep),
        jours: lireJours(v(cols.jour)), semaines: cols.semaine ? lireSemaines(v(cols.semaine)) : [...SEMAINES],
        // Libellé de la case : le point de visite ; lieu cherché : le quartier s'il est donné.
        point: v(cols.point) || v(cols.quartier) || v(cols.secteur),
        lieu: v(cols.quartier) || v(cols.point) || v(cols.secteur),
        ssf: SANS_SSF.has(ssfCle) || SSF_A_PRECISER.has(ssfCle) ? null : ssfBrut,
        ssfTexte: ssfBrut && !SANS_SSF.has(ssfCle) ? ssfBrut : null,
        ssfAPreciser: SSF_A_PRECISER.has(ssfCle),
        typeSsf: ['', '-'].includes(v(cols.typeSsf)) ? null : v(cols.typeSsf),
      })
    }
  }
  if (!lignes.length) throw new Error('Aucune ligne lisible : il faut au moins les colonnes « Merchandiser », « Jour » et « Point de visite » (ou « Quartier », ou « Zone »)')
  return lignes
}

// ---------------------------------------------------------------------------
// Territoires et quartiers des PDV
// ---------------------------------------------------------------------------
/**
 * Index des PDV : zones (clé normalisée : « Marcory » = « MARCORY »),
 * quartiers « ZONE›QUARTIER », quartiers par libellé, PDV par identifiant.
 */
export function indexerPdv(pdvs) {
  const zones = new Map() // clé de zone → nombre de PDV actifs
  const quartiers = new Map() // « ZONE›QUARTIER » normalisé → { zone, quartier, cleZone, pdvs }
  const parQuartier = new Map() // libellé de quartier normalisé → [entrées]
  const parId = new Map()
  for (const p of pdvs) {
    parId.set(p.pdv_id, p)
    if (p.is_active === false || !p.zone) continue
    const cleZone = cleTexte(p.zone)
    zones.set(cleZone, (zones.get(cleZone) || 0) + 1)
    if (!p.quartier) continue
    const k = `${cleZone}›${cleTexte(p.quartier)}`
    if (!quartiers.has(k)) {
      const q = { zone: p.zone, quartier: p.quartier, cleZone, pdvs: [] }
      quartiers.set(k, q)
      const kq = cleTexte(p.quartier)
      if (!parQuartier.has(kq)) parQuartier.set(kq, [])
      parQuartier.get(kq).push(q)
    }
    quartiers.get(k).pdvs.push(p)
  }
  return { zones, quartiers, parQuartier, parId }
}

/** Clé d'un lieu « ZONE›QUARTIER » (casse, accents et ponctuation ignorés). */
const cleLieu = (texte) => String(texte || '').split('›').map(cleTexte).join('›')

/** Zones principales d'un portefeuille (PDV des règles de base), sinon les territoires du compte. */
export function zonesPrincipales(pdvIds, index, territoires = []) {
  const nb = new Map()
  for (const id of pdvIds || []) {
    const p = index.parId.get(id)
    if (p?.zone && p.is_active !== false) nb.set(cleTexte(p.zone), (nb.get(cleTexte(p.zone)) || 0) + 1)
  }
  const principales = [...nb].filter(([, n]) => n >= MIN_PDV_ZONE_PORTEFEUILLE).map(([z]) => z)
  if (principales.length) return principales
  if (nb.size) return [...nb.keys()]
  return (territoires || []).map(cleTexte).filter(Boolean)
}

/**
 * Territoire d'une ligne : les zones des PDV de sa commune (« Yopougon » →
 * YOPOUGON 1 à 4 ; « Marcory » → MARCORY, MARCORY TREICHVILLE) ; une commune
 * qui n'est pas une zone des PDV, ou la partie entre parenthèses, est cherchée
 * comme quartier (Anyama → ABOBO 2 › ANYAMA ; « Adjamé (Williamsville) » →
 * les quartiers WILLIAMSVILLE). Sans commune : les zones du secteur.
 * Les quartiers ne se cherchent que dans `admissibles` : ces zones et celles
 * du portefeuille du merchandiser.
 */
export function territoireDe(commune, secteur, index, zonesPortefeuille = []) {
  const toutes = [...index.zones.keys()]
  const zonesDe = (mots) => toutes.filter(kz => kz.split(' ').some(w => mots.includes(w)))
  const motsC = motsLieu(sansParentheses(commune))
  const zonesCommune = zonesDe(motsC)
  const zonesSecteur = zonesDe(motsLieu(secteur))
  const motsQuartier = [...motsC.filter(w => !zonesDe([w]).length), ...entreParentheses(commune).flatMap(motsLieu)]
  const recherche = new Set([...zonesCommune, ...zonesSecteur, ...zonesPortefeuille])
  const quartiers = motsQuartier.length
    ? [...index.quartiers.values()].filter(q => recherche.has(q.cleZone) && motsLieu(q.quartier).some(w => motsQuartier.some(m => motsVoisins(w, m))))
    : []
  const zones = new Set(commune ? [...zonesCommune, ...(zonesCommune.length ? [] : quartiers.map(q => q.cleZone))] : zonesSecteur)
  if (commune && !zones.size) zonesSecteur.forEach(z => zones.add(z))
  return { commune: commune || '', zones, quartiers, admissibles: new Set([...zones, ...quartiers.map(q => q.cleZone), ...zonesPortefeuille]) }
}

/**
 * Libellé approché dans les zones admises : « X et Y » découpé, parenthèses
 * et numéros de fin retirés (« Andokoi 1 » → ANDOKOI), puis tout quartier dont
 * chaque mot significatif est voisin d'un mot du lieu.
 */
export function approcherLieu(texte, admissibles, index) {
  const trouves = new Map()
  for (const partie of cleTexte(sansParentheses(texte)).split(/\bET\b/).map(s => s.trim()).filter(Boolean)) {
    const base = partie.replace(/(\s+\d+[A-Z]{0,2})+$/, '').trim()
    let res = [partie, base].flatMap(t => index.parQuartier.get(t) || []).filter(q => admissibles.has(q.cleZone))
    if (!res.length) {
      const mots = motsLieu(base)
      if (mots.length) {
        res = [...index.quartiers.values()].filter((q) => {
          if (!admissibles.has(q.cleZone)) return false
          const mq = motsLieu(q.quartier)
          return mq.length && mq.every(w => mots.some(m => motsVoisins(w, m)))
        })
      }
    }
    for (const q of res) trouves.set(`${q.cleZone}›${cleTexte(q.quartier)}`, q)
  }
  return [...trouves.values()]
}

/**
 * PDV d'une case : ceux de ses lieux « ZONE›QUARTIER » ; sans lieu mais avec
 * une commune, ceux du portefeuille dans la commune (à défaut, les PDV de la
 * commune dans les territoires du compte).
 */
export function pdvsDeCase(c, { index, portefeuille = [], zonesPortefeuille = [], territoires = [] }) {
  const lieux = uniques((c.lieux || []).map(cleLieu))
  if (lieux.length) {
    return { mode: 'lieu', cle: lieux.sort().join(','), pdvs: lieux.flatMap(k => index.quartiers.get(k)?.pdvs || []) }
  }
  if (!c.commune) return { mode: 'portefeuille', cle: '', pdvs: [] }
  const terr = territoireDe(c.commune, c.secteur, index, zonesPortefeuille)
  if (terr.quartiers.length) {
    const ks = terr.quartiers.map(q => `${q.cleZone}›${cleTexte(q.quartier)}`)
    return { mode: 'lieu', cle: ks.sort().join(','), pdvs: terr.quartiers.flatMap(q => q.pdvs) }
  }
  const dansCommune = p => p && p.is_active !== false && terr.zones.has(cleTexte(p.zone))
  let pdvs = portefeuille.map(id => index.parId.get(id)).filter(dansCommune)
  if (!pdvs.length) {
    const terrCompte = new Set((territoires || []).map(cleTexte))
    pdvs = [...index.quartiers.values()].filter(q => terrCompte.has(q.cleZone)).flatMap(q => q.pdvs).filter(dansCommune)
  }
  return { mode: pdvs.length ? 'commune' : 'portefeuille', cle: `commune:${[...terr.zones].sort().join(',')}`, pdvs }
}

/**
 * Règles de tournée du routing mensuel d'un merchandiser : une par (jour,
 * lieu ou commune, SSF), avec ses semaines. Sert à l'import et à la
 * correction d'une case dans Référentiels › Routing mensuel.
 * cases : { jour_semaine, semaine_du_mois, point_visite, secteur, commune, lieux, ssf, distributeur }.
 */
export function reglesDuRouting(cases, ctx) {
  const { debut = null, origine = 'routing mensuel de l’agence' } = ctx
  const groupes = new Map()
  for (const c of [...cases].sort((a, b) => a.jour_semaine - b.jour_semaine || a.semaine_du_mois - b.semaine_du_mois)) {
    const res = pdvsDeCase(c, ctx)
    if (res.mode === 'portefeuille') continue
    const k = `${c.jour_semaine}|${c.ssf ? (c.ssf.id || c.ssf.nom) : '-'}|${res.cle}`
    if (!groupes.has(k)) groupes.set(k, { c, res, semaines: [] })
    groupes.get(k).semaines.push(c.semaine_du_mois)
  }
  return [...groupes.values()].map(({ c, res, semaines }) => {
    const sems = uniques(semaines).sort((a, b) => a - b)
    const lieux = res.mode === 'commune'
      ? `${c.commune} (quartier non trouvé : portefeuille dans la commune)`
      : uniques(res.pdvs.map(p => `${p.zone} › ${p.quartier}`)).join(', ')
    return {
      label: `${PREFIXE_REGLE}${JOURS[c.jour_semaine]} S${sems.join('+')} — ${c.point_visite || c.commune || c.zone || '—'}`.slice(0, 200),
      ssf: c.ssf || null, days_of_week: [c.jour_semaine], semaines_du_mois: sems,
      territoire: res.mode === 'commune' ? (c.commune || null) : (c.zone || res.pdvs[0]?.zone || null),
      distributeur: c.distributeur || null, date_debut: debut,
      notes: `Routing mensuel (${origine}) : ${c.point_visite || '—'}${c.ssf ? ` avec ${c.ssf.nom || 'SSF'}` : ', sans SSF'} — ${lieux}.`.slice(0, 4000),
      pdv_ids: ordreGps(uniques(res.pdvs.map(p => p.pdv_id)).map(id => ctx.index.parId.get(id))).map(p => p.pdv_id),
    }
  })
}

/**
 * Après une correction dans Référentiels › Routing mensuel : les opérations
 * qui refont les règles du merchandiser depuis ses cases actives, puis ses
 * tournées des `jours` à venir (route /api/admin/imports/routing-mensuel/appliquer).
 */
export async function operationsDepuisRouting(sb, userId, { toutes = toutesLesLignes, jours = 7, auteurId = null, aujourdhui = new Date().toISOString().slice(0, 10) } = {}) {
  const lire = async (q, quoi) => { const { data, error } = await q; if (error) throw new Error(`${quoi} : ${error.message}`); return data }
  const [profil, cases, regles, pdvs] = await Promise.all([
    lire(sb.from('profiles').select('id,territoires_assignes,zone_assignee').eq('id', userId).single(), 'merchandiser'),
    toutes(() => sb.from('routing_mensuel').select('jour_semaine,semaine_du_mois,secteur,commune,point_visite,zone,lieux,ssf_id,distributeur')
      .eq('merchandiser_id', userId).eq('actif', true).order('id')),
    toutes(() => sb.from('routing_templates').select('id,user_id,label,is_active,ssf_id').eq('user_id', userId).order('id')),
    toutes(() => sb.from('pdv').select('pdv_id,zone,quartier,is_active,geolocation_lat,geolocation_lng').order('pdv_id')),
  ])
  const base = regles.filter(r => r.is_active !== false && !r.ssf_id && !/^(SSF — |Routing mensuel — )/.test(r.label || '')).map(r => r.id)
  const reglesPdv = []
  for (let i = 0; i < base.length; i += 50) {
    reglesPdv.push(...await toutes(() => sb.from('routing_template_pdv').select('template_id,pdv_id,position_order').in('template_id', base.slice(i, i + 50)).order('id')))
  }
  const index = indexerPdv(pdvs)
  const portefeuille = portefeuilleDe(userId, regles, reglesPdv)
  const territoires = (profil.territoires_assignes || []).length ? profil.territoires_assignes : [profil.zone_assignee].filter(Boolean)
  const ctx = { index, portefeuille, territoires, zonesPortefeuille: zonesPrincipales(portefeuille, index, territoires), debut: aujourdhui, origine: 'correction dans Référentiels' }
  const regs = reglesDuRouting(cases.map(c => ({ ...c, ssf: c.ssf_id ? { id: c.ssf_id } : null })), ctx)
  const d0 = new Date(`${aujourdhui}T12:00:00Z`)
  const plus = n => { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  return [
    { type: 'regles_mensuelles.remplacer', user_id: userId, created_by: auteurId, regles: regs },
    { type: 'tournees.recalculer', user_id: userId, debut: plus(1), fin: plus(jours) },
  ]
}

/** PDV du portefeuille d'un merchandiser : ses règles actives hors SSF et hors routing mensuel. */
export function portefeuilleDe(userId, regles, reglesPdv) {
  const ids = new Set(regles.filter(r => r.user_id === userId && r.is_active !== false && !r.ssf_id && !/^(SSF — |Routing mensuel — )/.test(r.label || '')).map(r => r.id))
  return uniques(reglesPdv.filter(x => ids.has(x.template_id)).sort((a, b) => a.position_order - b.position_order).map(x => x.pdv_id))
}

export const lireRoutingMensuelExcel = (wb) => lireRoutingMensuel(feuillesDepuisClasseur(wb))
export const lireRoutingMensuelCsv = (texte, nom = 'CSV') => lireRoutingMensuel(feuillesDepuisCsv(texte, nom))

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------
export async function chargerDonneesRoutingMensuel(sb, { onEtape, toutes = toutesLesLignes } = {}) {
  const etape = (m) => onEtape?.(m)
  etape('Comptes')
  let codesAgences = ['atom']
  try {
    const agences = await toutes(() => sb.from('agence').select('code,programme,actif').order('code'))
    const programmes = agences.filter(a => a.programme && a.actif !== false).map(a => a.code)
    if (programmes.length) codesAgences = programmes
  }
  catch { /* table absente : Atom seul */ }
  const [profils, commerciaux, distributeurs, aliasImport] = await Promise.all([
    toutes(() => sb.from('profiles')
      .select('id,email,nom,role,employeur,is_active,zone_assignee,territoires_assignes,quartiers_assignes,commercial_id')
      .eq('role', 'merchandiser').in('employeur', codesAgences).order('id')),
    toutes(() => sb.from('profiles').select('id,email,nom,role,is_active').in('role', ['commercial', 'admin']).order('id')),
    toutes(() => sb.from('distributeur').select('id,nom').order('id')),
    chargerAlias(sb, toutes),
  ])
  let ssfs
  try { ssfs = await toutes(() => sb.from('ssf').select('id,nom,nom_brut,distributeur_id,commercial_id,actif').order('id')) }
  catch { ssfs = await toutes(() => sb.from('ssf').select('id,nom,nom_brut,distributeur_id,actif').order('id')) }
  etape('PDV')
  const pdvs = await toutes(() => sb.from('pdv').select('pdv_id,zone,quartier,is_active,geolocation_lat,geolocation_lng').order('pdv_id'))
  etape('Règles de tournée')
  const ids = profils.filter(p => p.is_active !== false).map(p => p.id)
  let migrationAppliquee = true
  const regles = []
  for (let i = 0; i < ids.length; i += 100) {
    try {
      regles.push(...await toutes(() => sb.from('routing_templates')
        .select('id,user_id,label,mode,days_of_week,day_of_week,is_active,territoire,distributeur,ssf_id,semaines_du_mois,repli,date_debut,notes')
        .in('user_id', ids.slice(i, i + 100)).order('id')))
    }
    catch {
      migrationAppliquee = false
      regles.push(...await toutes(() => sb.from('routing_templates')
        .select('id,user_id,label,mode,days_of_week,day_of_week,is_active,territoire,distributeur,ssf_id,date_debut,notes')
        .in('user_id', ids.slice(i, i + 100)).order('id')))
    }
  }
  // PDV des règles SSF / routing mensuel (retour arrière) et des règles de base (portefeuille).
  const aRetenir = regles.filter(r => /^(SSF — |Routing mensuel — )/.test(r.label || '') || (r.is_active !== false && !r.ssf_id)).map(r => r.id)
  const reglesPdv = []
  for (let i = 0; i < aRetenir.length; i += 50) {
    reglesPdv.push(...await toutes(() => sb.from('routing_template_pdv')
      .select('template_id,pdv_id,position_order').in('template_id', aRetenir.slice(i, i + 50)).order('id')))
  }
  etape('Routing en place')
  let routingAvant = []
  try {
    routingAvant = await toutes(() => sb.from('routing_mensuel')
      .select('merchandiser_id,jour_semaine,semaine_du_mois,secteur,commune,point_visite,zone,quartiers,lieux,ssf_id,ssf_texte,type_engin,commercial_id,distributeur,source')
      .eq('actif', true).order('id'))
  }
  catch { migrationAppliquee = false }
  let ssfQuartiers = []
  try { ssfQuartiers = await toutes(() => sb.from('ssf_quartier').select('ssf_id,zone,quartier,source,a_confirmer').order('id')) }
  catch { /* sous-zones absentes */ }
  return { profils, commerciaux, distributeurs, aliasImport, ssfs, pdvs, regles, reglesPdv, routingAvant, ssfQuartiers, migrationAppliquee, codesAgences }
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
export function simulerRoutingMensuel(lignes, donnees, options = {}) {
  const fichier = options.fichier || 'fichier de l’agence'
  const source = `client-${fichier}`.slice(0, 200)
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const debut = options.debut || aujourdhui
  const { profils, commerciaux, distributeurs, aliasImport, ssfs, pdvs, regles, reglesPdv, routingAvant, ssfQuartiers } = donnees
  const bloquants = donnees.migrationAppliquee === false
    ? ['Les migrations du routing mensuel (20261008130000, 20261009120000) ne sont pas toutes appliquées.']
    : []
  const avertissements = []

  const actifs = profils.filter(p => p.is_active !== false)
  const nomsDistributeurs = distributeurs.map(d => d.nom)
  const distParNom = new Map(distributeurs.map(d => [norm(d.nom), d]))
  const ssfParId = new Map(ssfs.map(s => [s.id, s]))
  const ssfActifs = ssfs.filter(s => s.actif !== false)
  const nomsSsf = s => [s.nom, ...String(s.nom_brut || '').split('|').filter(Boolean)]

  // ---- Quartiers des PDV, portefeuilles ---------------------------------------
  const index = indexerPdv(pdvs)
  const { quartiers, parQuartier } = index
  const cachePf = new Map()
  const portefeuilleCtx = (profil) => {
    if (!cachePf.has(profil.id)) {
      const portefeuille = portefeuilleDe(profil.id, regles, reglesPdv)
      const territoires = (profil.territoires_assignes || []).length ? profil.territoires_assignes : [profil.zone_assignee].filter(Boolean)
      cachePf.set(profil.id, { index, portefeuille, territoires, zonesPortefeuille: zonesPrincipales(portefeuille, index, territoires) })
    }
    return cachePf.get(profil.id)
  }

  // ---- Rapprochements --------------------------------------------------------
  const cacheMerch = new Map()
  const merchDe = (texte) => {
    const k = cleNom(texte)
    if (!cacheMerch.has(k)) {
      const alias = resoudreAlias(texte, aliasImport, 'merchandiser')
      cacheMerch.set(k, trouverPersonne(texte, actifs, { noms: p => [p.nom, p.email], alias }))
    }
    return cacheMerch.get(k)
  }
  const cacheCommercial = new Map()
  const commercialDe = (texte) => {
    if (!texte) return { trouve: null, certitude: null, candidats: [] }
    const k = cleNom(texte)
    if (!cacheCommercial.has(k)) {
      const alias = resoudreAlias(texte, aliasImport, 'commercial')
      cacheCommercial.set(k, trouverPersonne(texte, commerciaux.filter(c => c.is_active !== false), { noms: c => [c.nom, c.email], alias }))
    }
    return cacheCommercial.get(k)
  }
  const distributeurDe = (texte) => {
    if (!texte) return null
    const viaAlias = resoudreAlias(texte, aliasImport, 'distributeur')
    const nom = viaAlias || distributeurCanonique(texte, nomsDistributeurs)
    return distParNom.get(norm(nom)) || null
  }
  // SSF : d'abord parmi ceux du distributeur, puis tous (exact ou alias seulement).
  const cacheSsf = new Map()
  const ssfDe = (texte, dist) => {
    const k = `${dist?.id || ''}|${cleNom(texte)}`
    if (!cacheSsf.has(k)) {
      const alias = resoudreAlias(texte, aliasImport, 'ssf')
      let r = dist ? trouverPersonne(texte, ssfActifs.filter(s => s.distributeur_id === dist.id), { noms: nomsSsf, alias }) : { trouve: null, candidats: [] }
      if (!r.trouve) {
        const tous = trouverPersonne(texte, ssfActifs, { noms: nomsSsf, alias })
        if (tous.trouve && (tous.certitude !== 'approche' || !dist)) r = tous
        else if (!r.candidats.length) r = { ...r, candidats: tous.candidats }
      }
      cacheSsf.set(k, r)
    }
    return cacheSsf.get(k)
  }
  // Lieu → quartiers, dans le territoire de la ligne seulement : alias validé,
  // libellé identique, libellé approché, sinon la commune.
  const cacheLieu = new Map()
  const lieuDe = (l, ctx) => {
    const terr = territoireDe(l.commune, l.secteur, index, ctx.zonesPortefeuille)
    const k = `${cleTexte(l.secteur)}|${cleTexte(l.commune)}|${cleTexte(l.lieu)}|${[...terr.admissibles].sort().join(',')}`
    if (cacheLieu.has(k)) return cacheLieu.get(k)
    const base = { secteur: l.secteur, commune: l.commune, point: l.lieu, cases: 0 }
    let res
    const alias = resoudreAlias(l.lieu, aliasImport, 'quartier')
    if (alias) {
      const cibles = alias.split('|').map(x => x.trim()).filter(Boolean)
      const trouves = cibles.map(c => quartiers.get(cleLieu(c))).filter(Boolean)
      res = trouves.length
        ? { statut: 'alias', quartiers: trouves, horsTerritoire: trouves.filter(q => !terr.admissibles.has(q.cleZone)) }
        : { statut: 'introuvable', quartiers: [], motif: `alias « ${alias} » : quartier absent des PDV` }
    }
    if (!res) {
      const exacts = (parQuartier.get(cleTexte(l.lieu)) || []).filter(q => terr.admissibles.has(q.cleZone))
      if (exacts.length) res = { statut: 'exact', quartiers: exacts }
    }
    if (!res) {
      const approches = approcherLieu(l.lieu, terr.admissibles, index)
      if (approches.length && approches.length <= MAX_QUARTIERS_APPROCHES) res = { statut: 'approche', quartiers: approches }
      else if (approches.length) base.motif = `${approches.length} quartiers approchés, trop pour trancher`
    }
    if (!res && l.commune && (terr.quartiers.length || terr.zones.size)) {
      res = { statut: 'commune', quartiers: terr.quartiers, zones: terr.zones }
    }
    if (!res) res = { statut: 'introuvable', quartiers: [] }
    res = { ...base, ...res }
    if (['commune', 'introuvable'].includes(res.statut)) res.propositions = proposerQuartiers(l.lieu, l.commune || l.secteur, quartiers, 3, terr.admissibles)
    cacheLieu.set(k, res)
    return res
  }

  // ---- Cases du routing ------------------------------------------------------
  const cases = new Map() // userId → Map(« jour|semaine » → case)
  const merchInconnus = new Map()
  const doublons = []
  for (const l of lignes) {
    const m = merchDe(l.merch)
    if (!m.trouve) {
      if (!merchInconnus.has(cleNom(l.merch))) merchInconnus.set(cleNom(l.merch), { texte: l.merch, secteur: l.secteur, lignes: 0, pistes: m.candidats })
      merchInconnus.get(cleNom(l.merch)).lignes++
      continue
    }
    if (!l.jours.length) { avertissements.push(`${l.feuille} l.${l.ligne} : jour « illisible », ligne ignorée`); continue }
    const dist = distributeurDe(l.distributeur)
    const ssf = l.ssf ? ssfDe(l.ssf, dist) : null
    const com = departagerHomonymes(commercialDe(l.salesRep), m.trouve.commercial_id)
    const lieu = lieuDe(l, portefeuilleCtx(m.trouve))
    lieu.cases += l.jours.length * l.semaines.length
    if (!cases.has(m.trouve.id)) cases.set(m.trouve.id, new Map())
    const siennes = cases.get(m.trouve.id)
    for (const j of l.jours) {
      for (const s of l.semaines) {
        const k = `${j}|${s}`
        if (siennes.has(k)) doublons.push(`${m.trouve.nom} : ${JOURS[j]} semaine ${s} (l.${siennes.get(k).ligne} et l.${l.ligne}) — la dernière ligne est gardée`)
        siennes.set(k, { ...l, jour: j, semaine: s, merchandiser: m.trouve, merchCertitude: m.certitude, dist, ssfRes: ssf, com, lieu })
      }
    }
  }

  // ---- SSF à créer, à relier ------------------------------------------------
  const ssfACreer = new Map()
  const ssfARelier = new Map()
  const refSsf = (c) => {
    if (!c.ssf) return null
    if (c.ssfRes?.trouve) return { id: c.ssfRes.trouve.id, nom: c.ssfRes.trouve.nom }
    const k = cleNom(c.ssf)
    if (c.ssfRes?.candidats?.length) {
      if (!ssfARelier.has(k)) ssfARelier.set(k, { texte: c.ssf, distributeur: c.dist?.nom || c.distributeur, pistes: c.ssfRes.candidats.map(s => s.nom), cases: 0 })
      ssfARelier.get(k).cases++
      return null
    }
    if (!ssfACreer.has(k)) ssfACreer.set(k, { nom: c.ssf.trim(), distributeur: c.dist?.nom || null, cases: 0 })
    ssfACreer.get(k).cases++
    return { nom: c.ssf.trim() }
  }

  // ---- Opérations ------------------------------------------------------------
  const operations = []
  const retour = []
  const plannings = []
  const quartiersParSsf = new Map() // clé SSF → { ref, cles:Set, lignes:[] }
  const commerciauxParSsf = new Map()
  const ecartsCommerciaux = []
  const sansRegleDePortefeuille = []
  const regleOps = []
  for (const [userId, siennes] of cases) {
    const profil = actifs.find(p => p.id === userId)
    const liste = [...siennes.values()].sort((a, b) => a.jour - b.jour || a.semaine - b.semaine)
    const lignesRm = liste.map((c) => {
      const ref = refSsf(c)
      const q = c.lieu.quartiers
      if (ref && q.length) {
        const k = ref.id ? `id:${ref.id}` : `nom:${cleNom(ref.nom)}`
        if (!quartiersParSsf.has(k)) quartiersParSsf.set(k, { ref, cles: new Set(), lignes: [] })
        const e = quartiersParSsf.get(k)
        for (const x of q) { const kk = `${x.zone}|${x.quartier}`; if (!e.cles.has(kk)) { e.cles.add(kk); e.lignes.push({ zone: x.zone, quartier: x.quartier }) } }
      }
      if (ref && c.com.trouve) {
        const k = ref.id ? `id:${ref.id}` : `nom:${cleNom(ref.nom)}`
        if (!commerciauxParSsf.has(k)) commerciauxParSsf.set(k, { ref, ids: new Set() })
        commerciauxParSsf.get(k).ids.add(c.com.trouve.id)
      }
      return {
        jour_semaine: c.jour, semaine_du_mois: c.semaine,
        secteur: c.secteur || null, commune: c.commune || null, point_visite: c.point || null,
        zone: q[0]?.zone || null, quartiers: uniques(q.map(x => x.quartier)),
        lieux: uniques(q.map(x => `${x.zone}›${x.quartier}`)),
        ssf: ref, ssf_texte: c.ssfTexte || null, type_engin: c.typeSsf || null,
        commercial_id: c.com.trouve?.id || null, distributeur: c.dist?.nom || c.distributeur || null,
        _case: c,
      }
    })
    operations.push({ type: 'routing_mensuel.remplacer', user_id: userId, source, lignes: lignesRm.map(({ _case, ...l }) => l) })
    retour.push({
      type: 'routing_mensuel.remplacer', user_id: userId, source: 'retour',
      lignes: routingAvant.filter(r => r.merchandiser_id === userId).map(r => ({
        jour_semaine: r.jour_semaine, semaine_du_mois: r.semaine_du_mois, secteur: r.secteur, point_visite: r.point_visite,
        commune: r.commune || null, zone: r.zone, quartiers: r.quartiers || [], lieux: r.lieux || [],
        ssf: r.ssf_id ? { id: r.ssf_id, nom: ssfParId.get(r.ssf_id)?.nom } : null,
        ssf_texte: r.ssf_texte, type_engin: r.type_engin, commercial_id: r.commercial_id, distributeur: r.distributeur, source: r.source,
      })),
    })

    // Règles : une par (jour, lieu ou commune, SSF), avec ses semaines ; case sans lieu ni commune → repli.
    const ctxPf = portefeuilleCtx(profil)
    const reglesNouvelles = reglesDuRouting(lignesRm, { ...ctxPf, debut, origine: fichier })
    for (const l of lignesRm) l.parCommune = !l.lieux.length && pdvsDeCase(l, ctxPf).mode === 'commune'
    regleOps.push({ type: 'regles_mensuelles.remplacer', user_id: userId, created_by: options.auteurId || null, regles: reglesNouvelles })
    const avant = regles.filter(r => r.user_id === userId && /^(SSF — |Routing mensuel — )/.test(r.label || ''))
    retour.push({
      type: 'regles_mensuelles.remplacer', user_id: userId,
      regles: avant.map(r => ({
        label: r.label, ssf: r.ssf_id ? { id: r.ssf_id, nom: ssfParId.get(r.ssf_id)?.nom } : null,
        days_of_week: r.days_of_week || [r.day_of_week], semaines_du_mois: r.semaines_du_mois || null,
        territoire: r.territoire, distributeur: r.distributeur, date_debut: r.date_debut, notes: r.notes,
        pdv_ids: reglesPdv.filter(x => x.template_id === r.id).sort((a, b) => a.position_order - b.position_order).map(x => x.pdv_id),
      })).filter(r => r.days_of_week.length && r.days_of_week.every(j => j != null)),
    })

    // Règle de portefeuille → repli, tous les jours, en quotas.
    const portefeuilles = regles.filter(r => r.user_id === userId && r.is_active !== false && !/^(SSF — |Routing mensuel — )/.test(r.label || '') && !r.ssf_id)
    if (!portefeuilles.length) sansRegleDePortefeuille.push(profil.nom || profil.email)
    for (const r of portefeuilles) {
      operations.push({ type: 'regle.jours', template_id: r.id, days_of_week: [1, 2, 3, 4, 5, 6], is_active: true, mode: 'quota', repli: true })
      retour.push({ type: 'regle.jours', template_id: r.id, days_of_week: r.days_of_week || [r.day_of_week].filter(j => j != null), is_active: r.is_active !== false, mode: r.mode || 'perimetre', repli: !!r.repli })
    }

    // Périmètre : zones et quartiers des cases ajoutés (jamais retirés).
    const terrAvant = (profil.territoires_assignes || []).length ? profil.territoires_assignes : (profil.zone_assignee ? [profil.zone_assignee] : [])
    const qAvant = profil.quartiers_assignes || []
    const zones = uniques(liste.flatMap(c => c.lieu.quartiers.map(x => x.zone)))
    const qs = uniques(liste.flatMap(c => c.lieu.quartiers.map(x => x.quartier)))
    const terrApres = uniques([...terrAvant, ...zones])
    const qApres = qAvant.length ? uniques([...qAvant, ...qs]) : []
    if (terrApres.length !== terrAvant.length || qApres.length !== qAvant.length) {
      operations.push({ type: 'profil.perimetre', user_id: userId, territoires_assignes: terrApres, quartiers_assignes: qApres })
      retour.push({ type: 'profil.perimetre', user_id: userId, territoires_assignes: profil.territoires_assignes || [], quartiers_assignes: qAvant })
    }
    if (options.pregenererJours > 0) {
      const d0 = new Date(`${aujourdhui}T12:00:00Z`)
      const plus = n => { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
      const op = { type: 'tournees.recalculer', user_id: userId, debut: plus(1), fin: plus(options.pregenererJours) }
      regleOps.push(op)
      retour.push(op)
    }

    // Commercial du fichier ≠ commercial du compte : signalé, pas modifié.
    const coms = uniques(liste.map(c => c.com.trouve?.id))
    const texteRep = uniques(liste.map(c => c.salesRep)).join(', ')
    if (coms.length === 1 && coms[0] !== profil.commercial_id) {
      ecartsCommerciaux.push({ merch: profil.nom, fichier: `${texteRep} → ${commerciaux.find(c => c.id === coms[0])?.nom}`, base: commerciaux.find(c => c.id === profil.commercial_id)?.nom || 'aucun' })
    }
    else if (!coms.length && texteRep) {
      ecartsCommerciaux.push({ merch: profil.nom, fichier: `${texteRep} (aucun compte reconnu)`, base: commerciaux.find(c => c.id === profil.commercial_id)?.nom || 'aucun' })
    }

    plannings.push({ profil, liste: lignesRm, regles: reglesNouvelles, certitude: liste[0]?.merchCertitude, texte: liste[0]?.merch })
  }

  // Un SSF se crée avec son distributeur (obligatoire en base).
  for (const s of ssfACreer.values()) {
    if (!s.distributeur) bloquants.push(`SSF « ${s.nom} » à créer : distributeur introuvable (ajouter un alias de distributeur, puis simuler à nouveau).`)
  }
  // SSF à créer d'abord, puis le routing (qui les nomme), puis les règles.
  const opsSsf = [...ssfACreer.values()].map(s => ({ type: 'ssf.creer', nom: s.nom, distributeur: s.distributeur, telephone: null, source }))
  const opsQuartiers = []
  for (const { ref, lignes: lq } of quartiersParSsf.values()) {
    opsQuartiers.push({ type: 'ssf_quartier.remplacer', ssf: ref, remplace: ['derive-', 'client-'], lignes: lq.map(x => ({ zone: x.zone, quartier: x.quartier, source, a_confirmer: false })) })
    if (ref.id) {
      const avant = ssfQuartiers.filter(q => q.ssf_id === ref.id && /^(derive-|client-)/.test(q.source || ''))
      retour.push({ type: 'ssf_quartier.remplacer', ssf: ref, remplace: ['derive-', 'client-'], lignes: avant.map(q => ({ zone: q.zone, quartier: q.quartier, source: q.source, a_confirmer: q.a_confirmer })) })
    }
  }
  const opsCommercialSsf = []
  for (const { ref, ids } of commerciauxParSsf.values()) {
    if (ids.size !== 1) continue
    if (ref.id && ssfParId.get(ref.id)?.commercial_id) continue
    opsCommercialSsf.push({ type: 'ssf.commercial', ssf: ref, commercial_id: [...ids][0] })
    retour.push({ type: 'ssf.commercial', ssf: ref, commercial_id: null })
  }
  const toutes = [...opsSsf, ...operations.filter(o => o.type === 'routing_mensuel.remplacer'), ...opsQuartiers, ...opsCommercialSsf,
    ...regleOps.filter(o => o.type === 'regles_mensuelles.remplacer'), ...operations.filter(o => o.type !== 'routing_mensuel.remplacer'),
    ...regleOps.filter(o => o.type === 'tournees.recalculer')]
  // Retour : dans l'ordre inverse des dépendances (règles avant routing).
  const ordreRetour = ['tournees.recalculer', 'regles_mensuelles.remplacer', 'regle.jours', 'profil.perimetre', 'ssf.commercial', 'ssf_quartier.remplacer', 'routing_mensuel.remplacer']
  const retourTrie = ordreRetour.flatMap(t => retour.filter(o => o.type === t))

  // ---- Rapport --------------------------------------------------------------
  const nbCases = plannings.reduce((n, p) => n + p.liste.length, 0)
  const lieux = [...cacheLieu.entries()]
  const nbLieux = (s) => lieux.filter(([, r]) => r.statut === s).length
  const resume = {
    lignes: lignes.length,
    merchandisers: plannings.length,
    merchandisersInconnus: merchInconnus.size,
    cases: nbCases,
    casesSansSsf: plannings.reduce((n, p) => n + p.liste.filter(l => !l.ssf).length, 0),
    casesSansLieu: plannings.reduce((n, p) => n + p.liste.filter(l => !l.lieux.length && !l.parCommune).length, 0),
    casesCommune: plannings.reduce((n, p) => n + p.liste.filter(l => l.parCommune).length, 0),
    regles: plannings.reduce((n, p) => n + p.regles.length, 0),
    lieuxExacts: nbLieux('exact'),
    lieuxAlias: nbLieux('alias'),
    lieuxApproches: nbLieux('approche'),
    lieuxCommune: nbLieux('commune'),
    lieuxIntrouvables: nbLieux('introuvable'),
    ssfACreer: ssfACreer.size,
    ssfARelier: ssfARelier.size,
    operations: toutes.length,
  }

  const md = []
  md.push('# Routing mensuel des merchandisers', '')
  md.push(`Fichier : ${fichier} — ${lignes.length} lignes. Chaque case = un merchandiser, un jour, une semaine du mois, un point de visite et, s’il y en a un, le SSF du jour (binôme sans lien hiérarchique : tous deux dépendent du commercial).`)
  md.push('', '## Résumé', '')
  md.push(`- Merchandisers reconnus : ${resume.merchandisers} (${resume.cases} cases, dont ${resume.casesSansSsf} sans SSF) ; non reconnus : ${resume.merchandisersInconnus}.`)
  md.push(`- Lieux, toujours cherchés dans la commune de la ligne et le portefeuille du merchandiser : ${resume.lieuxExacts} reconnus tels quels, ${resume.lieuxAlias} par un alias validé, ${resume.lieuxApproches} approchés (à relire ci-dessous), ${resume.lieuxCommune} traités au niveau de la commune, ${resume.lieuxIntrouvables} sans commune reconnue.`)
  md.push(`- Cases : ${resume.casesCommune} au niveau de la commune (portefeuille du merchandiser dans la commune) ; ${resume.casesSansLieu} sans lieu ni commune (portefeuille entier ce jour-là).`)
  md.push(`- Règles de tournée créées : ${resume.regles}. La règle de portefeuille de chaque merchandiser passe en « repli » (jours sans case : 5e semaine, case vide) ; elle complète aussi une journée dont la case ne suffit pas.`)
  md.push(`- SSF : ${resume.ssfACreer} à créer, ${resume.ssfARelier} à relier (orthographe proche d’un SSF existant : ajouter un alias, puis relancer la simulation).`)
  if (sansRegleDePortefeuille.length) md.push(`- Sans règle de portefeuille (aucune tournée les jours sans case) : ${sansRegleDePortefeuille.join(', ')}.`)
  if (merchInconnus.size) {
    md.push('', '## Merchandisers non reconnus (lignes en attente)', '')
    for (const m of merchInconnus.values()) md.push(`- « ${m.texte} » (${m.secteur || '—'}, ${m.lignes} lignes)${m.pistes.length ? ` — pistes : ${m.pistes.map(p => p.nom).join(', ')}` : ' — aucun compte proche'}.`)
  }
  const approches = plannings.filter(p => p.certitude === 'approche')
  if (approches.length) md.push('', `Reconnus malgré une orthographe différente : ${approches.map(p => `« ${p.texte} » = ${p.profil.nom}`).join(' ; ')}.`)
  if (ecartsCommerciaux.length) {
    md.push('', '## Commerciaux : fichier ≠ base (non modifiés)', '')
    for (const e of ecartsCommerciaux) md.push(`- ${e.merch} : fichier ${e.fichier} ; base : ${e.base}.`)
  }
  if (ssfARelier.size || ssfACreer.size) {
    md.push('', '## SSF', '')
    for (const s of ssfARelier.values()) md.push(`- À relier : « ${s.texte} » (${s.distributeur || '—'}, ${s.cases} cases) — pistes : ${s.pistes.join(', ')}. Ces cases restent sans SSF tant que l’alias n’est pas ajouté.`)
    for (const s of ssfACreer.values()) md.push(`- À créer : « ${s.nom} » (${s.distributeur || 'distributeur inconnu'}, ${s.cases} cases).`)
  }
  const aPreciser = uniques(lignes.filter(l => l.ssfAPreciser).map(l => `${l.merch} (${JOURS[l.jours[0]] || '?'} S${l.semaines.join('+')}) : « ${l.ssfTexte} »`))
  if (aPreciser.length) md.push('', `SSF « à préciser » dans le fichier (case gardée sans SSF) : ${aPreciser.join(' ; ')}.`)
  const qListe = qs => uniques(qs.map(q => `${q.zone} › ${q.quartier} (${q.pdvs.length} PDV)`)).join(' ; ')
  const lieuxDe = statut => lieux.map(([, r]) => r).filter(r => r.statut === statut)
  if (lieuxDe('approche').length) {
    md.push('', '## Lieux approchés dans la commune (à relire)', '')
    md.push('Rattachés automatiquement : numéro, parenthèses ou une faute ignorés, jamais hors de la commune ni du portefeuille. Un rapprochement faux se corrige par un alias « quartier », puis on simule à nouveau.')
    md.push('', '| Commune | Lieu | Quartiers retenus | Cases |', '|---|---|---|---|')
    for (const r of lieuxDe('approche')) md.push(`| ${r.commune || r.secteur || '—'} | ${r.point} | ${qListe(r.quartiers)} | ${r.cases} |`)
  }
  const horsTerr = lieuxDe('alias').filter(r => r.horsTerritoire?.length)
  if (horsTerr.length) {
    md.push('', '## Alias hors de la commune (appliqués, à vérifier)', '')
    for (const r of horsTerr) md.push(`- ${r.point} (${r.commune || r.secteur || '—'}) → ${qListe(r.horsTerritoire)}.`)
  }
  md.push('', '## Lieux à rattacher', '')
  md.push('Quartier absent de la commune : la case vaut pour la commune (portefeuille du merchandiser dans la commune). Pour viser un quartier, ajouter un alias de type « quartier » (Référentiels › Alias d’import ; cible « ZONE›QUARTIER », plusieurs séparées par « | »). Les propositions ne sont jamais appliquées seules.')
  md.push('', '| Secteur | Commune | Point de visite | Traitement | Propositions |', '|---|---|---|---|---|')
  for (const r of [...lieuxDe('commune'), ...lieuxDe('introuvable')].slice(0, 300)) {
    const traitement = r.statut === 'commune'
      ? (r.quartiers.length ? `quartiers de la commune : ${uniques(r.quartiers.map(q => q.quartier)).join(', ')}` : 'commune (portefeuille)')
      : 'portefeuille entier'
    md.push(`| ${r.secteur || '—'} | ${r.commune || '—'} | ${r.point} | ${traitement} | ${r.motif || (r.propositions || []).map(p => `${p.zone} › ${p.quartier} (${p.nb} PDV)`).join(' ; ') || '—'} |`)
  }
  md.push('', '## Planning par merchandiser', '')
  for (const p of plannings) {
    md.push(`### ${p.profil.nom} — ${p.profil.email}`, '')
    md.push('| Jour | S1 | S2 | S3 | S4 |', '|---|---|---|---|---|')
    for (const j of [1, 2, 3, 4, 5, 6]) {
      const cel = (s) => {
        const l = p.liste.find(x => x.jour_semaine === j && x.semaine_du_mois === s)
        if (!l) return '—'
        const marque = l.lieux.length ? (l._case.lieu.statut === 'approche' ? ' ≈' : '') : l.parCommune ? ' ◌' : ' ⚠'
        return `${l.point_visite || '?'}${marque}${l.ssf ? ` · ${l.ssf.nom}` : ''}`
      }
      md.push(`| ${JOURS[j]} | ${cel(1)} | ${cel(2)} | ${cel(3)} | ${cel(4)} |`)
    }
    md.push('', '≈ = quartier approché ; ◌ = quartier non trouvé, portefeuille dans la commune ; ⚠ = ni lieu ni commune (portefeuille entier ce jour-là).', '')
  }
  if (doublons.length) md.push('', '## Cases en double dans le fichier', '', ...doublons.map(d => `- ${d}`))
  if (avertissements.length) md.push('', '## Avertissements', '', ...avertissements.map(a => `- ${a}`))
  md.push('', '## Retour arrière', '', '« Annuler le lot » (Imports terrain) remet le routing, les règles, la règle de portefeuille, les quartiers des SSF et les périmètres d’avant. Les SSF créés restent (à désactiver dans Référentiels si besoin).')

  const csv = {
    'routing-mensuel.csv': csvTexte(['Merchandiser', 'Email', 'Jour', 'Semaine', 'Secteur', 'Commune', 'Point de visite', 'Rattachement', 'Quartiers retenus', 'SSF', 'Engin', 'Commercial', 'Distributeur'],
      plannings.flatMap(p => p.liste.map(l => [p.profil.nom, p.profil.email, JOURS[l.jour_semaine], l.semaine_du_mois, l.secteur || '', l.commune || '', l.point_visite || '',
        l.lieux.length ? l._case.lieu.statut : l.parCommune ? 'commune' : 'portefeuille', l.lieux.join(' | '), l.ssf?.nom || l.ssf_texte || '', l.type_engin || '', commerciaux.find(c => c.id === l.commercial_id)?.nom || '', l.distributeur || '']))),
    'lieux-a-rattacher.csv': csvTexte(['Secteur', 'Commune', 'Point de visite', 'Traitement', 'Propositions', 'Quartier confirmé (ZONE›QUARTIER)'],
      lieux.map(([, r]) => r).filter(r => ['commune', 'introuvable'].includes(r.statut))
        .map(r => [r.secteur || '', r.commune || '', r.point, r.statut === 'commune' ? 'commune' : 'portefeuille', (r.propositions || []).map(x => `${x.zone}›${x.quartier}`).join(' | '), ''])),
    'lieux-approches.csv': csvTexte(['Secteur', 'Commune', 'Point de visite', 'Quartiers retenus (ZONE›QUARTIER)', 'Cases'],
      lieux.map(([, r]) => r).filter(r => r.statut === 'approche')
        .map(r => [r.secteur || '', r.commune || '', r.point, uniques(r.quartiers.map(q => `${q.zone}›${q.quartier}`)).join(' | '), r.cases])),
    'noms-a-verifier.csv': csvTexte(['Type', 'Dans le fichier', 'Pistes dans la base'], [
      ...[...merchInconnus.values()].map(m => ['Merchandiser', m.texte, m.pistes.map(x => x.nom).join(' | ')]),
      ...[...ssfARelier.values()].map(s => ['SSF', s.texte, s.pistes.join(' | ')]),
      ...ecartsCommerciaux.map(e => ['Commercial', `${e.merch} : ${e.fichier}`, e.base]),
    ]),
  }

  return { resume, rapport: md.join('\n') + '\n', csv, operations: toutes, retour: retourTrie, bloquants, avertissements, plannings, lieux: cacheLieu }
}

/**
 * Comptes homonymes (deux « N'GUESSAN OPHELIA ») : le commercial actuel du
 * merchandiser s'il en fait partie, sinon le compte de rôle commercial.
 */
export function departagerHomonymes(res, commercialActuel) {
  if (res.trouve || res.candidats.length < 2) return res
  const cles = new Set(res.candidats.map(c => cleNom(c.nom)))
  if (cles.size !== 1) return res
  const choisi = res.candidats.find(c => c.id === commercialActuel) || res.candidats.find(c => c.role === 'commercial')
  return choisi ? { trouve: choisi, certitude: 'approche', candidats: res.candidats } : res
}

/**
 * Quartiers proches d'un lieu (mots communs, une faute tolérée), pour le
 * rapport ; seulement dans `zones` (clés normalisées) quand elles sont données.
 */
export function proposerQuartiers(point, secteur, quartiers, max = 3, zones = null) {
  const mp = motsLieu(point)
  if (!mp.length) return []
  const communes = motsLieu(secteur)
  return [...quartiers.values()].filter(q => !zones || zones.has(cleTexte(q.zone))).map((q) => {
    const mq = motsLieu(q.quartier)
    const communs = mp.filter(w => mq.some(m => motsProches(w, m) || m.startsWith(w) || w.startsWith(m))).length
    let score = communs / mp.length
    if (score && communes.some(c => cleTexte(q.zone).includes(c))) score += 0.5
    return { zone: q.zone, quartier: q.quartier, nb: q.pdvs.length, score }
  }).filter(x => x.score >= 0.5).sort((a, b) => b.score - a.score || b.nb - a.nb).slice(0, max)
}

// Mots d'un nom de personne : réexporté pour les tests.
export { motsPersonne }
