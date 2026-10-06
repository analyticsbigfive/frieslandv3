#!/usr/bin/env node
/**
 * Sous-zones SSF et planning hebdomadaire des merchandisers Atom.
 *
 * Dérive des visites qui portent un SSF (export Atom importé, app 1.0.12) :
 *   - la sous-zone de chaque SSF (quartiers) → table ssf_quartier ;
 *   - pour chaque merchandiser Atom actif, une règle de tournée « SSF — <nom> »
 *     par SSF principal, sur les jours où ce SSF domine ses visites, avec les
 *     PDV de son portefeuille situés dans la sous-zone ;
 *   - la règle « Portefeuille DMS » garde les jours non couverts ;
 *   - le périmètre du profil est élargi aux zones et quartiers des sous-zones.
 * L'Excel « SSF ↔ zones » du client (--fichier) remplace la dérivation pour les
 * SSF et merchandisers qu'il cite.
 *
 * Logique : scripts/lib/imports/ssf-sous-zones.mjs (partagée avec Admin ›
 * Imports terrain). Écritures : scripts/lib/imports/operations.mjs.
 *
 * Simulation par défaut ; --apply pour écrire (exige la migration
 * 20261007100000_friesland_ssf_sous_zones.sql). Sorties (rapport, CSV, retour
 * arrière) dans ~/Downloads/imports-terrain/ssf-sous-zones-<date-heure>/.
 *
 * Usage :
 *   node scripts/deriver-ssf-sous-zones.mjs [--fichier=ssf-zones.xlsx] [--mois=2026-09]
 *        [--debut=AAAA-MM-JJ] [--pregenerer=7] [--auteur=admin@…] [--apply]
 *        [--seuil-visites=5] [--seuil-part=0.05] [--seuil-ssf-part=0.08] [--seuil-ssf-visites=40]
 *   node scripts/deriver-ssf-sous-zones.mjs --retour=…/retour.json [--apply]
 */
import { basename } from 'node:path'
import { arg, chemin, clientServiceRole, lireClasseur, nombre, terminerImport, traiterRetour } from './lib/cli-import.mjs'
import { chargerDonneesSsf, deriverSsf, lireExcelClientSsf } from './lib/imports/ssf-sous-zones.mjs'

const supabase = clientServiceRole()
if (await traiterRetour(supabase, 'ssf-sous-zones')) process.exit(0)

const donnees = await chargerDonneesSsf(supabase, { onEtape: m => console.log(`… ${m}`) })
if (!donnees.migrationAppliquee) console.log('⚠ Migration 20261007100000 pas encore appliquée : simulation seulement (aucune sous-zone saisie lue).')

const fichier = chemin(arg('fichier', null))
let lignesClient = null
if (fichier) {
  lignesClient = lireExcelClientSsf(await lireClasseur(fichier))
  console.log(`Fichier client : ${lignesClient.length} ligne(s) lue(s) dans ${fichier}`)
}

let auteurId = null
const auteur = arg('auteur', null)
if (auteur) {
  const { data } = await supabase.from('profiles').select('id').ilike('email', auteur).eq('role', 'admin').maybeSingle()
  if (!data) throw new Error(`--auteur=${auteur} : aucun admin avec cet email`)
  auteurId = data.id
}

const res = deriverSsf(donnees, {
  seuilVisites: nombre('seuil-visites', 5),
  seuilPart: nombre('seuil-part', 0.05),
  seuilSsfPart: nombre('seuil-ssf-part', 0.08),
  seuilSsfVisites: nombre('seuil-ssf-visites', 40),
  moisJours: arg('mois', null),
  debut: arg('debut', null),
  pregenererJours: nombre('pregenerer', 0),
  auteurId,
  lignesClient,
  fichierClient: fichier ? basename(fichier) : null,
})
await terminerImport(supabase, 'ssf-sous-zones', res, {
  avantApplication: async () => {
    const { error } = await supabase.from('routing_templates').select('ssf_id').limit(1)
    const { error: e2 } = await supabase.from('ssf_quartier').select('id').limit(1)
    if (error || e2) {
      console.error(`❌ ${(error || e2).message} — appliquer d'abord supabase/nouveau/20261007100000_friesland_ssf_sous_zones.sql`)
      process.exit(1)
    }
  },
})
