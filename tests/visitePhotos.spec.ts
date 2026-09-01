import { describe, expect, it } from 'vitest'
import { photosAffichables } from '../utils/visitePhotos'

describe('photosAffichables', () => {
  it('conserve les URLs résolues', () => {
    const urls = [
      'https://x.supabase.co/storage/v1/object/public/visite-images/VISITE_Images/a.webp',
      'https://x.supabase.co/storage/v1/object/public/visite-images/visites/b/c.jpg',
    ]
    expect(photosAffichables(urls)).toEqual(urls)
  })

  it('écarte les chemins AppSheet non migrés', () => {
    expect(photosAffichables([
      'VISITE_Images/3eef305c.Photo visibilité intérieure.135241.jpg',
      'VISITE_Files_/b6db87f4.Image.174626.jpg',
      'PDV_Images/e78fb6b4.Image.084735.jpg',
    ])).toEqual([])
  })

  it('ne garde que les URLs dans un tableau mixte', () => {
    expect(photosAffichables([
      'VISITE_Images/a.jpg',
      'https://x.supabase.co/ok.webp',
      'PDV_Images/b.jpg',
    ])).toEqual(['https://x.supabase.co/ok.webp'])
  })

  it('tolère les entrées non conformes', () => {
    expect(photosAffichables(null)).toEqual([])
    expect(photosAffichables(undefined)).toEqual([])
    expect(photosAffichables([])).toEqual([])
    expect(photosAffichables('https://x.webp')).toEqual([])
    expect(photosAffichables([null, undefined, 42, '', 'https://ok.webp'])).toEqual(['https://ok.webp'])
  })
})
