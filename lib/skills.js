import fs from 'node:fs';
import path from 'node:path';
import { isMd, isText, orderFiles } from './paths';

/* Build-time only. Reads content/skills and returns one record per skill:
 *   content/skills/foo.md          -> single-file skill
 *   content/skills/foo/SKILL.md    -> folder skill; every text file inside it (any depth) belongs to it
 * Binary files inside a folder skill are not read; they are only counted in `skipped`. */
function walk(dir, rel, files, counter) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    if (e.isDirectory()) walk(path.join(dir, e.name), rel + e.name + '/', files, counter);
    else if (isText(e.name)) files.push({ path: rel + e.name, raw: fs.readFileSync(path.join(dir, e.name), 'utf8') });
    else counter.n++;
  }
}

export function loadSkills() {
  const root = path.join(process.cwd(), 'content', 'skills');
  const slug = s => s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  const out = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue;
    if (e.isFile() && isMd(e.name)) {
      out.push({ id: slug(e.name.replace(/\.\w+$/, '')), label: e.name, skipped: 0, files: [{ path: e.name, raw: fs.readFileSync(path.join(root, e.name), 'utf8') }] });
    } else if (e.isDirectory()) {
      const files = [], counter = { n: 0 };
      walk(path.join(root, e.name), '', files, counter);
      if (files.some(f => isMd(f.path))) out.push({ id: slug(e.name), label: e.name, skipped: counter.n, files: orderFiles(files) });
    }
  }
  return out;
}
