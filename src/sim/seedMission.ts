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
import { unitComponents, structureComponents } from './factory.js';
import { FACTIONS, type TeamFactions } from './factions.js';

type Team = 'player' | 'enemy';
interface Placed { type: string; tx: number; ty: number }
interface FieldSpec { tx: number; ty: number; w: number; h: number; density: number }
export interface SeedDeps { units: readonly UnitDef[]; structures: readonly StructureDef[]; economy: EconomyConstants }
export interface SeededMeta { playerStartTile: { tx: number; ty: number }; objectiveTile: { tx: number; ty: number } }

function applyField(state: SimState, f: FieldSpec): void {
  for (let dy = 0; dy < f.h; dy++) {
    for (let dx = 0; dx < f.w; dx++) {
      state.shardDensity.set(`${f.tx + dx},${f.ty + dy}`, f.density);
    }
  }
}

// Buildings come from the CANONICAL factory (v0.42 Truth Pass) — the side's bank
// still lands on its FIRST refinery, and tier anchoring stays here (seed concerns).
function makeBuilding(kind: string, team: Team, deps: SeedDeps, sideCredits: number, takeCredits: boolean, techTier = 1): { components: Record<string, unknown>; tookCredits: boolean } {
  const isRefinery = kind === 'refinery';
  const components = structureComponents(kind, team, deps.structures, {
    onSlab: true,
    techTier,
    ...(isRefinery ? {
      credits: takeCredits ? sideCredits : 0,
      // TP: a bank never BOOTS over its own cap (QA: 3000 seeded into a 2000-cap
      // bank silently discarded every dock deposit → dead economy + "STORE 3000/2000").
      refineryMaxStorage: Math.max(deps.economy.refineryStorageCapacity, takeCredits ? sideCredits : 0),
    } : {}),
  });
  return { components, tookCredits: isRefinery && takeCredits };
}

// Units come from the CANONICAL factory (v0.42 Truth Pass).
function makeUnit(kind: string, team: Team, deps: SeedDeps, fm = FACTIONS.concord): Record<string, unknown> {
  const def = deps.units.find(u => u.id === kind);
  if (!def) throw new Error(`[seedMission] unknown unit kind "${kind}"`);
  return unitComponents(def, team, fm);
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
  // A side seeded WITHOUT a refinery still gets its bank: fall back to the
  // Construction Yard's command-reserve economy. Before this, the credits of any
  // refinery-less start (M1's WC3-style lone-ConYard opening) were silently
  // discarded — the mission said 2200, the player booted with 0.
  if (!creditsAssigned && credits > 0) {
    for (const e of state.store.all()) {
      const f = e.components.faction;
      if (f?.team !== team || f.faction !== 'construction_yard' || !e.components.economy) continue;
      e.components.economy.credits = credits;
      e.components.economy.refineryStorage = credits;
      // Headroom ABOVE the boot bank, or the mission opens on a red "STORAGE FULL"
      // banner before the player has done anything.
      e.components.economy.maxStorage = Math.max(e.components.economy.maxStorage, credits + deps.economy.refineryStorageCapacity);
      creditsAssigned = true;
      break;
    }
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
