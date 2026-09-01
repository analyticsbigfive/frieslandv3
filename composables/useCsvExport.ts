// composables/useCsvExport.ts
import ExcelJS from 'exceljs'
import type { Visite, PDV } from '~/types'

export function useCsvExport() {

  /**
   * Export visites to Excel (format compatible Google Sheets)
   */
  async function exportVisitesToExcel(visites: Visite[]) {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Visites')

    // Headers matching original Google Sheets format
    ws.columns = [
      { header: 'Visite ID', key: 'visite_id', width: 15 },
      { header: 'PDV', key: 'pdv_id', width: 15 },
      { header: 'Date', key: 'date_visite', width: 20 },
      { header: 'Commercial', key: 'commercial', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'EVAP Présent?', key: 'evap_present', width: 15 },
      { header: 'EVAP : BR Gold', key: 'evap_br_gold', width: 25 },
      { header: 'EVAP : BR 160g', key: 'evap_br_160g', width: 25 },
      { header: 'EVAP : BRB 160g', key: 'evap_brb_160g', width: 25 },
      { header: 'EVAP : BR 400g', key: 'evap_br_400g', width: 25 },
      { header: 'EVAP : BRB 400g', key: 'evap_brb_400g', width: 25 },
      { header: 'EVAP : Pearl 400g', key: 'evap_pearl_400g', width: 25 },
      { header: 'EVAP : Prix respectés?', key: 'evap_prix', width: 20 },
      { header: 'IMP Présent?', key: 'imp_present', width: 15 },
      { header: 'IMP : Prix respectés?', key: 'imp_prix', width: 20 },
      { header: 'SCM Présent?', key: 'scm_present', width: 15 },
      { header: 'SCM : Prix respectés?', key: 'scm_prix', width: 20 },
      { header: 'UHT Présent?', key: 'uht_present', width: 15 },
      { header: 'UHT prix respectés?', key: 'uht_prix', width: 20 },
      { header: 'YAOURT Présent?', key: 'yaourt_present', width: 15 },
      { header: 'Présence de concurrents', key: 'concurrence', width: 22 },
      { header: 'Présence de visibilité extérieure', key: 'visib_ext', width: 30 },
      { header: 'Présence de visibilité intérieure', key: 'visib_int', width: 30 },
      { header: 'Promotion applicable', key: 'promo_applicable', width: 22 },
      { header: 'Éléments visibilité / promotion observés', key: 'visib_standards', width: 55 },
      { header: 'Référencement produits', key: 'act_ref', width: 22 },
      { header: 'Exécution promotions', key: 'act_promo', width: 22 },
      { header: 'Prospection PDV', key: 'act_prosp', width: 20 },
      { header: 'Vérification FIFO', key: 'act_fifo', width: 20 },
      { header: 'Rangement produits', key: 'act_rang', width: 20 },
      { header: 'Pose affiches', key: 'act_aff', width: 18 },
      { header: 'Pose matériel visibilité', key: 'act_mat', width: 25 },
    ]

    // Style header row
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003DA5' } }

    // Add data rows
    for (const v of visites) {
      const d = v.data
      ws.addRow({
        visite_id: v.visite_id,
        pdv_id: v.pdv_id,
        date_visite: v.date_visite,
        commercial: v.commercial,
        email: v.email,
        evap_present: d?.produits?.evap?.present ? 'TRUE' : 'FALSE',
        evap_br_gold: d?.produits?.evap?.br_gold || '',
        evap_br_160g: d?.produits?.evap?.br_160g || '',
        evap_brb_160g: d?.produits?.evap?.brb_160g || '',
        evap_br_400g: d?.produits?.evap?.br_400g || '',
        evap_brb_400g: d?.produits?.evap?.brb_400g || '',
        evap_pearl_400g: d?.produits?.evap?.pearl_400g || '',
        evap_prix: d?.produits?.evap?.prix_respectes ? 'TRUE' : 'FALSE',
        imp_present: d?.produits?.imp?.present ? 'TRUE' : 'FALSE',
        imp_prix: d?.produits?.imp?.prix_respectes ? 'TRUE' : 'FALSE',
        scm_present: d?.produits?.scm?.present ? 'TRUE' : 'FALSE',
        scm_prix: d?.produits?.scm?.prix_respectes ? 'TRUE' : 'FALSE',
        uht_present: d?.produits?.uht?.present ? 'TRUE' : 'FALSE',
        uht_prix: d?.produits?.uht?.prix_respectes ? 'TRUE' : 'FALSE',
        yaourt_present: d?.produits?.yaourt?.present ? 'TRUE' : 'FALSE',
        concurrence: d?.concurrence?.presence_concurrents ? 'TRUE' : 'FALSE',
        visib_ext: d?.visibilite?.exterieure?.presence_visibilite ? 'TRUE' : 'FALSE',
        visib_int: d?.visibilite?.interieure?.presence_visibilite ? 'TRUE' : 'FALSE',
        promo_applicable: d?.visibilite?.promotion_applicable ? 'TRUE' : 'FALSE',
        visib_standards: Object.entries(d?.visibilite?.standards || {})
          .filter(([, observed]) => observed)
          .map(([code]) => code)
          .join(', '),
        act_ref: d?.actions?.referencement_produits ? 'TRUE' : 'FALSE',
        act_promo: d?.actions?.execution_activites_promotionnelles ? 'TRUE' : 'FALSE',
        act_prosp: d?.actions?.prospection_pdv ? 'TRUE' : 'FALSE',
        act_fifo: d?.actions?.verification_fifo ? 'TRUE' : 'FALSE',
        act_rang: d?.actions?.rangement_produits ? 'TRUE' : 'FALSE',
        act_aff: d?.actions?.pose_affiches ? 'TRUE' : 'FALSE',
        act_mat: d?.actions?.pose_materiel_visibilite ? 'TRUE' : 'FALSE',
      })
    }

    // Generate and download
    const buffer = await wb.xlsx.writeBuffer()
    downloadFile(buffer, 'visites-export.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  /**
   * Export PDV to Excel
   */
  async function exportPDVToExcel(pdvList: PDV[]) {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('PDV')

    ws.columns = [
      { header: 'PDV ID', key: 'pdv_id', width: 15 },
      { header: 'Nom du PDV', key: 'nom_pdv', width: 25 },
      { header: 'Canal', key: 'canal', width: 15 },
      { header: 'Catégorie', key: 'categorie_pdv', width: 25 },
      { header: 'Sous-catégorie', key: 'sous_categorie_pdv', width: 20 },
      { header: 'Région', key: 'region', width: 15 },
      { header: 'Zone', key: 'zone', width: 15 },
      { header: 'Quartier', key: 'quartier', width: 20 },
      { header: 'Latitude', key: 'geolocation_lat', width: 15 },
      { header: 'Longitude', key: 'geolocation_lng', width: 15 },
      { header: 'Adressage', key: 'adressage', width: 30 },
      { header: 'Territoire', key: 'territory_code', width: 15 },
      { header: 'Area', key: 'area_code', width: 15 },
      { header: 'Distributeur', key: 'distributor_name', width: 25 },
      { header: 'Objectif Perfect Store', key: 'objectif_perfect_store', width: 20 },
      { header: 'Date', key: 'date_creation', width: 15 },
      { header: 'Ajouté par', key: 'ajoute_par', width: 30 },
    ]

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003DA5' } }

    for (const p of pdvList) {
      ws.addRow(p)
    }

    const buffer = await wb.xlsx.writeBuffer()
    downloadFile(buffer, 'pdv-export.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  /**
   * Export to CSV
   */
  function exportToCsv(data: any[], filename: string) {
    if (!data.length) return

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h]
          if (val === null || val === undefined) return ''
          const str = String(val)
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        }).join(',')
      ),
    ].join('\n')

    downloadFile(
      new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }),
      filename,
      'text/csv'
    )
  }

  /**
   * Télécharge un modèle CSV pour l'import de routings (1 ligne = 1 PDV).
   * Plusieurs lignes même email+date = un routing ordonné.
   */
  function downloadRoutingTemplate() {
    const rows = [
      { email: 'merch1@exemple.com', date: '2026-06-25', pdv_id: 'PDV001', ordre: 1, releve_stock: 'TRUE', encaissement: 'FALSE', photos: 'TRUE', merchandising: 'FALSE', prospection: 'FALSE', notes: 'Tournée matin', statut: 'pending' },
      { email: 'merch1@exemple.com', date: '2026-06-25', pdv_id: 'PDV002', ordre: 2, releve_stock: 'TRUE', encaissement: 'FALSE', photos: 'TRUE', merchandising: 'TRUE', prospection: 'FALSE', notes: '', statut: 'pending' },
      { email: 'merch2@exemple.com', date: '2026-06-25', pdv_id: 'PDV010', ordre: 1, releve_stock: 'TRUE', encaissement: 'TRUE', photos: 'TRUE', merchandising: 'FALSE', prospection: 'FALSE', notes: '', statut: 'pending' },
    ]
    exportToCsv(rows, 'modele-import-routings.csv')
  }

  /**
   * Télécharge un modèle CSV pour l'import d'utilisateurs (upsert par email).
   * territoires_assignes / quartiers_assignes : valeurs séparées par |.
   * mot_de_passe : uniquement pour les créations (défaut serveur sinon).
   */
  function downloadUsersTemplate() {
    const rows = [
      { email: 'commercial1@exemple.com', nom: 'Prénom Nom', role: 'commercial', telephone: '0701020304', is_active: 'TRUE', zone_assignee: 'ABOBO 1', territoires_assignes: 'ABOBO 1|ABOBO 2', quartiers_assignes: 'ABOBOTE|SAMAKE|ANADOR', region: 'ABIDJAN 2', mot_de_passe: 'MotDePasse8+' },
      { email: 'merch1@exemple.com', nom: 'Prénom Nom', role: 'merchandiser', telephone: '', is_active: 'TRUE', zone_assignee: 'KOUMASSI', territoires_assignes: 'KOUMASSI', quartiers_assignes: 'MARAIS|SOWETO', region: 'ABIDJAN 1', mot_de_passe: '' },
    ]
    exportToCsv(rows, 'modele-import-utilisateurs.csv')
  }

  /**
   * Parse CSV file to array of objects
   */
  function parseCsv(text: string): Record<string, string>[] {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return []

    const headers = parseCsvLine(lines[0])
    return lines.slice(1).map(line => {
      const values = parseCsvLine(line)
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h.trim()] = (values[i] || '').trim()
      })
      return obj
    })
  }

  function parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        }
        else {
          inQuotes = !inQuotes
        }
      }
      else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      }
      else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  function downloadFile(data: any, filename: string, type: string) {
    const blob = data instanceof Blob ? data : new Blob([data], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    exportVisitesToExcel,
    exportPDVToExcel,
    exportToCsv,
    downloadRoutingTemplate,
    downloadUsersTemplate,
    parseCsv,
  }
}
