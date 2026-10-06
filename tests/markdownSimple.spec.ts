import { describe, it, expect } from 'vitest'
import { markdownVersHtml } from '../utils/markdownSimple'

describe('rendu des rapports d’import', () => {
  it('titres, listes, tableaux, code', () => {
    const html = markdownVersHtml('# Titre\n\nTexte **gras** et `code`.\n\n- un\n- deux\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```sql\nselect 1;\n```')
    expect(html).toContain('<h2>Titre</h2>')
    expect(html).toContain('<strong>gras</strong>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<ul><li>un</li><li>deux</li></ul>')
    expect(html).toContain('<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>')
    expect(html).toContain('<pre><code>select 1;</code></pre>')
  })
  it('échappe le HTML venu des fichiers', () => {
    const html = markdownVersHtml('- PDV <img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
