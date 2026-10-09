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
 *   - point de visite → quartier(s) des PDV : alias « quartier » validé, sinon
 *     libellé identique ; jamais d'approximation automatique (« Port-Bouët 2 »
 *     est un quartier de Yopougon) : les propositions vont dans le rapport.
 *
 * Module pur (aucune dépendance Node) : Admin › Imports terrain.
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
          else if (/^(POINT|LIEU|QUARTIER|SOUS ?ZONE)/.test(h) && !idx.point) idx.point = i
          else if (/^(ZONE|SECTEUR|COMMUNE|TERRITOIRE)/.test(h) && !idx.secteur) idx.secteur = i
          else if (/^DISTRIB/.test(h) && !idx.distributeur) idx.distributeur = i
        })
        if (idx.merch && idx.jour && (idx.point || idx.secteur)) cols = idx
        continue
      }
      const merch = v(cols.merch)
      if (!merch) continue
      const ssfBrut = v(cols.ssf)
      const ssfCle = cleTexte(ssfBrut)
      lignes.push({
        feuille: f.nom, ligne: n,
        secteur: v(cols.secteur), merch, distributeur: v(cols.distributeur), salesRep: v(cols.salesRep),
        jours: lireJours(v(cols.jour)), semaines: cols.semaine ? lireSemaines(v(cols.semaine)) : [...SEMAINES],
        point: v(cols.point) || v(cols.secteur),
        ssf: SANS_SSF.has(ssfCle) || SSF_A_PRECISER.has(ssfCle) ? null : ssfBrut,
        ssfTexte: ssfBrut && !SANS_SSF.has(ssfCle) ? ssfBrut : null,
        ssfAPreciser: SSF_A_PRECISER.has(ssfCle),
        typeSsf: ['', '-'].includes(v(cols.typeSsf)) ? null : v(cols.typeSsf),
      })
    }
  }
  if (!lignes.length) throw new Error('Aucune ligne lisible : il faut au moins les colonnes « Merchandiser », « Jour » et « Point de visite » (ou « Zone »)')
  return lignes
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
  const aRetenir = regles.filter(r => /^(SSF — |Routing mensuel — )/.test(r.label || '')).map(r => r.id)
  const reglesPdv = []
  for (let i = 0; i < aRetenir.length; i += 50) {
    reglesPdv.push(...await toutes(() => sb.from('routing_template_pdv')
      .select('template_id,pdv_id,position_order').in('template_id', aRetenir.slice(i, i + 50)).order('id')))
  }
  etape('Routing en place')
  let routingAvant = []
  try {
    routingAvant = await toutes(() => sb.from('routing_mensuel')
      .select('merchandiser_id,jour_semaine,semaine_du_mois,secteur,point_visite,zone,quartiers,ssf_id,ssf_texte,type_engin,commercial_id,distributeur,source')
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
    ? ['La migration du routing mensuel (20261008130000) n’est pas encore appliquée.']
    : []
  const avertissements = []

  const actifs = profils.filter(p => p.is_active !== false)
  const nomsDistributeurs = distributeurs.map(d => d.nom)
  const distParNom = new Map(distributeurs.map(d => [norm(d.nom), d]))
  const ssfParId = new Map(ssfs.map(s => [s.id, s]))
  const ssfActifs = ssfs.filter(s => s.actif !== false)
  const nomsSsf = s => [s.nom, ...String(s.nom_brut || '').split('|').filter(Boolean)]

  // ---- Quartiers des PDV ----------------------------------------------------
  const quartiers = new Map() // « ZONE›QUARTIER » normalisé → { zone, quartier, pdvs: [] }
  for (const p of pdvs) {
    if (p.is_active === false || !p.zone || !p.quartier) continue
    const k = `${cleTexte(p.zone)}›${cleTexte(p.quartier)}`
    if (!quartiers.has(k)) quartiers.set(k, { zone: p.zone, quartier: p.quartier, pdvs: [] })
    quartiers.get(k).pdvs.push(p)
  }
  const parQuartier = new Map() // libellé de quartier normalisé → [entrées]
  for (const q of quartiers.values()) {
    const k = cleTexte(q.quartier)
    if (!parQuartier.has(k)) parQuartier.set(k, [])
    parQuartier.get(k).push(q)
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
  // Point de visite → quartiers : alias validé, sinon libellé identique.
  const cacheLieu = new Map()
  const lieuDe = (point, secteur) => {
    const k = `${cleTexte(secteur)}|${cleTexte(point)}`
    if (cacheLieu.has(k)) return cacheLieu.get(k)
    let res
    const alias = resoudreAlias(point, aliasImport, 'quartier')
    if (alias) {
      const cibles = alias.split('|').map(x => x.trim()).filter(Boolean)
      const trouves = cibles.map(c => quartiers.get(c.split('›').map(cleTexte).join('›'))).filter(Boolean)
      res = trouves.length
        ? { statut: 'alias', quartiers: trouves }
        : { statut: 'introuvable', quartiers: [], motif: `alias « ${alias} » : quartier absent des PDV` }
    }
    else {
      const exacts = parQuartier.get(cleTexte(point)) || []
      const communes = motsLieu(secteur)
      const duSecteur = exacts.filter(q => communes.some(c => cleTexte(q.zone).includes(c)))
      const retenus = duSecteur.length ? duSecteur : exacts
      res = retenus.length ? { statut: 'exact', quartiers: retenus } : { statut: 'introuvable', quartiers: [] }
    }
    if (res.statut === 'introuvable') res.propositions = proposerQuartiers(point, secteur, quartiers)
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
    const lieu = lieuDe(l.point, l.secteur)
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
        secteur: c.secteur || null, point_visite: c.point || null,
        zone: q[0]?.zone || null, quartiers: uniques(q.map(x => x.quartier)),
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
        zone: r.zone, quartiers: r.quartiers || [], ssf: r.ssf_id ? { id: r.ssf_id, nom: ssfParId.get(r.ssf_id)?.nom } : null,
        ssf_texte: r.ssf_texte, type_engin: r.type_engin, commercial_id: r.commercial_id, distributeur: r.distributeur, source: r.source,
      })),
    })

    // Règles : une par (jour, lieu, SSF), avec ses semaines ; cases sans lieu reconnu → repli.
    const groupes = new Map()
    for (const l of lignesRm) {
      if (!l.quartiers.length) continue
      const cleQ = l._case.lieu.quartiers.map(x => `${x.zone}|${x.quartier}`).sort().join(',')
      const k = `${l.jour_semaine}|${l.ssf ? (l.ssf.id || l.ssf.nom) : '-'}|${cleQ}`
      if (!groupes.has(k)) groupes.set(k, { l, semaines: [] })
      groupes.get(k).semaines.push(l.semaine_du_mois)
    }
    const reglesNouvelles = [...groupes.values()].map(({ l, semaines }) => {
      const pdvsLieu = l._case.lieu.quartiers.flatMap(x => x.pdvs)
      const sems = uniques(semaines).sort((a, b) => a - b)
      return {
        label: `${PREFIXE_REGLE}${JOURS[l.jour_semaine]} S${sems.join('+')} — ${l.point_visite || l.zone}`.slice(0, 200),
        ssf: l.ssf, days_of_week: [l.jour_semaine], semaines_du_mois: sems,
        territoire: l.zone, distributeur: l.distributeur, date_debut: debut,
        notes: `Routing mensuel de l’agence (${fichier}) : ${l.point_visite || '—'}${l.ssf ? ` avec ${l.ssf.nom}` : ', sans SSF'} — ${l._case.lieu.quartiers.map(x => `${x.zone} › ${x.quartier}`).join(', ')}.`.slice(0, 4000),
        pdv_ids: ordreGps(pdvsLieu).map(p => p.pdv_id),
      }
    })
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
    casesSansLieu: plannings.reduce((n, p) => n + p.liste.filter(l => !l.quartiers.length).length, 0),
    regles: plannings.reduce((n, p) => n + p.regles.length, 0),
    lieuxExacts: nbLieux('exact'),
    lieuxAlias: nbLieux('alias'),
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
  md.push(`- Lieux : ${resume.lieuxExacts} reconnus tels quels, ${resume.lieuxAlias} par un alias validé, ${resume.lieuxIntrouvables} à rattacher. ${resume.casesSansLieu} case(s) sans lieu reconnu : ces jours-là, la tournée suit le portefeuille.`)
  md.push(`- Règles de tournée créées : ${resume.regles}. La règle de portefeuille de chaque merchandiser passe en « repli » (jours sans case : 5e semaine, case vide, lieu non reconnu).`)
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
  md.push('', '## Lieux à rattacher', '')
  md.push('Un lieu se rattache par un alias de type « quartier » (Référentiels › Alias d’import ; cible « COMMUNE›QUARTIER », plusieurs séparées par « | »). Les propositions ne sont jamais appliquées seules.')
  md.push('', '| Secteur | Point de visite | Propositions |', '|---|---|---|')
  for (const [k, r] of lieux.filter(([, x]) => x.statut === 'introuvable').slice(0, 300)) {
    const [secteur] = k.split('|')
    const point = [...cases.values()].flatMap(m => [...m.values()]).find(c => `${cleTexte(c.secteur)}|${cleTexte(c.point)}` === k)?.point || k
    md.push(`| ${secteur} | ${point} | ${r.motif || (r.propositions || []).map(p => `${p.zone} › ${p.quartier} (${p.nb} PDV)`).join(' ; ') || '—'} |`)
  }
  md.push('', '## Planning par merchandiser', '')
  for (const p of plannings) {
    md.push(`### ${p.profil.nom} — ${p.profil.email}`, '')
    md.push('| Jour | S1 | S2 | S3 | S4 |', '|---|---|---|---|---|')
    for (const j of [1, 2, 3, 4, 5, 6]) {
      const cel = s => { const l = p.liste.find(x => x.jour_semaine === j && x.semaine_du_mois === s); if (!l) return '—'; return `${l.point_visite || '?'}${l.quartiers.length ? '' : ' ⚠'}${l.ssf ? ` · ${l.ssf.nom}` : ''}` }
      md.push(`| ${JOURS[j]} | ${cel(1)} | ${cel(2)} | ${cel(3)} | ${cel(4)} |`)
    }
    md.push('', '⚠ = lieu non reconnu (portefeuille ce jour-là).', '')
  }
  if (doublons.length) md.push('', '## Cases en double dans le fichier', '', ...doublons.map(d => `- ${d}`))
  if (avertissements.length) md.push('', '## Avertissements', '', ...avertissements.map(a => `- ${a}`))
  md.push('', '## Retour arrière', '', '« Annuler le lot » (Imports terrain) remet le routing, les règles, la règle de portefeuille, les quartiers des SSF et les périmètres d’avant. Les SSF créés restent (à désactiver dans Référentiels si besoin).')

  const csv = {
    'routing-mensuel.csv': csvTexte(['Merchandiser', 'Email', 'Jour', 'Semaine', 'Secteur', 'Point de visite', 'Quartiers reconnus', 'SSF', 'Engin', 'Commercial', 'Distributeur'],
      plannings.flatMap(p => p.liste.map(l => [p.profil.nom, p.profil.email, JOURS[l.jour_semaine], l.semaine_du_mois, l.secteur || '', l.point_visite || '', l.quartiers.join(', '), l.ssf?.nom || l.ssf_texte || '', l.type_engin || '', commerciaux.find(c => c.id === l.commercial_id)?.nom || '', l.distributeur || '']))),
    'lieux-a-rattacher.csv': csvTexte(['Secteur', 'Point de visite', 'Propositions', 'Quartier confirmé (COMMUNE›QUARTIER)'],
      lieux.filter(([, r]) => r.statut === 'introuvable').map(([k, r]) => { const [secteur, point] = k.split('|'); return [secteur, point, (r.propositions || []).map(x => `${x.zone}›${x.quartier}`).join(' | '), ''] })),
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

/** Quartiers proches d'un lieu (mots communs, une faute tolérée), pour le rapport. */
export function proposerQuartiers(point, secteur, quartiers, max = 3) {
  const mp = motsLieu(point)
  if (!mp.length) return []
  const communes = motsLieu(secteur)
  return [...quartiers.values()].map((q) => {
    const mq = motsLieu(q.quartier)
    const communs = mp.filter(w => mq.some(m => motsProches(w, m) || m.startsWith(w) || w.startsWith(m))).length
    let score = communs / mp.length
    if (score && communes.some(c => cleTexte(q.zone).includes(c))) score += 0.5
    return { zone: q.zone, quartier: q.quartier, nb: q.pdvs.length, score }
  }).filter(x => x.score >= 0.5).sort((a, b) => b.score - a.score || b.nb - a.nb).slice(0, max)
}

// Mots d'un nom de personne : réexporté pour les tests.
export { motsPersonne }
