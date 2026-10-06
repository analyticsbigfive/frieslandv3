// utils/markdownSimple.ts
// Rendu HTML minimal des rapports d'import (titres, listes, tableaux, code,
// gras, code en ligne). Tout le texte est échappé AVANT la mise en forme :
// les noms de PDV ou de fichiers ne peuvent pas injecter de HTML.

const echapper = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))

const enLigne = (s: string) => echapper(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

export function markdownVersHtml(md: string): string {
  const lignes = String(md || '').replace(/\r/g, '').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lignes.length) {
    const l = lignes[i]
    if (l.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lignes.length && !lignes[i].startsWith('```')) code.push(lignes[i++])
      i++
      out.push(`<pre><code>${echapper(code.join('\n'))}</code></pre>`)
      continue
    }
    const titre = l.match(/^(#{1,4})\s+(.*)$/)
    if (titre) { out.push(`<h${titre[1].length + 1}>${enLigne(titre[2])}</h${titre[1].length + 1}>`); i++; continue }
    if (l.trim().startsWith('|')) {
      const bloc: string[] = []
      while (i < lignes.length && lignes[i].trim().startsWith('|')) bloc.push(lignes[i++])
      const cellules = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const [entete, ...reste] = bloc
      const corps = reste.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r))
      out.push(`<table><thead><tr>${cellules(entete).map(c => `<th>${enLigne(c)}</th>`).join('')}</tr></thead><tbody>${corps.map(r => `<tr>${cellules(r).map(c => `<td>${enLigne(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    if (/^\s*-\s+/.test(l)) {
      const items: string[] = []
      while (i < lignes.length && /^\s*-\s+/.test(lignes[i])) items.push(lignes[i++].replace(/^\s*-\s+/, ''))
      out.push(`<ul>${items.map(x => `<li>${enLigne(x)}</li>`).join('')}</ul>`)
      continue
    }
    if (!l.trim()) { i++; continue }
    const para: string[] = []
    while (i < lignes.length && lignes[i].trim() && !/^(#{1,4}\s|```|\s*\||\s*-\s)/.test(lignes[i])) para.push(lignes[i++])
    out.push(`<p>${para.map(enLigne).join('<br>')}</p>`)
  }
  return out.join('\n')
}
