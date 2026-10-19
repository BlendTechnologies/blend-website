// pricing.json is the source /how-it-works reads. index.html still carries
// the same numbers in data- attributes on its tiers, because the homepage
// was out of scope for the rebuild. Two copies drift, so this refuses when
// they do. Run it before merging anything that touches either.
import { readFile, readdir } from 'node:fs/promises';

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

/* ---- AND EVERY PRICE TYPED INTO PROSE, ANYWHERE ------------------------
   The check above only ever read index.html's tier attributes, because that
   is where the cards are. Prices written into a SENTENCE on another page
   were invisible to it, and on 2026-10-19 /use-cases/compare was found
   saying "Pro from $299/month, Enterprise from $599/month" while
   pricing.json said 189 and publishes no Enterprise price at all. It had
   been wrong long enough that nobody knew when it started.

   So: every `$<number>` in visible copy across the site has to be a figure
   pricing.json actually contains. Monthly and yearly, every currency, which
   is what makes 490 legal and 299 not. The point is not to parse the
   sentence, it is that a number nobody can source does not get to sit on a
   pricing page. */
const pages = (await readdir(root, { recursive: true }))
  .filter(f => f.endsWith('.html') && !f.startsWith('node_modules') && !f.startsWith('blend-mockups'));

const legal = new Set();
for (const plan of data.plans) {
  for (const cycle of ['monthly', 'yearly']) {
    for (const cur of data.currencies) legal.add(String(plan[cycle][cur]));
  }
}

const strays = [];
for (const file of pages) {
  const text = (await readFile(root + file, 'utf8'))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  for (const m of text.matchAll(/\$(\d[\d,]*)/g)) {
    const n = m[1].replace(/,/g, '');
    if (legal.has(n)) continue;
    strays.push({ file, n, context: text.slice(Math.max(0, m.index - 60), m.index + 50).replace(/\s+/g, ' ').trim() });
  }
}

if (strays.length) {
  console.error(`REFUSED: ${strays.length} price(s) in copy that pricing.json does not contain.\n`);
  for (const s of strays) {
    console.error(`  ${s.file}: $${s.n}`);
    console.error(`    ...${s.context}...`);
  }
  console.error('\npricing.json is the source of truth. Either the copy is stale, or the');
  console.error('price moved and pricing.json needs updating first.');
  process.exit(1);
}

if (problems.length) {
  console.error('REFUSED: pricing.json and the homepage disagree.\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`PASSED: ${data.plans.length} plan(s) match the homepage across ${data.currencies.join(', ')}, `
  + `and every price in copy across ${pages.length} page(s) is one pricing.json publishes.`);
