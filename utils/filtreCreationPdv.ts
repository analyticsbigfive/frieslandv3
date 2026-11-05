// utils/filtreCreationPdv.ts
// Filtres « Création » de la liste admin des PDV : date d'entrée dans la base
// (created_at) et compte qui a ajouté le PDV (ajoute_par : nom du compte app,
// e-mail du recensement d'août, ou étiquette d'import). Demande de Jean Luc du
// 05/11/2026 : retrouver les boutiques créées sur le terrain un jour donné.

/** Décale un jour « AAAA-MM-JJ » de `n` jours (calcul en UTC = heure d'Abidjan). */
export function decalerJour(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Lendemain d'un jour « AAAA-MM-JJ » (borne exclue du filtre « au »). */
export function lendemain(jour: string): string {
  return decalerJour(jour, 1)
}

/** Jour en cours à Abidjan (UTC+0, sans heure d'été), « AAAA-MM-JJ ». */
export function aujourdhuiAbidjan(maintenant: Date = new Date()): string {
  return maintenant.toISOString().slice(0, 10)
}

// Menu « Date de création » : raccourcis usuels, et « Période… » pour saisir
// les bornes à la main (champs Du / Au).
export type PresetCreation = 'tout' | 'aujourdhui' | 'hier' | '7j' | 'mois' | 'mois_dernier' | 'periode'

export const OPTIONS_CREATION: { value: PresetCreation; label: string }[] = [
  { value: 'tout', label: 'Toutes les dates' },
  { value: 'aujourdhui', label: 'Aujourd\'hui' },
  { value: 'hier', label: 'Hier' },
  { value: '7j', label: '7 derniers jours' },
  { value: 'mois', label: 'Ce mois' },
  { value: 'mois_dernier', label: 'Mois dernier' },
  { value: 'periode', label: 'Période…' },
]

/**
 * Bornes (incluses, « AAAA-MM-JJ ») d'un raccourci, relatives au jour
 * `aujourdhui` d'Abidjan. « Toutes les dates » et « Période… » n'imposent rien :
 * pour la période, ce sont les champs Du / Au qui donnent les bornes.
 */
export function plageCreation(preset: PresetCreation, aujourdhui: string): { debut: string; fin: string } {
  switch (preset) {
    case 'aujourdhui':
      return { debut: aujourdhui, fin: aujourdhui }
    case 'hier': {
      const hier = decalerJour(aujourdhui, -1)
      return { debut: hier, fin: hier }
    }
    case '7j':
      // Aujourd'hui compris : du jour J-6 au jour J.
      return { debut: decalerJour(aujourdhui, -6), fin: aujourdhui }
    case 'mois':
      return { debut: `${aujourdhui.slice(0, 7)}-01`, fin: aujourdhui }
    case 'mois_dernier': {
      // Dernier jour du mois dernier = veille du 1er du mois en cours.
      const fin = decalerJour(`${aujourdhui.slice(0, 7)}-01`, -1)
      return { debut: `${fin.slice(0, 7)}-01`, fin }
    }
    default:
      return { debut: '', fin: '' }
  }
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA », sans passer par Date (pas de décalage de fuseau). */
export function jourFr(jour: string): string {
  const [a, m, j] = jour.split('-')
  return `${j}/${m}/${a}`
}

/**
 * Libellé du filtre de date de création, pour la pastille « Créé : … ».
 * Vide quand aucun filtre de date n'est posé.
 */
export function libelleCreation(preset: PresetCreation, plage: { debut: string; fin: string }): string {
  const { debut, fin } = plage
  if (preset === 'aujourdhui' && debut) return `aujourd'hui (${jourFr(debut)})`
  if (preset === 'hier' && debut) return `hier (${jourFr(debut)})`
  if (preset === '7j') return '7 derniers jours'
  if (preset === 'mois') return 'ce mois'
  if (preset === 'mois_dernier') return 'mois dernier'
  if (preset !== 'periode') return ''
  if (debut && fin) return debut === fin ? `le ${jourFr(debut)}` : `du ${jourFr(debut)} au ${jourFr(fin)}`
  if (debut) return `depuis le ${jourFr(debut)}`
  if (fin) return `jusqu'au ${jourFr(fin)}`
  return ''
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
