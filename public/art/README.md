# Delivered art assets go here

This folder is served at `/art/…` (dev) and `…/games/shard-dominion/art/…` (prod).
The engine loads sheets listed in **`manifest.json`** and slices them per each sheet's
JSON sidecar (see `../../docs/ART_ASSETS_SPEC.md`). Anything not listed keeps rendering
with the built-in procedural art — so you can add assets one at a time.

## To add an asset

1. Drop the sheet + sidecar into the matching subfolder, named `assetId__team__state.{png,json}`
   (e.g. `units/vehicle__player__move.png` + `units/vehicle__player__move.json`).
2. Add its path (no extension) to `manifest.json` → `sheets`.
3. Reload — the engine swaps it in automatically. No code changes needed.

`manifest.json` currently registers 199 sprite sheets (141 unit animation sheets and
58 building sheets), plus 12 presentation images. The renderer also loads 13 terrain
textures. Procedural rendering remains the fallback for unavailable sheets.

The presentation PNGs were replaced in the September 2026 art pass using original
generated illustrations. Their stable filenames preserve campaign and portrait
routing. `scripts/art-gen/presentation.mjs` is the older procedural fallback generator;
running it over this directory would replace the new paintings with that older style.
See `docs/ART_REVIEW_2026-09.md` for scope and validation.

Folders: `units/ buildings/ terrain/ fx/ projectiles/ ui/`
