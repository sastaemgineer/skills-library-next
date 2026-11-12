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

Everything in `content/skills/` is picked up automatically at build time. There is no list to edit.

```
content/skills/
  my-note.md                  single-file skill
  my-skill/                   folder skill: needs a SKILL.md at its root
    SKILL.md
    references/overview.md    any depth, any number of files
    scripts/run.py            text files (.py .sh .json .yaml ...) show in raw view
```

- Sidebar title: `name:` in `SKILL.md` frontmatter, else the file or folder name.
- Folder skills show as an expandable tree. `SKILL.md` comes first, the rest alphabetical.
- `references/x.md` written in inline code or as a link opens that file in the app.
- Binary files (images etc.) in a skill folder are not shown; the skill page says how many were skipped.
- Every file has a URL: `#/skill-id/path/to/file.md`. Back/forward and shared links work.

Visitors can also use **Import files** (.md, .zip), **Import folder**, or **Paste Markdown**. A folder or zip containing `SKILL.md` becomes one skill. These are stored in that browser's `localStorage` only (about 5 MB limit) and are not written into the project.

## Copying

| Action | Result |
|---|---|
| Copy file | the exact text of the open file |
| Copy section | one `#` / `##` block |
| Copy skill | every file of the skill in one Markdown document, each introduced by `<!-- FILE: path -->` |
| Download .zip | the real folder structure; the only way to move a whole skill back out |

## Structure

```
app/layout.js, page.js, globals.css   shell, server page that loads the files, styles
components/Library.jsx                 the whole UI (client component)
lib/skills.js                         build-time reader: files and skill folders (server only)
lib/paths.js                          path helpers, reference-link resolution, folder/zip grouping
lib/markdown.js                       parser, section splitter, search snippets, code/table HTML
content/skills/                       YOUR SKILLS (files or folders)
next.config.mjs                       output: 'export' (static)
```

## Deploy

Run `npm run build` and upload `out/` to GitHub Pages, Netlify, Cloudflare Pages, S3, or any static host. For a sub-path (e.g. GitHub Pages at `/repo`), add `basePath: '/repo'` in `next.config.mjs`.

## Scaling

- Dozens of files: nothing to change. All files are bundled into the page.
- Hundreds of files, or large ones: the page HTML grows with the content and search scans it all in the browser. Move to one route per file (`app/skills/[slug]/page.js` with `generateStaticParams`) and a build-time search index.
- Do not remove `output: 'export'` unless you want a Node server. It would change the "frontend-only" guarantee.
