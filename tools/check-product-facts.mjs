#!/usr/bin/env node
/* Refuse a page that states a governed figure the engine disagrees with.
   ----------------------------------------------------------------------
   WHY THIS EXISTS. PRODUCT_FACTS.md has been the canonical set since it was
   written, and CLAUDE.md says no lane publishes a figure externally unless it
   appears there. Nothing enforced it, so the site drifted anyway, and on
   2026-10-17 an external reviewer found it before we did:

     /science            25 product attributes, 17 safety gates   (correct)
     homepage FAQ        "more than 30 product attributes"        (wrong)
     homepage JSON-LD    "30+ product attributes, 20+ safety checks"

   The interesting part is that 30 and 20 were not invented. They trace to
   real rows: supplements_db.json has 31 columns, and safety.py has 21
   apply_* functions. They are simply answers to a DIFFERENT QUESTION than
   the one the copy was asking. PRODUCT_FACTS is explicit about it:

     "Say '31 attributes per product' only about the data; never about
      what is scored."

   So this checker is not "find a number and compare it". It binds a CLAIM to
   a fact: a sentence about what the engine SCORES has to carry the scorer's
   number, whatever the data file happens to be that week.

   /science is already protected a different way — sync-science-facts.mjs
   writes its figures from the engine export, so they cannot be typed wrong.
   This covers everywhere a human writes prose.

   To govern a new figure: add a row to PRODUCT_FACTS.md with the value in
   bold, then add a CLAIM below pointing at it. Nothing here hardcodes a
   number, on purpose — the file is the source, this is only the binding.
*/

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const VENDORED = join(site, 'product-facts.json');
/* The workspace copy, when this runs from a full checkout. The website is its
   own repository, so in ITS ci the markdown is simply not there — hence the
   vendored json, the same arrangement pricing.json already uses for prices.
   When the markdown IS reachable the two are compared, so the vendored copy
   cannot quietly go stale. */
const FACTS = join(site, '..', '..', 'PRODUCT_FACTS.md');

function canonical() {
  const vendored = JSON.parse(readFileSync(VENDORED, 'utf8'));
  const out = new Map(Object.entries(vendored.facts).map(([k, v]) => [k, v.value]));

  let md = null;
  try { md = readFileSync(FACTS, 'utf8'); } catch { /* website-only checkout */ }
  if (md) {
    const live = new Map();
    for (const line of md.split('\n')) {
      const m = line.match(/^\|\s*([^|]+?)\s*\|\s*\*\*([\d,]+)\*\*\s*\|/);
      if (m) live.set(m[1].trim().replace(/^\*\*|\*\*$/g, ''), Number(m[2].replace(/,/g, '')));
    }
    const drift = [];
    for (const [name, value] of out) {
      if (!live.has(name)) drift.push(`  - "${name}" no longer exists in PRODUCT_FACTS.md`);
      else if (live.get(name) !== value) drift.push(`  - "${name}": vendored ${value}, canonical ${live.get(name)}`);
    }
    if (drift.length) {
      console.error('FAILED: product-facts.json has drifted from PRODUCT_FACTS.md\n');
      drift.forEach(d => console.error(d));
      console.error('\nRegenerate it rather than editing either by hand.');
      process.exit(1);
    }
  } else {
    console.log('note: PRODUCT_FACTS.md not reachable (website-only checkout) — checking against the vendored copy.');
  }
  return out;
}

/* ---- what the site is allowed to say -----------------------------------
   `find` runs over the page's visible text AND its structured data, because
   the JSON-LD said "30+ product attributes" for months where no reader would
   ever have seen it and no screenshot test could. */
const CLAIMS = [
  {
    fact: 'Product attributes the scorer reads',
    what: 'a claim about what the engine SCORES',
    // "scores ... using 25 product attributes", "25 product attributes scored"
    find: /(\d+)\+?\s*(?:scored\s+)?product attributes/gi,
    note: 'the 31-column width of supplements_db.json is a claim about the DATA; '
        + 'a sentence about scoring takes the scorer\'s number',
  },
  {
    fact: 'Maximum signals per user (ceiling)',
    what: 'a claim about how much a customer can tell the quiz',
    find: /up to (\d+)\s*personalised inputs/gi,
    note: 'PRODUCT_FACTS carries the approved phrasing for this one, and notes '
        + 'that a "47 signals" figure in circulation is not reproducible',
  },
  {
    fact: 'Guaranteed signals per user (floor)',
    what: 'a claim about what every customer is asked',
    find: /(\d+)\s*(?:questions|are)\s*always asked/gi,
    note: '"20+ user signals" is false: a customer who answers only the '
        + 'always-shown questions gives 16',
  },
  {
    fact: 'Safety gates that run on a recommendation',
    what: 'a claim about the safety layer',
    find: /(\d+)\+?\s*safety (?:checks|gates)/gi,
    note: 'safety.py has 21 apply_* functions, but 6 of those are curation, '
        + 'not safety',
  },
];

/* /science writes these from the engine export and is checked by
   sync-science-facts.mjs; re-checking the generated block here would only
   duplicate that, and its "3 of the 17" phrasing is deliberate. */
const SKIP = new Set(['science.html']);

function pages(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !['node_modules', 'tools', 'blend-mockups', '.git'].includes(e.name)) {
      pages(join(dir, e.name), acc);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      acc.push(join(dir, e.name));
    }
  }
  return acc;
}

const facts = canonical();
const missing = CLAIMS.filter(c => !facts.has(c.fact));
if (missing.length) {
  console.error('FAILED: PRODUCT_FACTS.md has no bold row named:');
  for (const c of missing) console.error(`  - "${c.fact}"`);
  console.error('\nA renamed or deleted row silently stops governing its claim, so this is a failure.');
  process.exit(1);
}

const problems = [];
let checked = 0;

for (const file of pages(site)) {
  const name = relative(site, file);
  if (SKIP.has(name)) continue;
  const html = readFileSync(file, 'utf8');
  // tags out, entities back, so "25&nbsp;product attributes" still matches
  const text = html
    /* HTML COMMENTS OUT FIRST. A comment is not something a reader can be
       misled by, and this check is about what the site SAYS. It fired on
       2026-10-19 on a comment in sample-report.html that recounted the
       incident this whole file exists for — "the homepage FAQ said 'more
       than 30 product attributes' for months" — which is a true sentence
       about history sitting in a page's source. A guard that refuses the
       documentation of the bug it was written for teaches people to stop
       writing the documentation. Copy that is commented OUT is not
       published either, and is meant to pass. */
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  for (const claim of CLAIMS) {
    const want = facts.get(claim.fact);
    for (const m of text.matchAll(claim.find)) {
      checked++;
      const said = Number(m[1]);
      if (said !== want) {
        const at = Math.max(0, m.index - 70);
        problems.push({
          page: name, said, want, claim,
          context: text.slice(at, m.index + m[0].length + 40).replace(/\s+/g, ' ').trim(),
        });
      }
    }
  }
}

if (problems.length) {
  console.error(`FAILED: ${problems.length} figure(s) disagree with PRODUCT_FACTS.md\n`);
  for (const p of problems) {
    console.error(`  ${p.page}`);
    console.error(`    says ${p.said}, canonical is ${p.want}  —  "${p.claim.fact}"`);
    console.error(`    this is ${p.claim.what}, and ${p.claim.note}`);
    console.error(`    ...${p.context}...\n`);
  }
  console.error('Either the copy is wrong, or the engine moved and PRODUCT_FACTS.md needs');
  console.error('updating first. Changing this file to make the check pass is not the fix.');
  process.exit(1);
}

console.log(`PASSED: ${checked} governed figure(s) across the site match PRODUCT_FACTS.md`
  + ` (${CLAIMS.map(c => `${c.fact.split(' ').slice(0, 3).join(' ')}=${facts.get(c.fact)}`).join(', ')}).`);
