#!/usr/bin/env node
/**
 * Charge le routing mensuel d'une agence (fichier .csv ou .xlsx, mêmes
 * colonnes qu'Admin › Imports terrain › Routing mensuel). Logique :
 * scripts/lib/imports/routing-mensuel.mjs (partagée avec l'admin).
 *
 * Simulation par défaut ; --apply pour écrire. Sorties (rapport, CSV, retour
 * arrière) dans ~/Downloads/imports-terrain/routing-mensuel-<date-heure>/.
 * --jours=N : tournées recalculées sur les N jours à venir (7 par défaut,
 * 0 pour n'en recalculer aucune).
 *
 * Usage :
 *   node scripts/importer-routing-mensuel.mjs --fichier=chemin.csv [--jours=7] [--apply]
 *   node scripts/importer-routing-mensuel.mjs --retour=…/retour.json [--apply]
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { arg, chemin, clientServiceRole, lireClasseur, nombre, terminerImport, traiterRetour } from './lib/cli-import.mjs'
import { chargerDonneesRoutingMensuel, lireRoutingMensuelCsv, lireRoutingMensuelExcel, simulerRoutingMensuel } from './lib/imports/routing-mensuel.mjs'

const supabase = clientServiceRole()
if (await traiterRetour(supabase, 'routing-mensuel')) process.exit(0)

const fichier = chemin(arg('fichier', null))
if (!fichier) {
  console.error('--fichier=chemin.csv (ou .xlsx) requis')
  process.exit(1)
}
const lignes = /\.csv$/i.test(fichier)
  ? lireRoutingMensuelCsv(readFileSync(fichier, 'utf8'), basename(fichier))
  : lireRoutingMensuelExcel(await lireClasseur(fichier))
console.log(`📄 ${lignes.length} cases lues dans ${basename(fichier)}`)
const donnees = await chargerDonneesRoutingMensuel(supabase, { onEtape: m => console.log(`… ${m}`) })
const res = simulerRoutingMensuel(lignes, donnees, { fichier: basename(fichier), pregenererJours: nombre('jours', 7) })
await terminerImport(supabase, 'routing-mensuel', res)
