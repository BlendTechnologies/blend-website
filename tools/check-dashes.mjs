#!/usr/bin/env node
/* Refuse an em dash in anything a reader sees.
   ----------------------------------------------------------------------
   WHY THIS EXISTS. On 2026-10-19 the founder's note was "NO HYPHENS
   NEVER", and a count settled what it meant: the whole site carried
   exactly ONE em dash in visible copy, on the page written that day, and
   every other page carried zero. Twelve of thirteen pages already obeyed a
   rule nothing enforced, which is the exact condition check-nav and
   check-wordmark were written for. The webapp holds the same line a
   different way: a unit test asserts no em dashes in lib/copy.ts.

     node tools/check-dashes.mjs

   WHAT IT LOOKS AT. Visible copy and JSON-LD. Not HTML comments, not
   script, not style: a comment is not something a reader can be misled by,
   and the prose in this repository's comments is for whoever reads the
   file next. check-product-facts.mjs learnt that the hard way, by failing
   on a comment describing the incident it exists for.

   WHAT IT DOES NOT BAN.

   - The en dash (–). It is the range character, and the demo's own quiz
     answers arrive carrying it: "5–6 hours", "1–5 eggs". Those are a
     brand's words coming back over the wire, and rewriting somebody's
     option text is not a style fix.
   - The hyphen. "Data-backed" is the founder's own phrasing, typed twice
     in the brief that produced this file. A hyphen inside a compound word
     is spelling; an em dash is punctuation, and it is the punctuation the
     house style has already removed everywhere.
*/

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const SKIP = new Set(['node_modules', 'blend-mockups', 'tools', 'api', '.git', '.github', 'test-results']);

function pages(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pages(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const EM = '—';
const problems = [];
let checked = 0;

for (const file of pages(site)) {
  const html = readFileSync(file, 'utf8');
  checked++;

  /* Comments first, then script and style — but NOT the JSON-LD block,
     which is published text that no reader and no screenshot ever sees,
     and is therefore exactly where a style rule rots unnoticed. */
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/gi, EM)
    .replace(/&#8212;/g, EM)
    .replace(/&#x2014;/gi, EM);

  let i = -1;
  while ((i = text.indexOf(EM, i + 1)) !== -1) {
    problems.push({
      page: relative(site, file),
      context: text.slice(Math.max(0, i - 55), i + 55).replace(/\s+/g, ' ').trim(),
    });
  }
}

if (problems.length) {
  console.error(`FAILED: ${problems.length} em dash(es) in copy a reader sees.\n`);
  for (const p of problems) {
    console.error(`  ${p.page}`);
    console.error(`    ...${p.context}...\n`);
  }
  console.error('House style has no em dashes. A comma, a full stop or a colon does the');
  console.error('same work; a pair of them around an aside usually wants brackets or two');
  console.error('sentences. The en dash in a range and the hyphen in a compound are fine.');
  process.exit(1);
}

console.log(`PASSED: no em dashes in visible copy or structured data across ${checked} page(s).`);
