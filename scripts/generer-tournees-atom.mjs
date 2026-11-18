#!/usr/bin/env node
/**
 * Génère les tournées des merchandisers Atom de demain jusqu'à une date
 * (fin de l'année par défaut). Même appel que le bouton « Exporter le mois »
 * de l'admin (materialiser_routings_periode, par tranches de 7 jours), pour
 * plusieurs mois d'un coup.
 *
 * Demande de Jean Luc du 18/11/2026. À savoir :
 *   - une tournée déjà générée n'est jamais recalculée : ce script n'ajoute
 *     que les jours manquants, et ce qu'il crée est figé (boutiques créées ou
 *     fermées ensuite, corrections du routing : non reprises) ;
 *   - chaque boutique reste prévue une seule fois par mois civil ;
 *   - les jours de 5e semaine (29 au 31) sont en visite libre, sans liste ;
 *   - les jours fériés ne sont pas traités à part (25/12 : tournée normale).
 *
 * Merchandisers : employeur « atom », actifs, avec un routing mensuel actif,
 * hors comptes de test (@friesland-test.ci). --compte=e-mail pour un seul.
 *
 * Simulation par défaut ; --apply pour écrire.
 *
 * Usage :
 *   node scripts/generer-tournees-atom.mjs [--fin=2026-12-31] [--compte=…] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })
const APPLY = process.argv.includes('--apply')
const arg = nom => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=')

// Date du jour à Abidjan (UTC+0).
const aujourdhui = new Date().toISOString().slice(0, 10)
const plus = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const DEBUT = plus(aujourdhui, 1)
const FIN = arg('fin') || `${aujourdhui.slice(0, 4)}-12-31`
if (!/^\d{4}-\d{2}-\d{2}$/.test(FIN) || FIN < DEBUT) {
  console.error(`--fin=AAAA-MM-JJ attendu, après le ${DEBUT}`)
  process.exit(1)
}
const COMPTE = arg('compte')?.toLowerCase()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const must = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }

/** Tranches de 7 jours : chaque appel reste sous la limite de durée. */
function tranches(debut, fin) {
  const out = []
  for (let du = debut; du <= fin; du = plus(du, 7)) out.push({ du, au: plus(du, 6) < fin ? plus(du, 6) : fin })
  return out
}
async function tourneesDe(id) {
  const lignes = []
  for (let i = 0; ; i += 1000) {
    const page = must(await supabase.from('routings').select('date_routing,routing_pdv(count)')
      .eq('user_id', id).gte('date_routing', DEBUT).lte('date_routing', FIN).order('date_routing').range(i, i + 999), 'tournées')
    lignes.push(...page)
    if (page.length < 1000) return lignes
  }
}
function parMois(tournees) {
  const m = {}
  for (const t of tournees) {
    const k = t.date_routing.slice(0, 7)
    const n = t.routing_pdv?.[0]?.count ?? 0
    m[k] ??= { jours: 0, pdv: 0, libres: 0 }
    m[k].jours++
    m[k].pdv += n
    if (!n) m[k].libres++
  }
  return m
}
const texteMois = m => Object.entries(m).map(([k, v]) => `${k} : ${v.jours} j, ${v.pdv} PDV${v.libres ? ` (${v.libres} visite libre)` : ''}`).join(' · ') || 'aucune'

// ---- Lecture -----------------------------------------------------------------
const comptes = must(await supabase.from('profiles').select('id,nom,email')
  .eq('employeur', 'atom').eq('role', 'merchandiser').eq('is_active', true).order('nom'), 'comptes')
  .filter(c => !String(c.email || '').endsWith('@friesland-test.ci'))
  .filter(c => !COMPTE || String(c.email || '').toLowerCase() === COMPTE)
const routing = must(await supabase.from('routing_mensuel').select('merchandiser_id').eq('actif', true).in('merchandiser_id', comptes.map(c => c.id)), 'routing mensuel')
const avecRouting = new Set(routing.map(r => r.merchandiser_id))
const cibles = comptes.filter(c => avecRouting.has(c.id))
const sans = comptes.filter(c => !avecRouting.has(c.id))
if (!cibles.length) throw new Error('Aucun merchandiser Atom avec un routing mensuel actif')

let ouvrables = 0
for (let d = DEBUT; d <= FIN; d = plus(d, 1)) if (new Date(`${d}T12:00:00Z`).getUTCDay() !== 0) ouvrables++
console.log(`${APPLY ? '=== APPLY ===' : '=== SIMULATION ==='}  du ${DEBUT} au ${FIN} : ${ouvrables} jours hors dimanche, ${cibles.length} merchandiser(s).`)
for (const s of sans) console.log(`  Sans routing mensuel, ignoré : ${s.nom}`)

const avant = {}
for (const c of cibles) {
  const t = await tourneesDe(c.id)
  avant[c.id] = t.length
  console.log(`  ${c.nom.padEnd(28)} déjà ${String(t.length).padStart(2)} tournée(s), ${ouvrables - t.length} jour(s) à générer au plus`)
}

if (!APPLY) {
  console.log('\nSimulation : rien n’a été écrit. Relancer avec --apply.')
  process.exit(0)
}

// ---- Génération --------------------------------------------------------------
const lots = tranches(DEBUT, FIN)
let total = 0
for (const [i, c] of cibles.entries()) {
  for (const t of lots) {
    must(await supabase.rpc('materialiser_routings_periode', { p_user_id: c.id, p_date_debut: t.du, p_date_fin: t.au }), `${c.nom}, ${t.du}`)
  }
  // La fonction compte aussi les tournées déjà là : on compte nous-mêmes.
  const apres = await tourneesDe(c.id)
  const creees = apres.length - avant[c.id]
  total += creees
  console.log(`  ✓ ${c.nom.padEnd(28)} (${i + 1}/${cibles.length}) +${creees} tournée(s) — ${texteMois(parMois(apres))}`)
}
console.log(`\nTerminé : ${total} tournée(s) créée(s).`)
