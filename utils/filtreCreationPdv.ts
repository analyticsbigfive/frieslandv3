// utils/filtreCreationPdv.ts
// Filtres « Création » de la liste admin des PDV : date d'entrée dans la base
// (created_at) et compte qui a ajouté le PDV (ajoute_par : nom du compte app,
// e-mail du recensement d'août, ou étiquette d'import). Demande de Jean Luc du
// 05/11/2026 : retrouver les boutiques créées sur le terrain un jour donné.

/** Lendemain d'un jour « AAAA-MM-JJ » (borne exclue du filtre « au »). */
export function lendemain(jour: string): string {
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Restreint une requête `pdv` à la date d'entrée dans la base, bornes
 * comprises. Abidjan est à UTC+0 : le jour UTC est le jour local.
 */
export function filtrerDateCreation<Q extends { gte: (c: string, v: string) => Q; lt: (c: string, v: string) => Q }>(query: Q, du: string, au: string): Q {
  if (du) query = query.gte('created_at', du)
  if (au) query = query.lt('created_at', lendemain(au))
  return query
}

/** Restreint une requête `pdv` au compte qui a ajouté le PDV (valeur exacte de ajoute_par). */
export function filtrerAuteur<Q extends { eq: (c: string, v: string) => Q }>(query: Q, auteur: string): Q {
  return auteur ? query.eq('ajoute_par', auteur) : query
}

/** Un filtre de création est posé : la liste passe des plus récents aux plus anciens. */
export function filtreCreationActif(f: { creeDu?: string; creeAu?: string; auteur?: string }): boolean {
  return !!(f.creeDu || f.creeAu || f.auteur)
}
