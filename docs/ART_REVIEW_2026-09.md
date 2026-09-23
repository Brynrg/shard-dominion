# September 2026 visual review

Request: review and improve all graphics, images, and art in the game.

## Review and changes

| Area | Finding | Result |
| --- | --- | --- |
| Title | Flat backdrop, heavy dimming, menu hid the focal point | New original landscape, left-aligned title and navigation, responsive typography, keyboard focus treatment |
| Campaign | Flat geometric chapter paintings | Four new illustrations following Landing, Turn, Verdict, Genesis; consistent 16:9 display crops |
| Briefings | Simple vector faces lacked character and contrast at small size | Six close-cropped painted portraits matching the existing character descriptions |
| Credits | Flat landscape | New quiet epilogue illustration with negative space for text |
| Terrain | High-frequency texture competed with infantry, abrupt tile seams | Cached albedo wash, gradient transitions, contours drawn after all tiles |
| Units and structures | Existing detailed sprites are worth retaining | Layered grounding shadows, stable depth sorting, faction-correct animated building accents |
| Visibility | Culled cloaked units/sites could leak opacity to following sprites | Set opacity after culling and reset per visible entity |
| HUD | Facet noise and inherited world-label text alignment | Quieter panel texture, explicit left text alignment, regression test |
| Display | Forced nearest-neighbor enlargement exaggerated pixel edges | Smooth browser scaling, restrained outer frame |

All changes are in presentation assets, view code, host HTML/CSS, tests, and documentation.
Simulation contracts, game balance, controls, asset IDs, sprite animation metadata,
and save formats remain unchanged. Existing unit/building/terrain PNGs are retained;
their presentation is improved in the renderer rather than repainting every sprite.

## Asset provenance

All 12 presentation replacements were generated with the built-in image-generation
tool for this project, using the original Aether Prime / Obsidian Bloom setting.
Character descriptions were checked against `docs/GEMINI_ART_PROMPTS.md` and
`docs/ART_HANDOFF.md`. No external game art was imported. Assets are saved under
`public/art/presentation/` and included in the existing manifest.

## Verification

- Inventory: 199 manifest sheets (58 buildings, 141 units), 13 terrain textures,
  12 presentation images. All sheet PNG signatures, metadata paths and frame
  dimensions checked; no missing paths or invalid frame division found.
- Screenshot review: title, campaign, briefing portrait, live battlefield, desktop
  and narrow title layout. The web-game skill client exercised skirmish input and
  captured two frames without console errors.
- `pnpm run verify`: typecheck and lint pass; 345 tests pass, 20 intentionally skipped.
- Initial full gameplay suite: 48 pass, 2 optional observation/soak tests skipped.
- Final full gameplay suite: **50 passed, 2 skipped (4.5m)**, including presentation
  image decoding, responsive title navigation, and world-label/HUD alignment.
- A final targeted visual check additionally waits for all 199 sprite sheets to be
  installed before capturing gameplay, so procedural fallbacks cannot pass as final art.
  Result: **2 passed (9.8s)** against the final production build.
- Retained visual receipts: `screenshots/art-review/` (title, narrow title, battlefield).

Local source and browser validation only; no deployment or Git publication performed.
The interactive preview was muted using the game's own setting during review.

## Animation follow-up

- Unit movement uses individual phases, subtle infantry stride and vehicle suspension;
  aircraft hover gently. Firing uses shot-local time, recoil that settles in 220 ms,
  and one-shot strips that return to idle rather than looping muzzle flashes.
- View animation time follows pause, briefing, lockstep holds, and game speed.
  Particle travel is analytically integrated so 30/60/120 Hz produce the same path.
- Explosions layer a warm flash, eased shock ring, fragments, and fading smoke.
  The particle pool is bounded at 512; refinery exhaust overlaps smoothly and
  building beacons pulse instead of abruptly switching.
- Title and act cards enter gently; buttons respond to presses. Reduced-motion
  preferences disable cosmetic unit motion, building accents, and menu entrances.
- Browser regression coverage checks pause/resume timing, reduced motion, and
  actual delivered firing pixels returning to idle. The skill client captured
  gameplay without console errors, and the interactive preview remains muted.

Validation: **Pass** — typecheck/lint, 348 unit tests; 52 full liveness tests
(2 optional skips); 3 final animation checks. Recorded CLI output:
`52 passed (4.5m)`, followed by `3 passed (12.1s)`.
