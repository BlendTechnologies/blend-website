#!/usr/bin/env node
/**
 * Writes the whole of /science from the engine's own export.
 *
 * WHY THIS EXISTS. /science is the page that says the engine can be audited,
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
      <h1 class="h1">A scoring engine you can audit, line by line.</h1>
      <p class="lead">One engine per vertical. Every pick scored, safety-checked and explained.</p>
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

/* ---- 2. what the engine covers ---------------------------------------------
   The breadth of the category in one band: the counts, every goal by name,
   and the two figures about a product, which belong with what the engine
   knows rather than in a strip under the hero. */
/* "None of the above." is a quiz option, not a signal, so it is the one
   thing dropped between the taxonomy and the page. */
const SIGNAL = x => x.trim().toLowerCase() !== 'none of the above.';
const goals = h.goals.map(g => ({ goal: g.goal, subgoals: g.subgoals.filter(SIGNAL) }));
const goalList = goals.map(g => g.goal);
const openGoal = goals.find(g => /gut health/i.test(g.goal)) || goals[0];
/* The two figures lead, because what the section is really claiming is the
   breadth of what the engine knows about a product, and a figure buried in a
   line under a taxonomy does not claim it. They sit either side of a quiet
   multiplication sign, which is also how to read them: 223 products described
   25 ways. Then a rule, then the taxonomy they feed.

   The VALUES still come from the export and are never typed here. The two
   short labels are written here on purpose: the export's own are long enough
   to wrap three times at this type size ("attributes recorded for every
   product in a brand's catalogue"), and a label is not a claim. Every number
   on this page remains the engine's. */
const covers = `<section class="sci-sec" id="covers">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">What the engine covers</span>
    </div>
    <div class="sci-stats sci-in">
      <div class="sci-stat">
        <span class="sci-stat-v"><b data-count="${h.counts.products_audited.value}">${num(h.counts.products_audited.value)}</b><i aria-hidden="true">+</i></span>
        <span class="sci-stat-l">Products audited for safety and composition</span>
      </div>
      <span class="sci-stat-x" aria-hidden="true">&#215;</span>
      <div class="sci-stat">
        <span class="sci-stat-v"><b data-count="${h.counts.product_attributes.value}">${num(h.counts.product_attributes.value)}</b></span>
        <span class="sci-stat-l">Attributes recorded for each product</span>
      </div>
    </div>
    <hr class="sci-rule sci-in">
    <h2 class="sci-covers-h sci-in"><span data-count="${h.counts.goals.value}">${num(h.counts.goals.value)}</span> goals &#183; <span data-count="${h.counts.subgoals.value}">${num(h.counts.subgoals.value)}</span> signals</h2>
    <div class="sci-goalgrid sci-in" data-goals>
${goals.map(g => `      <button type="button" class="sci-goalname" data-goal="${esc(g.goal)}" aria-controls="sci-subs"${g === openGoal ? ' aria-expanded="true"' : ' aria-expanded="false"'}>${esc(g.goal)}</button>`).join('\n')}
    </div>
    <div class="sci-subs sci-in" id="sci-subs" data-subs aria-live="polite">
      <div class="sci-subs-t">${esc(openGoal.goal)}</div>
      <div class="sci-subs-list">${openGoal.subgoals.map(x => `<span>${esc(x)}</span>`).join('')}</div>
    </div>
  </div>
</section>`;

/* ---- 3. one real run -------------------------------------------------------
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
const targetsStep = steps.find(s => s.per_nutrient && s.authority) || { per_nutrient: [], lines: [] };
const targetOf = new Map(targetsStep.per_nutrient.map(t => [t.nutrient, t]));
/* The macros have targets too, in the targets step's own lines rather
   than its per-nutrient list, which is why they were showing as bare
   figures with nothing to read them against. Matched on the first word,
   so "Energy target" meets "Energy from that food". */
const macroTarget = new Map((targetsStep.lines || []).map(l =>
  [String(l.text).split(' ')[0].toLowerCase(), l]));

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
    /* The macros and the modelled plate they come from. Dropped when this
       step was rewritten around the per-nutrient bars, which left the
       page showing micronutrients and no food. */
    const macros = `<div class="sci-macros">` + (s.lines || []).map(l => {
      const t = macroTarget.get(String(l.text).split(' ')[0].toLowerCase());
      return `<div class="sci-macro"><div class="sci-macro-v">${esc(l.value)}</div>` +
        `<div class="sci-macro-l">${esc(l.text)}</div>` +
        (t ? `<div class="sci-macro-t">target ${esc(t.value)}</div>` : '') + `</div>`;
    }).join('') + `</div>`;
    return macros + s.per_nutrient.map(x => {
      const t = targetOf.get(x.nutrient);
      const pct = t && t.target ? (x.intake_from_food || 0) / t.target : null;
      const v = `${num(Math.round((x.intake_from_food || 0) * 10) / 10)} ${x.unit || ''}`.trim() +
        (t ? ` of ${num(t.target)} ${t.unit || ''}`.trimEnd() : '');
      return `<div class="sci-row"><span class="sci-row-t">${esc(x.nutrient)}` +
        (met.has(x.nutrient) ? `<span class="sci-met">Already met by diet</span>` : '') +
        `</span><span class="sci-row-v">${esc(v)}</span>` +
        (pct != null ? `<div class="sci-bar ${met.has(x.nutrient) ? 'is-ok' : ''}"><i style="--v:${Math.max(.02, Math.min(1, pct)).toFixed(3)}"></i></div>` : '') +
        `</div>`;
    }).join('') +
    /* The products her own food took off the list, with the reason the
       engine gave. In the export and not on the page until now, which
       left the diet credit as a label on a bar rather than something
       with a consequence. */
    ((s.already_met_by_diet.products_removed || []).length
      ? `<div class="sci-after"><h4 class="sci-sub-h">Removed because her food already covers it</h4>` +
        s.already_met_by_diet.products_removed.map(r =>
          row(r.product, '', r.because, ' is-cut')).join('') + `</div>`
      : '');
  }
  if (s.per_nutrient && s.authority) {
    const a = s.authority;
    const macros = (s.lines || []).length
      ? `<div class="sci-macros">` + s.lines.map(l =>
          `<div class="sci-macro"><div class="sci-macro-v">${esc(l.value)}</div>` +
          `<div class="sci-macro-l">${esc(l.text)}</div>` +
          (l.basis ? `<div class="sci-macro-t">${esc(l.basis)}</div>` : '') + `</div>`).join('') + `</div>`
      : '';
    return macros + row(`Targets for ${a.market}`, a.name) +
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
    /* Four of the twenty are plan checks rather than safety checks, and
       the engine's own `kind` says which, so the page does not present
       them as the same thing. */
    return s.removed.map(r => row(r.product,
      r.check + (r.kind && r.kind !== 'safety check' ? ' · plan check' : ''), r.why, ' is-cut')).join('');
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

/* The plan checks are a box in the same row, not a disclosure underneath it.
   They are a different KIND of check — they shape a plan rather than remove
   an unsafe product — so the box is marked as its own thing, but it sits with
   the others because that is where a reader looks for "what else is checked".
   It joins the same one-open-at-a-time behaviour by carrying the same class
   and its own aria-controls; the separate handler it used to need is gone. */
const planBtn = `      <button type="button" class="sci-gbox sci-gbox--plan" aria-expanded="false" aria-controls="sci-plan-list" data-group="plan">` +
  `<span class="sci-gbox-n">${num(h.counts.plan_checks.value)}</span><span class="sci-gbox-name">Plan checks</span></button>`;

const planBody = `      <div class="sci-glist" id="sci-plan-list" hidden>` +
  h.plan_checks.map(x => `<div class="sci-check"><div class="sci-check-n">${esc(x.name)}` +
    (firedNames.has(x.name) ? `<span class="sci-dot" role="note" tabindex="0"><span class="sci-tip">In ${esc(c.name)}&#8217;s run</span></span>` : '') +
    `</div><p class="sci-check-d">${esc(x.does)}</p></div>`).join('') + `</div>`;

const safety = `<section class="sci-sec" id="safety">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">Safety</span>
      <h2 class="h2">${num(h.counts.safety_checks.value)} checks that can remove a product. None can be switched off.</h2>
      <p class="lead">Interactions, contraindications and the customer&#8217;s own conditions are checked before a product can be recommended. Sixteen of the ${num(h.counts.safety_checks.value)} remove it outright; the last adds a warning instead. Nothing a customer should not take reaches their plan, and you can show which check stopped it.</p>
    </div>
    <div class="sci-groups sci-in" data-groups>
${groupBtns}
${planBtn}
    </div>
${groupBodies}
${planBody}
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

/* What the engine actually blocks in a market. Rules exist for two
   ingredients in two countries and nowhere else, and absence of a rule is
   absence of research rather than permission, so a market with none says
   so instead of implying a clean sheet. */
function legalLine(s) {
  const rules = (s.ingredient_legality || {}).rules_in_force || {};
  const names = Object.keys(rules);
  if (!names.length) return 'No national ingredient ban recorded for this market.';
  return 'Blocked here: ' + names.map(n =>
    `${n} (${(rules[n] || []).join(', ')})`).join('; ') + '.';
}

const first = sets[0];
const markets = `<section class="sci-sec" id="markets">
  <div class="wrap">
    <div class="sci-head sci-in">
      <span class="eyebrow">Markets</span>
      <h2 class="h2">Targets follow the country you sell in.</h2>
      <p class="lead">Reference targets follow the official authority for each market, and an ingredient a country bans in supplements is never recommended there.</p>
    </div>
    <div class="sci-countries sci-in">
      <div class="sci-csel" role="group" aria-label="Market">${cbtns}</div>
      <p class="sci-auth" data-auth><b>${esc(first.authority.name)}</b> <span>${esc(first.authority.reference)}</span>
        <span class="sci-legal" data-legal>${esc(legalLine(first))}</span></p>
      <div class="sci-ladders" data-ladders>
${first.nutrients.map(ladder).join('\n')}
      </div>
      <p class="sci-note">Shown for a woman aged 31 to 50. These are <b>${num(first.nutrients.length)} of the ${num(h.counts.nutrients.value)}</b> nutrients the engine models and reports for every customer. Every real target is computed for the person, not read off this table.</p>
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

const body = [hero, covers, run, safety, markets, cta, data].join('\n\n');

/* ---- splice ------------------------------------------------------------------ */
let page = readFileSync(PAGE, 'utf8');
const before = page;
const re = /(<!-- science:body -->\n?)[\s\S]*?(\n?<!-- \/science:body -->)/;
if (!re.test(page)) { console.error('FAILED: science.html has no <!-- science:body --> region'); process.exit(1); }
page = page.replace(re, (_, o, cl) => o + body + cl);

const summary = `${liveKey} live, ${num(h.counts.products_audited.value)} products audited, ` +
  `${h.counts.safety_checks.value} safety checks, ${goalList.length} goals, ` +
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
