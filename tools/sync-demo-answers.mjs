#!/usr/bin/env node
/* Vendor the demo's answers for the static fallback.
   ----------------------------------------------------------------------
   /sample-report draws its answers panel from /api/demo-answers, a Vercel
   edge function that reads the same submission the report iframe renders.
   An edge function does not exist under a plain static server, so every
   local preview and every capture the visual-diff suite takes saw that
   panel hidden — which is how it came to be reported twice as missing when
   it had been live in production the whole time.

   demo-answers.json is the same payload, vendored, and the page falls back
   to it. A vendored copy of live data is exactly what went wrong with the
   old report fragment, which disagreed with its own breakdown for months,
   so this one is written by a script and checked by another:

     node tools/sync-demo-answers.mjs     writes it from the live submission
     node tools/check-demo-report.mjs     refuses when it has drifted

   Never edit demo-answers.json by hand. The whole point is that no hand
   touches it. */

import { buildPayload } from '../api/_demo-summary.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const APP = 'https://app.blend-technologies.com';

const doc = JSON.parse(readFileSync(join(site, 'demo-report.json'), 'utf8'));
const key = (doc.url.match(/\/quiz\/([^/]+)\//) || [])[1];
const sub = (doc.url.match(/\/results\/([^/?#]+)/) || [])[1];
if (!key || !sub) {
  console.error(`FAILED: cannot read a quiz key and submission id out of ${doc.url}`);
  process.exit(1);
}

const res = await fetch(`${APP}/api/embed/${key}/submissions/${sub}`, {
  headers: { accept: 'application/json' },
});
if (!res.ok) {
  console.error(`FAILED: upstream ${res.status} for the demo submission.`);
  process.exit(1);
}

const built = buildPayload(await res.json());
if (!built.answers.length) {
  console.error('FAILED: the submission came back with no answers in it.');
  process.exit(1);
}
if (built.missing.length) {
  console.error(`FAILED: the summary has lost ${built.missing.length} field(s): `
    + `${built.missing.join(', ')}.`);
  console.error('Fix the matchers in api/_demo-summary.mjs before vendoring this.');
  process.exit(1);
}

/* THE PANEL MAY NOT GET QUIETLY SMALLER.
   `profile` is best-effort by design — every row is dropped rather than
   printed empty, so a renamed question costs a row and leaves a payload
   that is still valid. Which means a broken matcher looks exactly like a
   quiz that no longer asks the question, and re-running this script would
   bless it. The drift check cannot see it either: once vendored, the
   vendored copy and the live build agree.

   Losing gender did exactly that in testing: "Woman, 34" became "34" and
   every check passed. So a reduction has to be stated rather than
   absorbed. Same stance as quality_gate.py in the workspace: a thing is
   allowed to get worse only when somebody signs for it.

     node tools/sync-demo-answers.mjs --accept-smaller   */
const previous = (() => {
  try { return JSON.parse(readFileSync(join(site, 'demo-answers.json'), 'utf8')); }
  catch { return null; }
})();

if (previous?.profile && !process.argv.includes('--accept-smaller')) {
  const was = previous.profile;
  const now = built.profile;
  const lost = [];
  if (was.name && !now.name) lost.push(`name: "${was.name}" is gone`);
  for (const k of ['identity', 'goals', 'flags', 'day', 'intake']) {
    const a = (was[k] || []).length, b = (now[k] || []).length;
    if (b < a) lost.push(`${k}: ${a} row(s) -> ${b}`);
  }
  if (lost.length) {
    console.error('FAILED: this would vendor a SMALLER panel than the one on disk.\n');
    lost.forEach(l => console.error(`  - ${l}`));
    console.error('\nEither a matcher in api/_demo-summary.mjs stopped fitting the demo quiz');
    console.error('(the likely case, and a bug), or the quiz genuinely stopped asking.');
    console.error('If it is the second, re-run with --accept-smaller and say so in the PR.');
    process.exit(1);
  }
}

/* `missing` is not vendored: it is a diagnostic about THIS fetch, and an
   empty array is the only state that ever reaches here. The page reads
   count, summary, profile and answers, and those are what the drift check
   compares. */
const { missing, ...vendored } = built;
writeFileSync(join(site, 'demo-answers.json'), JSON.stringify(vendored, null, 2) + '\n');

console.log(`WROTE demo-answers.json — ${vendored.count} answers, `
  + `${vendored.profile.identity.join(' \u00b7 ')}, `
  + `${vendored.profile.goals.length} goal(s), ${vendored.profile.flags.length} flag(s).`);
console.log(`  ${vendored.summary}`);
