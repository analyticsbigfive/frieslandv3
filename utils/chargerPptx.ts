// PptxGenJS pèse plusieurs centaines de Ko : chargé au moment de générer une
// présentation, pas avec la page (même principe que utils/chargerExcel.ts).
import type PptxGenJS from 'pptxgenjs'

export async function chargerPptxGenJS(): Promise<new () => PptxGenJS> {
  const mod: any = await import('pptxgenjs')
  return mod.default ?? mod
}
