#!/usr/bin/env node
/**
 * Affecte à chaque merchandiser nommé dans l'export DMS (colonne
 * « Merchandiseur ») les PDV de ses clients : périmètre remplacé et règle
 * « Portefeuille DMS — <distributeur> » (quotas pour un compte Atom ; jours
 * couverts par des règles SSF laissés à celles-ci). Logique :
 * scripts/lib/imports/merch-dms.mjs (partagée avec Admin › Imports terrain).
 *
 * Les PDV des clients sont retrouvés par `pdv.mdm` : appliquer d'abord
 * scripts/importer-dms-pdv.mjs. Pour simuler avant cet import, --simulation-dms
 * reprend le CSV de sa simulation (import-dms-pdv.csv).
 *
 * Simulation par défaut ; --apply pour écrire. Sorties dans
 * ~/Downloads/imports-terrain/merch-dms-<date-heure>/.
 *
 * Usage :
 *   node scripts/affecter-merch-dms.mjs [--dms=chemin.xlsx] [--mails=chemin.xlsx]
 *     [--debut=AAAA-MM-JJ] [--auteur=email-admin] [--pregenerer=7] [--simulation-dms=import-dms-pdv.csv] [--apply]
 *   node scripts/affecter-merch-dms.mjs --retour=…/retour.json [--apply]
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { arg, chemin, clientServiceRole, DOWNLOADS, lireClasseur, nombre, terminerImport, traiterRetour } from './lib/cli-import.mjs'
import { lireCsv } from './lib/commun.mjs'
import { chargerDonneesMerchDms, clientsAffectes, simulerMerchDms } from './lib/imports/merch-dms.mjs'

const supabase = clientServiceRole()
if (await traiterRetour(supabase, 'merch-dms')) process.exit(0)

const fichierDms = chemin(arg('dms', join(DOWNLOADS, '20260929_115747.xlsx')))
const fichierMails = chemin(arg('mails', join(DOWNLOADS, 'MAILS MERCH (1).xlsx')))
const classeurDms = await lireClasseur(fichierDms)
const classeurMails = existsSync(fichierMails) ? await lireClasseur(fichierMails) : null

let auteurId = null
const auteur = arg('auteur', '')
if (auteur) {
  const { data } = await supabase.from('profiles').select('id').ilike('email', auteur).eq('role', 'admin').maybeSingle()
  if (!data) throw new Error(`--auteur=${auteur} : aucun admin avec cet email`)
  auteurId = data.id
}

const codes = clientsAffectes(classeurDms, basename(fichierDms)).map(c => c.code)
const donnees = await chargerDonneesMerchDms(supabase, codes, { onEtape: m => console.log(`… ${m}`) })
const simulationDms = chemin(arg('simulation-dms', null))
const pdvSupplementaires = simulationDms
  ? lireCsv(readFileSync(simulationDms, 'utf8')).map(l => ({
      pdv_id: l.pdv_id, nom_pdv: l['Nom client'], zone: l.Territoire || null, quartier: l.Quartier || null,
      geolocation_lat: l.Latitude ? Number(l.Latitude) : null, geolocation_lng: l.Longitude ? Number(l.Longitude) : null,
      distributor_name: l.Distributeur, mdm: l['Code client'], is_active: true,
    }))
  : []

const res = simulerMerchDms(classeurDms, classeurMails, donnees, {
  debut: arg('debut', null),
  pregenerer: nombre('pregenerer', 0),
  auteurId,
  nomFichier: basename(fichierDms),
  pdvSupplementaires,
})
await terminerImport(supabase, 'merch-dms', res)
