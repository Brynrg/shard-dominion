// ── AI personalities (Phase A3) ───────────────────────────────────────────────
// Difficulty used to be three numbers that moved the AI's attack clock by a total
// of 54 seconds: a passive player died at 4:10 on Easy and 3:16 on Hard. There was
// no setting at which a new player could learn the game.
//
// Difficulty is now a BEHAVIOUR profile: what the AI builds, whether it expands,
// whether it defends its economy, whether it retreats, whether it techs, and whether
// it fields air/artillery/superweapons at all.
export interface AiPersonality {
  readonly id: 'easy' | 'normal' | 'hard';
  /** Structures to pursue, in order. The AI reserves credits for the next one. */
  readonly buildOrder: readonly string[];
  /** Extra refineries it will found on unexploited fields. */
  readonly maxExpansions: number;
  /** Harvesters it tries to keep alive (the real economic lever). */
  readonly targetHarvesters: number;
  /** Hard cap on fielded combat units. The measured problem with the old difficulty
   *  tiers was that Easy still massed ◈4800 of army by 5:00 and deleted a beginner;
   *  a unit cap is the standard RTS lever that actually makes Easy easy. */
  readonly armyCap: number;
  /** Army value that triggers an all-in assault. */
  readonly assaultValue: number;
  /** How much that threshold decays per elapsed minute. */
  readonly assaultEscalationPerMin: number;
  /** Army value at which it starts harassing with a partial force. */
  readonly pressureValue: number;
  /** No offensive plan before this tick (learning grace). */
  readonly graceTicks: number;
  /** Ticks between plan re-evaluations. */
  readonly evalInterval: number;
  /** After an assault, hold and rebuild for this long before the next one. */
  readonly waveLullTicks: number;
  // ── Defence (Phase B1: the anti-decoy rules) ────────────────────────────────
  /** Defend only if believed incoming threat ≥ ratio × own army value. */
  readonly defendThreatRatio: number;
  /** Consecutive evaluations of sustained proximity before committing to defend. */
  readonly defendConfirmEvals: number;
  /** Minimum ticks to stay in a defensive posture once entered (hysteresis). */
  readonly defendDwellTicks: number;
  /** Cap on the fraction of the army recalled for a defence. */
  readonly defendCommitFraction: number;
  // ── Behaviour toggles ───────────────────────────────────────────────────────
  readonly raidHarvesters: boolean;
  readonly retreatDamaged: boolean;
  readonly buildStaticDefence: boolean;
  readonly useAir: boolean;
  readonly useArtillery: boolean;
  readonly research: boolean;
  /** Split an assault into two prongs from different approach angles. */
  readonly multiProng: boolean;
}

const EASY: AiPersonality = {
  id: 'easy',
  // Economy and one production building. No tech, no defences: an Easy opponent is
  // a sparring partner, and its base is meant to be crackable by a first-timer.
  buildOrder: ['power_node', 'barracks'],
  maxExpansions: 0,
  targetHarvesters: 1,
  armyCap: 8,
  assaultValue: 900,
  assaultEscalationPerMin: 20,
  pressureValue: 700,
  graceTicks: 20 * 60 * 6,      // 6 minutes of peace to learn the interface
  evalInterval: 20,
  waveLullTicks: 20 * 45,       // telegraphed waves with a long breather
  defendThreatRatio: 0.5,
  defendConfirmEvals: 3,
  defendDwellTicks: 20 * 8,
  defendCommitFraction: 0.6,
  raidHarvesters: false,        // never punishes an undefended economy
  retreatDamaged: false,
  buildStaticDefence: false,
  useAir: false,
  useArtillery: false,
  research: false,
  multiProng: false,
};

const NORMAL: AiPersonality = {
  id: 'normal',
  buildOrder: ['power_node', 'barracks', 'refinery', 'war_factory', 'defense_turret', 'tech_lab', 'processing_plant', 'defense_turret'],
  maxExpansions: 1,
  targetHarvesters: 3,
  armyCap: 26,
  assaultValue: 1100,
  assaultEscalationPerMin: 45,
  pressureValue: 550,
  graceTicks: 20 * 90,          // 1:30 before the first offensive plan
  evalInterval: 10,
  waveLullTicks: 20 * 20,
  defendThreatRatio: 0.35,
  defendConfirmEvals: 2,
  defendDwellTicks: 20 * 6,
  defendCommitFraction: 0.75,
  raidHarvesters: true,
  retreatDamaged: true,
  buildStaticDefence: true,
  useAir: false,
  useArtillery: true,
  research: true,
  multiProng: false,
};

const HARD: AiPersonality = {
  id: 'hard',
  buildOrder: [
    'power_node', 'barracks', 'refinery', 'war_factory', 'defense_turret',
    'tech_lab', 'processing_plant', 'defense_turret', 'aa_turret',
    'barracks_elite', 'skypad', 'armor_upgrade_center', 'defense_turret', 'ion_cannon',
  ],
  maxExpansions: 2,
  targetHarvesters: 4,
  armyCap: 60,
  // Big-map tuning: mass a decisive wave (trickled squads die crossing a 48-tile
  // map into a defended base) and keep pressure forces meaningful.
  assaultValue: 1600,
  assaultEscalationPerMin: 40,
  pressureValue: 900,
  graceTicks: 20 * 45,
  evalInterval: 8,
  waveLullTicks: 20 * 10,
  defendThreatRatio: 0.25,
  defendConfirmEvals: 2,
  defendDwellTicks: 20 * 5,
  defendCommitFraction: 0.85,
  raidHarvesters: true,
  retreatDamaged: true,
  buildStaticDefence: true,
  useAir: true,
  useArtillery: true,
  research: true,
  multiProng: true,
};

export const AI_PERSONALITIES = { easy: EASY, normal: NORMAL, hard: HARD } as const;

export function personalityFor(difficulty: string | null | undefined): AiPersonality {
  if (difficulty === 'easy') return EASY;
  if (difficulty === 'hard') return HARD;
  return NORMAL;
}
