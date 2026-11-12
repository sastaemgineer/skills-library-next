'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { parseBundle, setLinkContext, snippet } from '../lib/markdown';
import { groupBundles, isText } from '../lib/paths';

if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', n => {
    if (n.tagName === 'A' && !n.hasAttribute('data-ref')) { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
  });
}

const KEY = 'skills-lib-next-v2', SORT = 'skills-lib-next-sort';
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};
const hashFor = (sid, path) => '#/' + [sid, ...path.split('/')].map(encodeURIComponent).join('/');
const parseHash = h => {
  const p = h.replace(/^#\/?/, '').split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch { return s; } });
  return { sid: p[0] || '', path: p.slice(1).join('/') };
};
const junk = p => /(^|\/)(__MACOSX|\.git|node_modules)\//.test(p) || /(^|\/)\.DS_Store$/.test(p);

/* initialSkills = skills read from content/skills at build time (app/page.js).
 * Skills the visitor imports live in localStorage. A skill is a bundle of files: SKILL.md first, then the rest. */
export default function Library({ initialSkills }) {
  const builtin = useMemo(() => initialSkills.map(r => parseBundle(r, true)), [initialSkills]);
  const [recs, setRecs] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState('');
  const [mode, setMode] = useState('rendered');
  const [sortBy, setSortBy] = useState('added');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [confirmRm, setConfirmRm] = useState(false);
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState('');
  const [nav, setNav] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pn, setPn] = useState('');
  const [pt, setPt] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const mainRef = useRef(null), dlgRef = useRef(null), pickRef = useRef(null), dirRef = useRef(null), qRef = useRef(null);
  const targetRef = useRef(null), toastT = useRef(null), seq = useRef(0), ingestRef = useRef(null);

  const flash = t => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 2200); };

  // Browser-only state is restored after mount so server and client HTML match.
  useEffect(() => {
    try { setRecs(JSON.parse(ls.get(KEY) || '[]')); } catch {}
    setSortBy(ls.get(SORT) || 'added');
    const r = () => setRoute(location.hash);
    r(); addEventListener('hashchange', r); setMounted(true);
    return () => removeEventListener('hashchange', r);
  }, []);
  useEffect(() => { if (mounted && !ls.set(KEY, JSON.stringify(recs))) flash('Browser storage is full: imported skills will be lost on reload.'); }, [recs, mounted]);

  const imported = useMemo(() => recs.map(r => parseBundle(r, false, r.rename)), [recs]);
  const skills = useMemo(() => [...builtin, ...imported], [builtin, imported]);
  const list = useMemo(() => {
    const a = skills.slice(), c = (x, y) => x.name.localeCompare(y.name, undefined, { numeric: true, sensitivity: 'base' });
    if (sortBy === 'az') a.sort(c);
    if (sortBy === 'za') a.sort((x, y) => c(y, x));
    return a;
  }, [skills, sortBy]);

  const { sid, path } = useMemo(() => parseHash(route), [route]);
  const skill = skills.find(s => s.id === sid) || skills[0] || null;
  const file = skill ? skill.files.find(f => f.path === path) || skill.files[0] : null;
  const isMain = !!skill && file === skill.main;

  useEffect(() => {
    if (skill && skill.bundle) setExpanded(p => (p.has(skill.id) ? p : new Set(p).add(skill.id)));
  }, [skill?.id, skill?.bundle]);

  const html = useMemo(() => {
    if (!mounted || !file || file.kind !== 'md' || mode !== 'rendered') return [];
    setLinkContext(skill.files.map(x => x.path), file.path);
    return file.secs.map(s => DOMPurify.sanitize(marked.parser(s.toks)));
  }, [mounted, skill, file, mode]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    const terms = term.split(/\s+/), out = [];
    skills.forEach(sk => sk.files.forEach(fl => fl.secs.forEach(s => {
      const fh = (sk.name + ' ' + fl.path + ' ' + Object.values(fl.meta).join(' ')).toLowerCase();
      const sh = (s.title || '').toLowerCase(), body = s.raw.toLowerCase();
      if (!terms.every(w => fh.includes(w) || sh.includes(w) || body.includes(w))) return;
      out.push({ sk, fl, s, terms, score: terms.reduce((a, w) => a + (sh.includes(w) ? 3 : 0) + (fh.includes(w) ? 2 : 0) + (body.includes(w) ? 1 : 0), 0) });
    })));
    return out.sort((a, b) => b.score - a.score).slice(0, 60);
  }, [q, skills]);

  /* Navigation: the URL hash is the source of truth (#/skill-id/path/to/file.md), so back/forward and shared links work. */
  function go(sk, p, secId) {
    targetRef.current = secId || null;
    if (secId) setMode('rendered');
    setQ(''); setConfirmRm(false); setOpen(false); setNav(n => n + 1);
    const h = hashFor(sk.id, p);
    setRoute(h); if (location.hash !== h) location.hash = h;
  }
  useEffect(() => {
    const t = targetRef.current; targetRef.current = null;
    const e = t && document.getElementById(t);
    if (e) { e.scrollIntoView({ block: 'start' }); e.classList.add('flash'); }
    else if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [file?.id, mode, nav]);

  async function copy(text, key, label) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch {}
      a.remove(); if (!ok) { flash('Copy failed. Select the text and copy it manually.'); return false; }
    }
    if (key) { setCopied(key); setTimeout(() => setCopied(k => (k === key ? '' : k)), 1600); }
    flash((label || 'Markdown') + ' copied');
    return true;
  }

  // Whole skill as one Markdown document; each file is introduced by an HTML comment carrying its path.
  const skillText = sk => sk.files.map(f => `<!-- FILE: ${f.path} -->\n${f.raw}`).join('\n\n');
  async function downloadZip(sk) {
    const JSZip = (await import('jszip')).default, z = new JSZip();
    sk.files.forEach(f => z.file(sk.label + '/' + f.path, f.raw));
    const a = document.createElement('a'); a.href = URL.createObjectURL(await z.generateAsync({ type: 'blob' })); a.download = sk.label + '.zip';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* Import: .md/.txt files, .zip archives and whole folders. A folder or zip that contains SKILL.md becomes one skill. */
  function addRecords(newRecs, skipped) {
    if (!newRecs.length) { flash('Nothing to import. Use “Import folder” for folders, or pick .md / .zip files.'); return; }
    const names = new Set(skills.map(s => s.name.toLowerCase()));
    const made = newRecs.map(r => {
      const rec = { ...r, id: 'i-' + Date.now().toString(36) + '-' + seq.current++ };
      const p = parseBundle(rec, false);
      let nm = p.name, n = 2;
      while (names.has(nm.toLowerCase())) nm = `${p.name} (${n++})`;
      names.add(nm.toLowerCase());
      if (nm !== p.name) rec.rename = nm;
      return rec;
    });
    made[0].skipped = (made[0].skipped || 0) + skipped;
    setRecs(r => [...r, ...made]); setMode('rendered'); setQ('');
    const h = hashFor(made[0].id, made[0].files[0].path); setRoute(h); location.hash = h;
    flash(made.length + (made.length === 1 ? ' skill imported' : ' skills imported') + (skipped ? ` · ${skipped} non-text files skipped` : ''));
  }
  async function ingest(list) {
    const recsOut = [], folder = []; let skipped = 0;
    for (const f of [...list]) {
      try {
        if (/\.zip$/i.test(f.name)) {
          const z = await (await import('jszip')).default.loadAsync(f), ents = [];
          for (const [p, e] of Object.entries(z.files)) {
            if (e.dir || junk(p)) continue;
            if (!isText(p)) { skipped++; continue; }
            ents.push({ path: p, raw: await e.async('string') });
          }
          recsOut.push(...groupBundles(ents, f.name.replace(/\.zip$/i, '')));
        } else if (f.webkitRelativePath) {
          if (junk(f.webkitRelativePath)) continue;
          if (!isText(f.webkitRelativePath)) { skipped++; continue; }
          folder.push({ path: f.webkitRelativePath, raw: await f.text() });
        } else if (/\.(md|markdown|txt)$/i.test(f.name)) {
          recsOut.push({ label: f.name, files: [{ path: f.name, raw: await f.text() }] });
        }
      } catch { flash('Could not read ' + f.name); }
    }
    if (folder.length) recsOut.push(...groupBundles(folder, ''));
    addRecords(recsOut, skipped);
  }
  ingestRef.current = ingest;

  useEffect(() => {
    let dc = 0;
    const en = e => { e.preventDefault(); dc++; setDragging(true); };
    const lv = () => { if (--dc <= 0) { dc = 0; setDragging(false); } };
    const ov = e => e.preventDefault();
    const dp = e => { e.preventDefault(); dc = 0; setDragging(false); ingestRef.current([...e.dataTransfer.files]); };
    addEventListener('dragenter', en); addEventListener('dragleave', lv); addEventListener('dragover', ov); addEventListener('drop', dp);
    return () => { removeEventListener('dragenter', en); removeEventListener('dragleave', lv); removeEventListener('dragover', ov); removeEventListener('drop', dp); };
  }, []);
  useEffect(() => {
    const k = e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); setOpen(true); qRef.current?.focus(); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);

  // Delegated clicks inside rendered Markdown: code-block copy buttons and in-app file references.
  function onMdClick(e) {
    const r = e.target.closest('[data-ref]');
    if (r) { e.preventDefault(); go(skill, r.dataset.ref); return; }
    const b = e.target.closest('[data-copy]');
    if (b) copy(b.parentElement.querySelector('pre').textContent, null, 'Code').then(ok => { if (ok) { b.textContent = 'Copied ✓'; setTimeout(() => (b.textContent = 'Copy code'), 1600); } });
  }
  const toggle = id => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const parts = file ? file.path.split('/') : [];
  const meta = skill && isMain ? Object.entries(file.meta).filter(([k]) => k !== 'name' && k !== 'description') : [];
  const rawOnly = file && (file.kind === 'text' || mode === 'raw');

  return (
    <div className="app">
      <aside id="side" className={open ? 'open' : ''}>
        <div className="brand">Skills Library<small>{skills.length} {skills.length === 1 ? 'skill' : 'skills'}</small></div>
        <div className="search">
          <input ref={qRef} type="search" value={q} placeholder="Search name, title or content" aria-label="Search all skills"
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Escape' && setQ('')} />
        </div>
        <div className="acts">
          <button className="btn pri" onClick={() => pickRef.current.click()}>Import files</button>
          <button className="btn" onClick={() => dirRef.current.click()}>Import folder</button>
          <button className="btn" onClick={() => { setPn(''); setPt(''); dlgRef.current.showModal(); }}>Paste Markdown</button>
        </div>
        <div className="sortrow">
          <label htmlFor="sort">Sort</label>
          <select id="sort" value={sortBy} onChange={e => { setSortBy(e.target.value); ls.set(SORT, e.target.value); }}>
            <option value="added">Added order</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option>
          </select>
        </div>
        <nav aria-label="Skills">
          {list.map(s => {
            const on = skill && s.id === skill.id, isOpen = expanded.has(s.id);
            if (!s.bundle) return (
              <button key={s.id} className="item" aria-current={!!on} onClick={() => go(s, s.main.path)}>
                <b>{s.name}</b><span>{s.main.path} · {s.main.secs.length} sections</span>
              </button>
            );
            let lastDir = '';
            return (
              <div key={s.id}>
                <div className="tree-head">
                  <button className="chev" aria-expanded={isOpen} aria-label={(isOpen ? 'Collapse ' : 'Expand ') + s.name} onClick={() => toggle(s.id)}>{isOpen ? '▾' : '▸'}</button>
                  <button className="item" aria-current={!!on} onClick={() => { go(s, s.main.path); setExpanded(p => new Set(p).add(s.id)); }}>
                    <b>{s.name}</b><span>{s.files.length} files</span>
                  </button>
                </div>
                {isOpen && (
                  <div className="tree">
                    {s.files.map(f => {
                      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1) : '', head = dir !== lastDir ? dir : null;
                      lastDir = dir;
                      return (
                        <div key={f.id}>
                          {head && <div className="treedir">{head}</div>}
                          <button className="item" title={f.title} aria-current={!!(on && file === f)} onClick={() => go(s, f.path)}>
                            <b>{f.path.split('/').pop()}</b>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {!list.length && <p className="empty" style={{ margin: 16 }}>No skills yet.</p>}
        </nav>
      </aside>

      <main id="main" ref={mainRef}>
        <div className="top"><button className="btn" onClick={() => setOpen(o => !o)} aria-label="Show skill list">Skills</button><b>{skill ? skill.name : 'Skills Library'}</b></div>
        <div className="wrap">
          {results ? (
            <>
              <div className="head"><h1>{results.length} {results.length === 1 ? 'match' : 'matches'}</h1><span className="file">for “{q.trim()}”</span></div>
              {results.length ? results.map(r => (
                <button key={r.s.id} className="res" onClick={() => go(r.sk, r.fl.path, r.s.id)}>
                  <b>{r.s.title || 'Introduction'}</b><small>{r.sk.name}{r.sk.bundle ? ' › ' + r.fl.path : ''}</small>
                  <p dangerouslySetInnerHTML={{ __html: snippet(r.s.raw, r.terms) }} />
                </button>
              )) : <p className="empty">Nothing matches. Try fewer or shorter words.</p>}
            </>
          ) : !file ? (
            <p className="empty">Add a .md file or a skill folder to <code>content/skills</code>, or use “Import files” / “Import folder”, or paste Markdown.</p>
          ) : (
            <>
              <div className="head">
                {skill.bundle && (
                  <p className="crumbs">
                    <button onClick={() => go(skill, skill.main.path)}>{skill.name}</button>
                    {parts.map((p, i) => <span key={i}> › {i === parts.length - 1 ? p : p + '/'}</span>)}
                  </p>
                )}
                <div className="titlerow">
                  <h1>{isMain ? skill.name : file.title}</h1>
                  <div className="bar">
                    {file.kind === 'md' && (
                      <div className="seg" role="group" aria-label="View mode">
                        <button className="btn" aria-pressed={mode === 'rendered'} onClick={() => setMode('rendered')}>Rendered</button>
                        <button className="btn" aria-pressed={mode === 'raw'} onClick={() => setMode('raw')}>Raw</button>
                      </div>
                    )}
                    <button className="btn pri" onClick={() => copy(file.raw, 'file', 'File')}>{copied === 'file' ? 'Copied ✓' : 'Copy file'}</button>
                    {skill.bundle && <button className="btn" onClick={() => copy(skillText(skill), 'skill', 'Skill (' + skill.files.length + ' files)')}>{copied === 'skill' ? 'Copied ✓' : 'Copy skill'}</button>}
                    {skill.bundle && <button className="btn" onClick={() => downloadZip(skill)}>Download .zip</button>}
                    {!skill.builtin && (confirmRm ? (
                      <span>
                        <button className="btn danger" onClick={() => {
                          setRecs(r => r.filter(d => d.id !== skill.id)); setRoute(''); history.replaceState(null, '', location.pathname + location.search);
                          setConfirmRm(false); flash('Removed ' + skill.name);
                        }}>Remove skill</button>{' '}
                        <button className="btn" onClick={() => setConfirmRm(false)}>Cancel</button>
                      </span>
                    ) : <button className="btn" onClick={() => setConfirmRm(true)}>Remove</button>)}
                  </div>
                </div>
                <span className="file">{file.path}</span>
                {isMain && file.meta.description && <p className="lead">{file.meta.description}</p>}
                {meta.length > 0 && <p className="meta">{meta.map(([k, v]) => <span key={k}><b>{k}</b> {v}&ensp;</span>)}</p>}
                {isMain && skill.skipped > 0 && <p className="skipnote">{skill.skipped} non-text {skill.skipped === 1 ? 'file is' : 'files are'} part of this skill but not shown.</p>}
              </div>
              {rawOnly ? (
                <section className="sk"><pre className="rawview">{file.raw}</pre></section>
              ) : mounted && file.secs.map((s, i) => (
                <section className="sk" id={s.id} key={s.id}>
                  <button className="btn cs" onClick={() => copy(s.raw, s.id, 'Section')}>{copied === s.id ? 'Copied ✓' : 'Copy section'}</button>
                  <div className="md" onClick={onMdClick} dangerouslySetInnerHTML={{ __html: html[i] || '' }} />
                </section>
              ))}
            </>
          )}
        </div>
      </main>

      <input ref={pickRef} type="file" accept=".md,.markdown,.txt,.zip,text/markdown,text/plain,application/zip" multiple hidden
        onChange={e => { ingest(e.target.files); e.target.value = ''; }} />
      <input ref={dirRef} type="file" multiple hidden {...{ webkitdirectory: '', directory: '' }}
        onChange={e => { ingest(e.target.files); e.target.value = ''; }} />
      <dialog ref={dlgRef}>
        <form method="dialog">
          <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Paste Markdown</h2>
          <label htmlFor="pn">File name</label><input id="pn" value={pn} onChange={e => setPn(e.target.value)} placeholder="my-skill.md" />
          <label htmlFor="pt">Content</label><textarea id="pt" value={pt} onChange={e => setPt(e.target.value)} placeholder={'---\nname: my-skill\ndescription: …\n---'} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn" value="x">Cancel</button>
            <button type="button" className="btn pri" onClick={() => {
              if (!pt.trim()) { flash('Paste some Markdown first'); return; }
              let n = pn.trim() || 'pasted-skill.md'; if (!/\.\w+$/.test(n)) n += '.md';
              addRecords([{ label: n, files: [{ path: n, raw: pt }] }], 0); dlgRef.current.close();
            }}>Add skill</button>
          </div>
        </form>
      </dialog>
      <div className={'drop' + (dragging ? ' on' : '')}>Drop .md or .zip files to import them</div>
      <div className={'toast' + (toast ? ' on' : '')} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
