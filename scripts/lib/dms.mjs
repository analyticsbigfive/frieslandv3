/**
 * Lecture de l'export clients DMS et rapprochement client DMS ↔ PDV.
 *
 * Partagé par scripts/extraire-pdv-croisement-dms.mjs (rapport, lecture seule),
 * scripts/importer-dms-pdv.mjs (création / liaison des PDV) et
 * scripts/affecter-merch-dms.mjs (périmètres et tournées).
 *
 * Les aides sans dépendance Node vivent dans ./commun.mjs (réexporté ici) pour
 * servir aussi à l'admin ; ce module ajoute la lecture et l'écriture de fichiers.
 */
import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'
import { csvTexte, lireDmsClasseur } from './commun.mjs'

export * from './commun.mjs'

export const ecrireCsv = (chemin, entete, lignes) => writeFileSync(chemin, csvTexte(entete, lignes), 'utf8')

/** Lit l'export clients DMS depuis un fichier (voir lireDmsClasseur). */
export async function lireDms(chemin, options = {}) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(chemin)
  return lireDmsClasseur(wb, { ...options, nomFichier: chemin })
}
