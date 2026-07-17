export type VisibilitySegment =
  | 'boutique'
  | 'superette'
  | 'table_top'
  | 'pushcart'
  | 'porridge'
  | 'kiosque_aboki'
  | 'mt'

export type VisibilityPlacement = 'exterieure' | 'interieure' | 'promotion'

export interface VisibilityElementRef {
  id?: number
  segment: VisibilitySegment
  code: string
  nom: string
  pilier: 'visibilite' | 'promotion'
  emplacement: VisibilityPlacement
  optionnel: boolean
}

type ElementSeed = [
  code: string,
  nom: string,
  emplacement: VisibilityPlacement,
  optionnel?: boolean,
]

const ELEMENTS_BY_SEGMENT: Record<VisibilitySegment, ElementSeed[]> = {
  boutique: [
    ['affiche', 'Affiche', 'exterieure'],
    ['fleche', 'Flèche', 'exterieure', true],
    ['guirlande', 'Guirlande', 'exterieure', true],
    ['sign_board', 'Sign board', 'exterieure'],
    ['panneau_privilege', 'Panneau privilège', 'exterieure'],
    ['full_branding', 'Full branding', 'exterieure'],
    ['reglette', 'Réglette', 'interieure'],
    ['maison_br', 'Maison BR', 'interieure'],
    ['hanger', 'Hanger', 'interieure', true],
    ['wobler', 'Wobler', 'interieure', true],
    ['presentoir', 'Présentoir', 'interieure', true],
    ['tg', 'Tête de gondole', 'interieure', true],
    ['plaque_br', 'Plaque BR', 'interieure', true],
    ['merchandising', 'Merchandising', 'interieure'],
    ['standard', 'Standard promotionnel', 'promotion'],
    ['hotesses', 'Hôtesses', 'promotion'],
    ['degustation', 'Dégustation', 'promotion'],
  ],
  superette: [
    ['affiche', 'Affiche', 'exterieure', true],
    ['fleche', 'Flèche entrée/sortie', 'exterieure', true],
    ['sign_board', 'Sign board lumineux', 'exterieure', true],
    ['panneau_privilege', 'Panneau privilège lumineux', 'exterieure', true],
    ['reglette', 'Réglette', 'interieure', true],
    ['espace_br', 'Espace BR', 'interieure'],
    ['wobler', 'Wobler rayon', 'interieure', true],
    ['presentoir', 'Présentoir', 'interieure', true],
    ['tg', 'Tête de gondole', 'interieure', true],
    ['plaque_br', 'Plaque BR', 'interieure', true],
    ['merchandising', 'Merchandising', 'interieure'],
    ['standard', 'Standard promotionnel', 'promotion'],
    ['hotesses', 'Hôtesses', 'promotion'],
    ['degustation', 'Dégustation', 'promotion'],
  ],
  table_top: [
    ['parasol', 'Parasol', 'exterieure'],
    ['nappe', 'Nappe', 'interieure'],
    ['hanger', 'Hanger', 'interieure'],
    ['tablier', 'Tablier', 'interieure', true],
    ['promotion', 'Promotion', 'promotion'],
  ],
  pushcart: [
    ['affiche', 'Affiche', 'exterieure'],
    ['thermos', 'Thermos', 'interieure'],
    ['verre_jetable', 'Verre jetable', 'interieure', true],
    ['chasuble', 'Chasuble', 'interieure'],
    ['full_branding', 'Full branding', 'exterieure'],
    ['promotion', 'Promotion', 'promotion'],
  ],
  porridge: [
    ['parasol', 'Parasol', 'exterieure'],
    ['nappe', 'Nappe', 'interieure'],
    ['hanger', 'Hanger', 'interieure'],
    ['verre_jetable', 'Verre jetable', 'interieure', true],
    ['tablier', 'Tablier', 'interieure'],
    ['standard', 'Standard promotionnel', 'promotion'],
    ['degustation', 'Dégustation', 'promotion'],
  ],
  kiosque_aboki: [
    ['affiche', 'Affiche', 'exterieure'],
    ['thermos', 'Thermos', 'interieure'],
    ['verre', 'Verre', 'interieure'],
    ['carafe', 'Carafe', 'interieure'],
    ['maison_br', 'Maison BR', 'interieure'],
    ['chasuble', 'Chasuble', 'interieure'],
    ['full_branding', 'Full branding', 'exterieure'],
    ['nappe', 'Nappe brandée', 'interieure'],
    ['promotion', 'Promotion', 'promotion'],
  ],
  // Modern Trade (supermarchés) — matrice dédiée, tout en intérieur.
  mt: [
    ['niche', 'Niche', 'interieure'],
    ['wobler', 'Wobbler', 'interieure'],
    ['top_shelf', 'Top shelf', 'interieure'],
    ['bacs', 'Bacs', 'interieure'],
    ['reglette', 'Réglettes', 'interieure'],
    ['tg', 'TG (activités promotionnelles)', 'interieure'],
    ['plot', 'Plot', 'promotion'],
    ['hotesses', 'Hôtesses', 'promotion'],
  ],
}

export const FALLBACK_VISIBILITY_ELEMENTS: VisibilityElementRef[] =
  (Object.entries(ELEMENTS_BY_SEGMENT) as [VisibilitySegment, ElementSeed[]][])
    .flatMap(([segment, elements]) => elements.map(([code, nom, emplacement, optionnel = false]) => ({
      segment,
      code,
      nom,
      pilier: emplacement === 'promotion' ? 'promotion' as const : 'visibilite' as const,
      emplacement,
      optionnel,
    })))

export function visibilitySegmentForPdv(typePdv?: string | null): VisibilitySegment | null {
  const value = (typePdv || '').trim().toLowerCase()
  if (!value) return null
  if (value.includes('boutique')) return 'boutique'
  if (value.includes('supermarket') || value.includes('hypermarket')) return 'mt'
  if (value.includes('superette')) return 'superette'
  if (value.includes('table top') || value.includes('table_top')) return 'table_top'
  if (value.includes('pushcard') || value.includes('pushcart')) return 'pushcart'
  if (value.includes('porridge')) return 'porridge'
  if (value.includes('kiosk') || value.includes('kiosque') || value.includes('aboki') || value.includes('horeca coffee')) return 'kiosque_aboki'
  return null
}

export function legacyVisibilityValue(data: any, code: string): boolean {
  const ext = data?.visibilite?.exterieure || {}
  const int = data?.visibilite?.interieure || {}
  const legacy: Record<string, boolean> = {
    affiche: !!ext.poster,
    guirlande: !!ext.guirlande,
    sign_board: !!ext.sign_board,
    panneau_privilege: !!ext.panneau_privilege,
    full_branding: !!ext.full_branding,
    reglette: !!int.reglettes,
    maison_br: !!int.maison_bonnet_rouge,
    hanger: !!int.hanger,
    presentoir: !!int.presentoirs,
    tg: !!int.tete_gondole,
    merchandising: !!int.merchandising,
  }
  return legacy[code] === true
}

export function visibilityElementObserved(data: any, code: string): boolean {
  const current = data?.visibilite?.standards?.[code]
  return typeof current === 'boolean' ? current : legacyVisibilityValue(data, code)
}
