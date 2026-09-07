import { describe, it, expect } from 'vitest'
import {
  TYPES_ACTION_DEFAUT,
  calculerEtatFraicheur,
  estEnRetard,
  estOuverte,
  libelleFraicheur,
  statutActionLabel,
  transitionsAssigne,
  typesActifs,
} from '../utils/actionsCommerciales'

// Lot 3 (1.0.4) : le commercial décide des actions, le merchandiseur les
// exécute. La fraîcheur reflète pdv_fraicheur_filtre (20260907130000).
describe('actions commerciales', () => {
  it('trie les types actifs par ordre et ignore les inactifs', () => {
    const types = [
      { code: 'z', libelle: 'Z', ordre: 5, actif: false },
      { code: 'b', libelle: 'B', ordre: 20, actif: true },
      { code: 'a', libelle: 'A', ordre: 10, actif: true },
    ]
    expect(typesActifs(types).map(t => t.code)).toEqual(['a', 'b'])
    expect(typesActifs(TYPES_ACTION_DEFAUT).map(t => t.code)).toEqual(['activation_ssr', 'activation_ssm', 'referencement_produit'])
  })

  it('distingue ouverte / fermée et libelle les statuts', () => {
    expect(estOuverte({ statut: 'a_faire' })).toBe(true)
    expect(estOuverte({ statut: 'en_cours' })).toBe(true)
    expect(estOuverte({ statut: 'faite' })).toBe(false)
    expect(estOuverte({ statut: 'annulee' })).toBe(false)
    expect(statutActionLabel('a_faire')).toBe('À faire')
    expect(statutActionLabel('inconnu')).toBe('inconnu')
  })

  it('signale le retard seulement sur une action ouverte à échéance passée', () => {
    const today = new Date('2026-09-07T12:00:00Z')
    expect(estEnRetard({ statut: 'a_faire', echeance: '2026-09-06' }, today)).toBe(true)
    expect(estEnRetard({ statut: 'a_faire', echeance: '2026-09-07' }, today)).toBe(false)
    expect(estEnRetard({ statut: 'faite', echeance: '2026-09-01' }, today)).toBe(false)
    expect(estEnRetard({ statut: 'a_faire', echeance: null }, today)).toBe(false)
  })

  it("l'assigné avance sans réouvrir", () => {
    expect(transitionsAssigne('a_faire')).toEqual(['en_cours', 'faite'])
    expect(transitionsAssigne('en_cours')).toEqual(['faite'])
    expect(transitionsAssigne('faite')).toEqual([])
    expect(transitionsAssigne('annulee')).toEqual([])
  })
})

describe('fraîcheur de visite', () => {
  const today = new Date('2026-09-07T10:00:00Z')

  it('jamais visité sans date', () => {
    expect(calculerEtatFraicheur(null, 7, today)).toEqual({ etat: 'jamais_visite', joursDepuis: null })
  })

  it('à jour dans la fréquence, en retard au-delà (strictement)', () => {
    expect(calculerEtatFraicheur('2026-09-07T08:00:00Z', 7, today)).toEqual({ etat: 'a_jour', joursDepuis: 0 })
    expect(calculerEtatFraicheur('2026-08-31T08:00:00Z', 7, today)).toEqual({ etat: 'a_jour', joursDepuis: 7 })
    expect(calculerEtatFraicheur('2026-08-30T08:00:00Z', 7, today)).toEqual({ etat: 'en_retard', joursDepuis: 8 })
  })

  it('respecte une fréquence surchargée', () => {
    expect(calculerEtatFraicheur('2026-08-30T08:00:00Z', 14, today).etat).toBe('a_jour')
  })

  it('libellés lisibles', () => {
    expect(libelleFraicheur('jamais_visite', null)).toBe('Jamais visité')
    expect(libelleFraicheur('a_jour', 0)).toBe("Visité aujourd'hui")
    expect(libelleFraicheur('a_jour', 1)).toBe('Visité hier')
    expect(libelleFraicheur('en_retard', 12)).toBe('Il y a 12 j')
  })
})

import { lienWhatsApp, messageActionsPourMerchandiser, normaliserTelephoneInternational } from '../utils/actionsCommerciales'

describe('WhatsApp', () => {
  it('normalise un numéro ivoirien local ou international', () => {
    expect(normaliserTelephoneInternational('07 08 09 10 11')).toBe('2250708091011')
    expect(normaliserTelephoneInternational('+225 07 08 09 10 11')).toBe('2250708091011')
    expect(normaliserTelephoneInternational('00225 0708091011')).toBe('2250708091011')
    expect(normaliserTelephoneInternational('')).toBeNull()
    expect(normaliserTelephoneInternational('abc')).toBeNull()
  })

  it('construit un lien wa.me encodé et un message listant les actions ouvertes', () => {
    const actions = [
      { type_code: 'activation_ssr', type: { libelle: 'Activation SSR' }, statut: 'a_faire' as const, echeance: '2026-09-15', commentaire: 'Voir le gérant', pdv: { nom_pdv: 'Kadi porridge' } },
      { type_code: 'referencement_produit', statut: 'faite' as const, echeance: null, commentaire: null, pdv: { nom_pdv: 'Bouné' } },
    ]
    const msg = messageActionsPourMerchandiser('Hermann', actions, 'QA Commercial')
    expect(msg).toContain('Bonjour Hermann')
    expect(msg).toContain('1. Kadi porridge : Activation SSR — avant le 15/09 (Voir le gérant)')
    expect(msg).not.toContain('Bouné')
    const lien = lienWhatsApp('0708091011', msg)!
    expect(lien.startsWith('https://wa.me/2250708091011?text=Bonjour%20Hermann')).toBe(true)
    expect(lienWhatsApp(null, msg)).toBeNull()
  })
})
