# ASSETS.md — provenance and licensing of every non-code asset

Required by the speedrungames portal contract (`docs/browser-game-template-contract.md`):
one row per asset bucket with source, license, and attribution. Everything shipped under
`public/art/` is produced by this repository's own tooling from this repository's own
prompts/code; **no third-party artwork, sound, or font files are included.**

| Bucket (path) | What | How it was made | License / attribution |
|---|---|---|---|
| `public/art/units/*.png` + `.json` | Unit sprite sheets (idle/move/fire strips, per-team + per-faction recolours) | Base images: xAI **Grok Imagine** (`grok-imagine-image-quality`, text→image; recolours via the image-edit endpoint) driven by `scripts/gen-art-grok.mjs` from the repo-authored prompt set `scripts/art-prompts.json`. Post-processed in-repo: `scripts/recolor-faction.py`, animation strips assembled by `scripts/art-gen/strips.mjs`, imported + sliced by `scripts/import-art.mjs` (sidecar JSON is generated metadata). Landed in commit `7134003`. | Project-owned. AI-generated from original prompts written for this game; no third-party images were supplied as inputs. Used under xAI's terms for generated outputs. |
| `public/art/buildings/*.png` + `.json` | Structure sheets (idle pulse strips, per-team/faction) | Same pipeline as units (`7134003`). | Same as units. |
| `public/art/terrain/*.png` | Seamless 128×128 terrain tiles ("Obsidian Bloom" set), overlay stamps (scorched, crystal lattice) | Code-drawn on canvas by `scripts/art-gen/terrain.mjs` (commits `8e3e163`, `9837313`). | Project-owned original code art (repo license). |
| `public/art/presentation/*.png` | Title backdrop, Act I–IV cards, credits backdrop, six character portraits | Code-drawn SVG rendered by `scripts/art-gen/presentation.mjs` (Acts III/IV added 2026-09-05). | Project-owned original code art (repo license). |
| `public/art/manifest.json`, `manifest.example.json`, `README.md` | Sheet registry + docs | Written by `scripts/import-art.mjs` / by hand. | Project-owned. |
| Audio | All SFX, EVA voice lines and music | **No audio files.** Procedural Web Audio synthesis in `src/view/audio.ts` and `speechSynthesis` for EVA (`src/view/eva.ts`). | n/a (code). |
| Fonts | UI text | System `monospace` stack only; no bundled font files. | n/a. |
| In-engine fallback art | Procedural unit/building/terrain drawing when a sheet is missing | `src/view/spritebank.ts`, `src/view/renderer.ts`. | Code (repo license). |

## Historical note (so the docs don't mislead)
`HANDOFF.md`'s art section (2026-07-11) describes an all-code-drawn 89-asset set; that set
was superseded on 2026-07-19 (`7134003`) for **units and buildings only**, which are now
Grok-generated painted sprites. Terrain and presentation art remain code-drawn. Earlier
experimental drops (`art-drop*/`) are working folders, not shipped assets.

## Not shipped
Nothing under `art-drop*/`, `screenshots/`, or `docs/` is served by the game.
