// GET /api/admin/decoupage — page « Découpage » (admin, superviseur, commercial).
// Découpage en vigueur (South 1 et South 2) : territoires, zones, secteurs et
// commerciaux ; boutiques géolocalisées rattachées à leur territoire par leur
// libellé (pdv.zone ou alias), sans secteur tant qu'elles ne sont pas
// reclassées ; merchandisers Atom (liste = pdv_ids_merch_atom) ; points de
// visite du routing mensuel. Réponse en colonnes (≈ 22 000 boutiques).
// Données communes gardées 5 minutes ; la garde passe à chaque appel. La clé
// service contourne la RLS : un commercial ne reçoit le détail des boutiques,
// merchandisers et points de visite que de son périmètre (restreindreAuCommercial),
// le reste du découpage (hiérarchie, compteurs, emprise) sans donnée de boutique.
import type { H3Event } from 'h3'
import { fetchAllRows } from '~/utils/fetchAll'
import {
  PARTAGE, SANS_COMMERCIAL, cleNom, commercialDeBoutique, commerciauxParTerritoire, estACheval,
  grilleEmprise, personnesCommerciales, resolveurTerritoire, restreindreAuCommercial,
  type DecoupageDonnees, type DecoupageMerch, type DecoupagePoint, type DecoupageTerritoire,
} from '~/utils/decoupage'

const SOUS_REGIONS = ['SOUTH1', 'SOUTH2']
const arrondi = (x: number) => Math.round(x * 1e5) / 1e5
const clePoint = (lat: number, lng: number) => `${(+lat).toFixed(5)},${(+lng).toFixed(5)}`

async function charger(event: H3Event): Promise<DecoupageDonnees> {
  const service = getServiceClient(event)

  const [hierarchie, alias, profils, atom, merchs] = await Promise.all([
    service.from('territoire')
      .select('code, nom, sous_region_code, zone(code, nom, actif, quartier(nom, ordre))')
      .in('sous_region_code', SOUS_REGIONS).eq('actif', true).neq('code', 'MT').order('nom'),
    service.from('territoire_alias').select('alias, territoire_code'),
    service.from('profiles').select('id, nom, email, territoires_assignes, quartiers_assignes')
      .eq('role', 'commercial').eq('is_active', true),
    fetchAllRows<{ pdv_id: string }>((de, a) => service.from('pdv_atom').select('pdv_id').order('pdv_id').range(de, a)),
    service.from('profiles').select('id, nom, email, commercial_id, is_active')
      .eq('role', 'merchandiser').eq('employeur', 'atom'),
  ])
  for (const r of [hierarchie, alias, profils, merchs]) if (r.error) throw apiError(500, r.error.message)

  // Hiérarchie : zones actives du nouveau découpage seulement, dans l'ordre du fichier.
  const terrs = (hierarchie.data || []).map((t: any) => ({
    code: t.code as string,
    nom: String(t.nom).trim(),
    sousRegion: t.sous_region_code as string,
    zones: (t.zone || [])
      .filter((z: any) => z.actif && /^Z\d{2}$/.test(z.code || ''))
      .sort((a: any, b: any) => a.code.localeCompare(b.code))
      .map((z: any) => ({
        code: z.code,
        nom: z.nom,
        secteurs: (z.quartier || []).sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((q: any) => q.nom),
      })),
  }))
  const indiceTerr = new Map(terrs.map((t: any, i: number) => [t.code, i]))
  const territoireDe = resolveurTerritoire(terrs, alias.data || [])

  const personnes = personnesCommerciales(
    (profils.data || []).filter((p: any) => !String(p.email || '').endsWith('@friesland-test.ci')),
    terrs,
  )
  const titulaires = commerciauxParTerritoire(personnes)
  const personneDuCompte = new Map<string, number>()
  personnes.forEach((p, i) => p.ids.forEach(id => personneDuCompte.set(id, i)))

  // Libellés de boutique qui mènent à un territoire du découpage : noms et alias.
  const libelles = [...new Set([
    ...terrs.map((t: any) => t.nom),
    ...(alias.data || []).filter((a: any) => indiceTerr.has(a.territoire_code)).map((a: any) => a.alias),
  ])]
  const merchAtom = (merchs.data || [])
    .filter((m: any) => m.is_active !== false && !String(m.email || '').endsWith('@friesland-test.ci'))
    .sort((a: any, b: any) => String(a.nom).localeCompare(String(b.nom), 'fr'))
  const idsMerch = merchAtom.map((m: any) => m.id)

  const [pdv, toutesListes, lignes, rattachements] = await Promise.all([
    fetchAllRows<any>((de, a) => service.from('pdv')
      .select('pdv_id, nom_pdv, zone, quartier, distributor_name, geolocation_lat, geolocation_lng')
      .eq('is_active', true).in('zone', libelles)
      .not('geolocation_lat', 'is', null).not('geolocation_lng', 'is', null)
      .order('pdv_id').range(de, a)),
    // Listes pdv_ids_merch_atom de tous les merchandisers Atom, par pages de 1 000
    // (deux listes dépassent 1 000 boutiques) : migration 20261029120000.
    fetchAllRows<{ merchandiser_id: string, pdv_id: string }>((de, a) => service
      .rpc('listes_merch_atom').order('merchandiser_id').order('pdv_id').range(de, a)),
    idsMerch.length
      ? service.from('routing_mensuel').select('merchandiser_id, point_visite, latitude, longitude')
        .eq('actif', true).in('merchandiser_id', idsMerch).not('latitude', 'is', null)
      : Promise.resolve({ data: [], error: null }),
    fetchAllRows<any>((de, a) => service.from('pdv_quartier_tournee')
      .select('pdv_id, merchandiser_id, point_lat, point_lng').order('pdv_id').order('merchandiser_id').range(de, a)),
  ])
  if (lignes.error) throw apiError(500, lignes.error.message)

  const listes: string[][] = merchAtom.map(() => [])
  const indiceMerch = new Map(idsMerch.map((id: string, i: number) => [id, i]))
  for (const r of toutesListes) {
    const mi = indiceMerch.get(r.merchandiser_id)
    if (mi !== undefined) listes[mi]!.push(r.pdv_id)
  }
  const estAtom = new Set(atom.map(x => x.pdv_id))
  const merchDuPdv = new Map<string, number>()
  listes.forEach((ids, mi) => {
    for (const id of ids) if (!merchDuPdv.has(id)) merchDuPdv.set(id, mi)
  })

  // Boutiques, en colonnes.
  const distributeurs: string[] = []
  const indiceDistrib = new Map<string, number>()
  const b: DecoupageDonnees['boutiques'] = { id: [], nom: [], quartier: [], lat: [], lng: [], t: [], c: [], a: [], m: [], d: [] }
  const indicePdv = new Map<string, number>()
  const n = terrs.map(() => 0), na = terrs.map(() => 0)
  for (const p of pdv) {
    const code = territoireDe(p.zone)
    const ti = code ? indiceTerr.get(code) : undefined
    if (ti === undefined) continue
    const lat = +p.geolocation_lat, lng = +p.geolocation_lng
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 4 || lat > 11 || lng < -9 || lng > -2) continue
    const d = String(p.distributor_name || '').trim()
    if (d && !indiceDistrib.has(d)) { indiceDistrib.set(d, distributeurs.length); distributeurs.push(d) }
    const a = estAtom.has(p.pdv_id) ? 1 : 0
    indicePdv.set(p.pdv_id, b.id.length)
    b.id.push(p.pdv_id)
    b.nom.push(p.nom_pdv || '')
    b.quartier.push(p.quartier || '')
    b.lat.push(arrondi(lat))
    b.lng.push(arrondi(lng))
    b.t.push(ti)
    b.c.push(commercialDeBoutique(titulaires.get(code!), p.quartier, personnes))
    b.a.push(a)
    b.m.push(merchDuPdv.get(p.pdv_id) ?? -1)
    b.d.push(d ? indiceDistrib.get(d)! : -1)
    n[ti]!++
    na[ti]! += a
  }

  const territoires: DecoupageTerritoire[] = terrs.map((t: any, i: number) => ({
    ...t, coms: titulaires.get(t.code) || [], n: n[i]!, na: na[i]!,
  }))

  // Merchandisers Atom : leur liste entière, y compris les boutiques hors découpage
  // (comptées dans le total, pas dans la répartition par commercial).
  const merchsSortie: DecoupageMerch[] = merchAtom.map((m: any, mi: number) => {
    const binome = personneDuCompte.get(m.commercial_id) ?? SANS_COMMERCIAL
    const ids = listes[mi]!
    const parCom = new Map<number, number>()
    let hors = 0
    for (const id of ids) {
      const i = indicePdv.get(id)
      const c = i === undefined ? SANS_COMMERCIAL : b.c[i]!
      parCom.set(c, (parCom.get(c) || 0) + 1)
      if (binome >= 0 && c !== binome && c !== PARTAGE) hors++
    }
    return {
      id: m.id,
      nom: String(m.nom || '').trim(),
      binome,
      total: ids.length,
      hors,
      parCom: [...parCom.entries()].sort((x, y) => y[1] - x[1]),
    }
  })

  // Points de visite : un par position (plusieurs lignes du mois au même point).
  const points = new Map<string, { lat: number, lng: number, noms: string[], merch: number, ids: string[] }>()
  for (const l of lignes.data || []) {
    const k = `${l.merchandiser_id}|${clePoint(l.latitude, l.longitude)}`
    const p = points.get(k) ?? { lat: arrondi(+l.latitude), lng: arrondi(+l.longitude), noms: [], merch: indiceMerch.get(l.merchandiser_id) ?? -1, ids: [] }
    const nom = String(l.point_visite || '').trim()
    if (nom && !p.noms.some(x => cleNom(x) === cleNom(nom))) p.noms.push(nom)
    points.set(k, p)
  }
  for (const r of rattachements) {
    const p = points.get(`${r.merchandiser_id}|${clePoint(r.point_lat, r.point_lng)}`)
    if (p) p.ids.push(r.pdv_id)
  }
  const pointsSortie: DecoupagePoint[] = [...points.values()].map((p) => {
    const t = new Set<number>(), c = new Set<number>()
    for (const id of p.ids) {
      const i = indicePdv.get(id)
      if (i === undefined) continue
      t.add(b.t[i]!)
      if (b.c[i]! >= 0) c.add(b.c[i]!)
    }
    return { lat: p.lat, lng: p.lng, nom: p.noms.join(' / ') || '—', merch: p.merch, nb: p.ids.length, t: [...t], c: [...c], cheval: estACheval([...t], [...c]) }
  })

  const centres = terrs.map(() => ({ lat: 0, lng: 0, n: 0 }))
  b.t.forEach((t, i) => { centres[t]!.lat += b.lat[i]!; centres[t]!.lng += b.lng[i]!; centres[t]!.n++ })

  return {
    maj: new Date().toISOString(),
    commerciaux: personnes.map(p => ({ nom: p.nom, ids: p.ids })),
    territoires,
    boutiques: b,
    distributeurs,
    merchs: merchsSortie,
    points: pointsSortie,
    emprise: grilleEmprise(b.lat, b.lng, b.t),
    centres: centres.map(c => c.n ? [arrondi(c.lat / c.n), arrondi(c.lng / c.n)] as [number, number] : null),
  }
}

const donneesEnCache = defineCachedFunction(charger, {
  name: 'decoupage',
  maxAge: 300,
  getKey: () => 'south',
})

export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  const moi = await requireRoles(event, service, ['admin', 'superviseur', 'commercial'])
  const donnees = await donneesEnCache(event)
  const indice = donnees.commerciaux.findIndex(c => c.ids.includes(moi.id))
  return {
    ...(moi.role === 'commercial' ? restreindreAuCommercial(donnees, indice) : donnees),
    moi: indice,
  }
})
