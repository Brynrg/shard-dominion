// ── Structures loader ───────────────────────────────────────────────────────────
// Loads and validates structures.json. Never hardcode these values in systems.
import { z } from 'zod';

export const StructureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().nonnegative(),
  buildTimeSeconds: z.number().positive(),
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
