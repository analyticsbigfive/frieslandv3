<template>
  <div ref="root" class="contents">
    <slot />
  </div>
</template>

<script setup lang="ts">
type SortDirection = 'asc' | 'desc'

interface TableState {
  table: HTMLTableElement
  toolbar: HTMLDivElement
  filterRow: HTMLTableRowElement
  filters: HTMLInputElement[]
  panels: HTMLUListElement[]
  originalRows: HTMLTableRowElement[]
  sortColumn: number | null
  sortDirection: SortDirection
}

const root = ref<HTMLElement | null>(null)
const states = new Map<HTMLTableElement, TableState>()
let observer: MutationObserver | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let onDocPointerDown: ((event: Event) => void) | null = null

const normalize = (value: string) => value.trim().toLocaleLowerCase('fr-FR')

const sortableValue = (value: string): string | number => {
  const text = normalize(value)
  const compact = text.replace(/\s/g, '').replace(',', '.').replace(/[%€$]/g, '')
  if (/^-?\d+(\.\d+)?$/.test(compact)) return Number(compact)

  const frenchDate = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/)
  if (frenchDate) {
    const [, day, month, rawYear] = frenchDate
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return Number(`${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`)
  }

  return text
}

const cellText = (row: HTMLTableRowElement, column: number) =>
  row.cells[column]?.textContent || ''

// Combobox par colonne : le champ filtre les lignes (« contient »), et le
// bouton ▾ ouvre un panneau des valeurs distinctes de la colonne, filtré par
// la saisie et cliquable. Reconstruit à l'ouverture (lignes en mémoire).
const columnValues = (state: TableState, column: number, query: string) => {
  const q = normalize(query)
  return [...new Set(state.originalRows
    .map(row => cellText(row, column).trim().replace(/\s+/g, ' '))
    .filter(Boolean))]
    .filter(value => !q || normalize(value).includes(q))
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' }))
    .slice(0, 50)
}

const closeAllPanels = (except?: HTMLUListElement) => {
  states.forEach(state => state.panels.forEach((panel) => {
    if (panel !== except) panel.hidden = true
  }))
}

const openPanel = (state: TableState, column: number) => {
  const input = state.filters[column]
  const panel = state.panels[column]
  const values = columnValues(state, column, input.value)
  panel.replaceChildren(...values.map((value) => {
    const item = document.createElement('li')
    const option = document.createElement('button')
    option.type = 'button'
    option.className = 'admin-column-combo__option'
    option.textContent = value
    option.addEventListener('mousedown', (event) => {
      event.preventDefault()
      input.value = value
      applyFilters(state)
      panel.hidden = true
    })
    item.appendChild(option)
    return item
  }))
  panel.hidden = values.length === 0
  closeAllPanels(panel)
}

const applyFilters = (state: TableState) => {
  const activeFilters = state.filters.map(input => normalize(input.value))
  state.originalRows.forEach((row) => {
    row.hidden = activeFilters.some((filter, column) =>
      filter !== '' && !normalize(cellText(row, column)).includes(filter),
    )
  })
}

const updateSortHeaders = (state: TableState) => {
  const headers = Array.from(state.table.tHead?.rows[0]?.cells || []) as HTMLTableCellElement[]
  headers.forEach((header, index) => {
    const active = state.sortColumn === index
    header.setAttribute('aria-sort', active ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none')
    header.dataset.sortDirection = active ? state.sortDirection : ''
  })
}

const sortTable = (state: TableState, column: number, toggleDirection = true) => {
  if (toggleDirection) {
    state.sortDirection = state.sortColumn === column && state.sortDirection === 'asc' ? 'desc' : 'asc'
  }
  state.sortColumn = column

  const originalIndex = new Map(state.originalRows.map((row, index) => [row, index]))
  const direction = state.sortDirection === 'asc' ? 1 : -1
  const rows = [...state.originalRows].sort((left, right) => {
    const a = sortableValue(cellText(left, column))
    const b = sortableValue(cellText(right, column))
    let comparison = 0
    if (typeof a === 'number' && typeof b === 'number') comparison = a - b
    else comparison = String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' })
    return comparison === 0
      ? (originalIndex.get(left)! - originalIndex.get(right)!)
      : comparison * direction
  })

  const body = state.table.tBodies[0]
  rows.forEach(row => body.appendChild(row))
  updateSortHeaders(state)
  applyFilters(state)
}

const resetTable = (state: TableState) => {
  state.filters.forEach(input => { input.value = '' })
  state.panels.forEach(panel => { panel.hidden = true })
  state.originalRows.forEach(row => state.table.tBodies[0].appendChild(row))
  state.sortColumn = null
  state.sortDirection = 'asc'
  state.filterRow.hidden = true
  state.toolbar.querySelector('[data-filter-toggle]')?.setAttribute('aria-expanded', 'false')
  updateSortHeaders(state)
  applyFilters(state)
}

// Icônes Heroicons (20 solid), dessinées en SVG : pas de caractères Unicode.
const ICONES = {
  filtre: '<path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clip-rule="evenodd" />',
  reinitialiser: '<path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd" />',
  deplier: '<path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />',
}
const svg = (chemin: string) => `<svg class="admin-table-tool__icone" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">${chemin}</svg>`

const createButton = (label: string, icone: keyof typeof ICONES) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'admin-table-tool'
  button.innerHTML = `${svg(ICONES[icone])}<span>${label}</span>`
  return button
}

// Barre « Trier et filtrer » seulement pour les tableaux assez longs pour en
// avoir besoin ; le tri par en-tête reste disponible partout.
const MIN_LIGNES_OUTILS = 12
const majVisibiliteOutils = (state: TableState) => {
  state.toolbar.hidden = state.originalRows.length < MIN_LIGNES_OUTILS
}

const enhanceTable = (table: HTMLTableElement) => {
  if (states.has(table) || table.dataset.noColumnTools !== undefined) return
  // Tableau de saisie (champs dans les lignes) : on ne réordonne pas des
  // lignes que Vue gère et que l'utilisateur est en train de remplir.
  if (table.tBodies[0]?.querySelector('input, select, textarea')) return
  const head = table.tHead
  const headerRow = head?.rows[0]
  const body = table.tBodies[0]
  if (!head || !headerRow || !body || !headerRow.cells.length) return
  if (Array.from(headerRow.cells).some(cell => cell.colSpan > 1 || cell.rowSpan > 1)) return

  const headers = Array.from(headerRow.cells) as HTMLTableCellElement[]
  const filterRow = document.createElement('tr')
  filterRow.className = 'admin-column-filter-row'
  filterRow.hidden = true
  const panels: HTMLUListElement[] = []
  const filters = headers.map((header, index) => {
    header.classList.add('admin-sortable-header')
    header.tabIndex = header.tabIndex >= 0 ? header.tabIndex : 0
    header.title = `${header.textContent?.trim() || `Colonne ${index + 1}`} : trier`
    header.setAttribute('aria-sort', 'none')

    const cell = document.createElement('th')
    const combo = document.createElement('div')
    combo.className = 'admin-column-combo'
    const input = document.createElement('input')
    input.type = 'search'
    input.className = 'admin-column-filter'
    input.placeholder = 'Filtrer…'
    input.autocomplete = 'off'
    input.setAttribute('aria-label', `Filtrer la colonne ${header.textContent?.trim() || index + 1}`)
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.tabIndex = -1
    toggle.className = 'admin-column-combo__toggle'
    toggle.setAttribute('aria-label', 'Voir les valeurs')
    toggle.innerHTML = svg(ICONES.deplier)
    const panel = document.createElement('ul')
    panel.className = 'admin-column-combo__panel'
    panel.hidden = true
    panels.push(panel)
    combo.append(input, toggle, panel)
    cell.appendChild(combo)
    filterRow.appendChild(cell)

    toggle.addEventListener('click', () => {
      if (panel.hidden) { openPanel(state, index); input.focus() }
      else panel.hidden = true
    })
    input.addEventListener('focus', () => openPanel(state, index))
    return input
  })
  head.appendChild(filterRow)

  const toolbar = document.createElement('div')
  toolbar.className = 'admin-table-tools'
  const toolbarLabel = document.createElement('span')
  toolbarLabel.className = 'admin-table-tools__label'
  toolbarLabel.textContent = 'Cliquez sur un en-tête pour trier'
  const filterButton = createButton('Filtrer par colonne', 'filtre')
  filterButton.dataset.filterToggle = ''
  filterButton.setAttribute('aria-expanded', 'false')
  const resetButton = createButton('Réinitialiser', 'reinitialiser')
  resetButton.dataset.resetTable = ''
  toolbar.append(toolbarLabel, filterButton, resetButton)
  table.parentElement?.insertBefore(toolbar, table)

  const state: TableState = {
    table,
    toolbar,
    filterRow,
    filters,
    panels,
    originalRows: Array.from(body.rows),
    sortColumn: null,
    sortDirection: 'asc',
  }
  states.set(table, state)
  majVisibiliteOutils(state)

  filterButton.addEventListener('click', () => {
    filterRow.hidden = !filterRow.hidden
    filterButton.setAttribute('aria-expanded', String(!filterRow.hidden))
    if (filterRow.hidden) closeAllPanels()
    else filters[0]?.focus()
  })
  resetButton.addEventListener('click', () => resetTable(state))
  filters.forEach((input, column) => input.addEventListener('input', () => {
    applyFilters(state)
    if (!state.panels[column].hidden) openPanel(state, column)
  }))

  const activateHeader = (event: Event) => {
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, select, textarea')) return
    const header = target.closest('th') as HTMLTableCellElement | null
    if (!header || header.parentElement !== headerRow) return
    sortTable(state, header.cellIndex)
  }
  headerRow.addEventListener('click', activateHeader)
  headerRow.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    activateHeader(event)
  })
}

const refreshTables = () => {
  if (!root.value) return
  root.value.querySelectorAll('table').forEach(table => enhanceTable(table as HTMLTableElement))

  states.forEach((state, table) => {
    if (!table.isConnected) {
      states.delete(table)
      return
    }
    const currentRows = Array.from(table.tBodies[0]?.rows || [])
    const hasChanged = currentRows.length !== state.originalRows.length
      || currentRows.some(row => !state.originalRows.includes(row))
    if (hasChanged) {
      state.originalRows = currentRows
      majVisibiliteOutils(state)
      if (state.sortColumn !== null) sortTable(state, state.sortColumn, false)
      else applyFilters(state)
    }
  })
}

onMounted(() => {
  nextTick(refreshTables)
  observer = new MutationObserver(() => {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refreshTables, 80)
  })
  if (root.value) observer.observe(root.value, { childList: true, subtree: true })

  // Fermer les panneaux combobox au clic en dehors / Échap.
  onDocPointerDown = (event: Event) => {
    if (!(event.target as HTMLElement)?.closest('.admin-column-combo')) closeAllPanels()
  }
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
})

function onDocKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeAllPanels()
}

onBeforeUnmount(() => {
  observer?.disconnect()
  if (refreshTimer) clearTimeout(refreshTimer)
  if (onDocPointerDown) document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<style>
.admin-table-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #E2E8F0;
}

.admin-table-tools[hidden] { display: none; }

.admin-table-tools__label {
  margin-right: auto;
  color: #64748B;
  font-size: 0.75rem;
  font-weight: 500;
}

.admin-table-tool {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  background: white;
  color: #334155;
  font-size: 0.75rem;
  font-weight: 600;
  transition: background-color 150ms, color 150ms;
}

.admin-table-tool:hover {
  background: #F8FAFC;
  color: #0F172A;
}

.admin-table-tool:focus-visible,
.admin-sortable-header:focus-visible,
.admin-column-combo__toggle:focus-visible,
.admin-column-combo__option:focus-visible {
  outline: 2px solid #C8102E;
  outline-offset: 2px;
}

.admin-table-tool__icone {
  width: 0.9rem;
  height: 0.9rem;
}

.admin-sortable-header {
  position: relative;
  padding-right: 1.75rem !important;
  cursor: pointer;
  user-select: none;
}

/* Indicateur de tri dessiné (chevrons Heroicons en masque), pas de glyphe. */
.admin-sortable-header::after {
  position: absolute;
  top: 50%;
  right: 0.55rem;
  width: 0.85rem;
  height: 0.85rem;
  margin-top: -0.425rem;
  content: '';
  background-color: #94A3B8;
  -webkit-mask: var(--admin-tri-icone) center / contain no-repeat;
  mask: var(--admin-tri-icone) center / contain no-repeat;
  --admin-tri-icone: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill-rule='evenodd' d='M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06l-3.25-3.25Zm-4.31 9.81 3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06Z' clip-rule='evenodd'/%3E%3C/svg%3E");
}

.admin-sortable-header[data-sort-direction='asc']::after {
  background-color: #C8102E;
  --admin-tri-icone: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill-rule='evenodd' d='M14.78 11.78a.75.75 0 0 1-1.06 0L10 8.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06Z' clip-rule='evenodd'/%3E%3C/svg%3E");
}

.admin-sortable-header[data-sort-direction='desc']::after {
  background-color: #C8102E;
  --admin-tri-icone: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill-rule='evenodd' d='M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z' clip-rule='evenodd'/%3E%3C/svg%3E");
}

.admin-column-filter-row th {
  padding: 0.5rem !important;
  background: #F8FAFC;
}

.admin-column-combo {
  position: relative;
  display: flex;
  align-items: center;
}

.admin-column-filter {
  width: 100%;
  min-width: 7rem;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  padding: 0.4rem 1.6rem 0.4rem 0.55rem;
  background: white;
  color: #0F172A;
  font-size: 0.75rem;
  font-weight: 400;
  outline: none;
}

.admin-column-filter:focus {
  border-color: #C8102E;
  box-shadow: 0 0 0 2px rgb(200 16 46 / 0.25);
}

.admin-column-combo__toggle {
  position: absolute;
  right: 0.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  color: #64748B;
}

.admin-column-combo__toggle .admin-table-tool__icone { width: 1rem; height: 1rem; }

.admin-column-combo__toggle:hover { color: #C8102E; }

.admin-column-combo__panel {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  z-index: 30;
  max-height: 14rem;
  min-width: 100%;
  overflow-y: auto;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  background: white;
  box-shadow: 0 10px 30px -12px rgb(15 23 42 / 0.25);
}

.admin-column-combo__option {
  display: block;
  width: 100%;
  border-radius: 0.35rem;
  padding: 0.3rem 0.5rem;
  text-align: left;
  white-space: nowrap;
  color: rgb(51 65 85);
  font-size: 0.75rem;
  font-weight: 400;
}

.admin-column-combo__option:hover {
  background: rgb(248 250 252);
  color: rgb(15 23 42);
}

.dark .admin-table-tools { border-color: rgb(51 65 85); }
.dark .admin-table-tools__label { color: rgb(148 163 184); }
.dark .admin-table-tool { border-color: rgb(71 85 105); background: rgb(30 41 59); color: rgb(203 213 225); }
.dark .admin-table-tool:hover { background: rgb(51 65 85); color: white; }
.dark .admin-column-filter-row th { background: rgb(15 23 42); }
.dark .admin-column-filter { border-color: rgb(71 85 105); background: rgb(30 41 59); color: white; }
.dark .admin-column-filter:focus { border-color: #D92040; box-shadow: 0 0 0 2px rgb(200 16 46 / 0.35); }
.dark .admin-column-combo__toggle { color: rgb(148 163 184); }
.dark .admin-column-combo__panel { border-color: rgb(71 85 105); background: rgb(30 41 59); box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.5); }
.dark .admin-column-combo__option { color: rgb(203 213 225); }
.dark .admin-column-combo__option:hover { background: rgb(51 65 85); color: white; }

@media print {
  .admin-table-tools,
  .admin-column-filter-row { display: none !important; }
}
</style>
