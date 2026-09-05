# Packet W3b — mission select snippet for src/view/menu.ts

> Emit ONLY the snippet file described below (the orchestrator splices it into menu.ts). Use the helpers shown in the context (`overlay()`, `button()`, `actCard()`); do not redefine them. No `any`.

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


## Output format (STRICT)
```
=== FILE: SNIPPET/menu.showMissionSelect.ts ===
…interface + type + function only…
=== END ===
```
