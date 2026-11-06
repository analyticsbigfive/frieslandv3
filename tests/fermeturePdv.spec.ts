import { describe, it, expect } from 'vitest'
import {
  FRAICHEUR_PHOTO_MAX_MS,
  NB_PHOTOS_FERMETURE,
  NOTE_ETAPE_FERMEE,
  cheminPhotoFermeture,
  etapeFermee,
  fermeturePrete,
  refusPhotoFermeture,
} from '../utils/fermeturePdv'

const maintenant = Date.parse('2026-11-06T10:00:00Z')
const photo = (o: Partial<{ type: string, size: number, lastModified: number }> = {}) => ({
  type: 'image/jpeg',
  size: 120_000,
  lastModified: maintenant - 30_000,
  ...o,
})

describe('PDV fermé : photos de la devanture', () => {
  it('deux photos obligatoires, comme la contrainte SQL', () => {
    expect(NB_PHOTOS_FERMETURE).toBe(2)
  })

  it('accepte une photo prise à l\'instant', () => {
    expect(refusPhotoFermeture(photo(), maintenant)).toBeNull()
  })

  it('refuse une photo ancienne (galerie, autre jour)', () => {
    const vieille = photo({ lastModified: maintenant - FRAICHEUR_PHOTO_MAX_MS - 1 })
    expect(refusPhotoFermeture(vieille, maintenant)).toMatch(/trop ancienne/)
    expect(refusPhotoFermeture(photo({ lastModified: maintenant - FRAICHEUR_PHOTO_MAX_MS }), maintenant)).toBeNull()
  })

  it('date inconnue : pas de refus sur la fraîcheur, la base contrôle le reste', () => {
    expect(refusPhotoFermeture(photo({ lastModified: 0 }), maintenant)).toBeNull()
    expect(refusPhotoFermeture(photo({ lastModified: Number.NaN }), maintenant)).toBeNull()
  })

  it('horloge du téléphone en avance : la photo reste acceptée', () => {
    expect(refusPhotoFermeture(photo({ lastModified: maintenant + 60_000 }), maintenant)).toBeNull()
  })

  it('refuse un fichier qui n\'est pas une image, ou vide', () => {
    expect(refusPhotoFermeture(photo({ type: 'application/pdf' }), maintenant)).toMatch(/pas une photo/)
    expect(refusPhotoFermeture(photo({ size: 0 }), maintenant)).toMatch(/vide/)
  })

  it('refuse deux fois la même photo', () => {
    const p = photo()
    expect(refusPhotoFermeture({ ...p }, maintenant, [p])).toMatch(/Même photo/)
    expect(refusPhotoFermeture(photo({ size: 99_000 }), maintenant, [p])).toBeNull()
  })

  it('prête seulement avec toutes les photos', () => {
    expect(fermeturePrete([])).toBe(false)
    expect(fermeturePrete([photo(), null])).toBe(false)
    expect(fermeturePrete([undefined, photo()])).toBe(false)
    expect(fermeturePrete([photo(), photo({ size: 1 })])).toBe(true)
  })

  it('chemin fixe sous fermetures/<id>/, attendu par declarer_pdv_ferme', () => {
    expect(cheminPhotoFermeture('abc', 1)).toBe('fermetures/abc/1.jpg')
    expect(cheminPhotoFermeture('abc', 2)).toBe('fermetures/abc/2.jpg')
  })

  it('reconnaît l\'étape de tournée close par un signalement', () => {
    expect(etapeFermee(NOTE_ETAPE_FERMEE)).toBe(true)
    expect(etapeFermee('Passé')).toBe(false)
    expect(etapeFermee(null)).toBe(false)
  })
})
