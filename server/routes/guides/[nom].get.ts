// Guides PDF du back-office, ouverts depuis le bouton « Aide » de l'en-tête.
// Copies de docs/guides/ placées dans server/assets/guides/ par
// scripts/generer-guides-pdf.mjs (seuls les guides génériques : jamais les
// guides personnalisés, qui contiennent des identifiants). S'y ajoute l'exemple
// de routing mensuel (fictif) proposé sur la carte d'import de l'agence.
import { serverSupabaseUser } from '#supabase/server'

const GUIDES: Record<string, { type: string, disposition: 'inline' | 'attachment' }> = {
  'GUIDE-ADMIN.pdf': { type: 'application/pdf', disposition: 'inline' },
  'GUIDE-ADMIN-ATOM.pdf': { type: 'application/pdf', disposition: 'inline' },
  'exemple-routing-mensuel.csv': { type: 'text/csv; charset=utf-8', disposition: 'attachment' },
}

export default defineEventHandler(async (event) => {
  const nom = getRouterParam(event, 'nom') || ''
  const fichier = Object.hasOwn(GUIDES, nom) ? GUIDES[nom] : undefined
  if (!fichier) throw createError({ statusCode: 404, statusMessage: 'Guide introuvable' })

  const user = await serverSupabaseUser(event).catch(() => null)
  if (!user) return sendRedirect(event, '/login', 302)

  const contenu = await useStorage('assets:server').getItemRaw(`guides/${nom}`)
  if (!contenu) throw createError({ statusCode: 404, statusMessage: 'Guide introuvable' })

  setResponseHeaders(event, {
    'content-type': fichier.type,
    'content-disposition': `${fichier.disposition}; filename="${nom}"`,
    'cache-control': 'private, max-age=300',
  })
  return contenu
})
