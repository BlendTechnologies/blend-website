#!/usr/bin/env node
/**
 * One command: bring every borrowed piece of this site up to date.
 *
 * WHY THIS EXISTS. Founder, 2026-11-15: "What I asked is for you to be able
 * to update everything with one command." By then the pieces had a manifest
 * (sources.json), a regenerator (tools/refresh.mjs) and a replay
 * (tools/replay-sample-report.mjs), each with its own modes and its own
 * setup done by hand: a workspace checkout at main with the demo catalogue
 * copied in, a website worktree at main, the replay run separately. This is
 * the whole routine.
 *
 *   node tools/update.mjs                 everything, on a fresh website branch
 *   node tools/update.mjs --report        measure only: nothing written, no submission on the demo
 *     --no-replay       leave the three sample reports alone (no submission on the demo)
 *     --here            run in this website checkout instead of a fresh branch
 *     --keep-workspace  keep the workspace checkout it made, for a look
 *
 * WHAT IT DOES, in order.
 *  1. The website. Fetches, and unless --here, makes a worktree at origin/main
 *     on a branch chore/site-update-<date> under the workspace's
 *     .claude/worktrees/, and runs there. A --report run makes a detached one
 *     and removes it afterwards.
 *  2. The workspace. Fetches, makes a detached worktree at origin/main under
 *     .claude/worktrees/ too, and copies the demo tenant's catalogue into it:
 *     the catalogue is gitignored, so a fresh checkout has none, and without
 *     it the trace exporter reads a page's worth of nothing. Removed at the
 *     end unless --keep-workspace.
 *  3. tools/refresh.mjs against that workspace: the science exports and the
 *     science page, the vendored product facts, written and stamped; the facts
 *     the site states checked; the commits under every drawn piece listed.
 *  4. tools/replay-sample-report.mjs --write: the three personas through the
 *     live demo, their reports and transcripts redrawn, stamped. Three real
 *     submissions on the demo tenant. (--report: --plan and --extract only.)
 *  5. Every check in CLAUDE.md's before-merging list, and the workspace's
 *     British English check on what changed.
 *  6. A summary: what changed, what needs a hand, what was not measured, where
 *     the branch is, and what comes next.
 *
 * WHAT IT CANNOT DO. The tour screens, the films, the step tiles, the hero and
 * the terminals are drawn by hand and have no generator. For those it lists
 * the commits under the components they mirror since they were drawn, and the
 * call stays a person's: leave, redraw what the diff names, or replace with a
 * capture. A capture rig (the seeded demo brand's dashboard, signed in,
 * photographed) would make them regenerable here; it needs the webapp lane
 * and a credential this repository does not hold.
 *
 * TWO SOURCES OF TRUTH, named in the output. The science page is regenerated
 * from the engine AT MAIN, in the workspace checkout; the sample reports are
 * replayed through the LIVE demo, which runs whatever is deployed. The two can
 * differ for a day or a week.
 *
 * Nothing it writes ships by itself. The branch is for the founder to see on
 * desktop; the PR comes after.
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findWorkspace } from './workspace.mjs';

const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const after = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const report = flag('--report');
const here = flag('--here');
const noReplay = flag('--no-replay');
const SELF = fileURLToPath(import.meta.url);
/* --site is how this file, run from one checkout, works on another: the fresh
   branch it makes does not carry this file until it is merged, and need not. */
const ROOT = after('--site') ? resolve(after('--site')) : join(dirname(SELF), '..');
const today = new Date().toISOString().slice(0, 10);

const say = (...a) => console.log(...a);
const git = (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (dir, args) => { try { return git(dir, args); } catch { return null; } };
const tool = f => join(ROOT, 'tools', f);
/** Runs a command with its output on this terminal; the exit code comes back. */
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', ...opts }).status ?? 1;
/** Runs a command and keeps its output, for the summary. */
const capture = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts }); return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || '') }; };
const rule = title => { say(''); say(`==== ${title}`); };

function workspace() {
  let ws = null;
  try { ws = findWorkspace(ROOT); } catch (e) { say(`FAILED: ${e.message}`); process.exit(1); }
  if (!ws) { say('FAILED: no Blend-OS workspace above this checkout and BLEND_OS is not set. The engine, the webapp and PRODUCT_FACTS.md live there.'); process.exit(1); }
  return ws;
}

/* ---- 1. the website: a fresh branch at main ------------------------------------ */
function freshSite(ws) {
  tryGit(ROOT, ['fetch', '-q', 'origin']);
  const head = git(ROOT, ['rev-parse', 'HEAD']);
  const main = git(ROOT, ['rev-parse', 'origin/main']);
  const dirty = git(ROOT, ['status', '--porcelain']).split('\n').filter(Boolean).length;
  if (report && head === main && !dirty) return null; /* measuring in place is fine when in place is main */
  const base = join(ws, '.claude', 'worktrees');
  let name = `site-update-${today}`;
  for (let n = 2; existsSync(join(base, name)) || tryGit(ROOT, ['rev-parse', '--verify', '-q', `refs/heads/chore/${name}`]); n++) name = `site-update-${today}-${n}`;
  const dir = join(base, name);
  if (report) git(ROOT, ['worktree', 'add', '--detach', dir, 'origin/main']);
  else git(ROOT, ['worktree', 'add', dir, '-b', `chore/${name}`, 'origin/main']);
  return { dir, branch: report ? null : `chore/${name}`, main: main.slice(0, 7) };
}

/* ---- 2. the workspace: a detached checkout at main, with the demo catalogue ---- */
function freshWorkspace(ws) {
  tryGit(ws, ['fetch', '-q', 'origin']);
  const dir = join(ws, '.claude', 'worktrees', 'site-update-ws');
  if (existsSync(dir)) {
    tryGit(ws, ['worktree', 'remove', '--force', dir]);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
  tryGit(ws, ['worktree', 'prune']);
  git(ws, ['worktree', 'add', '--detach', '-q', dir, 'origin/main']);
  const tenant = JSON.parse(readFileSync(join(ROOT, 'sample-report-alex.json'), 'utf8')).request.quiz_main;
  const rel = join('algorithms/personalization/data/clients/tenants', tenant);
  const catalogue = existsSync(join(ws, rel, 'catalog.json'));
  if (catalogue) cpSync(join(ws, rel), join(dir, rel), { recursive: true });
  return { dir, head: git(dir, ['rev-parse', '--short', 'HEAD']), tenant, catalogue, rel };
}

function removeWorkspace(ws, dir) {
  tryGit(ws, ['worktree', 'remove', '--force', dir]);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  tryGit(ws, ['worktree', 'prune']);
}

/* ---- 5. the checks -------------------------------------------------------------- */
function checks(ws) {
  const list = readdirSync(tool('')).filter(f => /^check-.*\.mjs$/.test(f)).sort().map(f => [tool(f)]);
  list.push([tool('sync-science-facts.mjs'), '--check'], [tool('refresh.mjs'), '--check'], [tool('replay-sample-report.mjs'), '--redraw', '--check']);
  const results = [];
  for (const args of list) {
    const r = capture(process.execPath, args, { cwd: ROOT });
    const name = args.map((a, i) => (i === 0 ? a.split('/').pop() : a)).join(' ');
    const first = (r.out.trim().split('\n').find(l => /PASSED|FAILED|WAIVED/.test(l)) || r.out.trim().split('\n')[0] || '').trim();
    results.push({ name, ok: r.code === 0, line: first });
    say(`${r.code === 0 ? 'ok  ' : 'FAIL'} ${name}: ${first}`);
    if (r.code !== 0) say(r.out.trim().split('\n').map(l => `       ${l}`).join('\n'));
  }
  const changed = git(ROOT, ['status', '--porcelain']).split('\n').filter(Boolean).map(l => l.slice(3)).filter(f => /\.(html|md|json|mjs|yml)$/.test(f));
  if (changed.length) {
    const r = capture('python3', [join(ws, 'tools', 'check_british_english.py'), ...changed.map(f => join(ROOT, f))]);
    const first = (r.out.trim().split('\n').find(l => /PASSED|REFUSED|FAILED/.test(l)) || r.out.trim().split('\n').pop() || '').trim();
    results.push({ name: 'check_british_english.py', ok: r.code === 0, line: first });
    say(`${r.code === 0 ? 'ok  ' : 'FAIL'} check_british_english.py on ${changed.length} changed file(s): ${first}`);
    if (r.code !== 0) say(r.out.trim().split('\n').map(l => `       ${l}`).join('\n'));
  }
  return results;
}

/* ---- the run ------------------------------------------------------------------- */
function main() {
  const ws = workspace();

  if (!here) {
    const site = freshSite(ws);
    if (site) {
      say(`Website: ${report ? 'a detached checkout' : `branch ${site.branch}`} at origin/main ${site.main}, ${site.dir}`);
      const code = run(process.execPath, [SELF, ...argv, '--here', '--site', site.dir]);
      if (report) { tryGit(ROOT, ['worktree', 'remove', '--force', site.dir]); say(`\nRemoved the detached checkout; nothing was written.`); }
      process.exit(code);
    }
  }

  const failed = [];
  const head = tryGit(ROOT, ['rev-parse', '--short', 'HEAD']);
  const branch = tryGit(ROOT, ['rev-parse', '--abbrev-ref', 'HEAD']);
  say(`Update, ${today}, ${report ? '--report: nothing written, no submission' : 'writing'}. Website ${ROOT} at ${head} (${branch}).`);

  rule('the workspace at main');
  const wsw = freshWorkspace(ws);
  say(`Workspace checkout at origin/main ${wsw.head}: ${wsw.dir}`);
  if (wsw.catalogue) say(`Demo tenant ${wsw.tenant}: catalogue copied in from the shared checkout (${wsw.rel}, gitignored).`);
  else { say(`WARNING: the shared checkout has no catalogue for tenant ${wsw.tenant} under ${wsw.rel}; the trace exporter will read nothing, and refresh.mjs will say so.`); }

  rule('the engine exports, the science page, the product facts (tools/refresh.mjs)');
  const rf = capture(process.execPath, [tool('refresh.mjs'), ...(report ? ['--report'] : []), '--workspace', wsw.dir], { cwd: ROOT });
  process.stdout.write(rf.out);
  const counts = /(\d+) changed automatically, (\d+) need a hand, (\d+) not measured, (\d+) nothing moved/.exec(rf.out);
  if (rf.code !== 0) failed.push('tools/refresh.mjs: an instrument did not run (its report above says which)');

  rule('the three sample reports, through the live demo (tools/replay-sample-report.mjs)');
  let replayed = 'skipped (--no-replay)';
  if (!noReplay) {
    if (report) {
      const a = run(process.execPath, [tool('replay-sample-report.mjs'), '--plan'], { cwd: ROOT });
      const b = run(process.execPath, [tool('replay-sample-report.mjs'), '--extract'], { cwd: ROOT });
      replayed = 'planned against the live quiz and the recorded pages read again; no submission (a plain run replays)';
      if (a || b) failed.push('tools/replay-sample-report.mjs: plan or extract did not pass (above)');
    } else {
      const c = run(process.execPath, [tool('replay-sample-report.mjs'), '--write'], { cwd: ROOT });
      replayed = c ? 'FAILED or not measured (above); the files kept their last figures' : 'replayed, written and redrawn';
      if (c) failed.push('tools/replay-sample-report.mjs --write did not pass (above)');
    }
  }

  rule('the checks');
  const results = checks(ws);
  const bad = results.filter(r => !r.ok);
  if (bad.length) failed.push(`${bad.length} check(s) failed: ${bad.map(b => b.name).join(', ')}`);

  rule('summary');
  const status = git(ROOT, ['status', '--porcelain']).split('\n').filter(Boolean);
  say(`Website: ${branch === 'HEAD' ? `detached at ${head}` : `branch ${branch}`}, ${ROOT}`);
  say(`Workspace main: ${wsw.head}${flag('--keep-workspace') ? `, kept at ${wsw.dir}` : ''}. The science page reads the engine at main; the sample reports read the live demo.`);
  if (counts) say(`Borrowed pieces: ${counts[1]} changed automatically, ${counts[2]} need a hand, ${counts[3]} not measured, ${counts[4]} nothing moved (the four parts above).`);
  say(`Sample reports: ${replayed}.`);
  say(`Checks: ${results.filter(r => r.ok).length} passed, ${bad.length} failed.`);
  if (report) say('Nothing written.');
  else if (status.length) {
    say(`Changed (${status.length} file${status.length > 1 ? 's' : ''}):`);
    for (const l of status) say(`  ${l}`);
    const stat = tryGit(ROOT, ['diff', '--stat']);
    if (stat) say(stat.split('\n').pop().trim());
  } else say('Nothing changed: every regenerated piece matched the copy on the site.');
  if (failed.length) { say('NOT MEASURED or FAILED:'); for (const f of failed) say(`  ${f}`); }
  say('');
  if (!report && status.length) say(`Next: open ${ROOT} at 1440 for the founder. When validated, commit on ${branch} and open the PR.`);
  else if (!report) say('Next: nothing to show; the branch can be removed.');
  say('The drawn screens have no generator: for each, the commits above name what moved under the components it mirrors, and the call is leave, redraw, or capture.');

  if (!flag('--keep-workspace')) removeWorkspace(ws, wsw.dir);
  process.exit(failed.length ? 1 : 0);
}

main();
