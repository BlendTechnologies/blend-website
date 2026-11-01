import { chromium } from '/Users/julienbrassart/Developer/Blend-OS/tools/visual-diff/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:4878/how-it-works', { waitUntil: 'networkidle' });
await p.addStyleTag({ content: '#blend-cookie-banner{display:none !important}' });
await p.evaluate(async () => { const Ht = document.documentElement.scrollHeight; for (let y = 0; y < Ht; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } window.scrollTo(0, 0); });
await p.waitForTimeout(300);
const rows = await p.evaluate(() => { const sy = scrollY; const out = []; const ph = document.querySelector('.ph'); const r0 = ph.getBoundingClientRect(); const s0 = getComputedStyle(ph); out.push({ n: 'hero card', t: Math.round(r0.top + sy), b: Math.round(r0.bottom + sy), pad: s0.padding, m: s0.margin });
  for (const e of document.querySelectorAll('.hw-steps > *')) { const r = e.getBoundingClientRect(); if (r.height < 24) continue; const s = getComputedStyle(e); const k = [...e.children].filter(x => x.getBoundingClientRect().height > 0); out.push({ n: (e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/).slice(0, 2).join('.')).slice(0, 30), t: Math.round(r.top + sy + parseFloat(s.paddingTop)), b: Math.round(r.bottom + sy - parseFloat(s.paddingBottom)), pad: s.padding, m: s.margin, ft: k.length ? Math.round(k[0].getBoundingClientRect().top + sy) : null, lb: k.length ? Math.round(k[k.length - 1].getBoundingClientRect().bottom + sy) : null }); }
  const c = document.querySelector('#contact'); const rc = c.getBoundingClientRect(); out.push({ n: 'closer card', t: Math.round(rc.top + sy), b: Math.round(rc.bottom + sy), pad: getComputedStyle(c).padding, m: getComputedStyle(c).margin });
  return out; });
let prev = null; for (const r of rows) { console.log(`${r.n.padEnd(30)} ${String(r.t).padStart(6)}-${String(r.b).padEnd(6)} pad ${r.pad.padEnd(20)} m ${r.m.padEnd(16)}${r.ft != null ? ' inner ' + (r.ft - r.t) + '/' + (r.b - r.lb) : ''}  gap: ${prev ? r.t - prev.b : '-'}`); prev = r; }
await b.close();
