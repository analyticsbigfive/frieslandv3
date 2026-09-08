// supabase/functions/notifier-action/index.ts
//
// Envoie une notification push au merchandiseur dès qu'une action commerciale
// lui est assignée. Appelée par le déclencheur `trg_action_commerciale_push`
// (migration 20260911140000), qui ne transmet que l'identifiant de l'action :
// les libellés sont relus ici, en service_role, pour que rien de lisible ne
// transite dans le corps de la requête.
//
// Variables d'environnement attendues (secrets de la fonction) :
//   · SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — fournis par la plateforme
//   · FCM_SERVICE_ACCOUNT — le JSON du compte de service Firebase, en une ligne
//
// Google a fermé l'ancienne « clé serveur » : l'envoi passe par FCM HTTP v1,
// qui exige un jeton OAuth signé avec la clé privée du compte de service.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CompteService {
  client_email: string
  private_key: string
  project_id: string
}

// --- Jeton OAuth Google ----------------------------------------------------
// Un jeton vaut une heure : on le garde en mémoire tant que l'instance vit,
// plutôt que de resigner un JWT à chaque action assignée.
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

// --- Message ---------------------------------------------------------------
function formaterEcheance(echeance: string | null): string {
  if (!echeance) return ''
  const d = new Date(`${echeance}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return ` · pour le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
}

// Comparaison à durée constante : une comparaison naïve s'arrête au premier
// caractère différent, ce qui laisse deviner le secret octet par octet.
function memeSecret(attendu: string, fourni: string): boolean {
  const a = new TextEncoder().encode(attendu)
  const b = new TextEncoder().encode(fourni)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

Deno.serve(async (req) => {
  try {
    // La fonction est déployée sans vérification de JWT : l'appelant est le
    // déclencheur Postgres, pas un utilisateur connecté. Un secret partagé tient
    // lieu d'authentification — sans lui, connaître l'URL suffirait à faire
    // renvoyer n'importe quelle notification. Secret volontairement distinct de
    // la clé service_role : il ne donne accès qu'à cette fonction et se change
    // sans toucher au reste du projet.
    // Fermeture par défaut : secret absent = fonction hors service, jamais
    // fonction ouverte. Un secret effacé ou un déploiement incomplet ne doit
    // pas transformer l'URL en porte d'entrée.
    const attendu = Deno.env.get('NOTIFIER_SECRET')
    if (!attendu) {
      console.error('NOTIFIER_SECRET absent : envoi refusé')
      return new Response('service mal configuré', { status: 500 })
    }
    if (!memeSecret(attendu, req.headers.get('x-notifier-secret') ?? '')) {
      return new Response('non autorisé', { status: 401 })
    }

    const { action_id } = await req.json()
    if (!action_id) return new Response('action_id manquant', { status: 400 })

    const compte: CompteService = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: action, error } = await supabase
      .from('action_commerciale')
      .select('id, assigne_a, echeance, commentaire, pdv:pdv_id(nom_pdv), type:type_code(libelle), auteur:auteur_id(nom)')
      .eq('id', action_id)
      .single()
    if (error || !action?.assigne_a) {
      return new Response(JSON.stringify({ envoyes: 0, motif: 'action introuvable ou non assignée' }), { status: 200 })
    }

    const { data: appareils } = await supabase
      .from('appareil_push')
      .select('jeton')
      .eq('user_id', action.assigne_a)
    if (!appareils?.length) {
      return new Response(JSON.stringify({ envoyes: 0, motif: 'aucun appareil enregistré' }), { status: 200 })
    }

    const pdv = (action.pdv as any)?.nom_pdv ?? 'un point de vente'
    const libelle = (action.type as any)?.libelle ?? 'Action à réaliser'
    const auteur = (action.auteur as any)?.nom
    const titre = `${libelle} — ${pdv}`
    const corps = `${auteur ? `${auteur} vous a assigné une action` : 'Une action vous a été assignée'}${formaterEcheance(action.echeance)}`

    const acces = await jetonAcces(compte)
    const url = `https://fcm.googleapis.com/v1/projects/${compte.project_id}/messages:send`

    let envoyes = 0
    const perimes: string[] = []
    for (const { jeton } of appareils) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${acces}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: jeton,
            notification: { title: titre, body: corps },
            // Lu par l'app pour ouvrir directement l'écran des actions.
            data: { type: 'action_commerciale', action_id: String(action.id) },
            android: { priority: 'high', notification: { channel_id: 'actions', sound: 'default' } },
          },
        }),
      })
      if (r.ok) { envoyes++; continue }
      const texte = await r.text()
      // Jeton d'une app désinstallée ou réinstallée : on le retire, sinon la
      // table se remplit d'appareils morts et chaque envoi les repaie.
      if (r.status === 404 || texte.includes('UNREGISTERED') || texte.includes('INVALID_ARGUMENT')) {
        perimes.push(jeton)
      }
      console.error('FCM refus', r.status, texte)
    }
    if (perimes.length) {
      await supabase.from('appareil_push').delete().in('jeton', perimes)
    }

    return new Response(JSON.stringify({ envoyes, perimes: perimes.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  catch (e) {
    console.error('notifier-action', e)
    return new Response(JSON.stringify({ erreur: String(e) }), { status: 500 })
  }
})
