// composables/useCsvExport.ts
import type ExcelJS from 'exceljs'
import { chargerExcelJS } from '~/utils/chargerExcel'
import type { Visite, PDV } from '~/types'
import { parseCsvTexte } from '~/utils/routingImport'
import { catalogueProduits, getSkus, skuQuantity } from '~/utils/products'
import { aGps, lienGoogleMaps, merchandiserDe, type PdvAgence } from '~/utils/pdvAgence'

export function useCsvExport() {

  /**
   * Export visites to Excel (format compatible Google Sheets)
   */
  async function exportVisitesToExcel(visites: Visite[]) {
    const Excel = await chargerExcelJS()
    const wb = new Excel.Workbook()
    const ws = wb.addWorksheet('Visites')

    // Colonnes produits depuis le catalogue (Paramètres › Produits du
    // formulaire), produits retirés compris pour l'historique : par catégorie,
    // présence, statut et quantité de chaque SKU, prix respectés.
    const categories = catalogueProduits()
    const colonnesProduits: Partial<ExcelJS.Column>[] = categories.flatMap(cat => [
      { header: `${cat.label} Présent?`, key: `${cat.key}__present`, width: 15 },
      ...getSkus(cat.key, { inclureInactifs: true }).flatMap(sku => [
        { header: `${cat.label} : ${sku.label}`, key: `${cat.key}__${sku.key}`, width: 25 },
        { header: `${cat.label} : ${sku.label} (qté)`, key: `${cat.key}__${sku.key}__qte`, width: 14 },
      ]),
      { header: `${cat.label} : Prix respectés?`, key: `${cat.key}__prix`, width: 20 },
    ])
    function valeursProduits(d: any): Record<string, string | number> {
      const ligne: Record<string, string | number> = {}
      for (const cat of categories) {
        const bloc = d?.produits?.[cat.key]
        ligne[`${cat.key}__present`] = bloc?.present ? 'TRUE' : 'FALSE'
        for (const sku of getSkus(cat.key, { inclureInactifs: true })) {
          ligne[`${cat.key}__${sku.key}`] = bloc?.[sku.key] || ''
          const q = skuQuantity(bloc, sku.key)
          ligne[`${cat.key}__${sku.key}__qte`] = q ?? ''
        }
        ligne[`${cat.key}__prix`] = bloc?.prix_respectes ? 'TRUE' : 'FALSE'
      }
      return ligne
    }

    // Headers matching original Google Sheets format
    ws.columns = [
      { header: 'Visite ID', key: 'visite_id', width: 15 },
      { header: 'PDV', key: 'pdv_id', width: 15 },
      { header: 'Date', key: 'date_visite', width: 20 },
      { header: 'Commercial', key: 'commercial', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      ...colonnesProduits,
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
        ...valeursProduits(d),
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
    const Excel = await chargerExcelJS()
    const wb = new Excel.Workbook()
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
      { header: 'GPS', key: 'gps', width: 8 },
      { header: 'Latitude', key: 'geolocation_lat', width: 15 },
      { header: 'Longitude', key: 'geolocation_lng', width: 15 },
      { header: 'Source GPS', key: 'gps_source', width: 14 },
      { header: 'Code DMS', key: 'mdm', width: 15 },
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
      const aGps = p.geolocation_lat != null && p.geolocation_lng != null
      ws.addRow({ ...p, gps: aGps ? 'Oui' : 'Non' })
    }

    const buffer = await wb.xlsx.writeBuffer()
    downloadFile(buffer, 'pdv-export.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  /**
   * Points de vente › PDV de l'agence : la liste filtrée, avec le lien Google
   * Maps de chaque PDV géolocalisé (à compléter ou vérifier par l'agence).
   */
  async function exportPdvAgenceToExcel(lignes: PdvAgence[], nomFichier = 'pdv-agence.xlsx') {
    const Excel = await chargerExcelJS()
    const wb = new Excel.Workbook()
    const ws = wb.addWorksheet('PDV de l\'agence')
    ws.columns = [
      { header: 'ID PDV', key: 'pdv_id', width: 12 },
      { header: 'Point de vente', key: 'nom_pdv', width: 28 },
      { header: 'Type', key: 'sous_categorie_pdv', width: 16 },
      { header: 'Zone', key: 'zone', width: 18 },
      { header: 'Quartier', key: 'quartier', width: 20 },
      { header: 'Distributeur', key: 'distributor_name', width: 28 },
      { header: 'Téléphone', key: 'adressage', width: 18 },
      { header: 'GPS', key: 'gps', width: 8 },
      { header: 'Latitude', key: 'geolocation_lat', width: 12 },
      { header: 'Longitude', key: 'geolocation_lng', width: 12 },
      { header: 'Google Maps', key: 'maps', width: 40 },
      { header: 'Visites', key: 'nb_visites', width: 9 },
      { header: 'Dernière visite', key: 'derniere', width: 15 },
      { header: 'Merchandiser', key: 'merchandiser', width: 26 },
      { header: 'Recensé par', key: 'recense_par', width: 26 },
    ]
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003DA5' } }
    for (const p of lignes) {
      ws.addRow({
        ...p,
        gps: aGps(p) ? 'Oui' : 'Non',
        maps: lienGoogleMaps(p),
        derniere: p.derniere_visite ? p.derniere_visite.slice(0, 10) : 'Jamais',
        merchandiser: merchandiserDe(p) || '',
      })
    }
    ws.autoFilter = { from: 'A1', to: 'O1' }
    const buffer = await wb.xlsx.writeBuffer()
    downloadFile(buffer, nomFichier, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
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
   * Télécharge un modèle CSV pour l'import d'utilisateurs (upsert par email).
   * territoires_assignes / quartiers_assignes : valeurs séparées par |.
   * mot_de_passe : uniquement pour les créations (défaut serveur sinon).
   */
  function downloadUsersTemplate() {
    const rows = [
      { email: 'commercial1@exemple.com', nom: 'Prénom Nom', role: 'commercial', telephone: '0701020304', is_active: 'TRUE', zone_assignee: 'ABOBO 1', territoires_assignes: 'ABOBO 1|ABOBO 2', quartiers_assignes: 'ABOBOTE|SAMAKE|ANADOR', commercial: '', sous_region: 'ABIDJAN 2', mot_de_passe: 'MotDePasse8+' },
      { email: 'merch1@exemple.com', nom: 'Prénom Nom', role: 'merchandiser', telephone: '', is_active: 'TRUE', zone_assignee: 'KOUMASSI', territoires_assignes: 'KOUMASSI', quartiers_assignes: 'MARAIS|SOWETO', commercial: 'commercial1@exemple.com', sous_region: 'ABIDJAN 1', mot_de_passe: '' },
    ]
    exportToCsv(rows, 'modele-import-utilisateurs.csv')
  }

  /**
   * CSV → objets. Séparateur détecté (virgule, ou point-virgule d'un Excel
   * français), guillemets et retours à la ligne dans un champ gérés.
   */
  function parseCsv(text: string): Record<string, string>[] {
    return parseCsvTexte(text)
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
    exportPdvAgenceToExcel,
    exportToCsv,
    downloadUsersTemplate,
    parseCsv,
  }
}
