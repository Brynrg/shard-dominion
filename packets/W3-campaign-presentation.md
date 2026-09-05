# Packet W3 — campaign presentation: briefing layout, act-grouped mission select, difficulty, Act III/IV cards

> Orchestrated build (branch `feat/wc3-parity`). View-layer only (`src/view/**`, `scripts/art-gen`).
> Review findings: long Act III/IV briefings overflow the frame (story pushes HOW TO PLAY under the
> portrait and the CLICK TO TAKE COMMAND prompt; hotkey legend clips); the same 6-step HOW TO PLAY
> boilerplate shows on all 20 missions; mission select has act cards for Acts I–II only, no blurbs,
> and no campaign difficulty.

## A. `src/view/onboarding.ts` — emit the COMPLETE file
1. `BriefingText` gains two optional fields: `howto?: boolean` (default true) and `subtitle?: string`.
   When `howto === false`, do NOT draw the HOW TO PLAY block (title + 6 lines) — replace it with a
   single grey hint line: `'Hover any sidebar button for its cost and requirements · OBJECTIVES tick off up top.'`
2. Bounded layout in `drawBriefing`. Compute `bottomReserve = 26 (CTA) + 18*2 (hint lines) + 16` and
   `textBottom = H - pad - bottomReserve`. Story lines draw at 20px pitch from `pad + 158`; if the
   story + (howto block if shown) would exceed `textBottom`, first drop the line pitch to 17px and the
   font to 12px monospace; if it STILL overflows, clip the story to the lines that fit and draw a final
   `'…'` line. The hint lines and CTA are always drawn at their fixed positions inside the frame.
3. Portrait placement: if `story.length > 6` (long briefing) draw the portrait SMALL (`ps = 96`) at the
   TOP-RIGHT of the frame beside the title (`px = W - pad - ps - 26, py = pad + 46`), so it never overlaps
   body text; otherwise keep today's bottom-right placement. Keep the existing frame, glow, border.
4. Everything else (STEPS tutorial banner, mission objectives banner, comm panel, `portraitFor`,
   `loadPortrait`, exports) unchanged.

## B. `src/view/menu.ts` — emit ONLY a replacement for `MissionEntry` + `showMissionSelect` as a snippet file
Emit as `=== FILE: SNIPPET/menu.showMissionSelect.ts ===` containing just the interface + function
(the orchestrator splices it in). Contract:
```ts
export interface MissionEntry { id: string; name: string; order: number; act: 1 | 2 | 3 | 4; blurb?: string; unlocked: boolean; completed: boolean }
export type CampaignDifficulty = 'easy' | 'normal' | 'hard';
export function showMissionSelect(missions: readonly MissionEntry[], onPick: (id: string, difficulty: CampaignDifficulty) => void, onBack: () => void): void
```
- Group by act in order. Before each act's first mission: the act card `actCard(\`act${act}_card\`)` (existing
  helper — it removes itself if the art is missing) and an act heading line (`ACT I · THE LANDING`,
  `ACT II · THE TURN`, `ACT III · THE VERDICT`, `ACT IV · GENESIS`; 12px, letter-spacing 2px, `#8fb7c9`).
- Each mission row: the existing button (✔ / 🔒 styling unchanged) plus, when `blurb` is set and the mission
  is unlocked, a one-line grey blurb under it (`font-size:11px;color:#8894a4;max-width:420px;margin:-6px auto 8px`).
- A difficulty row above the list: three toggle buttons EASY / NORMAL / HARD using the same active/inactive
  style pattern the skirmish setup uses (`border:1px solid #00e5ff` active). Persist to
  `localStorage['shardDominion.campaign.difficulty']` (try/catch), default `'normal'`. `onPick(id, difficulty)`.
- The panel must scroll: wrap the list in a div with `max-height:82vh; overflow-y:auto; padding:0 12px`.
- Use the file's existing `overlay()`, `button()`, `actCard()` helpers (they are in scope in menu.ts).

## C. `scripts/art-gen/presentation.mjs` — emit ONLY a snippet file `=== FILE: SNIPPET/presentation.actCards34.mjs ===`
Two new functions in the exact style of `actCard1`/`actCard2` (same `W`,`H`,`GLOW`,`rnd`, `crystalSeams` helpers,
1280×720 SVG string):
- `actCard3()` — Act III "The Verdict": Halex's Ash Court on black glass-flats under a storm; cyan (Concord)
  and ember (Emberhand) silhouettes standing on the SAME side of the frame; a lightning-lit bunker; ash motes.
- `actCard4()` — Act IV "Genesis": dawn over the sealed/bound Vein; three tall crystal spore towers glowing
  violet (`#b48bff`) with gold (`#ffd34d`) light seams; tiny figures at their feet; calm sky gradient.
Plus the two `PIECES` entries to add: `{ file: 'act3_card', draw: actCard3 }, { file: 'act4_card', draw: actCard4 }`.

## Constraints
No `any`; no unused vars; DOM only in `src/view`. Keep monospace/cyan/gold palette. Do not touch `src/sim/**`.

## Output format (STRICT)
```
=== FILE: src/view/onboarding.ts ===
…complete file…
=== END ===
=== FILE: SNIPPET/menu.showMissionSelect.ts ===
…interface + function only…
=== END ===
=== FILE: SNIPPET/presentation.actCards34.mjs ===
…two functions + PIECES lines…
=== END ===
```
