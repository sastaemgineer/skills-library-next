# Skills Library (Next.js)

Browse, search, sort and copy `SKILL.md`-style Markdown files. Static export: no backend, database or API.

## Run

```bash
npm install
npm run dev        # http://localhost:3000, hot reload
npm run build      # writes the static site to ./out
npm start          # serves ./out on http://localhost:3000
```

Needs Node 18.17+. An internet connection is needed for Google Fonts.

## Add a skill

Drop a `.md` file into `content/skills/`. That is the whole step: every `.md` file in the folder is picked up automatically at build time (see `app/page.js` and `lib/skills.js`). In `npm run dev` it appears after a refresh. For a deployed site, rebuild.

- Sidebar title: `name:` in the file's frontmatter, else the file name.
- Sidebar order ("Added order"): alphabetical by file name. Prefix with `01-`, `02-` to control it.
- A section is each `#` / `##` block; that is what "Copy section" copies.

Visitors can also import or paste files in the browser. Those are stored in their own `localStorage` only and are not written into the project.

## Structure

```
app/layout.js, page.js, globals.css   shell, server page that loads the files, styles
components/Library.jsx                 the whole UI (client component)
lib/skills.js                         build-time folder reader (server only)
lib/markdown.js                       parser, section splitter, search snippets, code/table HTML
content/skills/*.md                   YOUR SKILLS
next.config.mjs                       output: 'export' (static)
```

## Deploy

Run `npm run build` and upload `out/` to GitHub Pages, Netlify, Cloudflare Pages, S3, or any static host. For a sub-path (e.g. GitHub Pages at `/repo`), add `basePath: '/repo'` in `next.config.mjs`.

## Scaling

- Dozens of files: nothing to change. All files are bundled into the page.
- Hundreds of files, or large ones: the page HTML grows with the content and search scans it all in the browser. Move to one route per file (`app/skills/[slug]/page.js` with `generateStaticParams`) and a build-time search index.
- Do not remove `output: 'export'` unless you want a Node server. It would change the "frontend-only" guarantee.
