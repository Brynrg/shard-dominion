// Art-pipeline wiring for the incoming 81-asset drop (docs/ART_HANDOFF.md):
// sheet lookup order (faction skins + §0.6 animation strips) and the importer's
// classification/sidecar rules. Pure logic only — canvas work is Playwright-gated.
import { describe, it, expect } from 'vitest';
import { sheetCandidates } from '../../src/view/spritebank.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs script, no type surface; helpers are exported for tests.
import { classify, sidecarFor, UNIT_IDS, STRIP_STATES } from '../../scripts/import-art.mjs';

describe('sheetCandidates — delivered-sheet preference order', () => {
  it('idle: faction skin beats team paint beats neutral, base state only', () => {
    expect(sheetCandidates('enemy', 'idle', 'emberhand')).toEqual([
      { team: 'emberhand', state: 'base' },
      { team: 'enemy', state: 'base' },
      { team: 'neutral', state: 'base' },
    ]);
  });

  it('moving: walk strip beats drive strip beats base sprite, within each team', () => {
    const c = sheetCandidates('player', 'moving');
    expect(c.slice(0, 3)).toEqual([
      { team: 'player', state: 'walk' },
      { team: 'player', state: 'drive' },
      { team: 'player', state: 'base' },
    ]);
    expect(c[3]).toEqual({ team: 'neutral', state: 'walk' });
  });

  it('firing: fire strip first, then base', () => {
    expect(sheetCandidates('player', 'firing').map(c => c.state)).toEqual(['fire', 'base', 'fire', 'base']);
  });

  it('a faction skin outranks even the anim strip of the plain team paint', () => {
    // emberhand base must beat player walk — a cyan strip on an ember army is wrong.
    const keys = sheetCandidates('player', 'moving', 'emberhand').map(c => `${c.team}|${c.state}`);
    expect(keys.indexOf('emberhand|base')).toBeLessThan(keys.indexOf('player|walk'));
  });

  it('no faction id (or faction === team) → no duplicate team tier', () => {
    expect(sheetCandidates('player', 'idle', 'player').map(c => c.team)).toEqual(['player', 'neutral']);
  });
});

describe('import-art classification', () => {
  it('knows every post-v0.22 unit (the stale-UNIT_IDS regression)', () => {
    for (const id of ['scout_vehicle', 'assault_tank', 'longbow', 'skimmer_apc', 'gunship',
      'riftmaw', 'warden', 'ghostwalker', 'vane']) {
      expect(UNIT_IDS.has(id), id).toBe(true);
      expect(classify(`${id}__player__move.png`)?.kind).toBe('unit');
    }
  });

  it('routes buildings, terrain and presentation art correctly', () => {
    expect(classify('war_factory__player__idle.png')?.kind).toBe('building');
    expect(classify('derrick__neutral__idle.png')?.kind).toBe('building');
    expect(classify('terrain__scorched.png')?.kind).toBe('terrain');
    expect(classify('title_backdrop.png')?.kind).toBe('presentation');
    expect(classify('notes.txt')).toBeNull();
    expect(classify('infantry__player.png')?.kind).toBe('bad');
    expect(classify('infantry__player__dance.png')?.kind).toBe('bad');
  });

  it('writes strip sidecars with frames+fps, single sprites without', () => {
    const walk = sidecarFor(classify('infantry__player__walk.png'));
    expect(walk.frames).toBe(STRIP_STATES.walk.frames);
    expect(walk.fps).toBeGreaterThan(0);
    expect(walk.rotateFrom).toBe('north');

    const fire = sidecarFor(classify('longbow__player__fire.png'));
    expect(fire.frames).toBe(2); // §0.6 fire strips are 2-frame recoil poses

    const single = sidecarFor(classify('assault_tank__enemy__move.png'));
    expect(single.frames).toBe(1);
    expect(single.fps).toBe(0);

    const bldg = sidecarFor(classify('war_factory__player__idle.png'));
    expect(bldg.rotateFrom).toBeUndefined();
    expect(bldg.inGameWidthPx).toBe(96);
  });
});
