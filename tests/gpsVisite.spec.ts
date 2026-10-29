import { describe, it, expect } from 'vitest'
import { causeBlocageGps, codeErreurGps, decisionDistance, decisionGpsVisite, etatRecherche } from '../utils/gpsVisite'
import { CAS_AIDE_GPS, casAideGps, ETAPES_AIDE_GPS, ETAPES_AIDE_GPS_CHROME, typeTablette } from '../utils/aideGpsTablette'

// GPS obligatoire (1.0.17) : pas de position, pas de visite ; la distance au
// PDV ne bloque plus, l'agent confirme qu'il est devant.

// Erreurs réelles de @capacitor/geolocation 7 (GeolocationErrors.kt).
const PLUGIN = {
  refuse: { code: 'OS-PLUG-GLOC-0003', message: 'Location permission request was denied.' },
  coupe: { code: 'OS-PLUG-GLOC-0007', message: 'Location services are not enabled.' },
  activationRefusee: { code: 'OS-PLUG-GLOC-0009', message: 'Request to enable location was denied.' },
  delai: { code: 'OS-PLUG-GLOC-0010', message: 'Could not obtain location in time. Try with a higher timeout.' },
}

describe('codeErreurGps', () => {
  it('lit le code texte du plugin avant le message', () => {
    expect(codeErreurGps(PLUGIN.refuse)).toBe(1)
    expect(codeErreurGps(PLUGIN.coupe)).toBe(2)
    // « …was denied » : c'est la localisation qui est coupée, pas l'autorisation.
    expect(codeErreurGps(PLUGIN.activationRefusee)).toBe(2)
    expect(codeErreurGps(PLUGIN.delai)).toBe(3)
  })
  it('garde les codes du navigateur et lit les messages sans code', () => {
    expect(codeErreurGps({ code: 1, message: 'User denied Geolocation' })).toBe(1)
    expect(codeErreurGps({ code: 2 })).toBe(2)
    expect(codeErreurGps({ code: 3 })).toBe(3)
    expect(codeErreurGps({ message: 'Localisation refusée' })).toBe(1)
    expect(codeErreurGps({ message: 'Location services are not enabled.' })).toBe(2)
    expect(codeErreurGps(null)).toBeNull()
  })
})

describe('causeBlocageGps', () => {
  it('permission refusée → cas B', () => {
    expect(causeBlocageGps(PLUGIN.refuse, { location: 'denied', coarseLocation: 'denied' })).toBe('permission')
    expect(causeBlocageGps({ code: 1 }, null)).toBe('permission')
    expect(causeBlocageGps(null, { location: 'denied' })).toBe('permission')
  })
  it('position approximative seulement → cas B, sans attendre 20 s', () => {
    expect(causeBlocageGps(null, { location: 'prompt', coarseLocation: 'granted' })).toBe('approximative')
    expect(causeBlocageGps(PLUGIN.refuse, { location: 'denied', coarseLocation: 'granted' })).toBe('approximative')
  })
  it('GPS coupé → cas A, même si l\'autorisation est donnée', () => {
    expect(causeBlocageGps(PLUGIN.coupe, null)).toBe('desactive')
    expect(causeBlocageGps(PLUGIN.activationRefusee, { location: 'granted' })).toBe('desactive')
    expect(causeBlocageGps({ code: 2 }, { location: 'granted' })).toBe('desactive')
  })
  it('précision insuffisante ou trop lent → cas C', () => {
    expect(causeBlocageGps(PLUGIN.delai, { location: 'granted', coarseLocation: 'granted' })).toBe('lent')
    expect(causeBlocageGps(null, { location: 'granted' })).toBe('lent')
    expect(causeBlocageGps(null, null)).toBe('lent')
  })
})

describe('etatRecherche', () => {
  it('attend tant que la précision dépasse le seuil', () => {
    expect(etatRecherche(null, 50)).toBe('attendre')
    expect(etatRecherche(120, 50)).toBe('attendre')
    expect(etatRecherche(50.4, 50)).toBe('attendre')
    expect(etatRecherche(50, 50)).toBe('ok')
    expect(etatRecherche(8, 50)).toBe('ok')
  })
  it('sans seuil, la première position suffit', () => {
    expect(etatRecherche(900, 0)).toBe('ok')
  })
})

describe('decisionDistance', () => {
  it('ne bloque jamais : au-delà du seuil, on demande', () => {
    expect(decisionDistance(40, 100)).toBe('ok')
    expect(decisionDistance(100, 100)).toBe('ok')
    expect(decisionDistance(101, 100)).toBe('confirmer')
    expect(decisionDistance(5000, 100)).toBe('confirmer')
  })
  it('PDV sans position : rien à comparer', () => {
    expect(decisionDistance(null, 100)).toBe('ok')
  })
})

describe('decisionGpsVisite', () => {
  const base = { rayon_m: 300, distance_alerte_m: 100, precision_pdv_max_m: 50, precision_m: 12 }

  it('loin du PDV repéré : question « Êtes-vous bien devant ? », jamais « Hors zone »', () => {
    expect(decisionGpsVisite({ ...base, repere: 'terrain', distance_m: 800 })).toEqual({ action: 'confirmer', distance_m: 800 })
    expect(decisionGpsVisite({ ...base, repere: 'creation', distance_m: 150 })).toEqual({ action: 'confirmer', distance_m: 150 })
  })

  it('« Oui, je suis devant » : enregistrée avec la confirmation, hors rayon au-delà de 300 m', () => {
    expect(decisionGpsVisite({ ...base, repere: 'terrain', distance_m: 800, confirmation: 'devant' })).toEqual({
      action: 'enregistrer',
      geofenceOk: false,
      gps: { repere: 'terrain', distance_m: 800, rayon_m: 300, precision_m: 12, confirmation: 'devant' },
    })
    const proche = decisionGpsVisite({ ...base, repere: 'admin', distance_m: 150, confirmation: 'devant' })
    expect(proche).toMatchObject({ action: 'enregistrer', geofenceOk: true, gps: { confirmation: 'devant' } })
  })

  it('près du repère : enregistrée sans question', () => {
    expect(decisionGpsVisite({ ...base, repere: 'visite_validee', distance_m: 45 })).toEqual({
      action: 'enregistrer',
      geofenceOk: true,
      gps: { repere: 'visite_validee', distance_m: 45, rayon_m: 300, precision_m: 12 },
    })
  })

  it('PDV sans GPS : la première position prise devient la sienne, sans question', () => {
    expect(decisionGpsVisite({ ...base, repere: null, distance_m: null })).toEqual({
      action: 'enregistrer',
      geofenceOk: true,
      gps: { repere: 'premiere_visite', distance_m: null, precision_m: 12 },
    })
  })

  it('position d\'un fichier (non repérée), même à 2 km : première visite, sans question', () => {
    const d = decisionGpsVisite({ ...base, repere: null, distance_m: 2000 })
    expect(d).toMatchObject({ action: 'enregistrer', gps: { repere: 'premiere_visite', distance_m: 2000 } })
  })

  it('première visite moins précise que le seuil du PDV : enregistrée, PDV non repéré', () => {
    const d = decisionGpsVisite({ ...base, repere: null, distance_m: null, precision_m: 70 })
    expect(d).toMatchObject({ action: 'enregistrer', geofenceOk: false, gps: { motif: 'precision', precision_exigee_m: 50 } })
  })
})

describe('écran d\'aide', () => {
  it('chaque cause mène à un seul cas : A coupé, B autorisation, C lent', () => {
    expect(casAideGps('desactive')).toBe('A')
    expect(casAideGps('permission')).toBe('B')
    expect(casAideGps('approximative')).toBe('B')
    expect(casAideGps('lent')).toBe('C')
  })
  it('chaque cas a un titre et des étapes numérotables', () => {
    for (const cas of ['A', 'B', 'C'] as const) {
      expect(CAS_AIDE_GPS[cas].titre.length).toBeGreaterThan(5)
      expect(ETAPES_AIDE_GPS[cas].length).toBeGreaterThan(1)
    }
  })
  it('le cas B nomme les réglages exacts d\'Android et de Chrome', () => {
    const texte = JSON.stringify([...ETAPES_AIDE_GPS.B, ...ETAPES_AIDE_GPS_CHROME])
    expect(texte).toContain('Autoriser uniquement pendant l\'utilisation de l\'application')
    expect(texte).toContain('Utiliser la position exacte')
    expect(texte).toContain('Paramètres des sites')
  })
})

describe('typeTablette', () => {
  it('SM-X130 = Wi-Fi seul, SM-X135 / SM-X133 = avec GPS', () => {
    expect(typeTablette('SM-X130')).toBe('wifi')
    expect(typeTablette('sm-x135')).toBe('gps')
    expect(typeTablette('SM-X133')).toBe('gps')
    expect(typeTablette('SM-X1350')).toBeNull()
    expect(typeTablette('Pixel 7')).toBeNull()
    expect(typeTablette(null)).toBeNull()
  })
})
