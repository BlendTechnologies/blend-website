#!/usr/bin/env node
/**
 * Writes the whole of /science from the engine's own export.
 *
 * WHY THIS EXISTS. /science is the page that says the model can be audited,
 * so it is the page that can least afford a figure nobody can reproduce. It
 * used to be typed by hand and it drifted: the strip claimed 30+ scored
 * attributes where the engine records 25, and the goal rails showed 37 of 41
 * goals under a heading promising every goal a customer can pick.
 *
 *   node tools/sync-science-facts.mjs           rewrite the page
 *   node tools/sync-science-facts.mjs --check   refuse if it is out of date
 *
 * Sources, both generated in the engine repo and copied in with the mockups:
 *   blend-mockups/science/science-facts.json   export_science_facts.py
 *   blend-mockups/science/engine-trace.json    export_engine_trace.py
 *
 * Everything between <!-- science:body --> and its closing marker belongs to
 * this script. Prose that states no fact is written here, in the templates
 * below; every number, name, check, target, source and run line is read.
 *
 * The page is generated for the live vertical AND carries the whole export
 * as JSON, so the category selector can rebuild the vertical-specific
 * sections in the browser. Turning on Beauty is then a data change: the
 * export grows a vertical with counts, the selector enables it.
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
  console.log("SKIPPED: blend-mockups/science/ is missing an export (run the engine's exporters)");
  process.exit(0);
}

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/'/g, '&#8217;').replace(/\u2014/g, '&#8212;').replace(/\u2013/g, '&#8211;');
const num = n => Number(n).toLocaleString('en-GB');
const pad = n => String(n).padStart(2, '0');
const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const sentence = s => { const t = cap(String(s).trim()); return /[.!?]$/.test(t) ? t : t + '.'; };

const V = facts.verticals;
const liveKey = Object.keys(V).find(k => V[k].status === 'live');
if (!liveKey) { console.error('FAILED: no live vertical in the export'); process.exit(1); }
const h = V[liveKey];

/* ---- 1. hero --------------------------------------------------------------
   The same hero as every other inner page, on black: the index component
   carries the verticals rather than steps, so it has no numbers. */
const verts = Object.entries(V).map(([key, v]) => {
  const live = v.status === 'live';
  const label = key === 'health' ? 'Health and wellness' : cap(key);
  return live
    ? `<a class="ph-ix-item is-on" href="#run" data-vertical="${esc(key)}" aria-current="true"><span class="ph-ix-line" aria-hidden="true"></span><span class="ph-ix-name">${esc(label)}</span></a>`
    : `<span class="ph-ix-item is-off" data-vertical="${esc(key)}" tabindex="0" role="note"><span class="ph-ix-name">${esc(label)}</span><span class="sci-tip">Coming soon</span></span>`;
}).join('');

const hero = `<section class="ph ph--fill sc-hero" data-sc="hero">
  <div class="wrap">
    <div class="ph-inner">
      <span class="eyebrow">The science</span>
      <h1 class="h1">A scoring model you can audit, line by line.</h1>
      <p class="lead">One model per category. Every pick scored, safety-checked and explained.</p>
      <p class="ph-meta">Live for Health &amp; Wellness <span class="ph-dot" aria-hidden="true"></span> Built for any catalogue</p>
      <div class="ph-ctas">
        <a href="#run" class="btn btn-primary btn-lg">See a real run</a>
        <a href="mailto:contact@blend-technologies.com?subject=Blend%20methodology" class="btn btn-ghost btn-lg">Request the methodology</a>
      </div>
    </div>
    <nav class="ph-ix sci-verts" aria-label="Categories" style="--ph-ix:${Object.keys(V).length}">${verts}</nav>
  </div>
  <button type="button" class="sc-cue" data-sc-cue="#run" aria-label="Scroll to content"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</section>`;

/* ---- 2. one real run -------------------------------------------------------
   A short label for what was asked, so a value is never bare and the whole
   quiz question is never printed. The map shortens; it states nothing. */
const ASKED = [
  [/dietary preferences|restrictions/i, 'Diet'],
  [/fish and seafood/i, 'Fish'],
  [/dairy/i, 'Dairy'],
  [/vegetables and legumes/i, 'Vegetables'],
  [/meals and snacks/i, 'Meals'],
  [/usual portions/i, 'Portions'],
  [/weekly eating habits/i, 'Eating habits'],
  [/how active is your daily routine/i, 'Daily activity'],
  [/smoke|nicotine/i, 'Smoking'],
  [/hours do you sleep/i, 'Sleep'],
  [/drinks other than water/i, 'Drinks a day'],
  [/sun exposure/i, 'Sun exposure'],
  [/alcoholic drinks/i, 'Alcohol a week'],
  [/medical conditions/i, 'Conditions'],
  [/prescription medications/i, 'Medication'],
  [/pregnant or breastfeeding/i, 'Pregnancy'],
  [/popular goals|which resonate/i, 'Goals'],
];
const asked = q => (ASKED.find(([re]) => re.test(q || '')) || [null, (q || '').replace(/\?$/, '')])[1];

const c = trace.customer;
const steps = trace.steps;
const stepName = n => /food already gives/i.test(n) ? 'Intake' : n;

const tabs = steps.map((s, i) =>
  `<button type="button" role="tab" class="sci-tab" id="sci-tab-${s.id}" aria-controls="sci-p-${s.id}" aria-selected="${i === 0 ? 'true' : 'false'}" tabindex="${i === 0 ? '0' : '-1'}">${esc(stepName(s.name))}</button>`).join('');

const fact = (label, value) =>
  `<span class="sci-fact"><b>${esc(label)}</b>${esc(value)}</span>`;

const row = (t, v, s, cls = '') =>
  `<div class="sci-row${cls}"><span class="sci-row-t">${esc(t)}</span>` +
  (v == null || v === '' ? '' : `<span class="sci-row-v">${esc(v)}</span>`) +
  (s ? `<span class="sci-row-s">${esc(s)}</span>` : '') + '</div>';

/* Intake against her own target, so a bar means something. */
const targetsStep = steps.find(s => s.per_nutrient && s.authority) || { per_nutrient: [] };
const targetOf = new Map(targetsStep.per_nutrient.map(t => [t.nutrient, t]));

function panelBody(s) {
  if (s.groups) {
    const profile = `<div class="sci-siggroup"><h4>Profile</h4><div class="sci-facts">` +
      [['Name', c.name], ['Age', c.age], ['Sex', c.sex], ['Height', c.height], ['Weight', c.weight], ['Country', c.country]]
        .filter(([, v]) => v).map(([k, v]) => fact(k, v)).join('') + `</div></div>`;
    const g = s.groups.map(gr => {
      const lines = gr.lines || [];
      return `<div class="sci-siggroup"><h4>${esc(gr.group)}</h4><div class="sci-facts">` +
        lines.map(l => `<button type="button" class="sci-fact is-tap" data-changes="${esc(l.changes || '')}"><b>${esc(asked(l.question))}</b>${esc(l.answer || l.text)}</button>`).join('') +
        `</div><p class="sci-sigwhy" data-why>${esc((lines[0] || {}).changes || '')}</p></div>`;
    }).join('');
    const d = (s.derived || []).length
      ? `<div class="sci-siggroup"><h4>Derived, not asked</h4><div class="sci-facts">` +
        s.derived.map(l => `<button type="button" class="sci-fact is-tap" data-changes="${esc(l.changes || '')}"><b>${esc(l.text)}</b>${esc(l.value)}</button>`).join('') +
        `</div><p class="sci-sigwhy" data-why>${esc((s.derived[0] || {}).changes || '')}</p></div>`
      : '';
    return profile + g + d;
  }
  if (s.per_nutrient && s.already_met_by_diet) {
    const met = new Set(s.already_met_by_diet.nutrients_reading_as_met || []);
    return s.per_nutrient.map(x => {
      const t = targetOf.get(x.nutrient);
      const pct = t && t.target ? (x.intake_from_food || 0) / t.target : null;
      const v = `${num(Math.round((x.intake_from_food || 0) * 10) / 10)} ${x.unit || ''}`.trim() +
        (t ? ` of ${num(t.target)} ${t.unit || ''}`.trimEnd() : '');
      return `<div class="sci-row"><span class="sci-row-t">${esc(x.nutrient)}` +
        (met.has(x.nutrient) ? `<span class="sci-met">Already met by diet</span>` : '') +
        `</span><span class="sci-row-v">${esc(v)}</span>` +
        (pct != null ? `<div class="sci-bar ${met.has(x.nutrient) ? 'is-ok' : ''}"><i style="--v:${Math.max(.02, Math.min(1, pct)).toFixed(3)}"></i></div>` : '') +
        `</div>`;
    }).join('');
  }
  if (s.per_nutrient && s.authority) {
    const a = s.authority;
    return row(`Targets for ${a.market}`, a.name) +
      s.per_nutrient.map(x => row(x.nutrient, `${num(x.target)} ${x.unit || ''}`.trim())).join('');
  }
  if (s.ranking_order) {
    const hit = new Set((s.top_candidates || []).map(t => t.ranked_by));
    const ladder = `<div class="sci-ladder">` + s.ranking_order.map((t, i) =>
      `<div class="sci-tier${hit.has(t) ? ' is-hit' : ''}"><b>${pad(i + 1)}</b><span>${esc(t)}</span></div>`).join('') + `</div>`;
    const cand = (s.top_candidates || []).map(t =>
      row(`${t.position}. ${t.product}`, '', t.factors ? t.factors.join(' · ') : '')).join('');
    return ladder + (cand ? `<div class="sci-after">${cand}</div>` : '');
  }
  if (s.removed) {
    return s.removed.map(r => row(r.product, r.check, r.why, ' is-cut')).join('');
  }
  if (s.picks) {
    return s.picks.map(p =>
      `<div class="sci-pick"><div class="sci-pick-n">${esc(p.position)}</div><div>` +
      `<div class="sci-pick-p">${esc(p.product)}<span class="sci-pick-tier">${esc(p.tier)}</span></div>` +
      `<p class="sci-pick-w">${esc(p.why)}</p></div></div>`).join('');
  }
  return (s.lines || []).map(l => row(l.text, l.value, l.note || l.source)).join('');
}

const panels = steps.map((s, i) =>
  `      <div class="sci-panel" role="tabpanel" id="sci-p-${s.id}" aria-labelledby="sci-tab-${s.id}" tabindex="0"${i === 0 ? '' : ' hidden'}>${panelBody(s)}</div>`).join('\n');

const F = trace.counts;
const funnel = `<div class="sci-funnel" data-funnel>
      <div class="sci-fstep" data-at="0"><div class="sci-fn">${num(F.scored)}</div><div class="sci-fl">scored</div></div>
      <div class="sci-fstep" data-at="${steps.findIndex(s => s.removed)}"><div class="sci-fn">${num(F.passed_the_checks)}</div><div class="sci-fl">passed the checks</div></div>
      <div class="sci-fstep" data-at="${steps.findIndex(s => s.picks)}"><div class="sci-fn">${num(F.recommended)}</div><div class="sci-fl">recommended</div></div>
    </div>`;

const run = `<section class="sci-sec" id="run">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">One real run</span>
      <h2 class="h2">Watch the engine decide for ${esc(c.name)}.</h2>
      <p class="lead">Every step below came out of a real run.</p>
    </div>
    <div class="sci-card sci-stage sci-in" data-run>
      <div class="sci-tabs" role="tablist" aria-label="The steps of one run">${tabs}</div>
${panels}
      ${funnel}
    </div>
  </div>
</section>`;

/* ---- 3. safety ------------------------------------------------------------ */
const firedNames = new Set(Object.keys((steps.find(s => s.removed_by_check) || {}).removed_by_check || {}));
const groups = [...new Set(h.safety_checks.map(x => x.group))]
  .map(g => ({ group: g, checks: h.safety_checks.filter(x => x.group === g) }))
  .sort((a, b) => b.checks.length - a.checks.length);

const groupBtns = groups.map((g, i) =>
  `      <button type="button" class="sci-gbox" aria-expanded="${i === 0 ? 'true' : 'false'}" aria-controls="sci-g-${i}" data-group="${i}">` +
  `<span class="sci-gbox-n">${g.checks.length}</span><span class="sci-gbox-name">${esc(cap(g.group))}</span></button>`).join('\n');

const groupBodies = groups.map((g, i) =>
  `      <div class="sci-glist" id="sci-g-${i}"${i === 0 ? '' : ' hidden'}>` +
  g.checks.map(ch => `<div class="sci-check"><div class="sci-check-n">${esc(ch.name)}` +
    (firedNames.has(ch.name) ? `<span class="sci-dot" role="note" tabindex="0"><span class="sci-tip">In ${esc(c.name)}&#8217;s run</span></span>` : '') +
    (ch.effect === 'warns' ? `<span class="sci-warn" role="note" tabindex="0"><span class="sci-tip">Warns, removes nothing</span></span>` : '') +
    `</div><p class="sci-check-d">${esc(ch.does)}</p></div>`).join('') + `</div>`).join('\n');

const safety = `<section class="sci-sec" id="safety">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">Safety</span>
      <h2 class="h2">${num(h.counts.safety_checks.value)} checks that can remove a product. None can be switched off.</h2>
      <p class="lead">Sixteen remove a product; one adds a warning instead.</p>
    </div>
    <div class="sci-groups sci-in" data-groups>
${groupBtns}
    </div>
${groupBodies}
    <div class="sci-plan sci-in">
      <button type="button" class="sci-plan-btn" aria-expanded="false" aria-controls="sci-plan-list">
        <span>Plus ${num(h.counts.plan_checks.value)} plan checks</span><span class="sci-caret" aria-hidden="true"></span>
      </button>
      <div class="sci-glist" id="sci-plan-list" hidden>
        ${h.plan_checks.map(x => `<div class="sci-check"><div class="sci-check-n">${esc(x.name)}</div><p class="sci-check-d">${esc(x.does)}</p></div>`).join('')}
      </div>
    </div>
  </div>
</section>`;

/* ---- 4. markets ------------------------------------------------------------ */
const sets = h.countries.reference_sets;
const setName = s => s.countries.length === 1 ? s.countries[0]
  : (s.countries.includes('United States') ? 'United States / Canada' : 'European Union');
const cbtns = sets.map((s, i) =>
  `<button type="button" class="sci-cbtn" data-set="${i}" aria-pressed="${i === 0 ? 'true' : 'false'}">${esc(setName(s))}</button>`).join('');

function ladder(n) {
  const ul = n.upper_limit;
  const unit = n.upper_limit_unit || n.target_unit || '';
  const t = n.target_reference_adult;
  const head = `<div class="sci-dose-h"><span class="sci-dose-n">${esc(n.nutrient)}</span><span class="sci-dose-s is-${esc(n.strictness)}">${esc(n.strictness)}</span></div>`;
  if (t == null) {
    return `      <div class="sci-dose" data-dose="${esc(n.nutrient)}">${head}
        <p class="sci-dose-f">Target ${esc(n.target_basis || 'computed per person')}.</p>
      </div>`;
  }
  const span = ul ? ul * 1.18 : t * 2;
  const pos = v => Math.max(0, Math.min(100, (v / span) * 100));
  const tp = pos(t);
  const never = ul ? `<div class="sci-never" style="left:${pos(ul)}%"><span class="sci-never-l">Never</span></div>` : '';
  const edge = tp < 12 ? ' is-left' : tp > 88 ? ' is-right' : '';
  return `      <div class="sci-dose" data-dose="${esc(n.nutrient)}">${head}
        <div class="sci-track">${never}<div class="sci-mark is-target${edge}" style="left:${tp}%"><i>${num(t)} ${esc(n.target_unit || unit)}</i></div></div>
        <p class="sci-dose-f">${ul ? `Upper limit ${num(ul)} ${esc(unit)}.` : (n.upper_limit_note ? cap(esc(n.upper_limit_note)) + '.' : '')}</p>
      </div>`;
}

const first = sets[0];
const markets = `<section class="sci-sec" id="markets">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">Markets</span>
      <h2 class="h2">Targets follow the country you sell in.</h2>
      <p class="lead">Reference targets follow the official authority for each market, and only ingredients permitted there are recommended.</p>
    </div>
    <div class="sci-countries sci-in">
      <div class="sci-csel" role="group" aria-label="Market">${cbtns}</div>
      <p class="sci-auth" data-auth><b>${esc(first.authority.name)}</b> <span>${esc(first.authority.reference)}</span></p>
      <div class="sci-ladders" data-ladders>
${first.nutrients.map(ladder).join('\n')}
      </div>
      <p class="sci-note">Shown for a woman aged 31 to 50. Every real target is computed for the person.</p>
    </div>
  </div>
</section>`;

/* ---- 5. the endcap --------------------------------------------------------- */
const cta = `<section class="closer sc-reveal sc-reveal--top" data-sc="endcap" id="contact">
  <div class="wrap">
    <span class="eyebrow">The methodology</span>
    <h2 class="h1">Read the full methodology.</h2>
    <p class="lead">See how answers, research and rules produce every recommendation.</p>
    <div class="closer-ctas">
      <a href="mailto:contact@blend-technologies.com?subject=Blend%20methodology" class="btn btn-primary btn-lg">Request the methodology</a>
      <a href="/try" class="btn btn-ghost btn-lg">Try the demo</a>
    </div>
  </div>
</section>`;

const data = `<script type="application/json" id="sci-data">${JSON.stringify({ verticals: V, trace: { customer: trace.customer, counts: trace.counts } }).replace(/</g, '\\u003c')}</script>`;

const body = [hero, run, safety, markets, cta, data].join('\n\n');

/* ---- splice ------------------------------------------------------------------ */
let page = readFileSync(PAGE, 'utf8');
const before = page;
const re = /(<!-- science:body -->\n?)[\s\S]*?(\n?<!-- \/science:body -->)/;
if (!re.test(page)) { console.error('FAILED: science.html has no <!-- science:body --> region'); process.exit(1); }
page = page.replace(re, (_, o, cl) => o + body + cl);

const summary = `${liveKey} live, ${num(h.counts.products_audited.value)} products audited, ` +
  `${h.counts.safety_checks.value} safety checks, ${steps.length} run steps, ` +
  `${sets.length} reference sets`;

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
