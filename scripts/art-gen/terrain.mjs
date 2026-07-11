// Generate seamless, opaque terrain tiles (128x128) via canvas. Tileability is
// guaranteed by construction: every feature is stamped at all 9 wrap offsets
// (dx,dy in {-128,0,128}), so anything crossing an edge reappears opposite.
//   node scripts/art-gen/terrain.mjs <outDir>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SZ = 128;

// deterministic per-tile drawing, executed in the browser page
function drawTile(kind, seed) {
  const cv = document.createElement('canvas'); cv.width = SZ; cv.height = SZ;
  const g = cv.getContext('2d');
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const wrap = (fn) => { for (const dx of [-SZ, 0, SZ]) for (const dy of [-SZ, 0, SZ]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };

  if (kind === 'scorched') {
    g.fillStyle = '#3c3630'; g.fillRect(0, 0, SZ, SZ);
    for (let i = 0; i < 26; i++) { const x = rnd() * SZ, y = rnd() * SZ, r = 8 + rnd() * 22; wrap(() => { g.fillStyle = `rgba(122,102,80,${0.12 + rnd() * 0.14})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }
    for (let i = 0; i < 10; i++) { const x = rnd() * SZ, y = rnd() * SZ; wrap(() => { g.fillStyle = `rgba(180,168,150,${0.05 + rnd() * 0.08})`; g.beginPath(); g.ellipse(x, y, 14 + rnd() * 16, 5 + rnd() * 6, rnd() * 3, 0, 7); g.fill(); }); }
    g.strokeStyle = 'rgba(20,16,14,0.55)'; g.lineWidth = 1;
    for (let i = 0; i < 8; i++) { const x = rnd() * SZ, y = rnd() * SZ, a = rnd() * 7, len = 12 + rnd() * 20; wrap(() => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }); }
    for (let i = 0; i < 5; i++) { const x = rnd() * SZ, y = rnd() * SZ; wrap(() => { g.fillStyle = `rgba(255,${90 + rnd() * 60 | 0},40,${0.3 + rnd() * 0.3})`; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }); }
  } else { // crystal_lattice
    g.fillStyle = '#3c3630'; g.fillRect(0, 0, SZ, SZ);
    for (let i = 0; i < 16; i++) { const x = rnd() * SZ, y = rnd() * SZ, r = 10 + rnd() * 20; wrap(() => { g.fillStyle = `rgba(125,106,154,${0.14 + rnd() * 0.16})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }
    // vein network between junction nodes
    const nodes = Array.from({ length: 10 }, () => ({ x: rnd() * SZ, y: rnd() * SZ }));
    for (const n of nodes) {
      const links = 1 + (rnd() * 2 | 0);
      for (let k = 0; k < links; k++) { const m = nodes[(rnd() * nodes.length) | 0]; wrap(() => { g.strokeStyle = `rgba(180,155,216,${0.5 + rnd() * 0.3})`; g.lineWidth = 1.5 + rnd() * 1.5; g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(m.x, m.y); g.stroke(); }); }
    }
    for (const n of nodes) { wrap(() => { g.fillStyle = 'rgba(230,212,255,0.9)'; g.beginPath(); const r = 2 + rnd() * 3; g.moveTo(n.x, n.y - r * 2); g.lineTo(n.x + r, n.y); g.lineTo(n.x, n.y + r * 2); g.lineTo(n.x - r, n.y); g.fill(); }); }
  }
  return cv.toDataURL('image/png');
}

const outDir = process.argv[2] || 'art-out';
mkdirSync(outDir, { recursive: true });
const tiles = [
  { file: 'terrain__scorched.png', kind: 'scorched', seed: 101 },
  { file: 'terrain__scorched_2.png', kind: 'scorched', seed: 202 },
  { file: 'terrain__crystal_lattice.png', kind: 'crystal_lattice', seed: 303 },
  { file: 'terrain__crystal_lattice_2.png', kind: 'crystal_lattice', seed: 404 },
];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ content: `const SZ=${SZ}; window.drawTile=${drawTile.toString()};` });
const { writeFileSync } = await import('node:fs');
for (const t of tiles) {
  const dataUrl = await page.evaluate(({ k, s }) => window.drawTile(k, s), { k: t.kind, s: t.seed });
  writeFileSync(join(outDir, t.file), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`rendered ${t.file}`);
}
await browser.close();
console.log(`✓ ${tiles.length} terrain tiles → ${outDir}`);
