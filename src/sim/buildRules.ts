// ── Build rules: the ONE place that answers "can this team make this thing?" ────
// Sim-pure (state only; no DOM/Date/Math.random). Both the authoritative sim paths
// (command, production, ai) and the view's sidebar read these helpers, so a button
// can never claim something the sim will silently refuse — and the routing table
// that used to be duplicated in hud.ts, command.ts and ai.ts now lives in DATA
// (`units[].producedBy`, `structures[].prerequisites`).
import type { SimState } from './state.js';
import { isOperational } from './factory.js';
import { teamTier } from './tech.js';
import { teamCredits, teamCells } from './ledger.js';
import type { StructureDef } from '../loaders/structures.js';

/** Why a build/train request is refused. `null` = allowed. */
export type RefusalReason = 'funds' | 'tier' | 'prereq' | 'cells' | 'busy' | 'faction' | 'producer';

/** A living, finished, own-team structure of this kind exists. */
export function hasStructure(state: SimState, team: string, structureId: string): boolean {
  for (const e of state.store.all()) {
    const f = e.components.faction;
    if (f?.team !== team || f.faction !== structureId) continue;
    if ((e.components.health?.hp ?? 1) <= 0) continue;
    if (!isOperational(e)) continue; // a half-built scaffold unlocks nothing
    return true;
  }
  return false;
}

/** The own-team producer entity for a unit kind, or null. Honours `producedBy`. */
export function producerFor(
  state: SimState,
  team: string,
  unit: { producedBy?: string | null },
): { id: number | string; faction: string } | null {
  const want = unit.producedBy ?? null;
  if (!want) return null;
  for (const e of state.store.all()) {
    const f = e.components.faction;
    if (f?.team !== team || f.faction !== want) continue;
    if (!e.components.production) continue;
    if ((e.components.health?.hp ?? 1) <= 0) continue;
    if (!isOperational(e)) continue;
    return { id: e.id as unknown as number, faction: f.faction };
  }
  return null;
}

/** Every prerequisite structure of `def` is standing. */
export function prerequisitesMet(state: SimState, team: string, def: StructureDef): boolean {
  for (const p of def.prerequisites ?? []) if (!hasStructure(state, team, p)) return false;
  return true;
}

/** Full refusal check for STARTING a structure's sidebar job. */
export function refuseStructure(
  state: SimState,
  team: 'player' | 'enemy',
  def: StructureDef,
  factionId?: string,
  costOverride?: number,
): RefusalReason | null {
  if (def.menu === 'internal') return 'prereq';
  if (def.factionLock && factionId && def.factionLock !== factionId) return 'faction';
  if ((def.tier ?? 1) > teamTier(state, team)) return 'tier';
  if (!prerequisitesMet(state, team, def)) return 'prereq';
  if (teamCells(state, team) < (def.cellCost ?? 0)) return 'cells';
  if (teamCredits(state, team) < (costOverride ?? def.cost ?? 0)) return 'funds';
  return null;
}

/** Full refusal check for QUEUEING a unit. */
export function refuseUnit(
  state: SimState,
  team: 'player' | 'enemy',
  unit: { producedBy?: string | null; tier?: number; cellCost?: number; factionLock?: string },
  price: number,
  factionId?: string,
): RefusalReason | null {
  if (unit.factionLock && factionId && unit.factionLock !== factionId) return 'faction';
  if ((unit.tier ?? 1) > teamTier(state, team)) return 'tier';
  if (!producerFor(state, team, unit)) return 'producer';
  if (teamCells(state, team) < (unit.cellCost ?? 0)) return 'cells';
  if (teamCredits(state, team) < price) return 'funds';
  return null;
}
