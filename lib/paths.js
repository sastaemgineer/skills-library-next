// Pure path helpers shared by the server loader and the browser importer.
const MD = /\.(md|markdown)$/i;
// Files shown in the UI. Anything else (images, binaries) is skipped and counted.
const TEXT = /\.(md|markdown|txt|py|sh|js|mjs|cjs|ts|tsx|jsx|json|ya?ml|toml|csv|html|css|sql|rb|go|rs|ini|cfg)$/i;
export const isMd = p => MD.test(p);
export const isText = p => TEXT.test(p);
export const isMain = p => /^skill\.md$/i.test(p);

// SKILL.md first, then everything else alphabetically by path (keeps folders grouped).
export const orderFiles = files =>
  files.slice().sort((a, b) => (isMain(b.path) - isMain(a.path)) || a.path.localeCompare(b.path));

const norm = p => { const o = []; for (const s of p.split('/')) { if (s === '..') o.pop(); else if (s && s !== '.') o.push(s); } return o.join('/'); };

// Turn a reference found in Markdown ("references/x.md", "../SKILL.md#top") into a path inside the skill, or null.
export function resolveRef(ref, fromPath, paths) {
  ref = String(ref).split('#')[0].trim();
  if (!ref || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(ref)) return null;
  const dir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : '';
  for (const c of [norm(dir + ref), norm(ref)]) if (paths.has(c)) return c;
  return null;
}

/* Group loose files (from a folder pick or a zip) into skills.
 * A folder containing SKILL.md is one skill (outermost wins); every other .md becomes a single-file skill. */
export function groupBundles(entries, fallbackLabel) {
  entries = entries.map(e => ({ ...e, path: e.path.replace(/\\/g, '/').replace(/^\.\//, '') }));
  const dirs = entries.filter(e => /(^|\/)skill\.md$/i.test(e.path)).map(e => e.path.slice(0, -8));
  const roots = dirs.filter(d => !dirs.some(o => o !== d && d.startsWith(o)));
  const used = new Set(), out = [];
  roots.forEach(d => {
    const files = entries.filter(e => e.path.startsWith(d)).map(e => { used.add(e); return { path: e.path.slice(d.length), raw: e.raw }; });
    out.push({ label: d ? d.replace(/\/$/, '').split('/').pop() : (fallbackLabel || 'skill'), files: orderFiles(files) });
  });
  entries.filter(e => !used.has(e) && isMd(e.path)).forEach(e => {
    const n = e.path.split('/').pop(); out.push({ label: n, files: [{ path: n, raw: e.raw }] });
  });
  return out;
}
