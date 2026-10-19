#!/usr/bin/env node
/* Refuse CSS that does not parse as the rules it looks like.
   ----------------------------------------------------------------------
   WHY THIS EXISTS. On 2026-10-18 /try's embed opened flush against the nav.
   The page said:

       .try-embed-section{padding:24px 0 112px;background:var(--cream)}

   and the browser reported padding-top: 0px. The nav consolidation had
   removed a rule's declarations and left its selector behind:

       /* Footer logo, white tint *_/
       .footer
       .try-embed-section{...}

   A selector with no `{}` of its own does not disappear. It joins the NEXT
   prelude, so that rule had become `.footer .try-embed-section` — valid CSS
   matching nothing, no console warning, no parse error. The comment between
   the two selectors is what hid it from a human reading the file.

   Nothing could catch this but a parse. The visual-diff suite compares each
   page against its own baseline, so a page that has been wrong since its
   baseline was taken simply looks like that. check-nav and check-wordmark
   compare copies across pages; this one is a different invariant — not "do
   the copies agree" but "does this file mean what it says".

   WHAT IT REFUSES. A selector prelude whose lines are not a comma-separated
   list. `a,\n  b{...}` is a list and fine. `a\n  b{...}` is either a
   descendant selector written across two lines, which nothing here does, or
   a rule that lost its block — and the second is worth a false positive.

   Comments are replaced by a line break rather than removed, so a comment
   sitting BETWEEN two selectors splits them instead of welding them into
   one line that would read as legitimate.

   ----------------------------------------------------------------------
   SECOND INVARIANT, same shape: `hidden` means hidden.

   On 2026-10-19 /sample-report's transcript shipped open. The page had

       <dl class="answers-all" id="answersGrid" hidden>
       .answers-all{margin:0;display:grid;...}

   and all 43 rows were on screen under a button offering to show them.
   `hidden` is `display:none` in the UA stylesheet, which ANY author
   `display` beats — so a rule written for the visible state silently
   un-hides the element, and script that sets `.hidden = true` to close it
   does nothing a reader can see.

   It is invisible to a per-page baseline for the usual reason: the page has
   looked like that since the baseline was taken. So: an element that
   carries `hidden` in the markup, or that the page's own script toggles,
   may not be the subject of an author `display` rule unless a `[hidden]`
   rule puts it back.
*/

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const SKIP = ['node_modules', 'tools', 'blend-mockups', '.git', '.github', 'test-results'];

function files(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !SKIP.includes(e.name)) files(join(dir, e.name), acc);
    else if (e.isFile() && (e.name.endsWith('.html') || e.name.endsWith('.css'))) acc.push(join(dir, e.name));
  }
  return acc;
}

/* Every `{`'s prelude, with comments already turned into line breaks. */
function preludes(css) {
  const out = [];
  let buf = '', depth = 0;
  for (const ch of css) {
    if (ch === '{') { out.push(buf); buf = ''; depth++; }
    else if (ch === '}') { buf = ''; depth--; }
    else if (ch === ';' && depth === 0) buf = '';
    else buf += ch;
  }
  return out;
}

const bad = [];
for (const file of files(site)) {
  const text = readFileSync(file, 'utf8');
  const sheets = file.endsWith('.css')
    ? [text]
    : [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);

  for (const sheet of sheets) {
    const css = sheet.replace(/\/\*[\s\S]*?\*\//g, '\n');
    for (const p of preludes(css)) {
      const sel = p.trim();
      if (!sel || sel.startsWith('@')) continue;        // at-rule preludes have their own grammar
      const lines = sel.split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length - 1; i++) {
        if (!lines[i].endsWith(',')) {
          bad.push({ name: relative(site, file), sel: lines.join('  ⏎  ') });
          i = lines.length;                              // one report per rule
        }
      }
    }
  }
}

/* ---- hidden means hidden -----------------------------------------------
   Deliberately narrow. It looks only at an element's OWN class or id rule
   (`.foo{...}`, `#foo{...}`), because that is the rule somebody writes next
   to markup they just gave a `hidden` attribute, and a general answer needs
   a selector engine. A descendant rule that sets display on a hidden
   element is a real but rarer way to lose, and not worth a parser here. */
const DISPLAY = /(^|;)\s*display\s*:/;
const unhidden = [];

for (const file of files(site).filter(f => f.endsWith('.html'))) {
  const text = readFileSync(file, 'utf8');
  const name = relative(site, file);

  /* Elements the page hides: `hidden` in the markup, or `x.hidden = ` in
     its script. Both are the same mistake waiting to happen. */
  const toggled = new Set();
  for (const m of text.matchAll(/<[a-z][^>]*\shidden(?=[\s>])[^>]*>/gi)) {
    const tag = m[0];
    const id = (tag.match(/\sid="([^"]+)"/) || [])[1];
    if (id) toggled.add('#' + id);
    const cls = (tag.match(/\sclass="([^"]+)"/) || [])[1];
    if (cls) for (const c of cls.trim().split(/\s+/)) toggled.add('.' + c);
  }
  for (const m of text.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
    if (new RegExp(`\\b${m[1]}\\.hidden\\s*=`).test(text)) toggled.add('#' + m[1]);
  }
  if (!toggled.size) continue;

  for (const sheet of [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1])) {
    const css = sheet.replace(/\/\*[\s\S]*?\*\//g, '\n');

    /* Every rule as { selector, body }, flat — nested at-rule bodies are
       walked too, since a media query's rules bite exactly the same. */
    const rules = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    for (let m; (m = re.exec(css));) rules.push({ sel: m[1].trim(), body: m[2] });

    const escapes = new Set();
    for (const r of rules) {
      if (!/display\s*:\s*none/.test(r.body)) continue;
      for (const part of r.sel.split(',')) {
        const t = part.trim();
        if (t === '[hidden]') { escapes.add('*'); continue; }
        const m = t.match(/^([.#][A-Za-z0-9_-]+)\[hidden\]$/);
        if (m) escapes.add(m[1]);
      }
    }
    if (escapes.has('*')) continue;

    for (const r of rules) {
      if (!DISPLAY.test(';' + r.body)) continue;
      for (const part of r.sel.split(',')) {
        const t = part.trim();
        if (!/^[.#][A-Za-z0-9_-]+$/.test(t)) continue;   // own rule only
        if (!toggled.has(t) || escapes.has(t)) continue;
        unhidden.push({ name, sel: t, body: r.body.trim().slice(0, 70) });
      }
    }
  }
}

if (unhidden.length) {
  console.error(`FAILED: ${unhidden.length} element(s) the page hides that CSS un-hides.\n`);
  for (const u of unhidden) {
    console.error(`  ${u.name}`);
    console.error(`    ${u.sel}{${u.body}}`);
    console.error(`    This element carries \`hidden\`, and \`hidden\` is display:none in the`);
    console.error(`    UA sheet — any author display beats it, so it is never actually hidden.`);
    console.error(`    Add \`${u.sel}[hidden]{display:none}\`.\n`);
  }
  process.exit(1);
}

if (bad.length) {
  console.error(`FAILED: ${bad.length} selector(s) that do not parse as written.\n`);
  for (const b of bad) {
    console.error(`  ${b.name}`);
    console.error(`    ${b.sel.slice(0, 160)}`);
    console.error(`    These are ONE selector, not two. The first lost its { } and joined the next.\n`);
  }
  console.error('A selector list needs a comma on every line but the last. If this really is');
  console.error('a descendant selector split across lines, put it on one line.');
  process.exit(1);
}

console.log('PASSED: every selector parses as the rule it looks like, '
  + 'and nothing the page hides is un-hidden by a display rule.');
