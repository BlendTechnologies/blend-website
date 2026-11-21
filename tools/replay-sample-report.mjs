#!/usr/bin/env node
/**
 * The three sample reports: re-run each persona through the live demo and say
 * what moved.
 *
 * WHY THIS EXISTS. /sample-report draws three reports from the engine's own
 * output for three personas, vendored as sample-report-{alex,sam,helen}.json
 * with the request that produced each. They were replayed on 2026-11-11 by a
 * script that lived in a session scratchpad and was never committed, so the
 * figures could be checked (tools/check-sample-report.mjs holds the page to the
 * files) but not re-run: the first refresh report (tools/refresh.mjs,
 * 2026-11-15) had to list all three under "needs a hand". This is that script,
 * committed, with the parts it was missing.
 *
 *   node tools/replay-sample-report.mjs --plan                 read-only: do the recorded requests still fit the live quiz?
 *   node tools/replay-sample-report.mjs --extract [who ...]    read the RECORDED submissions' results pages again; no new submission
 *   node tools/replay-sample-report.mjs --report  [who ...]    replay, extract, compare with the files here; write nothing
 *   node tools/replay-sample-report.mjs --write   [who ...]    replay, extract, write the files, redraw the page, stamp sources.json
 *   node tools/replay-sample-report.mjs --redraw [--check]     draw the page from the files here, no network; --check only says whether it would change
 *     --keep <dir>   save every results page, submission transcript and extract there
 *     alex=<submission id>[:<recommendation id>]   with --extract, --report or --write: read THAT
 *                    submission's page instead of making one. For the day the reader breaks
 *                    after the results page is redesigned and the submissions already exist.
 *
 * WHAT A REPLAY IS. The request in each file is the persona's answers by their
 * stable ids. It is first planned against the live quiz definition
 * (GET /api/embed/<key>/quiz) with the webapp's own visibility rules
 * (lib/quiz/visibility.ts, ported below): a question the quiz would not show
 * must not be answered, a required one it would show must be, every id must
 * still exist, no chosen option may be gated off by another answer. A persona
 * whose request no longer fits is reported and not run. Then: one submission
 * pinned to the publication just read, one PUT per answered question, complete.
 * That is a REAL submission on the Blend Demo tenant and counts in the demo's
 * analytics, as the 2026-11-11 ones did; it is why --plan, --extract and
 * --redraw exist, and why --report says so before it runs.
 *
 * WHAT IS EXTRACTED. The figures are read from the submission's RENDERED
 * results page in a headless browser, not from the engine's JSON: the page is
 * what a customer sees, and everything a card says beyond the dose comes from
 * the brand's catalogue and the webapp's wording. The browser is the
 * workspace's Playwright (tools/visual-diff/node_modules), found through
 * tools/workspace.mjs or named by BLEND_PLAYWRIGHT; this site has no
 * dependencies of its own.
 *
 * THE PAGE IT READS. Written against the results page as redesigned on
 * 2026-11-19 and 2026-11-20 (webapp #1583 to #1605): a product is a list item
 * under "Recommended products" with its name, tier badge, goal pills, sub-goal
 * pills, why, a When/Serving row whose labels are visually hidden, "Your match"
 * dots and price; its <dialog> repeats that with the full description. The
 * products under "Other products in this range" are alternatives: listed by
 * name, never read as picks. The first reader keyed on every <dialog> and a
 * "Why:" prefix, and on 2026-11-20 it read 29 alternatives as picks and no why
 * at all; the guard below refused all three personas, as it should.
 *
 * A PROBE THAT READS NOTHING IS BROKEN. A page with no products, no macros, a
 * bar in a colour this site has no class for, a macro label this tool has never
 * met: each is reported as "not measured" and nothing of that persona is
 * written. The measuring apparatus is the first suspect, never the engine
 * (workspace CLAUDE.md, Measurement Discipline).
 *
 * WHAT IS DRAWN. The chrome of each report (its hero, its headings, the retake
 * line, the disclaimer's place, the wellness-score stand-in) is the site's and
 * stays. The tool rewrites only what the engine said: the number of areas in
 * the intro, the profile and goal chips, the product cards, the macros, the
 * breakdown, the notices. The answer cards' transcripts are rebuilt from the
 * submission as the demo stored it. --redraw from unchanged files must leave
 * the page byte-identical, and CI runs it that way: that is how the drawing
 * code is held honest, and why a card's markup is changed here and nowhere
 * else.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findWorkspace } from './workspace.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'sample-report.html');
const MANIFEST = join(ROOT, 'sources.json');
const DEMO_ANSWERS = join(ROOT, 'demo-answers.json');
const BASE = 'https://app.blend-technologies.com';
/* The Blend Demo tenant's embed key: the quiz /try embeds, the one the
   recorded runs answered. The tenant id the engine knows it by is
   request.quiz_main in each file. */
const KEY = '928d8ad4333a4dc4b13e7d86f7557526';
const WHO = ['alex', 'sam', 'helen'];

const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const after = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const MODES = ['--plan', '--extract', '--report', '--write', '--redraw'];
const picked = MODES.filter(flag);
if (picked.length !== 1) {
  console.error(`usage: node tools/replay-sample-report.mjs ${MODES.join(' | ')} [alex sam helen] [--keep <dir>] [--check]`);
  process.exit(2);
}
const mode = picked[0].slice(2);
/* alex=<submission>[:<recommendation>] names a submission that already exists
   (today's replay, read again after the reader was mended) instead of making one. */
const GIVEN = {};
for (const a of argv) {
  const m = /^(alex|sam|helen)=([0-9a-f-]{36})(?::([0-9a-f-]{36}))?$/i.exec(a);
  if (m) GIVEN[m[1].toLowerCase()] = { submission_id: m[2], recommendation_id: m[3] || null };
}
const personas = WHO.filter(w => argv.includes(w) || GIVEN[w]);
if (!personas.length) personas.push(...WHO);
const keep = after('--keep');
const today = new Date().toISOString().slice(0, 10);

const read = f => readFileSync(f, 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = w => w[0].toUpperCase() + w.slice(1);
const fileOf = w => join(ROOT, `sample-report-${w}.json`);
const files = Object.fromEntries(WHO.map(w => [w, JSON.parse(read(fileOf(w)))]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---- the live demo ----------------------------------------------------------- */
async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = null; }
  return { status: res.status, json, text };
}

async function liveQuiz() {
  const r = await call('GET', `/api/embed/${KEY}/quiz`);
  if (r.status !== 200 || !r.json?.definition?.questions) throw new Error(`GET .../quiz answered ${r.status}: ${r.text.slice(0, 160)}`);
  return r.json;
}

/* ---- planning: the webapp's visibility rules, ported ---------------------------
   lib/quiz/visibility.ts: four static checks (a brand-hidden question or gate,
   hides beat shows), then a fixed-point pass in which a conditional question
   is shown only when one of its condition answers is selected on a question
   that is itself visible. Options have their own gate (answerApplies). */
function visibility(questions, selected) {
  const byId = new Map(questions.map(q => [q.stableQuestionId, q]));
  const owner = new Map();
  for (const q of questions) for (const a of q.answers || []) owner.set(a.stableAnswerId, { qid: q.stableQuestionId, hidden: a.isHidden === true });
  const outcome = q => {
    if (q.isHidden) return 'hidden';
    if (q.hideIfQuestionHidden && byId.get(q.hideIfQuestionHidden)?.isHidden === true) return 'hidden';
    if (q.hideIfAnswerHidden && owner.get(q.hideIfAnswerHidden)?.hidden) return 'hidden';
    if (q.showIfQuestionHidden && byId.get(q.showIfQuestionHidden)?.isHidden === true) return 'shown';
    return q.conditionalDisplay ? 'conditional' : 'unconditional';
  };
  const kinds = new Map(questions.map(q => [q.stableQuestionId, outcome(q)]));
  const visible = new Map(questions.map(q => [q.stableQuestionId, ['shown', 'unconditional'].includes(kinds.get(q.stableQuestionId))]));
  for (let changed = true; changed;) {
    changed = false;
    for (const q of questions) {
      if (kinds.get(q.stableQuestionId) !== 'conditional' || visible.get(q.stableQuestionId)) continue;
      const ok = (q.conditionAnswer || []).some(aid => {
        const o = owner.get(aid);
        return o && visible.get(o.qid) && (selected.get(o.qid) || []).includes(aid);
      });
      if (ok) { visible.set(q.stableQuestionId, true); changed = true; }
    }
  }
  return visible;
}

/** The PUTs a request amounts to on this quiz, and everything that says it no longer fits. */
function plan(request, quiz) {
  const QS = quiz.definition.questions;
  const byId = new Map(QS.map(q => [q.stableQuestionId, q]));
  const choices = new Map(request.choices.map(c => [c.question_id, c.answer_ids]));
  const values = new Map(request.values.map(v => [v.question_id, v]));
  const issues = [];
  for (const qid of [...choices.keys(), ...values.keys()]) if (!byId.has(qid)) issues.push(`${qid} is no longer on the quiz`);
  for (const [qid, aids] of choices) {
    const q = byId.get(qid);
    if (!q) continue;
    const live = new Map((q.answers || []).map(a => [a.stableAnswerId, a]));
    for (const aid of aids) {
      const a = live.get(aid);
      if (!a) { issues.push(`${qid}: option ${aid} is no longer on the quiz`); continue; }
      if (a.isHidden) issues.push(`${qid}: option ${aid} "${a.optionText}" is switched off by the brand`);
      if (a.hideIfQuestion && a.hideIfAnswer && (choices.get(a.hideIfQuestion) || []).includes(a.hideIfAnswer)) issues.push(`${qid}: option ${aid} "${a.optionText}" is gated off by the answer to ${a.hideIfQuestion}`);
    }
    if (q.maxAnswers != null && aids.length > q.maxAnswers) issues.push(`${qid}: ${aids.length} answers, the quiz allows ${q.maxAnswers}`);
  }
  const visible = visibility(QS, choices);
  const steps = [];
  for (const q of QS) {
    const qid = q.stableQuestionId;
    if (!visible.get(qid)) {
      if (choices.has(qid) || values.has(qid)) issues.push(`${qid} "${q.questionText}" is answered, and the quiz would not show it`);
      continue;
    }
    if (q.questionType === null) continue; /* a section slide carries no answer */
    if (choices.has(qid)) steps.push({ kind: 'choice', qid, answerIds: choices.get(qid) });
    else if (values.has(qid)) steps.push({ kind: 'text', qid, value: String(values.get(qid).value) });
    else if (q.isRequired && q.questionType !== 'email_input') issues.push(`${qid} "${q.questionText}" is required, would be shown, and is not answered`);
  }
  return { steps, issues };
}

/* ---- the replay ---------------------------------------------------------------- */
async function replay(w, steps, publicationId, say) {
  const c = await call('POST', `/api/embed/${KEY}/submissions`, { publicationId });
  if (c.status !== 201) throw new Error(`creating the submission answered ${c.status}: ${c.text.slice(0, 200)}`);
  const sid = c.json.submissionId;
  for (const s of steps) {
    const body = s.kind === 'choice' ? { kind: 'choice', answerIds: s.answerIds } : { kind: 'text', value: s.value };
    const r = await call('PUT', `/api/embed/${KEY}/submissions/${sid}/responses/${encodeURIComponent(s.qid)}`, body);
    if (r.status !== 200) throw new Error(`PUT ${s.qid} answered ${r.status}: ${r.text.slice(0, 200)}`);
    await sleep(150);
  }
  let done = null;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    const r = await call('POST', `/api/embed/${KEY}/submissions/${sid}/complete`, {});
    if (r.status === 200) { done = r.json; break; }
    const again = attempt < 3 && (r.status >= 500 || r.status === 429);
    say(`  complete answered ${r.status}${again ? ', trying again in 8 s' : ''}: ${r.text.slice(0, 160)}`);
    if (!again) break;
    await sleep(8000);
  }
  if (!done) throw new Error(`submission ${sid} did not complete`);
  return {
    submission_id: sid,
    recommendation_id: done.recommendationId,
    publication_id: publicationId,
    completed: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
}

async function submission(sid) {
  const r = await call('GET', `/api/embed/${KEY}/submissions/${sid}`);
  if (r.status !== 200 || !r.json?.definition) throw new Error(`GET .../submissions/${sid} answered ${r.status}`);
  return r.json;
}

/** The answers as the demo stored them, in the quiz's own words, one row per answered question. */
function transcript(sub) {
  const rows = [];
  for (const q of sub.definition.questions) {
    const r = sub.responses[q.stableQuestionId];
    if (!r) continue;
    let parts = null, a;
    if (r.kind === 'choice') {
      const m = new Map((q.answers || []).map(x => [x.stableAnswerId, x.optionText]));
      parts = r.answerIds.map(x => m.get(x) ?? x);
      a = parts.join(', ');
    } else a = String(r.value);
    const full = a;
    if (a.length > 83) a = a.slice(0, 82).trimEnd() + '…';
    rows.push({ q: q.questionText, a, parts, full });
  }
  return rows;
}

/* ---- reading the results page -------------------------------------------------- */
async function openBrowser() {
  let ws = null;
  try { ws = findWorkspace(ROOT); } catch { ws = null; }
  const where = [process.env.BLEND_PLAYWRIGHT, ws && join(ws, 'tools/visual-diff/node_modules/playwright/index.mjs')].filter(Boolean);
  for (const p of where) {
    if (!existsSync(p)) continue;
    const { chromium } = await import(pathToFileURL(p).href);
    return chromium.launch();
  }
  throw new Error('no headless browser. This site has no dependencies of its own and borrows the workspace\'s Playwright (tools/visual-diff: run npm install there), or set BLEND_PLAYWRIGHT to a playwright/index.mjs.');
}

/* Runs inside the page. Self-contained: nothing from this file is in scope.
   Structural where it can be (headings, list items, the hidden labels, the
   aria-label of the dots), never a Tailwind class. */
function readPage() {
  const T = el => (el ? el.textContent || '' : '').replace(/\s+/g, ' ').trim();
  const visible = el => { if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('.sr-only').forEach(x => x.remove()); return T(c); };
  const headed = re => { for (const h of document.querySelectorAll('h1,h2,h3')) if (re.test(T(h))) return { h, sec: h.closest('section') || h.parentElement }; return null; };
  const lists = sec => sec ? [...sec.querySelectorAll('ul')].map(u => [...u.children].map(li => T(li)).filter(Boolean)) : [];
  const heading = T(document.querySelector('h1'));
  const intro = T([...document.querySelectorAll('p')].find(x => /Based on your answers/.test(T(x))));
  const prof = headed(/^Your profile|^Your details/);
  const profile = prof ? lists(prof.sec).flat() : [];
  const told = headed(/told us matters|^Your priorities|^Your goals/);
  const [goals = [], subgoals = []] = told ? lists(told.sec) : [];
  const sg = document.querySelector('[role="group"][aria-label*="score"]');
  const sa = sg ? /:\s*(\d{1,3})\s*,\s*(.+)$/.exec(sg.getAttribute('aria-label') || '') : null;
  const health_score = sa ? Number(sa[1]) : null;
  const health_band = sa ? sa[2].trim() : null;
  /* the band's sentence is the longest paragraph in the box; the bar's colour is the filled layer's background */
  const health_text = sg ? ([...sg.querySelectorAll('p')].map(T).filter(t => t.length > 40).sort((a, b) => b.length - a.length)[0] || null) : null;
  const health_bg = sg ? (([...sg.querySelectorAll('div[style]')].map(d => d.getAttribute('style') || '').find(st => /width:/.test(st)) || '').match(/background(?:-color)?:\s*([^;]+)/) || [])[1] || null : null;

  const isPrice = t => /^(US\$|£|€)\s?\d/.test(t);
  const readCard = li => {
    const c = li.cloneNode(true);
    c.querySelectorAll('dialog, button').forEach(x => x.remove());
    const nameP = c.querySelector('p');
    const name = T(nameP);
    const tier = [...c.querySelectorAll('span')].map(T).find(t => /^(Essential|Recommended|Optional)$/.test(t)) || '';
    const uls = [...c.querySelectorAll('ul')];
    const tags = uls[0] ? [...uls[0].children].map(T).filter(Boolean) : [];
    const subtags = uls[1] ? [...uls[1].children].map(T).filter(Boolean) : [];
    const ps = [...c.querySelectorAll('p')].filter(p => p !== nameP && !p.hasAttribute('data-match-dots'));
    const useP = ps.find(p => p.querySelector('.sr-only') && /When:|Serving:/.test(T(p)));
    const labelled = {};
    if (useP) for (const sp of useP.querySelectorAll('span')) { const sr = sp.querySelector(':scope > .sr-only'); if (sr) labelled[T(sr).replace(/:$/, '')] = visible(sp); }
    const body = ps.filter(p => p !== useP && !/^(Your match|Caution|Note)\b/.test(T(p)) && !isPrice(T(p)));
    const why = visible(body[0]);
    const caution = ps.map(T).find(t => /^(Caution|Note)\b/.test(t)) || null;
    const price = [...c.querySelectorAll('span, p')].map(T).find(isPrice) || null;
    const dots = li.querySelector('[data-match-dots]');
    const ma = dots ? /(\d+)\s*\/\s*(\d+)/.exec(dots.querySelector('[aria-label]')?.getAttribute('aria-label') || '') : null;
    const match = ma ? { score: Number(ma[1]), of: Number(ma[2]) } : (dots ? { score: Number(dots.getAttribute('data-match-dots')), of: 5 } : null);
    /* the full description is on the expanded card; the why there ends in a hidden "Why:" and the use row carries hidden labels, so both are told apart by that */
    const dlg = li.querySelector('dialog');
    const dps = dlg ? [...dlg.querySelectorAll('p')] : [];
    const descBlock = dps.filter(p => !p.querySelector('.sr-only') && !p.hasAttribute('data-match-dots')).map(T)
      .find(t => t !== name && t !== why && !isPrice(t) && !/^(Your match|Caution|Note)\b/.test(t) && t.length > 30) || '';
    const m = descBlock.match(/^(.*?)(?:\s+When to take it\.\s+(.*?))?(?:\s+Ingredients\.\s+(.*?))?$/);
    return { name, tier, tags, subtags, why, timing: labelled.When || '', form: labelled.Serving || '', price, caution, match, description: m ? m[1] : descBlock };
  };
  const rec = headed(/^Recommended products|^Your products|^Your plan/);
  /* a card is a list item with its own expanded <dialog>; the pills inside it are list items without one */
  const cards = rec ? [...rec.sec.querySelectorAll('li')].filter(li => li.querySelector('dialog')) : [];
  const products = cards.map(readCard);
  const det = [...document.querySelectorAll('details')].find(d => /Other products/i.test(T(d.querySelector('summary'))));
  const others = det ? [...det.querySelectorAll('li')].filter(li => li.querySelector('dialog')).map(readCard) : [];
  const othersCount = det ? (Number((/(\d+)\s+products?/.exec(T(det.querySelector('summary'))) || [])[1]) || others.length) : 0;

  const style = el => (el ? el.getAttribute('style') || '' : '');
  const bgOf = el => (style(el).match(/background(?:-color)?:\s*([^;]+)/) || [])[1] || (el ? getComputedStyle(el).backgroundColor : '');
  const mac = headed(/^Your macros|Daily intake/i);
  const grid = mac ? [...mac.sec.querySelectorAll('div')].find(d => d.children.length >= 4 && [...d.children].every(ch => ch.querySelector('[style*="width"]'))) : null;
  const macros = grid ? [...grid.children].map(tile => {
    const top = tile.children[0], bottom = tile.children[1];
    const ps = top ? [...top.querySelectorAll(':scope > p')] : [];
    const vs = ps[1] ? [...ps[1].querySelectorAll('span')].map(T) : [];
    const bar = tile.querySelector('[style*="width"]');
    const pctT = bottom ? [...bottom.querySelectorAll('span')].map(T).find(t => /%$/.test(t.replace(/\s/g, ''))) : null;
    const note = [...tile.children].slice(2).map(T).filter(Boolean).join(' ') || null;
    return { label: T(ps[0]), value: vs[0] || '', unit: vs[1] || '', target: T(ps[2]), pct: pctT ? parseInt(pctT) : NaN, w: (style(bar).match(/width:\s*([^;]+)/) || [])[1] || '', bg: bgOf(bar), note };
  }) : [];

  const bd = headed(/^Full breakdown|breakdown/i);
  const breakdown = [];
  if (bd) for (const h3 of bd.sec.querySelectorAll('h3')) {
    const rows = [];
    for (const row of h3.nextElementSibling ? [...h3.nextElementSibling.children] : []) {
      const ps = [...row.querySelectorAll('p')].map(p => T(p).replace(/^•\s*/, '').replace(/\s*•$/, ''));
      const pct = ps.map(t => /^(\d{1,3})\s*%$/.exec(t)).find(Boolean);
      const sources = ps.find(t => /^Sources:/.test(t)) || '';
      rows.push({ name: ps[0] || '', pct: pct ? Number(pct[1]) : NaN, sources, bg: bgOf(row.querySelector('[style*="width"]')) });
    }
    breakdown.push({ group: T(h3), rows });
  }

  const notices = [];
  for (const h of document.querySelectorAll('h2,h3')) {
    if (!/Talk to a professional|Talk to an expert/i.test(T(h))) continue;
    const sec = h.closest('section') || h.parentElement;
    for (const li of sec.querySelectorAll('li')) {
      const lead = T(li.querySelector('span'));
      const text = T(li).replace(lead, '').replace(/^\s*:\s*/, '').trim();
      notices.push({ title: T(h), lead, text });
    }
  }
  const disclaimer = T([...document.querySelectorAll('p')].find(x => /effectiveness and suitability/.test(T(x))));
  return { heading, intro, profile, goals, subgoals, products, others, othersCount, macros, breakdown, notices, disclaimer, health_score, health_band, health_text, health_bg };
}

async function extract(browser, sid) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${BASE}/quiz/${KEY}/results/${sid}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('[data-match-dots], dialog', { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const raw = await page.evaluate(readPage);
    const html = await page.content();
    return { raw, html };
  } finally { await page.close(); }
}

/* ---- the figures, in the files' shape ------------------------------------------- */
/* The bar colours the webapp paints and the classes this page draws them with.
   A colour not here is a colour the page cannot draw, so it is a refusal. */
const COLOUR = [
  [/#6aa84f|rgb\(106,\s*168,\s*79\)/i, 'm-gr'],
  [/#4a72ac|rgb\(74,\s*114,\s*172\)/i, 'm-b'],
  [/#d8614a|rgb\(216,\s*97,\s*74\)/i, 'm-r'],
  [/#c77e2f|rgb\(199,\s*126,\s*47\)/i, 'm-o'],
  [/var\(--quiz-text\)|rgba\(64,\s*59,\s*52,\s*0\.35\)/i, 'm-g'],
];
const colourClass = bg => (COLOUR.find(([re]) => re.test(bg || '')) || [])[1] || null;
/* The webapp sets the labels in capitals with CSS and Chrome's innerText
   honours that; the page draws them in sentence case. */
const LABEL = { CALORIES: 'Calories', PROTEIN: 'Protein', CARBS: 'Carbs', FAT: 'Fat', WATER: 'Water', 'OMEGA-3': 'Omega-3', FIBRE: 'Fibre', 'FREE SUGARS': 'Free sugars', 'SATURATED FAT': 'Saturated fat' };

function shape(raw, old) {
  const problems = [];
  const need = (ok, what) => { if (!ok) problems.push(what); };
  need(raw.products.length, 'no products read');
  need(raw.macros.length, 'no macros read');
  need(raw.disclaimer, 'no disclaimer read');
  need(raw.profile.length, 'no profile chips read');
  need(raw.goals.length, 'no goal chips read');
  const ka = /in (\d+) (?:key )?areas/.exec(raw.intro || '');
  need(ka, `the intro names no number of areas: ${JSON.stringify(raw.intro)}`);
  const shapeCard = (p, pick) => {
    /* a brand's other product carries no tier and may carry no dots (TierBadge and MatchLine draw nothing); a pick carries both */
    for (const k of ['name', 'why', 'form', 'timing']) need(p[k], `${p.name || 'a product'}: no ${k} read`);
    if (pick) need(p.tier, `${p.name || 'a product'}: no tier read`);
    if (pick) need(p.match && Number.isFinite(p.match.score), `${p.name || 'a product'}: no match dots read`);
    const d = { name: p.name, tier: p.tier, tags: p.tags, subtags: p.subtags, why: p.why, form: p.form, timing: p.timing, description: p.description || '', price: p.price, match: p.match && Number.isFinite(p.match.score) ? p.match : null };
    if (p.caution) d.caution = p.caution.replace(/^(Note|Caution): /, '');
    return d;
  };
  const products = raw.products.map(p => shapeCard(p, true));
  need(products.some(p => p.description), 'no product carries a description: the expanded card was not read');
  /* the alternatives under "Other products in this range": the page says how many, and every card is read like a pick */
  const others = raw.others.map(p => shapeCard(p, false));
  need(raw.othersCount === others.length, `the page says ${raw.othersCount} other products and ${others.length} were read`);
  const macros = raw.macros.map(m => {
    const key = String(m.label || '').toUpperCase();
    const cls = colourClass(m.bg);
    need(cls, `${m.label}: bar colour ${JSON.stringify(m.bg)} is none the page draws (m-g, m-gr, m-b, m-r, m-o)`);
    need(LABEL[key], `macro label ${JSON.stringify(m.label)} is new to this tool`);
    need(Number.isFinite(m.pct), `${m.label}: no percentage read`);
    need(m.value && m.unit && m.target, `${m.label}: value, unit or target not read`);
    const out = { label: LABEL[key] || m.label, value: m.value, unit: m.unit, target: m.target, pct: m.pct, cls };
    if (m.note) out.note = m.note;
    return out;
  });
  const breakdown = raw.breakdown.map(g => ({ group: g.group, rows: g.rows.map(r => {
    need(r.name, `a breakdown row under ${g.group} has no name`);
    need(Number.isFinite(r.pct), `breakdown ${r.name}: no percentage read`);
    need(r.sources, `breakdown ${r.name}: no sources line read`);
    const cls = colourClass(r.bg);
    need(cls, `breakdown ${r.name}: bar colour ${JSON.stringify(r.bg)} is none the page draws`);
    return { name: r.name, pct: r.pct, sources: r.sources, cls };
  }) }));
  const report = {
    heading: raw.heading, intro: raw.intro, key_areas: ka ? Number(ka[1]) : null,
    profile: raw.profile.map(c => c.replace(/\*$/, '')), goals: raw.goals, subgoals: raw.subgoals, products, macros,
    macros_note: old.report.macros_note, breakdown, notices: raw.notices, disclaimer: raw.disclaimer,
    other_products: { count: raw.othersCount, items: others },
  };
  if (raw.health_score != null) {
    report.health_score = raw.health_score;
    report.health_band = raw.health_band;
    report.health_text = raw.health_text;
    const hc = colourClass(raw.health_bg);
    need(hc, `the wellness score's bar colour ${JSON.stringify(raw.health_bg)} is none the page draws`);
    report.health_cls = hc;
  }
  return { report, problems };
}

/** What differs between the report on file and a fresh one, as sentences. */
function compare(a, b) {
  const out = [];
  if (a.key_areas !== b.key_areas) out.push(`key areas: ${a.key_areas} -> ${b.key_areas}`);
  const sets = (what, x, y) => {
    const gone = x.filter(v => !y.includes(v)), came = y.filter(v => !x.includes(v));
    if (gone.length || came.length) out.push(`${what}: ${gone.map(v => `-${JSON.stringify(v)}`).concat(came.map(v => `+${JSON.stringify(v)}`)).join(' ')}`);
    else if (!same(x, y)) out.push(`${what}: same items, new order`);
  };
  sets('profile', a.profile, b.profile);
  sets('goals', a.goals, b.goals);
  sets('sub-goals', a.subgoals || [], b.subgoals || []);
  const A = new Map(a.products.map(p => [p.name, p])), B = new Map(b.products.map(p => [p.name, p]));
  for (const [n, p] of A) if (!B.has(n)) out.push(`product out: ${n} (${p.tier})`);
  for (const [n, p] of B) if (!A.has(n)) out.push(`product in: ${n} (${p.tier})`);
  for (const [n, p] of A) {
    const q = B.get(n);
    if (!q) continue;
    for (const k of ['tier', 'tags', 'subtags', 'why', 'form', 'timing', 'description', 'caution', 'price', 'match']) if (!same(p[k], q[k])) out.push(`${n}: ${k} ${JSON.stringify(p[k])} -> ${JSON.stringify(q[k])}`);
  }
  if (A.size === B.size && [...A.keys()].every(n => B.has(n)) && !same([...A.keys()], [...B.keys()])) out.push('products: same picks, new order');
  const MA = new Map(a.macros.map(m => [m.label, m])), MB = new Map(b.macros.map(m => [m.label, m]));
  for (const [l, m] of MA) {
    const n = MB.get(l);
    if (!n) { out.push(`macro gone: ${l}`); continue; }
    const ch = ['value', 'unit', 'target', 'pct', 'cls', 'note'].filter(k => !same(m[k], n[k])).map(k => `${k} ${m[k]} -> ${n[k]}`);
    if (ch.length) out.push(`${l}: ${ch.join(', ')}`);
  }
  for (const l of MB.keys()) if (!MA.has(l)) out.push(`macro new: ${l}`);
  const rows = g => new Map(g.flatMap(x => x.rows.map(r => [r.name, { ...r, group: x.group }])));
  const RA = rows(a.breakdown), RB = rows(b.breakdown);
  for (const [n, r] of RA) {
    const s = RB.get(n);
    if (!s) { out.push(`breakdown row gone: ${n} (${r.pct}%)`); continue; }
    const ch = ['pct', 'sources', 'group', 'cls'].filter(k => r[k] !== s[k]).map(k => `${k} ${JSON.stringify(r[k])} -> ${JSON.stringify(s[k])}`);
    if (ch.length) out.push(`${n}: ${ch.join(', ')}`);
  }
  for (const [n, s] of RB) if (!RA.has(n)) out.push(`breakdown row new: ${n} (${s.pct}%)`);
  if (!same(a.notices || [], b.notices || [])) out.push(`notices: ${JSON.stringify(a.notices || [])} -> ${JSON.stringify(b.notices || [])}`);
  if (a.disclaimer !== b.disclaimer) out.push('disclaimer: the wording changed');
  if ((a.health_score ?? null) !== (b.health_score ?? null)) out.push(`wellness score: ${a.health_score ?? 'none'} -> ${b.health_score ?? 'none'}`);
  if ((a.other_products?.count ?? null) !== (b.other_products?.count ?? null)) out.push(`other products in this range: ${a.other_products?.count ?? 'not recorded'} -> ${b.other_products?.count ?? 'none'}`);
  else {
    const OA = (a.other_products?.items || []).map(p => p.name), OB = (b.other_products?.items || []).map(p => p.name);
    if (OA.length && OB.length) sets('other products', OA, OB);
  }
  if ((a.health_band ?? null) !== (b.health_band ?? null)) out.push(`wellness band: ${a.health_band ?? 'none'} -> ${b.health_band ?? 'none'}`);
  if (a.heading !== b.heading) out.push(`the webapp's heading: ${JSON.stringify(a.heading)} -> ${JSON.stringify(b.heading)}`);
  if (a.intro !== b.intro) out.push(`the webapp's intro sentence: ${JSON.stringify(a.intro)} -> ${JSON.stringify(b.intro)}`);
  return out;
}

/* ---- drawing ------------------------------------------------------------------- */
/* The webapp's icon rules (lib/report/usage-icons.ts), and the glyphs this page
   has for them. A name the webapp knows and the page has no glyph for (candy,
   droplet, cookie) is a refusal, not a blank: a card with an empty icon slot
   would ship looking broken. */
const TIMING = [
  [/\b(bed|bedtime|night|nightly|nighttime|evening|sleep|sleeping)\b/, 'moon'],
  [/\b(morning|breakfast|wake|waking|sunrise|am)\b/, 'sun'],
  [/\b(meal|meals|food|eat|eating|lunch|dinner|supper|snack)\b/, 'utensils'],
];
const SERVING = [
  [/\b(tablet|tablets|caplet|caplets)\b/, 'tablets'],
  [/\b(gummy|gummies|pastille|pastilles)\b/, 'candy'],
  [/\b(capsule|capsules|softgel|softgels|soft gel|soft gels|soft-gel)\b/, 'pill'],
  [/\b(powder|powders|scoop|scoops|shake|shakes)\b/, 'soup'],
  [/\b(liquid|drop|drops|dropper|tincture|oil|oils|spray|sprays)\b/, 'droplet'],
  [/\b(drink|sachet|sachets|stick|sticks|effervescent)\b/, 'glass-water'],
  [/\b(bar|bars)\b/, 'cookie'],
];
const iconName = (text, table, fallback) => {
  const words = text.toLowerCase().replace(/[-/]+/g, ' ');
  for (const [re, name] of table) if (re.test(words)) return name;
  return fallback;
};
const G = '<svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const GLYPH = {
  sun: `${G}<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  moon: `${G}<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>`,
  utensils: `${G}<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  clock: `${G}<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  tablets: `${G}<circle cx="7" cy="7" r="5"/><circle cx="17" cy="17" r="5"/><path d="M12 17h10"/><path d="m3.46 10.54 7.08-7.08"/></svg>`,
  pill: `${G}<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
  soup: `${G}<path d="M11.248 3c.273.1.808.53.747 1.36-.05.83-.938 1.2-.989 2.02-.06.78.333 1.24.727 1.62"/><path d="M16.252 3c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.725 1.62"/><path d="M19.5 12 22 6"/><path d="M4 12a1 1 0 00-.99 1.133A9 9 0 0012 21a9 9 0 008.99-7.867A1 1 0 0020 12z"/><path d="M6.252 3c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.725 1.62"/></svg>`,
  'glass-water': `${G}<path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"/><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"/></svg>`,
};
const glyph = (name, what) => {
  if (!GLYPH[name]) throw new Error(`no glyph on this page for "${name}" (${what}); the webapp has one and sample-report.html does not yet`);
  return GLYPH[name];
};
const WARN = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/></svg>';
const EXPAND = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
/* The photographs are the site's own, in rotation; the demo's products have none the site may use. */
const IMGS = ['daily-energy-blend-detail.jpg', 'daily-energy-blend-in-context.jpg', 'daily-energy-blend-front.jpg'];

/* Match dots: the webapp's five shades (lib/quiz/recommendation-view.ts, MATCH_DOT_SHADES) and the soft green behind an empty one. */
const DOT_SHADES = ['#C0DD97', '#97C459', '#639922', '#3B6D11', '#27500A'];
const DOT_OFF = 'rgb(99 153 34 / 0.18)';
const MATCH_LABEL = 'Your match';
const MATCH_ARIA = 'How well this fits your quiz answers';
/* The first nine alternatives show; the rest sit behind "Show N more" (wellness-report.tsx OPTIONAL_VISIBLE). */
const OTHERS_VISIBLE = 9;

/* A goal pill reads in the brand's accent when it is one of the customer's own goals (BenefitPills, matchesGoal). */
const tags = (ts, goals) => ts && ts.length ? `<div class="rp-tags">${ts.map(t => `<span${(goals || []).includes(t) ? ' class="is-goal"' : ''}>${esc(t)}</span>`).join('')}</div>` : '';
const subtags = ss => ss && ss.length ? `<div class="rp-sub">${ss.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : '';
const chips = xs => `<div class="rp-chips">${xs.map(x => `<span class="rp-chip">${esc(x)}</span>`).join('')}</div>`;
const subchips = xs => xs && xs.length ? `<div class="rp-chips rp-chips-sub">${xs.map(x => `<span class="rp-chip">${esc(x)}</span>`).join('')}</div>` : '';
const matchLine = m => {
  if (!m || !Number.isFinite(m.score)) return '';
  const n = Math.max(0, Math.min(5, m.score));
  const shade = DOT_SHADES[n - 1] || DOT_SHADES[0];
  return `<p class="rp-match" data-match="${n}"><span>${MATCH_LABEL}</span><span class="rp-dots" role="img" aria-label="${MATCH_ARIA}: ${n} / 5">`
    + [1, 2, 3, 4, 5].map(i => `<i style="background:${i <= n ? shade : DOT_OFF}"></i>`).join('') + '</span></p>';
};
const priceLine = p => p.price ? `<p class="rp-price">${esc(p.price)}</p>` : '';

/* The pieces every face of a card shares (wellness-report.tsx ProductCardFace, ProductRows). */
function cardParts(p, i, add, w, goals) {
  const name = esc(p.name);
  const img = `<img src="/images/${IMGS[i % IMGS.length]}" alt="" loading="lazy" decoding="async">`;
  const badge = p.tier ? `<span class="${p.tier === 'Recommended' ? 'rp-badge is-rec' : 'rp-badge'}">${esc(p.tier)}</span>` : '';
  const why = p.why ? `<p class="rp-why"><span class="sr-only">Why: </span>${esc(p.why)}</p>` : '';
  const warn = p.caution ? `<p class="sr-warn">${WARN}<span>${esc(p.caution)}</span></p>` : '';
  const desc = p.description ? `<p class="rp-desc">${esc(p.description)}</p>` : '';
  const use = `<p class="rp-use"><span>${glyph(iconName(p.timing, TIMING, 'clock'), `${w}: ${p.name}, timing "${p.timing}"`)}<span class="sr-only">When </span>${esc(p.timing)}</span>`
    + `<i aria-hidden="true">&#183;</i><span>${glyph(iconName(p.form, SERVING, 'pill'), `${w}: ${p.name}, serving "${p.form}"`)}<span class="sr-only">Serving </span>${esc(p.form)}</span></p>`;
  const buy = `${matchLine(p.match)}${priceLine(p)}<span class="rp-add">${add}</span>`;
  const expand = `<button type="button" class="rp-ex" aria-label="See everything about ${name}">${EXPAND}</button>`;
  /* the expanded face: photograph with the tier on it, the head, a scrolling middle, a pinned floor */
  const dialog = `<dialog class="rp-dialog" aria-label="${name}"><div class="rp-x"><button type="button" class="rp-x-close" aria-label="Close ${name}">${CLOSE}</button>`
    + `<div class="rp-x-media">${badge}${img}</div><div class="rp-x-body"><div class="rp-x-head"><p class="rp-x-name">${name}</p>${tags(p.tags, goals)}${subtags(p.subtags)}</div>`
    + `<div class="rp-x-main">${desc}${why}${use}</div><div class="rp-x-floor">${warn}${buy}</div></div></div></dialog>`;
  return { name, img, badge, why, warn, desc, use, buy, expand, dialog };
}

/* The compact card of the cards presentation: square photograph with the tier on it, a fixed-height body whose
   middle fades, and a floor with the dots, the price and the button. */
function cardCompact(p, i, add, w, goals, alt) {
  const c = cardParts(p, i, add, w, goals);
  return `<div class="rp-card${alt ? ' is-alt' : ''}"><div class="rp-ph">${c.badge}${c.expand}${c.img}</div>`
    + `<div class="rp-body"><div class="rp-head"><p class="rp-name">${c.name}</p></div>`
    + `<div class="rp-main">${tags(p.tags, goals)}${subtags(p.subtags)}${c.why}${c.desc}${c.use}${c.warn}<i class="rp-fade" aria-hidden="true"></i></div>`
    + `<div class="rp-floor">${c.buy}</div></div>${c.dialog}</div>`;
}

/* A row of the rows presentation: thumbnail, the words held to its height and faded, a side column with the dots,
   the price, the button and the expand. */
function cardRow(p, i, add, w, goals, alt) {
  const c = cardParts(p, i, add, w, goals);
  return `<div class="rp-card rp-row${alt ? ' is-alt' : ''}"><div class="rp-thumb">${c.img}</div>`
    + `<div class="rp-row-body"><div class="rp-row-head"><p class="rp-name">${c.name}</p>${c.badge}${tags(p.tags, goals)}</div>${subtags(p.subtags)}`
    + `<div class="rp-prose">${c.warn}${c.why}${c.desc}${c.use}</div></div>`
    + `<div class="rp-row-side"><div class="rp-row-buy">${c.buy}</div>${c.expand}</div>${c.dialog}</div>`;
}

const cardsOf = (ps, add, w, goals, pres, alt, offset) => ps.map((p, i) => (pres === 'rows' ? cardRow : cardCompact)(p, i + offset, add, w, goals, alt)).join('');

/* A list of cards in a presentation: a swipe row with its dots (the carousel), or rows. */
const list = (cards, pres, label) => pres === 'rows'
  ? `<div class="rp-rows">${cards}</div>`
  : `<div class="sr-row" aria-label="${esc(label)}, scroll sideways">${cards}</div><div class="sr-dots" aria-label="${esc(label)}, pages"></div>`;

const macro = m => `<div class="rp-mac"><p class="rp-ml">${esc(m.label)}</p><p class="rp-mv">${m.value}<em>${m.unit}</em></p>`
  + `<p class="rp-mt">${esc(m.target)}</p><div class="rp-mb ${m.cls}"><i style="width:${Math.min(m.pct, 100)}%"></i><span>${m.pct}%</span></div>`
  + `${m.note ? `<p class="rp-mn">${esc(m.note)}</p>` : ''}</div>`;

const group = g => `<p class="rp-grp">${esc(g.group)}</p>` + g.rows.map(r => `<div class="rp-bd"><span class="rp-bn">${esc(r.name)}</span><div><i class="rp-bt${r.cls ? ` ${r.cls}` : ''}"><b style="width:${Math.min(r.pct, 100)}%"></b></i>`
  + `<p>${esc(r.sources)}</p></div><span class="rp-bp${r.cls ? ` ${r.cls}` : ''}">${r.pct}%</span></div>`).join('');

/* The safety briefing as the webapp boxes it after the products: a title and one line per note, the lead in medium weight. */
function noticeSections(notices) {
  const byTitle = new Map();
  for (const n of notices) { if (!byTitle.has(n.title)) byTitle.set(n.title, []); byTitle.get(n.title).push(n); }
  return [...byTitle].map(([title, ns]) => `<div class="rp-s rp-s-notice"><div class="rp-brief"><h5>${esc(title)}</h5><ul>`
    + ns.map(n => `<li>${n.lead ? `<b>${esc(n.lead)}</b>: ` : ''}${esc(n.text)}</li>`).join('') + '</ul></div></div>').join('');
}

const scoreBox = rep => `<div class="rp-score"><p><b>${rep.health_score}</b><em>/100</em></p><i class="${rep.health_cls || ''}"><b style="width:${Math.max(0, Math.min(100, rep.health_score))}%"></b></i>`
  + `${rep.health_band ? `<p class="rp-good">${esc(rep.health_band)}</p>` : ''}${rep.health_text ? `<p class="rp-sn">${esc(rep.health_text)}</p>` : ''}</div>`;

/** The data-bearing regions of one report block rewritten; the chrome around them untouched. */
function redrawBlock(blk, rep, w) {
  const once = (s, re, fn, what) => {
    const m = re.exec(s);
    if (!m) throw new Error(`${cap(w)}'s report: cannot find ${what} on the page`);
    return s.slice(0, m.index) + fn(m) + s.slice(m.index + m[0].length);
  };
  const at = (s, needle, from, what) => { const i = s.indexOf(needle, from); if (i < 0) throw new Error(`${cap(w)}'s report: cannot find ${what} on the page`); return i; };
  const open = blk.slice(0, blk.indexOf('>') + 1);
  const pres = /data-presentation="rows"/.test(open) ? 'rows' : 'cards';
  const goals = rep.goals || [];

  blk = once(blk, /(<p class="rp-intro">[^<]*?)\d+( (?:key )?areas\b)/, m => `${m[1]}${rep.key_areas}${m[2]}`, 'the number of areas in the intro');
  blk = once(blk, /(<div class="rp-s rp-s-profile"><h5>[^<]*<\/h5>)<div class="rp-chips">.*?<\/div>/s, m => m[1] + chips(rep.profile), 'the profile chips');
  blk = once(blk, /(<div class="rp-s rp-s-goals"><h5>[^<]*<\/h5>)<div class="rp-chips">.*?<\/div>(?:<div class="rp-chips rp-chips-sub">.*?<\/div>)?/s, m => m[1] + chips(goals) + subchips(rep.subgoals), 'the goal chips');

  /* the picks: between the products section's list marker and its end; the button's label is the brand's, on the marker */
  const ps = at(blk, '<div class="rp-s rp-s-products">', 0, 'the products section');
  const pm = at(blk, '<div class="rp-list"', ps, 'the products list');
  const pa = /<div class="rp-list" data-add="([^"]*)" data-label="([^"]*)">/.exec(blk.slice(pm));
  if (!pa) throw new Error(`${cap(w)}'s report: the products list names no button label`);
  const add = pa[1], label = pa[2];
  const pe = at(blk, '<!--/list-->', pm, 'the end of the products list');
  blk = blk.slice(0, pm + pa[0].length) + list(cardsOf(rep.products, add, w, goals, pres, false, 0), pres, label) + blk.slice(pe);

  /* the alternatives: the first nine open, the rest behind "Show N more" */
  const items = rep.other_products?.items || [];
  const count = rep.other_products?.count ?? items.length;
  const o0 = at(blk, '<div class="rp-others-list">', 0, 'the list of other products') + '<div class="rp-others-list">'.length;
  const o1 = at(blk, '<!--/others-->', o0, 'the end of the list of other products');
  const first = items.slice(0, OTHERS_VISIBLE), rest = items.slice(OTHERS_VISIBLE);
  const others = list(cardsOf(first, add, w, goals, pres, true, rep.products.length), pres, 'Other products')
    + (rest.length ? `<details class="rp-more"><summary>Show ${rest.length} more</summary>${list(cardsOf(rest, add, w, goals, pres, true, rep.products.length + first.length), pres, 'More products')}</details>` : '');
  blk = blk.slice(0, o0) + others + blk.slice(o1);
  blk = once(blk, /<span class="rp-count">[^<]*<\/span>/, () => `<span class="rp-count">${count === 1 ? '1 product' : `${count} products`}</span>`, 'the count of other products');

  const m0 = at(blk, '<div class="rp-macs">', 0, 'the macros');
  const m1 = at(blk, '<p class="rp-foot">', m0, 'the note under the macros');
  blk = blk.slice(0, m0) + `<div class="rp-macs">${rep.macros.map(macro).join('')}</div>` + blk.slice(m1);

  /* the breakdown: everything after its heading row, up to the foot */
  const foot = at(blk, '<p class="rp-foot">', m0, 'the note under the macros');
  const d0 = at(blk, '<div class="rp-d">', foot, 'the breakdown');
  const h0 = at(blk, '</div>', d0 + 1, 'the breakdown heading') + '</div>'.length;
  const f0 = at(blk, '<div class="rp-s rp-s-foot"', h0, 'the disclaimer');
  blk = blk.slice(0, h0) + rep.breakdown.map(group).join('') + '</div></div>' + blk.slice(f0);

  blk = blk.replace(/<div class="rp-s rp-s-notice">.*?<\/ul><\/div><\/div>/gs, '');
  const r0 = at(blk, '<div class="rp-s rp-s-retake">', 0, 'the retake line');
  blk = blk.slice(0, r0) + noticeSections(rep.notices || []) + blk.slice(r0);

  /* a score the engine supplied replaces the stand-in; a block without a score section draws none */
  if (rep.health_score != null && blk.includes('<div class="rp-score"')) {
    blk = once(blk, /<div class="rp-score"[^>]*>.*?<\/div>/s, () => scoreBox(rep), 'the score');
  }
  return blk;
}

/** The three blocks on the page, in the order the page draws them: [start, end). */
function blocksOf(page) {
  const starts = [...page.matchAll(/<div class="rp sr-report"/g)].map(m => m.index);
  if (starts.length !== WHO.length) throw new Error(`the page draws ${starts.length} report(s); ${WHO.length} personas have a file`);
  const tail = page.indexOf('<div class="report-foot">', starts[starts.length - 1]);
  if (tail < 0) throw new Error('the page has no report-foot after the last report');
  return starts.map((s, k) => [s, k + 1 < starts.length ? starts[k + 1] : tail]);
}

function redrawReports(page, reports) {
  const spans = blocksOf(page);
  let out = '', last = 0;
  WHO.forEach((w, k) => {
    const [s, e] = spans[k];
    out += page.slice(last, s);
    out += reports[w] ? redrawBlock(page.slice(s, e), reports[w], w) : page.slice(s, e);
    last = e;
  });
  return out + page.slice(last);
}

function redrawAnswers(page, w, rows) {
  const dl = `<dl class="answers-all" id="answers-grid-${w}" hidden="">` + rows.map(r => `<div><dt>${esc(r.q)}</dt><dd>${esc(r.a)}</dd></div>`).join('') + '</dl>';
  const list = new RegExp(`<dl class="answers-all" id="answers-grid-${w}" hidden="">.*?</dl>`, 's');
  if (!list.test(page)) throw new Error(`${cap(w)}'s answers card has no transcript to redraw`);
  page = page.replace(list, () => dl);
  const btn = new RegExp(`(<button type="button" class="answers-more" aria-controls="answers-grid-${w}" aria-expanded="false">)See all \\d+ answers(</button>)`);
  if (!btn.test(page)) throw new Error(`${cap(w)}'s answers card has no "See all" button to recount`);
  return page.replace(btn, `$1See all ${rows.length} answers$2`);
}

/* ---- the files ----------------------------------------------------------------- */
function how(w, n, run, rep) {
  const score = rep.health_score == null
    ? "The demo's published report configuration keeps the wellness score off, so the results page shows none and this file carries none."
    : `The results page showed a wellness score of ${rep.health_score}, recorded as health_score.`;
  return `POST .../complete on the live demo (app.blend-technologies.com, the Blend Demo tenant, embed ${KEY}, publication ${run.publication_id || 'not recorded'}), ${run.completed.slice(0, 10)}, `
    + `replaying the request below through the public embed API exactly as the quiz runtime does: ${n} answers by their stable ids, one PUT per question, then complete. `
    + `Submission ${run.submission_id}, recommendation ${run.recommendation_id || 'not recorded'}, HTTP 200, ${rep.products.length} products from the demo catalogue. `
    + `The figures below were read from that submission's rendered results page by tools/replay-sample-report.mjs (a headless browser over the live page), and each macro's colour is the bar colour it drew. `
    + `The submission's country is whatever the server read from the request's origin; the embed API does not return it. ${score} `
    + `The brand's description for each product is the first paragraph its expanded card shows; the claim, the timing sentence and the ingredients that follow it are not drawn here, as before. `
    + `The page's goal pills, sub-goal pills and "Your match" dots are recorded for each product (tags, subtags, match) and the goal pills under the heading (goals, subgoals), and drawn as the webapp draws them on 2026-11-20. `
    + `The products under "Other products in this range" are recorded in full under other_products.items and drawn the same way, the first nine open and the rest behind "Show N more", as the webapp does. `
    + `To refresh: node tools/replay-sample-report.mjs --write ${w}.`;
}

function writePersona(w, run, rep, n) {
  const old = files[w];
  const data = {
    _: `The report /sample-report draws for ${cap(w)}, from the engine's own output. tools/check-sample-report.mjs holds that report to this file.`,
    _how: how(w, n, run, rep),
    _display: old._display,
    persona: w,
    request: old.request,
    run,
    report: rep,
  };
  writeFileSync(fileOf(w), JSON.stringify(data, null, 1) + '\n');
  files[w] = data;
}

function writeDemoAnswers(rows, run) {
  const da = JSON.parse(read(DEMO_ANSWERS));
  da.count = rows.length;
  da.answers = rows.map(r => (r.parts && r.parts.length > 1 ? { q: r.q, a: r.a, parts: r.parts } : { q: r.q, a: r.a }));
  da._how = `Alex's ${rows.length} answers as the live demo stored them, read back from GET .../submissions/${run.submission_id} on ${run.completed.slice(0, 10)} after the replay recorded in sample-report-alex.json. Regenerated by tools/replay-sample-report.mjs, not edited by hand.`;
  writeFileSync(DEMO_ANSWERS, JSON.stringify(da, null, 1) + '\n');
}

function stampManifest(runs) {
  const m = JSON.parse(read(MANIFEST));
  for (const [w, run] of Object.entries(runs)) {
    const p = m.pieces.find(x => x.id === `sample-report-${w}`);
    if (!p) throw new Error(`sources.json has no piece sample-report-${w}`);
    p.last_refreshed = { date: run.completed.slice(0, 10), workspace_commit: null, note: `Submission ${run.submission_id}.` };
  }
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
}

function runCheck() {
  try {
    const out = execFileSync(process.execPath, [join(ROOT, 'tools/check-sample-report.mjs')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(out.trim());
    return true;
  } catch (e) {
    console.error((e.stdout || '') + (e.stderr || ''));
    return false;
  }
}

function keepFile(name, text) {
  if (!keep) return;
  mkdirSync(keep, { recursive: true });
  writeFileSync(join(keep, name), text);
}

/* ---- modes --------------------------------------------------------------------- */
function redrawMode() {
  const check = flag('--check');
  const page = read(PAGE);
  const drawn = redrawReports(page, Object.fromEntries(WHO.map(w => [w, files[w].report])));
  if (drawn === page) {
    console.log(`PASSED: sample-report.html is what the three files draw; nothing to ${check ? 'change' : 'write'}.`);
    return;
  }
  if (check) {
    const d = drawn.length - page.length;
    console.error(`FAILED: sample-report.html is not what sample-report-{alex,sam,helen}.json draw (${d > 0 ? '+' : ''}${d} bytes).`);
    console.error('The product cards, chips, macros, breakdown and notices of each report are drawn from its file by tools/replay-sample-report.mjs.');
    console.error('Change the file and run --redraw, or change the drawing in the tool; do not edit those regions of the page by hand.');
    process.exit(1);
  }
  writeFileSync(PAGE, drawn);
  console.log(`sample-report.html redrawn from the three files (${drawn.length - page.length > 0 ? '+' : ''}${drawn.length - page.length} bytes).`);
  if (!runCheck()) process.exit(1);
}

async function main() {
  if (mode === 'redraw') return redrawMode();
  const say = (...a) => console.log(...a);
  const failed = [];      /* personas this run could not measure, with why */
  const results = {};     /* w -> { run, rep, rows, moved } */

  if (mode === 'plan' || mode === 'report' || mode === 'write') {
    const quiz = await liveQuiz();
    const recorded = new Set(WHO.map(w => files[w].run?.publication_id).filter(Boolean));
    say(`Live demo quiz: publication ${quiz.publicationId}, ${quiz.definition.questions.length} questions`
      + (recorded.size === 1 && recorded.has(quiz.publicationId) ? ' (the one the recorded runs answered).' : ` (the recorded runs answered ${[...recorded].join(', ') || 'an unrecorded publication'}: the demo has published since).`));
    const plans = {};
    for (const w of personas) {
      if (GIVEN[w] && mode !== 'plan') { say(`${cap(w)}: submission ${GIVEN[w].submission_id} given; its page is read and nothing is replayed.`); continue; }
      const { steps, issues } = plan(files[w].request, quiz);
      plans[w] = steps;
      const n = files[w].request.choices.length + files[w].request.values.length;
      if (issues.length) {
        say(`${cap(w)}: the recorded ${n} answers no longer fit the live quiz:`);
        for (const i of issues) say(`  ${i}`);
        failed.push(`${w}: the request needs a hand (${issues.length} issue${issues.length > 1 ? 's' : ''} above)`);
      } else say(`${cap(w)}: ${steps.length} answers planned, every one the quiz would ask.`);
    }
    if (mode === 'plan') {
      say('');
      say(failed.length ? `${failed.length} persona(s) cannot be replayed as recorded.` : 'All recorded requests still fit. --report replays them (it creates submissions on the demo).');
      process.exit(failed.length ? 1 : 0);
    }

    say('');
    const toReplay = personas.filter(w => !GIVEN[w] && plans[w] && !failed.some(f => f.startsWith(`${w}:`)));
    if (toReplay.length) say(`${mode === 'write' ? 'Replaying and writing' : 'Replaying, writing nothing'}. Each persona creates one submission on the Blend Demo tenant; it counts in the demo's analytics.`);
    for (const w of personas) {
      if (GIVEN[w]) { results[w] = { run: { ...GIVEN[w], publication_id: null, completed: null }, given: true, n: null }; continue; }
      if (!plans[w] || failed.some(f => f.startsWith(`${w}:`))) continue;
      try {
        const run = await replay(w, plans[w], quiz.publicationId, say);
        say(`${cap(w)}: submission ${run.submission_id}, recommendation ${run.recommendation_id}, ${plans[w].length} answers.`);
        results[w] = { run, n: plans[w].length };
      } catch (e) {
        failed.push(`${w}: ${e.message}`);
        say(`${cap(w)}: FAILED, ${e.message}`);
      }
    }
  } else {
    for (const w of personas) {
      if (GIVEN[w]) { results[w] = { run: { ...GIVEN[w], publication_id: null, completed: null }, given: true, n: null }; continue; }
      const run = files[w].run;
      if (!run?.submission_id) { failed.push(`${w}: the file records no submission to read again`); continue; }
      results[w] = { run, n: files[w].request.choices.length + files[w].request.values.length };
    }
    say(`Reading the ${Object.values(results).some(r => r.given) ? 'given' : 'recorded'} submissions' results pages again; no new submission.`);
  }

  const todo = Object.keys(results);
  if (todo.length) {
    const browser = await openBrowser();
    try {
      for (const w of todo) {
        const r = results[w];
        try {
          const { raw, html } = await extract(browser, r.run.submission_id);
          keepFile(`results-${w}.html`, html);
          keepFile(`extract-${w}.json`, JSON.stringify(raw, null, 1));
          const sub = await submission(r.run.submission_id);
          keepFile(`submission-${w}.json`, JSON.stringify(sub, null, 1));
          if (r.given) {
            /* the submission's own record of when and against which publication, where the API says; else today and unrecorded */
            r.run.publication_id = sub.publicationId ?? sub.publication_id ?? null;
            r.run.completed = sub.completedAt ?? sub.completed_at ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z');
          }
          keepFile(`run-${w}.json`, JSON.stringify(r.run, null, 1));
          const { report, problems } = shape(raw, files[w]);
          if (problems.length) {
            failed.push(`${w}: PROBE SUSPECT, nothing of it is believed: ${problems.join('; ')}`);
            delete results[w];
            continue;
          }
          r.rep = report;
          r.rows = transcript(sub);
          if (r.n == null) r.n = r.rows.length;
          r.moved = compare(files[w].report, report);
        } catch (e) {
          failed.push(`${w}: ${e.message}`);
          delete results[w];
        }
      }
    } finally { await browser.close(); }
  }

  say('');
  for (const w of personas) {
    const r = results[w];
    if (!r) continue;
    const page = `${BASE}/quiz/${KEY}/results/${r.run.submission_id}`;
    say(`${cap(w).toUpperCase()}  ${r.rep.products.length} products, ${r.rep.macros.length} macros, ${r.rep.breakdown.reduce((a, g) => a + g.rows.length, 0)} breakdown rows, ${r.rep.notices.length} notice(s), score ${r.rep.health_score ?? 'off'}`);
    say(`  ${page}`);
    if (r.moved.length) { say(`  MOVED since the file (${files[w].run?.completed?.slice(0, 10) || files[w].last_refreshed?.date || 'its record'}):`); for (const m of r.moved) say(`    ${m}`); }
    else say('  nothing moved: the page shows what the file records');
    const oldRows = files[w].request.choices.length + files[w].request.values.length;
    if (r.rows.length !== oldRows) say(`  the demo stored ${r.rows.length} answers; the request has ${oldRows}`);
  }

  if (mode === 'write') {
    const written = [];
    let page = read(PAGE);
    const reports = {};
    for (const [w, r] of Object.entries(results)) {
      writePersona(w, r.run, r.rep, r.n);
      reports[w] = r.rep;
      written.push(w);
    }
    if (written.length) {
      page = redrawReports(page, reports);
      for (const [w, r] of Object.entries(results)) page = redrawAnswers(page, w, r.rows);
      writeFileSync(PAGE, page);
      if (results.alex) writeDemoAnswers(results.alex.rows, results.alex.run);
      stampManifest(Object.fromEntries(written.map(w => [w, results[w].run])));
      say('');
      say(`Written: ${written.map(w => `sample-report-${w}.json`).join(', ')}, sample-report.html${results.alex ? ', demo-answers.json' : ''}; sources.json stamped.`);
      if (!runCheck()) failed.push('tools/check-sample-report.mjs refused the result');
    } else say('\nNothing written.');
  } else if (mode === 'report') {
    const moved = Object.values(results).filter(r => r.moved.length).length;
    say('');
    say(moved ? `${moved} report(s) would change. --write replays again and writes; the founder decides on desktop.` : 'Nothing would change on the page; --write would only record today\'s submissions.');
  }

  if (failed.length) {
    console.error('\nNOT MEASURED:\n  ' + failed.join('\n  '));
    console.error('\nA persona that was not measured is reported from its file, not from the demo.');
    process.exit(1);
  }
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
