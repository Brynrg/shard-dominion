// ── Mission loader (campaign) ─────────────────────────────────────────────────
// Loads + validates a mission definition (data/missions/*.json). A mission fully
// describes a match: map, starting forces per side, Shard fields, objectives, and
// failure conditions. The default skirmish is itself a mission file.
//
// The objective/failure shapes here mirror src/sim/systems/objectives.ts (kept in
// sync by the `satisfies` assertions at the bottom). Fields marked RESERVED are
// accepted but unused until later campaign phases (triggers/tags/rewards) so the
// on-disk format doesn't churn once mission authoring begins.
import { z } from 'zod';
import type { Objective, Failure } from '../sim/systems/objectives.js';

const Team = z.enum(['player', 'enemy']);
const Region = z.object({ tx: z.number(), ty: z.number(), r: z.number().positive() });

// ── Objectives / failures (discriminated on `type`) ──────────────────────────
const ObjectiveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('destroy'), id: z.string().optional(), team: Team, kind: z.string().optional(), primary: z.boolean().optional(), text: z.string(), onlyIfChoice: z.string().optional() }),
  z.object({ type: z.literal('eliminate'), id: z.string().optional(), team: Team, primary: z.boolean().optional(), text: z.string(), onlyIfChoice: z.string().optional() }),
  z.object({ type: z.literal('survive'), id: z.string().optional(), seconds: z.number().positive(), primary: z.boolean().optional(), text: z.string(), onlyIfChoice: z.string().optional() }),
  z.object({ type: z.literal('hold'), id: z.string().optional(), team: Team, region: Region, seconds: z.number().positive(), primary: z.boolean().optional(), text: z.string(), onlyIfChoice: z.string().optional() }),
  z.object({ type: z.literal('accumulate'), id: z.string().optional(), team: Team, credits: z.number().nonnegative(), primary: z.boolean().optional(), text: z.string(), onlyIfChoice: z.string().optional() }),
  z.object({ type: z.literal('build'), id: z.string().optional(), team: Team, kind: z.string(), primary: z.boolean().optional(), text: z.string(), onlyIfChoice: z.string().optional() }),
  z.object({ type: z.literal('reach'), id: z.string().optional(), team: Team, region: Region, primary: z.boolean().optional(), text: z.string(), onlyIfChoice: z.string().optional() }),
]);
const FailureSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('defend'), team: Team, kind: z.string().optional() }),
  z.object({ type: z.literal('defeated'), team: Team }),
]);

// ── Placed entities + fields ─────────────────────────────────────────────────
// `type` = the unit/structure KIND (matches data/{units,structures}.json ids).
const Placed = z.object({
  type: z.string().min(1),
  tx: z.number().int(),
  ty: z.number().int(),
  tags: z.array(z.string()).optional(), // RESERVED (named mission targets)
});
const Field = z.object({
  tx: z.number().int(),
  ty: z.number().int(),
  w: z.number().int().positive().default(1),
  h: z.number().int().positive().default(1),
  density: z.number().positive(),
});
const Side = z.object({
  credits: z.number().nonnegative().default(0),
  buildings: z.array(Placed).default([]),
  units: z.array(Placed).default([]),
  // Faction identity (FG-6): stat modifiers + palette. Defaults to 'concord'.
  factionId: z.enum(['concord', 'emberhand', 'shardborn']).optional(),
  // Starting HQ tech tier (XP-1). Missions that assume T2 content (e.g. M5's War
  // Factory objective) start higher instead of re-tuning for the upgrade cost.
  techTier: z.number().int().min(1).max(3).optional(),
});
// AI tunables per enemy side (all optional — see ai.ts AiConfig). attackTile defaults
// to the player start at seed time when omitted.
const AiConfig = z.object({
  attackTile: z.object({ tx: z.number().int(), ty: z.number().int() }).optional(),
  evalInterval: z.number().positive().optional(),
  assaultValue: z.number().positive().optional(),
  assaultEscalationPerMin: z.number().nonnegative().optional(),
  pressureValue: z.number().positive().optional(),
  raidUnitCap: z.number().int().positive().optional(),
  graceTicks: z.number().int().nonnegative().optional(),
  defendRadiusTiles: z.number().positive().optional(),
}).optional();
const Enemy = Side.extend({
  team: z.literal('enemy').default('enemy'),
  ai: AiConfig,
  fields: z.array(Field).default([]),
});

export const MissionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  map: z.object({ width: z.number().int().positive(), height: z.number().int().positive(), seed: z.number().int() }),
  briefing: z.object({
    title: z.string(),
    story: z.array(z.string()).default([]),
    objectives: z.array(z.string()).default([]),
  }),
  debrief: z.object({ win: z.array(z.string()).default([]), lose: z.array(z.string()).default([]) }).default({ win: [], lose: [] }),
  // Ambient Shard density applied to every SHARD terrain tile (the procedural background
  // field). Explicit `fields` clusters stack on top. Omit for missions with only authored fields.
  naturalShardDensity: z.number().nonnegative().optional(),
  fields: z.array(Field).default([]),
  player: Side,
  enemies: z.array(Enemy).default([]),
  // Neutral map features (FG-5): capturable derricks etc. Buildings only.
  neutrals: z.array(Placed).default([]),
  objectives: z.array(ObjectiveSchema).min(1),
  failure: z.array(FailureSchema).default([]),
  next: z.string().nullable().default(null),
  // XP-6: a pre-mission player CHOICE (the M14 Seal/Harness finale). The picked id
  // filters `onlyIfChoice` objectives and satisfies `when.choice` triggers.
  choice: z.object({
    prompt: z.string(),
    options: z.array(z.object({ id: z.string(), label: z.string(), blurb: z.string() })).min(2),
  }).optional(),
  // Act III: a mission with no `choice` of its own can INHERIT the campaign choice
  // (the last `choice` resolved, stored under a stable key) so its `onlyIfChoice`
  // objectives and `when.choice` triggers branch on the M14 Seal/Harness decision.
  inheritsChoice: z.boolean().optional(),
  // Mission triggers (FG-4): deterministic mid-mission events.
  triggers: z.array(z.object({
    id: z.string().min(1),
    when: z.object({
      timeSeconds: z.number().positive().optional(),
      credits: z.object({ team: Team, gte: z.number() }).optional(),
      objectiveComplete: z.string().optional(),
      choice: z.string().optional(), // XP-6: fires when the boot choice matches
    }),
    actions: z.array(z.discriminatedUnion('type', [
      z.object({ type: z.literal('message'), speaker: z.string().optional(), text: z.string() }),
      z.object({ type: z.literal('spawn'), team: z.enum(['player', 'enemy', 'neutral']), units: z.array(z.object({ type: z.string(), tx: z.number().int(), ty: z.number().int() })), attackMoveTo: z.object({ tx: z.number().int(), ty: z.number().int() }).optional() }),
      z.object({ type: z.literal('grantCredits'), team: Team, amount: z.number() }),
      z.object({ type: z.literal('reveal'), region: Region.optional() }),
    ])).min(1),
  })).default([]),
  // Secondary-objective rewards (FG-4): applied when starting the NEXT mission.
  rewards: z.array(z.object({
    ifObjectiveComplete: z.string(),
    grant: z.object({ nextMissionCredits: z.number() }),
  })).default([]),
});

export type Mission = z.infer<typeof MissionSchema>;

export function loadMission(raw: unknown): Mission {
  const result = MissionSchema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`[data:mission] ${msg}`);
  }
  return result.data;
}

// Type-sync guards: the loader's objective/failure output MUST be assignable to the
// sim's Objective/Failure types. `Loaded extends Sim` is a constraint — if the schemas
// drift so the loader output no longer fits the sim type, this fails to compile.
type AssertAssignable<Sim, Loaded extends Sim> = Loaded;
export type _ObjectiveSync = AssertAssignable<Objective, Mission['objectives'][number]>;
export type _FailureSync = AssertAssignable<Failure, Mission['failure'][number]>;
