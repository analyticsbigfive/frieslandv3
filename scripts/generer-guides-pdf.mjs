/**
 * Génère les guides de formation PDF à partir de docs/guides/source/.
 *
 * Usage :
 *   node scripts/generer-guides-pdf.mjs
 *       -> les 4 guides génériques : docs/guides/GUIDE-{ADMIN,COMMERCIAL,MERCHANDISER,MERCHANDISER-ATOM}.pdf
 *   node scripts/generer-guides-pdf.mjs --utilisateurs
 *       -> en plus, un guide personnalisé par commercial et merchandiseur actif
 *          (nom, e-mail, territoires, équipe / commercial responsable) dans
 *          docs/guides/utilisateurs/<role>/ — dossier NON versionné (données
 *          personnelles). Lit SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans .env.
 *          Un merchandiseur Atom (profiles.employeur = 'atom') reçoit le guide
 *          Atom, avec sa page « Ma semaine » (SSF, téléphone, quartiers de
 *          chaque jour, RPC ssf_semaine).
 *
 *   node scripts/generer-guides-pdf.mjs --utilisateurs --avec-mots-de-passe
 *       -> imprime en plus le mot de passe par défaut (SEED_DEFAULT_PASSWORD)
 *          sur la fiche des comptes qui ne l'ont pas encore remplacé
 *          (user_metadata.must_change_password encore à true).
 *
 * Supabase ne garde que le hachage des mots de passe : on ne peut pas relire
 * le mot de passe actuel. Seul le mot de passe par défaut des comptes seedés
 * est connu, et il est PRÉSUMÉ (une réinitialisation faite depuis l'admin
 * l'aurait remplacé). Sans --avec-mots-de-passe, la fiche laisse une ligne à
 * compléter à la main. Les PDF contenant un mot de passe ne doivent circuler
 * que vers leur destinataire.
 *
 * Rendu : Google Chrome en headless, piloté par le protocole DevTools (pour
 * le pied de page « page X / Y »). CHROME_PATH permet d'indiquer un autre binaire.
 */
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(__dirname, '..')
const DOCS = join(RACINE, 'docs')
const SOURCE = join(DOCS, 'guides', 'source')
const SORTIE = join(DOCS, 'guides')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const VERSION_APP = JSON.parse(await readFile(join(RACINE, 'package.json'), 'utf8')).version

const ROLES = {
  admin: {
    fichier: 'GUIDE-ADMIN',
    titre: 'Guide de l’administrateur',
    libelleRole: 'Administrateur · back-office web',
    intro: 'Ce guide accompagne les administrateurs du back-office Perfect Store : suivi de la performance, gestion des utilisateurs et des équipes, référentiels, standards et actions commerciales.',
  },
  commercial: {
    fichier: 'GUIDE-COMMERCIAL',
    titre: 'Guide du commercial',
    libelleRole: 'Commercial · field coaching',
    intro: 'Ce guide accompagne les commerciaux dans l’application mobile : suivi des visites de l’équipe et des points de vente, actions commerciales, field coaching des vendeurs des distributeurs.',
  },
  merchandiser: {
    fichier: 'GUIDE-MERCHANDISER',
    titre: 'Guide du merchandiseur',
    libelleRole: 'Merchandiseur · visites PDV',
    intro: 'Ce guide accompagne les merchandiseurs dans l’application mobile : tournée du jour, visites des points de vente, relevés produits, visibilité et actions à réaliser.',
  },
  merchandiser_atom: {
    fichier: 'GUIDE-MERCHANDISER-ATOM',
    source: 'merchandiser-atom',
    titre: 'Guide du merchandiseur Atom',
    libelleRole: 'Merchandiseur Atom · tournées avec les SSF',
    intro: 'Ce guide accompagne les merchandiseurs du programme Atom : planning de la semaine avec les SSF et leurs quartiers, tournée du jour par canal, visites des points de vente, travail hors ligne et objectifs du mois.',
  },
}

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const echapper = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]))
const slug = s => String(s || 'sans-nom').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const dateFr = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

// ---------------------------------------------------------------------------
// Assemblage HTML
// ---------------------------------------------------------------------------
async function feuilleDeStyle() {
  const css = await readFile(join(SOURCE, 'theme.css'), 'utf8')
  const police = join(RACINE, 'node_modules/@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2')
  if (!existsSync(police)) return css
  const b64 = (await readFile(police)).toString('base64')
  return `@font-face{font-family:'Nunito Sans Variable';font-style:normal;font-weight:200 1000;src:url(data:font/woff2;base64,${b64}) format('woff2');}\n${css}`
}

// Numérote les <h2> de chapitre et en déduit le sommaire.
function numeroterChapitres(contenu) {
  const titres = []
  const html = contenu.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, titre) => {
    titres.push(titre.trim())
    return `<h2><span class="num">${titres.length}</span><span>${titre.trim()}</span></h2>`
  })
  return { html, titres }
}

// Certains profils ont des dizaines de quartiers : la fiche doit tenir sur la couverture.
const abreger = (liste, max) => liste.length > max
  ? `${liste.slice(0, max).join(', ')} … et ${liste.length - max} autre(s)`
  : liste.join(', ')

function ligneMotDePasse(u) {
  if (u.motDePasse) return ['Mot de passe provisoire', `<code>${echapper(u.motDePasse)}</code>`]
  if (u.motDePassePersonnel) return ['Mot de passe', 'Personnel, déjà choisi par vous']
  return ['Mot de passe provisoire', '<span class="a-remplir"></span>']
}

function ficheUtilisateur(u) {
  const lignes = [
    ['Nom', echapper(u.nom || '—')],
    ['Identifiant (e-mail)', echapper(u.email)],
    ligneMotDePasse(u),
  ]
  if (u.telephone) lignes.push(['Téléphone', echapper(u.telephone)])
  const territoires = (u.territoires_assignes || []).filter(Boolean)
  lignes.push(['Territoire(s)', echapper(abreger(territoires, 12) || u.zone_assignee || 'À définir par l’administrateur')])
  const quartiers = (u.quartiers_assignes || []).filter(Boolean)
  if (quartiers.length) lignes.push(['Quartier(s)', echapper(abreger(quartiers, 12))])
  if (u.role === 'merchandiser') {
    lignes.push(['Commercial responsable', u.commercial
      ? `${echapper(u.commercial.nom || u.commercial.email)}${u.commercial.telephone ? ` · ${echapper(u.commercial.telephone)}` : ''}`
      : 'Non rattaché'])
  }
  if (u.role === 'commercial') {
    const equipe = u.equipe || []
    lignes.push(['Mon équipe', equipe.length
      ? `${equipe.length} merchandiseur(s) : ${equipe.map(m => echapper(m.nom || m.email)).join(', ')}`
      : 'Aucun merchandiseur rattaché pour le moment'])
  }
  return `
    <div class="fiche">
      <h2>Ma fiche de connexion</h2>
      <dl>${lignes.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <p class="fiche__note">${u.motDePassePersonnel
        ? 'Vous avez déjà choisi votre mot de passe. En cas d’oubli, demandez une réinitialisation à votre administrateur.'
        : u.motDePasse
          ? 'À la connexion, l’application vous demandera de remplacer ce mot de passe provisoire par un mot de passe personnel. Ne communiquez votre mot de passe à personne.'
          : 'Votre mot de passe vous est remis par votre administrateur. Ne le communiquez à personne.'}</p>
    </div>`
}

// Planning SSF de la semaine (merchandiser Atom), sur une page à part.
function pageSemaine(u) {
  if (!u?.semaine) return ''
  const lignes = [1, 2, 3, 4, 5, 6].map((jour) => {
    const duJour = u.semaine.filter(l => l.jour_semaine === jour)
    if (!duJour.length) return `<tr><td>${JOURS[jour]}</td><td colspan="4" class="muet">Pas de SSF prévu : portefeuille habituel</td></tr>`
    return duJour.map((l, i) => `<tr>
      <td>${i ? '' : JOURS[jour]}</td>
      <td><strong>${echapper(l.ssf_nom)}</strong>${l.distributeur ? `<br><span class="muet">${echapper(l.distributeur)}</span>` : ''}</td>
      <td>${echapper(l.ssf_telephone || '—')}</td>
      <td>${echapper(l.zone || '—')}</td>
      <td>${echapper(abreger((l.quartiers || []).filter(Boolean), 10) || '—')}</td>
    </tr>`).join('')
  }).join('')
  return `
    <section class="semaine">
      <h2>Ma semaine avec mes SSF</h2>
      <p>Planning au ${dateFr}. Il peut changer : l’application (<span class="ui">Plus</span> → <span class="ui">Ma semaine (SSF)</span>) fait foi.</p>
      <table>
        <thead><tr><th>Jour</th><th>SSF</th><th>Téléphone</th><th>Zone</th><th>Quartiers</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </section>`
}

async function assembler(role, { css, utilisateur = null }) {
  const meta = ROLES[role]
  const brut = await readFile(join(SOURCE, `${meta.source || role}.html`), 'utf8')
  const { html, titres } = numeroterChapitres(brut)
  const logo = pathToFileURL(join(RACINE, 'assets/logo.png')).href
  const sommaire = `
    <div class="sommaire">
      <h2>Sommaire</h2>
      <ol>${titres.map(t => `<li>${t}</li>`).join('')}</ol>
    </div>`

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(meta.titre)}${utilisateur ? ` — ${echapper(utilisateur.nom || utilisateur.email)}` : ''}</title>
<base href="${pathToFileURL(DOCS).href}/">
<style>${css}</style>
</head>
<body>
  <div class="couverture">
    <div class="couverture__bandeau">
      <img class="couverture__logo" src="${logo}" alt="Bonnet Rouge">
      <p class="couverture__surtitre">Perfect Store · Guide de formation</p>
      <h1>${echapper(meta.titre)}</h1>
      <span class="couverture__role">${echapper(meta.libelleRole)}</span>
    </div>
    <div class="couverture__corps">
      <p class="couverture__intro">${meta.intro}</p>
      ${utilisateur ? ficheUtilisateur(utilisateur) : ''}
      ${sommaire}
      <div class="couverture__pied">
        <span>FrieslandCampina · Bonnet Rouge — Côte d’Ivoire</span>
        <span>Application v${VERSION_APP} · édition du ${dateFr}</span>
      </div>
    </div>
  </div>
  <main>${pageSemaine(utilisateur)}${html}</main>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Impression via Chrome DevTools Protocol
// ---------------------------------------------------------------------------
const pause = ms => new Promise(r => setTimeout(r, ms))

async function demarrerChrome() {
  if (!existsSync(CHROME)) throw new Error(`Chrome introuvable : ${CHROME} (définir CHROME_PATH)`)
  const profil = await mkdtemp(join(tmpdir(), 'guides-chrome-'))
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${profil}`, 'about:blank',
  ], { stdio: 'ignore' })

  let port = null
  for (let i = 0; i < 150 && !port; i++) {
    try { port = (await readFile(join(profil, 'DevToolsActivePort'), 'utf8')).split('\n')[0] }
    catch { await pause(100) }
  }
  if (!port) { proc.kill(); throw new Error('Chrome n’a pas ouvert son port de débogage') }

  return {
    port,
    async fermer() {
      proc.kill()
      await pause(300)
      await rm(profil, { recursive: true, force: true }).catch(() => {})
    },
  }
}

async function imprimer(chrome, fichierHtml, fichierPdf, titrePied) {
  const cible = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(cible.webSocketDebuggerUrl)
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko })

  let seq = 0
  const attentes = new Map()
  const evenements = new Map()
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && attentes.has(msg.id)) {
      const { ok, ko } = attentes.get(msg.id)
      attentes.delete(msg.id)
      msg.error ? ko(new Error(msg.error.message)) : ok(msg.result)
    }
    else if (msg.method && evenements.has(msg.method)) {
      evenements.get(msg.method)()
      evenements.delete(msg.method)
    }
  }
  const envoyer = (method, params = {}) => new Promise((ok, ko) => {
    const id = ++seq
    attentes.set(id, { ok, ko })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const attendre = method => new Promise(ok => evenements.set(method, ok))

  await envoyer('Page.enable')
  const charge = attendre('Page.loadEventFired')
  await envoyer('Page.navigate', { url: pathToFileURL(fichierHtml).href })
  await charge
  await envoyer('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true })

  const pied = `<div style="width:100%;font-family:'Nunito Sans',Helvetica,Arial,sans-serif;font-size:7.5pt;color:#687466;padding:0 15mm;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact">
    <span>Bonnet Rouge · ${echapper(titrePied)}</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
  const { data } = await envoyer('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: pied,
  })
  await writeFile(fichierPdf, Buffer.from(data, 'base64'))
  ws.close()
  await fetch(`http://127.0.0.1:${chrome.port}/json/close/${cible.id}`).catch(() => {})
}

// ---------------------------------------------------------------------------
// Utilisateurs (option --utilisateurs)
// ---------------------------------------------------------------------------
async function chargerUtilisateurs({ avecMotsDePasse }) {
  const { config } = await import('dotenv')
  config({ path: join(RACINE, '.env') })
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env pour --utilisateurs')
  }
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, email, role, employeur, telephone, zone_assignee, territoires_assignes, quartiers_assignes, commercial_id, is_active')
    .in('role', ['commercial', 'merchandiser'])
  if (error) throw error

  const actifs = data.filter(u => u.is_active !== false)

  if (avecMotsDePasse) {
    const defaut = process.env.SEED_DEFAULT_PASSWORD
    if (!defaut) throw new Error('SEED_DEFAULT_PASSWORD absent de .env : --avec-mots-de-passe impossible')
    const comptes = new Map()
    for (let page = 1; ; page++) {
      const { data: lot, error: e } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (e) throw e
      for (const c of lot.users) comptes.set(c.id, c)
      if (lot.users.length < 1000) break
    }
    for (const u of actifs) {
      const compte = comptes.get(u.id)
      if (compte?.user_metadata?.must_change_password === true) u.motDePasse = defaut
      else if (compte?.last_sign_in_at) u.motDePassePersonnel = true
    }
  }

  // Merchandisers Atom : planning SSF de la semaine (migration 20261007100000).
  for (const u of actifs.filter(m => m.role === 'merchandiser' && m.employeur === 'atom')) {
    const { data: semaine, error: e } = await supabase.rpc('ssf_semaine', { p_user_id: u.id })
    if (e) console.warn(`   planning SSF indisponible pour ${u.nom || u.email} : ${e.message}`)
    else u.semaine = semaine || []
  }

  const parId = new Map(data.map(u => [u.id, u]))
  for (const u of actifs) {
    if (u.role === 'merchandiser') u.commercial = parId.get(u.commercial_id) || null
    if (u.role === 'commercial') {
      u.equipe = actifs
        .filter(m => m.role === 'merchandiser' && m.commercial_id === u.id)
        .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
    }
  }
  return actifs.sort((a, b) => (a.nom || a.email || '').localeCompare(b.nom || b.email || '', 'fr'))
}

// ---------------------------------------------------------------------------
const avecUtilisateurs = process.argv.includes('--utilisateurs')
const avecMotsDePasse = process.argv.includes('--avec-mots-de-passe')
const css = await feuilleDeStyle()
const travail = await mkdtemp(join(tmpdir(), 'guides-html-'))
const chrome = await demarrerChrome()

try {
  for (const role of Object.keys(ROLES)) {
    const html = join(travail, `${role}.html`)
    await writeFile(html, await assembler(role, { css }))
    const pdf = join(SORTIE, `${ROLES[role].fichier}.pdf`)
    await imprimer(chrome, html, pdf, ROLES[role].titre)
    console.log(`✅ ${pdf.replace(`${RACINE}/`, '')}`)
  }

  if (avecUtilisateurs) {
    const utilisateurs = await chargerUtilisateurs({ avecMotsDePasse })
    console.log(`\n${utilisateurs.length} utilisateur(s) terrain actif(s)`)
    if (avecMotsDePasse) {
      const n = utilisateurs.filter(u => u.motDePasse).length
      console.log(`   mot de passe par défaut imprimé sur ${n} fiche(s) — PDF à remettre à leur seul destinataire`)
    }
    const vus = new Set()
    for (const u of utilisateurs) {
      const dossier = join(SORTIE, 'utilisateurs', u.role === 'commercial' ? 'commerciaux' : 'merchandiseurs')
      await mkdir(dossier, { recursive: true })
      let nom = slug(u.nom || u.email.split('@')[0])
      if (vus.has(`${u.role}/${nom}`)) nom = `${nom}-${slug(u.email.split('@')[0])}`
      vus.add(`${u.role}/${nom}`)
      const role = u.role === 'merchandiser' && u.employeur === 'atom' ? 'merchandiser_atom' : u.role
      const html = join(travail, `${u.id}.html`)
      await writeFile(html, await assembler(role, { css, utilisateur: u }))
      await imprimer(chrome, html, join(dossier, `${nom}.pdf`), `${ROLES[role].titre} — ${u.nom || u.email}`)
      console.log(`  ✅ ${u.role === 'commercial' ? 'commerciaux' : 'merchandiseurs'}/${nom}.pdf${u.motDePasse ? ' (mot de passe)' : ''}`)
    }
  }
}
finally {
  await chrome.fermer()
  await rm(travail, { recursive: true, force: true })
}
