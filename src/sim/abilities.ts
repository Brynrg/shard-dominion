// ── Hero abilities (W4): data-defined active kit resolved in the pure sim ───────
// Each hero carries `abilities[]` in data/units.json (rally · mend · blink · nova ·
// ward) on per-ability cooldowns stored in the AbilityComponent. `castAbility` is
// the single resolver: the command system calls it for an `ability` intent, tests
// call it directly. Deterministic: fixed store scan order, tick math only.
import type { SimState } from './state.js';
import type { Entity } from './components.js';
import type { AbilityDef } from '../loaders/units.js';
import type { WorldPos } from './coords.js';
import { TILE_SUBUNITS } from './coords.js';
import { SIM_TICK_RATE } from './loop.js';

/** Anything that carries a hero kit (a full UnitDef, or the command system's narrowed unit shape). */
export type HeroLike = { id: string; abilities?: readonly AbilityDef[] };

const DEFAULT_RALLY_SECONDS = 8;

export function abilityOf(def: HeroLike, abilityId: string): AbilityDef | undefined {
  return (def.abilities ?? []).find((a) => a.id === abilityId);
}

/** No ability component, or no entry, or a 0 entry → ready. */
export function abilityReady(hero: Entity, abilityId: string): boolean {
  return (hero.components.ability?.cooldowns[abilityId] ?? 0) <= 0;
}

function distance(a: WorldPos, b: WorldPos): number {
  return Math.hypot(a.wx - b.wx, a.wy - b.wy);
}

/**
 * Resolve one cast. Returns false (and changes nothing) when the hero is dead, the
 * ability is cooling down, a targeted kind has no point, or a blink is out of range.
 */
export function castAbility(
  state: SimState,
  hero: Entity,
  def: HeroLike,
  ability: AbilityDef,
  target: WorldPos | null,
): boolean {
  const heroHp = hero.components.health;
  const heroPos = hero.components.position;
  if (!heroHp || heroHp.hp <= 0 || !heroPos) return false;
  if (!abilityReady(hero, ability.id)) return false;
  if (ability.targeted && !target) return false;
  if (!abilityOf(def, ability.id)) return false;

  const team = hero.components.faction?.team;
  const radius = ability.radiusTiles * TILE_SUBUNITS;

  if (ability.kind === 'blink') {
    if (!target || distance(heroPos, target) > radius) return false;
    const maxX = state.grid.width * TILE_SUBUNITS - 1;
    const maxY = state.grid.height * TILE_SUBUNITS - 1;
    hero.components.position = {
      wx: Math.max(0, Math.min(target.wx, maxX)),
      wy: Math.max(0, Math.min(target.wy, maxY)),
    };
    const mv = hero.components.movement;
    if (mv) { mv.target = null; mv.path = []; mv.attackMove = false; mv.orderQueue = []; }
    if (hero.components.combat) hero.components.combat.targetId = null;
  } else {
    // Area kinds: rally/mend/ward centre on the hero; nova centres on the point.
    const centre = ability.kind === 'nova' ? (target ?? heroPos) : heroPos;
    const durationTicks = Math.round((ability.durationSeconds ?? DEFAULT_RALLY_SECONDS) * SIM_TICK_RATE);
    for (const e of state.store.all()) {
      const f = e.components.faction;
      const h = e.components.health;
      const p = e.components.position;
      if (!f || !h || !p || h.hp <= 0) continue;
      if (distance(p, centre) > radius) continue;
      const friendly = f.team === team && !e.components.building;
      const hostile = f.team !== team;
      switch (ability.kind) {
        case 'rally':
          if (friendly) e.components.buff = { dmgBonus: ability.magnitude, dmgUntilTick: state.tick + durationTicks };
          break;
        case 'mend':
          if (friendly) h.hp = Math.min(h.maxHp, h.hp + ability.magnitude);
          break;
        case 'ward':
          if (friendly) {
            const prev = e.components.shield;
            e.components.shield = { hp: ability.magnitude, max: Math.max(prev?.max ?? 0, ability.magnitude), regenDelay: 0 };
          }
          break;
        case 'nova':
          if (hostile) {
            let dmg = ability.magnitude;
            const sh = e.components.shield;
            if (sh && sh.hp > 0) { const absorbed = Math.min(sh.hp, dmg); sh.hp -= absorbed; dmg -= absorbed; }
            h.hp -= dmg; // may reach <= 0; victory.ts culls
          }
          break;
      }
    }
  }

  const ab = hero.components.ability ?? (hero.components.ability = { cooldowns: {} });
  ab.cooldowns[ability.id] = Math.round(ability.cooldownSeconds * SIM_TICK_RATE);
  return true;
}
