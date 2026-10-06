/**
 * Sous-zones SSF et planning hebdomadaire des merchandisers Atom.
 *
 * À partir des visites qui portent un SSF (export Atom importé, puis app 1.0.12) :
 *   A. sous-zone de chaque SSF = quartiers (pdv.zone + pdv.quartier) où il a
 *      accompagné des visites, au-dessus de seuils ;
 *   B. pour chaque merchandiser Atom actif, une règle de tournée par SSF
 *      principal, avec les jours de la semaine où ce SSF domine ses visites
 *      (un SSF par jour : celui qui a le plus de visites ce jour-là dans le
 *      mois de référence — un jour sans visite ce mois-là reste à la règle
 *      DMS) ; seuls comptent les SSF dont la sous-zone est dans la commune du
 *      merchandiser (« il ne sort pas de sa zone » : ABOBO 1 et ABOBO 2 sont
 *      la même commune) ; portefeuille = PDV de son portefeuille DMS et PDV
 *      visités avec ce SSF, situés dans la sous-zone ;
 *   C. l'Excel « SSF ↔ zones » du client, quand il est fourni, remplace la
 *      dérivation pour les SSF et merchandisers qu'il cite.
 *
 * La règle « Portefeuille DMS » du merchandiser garde les jours qu'aucun SSF
 * ne couvre (« aucun jour » s'ils sont tous couverts : elle reste visible comme
 * portefeuille de référence, jamais supprimée).
 *
 * Module pur (aucune dépendance Node) : utilisé par
 * scripts/deriver-ssf-sous-zones.mjs et par Admin › Imports terrain.
 * Sortie : { resume, rapport (markdown), csv, operations, retour }.
 */
import { aGps, csvTexte, cleNom, haversine, mediane, norm, ordreGps, texteCellule, toutesLesLignes, uniques } from '../commun.mjs'

export const OPTIONS_DEFAUT = {
  seuilVisites: 5, // visites minimum d'un quartier pour l'inclure dans la sous-zone
  seuilPart: 0.05, // part minimum du quartier dans les visites (à quartier connu) du SSF
  minVisitesSsf: 10, // en dessous, le SSF n'a pas assez de visites pour une sous-zone
  seuilSsfPart: 0.08, // SSF principal d'un merchandiser : ≥ 8 % de ses visites…
  seuilSsfVisites: 40, // … ou ≥ 40 visites
  rayonBarycentreM: 1500, // PDV sans quartier rattaché au SSF le plus proche, jusqu'à cette distance
  moisJours: null, // 'AAAA-MM' de référence pour les jours ; défaut : dernier mois présent
  debut: null, // date de début des règles ; défaut : aujourd'hui
  pregenererJours: 0, // > 0 : tournées à venir recalculées sur N jours à partir de demain
  auteurId: null,
  fichierClient: null, // nom du fichier client (pour la source)
}

export const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const OUVRES = [1, 2, 3, 4, 5, 6]
const LIBELLE_PREFIXE = 'SSF — '

/** Canal de la grille Atom (copie de la fonction SQL canal_atom). */
export function canalAtom(sousCategorie) {
  const u = String(sousCategorie || '').toUpperCase()
  if (!u) return null
  if (/PORRIDGE/.test(u)) return 'Porridge'
  if (/PUSHCAR/.test(u)) return 'Pushcart'
  if (/ABOKI|KIOS|TABLE TOP|TABLIER/.test(u)) return 'Aboki & Kiosque'
  if (/SUPERETTE|MINIMARKET/.test(u)) return 'Superette'
  if (/BOUTIQUE/.test(u)) return 'Boutique'
  return null
}
const CANAUX = ['Superette', 'Boutique', 'Aboki & Kiosque', 'Pushcart', 'Porridge']

const jourIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plusJours = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const cleZq = (zone, quartier) => `${zone}|${quartier}`
// Commune d'un territoire : « ABOBO 2 » → « ABOBO », « COCODY 1 » → « COCODY ».
export const commune = (zone) => norm(zone).replace(/\s+\d+$/, '')
const ssfBruit = (s) => /\(\?\)/.test(s?.nom || '') || s?.actif === false
const pct = (x) => `${Math.round(x * 100)} %`
const sousZoneTexte = (lignes, max = 6) => {
  const parZone = new Map()
  for (const l of lignes) { if (!parZone.has(l.zone)) parZone.set(l.zone, []); parZone.get(l.zone).push(l.quartier) }
  return [...parZone].map(([z, qs]) => `${z} : ${liste(qs, max)}`).join(' ; ')
}
const liste = (xs, max = 8) => (xs.length > max ? `${xs.slice(0, max).join(', ')} … (+${xs.length - max})` : xs.join(', '))

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------
export async function chargerDonneesSsf(sb, { onEtape, toutes = toutesLesLignes } = {}) {
  const etape = (m) => onEtape?.(m)
  etape('Visites avec SSF')
  const visites = await toutes(() => sb.from('visites')
    .select('user_id,pdv_id,ssf_id,date_visite').not('ssf_id', 'is', null).order('id'))
  etape('PDV')
  const pdvs = await toutes(() => sb.from('pdv')
    .select('pdv_id,nom_pdv,zone,quartier,sous_categorie_pdv,geolocation_lat,geolocation_lng,is_active').order('pdv_id'))
  etape('Référentiels')
  const [profils, ssfs, distributeurs, quotas] = await Promise.all([
    toutes(() => sb.from('profiles')
      .select('id,email,nom,role,employeur,is_active,zone_assignee,territoires_assignes,quartiers_assignes')
      .eq('employeur', 'atom').order('id')),
    toutes(() => sb.from('ssf').select('id,nom,nom_brut,telephone,distributeur_id,actif,a_confirmer').order('id')),
    toutes(() => sb.from('distributeur').select('id,nom').order('id')),
    toutes(() => sb.from('routing_quota_canal').select('canal,jour_semaine,quota').order('canal')),
  ])
  // Avant la migration 20261007100000 (simulation seulement) : pas de table
  // ssf_quartier ni de colonne routing_templates.ssf_id.
  let migrationAppliquee = true
  let ssfQuartiers = []
  try {
    ssfQuartiers = await toutes(() => sb.from('ssf_quartier').select('ssf_id,zone,quartier,source,a_confirmer').order('id'))
  }
  catch { migrationAppliquee = false }
  etape('Règles de tournée')
  const ids = profils.map(p => p.id)
  const colonnes = 'id,user_id,label,mode,days_of_week,day_of_week,is_active,territoire,distributeur,date_debut,date_fin,notes,created_at'
  const regles = []
  for (let i = 0; i < ids.length; i += 100) {
    regles.push(...await toutes(() => sb.from('routing_templates')
      .select(migrationAppliquee ? `${colonnes},ssf_id` : colonnes)
      .in('user_id', ids.slice(i, i + 100)).order('id')))
  }
  const reglesPdv = []
  const idsRegles = regles.map(r => r.id)
  for (let i = 0; i < idsRegles.length; i += 50) {
    reglesPdv.push(...await toutes(() => sb.from('routing_template_pdv')
      .select('template_id,pdv_id,position_order').in('template_id', idsRegles.slice(i, i + 50)).order('id')))
  }
  return { visites, pdvs, profils, ssfs, distributeurs, ssfQuartiers, quotas, regles, reglesPdv, migrationAppliquee }
}

// ---------------------------------------------------------------------------
// Excel du client « SSF ↔ zones »
// ---------------------------------------------------------------------------
const JOUR_PAR_TEXTE = { DIM: 0, DIMANCHE: 0, LUN: 1, LUNDI: 1, MAR: 2, MARDI: 2, MER: 3, MERCREDI: 3, JEU: 4, JEUDI: 4, VEN: 5, VENDREDI: 5, SAM: 6, SAMEDI: 6 }

export function lireJours(texte) {
  const t = norm(texteCellule(texte))
  if (!t) return []
  if (/TOUS|LUNDI ?(A|AU|-|→) ?SAMEDI|LUN ?(A|AU|-|→) ?SAM/.test(t)) return [...OUVRES]
  const out = new Set()
  for (const mot of t.split(/[^A-Z0-9]+/).filter(Boolean)) {
    if (mot in JOUR_PAR_TEXTE) out.add(JOUR_PAR_TEXTE[mot])
    else if (/^[0-6]$/.test(mot)) out.add(Number(mot))
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * Lit l'Excel du client : une ligne par SSF × zone (quartiers dans une cellule,
 * séparés par , ; / | ou retour à la ligne) ou par SSF × quartier.
 * Colonnes reconnues (en-tête, casse et accents indifférents) : SSF ; Zone ou
 * Territoire ou Commune ; Quartier(s) ou Sous-zone ; Merchandiser(s) ou Merch
 * ou Email ; Jour(s) ; Distributeur ; Téléphone.
 */
export function lireExcelClientSsf(wb) {
  const lignes = []
  for (const ws of wb.worksheets) {
    let cols = null
    ws.eachRow((row, n) => {
      const v = (i) => (i ? String(texteCellule(row.getCell(i).value) ?? '').trim() : '')
      if (!cols) {
        const idx = {}
        row.eachCell((c, i) => {
          const h = norm(texteCellule(c.value))
          if (!h) return
          if (/^SSF|VENDEUR|SALESMAN/.test(h) && !idx.ssf) idx.ssf = i
          else if (/^(ZONE|TERRITOIRE|COMMUNE)/.test(h) && !idx.zone) idx.zone = i
          else if (/^(QUARTIER|SOUS[ -]?ZONE|SECTEUR)/.test(h) && !idx.quartiers) idx.quartiers = i
          else if (/^(MERCH|EMAIL|E-MAIL)/.test(h) && !idx.merch) idx.merch = i
          else if (/^JOUR/.test(h) && !idx.jours) idx.jours = i
          else if (/^DISTRIB/.test(h) && !idx.distributeur) idx.distributeur = i
          else if (/^(TEL|TÉL|CONTACT)/.test(h) && !idx.telephone) idx.telephone = i
        })
        if (idx.ssf && (idx.zone || idx.quartiers)) cols = idx
        return
      }
      const ssf = v(cols.ssf)
      if (!ssf) return
      lignes.push({
        feuille: ws.name, ligne: n, ssf,
        zone: v(cols.zone),
        quartiers: v(cols.quartiers).split(/[,;/|\n]+/).map(q => q.trim()).filter(Boolean),
        merch: v(cols.merch), jours: lireJours(v(cols.jours)),
        distributeur: v(cols.distributeur), telephone: v(cols.telephone),
      })
    })
  }
  if (!lignes.length) throw new Error('Aucune ligne lisible : il faut au moins les colonnes « SSF » et « Zone » ou « Quartier »')
  return lignes
}

// ---------------------------------------------------------------------------
// Dérivation
// ---------------------------------------------------------------------------
export function deriverSsf(donnees, options = {}) {
  const o = { ...OPTIONS_DEFAUT, ...options }
  const debut = o.debut || jourIso(new Date())
  const { visites, pdvs, profils, ssfs, distributeurs, ssfQuartiers, quotas, regles, reglesPdv } = donnees
  const avertissements = []

  const pdvParId = new Map(pdvs.map(p => [p.pdv_id, p]))
  const ssfParId = new Map(ssfs.map(s => [s.id, s]))
  const nomDistributeur = new Map(distributeurs.map(d => [d.id, d.nom]))
  const ssfParCle = new Map()
  for (const s of ssfs) {
    for (const variante of [s.nom, ...String(s.nom_brut || '').split('|')]) {
      const k = cleNom(variante)
      if (k && !ssfParCle.has(k)) ssfParCle.set(k, s)
    }
  }
  // Libellés exacts des zones et quartiers en base, retrouvés par leur forme normalisée.
  const zoneParNorm = new Map()
  const quartierParNorm = new Map()
  for (const p of pdvs) {
    if (p.zone && !zoneParNorm.has(norm(p.zone))) zoneParNorm.set(norm(p.zone), p.zone)
    if (p.zone && p.quartier) {
      const k = `${norm(p.zone)}|${norm(p.quartier)}`
      if (!quartierParNorm.has(k)) quartierParNorm.set(k, p.quartier)
    }
  }
  const activeParZq = new Map()
  for (const p of pdvs) {
    if (p.is_active === false || !p.zone || !p.quartier) continue
    const k = cleZq(p.zone, p.quartier)
    if (!activeParZq.has(k)) activeParZq.set(k, [])
    activeParZq.get(k).push(p)
  }

  // ---- A. Statistiques par SSF ---------------------------------------------
  const stats = new Map()
  const moisPresents = new Set()
  for (const v of visites) {
    const p = pdvParId.get(v.pdv_id)
    const s = ssfParId.get(v.ssf_id)
    if (!s) continue
    moisPresents.add(String(v.date_visite).slice(0, 7))
    if (!stats.has(s.id)) stats.set(s.id, { n: 0, nQuartier: 0, parZq: new Map(), parMerch: new Map() })
    const st = stats.get(s.id)
    st.n++
    st.parMerch.set(v.user_id, (st.parMerch.get(v.user_id) || 0) + 1)
    if (p?.zone && p?.quartier) {
      st.nQuartier++
      const k = cleZq(p.zone, p.quartier)
      st.parZq.set(k, (st.parZq.get(k) || 0) + 1)
    }
  }
  const moisListe = [...moisPresents].sort()
  const moisRef = o.moisJours || moisListe[moisListe.length - 1] || jourIso(new Date()).slice(0, 7)
  const sourceDerive = `derive-visites-${moisListe[0] || moisRef}-${moisListe[moisListe.length - 1] || moisRef}`

  // ---- C. Excel client ------------------------------------------------------
  const client = { sousZones: new Map(), planning: new Map(), ssfACreer: new Map(), rejets: [] }
  const merchParCle = new Map()
  for (const p of profils) {
    if (p.email) merchParCle.set(p.email.toLowerCase(), p)
    if (p.nom) merchParCle.set(cleNom(p.nom), p)
  }
  if (o.lignesClient?.length) {
    for (const l of o.lignesClient) {
      const ou = `${l.feuille} l.${l.ligne}`
      let ssf = ssfParCle.get(cleNom(l.ssf))
      let refSsf
      if (ssf) refSsf = { id: ssf.id, nom: ssf.nom }
      else {
        refSsf = { nom: l.ssf.trim() }
        if (!client.ssfACreer.has(cleNom(l.ssf))) client.ssfACreer.set(cleNom(l.ssf), { nom: l.ssf.trim(), distributeur: l.distributeur || null, telephone: l.telephone || null })
      }
      const cle = ssf ? `id:${ssf.id}` : `nom:${cleNom(l.ssf)}`
      const zone = l.zone ? zoneParNorm.get(norm(l.zone)) : null
      if (l.zone && !zone) { client.rejets.push(`${ou} : zone « ${l.zone} » inconnue`); continue }
      if (!client.sousZones.has(cle)) client.sousZones.set(cle, { ref: refSsf, lignes: [] })
      const sz = client.sousZones.get(cle)
      if (!l.quartiers.length && zone) {
        // Zone entière : tous ses quartiers connus.
        for (const [k, q] of quartierParNorm) if (k.startsWith(`${norm(zone)}|`)) sz.lignes.push({ zone, quartier: q })
      }
      for (const qTexte of l.quartiers) {
        let trouve = null
        if (zone) trouve = quartierParNorm.get(`${norm(zone)}|${norm(qTexte)}`) ? { zone, quartier: quartierParNorm.get(`${norm(zone)}|${norm(qTexte)}`) } : null
        else {
          for (const [k, q] of quartierParNorm) if (k.endsWith(`|${norm(qTexte)}`)) { trouve = { zone: [...zoneParNorm.values()].find(z => k.startsWith(`${norm(z)}|`)), quartier: q }; break }
        }
        if (!trouve) client.rejets.push(`${ou} : quartier « ${qTexte} »${zone ? ` (zone ${zone})` : ''} inconnu`)
        else sz.lignes.push(trouve)
      }
      if (l.merch) {
        const m = merchParCle.get(l.merch.toLowerCase()) || merchParCle.get(cleNom(l.merch))
        if (!m) { client.rejets.push(`${ou} : merchandiser « ${l.merch} » introuvable parmi les comptes Atom`); continue }
        if (!client.planning.has(m.id)) client.planning.set(m.id, new Map())
        const pl = client.planning.get(m.id)
        const jours = pl.get(cle)?.jours || new Set()
        for (const j of (l.jours.length ? l.jours : OUVRES)) jours.add(j)
        pl.set(cle, { ref: refSsf, jours })
      }
    }
  }

  // ---- A (suite). Sous-zone retenue pour chaque SSF --------------------------
  const sousZones = new Map() // cle → { ref, ssf, lignes: [{zone, quartier, n, part}], origine }
  const bruit = []
  const existantesParSsf = new Map()
  for (const q of ssfQuartiers) {
    if (!existantesParSsf.has(q.ssf_id)) existantesParSsf.set(q.ssf_id, [])
    existantesParSsf.get(q.ssf_id).push(q)
  }
  for (const s of ssfs) {
    const cle = `id:${s.id}`
    const existantes = existantesParSsf.get(s.id) || []
    const st = stats.get(s.id)
    if (client.sousZones.has(cle)) {
      const lignes = uniquesZq(client.sousZones.get(cle).lignes)
      sousZones.set(cle, { ref: { id: s.id, nom: s.nom }, ssf: s, lignes, origine: 'client' })
      continue
    }
    const manuelles = existantes.filter(q => !String(q.source || '').startsWith('derive-'))
    if (manuelles.length) {
      // Saisie admin ou client antérieure : prioritaire, on ne la recalcule pas.
      sousZones.set(cle, { ref: { id: s.id, nom: s.nom }, ssf: s, lignes: manuelles.map(q => ({ zone: q.zone, quartier: q.quartier })), origine: 'conservee' })
      continue
    }
    if (!st) continue
    if (ssfBruit(s) || st.n < o.minVisitesSsf) { bruit.push({ s, n: st.n }); continue }
    const total = Math.max(st.nQuartier, 1)
    let retenues = [...st.parZq].map(([k, n]) => { const [zone, quartier] = k.split('|'); return { zone, quartier, n, part: n / total } })
      .sort((a, b) => b.n - a.n)
    const filtrees = retenues.filter(x => x.n >= o.seuilVisites && x.part >= o.seuilPart)
    if (!filtrees.length && retenues.length && retenues[0].n >= o.seuilVisites) filtrees.push(retenues[0])
    if (!filtrees.length) { bruit.push({ s, n: st.n, motif: 'aucun quartier au-dessus des seuils' }); continue }
    // Une sous-zone appartient à une seule zone (modèle du client) : on garde
    // la commune qui pèse le plus, les autres quartiers sont signalés.
    const poidsCommune = new Map()
    filtrees.forEach(x => poidsCommune.set(commune(x.zone), (poidsCommune.get(commune(x.zone)) || 0) + x.n))
    const communeSsf = [...poidsCommune].sort((a, b) => b[1] - a[1])[0][0]
    retenues = filtrees.filter(x => commune(x.zone) === communeSsf)
    const ecartes = filtrees.filter(x => commune(x.zone) !== communeSsf)
    sousZones.set(cle, { ref: { id: s.id, nom: s.nom }, ssf: s, lignes: retenues, origine: 'derivee', horsCommune: ecartes })
  }
  for (const [cle, sz] of client.sousZones) {
    if (cle.startsWith('nom:')) sousZones.set(cle, { ref: sz.ref, ssf: null, lignes: uniquesZq(sz.lignes), origine: 'client' })
  }
  for (const sz of sousZones.values()) {
    const parZone = new Map()
    sz.lignes.forEach(l => parZone.set(l.zone, (parZone.get(l.zone) || 0) + (l.n || 1)))
    sz.zone = [...parZone].sort((a, b) => b[1] - a[1])[0]?.[0] || null
    sz.zones = [...parZone.keys()]
    sz.cles = new Set(sz.lignes.map(l => cleZq(l.zone, l.quartier)))
    const pdvsZone = sz.lignes.flatMap(l => activeParZq.get(cleZq(l.zone, l.quartier)) || [])
    const gps = pdvsZone.filter(p => aGps(p.geolocation_lat, p.geolocation_lng))
    sz.centre = gps.length ? { lat: mediane(gps.map(p => p.geolocation_lat)), lng: mediane(gps.map(p => p.geolocation_lng)) } : null
    sz.parCanal = Object.fromEntries(CANAUX.map(c => [c, 0]))
    for (const p of pdvsZone) { const c = canalAtom(p.sous_categorie_pdv); if (c) sz.parCanal[c]++ }
    sz.nbPdv = pdvsZone.length
    sz.distributeur = sz.ssf ? nomDistributeur.get(sz.ssf.distributeur_id) || null : client.ssfACreer.get(cleNom(sz.ref.nom))?.distributeur || null
  }

  // ---- B. Planning par merchandiser ----------------------------------------
  const visitesParMerch = new Map()
  for (const v of visites) {
    if (!visitesParMerch.has(v.user_id)) visitesParMerch.set(v.user_id, [])
    visitesParMerch.get(v.user_id).push(v)
  }
  const pdvParRegle = new Map()
  for (const l of reglesPdv) {
    if (!pdvParRegle.has(l.template_id)) pdvParRegle.set(l.template_id, [])
    pdvParRegle.get(l.template_id).push(l)
  }
  pdvParRegle.forEach(ls => ls.sort((a, b) => a.position_order - b.position_order))
  const quotaJour = (canal, j) => quotas.find(q => q.canal === canal && q.jour_semaine === j)?.quota || 0

  const plannings = []
  const hors = new Map() // user_id → SSF écartés car hors de sa zone
  for (const p of profils.filter(x => x.is_active !== false && x.role === 'merchandiser')) {
    const siennes = regles.filter(r => r.user_id === p.id)
    const dms = siennes.filter(r => r.mode === 'quota' && !r.ssf_id && !String(r.label || '').startsWith(LIBELLE_PREFIXE))
    const ssfAvant = siennes.filter(r => String(r.label || '').startsWith(LIBELLE_PREFIXE))
    const vis = (visitesParMerch.get(p.id) || []).filter(v => sousZones.has(`id:${v.ssf_id}`))
    const total = vis.length
    const parSsf = new Map()
    vis.forEach(v => parSsf.set(v.ssf_id, (parSsf.get(v.ssf_id) || 0) + 1))

    let affectations // Map cle → { ref, jours:Set, origine }
    const choixJours = {}
    if (client.planning.has(p.id)) {
      affectations = new Map([...client.planning.get(p.id)].map(([cle, x]) => [cle, { ref: x.ref, jours: x.jours, origine: 'client' }]))
      for (const j of OUVRES) choixJours[j] = 'fichier client'
    }
    else {
      // Sa zone : communes de ses territoires actuels (réorganisation Atom du
      // 06/10). Un SSF hors de ces communes n'est jamais retenu.
      const communes = new Set([...(p.territoires_assignes || []), p.zone_assignee].filter(Boolean).map(commune))
      const dansSaZone = (id) => sousZones.get(`id:${id}`)?.zones.some(z => communes.has(commune(z)))
      const horsZone = [...parSsf.keys()].filter(id => !dansSaZone(id))
      if (horsZone.length) hors.set(p.id, horsZone.map(id => `${ssfParId.get(id)?.nom} (${sousZones.get(`id:${id}`)?.zone})`))
      const eligibles = [...parSsf].filter(([id, n]) => dansSaZone(id) && (n / Math.max(total, 1) >= o.seuilSsfPart || n >= o.seuilSsfVisites)).map(([id]) => id)
      affectations = new Map()
      for (const j of OUVRES) {
        const comptes = new Map()
        vis.filter(v => eligibles.includes(v.ssf_id) && new Date(v.date_visite).getUTCDay() === j && String(v.date_visite).startsWith(moisRef))
          .forEach(v => comptes.set(v.ssf_id, (comptes.get(v.ssf_id) || 0) + 1))
        if (!comptes.size) { choixJours[j] = `aucune visite avec un SSF de sa zone le ${JOURS[j].toLowerCase()} en ${moisRef}`; continue }
        const [gagnant, n] = [...comptes].sort((a, b) => b[1] - a[1] || (parSsf.get(b[0]) - parSsf.get(a[0])))[0]
        const totalJour = [...comptes.values()].reduce((x, y) => x + y, 0)
        choixJours[j] = `${ssfParId.get(gagnant)?.nom} : ${n}/${totalJour} visites (${moisRef})`
        const cle = `id:${gagnant}`
        if (!affectations.has(cle)) affectations.set(cle, { ref: sousZones.get(cle).ref, jours: new Set(), origine: 'derivee' })
        affectations.get(cle).jours.add(j)
      }
    }

    // Portefeuille de chaque règle.
    const pdvDms = uniques(dms.flatMap(r => (pdvParRegle.get(r.id) || []).map(l => l.pdv_id)))
    const reglesProposees = []
    for (const [cle, a] of affectations) {
      const sz = sousZones.get(cle)
      if (!sz) { avertissements.push(`${p.nom} : SSF ${a.ref.nom} sans sous-zone, règle ignorée`); continue }
      const visitesAvec = new Set(vis.filter(v => `id:${v.ssf_id}` === cle).map(v => v.pdv_id))
      reglesProposees.push({ cle, a, sz, visitesAvec })
    }
    const affectes = new Map(reglesProposees.map(r => [r.cle, []]))
    for (const id of uniques([...pdvDms, ...reglesProposees.flatMap(r => [...r.visitesAvec])])) {
      const pdv = pdvParId.get(id)
      if (!pdv || pdv.is_active === false) continue
      let places = 0
      for (const r of reglesProposees) {
        if (pdv.zone && pdv.quartier && r.sz.cles.has(cleZq(pdv.zone, pdv.quartier))) { affectes.get(r.cle).push(pdv); places++ }
      }
      if (places || pdv.quartier) continue
      // Sans quartier : SSF avec lequel il a été visité, sinon barycentre le plus proche.
      const visite = reglesProposees.find(r => r.visitesAvec.has(id))
      if (visite) { affectes.get(visite.cle).push(pdv); continue }
      if (!aGps(pdv.geolocation_lat, pdv.geolocation_lng)) continue
      const proche = reglesProposees.filter(r => r.sz.centre)
        .map(r => ({ r, d: haversine(pdv.geolocation_lat, pdv.geolocation_lng, r.sz.centre.lat, r.sz.centre.lng) }))
        .sort((a, b) => a.d - b.d)[0]
      if (proche && proche.d <= o.rayonBarycentreM) affectes.get(proche.r.cle).push(pdv)
    }

    const regleOps = reglesProposees.map(({ cle, a, sz }) => {
      const pdvRegle = ordreGps(affectes.get(cle))
      const jours = [...a.jours].sort((x, y) => x - y)
      return {
        ssf: a.ref,
        label: `${LIBELLE_PREFIXE}${a.ref.nom}`,
        territoire: sz.zone,
        distributeur: sz.distributeur || dms[0]?.distributeur || null,
        days_of_week: jours,
        date_debut: debut,
        notes: `Sous-zone ${sz.origine === 'client' ? 'du fichier client' : `dérivée des visites (${moisListe[0]} → ${moisListe[moisListe.length - 1]})`} : ${sz.lignes.map(l => `${l.zone} › ${l.quartier}`).join(', ')}.`,
        pdv_ids: pdvRegle.map(x => x.pdv_id),
        _sz: sz,
      }
    }).filter(r => r.days_of_week.length)

    const couverts = new Set(regleOps.flatMap(r => r.days_of_week))
    const nonCouverts = OUVRES.filter(j => !couverts.has(j))

    // Périmètre : zones et quartiers des sous-zones ajoutés (une liste de
    // quartiers vide = pas de filtre : on la laisse vide).
    const terrAvant = (p.territoires_assignes || []).length ? p.territoires_assignes : (p.zone_assignee ? [p.zone_assignee] : [])
    const qAvant = p.quartiers_assignes || []
    const zones = uniques(regleOps.flatMap(r => r._sz.zones))
    const quartiers = uniques(regleOps.flatMap(r => r._sz.lignes.map(l => l.quartier)))
    const terrApres = uniques([...terrAvant, ...zones])
    const qApres = qAvant.length ? uniques([...qAvant, ...quartiers]) : []

    plannings.push({
      profil: p, total, parSsf, choixJours, regles: regleOps, dms, ssfAvant, nonCouverts,
      perimetre: { terrAvant, terrApres, qAvant, qApres, change: terrApres.length !== terrAvant.length || qApres.length !== qAvant.length },
      deficits: regleOps.flatMap(r => r.days_of_week.flatMap(j => CANAUX
        .filter(c => r._sz.parCanal[c] < quotaJour(c, j))
        .map(c => `${JOURS_COURTS[j]} ${c} : ${r._sz.parCanal[c]} PDV dans la sous-zone pour un quota de ${quotaJour(c, j)}`))),
    })
  }

  // ---- Opérations ------------------------------------------------------------
  const operations = []
  const retour = []
  const sansMarque = (r) => { const { _sz, ...reste } = r; return reste }
  for (const s of client.ssfACreer.values()) {
    operations.push({ type: 'ssf.creer', nom: s.nom, distributeur: s.distributeur, telephone: s.telephone, source: `client-${o.fichierClient || 'fichier'}` })
  }
  for (const [cle, sz] of sousZones) {
    if (sz.origine === 'conservee') continue
    const sourceCible = sz.origine === 'client' ? `client-${o.fichierClient || 'fichier'}` : sourceDerive
    operations.push({
      type: 'ssf_quartier.remplacer', ssf: sz.ref, remplace: sz.origine === 'client' ? ['derive-', 'client-'] : ['derive-'],
      lignes: sz.lignes.map(l => ({ zone: l.zone, quartier: l.quartier, source: sourceCible, a_confirmer: sz.origine !== 'client' })),
    })
    if (sz.ssf) {
      const avant = (existantesParSsf.get(sz.ssf.id) || []).filter(q => /^(derive-|client-)/.test(q.source || ''))
      retour.push({ type: 'ssf_quartier.remplacer', ssf: sz.ref, remplace: ['derive-', 'client-'], lignes: avant.map(q => ({ zone: q.zone, quartier: q.quartier, source: q.source, a_confirmer: q.a_confirmer })) })
    }
  }
  const finPre = o.pregenererJours > 0 ? plusJours(jourIso(new Date()), o.pregenererJours) : null
  const debutPre = plusJours(jourIso(new Date()), 1)
  for (const pl of plannings) {
    if (!pl.regles.length && !pl.ssfAvant.length) continue
    operations.push({ type: 'regles_ssf.remplacer', user_id: pl.profil.id, created_by: o.auteurId || null, regles: pl.regles.map(sansMarque) })
    retour.push({
      type: 'regles_ssf.remplacer', user_id: pl.profil.id,
      regles: pl.ssfAvant.filter(r => r.ssf_id).map(r => ({
        ssf: { id: r.ssf_id, nom: ssfParId.get(r.ssf_id)?.nom }, label: r.label, territoire: r.territoire, distributeur: r.distributeur,
        days_of_week: r.days_of_week || [r.day_of_week], date_debut: r.date_debut, notes: r.notes,
        pdv_ids: (pdvParRegle.get(r.id) || []).map(l => l.pdv_id),
      })).filter(r => r.days_of_week.length),
    })
    for (const r of pl.dms) {
      const jours = pl.regles.length ? pl.nonCouverts : (r.days_of_week || OUVRES)
      operations.push({ type: 'regle.jours', template_id: r.id, days_of_week: jours, is_active: true })
      retour.push({ type: 'regle.jours', template_id: r.id, days_of_week: r.days_of_week || [r.day_of_week], is_active: r.is_active !== false })
    }
    if (pl.perimetre.change) {
      operations.push({ type: 'profil.perimetre', user_id: pl.profil.id, territoires_assignes: pl.perimetre.terrApres, quartiers_assignes: pl.perimetre.qApres })
      retour.push({ type: 'profil.perimetre', user_id: pl.profil.id, territoires_assignes: pl.profil.territoires_assignes || [], quartiers_assignes: pl.perimetre.qAvant })
    }
    if (finPre) {
      operations.push({ type: 'tournees.recalculer', user_id: pl.profil.id, debut: debutPre, fin: finPre })
      retour.push({ type: 'tournees.recalculer', user_id: pl.profil.id, debut: debutPre, fin: finPre })
    }
  }

  // ---- Rapport -----------------------------------------------------------------
  const avecRegles = plannings.filter(p => p.regles.length)
  const resume = {
    ssf: ssfs.length,
    sousZonesDerivees: [...sousZones.values()].filter(s => s.origine === 'derivee').length,
    sousZonesClient: [...sousZones.values()].filter(s => s.origine === 'client').length,
    sousZonesConservees: [...sousZones.values()].filter(s => s.origine === 'conservee').length,
    ssfBruit: bruit.length,
    merchandisers: plannings.length,
    merchandisersAvecRegles: avecRegles.length,
    regles: avecRegles.reduce((n, p) => n + p.regles.length, 0),
    joursNonCouverts: plannings.reduce((n, p) => n + (p.regles.length ? p.nonCouverts.length : 0), 0),
    rejetsClient: client.rejets.length,
    operations: operations.length,
    moisReference: moisRef,
  }

  const md = []
  md.push('# Sous-zones SSF et planning des merchandisers Atom', '')
  md.push(`Visites analysées : ${visites.length} (mois ${moisListe[0] || '—'} → ${moisListe[moisListe.length - 1] || '—'}). Jours déterminés sur ${moisRef}.`)
  if (o.fichierClient) md.push(`Fichier client : ${o.fichierClient} (${o.lignesClient?.length || 0} lignes, ${client.rejets.length} rejet(s)).`)
  md.push('', '## Résumé', '')
  md.push(`- Sous-zones : ${resume.sousZonesDerivees} dérivées, ${resume.sousZonesClient} du fichier client, ${resume.sousZonesConservees} déjà saisies (conservées).`)
  md.push(`- SSF sans sous-zone (bruit ou trop peu de visites) : ${resume.ssfBruit}.`)
  md.push(`- Merchandisers Atom actifs : ${resume.merchandisers}, dont ${resume.merchandisersAvecRegles} avec un planning SSF (${resume.regles} règles).`)
  md.push(`- Jours sans SSF (laissés à la règle « Portefeuille DMS ») : ${resume.joursNonCouverts}.`)
  if (o.pregenererJours > 0) md.push(`- Tournées intactes du ${debutPre} au ${finPre} recalculées après écriture.`)
  md.push('', '## Planning par merchandiser', '')
  for (const pl of plannings) {
    md.push(`### ${pl.profil.nom || pl.profil.email} — ${pl.profil.email || ''}`, '')
    if (!pl.regles.length) {
      md.push(`Aucun SSF principal dans sa zone en ${moisRef} (${pl.total} visites avec SSF au total) : la règle « Portefeuille DMS » reste seule.`, '')
      if (hors.has(pl.profil.id)) md.push(`SSF écartés car hors de sa zone : ${liste(hors.get(pl.profil.id), 6)}.`, '')
      continue
    }
    md.push('| Jour | SSF | Sous-zone | PDV du portefeuille | Choix |', '|---|---|---|---|---|')
    for (const j of OUVRES) {
      const r = pl.regles.find(x => x.days_of_week.includes(j))
      md.push(r
        ? `| ${JOURS[j]} | ${r.ssf.nom} | ${sousZoneTexte(r._sz.lignes)} | ${r.pdv_ids.length} | ${pl.choixJours[j] || ''} |`
        : `| ${JOURS[j]} | — (Portefeuille DMS) | | | ${pl.choixJours[j] || ''} |`)
    }
    md.push('')
    if (pl.perimetre.change) {
      const zonesAjoutees = pl.perimetre.terrApres.filter(z => !pl.perimetre.terrAvant.includes(z))
      const quartiersAjoutes = pl.perimetre.qApres.filter(q => !pl.perimetre.qAvant.includes(q))
      md.push(`Périmètre élargi :${zonesAjoutees.length ? ` territoires + ${zonesAjoutees.join(', ')}` : ''}${quartiersAjoutes.length ? `${zonesAjoutees.length ? ' ;' : ''} quartiers + ${liste(quartiersAjoutes)}` : ''}.`, '')
    }
    if (hors.has(pl.profil.id)) md.push(`SSF écartés car hors de sa zone : ${liste(hors.get(pl.profil.id), 6)}.`, '')
    if (pl.deficits.length) md.push(`Quotas difficiles à remplir dans la sous-zone (complément en boutiques) : ${liste(pl.deficits, 6)}.`, '')
  }
  md.push('## Sous-zones des SSF', '')
  md.push('| SSF | Distributeur | Origine | Zone | Quartiers | PDV actifs |', '|---|---|---|---|---|---|')
  for (const sz of [...sousZones.values()].sort((a, b) => a.ref.nom.localeCompare(b.ref.nom, 'fr'))) {
    md.push(`| ${sz.ref.nom} | ${sz.distributeur || '—'} | ${{ derivee: 'dérivée (à confirmer)', client: 'fichier client', conservee: 'saisie conservée' }[sz.origine]} | ${sz.zone || '—'} | ${sousZoneTexte(sz.lignes.map(l => ({ zone: l.zone, quartier: `${l.quartier}${l.n ? ` (${l.n})` : ''}` })), 10)} | ${sz.nbPdv} |`)
  }
  if (bruit.length) md.push('', `SSF sans sous-zone : ${bruit.map(b => `${b.s.nom} (${b.n} visites${b.motif ? `, ${b.motif}` : ''})`).join(', ')}.`)
  const horsCommune = [...sousZones.values()].filter(sz => sz.horsCommune?.length)
  if (horsCommune.length) {
    md.push('', 'Quartiers écartés car dans une autre commune que celle du SSF (à ajouter à la main dans SSF ↔ Quartiers si le SSF les couvre vraiment) :', '')
    for (const sz of horsCommune) md.push(`- ${sz.ref.nom} : ${sousZoneTexte(sz.horsCommune.map(x => ({ zone: x.zone, quartier: `${x.quartier} (${x.n})` })))}`)
  }
  if (client.rejets.length) md.push('', '## Lignes du fichier client rejetées', '', ...client.rejets.map(r => `- ${r}`))
  if (avertissements.length) md.push('', '## Avertissements', '', ...avertissements.map(a => `- ${a}`))
  md.push('', '## Retour arrière', '', 'Les opérations inverses (règles SSF, jours de la règle DMS, périmètres, sous-zones) sont produites avec la simulation : bouton « Annuler le lot » dans Admin › Imports terrain, ou `node scripts/deriver-ssf-sous-zones.mjs --retour=<fichier .json> --apply`.')

  const csv = {
    'ssf-sous-zones.csv': csvTexte(['SSF', 'Distributeur', 'Origine', 'Zone', 'Quartier', 'Visites', 'Part', 'PDV actifs du quartier'],
      [...sousZones.values()].flatMap(sz => sz.lignes.map(l => [sz.ref.nom, sz.distributeur || '', sz.origine, l.zone, l.quartier, l.n ?? '', l.part != null ? pct(l.part) : '', (activeParZq.get(cleZq(l.zone, l.quartier)) || []).length]))),
    'ssf-planning.csv': csvTexte(['Merchandiser', 'Email', 'Jour', 'SSF', 'Zone', 'Quartiers', 'PDV portefeuille', ...CANAUX.map(c => `${c} (sous-zone)`), 'Choix'],
      plannings.flatMap(pl => OUVRES.map(j => {
        const r = pl.regles.find(x => x.days_of_week.includes(j))
        return [pl.profil.nom || '', pl.profil.email || '', JOURS[j], r?.ssf.nom || 'Portefeuille DMS', r?._sz.zone || '', r ? r._sz.lignes.map(l => l.quartier).join(', ') : '', r?.pdv_ids.length ?? '', ...CANAUX.map(c => r?._sz.parCanal[c] ?? ''), pl.choixJours[j] || '']
      }))),
  }

  return { resume, rapport: md.join('\n') + '\n', csv, operations, retour, avertissements, plannings, sousZones }
}

function uniquesZq(lignes) {
  const vus = new Set()
  return lignes.filter(l => { const k = cleZq(l.zone, l.quartier); if (vus.has(k)) return false; vus.add(k); return true })
}
