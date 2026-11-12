import { marked } from 'marked';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Custom HTML for code blocks and tables. The copy button sits on a non-scrolling wrapper
// so it stays put while long lines scroll. Tables get their own horizontal scroll container.
marked.use({
  renderer: {
    code: code => `<div class="codewrap"><button type="button" class="btn copycode" data-copy="1">Copy code</button><pre><code>${esc(code)}</code></pre></div>`,
    table: (header, body) => `<div class="scroll"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`,
  },
});

/* Split a Markdown file into { name, meta, secs[] }. A new section starts at every # or ## heading.
 * `raw` is returned untouched so "Copy file" gives the exact original text. */
export function parseSkill(id, file, raw, builtin) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/), meta = {};
  let body = raw;
  if (m) {
    body = raw.slice(m[0].length);
    m[1].split(/\r?\n/).forEach(l => { const k = l.match(/^([\w-]+):\s*(.*)$/); if (k) meta[k[1]] = k[2]; });
  }
  const toks = marked.lexer(body), secs = [];
  let c = { title: null, toks: [] };
  toks.forEach(t => {
    if (t.type === 'heading' && t.depth <= 2) {
      if (c.toks.some(x => x.type !== 'space')) secs.push(c);
      c = { title: t.text, toks: [] };
    }
    c.toks.push(t);
  });
  if (c.toks.some(x => x.type !== 'space')) secs.push(c);
  secs.forEach((s, i) => { s.id = `${id}-${i}`.replace(/[^\w-]/g, '_'); s.toks.links = toks.links; s.raw = s.toks.map(t => t.raw).join('').trim(); });
  return { id, file, name: meta.name || file.replace(/\.(md|markdown|txt)$/i, ''), meta, raw, secs, builtin };
}

// Search-result excerpt around the first match, HTML-escaped, matches wrapped in <mark>.
export function snippet(raw, terms) {
  const t = raw.replace(/[#>*`|_\[\]]/g, ' ').replace(/\s+/g, ' '), l = t.toLowerCase();
  let i = -1; for (const w of terms) { i = l.indexOf(w); if (i >= 0) break; }
  if (i < 0) i = 0;
  const s = Math.max(0, i - 50);
  let o = esc(t.slice(s, i + 140));
  terms.forEach(w => { o = o.replace(new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), x => '<mark>' + x + '</mark>'); });
  return (s ? '…' : '') + o;
}
