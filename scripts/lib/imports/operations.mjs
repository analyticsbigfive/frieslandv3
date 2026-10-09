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
import { norm, toutesLesLignes } from '../commun.mjs'

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
const PDV_ID = /^[A-Za-z0-9_-]{1,64}$/
const estMarqueur = (v) => estTexte(v, 120) && /^import-[a-z0-9-]+$/i.test(v)
const estObjet = (v) => v && typeof v === 'object' && !Array.isArray(v)

// Colonnes qu'un import peut écrire. Toute autre clé est refusée.
const COLONNES_PDV_CREATION = new Set([
  'pdv_id', 'nom_pdv', 'canal', 'categorie_pdv', 'sous_categorie_pdv', 'region', 'zone', 'quartier', 'territory_code',
  'area_code', 'geolocation_lat', 'geolocation_lng', 'rayon_geofence', 'adressage', 'distributor_name', 'mdm',
  'date_creation', 'ajoute_par', 'is_active', 'gps_source',
])
const COLONNES_PDV_MAJ = new Set(['mdm', 'distributor_name', 'zone', 'territory_code', 'region', 'quartier', 'area_code'])
const COLONNES_VISITE = new Set([
  'visite_id', 'pdv_id', 'user_id', 'date_visite', 'commercial', 'email', 'geolocation_lat', 'geolocation_lng',
  'geofence_validated', 'precision_gps', 'status', 'sync_status', 'synced_at', 'distributeur_id', 'distributeur_brut',
  'ssf_id', 'ssf_brut', 'image_urls', 'data',
])
const PREFIXES_VISITE = ['ATOM-']
const clesAutorisees = (objet, autorisees) => Object.keys(objet).every(k => autorisees.has(k))
const prefixeVisite = (id) => PREFIXES_VISITE.find(p => String(id || '').startsWith(p))

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
  'routing_mensuel.remplacer'(op) {
    exiger(UUID.test(op.user_id || ''), 'routing_mensuel.remplacer : user_id invalide')
    exiger(texteOuNul(op.source, 200), 'routing_mensuel.remplacer : source invalide')
    exiger(Array.isArray(op.lignes) && op.lignes.length <= 40, 'routing_mensuel.remplacer : lignes (≤ 40) requises')
    for (const l of op.lignes) {
      exiger(Number.isInteger(l.jour_semaine) && l.jour_semaine >= 0 && l.jour_semaine <= 6, 'case : jour_semaine 0-6 requis')
      exiger(Number.isInteger(l.semaine_du_mois) && l.semaine_du_mois >= 1 && l.semaine_du_mois <= 5, 'case : semaine_du_mois 1-5 requise')
      exiger(l.ssf == null || refSsf(l.ssf), 'case : ssf { id | nom } ou null')
      exiger(l.commercial_id == null || UUID.test(l.commercial_id), 'case : commercial_id invalide')
      for (const k of ['secteur', 'commune', 'point_visite', 'zone', 'ssf_texte', 'type_engin', 'distributeur', 'source']) exiger(texteOuNul(l[k], 200), `case : ${k} invalide`)
      exiger(estListeTextes(l.quartiers || [], 50, 200), 'case : quartiers invalides')
      exiger(estListeTextes(l.lieux || [], 50, 300) && (l.lieux || []).every(x => x.includes('›')), 'case : lieux « ZONE›QUARTIER » invalides')
    }
  },
  'regles_mensuelles.remplacer'(op) {
    exiger(UUID.test(op.user_id || ''), 'regles_mensuelles.remplacer : user_id invalide')
    exiger(op.created_by == null || UUID.test(op.created_by), 'regles_mensuelles.remplacer : created_by invalide')
    exiger(Array.isArray(op.regles) && op.regles.length <= 60, 'regles_mensuelles.remplacer : regles (≤ 60) requises')
    for (const r of op.regles) {
      exiger(estTexte(r.label, 200) && (r.label.startsWith('Routing mensuel — ') || r.label.startsWith('SSF — ')), 'règle : libellé « Routing mensuel — … » ou « SSF — … » requis')
      exiger(r.ssf == null || refSsf(r.ssf), 'règle : ssf { id | nom } ou null')
      exiger(estJours(r.days_of_week) && r.days_of_week.length, 'règle : jours requis')
      exiger(r.semaines_du_mois == null || (Array.isArray(r.semaines_du_mois) && r.semaines_du_mois.length && r.semaines_du_mois.every(x => Number.isInteger(x) && x >= 1 && x <= 5)), 'règle : semaines 1-5')
      exiger(r.date_debut == null || DATE.test(r.date_debut), 'règle : date_debut invalide')
      exiger(texteOuNul(r.territoire, 200) && texteOuNul(r.distributeur, 200) && texteOuNul(r.notes, 4000), 'règle : champs invalides')
      exiger(estListeTextes(r.pdv_ids, 20000, 64) && r.pdv_ids.every(id => PDV_ID.test(id)), 'règle : pdv_ids invalides')
    }
  },
  'ssf.commercial'(op) {
    exiger(refSsf(op.ssf), 'ssf.commercial : ssf { id | nom } requis')
    exiger(op.commercial_id === null || UUID.test(op.commercial_id || ''), 'ssf.commercial : commercial_id invalide')
  },
  'ssf_pdv.remplacer'(op) {
    exiger(refSsf(op.ssf), 'ssf_pdv.remplacer : ssf { id | nom } requis')
    exiger(estTexte(op.source, 200) && op.source.startsWith('dms-'), 'ssf_pdv.remplacer : source « dms-… » requise')
    exiger(Number.isInteger(op.jour_semaine ?? 0) && (op.jour_semaine ?? 0) >= 0 && (op.jour_semaine ?? 0) <= 6, 'ssf_pdv.remplacer : jour_semaine 0-6')
    exiger(Array.isArray(op.pdv_ids) && op.pdv_ids.length <= 20000 && op.pdv_ids.every(id => PDV_ID.test(id)), 'ssf_pdv.remplacer : pdv_ids invalides')
    exiger(Array.isArray(op.remplace ?? ['dms-']) && (op.remplace ?? ['dms-']).every(s => ['dms-'].includes(s)), 'ssf_pdv.remplacer : remplace ⊂ [dms-]')
  },
  'regle.jours'(op) {
    exiger(UUID.test(op.template_id || ''), 'regle.jours : template_id invalide')
    exiger(estJours(op.days_of_week), 'regle.jours : jours invalides')
    exiger(typeof op.is_active === 'boolean', 'regle.jours : is_active requis')
    exiger(op.mode === undefined || ['quota', 'perimetre'].includes(op.mode), 'regle.jours : mode invalide')
    exiger(op.repli === undefined || typeof op.repli === 'boolean', 'regle.jours : repli booléen')
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
  'tournees.generer'(op) {
    exiger(UUID.test(op.user_id || ''), 'tournees.generer : user_id invalide')
    exiger(DATE.test(op.debut || '') && DATE.test(op.fin || '') && op.debut <= op.fin, 'tournees.generer : période invalide')
  },
  'pdv.creer'(op) {
    exiger(Array.isArray(op.lignes) && op.lignes.length && op.lignes.length <= 500, 'pdv.creer : 1 à 500 lignes')
    for (const l of op.lignes) {
      exiger(estObjet(l) && clesAutorisees(l, COLONNES_PDV_CREATION), 'pdv.creer : colonne non autorisée')
      exiger(PDV_ID.test(l.pdv_id || '') && estTexte(l.nom_pdv, 300) && l.nom_pdv.trim(), 'pdv.creer : pdv_id et nom_pdv requis')
      exiger(estMarqueur(l.ajoute_par), 'pdv.creer : marqueur ajoute_par « import-… » requis')
    }
  },
  'pdv.maj'(op) {
    exiger(Array.isArray(op.lignes) && op.lignes.length && op.lignes.length <= 200, 'pdv.maj : 1 à 200 lignes')
    for (const l of op.lignes) {
      exiger(PDV_ID.test(l?.pdv_id || ''), 'pdv.maj : pdv_id invalide')
      exiger(estObjet(l.valeurs) && Object.keys(l.valeurs).length && clesAutorisees(l.valeurs, COLONNES_PDV_MAJ), 'pdv.maj : colonne non autorisée')
      exiger(l.si_mdm_vide == null || typeof l.si_mdm_vide === 'boolean', 'pdv.maj : si_mdm_vide booléen')
    }
  },
  'pdv.supprimer'(op) {
    exiger(estMarqueur(op.marqueur), 'pdv.supprimer : marqueur « import-… » requis')
    exiger(Array.isArray(op.pdv_ids) && op.pdv_ids.length <= 500 && op.pdv_ids.every(id => PDV_ID.test(id)), 'pdv.supprimer : 500 pdv_id au plus')
  },
  'visites.importer'(op) {
    exiger(Array.isArray(op.lignes) && op.lignes.length && op.lignes.length <= 200, 'visites.importer : 1 à 200 lignes')
    for (const v of op.lignes) {
      exiger(estObjet(v) && clesAutorisees(v, COLONNES_VISITE), 'visites.importer : colonne non autorisée')
      exiger(prefixeVisite(v.visite_id) && estTexte(v.visite_id, 120), 'visites.importer : visite_id « ATOM-… » requis')
      exiger(UUID.test(v.user_id || '') && PDV_ID.test(v.pdv_id || '') && typeof v.date_visite === 'string', 'visites.importer : user_id, pdv_id, date_visite requis')
    }
  },
  'visites.supprimer'(op) {
    exiger(Array.isArray(op.visite_ids) && op.visite_ids.length <= 500 && op.visite_ids.every(id => prefixeVisite(id) && estTexte(id, 120)), 'visites.supprimer : 500 visite_id « ATOM-… » au plus')
  },
  'regle_dms.remplacer'(op) {
    exiger(UUID.test(op.user_id || ''), 'regle_dms.remplacer : user_id invalide')
    exiger(op.created_by == null || UUID.test(op.created_by), 'regle_dms.remplacer : created_by invalide')
    const r = op.regle
    if (r === null) return
    exiger(estObjet(r) && estTexte(r.label, 200) && r.label.startsWith('Portefeuille DMS'), 'regle_dms.remplacer : libellé « Portefeuille DMS… » requis')
    exiger(['quota', 'perimetre'].includes(r.mode), 'regle_dms.remplacer : mode invalide')
    exiger(estJours(r.days_of_week), 'regle_dms.remplacer : jours invalides')
    exiger(r.date_debut == null || DATE.test(r.date_debut), 'regle_dms.remplacer : date_debut invalide')
    exiger(typeof (r.is_active ?? true) === 'boolean' && texteOuNul(r.distributeur, 200) && texteOuNul(r.notes, 4000), 'regle_dms.remplacer : champs invalides')
    exiger(estListeTextes(r.pdv_ids, 20000, 64) && r.pdv_ids.every(id => PDV_ID.test(id)), 'regle_dms.remplacer : pdv_ids invalides')
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
    // Nom unique sans tenir compte des accents ni de la casse (index ssf_nom_unique).
    const { data: tous, error } = await sb.from('ssf').select('id,nom')
    if (error) throw new Error(`ssf.creer : ${error.message}`)
    if ((tous || []).some(s => norm(s.nom) === norm(op.nom))) return `SSF « ${op.nom} » déjà présent`
    const distributeurId = await idDistributeur(sb, op.distributeur)
    if (!distributeurId) throw new Error(`ssf.creer : distributeur « ${op.distributeur || '—'} » introuvable pour « ${op.nom} »`)
    ok(await sb.from('ssf').insert({
      nom: op.nom.trim(),
      telephone: op.telephone || null,
      distributeur_id: distributeurId,
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

  async 'routing_mensuel.remplacer'(sb, op) {
    // Upsert sur la clé (merchandiser, jour, semaine) : pas de doublon. Les
    // cases actives du merchandiser absentes de la liste sont désactivées
    // (pas supprimées : l'historique reste lisible).
    const lignes = []
    for (const l of op.lignes) {
      lignes.push({
        merchandiser_id: op.user_id, jour_semaine: l.jour_semaine, semaine_du_mois: l.semaine_du_mois,
        secteur: l.secteur || null, commune: l.commune || null, point_visite: l.point_visite || null, zone: l.zone || null,
        quartiers: [...new Set(l.quartiers || [])], lieux: [...new Set(l.lieux || [])], ssf_id: l.ssf ? await idSsf(sb, l.ssf) : null,
        ssf_texte: l.ssf_texte || null, type_engin: l.type_engin || null, commercial_id: l.commercial_id || null,
        distributeur: l.distributeur || null, source: l.source || op.source || 'import', actif: true,
      })
    }
    const garder = new Set(lignes.map(l => `${l.jour_semaine}|${l.semaine_du_mois}`))
    if (lignes.length) ok(await sb.from('routing_mensuel').upsert(lignes, { onConflict: 'merchandiser_id,jour_semaine,semaine_du_mois' }), 'routing mensuel (mise à jour)')
    const { data: actifs, error } = await sb.from('routing_mensuel').select('id,jour_semaine,semaine_du_mois').eq('merchandiser_id', op.user_id).eq('actif', true)
    if (error) throw new Error(`routing mensuel : ${error.message}`)
    const aDesactiver = (actifs || []).filter(b => !garder.has(`${b.jour_semaine}|${b.semaine_du_mois}`)).map(b => b.id)
    if (aDesactiver.length) ok(await sb.from('routing_mensuel').update({ actif: false }).in('id', aDesactiver), 'routing mensuel (désactivation)')
    return `${lignes.length} case(s) du routing mensuel, ${aDesactiver.length} désactivée(s)`
  },

  async 'regles_mensuelles.remplacer'(sb, op) {
    // Règles du routing mensuel et anciennes règles « SSF — » du merchandiser :
    // remplacées ensemble. PDV et exceptions partent en cascade ; les tournées
    // déjà générées gardent leurs étapes (template_id → NULL).
    for (const prefixe of ['SSF — %', 'Routing mensuel — %']) {
      ok(await sb.from('routing_templates').delete().eq('user_id', op.user_id).like('label', prefixe), 'règles du routing (suppression)')
    }
    let nbPdv = 0
    for (const r of op.regles) {
      const jours = [...new Set(r.days_of_week)].sort((a, b) => a - b)
      const { data: regle, error } = await sb.from('routing_templates').insert({
        user_id: op.user_id, label: r.label, mode: 'quota', ssf_id: r.ssf ? await idSsf(sb, r.ssf) : null,
        days_of_week: jours, day_of_week: jours[0], semaines_du_mois: r.semaines_du_mois || null, repli: false,
        territoire: r.territoire || null, distributeur: r.distributeur || null, date_debut: r.date_debut || null,
        date_fin: null, notes: r.notes || null, is_active: true, created_by: op.created_by || null,
      }).select('id').single()
      if (error) throw new Error(`règle ${r.label} : ${error.message}`)
      const lignes = [...new Set(r.pdv_ids)].map((pdv_id, k) => ({
        template_id: regle.id, pdv_id, position_order: k + 1, objectifs: { releve_stock: true, photos: true },
      }))
      for (let i = 0; i < lignes.length; i += 500) ok(await sb.from('routing_template_pdv').insert(lignes.slice(i, i + 500)), `PDV de la règle ${r.label}`)
      nbPdv += lignes.length
    }
    return `${op.regles.length} règle(s) du routing mensuel, ${nbPdv} PDV`
  },

  async 'ssf.commercial'(sb, op) {
    const ssfId = await idSsf(sb, op.ssf)
    ok(await sb.from('ssf').update({ commercial_id: op.commercial_id }).eq('id', ssfId), 'ssf.commercial')
    return `SSF ${op.ssf.nom || ssfId} : commercial ${op.commercial_id ? 'rattaché' : 'retiré'}`
  },

  async 'ssf_pdv.remplacer'(sb, op) {
    const ssfId = await idSsf(sb, op.ssf)
    const jour = op.jour_semaine ?? 0
    for (const prefixe of (op.remplace ?? ['dms-'])) {
      ok(await sb.from('ssf_pdv').delete().eq('ssf_id', ssfId).eq('jour_semaine', jour).like('source', `${prefixe}%`), 'routing SSF (suppression)')
    }
    const lignes = [...new Set(op.pdv_ids)].map(pdv_id => ({ ssf_id: ssfId, pdv_id, jour_semaine: jour, source: op.source }))
    for (let i = 0; i < lignes.length; i += 500) {
      ok(await sb.from('ssf_pdv').upsert(lignes.slice(i, i + 500), { onConflict: 'ssf_id,pdv_id,jour_semaine', ignoreDuplicates: true }), 'routing SSF (ajout)')
    }
    return `SSF ${op.ssf.nom || ssfId} : ${lignes.length} PDV`
  },

  async 'regle.jours'(sb, op) {
    const jours = [...new Set(op.days_of_week)].sort((a, b) => a - b)
    // Aucun jour : la règle reste visible (portefeuille de référence) mais ne
    // s'applique plus (day_of_week nul, sinon l'ancien jour unique reprendrait).
    const maj = { days_of_week: jours, day_of_week: jours.length ? jours[0] : null, is_active: op.is_active }
    // Mode facultatif : un agent Atom en « périmètre » passe en quotas (retour : périmètre).
    if (op.mode) maj.mode = op.mode
    // Repli : la règle de portefeuille ne s'applique que les jours sans autre règle.
    if (op.repli !== undefined) maj.repli = op.repli
    ok(await sb.from('routing_templates').update(maj).eq('id', op.template_id), 'regle.jours')
    const mode = op.mode === 'quota' ? ', passée en quotas' : op.mode === 'perimetre' ? ', remise en périmètre' : ''
    if (!op.is_active) return `règle ${op.template_id} désactivée${mode}`
    return jours.length ? `règle ${op.template_id} : jours ${jours.join(',')}${mode}` : `règle ${op.template_id} : aucun jour (couverte par les règles SSF)${mode}`
  },

  async 'profil.perimetre'(sb, op) {
    const maj = { territoires_assignes: op.territoires_assignes, quartiers_assignes: op.quartiers_assignes }
    if (op.zone_assignee !== undefined) maj.zone_assignee = op.zone_assignee
    ok(await sb.from('profiles').update(maj).eq('id', op.user_id), 'profil.perimetre')
    return `périmètre de ${op.user_id}`
  },

  async 'tournees.generer'(sb, op) {
    const { data, error } = await sb.rpc('materialiser_routings_periode', { p_user_id: op.user_id, p_date_debut: op.debut, p_date_fin: op.fin })
    if (error) throw new Error(`génération des tournées : ${error.message}`)
    return `${data || 0} tournée(s) générée(s)`
  },

  async 'pdv.creer'(sb, op) {
    // ignoreDuplicates : relancer le même lot ne crée rien en double.
    ok(await sb.from('pdv').upsert(op.lignes, { onConflict: 'pdv_id', ignoreDuplicates: true }), 'pdv.creer')
    return `${op.lignes.length} PDV créé(s)`
  },

  async 'pdv.maj'(sb, op) {
    let faits = 0
    for (let i = 0; i < op.lignes.length; i += 10) {
      await Promise.all(op.lignes.slice(i, i + 10).map(async (l) => {
        let q = sb.from('pdv').update(l.valeurs).eq('pdv_id', l.pdv_id)
        if (l.si_mdm_vide) q = q.is('mdm', null)
        ok(await q, `pdv.maj ${l.pdv_id}`)
        faits++
      }))
    }
    return `${faits} PDV mis à jour`
  },

  async 'pdv.supprimer'(sb, op) {
    if (!op.pdv_ids.length) return '0 PDV'
    // Un PDV déjà visité n'est jamais supprimé (ses visites restent valables).
    const { data: visites, error } = await sb.from('visites').select('pdv_id').in('pdv_id', op.pdv_ids)
    if (error) throw new Error(`pdv.supprimer : ${error.message}`)
    const visites_ = new Set((visites || []).map(v => v.pdv_id))
    const aSupprimer = op.pdv_ids.filter(id => !visites_.has(id))
    if (aSupprimer.length) ok(await sb.from('pdv').delete().in('pdv_id', aSupprimer).eq('ajoute_par', op.marqueur), 'pdv.supprimer')
    return `${aSupprimer.length} PDV supprimé(s), ${op.pdv_ids.length - aSupprimer.length} gardé(s) car visité(s)`
  },

  async 'visites.importer'(sb, op) {
    ok(await sb.from('visites').upsert(op.lignes, { onConflict: 'visite_id', ignoreDuplicates: true }), 'visites.importer')
    return `${op.lignes.length} visite(s) importée(s)`
  },

  async 'visites.supprimer'(sb, op) {
    if (!op.visite_ids.length) return '0 visite'
    ok(await sb.from('visites').delete().in('visite_id', op.visite_ids), 'visites.supprimer')
    return `${op.visite_ids.length} visite(s) supprimée(s)`
  },

  async 'regle_dms.remplacer'(sb, op) {
    ok(await sb.from('routing_templates').delete().eq('user_id', op.user_id).like('label', 'Portefeuille DMS%'), 'règle DMS (suppression)')
    const r = op.regle
    if (!r) return 'règle DMS supprimée'
    const jours = [...new Set(r.days_of_week)].sort((a, b) => a - b)
    const { data: regle, error } = await sb.from('routing_templates').insert({
      user_id: op.user_id, label: r.label, mode: r.mode, days_of_week: jours, day_of_week: jours.length ? jours[0] : null,
      territoire: null, distributeur: r.distributeur || null, date_debut: r.date_debut || null, date_fin: null,
      notes: r.notes || null, is_active: r.is_active !== false, created_by: op.created_by || null,
    }).select('id').single()
    if (error) throw new Error(`règle ${r.label} : ${error.message}`)
    const lignes = [...new Set(r.pdv_ids)].map((pdv_id, k) => ({ template_id: regle.id, pdv_id, position_order: k + 1, objectifs: { releve_stock: true, photos: true } }))
    for (let i = 0; i < lignes.length; i += 500) ok(await sb.from('routing_template_pdv').insert(lignes.slice(i, i + 500)), `PDV de la règle ${r.label}`)
    return `règle « ${r.label} » : ${lignes.length} PDV`
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

/** Opérations autorisées pour chaque import (écriture ET retour arrière). */
export const OPERATIONS_PAR_IMPORT = {
  'dms-pdv': ['pdv.creer', 'pdv.maj', 'pdv.supprimer'],
  'merch-dms': ['profil.perimetre', 'regle_dms.remplacer', 'regle.jours', 'tournees.generer'],
  'routing-atom': ['pdv.creer', 'pdv.supprimer', 'visites.importer', 'visites.supprimer'],
  'ssf-sous-zones': ['ssf.creer', 'ssf_quartier.remplacer', 'regles_ssf.remplacer', 'regle.jours', 'profil.perimetre', 'tournees.recalculer'],
  'routing-ssf-dms': ['ssf.creer', 'ssf_pdv.remplacer'],
  'routing-mensuel': ['ssf.creer', 'ssf.commercial', 'ssf_quartier.remplacer', 'routing_mensuel.remplacer', 'regles_mensuelles.remplacer', 'regle.jours', 'profil.perimetre', 'tournees.recalculer'],
}

/**
 * Découpe des opérations en envois de taille raisonnable pour la route
 * serveur (limite de 4,5 Mo par requête sur Vercel) : au plus `maxOps`
 * opérations et ~`maxOctets` de JSON par envoi.
 */
export function decouperOperations(operations, { maxOps = 20, maxOctets = 1_000_000 } = {}) {
  const envois = []
  let courant = []
  let taille = 0
  for (const op of operations) {
    const t = JSON.stringify(op).length
    if (courant.length && (courant.length >= maxOps || taille + t > maxOctets)) { envois.push(courant); courant = []; taille = 0 }
    courant.push(op)
    taille += t
  }
  if (courant.length) envois.push(courant)
  return envois
}
