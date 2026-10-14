#!/usr/bin/env node
/**
 * Charge une liste de PDV par jour (fichier d'une agence, .xlsx à une feuille
 * par jour ou .csv avec une colonne « Jour ») : mêmes règles qu'Admin ›
 * Imports terrain › Liste de PDV par jour. Logique :
 * scripts/lib/imports/liste-pdv.mjs (partagée avec l'admin).
 *
 * Simulation par défaut ; --apply pour écrire. Sorties (rapport, CSV, retour
 * arrière) dans ~/Downloads/imports-terrain/liste-pdv-<date-heure>/.
 * --merch=<e-mail ou nom> : merchandiser, si le fichier n'a pas de colonne
 * « Merchandiser ». --debut=AAAA-MM-JJ : premier jour des règles (aujourd'hui
 * par défaut). --jours=N : tournées recalculées sur les N jours à venir
 * (7 par défaut, 0 pour aucune).
 *
 * Usage :
 *   node scripts/importer-liste-pdv.mjs --fichier=liste.xlsx --merch=marcorytreichone@gmail.com [--debut=2026-10-19] [--apply]
 *   node scripts/importer-liste-pdv.mjs --retour=…/retour.json [--apply]
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { arg, chemin, clientServiceRole, lireClasseur, nombre, terminerImport, traiterRetour } from './lib/cli-import.mjs'
import { trouverPersonne } from './lib/commun.mjs'
import { chargerDonneesListePdv, chargerMerchandisers, lireListePdvCsv, lireListePdvExcel, simulerListePdv } from './lib/imports/liste-pdv.mjs'

const supabase = clientServiceRole()
if (await traiterRetour(supabase, 'liste-pdv')) process.exit(0)

const fichier = chemin(arg('fichier', null))
if (!fichier) {
  console.error('--fichier=chemin.xlsx (ou .csv) requis')
  process.exit(1)
}
const { lignes, avecMerch } = /\.csv$/i.test(fichier)
  ? lireListePdvCsv(readFileSync(fichier, 'utf8'), basename(fichier))
  : lireListePdvExcel(await lireClasseur(fichier))
console.log(`📄 ${lignes.length} lignes lues dans ${basename(fichier)}`)

let merchandiserId = null
const merch = arg('merch', null)
if (merch) {
  const r = trouverPersonne(merch, await chargerMerchandisers(supabase), { noms: p => [p.nom, p.email].filter(Boolean) })
  if (!r.trouve) {
    console.error(`Merchandiser « ${merch} » introuvable${r.candidats.length ? ` (pistes : ${r.candidats.map(c => c.nom).join(', ')})` : ''}`)
    process.exit(1)
  }
  merchandiserId = r.trouve.id
  console.log(`👤 ${r.trouve.nom} (${r.trouve.email})`)
}
else if (!avecMerch) {
  console.error('Le fichier n’a pas de colonne « Merchandiser » : --merch=<e-mail ou nom> requis')
  process.exit(1)
}

const donnees = await chargerDonneesListePdv(supabase, lignes, { merchandiserId, onEtape: m => console.log(`… ${m}`) })
const res = simulerListePdv(lignes, donnees, {
  fichier: basename(fichier),
  debut: arg('debut', undefined),
  jours: nombre('jours', 7),
  marqueur: `import-liste-pdv-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}`,
})
await terminerImport(supabase, 'liste-pdv', res)
