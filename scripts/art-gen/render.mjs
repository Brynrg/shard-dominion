// Rasterize the full sprite set to transparent-alpha PNGs via Chromium.
//   node scripts/art-gen/render.mjs <outDir> [nameFilter]
// Coverage is driven off the real engine IDs (structures.json / units.json) so
// nothing the game references is missed. Recolors come from the team palette.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SHAPES } from './shapes.mjs';

// buildings rendered for player + enemy
const BUILDINGS_PE = ['barracks', 'refinery', 'war_factory', 'defense_turret', 'aa_turret', 'radar', 'processing_plant', 'skypad', 'wall', 'gate', 'bunker', 'infirmary', 'machine_shop', 'generic_structure'];
const BUILDINGS_FACTION = ['barracks', 'refinery', 'defense_turret']; // + emberhand, shardborn
const NEUTRAL_BUILDINGS = ['construction_yard', 'derrick', 'relay', 'wreck'];
// units rendered for player + enemy
const UNITS_PE = ['infantry', 'rocket_trooper', 'harvester', 'scout_vehicle', 'assault_tank', 'longbow', 'skimmer_apc', 'gunship', 'vehicle'];
const UNITS_FACTION = ['infantry', 'rocket_trooper', 'harvester']; // + emberhand, shardborn

function buildList() {
  const out = [];
  const add = (id, team, state) => out.push({ file: `${id}__${team}__${state}`, id, team, state });
  for (const id of NEUTRAL_BUILDINGS) add(id, 'neutral', 'idle');
  for (const id of BUILDINGS_PE) { add(id, 'player', 'idle'); add(id, 'enemy', 'idle'); }
  for (const id of BUILDINGS_FACTION) { add(id, 'emberhand', 'idle'); add(id, 'shardborn', 'idle'); }
  for (const id of UNITS_PE) { add(id, 'player', 'move'); add(id, 'enemy', 'move'); }
  for (const id of UNITS_FACTION) { add(id, 'emberhand', 'move'); add(id, 'shardborn', 'move'); }
  add('riftmaw', 'neutral', 'move');
  add('warden', 'player', 'move');
  add('ghostwalker', 'emberhand', 'move');
  add('vane', 'emberhand', 'move');
  return out;
}

const outDir = process.argv[2] || 'art-out';
const filter = process.argv[3] || '';
mkdirSync(outDir, { recursive: true });

const list = buildList();
const missing = [...new Set(list.filter((e) => !SHAPES[e.id]).map((e) => e.id))];
if (missing.length) console.warn(`⚠ no shape for: ${missing.join(', ')}`);

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
