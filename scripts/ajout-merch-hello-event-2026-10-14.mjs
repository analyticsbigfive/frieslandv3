#!/usr/bin/env node
/**
 * Merchandisers Modern Trade de l'agence Hello Event (fichier client du
 * 14/10/2026 « FICHE DE ZONE MERCHANDISEUR ABIDJAN ET UPC ») : 8 postes à
 * Abidjan, 2 à l'intérieur (UPC), chacun avec sa liste de magasins.
 *
 *   1. Agence : ligne `agence` « hello-event » (direction MT, sans programme :
 *      liste fixe de magasins, pas de quotas ni de programme mensuel).
 *   2. Comptes : on cherche chaque personne (e-mail, puis nom avec
 *      trouverPersonne, puis alias_import). Aucun n'existait au 14/10. Un compte
 *      retrouvé passe merchandiser Hello Event ; sinon il est créé avec une
 *      adresse générique par poste (domaine fictif friesland-terrain.ci : aucun
 *      e-mail ne part chez un tiers), mot de passe provisoire, changement
 *      imposé à la première connexion.
 *   3. Périmètre : pdv_ids_perimetre() donne TOUT le parc à un merchandiser
 *      sans territoire. Le compte reçoit les communes (pdv.zone) où se trouvent
 *      les magasins de sa fiche ; les magasins eux-mêmes ne sont PAS rattachés
 *      (décision du 14/10 : « pas les magasins, les nouveaux comptes »).
 *
 * Tout est lu et vérifié avant la première écriture. Un nom rapproché sans
 * certitude (« approche » ou plusieurs pistes) arrête le script.
 *
 * Usage :
 *   node scripts/ajout-merch-hello-event-2026-10-14.mjs            # simulation (défaut)
 *   node scripts/ajout-merch-hello-event-2026-10-14.mjs --apply    # SEED_DEFAULT_PASSWORD du .env
 *   Sortie : ~/Downloads/comptes-hello-event-2026-10-14.csv (sans mot de passe)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chargerAlias, csvTexte, norm, resoudreAlias, toutesLesLignes, trouverPersonne } from './lib/commun.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const APPLY = process.argv.includes('--apply')
const PASSWORD = process.argv.find(a => a.startsWith('--password='))?.split('=').slice(1).join('=')
  || process.env.SEED_DEFAULT_PASSWORD
const SORTIE = resolve(homedir(), 'Downloads', 'comptes-hello-event-2026-10-14.csv')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const AGENCE = { code: 'hello-event', nom: 'Hello Event Communication & Événementiel', direction: 'mt', programme: false, actif: true, ordre: 40 }
const DOMAINE = 'friesland-terrain.ci'

// Fiche du 14/10/2026, feuille « MERCHANDISEUR 1 » : poste, nom, magasins.
const POSTES = [
  { poste: 'abidjan1', nom: "M'BROH YEBLE NADEGE NINA", region: 'MODERN TRADE', magasins: [
    'PLAYCE MARCORY', 'HYPER HAYAT', 'SUPER U ZONE 4 SIVADIS', 'BON PRIX BELLEVILLE', 'PRIMA', 'S2P SOCOCE ZONE 3', 'CDCI VGE',
    'KING CASH BLVD DU GABON', 'CASINO MANDARINE MARCORY', 'SUPER U PLATEAU', 'BON PRIX PLATEAU', 'SOCOPRIX ZONE 3'] },
  { poste: 'abidjan2', nom: 'LELLA AYA BERNADETTE GRACE EMMANUELLA', region: 'MODERN TRADE', magasins: [
    'BON PRIX BOULEVARD DE MARSEILLE', 'CASH U AGOUTI', 'CASH U PORT BOUET', 'CASH U REMBLAIS', 'BON PRIX ZONE 4', 'BON PRIX SAINTE BERNADETTE',
    'PRO CASH ZONE 4', 'SOCOCE CI KAHIRA', 'MARKET 7 DECEMBRE', 'CASINO MANDARINE BIETRY', 'CASH U 7 DECEMBRE', 'AUCHAN 7 DECEMBRE',
    'CASINO KOUMASSI', 'AUCHAN INCHALLAH', 'BON PRIX INCHALLAH', 'KING CASH REMBLAIS', 'KING CASH PORT BOUET'] },
  { poste: 'abidjan3', nom: 'KONAN AMENAN NADEGE', region: 'MODERN TRADE', magasins: [
    'BON PRIX NIANGON', 'BON PRIX TOIT ROUGE', 'BON PRIX 220 LGT LIBERTE', 'BON PRIX UTB', 'BON PRIX RENAULT', 'BON PRIX ADJAME MOSQUEE',
    'BON PRIX ATTECOUBE', 'SUPECO TOIT ROUGE', 'CASH U TOIT ROUGE', 'CDCI NIANGON', 'CDCI EBENEZER', 'PRO CASH YOPOUGON', 'CASH U SANGUIDIBA',
    'AUCHAN COMPLEXE', 'SOCOCE BEL AIR', 'SUPECO NIANGON', 'KING CASH PALAIS', 'CDCI TOIT ROUGE', 'BON PRIX ABOBODOUME'] },
  { poste: 'abidjan4', nom: 'YAGO STEPHANE MARC HENRI', region: 'MODERN TRADE', magasins: [
    'COSMOS', 'SUPECO 47', 'BON PRIX CANAL', 'SOCOCE CI SOGEPHIA', 'SUPECO CITE VERTE', 'BON PRIX GESCO', 'CASH U ANANERAIE ANTENNE',
    'CASH U MAROC ANTENNE', 'BON PRIX ACADEMIE', 'BON PRIX WAKOUBOUE', 'KING CASH WAKOUBOUE', 'BON PRIX GABRIEL GARE', 'CDCI ANANERAIE',
    'KING CASH LES PRINCES', 'KING CASH SIPOREX', 'BON PRIX ANDOKOI'] },
  { poste: 'abidjan5', nom: 'FOFANA FLANI MARIAM', region: 'MODERN TRADE', magasins: [
    'HYPER U SOCOCE II PLATEAUX', 'COCO MARKET II PLATEAUX', 'CASINO II PLATEAUX', 'SUPER U VALLON', 'MARKET II PLATEAUX VALLON',
    'S2P RUE DES JARDINS', 'SOCOCE CI II PLATEAUX', 'AUCHAN PLAZA', 'CASH U II PLATEAUX OPERA', 'CASINO MANDARINE 22EME',
    'KING CASH LES OSCARS', 'KING CASH II PLATEAUX', 'CASH IVOIRE DOKUI', 'KING CASH DOKUI', 'COCO MARKET DOKUI'] },
  { poste: 'abidjan6', nom: 'MAFIA CAROLLE MURIELLE', region: 'MODERN TRADE', magasins: [
    'CASH U COCODY', 'MONOPRIX', 'BON PRIX BLOCKHAUSS', 'BON PRIX GOLF', 'CASINO MANDARINE GOLF', 'CDCI ANONO', 'CAP NORD', 'CDCI RIVIERA 3',
    'S2P MALL', 'MARKET RIVIERA 3', "AUCHAN M'POUTO", 'CASINO RIVIERA 4', 'SOCOPRIX PALMERAIE', 'COCO MARKET CIAD', 'BON PRIX PALMERAIE',
    'KING CASH PALMERAIE', 'IVOIRE CENTER PALMERAIE', 'CDCI KOUTE', 'SOCOCE KOUTE', "CASINO M'BADON", 'AUCHAN ATTOBAN'] },
  { poste: 'abidjan7', nom: "KOUAKOU N'DA ADJOUA JULIETTE", region: 'MODERN TRADE', magasins: [
    'BON PRIX FAYA', 'AUCHAN ABATTA', 'PLAYCE PALMERAIE', 'KOKOH MALL', 'CASH U BESSIKOI', 'SOCOCE CI ANGRE', 'CASH U 81/82', 'AUCHAN DJIBI',
    'SUPER U DJIBI', 'IVOIRE CENTER FAYA', 'CASH U 8E TRANCHE', 'CDCI ANGRE', 'BON PRIX ANGRE', 'BON PRIX BINGERVILLE', 'BON PRIX BINGERVILLE GARE',
    'AUCHAN BINGERVILLE', 'SOCOCE CI BINGERVILLE', 'COCO MARKET ANGRE', 'KING CASH PETRO IVOIRE'] },
  { poste: 'abidjan8', nom: "KOIME N'GUESSAN ANNE MARIE AIME EPSE KONATE", region: 'MODERN TRADE', magasins: [
    'BON PRIX ABOBOTE', 'BON PRIX ABOBO BAOULE', 'SUPECO ABOBOTE', 'PRO CASH ABOBO BAOULE', 'IVOIRE CENTER ABOBO BAOULE', 'SOCOCE CI ABOBOTE',
    'S2P SAMAKE', 'IVOIRE CENTER ABOBO GARE', 'BON PRIX ABOBO ETOILE', 'BON PRIX PK 18', "SOCOCE CI N'DOTRE", 'SOCOCE CI AKEIKOI',
    'SOCOCE CI ABOBO ETOILE', 'S2P CHATEAU', 'AUCHAN SAMAKE', 'BON PRIX GONZAGUEVILLE', 'COCO MARKET GONZAGUEVILLE', 'BON PRIX SAMAKE', 'SOCOCE ANANI'] },
  { poste: 'upc9', nom: 'YAO WOTHEYE EVELYNE EPSE BAKAYOKO', region: 'CNE', parVille: true, magasins: [
    'BON PRIX YAMOUSSOUKRO', 'SOCOCE YAMOUSSOUKRO', 'PRO CASH YAMOUSSOUKRO', 'AUCHAN YAMOUSSOUKRO', 'KING CASH YAMOUSSOUKRO',
    'BON PRIX DOUCOUBA BOUAKE', 'BON PRIX BOUAKE', 'SOCOCE BOUAKE', 'PRO CASH BOUAKE', 'SOCOCE SUPERETTE BOUAKE', 'AUCHAN BOUAKE', 'CDCI BOUAKE',
    'BON PRIX TOUMODI', 'KING CASH TOUMODI', 'CDCI TOUMODI', 'SOCOCE CI TOUMODI'] },
  { poste: 'upc10', nom: 'KOUASSI MARLENE', region: 'CNO', parVille: true, magasins: [
    'BON PRIX SAN PEDRO', 'BON PRIX SAN PEDRO ZONE IND', 'SOCOCE SAN PEDRO', 'SOCOCE DEMI GROS SAN PEDRO', 'CDCI DEMI GROS SAN PEDRO',
    'KING CASH SAN PEDRO', 'BON PRIX GAGNOA', 'SOCOCE DEMI GROS GAGNOA', 'S2P GAGNOA', 'KING CASH GAGNOA', 'SOCOCE SOUBRE', 'BON PRIX SOUBRE', 'CDCI SOUBRE'] },
]

// ── Rapprochement magasin → PDV Modern Trade (pour la commune seulement) ────
// Enseignes écrites de plusieurs façons dans la base.
const SYNONYMES = [
  [/\bDEUX\b|\bII\b/g, '2'], [/\bPLATEAUX\b/g, 'PLATEAU'], [/\bCARREFOUR\b/g, ''], [/\bSOCOCE CI\b/g, 'SOCOCE'],
  [/\bBLVD\b|\bBD\b/g, 'BOULEVARD'], [/\b(\d+) ?E(ME|IEME)?\b/g, '$1'], [/\bBLOCKHAUSS?\b|\bBLOCKOSS\b/g, 'BLOCKHAUS'],
  [/\bMARDEILLE\b/g, 'MARSEILLE'], [/\bANNERAIE\b|\bANANERAIE\b/g, 'ANANERAIE'], [/\bSANGUIDIBA\b|\bSAGUIDIBA\b/g, 'SAGUIDIBA'],
  [/\bSOGEPHIA\b|\bSOGEFIA\b|\bSOGEFHIA\b/g, 'SOGEPHIA'], [/\bINCHALLA\b/g, 'INCHALLAH'], [/\bMPOUTO\b/g, 'M POUTO'],
]
const ENSEIGNES = ['BON PRIX', 'CASH U', 'CASH IVOIRE', 'AUCHAN', 'SOCOCE', 'S2P', 'KING CASH', 'CDCI', 'SUPECO', 'CASINO', 'SUPER U', 'HYPER U',
  'PLAYCE', 'PRO CASH', 'COCO MARKET', 'SOCOPRIX', 'IVOIRE CENTER', 'MONOPRIX', 'COSMOS', 'HAYAT', 'PRIMA', 'CAP NORD', 'KOKOH', 'MARKET']
// Villes sans commune dans la base : leurs PDV sont rattachés à une autre commune.
const VILLES_HORS_BASE = { TOUMODI: 'YAMOUSSOUKRO' }
const VIDES = new Set(['CI', 'DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'ZONE', 'ANTENNE', 'SUPERMARCHE', 'SUPERMARKET', 'GROS', 'DEMI', 'ET', 'MANDARINE'])

function texteMagasin(s) {
  let t = norm(s).replace(/[^A-Z0-9 ]/g, ' ')
  for (const [re, par] of SYNONYMES) t = t.replace(re, par)
  return t.replace(/\s+/g, ' ').trim()
}
const enseigne = t => ENSEIGNES.find(e => (` ${t} `).includes(` ${e} `)) || null
const lieux = (t, e) => (e ? (` ${t} `).replace(` ${e} `, ' ') : t).split(' ').filter(w => w && !VIDES.has(w))

/**
 * PDV MT de la base pour un magasin de la fiche : même enseigne et tous les
 * mots du lieu, cherchés dans le nom, la commune et le quartier du PDV (à
 * l'intérieur, la base écrit souvent « Bon prix » et la ville est la commune).
 * Un nom identique l'emporte sur les noms qui le contiennent (« KING CASH
 * PORT BOUET » plutôt que « KING CASH PORT BOUET 2 »).
 */
function pdvDuMagasin(magasin, pdvs) {
  const t = texteMagasin(magasin)
  const e = enseigne(t)
  const motsLieu = lieux(t, e)
  const cands = pdvs.filter((p) => {
    if (e && p.enseigne !== e) return false
    if (!motsLieu.length) return p.texte === t
    return motsLieu.every(w => p.mots.has(w))
  })
  const identiques = cands.filter(p => p.texte === t)
  return identiques.length ? identiques : cands
}

async function findAuthUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const u = data.users.find(x => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 1000) return null
  }
}

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== SIMULATION (ajouter --apply pour écrire) ===')
  if (APPLY && !PASSWORD) throw new Error('Mot de passe requis : --password=... ou SEED_DEFAULT_PASSWORD')

  // ── Lecture ────────────────────────────────────────────────────────────────
  const { data: agence, error: eAg } = await supabase.from('agence').select('code, nom, direction, programme').eq('code', AGENCE.code).maybeSingle()
  if (eAg) throw eAg
  console.log(agence ? `Agence ${AGENCE.code} : existe déjà (« ${agence.nom} »)` : `Agence ${AGENCE.code} : création (« ${AGENCE.nom} », direction MT, sans programme)`)

  const profils = await toutesLesLignes(() => supabase.from('profiles').select('id, email, nom, role, employeur, is_active').order('id'))
  const aliases = await chargerAlias(supabase)
  const mt = (await toutesLesLignes(() => supabase.from('pdv').select('pdv_id, nom_pdv, zone, quartier, region')
    .eq('canal', 'Modern trade').eq('is_active', true).order('pdv_id')))
    .filter(p => p.zone)
    .map((p) => {
      const texte = texteMagasin(p.nom_pdv)
      const e = enseigne(texte)
      return { ...p, texte, enseigne: e, mots: new Set([...lieux(texte, e), ...lieux(texteMagasin(`${p.zone} ${p.quartier || ''}`), null)]) }
    })
  console.log(`PDV Modern Trade actifs : ${mt.length}`)
  // Communes de la base (mots hors numéro : BOUAKE 1 → BOUAKE) pour le repli par ville.
  const zonesMt = [...new Set(mt.map(p => p.zone))].map(zone => ({ zone, mots: texteMagasin(zone).split(' ').filter(w => !/^\d+$/.test(w)) }))

  const plan = []
  const bloquants = []
  for (const p of POSTES) {
    const email = `helloevent.${p.poste}@${DOMAINE}`
    // 1. E-mail générique déjà pris ; 2. nom ; 3. alias de merchandiser.
    let existant = profils.find(x => x.email?.toLowerCase() === email) || null
    let certitude = existant ? 'e-mail' : null
    if (!existant) {
      const r = trouverPersonne(p.nom, profils, { noms: x => [x.nom].filter(Boolean) })
      if (r.trouve && r.certitude === 'exact') { existant = r.trouve; certitude = 'nom identique' }
      else if (r.trouve) bloquants.push(`${p.nom} : rapproché de ${r.trouve.nom} <${r.trouve.email}> sans certitude, à trancher`)
      else if (r.candidats.length) console.log(`  (${p.nom} : homonymes partiels distincts : ${r.candidats.map(c => c.nom).join(', ')})`)
    }
    if (!existant) {
      const cible = resoudreAlias(p.nom, aliases, 'merchandiser')
      const viaAlias = cible && profils.find(x => x.email?.toLowerCase() === cible.toLowerCase())
      if (viaAlias) { existant = viaAlias; certitude = 'alias' }
    }

    // Communes : zones des PDV MT retrouvés pour les magasins de la fiche.
    const votes = new Map()
    const regions = new Map()
    const introuvables = []
    for (const m of p.magasins) {
      const cands = pdvDuMagasin(m, mt)
      if (!cands.length) {
        introuvables.push(m)
        // Intérieur : la base nomme rarement l'enseigne (« SuperMarket », « Aziz
        // market »). La ville du magasin donne la commune (« BOUAKE » → BOUAKE 1
        // et BOUAKE 2). Toumodi n'est pas une commune de la base : ses PDV sont
        // rattachés à YAMOUSSOUKRO.
        if (p.parVille) {
          const t = texteMagasin(m)
          const motsLieu = new Set(lieux(t, enseigne(t)).map(w => VILLES_HORS_BASE[w] || w))
          for (const z of zonesMt) {
            if (z.mots.length && z.mots.every(w => motsLieu.has(w))) votes.set(z.zone, (votes.get(z.zone) || 0) + 1)
          }
        }
        continue
      }
      for (const z of new Set(cands.map(c => c.zone))) votes.set(z, (votes.get(z) || 0) + 1)
      for (const c of cands) if (c.region) regions.set(c.region, (regions.get(c.region) || 0) + 1)
    }
    const territoires = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([z]) => z)
    if (!territoires.length) bloquants.push(`${p.nom} : aucune commune trouvée pour ses magasins`)
    plan.push({ ...p, email, existant, certitude, territoires, votes, introuvables })
  }

  // ── Rapport ────────────────────────────────────────────────────────────────
  for (const x of plan) {
    console.log(`\n${x.poste.padEnd(9)} ${x.nom}`)
    console.log(x.existant
      ? `  compte existant (${x.certitude}) : ${x.existant.email}, rôle ${x.existant.role}, employeur ${x.existant.employeur}`
      : `  compte absent → création ${x.email}`)
    console.log(`  communes : ${x.territoires.map(z => `${z} (${x.votes.get(z)})`).join(', ') || '—'} ; région ${x.region}`)
    console.log(`  magasins retrouvés : ${x.magasins.length - x.introuvables.length}/${x.magasins.length}${x.introuvables.length ? ` ; absents de la base : ${x.introuvables.join(' ; ')}` : ''}`)
  }
  if (bloquants.length) {
    console.log('\nBLOQUANTS :')
    for (const b of bloquants) console.log(`  - ${b}`)
    process.exitCode = 1
    return
  }

  const csv = csvTexte(['poste', 'nom', 'email', 'agence', 'communes', 'compte'], plan.map(x => [
    x.poste, x.nom, x.existant?.email || x.email, AGENCE.nom, x.territoires.join(' | '), x.existant ? 'existant' : 'créé',
  ]))
  if (!APPLY) {
    console.log('\nSIMULATION : aucune écriture.')
    return
  }

  // ── Écritures ──────────────────────────────────────────────────────────────
  if (!agence) {
    const { error } = await supabase.from('agence').insert(AGENCE)
    if (error) throw error
    console.log(`  ✓ agence ${AGENCE.code}`)
  }
  for (const x of plan) {
    let id = x.existant?.id
    if (!id) {
      const deja = await findAuthUser(x.email)
      if (deja) id = deja.id
      else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: x.email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { nom: x.nom, role: 'merchandiser', must_change_password: true },
        })
        if (error) throw error
        id = data.user.id
        console.log(`  ✓ compte ${x.email}`)
      }
    }
    // La ligne profiles est créée par le trigger handle_new_user : upsert au cas où.
    const { error } = await supabase.from('profiles').upsert({
      id,
      email: x.existant?.email || x.email,
      nom: x.nom,
      role: 'merchandiser',
      employeur: AGENCE.code,
      direction: 'mt',
      is_active: true,
      commercial_id: null,
      territoires_assignes: x.territoires,
      zone_assignee: x.territoires[0],
      quartiers_assignes: [],
      region: x.region,
    }, { onConflict: 'id' })
    if (error) throw error
    console.log(`  ✓ profil ${x.nom}`)
  }
  writeFileSync(SORTIE, `﻿${csv}`)
  console.log(`\nTerminé. Liste des comptes (sans mot de passe) : ${SORTIE}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
