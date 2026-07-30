// ── Refinements loader (economy depth) ────────────────────────────────────────
// Team-wide researched upgrades bought at a Processing Plant: a credit + Cell sink
// that shapes a build (eco / offence / defence / planet-mitigation). Applied as
// deterministic point-of-use multipliers by the effect systems.
import { z } from 'zod';

export const RefinementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().nonnegative(),
  cells: z.number().nonnegative().default(0),
  timeSeconds: z.number().positive(),
  effect: z.enum(['harvest', 'damage', 'armor', 'resonance', 'buildTime', 'range', 'firepower']),
  value: z.number().positive(),
  desc: z.string(),
  prerequisites: z.array(z.string()).optional(),
  faction: z.enum(['concord', 'emberhand', 'shardborn']).optional(),
  /** Phase 1c tech tree: research tier (2+ needs War Factory + Tech Lab). */
  tier: z.number().int().min(1).max(3).optional(),
});
export type Refinement = z.infer<typeof RefinementSchema>;

const RefinementsSchema = z.array(RefinementSchema);

export function loadRefinements(raw: unknown): Refinement[] {
  const r = RefinementsSchema.safeParse(raw);
  if (!r.success) {
    throw new Error(`[data:refinements] ${r.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`);
  }
  return r.data;
}

/** The team's TOTAL bonus for an effect: every researched refinement with that effect,
 *  summed. Pure helper over the sim's refinement ledger; 0 when nothing applies.
 *
 *  This used to return the FIRST match, which silently shadowed the whole tier-2 tier:
 *  once `munitions_doctrine` (damage) was done, `advanced_munitions` (+25% damage) could
 *  never apply, so the second half of the research tree was a no-op the player paid for.
 *  Additive stacking is the standard RTS convention and keeps the maths legible. */
export function refinementValue(
  done: readonly string[] | undefined,
  refinements: readonly Refinement[],
  effect: Refinement['effect'],
): number {
  if (!done || done.length === 0) return 0;
  let total = 0;
  for (const id of done) {
    const r = refinements.find(x => x.id === id);
    if (r && r.effect === effect) total += r.value;
  }
  return total;
}
