// ── AI: goal-driven FSM behind fog, with a real build order (Phase A3 + B) ─────
// Runs after production per SYSTEM_ORDER. Sim-pure & deterministic: no DOM, no Date,
// no Math.random. Time comes from state.tick; variety derives from tick/entity-id.
//
// WHAT CHANGED FROM THE ORIGINAL (see docs/GAMEPLAY_OVERHAUL_PLAN.md):
//  · B1 — `Stabilize` used to fire on ANY hostile combat unit within 8 tiles, with no
//    hysteresis and no cost/benefit test. Parking one ◈100 infantry near the AI base
//    cut its time-spent-attacking from 91% to 2% and pinned its whole army at home
//    for the match. Defence is now gated on believed THREAT VALUE vs own army value,
//    needs sustained contact over several evaluations, holds for a dwell period, and
//    answers small threats with a proportionate detachment instead of the whole army.
//  · B2 — the old ladder ("if credits ≥ 2500 build a War Factory") never fired,
//    because the AI re-queued a unit every evaluation and was permanently broke. It
//    built ZERO structures in a 15-minute match. It now follows an ordered build plan
//    and RESERVES credits for the next structure.
//  · B3 — the AI used to materialise structures instantly via store.create() while the
//    player paid upfront + waited the sidebar clock + placed + unfolded, one at a time.
//    It now goes through the same `state.structureBuild` job and the same construction
//    site, so its economy matches the player's and its half-built structures are
//    targetable.
//  · B4 — all enemy information now comes from `AiKnowledge` (fog-limited, with
//    memory). The AI can no longer see your composition or your harvester through fog.
//  · B5 — composition is chosen by ARMOUR CLASS (the old code compared the faction id
//    to 'vehicle', which matched one legacy unit, so tanks read as infantry), and the
//    AI now fields static defence, artillery, air, research, and retreats damaged units.
import type { SimState } from '../state.js';
import { structureComponents } from '../factory.js';
import { teamCredits, spendCredits, teamCells, spendCells } from '../ledger.js';
import { teamLedger } from './research.js';
import { refuseStructure, hasStructure, producerFor } from '../buildRules.js';
import { makeAiKnowledge, type AiKnowledge } from './aiKnowledge.js';
import { personalityFor, type AiPersonality } from '../aiPersonality.js';
import { validatePlacement } from './command.js';
import type { Refinement } from '../../loaders/refinements.js';
import type { StructureDef } from '../../loaders/structures.js';
import { teamTier } from '../tech.js';
import type { UnitDef } from '../../loaders/units.js';
import type { Entity } from '../components.js';
import { tileToWorldCenter, worldToTile, TILE_SUBUNITS, type TilePos } from '../coords.js';
import { SIM_TICK_RATE } from '../loop.js';
import type { EntityId } from '../ids.js';
import type { WorldPos } from '../coords.js';

export type AiState = 'Stabilize' | 'Recover' | 'Raid' | 'Assault' | 'Pressure' | 'Develop' | 'Expand';

export interface AiConfig {
  team: 'player' | 'enemy'; // 'player' is used by the AI-vs-AI balance harness
  attackTile: TilePos;      // the enemy base this AI assaults
  /** Difficulty name — selects the behaviour profile (aiPersonality.ts). */
  difficulty?: 'easy' | 'normal' | 'hard' | string | null;
  /** Direct personality override (tests + the balance harness). */
  personality?: AiPersonality;
  /** This AI's faction id, for faction-locked structures/units. */
  factionId?: string;
  // ── Legacy numeric overrides (kept so existing call sites keep working) ──────
  evalInterval?: number;
  assaultValue?: number;
  assaultEscalationPerMin?: number;
  pressureValue?: number;
  raidUnitCap?: number;
  graceTicks?: number;
  defendRadiusTiles?: number;
}

export interface AiSystem {
  readonly name: 'ai';
  run(state: SimState): void;
  debugState: () => AiState;
  /** Diagnostics for the probe harnesses (what it built, what it believes). */
  debugInfo: () => {
    plan: AiState; built: string[]; nextWanted: string | null;
    contacts: number; believedThreatAtBase: number; expansions: number;
    armyValue: number; armyCount: number; harvesters: number; defending: boolean;
  };
}

const dist = (a: WorldPos, b: WorldPos): number => Math.hypot(a.wx - b.wx, a.wy - b.wy);

const EXPAND_COST = 1200;   // the same refinery price the player pays
const EXPAND_RESERVE = 300; // production float kept after expanding
/** Below this believed threat value, nothing at home is an emergency (anti-decoy). */
const MIN_DEFEND_THREAT = 250;
/** A threat must reach this fraction of our army to take over the whole plan. */
const EMERGENCY_RATIO = 0.6;
/** How long "my buildings are being hit" stays latched after the last damage tick. */
const BASE_ATTACK_DWELL = 20 * 12;

export function makeAiSystem(
  units: readonly UnitDef[],
  cfg: AiConfig,
  structures: readonly StructureDef[] = [],
  refinements: readonly Refinement[] = [],
): AiSystem {
  const team = cfg.team;
  const P: AiPersonality = cfg.personality ?? personalityFor(cfg.difficulty);

  // Legacy numeric overrides win over the personality when explicitly supplied.
  const evalInterval = cfg.evalInterval ?? P.evalInterval;
  const assaultValue = cfg.assaultValue ?? P.assaultValue;
  const escalationPerMin = cfg.assaultEscalationPerMin ?? P.assaultEscalationPerMin;
  const pressureValue = cfg.pressureValue ?? P.pressureValue;
  const graceTicks = cfg.graceTicks ?? P.graceTicks;
  const raidUnitCap = cfg.raidUnitCap ?? 2;
  const defendRadius = cfg.defendRadiusTiles ?? 8;

  const knowledge: AiKnowledge = makeAiKnowledge(team, units);
  const committed = new Set<EntityId>();
  const structuresBuilt: string[] = [];
  let lastArmyCount = 0;
  let plan: AiState = 'Develop';
  let finisher = false;
  let defendConfirm = 0;        // consecutive evals of a real threat at home
  let defendUntilTick = -1;     // dwell: stay defensive until this tick
  let lastAssaultTick = -Infinity;
  let expansions = 0;
  let believedThreat = 0;
  let nextWanted: string | null = null;
  let dbgArmyValue = 0, dbgArmyCount = 0, dbgHarvesters = 0, dbgDefending = false;
  let lastOwnBuildingHp = -1;   // total HP of own buildings at the previous evaluation
  let baseAttackedUntil = -1;   // ticks during which "base under attack" stays latched

  const costOf = (id: string): number => units.find(u => u.id === id)?.cost ?? 0;
  const defOf = (id: string): StructureDef | undefined => structures.find(s => s.id === id);

  /** Queue a unit at the structure that `producedBy` names — never anywhere else. */
  function queueUnit(state: SimState, unitId: string): boolean {
    const def = units.find(u => u.id === unitId);
    if (!def) return false;
    const producer = producerFor(state, team, def);
    if (!producer) return false;
    for (const e of state.store.all()) {
      if (e.id !== (producer.id as unknown as EntityId)) continue;
      const prod = e.components.production;
      if (!prod || prod.queue.length > 0) return false;
      e.components.production = { ...prod, queue: [unitId] };
      return true;
    }
    return false;
  }

  /** A deterministic valid build tile near the base, spiralling outward. */
  function findBuildTile(state: SimState, def: StructureDef, anchor: TilePos): TilePos | null {
    for (let ring = 2; ring <= 8; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue; // ring perimeter only
          const t = { tx: anchor.tx + dx, ty: anchor.ty + dy };
          if ((state.shardDensity.get(`${t.tx},${t.ty}`) ?? 0) > 0) continue; // never build on Shard
          if (validatePlacement(state, def, t, team).valid) return t;
        }
      }
    }
    return null;
  }

  /** The next structure in the plan this AI does not yet have. */
  function wantedStructure(state: SimState): string | null {
    const counts = new Map<string, number>();
    for (const e of state.store.all()) {
      const f = e.components.faction;
      if (f?.team !== team || !e.components.building) continue;
      if ((e.components.health?.hp ?? 1) <= 0) continue;
      counts.set(f.faction, (counts.get(f.faction) ?? 0) + 1);
    }
    const wantCounts = new Map<string, number>();
    for (const id of P.buildOrder) {
      wantCounts.set(id, (wantCounts.get(id) ?? 0) + 1);
      if (!P.buildStaticDefence && (id === 'defense_turret' || id === 'aa_turret')) continue;
      if (!P.useAir && id === 'skypad') continue;
      if ((counts.get(id) ?? 0) < wantCounts.get(id)!) return id;
    }
    return null;
  }

  return {
    name: 'ai' as const,
    debugState: () => plan,
    debugInfo: () => ({
      plan, built: [...structuresBuilt], nextWanted,
      contacts: knowledge.contacts.size, believedThreatAtBase: believedThreat, expansions,
      armyValue: dbgArmyValue, armyCount: dbgArmyCount, harvesters: dbgHarvesters,
      defending: dbgDefending,
    }),
    run(state: SimState): void {
      if (state.tick % evalInterval !== 0) return;

      knowledge.update(state);

      // ── Read our OWN board (you always know your own things) ──────────────────
      const all = state.store.all();
      const credits = teamCredits(state, team);
      const barracks = all.find(e => e.components.faction?.team === team && e.components.faction?.faction === 'barracks' && e.components.production) ?? null;
      const refinery = all.find(e => e.components.faction?.team === team && e.components.faction?.faction === 'refinery' && e.components.production) ?? null;
      const ownHarvesters = all.filter(e => e.components.faction?.team === team && e.components.harvest && (e.components.health?.hp ?? 0) > 0);
      const army = all.filter(e => e.components.faction?.team === team && e.components.combat && (e.components.health?.hp ?? 0) > 0 && e.components.movement && !e.components.building);
      const armyValue = army.reduce((s, u) => s + costOf(u.components.faction?.faction ?? ''), 0);

      // Base position = the CENTROID of own buildings, not "the refinery". The
      // refinery is usually the first thing an attacker kills, and anchoring the
      // defence radius to it meant the AI stopped noticing an assault the moment it
      // mattered most.
      let bx = 0, by = 0, bn = 0, ownBuildingHp = 0;
      for (const e of all) {
        if (e.components.faction?.team !== team || !e.components.building) continue;
        if ((e.components.health?.hp ?? 0) <= 0) continue;
        const p = e.components.position;
        if (p) { bx += p.wx; by += p.wy; bn += 1; }
        ownBuildingHp += e.components.health?.hp ?? 0;
      }
      const basePos: WorldPos = bn > 0
        ? { wx: bx / bn, wy: by / bn }
        : refinery?.components.position ?? tileToWorldCenter(cfg.attackTile);
      const baseTile = worldToTile(basePos);

      // ── "My base is under attack" — the one signal that needs no vision and no
      //    geometry: own buildings are LOSING HP. The diagnostic run showed the AI
      //    happily in `Pressure` while its refinery and Construction Yard were being
      //    demolished, because the threat test depended on seeing the attackers near
      //    a base anchor that had already died.
      const buildingHpDropped = lastOwnBuildingHp >= 0 && ownBuildingHp < lastOwnBuildingHp - 0.5;
      if (buildingHpDropped) baseAttackedUntil = state.tick + BASE_ATTACK_DWELL;
      lastOwnBuildingHp = ownBuildingHp;
      const baseUnderAttack = state.tick < baseAttackedUntil;

      for (const id of committed) if (!army.some(u => u.id === id)) committed.delete(id);

      // ── B1: the defence decision, with a threat test AND hysteresis ───────────
      believedThreat = knowledge.threatNear(basePos, defendRadius);
      // Two gates, both required:
      //  (a) an ABSOLUTE floor — a lone cheap unit is never an emergency, however
      //      poor we are. This is what kills the ◈100 decoy pin: with the floor at
      //      MIN_DEFEND_THREAT a single rifleman can never flip the plan, no matter
      //      how many times our army dies and resets armyValue to zero.
      //  (b) a RELATIVE test — the threat has to be big next to what we already field.
      const defenceWorthIt =
        believedThreat >= MIN_DEFEND_THREAT &&
        believedThreat >= P.defendThreatRatio * armyValue;
      if (defenceWorthIt) defendConfirm += 1; else defendConfirm = 0;
      if (defendConfirm >= P.defendConfirmEvals) defendUntilTick = state.tick + P.defendDwellTicks;
      // Only a threat that genuinely rivals our army takes over the whole PLAN.
      // Anything smaller is answered by the home-guard detachment below while the
      // offensive continues — which is how a human plays it.
      //
      // Buildings taking damage is an emergency ONLY if we also believe a hostile
      // force is there. Without that conjunct the living planet's neutral Riftmaw
      // creeps — which chew on buildings all match and are never a `contact` — latch
      // "under attack" permanently, and the diagnostic showed the AI sitting on a
      // ◈3250 army in `Stabilize` from 8:00 to the end of the match, never attacking
      // and never rebuilding its destroyed refinery.
      const defending =
        (baseUnderAttack && believedThreat >= MIN_DEFEND_THREAT * 0.4) ||
        (state.tick < defendUntilTick &&
         believedThreat >= EMERGENCY_RATIO * Math.max(armyValue, MIN_DEFEND_THREAT));

      // ── Choose the plan ──────────────────────────────────────────────────────
      dbgArmyValue = armyValue; dbgArmyCount = army.length;
      dbgHarvesters = ownHarvesters.length; dbgDefending = defending;
      const minutes = state.tick / (60 * SIM_TICK_RATE);
      const assaultThreshold = Math.max(200, assaultValue - escalationPerMin * minutes);
      // "Gutted" must mean an army we HAD just collapsed — not merely that we have
      // none. Without the `lastArmyCount > 0` guard, an AI that has not yet built its
      // first soldier scores as gutted forever and sits in `Recover`, which silently
      // suppressed every plan-driven action (expansion above all).
      const gutted = lastArmyCount > 0 && army.length <= Math.max(1, Math.floor(lastArmyCount * 0.4));
      const inLull = state.tick - lastAssaultTick < P.waveLullTicks;

      // A harvester counts as raidable only if the AI can SEE it and it looks unescorted.
      const harvContacts = [...knowledge.contacts.values()].filter(c => c.isHarvester && c.visibleNow);
      const raidTarget = P.raidHarvesters
        ? harvContacts.find(h => knowledge.threatNear(h.pos, 5) < 200) ?? null
        : null;

      if (ownHarvesters.length === 0) plan = 'Stabilize';
      else if (defending) plan = 'Stabilize';
      else if (gutted && army.length < 3) plan = 'Recover';
      else if (armyValue >= assaultThreshold && !inLull) plan = 'Assault';
      else if (raidTarget && army.length > 2) plan = 'Raid';
      else if (armyValue >= pressureValue && !inLull) plan = 'Pressure';
      else if (expansions < P.maxExpansions && credits >= EXPAND_COST + EXPAND_RESERVE
               && findExpansionTile(state, team) !== null) plan = 'Expand';
      else plan = 'Develop';

      // FINISHER: a foe with no visible producers left and a broken economy gets
      // finished, not besieged. Sudden death still applies so two turtles can't stall.
      finisher = false;
      {
        const knownProds = knowledge.knownProducers();
        const foeLooksDead = knownProds.length > 0 && knownProds.every(p => {
          const still = state.store.get(p.id);
          return !still || (still.components.health?.hp ?? 0) <= 0;
        });
        // OVERWHELMING FORCE: once we massively out-mass what we believe the foe has
        // and we know where their base is, commit everything. Without this the AI
        // attacks in polite waves forever and matches hit the clock — the difficulty
        // harness measured 2 of 5 games against EASY ending in a 25-minute draw
        // because neither side could ever finish the other.
        let foeArmy = 0;
        for (const c of knowledge.contacts.values()) {
          if (c.isBuilding || c.isHarvester) continue;
          foeArmy += Math.max(c.value, 50);
        }
        const overwhelming = knownProds.length > 0 && armyValue >= 800 &&
          armyValue >= 2.5 * Math.max(foeArmy, 200);
        const suddenDeath = state.tick >= 24000 && armyValue > 0;
        if ((foeLooksDead && armyValue >= 400) || overwhelming || suddenDeath) {
          plan = 'Assault'; finisher = true;
        }
      }

      // Learning grace: before graceTicks the AI develops but does not attack.
      if (state.tick < graceTicks && (plan === 'Assault' || plan === 'Raid' || plan === 'Pressure')) {
        plan = 'Develop';
      }

      // ── B2/B3: the build plan. Reserve credits for the next structure so the AI
      //    stops spending its whole bank on infantry and never teching. ──────────
      // ── ECONOMY FIRST, always. Replacing a dead harvester is never blocked by a
      //    build reservation: reserving 1000 for a tier upgrade while sitting on 857
      //    credits and zero harvesters is an unrecoverable deadlock (no harvester →
      //    no income → never reaches the reserve → never rebuilds the harvester).
      //    The probe caught exactly that: the AI ended a 15-minute match with 0
      //    harvesters, 2 units and an empty build list.
      // Losing the last refinery kills the economy outright: no dock, no harvester
      // producer, no income, ever. Rebuilding it outranks EVERYTHING, including an
      // ongoing attack — the diagnostic caught an AI that lost its refinery at 8:00
      // and then farmed a dead economy for the rest of the match.
      const hasRefinery = hasStructure(state, team, 'refinery');
      const harvesterEmergency = hasRefinery && ownHarvesters.length === 0;
      if (refinery?.components.production && refinery.components.production.queue.length === 0) {
        const want = harvesterEmergency ? 1 : P.targetHarvesters;
        if (ownHarvesters.length < want && credits >= costOf('harvester')) {
          refinery.components.production = { ...refinery.components.production, queue: ['harvester'] };
        }
      }

      // Otherwise: don't start (or save for) the next TECH structure while the base is
      // being demolished — that money belongs in units right now. The diagnostic showed
      // the AI founding a War Factory at 4:00 while its refinery was being destroyed.
      nextWanted = !hasRefinery ? 'refinery'
        : (harvesterEmergency || baseUnderAttack) ? null
          : wantedStructure(state);
      const wantDef = nextWanted ? defOf(nextWanted) : undefined;
      let reserved = 0;
      const job = state.structureBuild.get(team);
      // The HQ tier ladder gates every T2+ structure. Without this the build order
      // stalls forever on the first tier-2 entry (the AI reached NOTHING past its
      // seeded barracks in a 15-minute match).
      const tier = teamTier(state, team);
      if (wantDef && (wantDef.tier ?? 1) > tier) {
        const yard = all.find(e =>
          e.components.faction?.team === team && e.components.faction.faction === 'construction_yard' &&
          e.components.tech && e.components.tech.upgradingTo == null &&
          (e.components.health?.hp ?? 0) > 0);
        const techC = yard?.components.tech;
        const yardDef = defOf('construction_yard');
        const step = yardDef?.tierUpgrades?.find(u => u.toTier === (techC?.tier ?? 1) + 1);
        if (techC && step) {
          if (credits >= step.cost && teamCells(state, team) >= (step.cells ?? 0)) {
            spendCredits(state, team, step.cost);
            if (step.cells) spendCells(state, team, step.cells);
            yard!.components.tech = {
              tier: techC.tier, upgradingTo: step.toTier,
              ticksLeft: Math.max(1, Math.round(step.seconds * SIM_TICK_RATE)),
            };
          } else {
            reserved = step.cost; // save for the tier, don't buy another rifleman
          }
        }
      } else if (!job && wantDef) {
        const refusal = refuseStructure(state, team, wantDef, cfg.factionId);
        if (refusal === null) {
          // Start the job through the SAME mechanism the player's sidebar uses:
          // paid upfront, construction.ts sweeps the clock, one structure at a time.
          spendCredits(state, team, wantDef.cost ?? 0);
          if (wantDef.cellCost) spendCells(state, team, wantDef.cellCost);
          const totalTicks = Math.max(1, Math.round((wantDef.buildTimeSeconds ?? 10) * SIM_TICK_RATE));
          state.structureBuild.set(team, { structureId: wantDef.id, ticksLeft: totalTicks, totalTicks });
        } else if (refusal === 'funds') {
          reserved = wantDef.cost ?? 0; // save up instead of buying another rifleman
        }
      } else if (job && job.ticksLeft <= 0) {
        // READY → place it on the field as a construction SITE (buildProgress 0).
        const readyDef = defOf(job.structureId);
        if (readyDef) {
          const anchor = readyDef.id === 'defense_turret' || readyDef.id === 'aa_turret'
            ? approachTile(baseTile, cfg.attackTile) // defences face the threat
            : baseTile;
          const t = findBuildTile(state, readyDef, anchor);
          if (t) {
            const comps = structureComponents(readyDef.id, team, structures as StructureDef[], { buildProgress: 0 });
            if (comps.building) (comps.building as { unfoldFast?: boolean }).unfoldFast = true;
            state.store.create({ position: tileToWorldCenter(t), ...comps });
            structuresBuilt.push(readyDef.id);
            state.structureBuild.delete(team);
          }
        } else {
          state.structureBuild.delete(team);
        }
      }
      // Never save for tech while too weak to survive: an AI sitting on a reservation
      // with a 7-unit army and no production is one push from dead. Units first until
      // we can at least harass, then the reservation applies.
      if (armyValue < pressureValue * 0.5) reserved = 0;
      const spendable = Math.max(0, credits - reserved);

      // ── B5: composition by ARMOUR CLASS, from the right producer ──────────────
      // The army cap is the difficulty lever that actually makes Easy easy: an Easy
      // opponent fielding 41 units by 5:00 is not an Easy opponent.
      const comp = knowledge.composition();
      const underCap = army.length < P.armyCap;
      if (underCap && barracks?.components.production && barracks.components.production.queue.length === 0) {
        const pick = chooseInfantry(state.tick, evalInterval, comp);
        if (spendable >= costOf(pick)) queueUnit(state, pick);
      }
      if (underCap && hasStructure(state, team, 'war_factory')) {
        const pick = chooseVehicle(state.tick, evalInterval, comp, P.useArtillery, teamTier(state, team));
        if (spendable >= costOf(pick) + 150) queueUnit(state, pick);
      }
      if (underCap && P.useAir && hasStructure(state, team, 'skypad')) {
        const pick = comp.air > 0 ? 'defense_drone' : 'gunship';
        if (spendable >= costOf(pick) + 200) queueUnit(state, pick);
      }

      // Reactive AA: the moment the AI BELIEVES the foe has air, want an AA turret.
      if (P.buildStaticDefence && comp.air > 0 && !hasStructure(state, team, 'aa_turret')
          && !state.structureBuild.get(team)) {
        const aa = defOf('aa_turret');
        if (aa && refuseStructure(state, team, aa, cfg.factionId) === null) {
          spendCredits(state, team, aa.cost ?? 0);
          const tt = Math.max(1, Math.round((aa.buildTimeSeconds ?? 14) * SIM_TICK_RATE));
          state.structureBuild.set(team, { structureId: 'aa_turret', ticksLeft: tt, totalTicks: tt });
        }
      }

      // ── Research (personality-gated) — now through the SAME rules the player
      //    obeys: prerequisites, tier, Tech Lab, faction lock. The old code wrote
      //    straight into the ledger and skipped every one of those checks. ────────
      if (P.research && refinements.length > 0 && hasStructure(state, team, 'processing_plant')) {
        const led = teamLedger(state, team);
        if (!led.researching) {
          const tier2Ready = hasStructure(state, team, 'war_factory') && hasStructure(state, team, 'tech_lab');
          const next = refinements.find(r =>
            !led.done.includes(r.id) &&
            (!r.tier || r.tier < 2 || tier2Ready) &&
            (!r.faction || r.faction === cfg.factionId) &&
            !(r.prerequisites ?? []).some(pr => !led.done.includes(pr)) &&
            spendable >= r.cost + 600 && teamCells(state, team) >= (r.cells ?? 0));
          if (next) {
            spendCredits(state, team, next.cost);
            if (next.cells) spendCells(state, team, next.cells);
            led.researching = next.id;
            led.ticksLeft = Math.max(1, Math.round(next.timeSeconds * SIM_TICK_RATE));
          }
        }
      }

      // ── B5: retreat badly damaged units toward home so they survive to fight ──
      if (P.retreatDamaged) {
        for (const u of army) {
          const h = u.components.health;
          const mv = u.components.movement;
          if (!h || !mv || h.maxHp <= 0) continue;
          if (h.hp / h.maxHp > 0.3) continue;
          if (dist(u.components.position!, basePos) < 4 * TILE_SUBUNITS) continue;
          mv.target = basePos;
          mv.attackMove = false;
          committed.delete(u.id);
        }
      }

      // ── Act on the plan ──────────────────────────────────────────────────────
      const healthy = (u: Entity): boolean => {
        const h = u.components.health;
        return !P.retreatDamaged || !h || h.maxHp <= 0 || h.hp / h.maxHp > 0.3;
      };
      const idleFresh = army.filter(u =>
        healthy(u) && !committed.has(u.id) &&
        u.components.movement?.target == null &&
        (u.components.combat?.targetId ?? null) === null);

      // ── HOME GUARD (B1): a threat too small to be an emergency still gets a
      //    proportionate answer — a couple of units peeled off, not the army. This
      //    is what lets the AI keep attacking while a decoy loiters at its base.
      if (!defending && believedThreat > 0 && army.length > 2) {
        const wantGuards = Math.min(
          Math.max(1, Math.ceil(believedThreat / 200)),
          Math.floor(army.length / 3),
        );
        const alreadyHome = army.filter(u =>
          u.components.position && dist(u.components.position, basePos) <= defendRadius * TILE_SUBUNITS).length;
        let assigned = alreadyHome;
        for (const u of idleFresh) {
          if (assigned >= wantGuards) break;
          if (!u.components.movement) continue;
          u.components.movement.target = basePos;
          u.components.movement.attackMove = true;
          committed.add(u.id);
          assigned += 1;
        }
      }

      switch (plan) {
        case 'Stabilize':
        case 'Recover': {
          // PROPORTIONATE response (B1): recall only as much as the threat warrants,
          // never the whole army for a scout. Attack-movers stay committed.
          const need = Math.max(1, Math.ceil(army.length * P.defendCommitFraction));
          const budget = believedThreat > 0
            ? Math.min(need, Math.max(1, Math.ceil(army.length * Math.min(1, believedThreat / Math.max(250, armyValue)))))
            : need;
          let recalled = 0;
          for (const u of army) {
            if (recalled >= budget) break;
            if (u.components.movement?.attackMove) continue;
            if ((u.components.combat?.targetId ?? null) !== null) continue;
            if (!u.components.movement) continue;
            u.components.movement.target = basePos;
            committed.delete(u.id);
            recalled += 1;
          }
          break;
        }
        case 'Raid': {
          if (raidTarget) {
            for (const u of idleFresh.slice(0, raidUnitCap)) {
              if (u.components.movement) { u.components.movement.target = { ...raidTarget.pos }; committed.add(u.id); }
            }
          }
          break;
        }
        case 'Assault': {
          // Aim at a KNOWN producer when we have one (fog-honest); otherwise at the
          // configured base tile — which is what scouting is for.
          let target = tileToWorldCenter(cfg.attackTile);
          const prods = knowledge.knownProducers();
          if (prods.length > 0) {
            const live = prods.find(p => {
              const s = state.store.get(p.id);
              return s && (s.components.health?.hp ?? 0) > 0;
            });
            if (live) target = { ...live.pos };
          }
          const wave = finisher ? army.filter(healthy) : idleFresh;
          if (P.multiProng && wave.length >= 6) {
            // Two prongs from different approach angles (B5): half flanks.
            const flank = flankPoint(target, basePos);
            for (const [i, u] of wave.entries()) {
              const mv = u.components.movement;
              if (!mv) continue;
              mv.target = i % 2 === 0 ? { ...target } : flank;
              mv.attackMove = true;
              committed.add(u.id);
            }
          } else {
            for (const u of wave) {
              const mv = u.components.movement;
              if (!mv) continue;
              mv.target = { ...target };
              mv.attackMove = true;
              committed.add(u.id);
            }
          }
          if (wave.length > 0) lastAssaultTick = state.tick;
          break;
        }
        case 'Pressure': {
          const target = tileToWorldCenter(cfg.attackTile);
          for (const u of idleFresh.slice(0, Math.max(1, Math.floor(idleFresh.length / 2)))) {
            if (u.components.movement) { u.components.movement.target = target; committed.add(u.id); }
          }
          break;
        }
        case 'Expand': {
          const spot = findExpansionTile(state, team);
          if (spot && credits >= EXPAND_COST) {
            const refDef = defOf('refinery');
            if (refDef && validatePlacement(state, refDef, spot, team).valid) {
              spendCredits(state, team, EXPAND_COST);
              const comps = structureComponents('refinery', team, structures as StructureDef[], { buildProgress: 0 });
              if (comps.building) (comps.building as { unfoldFast?: boolean }).unfoldFast = true;
              state.store.create({ position: tileToWorldCenter(spot), ...comps });
              structuresBuilt.push('refinery(expand)');
              expansions += 1;
            }
          }
          break;
        }
        // Develop: bank up; the production block above does the work.
      }

      // Squad focus-fire (Phase 2): veterans lead, squaddies adopt the leader's target.
      coordinateSquadTargets(groupBySquad(army));
      lastArmyCount = army.length;
    },
  };
}

/** A tile between the base and the threat — where defences belong. */
function approachTile(base: TilePos, threat: TilePos): TilePos {
  return {
    tx: Math.round(base.tx + (threat.tx - base.tx) * 0.25),
    ty: Math.round(base.ty + (threat.ty - base.ty) * 0.25),
  };
}

/** A flanking waypoint: perpendicular offset from the base→target line. */
function flankPoint(target: WorldPos, from: WorldPos): WorldPos {
  const dx = target.wx - from.wx, dy = target.wy - from.wy;
  const len = Math.max(1, Math.hypot(dx, dy));
  const off = 6 * TILE_SUBUNITS;
  return { wx: target.wx + (-dy / len) * off, wy: target.wy + (dx / len) * off };
}

/** The richest field ≥6 tiles from every refinery this team owns, with a build spot.
 *  The spot must also be inside an own Construction Yard's build radius — the AI is
 *  held to exactly the same placement rule as the player (Phase B3 fairness), so
 *  proposing a site it can never legally build would just stall the Expand plan. */
function findExpansionTile(state: SimState, team: string): TilePos | null {
  const refineries: WorldPos[] = [];
  const yards: TilePos[] = [];
  for (const e of state.store.all()) {
    const f = e.components.faction;
    if (f?.team !== team || !e.components.position) continue;
    if (f.faction === 'refinery') refineries.push(e.components.position);
    if (f.faction === 'construction_yard' && (e.components.health?.hp ?? 1) > 0) {
      yards.push(worldToTile(e.components.position));
    }
  }
  const inBuildRadius = (t: TilePos): boolean =>
    yards.some(y => Math.abs(y.tx - t.tx) + Math.abs(y.ty - t.ty) <= 10);
  const keys = [...state.shardDensity.keys()].sort();
  let best: { t: TilePos; density: number } | null = null;
  for (const k of keys) {
    const density = state.shardDensity.get(k) ?? 0;
    if (density < 500) continue;
    const [txs, tys] = k.split(',');
    const t = { tx: Number(txs), ty: Number(tys) };
    const w = tileToWorldCenter(t);
    if (refineries.some(r => Math.hypot(r.wx - w.wx, r.wy - w.wy) < 6 * TILE_SUBUNITS)) continue;
    if (best === null || density > best.density) {
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
        const spot = { tx: t.tx + dx, ty: t.ty + dy };
        if (!state.grid.isWalkable(spot)) continue;
        if ((state.shardDensity.get(`${spot.tx},${spot.ty}`) ?? 0) > 0) continue;
        if (!inBuildRadius(spot)) continue; // same rule the player obeys
        best = { t: spot, density };
        break;
      }
    }
  }
  return best?.t ?? null;
}

/** Infantry pick, countering the BELIEVED composition by armour class. */
function chooseInfantry(tick: number, evalInterval: number, comp: { light: number; armored: number; air: number }): string {
  const i = Math.floor(tick / evalInterval);
  if (comp.air > 0 && i % 3 === 0) return 'rocket_trooper';   // rockets hit air
  if (comp.armored > comp.light) return 'rocket_trooper';      // rockets shred armour
  if (i % 4 === 3) return 'rocket_trooper';                    // anti-armour insurance
  return 'infantry';
}

/** Vehicle pick from the War Factory, by believed composition + available tier. */
function chooseVehicle(
  tick: number, evalInterval: number,
  comp: { light: number; armored: number; air: number },
  useArtillery: boolean, tier: number,
): string {
  const i = Math.floor(tick / evalInterval);
  if (useArtillery && i % 5 === 4) return 'longbow';           // siege pressure
  if (tier >= 3 && i % 7 === 6) return 'super_heavy_tank';
  if (comp.armored > 0) return i % 2 === 0 ? 'assault_tank' : 'medium_tank';
  if (comp.light > comp.armored) return 'scout_vehicle';       // scout guns beat massed rifles
  return 'medium_tank';
}

/** Group units into same-type squads by proximity. Deterministic by entity id. */
function groupBySquad(units: Entity[], squadRadius: number = TILE_SUBUNITS * 3): Entity[][] {
  const squads: Entity[][] = [];
  const used = new Set<EntityId>();
  for (const u of units) {
    if (used.has(u.id)) continue;
    const squad = [u];
    used.add(u.id);
    const faction = u.components.faction?.faction;
    const pos = u.components.position;
    if (!faction || !pos) continue;
    for (const other of units) {
      if (used.has(other.id) || other.components.faction?.faction !== faction) continue;
      const opos = other.components.position;
      if (!opos) continue;
      if (Math.hypot(pos.wx - opos.wx, pos.wy - opos.wy) <= squadRadius) { squad.push(other); used.add(other.id); }
    }
    squads.push(squad);
  }
  return squads;
}

/** The squad's most-veteran member picks the target; the rest focus-fire it. */
function coordinateSquadTargets(squads: Entity[][]): void {
  for (const squad of squads) {
    if (squad.length <= 1) continue;
    let leader = squad[0]!;
    for (const u of squad) {
      if ((u.components.experience?.rank ?? 0) > (leader.components.experience?.rank ?? 0)) leader = u;
    }
    const leaderTarget = leader.components.combat?.targetId ?? null;
    if (leaderTarget === null) continue;
    for (const u of squad) if (u !== leader && u.components.combat) u.components.combat.targetId = leaderTarget;
  }
}
