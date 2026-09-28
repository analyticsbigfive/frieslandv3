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
    return 'La base de données a mis trop de temps à répondre (délai dépassé). Réessaie dans quelques secondes.'
  }
  if (isMissingObjectError(err)) {
    return 'Objet SQL manquant : lance les migrations supabase/nouveau dans Supabase.'
  }
  if (typeof err === 'string') return err || fallback
  return String(err?.message || fallback)
}
