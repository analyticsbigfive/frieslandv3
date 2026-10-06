/**
 * Socle des scripts d'import en ligne de commande (Node uniquement) :
 * arguments, client service_role, lecture des classeurs, sorties dans
 * ~/Downloads/imports-terrain/<import>-<date-heure>/ (jamais d'écrasement des
 * rapports précédents), application des opérations et retour arrière.
 *
 * La logique métier vit dans scripts/lib/imports/*.mjs, partagée avec
 * Admin › Imports terrain.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ExcelJS from 'exceljs'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appliquerOperations, OPERATIONS_PAR_IMPORT } from './imports/operations.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
config({ path: join(RACINE, '.env'), quiet: true })

export const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut
export const APPLY = process.argv.includes('--apply')
export const DOWNLOADS = join(process.env.HOME, 'Downloads')
export const chemin = (p) => (p?.startsWith('~/') ? join(process.env.HOME, p.slice(2)) : p)
export const nombre = (nom, defaut) => {
  const v = Number(arg(nom, defaut))
  if (!Number.isFinite(v)) throw new Error(`--${nom} : nombre attendu`)
  return v
}

export function clientServiceRole() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env')
    process.exit(1)
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function lireClasseur(fichier) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(chemin(fichier))
  return wb
}

const horodatage = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)

/** Écrit rapport, CSV et (si fourni) retour arrière dans un dossier daté ; renvoie le dossier. */
export function ecrireSorties(nomImport, res, { retour } = {}) {
  const dossier = join(DOWNLOADS, 'imports-terrain', `${nomImport}-${horodatage()}`)
  mkdirSync(dossier, { recursive: true })
  writeFileSync(join(dossier, 'rapport.md'), res.rapport, 'utf8')
  for (const [nom, texte] of Object.entries(res.csv || {})) writeFileSync(join(dossier, nom), texte, 'utf8')
  if (retour) writeFileSync(join(dossier, 'retour.json'), JSON.stringify(retour), 'utf8')
  return dossier
}

/** Applique les opérations d'un import (types limités à ceux de cet import). */
export async function appliquerImport(sb, nomImport, operations) {
  const journal = await appliquerOperations(sb, operations, {
    typesAutorises: OPERATIONS_PAR_IMPORT[nomImport],
    onProgression: ({ fait, total, message }) => console.log(`  [${fait}/${total}] ${message}`),
  })
  console.log(`✅ ${journal.length} opération(s) appliquée(s)`)
  return journal
}

/**
 * --retour=<retour.json> : rejoue le retour arrière d'un lot appliqué
 * (simulation sans --apply). Renvoie true si ce mode a été traité.
 */
export async function traiterRetour(sb, nomImport) {
  const fichier = chemin(arg('retour', null))
  if (!fichier) return false
  const operations = JSON.parse(readFileSync(fichier, 'utf8'))
  console.log(`Retour arrière : ${operations.length} opération(s) depuis ${fichier}`)
  if (!APPLY) { console.log('\nDRY-RUN : aucune écriture. Relancer avec --apply.'); return true }
  await appliquerImport(sb, nomImport, operations)
  return true
}

/** Fin commune : résumé, sorties, application si --apply. */
export async function terminerImport(sb, nomImport, res, { avantApplication } = {}) {
  console.log('\nRésumé :', res.resume)
  if (!APPLY) {
    const dossier = ecrireSorties(nomImport, res)
    console.log(`Rapport et CSV : ${dossier}`)
    console.log(`\nDRY-RUN : ${res.operations.length} opération(s) préparée(s), aucune écriture. Relancer avec --apply.`)
    return
  }
  if (res.bloquants?.length) {
    console.error(`❌ Import bloqué :\n${res.bloquants.map(b => `  - ${b}`).join('\n')}`)
    process.exit(1)
  }
  if (avantApplication) await avantApplication()
  const dossier = ecrireSorties(nomImport, res, { retour: res.retour })
  console.log(`Rapport, CSV et retour arrière (retour.json) : ${dossier}`)
  await appliquerImport(sb, nomImport, res.operations)
  console.log(`Annulation possible : node scripts/<script> --retour=${join(dossier, 'retour.json')} --apply`)
}
