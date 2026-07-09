// ── Economy constants loader ────────────────────────────────────────────────────
// Loads and validates economyConstants.json. Never hardcode these values in systems.
import { z } from 'zod';

export const EconomyConstantsSchema = z.object({
  harvestRate: z.number().positive(),
  cargoCapacity: z.number().positive(),
  dockRate: z.number().positive(),
  refineryStorageCapacity: z.number().positive(),
  /** Emergency salvage (QA BUG-3): credits/sec trickled to a side with a refinery but
   *  ZERO living harvesters, until it can afford a replacement. Kills the soft-lock. */
  salvageRatePerSec: z.number().nonnegative().default(10),
  salvageTrickleCap: z.number().positive().default(500),
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
