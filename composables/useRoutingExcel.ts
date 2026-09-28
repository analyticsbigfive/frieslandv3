// composables/useRoutingExcel.ts
// Modèle Excel d'import des tournées, pensé pour être rempli sans connaître
// les identifiants : merchandiser, territoire, quartier et point de vente se
// choisissent dans des listes déroulantes, les actions en Oui/Non.
//
// Le modèle est généré à la demande depuis la base : les listes reflètent les
// comptes et PDV du moment. Les choix Territoire → Quartier → Point de vente
// sont en cascade (listes OFFSET/MATCH sur des feuilles cachées triées), ce
// qui garde des listes courtes alors qu'un territoire compte jusqu'à 3 000 PDV.
//
// À la lecture, seules deux colonnes identifient réellement la ligne : l'e-mail
// (en fin de libellé « NOM — e-mail ») et le code PDV (en fin de libellé
// « NOM · CODE ») — les noms de PDV ne sont pas uniques, même dans un quartier.
// Territoire et quartier ne servent qu'à filtrer les listes.
import ExcelJS from 'exceljs'
import { fetchAllRows } from '~/utils/fetchAll'

export const ROUTING_ACTIONS = [
  { key: 'releve_stock', label: 'Relevé de stock' },
  { key: 'encaissement', label: 'Encaissement' },
  { key: 'photos', label: 'Photos' },
  { key: 'merchandising', label: 'Merchandising' },
  { key: 'prospection', label: 'Prospection' },
] as const

const FEUILLE_SAISIE = 'Tournées'
const LIGNES_SAISIE = 1000
const SANS_TERRITOIRE = '(SANS TERRITOIRE)'
const SANS_QUARTIER = '(SANS QUARTIER)'
const SEP_MERCH = ' — '
const SEP_PDV = ' · '

const COLONNES = [
  { header: 'Merchandiser', width: 42 },
  { header: 'Date', width: 13 },
  { header: 'Territoire', width: 22 },
  { header: 'Quartier', width: 26 },
  { header: 'Point de vente', width: 48 },
  { header: 'Ordre', width: 8 },
  ...ROUTING_ACTIONS.map(a => ({ header: a.label, width: 16 })),
  { header: 'Notes', width: 30 },
]

// Libellés de liste : majuscules (MATCH/COUNTIF ignorent la casse, donc
// « Marcory » et « MARCORY » doivent former un seul groupe) et sans * ? ~,
// jokers pour MATCH/COUNTIF.
function libelle(v: unknown, vide: string): string {
  const s = String(v ?? '').replace(/[*?~]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
  return s || vide
}

// Sans accents, minuscules : pour reconnaître les en-têtes quelle que soit la saisie.
function cle(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const pad = (n: number) => String(n).padStart(2, '0')

// Date Excel (Date UTC minuit), « 25/06/2026 » ou « 2026-06-25 » → AAAA-MM-JJ.
function versIsoJour(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`
  }
  const s = String(v ?? '').trim()
  const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (fr) return `${fr[3]}-${pad(Number(fr[2]))}-${pad(Number(fr[1]))}`
  return s
}

// Valeur affichée d'une cellule ExcelJS (texte riche, lien, formule…).
function texteCellule(v: any): unknown {
  if (v == null) return ''
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('result' in v) return texteCellule(v.result)
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join('')
    if ('text' in v) return v.text
    return ''
  }
  return v
}

export function useRoutingExcel() {
  const supabase = useSupabaseClient()

  async function downloadRoutingExcelTemplate() {
    const [profils, pdvs] = await Promise.all([
      fetchAllRows<any>((from, to) => (supabase.from('profiles') as any)
        .select('id, nom, email, role, is_active')
        .in('role', ['merchandiser', 'commercial'])
        .order('nom').order('id')
        .range(from, to)),
      fetchAllRows<any>((from, to) => (supabase.from('pdv') as any)
        .select('pdv_id, nom_pdv, zone, quartier')
        .eq('is_active', true)
        .order('pdv_id')
        .range(from, to)),
    ])

    const merchs = profils
      .filter(p => p.is_active !== false && p.email)
      .map(p => `${String(p.nom || '').trim() || p.email}${SEP_MERCH}${String(p.email).toLowerCase()}`)
      .sort((a, b) => a.localeCompare(b, 'fr'))

    // PDV groupés par « TERRITOIRE|QUARTIER », triés : chaque groupe est un bloc
    // contigu, que la validation retrouve avec MATCH (début) + COUNTIF (taille).
    const lignesPdv = pdvs.map((p) => {
      const t = libelle(p.zone, SANS_TERRITOIRE)
      const q = libelle(p.quartier, SANS_QUARTIER)
      const nom = String(p.nom_pdv || '').replace(/\s+/g, ' ').trim() || 'SANS NOM'
      return { t, q, groupe: `${t}|${q}`, texte: `${nom}${SEP_PDV}${p.pdv_id}` }
    }).sort((a, b) => a.groupe.localeCompare(b.groupe, 'fr') || a.texte.localeCompare(b.texte, 'fr'))

    const territoires = [...new Set(lignesPdv.map(l => l.t))].sort((a, b) => a.localeCompare(b, 'fr'))
    const quartiers = [...new Set(lignesPdv.map(l => l.groupe))]
      .map(g => g.split('|') as [string, string])
      .sort((a, b) => a[0].localeCompare(b[0], 'fr') || a[1].localeCompare(b[1], 'fr'))

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Friesland Bonnet Rouge'

    // ---- Mode d'emploi (1re feuille : c'est elle qui s'ouvre) ----
    const guide = wb.addWorksheet('Mode d\'emploi', { properties: { tabColor: { argb: 'FFE30613' } } })
    guide.getColumn(1).width = 110
    const lignesGuide: [string, 'titre' | 'etape' | 'texte' | 'note'][] = [
      ['Importer des tournées — mode d\'emploi', 'titre'],
      ['Ce fichier sert à planifier les tournées de plusieurs merchandisers en une fois. Une ligne = un point de vente à visiter.', 'texte'],
      ['', 'texte'],
      ['1. Ouvrez l\'onglet « Tournées » (en bas de l\'écran).', 'etape'],
      ['2. Pour chaque visite à prévoir, remplissez une ligne, de gauche à droite :', 'etape'],
      ['     • Merchandiser : choisissez la personne dans la liste (cliquez sur la cellule, puis sur la petite flèche).', 'texte'],
      ['     • Date : le jour de la tournée, au format 25/06/2026.', 'texte'],
      ['     • Territoire, puis Quartier, puis Point de vente : choisissez-les dans cet ordre, chaque liste dépend de la précédente.', 'texte'],
      ['     • Ordre (facultatif) : 1 pour le premier point de vente de la journée, 2 pour le suivant… Laissé vide, l\'ordre des lignes est utilisé.', 'texte'],
      ['     • Relevé de stock, Encaissement, Photos, Merchandising, Prospection : Oui ou Non. Vide = Non.', 'texte'],
      ['     • Notes (facultatif) : une consigne pour la journée ; seule la première note de la journée est gardée.', 'texte'],
      ['3. Une journée de tournée = plusieurs lignes avec le même merchandiser et la même date.', 'etape'],
      ['4. Enregistrez le fichier (gardez le format Excel .xlsx).', 'etape'],
      ['5. Dans le tableau de bord : Routing → Importer → choisissez le fichier → Importer.', 'etape'],
      ['6. Lisez le compte rendu affiché : il indique les tournées créées, mises à jour, et chaque ligne refusée avec la raison.', 'etape'],
      ['', 'texte'],
      ['Bon à savoir', 'titre'],
      ['• Un point de vente doit appartenir au territoire du merchandiser choisi, sinon la ligne est refusée.', 'note'],
      ['• Réimporter une journée déjà planifiée ajoute ou met à jour ses points de vente sans supprimer les autres (sauf si vous choisissez « Remplacer » au moment de l\'import).', 'note'],
      ['• Les listes datent du téléchargement de ce fichier. Un nouveau merchandiser ou point de vente ? Retéléchargez le modèle.', 'note'],
      ['• Ne modifiez pas les en-têtes de colonnes et ne renommez pas l\'onglet « Tournées ».', 'note'],
      ['• Les listes en cascade fonctionnent dans Excel et LibreOffice, pas dans Google Sheets.', 'note'],
      ['• Le code à la fin du nom d\'un point de vente (après « · ») permet de distinguer deux boutiques qui portent le même nom : ne l\'effacez pas.', 'note'],
    ]
    for (const [texte, style] of lignesGuide) {
      const row = guide.addRow([texte])
      const cell = row.getCell(1)
      cell.alignment = { wrapText: true, vertical: 'middle' }
      if (style === 'titre') { cell.font = { bold: true, size: 16, color: { argb: 'FFE30613' } }; row.height = 28 }
      else if (style === 'etape') { cell.font = { bold: true, size: 12 }; row.height = 22 }
      else if (style === 'note') { cell.font = { size: 11, color: { argb: 'FF444444' } } }
      else { cell.font = { size: 11 } }
    }

    // ---- Saisie ----
    const ws = wb.addWorksheet(FEUILLE_SAISIE, { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = COLONNES.map(c => ({ header: c.header, width: c.width }))
    const entete = ws.getRow(1)
    entete.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    entete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003DA5' } }
    entete.alignment = { vertical: 'middle' }
    entete.height = 22
    ws.getColumn(2).numFmt = 'dd/mm/yyyy'

    // ---- Listes (cachées) ----
    const listes = wb.addWorksheet('Listes', { state: 'hidden' })
    listes.getCell('A1').value = 'Merchandisers'
    merchs.forEach((m, i) => { listes.getCell(i + 2, 1).value = m })
    listes.getCell('B1').value = 'Territoires'
    territoires.forEach((t, i) => { listes.getCell(i + 2, 2).value = t })

    const feuilleQuartiers = wb.addWorksheet('Quartiers', { state: 'hidden' })
    feuilleQuartiers.addRow(['Territoire', 'Quartier'])
    for (const [t, q] of quartiers) feuilleQuartiers.addRow([t, q])

    const feuillePdv = wb.addWorksheet('PDV', { state: 'hidden' })
    feuillePdv.addRow(['Groupe', 'Point de vente'])
    for (const l of lignesPdv) feuillePdv.addRow([l.groupe, l.texte])

    // ---- Validations (plages entières, références relatives à la ligne 2) ----
    const plage = (col: string) => `${col}2:${col}${LIGNES_SAISIE + 1}`
    const liste = (formule: string, titre: string, message: string) => ({
      type: 'list', allowBlank: true, formulae: [formule],
      showErrorMessage: true, errorStyle: 'stop', errorTitle: titre, error: message,
    })
    const dv = (ws as any).dataValidations

    dv.add(plage('A'), liste(`Listes!$A$2:$A$${merchs.length + 1}`, 'Merchandiser', 'Choisissez un merchandiser dans la liste.'))
    dv.add(plage('B'), {
      type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(Date.UTC(2024, 0, 1))],
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Date', error: 'Saisissez une date, par exemple 25/06/2026.',
    })
    dv.add(plage('C'), liste(`Listes!$B$2:$B$${territoires.length + 1}`, 'Territoire', 'Choisissez un territoire dans la liste.'))
    dv.add(plage('D'), liste(
      'OFFSET(Quartiers!$B$1,MATCH($C2,Quartiers!$A:$A,0)-1,0,COUNTIF(Quartiers!$A:$A,$C2),1)',
      'Quartier', 'Choisissez d\'abord le territoire, puis un quartier dans la liste.',
    ))
    dv.add(plage('E'), liste(
      'OFFSET(PDV!$B$1,MATCH($C2&"|"&$D2,PDV!$A:$A,0)-1,0,COUNTIF(PDV!$A:$A,$C2&"|"&$D2),1)',
      'Point de vente', 'Choisissez d\'abord le territoire et le quartier, puis un point de vente dans la liste.',
    ))
    dv.add(plage('F'), {
      type: 'whole', operator: 'between', allowBlank: true, formulae: [1, 200],
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Ordre', error: 'Un nombre entier : 1, 2, 3…',
    })
    const premiereAction = 7
    ROUTING_ACTIONS.forEach((_, i) => {
      const col = String.fromCharCode(64 + premiereAction + i)
      dv.add(plage(col), liste('"Oui,Non"', 'Action', 'Choisissez Oui ou Non.'))
    })

    wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }] as any
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `modele-tournees-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Lit un fichier de tournées (.xlsx du modèle, ou ancien .csv) et le ramène
   * au format attendu par routingStore.importRoutingsFromCSV : email, date
   * (AAAA-MM-JJ), pdv_id, ordre, actions, notes, statut. Les lignes vides sont
   * ignorées ; `__ligne` garde le numéro de ligne du fichier pour les messages.
   */
  async function readRoutingFile(file: File, parseCsv: (t: string) => Record<string, string>[]): Promise<Record<string, string>[]> {
    let brutes: { ligne: number, valeurs: Record<string, unknown> }[] = []

    if (/\.xlsx$/i.test(file.name)) {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.getWorksheet(FEUILLE_SAISIE) || wb.worksheets.find(s => s.state === 'visible' && s.name !== 'Mode d\'emploi')
      if (!ws) throw new Error('Onglet « Tournées » introuvable dans le fichier.')
      const entetes: string[] = []
      ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { entetes[col] = String(texteCellule(cell.value) || '') })
      ws.eachRow((row, n) => {
        if (n === 1) return
        const valeurs: Record<string, unknown> = {}
        entetes.forEach((h, col) => { if (h) valeurs[h] = texteCellule(row.getCell(col).value) })
        brutes.push({ ligne: n, valeurs })
      })
    }
    else {
      brutes = parseCsv(await file.text()).map((valeurs, i) => ({ ligne: i + 2, valeurs }))
    }

    // En-têtes du modèle Excel et de l'ancien CSV.
    const champ: Record<string, string> = {
      'merchandiser': 'email', 'email': 'email',
      'date': 'date',
      'point de vente': 'pdv_id', 'pdv id': 'pdv_id', 'pdv': 'pdv_id',
      'ordre': 'ordre', 'notes': 'notes', 'statut': 'statut',
      ...Object.fromEntries(ROUTING_ACTIONS.flatMap(a => [[cle(a.label), a.key], [cle(a.key), a.key]])),
    }

    return brutes.flatMap(({ ligne, valeurs }) => {
      const out: Record<string, string> = { __ligne: String(ligne) }
      for (const [h, v] of Object.entries(valeurs)) {
        const k = champ[cle(h)]
        if (!k) continue
        if (k === 'date') out.date = versIsoJour(v)
        else if (k === 'email') out.email = (String(v ?? '').match(/[^\s—<>()]+@[^\s—<>()]+/)?.[0] || String(v ?? '')).trim().toLowerCase()
        else if (k === 'pdv_id') { const s = String(v ?? '').trim(); out.pdv_id = s.includes(SEP_PDV.trim()) ? s.split(SEP_PDV.trim()).pop()!.trim() : s }
        else out[k] = String(v ?? '').trim()
      }
      // Ligne entièrement vide (fin de tableau, ligne sautée) : ignorée.
      const utile = ['email', 'date', 'pdv_id'].some(k => out[k])
      return utile ? [out] : []
    })
  }

  return { downloadRoutingExcelTemplate, readRoutingFile }
}
