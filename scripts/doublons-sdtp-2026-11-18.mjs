#!/usr/bin/env node
/**
 * 8 doublons parmi les boutiques SDTP sans GPS de Port-Bouët (Guehi Daniel),
 * relevés le 18/11/2026 : même nom et même téléphone, une fiche de l'import
 * Atom du 06/10 et une du 20/10. Décision de Jean Luc du 18/11 : on les traite.
 *
 * Règle déjà en place pour un doublon (traiter_doublon_possible) : la fiche en
 * double est désactivée, ses visites restent, l'autre fiche reste la
 * référence. Rien n'est fusionné ni supprimé. La fiche gardée est celle qui
 * est dans le routing de Guehi Daniel.
 *
 * Puis le rattachement Atom est recalculé pour ces fiches (elles sortent des
 * listes). Aucune n'est dans une tournée.
 *
 * Simulation par défaut ; avec --apply, le retour arrière est écrit dans
 * ~/Downloads.
 *
 * Usage : node scripts/doublons-sdtp-2026-11-18.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })
const APPLY = process.argv.includes('--apply')

// [fiche en double à désactiver, fiche gardée]
const PAIRES = [
  ['7ac77c96', '4aef4805'], // Boutique chez Drissa Alassane
  ['fb9d50c9', '88dc5055'], // Boutique chez Aziz
  ['e68e7e41', '9104c043'], // Boutique chez Ousman
  ['c0594f54', '31d8ebc6'], // Boutique chez Hamed ibé
  ['190c9d21', '1502a63c'], // Boutique chez sidy
  ['35f542d9', '1502a63c'], // Boutique chez sidy (3e fiche)
  ['24324bca', '18d6ac64'], // Boutique chez amidou
  ['f994efaf', '3eefdf18'], // Boutique chez Barry
]

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const must = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const tel = p => String(p.telephone || p.adressage || '').replace(/\D/g, '')

// ---- Lecture et contrôles ----------------------------------------------------
const ids = [...new Set(PAIRES.flat())]
const fiches = new Map(must(await supabase.from('pdv')
  .select('pdv_id,nom_pdv,telephone,adressage,is_active,distributor_name,geolocation_lat,geolocation_lng').in('pdv_id', ids), 'fiches').map(p => [p.pdv_id, p]))
const etapes = must(await supabase.from('routing_pdv').select('pdv_id,status,routings(date_routing)').in('pdv_id', PAIRES.map(p => p[0])), 'étapes de tournée')
const visites = must(await supabase.from('visites').select('pdv_id').in('pdv_id', PAIRES.map(p => p[0])), 'visites')

const aFaire = []
for (const [double, gardee] of PAIRES) {
  const d = fiches.get(double), g = fiches.get(gardee)
  if (!d || !g) throw new Error(`Fiche introuvable : ${!d ? double : gardee}`)
  if (norm(d.nom_pdv) !== norm(g.nom_pdv) || !tel(d) || tel(d) !== tel(g)) throw new Error(`${double} / ${gardee} : nom ou téléphone différents, rien n'est fait`)
  if (g.is_active === false) throw new Error(`${gardee} (à garder) est désactivée : rien n'est fait`)
  const prevues = etapes.filter(e => e.pdv_id === double && e.status === 'pending')
  if (prevues.length) throw new Error(`${double} est prévue dans ${prevues.length} tournée(s) : à retirer d'abord`)
  const n = visites.filter(v => v.pdv_id === double).length
  if (d.is_active === false) { console.log(`  déjà désactivée : ${double} « ${d.nom_pdv} »`); continue }
  console.log(`  ${double} « ${d.nom_pdv} » désactivée (${n} visite(s) gardée(s) sur cette fiche) → référence ${gardee}`)
  aFaire.push(double)
}
console.log(`${aFaire.length} fiche(s) en double à désactiver sur ${PAIRES.length}.`)

if (!APPLY) {
  console.log('\nSimulation : rien n’a été écrit. Relancer avec --apply.')
  process.exit(0)
}
if (!aFaire.length) process.exit(0)

// ---- Retour arrière, puis écritures ------------------------------------------
const fichierRetour = join(homedir(), 'Downloads', `retour-doublons-sdtp-2026-11-18-${Date.now()}.json`)
writeFileSync(fichierRetour, JSON.stringify({ reactiver: aFaire }, null, 2))
console.log(`\nRetour arrière : ${fichierRetour}`)

must(await supabase.from('pdv').update({ is_active: false }).in('pdv_id', aFaire).select('pdv_id'), 'désactivation')
console.log(`  ✓ ${aFaire.length} fiche(s) désactivée(s)`)
must(await supabase.rpc('recalculer_quartiers_atom', { p_pdv_ids: aFaire }), 'recalcul du rattachement')
console.log('  ✓ rattachement Atom recalculé')
