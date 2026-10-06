import { describe, it, expect } from 'vitest'
// @ts-ignore module JS sans types
import { deriverSsf, lireJours, commune, canalAtom } from '../scripts/lib/imports/ssf-sous-zones.mjs'
// @ts-ignore module JS sans types
import { validerOperation } from '../scripts/lib/imports/operations.mjs'

// Jeu minimal : un merchandiser d'Adjamé, trois SSF (deux à Adjamé, un à
// Yopougon), des visites de septembre réparties par jour de semaine.
const M = '11111111-1111-1111-1111-111111111111'
const pdvs = [
  ...Array.from({ length: 12 }, (_, i) => ({ pdv_id: `L${i}`, zone: 'ADJAME', quartier: '220 LGTs', sous_categorie_pdv: 'Boutique C', geolocation_lat: 5.36 + i / 1e4, geolocation_lng: -4.02, is_active: true })),
  ...Array.from({ length: 8 }, (_, i) => ({ pdv_id: `B${i}`, zone: 'ADJAME', quartier: 'BRACODI', sous_categorie_pdv: 'Boutique B', geolocation_lat: 5.35, geolocation_lng: -4.01 + i / 1e4, is_active: true })),
  ...Array.from({ length: 6 }, (_, i) => ({ pdv_id: `C${i}`, zone: 'COCODY 1', quartier: '2 PLATEAUX', sous_categorie_pdv: 'Boutique C', geolocation_lat: 5.37, geolocation_lng: -3.99, is_active: true })),
  ...Array.from({ length: 10 }, (_, i) => ({ pdv_id: `Y${i}`, zone: 'YOPOUGON 3', quartier: 'MAROC', sous_categorie_pdv: 'Boutique C', geolocation_lat: 5.34, geolocation_lng: -4.08, is_active: true })),
]
const ssfs = [
  { id: 1, nom: 'Tra Bi Ta Arsène', distributeur_id: 1, actif: true },
  { id: 2, nom: 'Yapi Wilfried', distributeur_id: 1, actif: true },
  { id: 3, nom: 'Ouattara Nanougou', distributeur_id: 2, actif: true },
  { id: 4, nom: 'ATOM (?)', distributeur_id: 2, actif: true },
]
// date_visite d'un jour de septembre 2026 donné (1er = mardi).
const jour = (j: number) => `2026-09-${String(j).padStart(2, '0')}T08:00:00+00:00`
const visites: any[] = []
const ajouter = (ssf: number, pdv: string, date: string, n = 1, user = M) => { for (let k = 0; k < n; k++) visites.push({ user_id: user, ssf_id: ssf, pdv_id: pdv, date_visite: date }) }
// SSF 1 : lundis (7, 14) et jeudis (3, 10) à 220 LGTs ; un peu de 2 PLATEAUX (autre commune).
for (const d of [7, 14, 3, 10]) ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].forEach(p => ajouter(1, p, jour(d)))
ajouter(1, 'C0', jour(3), 3)
// SSF 2 : mardis (1, 8) et mercredis (2, 9) à BRACODI.
for (const d of [1, 8, 2, 9]) ['B0', 'B1', 'B2', 'B3', 'B4'].forEach(p => ajouter(2, p, jour(d)))
// SSF 3 : Yopougon, beaucoup de visites mais hors de la zone du merchandiser.
for (const d of [4, 11, 5, 12]) ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5'].forEach(p => ajouter(3, p, jour(d)))
// SSF « bruit ».
ajouter(4, 'L6', jour(4), 20)

const donnees = () => ({
  visites,
  pdvs,
  profils: [{ id: M, email: 'adjame@x.ci', nom: 'Merch Adjamé', role: 'merchandiser', employeur: 'atom', is_active: true, zone_assignee: 'ADJAME', territoires_assignes: ['ADJAME'], quartiers_assignes: ['220 LGTs'] }],
  ssfs,
  distributeurs: [{ id: 1, nom: 'BOUSSOURA SARL' }, { id: 2, nom: 'NDA' }],
  ssfQuartiers: [],
  quotas: [{ canal: 'Boutique', jour_semaine: 1, quota: 13 }, { canal: 'Superette', jour_semaine: 1, quota: 2 }],
  regles: [{ id: 'aaaaaaaa-0000-0000-0000-000000000009', user_id: M, label: 'Portefeuille DMS — BOUSSOURA', mode: 'quota', ssf_id: null, days_of_week: [1, 2, 3, 4, 5, 6], is_active: true, distributeur: 'BOUSSOURA SARL' }],
  reglesPdv: ['L7', 'L8', 'B5', 'Y9'].map((pdv_id, k) => ({ template_id: 'aaaaaaaa-0000-0000-0000-000000000009', pdv_id, position_order: k + 1 })),
})

describe('dérivation des sous-zones SSF', () => {
  const res = deriverSsf(donnees(), { debut: '2026-10-07', moisJours: '2026-09' })

  it('garde les quartiers au-dessus des seuils, dans la commune dominante du SSF', () => {
    const sz = res.sousZones.get('id:1')
    expect(sz.lignes.map((l: any) => `${l.zone}|${l.quartier}`)).toEqual(['ADJAME|220 LGTs'])
    expect(sz.horsCommune.map((l: any) => l.quartier)).toEqual([]) // 3 visites à 2 PLATEAUX : sous le seuil de 5
  })

  it('écarte les SSF « bruit »', () => {
    expect(res.sousZones.has('id:4')).toBe(false)
  })

  it('ne retient pas un SSF hors de la zone du merchandiser', () => {
    const pl = res.plannings[0]
    expect(pl.regles.map((r: any) => r.ssf.nom).sort()).toEqual(['Tra Bi Ta Arsène', 'Yapi Wilfried'])
  })

  it('un SSF par jour : celui qui domine ce jour-là', () => {
    const pl = res.plannings[0]
    const jours = Object.fromEntries(pl.regles.map((r: any) => [r.ssf.nom, r.days_of_week]))
    expect(jours['Tra Bi Ta Arsène']).toEqual([1, 4])
    expect(jours['Yapi Wilfried']).toEqual([2, 3])
    expect(pl.nonCouverts).toEqual([5, 6])
  })

  it('portefeuille de la règle = PDV DMS et visités, dans la sous-zone uniquement', () => {
    const r = res.plannings[0].regles.find((x: any) => x.ssf.id === 1)
    expect(r.pdv_ids).toContain('L7') // portefeuille DMS, dans 220 LGTs
    expect(r.pdv_ids).toContain('L0') // visité avec le SSF
    expect(r.pdv_ids).not.toContain('Y9') // portefeuille DMS mais hors sous-zone
    expect(r.pdv_ids).not.toContain('B5') // autre sous-zone
  })

  it('la règle DMS garde les jours non couverts, le périmètre gagne les quartiers', () => {
    const jours = res.operations.find((o: any) => o.type === 'regle.jours')
    expect(jours.days_of_week).toEqual([5, 6])
    expect(jours.is_active).toBe(true)
    const perim = res.operations.find((o: any) => o.type === 'profil.perimetre')
    expect(perim.quartiers_assignes).toEqual(['220 LGTs', 'BRACODI'])
    expect(perim.territoires_assignes).toEqual(['ADJAME'])
  })

  it('produit des opérations valides et leur retour arrière', () => {
    for (const op of [...res.operations, ...res.retour]) expect(() => validerOperation(op)).not.toThrow()
    const retourJours = res.retour.find((o: any) => o.type === 'regle.jours')
    expect(retourJours.days_of_week).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('Excel du client', () => {
  it('remplace la dérivation pour les SSF et merchandisers cités', () => {
    const res = deriverSsf(donnees(), {
      debut: '2026-10-07',
      fichierClient: 'ssf-zones.xlsx',
      lignesClient: [
        { feuille: 'F', ligne: 2, ssf: 'arsène tra bi ta', zone: 'Adjamé', quartiers: ['Bracodi'], merch: 'adjame@x.ci', jours: [1, 2, 3], distributeur: '', telephone: '' },
        { feuille: 'F', ligne: 3, ssf: 'Nouveau SSF', zone: 'Adjamé', quartiers: ['220 lgts'], merch: 'adjame@x.ci', jours: [4, 5, 6], distributeur: 'NDA', telephone: '0700' },
        { feuille: 'F', ligne: 4, ssf: 'Inconnu', zone: 'Atlantide', quartiers: ['X'], merch: '', jours: [], distributeur: '', telephone: '' },
      ],
    })
    const sz = res.sousZones.get('id:1')
    expect(sz.origine).toBe('client')
    expect(sz.lignes).toEqual([{ zone: 'ADJAME', quartier: 'BRACODI' }])
    expect(res.operations[0]).toMatchObject({ type: 'ssf.creer', nom: 'Nouveau SSF', distributeur: 'NDA' })
    const regles = res.operations.find((o: any) => o.type === 'regles_ssf.remplacer').regles
    expect(regles.map((r: any) => [r.ssf.nom, r.days_of_week])).toEqual([['Tra Bi Ta Arsène', [1, 2, 3]], ['Nouveau SSF', [4, 5, 6]]])
    expect(res.resume.rejetsClient).toBe(1)
  })
})

describe('aides', () => {
  it('lit les jours en toutes lettres ou abrégés', () => {
    expect(lireJours('Lundi, Jeudi')).toEqual([1, 4])
    expect(lireJours('lun au sam')).toEqual([1, 2, 3, 4, 5, 6])
    expect(lireJours('Mar / Ven')).toEqual([2, 5])
  })
  it('commune d\'un territoire', () => {
    expect(commune('ABOBO 2')).toBe('ABOBO')
    expect(commune('ATTECOUBE-PLATEAU')).toBe('ATTECOUBE-PLATEAU')
  })
  it('canal Atom (miroir de la fonction SQL)', () => {
    expect(canalAtom('Superettes A')).toBe('Superette')
    expect(canalAtom('Kiosk B')).toBe('Aboki & Kiosque')
    expect(canalAtom('Wholesalers')).toBeNull()
  })
})
