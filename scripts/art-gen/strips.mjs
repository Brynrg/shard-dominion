// Animation strips (§0.6, batch 4): composite per-frame motion onto the base
// move/idle sprite already rendered in <baseDir>. Output = horizontal strip
// (frames*512 wide) matching how spritebank slices sheets (frameWidth=imgW/frames).
//   node scripts/art-gen/strips.mjs <baseDir> <outDir>
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FR = { walk: 4, drive: 4, fire: 2 };

const STRIPS = [
  { file: 'infantry__player__walk', base: 'infantry__player__move', state: 'walk' },
  { file: 'rocket_trooper__player__walk', base: 'rocket_trooper__player__move', state: 'walk' },
  { file: 'ghostwalker__emberhand__walk', base: 'ghostwalker__emberhand__move', state: 'walk' },
  { file: 'harvester__player__drive', base: 'harvester__player__move', state: 'drive', treads: [[150, 200, 40, 180], [322, 200, 40, 180]] },
  { file: 'scout_vehicle__player__drive', base: 'scout_vehicle__player__move', state: 'drive', treads: [] },
  { file: 'assault_tank__player__drive', base: 'assault_tank__player__move', state: 'drive', treads: [[150, 168, 46, 200], [316, 168, 46, 200]] },
  { file: 'infantry__player__fire', base: 'infantry__player__move', state: 'fire', muzzle: [256, 94, 20] },
  { file: 'assault_tank__player__fire', base: 'assault_tank__player__move', state: 'fire', muzzle: [256, 120, 34] },
  { file: 'longbow__player__fire', base: 'longbow__player__move', state: 'fire', muzzle: [256, 80, 30] },
];

// runs in the page: compose a strip and return a data URL
function compose(spec, baseDataUrl) {
  return new Promise((resolve) => {
    const S = 512, frames = ({ walk: 4, drive: 4, fire: 2 })[spec.state];
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = S * frames; cv.height = S;
      const g = cv.getContext('2d');
      for (let f = 0; f < frames; f++) {
        const ox = f * S;
        g.save(); g.translate(ox, 0);
        if (spec.state === 'walk') {
          const bob = [0, -9, 0, 9][f];
          g.drawImage(img, Math.sin(f) * 3, bob);
        } else if (spec.state === 'drive') {
          g.drawImage(img, 0, 0);
          const phase = (f / frames);
          for (const [tx, ty, tw, th] of (spec.treads || [])) {
            g.save(); g.beginPath(); g.rect(tx, ty, tw, th); g.clip();
            g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4;
            const gap = 22;
            for (let y = ty - gap; y < ty + th + gap; y += gap) {
              const yy = y + phase * gap;
              g.beginPath(); g.moveTo(tx, yy); g.lineTo(tx + tw, yy); g.stroke();
            }
            g.restore();
          }
          // rear dust puffs
          g.fillStyle = `rgba(196,180,150,${0.08 + 0.07 * (f % frames)})`;
          for (const dx of [-64, 64]) { g.beginPath(); g.arc(256 + dx, 384 + (f % 2) * 6, 14 + f * 3, 0, 7); g.fill(); }
        } else if (spec.state === 'fire') {
          g.drawImage(img, 0, 0);
          if (f === 1) {
            const [mx, my, r] = spec.muzzle;
            const grd = g.createRadialGradient(mx, my, 0, mx, my, r);
            grd.addColorStop(0, 'rgba(255,255,240,0.95)'); grd.addColorStop(0.5, 'rgba(255,210,120,0.8)'); grd.addColorStop(1, 'rgba(255,150,40,0)');
            g.fillStyle = grd; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill();
            // starburst spikes
            g.strokeStyle = 'rgba(255,235,180,0.85)'; g.lineWidth = 3;
            for (let a = 0; a < 8; a++) { const an = (a / 8) * Math.PI * 2; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(an) * r * 1.5, my + Math.sin(an) * r * 1.5); g.stroke(); }
          }
        }
        g.restore();
      }
      resolve(cv.toDataURL('image/png'));
    };
    img.src = baseDataUrl;
  });
}

const [baseDir, outDir] = [process.argv[2], process.argv[3] || 'art-out'];
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ content: `window.compose=${compose.toString()};` });
const { writeFileSync } = await import('node:fs');
let n = 0;
for (const spec of STRIPS) {
  const baseData = 'data:image/png;base64,' + readFileSync(join(baseDir, `${spec.base}.png`)).toString('base64');
  const url = await page.evaluate(([s, b]) => window.compose(s, b), [spec, baseData]);
  writeFileSync(join(outDir, `${spec.file}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`strip ${spec.file}  (${FR[spec.state]}f)`);
  n++;
}
await browser.close();
console.log(`✓ ${n} strips → ${outDir}`);
