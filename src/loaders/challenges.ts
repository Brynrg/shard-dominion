// ── Challenge loader ──────────────────────────────────────────────────────────
// Loads + validates challenge definitions (data/challenges.json). Challenges are
// replayable skirmish variants with win conditions (survive, speed, constraints).
// A completed challenge unlocks a cosmetic reward.
import { z } from 'zod';

const ChallengeRulesSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('survive'),
    durationSeconds: z.number().positive(),
    playerCanAttack: z.boolean().optional(),
    playerCanBuild: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('destroy'),
    maxDurationSeconds: z.number().positive().optional(),
    playerStartCredits: z.number().nonnegative().optional(),
    playerStartUnits: z.array(z.object({ type: z.string(), count: z.number().positive() })).optional(),
    enemyStartCredits: z.number().nonnegative().optional(),
    constraint: z.string().optional(),
    constraintParam: z.number().optional(),
  }),
  z.object({
    type: z.literal('destroyWithConstraint'),
    constraint: z.string(),
    constraintParam: z.number().optional(),
  }),
]);

const ChallengeRewardSchema = z.object({
  cosmetic: z.string(),
  label: z.string(),
});

export const ChallengeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['defense', 'speed', 'economy', 'terrain', 'management']),
  description: z.string().min(1),
  difficulty: z.enum(['easy', 'normal', 'hard']),
  map: z.enum(['skirmish', 'skirmish_badlands']),
  rules: ChallengeRulesSchema,
  reward: ChallengeRewardSchema,
});

export type Challenge = z.infer<typeof ChallengeSchema>;
export type ChallengeRules = z.infer<typeof ChallengeRulesSchema>;

export interface ChallengesData {
  challenges: Challenge[];
}

export const ChallengesSchema = z.object({
  challenges: z.array(ChallengeSchema),
});

export function loadChallenges(data: unknown): Challenge[] {
  const parsed = ChallengesSchema.parse(data);
  return parsed.challenges;
}

// Challenge progress tracking (localStorage)
export interface ChallengeProgress {
  completed: string[];
  cosmetics: Set<string>;
}

export function loadChallengeProgress(): ChallengeProgress {
  try {
    const raw = localStorage.getItem('shardDominion.challenges');
    if (!raw) return { completed: [], cosmetics: new Set() };
    const parsed = JSON.parse(raw) as { completed: string[]; cosmetics: string[] };
    return {
      completed: parsed.completed ?? [],
      cosmetics: new Set(parsed.cosmetics ?? []),
    };
  } catch {
    return { completed: [], cosmetics: new Set() };
  }
}

export function saveChallengeProgress(progress: ChallengeProgress): void {
  try {
    const payload = {
      completed: progress.completed,
      cosmetics: Array.from(progress.cosmetics),
    };
    localStorage.setItem('shardDominion.challenges', JSON.stringify(payload));
  } catch {
    // storage unavailable
  }
}

export function completeChallenge(challengeId: string, reward: { cosmetic: string }): void {
  const progress = loadChallengeProgress();
  if (!progress.completed.includes(challengeId)) {
    progress.completed.push(challengeId);
  }
  progress.cosmetics.add(reward.cosmetic);
  saveChallengeProgress(progress);
}
