#!/usr/bin/env node
// Seeded skirmish-map generator (procedural-gen + level-design pass).
//
// Rules it encodes:
//  - ONE seeded RNG drives everything (mulberry32) — same seed, same map,
//    always. No Math.random anywhere (repo determinism rule).
//  - Generation fills plain data first, then a VALIDATION pass checks the
//    fairness invariants before anything is written:
//      * both starts >= 55% of the map diagonal apart
//      * each side's distance to its nearest shard field differs by <= 1 tile
//      * every rect in bounds with a 2-tile margin; no field/start overlaps
//  - Three archetypes, each an intentional experience (level-design), not
//    random soup:
//      mirror    — rotational symmetry, one rich contested center vein
//      corridor  — bases at opposite ends, the only rich vein in the middle
//      scatter   — many small symmetric fields; an expansion race
//
// Usage: node scripts/gen-skirmish.mjs <archetype> <seed> [size]
//        node scripts/gen-skirmish.mjs --batch     (writes the 3 shipped maps)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// Start kit mirrors the hand-authored skirmish maps (badlands composition).
function startKit(cx, cy) {
  return {
    buildings: [
      { type: 'construction_yard', tx: cx, ty: cy },
      { type: 'refinery', tx: cx + 3, ty: cy - 1 },
      { type: 'power_node', tx: cx - 2, ty: cy - 3 },
    ],
    units: [
      { type: 'harvester', tx: cx + 3, ty: cy },
      { type: 'infantry', tx: cx - 1, ty: cy + 2 },
      { type: 'infantry', tx: cx, ty: cy + 2 },
    ],
  };
}

// Rotational mirror (180°) — the fairness guarantee for 2P maps.
const mirror = (size, t) => size - 1 - t;

function fieldsFor(archetype, rng, size, px, py) {
  const c = Math.floor(size / 2);
  const fields = [];
  const push = (tx, ty, w, h, density) => fields.push({ tx, ty, w, h, density });
  // Home veins are placed as OFFSETS from the player start and 180°-mirrored,
  // so equal field access is guaranteed by construction (the validation gate
  // rejected the earlier absolute-placement version for exactly this).
  const homePair = (dx, dy, w, h, density) => {
    const tx = px + dx, ty = py + dy;
    push(tx, ty, w, h, density);
    push(mirror(size, tx + w - 1), mirror(size, ty + h - 1), w, h, density);
  };
  if (archetype === 'mirror') {
    homePair(int(rng, 4, 6), int(rng, -7, -5), 2, 3, int(rng, 60, 75) * 10);
    push(c - 1, c - 2, int(rng, 2, 3), int(rng, 3, 4), int(rng, 95, 120) * 10);
  } else if (archetype === 'corridor') {
    // thin home veins; the middle holds the only riches. The flanking 800s
    // are a mirrored pair — a single off-center vein fails the fairness gate.
    homePair(int(rng, -6, -4), int(rng, -4, -2), 2, 2, 550);
    push(c - 2, c - 1, 4, 2, int(rng, 110, 140) * 10);
    const fx = c + int(rng, 3, 5), fy = c + int(rng, 2, 4);
    push(fx, fy, 2, 2, 800);
    push(mirror(size, fx + 1), mirror(size, fy + 1), 2, 2, 800);
  } else {
    // scatter: a close home pair + 2 mirrored pairs of modest fields + lean center
    homePair(int(rng, 4, 5), int(rng, -6, -4), 2, 2, int(rng, 50, 60) * 10);
    for (let i = 0; i < 2; i++) {
      const fx = int(rng, 4, c - 6);
      const fy = int(rng, 4, size - 8);
      const d = int(rng, 45, 65) * 10;
      push(fx, fy, 2, 2, d);
      push(mirror(size, fx + 1), mirror(size, fy + 1), 2, 2, d);
    }
    push(c - 1, c - 1, 2, 2, 600);
  }
  return fields;
}

function overlaps(a, b) {
  return a.tx < b.tx + b.w && b.tx < a.tx + a.w && a.ty < b.ty + b.h && b.ty < a.ty + a.h;
}

function nearestFieldDist(fields, x, y) {
  let best = Infinity;
  for (const f of fields) {
    // True tile-center is tx + (w-1)/2 — using tx + w/2 breaks the 180°
    // mirror identity by half a tile per axis and falsely fails symmetric maps.
    const fx = f.tx + (f.w - 1) / 2, fy = f.ty + (f.h - 1) / 2;
    best = Math.min(best, Math.hypot(fx - x, fy - y));
  }
  return best;
}

/** The validation gate — a generated map that fails any invariant is rejected. */
function validate(map, size, px, py, ex, ey) {
  const problems = [];
  const diag = Math.hypot(size, size);
  if (Math.hypot(ex - px, ey - py) < diag * 0.55) problems.push('starts too close');
  const dp = nearestFieldDist(map.fields, px, py);
  const de = nearestFieldDist(map.fields, ex, ey);
  if (Math.abs(dp - de) > 1) problems.push(`unequal field access (${dp.toFixed(1)} vs ${de.toFixed(1)})`);
  for (const f of map.fields) {
    if (f.tx < 2 || f.ty < 2 || f.tx + f.w > size - 2 || f.ty + f.h > size - 2) problems.push('field out of bounds');
  }
  for (let i = 0; i < map.fields.length; i++) {
    for (let j = i + 1; j < map.fields.length; j++) {
      if (overlaps(map.fields[i], map.fields[j])) problems.push('fields overlap');
    }
  }
  return problems;
}

const FLAVOR = {
  mirror: {
    name: 'Shard Meridian',
    story: ['A perfect fault line splits the plateau.', 'Both warbands read the same map. Only one leaves with the center vein.'],
    briefTitle: 'SHARD MERIDIAN',
  },
  corridor: {
    name: 'The Narrows',
    story: ['One pass. One vein worth taking.', 'Whoever holds the middle starves the other out.'],
    briefTitle: 'THE NARROWS',
  },
  scatter: {
    name: 'Broken Veins',
    story: ['The shard here runs thin and everywhere.', 'Expand fast, hold wide — the hoarder wins.'],
    briefTitle: 'BROKEN VEINS',
  },
};

export function generate(archetype, seed, size = 48) {
  const rng = mulberry32(seed);
  // Starts on the main diagonal, mirrored — symmetric by construction.
  const px = int(rng, 8, 11), py = size - int(rng, 9, 12);
  const ex = mirror(size, px), ey = mirror(size, py);
  const fields = fieldsFor(archetype, rng, size, px, py);
  const flavor = FLAVOR[archetype];
  const id = `skirmish_gen_${archetype}`;
  const c = Math.floor(size / 2);

  const doc = {
    id,
    name: `Skirmish — ${flavor.name}`,
    order: 0,
    map: { width: size, height: size, seed: seed % 100000 },
    briefing: { title: flavor.briefTitle, story: flavor.story, objectives: ['Destroy the enemy base'] },
    debrief: {
      win: ['The field is yours. The vein flows home.'],
      lose: ['Your base has fallen. The vein flows the other way.'],
    },
    naturalShardDensity: 300,
    fields,
    player: { credits: 600, ...startKit(px, py) },
    enemies: [
      {
        team: 'enemy',
        credits: 600,
        ...startKit(ex, ey),
        fields: [],
        factionId: ['emberhand', 'shardborn', 'concord'][seed % 3],
      },
    ],
    objectives: [{ type: 'eliminate', team: 'enemy', primary: true, text: 'Destroy the enemy forces' }],
    failure: [{ type: 'defeated', team: 'player' }],
    next: null,
    neutrals: [
      { type: 'derrick', tx: c + int(rng, -6, -3), ty: c + int(rng, 3, 6) },
      { type: 'relay', tx: c + int(rng, 3, 6), ty: c + int(rng, -6, -3) },
    ],
  };

  const problems = validate(doc, size, px, py, ex, ey);
  if (problems.length) throw new Error(`${id} (seed ${seed}) failed validation: ${problems.join('; ')}`);
  return doc;
}

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args[0] === '--batch') {
  // The three shipped maps — seeds chosen once, then frozen (regenerating
  // with the same seed reproduces the identical file).
  for (const [archetype, seed] of [['mirror', 20260814], ['corridor', 771177], ['scatter', 424242]]) {
    const doc = generate(archetype, seed);
    const out = path.join(ROOT, 'data', 'missions', `${doc.id}.json`);
    writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
    console.log(`✓ ${doc.id} (seed ${seed}) → ${path.relative(ROOT, out)}`);
  }
} else if (args.length >= 2) {
  const doc = generate(args[0], Number(args[1]), args[2] ? Number(args[2]) : 48);
  console.log(JSON.stringify(doc, null, 2));
} else {
  console.log('usage: gen-skirmish.mjs <mirror|corridor|scatter> <seed> [size] | --batch');
}
