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
 * Aucune dépendance Node : module partagé serveur / tests.
 */

/** Imports ouverts aux comptes agence. */
export const IMPORTS_AGENCE = ['routing-mensuel']

export class HorsAgence extends Error {}

const hors = (message) => { throw new HorsAgence(message) }

/** Ce qu'une opération touche ; null = type non ouvert aux agences. */
export function cibleOperation(op) {
  switch (op?.type) {
    case 'routing_mensuel.remplacer':
    case 'regles_mensuelles.remplacer':
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
