/* The answers behind the sample report.
   ----------------------------------------------------------------------
   /sample-report embeds the live result of a real submission against the
   demo quiz. The report on its own is a set of assertions: eight products
   and a sentence each about percentages the reader has no way to judge.
   The answers are what make it an argument — limited sun and a vegetarian
   diet explain the vitamin D and the B12, never eating fish explains an
   algae omega-3 — so the page shows both.

   They come from the SAME submission as the report, which is the whole
   point: there is no second copy to drift. The page used to inline an
   export rendered against a fixture, and the fixture's percentages
   disagreed with its own breakdown for months because nothing tied them
   together.

   WHY A PROXY. GET /api/embed/:key/submissions/:id is public and
   unauthenticated — the quiz runtime reads it to resume a half-finished
   quiz — but it sends no Access-Control-Allow-Origin, so a fetch from
   this origin is blocked by the browser. Server side there is no such
   rule. This also lets the response be trimmed to what the page draws
   (the submission is 150KB, mostly a quiz definition) and cached at the
   edge, so a visitor costs the app nothing.

   It resolves answer ids to their option text here rather than in the
   page, because that needs the quiz definition, which is the 150KB. */

import { pick, sentence } from './_demo-summary.mjs';

export const config = { runtime: 'edge' };

const APP = 'https://app.blend-technologies.com';

/* The submission the page embeds. Kept in step with demo-report.json and
   sample-report.html's iframe by tools/check-demo-report.mjs, which also
   refuses once the results link has expired. */
const EMBED_KEY = '928d8ad4333a4dc4b13e7d86f7557526';
const SUBMISSION = '02edf24c-8c6d-46a8-81af-faffc931abfa';

export default async function handler() {
  let payload;
  try {
    const res = await fetch(`${APP}/api/embed/${EMBED_KEY}/submissions/${SUBMISSION}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    payload = await res.json();
  } catch (e) {
    /* The page hides the panel and still shows the report. A sample report
       with no answer list is the page as it was; a broken page is not. */
    return json({ error: 'upstream', detail: String(e.message || e) }, 502, 60);
  }

  const questions = payload?.definition?.questions ?? [];
  const responses = payload?.responses ?? {};

  const answers = [];
  for (const q of [...questions].sort((a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0))) {
    const r = responses[q.stableQuestionId];
    if (!r) continue;

    let value;
    if (r.kind === 'choice') {
      const text = new Map((q.answers ?? []).map(a => [a.stableAnswerId, a.optionText]));
      value = (r.answerIds ?? []).map(id => text.get(id) ?? id).join(', ');
    } else {
      /* Everything that is not a choice carries its own shape; the ones
         this quiz uses are { value }. Anything else is stringified rather
         than dropped, so a new question type shows up as something odd
         rather than as a silently missing row. */
      value = r.value ?? Object.entries(r)
        .filter(([k]) => k !== 'kind')
        .map(([, v]) => v)
        .join(', ');
    }
    if (!value) continue;
    /* The consent row is 140 characters and swamped the panel on a phone.
       A cap rather than a special case: the next long answer a brand writes
       is handled the same way, and the page is a summary of the answers,
       not a transcript. */
    value = String(value);
    if (value.length > 84) value = value.slice(0, 83).replace(/[ ,;]+$/, '') + '\u2026';
    answers.push({ q: q.questionText, a: value });
  }

  /* The sentence that leads the panel. `missing` travels with it so the
     page can tell "this demo has no sun question" from "the proxy is
     having a bad day", and so check-demo-report.mjs can fail on it. */
  const { got, missing } = pick(answers);
  return json({
    count: answers.length,
    summary: sentence(got),
    missing,
    answers,
  }, 200, 3600);
}

function json(body, status, maxAge) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}
