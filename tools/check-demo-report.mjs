#!/usr/bin/env node
/* The sample report is a live result, and live results expire.
   ----------------------------------------------------------------------
   /sample-report embeds a real submission against the demo quiz, so the
   page is the product rather than a picture of it and follows the demo
   without anybody regenerating anything. The cost is that a results link
   is good for RESULTS_LINK_TTL_DAYS = 90 (lib/quiz/results-expiry.ts),
   checked before the recommendation is ever fetched. On day 91 the
   marketing site's sample report becomes one line of grey text saying the
   link has expired, and nothing else changes: the page still returns 200,
   the iframe still loads, the screenshot suite still passes because the
   frame is cross-origin and a baseline cannot see inside it.

   So this check fetches it and reads what comes back.

     node tools/check-demo-report.mjs

   It refuses when the embedded URL is not a live report, and warns inside
   the last `warnWithinDays` so the replacement is a decision rather than
   an outage. Replacing it means taking the demo quiz again and putting
   the new URL in demo-report.json and in sample-report.html's iframe.

   Offline it still checks the two agree, which is the part CI can always
   do; the fetch is best-effort and a network failure is reported, not
   fatal. An EXPIRED link, once seen, is fatal. */

import { pick, sentence } from '../api/_demo-summary.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');

const doc = JSON.parse(readFileSync(join(site, 'demo-report.json'), 'utf8'));
const page = readFileSync(join(site, 'sample-report.html'), 'utf8');

const inPage = (page.match(/<iframe[^>]*id="reportFrame"[\s\S]*?src="([^"]+)"/) || [])[1];
if (!inPage) {
  console.error('FAILED: sample-report.html has no #reportFrame iframe with a src.');
  process.exit(1);
}
if (inPage !== doc.url) {
  console.error('FAILED: the page and demo-report.json embed different results.\n');
  console.error(`  page:  ${inPage}`);
  console.error(`  json:  ${doc.url}`);
  process.exit(1);
}

const submitted = new Date(doc.submittedAt);
const expires = new Date(submitted.getTime() + doc.ttlDays * 86400000);
const daysLeft = Math.floor((expires - Date.now()) / 86400000);

if (daysLeft < 0) {
  console.error(`FAILED: this results link expired ${-daysLeft} day(s) ago `
    + `(${doc.ttlDays}-day TTL from ${doc.submittedAt}).`);
  console.error('Take the demo quiz again and put the new URL in demo-report.json and the iframe.');
  process.exit(1);
}

/* What the app renders INSTEAD of a report. Matching the copy rather than a
   status code, because every one of these states returns 200.
   Taken VERBATIM from lib/copy.ts's `results` block, not paraphrased: the
   first version of this check used /could not find|not found/i, which
   matched a Next.js chunk inside a perfectly good report and failed on it.
   A loose pattern here fails the build on a working page, which is worse
   than the silence it was written to end. */
const DEAD = [
  ['linkExpired', 'This results link has expired.'],
  ['notFound', "We couldn't find a recommendation for this submission."],
  ['notReady', "Your results aren't ready yet."],
  ['error', 'Something went wrong loading your results.'],
];

let live = null;
try {
  const res = await fetch(doc.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const dead = DEAD.find(([, copy]) => html.includes(copy));
  if (dead) {
    console.error(`FAILED: the embedded result is no longer a report (${dead[0]}).`);
    console.error(`  ${doc.url}`);
    console.error('Take the demo quiz again and put the new URL in demo-report.json and the iframe.');
    process.exit(1);
  }
  /* A report says so. Without this the check passes on any 200 that is not
     one of the three known failures, including an empty shell. */
  if (!/Your wellness plan|Recommended products/i.test(html)) {
    console.error('FAILED: the embedded URL returned 200 but carries no report.');
    console.error(`  ${doc.url}`);
    process.exit(1);
  }
  live = true;
} catch (e) {
  console.log(`  (could not reach the demo result: ${e.message})`);
}

/* The sentence that leads the answers panel is built from named questions
   (api/_demo-summary.mjs), because the stable ids are opaque. A brand
   renaming one costs the sentence a clause, silently — the panel would
   just read shorter and nobody would know which fact went missing. So the
   same matchers run here against the live submission. */
try {
  const key = (doc.url.match(/\/quiz\/([^/]+)\//) || [])[1];
  const sub = (doc.url.match(/\/results\/([^/?#]+)/) || [])[1];
  const res = await fetch(`https://app.blend-technologies.com/api/embed/${key}/submissions/${sub}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = await res.json();
  const answers = [];
  for (const q of payload?.definition?.questions ?? []) {
    const r = (payload.responses ?? {})[q.stableQuestionId];
    if (!r) continue;
    const text = new Map((q.answers ?? []).map(a => [a.stableAnswerId, a.optionText]));
    const v = r.kind === 'choice'
      ? (r.answerIds ?? []).map(id => text.get(id) ?? id).join(', ')
      : r.value;
    if (v) answers.push({ q: q.questionText, a: String(v) });
  }
  /* demo-answers.json is what the page falls back to where the edge
     function cannot run — a local preview, and every visual-diff capture.
     A vendored copy of live data is exactly what went wrong with the
     report fragment, so it is checked rather than trusted. */
  const vendored = JSON.parse(readFileSync(join(site, 'demo-answers.json'), 'utf8'));
  const live = { count: answers.length, summary: sentence(pick(answers).got),
                 answers: answers.map(a => ({ q: a.q, a: a.a })) };
  const trim = v => v.length > 84 ? v.slice(0, 83).replace(/[ ,;]+$/, '') + '\u2026' : v;
  live.answers = live.answers.map(a => ({ q: a.q, a: trim(a.a) }));
  if (JSON.stringify(live) !== JSON.stringify({ count: vendored.count, summary: vendored.summary, answers: vendored.answers })) {
    console.error('FAILED: demo-answers.json no longer matches the live submission.');
    console.error(`  vendored: ${vendored.count} answers, "${(vendored.summary || '').slice(0, 60)}..."`);
    console.error(`  live:     ${live.count} answers, "${live.summary.slice(0, 60)}..."`);
    console.error('\nRegenerate it, or the local preview and every screenshot show stale answers.');
    process.exit(1);
  }

  const { got, missing } = pick(answers);
  if (missing.length) {
    console.error(`FAILED: the summary has lost ${missing.length} of its fields: ${missing.join(', ')}.`);
    console.error('A question in the demo quiz was renamed, or dropped. Either update the');
    console.error('matchers in api/_demo-summary.mjs or accept the shorter sentence there.');
    process.exit(1);
  }
  console.log(`  summary: ${sentence(got)}`);
} catch (e) {
  console.log(`  (summary not checked: ${e.message})`);
}

if (daysLeft <= doc.warnWithinDays) {
  console.log(`WARNING: this results link expires in ${daysLeft} day(s), on ${expires.toISOString().slice(0, 10)}.`);
  console.log('Take the demo quiz again and replace the URL before it does.');
}

console.log(`PASSED: /sample-report embeds a live demo result`
  + `${live ? '' : ' (not reached, offline check only)'}`
  + `, ${daysLeft} day(s) before its link expires.`);
