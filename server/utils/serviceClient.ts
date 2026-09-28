// server/utils/serviceClient.ts
// Client Supabase service_role pour les routes serveur.
//
// serverSupabaseServiceRole() lève une Error brute quand la clé est absente,
// ce que Nitro renvoie en « 500 Server Error » sans détail : c'est ce qui
// masquait l'échec de toutes les routes /api/admin/* sur Vercel (clé non
// définie sur le déploiement). On renvoie à la place la cause exacte.
//
// La clé est lue dans runtimeConfig.supabase.serviceKey : fixée au build
// depuis SUPABASE_SERVICE_ROLE_KEY (nuxt.config.ts), ou surchargée à
// l'exécution par NUXT_SUPABASE_SERVICE_KEY.
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export function getServiceClient(event: H3Event): any {
  try {
    return serverSupabaseServiceRole(event)
  }
  catch {
    throw apiError(
      500,
      'Configuration serveur incomplète : clé service Supabase absente (variable NUXT_SUPABASE_SERVICE_KEY à définir sur l\'hébergement)',
    )
  }
}
