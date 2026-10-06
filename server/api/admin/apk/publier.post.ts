// server/api/admin/apk/publier.post.ts
// Étape 2 de Référentiels › Publier une version, une fois l'APK déposé :
//   1. relit le fichier DÉPOSÉ et vérifie son manifeste (package, versionCode,
//      versionName) : la version minimale ne peut jamais dépasser le
//      versionCode du fichier publié, sinon les téléphones tourneraient en
//      boucle sur l'écran de mise à jour ;
//   2. remplace le lien stable friesland-bonnet-rouge-latest.apk ;
//   3. enregistre la version disponible (bandeau « nouvelle version » dans
//      l'app 1.0.11+) et, si demandé, la rend obligatoire (version minimale).
import { lireManifesteApk, nomFichierApk, NOM_APK_LATEST, PACKAGE_APP } from '~/utils/apkManifest'

export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  await requireAdmin(event, service)

  const body = await readBody(event)
  const versionName = String(body?.versionName || '').trim()
  const versionCode = Number(body?.versionCode)
  const obligatoire = body?.obligatoire === true
  const message = String(body?.message || '').trim() || null
  if (!/^\d+\.\d+\.\d+$/.test(versionName) || !Number.isInteger(versionCode) || versionCode < 1) {
    throw apiError(400, 'Version invalide')
  }

  const bucket = service.storage.from('apk')
  const chemin = nomFichierApk(versionName)

  // 1. Le fichier déposé est bien l'APK annoncé.
  const { data: fichier, error: eLecture } = await bucket.download(chemin)
  if (eLecture || !fichier) throw apiError(404, `Fichier ${chemin} introuvable dans le stockage : renvoyez l’APK.`)
  let manifeste
  try {
    manifeste = await lireManifesteApk(new Uint8Array(await fichier.arrayBuffer()))
  }
  catch (e: any) {
    throw apiError(422, `APK illisible : ${e.message}`)
  }
  if (manifeste.package !== PACKAGE_APP) throw apiError(422, `Ce fichier n’est pas l’app Bonnet Rouge (package ${manifeste.package}).`)
  if (manifeste.versionCode !== versionCode || manifeste.versionName !== versionName) {
    throw apiError(422, `Le fichier déposé est la version ${manifeste.versionName} (code ${manifeste.versionCode}), pas ${versionName} (code ${versionCode}).`)
  }

  // 2. Lien stable : copie du fichier versionné.
  await bucket.remove([NOM_APK_LATEST])
  const { error: eCopie } = await bucket.copy(chemin, NOM_APK_LATEST)
  if (eCopie) throw apiError(500, `Copie vers ${NOM_APK_LATEST} : ${eCopie.message}`)
  const url = bucket.getPublicUrl(NOM_APK_LATEST).data.publicUrl

  // 3. Version disponible / obligatoire.
  const base: Record<string, any> = { plateforme: 'android', url_telechargement: url, updated_at: new Date().toISOString() }
  if (obligatoire) Object.assign(base, { version_code_min: versionCode, version_nom_min: versionName, message })
  let { error: eVersion } = await service.from('version_app')
    .upsert({ ...base, version_code_dispo: versionCode, version_nom_dispo: versionName }, { onConflict: 'plateforme' })
  if (eVersion && /version_(code|nom)_dispo/.test(eVersion.message)) {
    // Migration 20261007120000 pas encore appliquée : sans la version disponible.
    ({ error: eVersion } = await service.from('version_app').upsert(base, { onConflict: 'plateforme' }))
  }
  if (eVersion) throw apiError(500, `version_app : ${eVersion.message}`)

  return { url, versionCode, versionName, obligatoire, fichier: chemin }
})
