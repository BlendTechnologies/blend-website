/* What the demo's answers say, and how the page draws them.
   ----------------------------------------------------------------------
   /sample-report embeds the live result of a real submission against the
   demo quiz. The report on its own is a set of assertions — eight products
   and a sentence each about percentages the reader has no way to judge —
   so the page shows the inputs beside the output.

   It used to show all 43 rows in quiz order, and quiz order is
   demographics first: a reader saw consent, a name, a gender, an age, a
   unit choice, a height and a weight before anything that produced a
   recommendation. Everything that did — the goals, the sleep, the diet,
   the sun — was below the fold of a capped panel. Founder's verdict on
   that panel: "really bad, it should look good and not necessarily show
   all answers."

   So `profile()` builds a SHAPE — who, goals, what they flagged, how they
   live, what they eat — and the full list is a disclosure behind it.

   Everything is matched on the question TEXT rather than its stable id,
   because the ids are opaque (036XDOYO) and a brand renaming a question is
   the case worth catching. For the ten fields in FIELDS that is what
   `missing` is for: check-demo-report.mjs fails on it rather than letting
   the sentence quietly lose a clause. The profile's extra rows are
   best-effort by design — each is dropped rather than printed empty, so a
   demo quiz without a sun question costs a row, not a panel.

   ONE DEFINITION, because there are three consumers and they must agree
   byte for byte:

     api/demo-answers.js        serves it at the edge
     tools/sync-demo-answers.mjs  vendors it for the static fallback
     tools/check-demo-report.mjs  refuses when the vendored copy drifts

   The checker compares JSON.stringify of one against the other, so the
   build cannot live in two places. It used to: the checker had its own
   copy of the loop below, and that copy did not sort by questionOrder.
   The leading underscore keeps Vercel from routing this as an endpoint. */

/** Order is the order they read in the sentence. Required: a miss fails CI. */
export const FIELDS = [
  { key: 'name',        match: /first name/i },
  { key: 'age',         match: /how old are you/i },
  { key: 'diet',        match: /dietary preferences or restrictions/i },
  { key: 'activity',    match: /how active is your daily routine/i },
  { key: 'sun',         match: /sun exposure/i },
  { key: 'sleep',       match: /hours do you sleep/i },
  { key: 'sleepIssues', match: /sleep issues/i },
  { key: 'energy',      match: /describes your energy/i },
  { key: 'stress',      match: /stress show up/i },
  { key: 'goals',       match: /popular goals/i },
];

/* The consent row is 140 characters and swamped the panel on a phone. A cap
   rather than a special case: the next long answer a brand writes is handled
   the same way, and the page is a summary of the answers, not a transcript. */
const CAP = 84;
const trim = v =>
  v.length > CAP ? v.slice(0, CAP - 1).replace(/[ ,;]+$/, '') + '…' : v;

/** The submission's responses as [{ q, a, parts? }] in quiz order.
 *
 *  `parts` carries the selected options unjoined, and only for a
 *  multi-select, because that is the only case where the page needs them
 *  back: splitting "Sleep, Boost Energy, Stress" on a comma works until a
 *  brand writes an option with a comma in it. One option needs no array,
 *  which also keeps the 140-character consent string out of the payload
 *  twice. */
export function rowsFrom(payload) {
  const questions = payload?.definition?.questions ?? [];
  const responses = payload?.responses ?? {};
  const rows = [];

  const ordered = [...questions].sort(
    (a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0));

  for (const q of ordered) {
    const r = responses[q.stableQuestionId];
    if (!r) continue;

    let parts = null;
    let value;
    if (r.kind === 'choice') {
      const text = new Map((q.answers ?? []).map(a => [a.stableAnswerId, a.optionText]));
      const picked = (r.answerIds ?? []).map(id => text.get(id) ?? id);
      value = picked.join(', ');
      if (picked.length > 1) parts = picked.map(p => trim(String(p)));
    } else {
      /* Everything that is not a choice carries its own shape; the ones this
         quiz uses are { value }. Anything else is stringified rather than
         dropped, so a new question type shows up as something odd rather
         than as a silently missing row. */
      value = r.value ?? Object.entries(r)
        .filter(([k]) => k !== 'kind')
        .map(([, v]) => v)
        .join(', ');
    }
    if (!value) continue;

    const row = { q: q.questionText, a: trim(String(value)) };
    if (parts) row.parts = parts;
    rows.push(row);
  }
  return rows;
}

/** `answers` is [{ q, a, parts? }] as rowsFrom builds it. */
export function pick(answers) {
  const got = {};
  const missing = [];
  for (const f of FIELDS) {
    const hit = answers.find(a => f.match.test(a.q));
    if (hit && hit.a) got[f.key] = hit.a;
    else missing.push(f.key);
  }
  return { got, missing };
}

/* Values go in verbatim. Lower-casing a brand's own option text is a change
   to their words, and "Mind-Body Wellness" is not "mind-body wellness"; the
   sentence is built so the capitals read as deliberate. Every clause is
   skipped rather than printed empty, so a renamed question costs a clause
   and not a sentence full of "undefined". */
export function sentence(got) {
  const bits = [];
  const who = [got.name, got.age].filter(Boolean).join(', ');
  const how = [got.diet, got.activity].filter(Boolean).join(', ');
  if (who && how) bits.push(`${who} — ${how}.`);
  else if (who || how) bits.push(`${who || how}.`);

  const day = [];
  if (got.sun) day.push(`${got.sun.toLowerCase()} sun`);
  if (got.sleep) day.push(`${got.sleep} hours' sleep`);
  if (day.length) bits.push(day.join(', ') + '.');

  const trouble = [got.sleepIssues, got.energy, got.stress].filter(Boolean).join(', ');
  if (trouble) bits.push(trouble + '.');

  if (got.goals) bits.push(`Goals: ${got.goals}.`);
  /* Each clause is its own sentence, so each starts with a capital: "sun"
     is lower-cased above to read inside a clause and would otherwise open
     one. Only the first character, never the rest — the words after it are
     the brand's. */
  return bits.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(' ');
}

/* ---- the shape the panel draws ----------------------------------------
   Labels on the left of each row are OURS; every value is the brand's own
   option text, unaltered. The two exceptions both take their word from the
   brand's own question rather than inventing one:

     "5–6"  ->  "5–6 hours"   from "how many HOURS do you sleep?"
     "170"  ->  "170 cm"      from "what is your height (CM)?"

   An answer of "5–6" under a label reading "Sleep" is ambiguous, and the
   unit is sitting right there in the question. Appended only when the value
   is bare digits and does not already end in that word, so a brand that
   writes "5–6 hours" as its option text does not get it twice. */
export function profile(answers) {
  const row = re => answers.find(a => re.test(a.q)) || null;
  const val = re => (row(re) || {}).a || '';

  /** A multi-select as a list: `parts` when it travelled, else split. */
  const list = re => {
    const r = row(re);
    if (!r || !r.a) return [];
    if (Array.isArray(r.parts) && r.parts.length) return r.parts.slice();
    return String(r.a).split(/,\s+/).filter(Boolean);
  };

  /** The value with the unit its own question names, when it needs one. */
  const withUnit = (re, from) => {
    const r = row(re);
    if (!r || !r.a) return '';
    if (!/^[\d\s–—.,/-]+$/.test(r.a)) return r.a;
    const unit = (r.q.match(from) || [])[1];
    if (!unit) return r.a;
    return r.a.toLowerCase().endsWith(unit.toLowerCase()) ? r.a : `${r.a} ${unit}`;
  };

  const rows = pairs => pairs
    .filter(([, v]) => v)
    .map(([k, v]) => ({ k, v }));

  return {
    name: val(/first name/i),
    /* The byline: who this is, as a `·`-separated line. An ARRAY rather than
       a joined string so sync-demo-answers.mjs can count it — the no-shrink
       rule there has to be able to see "four facts became three", and it
       could not while this was one string. Breaking the gender matcher in
       testing turned "Woman, 34 · 170 cm · 68 kg" into "34" and every check
       still passed.

       Gender, age, height and weight, and no more: ethnicity is asked (it
       moves a vitamin D threshold) and this demo answered "prefer not to
       say", which is not a thing to print beside somebody's name either
       way. */
    identity: [
      val(/what is your gender/i),
      val(/how old are you/i),
      withUnit(/your height \(/i, /\(([^)]+)\)/),
      withUnit(/your weight \(/i, /\(([^)]+)\)/),
    ].filter(Boolean),
    goals: list(/popular goals/i),
    /* The symptoms, from three questions, as one list. A reader does not
       care which question "caffeine reliance" arrived under; they care that
       it is why there is an adaptogen in the plan. */
    flags: [].concat(
      list(/sleep issues/i),
      list(/describes your energy/i),
      list(/stress show up/i)),
    day: rows([
      ['Diet', val(/dietary preferences or restrictions/i)],
      ['Sleep', withUnit(/hours do you sleep/i, /how many (\w+)/i)],
      ['Sun', val(/sun exposure/i)],
      ['Activity', val(/how active is your daily routine/i)],
    ]),
    /* The rows that explain the picks a reader would otherwise question: an
       algae omega-3 for somebody who never eats fish, B12 for a vegetarian. */
    intake: rows([
      ['Meat', val(/meat and poultry/i)],
      ['Fish', val(/fish and seafood/i)],
      ['Eggs', val(/how many eggs/i)],
      ['Dairy', val(/dairy products/i)],
    ]),
  };
}

/** The whole response, from an upstream submission. Key order is part of
 *  the contract: check-demo-report.mjs compares stringified output. */
export function buildPayload(upstream) {
  const answers = rowsFrom(upstream);
  const { got, missing } = pick(answers);
  return {
    count: answers.length,
    summary: sentence(got),
    profile: profile(answers),
    missing,
    answers,
  };
}
