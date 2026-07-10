# ART HANDOFF — the next session's FIRST task (2026-07-09, v0.42.0)

> **Directive from the operator:** the next session opens by producing a **detailed,
> paste-ready Gemini image-generation prompt package** covering EVERY missing art
> piece below. One prompt per asset (or per tight batch), written so the operator can
> paste them into Gemini one at a time and drop the results into `~/Code/...` for
> import. Read this file + `docs/ART_ASSETS_SPEC.md` (§0.5 single-sprite path, §0.6
> animation strips) before writing a single prompt. Then STOP and hand the operator
> the package — imports happen after they generate.

## Hard pipeline constraints (bake these into every prompt)
- **Units/buildings:** ONE sprite per image, viewed TOP-DOWN, unit facing straight UP,
  centred, generous margin, **solid pure magenta #FF00FF background** filling every
  non-sprite pixel (the loader chroma-keys by colour family — vignetted magenta is
  tolerated, but ask for flat). **PNG.** No grids, labels, drop shadows outside the
  sprite, or ground base plates — **buildings must sit FLAT with no coloured base
  platform** (the original 6 baked a purple base; their re-gen is part of this batch).
- **Animation strips (§0.6):** 4 equal-width frames, one horizontal row, SAME character
  scale/position per frame, only the pose changes; 4:1 aspect; magenta bg.
- **Terrain:** seamless, opaque, square tiles (no magenta). Existing 9-tile ground set
  is DONE — only new tiles listed below.
- **Portraits/backdrops:** normal illustrations, no magenta, 4:3 or wide.
- **Style bible:** late-1990s Westwood RTS (C&C / Red Alert / Dune 2000) — painted,
  chunky, readable at ~32–64 px, hard silhouettes, muted desert light. NOT modern
  PBR, NOT cartoon, NOT pixel-art dithering.
- **Faction palettes:** Meridian Concord = steel grey + **cyan** accents; Emberhand =
  scorched iron + **ember crimson**; Shardborn = translucent **violet crystal** +
  obsidian. Neutral = sand-bleached grey.
- **Naming for delivery:** `assetId__team__state.png` (`state` = `move` for units,
  `idle` for buildings, `walk`/`fire` for strips). Teams: `player`, `enemy`,
  `neutral` (painted per-team variants; ask Gemini to re-render with the palette
  swapped rather than hue-shifting).
- **Delivery:** operator drops the folder into `~/Code/` (NOT ~/Downloads — TCC blocks
  the terminal), then `node scripts/import-art.mjs <folder>`.

## THE GAP LIST (everything currently on procedural placeholder chassis)

### A. Units — missing entirely (need player + enemy variants unless noted)
| assetId | What it is (prompt fodder) |
|---|---|
| scout_vehicle | fast 4-wheel recon buggy, pintle gun |
| assault_tank | mid-size tracked battle tank, single cannon turret |
| longbow | tracked artillery, long single barrel, splayed recoil feet |
| skimmer_apc | boxy 8-passenger hover APC, rear ramp |
| gunship | small twin-rotor VTOL gunship, quad missile pods (draws "lifted" — keep shadowless) |
| riftmaw (neutral only) | crystalline burrower — segmented obsidian worm erupting from sand, violet shard spines |
| warden (player only) | Concord hero — heavy exo-armoured commander, cyan visor, oversized cannon |
| ghostwalker (emberhand skin only) | cloaked scout-assassin, ragged ember shroud, blade |
| vane (emberhand skin only) | Sera Vane — ash-cloaked warlord, twin pistols, crimson sash |
| harvester (enemy variant) | existing player harvester re-rendered in Emberhand crimson |

### B. Buildings — missing entirely (player + enemy unless noted)
war_factory (big garage, open bay), defense_turret (squat rotary cannon turret),
aa_turret (quad missile rack, radar dish), radar (dome + rotating dish),
processing_plant (glowing violet crucible + stacks), skypad (landing pad + fuel rig),
wall (1-tile modular segment), gate (wall segment with sliding doors),
bunker (sandbagged pillbox, firing slits), infirmary (red-cross field hospital),
machine_shop (crane + parts yard), derrick (neutral pumpjack), relay (neutral —
violet crystal antenna array), wreck (neutral — burnt hull husk decal).

### C. Re-generation — the purple-base fix (open thread since v0.20)
The 6 ORIGINAL buildings (construction_yard, barracks ×2 teams, refinery ×2,
power_node) baked a purple base platform that reads wrongly on sand. Re-gen all with:
"no coloured base — the structure sits flat on bare ground, background pure #FF00FF
to its exact footprint."

### D. Animation strips (§0.6 — engine already supports frames+fps sidecars)
walk ×4 frames: infantry, rocket_trooper, ghostwalker · drive ×4 (tread/wheel motion):
harvester, scout_vehicle, assault_tank · fire ×2 (recoil): infantry, assault_tank,
longbow. Player team first; enemy variants after the set proves in-engine.

### E. Faction skins (stat identities exist; visuals don't)
Emberhand + Shardborn re-renders of: infantry, rocket_trooper, harvester, barracks,
refinery, defense_turret (the minimum set that makes a faction LOOK owned).
Shardborn brief: grown-not-built — crystal extrusions, no straight edges.

### F. Presentation art (no magenta — plain illustrations)
| Piece | Spec |
|---|---|
| Title backdrop | wide painted vista: shard-veined desert at dusk, distant refinery silhouettes, violet storm on the horizon |
| Briefing portraits ×6 | Warden (helmeted, cyan visor), Marshal Corr (grey-templed, weathered), Sera Vane (ash-marked, crimson), Director Halex (cold corporate), Broker Yssel (ornate, smiling), The Chorus (a shard-touched face, crystal growths, wrong eyes) — bust, 3/4 view, painted, dark neutral background, ~square |
| Act cards ×2 | Act I "Operation Aether Prime" (Concord dropships over desert) · Act II "The Waking Deep" (Emberhand silhouettes before a glowing vein) |
| Credits backdrop | the First Vein — a vast glowing fissure, tiny figures at its rim |

### G. New terrain (only if Gemini handles seamless tiles well — else skip)
scorched-field tile (post-Cauterize blackened sand), crystal-lattice tile (Shardborn
creep ground).

## After the operator generates
Import order that proves the pipeline fastest: C (re-gens, replaces existing) → A
core units → B buildings → D strips (needs sidecar wiring — the importing session
splits strips + writes `frames`/`fps` sidecars) → E skins → F presentation (F needs
NEW view wiring: title/briefing/mission-select image slots — small view-layer work,
budget it). Verify per batch: `pnpm run verify` + `pnpm run test:live` + a screenshot
probe; art must never touch the sim.
