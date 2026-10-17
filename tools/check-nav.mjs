#!/usr/bin/env node
/* The nav bar is one component. Refuse when the copies disagree.
   ----------------------------------------------------------------------
   WHY THIS EXISTS. There is no templating here — every page carries its own
   copy of the header — and on 2026-10-17 there were SEVEN distinct nav
   markups across thirteen pages. The logo pointed at four different places
   (`/`, `#`, `index.html`, `/index.html`), the demo link was `/try` on six
   pages and `try.html` on five, and the button said "Try the demo" on two
   pages and "Try it yourself" on ten. Reported as "nav is different in
   every page", which is exactly what it was.

   None of that is visible to the screenshot suite: each page is compared
   against its own baseline, so a nav that is wrong the same way in every
   capture of a page is invisible. It is the same blind spot that let the
   wordmark lose its full stop on four pages for months, which is what
   check-wordmark.mjs was written for. This is that check, for the bar.

   TWO DIFFERENCES ARE SANCTIONED, and both are normalised away below
   rather than ignored, so anything else fails:

     1. The active-page marker. `class="active"` on the menu link for the
        page you are on is the point of having one.
     2. Pricing is an anchor on the homepage (`#pricing`) and a link
        everywhere else (`/#pricing`). Same destination; using the absolute
        form on the homepage would reload the page to reach an anchor
        already on it.

   AND ONE WHOLE-PAGE EXCEPTION: /try has no "Try the demo" button, because
   it would point at the page you are already on. It carries "Book a call"
   instead. Declared here so it is a decision in a file rather than drift.
*/

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');

/* The page whose nav is allowed to carry a different call to action. */
const CTA_EXCEPTION = 'try.html';

function pages(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !['node_modules', 'tools', 'blend-mockups', '.git', '.github'].includes(e.name)) {
      pages(join(dir, e.name), acc);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      acc.push(join(dir, e.name));
    }
  }
  return acc;
}

/* Strip the two sanctioned differences so everything else has to match. */
function normalise(nav) {
  return nav
    .replace(/\s*class="active"/g, '')
    .replace(/href="\/#pricing"/g, 'href="#pricing"')
    .replace(/\s+/g, ' ')
    .trim();
}

const found = [];
for (const file of pages(site)) {
  const name = relative(site, file);
  const html = readFileSync(file, 'utf8');
  const m = html.match(/<header class="nav"[^>]*>[\s\S]*?<\/header>/);
  if (!m) continue;
  let nav = m[0];
  if (name === CTA_EXCEPTION) {
    // compare everything but the button, which is declared different above
    nav = nav.replace(/<a href=""[^>]*class="btn btn-primary btn-sm"[^>]*>.*?<\/a>/s,
                      '<a href="/try" class="btn btn-primary btn-sm">Try the demo</a>');
  }
  found.push({ name, sig: normalise(nav) });
}

if (!found.length) {
  console.error('FAILED: no page carries a <header class="nav">. That cannot be right.');
  process.exit(1);
}

const groups = new Map();
for (const f of found) {
  if (!groups.has(f.sig)) groups.set(f.sig, []);
  groups.get(f.sig).push(f.name);
}

if (groups.size > 1) {
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const [majority, ...rest] = sorted;
  console.error(`FAILED: ${groups.size} distinct nav markups across ${found.length} pages.\n`);
  console.error(`  the ${majority[1].length} that agree: ${majority[1].join(', ')}\n`);
  for (const [sig, names] of rest) {
    console.error(`  differs — ${names.join(', ')}`);
    // show the first token that diverges, so the diff is actionable
    const a = majority[0].split(/(?=<)/), b = sig.split(/(?=<)/);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.error(`    expected: ${(a[i] || '(nothing)').slice(0, 120)}`);
        console.error(`    found:    ${(b[i] || '(nothing)').slice(0, 120)}\n`);
        break;
      }
    }
  }
  console.error('The nav is one component with no templating behind it, so the copies have');
  console.error('to be kept identical by hand. Two differences are sanctioned and already');
  console.error('normalised away here: the active-page marker, and #pricing on the homepage.');
  process.exit(1);
}

console.log(`PASSED: ${found.length} nav bars are the same component`
  + ` (1 sanctioned call-to-action exception: ${CTA_EXCEPTION}).`);
