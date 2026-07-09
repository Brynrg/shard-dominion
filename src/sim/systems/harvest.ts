// ── Harvest system: harvester FSM (SEEK→HARVEST→RETURN→DOCK) ──────────────────
// Runs after movement per SYSTEM_ORDER. Reads state only; does NOT construct anything.
import type { SimState } from '../state.js';
import type { EconomyConstants } from '../../loaders/economyConstants.js';
import { worldToTile, tileToWorldCenter } from '../coords.js';
import { SIM_TICK_RATE } from '../loop.js';
import type { EntityId } from '../ids.js';
import type { HarvestComponent, EconomyComponent, PositionComponent, MovementComponent, FactionComponent } from '../components.js';

// Dock slots per refinery (one per refinery for simplicity)
const DOCK_SLOTS_PER_REFINERY = 1;

export function makeHarvestSystem(economy: EconomyConstants): { name: 'harvest'; run(state: SimState): void } {
  // Derived constants from economy config
  const DOCK_RATE_PER_TICK = economy.dockRate / SIM_TICK_RATE; // 80/s ÷ 20Hz = 4 credits/tick

  // Last-seen hp per harvester, for flee detection (E6). Closure-scoped (one per sim),
  // deterministic. Id reuse is safe: we read prev then overwrite, and a fresh harvester's
  // full hp never reads as "dropped" against a dead predecessor's last (lower/equal) hp.
  const lastHp = new Map<EntityId, number>();

  return {
    name: 'harvest' as const,
    run(state: SimState): void {
      // ── Emergency salvage (QA BUG-3): a side with a refinery but ZERO living
      // harvesters trickles a small income until it can afford a replacement —
      // kills the "harvester died at 230 credits, game unwinnable" soft-lock.
      // Applies to both teams (symmetric); stops at the cap so it is a comeback
      // mechanic, not free AFK income. Deterministic (pure state read + tick math).
      for (const team of ['player', 'enemy'] as const) {
        let hasHarvester = false; let bank: { credits: number } | null = null;
        for (const e of state.store.all()) {
          const f = e.components.faction;
          if (!f || f.team !== team) continue;
          if (f.faction === 'harvester' && (e.components.health?.hp ?? 1) > 0) { hasHarvester = true; break; }
          if (!bank && e.components.building && e.components.economy) bank = e.components.economy;
        }
        if (!hasHarvester && bank && bank.credits < economy.salvageTrickleCap) {
          bank.credits = Math.min(economy.salvageTrickleCap, bank.credits + economy.salvageRatePerSec / SIM_TICK_RATE);
        }
      }

      // Track dock usage per refinery to prevent deadlock
      const dockUsage = new Map<EntityId, number>();

      // First pass: count dock usage by harvesters in DOCK state
      for (const e of state.store.all()) {
        const harvest = e.components.harvest;
        const faction = e.components.faction;
        if (!harvest || faction?.faction !== 'harvester') continue;
        if (harvest.state === 'DOCK' && harvest.targetRefinery) {
          dockUsage.set(harvest.targetRefinery, (dockUsage.get(harvest.targetRefinery) || 0) + 1);
        }
      }

      // Second pass: run FSM for each harvester
      for (const e of state.store.all()) {
        const pos = e.components.position;
        const movement = e.components.movement;
        const harvest = e.components.harvest;
        const faction = e.components.faction;

        if (!pos || !movement || !harvest || faction?.faction !== 'harvester') continue;

        // ── Flee (E6): a harvester that LOST hp since last tick breaks off mining and
        // routes to safety (its nearest refinery) instead of standing in the field.
        // Forces a raider to commit faster units; rewards defended harvest routes.
        const hp = e.components.health?.hp ?? Infinity;
        const prevHp = lastHp.get(e.id) ?? hp;
        lastHp.set(e.id, hp);
        if (hp < prevHp && (harvest.state === 'SEEK' || harvest.state === 'HARVEST')) {
          harvest.state = 'RETURN';
          movement.target = null;
        }

        switch (harvest.state) {
          case 'SEEK':
            runSeek(state, e, pos, movement, harvest);
            break;
          case 'HARVEST':
            runHarvest(state, e, pos, movement, harvest, economy);
            break;
          case 'RETURN':
            runReturn(state, e, pos, movement, harvest, dockUsage);
            break;
          case 'DOCK':
            runDock(state, e, pos, movement, harvest, dockUsage, economy, DOCK_RATE_PER_TICK);
            break;
        }
      }
    },
  };
}

function runSeek(
  state: SimState,
  entity: { id: EntityId; components: { position?: PositionComponent; movement?: MovementComponent; harvest?: HarvestComponent; faction?: FactionComponent } },
  pos: PositionComponent,
  movement: MovementComponent,
  harvest: HarvestComponent,
): void {
  // Find the densest reachable shard tile
  const targetTile = findDensestShardTile(state, pos);
  if (targetTile) {
    const targetPos = tileToWorldCenter(targetTile);
    movement.target = targetPos;
    harvest.targetTile = targetTile;
    // Transition to HARVEST when we reach the tile
    harvest.state = 'HARVEST';
  } else {
    // No shard tiles available - stay idle
    movement.target = null;
  }
}

function runHarvest(
  state: SimState,
  entity: { id: EntityId; components: { position?: PositionComponent; movement?: MovementComponent; harvest?: HarvestComponent; faction?: FactionComponent } },
  pos: PositionComponent,
  movement: MovementComponent,
  harvest: HarvestComponent,
  economy: EconomyConstants,
): void {
  // Check if we've reached the target tile
  if (harvest.targetTile) {
    const tilePos = worldToTile(pos);
    if (tilePos.tx === harvest.targetTile.tx && tilePos.ty === harvest.targetTile.ty) {
      // We're at the tile - harvest
      const densityKey = `${harvest.targetTile.tx},${harvest.targetTile.ty}`;
      const density = state.shardDensity.get(densityKey) ?? 0;

      if (density > 0 && harvest.cargo < economy.cargoCapacity) {
        // Harvest from tile
        const amount = Math.min(economy.harvestRate, density, economy.cargoCapacity - harvest.cargo);
        state.shardDensity.set(densityKey, density - amount);
        harvest.cargo += amount;
      } else {
        // Tile depleted or cargo full - return to refinery
        harvest.state = 'RETURN';
        movement.target = null;
      }
    } else {
      // Still moving toward tile - do nothing (movement system handles it)
    }
  } else {
    // No target - go back to SEEK
    harvest.state = 'SEEK';
  }
}

function runReturn(
  state: SimState,
  entity: { id: EntityId; components: { position?: PositionComponent; movement?: MovementComponent; harvest?: HarvestComponent; faction?: FactionComponent } },
  pos: PositionComponent,
  movement: MovementComponent,
  harvest: HarvestComponent,
  dockUsage: Map<EntityId, number>,
): void {
  // Find nearest refinery with free dock
  const refinery = findNearestFreeRefinery(state, pos, dockUsage);
  if (refinery) {
    const refineryPos = refinery.components.position;
    if (refineryPos) {
      movement.target = refineryPos;
      harvest.targetRefinery = refinery.id;
      // Transition to DOCK when we reach the refinery
      harvest.state = 'DOCK';
    }
  } else {
    // No free refinery - stay in RETURN state, keep looking
    movement.target = null;
  }
}

function runDock(
  state: SimState,
  entity: { id: EntityId; components: { position?: PositionComponent; movement?: MovementComponent; harvest?: HarvestComponent; faction?: FactionComponent } },
  pos: PositionComponent,
  movement: MovementComponent,
  harvest: HarvestComponent,
  dockUsage: Map<EntityId, number>,
  economy: EconomyConstants,
  dockRatePerTick: number,
): void {
  const refineryId = harvest.targetRefinery;
  if (!refineryId) {
    harvest.state = 'RETURN';
    movement.target = null;
    return;
  }

  const refinery = state.store.get(refineryId);
  if (!refinery || !refinery.components.position || !refinery.components.economy) {
    harvest.state = 'RETURN';
    movement.target = null;
    return;
  }

  // Check if we're at the refinery
  const refineryPos = refinery.components.position;
  const dx = refineryPos.wx - pos.wx;
  const dy = refineryPos.wy - pos.wy;
  const distSq = dx * dx + dy * dy;

  // Use a generous threshold for docking (1 tile = 256^2 = 65536)
  const DOCK_THRESHOLD_SQ = 256 * 256;

  if (distSq <= DOCK_THRESHOLD_SQ) {
    // At the refinery — drip cargo into credits at dockRatePerTick (100 cr/s), 1 cargo = 1 credit,
    // capped at maxStorage. Once the cap is reached, the rest of the load is LOST (overflow) so the
    // harvester never deadlocks waiting on a full refinery.
    const economyComp = refinery.components.economy as EconomyComponent;
    const maxStorage = economyComp.maxStorage || economy.refineryStorageCapacity;
    const room = maxStorage - economyComp.credits;

    if (room <= 0) {
      // Storage full: the remaining cargo is lost.
      harvest.cargo = 0;
    } else {
      const deposit = Math.min(dockRatePerTick, room, harvest.cargo);
      economyComp.credits += deposit;
      harvest.cargo -= deposit;
    }

    // Mirror credits to refineryStorage so the HUD storage bar reads the single credits pool.
    economyComp.refineryStorage = economyComp.credits;

    // Load done (emptied or overflowed) → seek the next field.
    if (harvest.cargo <= 0) {
      harvest.state = 'SEEK';
      harvest.targetRefinery = null;
      movement.target = null;
    }
  }
  // else: Still moving toward refinery - do nothing, let movement system handle it
}

function findDensestShardTile(state: SimState, pos: PositionComponent): { tx: number; ty: number } | null {
  const tilePos = worldToTile(pos);
  let bestTile: { tx: number; ty: number } | null = null;
  let bestScore = 0;

  // Distance-DISCOUNTED richness (FG-2): score = density − 60·distance. A nearby
  // field wins over a slightly-richer distant one, so harvesters work the home
  // field first and only trek to flank/centre fields as the near ones deplete —
  // expansion becomes a real decision instead of automatic centre-rushing.
  // Deterministic: fixed scan order, strict > keeps the first-best on ties.
  const searchRadius = 14;
  const DIST_PENALTY = 100; // density a farther tile must beat, per tile of distance
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const tx = tilePos.tx + dx;
      const ty = tilePos.ty + dy;
      const densityKey = `${tx},${ty}`;
      const density = state.shardDensity.get(densityKey) ?? 0;
      if (density <= 0) continue;
      const chebyshev = Math.max(Math.abs(dx), Math.abs(dy));
      const score = density - DIST_PENALTY * chebyshev;
      if (score > bestScore) {
        bestScore = score;
        bestTile = { tx, ty };
      }
    }
  }

  return bestTile;
}

function findNearestFreeRefinery(
  state: SimState,
  pos: PositionComponent,
  dockUsage: Map<EntityId, number>,
): { id: EntityId; components: { position?: PositionComponent; economy?: EconomyComponent } } | null {
  let nearest: { id: EntityId; components: { position?: PositionComponent; economy?: EconomyComponent } } | null = null;
  let nearestDistSq = Infinity;

  for (const e of state.store.all()) {
    const faction = e.components.faction;
    const building = e.components.building;
    const economy = e.components.economy;

    if (!faction || faction.faction !== 'refinery' || !building || !economy) continue;

    const refineryPos = e.components.position;
    if (!refineryPos) continue;

    const dx = refineryPos.wx - pos.wx;
    const dy = refineryPos.wy - pos.wy;
    const distSq = dx * dx + dy * dy;

    // Check if refinery has free dock
    const currentUsage = dockUsage.get(e.id) || 0;
    if (currentUsage < DOCK_SLOTS_PER_REFINERY && distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = { id: e.id, components: { position: refineryPos, economy } };
    }
  }

  return nearest;
}
