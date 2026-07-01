// ── Economy constants loader ────────────────────────────────────────────────────
// Loads and validates economyConstants.json. Never hardcode these values in systems.
import { z } from 'zod';

export const EconomyConstantsSchema = z.object({
  harvestRate: z.number().positive(),
  cargoCapacity: z.number().positive(),
  dockRate: z.number().positive(),
  refineryStorageCapacity: z.number().positive(),
});

export type EconomyConstants = z.infer<typeof EconomyConstantsSchema>;

export function loadEconomyConstants(raw: unknown): EconomyConstants {
  const result = EconomyConstantsSchema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`[data:economyConstants] ${msg}`);
  }
  return result.data;
}
