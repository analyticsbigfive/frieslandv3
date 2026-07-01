import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'; import { readFileSync } from 'fs'
config()
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY, { auth:{persistSession:false,autoRefreshToken:false} })
const J = JSON.parse(readFileSync('./territory_areas (1).json','utf8'))
const uniqBy = (arr,key)=>{const m=new Map();for(const x of arr){const k=key(x);if(!m.has(k))m.set(k,x)}return [...m.values()]}

// 1) region
const regions = uniqBy(J,r=>r.region_code).map(r=>({code:r.region_code,nom:r.region_name,nom_affichage:r.region_label,pays_code:r.country_code}))
let res = await sb.from('region').upsert(regions,{onConflict:'code'}); console.log('region upsert:',regions.length,res.error?.message||'OK')

// 2) sous_region
const sr = uniqBy(J,r=>r.sub_region_code).map(r=>({code:r.sub_region_code,nom:r.sub_region_name,nom_affichage:r.sub_region_label,region_code:r.region_code}))
res = await sb.from('sous_region').upsert(sr,{onConflict:'code'}); console.log('sous_region upsert:',sr.length,res.error?.message||'OK')

// 3) territoire
const terr = uniqBy(J,r=>r.territory_code).map(r=>({code:r.territory_code,nom:r.territory_name,sous_region_code:r.sub_region_code}))
res = await sb.from('territoire').upsert(terr,{onConflict:'code'}); console.log('territoire upsert:',terr.length,res.error?.message||'OK')

// 4) zone (areas): rebuild — delete all + insert distinct (territoire, code, nom)
const areas = uniqBy(J,r=>`${r.territory_code}|${r.area_code}|${r.area_name}`).map(r=>({code:r.area_code,nom:r.area_name,territoire_code:r.territory_code}))
console.log('distinct areas to insert:',areas.length)
// delete existing (no FK to zone.id yet)
let del = await sb.from('zone').delete().gte('id',0); console.log('zone delete:',del.error?.message||'OK')
// insert in batches
let ins=0
for(let i=0;i<areas.length;i+=500){const {error,data}=await sb.from('zone').insert(areas.slice(i,i+500)).select('id');if(error){console.error('zone insert fail',i,error.message);break}ins+=data.length}
console.log('zone inserted:',ins)

// 5) distributeur: ensure 32 JSON distributors exist (insert missing by nom), keep national flags
const dNames=[...new Set(J.map(r=>r.distributor).filter(x=>x&&x!=='NOT AVAILABLE'))]
const {data:existing}=await sb.from('distributeur').select('nom')
const have=new Set((existing||[]).map(d=>d.nom))
const toAdd=dNames.filter(n=>!have.has(n)).map(nom=>({nom,national:false}))
if(toAdd.length){res=await sb.from('distributeur').insert(toAdd);console.log('distributeur added:',toAdd.length,res.error?.message||'OK')}
else console.log('distributeur: all present')
console.log('JSON distinct distributors:',dNames.length,'| already had:',dNames.filter(n=>have.has(n)).length)

const {count:zc}=await sb.from('zone').select('*',{count:'exact',head:true})
const {count:dc}=await sb.from('distributeur').select('*',{count:'exact',head:true})
console.log('\nFINAL zone:',zc,'distributeur:',dc)
