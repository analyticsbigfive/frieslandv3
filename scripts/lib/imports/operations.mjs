/**
 * Opérations d'écriture des imports terrain.
 *
 * Un import (script en ligne de commande ou écran Admin › Imports terrain)
 * commence par une simulation qui produit une liste d'OPÉRATIONS MÉTIER —
 * « remplacer la sous-zone de tel SSF », « remplacer les règles SSF de tel
 * merchandiser »… — puis les applique ici. Le même code sert :
 *   - aux scripts (clé service_role, en local) ;
 *   - à la route serveur /api/admin/imports/[type]/appliquer (clé service_role,
 *     appel d'un admin), qui VALIDE chaque opération reçue du navigateur avant
 *     de l'exécuter : seuls les types et champs listés ici sont acceptés.
 *
 * Chaque opération est idempotente : la rejouer donne le même état.
 * Aucune dépendance Node : module partagé navigateur / serveur / scripts.
 */
import { toutesLesLignes } from '../commun.mjs'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

class OperationInvalide extends Error {}

const exiger = (cond, message) => { if (!cond) throw new OperationInvalide(message) }
const estTexte = (v, max = 500) => typeof v === 'string' && v.length <= max
const texteOuNul = (v, max = 500) => v == null || estTexte(v, max)
const estEntier = (v) => Number.isInteger(v)
const estJours = (v) => Array.isArray(v) && v.length <= 7 && v.every(j => Number.isInteger(j) && j >= 0 && j <= 6)
const estListeTextes = (v, maxLongueur = 20000, max = 200) => Array.isArray(v) && v.length <= maxLongueur && v.every(x => estTexte(x, max))
const refSsf = (v) => v && typeof v === 'object' && (estEntier(v.id) || estTexte(v.nom, 200))

/**
 * Validateurs par type d'opération. Un type absent ici est refusé.
 * Chaque validateur lève OperationInvalide avec un message lisible.
 */
const VALIDATEURS = {
  'ssf.creer'(op) {
    exiger(estTexte(op.nom, 200) && op.nom.trim(), 'ssf.creer : nom requis')
    exiger(texteOuNul(op.distributeur, 200) && texteOuNul(op.telephone, 50) && texteOuNul(op.source, 200), 'ssf.creer : champs invalides')
  },
  'ssf_quartier.remplacer'(op) {
    exiger(refSsf(op.ssf), 'ssf_quartier.remplacer : ssf { id | nom } requis')
    exiger(Array.isArray(op.remplace) && op.remplace.every(s => ['derive-', 'client-'].includes(s)), 'ssf_quartier.remplacer : remplace ⊂ [derive-, client-]')
    exiger(Array.isArray(op.lignes) && op.lignes.length <= 500, 'ssf_quartier.remplacer : lignes (≤ 500) requises')
    for (const l of op.lignes) {
      exiger(estTexte(l.zone, 200) && estTexte(l.quartier, 200), 'ssf_quartier.remplacer : zone et quartier requis')
      exiger(texteOuNul(l.source, 200) && typeof (l.a_confirmer ?? true) === 'boolean', 'ssf_quartier.remplacer : source / a_confirmer invalides')
    }
  },
  'regles_ssf.remplacer'(op) {
    exiger(UUID.test(op.user_id || ''), 'regles_ssf.remplacer : user_id invalide')
    exiger(Array.isArray(op.regles) && op.regles.length <= 20, 'regles_ssf.remplacer : regles (≤ 20) requises')
    exiger(op.created_by == null || UUID.test(op.created_by), 'regles_ssf.remplacer : created_by invalide')
    for (const r of op.regles) {
      exiger(refSsf(r.ssf), 'règle SSF : ssf { id | nom } requis')
      exiger(estTexte(r.label, 200) && r.label.startsWith('SSF — '), 'règle SSF : libellé « SSF — … » requis')
      exiger(estJours(r.days_of_week) && r.days_of_week.length, 'règle SSF : jours requis')
      exiger(r.date_debut == null || DATE.test(r.date_debut), 'règle SSF : date_debut invalide')
      exiger(texteOuNul(r.territoire, 200) && texteOuNul(r.distributeur, 200) && texteOuNul(r.notes, 4000), 'règle SSF : champs invalides')
      exiger(estListeTextes(r.pdv_ids, 20000, 64), 'règle SSF : pdv_ids invalides')
    }
  },
  'regle.jours'(op) {
    exiger(UUID.test(op.template_id || ''), 'regle.jours : template_id invalide')
    exiger(estJours(op.days_of_week), 'regle.jours : jours invalides')
    exiger(typeof op.is_active === 'boolean', 'regle.jours : is_active requis')
  },
  'profil.perimetre'(op) {
    exiger(UUID.test(op.user_id || ''), 'profil.perimetre : user_id invalide')
    exiger(estListeTextes(op.territoires_assignes, 200) && estListeTextes(op.quartiers_assignes, 2000), 'profil.perimetre : listes invalides')
    exiger(texteOuNul(op.zone_assignee, 200), 'profil.perimetre : zone_assignee invalide')
  },
  'tournees.recalculer'(op) {
    exiger(UUID.test(op.user_id || ''), 'tournees.recalculer : user_id invalide')
    exiger(DATE.test(op.debut || '') && DATE.test(op.fin || '') && op.debut <= op.fin, 'tournees.recalculer : période invalide')
  },
}

/** Lève une erreur si l'opération n'est pas d'un type autorisé ou mal formée. */
export function validerOperation(op, typesAutorises = Object.keys(VALIDATEURS)) {
  exiger(op && typeof op === 'object' && typeof op.type === 'string', 'opération sans type')
  exiger(typesAutorises.includes(op.type) && VALIDATEURS[op.type], `type d'opération refusé : ${op.type}`)
  VALIDATEURS[op.type](op)
}

export const estOperationInvalide = (e) => e instanceof OperationInvalide

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------
const ok = ({ error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`) }

async function idSsf(sb, ref) {
  if (ref.id) return ref.id
  const { data, error } = await sb.from('ssf').select('id').eq('nom', ref.nom).order('id').limit(1)
  if (error) throw error
  if (!data.length) throw new Error(`SSF introuvable : ${ref.nom}`)
  return data[0].id
}

async function idDistributeur(sb, nom) {
  if (!nom) return null
  const { data, error } = await sb.from('distributeur').select('id,nom')
  if (error) throw error
  const n = String(nom).trim().toUpperCase()
  return data.find(d => d.nom.toUpperCase() === n)?.id ?? null
}

const EXECUTEURS = {
  async 'ssf.creer'(sb, op) {
    const { data: existant } = await sb.from('ssf').select('id').eq('nom', op.nom.trim()).limit(1)
    if (existant?.length) return `SSF « ${op.nom} » déjà présent`
    ok(await sb.from('ssf').insert({
      nom: op.nom.trim(),
      telephone: op.telephone || null,
      distributeur_id: await idDistributeur(sb, op.distributeur),
      a_confirmer: false,
      source: op.source || 'import',
    }), 'ssf.creer')
    return `SSF « ${op.nom} » créé`
  },

  async 'ssf_quartier.remplacer'(sb, op) {
    const ssfId = await idSsf(sb, op.ssf)
    for (const prefixe of op.remplace) {
      ok(await sb.from('ssf_quartier').delete().eq('ssf_id', ssfId).like('source', `${prefixe}%`), 'ssf_quartier (suppression)')
    }
    if (op.lignes.length) {
      // Les quartiers saisis à la main dans l'admin (source « admin ») priment :
      // on ne les écrase pas.
      ok(await sb.from('ssf_quartier').upsert(op.lignes.map(l => ({
        ssf_id: ssfId, zone: l.zone, quartier: l.quartier, source: l.source || null, a_confirmer: l.a_confirmer ?? true,
      })), { onConflict: 'ssf_id,zone,quartier', ignoreDuplicates: true }), 'ssf_quartier (ajout)')
    }
    return `${op.lignes.length} quartier(s) pour le SSF ${op.ssf.nom || ssfId}`
  },

  async 'regles_ssf.remplacer'(sb, op) {
    // Les PDV et exceptions des anciennes règles partent en cascade ; les
    // tournées déjà générées gardent leurs étapes (template_id → NULL).
    ok(await sb.from('routing_templates').delete().eq('user_id', op.user_id).like('label', 'SSF — %'), 'règles SSF (suppression)')
    let nbPdv = 0
    for (const r of op.regles) {
      const ssfId = await idSsf(sb, r.ssf)
      const jours = [...new Set(r.days_of_week)].sort((a, b) => a - b)
      const { data: regle, error } = await sb.from('routing_templates').insert({
        user_id: op.user_id,
        label: r.label,
        mode: 'quota',
        ssf_id: ssfId,
        days_of_week: jours,
        day_of_week: jours[0],
        territoire: r.territoire || null,
        distributeur: r.distributeur || null,
        date_debut: r.date_debut || null,
        date_fin: null,
        notes: r.notes || null,
        is_active: true,
        created_by: op.created_by || null,
      }).select('id').single()
      if (error) throw new Error(`règle ${r.label} : ${error.message}`)
      const lignes = [...new Set(r.pdv_ids)].map((pdv_id, k) => ({
        template_id: regle.id, pdv_id, position_order: k + 1, objectifs: { releve_stock: true, photos: true },
      }))
      for (let i = 0; i < lignes.length; i += 500) {
        ok(await sb.from('routing_template_pdv').insert(lignes.slice(i, i + 500)), `PDV de la règle ${r.label}`)
      }
      nbPdv += lignes.length
    }
    return `${op.regles.length} règle(s) SSF, ${nbPdv} PDV`
  },

  async 'regle.jours'(sb, op) {
    const jours = [...new Set(op.days_of_week)].sort((a, b) => a - b)
    const maj = { days_of_week: jours, is_active: op.is_active }
    if (jours.length) maj.day_of_week = jours[0]
    ok(await sb.from('routing_templates').update(maj).eq('id', op.template_id), 'regle.jours')
    return op.is_active ? `règle ${op.template_id} : jours ${jours.join(',')}` : `règle ${op.template_id} désactivée`
  },

  async 'profil.perimetre'(sb, op) {
    const maj = { territoires_assignes: op.territoires_assignes, quartiers_assignes: op.quartiers_assignes }
    if (op.zone_assignee !== undefined) maj.zone_assignee = op.zone_assignee
    ok(await sb.from('profiles').update(maj).eq('id', op.user_id), 'profil.perimetre')
    return `périmètre de ${op.user_id}`
  },

  async 'tournees.recalculer'(sb, op) {
    // Tournées à venir encore intactes (toutes les étapes en attente) :
    // supprimées puis régénérées avec les règles actuelles. Une tournée
    // commencée n'est jamais touchée.
    const tournees = await toutesLesLignes(() => sb.from('routings')
      .select('id,status,routing_pdv(status)')
      .eq('user_id', op.user_id).gte('date_routing', op.debut).lte('date_routing', op.fin).order('id'))
    const intactes = tournees.filter(t => t.status === 'pending' && (t.routing_pdv || []).every(e => e.status === 'pending')).map(t => t.id)
    for (let i = 0; i < intactes.length; i += 200) {
      ok(await sb.from('routings').delete().in('id', intactes.slice(i, i + 200)), 'tournées à venir (suppression)')
    }
    const { data, error } = await sb.rpc('materialiser_routings_periode', { p_user_id: op.user_id, p_date_debut: op.debut, p_date_fin: op.fin })
    if (error) throw new Error(`pré-génération : ${error.message}`)
    return `${intactes.length} tournée(s) à venir recalculée(s), ${data || 0} créée(s)`
  },
}

/**
 * Applique les opérations dans l'ordre. S'arrête à la première erreur
 * (les opérations déjà faites restent faites : elles sont idempotentes, on
 * peut relancer après correction).
 */
export async function appliquerOperations(sb, operations, { typesAutorises, onProgression } = {}) {
  operations.forEach(op => validerOperation(op, typesAutorises))
  const journal = []
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]
    const message = await EXECUTEURS[op.type](sb, op)
    journal.push({ type: op.type, message })
    onProgression?.({ fait: i + 1, total: operations.length, type: op.type, message })
  }
  return journal
}

export const TYPES_OPERATIONS = Object.keys(VALIDATEURS)
