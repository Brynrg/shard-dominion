// ── Mission seeder: build a match from a Mission definition ───────────────────
// Boot-time (not a per-tick system): deterministic, no DOM/Date/Math.random. Lifts
// the previously-hardcoded main.ts seeding into data-driven entity factories so every
// match — skirmish and campaign missions alike — is described by a mission file.
import type { SimState } from './state.js';
import type { Mission } from '../loaders/missions.js';
import type { UnitDef } from '../loaders/units.js';
import type { StructureDef } from '../loaders/structures.js';
import type { EconomyConstants } from '../loaders/economyConstants.js';
import { tileToWorldCenter } from './coords.js';
import { modHp, modSpeed, FACTIONS, type TeamFactions } from './factions.js';

type Team = 'player' | 'enemy';
interface Placed { type: string; tx: number; ty: number }
interface FieldSpec { tx: number; ty: number; w: number; h: number; density: number }
export interface SeedDeps { units: readonly UnitDef[]; structures: readonly StructureDef[]; economy: EconomyConstants }
export interface SeededMeta { playerStartTile: { tx: number; ty: number }; objectiveTile: { tx: number; ty: number } }

// Building HP: from structures.json where defined, else 1500 (the seed-only Refinery,
// which is not yet a buildable structure def).
function structureHp(kind: string, structures: readonly StructureDef[]): number {
  return structures.find(s => s.id === kind)?.hp ?? 1500;
}

function applyField(state: SimState, f: FieldSpec): void {
  for (let dy = 0; dy < f.h; dy++) {
    for (let dx = 0; dx < f.w; dx++) {
      state.shardDensity.set(`${f.tx + dx},${f.ty + dy}`, f.density);
    }
  }
}

// Kind → building components (mirrors the original hardcoded seeding). `takeCredits`
// puts the side's bank on its FIRST refinery; later refineries start at 0.
function makeBuilding(kind: string, team: Team, deps: SeedDeps, sideCredits: number, takeCredits: boolean, techTier = 1): { components: Record<string, unknown>; tookCredits: boolean } {
  const hp = structureHp(kind, deps.structures);
  const sdef = deps.structures.find(s => s.id === kind);
  const blocks = sdef?.blocksPath;
  const components: Record<string, unknown> = {
    building: { onSlab: true, buildProgress: 100, powered: true, ...(blocks ? { blocksPath: true } : {}), ...(sdef?.teamPass ? { teamPass: true } : {}) },
    ...(sdef?.container ? { container: { capacity: sdef.container, stored: [] } } : {}),
    faction: { team, faction: kind },
    health: { hp, maxHp: hp },
    armor: { armorClass: 'BUILDING' },
  };
  let tookCredits = false;
  if (kind === 'refinery') {
    const credits = takeCredits ? sideCredits : 0;
    tookCredits = takeCredits;
    components.economy = { credits, refineryStorage: credits, maxStorage: deps.economy.refineryStorageCapacity };
    components.production = { queue: [], progress: 0, current: null };
  } else if (kind === 'barracks' || kind === 'war_factory') {
    components.production = { queue: [], progress: 0 };
  } else if (kind === 'defense_turret') {
    components.combat = { weaponId: 'raider_cannon', cooldownRemaining: 0, targetId: null };
  } else if (kind === 'construction_yard') {
    components.construction = { queue: [], progress: 0, currentStructureId: null };
    components.power = { powerSupply: 0, powerDemand: 0, powered: true };
    components.tech = { tier: techTier, upgradingTo: null, ticksLeft: 0 };
  } else if (kind === 'power_node') {
    const def = deps.structures.find(s => s.id === kind);
    components.power = { powerSupply: def?.powerSupply ?? 100, powerDemand: def?.powerDemand ?? 0, powered: true };
  }
  return { components, tookCredits };
}

// Kind → unit components. Harvesters get a harvest FSM; everything else a combat weapon.
function makeUnit(kind: string, team: Team, deps: SeedDeps, fm = FACTIONS.concord): Record<string, unknown> {
  const def = deps.units.find(u => u.id === kind);
  if (!def) throw new Error(`[seedMission] unknown unit kind "${kind}"`);
  const base: Record<string, unknown> = {
    faction: { team, faction: kind },
    health: { hp: modHp(def.hp, fm), maxHp: modHp(def.hp, fm) },
    armor: { armorClass: def.armorClass },
    movement: { target: null, path: [], speed: modSpeed(def.speed, fm) },
  };
  if (kind === 'harvester') {
    base.harvest = { state: 'SEEK', targetTile: null, targetRefinery: null, cargo: 0 };
  } else {
    base.combat = { weaponId: def.weaponId, cooldownRemaining: 0, targetId: null };
  }
  if (def.stealth) base.stealth = { cloaked: true, decloakTicks: 0 }; // XP-3
  return base;
}

function seedSide(state: SimState, team: Team, credits: number, buildings: readonly Placed[], units: readonly Placed[], deps: SeedDeps, fm = FACTIONS.concord, techTier = 1): void {
  let creditsAssigned = false;
  const hasYard = buildings.some(b => b.type === 'construction_yard');
  let first = true;
  for (const b of buildings) {
    const { components, tookCredits } = makeBuilding(b.type, team, deps, credits, !creditsAssigned, techTier);
    if (tookCredits) creditsAssigned = true;
    // Tier anchor (XP-1): a side with no ConYard carries its tech tier on its first
    // building, so mission-seeded T2 content (e.g. an enemy War Factory) still works.
    if (!hasYard && first) { components.tech = { tier: techTier, upgradingTo: null, ticksLeft: 0 }; first = false; }
    state.store.create({ position: tileToWorldCenter({ tx: b.tx, ty: b.ty }), ...components });
  }
  for (const u of units) {
    state.store.create({ position: tileToWorldCenter({ tx: u.tx, ty: u.ty }), ...makeUnit(u.type, team, deps, fm) });
  }
}

export function seedFromMission(state: SimState, mission: Mission, deps: SeedDeps, factions?: TeamFactions): SeededMeta {
  // 1) Shard fields: ambient density on every SHARD terrain tile, then explicit clusters.
  if (mission.naturalShardDensity != null) {
    for (let ty = 0; ty < state.grid.height; ty++) {
      for (let tx = 0; tx < state.grid.width; tx++) {
        if (state.grid.terrainAt({ tx, ty }) === 'SHARD') {
          state.shardDensity.set(`${tx},${ty}`, mission.naturalShardDensity);
        }
      }
    }
  }
  for (const f of mission.fields) applyField(state, f);

  // 2) Neutral map features (FG-5): capturable derricks (planetEvent flips their team).
  for (const n of mission.neutrals) {
    if (n.type === 'wreck') {
      // XP-3: authored salvage fields (Act II's Ashfall graveyard).
      state.store.create({
        position: tileToWorldCenter({ tx: n.tx, ty: n.ty }),
        faction: { team: 'neutral', faction: 'wreck' },
        resource: { cargo: 120, capacity: 120 },
      });
      continue;
    }
    state.store.create({
      position: tileToWorldCenter({ tx: n.tx, ty: n.ty }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'neutral', faction: n.type },
      health: { hp: 1000, maxHp: 1000 },
      armor: { armorClass: 'BUILDING' },
    });
  }

  // 3) Sides. Player first (matches original id ordering), then each enemy + its fields.
  seedSide(state, 'player', mission.player.credits, mission.player.buildings, mission.player.units, deps, factions?.player ?? FACTIONS.concord, mission.player.techTier ?? 1);
  for (const enemy of mission.enemies) {
    seedSide(state, 'enemy', enemy.credits, enemy.buildings, enemy.units, deps, factions?.enemy ?? FACTIONS.concord, enemy.techTier ?? 1);
    for (const f of enemy.fields) applyField(state, f);
  }

  const start = mission.player.buildings[0] ?? mission.player.units[0] ?? { tx: Math.floor(state.grid.width / 2), ty: Math.floor(state.grid.height / 2) };
  const enemyBase = mission.enemies[0]?.buildings[0] ?? mission.enemies[0]?.units[0] ?? start;
  return { playerStartTile: { tx: start.tx, ty: start.ty }, objectiveTile: { tx: enemyBase.tx, ty: enemyBase.ty } };
}
