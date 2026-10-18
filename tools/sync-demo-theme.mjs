#!/usr/bin/env node
/* The sample report wears the demo quiz's own theme.
   ----------------------------------------------------------------------
   WHY THIS EXISTS. Founder, 2026-10-18: "the report should be like the
   demo." /try embeds the live demo quiz; /sample-report showed the same
   product in a palette typed into this repository by hand, and the two
   had already parted company — the live demo paints its pills
   --quiz-input-bg: 250 248 242 (its cream) and the page drew them white.
   One token, but it is the whole profile and goals strip, and nothing
   here could notice: the figure is the brand's, not ours.

   So the demo's theme is VENDORED, exactly the way pricing.json vendors
   prices and product-facts.json vendors the engine's figures, and the
   page is written from the vendored copy rather than typed.

     node tools/sync-demo-theme.mjs           fetch the live demo, rewrite
     node tools/sync-demo-theme.mjs --check   refuse if the page has drifted

   --check compares the PAGE against demo-theme.json offline and always
   refuses on a mismatch. It reaches for the live demo too, and a
   difference there is reported as a warning rather than a failure: the
   brand can repaint their quiz at any moment, and CI going red because
   somebody moved a colour in a dashboard is not a useful gate. Run
   without --check to take the new theme.

   The DEMO URL is the one try.html embeds, read from that file rather
   than written twice. */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const CHECK = process.argv.includes('--check');

/* bg/text/accent/... are the swatch's data-* names; the values are the
   custom properties the report's own markup reads. */
const TOKENS = {
  bg: '--quiz-bg', text: '--quiz-text', accent: '--quiz-accent',
  cardbg: '--quiz-card-bg', cardtext: '--quiz-card-text', cardborder: '--quiz-card-border',
  inputbg: '--quiz-input-bg', inputtext: '--quiz-input-text', inputborder: '--quiz-input-border',
  buttonstext: '--quiz-buttons-text',
};

function demoUrl() {
  const html = readFileSync(join(site, 'try.html'), 'utf8');
  const m = html.match(/<iframe src="([^"]+\/quiz\/[^"]+)"/);
  if (!m) throw new Error('try.html no longer embeds a quiz; this tool reads the URL from there.');
  return m[1];
}

async function liveTheme() {
  const res = await fetch(demoUrl(), { redirect: 'follow' });
  if (!res.ok) throw new Error(`demo quiz returned ${res.status}`);
  const html = await res.text();
  const out = {};
  for (const [name, prop] of Object.entries(TOKENS)) {
    const m = html.match(new RegExp(`${prop}:\\s*([^;"]+)`));
    if (!m) throw new Error(`the demo quiz no longer sets ${prop}`);
    out[name] = m[1].trim();
  }
  return out;
}

/* The swatch the page opens on. Markers rather than a regex over the whole
   file, so a hand edit inside them is overwritten and one outside is not. */
const START = '<!-- demo-theme:start -->';
const END = '<!-- demo-theme:end -->';

function swatchHtml(theme) {
  const attrs = Object.keys(TOKENS).map(k => `data-${k}="${theme[k]}"`).join(' ');
  const [r, g, b] = theme.accent.split(/\s+/);
  const [br, bg_, bb] = theme.bg.split(/\s+/);
  return `<button type="button" class="swatch" title="Demo" aria-label="The demo quiz's own palette"`
    + ` style="background:linear-gradient(135deg,rgb(${r} ${g} ${b}) 50%,rgb(${br} ${bg_} ${bb}) 50%)"`
    + ` ${attrs}><span>Demo</span></button>`;
}

const pagePath = join(site, 'sample-report.html');
const vendorPath = join(site, 'demo-theme.json');
let page = readFileSync(pagePath, 'utf8');
const a = page.indexOf(START), z = page.indexOf(END);
if (a < 0 || z < 0) {
  console.error(`FAILED: sample-report.html has no ${START} ... ${END} region.`);
  process.exit(1);
}
const inPage = page.slice(a + START.length, z).trim();

if (CHECK) {
  const vendored = JSON.parse(readFileSync(vendorPath, 'utf8'));
  const want = swatchHtml(vendored.theme);
  if (inPage !== want) {
    console.error('FAILED: sample-report.html does not match demo-theme.json.\n');
    /* Naming the token that moved, not two 200-character prefixes that are
       identical up to the one attribute that differs. */
    for (const k of Object.keys(TOKENS)) {
      const got = (inPage.match(new RegExp(`data-${k}="([^"]*)"`)) || [])[1];
      if (got !== vendored.theme[k]) {
        console.error(`  ${TOKENS[k]}: page has ${got ?? '(nothing)'}, demo-theme.json has ${vendored.theme[k]}`);
      }
    }
    console.error('');
    console.error('Run `node tools/sync-demo-theme.mjs` rather than editing between the markers.');
    process.exit(1);
  }
  let live = null;
  try { live = await liveTheme(); } catch (e) { console.log(`  (live demo not reached: ${e.message})`); }
  if (live) {
    const moved = Object.keys(TOKENS).filter(k => live[k] !== vendored.theme[k]);
    if (moved.length) {
      console.log(`WARNING: the live demo has repainted ${moved.length} token(s) since this was vendored:`);
      for (const k of moved) console.log(`  ${TOKENS[k]}: vendored ${vendored.theme[k]} -> live ${live[k]}`);
      console.log('Run `node tools/sync-demo-theme.mjs` to take them.');
    }
  }
  console.log(`PASSED: the sample report opens on the demo quiz's own ${Object.keys(TOKENS).length} colour tokens.`);
  process.exit(0);
}

const theme = await liveTheme();
writeFileSync(vendorPath, JSON.stringify({
  source: demoUrl(),
  fetched: new Date().toISOString().slice(0, 10),
  theme,
}, null, 2) + '\n');
page = page.slice(0, a + START.length) + '\n        ' + swatchHtml(theme) + '\n        ' + page.slice(z);
writeFileSync(pagePath, page);
for (const [k, prop] of Object.entries(TOKENS)) console.log(`  ${prop}: ${theme[k]}`);
console.log(`Wrote the demo quiz's theme to demo-theme.json and into sample-report.html.`);
