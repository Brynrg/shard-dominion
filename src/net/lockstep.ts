// ── Lockstep controller (FG-7): input-delay 1v1 over a dumb relay ───────────────
// VIEW-LAYER netcode (WebSocket + wall-clock allowed here; the sim stays pure).
//
// The classic input-delay scheme on top of our deterministic core:
//   · Local intents are NOT applied immediately — they're scheduled for tick
//     T_now + DELAY, sent to the peer, and injected locally at that same tick.
//   · Every tick boundary each seat sends its (possibly empty) bundle, so the
//     peer always learns "seat X has nothing before tick T" — no speculation.
//   · The sim may only run tick T once BOTH seats' bundles for T are known
//     (renderer's canRunTick hook holds it otherwise; render keeps going).
//   · Every HASH_EVERY ticks the seats exchange stateHash — any mismatch is a
//     desync (impossible unless determinism broke) and the match halts loudly.
//
// The transport is injected so tests can run two controllers over an in-memory
// pipe with zero sockets.
import type { CommandIntent } from '../view/input.js';

export const INPUT_DELAY_TICKS = 3;   // 150ms at 20 Hz — right for LAN/tailnet
export const HASH_EVERY = 40;         // 2s between hash checks

export interface Transport {
  send(msg: string): void;
  onMessage(cb: (msg: string) => void): void;
}

type Wire =
  | { type: 'cmd'; tick: number; seat: number; intents: CommandIntent[] }
  | { type: 'hash'; tick: number; seat: number; hash: number }
  | { type: 'peer-left' };

export interface Lockstep {
  /** My seat: 0 = 'player' team, 1 = 'enemy' team. */
  readonly seat: number;
  readonly team: 'player' | 'enemy';
  /** Queue a locally-issued intent (tagged + scheduled + broadcast). */
  submit(intent: CommandIntent, currentTick: number): void;
  /** May the sim run `tick` yet? (Both bundles known.) */
  canRun(tick: number): boolean;
  /** Drain every intent scheduled for `tick` (call right before running it). */
  takeDue(tick: number): CommandIntent[];
  /** Call right AFTER running a tick: flushes my (possibly empty) bundle for
   *  tick+DELAY and my hash when due. */
  afterTick(tick: number, hash: number): void;
  /** Desync/peer status for the UI. */
  status(): { desynced: boolean; peerLeft: boolean };
}

export function makeLockstep(seat: number, transport: Transport): Lockstep {
  const team: 'player' | 'enemy' = seat === 0 ? 'player' : 'enemy';
  const otherSeat = 1 - seat;

  // tick → per-seat bundles. A tick is runnable when BOTH seats are present.
  const bundles = new Map<number, Map<number, CommandIntent[]>>();
  const localPending = new Map<number, CommandIntent[]>(); // scheduled, not yet flushed
  const myHashes = new Map<number, number>();
  const peerHashes = new Map<number, number>();
  let desynced = false;
  let peerLeft = false;
  let flushedThrough = -1; // highest tick whose local bundle has been sent

  function bundleFor(tick: number, s: number): CommandIntent[] {
    let byTick = bundles.get(tick);
    if (!byTick) { byTick = new Map(); bundles.set(tick, byTick); }
    let b = byTick.get(s);
    if (!b) { b = []; byTick.set(s, b); }
    return b;
  }

  transport.onMessage((raw) => {
    let msg: Wire;
    try { msg = JSON.parse(raw) as Wire; } catch { return; }
    if (msg.type === 'cmd') {
      bundleFor(msg.tick, msg.seat).push(...msg.intents);
      // Mark the seat present for that tick even when the bundle is empty.
      if (msg.intents.length === 0) bundleFor(msg.tick, msg.seat);
    } else if (msg.type === 'hash') {
      peerHashes.set(msg.tick, msg.hash);
      const mine = myHashes.get(msg.tick);
      if (mine !== undefined && mine !== msg.hash) desynced = true;
    } else if (msg.type === 'peer-left') {
      peerLeft = true;
    }
  });

  // Seed the pipeline: ticks 0..DELAY-1 have no inputs from either seat by
  // construction (both agree without a message).
  for (let t = 0; t < INPUT_DELAY_TICKS; t++) {
    bundleFor(t, 0); bundleFor(t, 1);
  }

  return {
    seat,
    team,
    submit(intent, currentTick): void {
      const at = currentTick + INPUT_DELAY_TICKS;
      const tagged = { ...intent, team };
      const p = localPending.get(at) ?? [];
      p.push(tagged);
      localPending.set(at, p);
    },
    canRun(tick): boolean {
      if (desynced) return false; // halt loudly rather than diverge
      const byTick = bundles.get(tick);
      return !!byTick && byTick.has(seat) && byTick.has(otherSeat);
    },
    takeDue(tick): CommandIntent[] {
      const byTick = bundles.get(tick);
      if (!byTick) return [];
      // Deterministic apply order: seat 0's intents, then seat 1's.
      const out = [...(byTick.get(0) ?? []), ...(byTick.get(1) ?? [])];
      bundles.delete(tick);
      return out;
    },
    afterTick(tick, hash): void {
      // Flush my bundle for tick+DELAY exactly once (empty counts — it's the
      // "nothing from me" guarantee the peer is waiting on).
      const flushAt = tick + INPUT_DELAY_TICKS;
      if (flushAt > flushedThrough) {
        flushedThrough = flushAt;
        const intents = localPending.get(flushAt) ?? [];
        localPending.delete(flushAt);
        bundleFor(flushAt, seat).push(...intents);
        transport.send(JSON.stringify({ type: 'cmd', tick: flushAt, seat, intents } satisfies Wire));
      }
      if (tick % HASH_EVERY === 0) {
        myHashes.set(tick, hash);
        const theirs = peerHashes.get(tick);
        if (theirs !== undefined && theirs !== hash) desynced = true;
        transport.send(JSON.stringify({ type: 'hash', tick, seat, hash } satisfies Wire));
      }
    },
    status: () => ({ desynced, peerLeft }),
  };
}
