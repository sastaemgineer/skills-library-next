import { marked } from 'marked';
import { isMd, resolveRef } from './paths';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Custom HTML for code blocks and tables. The copy button sits on a non-scrolling wrapper
// so it stays put while long lines scroll. Tables get their own horizontal scroll container.
// Which skill file is being rendered, so references to sibling files can become in-app links.
let ctx = { paths: new Set(), from: '' };
export const setLinkContext = (paths, from) => { ctx = { paths: new Set(paths), from }; };
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

marked.use({
  renderer: {
    // `references/x.md` in inline code and [text](references/x.md) links open that file inside the app.
    // Returning false keeps marked's default rendering for everything else.
    codespan: text => { const r = resolveRef(unesc(text), ctx.from, ctx.paths); return r ? `<code class="ref" data-ref="${esc(r)}" title="Open ${esc(r)}">${text}</code>` : false; },
    link: (href, title, text) => { const r = href && resolveRef(href, ctx.from, ctx.paths); return r ? `<a href="#" class="ref" data-ref="${esc(r)}">${text}</a>` : false; },
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
  let c = { title: null, depth: 0, toks: [] };
  toks.forEach(t => {
    if (t.type === 'heading' && t.depth <= 2) {
      if (c.toks.some(x => x.type !== 'space')) secs.push(c);
      c = { title: t.text, depth: t.depth, toks: [] };
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

/* A skill record { id, label, files:[{path, raw}], skipped } -> parsed skill.
 * files[0] is the main file (SKILL.md, or the only file). Non-Markdown files get one pseudo-section so search can see them. */
export function parseBundle(rec, builtin, rename) {
  const files = rec.files.map(f => {
    const fid = `${rec.id}::${f.path}`, base = f.path.split('/').pop();
    if (isMd(f.path)) {
      const p = parseSkill(fid, f.path, f.raw, builtin);
      return { ...p, path: f.path, kind: 'md', title: (p.secs.find(x => x.depth === 1) || {}).title || base };
    }
    return { id: fid, path: f.path, file: f.path, meta: {}, raw: f.raw, kind: 'text', title: base, builtin,
      secs: [{ id: `${fid}-0`.replace(/[^\w-]/g, '_'), title: base, depth: 0, toks: null, raw: f.raw }] };
  });
  const main = files[0];
  return { id: rec.id, label: rec.label, name: rename || main.meta.name || rec.label.replace(/\.(md|markdown|txt)$/i, ''),
    files, main, bundle: files.length > 1, skipped: rec.skipped || 0, builtin };
}
