#!/usr/bin/env node
/**
 * Refuses when /sample-report shows a figure the engine did not produce.
 *
 * WHY THIS EXISTS. /sample-report used to embed one live demo result from
 * the webapp. On 2026-10-22 that result had been deleted with the demo
 * account's data, the page showed "Page not found" inside its frame, and the
 * check that guarded it (check-demo-report.mjs) passed, because it read a
 * 404 as "could not reach" rather than as gone. The reports are drawn on the
 * page now, from the engine's output, vendored with the request that
 * produced each. Nothing outside this site can take them down; what can go
 * wrong is the page drifting from the engine's figures, so that is what this
 * holds.
 *
 *   node tools/check-sample-report.mjs
 *
 * THREE REPORTS, THREE FILES (2026-11-11). Each persona has a replay of its
 * own: sample-report-alex.json, sample-report-sam.json, sample-report-helen.json,
 * in the order the page draws them. Each report is held to ITS OWN file, and
 * only to that one: before this the three drew one customer's plan and were
 * all held to one file, which could not have told a figure from Sam's report
 * apart from one of Alex's.
 *
 * To change a figure, re-run that persona's request against the engine,
 * update the file and the page together, and this passes again.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(ROOT, 'sample-report.html'), 'utf8');
const PERSONAS = ['alex', 'sam', 'helen'];
const files = PERSONAS.map(p => JSON.parse(readFileSync(join(ROOT, `sample-report-${p}.json`), 'utf8')));

/* visible text of a fragment, entities decoded, whitespace folded */
const textOf = s => s
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8217;|&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&#183;/g, '·')
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

const failures = [];
const waived = [];
const reports = page.split('<div class="rp sr-report"').slice(1);
if (reports.length !== PERSONAS.length) failures.push(`the page draws ${reports.length} report(s); ${PERSONAS.length} personas have a file`);

reports.forEach((r, i) => {
  const who = PERSONAS[i]; const R = files[i].report; const text = textOf(r);
  const need = (what, s) => { if (!text.includes(s)) failures.push(`${who}'s report: ${what} "${s}" is not drawn`); };

  /* the brand may word the intro its own way; the count of areas is the engine's */
  if (!new RegExp(`\\b${R.key_areas} (key )?areas\\b`).test(text)) failures.push(`${who}'s report: the intro does not name the engine's ${R.key_areas} areas`);
  R.profile.forEach(p => need('profile chip', p));
  R.goals.forEach(g => need('goal', g));

  const cards = (r.match(/class="rp-card"/g) || []).length;
  if (cards !== R.products.length) failures.push(`${who}'s report: the page draws ${cards} cards, the engine returned ${R.products.length}`);
  R.products.forEach(p => {
    need('product', p.name);
    need(`${p.name}'s reason`, p.why);
    need(`${p.name}'s form`, p.form);
    need(`${p.name}'s timing`, p.timing);
    if (p.description) need(`${p.name}'s description`, p.description);
    if (p.caution) need(`${p.name}'s caution`, p.caution);
    p.tags.forEach(t => need(`${p.name}'s tag`, t));
  });
  R.macros.forEach(m => {
    need(m.label, `${m.value}${m.unit}`.replace(/(\d)([a-z])/, '$1 $2'));
    need(`${m.label}'s target`, m.target);
    need(`${m.label}'s share`, `${m.pct}%`);
    if (!r.includes(`rp-mb ${m.cls}"`)) failures.push(`${who}'s report: ${m.label} has no bar in its colour (${m.cls})`);
  });
  R.breakdown.forEach(g => g.rows.forEach(b => { need(b.name, `${b.pct}%`); need(`${b.name}'s sources`, b.sources); }));
  (R.notices || []).forEach(n => { need('notice', n.title); need(`${n.title}'s text`, n.text); });
  need('disclaimer', R.disclaimer);

  /* A drawn score is a figure like any other. While a report draws one and the
     engine's output here carries none, the page is showing a number the engine
     did not produce, and that is exactly what this check exists to refuse. */
  const m = /<div class="rp-score"([^>]*)>/.exec(r);
  if (!m) return;
  if (R.health_score !== undefined && R.health_score !== null) { need(`${who}'s score`, String(R.health_score)); return; }
  /* A stand-in is allowed only when the element names who waived it and
     when, and every run says so, so it cannot quietly become permanent. */
  const w = /data-standin="([^"]+)"/.exec(m[1]);
  if (w) waived.push(`${who}'s report draws a wellness score the engine has not supplied (waived: ${w[1]})`);
  else failures.push(`${who}'s report draws a wellness score; sample-report-${who}.json carries none. Turn the score on in the demo's report settings, read it off the results page, record it, and draw that.`);
});
if (/<iframe/i.test(page)) failures.push('the page embeds an iframe again: the report is drawn here, not loaded from the webapp');

if (failures.length) {
  console.error('FAILED:\n  ' + failures.join('\n  '));
  console.error('\nEach sample-report-<persona>.json is the engine\'s output for that persona. Change the page to match it, or re-run the engine and change both.');
  process.exit(1);
}
waived.forEach(w => console.warn('WAIVED: ' + w));
const n = files.reduce((a, f) => a + f.report.products.length, 0);
console.log(`PASSED: /sample-report draws ${reports.length} reports, each with its persona's own picks (${n} in all), macros and gaps exactly as its file records them.`);
