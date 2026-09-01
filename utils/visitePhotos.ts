/**
 * Les visites importées d'AppSheet peuvent conserver des chemins relatifs
 * ("VISITE_Images/x.jpg") quand la photo n'a pas été migrée dans le bucket :
 * on n'affiche que les URLs résolues pour éviter les vignettes cassées.
 *
 * Utilisé par l'écran admin, la fiche visite mobile et VisitDetailModal — la
 * règle doit rester identique partout, badge de comptage compris.
 */
export function photosAffichables(imageUrls: unknown): string[] {
  if (!Array.isArray(imageUrls)) return []
  return imageUrls.filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
}
