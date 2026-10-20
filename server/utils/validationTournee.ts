// server/utils/validationTournee.ts
// Socle des routes publiques /api/validation-tournee/* (page /validation-tournee).
//
// Les merchandisers Atom n'ont pas de session sur cette page : ils ouvrent
// leur lien personnel (jeton de 128 bits, envoyé sur WhatsApp). Le serveur rend
// alors un jeton signé (HMAC) valable 12 h, porté par l'en-tête Authorization.
// (Le code à 4 chiffres a été retiré le 20/10/2026 à la demande de Jean Luc.)
import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export const ESSAIS_MAX = 5
export const BLOCAGE_MIN = 15
const DUREE_JETON_MS = 12 * 60 * 60 * 1000

function secret(event: H3Event): string {
  const propre = process.env.NUXT_VALIDATION_SECRET
  if (propre) return propre
  // À défaut, dérivé de la clé service (jamais exposée) : rien à configurer.
  const cfg = useRuntimeConfig(event) as any
  const cle = cfg?.supabase?.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!cle) throw apiError(500, 'Configuration serveur incomplète (clé de signature absente)')
  return createHash('sha256').update(`validation-tournee:${cle}`).digest('hex')
}

const b64 = (s: string) => Buffer.from(s).toString('base64url')
const signer = (event: H3Event, charge: string) => createHmac('sha256', secret(event)).update(charge).digest('base64url')

export function creerJeton(event: H3Event, validationMerchId: string): string {
  const charge = b64(JSON.stringify({ v: validationMerchId, exp: Date.now() + DUREE_JETON_MS }))
  return `${charge}.${signer(event, charge)}`
}

/** Identifiant validation_tournee_merch porté par un jeton valide, sinon 401. */
export function lireJeton(event: H3Event): string {
  const brut = (getHeader(event, 'authorization') || '').replace(/^Bearer\s+/i, '')
  const [charge, signature] = brut.split('.')
  if (!charge || !signature) throw apiError(401, 'Session expirée : choisissez votre nom et retapez votre code')
  const attendu = Buffer.from(signer(event, charge))
  const recu = Buffer.from(signature)
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) throw apiError(401, 'Session invalide : retapez votre code')
  let donnees: any
  try { donnees = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8')) }
  catch { throw apiError(401, 'Session invalide : retapez votre code') }
  if (!donnees?.v || typeof donnees.exp !== 'number' || donnees.exp < Date.now()) {
    throw apiError(401, 'Session expirée : choisissez votre nom et retapez votre code')
  }
  return String(donnees.v)
}

// Frein supplémentaire par IP et par route (mémoire locale à l'instance, pas
// une garantie). Un compteur par route : répondre vite aux 24 jours ne doit pas
// empêcher de valider ensuite.
const appelsParIp = new Map<string, number[]>()
export function freinerIp(event: H3Event, max = 60, fenetreMs = 60_000) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'inconnue'
  const cle = `${ip}|${event.path?.split('?')[0] || ''}`
  const t = Date.now()
  const recents = (appelsParIp.get(cle) || []).filter(x => t - x < fenetreMs)
  recents.push(t)
  appelsParIp.set(cle, recents)
  if (appelsParIp.size > 2000) appelsParIp.clear()
  if (recents.length > max) throw apiError(429, 'Trop de demandes, réessayez dans une minute')
}

/** Campagne ouverte la plus récente (null si aucune). */
export async function campagneOuverte(service: any) {
  const { data, error } = await service
    .from('validation_tournee_campagne')
    .select('id, mois, libelle, statut')
    .eq('statut', 'ouverte')
    .order('mois', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw apiError(500, error.message)
  return data
}

/** Ligne validation_tournee_merch d'un jeton, avec la campagne encore ouverte. */
export async function validationDuJeton(event: H3Event, service: any) {
  const id = lireJeton(event)
  const { data, error } = await service
    .from('validation_tournee_merch')
    .select('id, campagne_id, merchandiser_id, statut, nom_saisi, remarque, valide_le, campagne:validation_tournee_campagne(id, mois, libelle, statut)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw apiError(500, error.message)
  if (!data) throw apiError(401, 'Session invalide : retapez votre code')
  if (data.campagne?.statut !== 'ouverte') throw apiError(409, 'La validation de ce mois est fermée')
  return data
}

export const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
