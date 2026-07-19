// Generate seamless, opaque terrain tiles (128x128) via canvas — "Obsidian Bloom"
// basalt identity: shatterFacet-jittered facets, cool-dark ground family toward
// #16141c, warmer-dark impassable rock toward #0c0b10, and a violet-teal crystal
// family for Shard density (kept OFF true magenta — magenta is reserved solely
// for the corruption/Avarice crack network drawn live in the view). Tileability
// is guaranteed by construction: every feature is stamped at all 9 wrap offsets
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
  const shade = (hex, amt) => {
    const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return amt >= 0
      ? `#${c(r + (255 - r) * amt)}${c(gg + (255 - gg) * amt)}${c(b + (255 - b) * amt)}`
      : `#${c(r * (1 + amt))}${c(gg * (1 + amt))}${c(b * (1 + amt))}`;
  };
  // Jittered radial-fan facet field tiling the whole 128x128 (the shatterFacet
  // algorithm, ported for a filled-plane use instead of one circular blob).
  const facetField = (base, jitterAmt, cellPx) => {
    for (let fy = -cellPx; fy < SZ + cellPx; fy += cellPx) {
      for (let fx = -cellPx; fx < SZ + cellPx; fx += cellPx) {
        wrap(() => {
          const cx = fx + (rnd() - 0.5) * cellPx * 0.4;
          const cy = fy + (rnd() - 0.5) * cellPx * 0.4;
          const facets = 5 + (rnd() * 3 | 0);
          const rr = cellPx * (0.72 + rnd() * 0.3);
          const pts = [];
          for (let i = 0; i < facets; i++) {
            const a = (i / facets) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
            const rad = rr * (0.75 + rnd() * 0.4);
            pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
          }
          for (let i = 0; i < facets; i++) {
            const a = pts[i], b = pts[(i + 1) % facets];
            g.fillStyle = shade(base, (rnd() - 0.5) * jitterAmt);
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
          }
        });
      }
    }
  };

  if (kind === 'ground') {
    // Cool basalt ground steps (sand/deep_sand/dune family) — dark, but with a
    // legible highlight range so the field reads under normal play lighting.
    g.fillStyle = '#1c1926'; g.fillRect(0, 0, SZ, SZ);
    facetField('#221f2e', 0.28, 22);
    // Sparse warm micro-grain (worn ground flecks).
    for (let i = 0; i < 14; i++) { const x = rnd() * SZ, y = rnd() * SZ; wrap(() => { g.fillStyle = `rgba(90,84,70,${0.08 + rnd() * 0.10})`; g.fillRect(x, y, 2, 2); }); }
  } else if (kind === 'dune') {
    g.fillStyle = '#211d2c'; g.fillRect(0, 0, SZ, SZ);
    facetField('#2b2738', 0.3, 20);
    // Wind-ridge streaks (lighter facet band + shadow underneath).
    for (let i = 0; i < 4; i++) { const y = rnd() * SZ; wrap(() => { g.fillStyle = 'rgba(70,64,90,0.35)'; g.fillRect(0, y, SZ, 2); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y + 2, SZ, 1); }); }
  } else if (kind === 'rock') {
    // Warmer-dark impassable rock, toward near-black.
    g.fillStyle = '#100f14'; g.fillRect(0, 0, SZ, SZ);
    facetField('#171319', 0.34, 26);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { const x = rnd() * SZ, y = rnd() * SZ, a = rnd() * 7, len = 14 + rnd() * 20; wrap(() => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }); }
  } else if (kind === 'impassable') {
    g.fillStyle = '#0c0b10'; g.fillRect(0, 0, SZ, SZ);
    facetField('#120f16', 0.3, 24);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) { const x = rnd() * SZ, y = rnd() * SZ, a = rnd() * 7, len = 16 + rnd() * 26; wrap(() => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }); }
  } else { // shard_full / shard_mid / shard_low — violet-teal crystal density family
    const density = kind === 'shard_full' ? 1 : kind === 'shard_mid' ? 0.55 : 0.28;
    g.fillStyle = '#1a1626'; g.fillRect(0, 0, SZ, SZ);
    facetField('#241f36', 0.24, 22);
    const nodes = Array.from({ length: Math.round(6 + density * 10) }, () => ({ x: rnd() * SZ, y: rnd() * SZ }));
    for (const n of nodes) {
      const links = 1 + (rnd() * 2 | 0);
      for (let k = 0; k < links; k++) { const m = nodes[(rnd() * nodes.length) | 0]; wrap(() => { g.strokeStyle = `rgba(125,220,220,${(0.25 + rnd() * 0.25) * density})`; g.lineWidth = 1.2 + rnd() * 1.2; g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(m.x, m.y); g.stroke(); }); }
    }
    for (const n of nodes) { wrap(() => { g.fillStyle = `rgba(190,140,255,${0.55 + 0.35 * density})`; const r = 2 + rnd() * (2 + density * 2); g.beginPath(); g.moveTo(n.x, n.y - r * 2); g.lineTo(n.x + r, n.y); g.lineTo(n.x, n.y + r * 2); g.lineTo(n.x - r, n.y); g.fill(); g.fillStyle = 'rgba(230,220,255,0.85)'; g.beginPath(); g.arc(n.x, n.y, r * 0.4, 0, 7); g.fill(); }); }
  }
  return cv.toDataURL('image/png');
}

const outDir = process.argv[2] || 'art-out';
mkdirSync(outDir, { recursive: true });
// Names match src/view/spritebank.ts loadTerrain()'s fetch list exactly.
const tiles = [
  { file: 'terrain__sand.png', kind: 'ground', seed: 101 },
  { file: 'terrain__sand_2.png', kind: 'ground', seed: 202 },
  { file: 'terrain__deep_sand.png', kind: 'ground', seed: 303 },
  { file: 'terrain__dune.png', kind: 'dune', seed: 404 },
  { file: 'terrain__rock.png', kind: 'rock', seed: 505 },
  { file: 'terrain__impassable.png', kind: 'impassable', seed: 606 },
  { file: 'terrain__shard_full.png', kind: 'shard_full', seed: 707 },
  { file: 'terrain__shard_mid.png', kind: 'shard_mid', seed: 808 },
  { file: 'terrain__shard_low.png', kind: 'shard_low', seed: 909 },
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
