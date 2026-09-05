# Packet W1 — Act IV integrity: known neutral kinds + validator + Act IV gate

> Orchestrated build (2026-09-05, branch `feat/wc3-parity`). Read `AGENTS.md` rules §1–§5.
> Context: the review found Act IV's `spore_tower` neutrals exist in no roster (rendered as a
> nameless grey box) and the mission validator never checks `neutrals`. Act IV also inherits the
> M14 Seal/Harness choice but never branches on it. This packet lands the CODE half; the
> orchestrator authors the mission JSON prose separately to the contract in §3.

## 1. `src/sim/neutralKinds.ts` (NEW)
The single list of neutral map-feature kinds the seeder accepts (`seedMission.ts` creates any
`neutrals[].type` as a passive neutral building; `planetEvent.ts` captures derrick/relay/spore_tower).
```ts
export const NEUTRAL_KINDS = ['derrick', 'relay', 'wreck', 'spore_tower'] as const;
export type NeutralKind = (typeof NEUTRAL_KINDS)[number];
export function isNeutralKind(kind: string): kind is NeutralKind
```
Pure module: no imports, no DOM, no randomness. Short header comment explaining the four kinds
(derrick = credit income when captured; relay = Cell income; wreck = salvage cargo; spore_tower =
Act IV capturable anchor, no income).

## 2. `tests/unit/missions.test.ts` — add ONE test inside the existing `describe('missions — schema + integrity')`
Keep every existing test byte-for-byte. Add, after the 'placed entities use known kinds…' test:
```ts
it('neutral map features use known neutral kinds and sit in bounds', () => { … })
```
For every mission, every `m.neutrals[]` entry: `expect(isNeutralKind(n.type), \`${m.id}: unknown neutral kind "${n.type}"\`).toBe(true)`
and in-bounds like the placed-entity check. Import `isNeutralKind` from `'../../src/sim/neutralKinds.js'`.
(`noUncheckedIndexedAccess` is on; no unused imports; no `any`.)

## 3. `tests/liveness/actIV.spec.ts` (NEW) — model EXACTLY on `tests/liveness/actIII_finale.spec.ts`
Same `boot()` helper (seeds `shardDominion.choice.campaign`, goes to `/?mission=…`, waits for
`#game-canvas`, clicks (400,300)), same `objs()` / `hasSpeaker()` helpers, same `expect.poll`
pattern with `{ timeout: 8000, intervals: [300] }`. Four tests, contract the mission data will meet:
1. **M18 SEAL** (`m18_act4_ruins`, 'seal'): an objective text matches `/SEAL:/i`; none matches `/HARNESS:/i`; speaker `MARSHAL CORR` appears.
2. **M18 HARNESS**: objective matches `/HARNESS:/i`; none `/SEAL:/i`; speaker `THE CHORUS` appears.
3. **M20 HARNESS** (`m20_act4_genesis`, 'harness'): objectives include one matching `/Destroy all enemy forces/i` AND one matching `/HARNESS:/i`; speaker `THE CHORUS` appears.
4. **M20 SEAL**: `/Destroy all enemy forces/i` present, `/HARNESS:/i` absent; speaker `SERA VANE` appears.
Playwright spec; `test.describe('Act IV branch gate', …)`.

## Output format (STRICT)
Emit each file as:
```
=== FILE: <repo-relative path> ===
<complete file content>
=== END ===
```
Emit `tests/unit/missions.test.ts` as the COMPLETE file (all existing tests preserved, one added).
No prose outside the blocks.

## Acceptance (orchestrator runs)
`pnpm run verify` green; `npx playwright test tests/liveness/actIV.spec.ts` green once the JSON lands.
