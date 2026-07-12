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
  effect: z.enum(['harvest', 'damage', 'armor', 'resonance']),
  value: z.number().positive(),
  desc: z.string(),
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

/** Whether a team has completed a refinement with the given effect, and its value.
 *  Pure helper over the sim's refinement ledger. Returns 0 if not researched. */
export function refinementValue(
  done: readonly string[] | undefined,
  refinements: readonly Refinement[],
  effect: Refinement['effect'],
): number {
  if (!done || done.length === 0) return 0;
  for (const id of done) {
    const r = refinements.find(x => x.id === id);
    if (r && r.effect === effect) return r.value;
  }
  return 0;
}
