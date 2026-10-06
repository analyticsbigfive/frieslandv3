#!/usr/bin/env node
/**
 * Importe l'historique de visites Atom BTL (export « Bonnet Rouge », feuille
 * « Routing détaillé ») dans `visites`. Logique :
 * scripts/lib/imports/routing-atom.mjs (partagée avec Admin › Imports terrain).
 *
 * Simulation par défaut ; --apply pour écrire. Sorties (rapport, CSV, retour
 * arrière) dans ~/Downloads/imports-terrain/routing-atom-<date-heure>/.
 * Relance idempotente : visite_id = ATOM-<date>-<n° ligne>.
 *
 * Usage :
 *   node scripts/importer-routing-atom.mjs [--fichier=chemin.xlsx] [--marqueur=import-atom-AAAA-MM-JJ] [--apply]
 *   node scripts/importer-routing-atom.mjs --retour=…/retour.json [--apply]
 */
import { basename, join } from 'node:path'
import { arg, chemin, clientServiceRole, DOWNLOADS, lireClasseur, terminerImport, traiterRetour } from './lib/cli-import.mjs'
import { chargerDonneesRoutingAtom, lireExcelRoutingAtom, simulerRoutingAtom } from './lib/imports/routing-atom.mjs'

const supabase = clientServiceRole()
if (await traiterRetour(supabase, 'routing-atom')) process.exit(0)

const fichier = chemin(arg('fichier', join(DOWNLOADS, 'BonnetRouge_Routing_2026-06-01_2026-09-30.xlsx')))
const lignes = lireExcelRoutingAtom(await lireClasseur(fichier))
console.log(`📄 ${lignes.length} lignes lues dans ${basename(fichier)}`)
const donnees = await chargerDonneesRoutingAtom(supabase, { onEtape: m => console.log(`… ${m}`) })
const res = simulerRoutingAtom(lignes, donnees, { marqueur: arg('marqueur', null), fichier: basename(fichier) })
await terminerImport(supabase, 'routing-atom', res, {
  avantApplication: async () => {
    const { error } = await supabase.from('visites').select('ssf_id').limit(1)
    if (error) { console.error(`❌ ${error.message} — appliquer d'abord 20261006100000_friesland_employeur_atom_ssf.sql`); process.exit(1) }
  },
})
if (process.argv.includes('--apply')) {
  const { error } = await supabase.rpc('refresh_stats_dashboard')
  console.log(error ? `⚠️  refresh_stats_dashboard : ${error.message} (Maintenance › Rafraîchir les statistiques)` : '📊 Statistiques rafraîchies.')
}
