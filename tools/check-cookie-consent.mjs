#!/usr/bin/env node
/* The cookie banner is one component. Refuse when a page is missing it.
   ----------------------------------------------------------------------
   WHY THIS EXISTS. On 2026-10-19 five of thirteen pages carried no consent
   system at all: /sample-report and all four pages under /use-cases. The
   eight that had it had had it since they were written, and the five had
   never had it, so no capture of those five ever showed a banner and no
   baseline was ever wrong. This is the blind spot check-wordmark.mjs and
   check-nav.mjs were written for — the screenshot suite compares each page
   against its own baseline, so a component missing from a page since before
   its baseline was taken is invisible to it, however many viewports run.

   /sample-report is the page sent in cold outreach, so it was the likeliest
   first contact anyone had with the site, and the one page with a
   cross-origin iframe on it.

   THREE PARTS, NOT TWO. It is tempting to grep for the stylesheet and the
   script and call that the include. It is not:

     1. <link rel="stylesheet" href=".../cookie-consent.css">
     2. <script src=".../cookie-consent.js"></script>
     3. the #blend-cookie-banner markup, inline in the page

   cookie-consent.js does not build the banner — showBanner() calls
   getElementById('blend-cookie-banner') and returns if it is not there. So a
   page with the stylesheet and the script and no markup renders no banner on
   first visit, and window.blendBookDemo() becomes a button that silently does
   nothing: it falls through to showBanner(), which returns, and the two ways
   round it that the prompt offers (Calendly in a new tab, and email) are
   inside the message that never appears. Checking two of the three parts
   would have passed that page.

   PATHS ARE RESOLVED, NOT COMPARED. Four of the thirteen pages are one
   directory down, where the relative form the root pages use —
   href="cookie-consent.css" — resolves to /use-cases/cookie-consent.css and
   404s. The stylesheet and the script would simply not load, the banner would
   not render, and nothing else on the page would complain. So this does not
   compare the href strings: it resolves each one against the page that
   carries it, the way the browser does, and refuses when the target is not
   on disk. Both path forms are therefore legal wherever they actually work.

   ONE DIFFERENCE IS SANCTIONED, and it is normalised away below rather than
   ignored, so anything else in the banner has to match:

     the privacy-policy href. The root pages carry href="privacy.html" and
     the pages under /use-cases carry href="/privacy", because the relative
     form resolves to /use-cases/privacy.html from there. Same destination;
     both are resolved above, so a form that does not work still fails.

   A FOURTH PART EXISTS AND IS DELIBERATELY NOT CHECKED HERE. The eight pages
   that have always had the consent system also carry

     <a onclick="return blendOpenCookieSettings();">Cookie settings</a>

   in .footer-bottom, and it is the only way to change a choice once it has
   been made — "as easy to withdraw as to give" is the actual standard, so
   this is worth more than tidiness. The five pages that gained the system on
   2026-10-19 do not have it: the four under /use-cases carry a different,
   darker footer, and sample-report.html has no <footer> element at all, so
   requiring it here would refuse a page that has nowhere to put it. Consent
   is stored per origin, so the link on any other page still governs the whole
   site and nobody is stranded.

   When all thirteen footers can carry it, require it here too. Until then
   this check covers the three parts that decide whether the banner works at
   all, and not the one that decides how pleasant it is to change your mind.
*/

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');

function pages(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !['node_modules', 'tools', 'blend-mockups', '.git', '.github'].includes(e.name)) {
      pages(join(dir, e.name), acc);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      acc.push(join(dir, e.name));
    }
  }
  return acc;
}

/* Resolve an href the way serve.mjs and Vercel do: root-relative against the
   site root, otherwise against the page's own directory, then cleanUrls —
   exact file, then +.html, then /index.html. Returns null when nothing is
   there, which is the failure this check exists to catch. */
function resolveHref(href, pageFile) {
  if (/^(https?:)?\/\//.test(href) || href.startsWith('#') || href.startsWith('mailto:')) return 'external';
  const path = href.split(/[?#]/)[0];
  const base = path.startsWith('/') ? site : dirname(pageFile);
  const target = resolve(base, path.replace(/^\//, ''));
  if (!target.startsWith(site)) return null;
  for (const c of [target, target + '.html', join(target, 'index.html')]) {
    try { if (statSync(c).isFile()) return c; } catch { /* keep looking */ }
  }
  return null;
}

/* Comments are not markup. /sample-report and /try both carry a note that
   quotes `<script src="cookie-consent.js">` while explaining that a script
   element with a src ignores its inline content — so a check reading raw HTML
   counts the prose as the include. An earlier version of this file did, and
   would have passed a page whose only mention of the script was that comment.
   Strip them before anything is matched. */
const stripComments = html => html.replace(/<!--[\s\S]*?-->/g, '');

const BANNER = /<div id="blend-cookie-banner"[\s\S]*?\n<\/div>/;
const norm = s => s
  .replace(/href="(?:\/privacy|privacy\.html)"/g, 'href="PRIVACY"')
  .replace(/\s+/g, ' ')
  .trim();

const found = [];
const broken = [];

for (const file of pages(site)) {
  const name = relative(site, file);
  const html = stripComments(readFileSync(file, 'utf8'));

  const css = html.match(/<link[^>]+href="([^"]*cookie-consent\.css)"/);
  const js = html.match(/<script[^>]+src="([^"]*cookie-consent\.js)"/);
  const banner = html.match(BANNER);

  const missing = [];
  if (!css) missing.push('cookie-consent.css stylesheet');
  if (!js) missing.push('cookie-consent.js script');
  if (!banner) missing.push('#blend-cookie-banner markup');
  if (missing.length) { broken.push({ name, missing }); continue; }

  /* Every reference has to actually resolve from this page. */
  const unresolved = [];
  for (const [what, href] of [['stylesheet', css[1]], ['script', js[1]]]) {
    if (!resolveHref(href, file)) unresolved.push(`${what} href="${href}"`);
  }
  const privacy = banner[0].match(/<a[^>]+href="([^"]+)"/);
  if (!privacy) unresolved.push('banner has no privacy-policy link');
  else if (!resolveHref(privacy[1], file)) unresolved.push(`privacy link href="${privacy[1]}"`);

  if (unresolved.length) { broken.push({ name, unresolved }); continue; }

  found.push({ name, banner: norm(banner[0]) });
}

if (!found.length && !broken.length) {
  console.error('FAILED: no pages found. Has the layout changed?');
  process.exit(1);
}

if (broken.length) {
  console.error(`FAILED: ${broken.length} of ${broken.length + found.length} pages do not carry a working consent system.\n`);
  for (const b of broken) {
    if (b.missing) {
      console.error(`  ${b.name} — missing: ${b.missing.join(', ')}`);
    } else {
      console.error(`  ${b.name} — does not resolve: ${b.unresolved.join(', ')}`);
    }
  }
  console.error('\nAll three parts are required. cookie-consent.js only wires up a');
  console.error('#blend-cookie-banner that is already in the page, so the stylesheet and');
  console.error('the script on their own render no banner and leave blendBookDemo() as a');
  console.error('button that does nothing. Copy the block from index.html, and use the');
  console.error('root-relative form (/cookie-consent.css) on any page below the site root.');
  process.exit(1);
}

/* The markup itself has to agree, the way the nav and the wordmark do. */
const groups = new Map();
for (const f of found) {
  if (!groups.has(f.banner)) groups.set(f.banner, []);
  groups.get(f.banner).push(f.name);
}

if (groups.size > 1) {
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const [majority, ...rest] = sorted;
  console.error(`FAILED: ${groups.size} distinct cookie banners across ${found.length} pages.\n`);
  console.error(`  the ${majority[1].length} that agree: ${majority[1].join(', ')}\n`);
  for (const [sig, names] of rest) {
    console.error(`  differs — ${names.join(', ')}`);
    const a = majority[0].split(/(?=<)/), b = sig.split(/(?=<)/);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.error(`    expected: ${(a[i] || '(nothing)').slice(0, 120)}`);
        console.error(`    found:    ${(b[i] || '(nothing)').slice(0, 120)}\n`);
        break;
      }
    }
  }
  console.error('The banner is one component with no templating behind it, so the copies');
  console.error('have to be kept identical by hand. One difference is sanctioned and');
  console.error('already normalised away here: the privacy-policy href, which is relative');
  console.error('on the root pages and root-relative below them.');
  process.exit(1);
}

console.log(`PASSED: ${found.length} pages carry the same consent system`
  + ` (stylesheet, script and #blend-cookie-banner markup), and every reference resolves.`);
