#!/usr/bin/env node
/**
 * Recalcule le périmètre (territoires, quartiers, zone principale) des
 * merchandisers d'une agence depuis leurs tournées, et non plus depuis le
 * premier fichier DMS (décision du 10/10/2026 : celui-ci avait écrit BOUAKE 1,
 * ABOISSO… dans des fiches de merchandisers qui ne travaillent qu'à Abidjan).
 *
 * PDV pris en compte, pour chaque merchandiser actif de l'agence :
 *   - ceux de ses règles actives (routing mensuel, SSF, portefeuille en repli) ;
 *   - ceux de ses tournées à venir (complément de quota compris).
 * Périmètre = zones et quartiers de ces PDV. Tout PDV qu'une tournée peut lui
 * donner reste donc lisible dans l'application (pdv_ids_perimetre : zone dans
 * les territoires étendus, quartier dans la liste ou vide). Une zone qui ne
 * tient qu'au portefeuille (moins de 10 PDV, aucun dans une tournée ni dans
 * le routing mensuel) n'entre pas : le fichier DMS traîne des PDV isolés, sans
 * GPS, classés à Bouaké ou Aboisso (même seuil que routing-mensuel.mjs).
 *
 * Simulation par défaut ; --apply pour écrire (retour arrière dans
 * ~/Downloads/imports-terrain/perimetre-routing-<date-heure>/retour.json).
 *
 * Usage :
 *   node scripts/perimetre-depuis-routing.mjs --agence=atom [--apply]
 *   node scripts/perimetre-depuis-routing.mjs --retour=…/retour.json [--apply]
 */
import { arg, APPLY, clientServiceRole, ecrireSorties, traiterRetour } from './lib/cli-import.mjs'
import { appliquerOperations } from './lib/imports/operations.mjs'
import { toutesLesLignes } from './lib/commun.mjs'

const sb = clientServiceRole()
// Le retour arrière ne contient que des « profil.perimetre », autorisés pour l'import routing-mensuel.
if (await traiterRetour(sb, 'routing-mensuel')) process.exit(0)

const agence = arg('agence', null)
if (!agence || agence === 'friesland') {
  console.error('--agence=<code de l’agence> requis (ex. --agence=atom)')
  process.exit(1)
}
const aujourdhui = new Date().toISOString().slice(0, 10)
const toutes = requete => toutesLesLignes(requete)
const MIN_PDV_ZONE_PORTEFEUILLE = 10
const parPaquets = async (ids, taille, f) => {
  const out = []
  for (let i = 0; i < ids.length; i += taille) out.push(...await f(ids.slice(i, i + taille)))
  return out
}

const merchs = await toutes(() => sb.from('profiles')
  .select('id,nom,email,is_active,territoires_assignes,quartiers_assignes,zone_assignee')
  .eq('role', 'merchandiser').eq('employeur', agence).eq('is_active', true).order('id'))
if (!merchs.length) {
  console.error(`Aucun merchandiser actif pour l’agence « ${agence} ».`)
  process.exit(1)
}
const ids = merchs.map(m => m.id)

const regles = await parPaquets(ids, 50, lot => toutes(() => sb.from('routing_templates')
  .select('id,user_id,label,ssf_id').in('user_id', lot).eq('is_active', true).order('id')))
const reglesPdv = await parPaquets(regles.map(r => r.id), 50, lot => toutes(() => sb.from('routing_template_pdv')
  .select('template_id,pdv_id').in('template_id', lot).order('id')))
const tournees = await parPaquets(ids, 50, lot => toutes(() => sb.from('routings')
  .select('id,user_id').in('user_id', lot).gte('date_routing', aujourdhui).neq('status', 'cancelled').order('id')))
const tourneesPdv = await parPaquets(tournees.map(t => t.id), 50, lot => toutes(() => sb.from('routing_pdv')
  .select('routing_id,pdv_id').in('routing_id', lot).order('id')))

const regleParId = new Map(regles.map(r => [r.id, r]))
const userDeTournee = new Map(tournees.map(t => [t.id, t.user_id]))
const pdvParUser = new Map(ids.map(id => [id, new Set()]))
// PDV « sûrs » : dans une tournée à venir, une règle du routing mensuel ou une règle SSF.
const surs = new Map(ids.map(id => [id, new Set()]))
for (const x of reglesPdv) {
  const r = regleParId.get(x.template_id)
  if (!r) continue
  pdvParUser.get(r.user_id)?.add(x.pdv_id)
  if (r.ssf_id || /^(SSF — |Routing mensuel — )/.test(r.label || '')) surs.get(r.user_id)?.add(x.pdv_id)
}
for (const x of tourneesPdv) {
  const u = userDeTournee.get(x.routing_id)
  pdvParUser.get(u)?.add(x.pdv_id)
  surs.get(u)?.add(x.pdv_id)
}

const tousPdv = [...new Set([...pdvParUser.values()].flatMap(s => [...s]))]
const pdvs = new Map((await parPaquets(tousPdv, 200, lot => toutes(() => sb.from('pdv')
  .select('pdv_id,zone,quartier').in('pdv_id', lot).order('pdv_id')))).map(p => [p.pdv_id, p]))

const operations = []
const retour = []
const lignesRapport = []
for (const m of merchs) {
  const parZone = new Map() // zone → { n, sur, quartiers }
  for (const id of pdvParUser.get(m.id)) {
    const p = pdvs.get(id)
    if (!p?.zone) continue
    const z = parZone.get(p.zone) || { n: 0, sur: false, quartiers: new Set() }
    z.n++
    z.sur ||= surs.get(m.id).has(id)
    if (p.quartier) z.quartiers.add(p.quartier)
    parZone.set(p.zone, z)
  }
  const ecartees = [...parZone.entries()].filter(([, z]) => !z.sur && z.n < MIN_PDV_ZONE_PORTEFEUILLE)
  for (const [zone] of ecartees) parZone.delete(zone)
  const nbParZone = new Map([...parZone.entries()].map(([zone, z]) => [zone, z.n]))
  const quartiers = new Set([...parZone.values()].flatMap(z => [...z.quartiers]))
  if (!nbParZone.size) {
    lignesRapport.push(`- ${m.nom} : aucun PDV de tournée, fiche inchangée.`)
    continue
  }
  const zones = [...nbParZone.entries()].sort((a, b) => b[1] - a[1])
  const territoires = zones.map(([z]) => z)
  const avant = (m.territoires_assignes || []).length ? m.territoires_assignes : [m.zone_assignee].filter(Boolean)
  const retires = avant.filter(z => !territoires.includes(z))
  const ajoutes = territoires.filter(z => !avant.includes(z))
  lignesRapport.push(`- ${m.nom} (${pdvParUser.get(m.id).size} PDV) : ${zones.map(([z, n]) => `${z} ${n}`).join(', ')} ; ${quartiers.size} quartiers`
    + (retires.length ? ` ; retirés : ${retires.join(', ')}` : '') + (ajoutes.length ? ` ; ajoutés : ${ajoutes.join(', ')}` : '')
    + (ecartees.length ? ` ; écartées (portefeuille DMS seul) : ${ecartees.map(([z, x]) => `${z} ${x.n}`).join(', ')}` : ''))
  operations.push({ type: 'profil.perimetre', user_id: m.id, territoires_assignes: territoires, quartiers_assignes: [...quartiers].sort(), zone_assignee: territoires[0] })
  retour.push({ type: 'profil.perimetre', user_id: m.id, territoires_assignes: m.territoires_assignes || [], quartiers_assignes: m.quartiers_assignes || [], zone_assignee: m.zone_assignee ?? null })
}

const rapport = [`# Périmètres recalculés depuis les tournées — agence ${agence} (${aujourdhui})`, '', ...lignesRapport, ''].join('\n')
console.log(rapport)
if (!APPLY) {
  const dossier = ecrireSorties('perimetre-routing', { rapport, csv: {} })
  console.log(`Rapport : ${dossier}\n\nDRY-RUN : ${operations.length} fiche(s) à mettre à jour, aucune écriture. Relancer avec --apply.`)
  process.exit(0)
}
const dossier = ecrireSorties('perimetre-routing', { rapport, csv: {} }, { retour })
console.log(`Rapport et retour arrière (retour.json) : ${dossier}`)
const journal = await appliquerOperations(sb, operations, {
  typesAutorises: ['profil.perimetre'],
  onProgression: ({ fait, total, message }) => console.log(`  [${fait}/${total}] ${message}`),
})
console.log(`✅ ${journal.length} fiche(s) mise(s) à jour`)
console.log(`Annulation possible : node scripts/perimetre-depuis-routing.mjs --retour=${dossier}/retour.json --apply`)
