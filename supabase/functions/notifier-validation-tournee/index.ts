// supabase/functions/notifier-validation-tournee/index.ts
//
// E-mail aux responsables quand un merchandiser a validé sa fiche sur
// /validation-tournee (routing du mois, PDV, zones et secteurs). Appelée par
// le déclencheur trg_validation_tournee_notifier (migration 20261020120000),
// qui ne transmet que l'identifiant : le contenu est relu ici en service_role.
//
// Aussi, le soir à 20 h : jours de visite libre sous l'objectif (corps
// { visite_libre: 'AAAA-MM-JJ' }, envoyé par controler_visites_libres,
// migration 20261022100000), relus dans alerte_visite_libre.
//
// Secrets de la fonction (supabase secrets set …) :
//   · SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — fournis par la plateforme
//   (le jeton envoyé par le déclencheur est vérifié dans Vault par la base :
//    verifier_jeton_notification_validation, rien à recopier ici)
//   · RESEND_API_KEY      — clé de l'API Resend (https://resend.com)
//   · NOTIF_EXPEDITEUR    — ex. « Friesland Tournées <tournees@votre-domaine> » (domaine vérifié chez Resend)
//   · NOTIF_DESTINATAIRES — adresses séparées par des virgules
//   · APP_URL             — ex. https://friesland.example.com (lien vers l'admin)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DECISION = { ok: 'OK', modifier: 'À modifier', retirer: 'À retirer' } as Record<string, string>
const MOTIF = { pas_ma_tournee: 'pas dans sa tournée', position_fausse: 'position fausse', ferme: 'fermé' } as Record<string, string>

const echapper = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: autorise } = await sb.rpc('verifier_jeton_notification_validation', { p_jeton: req.headers.get('x-notifier-secret') || '' })
  if (autorise !== true) return new Response('Accès refusé', { status: 401 })

  const corps = await req.json().catch(() => ({}))
  if (corps.visite_libre) return visitesLibres(sb, String(corps.visite_libre))
  const id = corps.validation_id
  if (!id) return new Response('validation_id manquant', { status: 400 })
  const { data: v, error } = await sb.from('validation_tournee_merch')
    .select('id, merchandiser_id, nom_saisi, remarque, zones_remarque, valide_le, notifie_le, campagne:validation_tournee_campagne(libelle), merchandiser:profiles!validation_tournee_merch_merchandiser_id_fkey(nom)')
    .eq('id', id).maybeSingle()
  if (error || !v) return new Response('Fiche introuvable', { status: 404 })
  if (v.notifie_le && v.valide_le && new Date(v.notifie_le) >= new Date(v.valide_le)) return new Response('Déjà notifié', { status: 200 })

  const [lignes, reponses, retours, zones] = await Promise.all([
    sb.from('routing_mensuel').select('id, jour_semaine, semaine_du_mois, point_visite').eq('merchandiser_id', v.merchandiser_id).eq('actif', true),
    sb.from('validation_tournee_reponse').select('routing_mensuel_id, decision, commentaire').eq('validation_merch_id', id),
    sb.from('validation_tournee_pdv_retour').select('pdv_id, motif, commentaire, pdv:pdv(nom_pdv)').eq('validation_merch_id', id),
    sb.from('validation_tournee_zone').select('type, libelle, decision, commentaire').eq('validation_merch_id', id),
  ])
  const ligneDe = new Map((lignes.data || []).map((l: any) => [l.id, l]))
  const rep = reponses.data || []
  const compte = (d: string) => rep.filter((r: any) => r.decision === d).length
  const corrections = rep.filter((r: any) => r.decision !== 'ok').map((r: any) => {
    const l: any = ligneDe.get(r.routing_mensuel_id)
    return `<li><b>${echapper(l ? `${JOURS[l.jour_semaine]} semaine ${l.semaine_du_mois} — ${l.point_visite}` : 'Jour')}</b> : ${DECISION[r.decision]}${r.commentaire ? ` — « ${echapper(r.commentaire)} »` : ''}</li>`
  })
  const pdv = (retours.data || []).map((r: any) => `<li>${echapper(r.pdv?.nom_pdv || r.pdv_id)} : ${MOTIF[r.motif]}${r.commentaire ? ` — « ${echapper(r.commentaire)} »` : ''}</li>`)
  const zonesNon = (zones.data || []).filter((z: any) => z.decision === 'non').map((z: any) => `<li>${echapper(z.libelle)} (${z.type === 'secteur_atom' ? 'secteur Atom' : z.type === 'territoire_friesland' ? 'territoire Friesland' : 'quartier Friesland'})${z.commentaire ? ` — « ${echapper(z.commentaire)} »` : ''}</li>`)

  const nom = (v as any).merchandiser?.nom || v.nom_saisi || 'Un merchandiser'
  const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '')
  const html = `
    <p><b>${echapper(nom)}</b> a validé sa fiche (${echapper((v as any).campagne?.libelle || '')}), signée « ${echapper(v.nom_saisi)} ».</p>
    <p>Jours : ${compte('ok')} OK, ${compte('modifier')} à modifier, ${compte('retirer')} à retirer.</p>
    ${corrections.length ? `<p><b>Jours à corriger</b></p><ul>${corrections.join('')}</ul>` : ''}
    ${pdv.length ? `<p><b>PDV signalés</b></p><ul>${pdv.join('')}</ul>` : ''}
    ${zonesNon.length ? `<p><b>Zones qu'il ne couvre pas</b></p><ul>${zonesNon.join('')}</ul>` : ''}
    ${v.zones_remarque ? `<p><b>Zones à ajouter</b> : « ${echapper(v.zones_remarque)} »</p>` : ''}
    ${v.remarque ? `<p><b>Remarque</b> : « ${echapper(v.remarque)} »</p>` : ''}
    ${appUrl ? `<p><a href="${appUrl}/admin/routing/validation">Ouvrir la validation des tournées</a></p>` : ''}`

  const echec = await envoyer(`Tournée validée : ${nom}`, html)
  if (echec) return echec

  await sb.from('validation_tournee_merch').update({ notifie_le: new Date().toISOString() }).eq('id', id)
  return new Response('Envoyé', { status: 200 })
})

/** Envoie l'e-mail aux responsables ; null si tout va bien, sinon la réponse d'erreur. */
async function envoyer(sujet: string, html: string): Promise<Response | null> {
  const cle = Deno.env.get('RESEND_API_KEY')
  // Sans domaine vérifié chez Resend, l'adresse de test de Resend n'envoie
  // qu'à l'adresse du compte Resend : mettre celle-ci dans NOTIF_DESTINATAIRES.
  const de = Deno.env.get('NOTIF_EXPEDITEUR') || 'Friesland Tournées <onboarding@resend.dev>'
  const a = (Deno.env.get('NOTIF_DESTINATAIRES') || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!cle || !a.length) return new Response('Envoi non configuré (RESEND_API_KEY, NOTIF_DESTINATAIRES)', { status: 503 })

  const envoi = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: de, to: a, subject: sujet, html }),
  })
  if (!envoi.ok) return new Response(`Resend : ${envoi.status} ${await envoi.text()}`, { status: 502 })
  return null
}

// Pluriel des types de boutique, comme dans l'admin (utils/visiteLibre.ts).
const TYPES: Record<string, string> = { Boutique: 'Boutiques', Superette: 'Superettes', Pushcart: 'Pushcarts', Porridge: 'Porridge', 'Aboki & Kiosque': 'Aboki & Kiosque' }

/** Jours de visite libre du `jour` sous l'objectif, pas encore envoyés. */
async function visitesLibres(sb: any, jour: string): Promise<Response> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return new Response('Date invalide', { status: 400 })
  const { data: alertes, error } = await sb.from('alerte_visite_libre')
    .select('routing_id, objectifs, manque, merchandiser:profiles!alerte_visite_libre_merchandiser_id_fkey(nom)')
    .eq('date_routing', jour).is('notifie_le', null)
  if (error) return new Response(error.message, { status: 500 })
  if (!alertes?.length) return new Response('Rien à envoyer', { status: 200 })

  const date = new Date(`${jour}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const lignes = alertes
    .sort((x: any, y: any) => String(x.merchandiser?.nom).localeCompare(String(y.merchandiser?.nom), 'fr'))
    .map((a: any) => {
      const o = a.objectifs || {}
      const parType = Object.entries(o.quotas || {})
        .map(([t, q]) => `${TYPES[t] || t} ${o.realise?.[t] || 0}/${q}`)
        .join(', ')
      return `<li><b>${echapper(a.merchandiser?.nom || 'Merchandiser')}</b> : ${o.nb_realise || 0}/${o.total || 0} PDV (${echapper(parType)})</li>`
    })
  const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '')
  const html = `
    <p>Visite libre du ${echapper(date)} : objectif non atteint.</p>
    <ul>${lignes.join('')}</ul>
    ${appUrl ? `<p><a href="${appUrl}/admin/routing">Ouvrir les tournées</a></p>` : ''}`

  const echec = await envoyer(`Visite libre du ${date} : objectif non atteint (${alertes.length})`, html)
  if (echec) return echec
  await sb.from('alerte_visite_libre').update({ notifie_le: new Date().toISOString() }).in('routing_id', alertes.map((a: any) => a.routing_id))
  return new Response('Envoyé', { status: 200 })
}
