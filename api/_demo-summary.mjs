/* Which of the demo's answers explain the report, and how they read.
   ----------------------------------------------------------------------
   The answers panel lists all 43 in quiz order, and quiz order is
   demographics first: a reader saw consent, a name, a gender, an age, a
   unit choice, a height and a weight before anything that produced a
   recommendation. Everything that did — the goals, the sleep, the diet,
   the sun — was below the fold of a capped panel.

   So a sentence leads, built from these. Matched on the question TEXT
   rather than its stable id, because the ids are opaque (036XDOYO) and a
   brand renaming a question is the case worth catching, which is what the
   `missing` list is for: check-demo-report.mjs fails on it rather than
   letting the sentence quietly lose a clause.

   Shared by api/demo-answers.js, which builds the sentence, and
   tools/check-demo-report.mjs, which proves it can still be built. One
   definition so the two cannot drift. The leading underscore keeps Vercel
   from routing this as an endpoint of its own. */

/** Order is the order they read in the sentence. */
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

/** `answers` is [{ q, a }] in quiz order, as the proxy builds it. */
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

/* Values go in verbatim. Lower-casing a brand's own option text is a
   change to their words, and "Mind-Body Wellness" is not "mind-body
   wellness"; the sentence is built so the capitals read as deliberate.
   Every clause is skipped rather than printed empty, so a renamed
   question costs a clause and not a sentence full of "undefined". */
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
