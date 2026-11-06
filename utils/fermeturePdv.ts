/**
 * « PDV fermé » (migration 20261106120000) : le terrain signale un point de
 * vente fermé uniquement avec des photos de la devanture, prises sur le
 * moment. L'admin ou le superviseur décide ensuite (fermer ou garder).
 *
 * Règles pures, partagées par l'écran de signalement et ses tests. La base
 * refait les contrôles qui comptent (nombre de photos, photos bien reçues,
 * GPS) : l'app ne fait que les dire plus tôt.
 */

/** Photos obligatoires, une par emplacement (même minimum que la contrainte SQL). */
export const PHOTOS_FERMETURE = [
  { cle: 'face', libelle: 'Devanture de face', aide: 'Porte ou rideau fermé, bien visible.' },
  { cle: 'ensemble', libelle: 'Vue d\'ensemble', aide: 'Avec l\'enseigne ou la rue, pour situer la boutique.' },
] as const

export const NB_PHOTOS_FERMETURE = PHOTOS_FERMETURE.length

/**
 * Une photo de fermeture se prend devant la boutique : au-delà de ce délai,
 * c'est une ancienne photo (galerie, autre jour). Marge pour l'horloge du
 * téléphone et le temps de cadrer.
 */
export const FRAICHEUR_PHOTO_MAX_MS = 10 * 60 * 1000

/** Texte de l'étape de tournée close par un signalement (repris par la base). */
export const NOTE_ETAPE_FERMEE = 'PDV fermé : photos de la devanture envoyées'

export interface PhotoCandidate {
  type: string
  size: number
  /** Date du fichier selon le téléphone (ms depuis 1970). */
  lastModified: number
}

/**
 * Motif de refus d'une photo, ou null si elle est acceptée.
 * `autres` : photos déjà retenues pour les autres emplacements.
 */
export function refusPhotoFermeture(
  photo: PhotoCandidate,
  maintenant: number,
  autres: PhotoCandidate[] = [],
): string | null {
  if (!photo.type.startsWith('image/')) return 'Ce fichier n\'est pas une photo.'
  if (photo.size <= 0) return 'Photo vide : reprenez-la.'
  if (Number.isFinite(photo.lastModified) && photo.lastModified > 0) {
    if (maintenant - photo.lastModified > FRAICHEUR_PHOTO_MAX_MS) {
      return 'Photo trop ancienne : prenez-la maintenant, devant la boutique.'
    }
  }
  if (autres.some(a => a.size === photo.size && a.lastModified === photo.lastModified)) {
    return 'Même photo que la précédente : prenez une autre vue.'
  }
  return null
}

/** Le signalement peut partir : toutes les photos sont là. */
export function fermeturePrete(photos: ReadonlyArray<unknown | null | undefined>): boolean {
  return photos.length >= NB_PHOTOS_FERMETURE
    && photos.slice(0, NB_PHOTOS_FERMETURE).every(p => p != null)
}

/** Chemin de la photo n° `rang` (1, 2…) dans le bucket : fixe, pour qu'un renvoi soit sans risque. */
export function cheminPhotoFermeture(fermetureId: string, rang: number): string {
  return `fermetures/${fermetureId}/${rang}.jpg`
}

/** Étape de tournée close par un signalement « PDV fermé ». */
export function etapeFermee(resultNotes: string | null | undefined): boolean {
  return resultNotes === NOTE_ETAPE_FERMEE
}
