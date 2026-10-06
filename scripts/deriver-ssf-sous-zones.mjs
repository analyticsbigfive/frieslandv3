#!/usr/bin/env node
/**
 * Sous-zones SSF et planning hebdomadaire des merchandisers Atom.
 *
 * Dérive des visites qui portent un SSF (export Atom importé, app 1.0.11) :
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
 * Simulation par défaut (rapport + CSV dans ~/Downloads) ; --apply pour écrire
 * (exige la migration 20261007100000_friesland_ssf_sous_zones.sql). Chaque
 * --apply écrit aussi le fichier de retour arrière, rejouable avec --retour.
 *
 * Usage :
 *   node scripts/deriver-ssf-sous-zones.mjs [--fichier=ssf-zones.xlsx] [--mois=2026-09]
 *        [--debut=AAAA-MM-JJ] [--pregenerer=7] [--auteur=admin@…] [--apply]
 *        [--seuil-visites=5] [--seuil-part=0.05] [--seuil-ssf-part=0.08] [--seuil-ssf-visites=40]
 *   node scripts/deriver-ssf-sous-zones.mjs --retour=~/Downloads/ssf-sous-zones-retour-….json [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ExcelJS from 'exceljs'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chargerDonneesSsf, deriverSsf, lireExcelClientSsf } from './lib/imports/ssf-sous-zones.mjs'
import { appliquerOperations } from './lib/imports/operations.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut
const nombre = (nom, defaut) => { const v = Number(arg(nom, defaut)); if (!Number.isFinite(v)) throw new Error(`--${nom} : nombre attendu`); return v }
const chemin = (p) => (p?.startsWith('~/') ? join(process.env.HOME, p.slice(2)) : p)
const APPLY = process.argv.includes('--apply')
const FICHIER = chemin(arg('fichier', null))
const RETOUR = chemin(arg('retour', null))
const DOWNLOADS = join(process.env.HOME, 'Downloads')
const horodatage = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env')
  process.exit(1)
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function exigerMigration() {
  const { error } = await supabase.from('routing_templates').select('ssf_id').limit(1)
  const { error: e2 } = await supabase.from('ssf_quartier').select('id').limit(1)
  if (error || e2) {
    console.error(`❌ ${(error || e2).message} — appliquer d'abord supabase/nouveau/20261007100000_friesland_ssf_sous_zones.sql`)
    process.exit(1)
  }
}

async function appliquer(operations) {
  await exigerMigration()
  const journal = await appliquerOperations(supabase, operations, {
    onProgression: ({ fait, total, message }) => console.log(`  [${fait}/${total}] ${message}`),
  })
  console.log(`✅ ${journal.length} opération(s) appliquée(s)`)
}

// ---- Retour arrière -----------------------------------------------------
if (RETOUR) {
  const operations = JSON.parse(readFileSync(RETOUR, 'utf8'))
  console.log(`Retour arrière : ${operations.length} opération(s) depuis ${RETOUR}`)
  if (!APPLY) { console.log('\nDRY-RUN : aucune écriture. Relancer avec --apply.'); process.exit(0) }
  await appliquer(operations)
  process.exit(0)
}

// ---- Dérivation -----------------------------------------------------------
const donnees = await chargerDonneesSsf(supabase, { onEtape: m => console.log(`… ${m}`) })
if (!donnees.migrationAppliquee) console.log('⚠ Migration 20261007100000 pas encore appliquée : simulation seulement (aucune sous-zone saisie lue).')

let lignesClient = null
if (FICHIER) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(FICHIER)
  lignesClient = lireExcelClientSsf(wb)
  console.log(`Fichier client : ${lignesClient.length} ligne(s) lue(s) dans ${FICHIER}`)
}

let auteurId = null
const AUTEUR = arg('auteur', null)
if (AUTEUR) {
  const { data } = await supabase.from('profiles').select('id').ilike('email', AUTEUR).eq('role', 'admin').maybeSingle()
  if (!data) throw new Error(`--auteur=${AUTEUR} : aucun admin avec cet email`)
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
  fichierClient: FICHIER ? basename(FICHIER) : null,
})

const OUT_MD = join(DOWNLOADS, 'ssf-sous-zones-rapport.md')
writeFileSync(OUT_MD, res.rapport, 'utf8')
for (const [nom, texte] of Object.entries(res.csv)) writeFileSync(join(DOWNLOADS, nom), texte, 'utf8')
console.log('\nRésumé :', res.resume)
console.log(`Rapport : ${OUT_MD}`)
console.log(`CSV : ${Object.keys(res.csv).map(n => join(DOWNLOADS, n)).join(', ')}`)

if (!APPLY) {
  console.log(`\nDRY-RUN : ${res.operations.length} opération(s) préparée(s), aucune écriture. Relancer avec --apply.`)
  process.exit(0)
}

const OUT_RETOUR = join(DOWNLOADS, `ssf-sous-zones-retour-${horodatage}.json`)
writeFileSync(OUT_RETOUR, JSON.stringify(res.retour, null, 1), 'utf8')
console.log(`Retour arrière enregistré : ${OUT_RETOUR}`)
await appliquer(res.operations)
