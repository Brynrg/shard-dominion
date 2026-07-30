// ── Canonical entity factory (v0.42 Truth Pass) ────────────────────────────────
// THE single source of truth for what components a unit or structure carries.
// QA round 2 (static audit + play-test) found five creation paths that had drifted
// apart — mission seeding, production, trigger spawns, AI construction, and player
// placement each assembled entities differently, so features worked on one path and
// silently missed on another (produced gunships couldn't fly; trigger "bombers"
// ground-pathed with infinite ammo; seeded AA turrets never fired; Concord shields
// only existed on seeded units). Every creation path now calls these two builders.
//
// Pure + deterministic: no DOM, no Date, no Math.random. Builders return component
// bags; callers add `position` and call `state.store.create`.
import type { UnitDef } from '../loaders/units.js';
import type { StructureDef } from '../loaders/structures.js';
import type { WorldPos } from './coords.js';
import { FACTIONS, modHp, modSpeed, type FactionMods } from './factions.js';

type Team = 'player' | 'enemy' | 'neutral';

export interface UnitOpts {
  /** Move/rally target applied at spawn (production rally, trigger attack-move). */
  target?: WorldPos | null;
  /** Spawn in attack-move posture (trigger waves). */
  attackMove?: boolean;
  /** Veterancy carried in (hero persistence). */
  experienceKills?: number;
}

/** Veterancy rank from lifetime kills. r1@3, r2@8, r3@15 (heroes ascend the ladder;
 *  regular units share it). Single source of truth (damage + hero systems use it). */
export function veterancyRank(kills: number): number {
  return kills >= 15 ? 3 : kills >= 8 ? 2 : kills >= 3 ? 1 : 0;
}

/** Component bag for a UNIT of `kind` — identical on every creation path. */
export function unitComponents(
  def: UnitDef,
  team: Team,
  fm: FactionMods = FACTIONS.concord,
  opts: UnitOpts = {},
): Record<string, unknown> {
  const kills = opts.experienceKills ?? 0;
  return {
    faction: { team, faction: def.id },
    health: { hp: modHp(def.hp, fm), maxHp: modHp(def.hp, fm) },
    armor: { armorClass: def.armorClass },
    movement: {
      target: opts.target ? { ...opts.target } : null,
      path: [],
      speed: modSpeed(def.speed, fm),
      ...(opts.attackMove && opts.target ? { attackMove: true } : {}),
      ...(def.flying ? { flying: true } : {}),
    },
    ...(def.stealth ? { stealth: { cloaked: true, decloakTicks: 0 } } : {}),
    ...(def.container ? { container: { capacity: def.container, stored: [] } } : {}),
    // Concord shields (XP-5) apply to COMBAT units on every path (not workers).
    ...(fm.shieldHp && def.id !== 'harvester'
      ? { shield: { hp: fm.shieldHp, max: fm.shieldHp, regenDelay: 0 } } : {}),
    ...(kills > 0
      ? { experience: { kills, rank: veterancyRank(kills) } } : {}),
    ...(def.id === 'harvester'
      ? { harvest: { state: 'SEEK' as const, targetTile: null, targetRefinery: null, cargo: 0 } }
      : { combat: { weaponId: def.weaponId, cooldownRemaining: 0, targetId: null, ...(def.ammo ? { ammo: def.ammo, ammoMax: def.ammo } : {}) } }),
  };
}

export interface StructureOpts {
  /** 100 = operational (seeds/AI); TP-3 placement starts at 0 and builds up. */
  buildProgress?: number;
  onSlab?: boolean;
  /** Refinery bank seeding (mission side credits). */
  credits?: number;
  refineryMaxStorage?: number;
  /** ConYard tech tier (mission techTier). */
  techTier?: number;
}

/** Structure kinds with no entry in structures.json (seed-only / neutral). */
const FALLBACK_HP: Record<string, number> = { refinery: 1500, derrick: 1000, relay: 1000 };

/** Component bag for a STRUCTURE of `kind` — identical on every creation path. */
export function structureComponents(
  kind: string,
  team: Team,
  structures: readonly StructureDef[],
  opts: StructureOpts = {},
): Record<string, unknown> {
  const def = structures.find(s => s.id === kind);
  const maxHp = def?.hp ?? FALLBACK_HP[kind] ?? 1000;
  const progress = opts.buildProgress ?? 100;
  // TP-3: a construction SITE stands at 20% hp and grows as it builds — attackable
  // scaffolding, exactly the C&C rule the audit found missing.
  const hp = progress >= 100 ? maxHp : Math.max(1, Math.ceil(maxHp * 0.2));
  const components: Record<string, unknown> = {
    building: {
      onSlab: opts.onSlab ?? false,
      buildProgress: progress,
      powered: true,
      ...(def?.blocksPath ? { blocksPath: true } : {}),
      ...(def?.teamPass ? { teamPass: true } : {}),
    },
    faction: { team, faction: kind },
    health: { hp, maxHp },
    armor: { armorClass: 'BUILDING' },
  };
  // Power: attach whenever the def declares supply OR demand (the audit found
  // seeded turrets/plants/skypads silently drawing no power).
  if (def && (def.powerSupply > 0 || def.powerDemand > 0)) {
    components.power = { powerSupply: def.powerSupply, powerDemand: def.powerDemand, powered: true };
  }
  if (def?.container) components.container = { capacity: def.container, stored: [] };
  // Producer flag from DATA (Phase C1): any structure some unit's `producedBy` names.
  // Replaces a hardcoded case list here that had drifted — barracks_elite was absent,
  // so the Elite Barracks stood but could never actually train its roster.
  if (def?.producesUnits && kind !== 'refinery') components.production = { queue: [], progress: 0 };

  switch (kind) {
    case 'refinery':
      components.economy = {
        credits: opts.credits ?? 0,
        refineryStorage: opts.credits ?? 0,
        maxStorage: opts.refineryMaxStorage ?? 1500,
      };
      components.production = { queue: [], progress: 0, current: null };
      break;

    case 'defense_turret':
      components.combat = { weaponId: 'raider_cannon', cooldownRemaining: 0, targetId: null };
      break;
    case 'aa_turret': // audit: seeded AA never fired — now armed on every path
      components.combat = { weaponId: 'aa_missile', cooldownRemaining: 0, targetId: null };
      break;
    case 'construction_yard':
      components.construction = { queue: [], progress: 0, currentStructureId: null };
      components.tech = { tier: opts.techTier ?? 1, upgradingTo: null, ticksLeft: 0 };
      if (!components.power) components.power = { powerSupply: 0, powerDemand: 0, powered: true };
      // TP-2: the ConYard carries a COMMAND RESERVE bank — after losing every
      // refinery a side can still bank the emergency trickle and rebuild.
      components.economy = { credits: 0, refineryStorage: 0, maxStorage: 1500 };
      break;
  }
  return components;
}

/** TP-3: is this building finished? Systems gate function on it (turrets don't fire,
 *  producers don't produce, power doesn't flow from scaffolding). Units are always
 *  operational. */
export function isOperational(e: { components: { building?: { buildProgress: number } } }): boolean {
  return (e.components.building?.buildProgress ?? 100) >= 100;
}
