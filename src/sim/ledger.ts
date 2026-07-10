// ── Team ledger (v0.42 Truth Pass) ──────────────────────────────────────────────
// ONE deterministic view of a side's money. QA round 2 found the HUD summing every
// bank while production/placement/upgrades spent only from the FIRST matching bank —
// so a player with credits split across refineries saw "affordable" buttons that
// silently did nothing. Every spend site now goes through these helpers, which
// drain across all owned banks in store order (deterministic).
//
// Banks live on refineries (dock storage) and Construction Yards (the small
// "command reserve" that keeps a side rebuildable after losing every refinery).
import type { SimState } from './state.js';
import type { EconomyComponent } from './components.js';

type Team = 'player' | 'enemy';

function banksOf(state: SimState, team: Team): EconomyComponent[] {
  const out: EconomyComponent[] = [];
  for (const e of state.store.all()) {
    if (e.components.faction?.team !== team) continue;
    if (!e.components.economy) continue;
    if ((e.components.health?.hp ?? 1) <= 0) continue;
    out.push(e.components.economy);
  }
  return out;
}

export function teamCredits(state: SimState, team: Team): number {
  let c = 0;
  for (const b of banksOf(state, team)) c += b.credits;
  return c;
}

export function teamCells(state: SimState, team: Team): number {
  let c = 0;
  for (const b of banksOf(state, team)) c += b.cells ?? 0;
  return c;
}

/** Spend `amount` credits across the team's banks (store order). All-or-nothing. */
export function spendCredits(state: SimState, team: Team, amount: number): boolean {
  if (amount <= 0) return true;
  const banks = banksOf(state, team);
  let total = 0;
  for (const b of banks) total += b.credits;
  if (total < amount) return false;
  let left = amount;
  for (const b of banks) {
    const take = Math.min(b.credits, left);
    b.credits -= take;
    left -= take;
    if (left <= 0) break;
  }
  return true;
}

/** Spend `amount` Cells across the team's banks. All-or-nothing. */
export function spendCells(state: SimState, team: Team, amount: number): boolean {
  if (amount <= 0) return true;
  const banks = banksOf(state, team);
  let total = 0;
  for (const b of banks) total += b.cells ?? 0;
  if (total < amount) return false;
  let left = amount;
  for (const b of banks) {
    const take = Math.min(b.cells ?? 0, left);
    b.cells = (b.cells ?? 0) - take;
    left -= take;
    if (left <= 0) break;
  }
  return true;
}

/** Grant credits to the first living bank. Scripted rewards (`uncapped`) bypass the
 *  storage cap — QA found M14's HARNESS +800 silently eaten at exactly the cap. */
export function grantCredits(state: SimState, team: Team, amount: number, uncapped = false): void {
  const bank = banksOf(state, team)[0];
  if (!bank) return;
  bank.credits = uncapped
    ? bank.credits + amount
    : Math.min(bank.maxStorage || Infinity, bank.credits + amount);
}

/** Grant Cells to the first living bank (team total capped at 12). */
export function grantCells(state: SimState, team: Team, amount: number, cap = 12): void {
  const bank = banksOf(state, team)[0];
  if (!bank) return;
  const room = Math.max(0, cap - teamCells(state, team));
  bank.cells = (bank.cells ?? 0) + Math.min(amount, room);
}
