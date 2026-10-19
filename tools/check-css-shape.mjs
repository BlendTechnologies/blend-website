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

console.log('PASSED: every selector parses as the rule it looks like.');
