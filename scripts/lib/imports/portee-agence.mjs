/**
 * Portée d'un compte « agence » (responsable du routing d'une agence, ex.
 * Atom BTL) sur les imports terrain.
 *
 * La route /api/admin/imports/[type]/appliquer écrit avec la clé
 * service_role, qui ignore les droits de la base : pour un compte agence,
 * chaque opération est donc vérifiée ICI, juste avant d'être exécutée (l'état
 * de la base à cet instant compte : un SSF créé ou un routing écrit par une
 * opération précédente du même import est pris en compte).
 *
 * Une agence ne touche qu'à ses merchandisers (profiles.employeur = son code) :
 * leur routing mensuel, leurs règles, leur périmètre, leurs tournées, et les
 * SSF de leur routing. Le commercial d'un SSF n'est jamais changé : il n'est
 * posé que s'il manque, comme le fait la simulation.
 *
 * Liste de PDV par jour (14/10/2026) : une agence crée des PDV et en
 * complète le téléphone, seulement dans les zones du périmètre de ses
 * merchandisers ; elle ne supprime que les PDV d'un import « liste de PDV »
 * de ces zones (annulation d'un lot).
 *
 * Aucune dépendance Node : module partagé serveur / tests.
 */
import { norm } from '../commun.mjs'

/** Imports ouverts aux comptes agence. */
export const IMPORTS_AGENCE = ['routing-mensuel', 'liste-pdv']
const MARQUEUR_LISTE = 'import-liste-pdv-'

export class HorsAgence extends Error {}

const hors = (message) => { throw new HorsAgence(message) }

/** Ce qu'une opération touche ; null = type non ouvert aux agences. */
export function cibleOperation(op) {
  switch (op?.type) {
    case 'routing_mensuel.remplacer':
    case 'regles_mensuelles.remplacer':
    case 'regles_liste.remplacer':
    case 'profil.perimetre':
    case 'tournees.recalculer':
      return { merchandiser: op.user_id }
    case 'regle.jours':
      return { regle: op.template_id }
    case 'ssf_quartier.remplacer':
    case 'ssf.commercial':
      return { ssf: op.ssf }
    case 'ssf.creer':
      return {}
    case 'pdv.creer':
      return { zones: (op.lignes || []).map(l => l?.zone ?? null) }
    case 'pdv.maj':
      return { pdv: (op.lignes || []).map(l => l?.pdv_id), seulement: ['telephone'] }
    case 'pdv.supprimer':
      return { pdv: op.pdv_ids || [], marqueur: MARQUEUR_LISTE }
    default:
      return null
  }
}

async function lire(requete, quoi) {
  const { data, error } = await requete
  if (error) throw new Error(`${quoi} : ${error.message}`)
  return data
}

/** Merchandisers de l'agence parmi `ids`. */
async function merchandisersDeLAgence(sb, ids, agence) {
  if (!ids.length) return new Set()
  const data = await lire(sb.from('profiles').select('id').in('id', ids).eq('role', 'merchandiser').eq('employeur', agence), 'profils')
  return new Set((data || []).map(p => p.id))
}

/** Zones du périmètre des merchandisers de l'agence (noms comparables, alias de territoire compris). */
async function zonesDeLAgence(sb, agence) {
  const merch = await lire(sb.from('profiles').select('territoires_assignes,zone_assignee').eq('role', 'merchandiser').eq('employeur', agence), 'profils')
  const noms = [...new Set((merch || []).flatMap(m => [...(Array.isArray(m.territoires_assignes) ? m.territoires_assignes : []), m.zone_assignee]).filter(Boolean))]
  const zones = new Set(noms.map(norm))
  try {
    const { data, error } = await sb.rpc('territoires_etendus', { p_noms: noms })
    if (!error && Array.isArray(data)) for (const x of data) zones.add(norm(typeof x === 'string' ? x : x?.territoires_etendus))
  }
  catch { /* fonction absente : noms tels quels */ }
  return zones
}

async function ssfDe(sb, ref) {
  const requete = sb.from('ssf').select('id,nom,commercial_id')
  const data = await lire(ref?.id ? requete.eq('id', ref.id) : requete.eq('nom', ref?.nom ?? '').order('id').limit(1), 'SSF')
  return data?.[0] || null
}

/**
 * Lève HorsAgence si l'opération sort de l'agence `agence` (code d'agence).
 * `sb` : client service_role.
 */
export async function verifierPorteeAgence(sb, op, agence) {
  if (!agence) hors('agence inconnue')
  const cible = cibleOperation(op)
  if (!cible) hors(`opération « ${op?.type} » réservée aux administrateurs`)

  if (cible.merchandiser) {
    const ok = await merchandisersDeLAgence(sb, [cible.merchandiser], agence)
    if (!ok.size) hors('merchandiser hors de votre agence')
  }

  if (cible.regle) {
    const data = await lire(sb.from('routing_templates').select('user_id').eq('id', cible.regle).limit(1), 'règle')
    const userId = data?.[0]?.user_id
    if (!userId || !(await merchandisersDeLAgence(sb, [userId], agence)).size) hors('règle hors de votre agence')
  }

  if (cible.zones) {
    const zones = await zonesDeLAgence(sb, agence)
    const dehors = [...new Set(cible.zones.filter(z => !zones.has(norm(z))))]
    if (!cible.zones.length || dehors.length) hors(`PDV hors des zones de votre agence : ${dehors.map(z => z ?? 'sans zone').join(', ') || 'aucune ligne'}`)
  }

  if (cible.pdv) {
    if (cible.seulement && !(op.lignes || []).every(l => Object.keys(l?.valeurs || {}).every(k => cible.seulement.includes(k)))) {
      hors(`PDV : seule la colonne ${cible.seulement.join(', ')} peut être changée par une agence`)
    }
    if (cible.marqueur && !String(op.marqueur || '').startsWith(cible.marqueur)) hors('PDV : seuls ceux d’une liste de PDV peuvent être supprimés par une agence')
    const ids = [...new Set(cible.pdv.filter(Boolean))]
    if (ids.length) {
      const pdvs = []
      for (let i = 0; i < ids.length; i += 200) pdvs.push(...(await lire(sb.from('pdv').select('pdv_id,zone').in('pdv_id', ids.slice(i, i + 200)), 'PDV') || []))
      const zones = await zonesDeLAgence(sb, agence)
      // Un PDV déjà supprimé (relance d'une annulation) n'est plus là : rien à vérifier pour lui.
      const dehors = pdvs.filter(p => !zones.has(norm(p.zone)))
      if (dehors.length) hors(`PDV hors des zones de votre agence : ${dehors.slice(0, 5).map(p => p.pdv_id).join(', ')}`)
    }
  }

  if (cible.ssf) {
    const ssf = await ssfDe(sb, cible.ssf)
    if (!ssf) hors(`SSF introuvable : ${cible.ssf?.nom || cible.ssf?.id}`)
    // Le SSF doit figurer dans le routing mensuel d'un merchandiser de l'agence.
    const cases = await lire(sb.from('routing_mensuel').select('merchandiser_id').eq('ssf_id', ssf.id), 'routing mensuel')
    const merch = [...new Set((cases || []).map(c => c.merchandiser_id))]
    if (!(await merchandisersDeLAgence(sb, merch, agence)).size) hors(`SSF ${ssf.nom} hors du routing de votre agence`)
    if (op.type === 'ssf.commercial' && op.commercial_id != null && ssf.commercial_id && ssf.commercial_id !== op.commercial_id) {
      hors(`SSF ${ssf.nom} : son commercial se change chez FrieslandCampina`)
    }
  }
}
