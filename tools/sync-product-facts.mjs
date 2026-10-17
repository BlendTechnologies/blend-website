#!/usr/bin/env node
/* Regenerate product-facts.json from PRODUCT_FACTS.md.

   Run from a full workspace checkout. The website repo on its own cannot see
   the markdown, which is the whole reason the figures are vendored — see
   "Figures the engine owns" in CLAUDE.md.

   Add a figure by adding its row name to product-facts.json's `facts` object
   with any value, then running this; the value and the note come from the
   markdown. A name with no matching bold row is an error, not a skip. */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const out = join(site, 'product-facts.json');
const doc = JSON.parse(readFileSync(out, 'utf8'));
const md = readFileSync(join(site, '..', '..', 'PRODUCT_FACTS.md'), 'utf8');

/* Rows look like:  | <name> | **25** | <why> | */
const rows = new Map();
for (const line of md.split('\n')) {
  const m = line.match(/^\|\s*([^|]+?)\s*\|\s*\*\*([\d,]+)\*\*\s*\|\s*(.*?)\s*\|?\s*$/);
  if (m) rows.set(m[1].trim(), { value: Number(m[2].replace(/,/g, '')), why: m[3].slice(0, 200) });
}

const facts = {};
const missing = [];
for (const name of Object.keys(doc.facts)) {
  if (!rows.has(name)) { missing.push(name); continue; }
  facts[name] = rows.get(name);
}

if (missing.length) {
  console.error('FAILED: PRODUCT_FACTS.md has no bold row named:');
  for (const n of missing) console.error(`  - "${n}"`);
  console.error('\nA renamed row stops governing its claim silently, so this is an error.');
  process.exit(1);
}

writeFileSync(out, JSON.stringify({ ...doc, facts }, null, 2) + '\n');
for (const [name, f] of Object.entries(facts)) console.log(`  ${name} = ${f.value}`);
console.log(`Wrote ${Object.keys(facts).length} governed figure(s) to product-facts.json.`);
