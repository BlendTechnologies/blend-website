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

import { buildPayload } from '../api/_demo-summary.mjs';
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

/* The answers panel is built from named questions (api/_demo-summary.mjs),
   because the stable ids are opaque. A brand renaming one costs the panel a
   row, silently — it would just read shorter and nobody would know which
   fact went missing. So the same matchers run here against the live
   submission, and the whole payload is rebuilt with the same function the
   edge handler serves. */
try {
  const key = (doc.url.match(/\/quiz\/([^/]+)\//) || [])[1];
  const sub = (doc.url.match(/\/results\/([^/?#]+)/) || [])[1];
  const res = await fetch(`https://app.blend-technologies.com/api/embed/${key}/submissions/${sub}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const built = buildPayload(await res.json());

  /* demo-answers.json is what the page falls back to where the edge
     function cannot run — a local preview, and every visual-diff capture.
     A vendored copy of live data is exactly what went wrong with the report
     fragment, so it is checked rather than trusted. Compared whole, not
     field by field: `profile` is what the panel actually draws now, and a
     stale goal chip is as wrong as a stale answer row. */
  const vendored = JSON.parse(readFileSync(join(site, 'demo-answers.json'), 'utf8'));
  const { missing, ...live } = built;
  const want = JSON.stringify(live);
  const have = JSON.stringify({
    count: vendored.count,
    summary: vendored.summary,
    profile: vendored.profile,
    answers: vendored.answers,
  });
  if (want !== have) {
    console.error('FAILED: demo-answers.json no longer matches the live submission.');
    console.error(`  vendored: ${vendored.count} answers, "${(vendored.summary || '').slice(0, 60)}..."`);
    console.error(`  live:     ${live.count} answers, "${live.summary.slice(0, 60)}..."`);
    console.error('\nRun `node tools/sync-demo-answers.mjs`, or the local preview and');
    console.error('every screenshot show stale answers.');
    process.exit(1);
  }

  if (missing.length) {
    console.error(`FAILED: the summary has lost ${missing.length} of its fields: ${missing.join(', ')}.`);
    console.error('A question in the demo quiz was renamed, or dropped. Either update the');
    console.error('matchers in api/_demo-summary.mjs or accept the shorter sentence there.');
    process.exit(1);
  }

  /* The panel is a shape now, not a list, and a shape can go empty without
     anything above noticing: `profile` is best-effort by design, so every
     row dropping leaves a valid payload and a panel with a heading and
     nothing under it. These three are what the demo is FOR. */
  const p = live.profile;
  const thin = [
    !p.identity.length && 'identity (gender, age, height, weight)',
    !p.goals.length && 'goals',
    !p.flags.length && 'what they flagged',
    !p.day.length && 'how they live',
  ].filter(Boolean);
  if (thin.length) {
    console.error(`FAILED: the answers panel would draw empty: no ${thin.join(', no ')}.`);
    console.error('The matchers in api/_demo-summary.mjs no longer fit this demo quiz.');
    process.exit(1);
  }

  console.log(`  summary: ${live.summary}`);
  console.log(`  panel:   ${p.identity.join(' \u00b7 ')}, ${p.goals.length} goals, ${p.flags.length} flags, `
    + `${p.day.length} lifestyle rows, ${p.intake.length} intake rows`);
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
