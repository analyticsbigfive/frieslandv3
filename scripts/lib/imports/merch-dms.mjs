/**
 * Affectation des merchandisers nommés dans l'export DMS (colonne
 * « Merchandiseur ») — cœur partagé par scripts/affecter-merch-dms.mjs et
 * Admin › Imports terrain.
 *
 * 1. Compte : alias d'import (Référentiels › Alias d'import), sinon nom du
 *    fichier → profil merchandiser actif (ordre prénom/nom indifférent).
 *    Contrôle croisé facultatif avec le fichier des mails (commune, email, nom).
 * 2. Périmètre REMPLACÉ : territoires = libellés `pdv.zone` de ses PDV (le plus
 *    fréquent d'abord), quartiers = leurs quartiers non vides.
 * 3. Tournée : une règle « Portefeuille DMS — <distributeur> » avec tous ses PDV
 *    dans l'ordre du plus proche voisin ; mode quota pour un compte Atom ;
 *    jours lundi → samedi sauf ceux déjà couverts par des règles SSF.
 *
 * Les PDV d'un client sont retrouvés par `pdv.mdm` (import DMS appliqué avant).
 * Module pur : simulation → { resume, rapport, csv, operations, retour, bloquants }.
 */
import {
  aGps, chargerAlias, cleNom, csvTexte, distributeurCanonique, jourIsoLocal, lireDmsClasseur, norm, ordreGps, paquets,
  resoudreAlias, texteCellule, toutesLesLignes,
} from '../commun.mjs'

export const PREFIXE_REGLE_DMS = 'Portefeuille DMS'
const JOURS = [1, 2, 3, 4, 5, 6] // lundi → samedi (0 = dimanche)
const liste = (xs, max = 12) => (xs.length ? `${xs.slice(0, max).join(', ')}${xs.length > max ? `, … (+${xs.length - max})` : ''}` : '—')

/** Fichier des mails : ne lit que les colonnes COMMUNES, EMAIL, MERCHANDISERS. */
export function lireExcelMails(classeur) {
  const ws = classeur?.worksheets?.[0]
  if (!ws) return []
  let cols = null
  const lignes = []
  ws.eachRow((row) => {
    const cellule = (i) => String(texteCellule(row.getCell(i).value) ?? '').trim()
    if (!cols) {
      const idx = {}
      row.eachCell((c, i) => {
        const h = norm(texteCellule(c.value))
        if (h === 'COMMUNES') idx.commune = i
        if (h === 'EMAIL') idx.email = i
        if (h === 'MERCHANDISERS') idx.nom = i
      })
      if (idx.email) cols = idx
      return
    }
    const email = cellule(cols.email).toLowerCase()
    if (email) lignes.push({ email, commune: cols.commune ? cellule(cols.commune) : '', nom: cols.nom ? cellule(cols.nom) : '' })
  })
  return lignes
}

/** Codes clients de l'export qui ont un merchandiser (pour charger leurs PDV). */
export function clientsAffectes(classeurDms, nomFichier) {
  return lireDmsClasseur(classeurDms, { nomFichier }).clients.filter(c => c.merch)
}

export async function chargerDonneesMerchDms(sb, codes, { onEtape, toutes = toutesLesLignes } = {}) {
  onEtape?.('Comptes et référentiels')
  const [profils, distributeurs, aliasImport] = await Promise.all([
    toutes(() => sb.from('profiles')
      .select('id,email,nom,role,is_active,employeur,zone_assignee,territoires_assignes,quartiers_assignes')
      .in('role', ['merchandiser', 'admin']).order('id')),
    toutes(() => sb.from('distributeur').select('nom').order('id')),
    chargerAlias(sb, toutes),
  ])
  onEtape?.('PDV des clients')
  const pdvClients = []
  for (const lot of paquets(codes, 200)) {
    const { data, error } = await sb.from('pdv')
      .select('pdv_id,nom_pdv,zone,quartier,geolocation_lat,geolocation_lng,distributor_name,mdm,is_active')
      .in('mdm', lot)
    if (error) throw error
    pdvClients.push(...(data || []))
  }
  onEtape?.('PDV visibles (périmètres)')
  const visibles = await toutes(() => sb.from('pdv').select('pdv_id,zone,quartier').eq('is_active', true).order('pdv_id'))
  onEtape?.('Règles et tournées existantes')
  const ids = profils.filter(p => p.role === 'merchandiser').map(p => p.id)
  const regles = []
  for (const lot of paquets(ids, 100)) {
    regles.push(...await toutes(() => sb.from('routing_templates')
      .select('id,user_id,label,mode,is_active,days_of_week,day_of_week,date_debut,date_fin,distributeur,notes').in('user_id', lot).order('id')))
  }
  const idsDms = regles.filter(r => String(r.label || '').startsWith(PREFIXE_REGLE_DMS)).map(r => r.id)
  const reglesPdv = []
  for (const lot of paquets(idsDms, 50)) {
    reglesPdv.push(...await toutes(() => sb.from('routing_template_pdv').select('template_id,pdv_id,position_order').in('template_id', lot).order('id')))
  }
  const debutFenetre = jourIsoLocal()
  const tournees = []
  for (const lot of paquets(ids, 100)) {
    tournees.push(...await toutes(() => sb.from('routings').select('user_id,date_routing').in('user_id', lot).gte('date_routing', debutFenetre).order('id')))
  }
  let appareils = []
  try { appareils = await toutes(() => sb.from('version_installee').select('user_id,version_nom,version_code,vu_le').order('user_id')) }
  catch { appareils = null }
  return { profils, distributeurs, aliasImport, pdvClients, visibles, regles, reglesPdv, tournees, appareils }
}

export function simulerMerchDms(classeurDms, classeurMails, donnees, options = {}) {
  const debut = options.debut || jourIsoLocal()
  const pregenerer = Number(options.pregenerer || 0)
  const nomFichier = options.nomFichier || 'export DMS'
  const { profils, distributeurs, aliasImport, pdvClients, visibles: visiblesListe, regles, reglesPdv, tournees, appareils } = donnees
  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut)) throw new Error(`Date de début ${debut} : format attendu AAAA-MM-JJ`)

  const affectes = clientsAffectes(classeurDms, nomFichier)
  const mails = classeurMails ? lireExcelMails(classeurMails) : []
  const mailParEmail = new Map(mails.map(m => [m.email, m]))
  const nomsDistributeur = distributeurs.map(d => d.nom)
  const merchsActifs = profils.filter(p => p.role === 'merchandiser' && p.is_active !== false && p.email)
  const auteur = options.auteurId ? profils.find(p => p.id === options.auteurId) : null

  const nomsFichier = [...new Set(affectes.map(c => c.merch))].sort((a, b) => a.localeCompare(b, 'fr'))
  const merchs = nomsFichier.map((nom) => {
    const email = resoudreAlias(nom, aliasImport, 'merchandiser')
    const candidats = email
      ? merchsActifs.filter(p => p.email.toLowerCase() === String(email).toLowerCase())
      : merchsActifs.filter(p => cleNom(p.nom) === cleNom(nom))
    const siens = affectes.filter(c => c.merch === nom)
    return {
      nomFichier: nom,
      profil: candidats.length === 1 ? candidats[0] : null,
      candidats,
      clients: siens,
      zonesFichier: [...new Set(siens.map(c => c.zone).filter(Boolean))],
      distributeurs: [...siens.reduce((m, c) => m.set(c.distributeurs[0], (m.get(c.distributeurs[0]) || 0) + 1), new Map())]
        .filter(([d]) => d).sort((a, b) => b[1] - a[1]).map(([d]) => d),
    }
  })

  const pdvParMdm = new Map()
  for (const p of [...pdvClients, ...(options.pdvSupplementaires || [])]) if (p.mdm && !pdvParMdm.has(p.mdm)) pdvParMdm.set(p.mdm, p)
  const visibles = new Map(visiblesListe.map(p => [p.pdv_id, p]))
  for (const p of options.pdvSupplementaires || []) visibles.set(p.pdv_id, { pdv_id: p.pdv_id, zone: p.zone, quartier: p.quartier })
  const dansPerimetre = (p, territoires, quartiers) =>
    territoires.includes(p.zone || '') && (!quartiers.length || !p.quartier || quartiers.includes(p.quartier))

  const pdvParRegle = new Map()
  for (const l of reglesPdv) {
    if (!pdvParRegle.has(l.template_id)) pdvParRegle.set(l.template_id, [])
    pdvParRegle.get(l.template_id).push(l)
  }
  pdvParRegle.forEach(ls => ls.sort((a, b) => a.position_order - b.position_order))

  for (const m of merchs) {
    m.pdvs = m.clients.map(c => pdvParMdm.get(c.code)).filter(Boolean)
    m.manquants = m.clients.filter(c => !pdvParMdm.has(c.code))
    const parZone = new Map()
    m.pdvs.forEach(p => { if (p.zone) parZone.set(p.zone, (parZone.get(p.zone) || 0) + 1) })
    m.territoires = [...parZone].sort((a, b) => b[1] - a[1]).map(([z]) => z)
    m.quartiers = [...new Set(m.pdvs.map(p => p.quartier).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
    m.sansZone = m.pdvs.filter(p => !p.zone)
    m.sansGps = m.pdvs.filter(p => !aGps(p.geolocation_lat, p.geolocation_lng))
    m.ordre = ordreGps(m.pdvs)
    m.distributeur = m.distributeurs.length
      ? (resoudreAlias(m.distributeurs[0], aliasImport, 'distributeur') || distributeurCanonique(m.distributeurs[0], nomsDistributeur))
      : ''
    m.label = `${PREFIXE_REGLE_DMS} — ${m.distributeur || m.nomFichier}`
    m.nbVisibles = [...visibles.values()].filter(p => dansPerimetre(p, m.territoires, m.quartiers)).length
    m.nbVisiblesAvant = m.profil
      ? [...visibles.values()].filter(p => dansPerimetre(p,
        (m.profil.territoires_assignes?.length ? m.profil.territoires_assignes : [m.profil.zone_assignee]).filter(Boolean),
        (m.profil.quartiers_assignes || []).filter(Boolean))).length
      : 0
    m.mail = m.profil ? mailParEmail.get(m.profil.email.toLowerCase()) : null
    if (!m.profil) continue
    const siennes = regles.filter(r => r.user_id === m.profil.id)
    m.reglesDms = siennes.filter(r => String(r.label || '').startsWith(PREFIXE_REGLE_DMS))
    // Jours déjà couverts par des règles SSF (sous-zones) : la règle DMS ne
    // garde que les autres.
    m.joursSsf = [...new Set(siennes.filter(r => String(r.label || '').startsWith('SSF — ') && r.is_active !== false).flatMap(r => r.days_of_week || []))]
    m.joursDms = JOURS.filter(j => !m.joursSsf.includes(j))
    m.autresRegles = siennes.filter(r => r.is_active && !String(r.label || '').startsWith(PREFIXE_REGLE_DMS) && !String(r.label || '').startsWith('SSF — '))
    m.tourneesExistantes = tournees.filter(t => t.user_id === m.profil.id && t.date_routing >= debut).map(t => t.date_routing).sort()
    const vus = (appareils || []).filter(a => a.user_id === m.profil.id).sort((a, b) => String(b.vu_le).localeCompare(String(a.vu_le)))
    m.version = appareils == null ? 'inconnue' : vus[0] ? `${vus[0].version_nom || vus[0].version_code} (vu le ${String(vus[0].vu_le).slice(0, 10)})` : '≤ 1.0.9 ou jamais ouverte'
  }

  // ---------- Opérations ----------
  const bloquants = merchs.filter(m => m.profil && m.manquants.length)
    .map(m => `${m.nomFichier} : ${m.manquants.length} client(s) sans PDV (pdv.mdm) — appliquer d'abord l'import DMS.`)
  const operations = []
  const retour = []
  const finPre = pregenerer > 0 ? (() => { const d = new Date(`${debut}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + pregenerer - 1); return d.toISOString().slice(0, 10) })() : null
  for (const m of merchs.filter(m => m.profil && m.pdvs.length)) {
    const p = m.profil
    operations.push({ type: 'profil.perimetre', user_id: p.id, territoires_assignes: m.territoires, quartiers_assignes: m.quartiers, zone_assignee: m.territoires[0] || null })
    retour.push({ type: 'profil.perimetre', user_id: p.id, territoires_assignes: p.territoires_assignes || [], quartiers_assignes: p.quartiers_assignes || [], zone_assignee: p.zone_assignee || null })
    operations.push({
      type: 'regle_dms.remplacer', user_id: p.id, created_by: auteur?.id || null,
      regle: {
        label: m.label, mode: p.employeur === 'atom' ? 'quota' : 'perimetre', distributeur: m.distributeur || null,
        days_of_week: m.joursDms, date_debut: debut, is_active: true,
        notes: `Clients DMS du fichier ${nomFichier} (${m.pdvs.length} PDV).`,
        pdv_ids: m.ordre.map(x => x.pdv_id),
      },
    })
    const ancienne = m.reglesDms[0]
    retour.push({
      type: 'regle_dms.remplacer', user_id: p.id,
      regle: ancienne
        ? {
            label: ancienne.label, mode: ancienne.mode || 'perimetre', distributeur: ancienne.distributeur || null,
            days_of_week: ancienne.days_of_week || [ancienne.day_of_week], date_debut: ancienne.date_debut || null,
            is_active: ancienne.is_active !== false, notes: ancienne.notes || null,
            pdv_ids: (pdvParRegle.get(ancienne.id) || []).map(l => l.pdv_id),
          }
        : null,
    })
    if (finPre) operations.push({ type: 'tournees.generer', user_id: p.id, debut, fin: finPre })
  }

  // ---------- Rapport ----------
  const anomalies = [...bloquants]
  for (const m of merchs) {
    if (!m.profil) {
      anomalies.push(m.candidats.length
        ? `**${m.nomFichier}** : ${m.candidats.length} comptes possibles (${m.candidats.map(p => p.email).join(', ')}) — non affecté, à trancher dans Référentiels › Alias d'import.`
        : `**${m.nomFichier}** : aucun compte merchandiser actif à ce nom — non affecté (${m.clients.length} clients). Créer le compte ou un alias.`)
      continue
    }
    if (m.sansZone.length) anomalies.push(`**${m.nomFichier}** : ${m.sansZone.length} PDV sans territoire, invisibles du terrain.`)
    if (mails.length && !m.mail) anomalies.push(`**${m.nomFichier}** : compte ${m.profil.email} absent du fichier des mails.`)
    else if (m.mail?.nom && cleNom(m.mail.nom) !== cleNom(m.nomFichier)) anomalies.push(`**${m.nomFichier}** : le fichier des mails donne « ${m.mail.nom} » pour ${m.profil.email} (${m.mail.commune}).`)
    if (m.reglesDms.length > 1) anomalies.push(`**${m.nomFichier}** : ${m.reglesDms.length} règles « ${PREFIXE_REGLE_DMS} » existantes, remplacées par une seule (le retour arrière ne recrée que la première).`)
    if (m.joursSsf.length) anomalies.push(`**${m.nomFichier}** : règles SSF sur ${m.joursSsf.join(', ')} → la règle DMS ne garde que ${m.joursDms.join(', ') || 'aucun jour'} ; relancer l'import « Sous-zones SSF » pour recalculer leurs portefeuilles.`)
    if (m.autresRegles.length) anomalies.push(`**${m.nomFichier}** : ${m.autresRegles.length} autre(s) règle(s) active(s) conservée(s) — leurs PDV s'ajoutent à la tournée.`)
    if (m.tourneesExistantes.length) anomalies.push(`**${m.nomFichier}** : ${m.tourneesExistantes.length} tournée(s) déjà générée(s) à partir du ${debut} (${liste(m.tourneesExistantes, 6)}) — elles priment ces jours-là (Maintenance › Recalculer les tournées à venir).`)
  }
  mails.filter(x => !merchs.some(m => m.profil?.email.toLowerCase() === x.email))
    .forEach(x => anomalies.push(`Fichier des mails : ${x.email} (${x.commune || '?'}${x.nom ? `, ${x.nom}` : ', sans nom'}) n'a aucun client dans l'export DMS.`))

  const rapport = `# Affectation des merchandisers DMS

Source : \`${nomFichier}\` — ${affectes.length} clients avec un merchandiser${mails.length ? ` ; fichier des mails : ${mails.length} comptes` : ''}.
Règle : « ${PREFIXE_REGLE_DMS} — <distributeur> », à partir du ${debut}, sans date de fin, tous les PDV du merchandiser (quotas pour un compte Atom).

## Synthèse

| Merchandiser (fichier) | Compte | Clients | PDV en tournée | sans GPS | Territoires (remplacés) | Quartiers | PDV visibles avant → après | Version app |
|---|---|---|---|---|---|---|---|---|
${merchs.map(m => `| ${m.nomFichier} | ${m.profil?.email || '**aucun**'} | ${m.clients.length} | ${m.pdvs.length} | ${m.sansGps.length} | ${m.territoires.join(', ') || '—'} | ${m.quartiers.length} | ${m.nbVisiblesAvant} → ${m.nbVisibles} | ${m.version || '—'} |`).join('\n') || '| — | | | | | | | | |'}

« PDV visibles » : PDV de ses territoires dont le quartier est dans sa liste, ou vide.

## Anomalies

${anomalies.length ? anomalies.map(a => `- ${a}`).join('\n') : 'Aucune.'}

## Retour arrière

Bouton « Annuler le lot » (Admin › Imports terrain) ou \`--retour=<fichier>\` : périmètres et règle « ${PREFIXE_REGLE_DMS} » d'avant restaurés.
`
  const csv = {
    'affectation-merch-dms.csv': csvTexte(['Merchandiser (fichier)', 'Compte', 'Clients', 'PDV en tournée', 'Sans GPS', 'Territoires', 'Quartiers', 'Visibles avant', 'Visibles après', 'Règle'],
      merchs.map(m => [m.nomFichier, m.profil?.email || '', m.clients.length, m.pdvs.length, m.sansGps.length, m.territoires.join(' / '), m.quartiers.length, m.nbVisiblesAvant, m.nbVisibles, m.label])),
  }
  const resume = {
    clients: affectes.length, merchandisers: merchs.length, affectes: merchs.filter(m => m.profil && m.pdvs.length).length,
    sansCompte: merchs.filter(m => !m.profil).length, bloquants: bloquants.length, operations: operations.length,
  }
  return { resume, rapport, csv, operations, retour, bloquants }
}
