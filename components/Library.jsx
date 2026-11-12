'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { parseSkill, snippet } from '../lib/markdown';

// Make every link in rendered Markdown open in a new tab (browser only).
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', n => {
    if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
  });
}

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

/* initialFiles = the .md files in content/skills, read at build time by app/page.js.
 * Files the visitor imports in the browser are kept separately in localStorage. */
export default function Library({ initialFiles }) {
  const builtin = useMemo(() => initialFiles.map(f => parseSkill('c:' + f.file, f.file, f.raw, true)), [initialFiles]);
  const [importedRaw, setImportedRaw] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [cur, setCur] = useState(builtin[0]?.id ?? null);
  const [mode, setMode] = useState('rendered');
  const [sortBy, setSortBy] = useState('added');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [confirmRm, setConfirmRm] = useState(false);
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState('');
  const [target, setTarget] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [pn, setPn] = useState('');
  const [pt, setPt] = useState('');
  const mainRef = useRef(null), dlgRef = useRef(null), pickRef = useRef(null), qRef = useRef(null), seq = useRef(0);

  // Browser-only state (localStorage) is restored after mount so server and client HTML match.
  useEffect(() => {
    try { setImportedRaw(JSON.parse(ls.get('skills-lib-next-v1') || '[]')); } catch {}
    setSortBy(ls.get('skills-lib-next-sort') || 'added');
    setMounted(true);
  }, []);
  useEffect(() => { if (mounted) ls.set('skills-lib-next-v1', JSON.stringify(importedRaw)); }, [importedRaw, mounted]);

  const imported = useMemo(() => importedRaw.map(d => parseSkill(d.id, d.name, d.raw, false)), [importedRaw]);
  const files = useMemo(() => [...builtin, ...imported], [builtin, imported]);
  const list = useMemo(() => {
    const a = files.slice(), c = (x, y) => x.name.localeCompare(y.name, undefined, { numeric: true, sensitivity: 'base' });
    if (sortBy === 'az') a.sort(c);
    if (sortBy === 'za') a.sort((x, y) => c(y, x));
    return a;
  }, [files, sortBy]);
  const f = files.find(x => x.id === cur) || null;

  const html = useMemo(
    () => (mounted && f && mode === 'rendered' ? f.secs.map(s => DOMPurify.sanitize(marked.parser(s.toks))) : []),
    [mounted, f, mode]
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    const terms = term.split(/\s+/), out = [];
    files.forEach(file => file.secs.forEach(s => {
      const fh = (file.name + ' ' + file.file + ' ' + Object.values(file.meta).join(' ')).toLowerCase();
      const sh = (s.title || '').toLowerCase(), body = s.raw.toLowerCase();
      if (!terms.every(w => fh.includes(w) || sh.includes(w) || body.includes(w))) return;
      out.push({ file, s, terms, score: terms.reduce((a, w) => a + (sh.includes(w) ? 3 : 0) + (fh.includes(w) ? 2 : 0) + (body.includes(w) ? 1 : 0), 0) });
    }));
    return out.sort((a, b) => b.score - a.score).slice(0, 60);
  }, [q, files]);

  const flash = t => { setToast(t); clearTimeout(flash.t); flash.t = setTimeout(() => setToast(''), 1800); };

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

  const select = id => { setCur(id); setQ(''); setConfirmRm(false); setOpen(false); };

  // Scroll to a section after a search result is opened.
  useEffect(() => {
    if (target) {
      const e = document.getElementById(target);
      if (e) { e.scrollIntoView({ block: 'start' }); e.classList.add('flash'); }
      setTarget(null);
    } else if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [cur, mode, target]);

  const addRaw = useCallback((name, raw) => {
    const id = 'i:' + Date.now() + '-' + seq.current++;
    setImportedRaw(r => [...r, { id, name, raw }]);
    setCur(id); setMode('rendered'); setQ('');
  }, []);

  const ingest = useCallback(async list => {
    let n = 0;
    for (const file of list) {
      if (!/\.(md|markdown|txt)$/i.test(file.name) && !(file.type || '').startsWith('text/')) continue;
      try { addRaw(file.name, await file.text()); n++; } catch { flash('Could not read ' + file.name); }
    }
    flash(n ? n + (n === 1 ? ' file imported' : ' files imported') : 'Only Markdown or text files can be imported');
  }, [addRaw]);

  // Drag and drop anywhere on the page.
  useEffect(() => {
    let dc = 0;
    const en = e => { e.preventDefault(); dc++; setDragging(true); };
    const lv = () => { if (--dc <= 0) { dc = 0; setDragging(false); } };
    const ov = e => e.preventDefault();
    const dp = e => { e.preventDefault(); dc = 0; setDragging(false); ingest([...e.dataTransfer.files]); };
    addEventListener('dragenter', en); addEventListener('dragleave', lv); addEventListener('dragover', ov); addEventListener('drop', dp);
    return () => { removeEventListener('dragenter', en); removeEventListener('dragleave', lv); removeEventListener('dragover', ov); removeEventListener('drop', dp); };
  }, [ingest]);

  // "/" focuses the search box.
  useEffect(() => {
    const k = e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); setOpen(true); qRef.current?.focus(); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  // Copy buttons inside rendered Markdown (code blocks) are plain HTML, so one delegated handler serves them all.
  function onMdClick(e) {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    copy(b.parentElement.querySelector('pre').textContent, null, 'Code').then(ok => {
      if (ok) { b.textContent = 'Copied ✓'; setTimeout(() => (b.textContent = 'Copy code'), 1600); }
    });
  }

  const meta = f ? Object.entries(f.meta).filter(([k]) => k !== 'name' && k !== 'description') : [];

  return (
    <div className="app">
      <aside id="side" className={open ? 'open' : ''}>
        <div className="brand">Skills Library<small>{files.length} {files.length === 1 ? 'file' : 'files'}</small></div>
        <div className="search">
          <input ref={qRef} type="search" value={q} placeholder="Search name, title or content" aria-label="Search all skills"
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Escape' && setQ('')} />
        </div>
        <div className="acts">
          <button className="btn pri" onClick={() => pickRef.current.click()}>Import .md</button>
          <button className="btn" onClick={() => { setPn(''); setPt(''); dlgRef.current.showModal(); }}>Paste Markdown</button>
        </div>
        <div className="sortrow">
          <label htmlFor="sort">Sort</label>
          <select id="sort" value={sortBy} onChange={e => { setSortBy(e.target.value); ls.set('skills-lib-next-sort', e.target.value); }}>
            <option value="added">Added order</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option>
          </select>
        </div>
        <nav aria-label="Skill files">
          {list.map(x => (
            <button key={x.id} className="item" aria-current={x.id === cur} onClick={() => select(x.id)}>
              <b>{x.name}</b><span>{x.file} · {x.secs.length} sections</span>
            </button>
          ))}
          {!list.length && <p className="empty" style={{ margin: 16 }}>No files yet.</p>}
        </nav>
      </aside>

      <main id="main" ref={mainRef}>
        <div className="top"><button className="btn" onClick={() => setOpen(o => !o)} aria-label="Show file list">Files</button><b>{f ? f.name : 'Skills Library'}</b></div>
        <div className="wrap">
          {results ? (
            <>
              <div className="head"><h1>{results.length} {results.length === 1 ? 'match' : 'matches'}</h1><span className="file">for “{q.trim()}”</span></div>
              {results.length ? results.map(r => (
                <button key={r.s.id} className="res" onClick={() => { setQ(''); setCur(r.file.id); setMode('rendered'); setTarget(r.s.id); setOpen(false); }}>
                  <b>{r.s.title || 'Introduction'}</b><small>{r.file.name}</small>
                  <p dangerouslySetInnerHTML={{ __html: snippet(r.s.raw, r.terms) }} />
                </button>
              )) : <p className="empty">Nothing matches. Try fewer or shorter words.</p>}
            </>
          ) : !f ? (
            <p className="empty">Add a Markdown file to <code>content/skills</code>, or use “Import .md”, drop a file on this page, or paste its content.</p>
          ) : (
            <>
              <div className="head">
                <div className="titlerow">
                  <h1>{f.name}</h1>
                  <div className="bar">
                    <div className="seg" role="group" aria-label="View mode">
                      <button className="btn" aria-pressed={mode === 'rendered'} onClick={() => setMode('rendered')}>Rendered</button>
                      <button className="btn" aria-pressed={mode === 'raw'} onClick={() => setMode('raw')}>Raw</button>
                    </div>
                    <button className="btn pri" onClick={() => copy(f.raw, 'file', 'File')}>{copied === 'file' ? 'Copied ✓' : 'Copy file'}</button>
                    {!f.builtin && (confirmRm ? (
                      <span>
                        <button className="btn danger" onClick={() => {
                          setImportedRaw(r => r.filter(d => d.id !== f.id)); setCur(builtin[0]?.id ?? null); setConfirmRm(false); flash('Removed ' + f.file);
                        }}>Remove file</button>{' '}
                        <button className="btn" onClick={() => setConfirmRm(false)}>Cancel</button>
                      </span>
                    ) : <button className="btn" onClick={() => setConfirmRm(true)}>Remove</button>)}
                  </div>
                </div>
                <span className="file">{f.file}</span>
                {f.meta.description && <p className="lead">{f.meta.description}</p>}
                {meta.length > 0 && <p className="meta">{meta.map(([k, v]) => <span key={k}><b>{k}</b> {v}&ensp;</span>)}</p>}
              </div>
              {mode === 'raw' ? (
                <section className="sk"><pre className="rawview">{f.raw}</pre></section>
              ) : mounted && f.secs.map((s, i) => (
                <section className="sk" id={s.id} key={s.id}>
                  <button className="btn cs" onClick={() => copy(s.raw, s.id, 'Section')}>{copied === s.id ? 'Copied ✓' : 'Copy section'}</button>
                  <div className="md" onClick={onMdClick} dangerouslySetInnerHTML={{ __html: html[i] || '' }} />
                </section>
              ))}
            </>
          )}
        </div>
      </main>

      <input ref={pickRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden
        onChange={e => { ingest([...e.target.files]); e.target.value = ''; }} />
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
              addRaw(n, pt); dlgRef.current.close();
            }}>Add skill</button>
          </div>
        </form>
      </dialog>
      <div className={'drop' + (dragging ? ' on' : '')}>Drop Markdown files to import them</div>
      <div className={'toast' + (toast ? ' on' : '')} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
