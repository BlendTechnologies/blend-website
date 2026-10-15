#!/usr/bin/env node
/**
 * Refuses when the Blend wordmark is not the same drawing on every page.
 *
 * WHY THIS EXISTS. The four pages under /use-cases carried a five-path copy
 * of the wordmark — the same letterforms, without the path that draws the
 * full stop — in the bar and in the footer, since the day those pages were
 * written. Nobody saw it for months and the visual-diff suite never could:
 * it compares each page against its own baseline, so a logo that is wrong
 * the same way in every capture of that page is exactly what it cannot
 * report. Agreement between pages needs its own check.
 *
 *   node tools/check-wordmark.mjs
 *
 * The svg TAG is allowed to differ — the bar draws at 26px and the footer at
 * 24 — so only the markup inside it is compared. The canonical drawing is
 * whichever one most pages carry, which means this keeps working if the
 * wordmark is ever redrawn: update every page and it passes again, update
 * some and it refuses.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'blend-mockups', 'tools', 'images', 'api', '.git']);

function pages(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pages(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

// The wordmark, by its viewBox. Three things are normalised away because
// none of them is the drawing: whitespace; trailing precision, since the
// same export reads 6571.8 on one page and 6571.800000000001 on another;
// and the fill, because the bar draws it black and the footer white.
const LOGO = /<svg[^>]*viewBox="-244\.6[^"]*"[^>]*>([\s\S]*?)<\/svg>/g;
const norm = s => s
  .replace(/\s+/g, ' ')
  .replace(/(\d+\.\d{2})\d+/g, '$1')
  .replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="#"')
  .trim();

const found = [];
for (const file of pages(ROOT)) {
  const html = readFileSync(file, 'utf8');
  let m, i = 0;
  while ((m = LOGO.exec(html))) {
    found.push({ file: relative(ROOT, file), index: i++, body: norm(m[1]), paths: (m[1].match(/<path/g) || []).length });
  }
}

if (!found.length) {
  console.error('FAILED: no wordmark found on any page. Has the viewBox changed?');
  process.exit(1);
}

const tally = new Map();
for (const f of found) tally.set(f.body, (tally.get(f.body) || 0) + 1);
const [canon, count] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
const canonPaths = (canon.match(/<path/g) || []).length;
const odd = found.filter(f => f.body !== canon);

if (odd.length) {
  console.error(`FAILED: ${odd.length} of ${found.length} wordmarks differ from the one ${count} pages carry (${canonPaths} paths).`);
  const byFile = new Map();
  for (const o of odd) byFile.set(o.file, (byFile.get(o.file) || []).concat(o.paths));
  for (const [file, paths] of byFile) console.error(`  ${file}: ${paths.length} logo(s) with ${paths.join(', ')} paths`);
  console.error('  Copy the markup inside the svg from a page that passes; leave each file its own svg tag.');
  process.exit(1);
}

const files = new Set(found.map(f => f.file)).size;
console.log(`PASSED: ${found.length} wordmarks across ${files} pages are the same ${canonPaths}-path drawing.`);
