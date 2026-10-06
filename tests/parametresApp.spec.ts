import { describe, it, expect } from 'vitest'
import { fusionnerParametres, parametresParDefaut } from '../composables/useParametresApp'

describe('paramètres terrain', () => {
  const defauts = parametresParDefaut({ geofenceRadius: 300, gpsMinAccuracy: 10, gpsPdvPrecisionMax: 30, trackingIntervalMs: 120000, trackingDistanceM: 15, trackingFlushMs: 300000, trackingBatchMax: 200 })

  it('reprend les valeurs du build par défaut', () => {
    expect(defauts.geofence_rayon_m).toBe(300)
    expect(defauts.tracking_intervalle_s).toBe(120)
    expect(defauts.objectif_visites_jour).toBe(10)
  })

  it('les valeurs de la base priment, l’objectif vide reste vide (Atom)', () => {
    const p = fusionnerParametres(defauts, { geofence_rayon_m: 250, objectif_visites_jour: null, inconnu: 3 })
    expect(p.geofence_rayon_m).toBe(250)
    expect(p.objectif_visites_jour).toBeNull()
    expect((p as any).inconnu).toBeUndefined()
  })

  it('sans base ni cache : valeurs du build', () => {
    expect(fusionnerParametres(defauts, null)).toEqual(defauts)
  })
})
