<template>
  <div class="relative h-full w-full">
    <div ref="conteneur" class="h-full w-full" />
  </div>
</template>

<script setup lang="ts">
// Carte de la page Découpage : emprise des territoires (grille de cases teintées
// à la couleur du commercial), boutiques en canvas (Atom cerclées), points de
// visite (tirets rouges quand ils sont à cheval), nom des territoires.
// Tuiles OSM claires, comme les autres cartes du back-office.
import { AUTRE, STATUT } from '~/utils/chartPalette'
import { cadreRobuste, type CouchesDecoupage, type DecoupageDonnees } from '~/utils/decoupage'

const props = defineProps<{
  donnees: DecoupageDonnees
  couleurs: string[]
  territoire: number
  merch: number
  masques: Set<number>
  couches: CouchesDecoupage
}>()
const emit = defineEmits<{ (e: 'choisir-territoire', t: number): void }>()

const conteneur = ref<HTMLElement | null>(null)
let map: any = null
let L: any = null
let boutiques: any[] = []
let cases: { lyr: any, t: number }[] = []
let points: any[] = []
let noms: { lyr: any, t: number }[] = []
let groupes: Record<string, any> = {}
let rendus: Record<string, any> = {}

const PAS_EMPRISE = 0.004
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))

function nomCommercial(c: number) {
  if (c >= 0) return props.donnees.commerciaux[c]?.nom || '—'
  return c === -2 ? 'Partagé (quartier non attribué)' : 'Aucun'
}

function couleurTerritoire(t: number) {
  const coms = props.donnees.territoires[t]?.coms || []
  return coms.length === 1 ? props.couleurs[coms[0]!]! : coms.length ? AUTRE : STATUT.neutre
}

function popupBoutique(i: number) {
  const B = props.donnees.boutiques
  const t = props.donnees.territoires[B.t[i]!]
  const m = B.m[i]! >= 0 ? props.donnees.merchs[B.m[i]!] : null
  const lignes: [string, string][] = [
    ['Territoire', t?.nom || '—'],
    ['Commercial', nomCommercial(B.c[i]!)],
    ['Quartier saisi', B.quartier[i] || '—'],
    ['Distributeur', B.d[i]! >= 0 ? props.donnees.distributeurs[B.d[i]!]! : '—'],
  ]
  if (B.a[i]) lignes.push(['Atom', m ? `liste de ${m.nom}` : 'boutique Atom'])
  return `<div class="min-w-[220px] text-sm"><p class="mb-1 font-semibold text-slate-900">${esc(B.nom[i] || 'Boutique')}</p>`
    + `<dl class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">${lignes.map(([a, b]) => `<dt class="text-slate-500">${esc(a)}</dt><dd class="text-slate-800">${esc(b)}</dd>`).join('')}</dl>`
    + `<p class="mt-1.5 text-xs text-slate-500">Rattachée par territoire, en attendant le reclassement par secteur.</p></div>`
}

function popupPoint(p: DecoupageDonnees['points'][number]) {
  const m = p.merch >= 0 ? props.donnees.merchs[p.merch] : null
  const terr = p.t.map(t => props.donnees.territoires[t]?.nom).filter(Boolean).join(', ') || '—'
  const coms = p.c.map(c => nomCommercial(c)).join(', ') || '—'
  return `<div class="min-w-[220px] text-sm"><p class="mb-1 font-semibold text-slate-900">${esc(p.nom)}</p>`
    + `<dl class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5"><dt class="text-slate-500">Merchandiser</dt><dd>${esc(m?.nom || '—')}</dd>`
    + `<dt class="text-slate-500">Boutiques</dt><dd>${p.nb}</dd><dt class="text-slate-500">Territoires</dt><dd>${esc(terr)}</dd>`
    + `<dt class="text-slate-500">Commerciaux</dt><dd>${esc(coms)}</dd></dl>`
    + (p.cheval ? '<p class="mt-1.5 text-xs font-semibold text-red-700">À cheval sur deux territoires ou deux commerciaux</p>' : '')
    + '</div>'
}

function dessiner() {
  const D = props.donnees
  const B = D.boutiques
  for (const g of Object.values(groupes)) g.clearLayers()

  // Emprise : une case par 0,004° (≈ 450 m), territoire majoritaire de ses boutiques
  // (calculée sur toutes les boutiques, côté serveur).
  cases = D.emprise.map((c) => {
    const lyr = L.rectangle([[c.lat, c.lng], [c.lat + PAS_EMPRISE, c.lng + PAS_EMPRISE]], { renderer: rendus.emprise, stroke: false, fillOpacity: 0.18, interactive: true })
    lyr.on('click', () => emit('choisir-territoire', c.t))
    lyr.bindTooltip(() => `<b>${esc(D.territoires[c.t]?.nom)}</b> · ${esc((D.territoires[c.t]?.coms || []).map(nomCommercial).join(' / ') || 'sans commercial')}`, { sticky: true })
    return { lyr, t: c.t }
  })

  boutiques = B.lat.map((lat, i) => {
    const lyr = L.circleMarker([lat, B.lng[i]], { renderer: rendus.boutiques, radius: B.a[i] ? 4 : 3.2, weight: B.a[i] ? 1.4 : 0, color: '#0f172a', fillOpacity: 0.85 })
    lyr.bindPopup(() => popupBoutique(i), { maxWidth: 320 })
    return lyr
  })

  points = D.points.map((p) => {
    const lyr = L.circleMarker([p.lat, p.lng], { renderer: rendus.points, radius: 8, fill: true, fillOpacity: 0.05, weight: p.cheval ? 2.4 : 1.8, color: p.cheval ? STATUT.critique : '#334155', dashArray: p.cheval ? '4 3' : null })
    lyr.bindPopup(() => popupPoint(p), { maxWidth: 320 })
    return lyr
  })

  // Nom du territoire au centre de ses boutiques.
  noms = D.centres.flatMap((centre, t) => centre ? [{
    t,
    lyr: L.marker(centre, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'decoupage-nom', html: `<span>${esc(D.territoires[t]!.nom)}</span>`, iconSize: null }),
    }),
  }] : [])

  styler()
}

function styler() {
  if (!map) return
  const B = props.donnees.boutiques
  const { territoire: sel, merch, masques, couches } = props
  const estompeTerr = (t: number) => sel >= 0 && t !== sel

  for (const { lyr, t } of cases) {
    const visible = couches.emprises && !masques.has(t)
    if (!visible) { groupes.emprises.removeLayer(lyr); continue }
    lyr.setStyle({ fillColor: couleurTerritoire(t), fillOpacity: sel === t ? 0.32 : estompeTerr(t) || merch >= 0 ? 0.06 : 0.18 })
    groupes.emprises.addLayer(lyr)
  }

  boutiques.forEach((lyr, i) => {
    const atom = B.a[i] === 1
    const visible = (atom ? couches.atom : couches.friesland) && !masques.has(B.t[i]!)
    if (!visible) { groupes.boutiques.removeLayer(lyr); return }
    const estompee = merch >= 0 ? B.m[i] !== merch : estompeTerr(B.t[i]!)
    const c = B.c[i]!
    lyr.setStyle({
      fillColor: c >= 0 ? props.couleurs[c] : c === -2 ? AUTRE : STATUT.neutre,
      fillOpacity: estompee ? 0.12 : 0.85,
      opacity: estompee ? 0.15 : 0.9,
    })
    groupes.boutiques.addLayer(lyr)
  })

  points.forEach((lyr, i) => {
    const p = props.donnees.points[i]!
    const visible = couches.points && (merch < 0 || p.merch === merch) && !p.t.every(t => masques.has(t))
    if (visible) groupes.points.addLayer(lyr)
    else groupes.points.removeLayer(lyr)
  })

  for (const { lyr, t } of noms) {
    if (couches.noms && !masques.has(t)) groupes.noms.addLayer(lyr)
    else groupes.noms.removeLayer(lyr)
  }
}

/** Cadre la carte sur un territoire, un merchandiser ou tout le découpage. */
function cadrer() {
  if (!map) return
  const B = props.donnees.boutiques
  const garder = props.merch >= 0
    ? (i: number) => B.m[i] === props.merch
    : props.territoire >= 0 ? (i: number) => B.t[i] === props.territoire : (i: number) => !props.masques.has(B.t[i]!)
  const lat: number[] = [], lng: number[] = []
  for (let i = 0; i < B.lat.length; i++) {
    if (garder(i)) { lat.push(B.lat[i]!); lng.push(B.lng[i]!) }
  }
  if (!lat.length) {
    // Rien à montrer en boutiques (territoire vide, ou hors du périmètre d'un
    // commercial) : l'emprise du territoire ou du découpage.
    for (const c of props.donnees.emprise) {
      if (props.territoire >= 0 ? c.t !== props.territoire : props.masques.has(c.t)) continue
      lat.push(c.lat, c.lat + PAS_EMPRISE); lng.push(c.lng, c.lng + PAS_EMPRISE)
    }
  }
  const cadre = cadreRobuste(lat, lng)
  if (!cadre) return
  map.invalidateSize()
  map.fitBounds(cadre, { padding: [30, 30], maxZoom: 15 })
}

async function initialiser() {
  if (!conteneur.value) return
  L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  map = L.map(conteneur.value, { preferCanvas: true }).setView([5.36, -4.0], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)
  map.createPane('emprises').style.zIndex = '350'
  map.createPane('noms').style.zIndex = '640'
  rendus = {
    emprise: L.canvas({ pane: 'emprises', padding: 0.3 }),
    boutiques: L.canvas({ padding: 0.3 }),
    points: L.canvas({ padding: 0.3 }),
  }
  groupes = {
    emprises: L.layerGroup().addTo(map),
    boutiques: L.layerGroup().addTo(map),
    points: L.layerGroup().addTo(map),
    noms: L.layerGroup({ pane: 'noms' }).addTo(map),
  }
  dessiner()
  cadrer()
}

watch(() => props.donnees, () => { if (map) { dessiner(); cadrer() } })
watch(() => [props.territoire, props.merch], () => { styler(); cadrer() })
watch(() => [props.masques, props.couches, props.couleurs], styler, { deep: true })

onMounted(() => { nextTick(initialiser) })
onUnmounted(() => {
  map?.remove()
  map = null
})

defineExpose({ cadrer })
</script>

<style>
.decoupage-nom span {
  display: inline-block;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  font: 700 11px/1.1 'Nunito Sans', system-ui, sans-serif;
  letter-spacing: 0.02em;
  color: #1e293b;
  text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 2px #fff;
  pointer-events: none;
}
</style>
