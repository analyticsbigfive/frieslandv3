// GET /api/admin/territoires-equipe?ids=uuid,uuid — page « Suivi des équipes ».
// Emprise du territoire de chaque personne : cases d'environ 450 m (grilleEmprise,
// comme la page Découpage) qui contiennent au moins une boutique de sa liste.
//   - Merchandiser Atom : sa vraie liste (listes_merch_atom, réservée à la clé
//     service) et ses points de visite du routing mensuel.
//   - Autres (merchandiser Friesland, commercial, superviseur) : la règle de
//     pdv_ids_perimetre pour cette personne (territoires étendus, puis quartiers
//     attribués quand la liste n'est pas vide).
// Admin et superviseur : tout le monde ; compte agence : ses merchandisers
// seulement. Emprise gardée 5 minutes par personne.
import type { H3Event } from 'h3'
import { fetchAllRows } from '~/utils/fetchAll'
import { casesEmprise } from '~/utils/decoupage'

const MAX_PERSONNES = 60
const PAQUET_IDS = 300
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface EmprisePersonne {
  cases: [number, number][]
  points_visite: { nom: string, lat: number, lng: number }[]
  nb_pdv: number
  /** Ni territoire ni zone attribués : pas d'emprise à dessiner. */
  sans_territoire: boolean
}

const VIDE: EmprisePersonne = { cases: [], points_visite: [], nb_pdv: 0, sans_territoire: false }

function enTableau(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(x => x !== '') : []
}

async function coordonneesDesPdv(service: any, ids: string[]): Promise<{ lat: number[], lng: number[] }> {
  const lat: number[] = [], lng: number[] = []
  const paquets: string[][] = []
  for (let i = 0; i < ids.length; i += PAQUET_IDS) paquets.push(ids.slice(i, i + PAQUET_IDS))
  const reponses = await Promise.all(paquets.map(p => service.from('pdv')
    .select('geolocation_lat, geolocation_lng')
    .in('pdv_id', p).eq('is_active', true)
    .not('geolocation_lat', 'is', null).not('geolocation_lng', 'is', null)))
  for (const { data, error } of reponses) {
    if (error) throw apiError(500, error.message)
    for (const r of data || []) { lat.push(+r.geolocation_lat); lng.push(+r.geolocation_lng) }
  }
  return { lat, lng }
}

async function chargerEmprise(event: H3Event, id: string): Promise<EmprisePersonne> {
  const service = getServiceClient(event)
  const { data: p, error } = await service.from('profiles')
    .select('role, employeur, territoires_assignes, quartiers_assignes, zone_assignee')
    .eq('id', id).maybeSingle()
  if (error) throw apiError(500, error.message)
  if (!p) return VIDE

  if (p.role === 'merchandiser' && p.employeur === 'atom') {
    const [liste, lignes] = await Promise.all([
      fetchAllRows<{ pdv_id: string }>((de, a) => service.rpc('listes_merch_atom')
        .eq('merchandiser_id', id).order('pdv_id').range(de, a)),
      service.from('routing_mensuel').select('point_visite, latitude, longitude')
        .eq('merchandiser_id', id).eq('actif', true).not('latitude', 'is', null).not('longitude', 'is', null),
    ])
    if (lignes.error) throw apiError(500, lignes.error.message)
    const { lat, lng } = await coordonneesDesPdv(service, [...new Set(liste.map(r => r.pdv_id))])
    const vus = new Set<string>()
    const points_visite = (lignes.data || []).flatMap((r: any) => {
      const cle = `${r.point_visite}|${r.latitude}|${r.longitude}`
      if (vus.has(cle)) return []
      vus.add(cle)
      return [{ nom: String(r.point_visite || 'Point de visite'), lat: +r.latitude, lng: +r.longitude }]
    })
    return { cases: casesEmprise(lat, lng), points_visite, nb_pdv: lat.length, sans_territoire: false }
  }

  const territoires = enTableau(p.territoires_assignes)
  if (!territoires.length && p.zone_assignee) territoires.push(String(p.zone_assignee))
  // Sans territoire, pdv_ids_perimetre ouvre tout le parc : rien d'utile à dessiner.
  if (!territoires.length) return { ...VIDE, sans_territoire: true }

  const { data: noms, error: errNoms } = await service.rpc('territoires_etendus', { p_noms: territoires })
  if (errNoms) throw apiError(500, errNoms.message)
  const quartiers = new Set(enTableau(p.quartiers_assignes))
  const lignes = await fetchAllRows<any>((de, a) => service.from('pdv')
    .select('pdv_id, quartier, geolocation_lat, geolocation_lng')
    .eq('is_active', true).in('zone', noms || [])
    .not('geolocation_lat', 'is', null).not('geolocation_lng', 'is', null)
    .order('pdv_id').range(de, a))
  const gardes = quartiers.size ? lignes.filter(r => r.quartier == null || quartiers.has(r.quartier)) : lignes
  const lat = gardes.map(r => +r.geolocation_lat), lng = gardes.map(r => +r.geolocation_lng)
  return { cases: casesEmprise(lat, lng), points_visite: [], nb_pdv: lat.length, sans_territoire: false }
}

const empriseEnCache = defineCachedFunction(chargerEmprise, {
  name: 'territoire-equipe',
  maxAge: 300,
  getKey: (_event: H3Event, id: string) => id,
})

export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  const moi = await requireRoles(event, service, ['admin', 'superviseur', 'agence'])

  const ids = [...new Set(String(getQuery(event).ids || '').split(',').map(s => s.trim()).filter(s => UUID.test(s)))]
  if (ids.length > MAX_PERSONNES) throw apiError(400, `Au plus ${MAX_PERSONNES} personnes à la fois`)
  if (!ids.length) return {}

  if (moi.role === 'agence') {
    const { data: compte } = await service.from('profiles').select('employeur').eq('id', moi.id).single()
    const agence = compte?.employeur
    if (!agence || agence === 'friesland') throw apiError(403, 'Accès non autorisé pour ce compte')
    const { data, error } = await service.from('profiles').select('id')
      .in('id', ids).eq('role', 'merchandiser').eq('employeur', agence)
    if (error) throw apiError(500, error.message)
    const siens = new Set((data || []).map((r: any) => r.id))
    if (ids.some(i => !siens.has(i))) throw apiError(403, 'Ces personnes ne sont pas toutes de votre agence')
  }

  const emprises: Record<string, EmprisePersonne> = {}
  await Promise.all(ids.map(async (id) => { emprises[id] = await empriseEnCache(event, id) }))
  return emprises
})
