#!/usr/bin/env node
/**
 * The site's borrowed pieces: regenerate what has a generator, and say what
 * has moved under everything else.
 *
 * WHY THIS EXISTS. The site carries about two dozen pieces of the product
 * and the engine: figures the engine computes, screens of the webapp rebuilt
 * in code, reports the engine returned, and sample data invented to look like
 * either. sources.json names every one of them, with where its truth lives
 * and when it was last refreshed. Until 2026-11-15 nothing listed them, so
 * nobody could say what was stale: the engine's trace export had grown for a
 * month (42 nutrients a step where the page's copy had 14) and the only check
 * compared the page with the page's own copy of the export. This is the
 * instrument that compares the copy with the engine.
 *
 *   node tools/refresh.mjs              regenerate what has a generator, then report; stamps what it rewrote
 *   node tools/refresh.mjs --report     measure only, write nothing
 *   node tools/refresh.mjs --check      the manifest agrees with the pages (CI; needs no workspace)
 *   node tools/refresh.mjs --stamp a,b  mark pieces refreshed by hand today, at the workspace's HEAD
 *
 * THE WORKSPACE. Found by walking up from this repository (tools/workspace.mjs),
 * or given by BLEND_OS or --workspace. The exporters read the CHECKOUT, not
 * origin/main, and the shared checkout is usually on a feature branch: on
 * 2026-11-15 it was 197 commits behind main under the engine and the webapp.
 * So a plain run refuses a checkout that is behind or dirty under the sources,
 * and --report says so at the top. Use a worktree at origin/main.
 *
 * THE REPORT has four parts. "Changed automatically": regenerated pieces whose
 * output differs, with what moved. "Needs a hand": pieces whose sources have
 * commits since their refresh, a fact the site states that no longer holds, a
 * replay that cannot be re-run, an address that does not answer. "Not
 * measured": what this tool cannot see, said rather than skipped. "Nothing
 * moved": the rest, listed, so silence is a measurement.
 *
 * Nothing here decides what the site should say. It says what has moved; the
 * founder decides on desktop, as always.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findWorkspace } from './workspace.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'sources.json');
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const after = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const mode = flag('--check') ? 'check' : flag('--report') ? 'report' : flag('--stamp') ? 'stamp' : 'write';
if (after('--workspace')) process.env.BLEND_OS = after('--workspace');
const today = new Date().toISOString().slice(0, 10);

const UI = new Set(['generated', 'drawn', 'none']);
const DATA = new Set(['generated', 'replayed', 'copied', 'invented', 'live']);
const FACTS = new Set(['enum-count', 'contains', 'export', 'url']);
const GENERATORS = new Set(['science', 'product-facts']);

const read = f => readFileSync(f, 'utf8');
const manifest = JSON.parse(read(MANIFEST));
const pieces = manifest.pieces;

/* ---- the manifest agrees with the pages ------------------------------------
   Every piece names the markup it sits in; a piece whose anchor is gone was
   removed from the page without being removed from here, and a film or a tour
   screen or a report on the page that no piece names is borrowed content
   nobody is watching. Both are failures. */
function check() {
  const problems = [];
  const ids = new Set();
  let anchors = 0;
  for (const p of pieces) {
    const at = `piece ${p.id || '(no id)'}`;
    if (!p.id) problems.push('a piece has no id');
    else if (ids.has(p.id)) problems.push(`${at}: duplicate id`);
    ids.add(p.id);
    for (const k of ['page', 'what']) if (!p[k]) problems.push(`${at}: no ${k}`);
    if (!UI.has(p.ui)) problems.push(`${at}: ui "${p.ui}" is not one of ${[...UI].join(', ')}`);
    if (!DATA.has(p.data)) problems.push(`${at}: data "${p.data}" is not one of ${[...DATA].join(', ')}`);
    if (p.generator && !GENERATORS.has(p.generator)) problems.push(`${at}: unknown generator "${p.generator}"`);
    if (!Array.isArray(p.sources)) problems.push(`${at}: sources must be a list (empty is allowed)`);
    if (!Array.isArray(p.anchors) || !p.anchors.length) problems.push(`${at}: no anchors`);
    const lr = p.last_refreshed;
    if (!lr || typeof lr !== 'object') problems.push(`${at}: no last_refreshed`);
    else if (lr.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(lr.date)) problems.push(`${at}: last_refreshed.date "${lr.date}" is not a date`);
    for (const f of p.facts || []) if (!FACTS.has(f.kind)) problems.push(`${at}: unknown fact kind "${f.kind}"`);
    for (const a of p.anchors || []) {
      const file = join(ROOT, a.page);
      if (!existsSync(file)) { problems.push(`${at}: anchor page ${a.page} does not exist`); continue; }
      const n = read(file).split(a.contains).length - 1;
      if (n === 0) problems.push(`${at}: ${a.page} no longer contains ${JSON.stringify(a.contains)}`);
      else if (a.count !== undefined && n !== a.count) problems.push(`${at}: ${a.page} contains ${JSON.stringify(a.contains)} ${n} time(s), expected ${a.count}`);
      anchors++;
    }
  }
  const anchored = s => pieces.some(p => (p.anchors || []).some(a => a.contains.includes(s)));
  /* the films: every data-demo on /how-it-works is somebody's */
  const hiw = read(join(ROOT, 'how-it-works.html'));
  for (const m of hiw.matchAll(/<div class="hw-screen" data-demo="([a-z]+)">/g)) {
    if (!anchored(`data-demo="${m[1]}"`)) problems.push(`how-it-works.html plays a "${m[1]}" film that no piece names`);
  }
  /* the tour: every screen root on the homepage */
  const home = read(join(ROOT, 'index.html'));
  for (const m of home.matchAll(/<div class="((?:bx|ax|cx|kx)(?: [a-z]+)?)" aria-hidden="true">/g)) {
    if (!anchored(`<div class="${m[1]}" aria-hidden="true">`)) problems.push(`index.html shows a tour screen .${m[1].replace(' ', '.')} that no piece names`);
  }
  /* the reports: one piece per drawn report */
  const reports = (read(join(ROOT, 'sample-report.html')).match(/<div class="rp sr-report"/g) || []).length;
  const replayed = pieces.filter(p => p.page === 'sample-report.html' && p.data === 'replayed').length;
  if (reports !== replayed) problems.push(`sample-report.html draws ${reports} report(s) and the manifest lists ${replayed}`);

  if (problems.length) {
    console.error('FAILED:\n  ' + problems.join('\n  '));
    console.error('\nsources.json must name every borrowed piece and point at markup that exists.');
    process.exit(1);
  }
  console.log(`PASSED: sources.json names ${pieces.length} borrowed pieces; all ${anchors} anchors found; every film, tour screen and drawn report is listed.`);
}

/* ---- the workspace ----------------------------------------------------------- */
function git(ws, args) {
  return execFileSync('git', ['-C', ws, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).trim();
}
function tryGit(ws, args) { try { return git(ws, args); } catch { return null; } }

function workspace() {
  const ws = findWorkspace(ROOT);
  if (!ws) {
    console.error('FAILED: no Blend-OS workspace above this checkout and BLEND_OS is not set.');
    console.error('The exporters, PRODUCT_FACTS.md and the webapp live there. Give one with --workspace <path>.');
    process.exit(1);
  }
  return ws;
}

/** Every source path any piece names, for the questions about the checkout. */
const allSources = [...new Set(pieces.flatMap(p => p.sources || []).concat('PRODUCT_FACTS.md'))];

function state(ws) {
  tryGit(ws, ['fetch', '-q', 'origin']);
  const head = tryGit(ws, ['rev-parse', '--short', 'HEAD']);
  const branch = tryGit(ws, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const main = tryGit(ws, ['rev-parse', '--short', 'origin/main']);
  const behind = Number(tryGit(ws, ['rev-list', '--count', 'HEAD..origin/main', '--', ...allSources]) || 0);
  const dirty = (tryGit(ws, ['status', '--porcelain', '--', ...allSources]) || '').split('\n').filter(Boolean).length;
  return { head, branch, main, behind, dirty };
}

/** Commits on origin/main touching a piece's sources since it was refreshed. */
function moved(ws, p) {
  const lr = p.last_refreshed || {};
  if (!(p.sources || []).length) return null;
  let range = null;
  if (lr.workspace_commit && tryGit(ws, ['cat-file', '-e', `${lr.workspace_commit}^{commit}`]) !== null) range = [`${lr.workspace_commit}..origin/main`];
  else if (lr.date) range = ['origin/main', `--since=${lr.date}`];
  if (!range) return null;
  const out = tryGit(ws, ['log', ...range, '--format=%h%x09%ad%x09%s', '--date=short', '--', ...p.sources]);
  if (out === null) return null;
  return out ? out.split('\n').map(l => { const [h, d, ...s] = l.split('\t'); return { h, d, s: s.join('\t') }; }) : [];
}

/* ---- generators ---------------------------------------------------------------
   Each real tool is run on a STAGED copy of the files it reads and writes, so
   --report changes nothing and a plain run copies the results back. The tools
   themselves are untouched; this only arranges where they run. */
function run(cmd, args, opts = {}) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, ...opts });
    return { ok: true, out };
  } catch (e) {
    const err = (e.stderr || '').trim().split('\n').filter(l => !/^(DEBUG|INFO)/.test(l)).slice(-6).join('\n');
    return { ok: false, out: e.stdout || '', err: err || e.message };
  }
}
function stage(files) {
  const dir = mkdtempSync(join(tmpdir(), 'blend-site-'));
  for (const f of files) {
    const src = join(ROOT, f);
    if (!existsSync(src)) continue;
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    copyFileSync(src, join(dir, f));
  }
  return dir;
}
const tmp = [];
const cleanup = () => { for (const d of tmp) rmSync(d, { recursive: true, force: true }); };

/** Which leaves differ between two JSON documents, in a few words. */
function leafDiff(a, b) {
  const d = { added: [], removed: [], changed: [], resized: [] };
  (function walk(x, y, p) {
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        const q = p ? `${p}.${k}` : k;
        if (!(k in x)) d.added.push(q); else if (!(k in y)) d.removed.push(q); else walk(x[k], y[k], q);
      }
    } else if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) d.resized.push(`${p} ${x.length} -> ${y.length}`);
      for (let i = 0; i < Math.min(x.length, y.length); i++) walk(x[i], y[i], `${p}[${i}]`);
    } else if (JSON.stringify(x) !== JSON.stringify(y)) {
      d.changed.push(`${p}: ${short(x)} -> ${short(y)}`);
    }
  })(a, b, '');
  d.total = d.added.length + d.removed.length + d.changed.length + d.resized.length;
  return d;
}
const short = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > 48 ? s.slice(0, 45) + '...' : s; };
function describe(d) {
  if (!d.total) return ['identical to the copy on the site'];
  const lines = [`${d.total} leaves differ: ${d.added.length} added, ${d.removed.length} removed, ${d.changed.length} changed, ${d.resized.length} lists resized`];
  const show = [...d.resized.map(s => `list ${s}`), ...d.added.filter(a => !/\[\d+\]/.test(a)).map(a => `added ${a}`), ...d.removed.filter(a => !/\[\d+\]/.test(a)).map(a => `removed ${a}`), ...d.changed];
  for (const s of show.slice(0, 6)) lines.push(`  ${s}`);
  if (show.length > 6) lines.push(`  and ${show.length - 6} more`);
  return lines;
}

/** Isabel's run in words: what a reader of /science would want to know
 *  before the leaf counts. Nothing here is typed; every value is read from
 *  the two documents. */
function traceSummary(was, now) {
  const lines = [];
  const c = k => `${was.counts?.[k]} -> ${now.counts?.[k]}`;
  if (JSON.stringify(was.counts) !== JSON.stringify(now.counts)) lines.push(`counts: scored ${c('scored')}, passed the checks ${c('passed_the_checks')}, recommended ${c('recommended')}`);
  const picks = d => (d.steps?.[6]?.picks || []).map(p => p.product || p.name);
  const a = picks(was), b = picks(now);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    const out = a.filter(x => !b.includes(x)), inn = b.filter(x => !a.includes(x));
    lines.push(`plan: ${b.length} product(s)${out.length ? `; out: ${out.join(', ')}` : ''}${inn.length ? `; in: ${inn.join(', ')}` : ''}`);
  }
  const ra = was.steps?.[5]?.removed_by_check || {}, rb = now.steps?.[5]?.removed_by_check || {};
  const checks = [...new Set([...Object.keys(ra), ...Object.keys(rb)])].filter(k => ra[k] !== rb[k]).map(k => `${k} ${ra[k] ?? 0} -> ${rb[k] ?? 0}`);
  if (checks.length) lines.push(`checks that removed products: ${checks.join('; ')}`);
  if (was.customer?.health_score !== now.customer?.health_score) lines.push(`health score ${was.customer?.health_score} -> ${now.customer?.health_score}`);
  return lines;
}

function genScience(ws) {
  const exp = mkdtempSync(join(tmpdir(), 'blend-exports-')); tmp.push(exp);
  const py = f => join(ws, 'algorithms', 'personalization', 'tools', f);
  const res = {
    facts: run('python3', [py('export_science_facts.py'), '--out-dir', exp], { cwd: ws }),
    trace: run('python3', [py('export_engine_trace.py'), '--out-dir', exp], { cwd: ws }),
  };
  const site = stage(['tools/sync-science-facts.mjs', 'science.html', 'blend-mockups/science/science-facts.json', 'blend-mockups/science/engine-trace.json']); tmp.push(site);
  const fresh = {};
  for (const [key, file] of [['facts', 'science-facts.json'], ['trace', 'engine-trace.json']]) {
    const out = join(exp, file);
    if (res[key].ok && existsSync(out)) {
      fresh[key] = JSON.parse(read(out));
      res[key].diff = leafDiff(JSON.parse(read(join(ROOT, 'blend-mockups', 'science', file))), fresh[key]);
      copyFileSync(out, join(site, 'blend-mockups', 'science', file));
      res[key].file = out;
    }
  }
  const gen = run('node', [join(site, 'tools', 'sync-science-facts.mjs')]);
  const page = { gen, changed: false, delta: 0 };
  if (gen.ok) {
    const before = read(join(ROOT, 'science.html')), afterText = read(join(site, 'science.html'));
    page.changed = before !== afterText; page.delta = afterText.length - before.length; page.staged = join(site, 'science.html');
  }
  return { res, fresh, page };
}

function genProductFacts(ws) {
  const site = stage(['tools/sync-product-facts.mjs', 'tools/workspace.mjs', 'product-facts.json']); tmp.push(site);
  const r = run('node', [join(site, 'tools', 'sync-product-facts.mjs')], { env: { ...process.env, BLEND_OS: ws } });
  if (!r.ok) return { r };
  const before = JSON.parse(read(join(ROOT, 'product-facts.json'))), afterDoc = JSON.parse(read(join(site, 'product-facts.json')));
  return { r, diff: leafDiff(before, afterDoc), staged: join(site, 'product-facts.json') };
}

/* ---- facts the site states, checked against origin/main or a fresh export ---- */
function showMain(ws, file) { return tryGit(ws, ['show', `origin/main:${file}`]); }
function resolvePath(obj, path) {
  let cur = [obj];
  for (const p of path.replace(/\[\*\]/g, '.*').split('.').filter(Boolean)) {
    cur = cur.flatMap(v => p === '*' ? (Array.isArray(v) ? v : []) : (v && typeof v === 'object' && p in v ? [v[p]] : []));
  }
  return cur;
}
async function fact(ws, f, fresh) {
  const site = f.site ? ` (the site says: ${f.site})` : '';
  if (f.kind === 'enum-count') {
    const src = showMain(ws, f.file);
    if (src === null) return { ok: null, text: `could not read ${f.file} on origin/main` };
    const m = src.match(new RegExp(`export const ${f.name}\\s*=\\s*z\\.enum\\(\\[([\\s\\S]*?)\\]\\)`));
    if (!m) return { ok: false, text: `${f.name} is no longer a literal z.enum in ${f.file}${site}` };
    const n = (m[1].match(/"[^"]*"|'[^']*'/g) || []).length;
    return { ok: n === f.expect, text: `${f.name} has ${n} members, the site says ${f.expect}${site}` };
  }
  if (f.kind === 'contains') {
    const src = showMain(ws, f.file);
    if (src === null) return { ok: null, text: `could not read ${f.file} on origin/main` };
    const missing = f.texts.filter(t => !src.includes(t));
    return missing.length
      ? { ok: false, text: `${f.file} no longer carries ${missing.map(t => JSON.stringify(t)).join(', ')}${site}` }
      : { ok: true, text: `${f.texts.length} string(s) still in ${f.file}` };
  }
  if (f.kind === 'export') {
    const doc = fresh[f.from === 'engine-trace' ? 'trace' : 'facts'];
    if (!doc) return { ok: null, text: `no fresh ${f.from} export to read ${f.path} from` };
    let got = resolvePath(doc, f.path);
    if (f.reduce === 'length') got = got.length === 1 && Array.isArray(got[0]) ? got[0].length : got.length;
    else if (f.reduce === 'sum-lengths') got = got.reduce((t, v) => t + (Array.isArray(v) ? v.length : 0), 0);
    else got = got.length === 1 ? got[0] : got;
    return { ok: JSON.stringify(got) === JSON.stringify(f.expect), text: `${f.from} ${f.path}${f.reduce ? ' ' + f.reduce : ''} = ${short(got)}, the site says ${f.expect}${site}` };
  }
  if (f.kind === 'url') {
    try {
      const r = await fetch(f.url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
      return { ok: r.status === 200, text: `${f.url} answers ${r.status}${site}` };
    } catch (e) { return { ok: false, text: `${f.url} did not answer: ${e.message}${site}` }; }
  }
  return { ok: null, text: `unknown fact kind ${f.kind}` };
}

/* ---- stamp ------------------------------------------------------------------ */
function stamp(ids, ws, head) {
  for (const id of ids) {
    const p = pieces.find(x => x.id === id);
    if (!p) { console.error(`FAILED: no piece "${id}" in sources.json`); process.exit(1); }
    p.last_refreshed = { ...(p.last_refreshed || {}), date: today, workspace_commit: head };
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
}

/* ---- main ---------------------------------------------------------------------- */
async function main() {
  if (mode === 'check') return check();
  const ws = workspace();
  const st = state(ws);
  const head = tryGit(ws, ['rev-parse', 'HEAD']);

  if (mode === 'stamp') {
    const ids = (after('--stamp') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) { console.error('FAILED: --stamp needs piece ids, comma separated'); process.exit(1); }
    stamp(ids, ws, head);
    console.log(`stamped ${ids.join(', ')}: refreshed ${today} at workspace ${st.head} (${st.branch})`);
    return;
  }

  console.log(`Refresh report, ${today}, ${mode === 'report' ? '--report (nothing written)' : 'regenerating'}.`);
  console.log(`Workspace ${ws} at ${st.head} (${st.branch}); origin/main is ${st.main}. The exporters read this checkout.`);
  if (st.behind || st.dirty) {
    const why = [st.behind ? `${st.behind} commit(s) behind origin/main under the sources` : '', st.dirty ? `${st.dirty} uncommitted change(s) under the sources` : ''].filter(Boolean).join(' and ');
    if (mode === 'write' && !flag('--allow-stale-checkout')) {
      console.error(`\nREFUSED: this checkout is ${why}. What the exporters read is not what has shipped.`);
      console.error('Run from a worktree at origin/main (git worktree add .claude/worktrees/<name> origin/main), or pass --allow-stale-checkout to regenerate from it anyway.');
      process.exit(1);
    }
    console.log(`WARNING: this checkout is ${why}. The regenerated figures below describe the checkout, not main.`);
  }
  console.log('');

  const sci = genScience(ws);
  const pf = genProductFacts(ws);
  const failed = [];
  if (!sci.res.facts.ok) failed.push(`export_science_facts.py did not run:\n    ${sci.res.facts.err.replace(/\n/g, '\n    ')}`);
  if (!sci.res.trace.ok) failed.push(`export_engine_trace.py did not run:\n    ${sci.res.trace.err.replace(/\n/g, '\n    ')}`);
  if (!sci.page.gen.ok) failed.push(`sync-science-facts.mjs did not run:\n    ${sci.page.gen.err}`);
  if (!pf.r.ok) failed.push(`sync-product-facts.mjs did not run:\n    ${pf.r.err}`);

  /* The fresh exports, once they have passed their sanity checks. A probe
     that reports nothing where the site shows something is treated as a
     broken probe, not as a finding: the piece is "not measured" and nothing
     of it is written. (Workspace CLAUDE.md, Measurement Discipline: nine
     wrong conclusions have come from exactly this.) */
  const vendored = {
    'science-facts': () => JSON.parse(read(join(ROOT, 'blend-mockups', 'science', 'science-facts.json'))),
    'science-trace': () => JSON.parse(read(join(ROOT, 'blend-mockups', 'science', 'engine-trace.json'))),
    'product-facts': () => JSON.parse(read(join(ROOT, 'product-facts.json'))),
  };
  const freshOf = { 'science-facts': sci.fresh.facts, 'science-trace': sci.fresh.trace, 'product-facts': pf.staged ? JSON.parse(read(pf.staged)) : undefined };
  const suspect = {};
  for (const p of pieces) {
    if (!p.sanity || !freshOf[p.id]) continue;
    const was = vendored[p.id](), now = freshOf[p.id];
    const empty = v => v === undefined || v === null || v === 0 || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    const size = v => Array.isArray(v) ? v.length : typeof v === 'object' && v ? Object.keys(v).length : typeof v === 'number' ? v : null;
    const problems = [];
    for (const path of p.sanity) {
      const a = resolvePath(was, path)[0], b = resolvePath(now, path)[0];
      if (!empty(a) && empty(b)) problems.push(`${path} is empty in the fresh export where the site's copy has ${short(size(a) ?? a)}`);
      else if (size(a) && size(b) !== null && size(b) < size(a) / 2) problems.push(`${path} fell from ${size(a)} to ${size(b)}`);
    }
    if (problems.length) suspect[p.id] = problems;
  }
  const scienceSuspect = suspect['science-facts'] || suspect['science-trace'];

  const groups = { auto: [], hand: [], unmeasured: [], quiet: [] };
  for (const p of pieces) {
    const lines = [];
    let where = 'quiet';
    const since = p.last_refreshed?.date ? `since ${p.last_refreshed.date}` : 'ever';
    let regenerated = false, identical = false;

    if (p.generator) {
      const r = p.generator === 'science' ? (p.id === 'science-trace' ? sci.res.trace : sci.res.facts) : pf;
      if (suspect[p.id]) {
        where = 'unmeasured';
        lines.push('PROBE SUSPECT, nothing written: ' + suspect[p.id].join('; '));
        lines.push('An empty result is not a finding. Check the exporter and what it read before believing it.');
      } else if (r.diff) {
        regenerated = true; identical = !r.diff.total;
        if (p.id === 'science-trace' && r.diff.total) lines.push(...traceSummary(vendored['science-trace'](), sci.fresh.trace));
        lines.push(...describe(r.diff));
        if (r.diff.total) where = 'auto';
      } else {
        where = 'unmeasured';
        lines.push(`not regenerated: the ${p.generator === 'science' ? 'exporter' : 'sync'} did not run (see the end of this report)`);
      }
      if (p.id === 'science-trace' && sci.page.gen.ok && !scienceSuspect) {
        const by = sci.page.delta === 0 ? 'same length; the embedded run data moved' : `${sci.page.delta > 0 ? '+' : ''}${sci.page.delta} bytes`;
        lines.push(sci.page.changed ? `science.html ${mode === 'write' ? 'rewritten' : 'would change'} (${by})` : 'science.html unchanged');
      }
    }

    const results = [];
    for (const f of p.facts || []) results.push(await fact(ws, f, scienceSuspect ? {} : sci.fresh));
    const broken = results.filter(r => r.ok === false), unknown = results.filter(r => r.ok === null);
    const factsHold = results.length > 0 && !broken.length && !unknown.length;

    const mv = moved(ws, p);
    const informational = p.commits_are_informational || identical || factsHold;
    if (mv && mv.length) {
      if (!informational && where !== 'auto' && where !== 'unmeasured') where = 'hand';
      const why = p.commits_are_informational ? 'informational: ' + p.commits_are_informational : identical ? 'regenerated above, identical' : factsHold ? 'every fact the site states still holds' : regenerated ? 'regenerated above' : '';
      lines.push(`${mv.length} commit(s) under its sources ${since}${why ? ` (${why})` : ''}:`);
      for (const c of mv.slice(0, 4)) lines.push(`  ${c.d} ${c.h} ${c.s}`);
      if (mv.length > 4) lines.push(`  and ${mv.length - 4} more`);
    } else if (mv && (p.sources || []).length) {
      lines.push(`no commits under its sources ${since}`);
    }

    for (const r of results) {
      if (r.ok === false) { if (where !== 'auto') where = 'hand'; lines.push(`FACT BROKEN: ${r.text}`); }
      else if (r.ok === null) { if (where === 'quiet') where = 'unmeasured'; lines.push(`not measured: ${r.text}`); }
      else lines.push(`holds: ${r.text}`);
    }
    if (p.data === 'replayed' && !p.refresh) { if (where !== 'auto' && where !== 'unmeasured') where = 'hand'; lines.push(`cannot be re-run: ${p.refresh_note || 'no refresh command'}`); }
    if (p.unmeasured) { if (where === 'quiet') where = 'unmeasured'; lines.push(`not measured: ${p.unmeasured}`); }
    if (p.source_note && where !== 'quiet') lines.push(`note: ${p.source_note}`);
    groups[where].push({ p, lines });
  }

  const section = (title, items, empty) => {
    console.log(`${title}`);
    if (!items.length) console.log(`  ${empty}`);
    for (const { p, lines } of items) {
      console.log(`  ${p.id}  [${p.ui} ui, ${p.data} data]  ${p.page}`);
      for (const l of lines) console.log(`      ${l}`);
    }
    console.log('');
  };
  section(mode === 'write' ? 'CHANGED AUTOMATICALLY (written)' : 'CHANGED AUTOMATICALLY (would be written by a plain run)', groups.auto, 'nothing: every regenerated export matches the copy on the site');
  section('NEEDS A HAND', groups.hand, 'nothing');
  section('NOT MEASURED', groups.unmeasured, 'nothing');
  section('NOTHING MOVED', groups.quiet, 'nothing');

  if (mode === 'write') {
    const written = [];
    /* /science is one unit: its page is generated from both exports, so a
       suspect export holds back the page and the other export with it. */
    if (scienceSuspect) console.log('Not written: the science exports, because a probe is suspect (above).');
    else {
      for (const [key, file, id] of [['facts', 'science-facts.json', 'science-facts'], ['trace', 'engine-trace.json', 'science-trace']]) {
        const r = sci.res[key];
        if (r.file && r.diff && r.diff.total) { copyFileSync(r.file, join(ROOT, 'blend-mockups', 'science', file)); written.push(id); }
      }
      if (sci.page.changed && sci.page.staged) copyFileSync(sci.page.staged, join(ROOT, 'science.html'));
    }
    if (suspect['product-facts']) console.log('Not written: product-facts.json, because a probe is suspect (above).');
    else if (pf.diff && pf.diff.total) { copyFileSync(pf.staged, join(ROOT, 'product-facts.json')); written.push('product-facts'); }
    if (written.length) { stamp(written, ws, head); console.log(`Written and stamped: ${written.join(', ')}.`); }
    else console.log('Nothing to write.');
    console.log('');
  }

  if (failed.length) {
    console.error('NOT MEASURED, because an instrument did not run:\n  ' + failed.join('\n  '));
    console.error('\nA piece that was not regenerated is reported from its last copy, not from the engine.');
  }
  console.log(`${groups.auto.length} changed automatically, ${groups.hand.length} need a hand, ${groups.unmeasured.length} not measured, ${groups.quiet.length} nothing moved.`);
  cleanup();
  if (failed.length) process.exit(1);
}

main().catch(e => { cleanup(); console.error('FAILED:', e.message); process.exit(1); });
