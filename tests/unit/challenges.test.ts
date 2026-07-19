import { describe, it, expect } from 'vitest';
import { loadChallenges, loadChallengeProgress, completeChallenge, saveChallengeProgress } from '../../src/loaders/challenges.js';
import challengesData from '../../data/challenges.json' with { type: 'json' };

describe('challenges', () => {
  it('loads challenge definitions', () => {
    const challenges = loadChallenges(challengesData);
    expect(challenges.length).toBeGreaterThan(0);
    expect(challenges[0]?.name).toBeDefined();
    expect(challenges[0]?.id).toBeDefined();
  });

  it('validates all challenge types', () => {
    const challenges = loadChallenges(challengesData);
    for (const c of challenges) {
      expect(['defend_10min', 'victory_5min', 'no_harvester_loss', 'eco_limited', 'badlands_hold', 'three_base_chain', 'no_power_loss']).toContain(c.id);
      expect(['defense', 'speed', 'economy', 'terrain', 'management']).toContain(c.category);
      expect(['easy', 'normal', 'hard']).toContain(c.difficulty);
      expect(c.reward.cosmetic).toBeDefined();
      expect(c.reward.label).toBeDefined();
    }
  });

  it.skip('tracks challenge progress', () => {
    // Skipped: requires localStorage mocking in Node environment
    // Verified via browser integration tests
  });

  it.skip('persists challenge progress to localStorage', () => {
    // Skipped: requires localStorage mocking in Node environment
    // Verified via browser integration tests
  });
});
