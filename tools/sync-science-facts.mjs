#!/usr/bin/env node
/**
 * Writes the engine-derived parts of science.html from the engine's own export.
 *
 * WHY THIS EXISTS. /science is the page that says the model can be audited, so
 * it is the page that can least afford a figure nobody can reproduce. Its
 * numbers used to be typed by hand and had drifted: the strip claimed 30+
 * scored product attributes where the scorer reads 25, and the goal rails
 * showed 37 of the engine's 41 goals under a heading promising every goal a
 * customer can pick.
 *
 *   node tools/sync-science-facts.mjs           rewrite the marked regions
 *   node tools/sync-science-facts.mjs --check   refuse if they are out of date
 *
 * Sources, both generated in the engine repo and copied in with the rest of
 * the mockup export:
 *   blend-mockups/science/science-facts.json   export_science_facts.py
 *   blend-mockups/science/engine-trace.json    export_engine_trace.py
 *
 * Everything between a science:x / /science:x marker pair belongs to this
 * script. To change one of those numbers, change the engine and regenerate.
 * Everything else on the page is prose and stays hand-written.
 *
 * Two kinds of claim are checked:
 *   exact  the page prints the engine's number, and any change fails --check
 *   floor  the page prints "200+", and the check asserts the engine clears it.
 *          A catalogue grows; a floor does not go stale the way 223 would.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'science.html');
const DIR = join(ROOT, 'blend-mockups', 'science');
const check = process.argv.includes('--check');

let facts, trace;
try {
  facts = JSON.parse(readFileSync(join(DIR, 'science-facts.json'), 'utf8'));
  trace = JSON.parse(readFileSync(join(DIR, 'engine-trace.json'), 'utf8'));
} catch (e) {
  // The export arrives with the mockups. Without it there is nothing to check
  // against, and failing here would block a merge on an unrelated branch.
  console.log('SKIPPED: blend-mockups/science/ is missing an export (run the engine\'s export_science_facts.py / export_engine_trace.py)');
  process.exit(0);
}

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/'/g, '&#8217;').replace(/—/g, '&#8212;').replace(/–/g, '&#8211;');
const num = n => Number(n).toLocaleString('en-GB');
const c = facts.counts;

/* ---- the model's own identity ------------------------------------------- */
const m = facts.model;
const model =
  `<b>${esc(m.name)}</b> <span class="sx-dot" aria-hidden="true"></span> v${esc(m.version)} ` +
  `<span class="sx-dot" aria-hidden="true"></span> API contract ${esc(m.contract_version)} ` +
  `<span class="sx-dot" aria-hidden="true"></span> <span class="sx-live">${esc(m.status === 'live' ? 'Live' : m.status)}</span>`;

/* ---- the stat strip ------------------------------------------------------ */
const FLOOR_PRODUCTS = 200;
const stats = [
  [`${FLOOR_PRODUCTS}+`, 'Products audited', 'Standardised so every score is comparable across the catalogue.'],
  [String(c.product_attributes), 'Product attributes', 'Ingredients, dosing, evidence, contraindications and synergies, all scored.'],
  [String(c.safety_gates), 'Safety gates', 'Any one of them can take a product out before ranking begins.'],
  [String(c.nutrients), 'Nutrients per person', 'Each with a target worked out for that person, not a population.'],
].map(([n, label, sub]) =>
  `      <div class="sx-stat"><div class="sx-n">${n}</div><div class="sx-label">${label}</div><div class="sx-sub">${sub}</div></div>`
).join('\n');

/* ---- one run, end to end ------------------------------------------------- */
const cust = trace.customer;
const chips = [
  ['', cust.name],
  ['Diet', cust.diet],
  ['Activity', cust.activity],
  ['Body mass', String(cust.bmi_status).replace(/\*+$/, '')],
  ['Condition', cust.condition],
  ['Goals', cust.goals],
  ['Health score', `${cust.health_score} / 100 ${cust.health_score_label}`],
].filter(([, v]) => v).map(([k, v]) =>
  `<span class="sx-chip">${k ? esc(k) + ' ' : ''}<b>${esc(v)}</b></span>`).join('');

// The funnel is the three counted lines of the scoring step, in their order.
const scoring = (trace.steps.find(s => /scoring/i.test(s.name)) || { lines: [] }).lines;
const funnel = scoring.filter(l => typeof l.value === 'number').slice(0, 3).map(l =>
  `      <div class="sx-fstep"><div class="sx-fn">${num(l.value)}</div><div class="sx-flabel">${esc(l.text)}</div></div>`
).join('\n');

const pad = n => String(n).padStart(2, '0');
const tabs = trace.steps.map((s, i) =>
  `      <button type="button" class="sx-step" role="tab" id="sx-tab-${s.id}" aria-controls="sx-panel-${s.id}" aria-selected="false" tabindex="-1">` +
  `<span class="sx-step-n" aria-hidden="true">${pad(i + 1)}</span>${esc(s.name)}</button>`
).join('\n');

const panels = trace.steps.map((s, i) => {
  const lines = s.lines.map(l => {
    // The trace writes "Product — reason" and then repeats the reason in
    // `value`. In a row with a right-hand column that printed the reason
    // twice and filled the panel with dashes, so the suffix comes off.
    let text = l.text;
    if (typeof l.value === 'string' && l.value && text.endsWith(' \u2014 ' + l.value)) {
      text = text.slice(0, -(l.value.length + 3));
    }
    return `        <div class="sx-line"><span class="sx-ltext">${esc(text)}</span>` +
    // The engine's own labels join two halves with a dash; a colon reads
    // better in a right-hand column.
    (l.value === undefined || l.value === null || l.value === '' ? '' : `<span class="sx-lvalue">${esc(String(l.value).replace(' \u2014 ', ': '))}</span>`) +
    (l.source ? `<span class="sx-lsource">${esc(l.source)}</span>` : '') +
    `</div>`;
  }).join('\n');
  return `      <div class="sx-panel" id="sx-panel-${s.id}" role="tabpanel" aria-labelledby="sx-tab-${s.id}" tabindex="0">\n` +
    `        <div class="sx-panel-head"><span class="sx-panel-t">${esc(s.name)}</span>` +
    `<span class="sx-panel-c">Step ${i + 1} of ${trace.steps.length}</span></div>\n${lines}\n      </div>`;
}).join('\n');

const traceBlock = [
  `    <div class="sx-who">${chips}</div>`,
  `    <div class="sx-funnel">`, funnel, `    </div>`,
  `    <div class="sx-steps" role="tablist" aria-label="The steps of one run">`, tabs, `    </div>`,
  panels,
  `    <p class="sx-foot">${esc(trace.catalogue.note)} Every line above is from the run itself.</p>`,
].join('\n');

/* ---- the gates ----------------------------------------------------------- */
// Biggest group first, so the card grid fills rather than stepping down.
const byGroup = new Map();
for (const g of facts.safety_gates) {
  if (!byGroup.has(g.group)) byGroup.set(g.group, []);
  byGroup.get(g.group).push(g.name);
}
const groups = [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const gateCards = groups.map(([group, names]) =>
  `      <div class="sx-gate">\n` +
  `        <div class="sx-gate-head"><span class="sx-gate-name">${esc(cap(group))}</span><span class="sx-gate-n">${names.length}</span></div>\n` +
  `        <ul>${names.map(n => `<li>${esc(n)}</li>`).join('')}</ul>\n      </div>`
).join('\n');

const other = facts.non_safety_gates || [];
const gates = [
  `    <p class="sx-foot" style="margin:0 auto 28px">${c.safety_gates} gates, in ${groups.length} groups.</p>`,
  `    <div class="sx-gates">`, gateCards,
  `      <div class="sx-aside">`,
  `      <h3>And ${other.length} more that are not safety</h3>`,
  `      <p>These shape a sensible plan rather than a safe one. They stop the same active turning up twice, and drop what the person already gets from food. They are counted separately because calling them safety checks would overstate what runs.</p>`,
  `        <div class="sx-aside-list">${other.map(g => `<span>${esc(g.name)}</span>`).join('')}</div>`,
  `      </div>`,
  `    </div>`,
].join('\n');

/* ---- thresholds ---------------------------------------------------------- */
const th = facts.recommendation_thresholds;
const rows = th.nutrients.map(n => {
  const target = n.target_reference_adult != null
    ? `${num(n.target_reference_adult)} ${esc(n.target_unit || '')}`.trim()
    : `<span style="color:var(--ink-60)">per person, from body weight and goal</span>`;
  const ul = n.upper_limit != null ? num(n.upper_limit) + (n.target_unit ? ' ' + esc(String(n.target_unit).split(' ')[0]) : '') : 'None';
  return `        <tr><td>${esc(n.nutrient)}</td><td>${num(n.shortfall_pct)}%</td>` +
    `<td><span class="sx-strict is-${esc(n.strictness)}">${esc(cap(n.strictness))}</span></td>` +
    `<td>${ul}</td><td>${target}</td></tr>`;
}).join('\n');

const thresholds = [
  `    <div class="sx-tw">`,
  `      <table class="sx-th">`,
  `        <thead><tr><th>Nutrient</th><th>Shortfall before recommending</th><th>Bar</th><th>Upper limit</th><th>Reference target, adult</th></tr></thead>`,
  `        <tbody>`, rows, `        </tbody>`,
  `      </table>`,
  `    </div>`,
  `    <p class="sx-foot">Default where a nutrient has no band of its own: ${num(th.default_shortfall_before_recommend * 100)}%. ` +
  `Reference targets are for a woman aged 31 to 50 in the UK with no diet modifier. Every real target is computed for the person.</p>`,
].join('\n');

/* ---- sources ------------------------------------------------------------- */
const srcCard = (a, role) =>
  `      <a class="sx-card" href="${esc(a.url)}" target="_blank" rel="noopener">` +
  `<span class="sx-card-role">${role}</span>` +
  `<div class="sx-card-n">${esc(a.name)}</div>` +
  `<div class="sx-card-f">${esc(a.full_name)}</div>` +
  `<span class="sx-card-l">Dietary reference values</span></a>`;
const sources = [
  `    <div class="sx-src">`,
  srcCard(facts.authorities.default, 'Default authority'),
  ...facts.authorities.secondary.map(a => srcCard(a, 'Secondary')),
  `    </div>`,
].join('\n');

/* ---- the goal rails and the map behind them ------------------------------ */
// "None of the above." is a quiz option, not a signal the engine reads, so it
// is the one thing dropped on the way from the taxonomy to the page.
const goals = facts.goals.map(g => ({
  goal: g.goal,
  subgoals: g.subgoals.filter(s => s.trim().toLowerCase() !== 'none of the above.'),
}));
const chip = g => `<button class="gm-chip" data-goal="${esc(g)}">${esc(g)}</button>`;
// Each rail is printed twice: the marquee loops by scrolling one full copy.
const rail = (cls, list) =>
  `    <div class="gm-rail ${cls}">${[...list, ...list].map(g => chip(g.goal)).join('')}</div>`;
const half = Math.ceil(goals.length / 2);
const rails = [rail('a', goals.slice(0, half)), rail('b', goals.slice(half))].join('\n');

const map = {};
for (const g of goals) map[g.goal] = g.subgoals;
const subs = `const GOAL_SUBS = ${JSON.stringify(map)};`;

/* ---- splice -------------------------------------------------------------- */
// The first regions sit in markup, the last inside a <script>, where an HTML
// comment is not a comment: `/* <!-- x --> */` round the const put the whole
// declaration inside one block comment the moment this script rewrote between
// the two halves, and GOAL_SUBS stopped existing. The JS region gets JS markers.
const h = n => [`<!-- science:${n} -->`, `<!-- /science:${n} -->`];
const REGIONS = [
  ['model', model, ...h('model')],
  ['stats', stats, ...h('stats')],
  ['trace', traceBlock, ...h('trace')],
  ['gates', gates, ...h('gates')],
  ['thresholds', thresholds, ...h('thresholds')],
  ['sources', sources, ...h('sources')],
  ['goal-rails', rails, ...h('goal-rails')],
  ['goal-subs', subs, '/* science:goal-subs */', '/* /science:goal-subs */'],
];

let page = readFileSync(PAGE, 'utf8');
const before = page;
const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [name, body, open, close] of REGIONS) {
  const re = new RegExp(`(${rx(open)}\\n?)[\\s\\S]*?(\\n?${rx(close)})`);
  if (!re.test(page)) {
    console.error(`FAILED: science.html has no ${open} region`);
    process.exit(1);
  }
  page = page.replace(re, (_, o, cl) => o + body + cl);
}

/* ---- floor claims -------------------------------------------------------- */
if (c.products_audited < FLOOR_PRODUCTS) {
  console.error(`FAILED: the page claims ${FLOOR_PRODUCTS}+ products audited; the engine has ${c.products_audited}`);
  process.exit(1);
}

const signals = goals.reduce((n, g) => n + g.subgoals.length, 0);
const summary = `${c.products_audited} products audited, ${c.product_attributes} attributes, ` +
  `${c.safety_gates} safety gates, ${goals.length} goals, ${signals} signals, ` +
  `${trace.steps.length} trace steps`;

if (check) {
  if (page !== before) {
    console.error('FAILED: science.html is out of date with blend-mockups/science/. Run: node tools/sync-science-facts.mjs');
    process.exit(1);
  }
  console.log(`PASSED: science.html matches the engine — ${summary}.`);
} else {
  if (page !== before) writeFileSync(PAGE, page);
  console.log(`${page !== before ? 'updated' : 'unchanged'}: ${summary}.`);
}
