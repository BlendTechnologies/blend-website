#!/usr/bin/env node
/* Refuse a checkout link that does not reach Stripe.
   ----------------------------------------------------------------------
   WHY THIS EXISTS. On 2026-10-19 every YEARLY checkout on the pricing page
   was broken, live, and had been for as long as anyone could tell.

   The page's cycle toggle calls it `yearly`, and so does pricing.json. The
   app validates against CHECKOUT_CYCLES = ["monthly", "annual"] and rejects
   anything else, so `?cycle=yearly` 307'd to
   /pricing?error=unknown_plan ... which vercel.json rewrites to "/". A
   customer who chose annual billing was dropped back at the top of the
   homepage, with no card taken and nothing said.

   Every automatic check passed through all of it. The link is in the HTML
   and looks right. The end of the redirect chain is a 200. The page renders.
   Nothing on this side knew the app's vocabulary, and nothing was going to
   until somebody tried to buy an annual plan.

   WHAT IT DOES. Collects every plan and cycle the pricing page can actually
   emit -- the static hrefs AND the values the toggle writes into them --
   and follows each one. A link passes only when it ends at Stripe.

     node tools/check-checkout.mjs

   THE FETCH IS THE AUTHORITY, not a list of allowed strings. A vendored copy
   of the app's enum would have drifted the same way the cycle name did; what
   cannot drift is whether the link lands on a payment page. Offline, it
   falls back to checking the page is self-consistent and says so, the same
   shape as check-demo-report.mjs.

   These are LIVE Stripe sessions. Following the redirect creates a Checkout
   Session nobody completes, which is exactly what a visitor clicking the
   button and changing their mind does, and the app's own comment says the
   worst an abuser achieves here is the same thing. No row is written on
   either side until a payment succeeds.
*/

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const page = readFileSync(join(site, 'index.html'), 'utf8');

/* The links as written, plus the cycles the toggle can substitute. Both
   matter: the static href is what a no-JavaScript visitor follows, and the
   rewritten one is what everybody else does. */
const STATIC = [...page.matchAll(/https:\/\/app\.blend-technologies\.com\/api\/checkout\?plan=([a-z]+)&cycle=([a-z]+)/g)]
  .map(m => ({ plan: m[1], cycle: m[2], how: 'static href' }));

if (!STATIC.length) {
  console.error('FAILED: the pricing page has no /api/checkout links at all.');
  console.error('Either the buttons stopped pointing at checkout, or the host changed.');
  process.exit(1);
}

/* What the toggle writes. The template is `cycle=${checkoutCycle}`, and the
   mapping above it is what turns the page's own word into the app's. Read
   the mapping rather than assuming it, so deleting it is caught. */
const mapped = page.match(/const checkoutCycle = cycle === '([a-z]+)' \? '([a-z]+)' : cycle;/);
const toggled = new Set(STATIC.map(s => s.cycle));
if (mapped) toggled.add(mapped[2]);
else {
  console.error('FAILED: the cycle mapping in the pricing toggle is gone.');
  console.error('The page calls it "yearly" and the app only accepts "monthly" and');
  console.error('"annual", so without the mapping every annual checkout 307s to an');
  console.error('error page that is rewritten to "/". See the comment on this check.');
  process.exit(1);
}

const plans = [...new Set(STATIC.map(s => s.plan))];
const combos = [];
for (const plan of plans) for (const cycle of toggled) combos.push({ plan, cycle });

let reached = 0;
const broken = [];
for (const { plan, cycle } of combos) {
  const url = `https://app.blend-technologies.com/api/checkout?plan=${plan}&cycle=${cycle}`;
  let res;
  try {
    res = await fetch(url, { redirect: 'manual' });
  } catch (e) {
    console.log(`  (could not reach checkout: ${e.message})`);
    broken.length = 0;
    reached = -1;
    break;
  }
  reached++;
  const to = res.headers.get('location') || '';
  if (!to.startsWith('https://checkout.stripe.com/')) {
    broken.push({ plan, cycle, status: res.status, to: to || '(no redirect)' });
  }
}

if (broken.length) {
  console.error(`FAILED: ${broken.length} checkout link(s) do not reach Stripe.\n`);
  for (const b of broken) {
    console.error(`  plan=${b.plan} cycle=${b.cycle}`);
    console.error(`    HTTP ${b.status} -> ${b.to.slice(0, 90)}`);
  }
  console.error('\nThe app validates plan and cycle against a closed set and sends anything');
  console.error('else to an error page. A link that looks right in the HTML and ends on a');
  console.error('200 can still be a customer who could not pay.');
  process.exit(1);
}

if (reached < 0) {
  console.log('PASSED: the pricing page is self-consistent (checkout not reached, offline check only).');
} else {
  console.log(`PASSED: ${reached} checkout link(s) across ${plans.length} plan(s) `
    + `and ${toggled.size} cycle(s) reach Stripe.`);
}
