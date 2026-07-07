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

There is **no `manifest.json` yet on purpose** — until one exists the game stays fully
procedural. Copy `manifest.example.json` to `manifest.json` when the first asset lands.

Folders: `units/ buildings/ terrain/ fx/ projectiles/ ui/`
