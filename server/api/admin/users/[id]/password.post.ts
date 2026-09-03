// server/api/admin/users/[id]/password.post.ts
// Réinitialisation du mot de passe d'un utilisateur par un admin.
//
// Passe par l'API admin (service_role) : pas de mail « mot de passe oublié »
// (SMTP Supabase plafonné, et les comptes terrain n'ont pas toujours accès à
// leur boîte). L'admin communique le mot de passe provisoire lui-même ; le
// drapeau must_change_password force l'utilisateur à en choisir un nouveau à
// sa prochaine connexion (middleware must-change-password.global.ts).
//
// Body : { password?: string }  — vide = mot de passe provisoire généré ici.
// Retour : { success: true, password }  (le mot de passe appliqué, à afficher
// une seule fois à l'admin).
import { randomInt } from 'node:crypto'
import { serverSupabaseServiceRole } from '#supabase/server'

// Alphabet sans caractères ambigus (0/O, 1/l/I) : le mot de passe est souvent
// dicté oralement ou recopié depuis un écran.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

function motDePasseProvisoire(): string {
  const bloc = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  return `BR-${bloc(4)}-${bloc(4)}`
}

export default defineEventHandler(async (event) => {
  const service = serverSupabaseServiceRole(event) as any
  await requireAdmin(event, service)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(400, 'Identifiant utilisateur manquant')
  }

  const body = await readBody(event).catch(() => ({}))
  const fourni = String(body?.password || '').trim()
  if (fourni && fourni.length < 8) {
    throw apiError(400, 'Le mot de passe doit contenir au moins 8 caractères')
  }
  const password = fourni || motDePasseProvisoire()

  // Métadonnées existantes conservées : updateUserById remplace l'objet entier.
  const { data: existing, error: getErr } = await service.auth.admin.getUserById(id)
  if (getErr || !existing?.user) {
    throw apiError(404, 'Compte de connexion introuvable pour cet utilisateur')
  }

  const { error } = await service.auth.admin.updateUserById(id, {
    password,
    user_metadata: { ...(existing.user.user_metadata || {}), must_change_password: true },
  })
  if (error) {
    throw apiError(error.status || 500, error.message)
  }

  return { success: true, password }
})
