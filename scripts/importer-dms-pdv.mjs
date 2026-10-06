#!/usr/bin/env node
/**
 * Importe l'export clients DMS dans `pdv` : relie les PDV déjà connus par leur
 * code client (`pdv.mdm`) et crée les clients manquants. Logique :
 * scripts/lib/imports/dms-pdv.mjs (partagée avec Admin › Imports terrain).
 *
 * Simulation par défaut ; --apply pour écrire. Sorties (rapport, CSV, retour
 * arrière) dans ~/Downloads/imports-terrain/dms-pdv-<date-heure>/.
 *
 * Usage :
 *   node scripts/importer-dms-pdv.mjs [--dms=chemin.xlsx] [--seuil-depot=10] [--marqueur=import-dms-AAAA-MM-JJ] [--apply]
 *   node scripts/importer-dms-pdv.mjs --retour=…/retour.json [--apply]
 */
import { basename, join } from 'node:path'
import { arg, chemin, clientServiceRole, DOWNLOADS, lireClasseur, nombre, terminerImport, traiterRetour } from './lib/cli-import.mjs'
import { chargerDonneesDmsPdv, simulerDmsPdv } from './lib/imports/dms-pdv.mjs'

const supabase = clientServiceRole()
if (await traiterRetour(supabase, 'dms-pdv')) process.exit(0)

const fichier = chemin(arg('dms', join(DOWNLOADS, '20260929_115747.xlsx')))
const classeur = await lireClasseur(fichier)
const donnees = await chargerDonneesDmsPdv(supabase, { onEtape: m => console.log(`… ${m}`) })
const res = simulerDmsPdv(classeur, donnees, {
  seuilDepot: nombre('seuil-depot', 10),
  marqueur: arg('marqueur', null),
  nomFichier: basename(fichier),
})
await terminerImport(supabase, 'dms-pdv', res, {
  avantApplication: async () => {
    const { error } = await supabase.from('pdv').select('gps_source').limit(1)
    if (error) { console.error(`❌ Colonne pdv.gps_source absente (${error.message}) : appliquer d'abord 20260930091000.`); process.exit(1) }
  },
})
if (process.argv.includes('--apply')) {
  const { error } = await supabase.rpc('refresh_stats_dashboard')
  console.log(error ? `⚠️  refresh_stats_dashboard : ${error.message} (Maintenance › Rafraîchir les statistiques)` : '📊 Statistiques rafraîchies.')
}
