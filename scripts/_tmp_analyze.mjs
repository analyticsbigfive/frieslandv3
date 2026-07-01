import { readFileSync } from 'fs'
const rows = JSON.parse(readFileSync('./territory_areas (1).json','utf8'))
console.log('TOTAL rows:', rows.length)
console.log('keys:', Object.keys(rows[0]).join(', '))

const uniq = (arr) => [...new Set(arr)]
console.log('\ncountries:', uniq(rows.map(r=>r.country_name)))
console.log('regions:', uniq(rows.map(r=>`${r.region_code}|${r.region_name}|${r.region_label}`)))
console.log('sub_regions:', uniq(rows.map(r=>`${r.sub_region_code}|${r.sub_region_name}|${r.sub_region_label}`)).length, uniq(rows.map(r=>`${r.sub_region_code}|${r.sub_region_label}`)))
console.log('territories:', uniq(rows.map(r=>r.territory_code)).length)
console.log('areas (by code):', uniq(rows.map(r=>r.area_code)).length)
console.log('areas (by code+name):', uniq(rows.map(r=>`${r.area_code}|${r.area_name}`)).length)
console.log('distributors:', uniq(rows.map(r=>r.distributor)).length)
console.log('distributor list:', uniq(rows.map(r=>r.distributor)).sort())

// national heuristic: distributor present across how many territories
const distTerr = {}
for (const r of rows){ (distTerr[r.distributor] ||= new Set()).add(r.territory_code) }
console.log('\ndistributor -> #territories couverts:')
Object.entries(distTerr).sort((a,b)=>b[1].size-a[1].size).forEach(([d,s])=>console.log(`  ${String(s.size).padStart(3)}  ${d}`))

// area -> distributors (multi?)
const areaDist = {}
for (const r of rows){ (areaDist[r.area_code] ||= new Set()).add(r.distributor) }
const multi = Object.entries(areaDist).filter(([,s])=>s.size>1)
console.log('\nareas avec >1 distributeur:', multi.length, '/', Object.keys(areaDist).length)
console.log('sample multi:', multi.slice(0,5).map(([a,s])=>`${a}:[${[...s].join(',')}]`))

// area_code -> multiple names?
const areaNames = {}
for (const r of rows){ (areaNames[r.area_code] ||= new Set()).add(r.area_name) }
const dupName = Object.entries(areaNames).filter(([,s])=>s.size>1)
console.log('\narea_code avec >1 area_name (attention unicité):', dupName.length)
console.log('sample:', dupName.slice(0,3).map(([a,s])=>`${a}:[${[...s].join(' | ')}]`))
