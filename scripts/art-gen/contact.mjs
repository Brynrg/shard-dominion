// Build a labeled contact sheet of every PNG in a dir → <out>.
//   node scripts/art-gen/contact.mjs <dir> <outPng> [cols]
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const out = process.argv[3] || 'contact.png';
const cols = parseInt(process.argv[4] || '6', 10);
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const cells = files.map((f) => {
  const b64 = readFileSync(join(dir, f)).toString('base64');
  return `<figure><img src="data:image/png;base64,${b64}"/><figcaption>${f.replace('.png', '').replace(/__/g, ' · ')}</figcaption></figure>`;
}).join('');
const cellW = 190;
const html = `<!doctype html><body style="margin:0;background:#39414a;font-family:system-ui">
  <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:12px">${cells}</div>
  <style>figure{margin:0;background:#2b3138;border-radius:8px;padding:6px}img{width:100%;display:block}
  figcaption{color:#cdd6df;font-size:11px;text-align:center;padding:5px 0 2px;word-break:break-word}</style></body>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cols * cellW + 40, height: 400 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`✓ contact sheet (${files.length} sprites) → ${out}`);
