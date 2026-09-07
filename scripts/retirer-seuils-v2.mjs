#!/usr/bin/env node
/**
 * Lot 6.1 — Disponibilité V2 (fichier client du 7 sept. 2026) : retrait des
 * 17 seuils GT obsolètes, puis recalcul Perfect Store. Même effet que la
 * suppression ligne à ligne dans Référentiels → Seuils dispo ; les lignes
 * SupermarcheMT (câblage MT de juillet) sont conservées.
 *
 * Usage : node scripts/retirer-seuils-v2.mjs            # dry-run
 *         node scripts/retirer-seuils-v2.mjs --apply    # supprime + recalcule
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()
const APPLY = process.argv.includes('--apply')
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const CIBLES = [
  { nom: 'BRB 380g', segments: { Boutique: ['A', 'B', 'C'], Minimarket: ['A', 'B'] } },
  { nom: 'BR 1kg', segments: { Boutique: ['A'], Minimarket: ['A', 'B'] } },
  { nom: 'Pearl 1kg', segments: { Boutique: ['A', 'B', 'C'], Minimarket: ['A', 'B'], Kiosque: ['A', 'B'], Aboki: ['A', 'B'] } },
]

const { data: refs } = await s.from('reference_produit').select('id, nom')
let total = 0
for (const c of CIBLES) {
  const ref = refs.find(r => r.nom === c.nom)
  if (!ref) { console.error('référence introuvable :', c.nom); process.exit(1) }
  for (const [segment, grades] of Object.entries(c.segments)) {
    const { data: rows } = await s.from('seuil_disponibilite').select('segment, grade, quantite_min')
      .eq('reference_produit_id', ref.id).eq('segment', segment).in('grade', grades)
    for (const r of rows || []) {
      total++
      console.log(`${APPLY ? 'suppr.' : 'à supprimer'} ${c.nom.padEnd(10)} ${segment.padEnd(11)} ${r.grade}  (min ${r.quantite_min})`)
      if (APPLY) {
        const { error } = await s.from('seuil_disponibilite').delete()
          .eq('reference_produit_id', ref.id).eq('segment', segment).eq('grade', r.grade)
        if (error) { console.error('échec :', error.message); process.exit(1) }
      }
    }
  }
}
console.log(`${total} ligne(s) ${APPLY ? 'supprimée(s)' : 'concernée(s)'} — attendu : 17`)
const { count } = await s.from('seuil_disponibilite').select('*', { count: 'exact', head: true })
console.log('seuils restants :', count)
if (APPLY) {
  console.log('Recalcul Perfect Store (recalculer_tous_perfect_store)…')
  const t = Date.now()
  const { data, error } = await s.rpc('recalculer_tous_perfect_store', { p_base_calcul: 'taux_vente' })
  console.log(error ? 'échec recalcul : ' + error.message : `recalculé : ${data} visite(s) en ${Math.round((Date.now() - t) / 1000)} s`)
}
