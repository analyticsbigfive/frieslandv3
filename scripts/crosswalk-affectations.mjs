#!/usr/bin/env node
// Croise affectations_par_secteur.csv (Zone/Secteur/Merchandiser/Commercial/Region)
// avec le référentiel géographique actuel (docs/migrationGood.csv :
// Division ABIDJAN/UP COUNTRY > Sous-région ABIDJAN 1/2, NORTH 1/2 > Territoire > Quartier).
// Sorties : affectations_par_secteur_enrichi.csv + affectations_rapport.md dans ~/Downloads.
// Aucune écriture en base.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REF_PATH = join(__dirname, '..', 'docs', 'migrationGood.csv')
const SRC_PATH = join(process.env.HOME, 'Downloads', 'affectations_par_secteur.csv')
const OUT_CSV = join(process.env.HOME, 'Downloads', 'affectations_par_secteur_enrichi.csv')
const OUT_MD = join(process.env.HOME, 'Downloads', 'affectations_rapport.md')

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

// Forme compacte pour comparaison approchée : lettres/chiffres uniquement
const compact = (s) => norm(s).replace(/[^A-Z0-9]/g, '')

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

// Cherche un quartier approchant dans un territoire : compact égal, puis distance ≤2 (mots ≥5), puis inclusion (≥5 car.)
function fuzzyFind(terr, secteur) {
  const c = compact(secteur)
  if (!c) return null
  for (const [qKey, label] of terr.quartiers) if (compact(qKey) === c) return label
  let best = null
  for (const [qKey, label] of terr.quartiers) {
    const qc = compact(qKey)
    if (c.length >= 5 && qc.length >= 5) {
      const d = levenshtein(c, qc)
      if (d <= 2 && (!best || d < best.d)) best = { d, label }
    }
  }
  if (best) return best.label
  for (const [qKey, label] of terr.quartiers) {
    const qc = compact(qKey)
    if (c.length >= 5 && qc.length >= 5 && (qc.includes(c) || c.includes(qc))) return label
  }
  return null
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

// ---------- Référentiel ----------
const refLines = readFileSync(REF_PATH, 'utf8').split(/\r?\n/)
// Sauter les 3 lignes descriptives + l'en-tête (ligne 4)
const refRows = refLines.slice(4).map(parseCsvLine).filter((r) => r.length >= 8 && r[5])

// territoire normalisé -> { nom, sousRegion, division, quartiers: Map(normQuartier -> libellé) }
const territoires = new Map()
// quartier normalisé -> Set de territoires (pour la recherche élargie)
const quartierIndex = new Map()

for (const r of refRows) {
  const [, , division, , sousRegion, territoire, , quartier] = r
  const tKey = norm(territoire)
  if (!territoires.has(tKey)) {
    territoires.set(tKey, { nom: territoire.trim(), sousRegion: sousRegion.trim(), division: division.trim(), quartiers: new Map() })
  }
  const t = territoires.get(tKey)
  const qKey = norm(quartier)
  if (qKey) {
    if (!t.quartiers.has(qKey)) t.quartiers.set(qKey, quartier.trim())
    if (!quartierIndex.has(qKey)) quartierIndex.set(qKey, new Set())
    quartierIndex.get(qKey).add(tKey)
  }
}

// Alias Zone CSV -> territoire référentiel (cas sans homonyme direct)
const ZONE_ALIAS = {
  'ATTECOUBE-PLATEAU': 'PLATEAU',
  'ADIAKE': 'ABOISSO',
  'ADAOU': 'ABOISSO',
  'AYAME': 'ABOISSO',
  'BIANOUAN': 'ABOISSO',
  'MAFERE': 'ABOISSO',
  'ETUEBOUE': 'ABOISSO',
  'ASSINIE MAFIA': 'BASSAM',
  'BONOUA': 'BASSAM',
  'PORT-BOUET': 'PORT BOUET',
}

// ---------- Source ----------
const srcLines = readFileSync(SRC_PATH, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const header = parseCsvLine(srcLines[0])
const rows = srcLines.slice(1).map(parseCsvLine)

const outHeader = [...header, 'Division', 'Sous-région', 'Territoire (référentiel)', 'Quartier (référentiel)', 'Canal', 'Statut match']
const outRows = []
const stats = { total: 0, quartierOk: 0, quartierKo: 0, zoneKo: 0 }
const unmatchedQuartiers = []
const regionMismatches = []
// clé personne -> { role, sousRegions:Set, territoires:Set, zones:Set, secteurs: n }
const parPersonne = new Map()
const secteurSeen = new Map() // détection doublons (zone|secteur|equipe)

for (const r of rows) {
  if (r.length < 6) continue
  const [id, zone, secteur, merch, commercial, regionCsv] = r.map((x) => x.trim())
  if (!zone) continue
  stats.total++

  const canal = norm(regionCsv) === 'MODERN TRADE' ? 'Modern Trade' : 'Général'
  const zKey = norm(zone)
  const tKey = territoires.has(zKey) ? zKey : norm(ZONE_ALIAS[zKey] || '')
  const terr = territoires.get(tKey)

  let division = '', sousRegion = '', terrNom = '', quartierRef = '', statut
  if (!terr) {
    statut = 'ZONE_NON_TROUVEE'
    stats.zoneKo++
  } else {
    division = terr.division
    sousRegion = terr.sousRegion
    terrNom = terr.nom
    const qKey = norm(secteur)
    const approx = terr.quartiers.has(qKey) ? null : fuzzyFind(terr, secteur)
    if (terr.quartiers.has(qKey)) {
      quartierRef = terr.quartiers.get(qKey)
      statut = 'OK'
      stats.quartierOk++
    } else if (approx) {
      quartierRef = approx
      statut = 'OK_APPROX'
      stats.quartierOk++
    } else if (quartierIndex.has(qKey)) {
      // trouvé dans un autre territoire
      const other = [...quartierIndex.get(qKey)][0]
      quartierRef = territoires.get(other).quartiers.get(qKey)
      statut = `OK_AUTRE_TERRITOIRE(${territoires.get(other).nom})`
      stats.quartierOk++
    } else {
      statut = 'QUARTIER_NON_TROUVE'
      stats.quartierKo++
      unmatchedQuartiers.push(`${secteur} (zone ${zone})`)
    }
    // cohérence Region CSV vs sous-région référentiel (hors Modern Trade)
    if (canal === 'Général' && norm(regionCsv) !== norm(sousRegion)) {
      regionMismatches.push(`${zone} / ${secteur} : CSV=${regionCsv} vs référentiel=${sousRegion}`)
    }
  }

  // doublons
  const dupKey = `${zKey}|${norm(secteur)}|${norm(merch)}`
  secteurSeen.set(dupKey, (secteurSeen.get(dupKey) || 0) + 1)

  for (const [nom, role] of [[merch, 'Merchandiser'], [commercial, 'Commercial']]) {
    if (!nom) continue
    const pKey = `${role}|${nom}`
    if (!parPersonne.has(pKey)) {
      parPersonne.set(pKey, { nom, role, divisions: new Set(), sousRegions: new Set(), territoires: new Set(), zones: new Set(), canaux: new Set(), secteurs: 0 })
    }
    const p = parPersonne.get(pKey)
    if (division) p.divisions.add(division)
    if (sousRegion) p.sousRegions.add(sousRegion)
    if (terrNom) p.territoires.add(terrNom)
    p.zones.add(zone)
    p.canaux.add(canal)
    p.secteurs++
  }

  outRows.push([id, zone, secteur, merch, commercial, regionCsv, division, sousRegion, terrNom, quartierRef, canal, statut])
}

// ---------- CSV enrichi ----------
const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
writeFileSync(OUT_CSV, [outHeader, ...outRows].map((r) => r.map(esc).join(',')).join('\n') + '\n', 'utf8')

// ---------- Rapport ----------
const dups = [...secteurSeen.entries()].filter(([, n]) => n > 1)
const pct = ((stats.quartierOk / stats.total) * 100).toFixed(1)

const personneTable = (role) =>
  [...parPersonne.values()]
    .filter((p) => p.role === role)
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map((p) => `| ${p.nom} | ${[...p.divisions].join(', ') || '—'} | ${[...p.sousRegions].join(', ') || '—'} | ${[...p.territoires].join(', ') || '—'} | ${[...p.zones].join(', ')} | ${p.secteurs} | ${[...p.canaux].join(', ')} |`)
    .join('\n')

const md = `# Rapport de croisement — affectations ↔ référentiel géographique

Source : \`affectations_par_secteur.csv\` (${stats.total} lignes) croisée avec \`docs/migrationGood.csv\`
(Division > Sous-région > Territoire > Quartier). Secteur = quartier, Zone = territoire.

## Synthèse

- Lignes traitées : **${stats.total}**
- Secteurs matchés à un quartier du référentiel : **${stats.quartierOk}** (${pct} %)
- Secteurs non trouvés : **${stats.quartierKo}**
- Zones non trouvées : **${stats.zoneKo}**

## Commerciaux

| Commercial | Division | Sous-région | Territoires | Zones CSV | Secteurs | Canal |
|---|---|---|---|---|---|---|
${personneTable('Commercial')}

## Merchandisers

| Merchandiser | Division | Sous-région | Territoires | Zones CSV | Secteurs | Canal |
|---|---|---|---|---|---|---|
${personneTable('Merchandiser')}

## Secteurs non matchés à un quartier (${unmatchedQuartiers.length})

${unmatchedQuartiers.length ? unmatchedQuartiers.map((q) => `- ${q}`).join('\n') : '_Aucun_'}

## Incohérences Region CSV ↔ sous-région référentiel (${regionMismatches.length})

${regionMismatches.length ? regionMismatches.map((m) => `- ${m}`).join('\n') : '_Aucune_'}

## Doublons dans le CSV source (${dups.length})

${dups.length ? dups.map(([k, n]) => `- ${k.split('|').slice(0, 2).join(' / ')} (×${n})`).join('\n') : '_Aucun_'}

## Notes

- **PORT-BOUET apparaît deux fois** : une équipe terrain (Moustapha N'daye / N'Guessan Akundah Anne Marie, ABIDJAN 1, sans Secteur ID) et une équipe Modern Trade (Sonia Akon). Les deux sont rattachées au territoire **Port bouet** ; les lignes Modern Trade portent \`Canal = Modern Trade\`.
- Zones sans territoire homonyme, rattachées par alias : Adiaké, Adaou, Ayamé, Bianouan, Maféré, Etueboué → **Aboisso** ; Bonoua, Assinie Mafia → **Bassam** ; Attécoubé-Plateau → **Plateau**.
- Rachid Assirou est à la fois commercial (Abobo 1/2, Adzopé) et merchandiser (Adzopé).
`
writeFileSync(OUT_MD, md, 'utf8')

console.log(`OK — ${stats.total} lignes, ${stats.quartierOk} quartiers matchés (${pct}%), ${stats.quartierKo} non trouvés, ${stats.zoneKo} zones inconnues`)
console.log(`→ ${OUT_CSV}`)
console.log(`→ ${OUT_MD}`)
