// utils/libellePdv.ts
// Nom d'un PDV embarqué (pdv:pdv_id(...)). Quand la ligne de PDV ne revient
// pas (PDV hors du secteur lisible par l'utilisateur), on l'écrit clairement
// au lieu d'afficher le code seul (constat du 16/10/2026, merchs Atom).
export function libellePdv(row: { pdv?: { nom_pdv?: string | null } | null, pdv_id?: string | null } | null | undefined): string {
  const nom = row?.pdv?.nom_pdv
  if (nom) return nom
  return row?.pdv_id ? `PDV hors secteur · ${row.pdv_id}` : 'PDV hors secteur'
}
