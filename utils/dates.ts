// utils/dates.ts
// Helpers de formatage de dates côté front.
// Problème récurrent : certains graphiques reçoivent des dates ISO
// ('2026-07-15'), d'autres des libellés déjà formatés ('S28 - 2026',
// 'juillet 2026', '05 juil.'). Re-parser un libellé formaté avec
// `new Date(...)` produit « Invalid Date ». isIsoDate permet de ne
// formater que ce qui est réellement une date ISO.

// Vrai si la chaîne commence par une date ISO (YYYY-MM-DD).
export function isIsoDate(value?: string | null): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
}

// Formate une date en français. Retourne '—' si la valeur est vide ou
// non parsable (jamais « Invalid Date »).
export function formatDateFr(
  value?: string | number | Date | null,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', opts)
}
