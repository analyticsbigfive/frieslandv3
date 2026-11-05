// utils/libellePdv.ts
// Nom d'un PDV embarqué (pdv:pdv_id(...)). Quand la ligne de PDV ne revient
// pas (PDV hors du secteur lisible par l'utilisateur), on l'écrit clairement
// au lieu d'afficher le code seul (constat du 16/10/2026, merchs Atom).
export function libellePdv(row: { pdv?: { nom_pdv?: string | null } | null, pdv_id?: string | null } | null | undefined): string {
  const nom = row?.pdv?.nom_pdv
  if (nom) return nom
  return row?.pdv_id ? `PDV hors secteur · ${row.pdv_id}` : 'PDV hors secteur'
}

// Compte qui a ajouté un PDV (colonne ajoute_par) : nom du compte pour un PDV
// créé dans l'app (« GUI STEPHANE »), e-mail pour le recensement d'août, ou
// étiquette d'import (« import-dms-2026-09-29 », « import-pdv-atom-2026-10-20 »,
// « import-liste-pdv-202610141514 ») rendue lisible avec sa date.
export function estImport(ajoutePar?: string | null): boolean {
  return /^import-/i.test((ajoutePar || '').trim())
}

export function libelleAuteur(ajoutePar?: string | null): string {
  const valeur = (ajoutePar || '').trim()
  if (!valeur) return ''
  if (!estImport(valeur)) return valeur
  const source = /atom/i.test(valeur) ? 'Import Atom' : /dms/i.test(valeur) ? 'Import DMS' : /liste-pdv/i.test(valeur) ? 'Import liste PDV' : 'Import'
  const date = /(\d{4})-?(\d{2})-?(\d{2})/.exec(valeur)
  return date ? `${source} du ${date[3]}/${date[2]}/${date[1]}` : source
}

/** Texte sous la date de création : « par GUI STEPHANE » ou « Import DMS du 29/09/2026 ». */
export function origineAjout(ajoutePar?: string | null): string {
  const libelle = libelleAuteur(ajoutePar)
  if (!libelle) return ''
  return estImport(ajoutePar) ? libelle : `par ${libelle}`
}
