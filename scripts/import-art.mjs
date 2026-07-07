#!/usr/bin/env node
// Import a folder of generated sprite images into public/art/ + write JSON sidecars
// + manifest.json, so the engine's loader picks them up.
//
//   node scripts/import-art.mjs <source-dir>
//
// Expects files named `assetId__team__state.(png|jpg)` (any nesting). Each becomes a
// SINGLE top-down sprite: the engine chroma-keys its background to transparent and
// rotates it to the unit heading (buildings stay static). See docs/ART_ASSETS_SPEC.md.
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'public', 'art');
const CHROMA = '#ff00ff';

const UNIT_IDS = new Set(['infantry', 'rocket_trooper', 'vehicle', 'harvester', 'mcv', 'generic']);
// On-screen width per asset (tile = 32px). Everything else defaults sensibly.
const IN_GAME_W = {
  infantry: 30, rocket_trooper: 30, vehicle: 46, harvester: 56, mcv: 50, generic: 40,
  power_node: 44, barracks: 66, refinery: 98, construction_yard: 88, concrete_slab: 32, generic_structure: 48,
};

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('usage: node scripts/import-art.mjs <source-dir>   (dir with assetId__team__state.png files)');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const sheets = [];
let imported = 0, skipped = 0;
for (const file of walk(src)) {
  const ext = extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;
  const stem = basename(file, ext);            // assetId__team__state
  const parts = stem.split('__');
  if (parts.length < 3) { console.warn('skip (bad name, need assetId__team__state):', basename(file)); skipped++; continue; }
  const [assetId, team, state] = parts;
  const isUnit = UNIT_IDS.has(assetId);
  const sub = isUnit ? 'units' : 'buildings';
  if (ext !== '.png') console.warn(`note: ${basename(file)} is ${ext} — PNG preferred (chroma edges are cleaner); importing anyway.`);

  const outDir = join(ART, sub);
  mkdirSync(outDir, { recursive: true });
  const pngName = `${stem}.png`;               // keep .png name even if source was jpg (loader keys either)
  copyFileSync(file, join(outDir, `${stem}${ext}`));
  const imgFile = `${stem}${ext}`;

  // Minimal sidecar — frame size + pivot are derived from the real image at load.
  const meta = {
    facings: 1, frames: 1, fps: 0,
    chromaKey: CHROMA,
    ...(isUnit ? { rotateFrom: 'north' } : {}),
    inGameWidthPx: IN_GAME_W[assetId] ?? (isUnit ? 44 : 72),
    image: imgFile,
  };
  writeFileSync(join(outDir, `${stem}.json`), JSON.stringify(meta, null, 2) + '\n');
  sheets.push(`${sub}/${stem}`);
  imported++;
  console.log(`imported ${sub}/${stem}  (${isUnit ? 'unit·rotates' : 'building·static'}, w=${meta.inGameWidthPx})`);
}

// Merge into any existing manifest so partial drops accumulate.
const manifestPath = join(ART, 'manifest.json');
let existing = [];
if (existsSync(manifestPath)) { try { existing = JSON.parse(readFileSync(manifestPath, 'utf8')).sheets ?? []; } catch { /* ignore */ } }
const merged = [...new Set([...existing, ...sheets])].sort();
writeFileSync(manifestPath, JSON.stringify({ sheets: merged }, null, 2) + '\n');

console.log(`\n✓ imported ${imported}, skipped ${skipped}. manifest.json now lists ${merged.length} sheet(s).`);
console.log('  Next: pnpm build + deploy, or reload the dev server to see them swap in.');
