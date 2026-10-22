#!/usr/bin/env node
/**
 * Refuses when /sample-report shows a figure the engine did not produce.
 *
 * WHY THIS EXISTS. /sample-report used to embed one live demo result from
 * the webapp. On 2026-10-22 that result had been deleted with the demo
 * account's data, the page showed "Page not found" inside its frame, and the
 * check that guarded it (check-demo-report.mjs) passed, because it read a
 * 404 as "could not reach" rather than as gone. The report is drawn on the
 * page now, from the engine's output for the same customer, vendored in
 * sample-report.json with the request that produced it. Nothing outside this
 * site can take it down; what can go wrong is the page drifting from the
 * engine's figures, so that is what this holds.
 *
 *   node tools/check-sample-report.mjs
 *
 * To change a figure, re-run the request in sample-report.json against the
 * engine, update the file and the page together, and this passes again.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(ROOT, 'sample-report.html'), 'utf8');
const { report: R } = JSON.parse(readFileSync(join(ROOT, 'sample-report.json'), 'utf8'));

/* the page's visible text, entities decoded, whitespace folded */
const text = page
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8217;|&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&#183;/g, '·')
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');
const failures = [];
const need = (what, s) => { if (!text.includes(s)) failures.push(`${what}: "${s}" is not on the page`); };

need('heading', R.heading);
need('intro', R.intro);
R.profile.forEach(p => need('profile', p));
R.goals.forEach(g => need('goal', g));
const cards = (page.match(/class="rp-card"/g) || []).length;
if (cards !== R.products.length) failures.push(`products: the page draws ${cards} cards, the engine returned ${R.products.length}`);
R.products.forEach(p => {
  need('product', p.name);
  need(`${p.name}'s reason`, p.why);
  need(`${p.name}'s form`, `${p.form} · ${p.timing}`);
  if (p.caution) need(`${p.name}'s caution`, p.caution);
  p.tags.forEach(t => need(`${p.name}'s tag`, t));
});
R.macros.forEach(m => {
  need(m.label, `${m.value}${m.unit}`.replace(/(\d)([a-z])/, '$1 $2'));
  need(`${m.label}'s target`, m.target);
  need(`${m.label}'s share`, `${m.pct}%`);
  if (!page.includes(`rp-mb ${m.cls}"`)) failures.push(`${m.label}: no bar in its colour (${m.cls})`);
});
R.breakdown.forEach(g => g.rows.forEach(b => { need(b.name, `${b.pct}%`); need(`${b.name}'s sources`, b.sources); }));
need('disclaimer', R.disclaimer);
if (/<iframe/i.test(page)) failures.push('the page embeds an iframe again: the report is drawn here, not loaded from the webapp');

if (failures.length) {
  console.error('FAILED:\n  ' + failures.join('\n  '));
  console.error('\nsample-report.json is the engine\'s output. Change the page to match it, or re-run the engine and change both.');
  process.exit(1);
}
console.log(`PASSED: /sample-report shows the engine's ${R.products.length} picks, ${R.macros.length} macros and ${R.breakdown.reduce((n, g) => n + g.rows.length, 0)} gaps exactly as sample-report.json records them.`);
