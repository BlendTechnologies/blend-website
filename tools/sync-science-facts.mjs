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

const hero = `<section class="theme-dark ph ph--fill sc-hero" data-sc="hero">
  <div class="wrap">
    <div class="ph-inner">
      <h1 class="h1">A scoring engine you can audit, line by line.</h1>
      <p class="lead">Blend combines nutritional research, individual customer information and product-level analysis to deliver personalised, explainable recommendations. One engine per vertical, every pick scored, safety-checked and explained.</p>
      <p class="ph-meta">Live for Health &amp; Wellness <span class="ph-dot" aria-hidden="true"></span> Built for any catalogue</p>
      <div class="ph-ctas">
        <a href="#run" class="btn btn-primary btn-lg">See a real run</a>
        <a href="mailto:contact@blend-technologies.com?subject=Blend%20methodology" class="btn btn-ghost btn-lg">Request the methodology</a>
      </div>
    </div>
    <nav class="ph-ix sci-verts" aria-label="Categories" style="--ph-ix:${Object.keys(V).length}">${verts}</nav>
  </div>
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
/* ---- 2a. the product database ------------------------------------------
   What "25 attributes recorded" means, shown rather than claimed. Eight real
   products from the master table, six of their recorded attributes, every
   value read from the export. The selector and the detail area are the same
   components as the goal explorer below it, so the two read as a pair: same
   names-in-a-row control, same panel underneath, same reveal.

   An attribute the table leaves empty says so. Writing "none" into a safety
   field because it looks tidier would be inventing the one kind of fact this
   page must not invent. */
const prods = h.products;
const firstProd = prods.items[0];
const prodRows = pr => pr.attributes.map(a =>
  `<div class="sci-prow"><dt>${esc(a.label)}</dt><dd>${a.value ? esc(a.value) : '<span class="sci-prow-none">None recorded</span>'}</dd></div>`).join('');

const productsSec = `<section class="sci-sec" id="products">
  <div class="wrap">
    <div class="sci-head sci-in">
      <h2 class="h2"><span data-count="${h.counts.products_audited.value}">${num(h.counts.products_audited.value)}</span>+ products &#183; <span data-count="${h.counts.product_attributes.value}">${num(h.counts.product_attributes.value)}</span> attributes each</h2>
      <p class="lead">Audited for safety and composition. Explore a product to see what the engine records.</p>
    </div>
    <div class="sci-goalgrid sci-in" data-products>
${prods.items.map(pr => `      <button type="button" class="sci-goalname" data-prod="${esc(pr.name)}" aria-controls="sci-prod" aria-expanded="${pr === firstProd ? 'true' : 'false'}">${esc(pr.name)}</button>`).join('\n')}
      <span class="sci-goalmore">+${num(prods.more_in_table)} more</span>
    </div>
    <div class="sci-subs sci-prod sci-in" id="sci-prod" data-prod-detail aria-live="polite">
      <div class="sci-subs-t">${esc(firstProd.name)}</div>
      <dl class="sci-prows">${prodRows(firstProd)}</dl>
      <p class="sci-prod-foot">${num(prods.attributes_shown)} of the ${num(prods.attributes_recorded)} attributes recorded for every product.</p>
    </div>
  </div>
</section>`;

/* One section, one claim. This one is the taxonomy: what a customer can ask
   for and how finely. The two product figures that used to open it moved to
   Safety, where the products themselves are the subject — they were a second,
   unrelated claim sharing a heading, and no amount of type scale was going to
   make four numbers about two different things read as one statement.

   With the figures gone it needs no bespoke heading stack: it is the page's
   ordinary section head, the same eyebrow / h2 / lead as Safety and Markets. */
const covers = `<section class="sci-sec" id="covers">
  <div class="wrap">
    <hr class="sci-divider sci-in">
    <div class="sci-head sci-in">
      <h2 class="h2"><span data-count="${h.counts.goals.value}">${num(h.counts.goals.value)}</span> goals &#183; <span data-count="${h.counts.subgoals.value}">${num(h.counts.subgoals.value)}</span> signals</h2>
      <p class="lead">Explore a goal to see the signals behind it.</p>
    </div>
    <div class="sci-goalgrid sci-in" data-goals>
${goals.map(g => `      <button type="button" class="sci-goalname" data-goal="${esc(g.goal)}" aria-controls="sci-subs"${g === openGoal ? ' aria-expanded="true"' : ' aria-expanded="false"'}>${esc(g.goal)}</button>`).join('\n')}
    </div>
    <div class="sci-subs sci-in" id="sci-subs" data-subs aria-live="polite">
      <div class="sci-subs-t">${esc(openGoal.goal)}</div>
      <div class="sci-subs-list">${openGoal.subgoals.map(x => `<span>${esc(x)}</span>`).join('')}</div>
    </div>
  </div>
</section>`;

/* The replay is illustrative, but the safety dots are not: they mark the
   checks that actually removed a product in the engine's exported run, and
   that evidence is the reason the three examples are worth showing at all.
   This is the only thing left on the page that reads the real trace. */
const steps = trace.steps;

/* ---- 2b. what the engine does, in three lines -------------------------------
   The only plain-language explanation on the page, and the only part that
   describes the walkthrough in words rather than in motion. Deliberately
   short: no formula, no threshold, no scoring rule. */
const STEPS = [
  ['Understand the customer', 'Their answers describe their goals, preferences and relevant health information.'],
  ['Assess the catalogue', 'Blend scores products against their profile and applies safety checks.'],
  ['Explain the recommendations', 'The customer receives a personalised plan with a reason for each recommendation.'],
];
const steps3 = `<section class="sci-sec sci-steps-sec" id="how">
  <div class="wrap">
    <ol class="sci-steps sci-in">
${STEPS.map(([t, d], i) => `      <li><h3>${pad(i + 1)}. ${esc(t)}</h3><p>${esc(d)}</p></li>`).join('\n')}
    </ol>
  </div>
</section>`;

/* ---- 3. the terminal -------------------------------------------------------
   One dark terminal that runs for the whole walkthrough: a log scrolling up
   the left, the catalogue as a pixel matrix on the right, a heading and one
   sentence above them that hold still long enough to read, and seven stage
   ticks. The terminal does not restart between stages; only what it is
   printing changes.

   PRESENTATION DATA ONLY. The log lines are generated in science.js from
   small pools of illustrative text. No score, weight, threshold or mapping
   appears in any of them: a product line carries an identifier and a status,
   never the number behind the decision. The card says "Illustrative
   simulation. Sample data." on its face.

   The markup's resting state is the END of the run — the matrix already
   carries its excluded and selected cells, the plan is already listed, and
   the heading is stage seven. That is what a reader gets with no JavaScript,
   under reduced motion, and in a frozen screenshot, and it is the same thing
   "skip to the plan" gives them. science.js rewinds to stage one only when it
   is allowed to animate. */
const MX = 160;                      /* 16 x 10, sized so no row is clipped */
const MX_CUT = [7, 19, 26, 41, 53, 68, 74, 88, 97, 111, 123, 134, 141, 150, 157];
const MX_PICK = [34, 60, 92, 118, 129, 146];
const PLAN = [
  { n: 'Vitamin D3', why: 'Covers the largest gap between estimated intake and target.' },
  { n: 'Magnesium Glycinate', why: 'Matches two stated goals, and nothing else in the plan carries it.' },
  { n: 'Omega-3 (Algae Oil)', why: 'The form that suits this diet, where the fish-oil version does not.' },
];
const STAGE_NAMES = [
  ['Reading the signals', 'Organising the customer&#8217;s answers into a personal profile.'],
  ['Estimating intakes', 'Estimating nutritional intake from reported eating habits.'],
  ['Determining targets', 'Selecting reference targets for this profile.'],
  ['Calculating gaps', 'Comparing estimated intake with targets to identify possible gaps.'],
  ['Scoring the catalogue', 'Assessing products against the customer&#8217;s profile, goals and gaps.'],
  ['Applying safety checks', 'Removing unsuitable products, regardless of their match score.'],
  ['Building the personalised plan', 'Selecting a complementary plan and explaining every recommendation.'],
];

/* The end state, by a rule rather than by chance, so the markup the page
   ships and the state the handler lands on are the same picture. Assessed
   cells keep a dim light, the excluded are red, the selected green. */
const mxClass = i => MX_CUT.includes(i) ? 'is-cut'
  : MX_PICK.includes(i) ? 'is-pick'
  : (i * 7 + 3) % 10 < 6 ? 'is-on' : '';
const cells = Array.from({ length: MX }, (_, i) =>
  `<i class="${mxClass(i)}"></i>`).join('');
const ticks = STAGE_NAMES.map(([n], i) =>
  `<button type="button" class="tm-tick" data-goto="${i}" aria-label="${esc(n)}"${i === 6 ? ' aria-current="step"' : ''}></button>`).join('');
const heads = STAGE_NAMES.map(([n, say], i) =>
  `<span class="tm-head" data-head="${i}"${i === 6 ? '' : ' hidden'}><b>${n}</b>${say}</span>`).join('');

const run = `<section class="sci-sec" id="run">
  <div class="wrap">
    <div class="sci-head sci-in">
      <h2 class="h2">Watch it decide.</h2>
      <p class="lead">Seven stages, from the first answer to a readable plan.</p>
    </div>
    <div class="sci-card tm sci-in" data-term>
      <div class="tm-top">
        <span class="tm-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="tm-path">blend/engine: walkthrough</span>
        <span class="tm-live" data-tm-state>idle</span>
      </div>
      <p class="tm-caption" aria-live="polite">${heads}</p>
      <div class="tm-body">
        <div class="tm-logwrap">
          <div class="tm-persona" data-tm-persona hidden>
            <span class="tm-persona-h">Customer profile</span>
            <dl>
              <div><dt>Age band</dt><dd>31&#8211;50</dd></div>
              <div><dt>Market</dt><dd>United Kingdom</dd></div>
              <div><dt>Diet</dt><dd>Vegetarian, no fish</dd></div>
              <div><dt>Goals</dt><dd>Energy, sleep</dd></div>
              <div><dt>Activity</dt><dd>Sedentary</dd></div>
              <div><dt>Declared</dt><dd>Medication, not pregnant</dd></div>
            </dl>
          </div>
          <div class="tm-log" data-tm-log role="log" aria-label="Processing log"></div>
          <div class="tm-plan" data-tm-plan>
            <div class="tm-plan-h"><span>PLAN</span><span>${num(PLAN.length)} selected</span></div>
            <ol>
${PLAN.map((x, i) => `              <li><span class="tm-pi">${pad(i + 1)}</span><span class="tm-pn">${esc(x.n)}</span><span class="tm-pw">${esc(x.why)}</span></li>`).join('\n')}
            </ol>
          </div>
        </div>
        <div class="tm-mxwrap">
          <div class="tm-mx is-dim" data-tm-mx aria-hidden="true"><span class="tm-sweep" data-tm-sweep></span>${cells}</div>
          <p class="tm-key"><span><i class="k-gold"></i>assessed</span><span><i class="k-cut"></i>excluded</span><span><i class="k-pick"></i>selected</span></p>
        </div>
      </div>
      <div class="tm-ticks" role="group" aria-label="Stages">${ticks}</div>
      <div class="tm-controls">
        <button type="button" class="tm-btn" data-tm-toggle aria-label="Start the walkthrough">Run</button>
        <button type="button" class="tm-btn" data-tm-replay>Restart</button>
        <span class="tm-note">Illustrative simulation. Sample data.</span>
      </div>
    </div>
  </div>
</section>`;

/* ---- 3. safety ------------------------------------------------------------ */
const firedNames = new Set(Object.keys((steps.find(s => s.removed_by_check) || {}).removed_by_check || {}));
const groups = [...new Set(h.safety_checks.map(x => x.group))]
  .map(g => ({ group: g, checks: h.safety_checks.filter(x => x.group === g) }))
  .sort((a, b) => b.checks.length - a.checks.length);

/* Counts and categories, not a catalogue of rules.
   The seventeen checks used to be listed by name with the rule each applies,
   which is a buildable specification: a competitor reads the page and
   implements it. What a client needs is that the checks exist, how many there
   are, what kinds, that none can be switched off, and evidence they fire on a
   real customer — all of which survives here.

   Three are still named in full, chosen because they are the ones any serious
   competitor has already thought of: pregnancy, a tolerable upper limit, a
   hard medication conflict. The ones that are actually ours stay off the page,
   and so do all six plan checks.

   The tiles do not open. They were buttons over a list; with no list to open,
   a thing that still looked pressable would be worse than one that plainly is
   not. */
const PUBLIC_CHECKS = [
  'Pregnancy and breastfeeding safety',
  'Tolerable upper limit',
  'Hard medication conflict',
];
const allChecks = h.safety_checks.concat(h.plan_checks || []);
const examples = PUBLIC_CHECKS.map(n => allChecks.find(c => c.name === n)).filter(Boolean);
if (examples.length !== PUBLIC_CHECKS.length) {
  console.error('FAILED: a named example check is no longer in the engine export:',
    PUBLIC_CHECKS.filter(n => !allChecks.some(c => c.name === n)).join(', '));
  process.exit(1);
}

const groupTiles = groups.map(g =>
  `      <div class="sci-gbox sci-gbox--static"><span class="sci-gbox-n">${g.checks.length}</span>` +
  `<span class="sci-gbox-name">${esc(cap(g.group))}</span></div>`).join('\n') +
  `\n      <div class="sci-gbox sci-gbox--static sci-gbox--plan"><span class="sci-gbox-n">${num(h.counts.plan_checks.value)}</span>` +
  `<span class="sci-gbox-name">Plan checks</span></div>`;

const exampleList = `      <div class="sci-glist" id="sci-examples">` +
  examples.map(ch => `<div class="sci-check"><div class="sci-check-n">${esc(ch.name)}` +
    (firedNames.has(ch.name) ? `<span class="sci-dot" role="note" tabindex="0"><span class="sci-tip">Fired in a real run</span></span>` : '') +
    `</div><p class="sci-check-d">${esc(ch.does)}</p></div>`).join('') + `</div>`;

const safety = `<section class="sci-sec" id="safety">
  <div class="wrap">
    <div class="sci-head sci-in">
      <h2 class="h2">${num(h.counts.safety_checks.value)} checks that can remove a product. None can be switched off.</h2>
      <p class="lead">Interactions, contraindications and the customer&#8217;s own conditions are checked before a product can be recommended.</p>
    </div>
    <div class="sci-groups sci-in">
${groupTiles}
    </div>
${exampleList}
    <p class="sci-prod-foot sci-in">${num(examples.length)} of the ${num(h.counts.safety_checks.value)} checks that can remove a product.</p>
  </div>
</section>`;

/* ---- 4. markets ------------------------------------------------------------ */
const sets = h.countries.reference_sets;
const setName = s => s.countries.length === 1 ? s.countries[0]
  : (s.countries.includes('United States') ? 'United States / Canada' : 'European Union');
const cbtns = sets.map((s, i) =>
  `<button type="button" class="sci-cbtn" data-set="${i}" aria-pressed="${i === 0 ? 'true' : 'false'}">${esc(setName(s))}</button>`).join('');

/* The export calls these "strict" and "lenient", which is the engine's own
   vocabulary and means nothing on a page a buyer reads — flagged in the
   2026-10-17 review alongside the NEVER zone. What they actually describe
   is how far below target a nutrient has to fall before the engine will
   offer anything for it, so that is what the label says.

   The threshold itself stays unpublished: it is tuning, and the same review
   asked that proprietary rules stay private. */
const STRICTNESS_LABEL = {
  strict:  'needs a clear shortfall',
  lenient: 'acts on a small shortfall',
};

function ladder(n) {
  const ul = n.upper_limit;
  const unit = n.upper_limit_unit || n.target_unit || '';
  const t = n.target_reference_adult;
  const head = `<div class="sci-dose-h"><span class="sci-dose-n">${esc(n.nutrient)}</span><span class="sci-dose-s is-${esc(n.strictness)}">${esc(STRICTNESS_LABEL[n.strictness] || n.strictness)}</span></div>`;
  if (t == null) {
    return `      <div class="sci-dose" data-dose="${esc(n.nutrient)}">${head}
        <p class="sci-dose-f">Target ${esc(n.target_basis || 'computed per person')}.</p>
      </div>`;
  }
  const span = ul ? ul * 1.18 : t * 2;
  const pos = v => Math.max(0, Math.min(100, (v / span) * 100));
  const tp = pos(t);
  /* "Never" alone read as a system state. It is the zone past the tolerable
     upper limit, so it says so. */
  const never = ul ? `<div class="sci-never" style="left:${pos(ul)}%"><span class="sci-never-l">Above the limit</span></div>` : '';
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
      <p class="sci-note"><span>Shown for a woman aged 31 to 50.</span><span>${num(first.nutrients.length)} of the ${num(h.countries.market_varying_nutrients)} nutrients whose reference value changes with the market.</span><span>Every real target is computed for the person, not read off this table.</span></p>
    </div>
  </div>
</section>`;

/* ---- 5. the endcap --------------------------------------------------------- */
const cta = `<section class="theme-dark closer sc-reveal sc-reveal--top" data-sc="endcap" id="contact">
  <div class="wrap">
    <h2 class="h1">Read the full methodology.</h2>
    <p class="lead">See how answers, research and rules produce every recommendation.</p>
    <div class="closer-ctas">
      <a href="mailto:contact@blend-technologies.com?subject=Blend%20methodology" class="btn btn-primary btn-lg">Request the methodology</a>
      <a href="/try" class="btn btn-ghost btn-lg">Try the demo</a>
    </div>
  </div>
</section>`;

/* The hero and the closing CTA carry `theme-dark` because they are dark
   islands on a light page, and they are written HERE rather than in the
   page: this region is regenerated, so an edit made in science.html is
   reverted the next time anyone runs this. That happened once already
   while the theme was being switched over.

   What ships in the page is not what the engine exports. Hiding the check
   list in the markup while shipping it in a JSON island would hide it from
   nobody. The counts by group stay, because the tiles are drawn from them
   and they are the claim; the per-check names and rules do not. */
const PUBLIC_V = JSON.parse(JSON.stringify(V));

/* The shortfall thresholds are tuning: how far below target each nutrient
   has to fall before the engine offers anything for it. The ladders render
   from `strictness`, the target and the upper limit, and never from these,
   so nothing on the page needs them — they were only ever in the island
   because the export carries them. The 2026-10-17 review asked that the
   page explain its labels without publishing the rules behind them, and a
   per-nutrient threshold table is the most copyable thing on it. */
function dropThresholds(rows) {
  for (const n of rows || []) {
    delete n.shortfall_before_recommend;
    delete n.shortfall_pct;
  }
}

for (const key of Object.keys(PUBLIC_V)) {
  delete PUBLIC_V[key].safety_checks;
  delete PUBLIC_V[key].plan_checks;
  delete PUBLIC_V[key].also_in_the_chain;

  dropThresholds(PUBLIC_V[key].recommendation_thresholds?.nutrients);
  delete PUBLIC_V[key].recommendation_thresholds?.default_shortfall_before_recommend;
  for (const set of PUBLIC_V[key].countries?.reference_sets || []) dropThresholds(set.nutrients);
}

const data = `<script type="application/json" id="sci-data">${JSON.stringify({ verticals: PUBLIC_V, trace: { customer: trace.customer, counts: trace.counts } }).replace(/</g, '\\u003c')}</script>`;

const body = [hero, run, steps3, productsSec, covers, safety, markets, cta, data].join('\n\n');

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
