// pricing.json is the source /how-it-works reads. index.html still carries
// the same numbers in data- attributes on its tiers, because the homepage
// was out of scope for the rebuild. Two copies drift, so this refuses when
// they do. Run it before merging anything that touches either.
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url).pathname;
const data = JSON.parse(await readFile(root + 'pricing.json', 'utf8'));
const html = await readFile(root + 'index.html', 'utf8');

const problems = [];
for (const plan of data.plans) {
  const re = new RegExp(`data-tier="${plan.id}"[\\s\\S]{0,800}?class="tier-price"([^>]*)>`);
  const m = html.match(re);
  if (!m) { problems.push(`${plan.id}: no tier found on the homepage`); continue; }
  const attrs = m[1];
  for (const [cycle, key] of [['monthly', 'monthly'], ['yearly', 'yearly']]) {
    for (const cur of data.currencies) {
      const want = plan[key][cur];
      const got = attrs.match(new RegExp(`data-price-${cycle}-${cur}="(\\d+)"`));
      if (!got) { problems.push(`${plan.id} ${cycle} ${cur}: missing on the homepage`); continue; }
      if (Number(got[1]) !== want) {
        problems.push(`${plan.id} ${cycle} ${cur}: pricing.json ${want}, homepage ${got[1]}`);
      }
    }
  }
}

if (problems.length) {
  console.error('REFUSED: pricing.json and the homepage disagree.\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`PASSED: ${data.plans.length} plan(s) match the homepage across ${data.currencies.join(', ')}.`);
