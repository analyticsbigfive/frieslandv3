// supabase/functions/notifier-message/index.ts
//
// Notification push libre envoyée par un administrateur depuis le dashboard
// (Paramètres › Versions de l'app › « Prévenir par notification »), par exemple
// pour inviter les merchandisers à installer une nouvelle version.
//
// Appelée par le navigateur (supabase.functions.invoke) : JWT vérifié par la
// plateforme, puis rôle relu ici en service_role — seul un admin actif envoie.
// Deux modes :
//   · { apercu: true, user_ids }            → qui a un appareil enregistré, sans rien envoyer
//   · { titre, texte, user_ids }            → envoi
//
// Variables d'environnement : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (plateforme),
// FCM_SERVICE_ACCOUNT (secret déjà posé pour notifier-action).
//
// Le jeton OAuth Google est le même code que notifier-action, recopié pour ne
// pas redéployer celle-ci.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TITRE_MAX = 65
const TEXTE_MAX = 240
const DESTINATAIRES_MAX = 300

function repondre(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

interface CompteService {
  client_email: string
  private_key: string
  project_id: string
}

// --- Jeton OAuth Google (copie de notifier-action) -------------------------
let jetonCache: { valeur: string; expire: number } | null = null

function base64url(donnees: ArrayBuffer | string): string {
  const octets = typeof donnees === 'string'
    ? new TextEncoder().encode(donnees)
    : new Uint8Array(donnees)
  let binaire = ''
  for (const o of octets) binaire += String.fromCharCode(o)
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemVersArrayBuffer(pem: string): ArrayBuffer {
  const corps = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const binaire = atob(corps)
  const octets = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)
  return octets.buffer
}

async function jetonAcces(compte: CompteService): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000)
  if (jetonCache && jetonCache.expire > maintenant + 60) return jetonCache.valeur

  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const charge = base64url(JSON.stringify({
    iss: compte.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: maintenant,
    exp: maintenant + 3600,
  }))

  const cle = await crypto.subtle.importKey(
    'pkcs8',
    pemVersArrayBuffer(compte.private_key.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cle,
    new TextEncoder().encode(`${entete}.${charge}`),
  )
  const jwt = `${entete}.${charge}.${base64url(signature)}`

  const reponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!reponse.ok) throw new Error(`OAuth Google refusé : ${await reponse.text()}`)
  const { access_token, expires_in } = await reponse.json()
  jetonCache = { valeur: access_token, expire: maintenant + (expires_in ?? 3600) }
  return access_token
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Appelant : admin actif, relu en base (le JWT seul dit qui, pas quel rôle).
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: { user } } = await supabase.auth.getUser(jwt)
    if (!user) return repondre({ erreur: 'Session expirée : reconnectez-vous.' }, 401)
    const { data: profil } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
    if (profil?.role !== 'admin' || profil?.is_active === false) {
      return repondre({ erreur: 'Réservé aux administrateurs.' }, 403)
    }

    const corps = await req.json().catch(() => ({}))
    const userIds: string[] = Array.isArray(corps.user_ids)
      ? [...new Set(corps.user_ids.filter((id: unknown) => typeof id === 'string' && id))] as string[]
      : []
    if (!userIds.length) return repondre({ erreur: 'Aucun destinataire.' }, 400)
    if (userIds.length > DESTINATAIRES_MAX) return repondre({ erreur: `${DESTINATAIRES_MAX} destinataires au plus par envoi.` }, 400)

    const { data: appareils, error } = await supabase
      .from('appareil_push')
      .select('jeton, user_id')
      .in('user_id', userIds)
    if (error) throw error
    const avecAppareil = new Set((appareils ?? []).map(a => a.user_id))
    const sansAppareil = userIds.filter(id => !avecAppareil.has(id))

    if (corps.apercu) {
      return repondre({ joignables: [...avecAppareil], sans_appareil: sansAppareil, appareils: appareils?.length ?? 0 })
    }

    const titre = String(corps.titre ?? '').trim()
    const texte = String(corps.texte ?? '').trim()
    if (!titre || !texte) return repondre({ erreur: 'Titre et message obligatoires.' }, 400)
    if (titre.length > TITRE_MAX || texte.length > TEXTE_MAX) {
      return repondre({ erreur: `Titre : ${TITRE_MAX} caractères au plus ; message : ${TEXTE_MAX}.` }, 400)
    }
    if (!appareils?.length) return repondre({ envoyes: 0, echecs: 0, perimes: 0, recus: [], sans_appareil: sansAppareil })

    const compte: CompteService = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '')
    const acces = await jetonAcces(compte)
    const url = `https://fcm.googleapis.com/v1/projects/${compte.project_id}/messages:send`

    let envoyes = 0
    let echecs = 0
    const recus = new Set<string>()
    const perimes: string[] = []
    for (const { jeton, user_id } of appareils) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${acces}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: jeton,
            notification: { title: titre, body: texte },
            // FCM n'accepte que des chaînes dans data.
            data: { type: 'message' },
            // Canal créé par l'app (usePushNotifications) : notification sonore, en haut de l'écran.
            android: { priority: 'high', notification: { channel_id: 'actions', sound: 'default' } },
          },
        }),
      })
      if (r.ok) { envoyes++; recus.add(user_id); continue }
      const detail = await r.text()
      console.error('FCM refus', r.status, detail)
      // Seul un appareil désinstallé (404 / UNREGISTERED) est retiré. INVALID_ARGUMENT
      // vient aussi d'un message mal formé : on arrête tout plutôt que d'effacer
      // les jetons de tous les destinataires (notifier-action les efface).
      if (r.status === 404 || detail.includes('UNREGISTERED')) { perimes.push(jeton); continue }
      if (detail.includes('INVALID_ARGUMENT')) {
        return repondre({ erreur: 'Message refusé par Firebase, envoi arrêté.', detail, envoyes }, 502)
      }
      echecs++
    }
    if (perimes.length) await supabase.from('appareil_push').delete().in('jeton', perimes)

    console.log('notifier-message', { par: user.id, destinataires: userIds.length, envoyes, echecs, perimes: perimes.length })
    return repondre({ envoyes, echecs, perimes: perimes.length, recus: [...recus], sans_appareil: sansAppareil })
  }
  catch (e) {
    console.error('notifier-message', e)
    return repondre({ erreur: String(e) }, 500)
  }
})
