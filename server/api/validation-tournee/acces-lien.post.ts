// POST /api/validation-tournee/acces-lien — route PUBLIQUE.
// { lien } (jeton de 128 bits du lien personnel envoyé sur WhatsApp) → { jeton }.
// Sans code à taper : le lien suffit. Un lien inconnu ou d'un mois fermé est refusé.
export default defineEventHandler(async (event) => {
  freinerIp(event, 20)
  const body = await readBody(event).catch(() => ({}))
  const lien = String(body?.lien || '').trim().toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(lien)) throw apiError(400, 'Lien incomplet : recopiez-le en entier, ou choisissez votre nom et tapez votre code')

  const service = getServiceClient(event)
  const { data, error } = await service.rpc('verifier_lien_validation', { p_jeton: lien })
  if (error) throw apiError(500, error.message)
  if (!data) throw apiError(404, 'Ce lien ne marche plus. Choisissez votre nom et tapez votre code, ou demandez un nouveau lien.')
  return { jeton: creerJeton(event, String(data)) }
})
