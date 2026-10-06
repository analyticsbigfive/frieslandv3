// server/api/admin/imports/[type]/appliquer.post.ts
// Applique un envoi d'opérations d'un import terrain (Admin › Import / Export
// › Imports terrain). La simulation a tourné dans le navigateur de l'admin ;
// ici, avec la clé service_role :
//   - chaque opération est REVALIDÉE (types autorisés pour cet import,
//     colonnes en liste blanche, marqueurs « import-… », préfixe ATOM-…) :
//     le navigateur ne peut rien écrire d'autre ;
//   - l'avancement du lot (import_lot) est mis à jour, l'erreur y est notée.
// Le navigateur découpe les opérations en envois (decouperOperations) pour
// rester sous la limite de 4,5 Mo par requête et sous la durée maximale.
import {
  appliquerOperations, estOperationInvalide, OPERATIONS_PAR_IMPORT, validerOperation,
} from '~/scripts/lib/imports/operations.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  await requireAdmin(event, service)

  const type = String(getRouterParam(event, 'type') || '')
  const autorises: string[] | undefined = (OPERATIONS_PAR_IMPORT as Record<string, string[]>)[type]
  if (!autorises) throw apiError(404, `Import inconnu : ${type}`)

  const body = await readBody(event)
  const operations = body?.operations
  const lotId = body?.lot_id ? String(body.lot_id) : null
  const sens = body?.sens === 'retour' ? 'retour' : 'application'
  if (!Array.isArray(operations) || !operations.length || operations.length > 50) {
    throw apiError(400, 'operations : 1 à 50 opérations par envoi')
  }
  if (lotId && !UUID.test(lotId)) throw apiError(400, 'lot_id invalide')

  try {
    operations.forEach((op: any) => validerOperation(op, autorises))
  }
  catch (e: any) {
    if (estOperationInvalide(e)) throw apiError(422, `Opération refusée : ${e.message}`)
    throw e
  }

  let lot: any = null
  if (lotId) {
    const { data, error } = await service.from('import_lot').select('id, type, statut, operations_faites').eq('id', lotId).maybeSingle()
    if (error) throw apiError(500, `Journal des imports : ${error.message}`)
    if (!data || data.type !== type) throw apiError(404, 'Lot d’import introuvable')
    const attendu = sens === 'retour' ? ['annulation', 'applique', 'erreur'] : ['en_cours', 'erreur']
    if (!attendu.includes(data.statut)) throw apiError(409, `Lot au statut « ${data.statut} » : opération impossible`)
    lot = data
  }

  try {
    const journal = await appliquerOperations(service, operations, { typesAutorises: autorises })
    if (lot && sens === 'application') {
      await service.from('import_lot')
        .update({ operations_faites: (lot.operations_faites || 0) + operations.length, statut: 'en_cours', erreur: null })
        .eq('id', lot.id)
    }
    return { journal }
  }
  catch (e: any) {
    const message = e?.message || String(e)
    if (lot) await service.from('import_lot').update({ statut: 'erreur', erreur: message.slice(0, 2000) }).eq('id', lot.id)
    throw apiError(500, `Import interrompu : ${message}. Les opérations déjà faites restent faites ; relancer reprend sans doublon.`)
  }
})
