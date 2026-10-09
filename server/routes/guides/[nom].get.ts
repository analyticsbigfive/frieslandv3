// Guides PDF du back-office, ouverts depuis le bouton « Aide » de l'en-tête.
// Copies de docs/guides/ placées dans server/assets/guides/ par
// scripts/generer-guides-pdf.mjs (seuls les guides génériques : jamais les
// guides personnalisés, qui contiennent des identifiants).
import { serverSupabaseUser } from '#supabase/server'

const GUIDES = new Set(['GUIDE-ADMIN.pdf', 'GUIDE-ADMIN-ATOM.pdf'])

export default defineEventHandler(async (event) => {
  const nom = getRouterParam(event, 'nom') || ''
  if (!GUIDES.has(nom)) throw createError({ statusCode: 404, statusMessage: 'Guide introuvable' })

  const user = await serverSupabaseUser(event).catch(() => null)
  if (!user) return sendRedirect(event, '/login', 302)

  const pdf = await useStorage('assets:server').getItemRaw(`guides/${nom}`)
  if (!pdf) throw createError({ statusCode: 404, statusMessage: 'Guide introuvable' })

  setResponseHeaders(event, {
    'content-type': 'application/pdf',
    'content-disposition': `inline; filename="${nom}"`,
    'cache-control': 'private, max-age=300',
  })
  return pdf
})
