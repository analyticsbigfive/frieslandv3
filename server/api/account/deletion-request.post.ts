// server/api/account/deletion-request.post.ts
// Demande de suppression de compte et des données associées (exigence Google
// Play : un lien accessible sans être connecté). Route PUBLIQUE.
//
// La demande est enregistrée sur le compte de connexion lui-même
// (user_metadata.deletion_requested_at / deletion_reason) : aucune table à
// créer, et l'admin la retrouve dans Utilisateurs via
// /api/admin/users/deletion-requests. La suppression effective reste un acte
// de l'administrateur (compte + profil, cascade sur les visites).
//
// Réponse identique que l'e-mail existe ou non : on ne révèle pas la liste
// des comptes. Si l'appelant est connecté, son propre compte est ciblé quel
// que soit l'e-mail saisi.
import { serverSupabaseUser } from '#supabase/server'
import { EMAIL_RE } from '../../utils/adminUsers'

// Route publique : on plafonne le nombre de demandes par IP. Mémoire locale à
// l'instance (pas partagée entre fonctions serverless) : un frein, pas une
// garantie — suffisant pour un formulaire rarement utilisé.
const FENETRE_MS = 60_000
const MAX_PAR_FENETRE = 5
const demandesParIp = new Map<string, number[]>()

function limiteAtteinte(ip: string): boolean {
  const maintenant = Date.now()
  const recentes = (demandesParIp.get(ip) || []).filter(t => maintenant - t < FENETRE_MS)
  recentes.push(maintenant)
  demandesParIp.set(ip, recentes)
  if (demandesParIp.size > 1000) demandesParIp.clear()
  return recentes.length > MAX_PAR_FENETRE
}

// Une requête sur profiles plutôt que de paginer auth.users (jusqu'à 20
// appels admin par demande anonyme). profiles.email est renseigné à la
// création de chaque compte (createUserWithProfile, handle_new_user), en
// minuscules comme l'e-mail saisi.
async function findUserIdByEmail(service: any, email: string): Promise<string | null> {
  const { data, error } = await service
    .from('profiles')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()
  if (error) throw apiError(500, error.message)
  return data?.id || null
}

export default defineEventHandler(async (event) => {
  if (limiteAtteinte(getRequestIP(event, { xForwardedFor: true }) || 'inconnue')) {
    throw apiError(429, 'Trop de demandes, réessayez dans une minute')
  }

  const body = await readBody(event).catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const reason = String(body?.reason || '').trim().substring(0, 500)
  if (!EMAIL_RE.test(email)) {
    throw apiError(400, 'Adresse e-mail invalide')
  }
  if (body?.confirm !== true) {
    throw apiError(400, 'Veuillez confirmer la demande')
  }

  const service = getServiceClient(event)

  let userId: string | null = null
  try {
    const me = (await serverSupabaseUser(event)) as any
    if (me?.id) userId = me.id
  }
  catch {
    userId = null
  }
  if (!userId) userId = await findUserIdByEmail(service, email)

  if (userId) {
    const { data: existing } = await service.auth.admin.getUserById(userId)
    const meta = existing?.user?.user_metadata || {}
    const { error } = await service.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...meta,
        deletion_requested_at: new Date().toISOString(),
        deletion_reason: reason || null,
        deletion_contact_email: email,
      },
    })
    if (error) throw apiError(500, error.message)
  }

  // Même réponse dans tous les cas (pas d'énumération des comptes).
  return { success: true }
})
