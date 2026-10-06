// server/api/admin/apk/url-envoi.post.ts
// Étape 1 de Référentiels › Publier une version : URL d'envoi signée vers le
// bucket « apk ». L'APK (~5,6 Mo) dépasse la limite de 4,5 Mo des fonctions
// Vercel : le navigateur l'envoie directement à Supabase Storage avec cette
// URL, sans passer par le serveur. Aucune clé n'est exposée au navigateur.
import { nomFichierApk } from '~/utils/apkManifest'

export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  await requireAdmin(event, service)

  const body = await readBody(event)
  const versionName = String(body?.versionName || '').trim()
  const versionCode = Number(body?.versionCode)
  if (!/^\d+\.\d+\.\d+$/.test(versionName)) throw apiError(400, 'Version invalide (format attendu : 1.0.11)')
  if (!Number.isInteger(versionCode) || versionCode < 1) throw apiError(400, 'versionCode invalide')

  // Dernière version publiée (version_code_dispo existe depuis la migration
  // 20261007120000 ; avant, seule la version minimale est connue).
  let derniere = 0
  const avecDispo = await service.from('version_app').select('version_code_min, version_code_dispo').eq('plateforme', 'android').maybeSingle()
  if (!avecDispo.error) derniere = Math.max(avecDispo.data?.version_code_dispo || 0, avecDispo.data?.version_code_min || 0)
  else {
    const min = await service.from('version_app').select('version_code_min').eq('plateforme', 'android').maybeSingle()
    derniere = min.data?.version_code_min || 0
  }
  if (versionCode <= derniere) {
    throw apiError(409, `Le versionCode ${versionCode} n’est pas supérieur à la dernière version publiée (${derniere}). Incrémentez versionCode dans android/app/build.gradle avant le build.`)
  }

  const chemin = nomFichierApk(versionName)
  const { data, error } = await service.storage.from('apk').createSignedUploadUrl(chemin, { upsert: true })
  if (error || !data) throw apiError(500, `Stockage : ${error?.message || 'URL d’envoi indisponible'}`)
  return { chemin: data.path, jeton: data.token }
})
