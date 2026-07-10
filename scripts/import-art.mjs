#!/usr/bin/env node
// Import a folder of generated sprite images into public/art/ + write JSON sidecars
// + manifest.json, so the engine's loader picks them up.
//
//   node scripts/import-art.mjs <source-dir> [--dest <art-dir>]
//
// Routing by filename (any nesting in the source dir):
//   assetId__team__state.(png|jpg)  → art/units/ or art/buildings/ + sidecar + manifest
//       state move/idle = single top-down sprite (chroma-keyed, units rotate to heading)
//       state walk/drive/fire = horizontal animation strip (§0.6) — the sidecar's
//       frames/fps make the engine animate it; no splitting needed.
//   terrain__<name>.png             → art/terrain/ (seamless opaque tile, no sidecar)
//   <name>.png (no "__")            → art/presentation/ (title/portraits/act cards —
//                                     plain illustrations, listed in manifest.presentation)
// See docs/ART_ASSETS_SPEC.md + docs/ART_HANDOFF.md.
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROMA = '#ff00ff';

// Unit ids come from the sim's own roster so new units never fall into "building".
export const UNIT_IDS = new Set(
  JSON.parse(readFileSync(join(ROOT, 'data', 'units.json'), 'utf8')).units.map((u) => u.id),
);

// Animation strips (§0.6): frame count is fixed by the prompt package; fps tuned by eye.
export const STRIP_STATES = {
  walk: { frames: 4, fps: 8 },
  drive: { frames: 4, fps: 10 },
  fire: { frames: 2, fps: 6 },
};

// On-screen width per asset (tile = 32px). Everything else defaults sensibly.
export const IN_GAME_W = {
  // units
  infantry: 30, rocket_trooper: 30, vehicle: 46, harvester: 56, mcv: 50, generic: 40,
  scout_vehicle: 42, assault_tank: 50, longbow: 54, skimmer_apc: 52, gunship: 50,
  riftmaw: 72, warden: 34, ghostwalker: 30, vane: 32,
  // buildings
  power_node: 44, barracks: 66, refinery: 98, construction_yard: 88, concrete_slab: 32,
  generic_structure: 48, war_factory: 96, defense_turret: 44, aa_turret: 44, radar: 52,
  processing_plant: 52, skypad: 56, wall: 32, gate: 40, bunker: 46, infirmary: 52,
  machine_shop: 52, derrick: 56, relay: 56, wreck: 52,
};

/** Classify one source file. Returns null for non-images / unrecognizable names. */
export function classify(file) {
  const ext = extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null;
  const stem = basename(file, ext);
  if (stem.startsWith('terrain__')) return { kind: 'terrain', stem, ext };
  if (!stem.includes('__')) return { kind: 'presentation', stem, ext };
  const parts = stem.split('__');
  if (parts.length < 3) return { kind: 'bad', stem, ext };
  const [assetId, team, state] = parts;
  const isUnit = UNIT_IDS.has(assetId);
  if (state !== 'move' && state !== 'idle' && !STRIP_STATES[state]) return { kind: 'bad', stem, ext };
  return { kind: isUnit ? 'unit' : 'building', stem, ext, assetId, team, state };
}

/** The JSON sidecar for a unit/building sheet (single sprite or strip). */
export function sidecarFor(c) {
  const strip = STRIP_STATES[c.state];
  return {
    facings: 1,
    frames: strip?.frames ?? 1,
    fps: strip?.fps ?? 0,
    chromaKey: CHROMA,
    ...(c.kind === 'unit' ? { rotateFrom: 'north' } : {}),
    inGameWidthPx: IN_GAME_W[c.assetId] ?? (c.kind === 'unit' ? 44 : 72),
    image: `${c.stem}${c.ext}`,
  };
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

export function importArt(src, ART) {
  const sheets = [];
  const presentation = [];
  let imported = 0, skipped = 0;
  for (const file of walk(src)) {
    const c = classify(file);
    if (!c) continue;
    if (c.kind === 'bad') {
      console.warn('skip (bad name, need assetId__team__state):', basename(file));
      skipped++;
      continue;
    }
    if (c.ext !== '.png') console.warn(`note: ${basename(file)} is ${c.ext} — PNG preferred (chroma edges are cleaner); importing anyway.`);

    if (c.kind === 'terrain') {
      mkdirSync(join(ART, 'terrain'), { recursive: true });
      copyFileSync(file, join(ART, 'terrain', `${c.stem}.png`));
      imported++;
      console.log(`imported terrain/${c.stem}`);
      continue;
    }
    if (c.kind === 'presentation') {
      mkdirSync(join(ART, 'presentation'), { recursive: true });
      copyFileSync(file, join(ART, 'presentation', `${c.stem}${c.ext}`));
      presentation.push(`presentation/${c.stem}${c.ext}`);
      imported++;
      console.log(`imported presentation/${c.stem}`);
      continue;
    }

    const sub = c.kind === 'unit' ? 'units' : 'buildings';
    const outDir = join(ART, sub);
    mkdirSync(outDir, { recursive: true });
    copyFileSync(file, join(outDir, `${c.stem}${c.ext}`));
    const meta = sidecarFor(c);
    writeFileSync(join(outDir, `${c.stem}.json`), JSON.stringify(meta, null, 2) + '\n');
    sheets.push(`${sub}/${c.stem}`);
    imported++;
    const anim = STRIP_STATES[c.state] ? `strip ${meta.frames}f@${meta.fps}fps` : (c.kind === 'unit' ? 'unit·rotates' : 'building·static');
    console.log(`imported ${sub}/${c.stem}  (${anim}, w=${meta.inGameWidthPx})`);
  }

  // Merge into any existing manifest so partial drops accumulate.
  const manifestPath = join(ART, 'manifest.json');
  let prev = {};
  if (existsSync(manifestPath)) { try { prev = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { /* ignore */ } }
  const manifest = {
    sheets: [...new Set([...(prev.sheets ?? []), ...sheets])].sort(),
    presentation: [...new Set([...(prev.presentation ?? []), ...presentation])].sort(),
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { imported, skipped, manifest };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const src = process.argv[2];
  const destIdx = process.argv.indexOf('--dest');
  const ART = destIdx > -1 ? process.argv[destIdx + 1] : join(ROOT, 'public', 'art');
  if (!src || !existsSync(src)) {
    console.error('usage: node scripts/import-art.mjs <source-dir> [--dest <art-dir>]');
    process.exit(1);
  }
  const { imported, skipped, manifest } = importArt(src, ART);
  console.log(`\n✓ imported ${imported}, skipped ${skipped}. manifest.json: ${manifest.sheets.length} sheet(s), ${manifest.presentation.length} presentation piece(s).`);
  console.log('  Next: pnpm build + deploy, or reload the dev server to see them swap in.');
}
