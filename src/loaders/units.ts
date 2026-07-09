// ── Units loader ────────────────────────────────────────────────────────────────
// Loads and validates units.json. Never hardcode these values in systems.
import { z } from 'zod';

export const UnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().nonnegative(),
  hp: z.number().positive(),
  armorClass: z.enum(['NONE', 'LIGHT', 'MEDIUM', 'HEAVY', 'BUILDING']),
  weaponId: z.string().min(1),
  speed: z.number().positive(),
  buildTimeSeconds: z.number().positive(),
  tier: z.number().int().min(1).max(3).default(1),
  /** XP-2: dies into a salvageable wreck worth ~30% of cost. */
  leavesWreck: z.boolean().optional(),
  /** XP-2: Refined Cells charged at production start (elite systems only). */
  cellCost: z.number().int().nonnegative().optional(),
  /** XP-3: hero unit — capped at ONE living/queued per side; aura carrier. */
  hero: z.boolean().optional(),
  /** XP-3: only this faction may produce the unit. */
  factionLock: z.enum(['concord', 'emberhand', 'shardborn']).optional(),
  /** XP-3: spawns cloaked; decloaks on firing / near detectors. */
  stealth: z.boolean().optional(),
  /** XP-4 transports: passenger capacity. */
  container: z.number().int().positive().optional(),
  team: z.enum(['player', 'enemy', 'neutral']),
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

export const UnitsFileSchema = z.object({ units: z.array(UnitSchema) });

export type UnitDef = z.infer<typeof UnitSchema>;

export function loadUnits(raw: unknown): UnitDef[] {
  const result = UnitsFileSchema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`[data:units] ${msg}`);
  }
  return result.data.units;
}
