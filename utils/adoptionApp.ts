// utils/adoptionApp.ts
// Adoption de l'app mobile : qui a installé la version minimale exigée.
//
// L'app déclare sa version au lancement (version_installee, plugins/
// version-app.client.ts) et se bloque sous version_app.version_code_min. Les
// deux mécanismes datent de la 1.0.10 (versionCode 13) : un téléphone en 1.0.9
// ou avant ne déclare rien ET n'est pas bloqué. « Non déclarée » ne veut donc
// pas dire « pas d'app » : c'est souvent une ancienne version qui tourne
// encore, à mettre à jour à la main (Play Store ou lien de l'APK).

export type StatutVersion = 'a_jour' | 'bloquee' | 'non_declaree'

export const LIBELLES_STATUT: Record<StatutVersion, string> = {
  a_jour: 'À jour',
  bloquee: 'Bloquée (mise à jour exigée)',
  non_declaree: 'Non déclarée (avant 1.0.10 ou jamais ouverte)',
}

/** Rôles qui utilisent l'app mobile sur le terrain. */
export const ROLES_APP_MOBILE: readonly string[] = ['merchandiser', 'commercial', 'superviseur']

export function statutVersion(versionCode: number | null | undefined, versionCodeMin: number | null | undefined): StatutVersion {
  if (versionCode == null) return 'non_declaree'
  if (versionCodeMin == null) return 'a_jour'
  return versionCode >= versionCodeMin ? 'a_jour' : 'bloquee'
}

export interface LigneAdoption {
  user_id: string
  statut: StatutVersion
}

/** Compteurs par statut et taux d'adoption (à jour / total, en %, arrondi). */
export function syntheseAdoption(lignes: LigneAdoption[]) {
  const compte: Record<StatutVersion, number> = { a_jour: 0, bloquee: 0, non_declaree: 0 }
  for (const l of lignes) compte[l.statut]++
  const total = lignes.length
  return { ...compte, total, taux: total ? Math.round((compte.a_jour / total) * 100) : 0 }
}

/** Jours écoulés depuis une date ISO (null si absente) : sert à repérer les comptes inactifs. */
export function joursDepuis(iso: string | null | undefined, maintenant: Date = new Date()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((maintenant.getTime() - t) / 86_400_000))
}
