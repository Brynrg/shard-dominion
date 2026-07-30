// ── Structures loader ───────────────────────────────────────────────────────────
// Loads and validates structures.json. Never hardcode these values in systems.
import { z } from 'zod';

export const StructureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().nonnegative(),
  buildTimeSeconds: z.number().positive(),
  tier: z.number().int().min(1).max(3).default(1),
  /** Sidebar tab this structure lives on. `internal` = never player-buildable
   *  (pre-placed or engine-owned) and therefore exempt from the reachability gate. */
  menu: z.enum(['base', 'def', 'internal']).default('base'),
  /** Sidebar hotkey (single char, '' = none). */
  hotkey: z.string().max(1).default(''),
  /** Short sidebar label. */
  shortName: z.string().min(1).optional(),
  /** One-line purpose for the hover tooltip (WC3 convention: every build button
   *  says what the thing DOES — "Trains Footmen and Riflemen"). */
  desc: z.string().optional(),
  /** Structure ids that must be standing before this can be built (Phase C2 tech spine). */
  prerequisites: z.array(z.string()).default([]),
  /** XP-2: Refined Cells charged when the build starts. */
  cellCost: z.number().int().nonnegative().optional(),
  /** Only this faction may build it. */
  factionLock: z.enum(['concord', 'emberhand', 'shardborn']).optional(),
  /** This structure trains units (matches some unit's `producedBy`). Data-driven so
   *  the factory stops carrying a hardcoded producer switch — barracks_elite was
   *  missing from it and its whole roster silently never built. */
  producesUnits: z.boolean().default(false),
  /** Superweapon (Phase C3): area strike this structure arms, and its cooldown. */
  superweapon: z.object({
    damage: z.number().positive(),
    radiusTiles: z.number().positive(),
    cooldownSeconds: z.number().positive(),
    label: z.string().min(1),
  }).optional(),
  /** Walls (XP-1): this structure blocks unit pathing while alive. */
  blocksPath: z.boolean().optional(),
  /** XP-4 gates: own-team units path THROUGH this blocker. */
  teamPass: z.boolean().optional(),
  /** XP-4 garrison capacity (bunkers). */
  container: z.number().int().positive().optional(),
  /** XP-4 aura addons: heal nearby own units of a class. */
  aura: z.object({ heals: z.enum(['infantry', 'vehicles']), radiusTiles: z.number().positive(), hpPerSec: z.number().positive() }).optional(),
  /** ConYard only: the HQ upgrade ladder (XP-1). */
  tierUpgrades: z.array(z.object({ toTier: z.number().int().min(2).max(3), cost: z.number().positive(), seconds: z.number().positive(), cells: z.number().int().nonnegative().optional() })).optional(),
  hp: z.number().positive(),
  footprint: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  powerSupply: z.number().nonnegative(),
  powerDemand: z.number().nonnegative(),
  onSlabHpFraction: z.number().positive(),
  offSlabHpFraction: z.number().positive(),
  providesBuildRadius: z.boolean(),
  isDeployable: z.boolean(),
  isSlab: z.boolean().optional(),
  graphics: z.object({
    sprite_id: z.string().min(1),
    fallback_geometry: z.object({
      chassis: z.enum(['INFANTRY', 'LIGHT_VEHICLE', 'TANK', 'AIR', 'BUILDING']),
      chassisMod: z.enum(['NONE', 'CHAMFER', 'HEAVY_BLOCK', 'SWEPT_WEDGE']),
      weaponGlyph: z.enum(['NONE', 'ANTI_INFANTRY', 'ANTI_VEHICLE', 'ANTI_AIR', 'SIEGE', 'SCOUT', 'RAIDER', 'SUPPORT', 'ECONOMY']),
      barrelClass: z.enum(['NONE', 'SHORT', 'MEDIUM', 'LONG', 'TWIN_LAUNCHER', 'EMITTER']),
      roleBadge: z.enum(['ANTI_INFANTRY', 'ANTI_VEHICLE', 'ANTI_AIR', 'SIEGE', 'SCOUT', 'RAIDER', 'SUPPORT', 'ECONOMY']),
      rangeMarks: z.number().int().nonnegative(),
      hazard: z.enum(['NONE', 'SPLASH', 'FRIENDLY_FIRE', 'STEALTH', 'CONTROL']),
      factionStripe: z.string().min(1),
    }),
  }),
});

export const StructuresFileSchema = z.object({ structures: z.array(StructureSchema) });

export type StructureDef = z.infer<typeof StructureSchema>;

export function loadStructures(raw: unknown): StructureDef[] {
  const result = StructuresFileSchema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`[data:structures] ${msg}`);
  }
  return result.data.structures;
}
