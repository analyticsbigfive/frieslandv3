#!/usr/bin/env node
/**
 * Réponses d'Atom (Elias) du 09/10/2026 aux questions sur le routing mensuel :
 * corrections de comptes, indépendantes des migrations de la PR #14.
 *
 *   1. Gui Stéphane remplace Akedan Jean-Yves (Marcory-Treichville, Sidecom) et
 *      garde le même compte (marcorytreichone@gmail.com, déjà sur sa
 *      tablette) : nom → GUI STEPHANE, téléphone → --telephone-gui. Gui
 *      Stéphane et Guihi Bernadin (Cocody, PRODISMA) sont deux personnes
 *      différentes.
 *   2. Yopougon 1 & 2 (Zogbolou Kevin) : commercial M. Kamy (GAI KAMI), au
 *      lieu de SOUARE IBRAHIMA. Yopougon 3 & 4 (Deheo) reste chez M. Souaré,
 *      Cocody 2 Plateaux-Riviera (Guihi) chez Mme Tea Anne-Marie.
 *   3. Moustapha N'Diaye (Port-Bouët) ne fait plus partie de l'effectif, la
 *      zone est vacante : compte désactivé (comme « Désactiver » dans
 *      Admin › Utilisateurs), règles désactivées, tournées à venir non
 *      commencées supprimées. Celle du jour, les visites et l'historique
 *      restent.
 *
 * Tout est lu et affiché avant la première écriture. Simulation par défaut ;
 * avec --apply, le retour arrière est écrit dans ~/Downloads.
 *
 * Usage :
 *   node scripts/reponses-client-2026-10-09.mjs --telephone-gui=+225XXXXXXXXXX
 *   node scripts/reponses-client-2026-10-09.mjs --telephone-gui=+225XXXXXXXXXX --apply
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
const arg = nom => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=')

const COMPTE_GUI = 'marcorytreichone@gmail.com'
const NOM_GUI = 'GUI STEPHANE'
const COMPTE_ZOGBOLOU = 'yopougonone@gmail.com'
const NOM_KAMY = 'GAI KAMI'
const COMPTE_MOUSTAPHA = 'portbouetone@gmail.com'

const telephoneGui = arg('telephone-gui')
if (!telephoneGui || !/^\+225\d{10}$/.test(telephoneGui)) {
  console.error('--telephone-gui=+225XXXXXXXXXX requis (format des autres fiches).')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const must = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }
const unSeul = (lignes, quoi) => { if (lignes?.length !== 1) throw new Error(`${quoi} : ${lignes?.length || 0} résultat(s), un seul attendu`); return lignes[0] }
const aujourdhui = new Date().toISOString().slice(0, 10)

// ---- Lecture -----------------------------------------------------------------
const gui = unSeul(must(await supabase.from('profiles').select('id,nom,telephone,is_active').eq('email', COMPTE_GUI), 'compte de Gui Stéphane'), COMPTE_GUI)
const zogbolou = unSeul(must(await supabase.from('profiles').select('id,nom,commercial_id').eq('email', COMPTE_ZOGBOLOU), 'compte de Zogbolou'), COMPTE_ZOGBOLOU)
const kamy = unSeul(must(await supabase.from('profiles').select('id,nom,email').eq('role', 'commercial').eq('is_active', true).ilike('nom', NOM_KAMY), 'commercial M. Kamy'), NOM_KAMY)
const actuelZ = zogbolou.commercial_id
  ? must(await supabase.from('profiles').select('nom').eq('id', zogbolou.commercial_id).maybeSingle(), 'commercial actuel')
  : null
const moustapha = unSeul(must(await supabase.from('profiles').select('id,nom,is_active').eq('email', COMPTE_MOUSTAPHA), 'compte de Moustapha'), COMPTE_MOUSTAPHA)
const reglesM = must(await supabase.from('routing_templates').select('id,label,is_active').eq('user_id', moustapha.id), 'règles de Moustapha')
const tourneesM = must(await supabase.from('routings').select('id,date_routing,status,routing_pdv(status)').eq('user_id', moustapha.id).gt('date_routing', aujourdhui), 'tournées de Moustapha')
const intactes = tourneesM.filter(t => t.status === 'pending' && (t.routing_pdv || []).every(e => e.status === 'pending'))
const homonymes = must(await supabase.from('profiles').select('email,is_active').ilike('nom', "%MOUSTAPHA%N%DIAYE%").neq('email', COMPTE_MOUSTAPHA), 'homonymes')

console.log(`\n1. ${COMPTE_GUI} : « ${gui.nom} » → « ${NOM_GUI} », téléphone ${gui.telephone ? 'remplacé' : 'ajouté'}.`)
console.log(`2. ${zogbolou.nom} : commercial ${actuelZ?.nom || '—'} → ${kamy.nom} (${kamy.email}).`)
console.log(`3. ${moustapha.nom} (${COMPTE_MOUSTAPHA}) : compte ${moustapha.is_active ? 'actif → désactivé' : 'déjà désactivé'} ; ${reglesM.filter(r => r.is_active !== false).length} règle(s) active(s) → désactivées ; ${intactes.length} tournée(s) à venir non commencées → supprimées (${tourneesM.length - intactes.length} commencée(s) gardée(s)).`)
for (const h of homonymes) console.log(`   Signalé, non modifié : homonyme ${h.email} (${h.is_active ? 'actif' : 'inactif'}).`)

if (!APPLY) {
  console.log('\nSimulation : rien n’a été écrit. Relancer avec --apply.')
  process.exit(0)
}

// ---- Écriture ------------------------------------------------------------------
const retour = {
  date: new Date().toISOString(),
  profils: [
    { email: COMPTE_GUI, nom: gui.nom, telephone: gui.telephone },
    { email: COMPTE_ZOGBOLOU, commercial_id: zogbolou.commercial_id },
    { email: COMPTE_MOUSTAPHA, is_active: moustapha.is_active },
  ],
  regles_reactiver: reglesM.filter(r => r.is_active !== false).map(r => r.id),
  tournees_supprimees: intactes.map(t => t.date_routing),
}
const fichierRetour = join(homedir(), 'Downloads', `retour-reponses-client-2026-10-09-${Date.now()}.json`)
writeFileSync(fichierRetour, JSON.stringify(retour, null, 2))

must(await supabase.from('profiles').update({ nom: NOM_GUI, telephone: telephoneGui }).eq('id', gui.id).select('id'), 'renommage de Gui Stéphane')
must(await supabase.from('profiles').update({ commercial_id: kamy.id }).eq('id', zogbolou.id).select('id'), 'commercial de Zogbolou')
must(await supabase.from('profiles').update({ is_active: false }).eq('id', moustapha.id).select('id'), 'désactivation de Moustapha')
if (retour.regles_reactiver.length) {
  must(await supabase.from('routing_templates').update({ is_active: false }).in('id', retour.regles_reactiver).select('id'), 'règles de Moustapha')
}
if (intactes.length) {
  must(await supabase.from('routings').delete().in('id', intactes.map(t => t.id)).select('id'), 'tournées à venir de Moustapha')
}
console.log(`\nÉcrit. Retour arrière : ${fichierRetour} (les tournées supprimées se régénèrent si le compte et ses règles sont réactivés).`)
