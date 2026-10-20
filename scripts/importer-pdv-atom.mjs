#!/usr/bin/env node
/**
 * PDV Atom géolocalisés : met en base les PDV identifiés par l'agence Atom
 * (export « Bonnet Rouge », onglet PDV, colonnes GPS_Lat / GPS_Lng), avec le
 * distributeur tiré de leurs visites. Logique : scripts/lib/imports/pdv-atom.mjs.
 *
 * Simulation par défaut ; --apply pour écrire. Sorties (rapport, CSV, retour
 * arrière) dans ~/Downloads/imports-terrain/pdv-atom-<date-heure>/.
 *
 * Usage :
 *   node scripts/importer-pdv-atom.mjs [--fichier=chemin.xlsx] [--routing=chemin.xlsx] [--marqueur=import-pdv-atom-AAAA-MM-JJ] [--apply]
 *   node scripts/importer-pdv-atom.mjs --retour=…/retour.json [--apply]
 */
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { arg, chemin, clientServiceRole, DOWNLOADS, lireClasseur, terminerImport, traiterRetour } from './lib/cli-import.mjs'
import { chargerDonneesPdvAtom, lirePdvAtom, simulerPdvAtom } from './lib/imports/pdv-atom.mjs'

const supabase = clientServiceRole()
if (await traiterRetour(supabase, 'pdv-atom')) process.exit(0)

const fichier = chemin(arg('fichier', join(DOWNLOADS, 'BONNET ROUGE MAI 2026.xlsx')))
const routingParDefaut = join(DOWNLOADS, 'BonnetRouge_Routing_2026-06-01_2026-09-30 (1).xlsx')
const fichierRouting = chemin(arg('routing', existsSync(routingParDefaut) ? routingParDefaut : ''))

const lu = lirePdvAtom(await lireClasseur(fichier), fichierRouting ? await lireClasseur(fichierRouting) : null)
console.log(`📄 ${lu.pdvs.length} PDV et ${lu.visites.length} visites avec distributeur lus (${basename(fichier)}${fichierRouting ? ` + ${basename(fichierRouting)}` : ''})`)
const donnees = await chargerDonneesPdvAtom(supabase, { onEtape: m => console.log(`… ${m}`) })
console.log(`… ${donnees.pdvsAtom.length} PDV Atom en base, ${donnees.lignesRouting.length} lignes de routing Atom`)
const res = simulerPdvAtom(lu, donnees, { marqueur: arg('marqueur', null), fichier: basename(fichier) })
await terminerImport(supabase, 'pdv-atom', res, {
  avantApplication: async () => {
    const { error } = await supabase.from('pdv_atom').select('pdv_id').limit(1)
    if (error) { console.error(`❌ ${error.message} — appliquer d'abord la migration 20261020100000_friesland_validation_tournee.sql`); process.exit(1) }
  },
})
