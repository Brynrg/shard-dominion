#!/usr/bin/env node
// Mission kit (XP-1): stamp a new mission JSON from a template.
//   node scripts/new-mission.mjs <defense|assault|harvest> <mission_id> [name]
// Writes data/missions/<mission_id>.json — then register it in src/main.ts MISSIONS
// and add it to tests/unit/missions.test.ts. Validate: pnpm run validate:missions.
import fs from 'node:fs';

const [tpl, id, ...nameParts] = process.argv.slice(2);
if (!tpl || !id) { console.error('usage: new-mission.mjs <defense|assault|harvest> <mission_id> [name]'); process.exit(1); }
const name = nameParts.join(' ') || id;

const base = {
  id, name, order: 99,
  map: { width: 32, height: 32, seed: 1234 },
  briefing: { title: name.toUpperCase(), story: ['<briefing line 1>', '<briefing line 2>'], objectives: ['<goal shown in the briefing>'] },
  debrief: { win: ['<win text>'], lose: ['<lose text>'] },
  naturalShardDensity: 300,
  fields: [{ tx: 18, ty: 15, w: 3, h: 3, density: 700 }],
  player: { credits: 600, techTier: 1,
    buildings: [{ type: 'construction_yard', tx: 14, ty: 16 }, { type: 'refinery', tx: 16, ty: 16 }],
    units: [{ type: 'harvester', tx: 17, ty: 16 }, { type: 'infantry', tx: 13, ty: 18 }] },
  enemies: [{ team: 'enemy', credits: 600, factionId: 'emberhand',
    buildings: [{ type: 'refinery', tx: 26, ty: 8 }, { type: 'barracks', tx: 27, ty: 9 }],
    units: [{ type: 'harvester', tx: 27, ty: 8 }],
    fields: [{ tx: 28, ty: 7, w: 3, h: 3, density: 600 }] }],
  neutrals: [],
  objectives: [], failure: [{ type: 'defeated', team: 'player' }],
  triggers: [], rewards: [], next: null,
};
const shapes = {
  defense: {
    objectives: [{ type: 'survive', id: 'hold_out', seconds: 240, primary: true, text: 'Survive 4:00' }],
    triggers: [{ id: 't_wave_1', when: { timeSeconds: 45 }, actions: [
      { type: 'message', speaker: 'CORR', text: 'First wave inbound.' },
      { type: 'spawn', team: 'enemy', units: [{ type: 'infantry', tx: 18, ty: 4 }, { type: 'infantry', tx: 19, ty: 4 }], attackMoveTo: { tx: 14, ty: 16 } }]}],
  },
  assault: {
    objectives: [{ type: 'destroy', id: 'kill_base', team: 'enemy', kind: 'barracks', primary: true, text: 'Destroy the enemy barracks' }],
  },
  harvest: {
    objectives: [{ type: 'accumulate', id: 'quota', team: 'player', credits: 1500, primary: true, text: 'Bank 1,500 credits' }],
  },
};
if (!shapes[tpl]) { console.error(`unknown template "${tpl}"`); process.exit(1); }
const mission = { ...base, ...shapes[tpl] };
const path = `data/missions/${id}.json`;
if (fs.existsSync(path)) { console.error(`${path} exists`); process.exit(1); }
fs.writeFileSync(path, JSON.stringify(mission, null, 2) + '\n');
console.log(`wrote ${path} (template: ${tpl}) — register in MISSIONS + missions.test.ts, then validate.`);
