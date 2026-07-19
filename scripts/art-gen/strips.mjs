// Animation strips (§0.6): composite per-frame motion onto base move/idle sprites.
//   node scripts/art-gen/strips.mjs <baseDir> <outDir> [--buildings]
//
// baseDir may be a flat drop folder OR public/art (reads units/ + buildings/).
// Unit strips: walk / drive / fire. Building strips: 4-frame idle pulse (lights).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FR = { walk: 4, drive: 4, fire: 2, pulse: 4 };

const INFANTRY = new Set([
  'infantry', 'rocket_trooper', 'engineer', 'commando', 'laser_trooper',
  'razor', 'warden', 'ghostwalker', 'vane',
]);
const VEHICLE = new Set([
  'harvester', 'scout_vehicle', 'assault_tank', 'medium_tank', 'super_heavy_tank',
  'howitzer', 'tempest', 'transport_apc', 'repair_truck', 'vehicle', 'longbow',
  'skimmer_apc', 'mcv',
]);
const AIR = new Set(['gunship', 'defense_drone']);
const FIRE = new Set([
  'infantry', 'rocket_trooper', 'laser_trooper', 'razor', 'warden', 'vane',
  'assault_tank', 'medium_tank', 'super_heavy_tank', 'howitzer', 'longbow',
  'vehicle', 'gunship', 'defense_drone', 'tempest', 'scout_vehicle',
]);

// Approximate tread / muzzle regions in 512 art space (tuned for art-gen shapes;
// painted WC3 sheets still get bob/dust/muzzle even if tread clip misses).
const TREADS = {
  harvester: [[150, 200, 40, 180], [322, 200, 40, 180]],
  assault_tank: [[150, 168, 46, 200], [316, 168, 46, 200]],
  medium_tank: [[160, 190, 42, 180], [318, 190, 42, 180]],
  super_heavy_tank: [[130, 150, 52, 230], [330, 150, 52, 230]],
  howitzer: [[158, 200, 42, 170], [316, 200, 42, 170]],
  tempest: [[150, 170, 46, 200], [320, 170, 46, 200]],
  vehicle: [[168, 200, 40, 150], [304, 200, 40, 150]],
  longbow: [[158, 210, 40, 158], [314, 210, 40, 158]],
  mcv: [[140, 180, 48, 200], [324, 180, 48, 200]],
};
const MUZZLE = {
  infantry: [256, 94, 20], rocket_trooper: [256, 90, 24], laser_trooper: [256, 116, 22],
  razor: [256, 120, 24], warden: [256, 100, 28], vane: [181, 156, 18],
  assault_tank: [256, 120, 34], medium_tank: [256, 120, 30], super_heavy_tank: [256, 110, 40],
  howitzer: [256, 150, 36], longbow: [256, 80, 30], vehicle: [256, 140, 22],
  gunship: [256, 180, 26], defense_drone: [256, 200, 18], tempest: [256, 140, 28],
  scout_vehicle: [256, 154, 16],
};

const BUILDING_PULSE = new Set([
  'barracks', 'refinery', 'power_node', 'war_factory', 'defense_turret', 'aa_turret',
  'radar', 'processing_plant', 'skypad', 'construction_yard', 'tech_lab', 'ion_cannon',
  'resonance_device', 'barracks_elite', 'armor_upgrade_center', 'infirmary', 'machine_shop',
  'bunker', 'air_pad', 'radar_addon',
]);

function resolveBasePng(baseDir, stem) {
  // stem like infantry__player__move or barracks__player__idle
  const flat = join(baseDir, `${stem}.png`);
  if (existsSync(flat)) return flat;
  const isBldg = stem.includes('__idle');
  const nested = join(baseDir, isBldg ? 'buildings' : 'units', `${stem}.png`);
  if (existsSync(nested)) return nested;
  // Also try the other folder
  const alt = join(baseDir, isBldg ? 'units' : 'buildings', `${stem}.png`);
  if (existsSync(alt)) return alt;
  return null;
}

function listUnitBases(baseDir) {
  const found = [];
  const dirs = [baseDir, join(baseDir, 'units')];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const m = name.match(/^(.+?)__(.+?)__move\.png$/);
      if (!m) continue;
      found.push({ assetId: m[1], team: m[2], stem: name.replace(/\.png$/, '') });
    }
  }
  // de-dupe by stem
  const seen = new Set();
  return found.filter((e) => (seen.has(e.stem) ? false : (seen.add(e.stem), true)));
}

function listBuildingBases(baseDir) {
  const found = [];
  const dirs = [baseDir, join(baseDir, 'buildings')];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const m = name.match(/^(.+?)__(.+?)__idle\.png$/);
      if (!m) continue;
      if (!BUILDING_PULSE.has(m[1])) continue;
      found.push({ assetId: m[1], team: m[2], stem: name.replace(/\.png$/, '') });
    }
  }
  const seen = new Set();
  return found.filter((e) => (seen.has(e.stem) ? false : (seen.add(e.stem), true)));
}

function buildUnitStripSpecs(baseDir) {
  const specs = [];
  for (const { assetId, team, stem } of listUnitBases(baseDir)) {
    if (!resolveBasePng(baseDir, stem)) continue;
    if (INFANTRY.has(assetId)) {
      specs.push({ file: `${assetId}__${team}__walk`, base: stem, state: 'walk' });
    }
    if (VEHICLE.has(assetId) || AIR.has(assetId)) {
      specs.push({
        file: `${assetId}__${team}__drive`, base: stem, state: 'drive',
        treads: TREADS[assetId] || [],
      });
    }
    if (FIRE.has(assetId)) {
      specs.push({
        file: `${assetId}__${team}__fire`, base: stem, state: 'fire',
        muzzle: MUZZLE[assetId] || [256, 120, 24],
      });
    }
  }
  return specs;
}

function buildBuildingStripSpecs(baseDir) {
  return listBuildingBases(baseDir).map(({ assetId, team, stem }) => ({
    file: `${assetId}__${team}__idle`, // overwrite with multi-frame pulse strip
    base: stem,
    state: 'pulse',
    building: true,
  }));
}

function compose(spec, baseDataUrl) {
  return new Promise((resolve) => {
    const S = 512;
    const frames = ({ walk: 4, drive: 4, fire: 2, pulse: 4 })[spec.state];
    const img = new Image();
    img.onload = () => {
      // Scale any source size into 512 working space
      const cv = document.createElement('canvas'); cv.width = S * frames; cv.height = S;
      const g = cv.getContext('2d');
      const drawBase = (dx = 0, dy = 0) => {
        // If source is already a horizontal strip, sample the first cell only.
        const cell = img.height;
        const sw = (img.width >= cell * 2 && Math.abs(img.width / cell - Math.round(img.width / cell)) < 0.08)
          ? cell : img.width;
        g.drawImage(img, 0, 0, sw, img.height, dx, dy, S, S);
      };
      for (let f = 0; f < frames; f++) {
        const ox = f * S;
        g.save(); g.translate(ox, 0);
        if (spec.state === 'walk') {
          const bob = [0, -9, 0, 9][f];
          drawBase(Math.sin(f) * 3, bob);
        } else if (spec.state === 'drive') {
          drawBase();
          const phase = f / frames;
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
          g.fillStyle = `rgba(196,180,150,${0.08 + 0.07 * (f % frames)})`;
          for (const dx of [-64, 64]) { g.beginPath(); g.arc(256 + dx, 384 + (f % 2) * 6, 14 + f * 3, 0, 7); g.fill(); }
        } else if (spec.state === 'fire') {
          drawBase();
          if (f === 1) {
            const [mx, my, r] = spec.muzzle;
            const grd = g.createRadialGradient(mx, my, 0, mx, my, r);
            grd.addColorStop(0, 'rgba(255,255,240,0.95)');
            grd.addColorStop(0.5, 'rgba(255,210,120,0.8)');
            grd.addColorStop(1, 'rgba(255,150,40,0)');
            g.fillStyle = grd; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill();
            g.strokeStyle = 'rgba(255,235,180,0.85)'; g.lineWidth = 3;
            for (let a = 0; a < 8; a++) {
              const an = (a / 8) * Math.PI * 2;
              g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(an) * r * 1.5, my + Math.sin(an) * r * 1.5); g.stroke();
            }
          }
        } else if (spec.state === 'pulse') {
          drawBase();
          // Soft light pulse — brighten upper lights without changing silhouette
          const a = 0.08 + 0.14 * (0.5 + 0.5 * Math.sin((f / frames) * Math.PI * 2));
          g.fillStyle = `rgba(120,230,255,${a})`;
          g.beginPath(); g.arc(160, 170, 18, 0, 7); g.fill();
          g.beginPath(); g.arc(352, 170, 18, 0, 7); g.fill();
          g.fillStyle = `rgba(255,255,220,${a * 0.7})`;
          g.beginPath(); g.arc(256, 210, 28, 0, 7); g.fill();
        }
        g.restore();
      }
      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = baseDataUrl;
  });
}

const baseDir = process.argv[2] || 'public/art';
const outDir = process.argv[3] || 'art-out-strips';
const wantBuildings = process.argv.includes('--buildings') || process.argv.includes('--all');
const wantUnits = !process.argv.includes('--buildings-only');

mkdirSync(outDir, { recursive: true });

const specs = [];
if (wantUnits) specs.push(...buildUnitStripSpecs(baseDir));
if (wantBuildings || process.argv.includes('--all')) specs.push(...buildBuildingStripSpecs(baseDir));

if (!specs.length) {
  console.error(`No strip bases found under ${baseDir}`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ content: `window.compose=${compose.toString()};` });

let n = 0, skipped = 0;
for (const spec of specs) {
  const basePath = resolveBasePng(baseDir, spec.base);
  if (!basePath) { console.warn(`skip missing base ${spec.base}`); skipped++; continue; }
  // For building pulse, source base must be single-frame — if already a strip (wide),
  // use the left-most frame by letting compose scale the whole image (ok enough).
  const baseData = 'data:image/png;base64,' + readFileSync(basePath).toString('base64');
  const url = await page.evaluate(([s, b]) => window.compose(s, b), [spec, baseData]);
  if (!url) { console.warn(`compose failed ${spec.file}`); skipped++; continue; }
  writeFileSync(join(outDir, `${spec.file}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`strip ${spec.file}  (${FR[spec.state]}f)`);
  n++;
}
await browser.close();
console.log(`✓ ${n} strips → ${outDir}${skipped ? ` (${skipped} skipped)` : ''}`);
