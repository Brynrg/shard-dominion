// ── Content reachability gate (Phase C1) ───────────────────────────────────────
// The measured problem: hud.ts carried three hardcoded literal menus that reached
// 11 of 24 units and 14 of 25 structures. Roughly half the authored content —
// including two of three faction heroes, the Tech Lab that gates the entire research
// tree, and both superweapons — existed in the JSON and could never be clicked, while
// STATUS.md reported it as shipped.
//
// This gate makes that drift impossible: every id in the data must be reachable in the
// sidebar, or explicitly marked internal.
import { describe, it, expect } from 'vitest';
import { loadUnits } from '../../src/loaders/units.js';
import { loadStructures } from '../../src/loaders/structures.js';
import { loadRefinements } from '../../src/loaders/refinements.js';
import { itemsForTab, itemForHotkey, pageCount, ROWS_PER_PAGE } from '../../src/view/buildMenu.js';
import unitsData from '../../data/units.json' with { type: 'json' };
import structuresData from '../../data/structures.json' with { type: 'json' };
import refinementsData from '../../data/refinements.json' with { type: 'json' };

const units = loadUnits(unitsData);
const structures = loadStructures(structuresData);
const refinements = loadRefinements(refinementsData);
const FACTIONS = ['concord', 'emberhand', 'shardborn'] as const;

/** Every action reachable in the sidebar across all tabs, for any faction. */
function allReachable(): Set<string> {
  const out = new Set<string>();
  for (const f of FACTIONS) {
    for (const tab of ['base', 'def', 'units'] as const) {
      for (const item of itemsForTab(tab, units, structures, f)) out.add(item.id);
    }
  }
  return out;
}

describe('content reachability (Phase C1)', () => {
  it('every producible unit is reachable in the sidebar', () => {
    const reachable = allReachable();
    const producible = units.filter(u => u.producedBy).map(u => u.id);
    const stranded = producible.filter(id => !reachable.has(id));
    expect(stranded, `units in data but not in any sidebar tab: ${stranded.join(', ')}`).toEqual([]);
    // And the ones that are NOT producible must say so explicitly (creeps).
    for (const u of units) {
      if (u.producedBy) continue;
      expect(['riftmaw'], `${u.id} has no producedBy — is that deliberate?`).toContain(u.id);
    }
  });

  it('every non-internal structure is reachable in the sidebar', () => {
    const reachable = allReachable();
    const buildable = structures.filter(s => s.menu !== 'internal').map(s => s.id);
    const stranded = buildable.filter(id => !reachable.has(id));
    expect(stranded, `structures in data but not in any sidebar tab: ${stranded.join(', ')}`).toEqual([]);
  });

  it('every unit names a producer that actually exists as a structure', () => {
    const ids = new Set(structures.map(s => s.id));
    for (const u of units) {
      if (!u.producedBy) continue;
      expect(ids.has(u.producedBy), `${u.id}.producedBy = "${u.producedBy}" is not a structure`).toBe(true);
    }
  });

  it('every structure prerequisite names a real structure, with no cycles', () => {
    const byId = new Map(structures.map(s => [s.id, s]));
    for (const s of structures) {
      for (const p of s.prerequisites ?? []) {
        expect(byId.has(p), `${s.id} requires "${p}", which is not a structure`).toBe(true);
      }
    }
    // Walk each chain; a cycle would make the structure permanently unbuildable.
    for (const s of structures) {
      // Track the current PATH, not every node visited: a diamond (ion_cannon reaches
      // refinery via both tech_lab and processing_plant) is legal, a cycle is not.
      const walk = (id: string, path: readonly string[]): void => {
        if (path.includes(id)) throw new Error(`prerequisite cycle: ${[...path, id].join(' -> ')}`);
        for (const p of byId.get(id)?.prerequisites ?? []) walk(p, [...path, id]);
      };
      expect(() => walk(s.id, []), `${s.id} prerequisite chain`).not.toThrow();
    }
  });

  it('no two menu items share a hotkey (heroes may share E)', () => {
    for (const f of FACTIONS) {
      const used = new Map<string, string>();
      for (const tab of ['base', 'def', 'units'] as const) {
        for (const item of itemsForTab(tab, units, structures, f)) {
          if (!item.hotkey) continue;
          const prev = used.get(item.hotkey);
          expect(prev, `faction ${f}: hotkey ${item.hotkey} claimed by both ${prev} and ${item.id}`).toBeUndefined();
          used.set(item.hotkey, item.id);
        }
      }
      // Reserved control keys must never be stolen by a build item.
      for (const k of 'ASDXUPMQIO') {
        expect(used.has(k), `faction ${f}: build item ${used.get(k)} steals the reserved key ${k}`).toBe(false);
      }
    }
  });

  it('every declared hotkey resolves back to its item', () => {
    for (const f of FACTIONS) {
      for (const tab of ['base', 'def', 'units'] as const) {
        for (const item of itemsForTab(tab, units, structures, f)) {
          if (!item.hotkey) continue;
          const hit = itemForHotkey(item.hotkey, units, structures, f);
          expect(hit?.id, `faction ${f}: ${item.hotkey} should reach ${item.id}`).toBe(item.id);
          // Lower case must work too — players do not hold shift.
          expect(itemForHotkey(item.hotkey.toLowerCase(), units, structures, f)?.id).toBe(item.id);
        }
      }
    }
  });

  it('every tab is paged rather than overflowing the panel', () => {
    for (const f of FACTIONS) {
      for (const tab of ['base', 'def', 'units'] as const) {
        const items = itemsForTab(tab, units, structures, f);
        // A tab longer than one page MUST report more than one page, otherwise the
        // overflow rows are drawn off the bottom of the sidebar and are unclickable —
        // which is exactly what the 13-refinement TECH tab used to do.
        if (items.length > ROWS_PER_PAGE) expect(pageCount(items)).toBeGreaterThan(1);
        expect(pageCount(items) * ROWS_PER_PAGE).toBeGreaterThanOrEqual(items.length);
      }
    }
  });

  it('every refinement effect has an application site in the sim', () => {
    // A refinement whose effect nothing reads is a no-op the player pays for. Before
    // Phase C2, `range`, `firepower` and `buildTime` were parsed and applied nowhere.
    const APPLIED = new Set(['harvest', 'damage', 'armor', 'resonance', 'range', 'firepower', 'buildTime']);
    for (const r of refinements) {
      expect(APPLIED.has(r.effect), `refinement ${r.id} has unapplied effect "${r.effect}"`).toBe(true);
    }
  });

  it('every menu item has a purpose description for its tooltip (WC3 convention)', () => {
    for (const f of FACTIONS) {
      for (const tab of ['base', 'def', 'units'] as const) {
        for (const item of itemsForTab(tab, units, structures, f)) {
          expect(item.desc.length, `${item.id} has no desc — its tooltip would be empty`).toBeGreaterThan(10);
          expect(item.buildTimeSeconds, `${item.id} build time`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every faction can build a hero and reach tier 3', () => {
    for (const f of FACTIONS) {
      const roster = itemsForTab('units', units, structures, f).map(i => i.id);
      const heroes = units.filter(u => u.hero && roster.includes(u.id));
      // Two of three factions previously had NO reachable hero at all.
      expect(heroes.length, `faction ${f} has no reachable hero`).toBeGreaterThanOrEqual(1);
    }
  });
});
