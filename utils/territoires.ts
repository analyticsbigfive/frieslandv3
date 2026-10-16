// utils/territoires.ts
// Territoires hors référentiel (libellés terrain comme « MARCORY TREICHVILLE »
// ou « YOPOUGON ») rattachés à des territoires réels par la table
// territoire_alias. Le périmètre d'un profil s'étend aux alias pour que les
// PDV portant encore l'ancien libellé restent visibles. Miroir de la fonction
// SQL territoires_etendus() (migration 20260908100000).

export interface TerritoireAlias {
  alias: string
  territoire_code: string
}

export interface TerritoireRef {
  code: string
  name: string
}

export const normaliserNomTerritoire = (v: string) =>
  (v || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Étend une liste de noms de territoires (tels que stockés sur le profil) :
// + les alias qui pointent vers ces territoires ; + le territoire réel (en
// casse référentiel et en MAJUSCULES) quand le profil porte un alias.
export function etendreTerritoires(noms: string[], aliases: TerritoireAlias[], territoires: TerritoireRef[]): string[] {
  const out = new Set(noms.filter(Boolean))
  if (!aliases.length) return [...out]
  const parCode = new Map(territoires.map(t => [t.code, t]))
  const codesParNom = new Map<string, string>()
  for (const t of territoires) codesParNom.set(normaliserNomTerritoire(t.name), t.code)
  const aliasParNom = new Map(aliases.map(a => [normaliserNomTerritoire(a.alias), a]))

  const codes = new Set<string>()
  for (const n of noms) {
    const key = normaliserNomTerritoire(n)
    const code = codesParNom.get(key) || aliasParNom.get(key)?.territoire_code
    if (code) codes.add(code)
  }
  for (const code of codes) {
    const t = parCode.get(code)
    if (t) { out.add(t.name); out.add(t.name.toUpperCase()) }
    for (const a of aliases) if (a.territoire_code === code) out.add(a.alias)
  }
  return [...out]
}

// Deux périmètres se recoupent-ils ? Comparaison normalisée (casse, accents) :
// les zones terrain sont en MAJUSCULES, le référentiel en casse mixte.
export function partagentUnTerritoire(a: (string | null | undefined)[], b: (string | null | undefined)[]): boolean {
  const setA = new Set(a.filter(Boolean).map(x => normaliserNomTerritoire(x as string)))
  if (!setA.size) return false
  return b.filter(Boolean).some(x => setA.has(normaliserNomTerritoire(x as string)))
}

export interface QuartierRef { id: number; zone_id: number; nom: string }
export interface AreaRef { id: number; name: string; territory_code: string }

export interface GroupeQuartiers {
  territoire: string
  code: string
  quartiers: string[]
}

// Regroupe des noms de quartiers par territoire (quartier → area → territoire).
// Les quartiers introuvables dans le référentiel vont dans un groupe « Autres ».
export function grouperQuartiersParTerritoire(
  noms: string[],
  quartiers: QuartierRef[],
  areas: AreaRef[],
  territoires: TerritoireRef[],
): GroupeQuartiers[] {
  const areaParId = new Map(areas.map(a => [a.id, a]))
  const terrParCode = new Map(territoires.map(t => [t.code, t]))
  const terrParQuartier = new Map<string, string>()
  for (const q of quartiers) {
    const area = areaParId.get(q.zone_id)
    if (area && !terrParQuartier.has(q.nom)) terrParQuartier.set(q.nom, area.territory_code)
  }
  const groupes = new Map<string, GroupeQuartiers>()
  for (const nom of [...new Set(noms.filter(Boolean))]) {
    const code = terrParQuartier.get(nom) || ''
    const libelle = code ? (terrParCode.get(code)?.name || code) : 'Autres'
    if (!groupes.has(code)) groupes.set(code, { territoire: libelle, code, quartiers: [] })
    groupes.get(code)!.quartiers.push(nom)
  }
  return [...groupes.values()]
    .map(g => ({ ...g, quartiers: g.quartiers.sort((a, b) => a.localeCompare(b, 'fr')) }))
    .sort((a, b) => (a.code === '' ? 1 : b.code === '' ? -1 : a.territoire.localeCompare(b.territoire, 'fr')))
}

// Code du territoire d'un nom porté par un profil : exact, puis sans casse ni
// accents (« KOUMASSI » ↔ « koumassi »), puis via territoire_alias.
export function codeTerritoireDuNom(nom: string, territoires: TerritoireRef[], aliases: TerritoireAlias[] = []): string {
  if (!nom) return ''
  const exact = territoires.find(t => t.name === nom)
  if (exact) return exact.code
  const key = normaliserNomTerritoire(nom)
  return territoires.find(t => normaliserNomTerritoire(t.name) === key)?.code
    || aliases.find(a => normaliserNomTerritoire(a.alias) === key)?.territoire_code
    || ''
}

// Territoire d'un PDV créé sur le terrain. Un même nom de quartier existe dans
// plusieurs areas (SICOGI : 8) : on garde l'area qui tombe dans les territoires
// du profil ; à défaut, le territoire de la zone du profil ; à défaut, celui de
// la première area portant ce quartier.
export function resoudreTerritoirePdv(opts: {
  zone: string
  quartier: string
  territoiresProfil: string[]
  quartiers: QuartierRef[]
  areas: AreaRef[]
  territoires: TerritoireRef[]
  aliases?: TerritoireAlias[]
}): string {
  const { zone, quartier, territoiresProfil, quartiers, areas, territoires, aliases = [] } = opts
  const codeZone = codeTerritoireDuNom(zone, territoires, aliases)
  const codesProfil = new Set(
    [zone, ...territoiresProfil].map(n => codeTerritoireDuNom(n, territoires, aliases)).filter(Boolean),
  )
  const areaParId = new Map(areas.map(a => [a.id, a]))
  const codesQuartier = quartier
    ? quartiers.filter(q => q.nom === quartier).map(q => areaParId.get(q.zone_id)?.territory_code).filter(Boolean) as string[]
    : []
  if (codeZone && codesQuartier.includes(codeZone)) return codeZone
  return codesQuartier.find(c => codesProfil.has(c)) || codeZone || codesQuartier[0] || ''
}
