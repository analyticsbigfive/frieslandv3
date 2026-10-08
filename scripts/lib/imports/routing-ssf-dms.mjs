/**
 * Routing des SSF depuis l'export clients DMS (Admin › Imports terrain).
 *
 * Réunion client du 08/10/2026 : le SSF (vendeur du distributeur) et le
 * merchandiser de son binôme doivent passer dans les mêmes PDV. La tournée du
 * SSF vient du DMS : chaque client (customer_code = pdv.mdm) y porte son
 * vendeur (salesman_name). L'import remplit `ssf_pdv` : pour chaque SSF, les
 * PDV de ses clients DMS (jour 0 = tous les jours, l'export ne donne pas le
 * jour). Le contrôle d'écart (Routing › Écarts SSF ↔ merch) s'en sert.
 *
 * Rapprochement du vendeur : nom du SSF ou une de ses orthographes (ssf.nom,
 * ssf.nom_brut), puis alias d'import de type « ssf ». Un vendeur inconnu est
 * créé dans le référentiel SSF, rattaché à son distributeur.
 *
 * Module pur : simulation → { resume, rapport, csv, operations, retour }.
 */
import { chargerAlias, cleNom, csvTexte, distributeurCanonique, lireDmsClasseur, resoudreAlias, toutesLesLignes, uniques } from '../commun.mjs'

export async function chargerDonneesRoutingSsf(sb, { onEtape, toutes = toutesLesLignes } = {}) {
  onEtape?.('PDV reliés au DMS')
  const pdvs = await toutes(() => sb.from('pdv').select('pdv_id,mdm').not('mdm', 'is', null).order('pdv_id'))
  onEtape?.('Référentiels')
  const [ssfs, distributeurs, aliasImport] = await Promise.all([
    toutes(() => sb.from('ssf').select('id,nom,nom_brut,distributeur_id,actif').order('id')),
    toutes(() => sb.from('distributeur').select('id,nom').order('id')),
    chargerAlias(sb, toutes),
  ])
  onEtape?.('Routing SSF en place')
  let existants = []
  let migrationAppliquee = true
  try {
    existants = await toutes(() => sb.from('ssf_pdv').select('ssf_id,pdv_id,jour_semaine,source').like('source', 'dms-%').order('ssf_id').order('pdv_id'))
  }
  catch { migrationAppliquee = false }
  return { pdvs, ssfs, distributeurs, aliasImport, existants, migrationAppliquee }
}

export function simulerRoutingSsf(classeur, donnees, options = {}) {
  const nomFichier = options.nomFichier || 'export DMS'
  const source = `dms-${nomFichier}`.slice(0, 200)
  const { pdvs, ssfs, distributeurs, aliasImport, existants } = donnees
  const bloquants = donnees.migrationAppliquee === false
    ? ['La migration du routing SSF (20261008140000) n’est pas encore appliquée.']
    : []

  const { lignesDms, clients } = lireDmsClasseur(classeur, { nomFichier })

  const pdvParMdm = new Map()
  for (const p of pdvs) if (p.mdm) pdvParMdm.set(String(p.mdm).trim(), p.pdv_id)
  const nomsDistributeurs = distributeurs.map(d => d.nom)
  const ssfParCle = new Map()
  const ssfParNom = new Map()
  for (const s of ssfs) {
    ssfParNom.set(s.nom, s)
    for (const variante of [s.nom, ...String(s.nom_brut || '').split('|')]) {
      const k = cleNom(variante)
      if (k && !ssfParCle.has(k)) ssfParCle.set(k, s)
    }
  }
  const trouverSsf = (nom) => ssfParCle.get(cleNom(nom))
    || ssfParNom.get(resoudreAlias(nom, aliasImport, 'ssf') || '')
    || null

  // Vendeur → { ref, distributeur, clients, pdv_ids }
  const parVendeur = new Map()
  let clientsSansPdv = 0
  let clientsSansVendeur = 0
  for (const c of clients) {
    const pdvId = pdvParMdm.get(String(c.code).trim()) || null
    if (!pdvId) clientsSansPdv++
    const vendeurs = (c.vendeursDetail || []).filter(v => String(v.nom || '').trim())
    if (!vendeurs.length) { clientsSansVendeur++; continue }
    for (const v of vendeurs) {
      const k = cleNom(v.nom)
      if (!parVendeur.has(k)) {
        const ssf = trouverSsf(v.nom)
        parVendeur.set(k, {
          nomFichier: v.nom.trim(),
          ref: ssf ? { id: ssf.id, nom: ssf.nom } : { nom: v.nom.trim() },
          aCreer: !ssf,
          distributeur: distributeurCanonique(v.distributeur, nomsDistributeurs) || null,
          clients: 0,
          pdv_ids: new Set(),
        })
      }
      const x = parVendeur.get(k)
      x.clients++
      if (pdvId) x.pdv_ids.add(pdvId)
    }
  }

  const avantParSsf = new Map()
  for (const e of existants) {
    if (e.jour_semaine !== 0) continue
    if (!avantParSsf.has(e.ssf_id)) avantParSsf.set(e.ssf_id, [])
    avantParSsf.get(e.ssf_id).push(e.pdv_id)
  }

  const operations = []
  const retour = []
  const vendeurs = [...parVendeur.values()].sort((a, b) => a.ref.nom.localeCompare(b.ref.nom, 'fr'))
  for (const v of vendeurs.filter(x => x.aCreer)) {
    operations.push({ type: 'ssf.creer', nom: v.ref.nom, distributeur: v.distributeur, telephone: null, source })
  }
  for (const v of vendeurs) {
    const pdvIds = [...v.pdv_ids].sort()
    const avant = v.ref.id ? (avantParSsf.get(v.ref.id) || []) : []
    const inchange = v.ref.id && avant.length === pdvIds.length && avant.every(id => v.pdv_ids.has(id))
    if (inchange) continue
    operations.push({ type: 'ssf_pdv.remplacer', ssf: v.ref, source, jour_semaine: 0, remplace: ['dms-'], pdv_ids: pdvIds })
    retour.push({ type: 'ssf_pdv.remplacer', ssf: v.ref, source: avant.length ? (existants.find(e => e.ssf_id === v.ref.id)?.source || 'dms-retour') : 'dms-retour', jour_semaine: 0, remplace: ['dms-'], pdv_ids: avant })
  }

  const resume = {
    lignesDms,
    clients: clients.length,
    vendeurs: vendeurs.length,
    ssfReconnus: vendeurs.filter(v => !v.aCreer).length,
    ssfACreer: vendeurs.filter(v => v.aCreer).length,
    clientsSansPdv,
    clientsSansVendeur,
    operations: operations.length,
  }

  const md = []
  md.push('# Routing des SSF (export DMS)', '')
  md.push(`Fichier : ${nomFichier} — ${lignesDms} lignes, ${clients.length} clients.`)
  md.push('', 'Pour chaque SSF (vendeur du distributeur), les PDV de ses clients DMS. Ce routing sert au contrôle d’écart avec la tournée du merchandiser de son binôme (Routing › Écarts SSF ↔ merch). L’export ne donne pas le jour : un PDV du routing vaut pour tous les jours.')
  md.push('', '## Résumé', '')
  md.push(`- Vendeurs : ${resume.vendeurs}, dont ${resume.ssfReconnus} reconnus dans le référentiel SSF et ${resume.ssfACreer} à créer.`)
  md.push(`- Clients sans PDV relié (code client absent de pdv.mdm : lancer d’abord « Clients DMS → points de vente ») : ${clientsSansPdv}.`)
  if (clientsSansVendeur) md.push(`- Clients sans vendeur : ${clientsSansVendeur}.`)
  md.push(`- SSF dont le routing change : ${operations.filter(o => o.type === 'ssf_pdv.remplacer').length}.`)
  md.push('', '## Par SSF', '', '| SSF | Dans le fichier | Distributeur | Clients | PDV reliés | Statut |', '|---|---|---|---|---|---|')
  for (const v of vendeurs) {
    md.push(`| ${v.ref.nom} | ${v.nomFichier} | ${v.distributeur || '—'} | ${v.clients} | ${v.pdv_ids.size} | ${v.aCreer ? 'à créer' : 'reconnu'} |`)
  }
  md.push('', 'Un vendeur mal reconnu se corrige par un alias (Référentiels › Alias d’import, type SSF), puis une nouvelle simulation.')

  const csv = {
    'routing-ssf.csv': csvTexte(['SSF', 'Nom dans le fichier', 'Distributeur', 'Clients', 'PDV reliés', 'Statut'],
      vendeurs.map(v => [v.ref.nom, v.nomFichier, v.distributeur || '', v.clients, v.pdv_ids.size, v.aCreer ? 'à créer' : 'reconnu'])),
  }

  return { resume, rapport: md.join('\n') + '\n', csv, operations, retour, bloquants, vendeurs: vendeurs.map(v => ({ ...v, pdv_ids: uniques([...v.pdv_ids]) })) }
}
