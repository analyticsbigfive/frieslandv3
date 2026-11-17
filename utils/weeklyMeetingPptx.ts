// utils/weeklyMeetingPptx.ts
// Mise en slides du Weekly Meeting Merchandising Agency : une présentation par
// agence et par semaine, à partir du rapport de utils/weeklyMeeting.ts.
//
// Pas de gabarit client (17/11/2026) : couleurs du back-office (rouge Bonnet
// Rouge, slate), police Calibri (présente sur tous les postes PowerPoint).
// Graphiques et tableaux natifs : ils restent modifiables dans PowerPoint.
//
// La bibliothèque est passée en paramètre : chargée à la demande dans le
// navigateur (utils/chargerPptx.ts), importée directement dans les tests.
import type PptxGenJS from 'pptxgenjs'
import { evolution, fmtPct, libelleSemaine, numeroSemaine, type Evolution, type RapportHebdo } from './weeklyMeeting'

export interface PhotoSlide {
  /** Data URL (image/jpeg;base64). */
  data: string
  largeur: number
  hauteur: number
  legende: string
}

type Slide = PptxGenJS.Slide

const L = 13.333
const MARGE = 0.5
const UTILE = L - 2 * MARGE
const POLICE = 'Calibri'

const C = {
  rouge: 'C8102E',
  rougeFonce: '8F0B21',
  encre: '0F172A',
  texte: '334155',
  discret: '64748B',
  trait: 'E2E8F0',
  fond: 'F8FAFC',
  entete: 'F1F5F9',
  blanc: 'FFFFFF',
  gris: 'CBD5E1',
  hausse: '15803D',
  baisse: 'B91C1C',
  alerte: 'B45309',
  alerteFond: 'FFFBEB',
} as const

const hex = (c: string) => c.replace('#', '').toUpperCase()
const MAITRE = 'CONTENU'
const TITRE_DECK = 'Weekly Meeting Merchandising Agency'

const entier = (n: number) => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ')
const jourMois = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const couper = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

function titre(slide: Slide, texte: string, sousTitre?: string) {
  slide.addText(texte, { x: MARGE + 0.25, y: 0.38, w: UTILE - 0.25, h: 0.5, fontFace: POLICE, fontSize: 26, bold: true, color: C.encre, margin: 0, valign: 'middle' })
  if (sousTitre) {
    slide.addText(sousTitre, { x: MARGE + 0.25, y: 0.9, w: UTILE - 0.25, h: 0.32, fontFace: POLICE, fontSize: 13, color: C.discret, margin: 0, valign: 'middle' })
  }
}

interface Tuile {
  libelle: string
  valeur: string
  detail?: string
  evolution?: Evolution
  /** Une hausse est une mauvaise nouvelle (alertes). */
  hausseDefavorable?: boolean
}

function couleurEvolution(e: Evolution, hausseDefavorable = false): string {
  if (e.sens === 'hausse') return hausseDefavorable ? C.baisse : C.hausse
  if (e.sens === 'baisse') return hausseDefavorable ? C.hausse : C.baisse
  return C.discret
}

const FLECHE: Record<Evolution['sens'], string> = { hausse: '▲ ', baisse: '▼ ', stable: '', inconnu: '' }

function tuiles(pptx: PptxGenJS, slide: Slide, items: Tuile[], y: number, h = 1.45) {
  const ecart = 0.2
  const w = (UTILE - ecart * (items.length - 1)) / items.length
  items.forEach((t, i) => {
    const x = MARGE + i * (w + ecart)
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: C.fond }, line: { color: C.trait, width: 0.75 } })
    slide.addText(t.libelle, { x: x + 0.18, y: y + 0.12, w: w - 0.36, h: 0.3, fontFace: POLICE, fontSize: 11, color: C.discret, margin: 0, valign: 'middle' })
    slide.addText(t.valeur, { x: x + 0.18, y: y + 0.42, w: w - 0.36, h: 0.55, fontFace: POLICE, fontSize: 26, bold: true, color: C.encre, margin: 0, valign: 'middle', fit: 'shrink' })
    const lignes: PptxGenJS.TextProps[] = []
    if (t.evolution) {
      lignes.push({ text: `${FLECHE[t.evolution.sens]}${t.evolution.texte}`, options: { color: couleurEvolution(t.evolution, t.hausseDefavorable), bold: t.evolution.sens === 'hausse' || t.evolution.sens === 'baisse' } })
      if (t.evolution.sens !== 'inconnu') lignes.push({ text: ' vs S-1', options: { color: C.discret } })
    }
    if (t.detail) lignes.push({ text: `${lignes.length ? ' · ' : ''}${t.detail}`, options: { color: C.discret } })
    if (lignes.length) {
      slide.addText(lignes, { x: x + 0.18, y: y + h - 0.42, w: w - 0.36, h: 0.3, fontFace: POLICE, fontSize: 10, margin: 0, valign: 'middle', fit: 'shrink' })
    }
  })
}

type Cellule = string | { text: string, bold?: boolean, color?: string, align?: 'left' | 'right' | 'center' }

interface Colonne {
  titre: string
  largeur: number
  align?: 'left' | 'right' | 'center'
}

const BORD_LIGNE: PptxGenJS.BorderProps[] = [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.5, color: C.trait }, { type: 'none' }]

function tableau(slide: Slide, colonnes: Colonne[], lignes: Cellule[][], pos: { x: number, y: number, w: number }, opts: { taille?: number, hauteurLigne?: number } = {}) {
  const taille = opts.taille ?? 10
  const total = colonnes.reduce((s, c) => s + c.largeur, 0)
  const colW = colonnes.map(c => (pos.w * c.largeur) / total)
  const entete: PptxGenJS.TableCell[] = colonnes.map(c => ({
    text: c.titre,
    options: { bold: true, color: C.texte, fill: { color: C.entete }, align: c.align ?? 'left', valign: 'middle', fontSize: taille, fontFace: POLICE, border: BORD_LIGNE },
  }))
  const corps: PptxGenJS.TableCell[][] = lignes.map(l => l.map((cellule, i) => {
    const c = typeof cellule === 'string' ? { text: cellule } : cellule
    return {
      text: c.text,
      options: { bold: c.bold, color: c.color ?? C.texte, align: c.align ?? colonnes[i]?.align ?? 'left', valign: 'middle', fontSize: taille, fontFace: POLICE, border: BORD_LIGNE },
    }
  }))
  slide.addTable([entete, ...corps], { x: pos.x, y: pos.y, w: pos.w, colW, rowH: opts.hauteurLigne ?? 0.3, margin: [0, 0.08, 0, 0.08] })
}

function sousTitre(slide: Slide, texte: string, x: number, y: number, w: number) {
  slide.addText(texte, { x, y, w, h: 0.3, fontFace: POLICE, fontSize: 13, bold: true, color: C.encre, margin: 0, valign: 'middle' })
}

function note(slide: Slide, texte: string, x: number, y: number, w: number, h = 0.4) {
  slide.addText(texte, { x, y, w, h, fontFace: POLICE, fontSize: 10, color: C.discret, margin: 0, valign: 'top' })
}

function vide(slide: Slide, texte: string, x: number, y: number, w: number, h: number) {
  slide.addText(texte, { x, y, w, h, fontFace: POLICE, fontSize: 12, italic: true, color: C.discret, align: 'center', valign: 'middle', fill: { color: C.fond }, line: { color: C.trait, width: 0.75 } })
}

const pctCouleur = (v: number | null, seuilBon = 80, seuilMoyen = 50) =>
  v === null ? C.discret : v >= seuilBon ? C.hausse : v >= seuilMoyen ? C.alerte : C.baisse

// ---- Slides -----------------------------------------------------------------

function couverture(pptx: PptxGenJS, r: RapportHebdo, direction: string) {
  const slide = pptx.addSlide()
  slide.background = { color: C.rouge }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 6.3, w: L, h: 1.2, fill: { color: C.rougeFonce }, line: { color: C.rougeFonce, width: 0 } })
  slide.addText(TITRE_DECK.toUpperCase(), { x: 0.8, y: 1.5, w: L - 1.6, h: 0.4, fontFace: POLICE, fontSize: 16, bold: true, color: 'FECDD3', charSpacing: 3, margin: 0 })
  slide.addText(r.agence.nom, { x: 0.8, y: 2.0, w: L - 1.6, h: 1.3, fontFace: POLICE, fontSize: 60, bold: true, color: C.blanc, margin: 0, valign: 'middle', fit: 'shrink' })
  slide.addText(`Semaine ${numeroSemaine(r.semaine)} · ${libelleSemaine(r.semaine)}`, { x: 0.8, y: 3.45, w: L - 1.6, h: 0.5, fontFace: POLICE, fontSize: 24, color: C.blanc, margin: 0, valign: 'middle' })
  if (direction) {
    slide.addText(`Direction ${direction}`, { x: 0.8, y: 4.0, w: L - 1.6, h: 0.4, fontFace: POLICE, fontSize: 16, color: 'FECDD3', margin: 0, valign: 'middle' })
  }
  slide.addText('FrieslandCampina · Bonnet Rouge — semaine de travail du lundi au samedi', { x: 0.8, y: 6.65, w: L - 1.6, h: 0.5, fontFace: POLICE, fontSize: 12, color: 'FECDD3', margin: 0, valign: 'middle' })
}

function chiffresCles(pptx: PptxGenJS, r: RapportHebdo) {
  const slide = pptx.addSlide({ masterName: MAITRE })
  const c = r.chiffres
  const a = r.avant
  titre(slide, 'Chiffres clés de la semaine', `Comparés à la semaine précédente (${libelleSemaine(r.precedente)})`)
  tuiles(pptx, slide, [
    { libelle: 'Visites', valeur: entier(c.visites), evolution: evolution(c.visites, a.visites) },
    { libelle: 'Points de vente visités', valeur: entier(c.pdv_visites), evolution: evolution(c.pdv_visites, a.pdv_visites) },
    { libelle: 'Merchandisers actifs', valeur: `${c.merchandisers_actifs} / ${r.effectif}`, evolution: evolution(c.merchandisers_actifs, a.merchandisers_actifs), detail: 'sur l’effectif' },
  ], 1.45)
  tuiles(pptx, slide, [
    { libelle: 'Réalisation des tournées', valeur: fmtPct(c.realisation_pct), evolution: evolution(c.realisation_pct, a.realisation_pct, 'points') },
    { libelle: 'Perfect Store atteint', valeur: fmtPct(c.perfect_store_pct), evolution: evolution(c.perfect_store_pct, a.perfect_store_pct, 'points') },
    { libelle: 'Disponibilité moyenne', valeur: fmtPct(c.dispo_moyenne_pct), evolution: evolution(c.dispo_moyenne_pct, a.dispo_moyenne_pct, 'points') },
  ], 3.05)

  sousTitre(slide, 'Visites par jour', MARGE, 4.65, UTILE)
  if (c.visites || a.visites) {
    slide.addChart(pptx.ChartType.bar, [
      { name: 'Semaine précédente', labels: r.jours.map(j => j.libelle), values: r.jours.map(j => j.visites_precedentes) },
      { name: 'Cette semaine', labels: r.jours.map(j => j.libelle), values: r.jours.map(j => j.visites) },
    ], {
      x: MARGE, y: 4.95, w: UTILE, h: 1.9, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60,
      chartColors: [C.gris, C.rouge], showLegend: true, legendPos: 'r', legendFontSize: 10, legendFontFace: POLICE, legendColor: C.texte,
      showValue: true, dataLabelFontSize: 9, dataLabelColor: C.texte, dataLabelFormatCode: '0;;',
      catAxisLabelFontSize: 10, catAxisLabelColor: C.discret, catAxisLabelFontFace: POLICE,
      valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    })
  }
  else {
    vide(slide, 'Aucune visite sur la semaine ni sur la précédente.', MARGE, 4.95, UTILE, 1.9)
  }
}

function routing(pptx: PptxGenJS, r: RapportHebdo) {
  const slide = pptx.addSlide({ masterName: MAITRE })
  const c = r.chiffres
  const a = r.avant
  titre(slide, 'Routing : programmé et réalisé', 'Tournées planifiées de la semaine et étapes faites sur le terrain')
  tuiles(pptx, slide, [
    { libelle: 'Tournées', valeur: entier(c.tournees), evolution: evolution(c.tournees, a.tournees) },
    { libelle: 'PDV programmés', valeur: entier(c.pdv_programmes), evolution: evolution(c.pdv_programmes, a.pdv_programmes) },
    { libelle: 'Étapes réalisées', valeur: entier(c.etapes_faites), evolution: evolution(c.etapes_faites, a.etapes_faites) },
    { libelle: 'Taux de réalisation', valeur: fmtPct(c.realisation_pct), evolution: evolution(c.realisation_pct, a.realisation_pct, 'points') },
  ], 1.45)

  const gauche = 7.4
  sousTitre(slide, 'Par jour', MARGE, 3.15, gauche)
  if (c.pdv_programmes) {
    slide.addChart(pptx.ChartType.bar, [
      { name: 'PDV programmés', labels: r.jours.map(j => j.libelle), values: r.jours.map(j => j.pdv_programmes) },
      { name: 'Étapes réalisées', labels: r.jours.map(j => j.libelle), values: r.jours.map(j => j.etapes_faites) },
    ], {
      x: MARGE, y: 3.45, w: gauche, h: 3.35, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60,
      chartColors: [C.gris, C.rouge], showLegend: true, legendPos: 'b', legendFontSize: 10, legendFontFace: POLICE, legendColor: C.texte,
      showValue: true, dataLabelFontSize: 9, dataLabelColor: C.texte, dataLabelFormatCode: '0;;',
      catAxisLabelFontSize: 10, catAxisLabelColor: C.discret, catAxisLabelFontFace: POLICE,
      valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    })
  }
  else {
    vide(slide, 'Aucune tournée planifiée pour cette agence sur la semaine.', MARGE, 3.45, gauche, 3.35)
  }

  const x = MARGE + gauche + 0.4
  const w = UTILE - gauche - 0.4
  sousTitre(slide, 'Situation des visites dans la tournée', x, 3.15, w)
  const s = r.situation
  if (s.disponible) {
    const part = (n: number) => fmtPct(c.visites ? Math.round((1000 * n) / c.visites) / 10 : null)
    tableau(slide, [{ titre: 'Situation', largeur: 3.2 }, { titre: 'Visites', largeur: 1, align: 'right' }, { titre: 'Part', largeur: 1, align: 'right' }], [
      ['Prévues dans la tournée', entier(s.prevues), part(s.prevues)],
      ['Ajoutées à la tournée du jour', entier(s.ajoutees_jour), part(s.ajoutees_jour)],
      [{ text: 'Hors tournée', color: s.hors_tournee ? C.alerte : C.texte, bold: !!s.hors_tournee }, entier(s.hors_tournee), part(s.hors_tournee)],
      ['   dont PDV créé sur place', entier(s.dont_pdv_cree), part(s.dont_pdv_cree)],
      ['Jour sans tournée', entier(s.sans_tournee), part(s.sans_tournee)],
    ], { x, y: 3.5, w }, { hauteurLigne: 0.36 })
    note(slide, 'Une visite hors tournée compte quand même. Les étapes réalisées se lisent sur la tournée ; les visites, sur le terrain : les deux totaux diffèrent.', x, 5.85, w, 0.9)
  }
  else {
    vide(slide, 'Situation des visites indisponible sur cette base.', x, 3.5, w, 1.6)
  }
}

function perfectStore(pptx: PptxGenJS, r: RapportHebdo) {
  const slide = pptx.addSlide({ masterName: MAITRE })
  const c = r.chiffres
  const a = r.avant
  titre(slide, 'Perfect Store', 'Points de vente distincts, dernière visite scorée de la semaine')
  tuiles(pptx, slide, [
    { libelle: 'PDV évalués', valeur: entier(c.pdv_evalues), evolution: evolution(c.pdv_evalues, a.pdv_evalues) },
    { libelle: 'PDV au standard', valeur: entier(c.pdv_perfect_store), evolution: evolution(c.pdv_perfect_store, a.pdv_perfect_store) },
    { libelle: 'Perfect Store atteint', valeur: fmtPct(c.perfect_store_pct), evolution: evolution(c.perfect_store_pct, a.perfect_store_pct, 'points') },
    { libelle: 'Score moyen', valeur: fmtPct(c.score_moyen_pct), evolution: evolution(c.score_moyen_pct, a.score_moyen_pct, 'points') },
  ], 1.45)

  const gauche = 6.4
  sousTitre(slide, 'Répartition par niveau', MARGE, 3.15, gauche)
  if (c.pdv_evalues) {
    const nonConformes = c.pdv_evalues - c.pdv_perfect_store
    const libelles = [...c.par_niveau.map(n => n.libelle), 'Non conforme']
    slide.addChart(pptx.ChartType.bar, [{ name: 'Points de vente', labels: libelles, values: [...c.par_niveau.map(n => n.nb_pdv), nonConformes] }], {
      x: MARGE, y: 3.45, w: gauche, h: 3.35, barDir: 'bar', barGapWidthPct: 45,
      chartColors: [...c.par_niveau.map(n => hex(n.couleur)), '94A3B8'], showLegend: false,
      showValue: true, dataLabelFontSize: 10, dataLabelColor: C.texte,
      catAxisLabelFontSize: 11, catAxisLabelColor: C.texte, catAxisLabelFontFace: POLICE, catAxisOrientation: 'maxMin',
      valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    })
  }
  else {
    vide(slide, 'Aucun point de vente évalué sur la semaine.', MARGE, 3.45, gauche, 3.35)
  }

  const x = MARGE + gauche + 0.4
  const w = UTILE - gauche - 0.4
  sousTitre(slide, 'Les piliers du score', x, 3.15, w)
  const evo = (act: number | null, av: number | null) => {
    const e = evolution(act, av, 'points')
    return { text: `${FLECHE[e.sens]}${e.texte}`, color: couleurEvolution(e), align: 'right' as const }
  }
  tableau(slide, [{ titre: 'Indicateur', largeur: 2.6 }, { titre: 'Semaine', largeur: 1.1, align: 'right' }, { titre: 'S-1', largeur: 1.1, align: 'right' }, { titre: 'Évolution', largeur: 1.4, align: 'right' }], [
    ['Disponibilité en rayon', { text: fmtPct(c.dispo_moyenne_pct), bold: true }, fmtPct(a.dispo_moyenne_pct), evo(c.dispo_moyenne_pct, a.dispo_moyenne_pct)],
    ['Visibilité', { text: fmtPct(c.visibilite_moyenne_pct), bold: true }, fmtPct(a.visibilite_moyenne_pct), evo(c.visibilite_moyenne_pct, a.visibilite_moyenne_pct)],
    ['Score global', { text: fmtPct(c.score_moyen_pct), bold: true }, fmtPct(a.score_moyen_pct), evo(c.score_moyen_pct, a.score_moyen_pct)],
  ], { x, y: 3.5, w }, { hauteurLigne: 0.4 })
  const reserves = [
    c.pdv_sans_seuil ? `${entier(c.pdv_sans_seuil)} PDV sans seuil de disponibilité : niveau impossible à calculer.` : '',
    c.visites_sans_releve ? `${entier(c.visites_sans_releve)} visites sans relevé (ni produits ni visibilité) : hors du calcul.` : '',
  ].filter(Boolean)
  if (reserves.length) note(slide, reserves.join('\n'), x, 5.4, w, 1.2)
}

const LIGNES_MERCH = 14
const LIGNES_SKU = 12

function merchandisers(pptx: PptxGenJS, r: RapportHebdo) {
  const pages = Math.max(1, Math.ceil(r.merchandisers.length / LIGNES_MERCH))
  for (let p = 0; p < pages; p++) {
    const slide = pptx.addSlide({ masterName: MAITRE })
    titre(slide, `Performance par merchandiser${pages > 1 ? ` (${p + 1}/${pages})` : ''}`, `${r.merchandisers.length} merchandisers avec une visite ou une tournée, classés par nombre de visites`)
    const lignes = r.merchandisers.slice(p * LIGNES_MERCH, (p + 1) * LIGNES_MERCH)
    if (!lignes.length) {
      vide(slide, 'Aucune visite ni tournée sur la semaine.', MARGE, 1.6, UTILE, 2)
      continue
    }
    tableau(slide, [
      { titre: 'Merchandiser', largeur: 2.95 },
      { titre: 'Jours', largeur: 0.7, align: 'right' },
      { titre: 'Visites', largeur: 0.8, align: 'right' },
      { titre: 'PDV visités', largeur: 1, align: 'right' },
      { titre: 'Programmés', largeur: 1.3, align: 'right' },
      { titre: 'Réalisés', largeur: 0.9, align: 'right' },
      { titre: 'Réalisation', largeur: 1.05, align: 'right' },
      { titre: 'Au standard', largeur: 1.1, align: 'right' },
      { titre: 'Dispo.', largeur: 0.85, align: 'right' },
      { titre: 'Visib.', largeur: 0.85, align: 'right' },
      { titre: 'Hors tournée', largeur: 1.1, align: 'right' },
      { titre: 'Sans relevé', largeur: 1.05, align: 'right' },
    ], lignes.map(m => [
      { text: couper(m.nom, 34), bold: true, color: C.encre },
      String(m.jours_actifs),
      entier(m.visites),
      entier(m.pdv_visites),
      entier(m.pdv_programmes),
      entier(m.etapes_faites),
      { text: fmtPct(m.realisation_pct), color: pctCouleur(m.realisation_pct) },
      m.pdv_evalues ? `${m.pdv_perfect_store} / ${m.pdv_evalues}` : '—',
      fmtPct(m.dispo_moyenne_pct),
      fmtPct(m.visibilite_moyenne_pct),
      r.situation.disponible ? { text: String(m.hors_tournee), color: m.hors_tournee ? C.alerte : C.texte } : '—',
      { text: String(m.visites_sans_releve), color: m.visites_sans_releve ? C.alerte : C.texte },
    ]), { x: MARGE, y: 1.45, w: UTILE }, { hauteurLigne: 0.34 })
  }
}

function produits(pptx: PptxGenJS, r: RapportHebdo) {
  const slide = pptx.addSlide({ masterName: MAITRE })
  titre(slide, 'Disponibilité des produits', 'Part des points de vente visités où la référence est disponible en rayon')
  const familles = r.familles.filter(f => f.releves > 0)
  const gauche = 4.6
  sousTitre(slide, 'Par famille', MARGE, 1.45, gauche)
  if (familles.length) {
    tableau(slide, [{ titre: 'Famille', largeur: 2 }, { titre: 'Relevés', largeur: 1.1, align: 'right' }, { titre: 'Disponibilité', largeur: 1.3, align: 'right' }],
      familles.map(f => [{ text: f.libelle, bold: true, color: C.encre }, entier(f.releves), { text: fmtPct(f.dispo_pct), bold: true, color: C.encre }]),
      { x: MARGE, y: 1.8, w: gauche }, { hauteurLigne: 0.4 })
  }
  else {
    vide(slide, 'Aucun relevé de produits sur la semaine.', MARGE, 1.8, gauche, 1.6)
  }
  note(slide, 'Dernière visite de la semaine de chaque point de vente. Disponible : la référence est en rayon. Une référence que le point de vente ne vend pas est relevée « en rupture » : elle compte comme non disponible.', MARGE, 5.75, gauche, 1.05)

  const x = MARGE + gauche + 0.4
  const w = UTILE - gauche - 0.4
  const classees = r.skus.filter(s => s.releves > 0).sort((a, b) => (b.dispo_pct ?? 0) - (a.dispo_pct ?? 0) || b.disponibles - a.disponibles)
  const montrees = classees.slice(0, LIGNES_SKU)
  sousTitre(slide, classees.length > LIGNES_SKU ? `Par référence : les ${LIGNES_SKU} plus disponibles sur ${classees.length}` : 'Par référence', x, 1.45, w)
  if (montrees.length) {
    tableau(slide, [{ titre: 'Référence', largeur: 3.3 }, { titre: 'Famille', largeur: 1 }, { titre: 'PDV relevés', largeur: 1.1, align: 'right' }, { titre: 'En rayon', largeur: 0.95, align: 'right' }, { titre: 'Absente', largeur: 0.95, align: 'right' }, { titre: 'Disponibilité', largeur: 1.25, align: 'right' }],
      montrees.map(s => [{ text: couper(s.libelle, 40), bold: true, color: C.encre }, s.categorie_libelle, entier(s.releves), entier(s.disponibles), entier(s.releves - s.disponibles), { text: fmtPct(s.dispo_pct), bold: true, color: pctCouleur(s.dispo_pct) }]),
      { x, y: 1.8, w }, { hauteurLigne: 0.36 })
  }
  else {
    vide(slide, 'Aucun relevé de produits sur la semaine.', x, 1.8, w, 1.6)
  }
}

function visibiliteEtConcurrence(pptx: PptxGenJS, r: RapportHebdo) {
  const slide = pptx.addSlide({ masterName: MAITRE })
  titre(slide, 'Visibilité et concurrence', 'Faits marquants relevés pendant les visites de la semaine')
  const moitie = (UTILE - 0.4) / 2

  sousTitre(slide, 'Visibilité Bonnet Rouge : éléments les moins présents', MARGE, 1.45, moitie)
  const elements = r.visibilite.filter(v => v.releves >= 5)
  const faibles = [...elements].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)).slice(0, 5)
  const forts = elements.filter(e => !faibles.includes(e)).slice(0, 4)
  const colonnesVisi: Colonne[] = [{ titre: 'Élément', largeur: 3.6 }, { titre: 'Relevés', largeur: 1, align: 'right' }, { titre: 'Présent', largeur: 1.1, align: 'right' }]
  const ligneVisi = (v: typeof elements[number]): Cellule[] => [{ text: couper(v.nom, 42), color: C.encre }, entier(v.releves), { text: fmtPct(v.pct), bold: true, color: pctCouleur(v.pct) }]
  if (faibles.length) {
    tableau(slide, colonnesVisi, faibles.map(ligneVisi), { x: MARGE, y: 1.8, w: moitie }, { hauteurLigne: 0.34 })
    if (forts.length) {
      sousTitre(slide, 'Éléments les plus présents', MARGE, 4.15, moitie)
      tableau(slide, colonnesVisi, forts.map(ligneVisi), { x: MARGE, y: 4.5, w: moitie }, { hauteurLigne: 0.34 })
    }
  }
  else {
    vide(slide, 'Pas assez de relevés de visibilité sur la semaine.', MARGE, 1.8, moitie, 1.6)
  }

  const x = MARGE + moitie + 0.4
  const k = r.concurrence
  sousTitre(slide, 'Concurrence', x, 1.45, moitie)
  if (!k.visites_renseignees) {
    vide(slide, 'Aucun relevé de concurrence sur la semaine.', x, 1.8, moitie, 1.6)
    return
  }
  slide.addText([
    { text: fmtPct(k.presence_pct), options: { bold: true, color: C.encre, fontSize: 20 } },
    { text: `  des visites avec au moins un concurrent présent (${entier(k.visites_avec_concurrent)} sur ${entier(k.visites_renseignees)})`, options: { color: C.texte, fontSize: 11 } },
  ], { x, y: 1.8, w: moitie, h: 0.45, fontFace: POLICE, margin: 0, valign: 'middle' })
  tableau(slide, [{ titre: 'Famille', largeur: 2 }, { titre: 'Concurrent présent', largeur: 1.7, align: 'right' }, { titre: 'En activité', largeur: 1.3, align: 'right' }],
    k.familles.map(f => [{ text: f.libelle, bold: true, color: C.encre }, entier(f.presents), { text: entier(f.en_activite), color: f.en_activite ? C.alerte : C.texte, bold: !!f.en_activite }]),
    { x, y: 2.35, w: moitie }, { hauteurLigne: 0.34 })

  const signales = k.signales.slice(0, 5).map(s => `${couper(s.nom, 28)} (${s.signalements})`)
  const actions = k.actions.slice(0, 4).map(a => `${couper(a.libelle, 60)} (${a.nb})`)
  const puces: PptxGenJS.TextProps[] = []
  if (signales.length) {
    puces.push({ text: 'Concurrents signalés hors liste', options: { bold: true, color: C.encre, breakLine: true } })
    puces.push({ text: signales.join(' · '), options: { color: C.texte, breakLine: true } })
  }
  if (actions.length) {
    puces.push({ text: 'Actions de la concurrence', options: { bold: true, color: C.encre, breakLine: true } })
    actions.forEach(a => puces.push({ text: a, options: { color: C.texte, bullet: true, breakLine: true } }))
  }
  if (puces.length) slide.addText(puces, { x, y: 4.3, w: moitie, h: 2.5, fontFace: POLICE, fontSize: 11, margin: 0, valign: 'top', paraSpaceAfter: 4 })
}

function alertes(pptx: PptxGenJS, r: RapportHebdo) {
  const slide = pptx.addSlide({ masterName: MAITRE })
  const c = r.chiffres
  const a = r.avant
  titre(slide, 'Alertes et points à traiter')
  tuiles(pptx, slide, [
    { libelle: 'PDV signalés fermés', valeur: entier(r.fermetures.length), detail: `${r.fermetures.filter(f => !f.decision).length} sans décision` },
    { libelle: 'Visites sans relevé', valeur: entier(c.visites_sans_releve), evolution: evolution(c.visites_sans_releve, a.visites_sans_releve), hausseDefavorable: true },
    { libelle: 'Visites hors tournée', valeur: r.situation.disponible ? entier(r.situation.hors_tournee) : '—', detail: r.situation.disponible ? `dont ${r.situation.dont_pdv_cree} PDV créés sur place` : 'indisponible' },
    { libelle: 'Visites sans validation GPS', valeur: entier(r.gps_non_valide) },
    { libelle: 'Merchandisers sans visite', valeur: `${r.sans_visite.length} / ${r.effectif}` },
  ], 1.2)

  const gauche = 7.6
  sousTitre(slide, 'Points de vente signalés fermés', MARGE, 2.95, gauche)
  if (r.fermetures.length) {
    const decision = (d: string | null) => (d === 'fermer' ? { text: 'Fermé', color: C.baisse } : d === 'garder' ? { text: 'Gardé', color: C.hausse } : { text: 'À décider', color: C.alerte, bold: true })
    tableau(slide, [{ titre: 'Date', largeur: 0.7 }, { titre: 'Point de vente', largeur: 3 }, { titre: 'Quartier', largeur: 1.8 }, { titre: 'Signalé par', largeur: 2 }, { titre: 'Décision', largeur: 1.1 }],
      r.fermetures.slice(0, 9).map(f => [jourMois(f.declare_le), { text: couper(f.nom_pdv || f.pdv_id, 34), color: C.encre }, couper(f.quartier || f.zone || '—', 22), couper(f.declarant, 24), decision(f.decision)]),
      { x: MARGE, y: 3.3, w: gauche }, { hauteurLigne: 0.34 })
    if (r.fermetures.length > 9) note(slide, `… et ${r.fermetures.length - 9} autres signalements (Points de vente › Fermetures signalées).`, MARGE, 6.72, gauche, 0.25)
  }
  else {
    vide(slide, 'Aucun point de vente signalé fermé sur la semaine.', MARGE, 3.3, gauche, 1.4)
  }

  const x = MARGE + gauche + 0.4
  const w = UTILE - gauche - 0.4
  sousTitre(slide, 'Merchandisers sans visite sur la semaine', x, 2.95, w)
  if (r.sans_visite.length) {
    const noms = r.sans_visite.slice(0, 16).map(n => couper(n, 30))
    if (r.sans_visite.length > 16) noms.push(`… et ${r.sans_visite.length - 16} autres`)
    slide.addText(noms.map(n => ({ text: n, options: { bullet: true, breakLine: true } })), { x, y: 3.3, w, h: Math.min(3.5, 0.3 + noms.length * 0.21), fontFace: POLICE, fontSize: 10.5, color: C.texte, margin: 8, valign: 'top', fill: { color: C.alerteFond }, line: { color: 'FDE68A', width: 0.75 } })
  }
  else {
    vide(slide, 'Tous les merchandisers actifs ont fait au moins une visite.', x, 3.3, w, 1.4)
  }
}

function photosSemaine(pptx: PptxGenJS, r: RapportHebdo, photos: PhotoSlide[]) {
  const slide = pptx.addSlide({ masterName: MAITRE })
  titre(slide, 'Photos de la semaine', 'Une sélection de photos prises pendant les visites')
  if (!photos.length) {
    vide(slide, r.photos.length ? 'Les photos de la semaine n’ont pas pu être chargées.' : 'Aucune photo de visite sur la semaine.', MARGE, 1.6, UTILE, 2)
    return
  }
  const colonnes = 3
  const ecart = 0.3
  const w = (UTILE - ecart * (colonnes - 1)) / colonnes
  const hImage = 2.2
  const hCase = hImage + 0.42
  photos.slice(0, 6).forEach((p, i) => {
    const x = MARGE + (i % colonnes) * (w + ecart)
    const y = 1.45 + Math.floor(i / colonnes) * (hCase + 0.12)
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h: hImage, fill: { color: C.entete }, line: { color: C.trait, width: 0.75 } })
    const echelle = Math.min(w / p.largeur, hImage / p.hauteur)
    const iw = p.largeur * echelle
    const ih = p.hauteur * echelle
    slide.addImage({ data: p.data, x: x + (w - iw) / 2, y: y + (hImage - ih) / 2, w: iw, h: ih })
    slide.addText(p.legende, { x, y: y + hImage + 0.04, w, h: 0.36, fontFace: POLICE, fontSize: 9.5, color: C.texte, margin: 0, valign: 'top', fit: 'shrink' })
  })
}

function actionsSuivantes(pptx: PptxGenJS) {
  const slide = pptx.addSlide({ masterName: MAITRE })
  titre(slide, 'Actions pour la semaine suivante', 'À remplir pendant la réunion')
  tableau(slide, [{ titre: 'Action', largeur: 6 }, { titre: 'Responsable', largeur: 2.6 }, { titre: 'Échéance', largeur: 1.6 }, { titre: 'Statut', largeur: 1.6 }],
    Array.from({ length: 8 }, () => ['', '', '', '']), { x: MARGE, y: 1.5, w: UTILE }, { taille: 12, hauteurLigne: 0.58 })
}

/**
 * Construit la présentation d'une agence. `direction` : libellé déjà formé
 * (« South — Abidjan »), vide si l'agence n'en a pas.
 */
export function construirePresentation(Pptx: new () => PptxGenJS, r: RapportHebdo, photos: PhotoSlide[] = [], direction = ''): PptxGenJS {
  const pptx = new Pptx()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = `${TITRE_DECK} — ${r.agence.nom} — ${libelleSemaine(r.semaine)}`
  pptx.subject = TITRE_DECK
  pptx.company = 'FrieslandCampina'
  pptx.theme = { headFontFace: POLICE, bodyFontFace: POLICE }

  pptx.defineSlideMaster({
    title: MAITRE,
    background: { color: C.blanc },
    objects: [
      { rect: { x: MARGE, y: 0.38, w: 0.1, h: 0.5, fill: { color: C.rouge } } },
      { rect: { x: MARGE, y: 7.0, w: UTILE, h: 0.01, fill: { color: C.trait } } },
      { text: { text: `${TITRE_DECK} · ${r.agence.nom} · ${libelleSemaine(r.semaine)}`, options: { x: MARGE, y: 7.05, w: UTILE - 1, h: 0.3, fontFace: POLICE, fontSize: 9, color: C.discret, margin: 0, valign: 'middle' } } },
    ],
    slideNumber: { x: L - MARGE - 0.6, y: 7.05, w: 0.6, h: 0.3, fontFace: POLICE, fontSize: 9, color: C.discret, align: 'right' },
  })

  couverture(pptx, r, direction)
  chiffresCles(pptx, r)
  routing(pptx, r)
  perfectStore(pptx, r)
  merchandisers(pptx, r)
  produits(pptx, r)
  visibiliteEtConcurrence(pptx, r)
  alertes(pptx, r)
  photosSemaine(pptx, r, photos)
  actionsSuivantes(pptx)
  return pptx
}
