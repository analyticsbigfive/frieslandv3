// utils/sessionExpiree.ts
// Session perdue sur le back-office : détection des erreurs « jeton refusé »,
// signal vers le plugin plugins/session-expiree.client.ts, et contrôle du
// chemin de retour après reconnexion (?redirect=).

/** Événement émis sur `window` quand une requête est refusée faute de session valide. */
export const EVENEMENT_SESSION_EXPIREE = 'bonnet-rouge:session-expiree'

/** Motif passé à /login pour afficher « Votre session a expiré ». */
export const MOTIF_SESSION_EXPIREE = 'session-expiree'

/**
 * Vrai si l'erreur dit que le jeton de session est refusé : PostgREST
 * (PGRST301 / PGRST302, HTTP 401) ou GoTrue (« JWT expired », « invalid JWT »).
 * Un 403 (droits insuffisants) n'en est pas un : la session est valide.
 */
export function estErreurSessionExpiree(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, any>
  const code = String(e.code ?? '')
  const status = Number(e.status ?? e.statusCode ?? 0)
  const message = String(e.message ?? '')
  return code === 'PGRST301' || code === 'PGRST302' || status === 401
    || /jwt (expired|is expired|malformed)|invalid jwt|invalid refresh token|refresh token not found/i.test(message)
}

/** Prévient le plugin (navigateur seulement). Sans effet côté serveur et en test. */
export function signalerSessionExpiree(err: unknown): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new CustomEvent(EVENEMENT_SESSION_EXPIREE, { detail: err }))
}

/**
 * Chemin de retour accepté après reconnexion : un chemin interne de
 * l'application (/admin… ou /mobile…), jamais une adresse externe
 * (« //site.com », « https:… », « /\site.com »). Sinon null.
 */
export function cheminRetourValide(brut: unknown): string | null {
  const valeur = Array.isArray(brut) ? brut[0] : brut
  if (typeof valeur !== 'string' || !valeur) return null
  if (!/^\/(admin|mobile)(?=$|[/?#])/.test(valeur)) return null
  if (/[\\\s]|\/\//.test(valeur.split(/[?#]/)[0]!)) return null
  return valeur
}

// Déconnexion demandée par la personne (menu du compte) : le plugin ne doit pas
// la prendre pour une expiration.
let deconnexionVolontaire = false
export function marquerDeconnexionVolontaire(enCours: boolean): void {
  deconnexionVolontaire = enCours
}
export function estDeconnexionVolontaire(): boolean {
  return deconnexionVolontaire
}
