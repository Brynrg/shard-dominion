// ── CONTRACT: DataLoader — the single ingestion point ────────────────────────
// Every data file enters the game through here, validated and cross-referenced.
// Anything malformed or inconsistent throws with a precise message — fail fast,
// at load, never a silent runtime divergence.
import type { z } from 'zod';
import {
  WeaponsFileSchema,
  UnitsFileSchema,
  BuildingsFileSchema,
  AudioFileSchema,
  OnboardingFileSchema,
  type WeaponsFile,
  type UnitDef,
  type BuildingDef,
  type OnboardingEntry,
} from './schemas.js';

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`[data:${label}] ${msg}`);
  }
  return result.data;
}

export function loadWeapons(raw: unknown): WeaponsFile {
  return parseOrThrow(WeaponsFileSchema, raw, 'weapons');
}

export function loadUnits(raw: unknown, weapons: WeaponsFile): UnitDef[] {
  const { units } = parseOrThrow(UnitsFileSchema, raw, 'units');
  for (const u of units) {
    if (u.weapon !== null && !(u.weapon in weapons.weapons)) {
      throw new Error(`[data:units] "${u.id}" references unknown weapon "${u.weapon}"`);
    }
  }
  // 1× legibility: no two units may share an identical placeholder tuple.
  const seen = new Map<string, string>();
  for (const u of units) {
    const key = JSON.stringify(u.graphics.fallback_geometry);
    const prev = seen.get(key);
    if (prev !== undefined) {
      throw new Error(`[data:units] "${u.id}" and "${prev}" have identical placeholder geometry (indistinguishable at 1× zoom)`);
    }
    seen.set(key, u.id);
  }
  return units;
}

export function loadBuildings(raw: unknown): BuildingDef[] {
  return parseOrThrow(BuildingsFileSchema, raw, 'buildings').buildings;
}

export function loadAudioCues(raw: unknown): string[] {
  return parseOrThrow(AudioFileSchema, raw, 'audio').v1_readability_cues;
}

export function loadOnboarding(raw: unknown): OnboardingEntry[] {
  return parseOrThrow(OnboardingFileSchema, raw, 'onboarding').entries;
}

export interface RawGameData {
  weapons: unknown;
  units?: unknown;
  buildings?: unknown;
  audio?: unknown;
  onboarding?: unknown;
}

export interface GameData {
  weapons: WeaponsFile;
  units: UnitDef[];
  buildings: BuildingDef[];
  audioCues: string[];
  onboarding: OnboardingEntry[];
}

/** Load + validate + cross-reference the whole data set. Throws on any problem. */
export function loadGameData(raw: RawGameData): GameData {
  const weapons = loadWeapons(raw.weapons);
  return {
    weapons,
    units: raw.units === undefined ? [] : loadUnits(raw.units, weapons),
    buildings: raw.buildings === undefined ? [] : loadBuildings(raw.buildings),
    audioCues: raw.audio === undefined ? [] : loadAudioCues(raw.audio),
    onboarding: raw.onboarding === undefined ? [] : loadOnboarding(raw.onboarding),
  };
}
