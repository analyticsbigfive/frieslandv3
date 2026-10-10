// utils/pdvAgence.ts
// Points de vente › PDV de l'agence : états d'un PDV (sans GPS, jamais visité,
// pas revu depuis 60 jours, visité une seule fois) et filtres de la liste.
// Les lignes viennent de la fonction pdv_agence (migration 20261010190000).
//
// TypeScript pur, sans import Vue ni alias « ~ » : testé par vitest
// (tests/pdvAgence.spec.ts).

export interface PdvAgence {
  pdv_id: string
  nom_pdv: string | null
  zone: string | null
  quartier: string | null
  canal: string | null
  sous_categorie_pdv: string | null
  distributor_name: string | null
  adressage: string | null
  geolocation_lat: number | null
  geolocation_lng: number | null
  /** Merchandiser de l'agence qui a recensé le PDV (pdv.ajoute_par ou created_by). */
  recense_par: string | null
  nb_visites: number
  derniere_visite: string | null
  dernier_merchandiser: string | null
}

export type EtatPdvAgence = 'tous' | 'sans-gps' | 'jamais-visite' | 'plus-60-jours' | 'une-visite'

export const JOURS_SANS_VISITE = 60

export const ETATS_PDV_AGENCE: { value: EtatPdvAgence, label: string, aide: string }[] = [
  { value: 'tous', label: 'Tous', aide: 'Tous les points de vente visités ou recensés par les merchandisers de l\'agence.' },
  { value: 'sans-gps', label: 'Sans GPS', aide: 'Sans position, le point de vente n\'entre pas dans une tournée par point GPS. La prochaine visite dans l\'application enregistre sa position.' },
  { value: 'jamais-visite', label: 'Jamais visités', aide: 'Recensés par un merchandiser, jamais visités depuis.' },
  { value: 'plus-60-jours', label: `Pas vus depuis ${JOURS_SANS_VISITE} jours`, aide: `Déjà visités, mais pas revus depuis plus de ${JOURS_SANS_VISITE} jours.` },
  { value: 'une-visite', label: 'Visités une seule fois', aide: 'Une seule visite enregistrée.' },
]

/** État lu dans l'URL (?etat=) ; « tous » par défaut. */
export function lireEtat(valeur: unknown): EtatPdvAgence {
  const v = Array.isArray(valeur) ? valeur[0] : valeur
  return ETATS_PDV_AGENCE.some(e => e.value === v) ? (v as EtatPdvAgence) : 'tous'
}

export function aGps(p: Pick<PdvAgence, 'geolocation_lat' | 'geolocation_lng'>): boolean {
  return p.geolocation_lat != null && p.geolocation_lng != null
    && Number.isFinite(Number(p.geolocation_lat)) && Number.isFinite(Number(p.geolocation_lng))
}

/** Merchandiser rattaché au PDV : celui de la dernière visite, sinon celui qui l'a recensé. */
export function merchandiserDe(p: Pick<PdvAgence, 'dernier_merchandiser' | 'recense_par'>): string | null {
  return p.dernier_merchandiser || p.recense_par || null
}

export function correspondEtat(p: PdvAgence, etat: EtatPdvAgence, maintenant: Date = new Date()): boolean {
  switch (etat) {
    case 'sans-gps': return !aGps(p)
    case 'jamais-visite': return !p.nb_visites
    case 'une-visite': return p.nb_visites === 1
    case 'plus-60-jours': {
      if (!p.nb_visites || !p.derniere_visite) return false
      const limite = maintenant.getTime() - JOURS_SANS_VISITE * 86_400_000
      return new Date(p.derniere_visite).getTime() < limite
    }
    default: return true
  }
}

export function compterEtats(lignes: PdvAgence[], maintenant: Date = new Date()): Record<EtatPdvAgence, number> {
  const n = { 'tous': 0, 'sans-gps': 0, 'jamais-visite': 0, 'plus-60-jours': 0, 'une-visite': 0 } as Record<EtatPdvAgence, number>
  for (const p of lignes) {
    for (const { value } of ETATS_PDV_AGENCE) if (correspondEtat(p, value, maintenant)) n[value]++
  }
  return n
}

/** Texte comparable : casse, accents et espaces multiples ignorés. */
export function normaliser(texte: string | null | undefined): string {
  return String(texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface FiltresPdvAgence {
  etat: EtatPdvAgence
  /** Nom, téléphone, quartier, zone ou identifiant. */
  recherche?: string
  zone?: string
  merchandiser?: string
}

export function filtrerPdvAgence(lignes: PdvAgence[], f: FiltresPdvAgence, maintenant: Date = new Date()): PdvAgence[] {
  const mots = normaliser(f.recherche).split(' ').filter(Boolean)
  const chiffres = String(f.recherche ?? '').replace(/\D/g, '')
  return lignes.filter((p) => {
    if (!correspondEtat(p, f.etat, maintenant)) return false
    if (f.zone && p.zone !== f.zone) return false
    if (f.merchandiser && merchandiserDe(p) !== f.merchandiser) return false
    if (!mots.length) return true
    const texte = normaliser([p.nom_pdv, p.quartier, p.zone, p.pdv_id, p.adressage].join(' '))
    if (mots.every(m => texte.includes(m))) return true
    return chiffres.length >= 4 && String(p.adressage ?? '').replace(/\D/g, '').includes(chiffres)
  })
}

/** Lien Google Maps d'un PDV géolocalisé (export, liste à vérifier). */
export function lienGoogleMaps(p: Pick<PdvAgence, 'geolocation_lat' | 'geolocation_lng'>): string {
  return aGps(p) ? `https://www.google.com/maps/search/?api=1&query=${p.geolocation_lat},${p.geolocation_lng}` : ''
}
