// server/api/admin/territoire-alias.post.ts
// Rattache un libellé de territoire hors référentiel à un territoire réel et
// remplace ce libellé sur TOUS les profils qui le portent (territoires_assignes,
// zone_assignee). Service role : la RLS de profiles ne laisse pas un admin
// réécrire les autres profils depuis le navigateur.
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const service = serverSupabaseServiceRole(event) as any
  await requireAdmin(event, service)

  const body = await readBody(event)
  const alias = String(body?.alias || '').trim()
  const code = String(body?.territoire_code || '').trim()
  if (!alias || !code) throw apiError(400, 'alias et territoire_code sont requis')

  const { data: terr, error: terrErr } = await service.from('territoire').select('code, nom').eq('code', code).maybeSingle()
  if (terrErr) throw apiError(500, terrErr.message)
  if (!terr) throw apiError(404, 'Territoire introuvable')

  const { error: aliasErr } = await service.from('territoire_alias')
    .upsert({ alias, territoire_code: code }, { onConflict: 'alias' })
  if (aliasErr) throw apiError(500, aliasErr.message)

  // Le libellé stocké sur les profils est en général en MAJUSCULES, comme
  // pdv.zone ; on garde cette convention pour le territoire réel.
  const reel = String(terr.nom).toUpperCase()
  const norm = (v: string) => (v || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const cible = norm(alias)

  const { data: profils, error: profErr } = await service
    .from('profiles')
    .select('id, territoires_assignes, zone_assignee')
  if (profErr) throw apiError(500, profErr.message)

  let modifies = 0
  for (const p of profils || []) {
    const terrs: string[] = Array.isArray(p.territoires_assignes) ? p.territoires_assignes : []
    const touche = terrs.some(t => norm(t) === cible) || norm(p.zone_assignee || '') === cible
    if (!touche) continue
    const nouveaux = [...new Set(terrs.map(t => (norm(t) === cible ? reel : t)))]
    const zone = norm(p.zone_assignee || '') === cible ? reel : p.zone_assignee
    const { error } = await service.from('profiles')
      .update({ territoires_assignes: nouveaux, zone_assignee: zone })
      .eq('id', p.id)
    if (error) throw apiError(500, error.message)
    modifies++
  }

  return { alias, territoire: terr.nom, profils: modifies }
})
