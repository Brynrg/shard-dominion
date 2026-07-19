// Rasterize the full sprite set to transparent-alpha PNGs via Chromium.
//   node scripts/art-gen/render.mjs <outDir> [nameFilter]
// Coverage is driven off the real engine IDs (structures.json / units.json) so
// nothing the game references is missed. Recolors come from the team palette.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHAPES } from './shapes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const units = JSON.parse(readFileSync(join(ROOT, 'data', 'units.json'), 'utf8')).units;
const structures = JSON.parse(readFileSync(join(ROOT, 'data', 'structures.json'), 'utf8')).structures;

// Buildings rendered for player + enemy (skip slab — procedural pad).
const SKIP_BUILDINGS = new Set(['concrete_slab']);
const BUILDINGS_PE = structures.map((s) => s.id).filter((id) => !SKIP_BUILDINGS.has(id) && SHAPES[id]);
const BUILDINGS_FACTION = ['barracks', 'refinery', 'defense_turret'];
const NEUTRAL_BUILDINGS = ['construction_yard', 'derrick', 'relay', 'wreck'].filter((id) => SHAPES[id]);

// Units rendered for player + enemy (heroes get faction-correct teams below).
const HERO_TEAMS = {
  warden: 'player',
  ghostwalker: 'emberhand',
  vane: 'emberhand',
  razor: 'player',
  tempest: 'shardborn',
  riftmaw: 'neutral',
};
const UNITS_PE = units.map((u) => u.id).filter((id) => SHAPES[id] && !HERO_TEAMS[id]);
const UNITS_FACTION = ['infantry', 'rocket_trooper', 'harvester'];

function buildList() {
  const out = [];
  const add = (id, team, state) => out.push({ file: `${id}__${team}__${state}`, id, team, state });
  for (const id of NEUTRAL_BUILDINGS) add(id, 'neutral', 'idle');
  // ConYard also needs player/enemy (neutral kept above).
  if (SHAPES.construction_yard) {
    add('construction_yard', 'player', 'idle');
    add('construction_yard', 'enemy', 'idle');
  }
  for (const id of BUILDINGS_PE) {
    if (id === 'construction_yard') continue; // handled above
    add(id, 'player', 'idle');
    add(id, 'enemy', 'idle');
  }
  for (const id of BUILDINGS_FACTION) {
    add(id, 'emberhand', 'idle');
    add(id, 'shardborn', 'idle');
  }
  for (const id of UNITS_PE) {
    add(id, 'player', 'move');
    add(id, 'enemy', 'move');
  }
  for (const id of UNITS_FACTION) {
    add(id, 'emberhand', 'move');
    add(id, 'shardborn', 'move');
  }
  for (const [id, team] of Object.entries(HERO_TEAMS)) {
    if (SHAPES[id]) add(id, team, 'move');
  }
  // Tempest also playable as player sheet for Concord seat when unlocked visually.
  if (SHAPES.tempest) add('tempest', 'player', 'move');
  if (SHAPES.razor) add('razor', 'shardborn', 'move');
  return out;
}

const outDir = process.argv[2] || 'art-out';
const filter = process.argv[3] || '';
mkdirSync(outDir, { recursive: true });

const list = buildList();
const missing = [...new Set(list.filter((e) => !SHAPES[e.id]).map((e) => e.id))];
if (missing.length) console.warn(`⚠ no shape for: ${missing.join(', ')}`);

// Also warn about roster IDs with no shape at all.
const rosterMissing = [
  ...units.map((u) => u.id).filter((id) => !SHAPES[id]),
  ...structures.map((s) => s.id).filter((id) => !SKIP_BUILDINGS.has(id) && !SHAPES[id]),
];
if (rosterMissing.length) console.warn(`⚠ roster IDs without SHAPES: ${rosterMissing.join(', ')}`);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
let n = 0;
for (const e of list) {
  if (!SHAPES[e.id]) continue;
  if (filter && !e.file.includes(filter)) continue;
  const markup = SHAPES[e.id](e.team);
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent">${markup}</body>`, { waitUntil: 'networkidle' });
  const el = await page.$('svg');
  await el.screenshot({ path: join(outDir, `${e.file}.png`), omitBackground: true });
  n++;
}
await browser.close();
console.log(`✓ ${n} sprite(s) → ${outDir}${filter ? ` (filter: ${filter})` : ''}`);
