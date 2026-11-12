import fs from 'node:fs';
import path from 'node:path';

// Server-side, build-time only. Reads every .md file in content/skills, text untouched.
export function loadSkills() {
  const dir = path.join(process.cwd(), 'content', 'skills');
  return fs.readdirSync(dir)
    .filter(f => /\.(md|markdown)$/i.test(f))
    .sort((a, b) => a.localeCompare(b))
    .map(file => ({ file, raw: fs.readFileSync(path.join(dir, file), 'utf8') }));
}
