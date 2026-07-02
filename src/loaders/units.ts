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
