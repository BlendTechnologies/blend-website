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

const V = facts.verticals;
const liveKey = Object.keys(V).find(k => V[k].status === 'live');
if (!liveKey) { console.error('FAILED: no live vertical in the export'); process.exit(1); }
const h = V[liveKey];

/* ---- 1. hero ------------------------------------------------------------ */
const segs = Object.entries(V).map(([key, v]) => {
  const live = v.status === 'live';
  return `<button type="button" role="tab" class="sci-seg-btn" data-vertical="${esc(key)}"` +
    ` aria-selected="${live ? 'true' : 'false'}"${live ? '' : ' disabled'}>` +
    `${esc(v.label || v.display_category || cap(key === 'health' ? 'Health and wellness' : key))}` +
    (live ? '' : '<span class="sci-tip" role="tooltip">Coming soon</span>') + '</button>';
}).join('');

// A version is shown only where the export says one is publishable. This one
// explains in _omitted_from_the_page why its deployment string is not.
const version = h.published_version ? ` <span class="ph-dot" aria-hidden="true"></span> ${esc(h.published_version)}` : '';
const meta = `<b>${esc(h.display_name)}</b>${version}` +
  ` <span class="ph-dot" aria-hidden="true"></span> <span class="ph-live">Live</span>`;

const FIGS = ['products_audited', 'product_attributes', 'safety_checks', 'nutrients'];
const figs = FIGS.filter(k => h.counts[k]).map(k => {
  const c = h.counts[k];
  const shown = c.site_claim && /\+$/.test(c.site_claim) ? c.site_claim : num(c.value);
  return `      <div class="ph-fig"><div class="ph-fig-n" data-count-to="${c.value}" data-count-text="${esc(shown)}">${esc(shown)}</div>` +
    `<div class="ph-fig-label">${esc(cap(c.label.split(',')[0]))}</div></div>`;
}).join('\n');

const hero = `<section class="ph ph--fill sc-hero" data-sc="hero">
  <div class="wrap">
    <div class="ph-inner">
      <span class="eyebrow">The science</span>
      <h1 class="h1">A scoring model you can audit, line by line.</h1>
      <p class="lead">One model per category. Every pick scored, safety-checked and explained.</p>
      <div class="sci-seg" role="tablist" aria-label="Category">${segs}</div>
      <p class="ph-meta">${meta}</p>
      <div class="ph-ctas">
        <a href="#run" class="btn btn-primary btn-lg">See a real run</a>
        <a href="mailto:contact@blend-technologies.com?subject=Blend%20methodology" class="btn btn-ghost btn-lg">Request the methodology</a>
      </div>
    </div>
    <div class="ph-figs" data-figs>
${figs}
    </div>
  </div>
  <button type="button" class="sc-cue" data-sc-cue="#how" aria-label="Scroll to content"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</section>`;

/* ---- 2. the pipeline ----------------------------------------------------- */
const PIPE = [
  ['Customer answers', 'Built around each customer', 'Answers shape every score, so the plan fits the person, not a segment.'],
  ['Your full catalogue', 'Your entire catalogue', 'Every product is evaluated, not a shortlist.'],
  ['Research data', 'Research behind the data', 'Every value traces to a published source.'],
  ['Your rules', 'Your controls', 'Tune attributes, priorities and rules to your brand.'],
  ['Safety checks', 'Safety beyond settings', 'No configuration can switch the checks off.'],
  ['A reason', 'A methodology you can inspect', 'Request the full report.'],
];
const pipeline = `<section class="sci-sec" id="how">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">Every category</span>
      <h2 class="h2">How every Blend model decides.</h2>
    </div>
    <div class="sci-flow sci-in" aria-hidden="true">${PIPE.map(p => `<span>${esc(p[0])}</span>`).join('')}</div>
    <div class="sci-pipe">
${PIPE.map(([stage, title, line], i) => `      <div class="sci-node"><div class="sci-node-n">${pad(i + 1)}</div><h3 class="sci-node-t">${esc(title)}</h3><p class="sci-node-p">${esc(line)}</p></div>`).join('\n')}
    </div>
  </div>
</section>`;

/* ---- 3. what the model covers -------------------------------------------- */
const SIGNAL = s => s.trim().toLowerCase() !== 'none of the above.';
const goals = h.goals.map(g => ({ goal: g.goal, subgoals: g.subgoals.filter(SIGNAL) }));
const open = goals.find(g => /gut health/i.test(g.goal)) || goals[0];
const goalBtns = goals.map(g =>
  `<button type="button" class="sci-goal" data-goal="${esc(g.goal)}" aria-expanded="${g === open ? 'true' : 'false'}" aria-controls="sci-subs">${esc(g.goal)}</button>`).join('');
const covers = `<section class="sci-sec" id="covers">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">What the model covers</span>
      <h2 class="h2">${num(h.counts.goals.value)} goals, ${num(h.counts.subgoals.value)} signals underneath.</h2>
    </div>
    <div class="sci-goals sci-in" data-goals>${goalBtns}</div>
    <div class="sci-card sci-subs sci-in" id="sci-subs" data-subs>
      <div class="sci-subs-t">${esc(open.goal)}</div>
      <div class="sci-subs-list">${open.subgoals.map(s => `<span>${esc(s)}</span>`).join('')}</div>
    </div>
    <p class="sci-note sci-in">${esc(h.food_intake.summary[0])}</p>
  </div>
</section>`;

/* ---- 4. one real run ------------------------------------------------------ */
const c = trace.customer;
const pgroup = (title, items) => items.length
  ? `<div class="sci-pgroup"><h4>${esc(title)}</h4><div>${items.map(i => `<span class="sci-pchip">${esc(i)}</span>`).join('')}</div></div>` : '';
const persona = `<div class="sci-card sci-persona sci-in">
  <div class="sci-persona-n">${esc(c.name)}</div>
  <div class="sci-persona-m">${esc(c.age)} <span aria-hidden="true">&#183;</span> ${esc(c.sex)} <span aria-hidden="true">&#183;</span> ${esc(c.country)}</div>
  ${pgroup('Diet and lifestyle', [c.diet, c.activity].filter(Boolean))}
  ${pgroup('Medical', [c.condition, c.medication].filter(Boolean))}
  ${pgroup('Goals', String(c.goals || '').split(',').map(s => s.trim()).filter(Boolean))}
</div>`;

const steps = trace.steps;
const tabs = steps.map((s, i) =>
  `<button type="button" role="tab" class="sci-tab" id="sci-tab-${s.id}" aria-controls="sci-p-${s.id}" aria-selected="${i === 0 ? 'true' : 'false'}" tabindex="${i === 0 ? '0' : '-1'}"><span class="sci-tab-n" aria-hidden="true">${pad(i + 1)}</span>${esc(s.name)}</button>`).join('');

const row = (t, v, s, cls = '') =>
  `<div class="sci-row${cls}"><span class="sci-row-t">${esc(t)}</span>` +
  (v == null || v === '' ? '' : `<span class="sci-row-v">${esc(v)}</span>`) +
  (s ? `<span class="sci-row-s">${esc(s)}</span>` : '') + '</div>';

const bar = (t, v, pct, tone, s) =>
  `<div class="sci-row"><span class="sci-row-t">${esc(t)}</span><span class="sci-row-v">${esc(v)}</span>` +
  `<div class="sci-bar ${tone}"><i style="--v:${Math.max(0, Math.min(1, pct)).toFixed(3)}"></i></div>` +
  (s ? `<span class="sci-row-s">${esc(s)}</span>` : '') + '</div>';

function panelBody(s) {
  const note = s.note ? `<p class="sci-panel-note">${esc(s.note)}</p>` : '';
  if (s.groups) {
    /* Chips in their groups, not rows: what she answered is the shape of
       this step, and what each answer changes belongs under the group it
       is in rather than beside every line. */
    const chip = l => `<button type="button" class="sci-sig" data-changes="${esc((l.question ? l.question + ' ' : '') + (l.changes || ''))}">${esc(l.answer || l.text)}</button>`;
    const g = s.groups.map(gr => `<div class="sci-siggroup"><h4>${esc(gr.group)}</h4>` +
      `<div class="sci-sigs">${(gr.lines || []).map(chip).join('')}</div>` +
      `<p class="sci-sigwhy" data-why>${esc(((gr.lines || [])[0] || {}).question || '')} ${esc(((gr.lines || [])[0] || {}).changes || '')}</p></div>`).join('');
    const d = (s.derived || []).length
      ? `<div class="sci-siggroup"><h4>Derived, not asked</h4><div class="sci-sigs">` +
        s.derived.map(l => `<button type="button" class="sci-sig" data-changes="${esc(l.changes || '')}">${esc(l.text)}: ${esc(l.value)}</button>`).join('') +
        `</div><p class="sci-sigwhy" data-why>${esc((s.derived[0] || {}).changes || '')}</p></div>`
      : '';
    return note + g + d;
  }
  if (s.per_nutrient && s.already_met_by_diet) {
    const met = new Set(s.already_met_by_diet.nutrients_reading_as_met || []);
    const lines = (s.lines || []).map(l => row(l.text, l.value, l.note)).join('');
    const max = Math.max(...s.per_nutrient.map(n => n.intake_from_food || 0), 1);
    const n = s.per_nutrient.slice(0, 8).map(x =>
      bar(x.nutrient, `${num(Math.round(x.intake_from_food * 100) / 100)} ${x.unit || ''}`.trim(),
        (x.intake_from_food || 0) / max, met.has(x.nutrient) ? 'is-ok' : '',
        met.has(x.nutrient) ? 'Already met by diet' : (x.source || ''))).join('');
    return note + lines + n;
  }
  if (s.per_nutrient && s.authority) {
    const a = s.authority;
    const head = row(`Targets for ${a.market}`, a.name, a.reference);
    const n = s.per_nutrient.slice(0, 8).map(x => row(x.nutrient, `${num(x.target)} ${x.unit || ''}`.trim())).join('');
    return note + head + n;
  }
  if (s.ranking_order) {
    const hit = new Set((s.top_candidates || []).map(t => t.ranked_by));
    const ladder = `<div class="sci-ladder">` + s.ranking_order.map((t, i) =>
      `<div class="sci-tier${hit.has(t) ? ' is-hit' : ''}"><b>${pad(i + 1)}</b><span>${esc(t)}</span></div>`).join('') + `</div>`;
    const cand = (s.top_candidates || []).map(t =>
      row(`${t.position}. ${t.product}`, t.ranked_by ? 'ranked here' : '', t.factors ? t.factors.join(' · ') : '')).join('');
    return note + ladder + (cand ? `<div style="margin-top:18px">${cand}</div>` : '');
  }
  if (s.removed) {
    const byCheck = s.removed_by_check || {};
    const head = Object.entries(byCheck).map(([k, v]) => row(k, `${v} removed`)).join('');
    const rows = s.removed.map(r => row(r.product, r.check, r.why, ' is-cut')).join('');
    return note + head + `<div style="margin-top:18px">${rows}</div>`;
  }
  if (s.picks) {
    return note + s.picks.map(p =>
      `<div class="sci-pick"><div class="sci-pick-n">${esc(p.position)}</div><div>` +
      `<div class="sci-pick-p">${esc(p.product)}<span class="sci-pick-tier">${esc(p.tier)}</span></div>` +
      `<p class="sci-pick-w">${esc(p.why)}</p></div></div>`).join('');
  }
  return note + (s.lines || []).map(l => row(l.text, l.value, l.note || l.source)).join('');
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
      <p class="lead">${esc(trace.engine_order.confirmed)}</p>
    </div>
    <div class="sci-run">
      ${persona}
      <div class="sci-card sci-stage sci-in" data-run>
        <div class="sci-tabs" role="tablist" aria-label="The steps of one run">${tabs}</div>
${panels}
        ${funnel}
      </div>
    </div>
    <p class="sci-note">A real run against the Blend demo catalogue.</p>
  </div>
</section>`;

/* ---- 5. safety checks ------------------------------------------------------ */
const firedNames = new Set(Object.keys((steps.find(s => s.removed_by_check) || {}).removed_by_check || {}));
const groups = [...new Set(h.safety_checks.map(s => s.group))]
  .map(g => ({ group: g, checks: h.safety_checks.filter(s => s.group === g) }))
  .sort((a, b) => b.checks.length - a.checks.length);
const layers = groups.map((g, i) => `      <div class="sci-layer">
        <button type="button" class="sci-layer-btn" aria-expanded="${i === 0 ? 'true' : 'false'}" aria-controls="sci-layer-${i}">
          <span class="sci-layer-name">${esc(cap(g.group))}</span>
          <span class="sci-layer-n">${g.checks.length}</span>
          <span class="sci-layer-caret" aria-hidden="true"></span>
        </button>
        <div class="sci-layer-body" id="sci-layer-${i}"${i === 0 ? '' : ' hidden'}>
${g.checks.map(ch => `          <div class="sci-check"><div class="sci-check-n">${esc(ch.name)}</div><p class="sci-check-d">${esc(ch.does)}</p>` +
    (ch.effect === 'warns' ? `<span class="sci-check-warn">Warns, removes nothing</span>` : '') +
    (firedNames.has(ch.name) ? `<span class="sci-check-run">In ${esc(c.name)}&#8217;s run</span>` : '') + `</div>`).join('\n')}
        </div>
      </div>`).join('\n');

const safety = `<section class="sci-sec" id="safety">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">Safety</span>
      <h2 class="h2">${num(h.counts.safety_checks.value)} checks that can remove a product. None can be switched off.</h2>
      <p class="lead">${esc(h.counts.safety_checks.basis)}.</p>
    </div>
    <div class="sci-layers sci-in">
${layers}
    </div>
    <div class="sci-plan-checks sci-in">
      <h3>Plus ${num(h.counts.plan_checks.value)} plan checks</h3>
      <p>${esc(h.counts.plan_checks.basis)}. They shape a sensible plan rather than a safe one, and are not safety checks.</p>
      <ul>${h.plan_checks.map(p => `<li><b>${esc(p.name)}</b> &#8212; ${esc(p.does)}</li>`).join('')}</ul>
    </div>
  </div>
</section>`;

/* ---- 6. countries ---------------------------------------------------------- */
const sets = h.countries.reference_sets;
const cbtns = sets.map((s, i) =>
  `<button type="button" class="sci-cbtn" data-set="${i}" aria-pressed="${i === 0 ? 'true' : 'false'}">${esc(s.countries.length > 3 ? s.countries[0] + ' and ' + (s.countries.length - 1) + ' more' : s.countries.join(' / '))}</button>`).join('');

function ladder(n) {
  const ul = n.upper_limit;
  const unit = n.upper_limit_unit || n.target_unit || '';
  const t = n.target_reference_adult;
  const head = `<div class="sci-dose-h"><span class="sci-dose-n">${esc(n.nutrient)}</span><span class="sci-dose-s is-${esc(n.strictness)}">${esc(n.strictness)}</span></div>`;
  /* No target to place and no ceiling to hatch means no ladder: an empty
     track reads as a broken one. Protein is computed per person, so it
     says that instead. */
  if (t == null) {
    return `      <div class="sci-card sci-dose" data-dose="${esc(n.nutrient)}">${head}
        <p class="sci-dose-f">Target ${esc(n.target_basis || 'computed per person')}. ` +
      `Recommended below ${num(Math.round((1 - (n.shortfall_before_recommend || 0)) * 100))}% of it.</p>
      </div>`;
  }
  /* A little past the ceiling, so the zone beyond it is a band you can
     see rather than a line on the right edge. */
  const span = ul ? ul * 1.18 : t * 2;
  const below = t * (1 - (n.shortfall_before_recommend || 0));
  const pos = v => Math.max(0, Math.min(100, (v / span) * 100));
  const never = ul ? `<div class="sci-never" style="left:${pos(ul)}%"><span class="sci-never-l">Never</span></div>` : '';
  /* On a lenient nutrient the two markers sit within a tenth of each
     other, so only one of them is labelled. The second is a tick, and
     the line underneath says what it is: a label on each collided at
     every width, whichever side of the track they were put. */
  const edge = v => (v < 12 ? ' is-left' : v > 88 ? ' is-right' : '');
  const tp = pos(t);
  const marks = `<div class="sci-mark is-target${edge(tp)}" style="left:${tp}%"><b>Target</b><i>${num(t)} ${esc(n.target_unit || unit)}</i></div>` +
    `<div class="sci-mark is-below" style="left:${pos(below)}%" title="Recommend below"></div>`;
  const foot = [
    ul ? `Upper limit ${num(ul)} ${esc(unit)}` : (n.upper_limit_note ? cap(esc(n.upper_limit_note)) : ''),
    `Recommended below ${num(Math.round((1 - (n.shortfall_before_recommend || 0)) * 100))}% of target`,
  ].filter(Boolean).join('. ') + '.';
  return `      <div class="sci-card sci-dose" data-dose="${esc(n.nutrient)}">${head}
        <div class="sci-track">${never}${marks}</div>
        <p class="sci-dose-f">${foot}</p>
      </div>`;
}

const first = sets[0];
const authCard = s => `<div class="sci-card sci-auth" data-auth>
      <div class="sci-auth-l">Reference targets</div>
      <div class="sci-auth-n">${esc(s.authority.name)}</div>
      <p class="sci-auth-r">${esc(s.authority.reference)}</p>
      <p class="sci-auth-x">${esc(s.food_composition)}${typeof s.fortification_overlay === 'string' ? ' ' + esc(s.fortification_overlay) : ''}</p>
    </div>`;

const countries = `<section class="sci-sec" id="markets">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">Markets</span>
      <h2 class="h2">Targets follow the country you sell in.</h2>
      <p class="lead">Reference targets, upper limits and which ingredients are allowed depend on the market. Blend applies the right authority for each country.</p>
    </div>
    <div class="sci-countries sci-in">
      <div class="sci-csel" role="group" aria-label="Market">${cbtns}</div>
      ${authCard(first)}
      <div class="sci-ladders" data-ladders>
${first.nutrients.map(ladder).join('\n')}
      </div>
      <p class="sci-note">Shown for a ${esc(h.recommendation_thresholds.reference_adult)}. Every real target is computed for the person.</p>
      <p class="sci-note">${esc(h.countries.what_is_not_per_country.join(' '))}</p>
    </div>
  </div>
</section>`;

/* ---- 7. the closing card ---------------------------------------------------- */
const cta = `<section class="sci-cta">
  <div class="wrap">
    <div class="sci-cta-card">
      <span class="eyebrow">The methodology</span>
      <h2>Read the full methodology.</h2>
      <p>See how answers, research and rules produce every recommendation.</p>
      <div class="sci-cta-ctas">
        <a href="mailto:contact@blend-technologies.com?subject=Blend%20methodology" class="btn btn-primary btn-lg">Request the methodology</a>
        <a href="/try" class="btn btn-ghost btn-lg">Try the demo</a>
      </div>
    </div>
  </div>
</section>`;

const data = `<script type="application/json" id="sci-data">${JSON.stringify({ verticals: V, trace: { customer: trace.customer, counts: trace.counts } }).replace(/</g, '\\u003c')}</script>`;

const body = [hero, pipeline, covers, run, safety, countries, cta, data].join('\n\n');

/* ---- splice ------------------------------------------------------------------ */
let page = readFileSync(PAGE, 'utf8');
const before = page;
const re = /(<!-- science:body -->\n?)[\s\S]*?(\n?<!-- \/science:body -->)/;
if (!re.test(page)) { console.error('FAILED: science.html has no <!-- science:body --> region'); process.exit(1); }
page = page.replace(re, (_, o, cl) => o + body + cl);

const signals = goals.reduce((n, g) => n + g.subgoals.length, 0);
const summary = `${liveKey} live, ${num(h.counts.products_audited.value)} products audited, ` +
  `${h.counts.safety_checks.value} safety checks, ${goals.length} goals, ${signals} signals, ` +
  `${steps.length} run steps, ${sets.length} reference sets`;

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
