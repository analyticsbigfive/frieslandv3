// POST /api/validation-tournee/reponse — route PUBLIQUE, jeton requis.
// { type: 'jour', ligneId, decision: ok|modifier|retirer, commentaire }
// { type: 'pdv', pdvId, ligneId, motif: pas_ma_tournee|position_fausse|ferme|null, commentaire }
// { type: 'zone', zoneType: secteur_atom|territoire_friesland|quartier_friesland, libelle, decision: oui|non|null, commentaire }
// { type: 'zones_remarque', commentaire } : zones couvertes qui manquent dans les listes
// { type: 'zones_proposees', zones: { secteursAtom, territoires, quartiers } } : ce qu'il
//   couvre vraiment (proposition ; profiles n'est jamais modifié ici)
const DECISIONS = ['ok', 'modifier', 'retirer']
const MOTIFS = ['pas_ma_tournee', 'position_fausse', 'ferme']
const TYPES_ZONE = ['secteur_atom', 'territoire_friesland', 'quartier_friesland']

export default defineEventHandler(async (event) => {
  freinerIp(event, 300)
  const service = getServiceClient(event)
  const v = await validationDuJeton(event, service)
  if (v.statut === 'validee') throw apiError(409, 'Routing déjà validé : demandez à l\'admin de le rouvrir pour le modifier')
  const body = await readBody(event).catch(() => ({}))
  const commentaire = String(body?.commentaire || '').trim().slice(0, 1000) || null
  const maintenant = new Date().toISOString()

  const ligneId = String(body?.ligneId || '')
  if (ligneId) {
    const { data: l } = await service.from('routing_mensuel').select('id').eq('id', ligneId).eq('merchandiser_id', v.merchandiser_id).maybeSingle()
    if (!l) throw apiError(400, 'Jour inconnu')
  }

  if (body?.type === 'jour') {
    if (!ligneId || !DECISIONS.includes(body?.decision)) throw apiError(400, 'Choix invalide')
    const { error } = await service.from('validation_tournee_reponse').upsert({
      validation_merch_id: v.id, routing_mensuel_id: ligneId, decision: body.decision, commentaire, traite: false, maj_le: maintenant,
    }, { onConflict: 'validation_merch_id,routing_mensuel_id' })
    if (error) throw apiError(500, error.message)
  }
  else if (body?.type === 'pdv') {
    const pdvId = String(body?.pdvId || '')
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(pdvId)) throw apiError(400, 'PDV invalide')
    if (body?.motif == null) {
      const { error } = await service.from('validation_tournee_pdv_retour').delete().eq('validation_merch_id', v.id).eq('pdv_id', pdvId)
      if (error) throw apiError(500, error.message)
    }
    else {
      if (!MOTIFS.includes(body.motif)) throw apiError(400, 'Motif invalide')
      const { error } = await service.from('validation_tournee_pdv_retour').upsert({
        validation_merch_id: v.id, pdv_id: pdvId, routing_mensuel_id: ligneId || null, motif: body.motif, commentaire, traite: false, maj_le: maintenant,
      }, { onConflict: 'validation_merch_id,pdv_id' })
      if (error) throw apiError(500, error.message)
    }
  }
  else if (body?.type === 'zone') {
    const libelle = String(body?.libelle || '').trim().slice(0, 200)
    if (!TYPES_ZONE.includes(body?.zoneType) || !libelle) throw apiError(400, 'Zone invalide')
    if (body?.decision == null) {
      const { error } = await service.from('validation_tournee_zone').delete()
        .eq('validation_merch_id', v.id).eq('type', body.zoneType).eq('libelle', libelle)
      if (error) throw apiError(500, error.message)
    }
    else {
      if (!['oui', 'non'].includes(body.decision)) throw apiError(400, 'Choix invalide')
      const { error } = await service.from('validation_tournee_zone').upsert({
        validation_merch_id: v.id, type: body.zoneType, libelle, decision: body.decision, commentaire, traite: false, maj_le: maintenant,
      }, { onConflict: 'validation_merch_id,type,libelle' })
      if (error) throw apiError(500, error.message)
    }
  }
  else if (body?.type === 'zones_proposees') {
    const liste = (x: unknown, max: number, motif: RegExp) => Array.isArray(x)
      ? [...new Set(x.map(v => String(v ?? '').trim()).filter(v => v && motif.test(v)))].slice(0, max)
      : []
    const z = body?.zones || {}
    const zones = {
      secteursAtom: liste(z.secteursAtom, 50, /^.{1,200}$/),
      territoires: liste(z.territoires, 50, /^[\w .'-]{1,40}$/),
      quartiers: liste(z.quartiers, 1000, /^.{1,120}$/),
    }
    const { error } = await service.from('validation_tournee_merch').update({ zones_proposees: zones }).eq('id', v.id)
    if (error) throw apiError(500, error.message)
  }
  else if (body?.type === 'zones_remarque') {
    const { error } = await service.from('validation_tournee_merch').update({ zones_remarque: commentaire }).eq('id', v.id)
    if (error) throw apiError(500, error.message)
  }
  else {
    throw apiError(400, 'Réponse invalide')
  }

  await service.from('validation_tournee_merch')
    .update({ statut: 'en_cours', derniere_activite: maintenant })
    .eq('id', v.id)
  return { ok: true }
})
