// ── CONTRACT: the data schemas (zod) ─────────────────────────────────────────
// Every data file is validated here at load time; a malformed or
// cross-inconsistent file is a thrown error, not a runtime surprise. Includes
// the three contracts promoted in plan v4: the placeholder-visual `graphics`
// block, the audio-readability cue set, and the onboarding-predicate entries.
import { z } from 'zod';
import { WEAPON_TYPES, ARMOR_CLASSES } from '../sim/combat-types.js';

export const WeaponTypeSchema = z.enum(WEAPON_TYPES);
export const ArmorClassSchema = z.enum(ARMOR_CLASSES);

// ── weapons.json + the damage matrix ─────────────────────────────────────────
export const WeaponSchema = z.object({
  damage: z.number().positive(),
  cooldown: z.number().positive(),
  range: z.number().positive(),
  type: WeaponTypeSchema,
  minRange: z.number().nonnegative().optional(),
  splash: z.number().nonnegative().optional(),
  friendlyFire: z.boolean().optional(),
});

export const WeaponsFileSchema = z
  .object({
    matrix: z.record(z.string(), z.record(z.string(), z.number())),
    weapons: z.record(z.string(), WeaponSchema),
  })
  .superRefine((data, ctx) => {
    // matrix complete over every weaponType × armorClass
    for (const wt of WEAPON_TYPES) {
      const row = data.matrix[wt];
      if (!row) {
        ctx.addIssue({ code: 'custom', message: `damage matrix missing weapon type "${wt}"` });
        continue;
      }
      for (const ac of ARMOR_CLASSES) {
        if (typeof row[ac] !== 'number') {
          ctx.addIssue({ code: 'custom', message: `damage matrix["${wt}"] missing armor class "${ac}"` });
        }
      }
    }
  });

// ── placeholder-visual `graphics` block (v4 §8; merges fallback_geometry) ─────
export const ChassisSchema = z.enum(['INFANTRY', 'LIGHT_VEHICLE', 'TANK', 'AIR', 'BUILDING']);
export const ChassisModSchema = z.enum(['NONE', 'CHAMFER', 'HEAVY_BLOCK', 'SWEPT_WEDGE']);
export const WeaponGlyphSchema = z.enum([...WEAPON_TYPES, 'NONE']);
export const BarrelClassSchema = z.enum(['NONE', 'SHORT', 'MEDIUM', 'LONG', 'TWIN_LAUNCHER', 'EMITTER']);
export const RoleBadgeSchema = z.enum(['ANTI_INFANTRY', 'ANTI_VEHICLE', 'ANTI_AIR', 'SIEGE', 'SCOUT', 'RAIDER', 'SUPPORT', 'ECONOMY']);
export const HazardSchema = z.enum(['NONE', 'SPLASH', 'FRIENDLY_FIRE', 'STEALTH', 'CONTROL']);

export const FallbackGeometrySchema = z.object({
  chassis: ChassisSchema,
  chassisMod: ChassisModSchema,
  weaponGlyph: WeaponGlyphSchema,
  barrelClass: BarrelClassSchema,
  roleBadge: RoleBadgeSchema,
  rangeMarks: z.number().int().nonnegative(),
  hazard: HazardSchema,
  factionStripe: z.string().min(1),
});

export const GraphicsSchema = z.object({
  sprite_id: z.string().min(1),
  fallback_geometry: FallbackGeometrySchema,
});

// ── units / buildings ────────────────────────────────────────────────────────
export const UnitSchema = z.object({
  id: z.string().min(1),
  cost: z.number().nonnegative(),
  buildTime: z.number().nonnegative(),
  hp: z.number().positive(),
  armor: ArmorClassSchema,
  speed: z.number().nonnegative(),
  vision: z.number().nonnegative(),
  weapon: z.string().nullable(),
  producer: z.string().nullable(),
  prereqUpgrade: z.string().nullable(),
  faction: z.string().nullable(),
  special: z.string().nullable(),
  graphics: GraphicsSchema,
});
export const UnitsFileSchema = z.object({ units: z.array(UnitSchema) });

export const BuildingSchema = z.object({
  id: z.string().min(1),
  cost: z.number().nonnegative(),
  buildTime: z.number().nonnegative(),
  hp: z.number().positive(),
  footprint: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  powerGenerated: z.number().nonnegative(),
  powerConsumed: z.number().nonnegative(),
  providesPlacementAdjacency: z.boolean(),
  providesBuildRadius: z.boolean(),
  graphics: GraphicsSchema,
});
export const BuildingsFileSchema = z.object({ buildings: z.array(BuildingSchema) });

// ── audio-readability cue set (v4 §8/§11.2) ──────────────────────────────────
export const REQUIRED_AUDIO_CUES = [
  'planet_worm_telegraph', 'planet_worm_emerge', 'planet_bloom_warning', 'planet_bloom_detonate',
  'power_brownout_stage_1', 'power_brownout_stage_2', 'harvester_under_attack',
  'impact_shell', 'impact_rocket', 'impact_siege', 'impact_sonic', 'unit_death', 'command_ack',
] as const;

export const AudioFileSchema = z
  .object({ v1_readability_cues: z.array(z.string()) })
  .superRefine((data, ctx) => {
    const present = new Set(data.v1_readability_cues);
    for (const cue of REQUIRED_AUDIO_CUES) {
      if (!present.has(cue)) ctx.addIssue({ code: 'custom', message: `audio: required readability cue "${cue}" missing (sprite-severity)` });
    }
  });

// ── onboarding-predicate entries (v4 §5.9) ───────────────────────────────────
export const REQUIRED_ONBOARDING_IDS = [
  'select_mcv', 'deploy_mcv', 'choose_foundation', 'place_first_slab', 'build_first_power',
  'build_first_refinery', 'first_deposit', 'storage_near_full', 'construction_paused',
  'first_power_deficit', 'first_critical_brownout', 'produce_first_unit', 'read_first_counter',
  'first_agitation_gain', 'first_local_risk', 'first_worm_warning', 'first_thumper', 'first_bloom_warning',
] as const;

export const OnboardingEntrySchema = z.object({
  id: z.string().min(1),
  when: z.string().min(1), // a sim-predicate expression, e.g. "power.ratio < 1"
  anchor: z.string().min(1),
  mode: z.array(z.enum(['LEARN', 'FIRST_STANDARD_MATCH'])).min(1),
  priority: z.number().int(),
  cooldownSeconds: z.number().nonnegative(),
  text: z.string().min(1),
  dismissWhen: z.string().min(1),
  oncePerProfile: z.boolean(),
  slowsTime: z.boolean(),
  allowedInCombat: z.boolean(),
  a11yText: z.string().min(1),
});

export const OnboardingFileSchema = z
  .object({ entries: z.array(OnboardingEntrySchema) })
  .superRefine((data, ctx) => {
    const ids = new Set(data.entries.map((e) => e.id));
    for (const id of REQUIRED_ONBOARDING_IDS) {
      if (!ids.has(id)) ctx.addIssue({ code: 'custom', message: `onboarding: required nudge id "${id}" missing` });
    }
  });

export type WeaponsFile = z.infer<typeof WeaponsFileSchema>;
export type UnitDef = z.infer<typeof UnitSchema>;
export type BuildingDef = z.infer<typeof BuildingSchema>;
export type Graphics = z.infer<typeof GraphicsSchema>;
export type OnboardingEntry = z.infer<typeof OnboardingEntrySchema>;
