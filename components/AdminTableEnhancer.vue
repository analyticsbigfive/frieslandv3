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
  originalRows: HTMLTableRowElement[]
  sortColumn: number | null
  sortDirection: SortDirection
}

const root = ref<HTMLElement | null>(null)
const states = new Map<HTMLTableElement, TableState>()
let observer: MutationObserver | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

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
  state.originalRows.forEach(row => state.table.tBodies[0].appendChild(row))
  state.sortColumn = null
  state.sortDirection = 'asc'
  state.filterRow.hidden = true
  state.toolbar.querySelector('[data-filter-toggle]')?.setAttribute('aria-expanded', 'false')
  updateSortHeaders(state)
  applyFilters(state)
}

const createButton = (label: string, icon: string) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'admin-table-tool'
  button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`
  return button
}

const enhanceTable = (table: HTMLTableElement) => {
  if (states.has(table) || table.dataset.noColumnTools !== undefined) return
  const head = table.tHead
  const headerRow = head?.rows[0]
  const body = table.tBodies[0]
  if (!head || !headerRow || !body || !headerRow.cells.length) return
  if (Array.from(headerRow.cells).some(cell => cell.colSpan > 1 || cell.rowSpan > 1)) return

  const headers = Array.from(headerRow.cells) as HTMLTableCellElement[]
  const filterRow = document.createElement('tr')
  filterRow.className = 'admin-column-filter-row'
  filterRow.hidden = true
  const filters = headers.map((header, index) => {
    header.classList.add('admin-sortable-header')
    header.tabIndex = header.tabIndex >= 0 ? header.tabIndex : 0
    header.title = `${header.textContent?.trim() || `Colonne ${index + 1}`} : trier`
    header.setAttribute('aria-sort', 'none')

    const cell = document.createElement('th')
    const input = document.createElement('input')
    input.type = 'search'
    input.className = 'admin-column-filter'
    input.placeholder = 'Filtrer…'
    input.setAttribute('aria-label', `Filtrer la colonne ${header.textContent?.trim() || index + 1}`)
    cell.appendChild(input)
    filterRow.appendChild(cell)
    return input
  })
  head.appendChild(filterRow)

  const toolbar = document.createElement('div')
  toolbar.className = 'admin-table-tools'
  const filterButton = createButton('Filtrer les colonnes', '⌕')
  filterButton.dataset.filterToggle = ''
  filterButton.setAttribute('aria-expanded', 'false')
  const resetButton = createButton('Réinitialiser', '↺')
  resetButton.dataset.resetTable = ''
  toolbar.append(filterButton, resetButton)
  table.parentElement?.insertBefore(toolbar, table)

  const state: TableState = {
    table,
    toolbar,
    filterRow,
    filters,
    originalRows: Array.from(body.rows),
    sortColumn: null,
    sortDirection: 'asc',
  }
  states.set(table, state)

  filterButton.addEventListener('click', () => {
    filterRow.hidden = !filterRow.hidden
    filterButton.setAttribute('aria-expanded', String(!filterRow.hidden))
    if (!filterRow.hidden) filters[0]?.focus()
  })
  resetButton.addEventListener('click', () => resetTable(state))
  filters.forEach(input => input.addEventListener('input', () => applyFilters(state)))

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
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (refreshTimer) clearTimeout(refreshTimer)
})
</script>

<style>
.admin-table-tools {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgb(226 232 240 / 0.8);
}

.admin-table-tool {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid rgb(203 213 225);
  border-radius: 0.6rem;
  padding: 0.4rem 0.65rem;
  background: white;
  color: rgb(51 65 85);
  font-size: 0.75rem;
  font-weight: 600;
  transition: border-color 150ms, background-color 150ms, color 150ms;
}

.admin-table-tool:hover {
  border-color: rgb(148 163 184);
  background: rgb(248 250 252);
  color: rgb(15 23 42);
}

.admin-sortable-header {
  position: relative;
  padding-right: 1.75rem !important;
  cursor: pointer;
  user-select: none;
}

.admin-sortable-header::after {
  position: absolute;
  right: 0.6rem;
  content: '↕';
  color: rgb(148 163 184);
  font-size: 0.7rem;
}

.admin-sortable-header[data-sort-direction='asc']::after {
  content: '↑';
  color: rgb(220 38 38);
}

.admin-sortable-header[data-sort-direction='desc']::after {
  content: '↓';
  color: rgb(220 38 38);
}

.admin-column-filter-row th {
  padding: 0.5rem !important;
  background: rgb(248 250 252);
}

.admin-column-filter {
  width: 100%;
  min-width: 7rem;
  border: 1px solid rgb(203 213 225);
  border-radius: 0.5rem;
  padding: 0.4rem 0.55rem;
  background: white;
  color: rgb(15 23 42);
  font-size: 0.75rem;
  font-weight: 400;
  outline: none;
}

.admin-column-filter:focus {
  border-color: rgb(220 38 38);
  box-shadow: 0 0 0 2px rgb(254 226 226);
}

.dark .admin-table-tools { border-color: rgb(51 65 85); }
.dark .admin-table-tool { border-color: rgb(71 85 105); background: rgb(30 41 59); color: rgb(203 213 225); }
.dark .admin-table-tool:hover { background: rgb(51 65 85); color: white; }
.dark .admin-column-filter-row th { background: rgb(15 23 42); }
.dark .admin-column-filter { border-color: rgb(71 85 105); background: rgb(30 41 59); color: white; }
.dark .admin-column-filter:focus { border-color: rgb(248 113 113); box-shadow: 0 0 0 2px rgb(127 29 29 / 0.45); }

@media print {
  .admin-table-tools,
  .admin-column-filter-row { display: none !important; }
}
</style>
