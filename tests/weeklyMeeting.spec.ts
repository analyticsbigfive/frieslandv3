import { describe, expect, it } from 'vitest'
import PptxGenJS from 'pptxgenjs'
import {
  choisirPhotos, construireRapport, derniereSemaineEcoulee, disponibiliteProduits, evolution, fmtPct, indexAuteurs,
  joursDeSemaine, libelleSemaine, nomFichierWeekly, numeroSemaine, semaineHebdo, semainePrecedente, semaineSuivante,
  type EntreeRapport, type MembreAgence, type VisiteHebdo,
} from '../utils/weeklyMeeting'
import { construirePresentation } from '../utils/weeklyMeetingPptx'

const membres: MembreAgence[] = [
  { id: 'a', nom: 'Awa', email: 'awa@x.ci', role: 'merchandiser', is_active: true },
  { id: 'b', nom: 'Bakary', email: 'Bakary@x.ci', role: 'merchandiser', is_active: true },
  { id: 'c', nom: 'Chantal', email: 'chantal@x.ci', role: 'merchandiser', is_active: true },
  { id: 'd', nom: 'Ancien', email: 'ancien@x.ci', role: 'merchandiser', is_active: false },
  { id: 'r', nom: 'Responsable', email: 'resp@x.ci', role: 'agence', is_active: true },
]

const resultat = (niveau: string | null, dispo: number | null = 50, visibilite = 40) =>
  ({ niveau, dispo_rayon: dispo, visibilite, score_global: 45, calcule_le: '2026-11-14T00:00:00+00:00' })

function visite(v: Partial<VisiteHebdo> & { id: string }): VisiteHebdo {
  return { pdv_id: 'P1', user_id: 'a', email: null, date_visite: '2026-11-09T08:00:00+00:00', resultat: null, ...v }
}

const semaine = semaineHebdo('2026-11-11')

function entree(e: Partial<EntreeRapport> = {}): EntreeRapport {
  return {
    agence: { code: 'atom', nom: 'Atom BTL', direction: 'south' },
    semaine,
    membres,
    visites: [],
    visitesPrecedentes: [],
    tournees: [],
    tourneesPrecedentes: [],
    fermetures: [],
    catalogue: [],
    elementsVisibilite: [],
    ...e,
  }
}

describe('semaine du lundi au samedi', () => {
  it('va du lundi au samedi, quel que soit le jour choisi', () => {
    expect(semaineHebdo('2026-11-09')).toEqual({ debut: '2026-11-09', fin: '2026-11-14' })
    expect(semaineHebdo('2026-11-14')).toEqual({ debut: '2026-11-09', fin: '2026-11-14' })
    expect(semaineHebdo(new Date(2026, 10, 11))).toEqual({ debut: '2026-11-09', fin: '2026-11-14' })
  })

  it('rattache le dimanche à la semaine qui s\'achève', () => {
    expect(semaineHebdo('2026-11-15')).toEqual({ debut: '2026-11-09', fin: '2026-11-14' })
  })

  it('propose la dernière semaine terminée', () => {
    expect(derniereSemaineEcoulee(new Date(2026, 10, 17))).toEqual({ debut: '2026-11-09', fin: '2026-11-14' }) // mardi
    expect(derniereSemaineEcoulee(new Date(2026, 10, 14))).toEqual({ debut: '2026-11-02', fin: '2026-11-07' }) // samedi : semaine en cours
    expect(derniereSemaineEcoulee(new Date(2026, 10, 15))).toEqual({ debut: '2026-11-09', fin: '2026-11-14' }) // dimanche
  })

  it('passe d\'une semaine à l\'autre, y compris d\'une année à l\'autre', () => {
    expect(semainePrecedente(semaine)).toEqual({ debut: '2026-11-02', fin: '2026-11-07' })
    expect(semaineSuivante(semaine)).toEqual({ debut: '2026-11-16', fin: '2026-11-21' })
    expect(semaineSuivante(semaineHebdo('2026-12-23'))).toEqual({ debut: '2026-12-28', fin: '2027-01-02' })
    expect(joursDeSemaine(semaine)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'])
  })

  it('nomme la semaine', () => {
    expect(libelleSemaine(semaine)).toBe('du 9 au 14 novembre 2026')
    expect(libelleSemaine(semaineHebdo('2026-11-30'))).toBe('du 30 novembre au 5 décembre 2026')
    expect(libelleSemaine(semaineHebdo('2026-12-28'))).toBe('du 28 décembre 2026 au 2 janvier 2027')
    expect(libelleSemaine(semaineHebdo('2026-06-01'))).toBe('du 1er au 6 juin 2026')
    expect(numeroSemaine(semaine)).toBe(46)
    expect(numeroSemaine(semaineHebdo('2026-12-28'))).toBe(53)
    expect(numeroSemaine(semaineHebdo('2027-01-04'))).toBe(1)
    expect(nomFichierWeekly('Hello Event Communication & Événementiel', semaine)).toBe('weekly-meeting-hello-event-communication-evenementiel-2026-11-09.pptx')
  })
})

describe('auteur d\'une visite', () => {
  const auteur = indexAuteurs(membres)

  it('lit user_id, sinon l\'e-mail sans tenir compte de la casse', () => {
    expect(auteur({ user_id: 'b', email: null })?.nom).toBe('Bakary')
    expect(auteur({ user_id: null, email: 'bakary@X.ci' })?.nom).toBe('Bakary')
    expect(auteur({ user_id: 'inconnu', email: 'awa@x.ci' })).toBeNull()
    expect(auteur({ user_id: null, email: null })).toBeNull()
  })
})

describe('rapport de la semaine', () => {
  const visites: VisiteHebdo[] = [
    // P1 vu deux fois : la dernière visite scorée fait foi (au standard).
    visite({ id: '1', pdv_id: 'P1', date_visite: '2026-11-09T08:00:00+00:00', resultat: resultat(null, 20) }),
    visite({ id: '2', pdv_id: 'P1', date_visite: '2026-11-12T08:00:00+00:00', resultat: resultat('CORE PERFECT STORE', 80), situation_tournee: 'prevue' }),
    visite({ id: '3', pdv_id: 'P2', user_id: 'b', date_visite: '2026-11-10T09:00:00+00:00', resultat: resultat(null, null), situation_tournee: 'pdv_cree_sur_place', geofence_validated: false }),
    visite({ id: '4', pdv_id: 'P3', user_id: null, email: 'BAKARY@x.ci', date_visite: '2026-11-10T10:00:00+00:00', situation_tournee: null }),
  ]
  const r = construireRapport(entree({
    visites,
    visitesPrecedentes: [visite({ id: '0', date_visite: '2026-11-02T08:00:00+00:00' }), visite({ id: '00', pdv_id: 'P9', date_visite: '2026-11-03T08:00:00+00:00' })],
    tournees: [
      { user_id: 'a', date_routing: '2026-11-09', nb_pdv: 10, nb_faits: 4 },
      { user_id: 'c', date_routing: '2026-11-10', nb_pdv: 10, nb_faits: 0 },
    ],
    fermetures: [{ pdv_id: 'P7', nom_pdv: 'Chez Tantie', zone: 'ABOBO', quartier: null, declare_par: 'b', declare_le: '2026-11-11T10:00:00+00:00', decision: null, commentaire: null }],
  }))

  it('compte les visites, les points de vente et les merchandisers', () => {
    expect(r.chiffres.visites).toBe(4)
    expect(r.chiffres.pdv_visites).toBe(3)
    expect(r.chiffres.merchandisers_actifs).toBe(2)
    expect(r.effectif).toBe(3)
    expect(r.avant.visites).toBe(2)
  })

  it('garde la dernière visite scorée de chaque point de vente pour le Perfect Store', () => {
    expect(r.chiffres.pdv_evalues).toBe(2)
    expect(r.chiffres.pdv_perfect_store).toBe(1)
    expect(r.chiffres.perfect_store_pct).toBe(50)
    expect(r.chiffres.dispo_moyenne_pct).toBe(80)
    expect(r.chiffres.pdv_sans_seuil).toBe(1)
    expect(r.chiffres.visites_sans_releve).toBe(1)
    expect(r.chiffres.par_niveau.find(n => n.cle === 'CORE')?.nb_pdv).toBe(1)
  })

  it('rapproche les tournées et le terrain', () => {
    expect(r.chiffres.tournees).toBe(2)
    expect(r.chiffres.pdv_programmes).toBe(20)
    expect(r.chiffres.realisation_pct).toBe(20)
    expect(r.jours.map(j => j.visites)).toEqual([1, 2, 0, 1, 0, 0])
    expect(r.jours.map(j => j.visites_precedentes)).toEqual([1, 1, 0, 0, 0, 0])
    expect(r.jours[0].pdv_programmes).toBe(10)
    expect(r.situation).toEqual({ disponible: true, prevues: 1, ajoutees_jour: 0, hors_tournee: 1, dont_pdv_cree: 1, sans_tournee: 1 })
  })

  it('classe les merchandisers et garde ceux qui n\'ont qu\'une tournée', () => {
    expect(r.merchandisers.map(m => m.nom)).toEqual(['Awa', 'Bakary', 'Chantal'])
    expect(r.merchandisers[0]).toMatchObject({ visites: 2, pdv_visites: 1, jours_actifs: 2, realisation_pct: 40, pdv_perfect_store: 1 })
    expect(r.merchandisers[1]).toMatchObject({ visites: 2, hors_tournee: 1, visites_sans_releve: 1, realisation_pct: null })
    expect(r.merchandisers[2]).toMatchObject({ visites: 0, pdv_programmes: 10 })
  })

  it('relève les alertes', () => {
    expect(r.sans_visite).toEqual(['Chantal']) // ni l'inactif ni le compte agence
    expect(r.gps_non_valide).toBe(1)
    expect(r.fermetures[0]).toMatchObject({ nom_pdv: 'Chez Tantie', declarant: 'Bakary' })
  })

  it('signale une base sans situation de tournée', () => {
    const sans = construireRapport(entree({ visites: [visite({ id: '1' })] }))
    expect(sans.situation.disponible).toBe(false)
  })

  it('tient sans aucune donnée', () => {
    const vide = construireRapport(entree({ membres: [] }))
    expect(vide.chiffres).toMatchObject({ visites: 0, perfect_store_pct: null, realisation_pct: null })
    expect(vide.merchandisers).toEqual([])
  })
})

describe('disponibilité des produits', () => {
  const catalogue = [{ key: 'evap', label: 'EVAP', skus: [{ key: 'br_160g', label: 'BR 150g' }, { key: 'br_gold', label: 'BR Gold' }] }]

  it('garde la dernière visite de chaque point de vente', () => {
    const { skus, familles } = disponibiliteProduits([
      visite({ id: '1', pdv_id: 'P1', date_visite: '2026-11-09T08:00:00+00:00', data: { produits: { evap: { quantites: { br_160g: 0 } } } } }),
      visite({ id: '2', pdv_id: 'P1', date_visite: '2026-11-12T08:00:00+00:00', data: { produits: { evap: { quantites: { br_160g: 5 }, br_gold: 'En rupture' } } } }),
      visite({ id: '3', pdv_id: 'P2', data: { produits: { evap: { br_160g: 'Présent', br_gold: 'En rupture' } } } }),
      visite({ id: '4', pdv_id: 'P3' }), // sans relevé : hors du calcul
    ], catalogue)
    expect(skus[0]).toMatchObject({ sku: 'br_160g', releves: 2, disponibles: 1, ruptures: 0, dispo_pct: 50 })
    expect(skus[1]).toMatchObject({ sku: 'br_gold', releves: 2, disponibles: 0, ruptures: 2, dispo_pct: 0 })
    expect(familles[0]).toMatchObject({ releves: 4, disponibles: 1, dispo_pct: 25 })
  })
})

describe('visibilité et concurrence', () => {
  const r = construireRapport(entree({
    elementsVisibilite: [
      { code: 'affiche', nom: 'Affiche', pilier: 'visibilite' },
      { code: 'affiche', nom: 'Affiche (MT)', pilier: 'visibilite' },
      { code: 'hanger', nom: 'Hanger', pilier: 'visibilite' },
      { code: 'degustation', nom: 'Dégustation', pilier: 'promotion' },
    ],
    visites: [
      visite({ id: '1', data: { visibilite: { standards: { affiche: true, hanger: false, degustation: false } }, concurrence: { presence_concurrents: true, imp: { present: true, en_activite: true, action_concurrence: 'Promotion' }, autres: [{ nom: 'Cow Milk' }] } } }),
      visite({ id: '2', pdv_id: 'P2', data: { visibilite: { standards: { affiche: false } }, concurrence: { presence_concurrents: true, imp: { present: true, en_activite: true, action_concurrence: 'promotion' }, autres: [{ nom: 'cowmilk' }] } } }),
      visite({ id: '3', pdv_id: 'P3', data: { concurrence: { presence_concurrents: false } } }),
    ],
  }))

  it('compte chaque élément une fois, sans le pilier promotion', () => {
    expect(r.visibilite).toEqual([
      { code: 'affiche', nom: 'Affiche', emplacement: null, releves: 2, presents: 1, pct: 50 },
      { code: 'hanger', nom: 'Hanger', emplacement: null, releves: 1, presents: 0, pct: 0 },
    ])
  })

  it('résume la concurrence', () => {
    expect(r.concurrence.visites_renseignees).toBe(3)
    expect(r.concurrence.presence_pct).toBe(66.7)
    expect(r.concurrence.familles.find(f => f.categorie === 'imp')).toMatchObject({ presents: 2, en_activite: 2 })
    expect(r.concurrence.actions).toEqual([{ libelle: 'Promotion', nb: 2 }])
    expect(r.concurrence.signales).toEqual([{ nom: 'Cow Milk', signalements: 2, en_activite: 0 }])
  })
})

describe('photos de la semaine', () => {
  it('alterne les merchandisers et ignore les chemins non résolus', () => {
    const auteur = indexAuteurs(membres)
    const photos = choisirPhotos([
      visite({ id: '1', image_urls: ['https://x/a1.jpg'], date_visite: '2026-11-13T08:00:00+00:00' }),
      visite({ id: '2', image_urls: ['https://x/a2.jpg'], date_visite: '2026-11-12T08:00:00+00:00' }),
      visite({ id: '3', user_id: 'b', image_urls: ['VISITE_Images/x.jpg', 'https://x/b1.jpg'], date_visite: '2026-11-10T08:00:00+00:00' }),
      visite({ id: '4', user_id: 'b', image_urls: ['VISITE_Images/y.jpg'] }),
    ], auteur, 3)
    expect(photos.map(p => p.url)).toEqual(['https://x/a1.jpg', 'https://x/b1.jpg', 'https://x/a2.jpg'])
    expect(photos[1]).toMatchObject({ merchandiser: 'Bakary', jour: '2026-11-10' })
  })
})

describe('mise en forme', () => {
  it('écrit les taux à la française', () => {
    expect(fmtPct(42.5)).toBe('42,5 %')
    expect(fmtPct(40)).toBe('40 %')
    expect(fmtPct(null)).toBe('—')
  })

  it('compare à la semaine précédente', () => {
    expect(evolution(110, 100)).toEqual({ texte: '+10 % (+10)', sens: 'hausse' })
    expect(evolution(712, 713)).toEqual({ texte: '−1', sens: 'baisse' })
    expect(evolution(5, 0)).toEqual({ texte: '+5', sens: 'hausse' })
    expect(evolution(7, 7).sens).toBe('stable')
    expect(evolution(41.3, 39.3, 'points')).toEqual({ texte: '+2 pt', sens: 'hausse' })
    expect(evolution(null, 39.3, 'points').sens).toBe('inconnu')
  })
})

describe('présentation PowerPoint', () => {
  it('se génère avec et sans données', async () => {
    const plein = construireRapport(entree({
      visites: [visite({ id: '1', resultat: resultat('VIP PERFECT STORE'), situation_tournee: 'prevue' })],
      tournees: [{ user_id: 'a', date_routing: '2026-11-09', nb_pdv: 10, nb_faits: 4 }],
    }))
    for (const r of [plein, construireRapport(entree({ membres: [] }))]) {
      const fichier = await construirePresentation(PptxGenJS as any, r, [], 'South — Abidjan').write({ outputType: 'nodebuffer' }) as Buffer
      // Archive zip (PK) non vide.
      expect(fichier.subarray(0, 2).toString()).toBe('PK')
      expect(fichier.length).toBeGreaterThan(20000)
    }
  })
})
