// utils/supabaseErrors.ts
// Distingue une base SATURÉE d'une base MAL MIGRÉE.
//
// Le 24 sept. 2026 en production, PostgREST renvoyait des 504 « upstream
// request timeout » et Postgres « canceling statement due to statement
// timeout » (code 57014) sur toutes les requêtes en attente, y compris la
// liste des PDV. Le front concluait « vues SQL manquantes, lance les
// migrations » — faux, et l'admin cherchait un problème de schéma alors que
// la base manquait de CPU. Ces helpers permettent d'afficher le bon message.

type AnyError = { message?: unknown; code?: unknown; status?: unknown; details?: unknown } | string | null | undefined

/** Vrai si l'erreur est un dépassement de délai (PostgREST, Postgres ou réseau). */
export function isTimeoutError(err: AnyError): boolean {
  if (!err) return false
  if (typeof err === 'string') return /timeout|timed out|délai/i.test(err)
  const code = String(err.code ?? '')
  const status = Number(err.status ?? 0)
  const text = `${err.message ?? ''} ${err.details ?? ''}`
  return code === '57014'
    || status === 504 || status === 408
    || /timeout|timed out/i.test(text)
}

/** Vrai si l'objet (vue, table, RPC) n'existe pas côté Postgres : migration manquante. */
export function isMissingObjectError(err: AnyError): boolean {
  if (!err || typeof err === 'string') return false
  const code = String(err.code ?? '')
  const text = String(err.message ?? '')
  return code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205'
    || /does not exist|not find|schema cache/i.test(text)
}

/** Message utilisateur adapté à la cause. */
export function describeSupabaseError(err: AnyError, fallback = 'Erreur inattendue.'): string {
  if (isTimeoutError(err)) {
    return 'Le serveur met trop de temps à répondre (délai dépassé). Réessayez dans quelques instants.'
  }
  if (isMissingObjectError(err)) {
    console.error('[erreur] objet SQL manquant (migration supabase/nouveau à appliquer ?)', err)
    return 'Cet écran n\'est pas encore disponible sur le serveur. Prévenez l\'administrateur technique.'
  }
  if (typeof err === 'string') return err || fallback
  return String(err?.message || fallback)
}

/**
 * Message à afficher à un utilisateur non technique, quelle que soit l'erreur
 * (Supabase, PostgREST, $fetch vers nos routes /api, réseau). Jamais de code
 * SQL, de nom de table ni de consigne de migration : le détail part dans la
 * console pour l'équipe technique.
 *
 * Nos routes /api renvoient déjà un message rédigé en français (apiError) :
 * il est repris tel quel.
 */
export function messageUtilisateur(err: unknown, fallback = 'L\'opération n\'a pas abouti. Réessayez ; si le problème continue, prévenez l\'administrateur.'): string {
  if (err) console.error('[erreur]', err)
  if (!err) return fallback
  if (typeof err === 'string') return err || fallback
  const e = err as Record<string, any>

  const messageApi = e.data?.message ?? e.data?.statusMessage
  if (typeof messageApi === 'string' && messageApi.trim() && !estTexteTechnique(messageApi)) return messageApi

  if (estErreurReseau(e)) return 'Pas de connexion au serveur. Vérifiez la connexion internet puis réessayez.'
  if (isTimeoutError(e as AnyError)) return 'Le serveur met trop de temps à répondre. Réessayez dans quelques instants.'

  const code = String(e.code ?? '')
  const status = Number(e.status ?? e.statusCode ?? 0)
  if (code === 'PGRST301' || status === 401 || /jwt|session/i.test(String(e.message ?? ''))) {
    return 'Votre session a expiré. Reconnectez-vous puis recommencez.'
  }
  if (code === '42501' || status === 403 || /permission denied|row-level security/i.test(String(e.message ?? ''))) {
    return 'Vous n\'avez pas les droits pour cette action.'
  }
  if (code === '23505') return 'Cet élément existe déjà.'
  if (code === '23503') return 'Impossible : cet élément est encore utilisé ailleurs (visites, tournées, utilisateurs…).'
  if (code === '23502') return 'Un champ obligatoire est vide.'
  if (code === '23514' || code === '22P02' || code === '22007') return 'Une valeur saisie n\'est pas acceptée. Vérifiez le formulaire.'
  if (isMissingObjectError(e as AnyError)) {
    return 'Cet écran n\'est pas encore disponible sur le serveur. Prévenez l\'administrateur technique.'
  }

  const message = String(e.message ?? '')
  if (message && !estTexteTechnique(message)) return message
  return fallback
}

/** Vrai pour un message destiné aux développeurs (anglais technique, SQL, codes). */
function estTexteTechnique(message: string): boolean {
  return /\b(sql|relation|column|constraint|violates|function|schema|rpc|postgres|pgrst|uuid|syntax|null value|duplicate key|fetch|undefined|migration)\b/i.test(message)
    || /^[A-Za-z]+Error\b/.test(message)
}

/**
 * Vrai si l'appel n'a pas atteint le serveur (réseau coupé) : supabase-js
 * renvoie alors une erreur à message « Failed to fetch » (Chrome/WebView),
 * « Load failed » (Safari) ou « Network request failed », sans code HTTP.
 */
export function estErreurReseau(error: any): boolean {
  return !error?.code && /failed to fetch|load failed|network ?request failed|networkerror/i.test(String(error?.message || ''))
}
