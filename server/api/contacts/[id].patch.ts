// server/api/contacts/[id].patch.ts
// Correction du numéro de téléphone d'un contact depuis l'application mobile.
//
// La politique profiles_update_own interdit à un non-admin de modifier un
// autre profil : cette route passe donc par la clé service_role, et vérifie
// elle-même qui a le droit de modifier qui.
//   - admin / superviseur : tout contact non-admin ;
//   - commercial : un merchandiseur qui lui est assigné, ou qui partage un de
//     ses territoires (alias compris, via la fonction SQL territoires_etendus).
// Seul le téléphone est modifiable. Ni rôle, ni e-mail, ni activation : ce sont
// des données de sécurité, elles restent dans l'administration.
import { serverSupabaseServiceRole } from '#supabase/server'

// Miroir de normaliserTelephoneInternational (utils/actionsCommerciales.ts),
// recopié ici pour ne pas faire dépendre le serveur d'un util auto-importé.
function numeroLisible(tel: string, indicatif = '225'): boolean {
  const brut = tel.replace(/[^\d+]/g, '')
  if (!brut) return false
  let n = brut.startsWith('+') ? brut.slice(1) : brut.startsWith('00') ? brut.slice(2) : brut
  if (!n.startsWith(indicatif) && (n.length === 8 || n.length === 10)) n = indicatif + n
  return /^\d{10,15}$/.test(n)
}

const norm = (v: string) => (v || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Recoupement de périmètre, alias de territoires compris. La fonction SQL
// territoires_etendus est la même que celle utilisée par pdv_ids_perimetre.
async function partagentUnTerritoire(service: any, mesTerritoires: string[], cible: any): Promise<boolean> {
  if (!mesTerritoires.length) return true // périmètre non restreint

  const siens: string[] = Array.isArray(cible.territoires_assignes) ? cible.territoires_assignes.filter(Boolean) : []
  const territoiresCible = siens.length ? siens : (cible.zone_assignee ? [cible.zone_assignee] : [])
  if (!territoiresCible.length) return false

  const { data } = await service.rpc('territoires_etendus', { p_noms: mesTerritoires })
  const etendus: string[] = Array.isArray(data) ? data : mesTerritoires
  const miens = new Set(etendus.map(norm))
  return territoiresCible.some((t: string) => miens.has(norm(t)))
}

export default defineEventHandler(async (event) => {
  const service = serverSupabaseServiceRole(event) as any
  const moi = await requireEncadrant(event, service)

  const cibleId = getRouterParam(event, 'id')
  if (!cibleId) throw apiError(400, 'Contact non précisé')

  const body = await readBody(event)
  const brut = String(body?.telephone ?? '').trim().substring(0, 50)
  if (!brut) throw apiError(400, 'Le numéro de téléphone est requis')
  if (!numeroLisible(brut)) {
    throw apiError(400, 'Numéro illisible. Exemple attendu : 07 08 09 10 11')
  }

  const { data: cible, error: cibleErr } = await service
    .from('profiles')
    .select('id, role, is_active, commercial_id, territoires_assignes, zone_assignee')
    .eq('id', cibleId)
    .maybeSingle()
  if (cibleErr) throw apiError(500, cibleErr.message)
  if (!cible) throw apiError(404, 'Contact introuvable')

  // Chacun peut corriger son propre numéro.
  if (cible.id !== moi.id) {
    if (cible.role === 'admin') {
      throw apiError(403, 'Le numéro d\'un administrateur se modifie dans l\'administration')
    }
    if (moi.role === 'commercial') {
      if (cible.role !== 'merchandiser') {
        throw apiError(403, 'Vous ne pouvez corriger que le numéro d\'un merchandiseur')
      }
      const assigne = cible.commercial_id === moi.id
      if (!assigne && !(await partagentUnTerritoire(service, moi.territoires, cible))) {
        throw apiError(403, 'Ce merchandiseur n\'est pas dans votre périmètre')
      }
    }
  }

  const { error } = await service.from('profiles').update({ telephone: brut }).eq('id', cible.id)
  if (error) throw apiError(500, error.message)

  return { id: cible.id, telephone: brut }
})
