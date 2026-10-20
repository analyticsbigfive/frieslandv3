// POST /api/validation-tournee/valider — route PUBLIQUE, jeton requis.
// { nom, remarque } : exige une réponse pour chacun des jours du routing.
export default defineEventHandler(async (event) => {
  freinerIp(event, 20)
  const service = getServiceClient(event)
  const v = await validationDuJeton(event, service)
  const body = await readBody(event).catch(() => ({}))
  const nom = String(body?.nom || '').trim().slice(0, 120)
  if (nom.length < 2) throw apiError(400, 'Écrivez votre nom pour valider')

  const [lignes, reponses, profil, zones] = await Promise.all([
    service.from('routing_mensuel').select('id, secteur').eq('merchandiser_id', v.merchandiser_id).eq('actif', true),
    service.from('validation_tournee_reponse').select('routing_mensuel_id').eq('validation_merch_id', v.id),
    service.from('profiles').select('zone_assignee, territoires_assignes').eq('id', v.merchandiser_id).maybeSingle(),
    service.from('validation_tournee_zone').select('type, libelle').eq('validation_merch_id', v.id),
  ])
  for (const r of [lignes, reponses, profil, zones]) if (r.error) throw apiError(500, r.error.message)
  const faits = new Set((reponses.data || []).map((r: any) => r.routing_mensuel_id))
  const manquants = (lignes.data || []).filter((l: any) => !faits.has(l.id)).length
  if (manquants) throw apiError(400, `Il reste ${manquants} jour${manquants > 1 ? 's' : ''} sans réponse`)

  // Zones : chaque secteur Atom et chaque territoire Friesland a une réponse.
  const cle = (s: string) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  const repondu = new Set((zones.data || []).map((z: any) => `${z.type}|${cle(z.libelle)}`))
  const attendus = [
    ...(lignes.data || []).map((l: any) => ['secteur_atom', l.secteur]),
    ...[profil.data?.zone_assignee, ...(profil.data?.territoires_assignes || [])].map(t => ['territoire_friesland', t]),
  ].filter(([, l]) => String(l || '').trim())
  const zonesManquantes = new Set(attendus.filter(([t, l]) => !repondu.has(`${t}|${cle(l)}`)).map(([t, l]) => `${t}|${cle(l)}`)).size
  if (zonesManquantes) throw apiError(400, `Il reste ${zonesManquantes} zone${zonesManquantes > 1 ? 's' : ''} sans réponse`)

  const maintenant = new Date().toISOString()
  const { error } = await service.from('validation_tournee_merch').update({
    statut: 'validee', valide_le: maintenant, derniere_activite: maintenant, nom_saisi: nom,
    remarque: String(body?.remarque || '').trim().slice(0, 2000) || null,
  }).eq('id', v.id)
  if (error) throw apiError(500, error.message)
  return { ok: true, valideLe: maintenant }
})
