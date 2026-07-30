// ── Build menu model, generated from DATA (Phase C1) ───────────────────────────
// hud.ts used to carry three hardcoded literal arrays (BASE_MENU / DEF_MENU /
// UNIT_MENU). They listed 11 of 24 units and 14 of 25 structures, so roughly half the
// authored content — including two of three faction heroes, the Tech Lab that gates
// the whole research tree, and both superweapons — could never be clicked. Worse, the
// arrays duplicated cost/tier/faction-lock from the JSON and silently drifted from it.
//
// This module derives the menu from `data/units.json` + `data/structures.json`, so
// adding content to the data adds it to the sidebar. Pure view-side: no DOM, no state
// mutation, so it is trivially testable.
import type { UnitDef } from '../loaders/units.js';
import type { StructureDef } from '../loaders/structures.js';

export type MenuTab = 'base' | 'def' | 'units' | 'tech';

export interface MenuItem {
  /** `build:barracks` / `train:infantry` / `strike:ion_cannon` — the sidebar action. */
  action: string;
  kind: 'build' | 'train';
  id: string;
  /** Sidebar label (shortName if the data provides one). */
  name: string;
  hotkey: string;
  cost: number;
  tier: number;
  cellCost: number;
  factionLock?: string;
  /** Structures: the prerequisite structure ids. Units: the single producer. */
  requires: readonly string[];
  /** Units only: `producedBy`, for the "needs a War Factory" hint. */
  producedBy?: string;
}

/** How many build rows fit on one sidebar page. */
export const ROWS_PER_PAGE = 9;

function unitItem(u: UnitDef): MenuItem {
  return {
    action: `train:${u.id}`,
    kind: 'train',
    id: u.id,
    name: u.shortName ?? u.name,
    hotkey: u.hotkey ?? '',
    cost: u.cost,
    tier: u.tier ?? 1,
    cellCost: u.cellCost ?? 0,
    factionLock: u.factionLock,
    requires: u.producedBy ? [u.producedBy] : [],
    producedBy: u.producedBy ?? undefined,
  };
}

function structureItem(s: StructureDef): MenuItem {
  return {
    action: `build:${s.id}`,
    kind: 'build',
    id: s.id,
    name: s.shortName ?? s.name,
    hotkey: s.hotkey ?? '',
    cost: s.cost,
    tier: s.tier ?? 1,
    cellCost: s.cellCost ?? 0,
    factionLock: s.factionLock,
    requires: s.prerequisites ?? [],
  };
}

/** Every item on a tab, for a given faction. Ordered tier-then-cost so the ladder
 *  reads top-to-bottom the way a build order actually goes. */
export function itemsForTab(
  tab: MenuTab,
  units: readonly UnitDef[],
  structures: readonly StructureDef[],
  factionId: string,
): MenuItem[] {
  let items: MenuItem[];
  if (tab === 'units') {
    items = units
      // `producedBy: null` marks something the player never builds (creeps).
      .filter(u => u.producedBy)
      .map(unitItem);
  } else if (tab === 'base' || tab === 'def') {
    items = structures.filter(s => s.menu === tab).map(structureItem);
  } else {
    return []; // the TECH tab renders refinements, not build items
  }
  return items
    .filter(i => !i.factionLock || i.factionLock === factionId)
    .sort((a, b) => (a.tier - b.tier) || (a.cost - b.cost) || a.id.localeCompare(b.id));
}

/** Slice a tab's items into the visible page. */
export function pageOf(items: readonly MenuItem[], page: number): MenuItem[] {
  const start = Math.max(0, page) * ROWS_PER_PAGE;
  return items.slice(start, start + ROWS_PER_PAGE);
}

export function pageCount(items: readonly MenuItem[]): number {
  return Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
}

/** The build/train item a hotkey maps to, honouring the faction lock. Heroes
 *  deliberately share `E`; the lock picks the right one for this faction. */
export function itemForHotkey(
  key: string,
  units: readonly UnitDef[],
  structures: readonly StructureDef[],
  factionId: string,
): MenuItem | null {
  const want = key.toUpperCase();
  if (!want) return null;
  for (const tab of ['base', 'def', 'units'] as const) {
    for (const item of itemsForTab(tab, units, structures, factionId)) {
      if (item.hotkey.toUpperCase() === want) return item;
    }
  }
  return null;
}
