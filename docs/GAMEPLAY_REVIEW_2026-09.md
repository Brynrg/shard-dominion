# Gameplay and controls review — 2026-09-23

Request: deeply review the game and improve gameplay and user controls.

## Findings and implemented changes

| Area | Confirmed problem | Improvement |
|---|---|---|
| Build menu | Page buttons reached an optional callback that main never supplied. Later structures were mouse-inaccessible. | Connected page changes through the view and main wiring. |
| Selection | Every click/box replaced the squad; Shift did not adjust selection. | Shift-click toggles a single unit; Shift-drag adds units. Selection stays seat-scoped. |
| Pause/briefing | Global input listeners could queue gameplay commands behind overlays. Holding a key repeated actions. | Gate gameplay input, ignore typing/browser shortcuts, and suppress repeated discrete actions. Restore canvas focus on resume. |
| Targeting | Attack, placement, abilities, and strikes could remain armed together; right-click could issue an order while leaving a mode active. | Exclusive targeting modes, consistent right-click/Escape cancellation, visible targeting instruction. Escape cancels before pausing. |
| Mouse boundaries | Blank sidebar space became world-space commands; releasing a selection drag outside the canvas left a stale gesture. | Limit orders/selection to the battlefield; reset abandoned gestures on outside release or blur. |
| Ownership/readability | Cursor allegiance was hardcoded to player/enemy and inspected unseen tiles. ConYard presence could be satisfied by the opposing side. | Use viewer ownership and fog visibility for cursor feedback and own-team construction checks. |
| Onboarding | Build guidance skipped reselecting the READY item before placement. | Explain the complete start → READY → select again → place sequence. |
| Discoverability | Common combat commands depended on memorized keys. | Clickable Attack/Stop/Army controls, selected-unit count, Home-to-base, and a pause-menu controls/tactics guide. |
| Order feedback | Rally points and queued destinations disappeared after the brief acknowledgement marker. | Selected units display numbered route segments; selected producers display a rally marker. These depict intended destinations, not exact pathfinding routes. |
| Parallel production | Every train order went to the first producer, leaving additional factories idle. | Deterministically prefer completed, living producers and choose the least-loaded one, preferring further progress on ties. If none is complete, preserve queued orders at the construction site. |
| Production feedback/cancel | HUD only showed the first producer; cancel could interrupt paid work while unpaid copies waited elsewhere. | Aggregate queues and show the leading active build; cancel waiting copies before active jobs. |

## Review scope

Inspected input dispatch, HUD hit testing, main/view wiring, selection and order semantics,
production routing, onboarding, pause flow, camera behavior, and multiplayer seat ownership.
Rendered the briefing, combat commands, targeting mode, movement routes, and pause guide.
Existing regression gates exercise economy, production, combat, campaign branches, heroes,
aircraft, save/continue, camera navigation, and multiplayer lockstep.

Simulation contract files, weapon data, economy prices, and AI difficulty settings are unchanged.
The additive selection intent remains compatible with intents that omit the new field.

This review does not establish completion of every campaign mission by a human, long-session
four-player stability, or competitive balance across all factions. Those remain Not Proven.
The optional observation/soak tests are not enabled by the normal liveness command.

## Validation

New unit checks cover additive selection and seat isolation, deterministic factory distribution,
cancellation priority, and two barracks completing two units in a single production cycle.
New browser checks exercise real menu paging, Shift-selection, sidebar safety, pause gating,
attack-mode cancellation, Stop, Home, repeated pause keys, help visibility, and resume focus.

Pass: typecheck and lint; 353 unit tests (20 skipped); full liveness suite
57 passed, 2 optional skipped (4.7m). An initial production regression discovered
by the full suite was fixed and retested. Rendered receipts are retained under
`screenshots/controls-review/`; full run notes are in PROGRESS.md.
Changes are local in this review; publication is a separate step.
