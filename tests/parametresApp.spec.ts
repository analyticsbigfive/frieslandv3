import { describe, it, expect } from 'vitest'
import { fusionnerParametres, parametresParDefaut } from '../composables/useParametresApp'

describe('paramètres terrain', () => {
  const defauts = parametresParDefaut({ geofenceRadius: 300, gpsMinAccuracy: 10, gpsPdvPrecisionMax: 30, trackingIntervalMs: 120000, trackingDistanceM: 15, trackingFlushMs: 300000, trackingBatchMax: 200 })

  it('reprend les valeurs du build par défaut', () => {
    expect(defauts.geofence_rayon_m).toBe(300)
    expect(defauts.tracking_intervalle_s).toBe(120)
    expect(defauts.objectif_visites_jour).toBe(10)
  })

  it('1.0.17 : distance d\'alerte et déplacement à vérifier, lus en base comme les autres', () => {
    expect(defauts.distance_alerte_m).toBe(100)
    expect(defauts.gps_deplacement_verif_m).toBe(500)
    const p = fusionnerParametres(defauts, { distance_alerte_m: 150, gps_deplacement_verif_m: 800 })
    expect(p.distance_alerte_m).toBe(150)
    expect(p.gps_deplacement_verif_m).toBe(800)
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
