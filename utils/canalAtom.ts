// utils/canalAtom.ts
// Canal Atom d'un PDV (grille de quotas des tournées « Bonnet Rouge »).
//
// RÉPLIQUE EXACTE de la fonction SQL public.canal_atom(text), définie dans
// supabase/nouveau/20261006101000_friesland_routing_quotas_atom.sql : c'est
// elle qui pioche les PDV des tournées en mode quota. Toute modification des
// regex doit être faite DES DEUX CÔTÉS (et dans tests/canalAtom.spec.ts),
// sinon le badge affiché dans l'app ne correspond plus au quota qui a placé
// le PDV dans la tournée.
//
// Côté SQL : `upper(x) ~ 'MOTIF'`, testé dans l'ordre, premier qui gagne
// (« Pushcart Boutique » est un Pushcart). Grossistes, supermarchés,
// pharmacies, boulangeries : NULL, hors quota.
//
// Aucune dépendance Nuxt : module couvert par des tests unitaires.

/** Les 5 canaux de la grille routing_quota_canal, dans l'ordre d'affichage. */
export const CANAUX_ATOM = ['Superette', 'Boutique', 'Aboki & Kiosque', 'Pushcart', 'Porridge'] as const

export type CanalAtom = typeof CANAUX_ATOM[number]

// Ordre des `when` de canal_atom : NE PAS réordonner.
const REGLES: [RegExp, CanalAtom][] = [
  [/PORRIDGE/, 'Porridge'],
  [/PUSHCAR/, 'Pushcart'],
  [/ABOKI|KIOS|TABLE TOP|TABLIER/, 'Aboki & Kiosque'],
  [/SUPERETTE|MINIMARKET/, 'Superette'],
  [/BOUTIQUE/, 'Boutique'],
]

/** Canal Atom d'une sous-catégorie PDV ; null = hors grille (comme canal_atom SQL). */
export function canalAtom(sousCategorie?: string | null): CanalAtom | null {
  if (sousCategorie === null || sousCategorie === undefined) return null
  const valeur = String(sousCategorie).toUpperCase()
  for (const [motif, canal] of REGLES) {
    if (motif.test(valeur)) return canal
  }
  return null
}

/**
 * Libellé du type de PDV à afficher en badge : le canal Atom s'il y en a un,
 * sinon la sous-catégorie brute (« Grossiste », « Pharmacie »…), sinon null.
 */
export function libelleTypePdv(sousCategorie?: string | null): string | null {
  const canal = canalAtom(sousCategorie)
  if (canal) return canal
  const brut = (sousCategorie || '').trim()
  return brut || null
}
