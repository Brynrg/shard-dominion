import weaponsRaw from '../data/weapons.json';
import { loadWeapons, loadUnits, loadAudioCues, loadOnboarding } from '../src/loaders/loader.js';
import { WEAPON_TYPES, ARMOR_CLASSES } from '../src/sim/combat-types.js';
import { REQUIRED_AUDIO_CUES, REQUIRED_ONBOARDING_IDS, type Graphics } from '../src/loaders/schemas.js';

const geom = (over: Partial<Graphics['fallback_geometry']> = {}): Graphics['fallback_geometry'] => ({
  chassis: 'TANK', chassisMod: 'NONE', weaponGlyph: 'SHELL', barrelClass: 'MEDIUM',
  roleBadge: 'ANTI_VEHICLE', rangeMarks: 2, hazard: 'NONE', factionStripe: 'outer', ...over,
});
const unit = (id: string, weapon: string | null, over: Partial<Graphics['fallback_geometry']> = {}) => ({
  id, cost: 100, buildTime: 5, hp: 100, armor: 'LIGHT', speed: 1, vision: 4,
  weapon, producer: null, prereqUpgrade: null, faction: null, special: null,
  graphics: { sprite_id: id, fallback_geometry: geom(over) },
});

describe('weapons.json — locked matrix + values', () => {
  it('validates and the damage matrix is complete (7×5)', () => {
    const w = loadWeapons(weaponsRaw);
    for (const wt of WEAPON_TYPES) for (const ac of ARMOR_CLASSES) {
      expect(typeof w.matrix[wt]?.[ac]).toBe('number');
    }
    expect(w.weapons['tank_shell_f']?.damage).toBe(42);
  });

  it('a matrix missing an armor column throws', () => {
    const broken = structuredClone(weaponsRaw) as { matrix: Record<string, Record<string, number>> };
    delete broken.matrix['BULLET']!['HEAVY'];
    expect(() => loadWeapons(broken)).toThrow(/matrix.*HEAVY/);
  });
});

describe('units — cross-reference + 1× legibility', () => {
  const weapons = loadWeapons(weaponsRaw);
  it('valid units load', () => {
    const units = loadUnits({ units: [unit('a', 'rifle', { weaponGlyph: 'BULLET', roleBadge: 'ANTI_INFANTRY' }), unit('b', 'tank_shell_v')] }, weapons);
    expect(units).toHaveLength(2);
  });
  it('a unit referencing an unknown weapon throws', () => {
    expect(() => loadUnits({ units: [unit('a', 'no_such_gun')] }, weapons)).toThrow(/unknown weapon/);
  });
  it('two units with identical placeholder geometry throw (unreadable at 1×)', () => {
    expect(() => loadUnits({ units: [unit('a', 'rifle'), unit('b', 'rifle')] }, weapons)).toThrow(/identical placeholder/);
  });
  it('a missing graphics block throws', () => {
    const noGfx = { id: 'x', cost: 1, buildTime: 1, hp: 1, armor: 'NONE', speed: 1, vision: 1, weapon: null, producer: null, prereqUpgrade: null, faction: null, special: null };
    expect(() => loadUnits({ units: [noGfx] }, weapons)).toThrow(/graphics/);
  });
});

describe('audio-readability cue set (sprite-severity)', () => {
  it('the full required set loads', () => {
    expect(loadAudioCues({ v1_readability_cues: [...REQUIRED_AUDIO_CUES] })).toContain('planet_worm_telegraph');
  });
  it('a missing required cue throws', () => {
    const partial = REQUIRED_AUDIO_CUES.filter((c) => c !== 'harvester_under_attack');
    expect(() => loadAudioCues({ v1_readability_cues: partial })).toThrow(/harvester_under_attack/);
  });
});

describe('onboarding-predicate entries', () => {
  const entry = (id: string) => ({
    id, when: 'power.ratio < 1', anchor: 'hud.power', mode: ['LEARN'], priority: 40,
    cooldownSeconds: 20, text: '...', dismissWhen: 'power.ratio >= 1', oncePerProfile: true,
    slowsTime: false, allowedInCombat: false, a11yText: '...',
  });
  it('the full required id set loads', () => {
    const entries = REQUIRED_ONBOARDING_IDS.map(entry);
    expect(loadOnboarding({ entries })).toHaveLength(REQUIRED_ONBOARDING_IDS.length);
  });
  it('a missing required nudge id throws', () => {
    const entries = REQUIRED_ONBOARDING_IDS.filter((i) => i !== 'deploy_mcv').map(entry);
    expect(() => loadOnboarding({ entries })).toThrow(/deploy_mcv/);
  });
});
