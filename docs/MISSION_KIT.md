# Mission Kit (XP-1) — internal authoring tooling

- **Play any JSON without registering it:** open `/?dev=1` → paste mission JSON → VALIDATE + LAUNCH
  (stores to `localStorage['shardDominion.devMission']`, boots as `?mission=__dev__`). Errors from the
  zod loader show inline.
- **Stamp a skeleton:** `node scripts/new-mission.mjs <defense|assault|harvest> <id> [name]`.
- **Validate everything:** `pnpm run validate:missions` (schema, unique ids, kinds, bounds, chains,
  trigger/reward references).
- **Trigger preview:** in any match, `window.__debugTriggersFired()` lists fired trigger ids;
  `__debugObjectives()` / `__debugMessages()` cover the rest.
- **Ship it:** register in `src/main.ts` `MISSIONS`, import in `tests/unit/missions.test.ts`, chain via
  `next`, add to `CAMPAIGN` if it's story.
