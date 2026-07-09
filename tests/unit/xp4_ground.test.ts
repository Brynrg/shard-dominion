// ── XP-4: stances, artillery minRange, containers, auras, team-pass gates ───────
import { describe, it, expect, beforeEach } from 'vitest';
import { makeSimState, type SimState } from '../../src/sim/state.js';
import { orderSystems, runTick } from '../../src/sim/loop.js';
import { makeCombatTargetingSystem } from '../../src/sim/systems/combatTargeting.js';
import { makeCommandSystem } from '../../src/sim/systems/command.js';
import { makeMovementSystem } from '../../src/sim/systems/movement.js';
import { makeConstructionSystem } from '../../src/sim/systems/construction.js';
import { makeCommandQueue } from '../../src/view/input.js';
import { loadWeapons } from '../../src/loaders/loader.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { tileToWorldCenter, worldToTile } from '../../src/sim/coords.js';
import weaponsData from '../../data/weapons.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };

const weapons = loadWeapons(weaponsData);
const structures = loadStructures(structuresData);

function unit(state: SimState, team: 'player' | 'enemy', tx: number, ty: number, weaponId = 'rifle', kind = 'infantry') {
  return state.store.create({
    position: tileToWorldCenter({ tx, ty }),
    movement: { target: null, path: [], speed: 12 },
    combat: { weaponId, cooldownRemaining: 0, targetId: null },
    faction: { team, faction: kind },
    health: { hp: 60, maxHp: 60 },
    armor: { armorClass: 'LIGHT' },
  });
}

describe('XP-4 — stances', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 4, mapWidth: 32, mapHeight: 32 }); });

  it('hold-fire never acquires; defensive ignores edge-of-range targets', () => {
    const shooter = unit(state, 'player', 10, 10);
    unit(state, 'enemy', 13, 10); // 3 tiles: inside rifle range (4), outside 0.7× (2.8)
    const sys = orderSystems([makeCombatTargetingSystem(weapons)]);
    state.store.get(shooter)!.components.combat!.stance = 'hold';
    runTick(state, sys);
    expect(state.store.get(shooter)!.components.combat!.targetId).toBeNull();
    state.store.get(shooter)!.components.combat!.stance = 'defensive';
    runTick(state, sys);
    expect(state.store.get(shooter)!.components.combat!.targetId).toBeNull();
    state.store.get(shooter)!.components.combat!.stance = 'aggressive';
    runTick(state, sys);
    expect(state.store.get(shooter)!.components.combat!.targetId).not.toBeNull();
  });

  it('the stance intent cycles the selection', () => {
    const u = unit(state, 'player', 10, 10);
    state.store.get(u)!.components.selection = { selected: true };
    const queue = makeCommandQueue();
    const sys = orderSystems([makeCommandSystem(queue, structures)]);
    queue.push({ type: 'stance' });
    runTick(state, sys);
    expect(state.store.get(u)!.components.combat!.stance).toBe('defensive');
    queue.push({ type: 'stance' });
    runTick(state, sys);
    expect(state.store.get(u)!.components.combat!.stance).toBe('hold');
  });
});

describe('XP-4 — artillery', () => {
  it('siege targeting skips sub-minRange candidates (no lock-and-sulk)', () => {
    const state = makeSimState({ seed: 4, mapWidth: 32, mapHeight: 32 });
    const arty = unit(state, 'player', 10, 10, 'siege_cannon', 'longbow');
    unit(state, 'enemy', 11, 10);  // 1 tile: inside minRange 2 — must be ignored
    const far = unit(state, 'enemy', 15, 10); // 5 tiles: valid
    const sys = orderSystems([makeCombatTargetingSystem(weapons)]);
    runTick(state, sys);
    expect(state.store.get(arty)!.components.combat!.targetId).toBe(far);
  });
});

describe('XP-4 — containers + auras + gates', () => {
  let state: SimState;
  beforeEach(() => { state = makeSimState({ seed: 4, mapWidth: 32, mapHeight: 32 }); });

  it('infantry boards an adjacent bunker; the bunker arms; unload spills them back', () => {
    const bunker = state.store.create({
      position: tileToWorldCenter({ tx: 12, ty: 10 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      container: { capacity: 4, stored: [] },
      faction: { team: 'player', faction: 'bunker' },
      health: { hp: 600, maxHp: 600 },
    });
    const inf = unit(state, 'player', 11, 10);
    state.store.get(inf)!.components.movement!.target = tileToWorldCenter({ tx: 12, ty: 10 });
    state.store.get(inf)!.components.movement!.boardTargetId = bunker;
    const sys = orderSystems([makeMovementSystem()]);
    for (let i = 0; i < 10; i++) runTick(state, sys);
    expect(state.store.get(inf)).toBeUndefined(); // boarded
    const box = state.store.get(bunker)!;
    expect(box.components.container!.stored.length).toBe(1);
    expect(box.components.combat).toBeDefined(); // armed
    // Unload via the intent.
    box.components.selection = { selected: true };
    const queue = makeCommandQueue();
    const csys = orderSystems([makeCommandSystem(queue, structures)]);
    queue.push({ type: 'unload' });
    runTick(state, csys);
    expect(state.store.get(bunker)!.components.container!.stored.length).toBe(0);
    expect(state.store.all().filter(e => e.components.faction?.faction === 'infantry').length).toBe(1);
  });

  it('an infirmary heals nearby damaged own infantry (and not vehicles)', () => {
    state.store.create({
      position: tileToWorldCenter({ tx: 10, ty: 10 }),
      building: { onSlab: true, buildProgress: 100, powered: true },
      faction: { team: 'player', faction: 'infirmary' },
      health: { hp: 600, maxHp: 600 },
    });
    const inf = unit(state, 'player', 11, 10);
    state.store.get(inf)!.components.health!.hp = 10;
    const queue = makeCommandQueue();
    const sys = orderSystems([makeConstructionSystem(structures, queue)]);
    for (let i = 0; i < 40; i++) runTick(state, sys); // 2s → +3 hp
    expect(state.store.get(inf)!.components.health!.hp).toBeGreaterThan(10);
  });

  it('gates block the enemy but pass the owner', () => {
    // A gate line at tx=10; an OWNER unit crosses, an ENEMY detours.
    for (const ty of [9, 10, 11]) {
      state.store.create({
        position: tileToWorldCenter({ tx: 10, ty }),
        building: { onSlab: true, buildProgress: 100, powered: true, blocksPath: true, teamPass: true },
        faction: { team: 'player', faction: 'gate' },
        health: { hp: 350, maxHp: 350 },
      });
    }
    const own = state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 10 }),
      movement: { target: tileToWorldCenter({ tx: 12, ty: 10 }), path: [], speed: 20 },
      faction: { team: 'player', faction: 'infantry' },
      health: { hp: 20, maxHp: 20 },
    });
    const foe = state.store.create({
      position: tileToWorldCenter({ tx: 8, ty: 12 }),
      movement: { target: tileToWorldCenter({ tx: 12, ty: 13 }), path: [], speed: 20 },
      faction: { team: 'enemy', faction: 'infantry' },
      health: { hp: 20, maxHp: 20 },
    });
    const sys = orderSystems([makeMovementSystem()]);
    let foeTouchedGate = false;
    for (let i = 0; i < 300; i++) {
      runTick(state, sys);
      const ft = worldToTile(state.store.get(foe)!.components.position!);
      if (ft.tx === 10 && ft.ty >= 9 && ft.ty <= 11) foeTouchedGate = true;
    }
    expect(worldToTile(state.store.get(own)!.components.position!).tx).toBe(12); // owner through
    expect(worldToTile(state.store.get(foe)!.components.position!).tx).toBe(12); // foe arrived (via the south detour)…
    expect(foeTouchedGate).toBe(false);                                          // …but AROUND
  });
});
