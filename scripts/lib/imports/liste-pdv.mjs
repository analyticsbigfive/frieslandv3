/**
 * Liste de PDV par jour (fichier d'une agence, Admin › Imports terrain).
 *
 * Décision du 14/10/2026 : Atom envoie pour Treichville une liste de PDV par
 * jour de la semaine (une feuille par jour : nom, localisation, secteur,
 * contact, type), sans GPS : « la géolocalisation de ces PDV sera effectuée
 * par le merchandiser, conformément à la procédure » (geolocaliser_pdv, à la
 * première visite). La liste s'AJOUTE au routing du merchandiser : toute la
 * liste du jour, chaque semaine (règle en mode périmètre), en plus de sa case
 * du routing mensuel. Import ouvert à l'admin et aux comptes agence (pour
 * leurs merchandisers : portee-agence.mjs).
 *
 * Fichier accepté :
 *   - classeur à une feuille par jour (nom de la feuille = jour ; une feuille
 *     sans jour, ex. « autres », donne des PDV créés mais non planifiés) ;
 *   - ou CSV / feuille unique avec une colonne « Jour ».
 * Colonnes (en-tête cherché sur chaque feuille) : Nom du PDV, Localisation
 * (ou Adresse), Type ; facultatives : Merchandiser, Zone (ou Commune),
 * Secteur (ou Quartier), Contact (ou Téléphone), Jour, Semaines. Sans colonne
 * Merchandiser, l'écran demande de le choisir.
 *
 * Semaines (réponse d'Atom du 15/10/2026 : pour alléger Gui, chaque PDV de
 * Treichville une semaine sur deux) : semaines du mois où la ligne est
 * visitée, comme le routing mensuel (« 1 et 3 », « 2 et 4 » ; vide = chaque
 * semaine). Une règle par jour et par jeu de semaines ; la 5e semaine (jours
 * 29 à 31) suit le paramètre routing_semaine_5.
 *
 * Rapprochement avec les PDV de la base, dans les zones du périmètre du
 * merchandiser (et celles du fichier) ; un PDV de la base ne sert qu'à une
 * ligne :
 *   1. nom et adresse identiques ;
 *   2. nom identique (au moins deux mots, unique dans le fichier), adresse
 *      compatible ;
 *   3. même « avenue N rue M » et même nom du gérant (premier mot du nom hors
 *      « boutique », « chez », nom de la commune…).
 * Plusieurs PDV possibles : la ligne est créée et signalée « à vérifier ».
 * Un PDV retrouvé garde ses données et son GPS ; seul un téléphone manquant
 * est ajouté. Un PDV créé : sans GPS, quartier ramené au libellé de la base
 * (« arras » → Aras, « quartier apolo » → Quartier Appolo), à défaut au
 * quartier le plus fréquent de son avenue ; zone du quartier ; type ramené
 * aux sous-catégories de la base.
 *
 * Module pur (aucune dépendance Node) : écran admin et script
 * scripts/importer-liste-pdv.mjs.
 * Sortie : { resume, rapport (markdown), csv, operations, retour, bloquants }.
 */
import { csvTexte, feuillesDepuisClasseur, feuillesDepuisCsv, motsProches, norm, nouvelIdPdv, toutesLesLignes, trouverPersonne, uniques } from '../commun.mjs'
import { PREFIXE_REGLE_LISTE } from './operations.mjs'
import { lireJours } from './ssf-sous-zones.mjs'

export const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const cleTexte = (s) => norm(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const sansDoubles = (w) => w.replace(/(.)\1+/g, '$1')
// Mots qui ne disent rien du gérant ou de l'enseigne.
const MOTS_VIDES_NOM = new Set([
  'AVENUE', 'AV', 'RUE', 'BOUTIQUE', 'SUPERETTE', 'SUPER', 'MARKET', 'SUPERMARKET', 'KIOSQUE', 'CHEZ', 'LE', 'LA', 'LES',
  'DE', 'DU', 'DES', 'ET', 'AU', 'EN', 'FACE', 'VIEUX', 'VIEILLE', 'MAMAN', 'MME', 'MR', 'BARREE', 'BARRE', 'DMG', 'PDV',
])
const MAX_PDV_REGLE = 2000

// ---------------------------------------------------------------------------
// Lecture du fichier
// ---------------------------------------------------------------------------
/** Feuilles (feuillesDepuisClasseur / feuillesDepuisCsv) → lignes de la liste. */
export function lireListePdv(feuilles) {
  const lignes = []
  let avecMerch = false
  for (const f of feuilles) {
    // Jour de la feuille (« mardi ») ; une feuille sans jour (« autres ») : non planifiée.
    const joursFeuille = lireJours(f.nom)
    let cols = null
    for (const { n, cellules } of f.lignes) {
      const v = (i) => (i ? String(cellules[i] ?? '').replace(/\s+/g, ' ').trim() : '')
      if (!cols) {
        const idx = {}
        cellules.forEach((c, i) => {
          const h = cleTexte(c)
          if (!h) return
          if (/^(MERCH|E ?MAIL|AGENT)/.test(h) && !idx.merch) idx.merch = i
          else if (/^(NOM|ENSEIGNE|POINT DE VENTE|PDV$)/.test(h) && !idx.nom) idx.nom = i
          else if (/^(LOCALISATION|ADRESSE|ADRESSAGE|EMPLACEMENT|SITUATION)/.test(h) && !idx.adresse) idx.adresse = i
          else if (/^(SECTEUR|QUARTIER)/.test(h) && !idx.quartier) idx.quartier = i
          else if (/^(ZONE|COMMUNE|TERRITOIRE)/.test(h) && !idx.zone) idx.zone = i
          else if (/^(CONTACT|TEL|TELEPHONE|NUMERO|PORTABLE)/.test(h) && !idx.contact) idx.contact = i
          else if (/^(TYPE|CATEGORIE|SOUS CATEGORIE|CANAL)/.test(h) && !idx.type) idx.type = i
          else if (/^JOUR/.test(h) && !idx.jour) idx.jour = i
          else if (/^SEMAINE/.test(h) && !idx.semaines) idx.semaines = i
        })
        if (idx.nom && (idx.adresse || idx.type)) cols = idx
        continue
      }
      const nom = v(cols.nom)
      // En-tête répété plus bas dans la feuille : ignoré.
      if (!nom || /^NOM( DU)? (PDV|POINT)/.test(cleTexte(nom))) continue
      if (cols.merch) avecMerch = true
      const jours = cols.jour ? lireJours(v(cols.jour)) : joursFeuille
      lignes.push({
        feuille: f.nom.trim(), ligne: n, nom, adresse: v(cols.adresse), quartier: v(cols.quartier), zone: v(cols.zone),
        contact: v(cols.contact), type: v(cols.type), merch: v(cols.merch), jours,
        semaines: cols.semaines ? lireSemaines(v(cols.semaines)) : null,
      })
    }
  }
  if (!lignes.length) throw new Error('Aucune ligne lisible : il faut au moins les colonnes « Nom du PDV » et « Localisation » (ou « Type »)')
  return { lignes, avecMerch }
}

/**
 * Semaines du mois d'une ligne (1 = jours 1-7 … 5 = jours 29-31) :
 * « 1 et 3 », « S2 + S4 », « impaires » → [1, 3], « paires » → [2, 4].
 * null = chaque semaine (vide, « toutes », ou les semaines 1 à 4).
 */
export function lireSemaines(texte) {
  const t = cleTexte(texte)
  if (!t || /TOUTES|CHAQUE/.test(t)) return null
  if (/^(SEMAINES? )?IMPAIRES?$/.test(t)) return [1, 3]
  if (/^(SEMAINES? )?PAIRES?$/.test(t)) return [2, 4]
  const s = uniques((separerChiffres(t).match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 5)).sort((a, b) => a - b)
  if (!s.length) throw new Error(`Semaines « ${texte} » : écrire les semaines du mois, par exemple « 1 et 3 » ou « 2 et 4 »`)
  return [1, 2, 3, 4].every(n => s.includes(n)) ? null : s
}
const libelleSemaines = (s) => (s?.length ? `semaine${s.length > 1 ? 's' : ''} ${s.length > 1 ? `${s.slice(0, -1).join(', ')} et ${s.at(-1)}` : s[0]}` : 'chaque semaine')

export const lireListePdvExcel = (wb) => lireListePdv(feuillesDepuisClasseur(wb))
export const lireListePdvCsv = (texte, nom = 'CSV') => lireListePdv(feuillesDepuisCsv(texte, nom))

// ---------------------------------------------------------------------------
// Normalisations
// ---------------------------------------------------------------------------
const separerChiffres = (t) => t.replace(/(\d)([A-Z])/g, '$1 $2').replace(/([A-Z])(\d)/g, '$1 $2')
/** Numéro d'avenue d'une adresse (« avenue 11rue 18 » → 11) ; null sinon. */
export function avenueDe(texte) {
  const m = separerChiffres(cleTexte(texte)).match(/\bAV(?:ENUE)? (\d+)\b/)
  return m ? Number(m[1]) : null
}
/** « avenue 9 rue 15 » → « AV9 RUE15 » ; null s'il manque l'avenue ou la rue. */
export function cleAdresse(texte) {
  const t = separerChiffres(cleTexte(texte))
  const av = t.match(/\bAV(?:ENUE)? (\d+)\b/)?.[1]
  const rue = t.match(/\bRUE (\d+)\b/)?.[1]
  return av && rue ? `AV${Number(av)} RUE${Number(rue)}` : null
}
/** Libellé de quartier comparable : « quartier appolo » = « Quartier Appolo » = « APOLO » ; « arras » = « Aras ». */
export const cleQuartier = (s) => cleTexte(s).split(' ').filter(w => w && w !== 'QUARTIER').map(sansDoubles).join(' ')

/** Mots du nom qui désignent le gérant ou l'enseigne (hors mots vides et noms de lieux). */
function motsGerant(nom, motsLieux) {
  return cleTexte(nom).split(' ').filter(w => w.length >= 2 && !/^\d+$/.test(w) && !MOTS_VIDES_NOM.has(w) && !motsLieux.has(w))
}

/**
 * Même gérant : tous les mots du nom le plus court se retrouvent dans l'autre,
 * à une faute ou une lettre doublée près (« diallo » = « Mohamed diallo »,
 * « alassane » = « Allassane » ; « diallo idrisse » ≠ « Diallo ousmane »).
 */
export function gerantsCompatibles(a, b, { exact = false } = {}) {
  if (!a.length || !b.length) return false
  const [petit, grand] = a.length <= b.length ? [a, b] : [b, a]
  const proches = exact ? (x, y) => x === y : (x, y) => motsProches(sansDoubles(x), sansDoubles(y))
  return petit.every(w => grand.some(x => proches(w, x)))
}

/** Téléphone : 10 chiffres groupés par deux (« 07 07 19 10 22 ») ; sinon le texte nettoyé. */
export function telephoneDe(texte) {
  const brut = String(texte || '').replace(/\s+/g, ' ').trim()
  if (!brut || brut === '-') return null
  const chiffres = brut.replace(/\D/g, '')
  if (chiffres.length === 10) return chiffres.replace(/(\d{2})(?=\d)/g, '$1 ')
  return brut.slice(0, 50)
}

// Type du fichier → sous-catégorie de la base. Les libellés sont ceux des PDV
// d'Abidjan (« Superette GT » sans accent : canal_atom ne reconnaît pas « Supérette »).
const TYPES = [
  [/PORRIDGE/, 'Porridge'],
  [/ABOKI/, 'Aboki'],
  [/KIOSQ|KIOSK/, 'Kiosque'],
  [/PUSH ?CAR/, 'Pushcart'],
  [/TABLIER|TABLE TOP/, 'Tabliers'],
  [/DMG|DEMI ?GROS|AUTRE PDV/, 'Autre PDV détail (GT)'],
  [/SUPERETTE|MINI ?MARKET/, 'Superette GT'],
  [/SUPERMARCHE|SUPER ?MARKET/, 'Supermarché'],
  [/^(BOUTIQUE )?A$|BOUTIQUE A\b/, 'Boutique A'],
  [/^(BOUTIQUE )?B$|BOUTIQUE B\b/, 'Boutique B'],
  [/^(BOUTIQUE )?C$|BOUTIQUE C\b/, 'Boutique C'],
  [/BOUTIQUE/, 'Boutique C'],
]
const CONSOMMATION = new Set(['Porridge', 'Aboki', 'Kiosque', 'Pushcart'])
export function typeDe(texte) {
  const t = cleTexte(texte)
  if (!t) return { sous_categorie_pdv: 'Boutique C', reconnu: false }
  const trouve = TYPES.find(([re]) => re.test(t))
  return trouve ? { sous_categorie_pdv: trouve[1], reconnu: true } : { sous_categorie_pdv: 'Boutique C', reconnu: false }
}

const plusFrequent = (xs) => {
  const n = new Map()
  for (const x of xs) if (x) n.set(x, (n.get(x) || 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] ?? null
}
const grouper = (xs, cle) => {
  const m = new Map()
  for (const x of xs) {
    const k = cle(x)
    if (k == null || k === '') continue
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(x)
  }
  return m
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------
/** Merchandisers actifs que le compte connecté peut voir (un compte agence : les siens, par la RLS). */
export async function chargerMerchandisers(sb, { toutes = toutesLesLignes } = {}) {
  return toutes(() => sb.from('profiles').select('id,nom,email,employeur,is_active,territoires_assignes,quartiers_assignes,zone_assignee')
    .eq('role', 'merchandiser').eq('is_active', true).order('nom'))
}

/**
 * Données de la simulation : merchandiser de chaque ligne (colonne du fichier
 * ou `merchandiserId` choisi à l'écran), PDV des zones de leurs périmètres et
 * du fichier, listes déjà en place.
 */
export async function chargerDonneesListePdv(sb, lignes, { merchandiserId = null, onEtape, toutes = toutesLesLignes } = {}) {
  const etape = (m) => onEtape?.(m)
  etape('Merchandisers')
  const merchandisers = await chargerMerchandisers(sb, { toutes })
  const choisi = merchandiserId ? merchandisers.find(m => m.id === merchandiserId) : null
  if (merchandiserId && !choisi) throw new Error('Merchandiser choisi introuvable (ou hors de votre agence)')
  const merchDeLigne = new Map()
  const inconnus = new Map()
  for (const l of lignes) {
    if (!l.merch) { if (choisi) merchDeLigne.set(l, { profil: choisi, certitude: 'choisi' }); continue }
    const r = trouverPersonne(l.merch, merchandisers, { noms: p => [p.nom, p.email].filter(Boolean) })
    if (r.trouve) merchDeLigne.set(l, { profil: r.trouve, certitude: r.certitude })
    else {
      const k = norm(l.merch)
      if (!inconnus.has(k)) inconnus.set(k, { texte: l.merch, lignes: 0, pistes: r.candidats })
      inconnus.get(k).lignes++
    }
  }
  const profils = uniques([...merchDeLigne.values()].map(x => x.profil))
  const territoires = uniques(profils.flatMap(p => (p.territoires_assignes || []).length ? p.territoires_assignes : [p.zone_assignee]))
  etape('Zones')
  // Zones étendues (alias de territoire : « Marcory » = « MARCORY ») ; sans la fonction, les noms tels quels.
  let zonesPerimetre = territoires
  try {
    const { data, error } = await sb.rpc('territoires_etendus', { p_noms: territoires })
    if (!error && Array.isArray(data)) zonesPerimetre = uniques([...territoires, ...data.map(x => (typeof x === 'string' ? x : x?.territoires_etendus)).filter(Boolean)])
  }
  catch { /* fonction absente : noms tels quels */ }
  const zonesFichier = uniques(lignes.map(l => l.zone).filter(Boolean))
  etape('PDV')
  let migrationAppliquee = true
  const colonnes = 'pdv_id,nom_pdv,adressage,zone,quartier,sous_categorie_pdv,categorie_pdv,canal,distributor_name,geolocation_lat,geolocation_lng,is_active'
  const lirePdv = async (zones, avecTelephone) => {
    const out = []
    for (let i = 0; i < zones.length; i += 50) {
      out.push(...await toutes(() => sb.from('pdv').select(avecTelephone ? `${colonnes},telephone` : colonnes)
        .in('zone', zones.slice(i, i + 50)).eq('is_active', true).order('pdv_id')))
    }
    return out
  }
  // Zones du fichier : écrites comme dans la base ou en majuscules.
  const zones = uniques([...zonesPerimetre, ...zonesFichier, ...zonesFichier.map(z => norm(z))])
  let pdvs
  try { pdvs = await lirePdv(zones, true) }
  catch { migrationAppliquee = false; pdvs = await lirePdv(zones, false) }
  etape('Listes en place')
  const ids = profils.map(p => p.id)
  const regles = ids.length
    ? await toutes(() => sb.from('routing_templates').select('id,user_id,label,territoire,days_of_week,day_of_week,semaines_du_mois,date_debut,notes,is_active')
      .in('user_id', ids).like('label', `${PREFIXE_REGLE_LISTE}%`).order('id'))
    : []
  const reglesPdv = []
  for (let i = 0; i < regles.length; i += 50) {
    reglesPdv.push(...await toutes(() => sb.from('routing_template_pdv').select('template_id,pdv_id,position_order')
      .in('template_id', regles.slice(i, i + 50).map(r => r.id)).order('id')))
  }
  // Identifiants pris : ceux des PDV chargés ; un identifiant de 8 caractères
  // aléatoires hors périmètre déjà pris est improbable, et pdv.creer ignore un doublon.
  return { merchDeLigne, inconnus, profils, zonesPerimetre, pdvs, regles, reglesPdv, migrationAppliquee }
}

// ---------------------------------------------------------------------------
// Rapprochement
// ---------------------------------------------------------------------------
/**
 * Ligne du fichier → PDV de la base (au plus une ligne par PDV). Renvoie, par
 * ligne, { pdv, niveau } ou { pistes } (plusieurs PDV possibles).
 */
export function rapprocher(lignes, pdvs, { motsLieux = new Set() } = {}) {
  const res = new Map(lignes.map(l => [l, { pdv: null, niveau: null, pistes: [] }]))
  const pris = new Set()
  const cleDe = (p) => cleAdresse(p.adressage) || cleAdresse(p.nom_pdv)
  const parNom = grouper(pdvs, p => cleTexte(p.nom_pdv))
  const parCle = grouper(pdvs, cleDe)
  const nbNomFichier = new Map()
  for (const l of lignes) nbNomFichier.set(cleTexte(l.nom), (nbNomFichier.get(cleTexte(l.nom)) || 0) + 1)
  // Même PDV deux fois dans le fichier (même nom, même adresse, même type) : une
  // seule ligne le rapproche, l'autre la suit. Une boutique et un kiosque « diallo »
  // à la même adresse restent deux PDV.
  const premiere = new Map()
  const aTraiter = []
  for (const l of lignes) {
    const k = `${cleTexte(l.nom)}|${cleTexte(l.adresse)}|${typeDe(l.type).sous_categorie_pdv}`
    if (premiere.has(k)) res.get(l).meme = premiere.get(k)
    else { premiere.set(k, l); aTraiter.push(l) }
  }
  const libres = (ps) => ps.filter(p => !pris.has(p.pdv_id))
  const attribuer = (l, p, niveau) => { Object.assign(res.get(l), { pdv: p, niveau, pistes: [] }); pris.add(p.pdv_id) }
  const niveaux = [
    // 1. Nom et adresse identiques (doublons de la base : le premier).
    ['nom et adresse', (l) => {
      if (!l.adresse) return []
      const c = libres(parNom.get(cleTexte(l.nom)) || []).filter(p => cleTexte(p.adressage) === cleTexte(l.adresse))
      return c.slice(0, 1)
    }],
    // 2. Nom identique, unique dans le fichier, adresse compatible ; un nom
    //    court (« diallo aboubacar ») seulement dans le même quartier.
    ['nom', (l) => {
      const mots = cleTexte(l.nom).split(' ')
      if (mots.length < 2 || nbNomFichier.get(cleTexte(l.nom)) > 1) return []
      const cl = cleAdresse(l.adresse)
      const ql = l.quartier ? cleQuartier(l.quartier) : null
      return libres(parNom.get(cleTexte(l.nom)) || []).filter(p => (!cl || !cleDe(p) || cleDe(p) === cl)
        && (mots.length >= 3 || (ql && p.quartier && cleQuartier(p.quartier) === ql)))
    }],
    // 3. Même avenue et rue, même nom de gérant (le nom exact d'abord).
    ['adresse et gérant', (l) => {
      const cl = cleAdresse(l.adresse) || cleAdresse(l.nom)
      if (!cl) return []
      const mots = motsGerant(l.nom, motsLieux)
      if (!mots.length) return []
      const c = libres(parCle.get(cl) || []).filter(p => gerantsCompatibles(mots, motsGerant(p.nom_pdv, motsLieux)))
      const exacts = c.filter(p => gerantsCompatibles(mots, motsGerant(p.nom_pdv, motsLieux), { exact: true }))
      return exacts.length === 1 ? exacts : c
    }],
  ]
  // Plusieurs PDV de même nom à la même adresse : un doublon de la base, on prend le premier.
  const doublonsBase = (c) => c.every(p => cleTexte(p.nom_pdv) === cleTexte(c[0].nom_pdv) && cleDe(p) === cleDe(c[0]))
  for (const [niveau, candidats] of niveaux) {
    for (const l of aTraiter) {
      const r = res.get(l)
      if (r.pdv) continue
      const c = candidats(l)
      if (c.length === 1 || (c.length > 1 && doublonsBase(c))) attribuer(l, c[0], niveau)
      else if (c.length > 1 && !r.pistes.length) r.pistes = c.slice(0, 5)
    }
  }
  return res
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
/**
 * options : { fichier, debut (date des règles), marqueur ('import-liste-pdv-…'),
 * auteurId, jours (tournées recalculées, 7 par défaut, 0 aucune), aujourdhui }.
 */
export function simulerListePdv(lignes, donnees, options = {}) {
  const fichier = options.fichier || 'liste de l’agence'
  const aujourdhui = options.aujourdhui || new Date().toISOString().slice(0, 10)
  const debut = options.debut || aujourdhui
  const marqueur = options.marqueur || `import-liste-pdv-${aujourdhui.replace(/-/g, '')}`
  const joursRecalcul = options.jours ?? 7
  const { merchDeLigne, inconnus, pdvs, regles, reglesPdv } = donnees
  const bloquants = donnees.migrationAppliquee === false
    ? ['La migration 20261014100000 (colonne téléphone des PDV) n’est pas appliquée.']
    : []
  if (!merchDeLigne.size && !inconnus.size) bloquants.push('Choisissez le merchandiser : le fichier n’a pas de colonne « Merchandiser ».')

  const operations = []
  const retour = { regles: [], maj: [], supprimer: [], perimetre: [], recalcul: [] }
  const idsPris = new Set(pdvs.map(p => p.pdv_id))
  const plannings = []

  // Libellés de la base, par clé comparable : quartier → { quartier, zone } le plus fréquent.
  const quartierParCle = new Map()
  for (const [k, ps] of grouper(pdvs, p => (p.quartier ? cleQuartier(p.quartier) : null))) {
    const quartier = plusFrequent(ps.map(p => p.quartier))
    quartierParCle.set(k, { quartier, zone: plusFrequent(ps.filter(p => p.quartier === quartier).map(p => p.zone)), n: ps.length })
  }
  const parAvenue = grouper(pdvs, p => avenueDe(p.adressage) ?? avenueDe(p.nom_pdv))
  const zoneParCle = new Map(uniques(pdvs.map(p => p.zone)).map(z => [cleTexte(z), z]))
  const typeLocal = new Map()
  for (const [sc, ps] of grouper(pdvs, p => p.sous_categorie_pdv)) {
    typeLocal.set(sc, { categorie_pdv: plusFrequent(ps.map(p => p.categorie_pdv)), canal: plusFrequent(ps.map(p => p.canal)) })
  }
  const motsLieux = new Set(uniques([...pdvs.map(p => p.zone), ...pdvs.map(p => p.quartier)]).flatMap(z => cleTexte(z).split(' ')).filter(w => w.length >= 4))
  const traductionsQuartier = new Map()
  const typesNonReconnus = new Map()

  /**
   * Quartier et zone d'une ligne à créer. `zoneListe` : zone principale des
   * PDV retrouvés de la liste, pour une adresse sans avenue ni secteur
   * (« avenue rue 18 ») ; sans zone, le PDV échappe au périmètre et à un
   * nouvel import de la même liste.
   */
  function localiser(l, zoneListe = null) {
    const av = avenueDe(l.adresse) ?? avenueDe(l.nom)
    const voisins = av != null ? (parAvenue.get(av) || []) : []
    let quartier = null
    let statutQuartier = 'vide'
    const connu = l.quartier ? quartierParCle.get(cleQuartier(l.quartier)) : null
    // Un secteur inconnu de la base est gardé tel qu'écrit par l'agence ; un
    // secteur vide prend le quartier le plus fréquent de la même avenue.
    if (connu) { quartier = connu.quartier; statutQuartier = norm(connu.quartier) === norm(l.quartier) ? 'identique' : 'rapproche' }
    else if (l.quartier) { quartier = l.quartier; statutQuartier = 'nouveau' }
    else if (voisins.length) { quartier = plusFrequent(voisins.map(p => p.quartier)); statutQuartier = 'vide-avenue' }
    if (statutQuartier !== 'identique' && (l.quartier || quartier)) {
      const k = `${l.quartier}|${quartier || ''}|${statutQuartier}`
      if (!traductionsQuartier.has(k)) traductionsQuartier.set(k, { fichier: l.quartier || '(secteur vide)', base: quartier, statut: statutQuartier, lignes: 0 })
      traductionsQuartier.get(k).lignes++
    }
    const zone = (l.zone && zoneParCle.get(cleTexte(l.zone)))
      || (quartier && quartierParCle.get(cleQuartier(quartier))?.zone)
      || plusFrequent(voisins.map(p => p.zone))
      || (l.zone ? norm(l.zone) : null)
      || zoneListe
    return { quartier, zone, distributeur: distributeurDe(zone, quartier), statutQuartier }
  }
  // Distributeur d'un PDV créé : le plus fréquent de son quartier, sinon de sa zone.
  const distributeurs = new Map()
  function distributeurDe(zone, quartier) {
    const k = `${zone}|${quartier}`
    if (!distributeurs.has(k)) {
      distributeurs.set(k, plusFrequent(pdvs.filter(p => p.zone === zone && p.quartier === quartier).map(p => p.distributor_name))
        || plusFrequent(pdvs.filter(p => p.zone === zone).map(p => p.distributor_name)))
    }
    return distributeurs.get(k)
  }

  // Lignes par merchandiser.
  const parMerch = new Map()
  for (const l of lignes) {
    const m = merchDeLigne.get(l)
    if (!m) continue
    if (!parMerch.has(m.profil.id)) parMerch.set(m.profil.id, { profil: m.profil, certitude: m.certitude, lignes: [] })
    parMerch.get(m.profil.id).lignes.push(l)
  }

  const pdvCrees = []
  const opsCreer = []
  const opsMaj = []
  const opsPerimetre = []
  const opsRegles = []
  const opsRecalcul = []
  const detail = []

  for (const { profil, certitude, lignes: siennes } of parMerch.values()) {
    const rapp = rapprocher(siennes, pdvs, { motsLieux })
    const zoneListe = plusFrequent(siennes.map(l => rapp.get(l).pdv?.zone))
    const pdvDeLigne = new Map()
    const crees = []
    const maj = []
    for (const l of siennes) {
      const r = rapp.get(l)
      if (r.meme) continue
      if (r.pdv) {
        pdvDeLigne.set(l, r.pdv)
        const tel = telephoneDe(l.contact)
        if (tel && donnees.migrationAppliquee !== false && !r.pdv.telephone) maj.push({ pdv_id: r.pdv.pdv_id, valeurs: { telephone: tel } })
        continue
      }
      const loc = localiser(l, zoneListe)
      const type = typeDe(l.type)
      if (!type.reconnu && l.type) typesNonReconnus.set(l.type, (typesNonReconnus.get(l.type) || 0) + 1)
      const local = typeLocal.get(type.sous_categorie_pdv)
      const ligne = {
        pdv_id: nouvelIdPdv(idsPris),
        nom_pdv: l.nom.slice(0, 300),
        canal: local?.canal || 'General trade',
        categorie_pdv: local?.categorie_pdv || (CONSOMMATION.has(type.sous_categorie_pdv) ? 'Point de consommation' : 'Point de vente détail'),
        sous_categorie_pdv: type.sous_categorie_pdv,
        zone: loc.zone,
        quartier: loc.quartier,
        geolocation_lat: null,
        geolocation_lng: null,
        rayon_geofence: 200,
        adressage: l.adresse || null,
        distributor_name: loc.distributeur,
        date_creation: aujourdhui,
        ajoute_par: marqueur,
        is_active: true,
        ...(donnees.migrationAppliquee !== false ? { telephone: telephoneDe(l.contact) } : {}),
      }
      const p = { ...ligne, nouveau: true, loc }
      pdvDeLigne.set(l, p)
      crees.push(ligne)
    }
    for (const l of siennes) {
      const r = rapp.get(l)
      if (r.meme) pdvDeLigne.set(l, pdvDeLigne.get(r.meme))
    }

    // Une règle par jour et par jeu de semaines (« 1 et 3 », chaque semaine…),
    // dans l'ordre du fichier ; territoire = zone principale de la liste.
    const territoire = plusFrequent(siennes.map(l => pdvDeLigne.get(l)?.zone)) || profil.territoires_assignes?.[0] || 'SANS ZONE'
    const reglesNouvelles = []
    for (let j = 0; j <= 6; j++) {
      // « * » : chaque semaine (grouper ignore une clé vide).
      const parSemaines = grouper(siennes.filter(l => l.jours.includes(j)), l => (l.semaines ? l.semaines.join(',') : '*'))
      for (const cle of [...parSemaines.keys()].sort()) {
        const duJour = parSemaines.get(cle)
        const semaines = cle === '*' ? null : cle.split(',').map(Number)
        const ids = uniques(duJour.map(l => pdvDeLigne.get(l)?.pdv_id))
        const quartiers = [...grouper(duJour, l => pdvDeLigne.get(l)?.quartier).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 2).map(([q]) => q)
        reglesNouvelles.push({
          label: `${PREFIXE_REGLE_LISTE}${JOURS[j]}${semaines ? ` (${libelleSemaines(semaines)})` : ''} — ${territoire}${quartiers.length ? ` › ${quartiers.join(' / ')}` : ''}`.slice(0, 200),
          days_of_week: [j],
          semaines_du_mois: semaines,
          date_debut: debut,
          notes: `Liste de PDV par jour, fichier « ${fichier} » (${ids.length} PDV, toute la liste ${semaines ? `les ${libelleSemaines(semaines)} du mois` : 'chaque semaine'}).`.slice(0, 4000),
          pdv_ids: ids.slice(0, MAX_PDV_REGLE),
          nouveaux: duJour.filter(l => pdvDeLigne.get(l)?.nouveau).length,
        })
      }
    }
    const nonPlanifiees = siennes.filter(l => !l.jours.length)

    // Périmètre : zones et quartiers des PDV de la liste (jamais retirés), pour
    // que le merchandiser les voie et puisse les géolocaliser.
    const terrAvant = (profil.territoires_assignes || []).length ? profil.territoires_assignes : (profil.zone_assignee ? [profil.zone_assignee] : [])
    const qAvant = profil.quartiers_assignes || []
    const etendues = new Set(donnees.zonesPerimetre.map(norm))
    const tous = uniques(siennes.map(l => pdvDeLigne.get(l)))
    const zonesManquantes = uniques(tous.map(p => p.zone)).filter(z => !etendues.has(norm(z)) && !terrAvant.some(t => norm(t) === norm(z)))
    const qManquants = qAvant.length ? uniques(tous.map(p => p.quartier)).filter(q => !qAvant.includes(q)) : []
    if (zonesManquantes.length || qManquants.length) {
      opsPerimetre.push({ type: 'profil.perimetre', user_id: profil.id, territoires_assignes: uniques([...terrAvant, ...zonesManquantes]), quartiers_assignes: qAvant.length ? uniques([...qAvant, ...qManquants]) : [] })
      retour.perimetre.push({ type: 'profil.perimetre', user_id: profil.id, territoires_assignes: profil.territoires_assignes || [], quartiers_assignes: qAvant })
    }

    for (let i = 0; i < crees.length; i += 500) opsCreer.push({ type: 'pdv.creer', lignes: crees.slice(i, i + 500) })
    for (let i = 0; i < maj.length; i += 200) opsMaj.push({ type: 'pdv.maj', lignes: maj.slice(i, i + 200) })
    if (crees.length) {
      for (let i = 0; i < crees.length; i += 500) retour.supprimer.push({ type: 'pdv.supprimer', marqueur, pdv_ids: crees.slice(i, i + 500).map(c => c.pdv_id) })
    }
    for (let i = 0; i < maj.length; i += 200) retour.maj.push({ type: 'pdv.maj', lignes: maj.slice(i, i + 200).map(x => ({ pdv_id: x.pdv_id, valeurs: { telephone: null } })) })

    opsRegles.push({ type: 'regles_liste.remplacer', user_id: profil.id, territoire, created_by: options.auteurId || null, regles: reglesNouvelles.map(({ nouveaux, ...r }) => r) })
    const avant = regles.filter(r => r.user_id === profil.id && r.territoire === territoire)
    retour.regles.push({
      type: 'regles_liste.remplacer', user_id: profil.id, territoire, created_by: options.auteurId || null,
      regles: avant.map(r => ({
        label: r.label, days_of_week: r.days_of_week || [r.day_of_week], semaines_du_mois: r.semaines_du_mois ?? null, date_debut: r.date_debut, notes: r.notes,
        pdv_ids: reglesPdv.filter(x => x.template_id === r.id).sort((a, b) => a.position_order - b.position_order).map(x => x.pdv_id),
      })).filter(r => r.days_of_week.length && r.days_of_week.every(j => j != null)),
    })
    if (joursRecalcul > 0) {
      const d0 = new Date(`${aujourdhui}T12:00:00Z`)
      const plus = n => { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
      const op = { type: 'tournees.recalculer', user_id: profil.id, debut: plus(1), fin: plus(joursRecalcul) }
      opsRecalcul.push(op)
      retour.recalcul.push(op)
    }

    for (const l of siennes) {
      const r = rapp.get(l)
      const p = pdvDeLigne.get(l)
      detail.push({ profil, l, r, p })
    }
    pdvCrees.push(...crees)
    plannings.push({ profil, certitude, territoire, regles: reglesNouvelles, nonPlanifiees, avant, crees, maj, rapp, pdvDeLigne, zonesManquantes, qManquants, lignes: siennes })
  }

  const operationsTriees = [...opsPerimetre, ...opsCreer, ...opsMaj, ...opsRegles, ...opsRecalcul]
  // Retour : règles d'avant, téléphones retirés, PDV créés supprimés (jamais un PDV visité), périmètre, tournées.
  const retourTrie = [...retour.regles, ...retour.maj, ...retour.supprimer, ...retour.perimetre, ...retour.recalcul]

  // ---- Rapport --------------------------------------------------------------
  const lignesMerch = detail.length
  const existants = detail.filter(d => d.r.pdv)
  const parNiveau = (n) => existants.filter(d => d.r.niveau === n).length
  const aVerifier = detail.filter(d => !d.r.pdv && !d.r.meme && d.r.pistes.length)
  const resume = {
    lignes: lignes.length,
    merchandisers: plannings.length,
    merchandisersInconnus: inconnus.size,
    pdvExistants: existants.length,
    pdvCrees: pdvCrees.length,
    aVerifier: aVerifier.length,
    doublonsFichier: detail.filter(d => d.r.meme).length,
    nonPlanifies: plannings.reduce((n, p) => n + p.nonPlanifiees.length, 0),
    regles: plannings.reduce((n, p) => n + p.regles.length, 0),
    telephones: plannings.reduce((n, p) => n + p.maj.length, 0) + pdvCrees.filter(c => c.telephone).length,
    operations: operationsTriees.length,
  }

  const md = []
  md.push('# Liste de PDV par jour', '')
  const alternance = lignes.some(l => l.semaines)
  md.push(`Fichier : ${fichier} — ${lignes.length} lignes. Chaque jour, le merchandiser visite toute la liste du jour${alternance ? ' prévue pour la semaine du mois (colonne « Semaines » ; sans semaine : chaque semaine)' : ', chaque semaine'}, en plus de sa case du routing mensuel. Les PDV créés n’ont pas de GPS : le merchandiser les géolocalise à sa première visite.`)
  md.push('', '## Résumé', '')
  for (const p of plannings) {
    md.push(`- Merchandiser : **${p.profil.nom || p.profil.email}** (${p.profil.email || '—'})${p.certitude === 'approche' ? ', reconnu malgré une orthographe différente' : ''}. Zone de la liste : ${p.territoire}.`)
  }
  md.push(`- PDV déjà en base : ${resume.pdvExistants} (${parNiveau('nom et adresse')} par le nom et l’adresse, ${parNiveau('nom')} par le nom, ${parNiveau('adresse et gérant')} par l’avenue, la rue et le nom du gérant). Ils gardent leurs données et leur GPS.`)
  md.push(`- PDV à créer, sans GPS : ${resume.pdvCrees}${resume.aVerifier ? `, dont ${resume.aVerifier} à vérifier (un PDV proche existe peut-être, voir plus bas)` : ''}.`)
  if (resume.doublonsFichier) md.push(`- Lignes en double dans le fichier (même nom, même adresse, même type) : ${resume.doublonsFichier}, comptées une fois.`)
  md.push(`- Téléphones : ${resume.telephones} (ajoutés aux PDV existants qui n’en avaient pas, et aux PDV créés).`)
  if (inconnus.size) {
    md.push('', '## Merchandisers non reconnus (lignes en attente)', '')
    for (const m of inconnus.values()) md.push(`- « ${m.texte} » (${m.lignes} lignes)${m.pistes.length ? ` — pistes : ${m.pistes.map(x => x.nom).join(', ')}` : ' — aucun compte proche'}.`)
  }
  for (const p of plannings) {
    md.push('', `## Tournées de ${p.profil.nom || p.profil.email}`, '')
    if (p.regles.length) {
      md.push('| Jour | Semaines du mois | Règle | PDV | dont créés |', '|---|---|---|---:|---:|')
      for (const r of p.regles) md.push(`| ${JOURS[r.days_of_week[0]]} | ${r.semaines_du_mois ? r.semaines_du_mois.join(', ') : 'toutes'} | ${r.label.slice(PREFIXE_REGLE_LISTE.length)} | ${r.pdv_ids.length} | ${r.nouveaux} |`)
      md.push('', `À partir du ${debut.split('-').reverse().join('/')}. Ces règles s’ajoutent au routing mensuel du merchandiser, qui ne change pas.${p.regles.some(r => r.semaines_du_mois) ? ' Semaines du mois : 1 = jours 1 à 7, 2 = 8 à 14, 3 = 15 à 21, 4 = 22 à 28 ; les jours 29 à 31 suivent le réglage « Routing de la 5e semaine du mois », comme le routing mensuel.' : ''}`)
    }
    if (p.nonPlanifiees.length) {
      const feuilles = uniques(p.nonPlanifiees.map(l => `« ${l.feuille} »`)).join(', ')
      md.push('', `PDV sans jour (feuille ${feuilles}) : ${p.nonPlanifiees.length}, ${p.nonPlanifiees.length > 1 ? 'mis en base mais planifiés dans aucune tournée' : 'mis en base mais planifié dans aucune tournée'}, en attendant que l’agence précise le jour.`)
    }
    if (p.avant.length) md.push('', `Listes remplacées (même merchandiser, même zone) : ${p.avant.map(r => `« ${r.label} »`).join(', ')}.`)
    if (p.zonesManquantes.length || p.qManquants.length) {
      md.push('', `Périmètre élargi, pour que le merchandiser voie ces PDV et puisse les géolocaliser : ${[...p.zonesManquantes.map(z => `zone ${z}`), ...p.qManquants.map(q => `quartier ${q}`)].join(', ')}.`)
    }
  }
  if (traductionsQuartier.size) {
    md.push('', '## Quartiers des PDV créés', '')
    const motif = { rapproche: 'même quartier, écrit autrement', nouveau: 'inconnu dans la base : gardé tel qu’écrit dans le fichier', 'vide-avenue': 'quartier le plus fréquent de la même avenue' }
    for (const t of traductionsQuartier.values()) md.push(`- ${t.fichier.startsWith('(') ? t.fichier : `« ${t.fichier} »`} → ${t.base || '(aucun)'} — ${motif[t.statut] || t.statut} (${t.lignes} ligne${t.lignes > 1 ? 's' : ''}).`)
  }
  if (typesNonReconnus.size) md.push('', `Types non reconnus, enregistrés en « Boutique C » : ${[...typesNonReconnus.entries()].map(([t, n]) => `« ${t} » (${n})`).join(', ')}.`)
  if (aVerifier.length) {
    md.push('', '## À vérifier : PDV créés alors qu’un PDV proche existe peut-être', '')
    md.push('| Feuille | Ligne | Nom | Adresse | PDV possibles dans la base |', '|---|---:|---|---|---|')
    for (const d of aVerifier) md.push(`| ${d.l.feuille} | ${d.l.ligne} | ${d.l.nom} | ${d.l.adresse || '—'} | ${d.r.pistes.map(x => `${x.nom_pdv} (${x.adressage || '—'})`).join(' ; ')} |`)
  }
  md.push('', '## Retour arrière', '', '« Annuler le lot » (Imports terrain) remet les listes d’avant, retire les téléphones ajoutés, supprime les PDV créés (sauf ceux déjà visités) et remet le périmètre d’avant.')

  const csv = {
    'liste-pdv.csv': csvTexte(['Merchandiser', 'Feuille', 'Ligne', 'Jours', 'Semaines', 'Nom', 'Adresse', 'Secteur (fichier)', 'Contact', 'Type (fichier)', 'Rapprochement', 'PDV', 'Nom en base', 'Adresse en base', 'Zone', 'Quartier', 'GPS', 'Pistes'],
      detail.map(({ profil, l, r, p }) => [
        profil.nom || profil.email, l.feuille, l.ligne, l.jours.map(j => JOURS[j]).join(' + ') || 'non planifié', l.semaines ? l.semaines.join(', ') : 'toutes', l.nom, l.adresse, l.quartier, l.contact, l.type,
        r.pdv ? `déjà en base (${r.niveau})` : r.meme ? 'doublon du fichier' : r.pistes.length ? 'créé, à vérifier' : 'créé',
        p?.pdv_id || '', r.pdv?.nom_pdv || '', r.pdv?.adressage || '', p?.zone || '', p?.quartier || '',
        p?.geolocation_lat != null ? 'oui' : 'non (à la première visite)', r.pistes.map(x => `${x.pdv_id} ${x.nom_pdv}`).join(' | '),
      ])),
  }

  return { resume, rapport: md.join('\n') + '\n', csv, operations: operationsTriees, retour: retourTrie, bloquants, plannings }
}
