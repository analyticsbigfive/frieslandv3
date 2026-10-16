import { describe, expect, it } from 'vitest'
// @ts-ignore module JS sans types
import { avenueDe, cleAdresse, cleQuartier, gerantsCompatibles, lireListePdv, lireListePdvCsv, lireSemaines, rapprocher, simulerListePdv, telephoneDe, typeDe } from '../scripts/lib/imports/liste-pdv.mjs'
// @ts-ignore module JS sans types
import { OPERATIONS_PAR_IMPORT, validerOperation } from '../scripts/lib/imports/operations.mjs'

// Extrait anonymisé de « ROUTING TREICHVILLE FINAL » (Atom, 14/10/2026) : une
// feuille par jour, titre au-dessus de l'en-tête, feuille « autres » sans jour,
// second bloc sans en-tête plus bas dans la feuille.
const feuille = (nom: string, lignes: string[][]) => ({ nom, lignes: lignes.map((v, i) => ({ n: i + 1, cellules: ['', ...v] })) })
const ENTETE = ['', 'NOM DU PDV', 'LOCALISATION ', 'SECTEUR ', 'CONTACT ', 'TYPE DE PDV']
const FEUILLES = [
  feuille('lundi', [
    ['LUNDI', 'BELLEVILLE '], [],
    ENTETE,
    ['1', 'Sow rue 44 treichville', 'Après la mosquée', 'Belleville', '', 'Boutique C'],
    ['2', 'Toure rue 44 treichville', 'Rue 44', 'Belleville', '', 'Kiosque'],
  ]),
  feuille('mardi ', [
    ENTETE,
    ['1', 'Diallo treichville avenue 6', 'Avenue 6 rue 16 barrée', 'France Amerique', '', 'Boutique C'],
    ['2', 'Supérette baraka treichville avenue 2', 'Avenue 2 rue 15', 'Biafra', '', 'supérette '],
  ]),
  feuille('mercredi ', [
    ENTETE,
    ['1', 'diallo  idrisse', 'avenue  9 rue 18', '', '07 78 01 64 03', 'boutique C'],
    ['2', 'barri Ibrahim ', 'avenue 7 rue 24', 'France Afrique ', '07 10 31 36 12', 'boutique C'],
    ['3', 'aladji ', 'avenue 13 rue 17', 'quartier  apolo', '', 'c'],
    ['4', 'supérette avenue 8', 'avenue 8 rue 9', 'arras', '01 41 58 01 81', 'supérette '],
    ['5', 'moustapha ', 'avenue 7 rue 14', 'France Afrique ', '', 'boutique C'],
    [],
    // Second bloc, sans en-tête.
    ['6', 'fall', 'avenue 20 rue 17', 'quartier appolo', '', 'b'],
  ]),
  feuille('autres', [
    ENTETE,
    ['1', 'diallo ', 'avenue 27 rue 19', 'quartier appolo', '05 64 30 80 71', 'c'],
    ['2', 'diallo ', 'avenue 27 rue 19', 'quartier appolo', '', 'kiosque '],
  ]),
]

const M = '11111111-1111-1111-1111-111111111111'
const AUTEUR = '99999999-9999-9999-9999-999999999999'
const T_AVANT = 'aaaaaaaa-0000-0000-0000-000000000001'
const p = (pdv_id: string, nom_pdv: string, adressage: string, quartier: string, extra: any = {}) => ({
  pdv_id, nom_pdv, adressage, quartier, zone: 'TREICHVILLE', sous_categorie_pdv: 'Boutique C', categorie_pdv: 'Point de vente détail',
  canal: 'General trade', distributor_name: 'SIDECOM', geolocation_lat: 5.3, geolocation_lng: -4.0, is_active: true, telephone: null, ...extra,
})
const PDVS = [
  p('B1', 'Sow rue 44 treichville', 'Après la mosquée', 'Belleville'),
  p('B2', 'Diallo treichville avenue 6', 'Avenue 6 rue 16 barrée', 'France Amerique'),
  p('B3', 'Diallo  ousmane  av 09 rue 18', 'Av 09', 'Quartier Appolo'),
  p('B4', 'Barry ibrahim 3 avenue 7 treichville', 'Avenue 7 rue 24', 'Quartier Appolo', { telephone: '01 01 01 01 01' }),
  // Doublon de la base : même nom, même adresse.
  p('B5', 'Aladji', 'Treichville avenue 13 rue  17', 'Quartier Appolo'),
  p('B6', 'Aladji', 'Treichville avenue 13 rue 17', 'Quartier Appolo'),
  // Deux « fall » à la même adresse : ambigu.
  p('B7', 'Fall talla', 'Av 20 rue 17', 'Quartier Appolo'),
  p('B8', 'Fall treichville avenue 20 rue 17', 'Treichville avenue 20 rue 17', 'Quartier Appolo'),
  p('B9', 'Supérette avenue 2', 'Avenue 2 rue 3', 'Biafra', { sous_categorie_pdv: 'Superette GT' }),
  p('B10', 'Kiosque test', 'Avenue 1', 'Belleville', { sous_categorie_pdv: 'Kiosque', categorie_pdv: 'Point de consommation' }),
  p('B11', 'Boutique aras', 'Avenue 3 rue 38', 'Aras'),
]
const donnees = (extra: any = {}) => {
  const { lignes } = lireListePdv(FEUILLES)
  const profil = { id: M, nom: 'GUI STEPHANE', email: 'gui@x.ci', territoires_assignes: ['TREICHVILLE', 'MARCORY'], quartiers_assignes: ['Belleville', 'Biafra', 'France Amerique', 'Quartier Appolo'], zone_assignee: null }
  return {
    lignes,
    d: {
      merchDeLigne: new Map(lignes.map((l: any) => [l, { profil, certitude: 'choisi' }])),
      inconnus: new Map(),
      profils: [profil],
      zonesPerimetre: ['TREICHVILLE', 'MARCORY'],
      pdvs: PDVS,
      regles: [{ id: T_AVANT, user_id: M, label: 'Liste PDV — Lundi — TREICHVILLE › Belleville', territoire: 'TREICHVILLE', days_of_week: [1], date_debut: '2026-10-12', notes: null, is_active: true }],
      reglesPdv: [{ template_id: T_AVANT, pdv_id: 'B1', position_order: 1 }],
      migrationAppliquee: true,
      ...extra,
    },
  }
}

describe('lecture de la liste', () => {
  const { lignes, avecMerch } = lireListePdv(FEUILLES)
  it('une feuille par jour ; titre, ligne vide et second bloc sans en-tête', () => {
    expect(avecMerch).toBe(false)
    expect(lignes).toHaveLength(12)
    expect(lignes.map((l: any) => l.jours.join(','))).toEqual(['1', '1', '2', '2', '3', '3', '3', '3', '3', '3', '', ''])
    expect(lignes[2]).toMatchObject({ feuille: 'mardi', nom: 'Diallo treichville avenue 6', adresse: 'Avenue 6 rue 16 barrée', quartier: 'France Amerique', type: 'Boutique C' })
    expect(lignes[4]).toMatchObject({ nom: 'diallo idrisse', adresse: 'avenue 9 rue 18', contact: '07 78 01 64 03' })
  })

  it('CSV avec colonnes Merchandiser et Jour', () => {
    const csv = 'Merchandiser;Jour;Nom du PDV;Localisation;Secteur;Contact;Type\nGui;Lundi, Jeudi;Boutique 1;Avenue 1 rue 2;Biafra;;c\nGui;;Aboki 2;Avenue 22 rue 15;Quartier Appolo;;Aboki\n'
    const r = lireListePdvCsv(csv)
    expect(r.avecMerch).toBe(true)
    expect(r.lignes.map((l: any) => [l.merch, l.jours])).toEqual([['Gui', [1, 4]], ['Gui', []]])
  })

  it('refuse un fichier sans les colonnes attendues', () => {
    expect(() => lireListePdvCsv('A;B\n1;2\n')).toThrow(/Nom du PDV/)
  })
})

describe('normalisations', () => {
  it('adresse « avenue N rue M », même collée ou abrégée', () => {
    expect(['avenue 11rue 18', 'Av 09 rue 18', 'Avenue 5  rue 20 barrée', 'avenue rue 18', 'Rue 44'].map(cleAdresse))
      .toEqual(['AV11 RUE18', 'AV9 RUE18', 'AV5 RUE20', null, null])
    expect(avenueDe('Treichville avenue 13 rue  17')).toBe(13)
  })
  it('quartiers écrits autrement', () => {
    expect(cleQuartier('quartier  apolo')).toBe(cleQuartier('Quartier Appolo'))
    expect(cleQuartier('arras')).toBe(cleQuartier('Aras'))
    expect(cleQuartier('France Afrique')).not.toBe(cleQuartier('France Amerique'))
  })
  it('types de l’agence → sous-catégories de la base (sans accent pour les quotas)', () => {
    expect(['c', 'b', 'boutique C', 'supérette ', 'kiosque ', 'aboki', 'petit DMG', 'Porridge', 'inconnu'].map(t => typeDe(t).sous_categorie_pdv))
      .toEqual(['Boutique C', 'Boutique B', 'Boutique C', 'Superette GT', 'Kiosque', 'Aboki', 'Autre PDV détail (GT)', 'Porridge', 'Boutique C'])
    expect(typeDe('inconnu').reconnu).toBe(false)
  })
  it('téléphone groupé par deux chiffres', () => {
    expect(['07  87 71 52 60', '01 42 1062 44', ' ', '-'].map(telephoneDe)).toEqual(['07 87 71 52 60', '01 42 10 62 44', null, null])
  })
  it('même gérant : le nom court contenu dans l’autre', () => {
    expect(gerantsCompatibles(['DIALLO'], ['MOHAMED', 'DIALLO'])).toBe(true)
    expect(gerantsCompatibles(['ALASSANE'], ['ALLASSANE'])).toBe(true)
    expect(gerantsCompatibles(['DIALLO', 'IDRISSE'], ['DIALLO', 'OUSMANE'])).toBe(false)
  })
})

describe('rapprochement avec la base', () => {
  const { lignes } = lireListePdv(FEUILLES)
  const r = rapprocher(lignes, PDVS, { motsLieux: new Set(['TREICHVILLE', 'BELLEVILLE']) })
  const de = (nom: string, i = 0) => r.get(lignes.filter((l: any) => l.nom === nom)[i])
  it('nom et adresse identiques', () => {
    expect(de('Sow rue 44 treichville')).toMatchObject({ pdv: { pdv_id: 'B1' }, niveau: 'nom et adresse' })
    expect(de('Diallo treichville avenue 6')).toMatchObject({ pdv: { pdv_id: 'B2' }, niveau: 'nom et adresse' })
  })
  it('avenue, rue et gérant ; doublon de la base : le premier', () => {
    expect(de('barri Ibrahim')).toMatchObject({ pdv: { pdv_id: 'B4' }, niveau: 'adresse et gérant' })
    expect(de('aladji')).toMatchObject({ pdv: { pdv_id: 'B5' }, niveau: 'adresse et gérant' })
  })
  it('gérant différent à la même adresse : pas de rapprochement', () => {
    expect(de('diallo idrisse').pdv).toBeNull()
  })
  it('plusieurs PDV possibles : pistes, pas de rapprochement', () => {
    expect(de('fall').pdv).toBeNull()
    expect(de('fall').pistes.map((x: any) => x.pdv_id).sort()).toEqual(['B7', 'B8'])
  })
  it('une boutique et un kiosque « diallo » à la même adresse : deux PDV', () => {
    expect(de('diallo', 0).meme).toBeUndefined()
    expect(de('diallo', 1).meme).toBeUndefined()
  })
})

describe('simulation', () => {
  const { lignes, d } = donnees()
  const res = simulerListePdv(lignes, d, { fichier: 'treichville.xlsx', debut: '2026-10-19', aujourdhui: '2026-10-14', marqueur: 'import-liste-pdv-202610141500', auteurId: AUTEUR })
  const ops = res.operations as any[]
  const de = (type: string) => ops.filter(o => o.type === type)

  it('PDV existants gardés, autres créés sans GPS', () => {
    expect(res.resume).toMatchObject({ lignes: 12, pdvExistants: 4, pdvCrees: 8, aVerifier: 1, nonPlanifies: 2, regles: 3 })
    const crees = de('pdv.creer').flatMap(o => o.lignes)
    expect(crees.every((c: any) => c.geolocation_lat === null && c.ajoute_par === 'import-liste-pdv-202610141500')).toBe(true)
    expect(crees.find((c: any) => c.nom_pdv === 'Supérette baraka treichville avenue 2'))
      .toMatchObject({ sous_categorie_pdv: 'Superette GT', categorie_pdv: 'Point de vente détail', zone: 'TREICHVILLE', quartier: 'Biafra', distributor_name: 'SIDECOM' })
  })

  it('quartiers : ramenés à la base, gardés s’ils sont inconnus, déduits de l’avenue s’ils manquent', () => {
    const crees = de('pdv.creer').flatMap(o => o.lignes)
    expect(crees.find((c: any) => c.nom_pdv === 'fall').quartier).toBe('Quartier Appolo')
    expect(crees.find((c: any) => c.nom_pdv === 'supérette avenue 8').quartier).toBe('Aras')
    expect(crees.find((c: any) => c.nom_pdv === 'moustapha').quartier).toBe('France Afrique')
    expect(crees.find((c: any) => c.nom_pdv === 'diallo idrisse').quartier).toBe('Quartier Appolo')
    expect(res.rapport).toMatch(/« arras » → Aras — même quartier, écrit autrement/)
    expect(res.rapport).toMatch(/« France Afrique » → France Afrique — inconnu dans la base/)
    expect(res.rapport).toMatch(/\(secteur vide\) → Quartier Appolo/)
  })

  it('téléphone : sur les PDV créés, et seulement là où il manque', () => {
    const crees = de('pdv.creer').flatMap(o => o.lignes)
    expect(crees.find((c: any) => c.nom_pdv === 'diallo idrisse').telephone).toBe('07 78 01 64 03')
    expect(crees.find((c: any) => c.nom_pdv === 'supérette avenue 8')).toMatchObject({ telephone: '01 41 58 01 81', sous_categorie_pdv: 'Superette GT' })
    // B4 a déjà un téléphone : pas de mise à jour.
    expect(de('pdv.maj')).toEqual([])
  })

  it('une règle par jour, mode périmètre, toute la liste ; la feuille « autres » n’est pas planifiée', () => {
    const op = de('regles_liste.remplacer')[0]
    expect(op).toMatchObject({ user_id: M, territoire: 'TREICHVILLE', created_by: AUTEUR })
    expect(op.regles.map((r: any) => [r.days_of_week, r.pdv_ids.length, r.date_debut])).toEqual([[[1], 2, '2026-10-19'], [[2], 2, '2026-10-19'], [[3], 6, '2026-10-19']])
    expect(op.regles[0].label).toBe('Liste PDV — Lundi — TREICHVILLE › Belleville')
    expect(op.regles[0].pdv_ids[0]).toBe('B1')
    const autres = lignes.filter((l: any) => l.feuille === 'autres')
    expect(autres).toHaveLength(2)
    expect(res.rapport).toMatch(/feuille « autres »\) : 2/)
  })

  it('périmètre : le quartier inconnu est ajouté pour que le merchandiser voie ses PDV', () => {
    expect(de('profil.perimetre')).toEqual([expect.objectContaining({ user_id: M, quartiers_assignes: expect.arrayContaining(['France Afrique', 'Aras', 'Belleville']) })])
    expect(res.rapport).toMatch(/Périmètre élargi.*quartier France Afrique/)
  })

  it('tournées des 7 prochains jours recalculées', () => {
    expect(de('tournees.recalculer')).toEqual([{ type: 'tournees.recalculer', user_id: M, debut: '2026-10-15', fin: '2026-10-21' }])
  })

  it('opérations et retour arrière valides pour cet import ; retour = listes d’avant', () => {
    for (const op of [...ops, ...res.retour]) expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['liste-pdv'])).not.toThrow()
    const avant = (res.retour as any[]).find(o => o.type === 'regles_liste.remplacer')
    expect(avant.regles).toEqual([expect.objectContaining({ label: 'Liste PDV — Lundi — TREICHVILLE › Belleville', pdv_ids: ['B1'] })])
    expect((res.retour as any[]).find(o => o.type === 'pdv.supprimer').pdv_ids).toHaveLength(8)
    // Ordre : périmètre et PDV avant les règles qui les citent.
    expect(ops.findIndex(o => o.type === 'pdv.creer')).toBeLessThan(ops.findIndex(o => o.type === 'regles_liste.remplacer'))
  })

  it('bloqué tant que la migration du téléphone n’est pas appliquée', () => {
    const x = donnees({ migrationAppliquee: false })
    const r2 = simulerListePdv(x.lignes, x.d, { aujourdhui: '2026-10-14' })
    expect(r2.bloquants).toHaveLength(1)
    expect(r2.operations.flatMap((o: any) => o.lignes || []).some((l: any) => 'telephone' in l)).toBe(false)
  })

  it('sans merchandiser : bloqué', () => {
    const x = donnees({ merchDeLigne: new Map() })
    expect(simulerListePdv(x.lignes, x.d, { aujourdhui: '2026-10-14' }).bloquants).toEqual(['Choisissez le merchandiser : le fichier n’a pas de colonne « Merchandiser ».'])
  })
})

describe('une semaine sur deux (colonne « Semaines »)', () => {
  // Réponse d'Atom du 15/10/2026 : chaque liste du jour en deux moitiés, en alternance.
  const CSV = [
    'Jour;Semaines;Nom du PDV;Localisation;Secteur;Contact;Type',
    'Lundi;1 et 3;Sow rue 44 treichville;Après la mosquée;Belleville;;Boutique C',
    'Lundi;2 et 4;Diallo treichville avenue 6;Avenue 6 rue 16 barrée;France Amerique;;Boutique C',
    'Lundi;S2 + S4;Kiosque test;Avenue 1;Belleville;;Kiosque',
    'Mardi;;Boutique aras;Avenue 3 rue 38;Aras;;Boutique C',
  ].join('\n')
  const sim = () => {
    const { lignes } = lireListePdvCsv(CSV)
    const x = donnees()
    const profil = x.d.profils[0]
    return simulerListePdv(lignes, { ...x.d, merchDeLigne: new Map(lignes.map((l: any) => [l, { profil, certitude: 'choisi' }])) }, { aujourdhui: '2026-10-15', debut: '2026-10-19' })
  }

  it('adresse sans avenue ni secteur : zone principale de la liste', () => {
    const csv = `${CSV}\nMercredi;2 et 4;diallo;avenue rue 18;;;Boutique C`
    const { lignes } = lireListePdvCsv(csv)
    const x = donnees()
    const profil = x.d.profils[0]
    const res = simulerListePdv(lignes, { ...x.d, merchDeLigne: new Map(lignes.map((l: any) => [l, { profil, certitude: 'choisi' }])) }, { aujourdhui: '2026-10-15' })
    const cree = res.operations.find((o: any) => o.type === 'pdv.creer').lignes[0]
    expect(cree).toMatchObject({ nom_pdv: 'diallo', zone: 'TREICHVILLE', quartier: null })
  })

  it('lit les semaines du mois ; vide, « toutes » ou 1 à 4 = chaque semaine', () => {
    expect(['1 et 3', 'S2+S4', '2,4', 'impaires', 'semaines paires', '', 'toutes', '1, 2, 3, 4'].map(lireSemaines))
      .toEqual([[1, 3], [2, 4], [2, 4], [1, 3], [2, 4], null, null, null])
    expect(() => lireSemaines('A')).toThrow(/Semaines/)
  })

  it('une règle par jour et par moitié, avec ses semaines du mois', () => {
    const op = sim().operations.find((o: any) => o.type === 'regles_liste.remplacer')
    expect(op.regles.map((r: any) => [r.days_of_week, r.semaines_du_mois, r.pdv_ids])).toEqual([
      [[1], [1, 3], ['B1']],
      [[1], [2, 4], ['B2', 'B10']],
      [[2], null, ['B11']],
    ])
    expect(op.regles[0].label).toBe('Liste PDV — Lundi (semaines 1 et 3) — TREICHVILLE › Belleville')
    expect(op.regles[2].label).toBe('Liste PDV — Mardi — TREICHVILLE › Aras')
    expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['liste-pdv'])).not.toThrow()
    expect(() => validerOperation({ ...op, regles: [{ ...op.regles[0], semaines_du_mois: [6] }] })).toThrow(/semaines/)
  })

  it('rapport : semaines de chaque règle ; retour = liste d’avant, chaque semaine', () => {
    const res = sim()
    expect(res.rapport).toMatch(/\| Lundi \| 2, 4 \| Lundi \(semaines 2 et 4\)/)
    expect(res.rapport).toMatch(/jours 29 à 31 suivent le réglage/)
    const avant = (res.retour as any[]).find(o => o.type === 'regles_liste.remplacer')
    expect(avant.regles[0]).toMatchObject({ semaines_du_mois: null, pdv_ids: ['B1'] })
  })
})

describe('validation de l’opération regles_liste.remplacer', () => {
  const ok = { type: 'regles_liste.remplacer', user_id: M, territoire: 'TREICHVILLE', regles: [{ label: 'Liste PDV — Lundi — X', days_of_week: [1], pdv_ids: ['B1'] }] }
  it('accepte une liste valide, refuse un autre libellé ou un territoire vide', () => {
    expect(() => validerOperation(ok, OPERATIONS_PAR_IMPORT['liste-pdv'])).not.toThrow()
    expect(() => validerOperation({ ...ok, regles: [{ ...ok.regles[0], label: 'Routing mensuel — Lundi' }] })).toThrow(/Liste PDV/)
    expect(() => validerOperation({ ...ok, territoire: '' })).toThrow(/territoire/)
    // Réservée à cet import.
    expect(() => validerOperation(ok, OPERATIONS_PAR_IMPORT['routing-mensuel'])).toThrow(/refusé/)
  })
})
