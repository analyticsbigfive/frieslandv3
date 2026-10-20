// POST /api/validation-tournee/acces — route PUBLIQUE.
// { id, code } → { jeton }. 5 codes faux bloquent 15 minutes : le compteur et
// la comparaison sont faits en une instruction en base (verifier_code_validation),
// donc des requêtes simultanées ne contournent pas le blocage.
export default defineEventHandler(async (event) => {
  freinerIp(event, 20)
  const body = await readBody(event).catch(() => ({}))
  const id = String(body?.id || '')
  const code = String(body?.code || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw apiError(400, 'Choisissez votre nom')
  if (!/^[0-9]{4}$/.test(code)) throw apiError(400, 'Le code a 4 chiffres')

  const service = getServiceClient(event)
  const { data, error } = await service.rpc('verifier_code_validation', { p_id: id, p_code: code })
  if (error) throw apiError(500, error.message)
  const [resultat, valeur] = String(data || 'inconnu').split(':')

  if (resultat === 'ok') return { jeton: creerJeton(event, id) }
  if (resultat === 'inconnu') throw apiError(404, 'Ce nom n\'est plus dans la liste : rechargez la page')
  if (resultat === 'bloque') {
    const min = Number(valeur) || BLOCAGE_MIN
    throw apiError(429, `Trop de codes faux. Réessayez dans ${min} minute${min > 1 ? 's' : ''}, ou demandez votre code à l'admin.`)
  }
  const restants = Number(valeur) || 0
  throw apiError(403, `Code faux. Encore ${restants} essai${restants > 1 ? 's' : ''}.`)
})
