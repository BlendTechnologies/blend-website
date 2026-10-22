#!/usr/bin/env node
/**
 * Refuses when a page's copy of a rebuilt product screen differs from the
 * homepage's.
 *
 * WHY THIS EXISTS. The dashboard's screens are rebuilt in code from the
 * founder's screenshots: the quiz builder (.bx), the results builder
 * (.bx.rx), Analytics (.ax) and Contacts (.cx) in the homepage's product
 * tour. /how-it-works showed two of them again until each of its six steps
 * got its own film (2026-10-22), so today no page copies one; the list below
 * is empty, and the check holds both pages to the shared stylesheet until a
 * page copies a screen again. There is no build step, so a copy is
 * markup copied by hand. The rules are not: both pages link
 * product-screens.css. The visual-diff suite compares each page against its
 * own past, so a copy that drifts from the other page's is invisible to it,
 * the same way the wordmark under /use-cases went wrong for months. Agreement
 * between pages needs its own check.
 *
 *   node tools/check-screens.mjs
 *
 * The homepage is the source. To change a screen, change it there and copy
 * it between the `<!-- screen:NAME start -->` and `<!-- screen:NAME end -->`
 * markers on /how-it-works; this passes again when they agree.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');

// Each screen's root element, as the homepage opens it.
const SCREENS = {
  quiz: '<div class="bx" aria-hidden="true">',
  plan: '<div class="bx rx" aria-hidden="true">',
  analytics: '<div class="ax" aria-hidden="true">',
};
const COPIES = { 'how-it-works.html': [] };
/* The films (films.css, films.js) have their own source: /how-it-works,
   where each was directed. A page that plays one copies its .hw-screen
   whole, and is held to it here. */
const FILM_SOURCE = 'how-it-works.html';
const FILM_COPIES = {
};
const FILM_SHEET = '<link rel="stylesheet" href="/films.css">';
const FILM_SCRIPT = '<script src="/films.js" defer></script>';
const SHEET = '<link rel="stylesheet" href="/product-screens.css">';

/** The element opening at src[start], through its matching </div>. */
function element(src, start) {
  let depth = 0;
  const re = /<(\/?)div\b[^>]*>/g;
  re.lastIndex = start;
  for (let m; (m = re.exec(src));) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return src.slice(start, re.lastIndex);
  }
  throw new Error('unbalanced <div> from ' + start);
}
const norm = s => s.replace(/\s+/g, ' ').trim();

const home = read('index.html');
const failures = [];
if (!home.includes(SHEET)) failures.push('index.html does not link /product-screens.css');
const source = {};
for (const [name, open] of Object.entries(SCREENS)) {
  const at = home.indexOf(open);
  if (at < 0) { failures.push(`index.html: no ${name} screen (${open})`); continue; }
  source[name] = norm(element(home, at));
}

for (const [page, names] of Object.entries(COPIES)) {
  const html = read(page);
  if (!html.includes(SHEET)) failures.push(`${page} does not link /product-screens.css`);
  for (const name of names) {
    const a = html.indexOf(`<!-- screen:${name} start`), b = html.indexOf(`<!-- screen:${name} end -->`);
    if (a < 0 || b < 0) { failures.push(`${page}: no screen:${name} markers`); continue; }
    const copy = norm(html.slice(html.indexOf('-->', a) + 3, b));
    if (!source[name]) continue;
    if (copy !== source[name]) {
      let i = 0;
      while (i < copy.length && copy[i] === source[name][i]) i++;
      failures.push(`${page}: screen:${name} differs from the homepage's at character ${i}:\n` +
        `    homepage: ...${source[name].slice(Math.max(0, i - 40), i + 60)}...\n` +
        `    ${page}: ...${copy.slice(Math.max(0, i - 40), i + 60)}...`);
    }
  }
}

const filmSrc = read(FILM_SOURCE);
for (const [page, names] of Object.entries(FILM_COPIES)) {
  const html = read(page);
  if (!html.includes(FILM_SHEET)) failures.push(`${page} plays a film but does not link /films.css`);
  if (!html.includes(FILM_SCRIPT)) failures.push(`${page} plays a film but does not load /films.js`);
  if (!html.includes(SHEET)) failures.push(`${page} plays a film but does not link /product-screens.css`);
  for (const name of names) {
    const open = `<div class="hw-screen" data-demo="${name}">`;
    const a = filmSrc.indexOf(open), b = html.indexOf(open);
    if (a < 0) { failures.push(`${FILM_SOURCE}: no ${name} film`); continue; }
    if (b < 0) { failures.push(`${page}: no ${name} film`); continue; }
    const want = norm(element(filmSrc, a)), got = norm(element(html, b));
    if (want !== got) {
      let i = 0;
      while (i < got.length && got[i] === want[i]) i++;
      failures.push(`${page}: the ${name} film differs from ${FILM_SOURCE}'s at character ${i}:\n` +
        `    ${FILM_SOURCE}: ...${want.slice(Math.max(0, i - 40), i + 60)}...\n` +
        `    ${page}: ...${got.slice(Math.max(0, i - 40), i + 60)}...`);
    }
  }
}

if (failures.length) {
  console.error('FAILED:\n  ' + failures.join('\n  '));
  console.error('\nThe homepage is the source: copy its screen between the markers.');
  process.exit(1);
}
const n = Object.values(COPIES).reduce((t, v) => t + v.length, 0);
const f = Object.values(FILM_COPIES).reduce((t, v) => t + v.length, 0);
console.log(`PASSED: ${n} copied screen(s) match the homepage's, ${f} copied film(s) match ${FILM_SOURCE}'s, and every page showing them links what they need.`);
