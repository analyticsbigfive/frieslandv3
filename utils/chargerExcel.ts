// ExcelJS pèse près d'1 Mo : chargé au moment d'un export ou d'une lecture de
// fichier, pas avec la page. Le module est CommonJS, d'où le repli sur
// `default` selon l'empaquetage (Vite en dev, Rollup en build, Node en test).
import type ExcelJS from 'exceljs'

export async function chargerExcelJS(): Promise<typeof ExcelJS> {
  const mod: any = await import('exceljs')
  return mod.default ?? mod
}
