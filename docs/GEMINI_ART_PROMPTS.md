# Gemini Art Prompt Package — Shard Dominion (2026-07-10, for v0.42.0)

> **What this is:** one paste-ready Gemini prompt per missing art asset, covering the full
> gap list in `docs/ART_HANDOFF.md`, honoring the §0.5 single-sprite + §0.6 strip pipeline
> in `docs/ART_ASSETS_SPEC.md`. Work through the batches **in order** (Batch 1 proves the
> pipeline fastest). Every prompt is fully self-contained — paste it into Gemini as-is.

## How to use (operator workflow)

1. Paste **one prompt per Gemini turn**. Download the result as **PNG** and save it under
   the exact **Save as:** filename given with each prompt.
2. For assets that need an enemy variant, paste the **ENEMY REPAINT follow-up** (below)
   into the **same Gemini chat** right after the player sprite, and save under the enemy
   filename. Re-rendering in-chat keeps the chassis identical; never hue-shift in an editor.
3. **Re-roll, don't settle** if the output has: a shadow on the ground, a coloured base
   platform under a building, a background that isn't flat magenta, more than one object,
   grid lines, or text. Slightly vignetted magenta is tolerated (the loader chroma-keys by
   colour family), but flat is better.
4. Collect everything in one folder **under `~/Code/`** (e.g. `~/Code/art-drop-2026-07/`) —
   **NOT `~/Downloads` or `~/Desktop`** (macOS TCC blocks the terminal from reading them).
5. Tell Claude the folder path. Import is `node scripts/import-art.mjs <folder>` plus, for
   animation strips, sidecar wiring done by the importing session. Art never touches the sim.

### ENEMY REPAINT follow-up (reusable — paste after any player sprite, same chat)

> Keep exactly the same vehicle/structure, same pose, same top-down camera, same painted
> late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the
> faction colours only: the dusty steel blue-grey armour becomes scorched red-iron
> (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan
> accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

### Palette reference (baked into the prompts — for your eyeball QA)

| Variant | Main | Shadow | Highlight | Glow |
|---|---|---|---|---|
| player (Meridian Concord) | `#3d7fd6` steel blue-grey | `#28568f` | `#a7d6ff` | `#00e5ff` cyan |
| enemy (Emberhand red) | `#d1503a` scorched iron | `#8f3020` | `#ffb08f` | `#ff4a3d` crimson |
| neutral | `#9a9a9a` sand-bleached grey | `#6a6a6a` | `#d8d8d8` | — |
| Shardborn (skins, Batch 5) | translucent violet crystal `#b49bd8`→`#e6d4ff` | obsidian `#3c3630` | — | violet inner glow |

**Why units are pure top-down but buildings get a little depth:** the engine ROTATES unit
sprites to their heading (a tilted unit sprite breaks when rotated), while buildings are
static (so a lit roof + darker front face makes them read as tall).

---

# BATCH 1 — Purple-base re-gens (the 6 originals; do these first)

The original 6 buildings baked a purple base platform that reads wrongly on sand. Same
buildings, re-generated to sit flat. 4 prompts + 2 repaints = 6 images.

### 1.1 Construction Yard
**Save as:** `construction_yard__neutral__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a heavy
> construction yard — the biggest, heaviest structure on a desert base: a broad industrial
> platform building with a large roof-mounted crane arm with a hook, fold-out panel seams,
> a small blinking red hazard beacon, vents and machinery details. Viewed from almost
> directly above with a slight three-quarter depth: the roof brightly lit, the front
> (lower) face a little darker so it reads as having height. Muted desert sunlight from the
> upper left, soft shading painted into the sprite, NO shadow cast on the ground. Paint it
> in neutral sand-bleached grey metal (main #9a9a9a, shadow #6a6a6a, highlight #d8d8d8),
> dusty and sand-worn, with a thin dark outline rim. The structure sits FLAT with
> absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat
> pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint.
> No gradient, no vignette, no grid, no text. One building only, centred, generous margin.
> Square PNG.

### 1.2 Barracks
**Save as:** `barracks__player__idle.png` → then ENEMY REPAINT → `barracks__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a military
> infantry barracks — a blocky low bunker building with a lit doorway that troops march out
> of, a ridged roof with vents, sandbag details at the walls. Viewed from almost directly
> above with a slight three-quarter depth: the roof brightly lit, the front (lower) face a
> little darker so it reads as having height. Muted desert sunlight from the upper left,
> soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty
> steel blue-grey armour plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with
> glowing cyan accent lights (#00e5ff), sand-worn finish, thin dark outline rim. The
> structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile
> beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure,
> right up to its footprint. No gradient, no vignette, no grid, no text. One building only,
> centred, generous margin. Square PNG.

### 1.3 Refinery
**Save as:** `refinery__player__idle.png` → then ENEMY REPAINT → `refinery__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: an ore refinery
> — a wide industrial structure with two vertical silo tanks, a low open docking bay where
> a hauler truck unloads, pipework connecting silos to the bay, a small exhaust stack, and
> a faint purple crystal glow inside the intake hopper. Viewed from almost directly above
> with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little
> darker so it reads as having height. Muted desert sunlight from the upper left, soft
> shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel
> blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan
> accent lights (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT
> with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat
> pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint.
> No gradient, no vignette, no grid, no text. One building only, centred, generous margin.
> Wide-ish square PNG.

### 1.4 Power Node
**Save as:** `power_node__player__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a compact power
> pylon node — a small squat generator housing with cooling fins and a tall thin antenna
> mast whose tip light glows. Viewed from almost directly above with a slight three-quarter
> depth: the top brightly lit, the front (lower) face a little darker so it reads as having
> height. Muted desert sunlight from the upper left, soft shading painted into the sprite,
> NO shadow cast on the ground. Faction paint: dusty steel blue-grey plating (main #3d7fd6,
> shadow #28568f, highlight #a7d6ff) with a glowing cyan tip light and accents (#00e5ff),
> sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base
> platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF
> fills every pixel outside the structure, right up to its footprint. No gradient, no
> vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

---

# BATCH 2 — Missing units (10 prompts → 15 images)

All unit sprites: **pure top-down, facing straight UP**, one sprite, magenta background —
the engine rotates them to heading and adds the contact shadow itself.

### 2.1 Scout Vehicle
**Save as:** `scout_vehicle__player__move.png` → ENEMY REPAINT → `scout_vehicle__enemy__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a fast four-wheel
> military recon buggy — open lightweight frame, chunky off-road tyres, a roll cage, and a
> small pintle-mounted machine gun behind the driver. Viewed from DIRECTLY ABOVE (pure
> top-down), the buggy facing straight up, exactly one vehicle, centred with a generous
> empty margin on all sides. Muted desert sunlight from the upper left, soft shading
> painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel
> blue-grey bodywork (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with small glowing
> cyan accent lights (#00e5ff), sand-worn battle finish, thin dark outline rim. Background:
> every pixel outside the vehicle is solid flat pure magenta #FF00FF — no gradient, no
> vignette, no ground, no base plate, no grid, no text. Square PNG.

### 2.2 Assault Tank
**Save as:** `assault_tank__player__move.png` → ENEMY REPAINT → `assault_tank__enemy__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a mid-size tracked
> main battle tank — wedge-shaped glacis hull, wide treads with side skirts, a circular
> turret with a hatch and a single long forward cannon barrel with a bright muzzle band,
> rear engine deck with louvres. Clearly bigger and heavier than a light scout tank. Viewed
> from DIRECTLY ABOVE (pure top-down), the tank facing straight up with the barrel pointing
> up, exactly one vehicle, centred with a generous empty margin. Muted desert sunlight from
> the upper left, soft shading painted into the sprite, NO shadow cast on the ground.
> Faction paint: dusty steel blue-grey armour (main #3d7fd6, shadow #28568f, highlight
> #a7d6ff) with a glowing cyan muzzle band and accents (#00e5ff), sand-worn battle finish,
> thin dark outline rim. Background: every pixel outside the vehicle is solid flat pure
> magenta #FF00FF — no gradient, no vignette, no ground, no base plate, no grid, no text.
> Square PNG.

### 2.3 Longbow (artillery)
**Save as:** `longbow__player__move.png` → ENEMY REPAINT → `longbow__enemy__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a tracked
> long-range artillery vehicle — a low tracked chassis carrying one very long single
> artillery barrel pointing forward, with four splayed hydraulic recoil stabilizer feet
> folded at its corners and an ammunition rack behind the gun mount. The extremely long
> barrel is its signature. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up
> with the barrel pointing up, exactly one vehicle, centred with a generous empty margin.
> Muted desert sunlight from the upper left, soft shading painted into the sprite, NO
> shadow cast on the ground. Faction paint: dusty steel blue-grey armour (main #3d7fd6,
> shadow #28568f, highlight #a7d6ff) with glowing cyan accents (#00e5ff), sand-worn battle
> finish, thin dark outline rim. Background: every pixel outside the vehicle is solid flat
> pure magenta #FF00FF — no gradient, no vignette, no ground, no base plate, no grid, no
> text. Square PNG.

### 2.4 Skimmer APC
**Save as:** `skimmer_apc__player__move.png` → ENEMY REPAINT → `skimmer_apc__enemy__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a boxy hover
> armoured personnel carrier for eight passengers — a slab-sided rectangular hull riding on
> glowing hover skirts instead of wheels, a rear loading ramp, small viewports along the
> sides, a low profile sensor mast. Utilitarian troop bus, not a gun platform. Viewed from
> DIRECTLY ABOVE (pure top-down), facing straight up, exactly one vehicle, centred with a
> generous empty margin. Muted desert sunlight from the upper left, soft shading painted
> into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey
> armour (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with the hover skirts glowing
> cyan (#00e5ff), sand-worn finish, thin dark outline rim. Background: every pixel outside
> the vehicle is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no
> base plate, no grid, no text. Square PNG.

### 2.5 Gunship
**Save as:** `gunship__player__move.png` → ENEMY REPAINT → `gunship__enemy__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a small twin-rotor
> VTOL attack gunship seen from above — two side-mounted rotor pods (rotor discs drawn as
> translucent blur circles), a narrow armed fuselage with a cockpit canopy at the front,
> and four missile pods slung under stub wings. Viewed from DIRECTLY ABOVE (pure top-down),
> facing straight up, exactly one aircraft, centred with a generous empty margin. Muted
> desert sunlight from the upper left, soft shading painted into the sprite, and ABSOLUTELY
> NO shadow on the ground — the game engine draws the flying-height shadow itself. Faction
> paint: dusty steel blue-grey fuselage (main #3d7fd6, shadow #28568f, highlight #a7d6ff)
> with glowing cyan canopy and accents (#00e5ff), sand-worn finish, thin dark outline rim.
> Background: every pixel outside the aircraft is solid flat pure magenta #FF00FF — no
> gradient, no vignette, no ground, no grid, no text. Square PNG.

### 2.6 Riftmaw (neutral creep — single variant)
**Save as:** `riftmaw__neutral__move.png`

> A single video-game monster sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline
> burrower creature — a segmented obsidian-black worm bursting upward out of the ground,
> jaws open, its back armoured with rows of jagged translucent violet crystal spines that
> glow from within (crystal tones from #b49bd8 to #e6d4ff over near-black obsidian #3c3630
> plating). A small spray of erupted sand debris may be part of the creature's silhouette,
> but nothing else touches the background. Viewed from DIRECTLY ABOVE (pure top-down), the
> creature oriented straight up, exactly one creature, centred with a generous empty
> margin. Muted desert sunlight from the upper left, soft shading painted into the sprite,
> NO shadow cast on the ground. Thin dark outline rim. Background: every pixel outside the
> creature is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground plane,
> no grid, no text. Square PNG.

### 2.7 Warden (player hero — single variant)
**Save as:** `warden__player__move.png`

> A single video-game hero-unit sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a heavy
> exo-armoured commander on foot — bulky powered armour with oversized shoulder plates, a
> helmet with a glowing cyan visor slit, and an oversized two-handed cannon held forward.
> Visibly bigger and bulkier than a normal infantry soldier. Viewed from DIRECTLY ABOVE
> (pure top-down), facing straight up with the cannon pointing up, exactly one figure,
> centred with a generous empty margin. Muted desert sunlight from the upper left, soft
> shading painted into the sprite, NO shadow cast on the ground. Faction paint: steel
> blue-grey powered armour (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with the visor
> and armour seams glowing cyan (#00e5ff), sand-worn finish, thin dark outline rim.
> Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no
> gradient, no vignette, no ground, no grid, no text. Square PNG.

### 2.8 Ghostwalker (Emberhand stealth unit — single variant)
**Save as:** `ghostwalker__emberhand__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a cloaked
> scout-assassin on foot — a lean figure wrapped in a ragged, tattered shroud-cloak, a long
> curved blade held low in one hand, ash-stained wrappings, a half-mask. Viewed from
> DIRECTLY ABOVE (pure top-down), facing straight up, exactly one figure, centred with a
> generous empty margin. Muted desert sunlight from the upper left, soft shading painted
> into the sprite, NO shadow cast on the ground. Faction paint: scorched dark iron and
> ash-black cloth (main #d1503a on the armour pieces, shadow #8f3020, highlight #ffb08f)
> with faint ember-crimson glowing embers along the cloak edge (#ff4a3d), thin dark outline
> rim. Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no
> gradient, no vignette, no ground, no grid, no text. Square PNG.

### 2.9 Sera Vane (Emberhand hero — single variant)
**Save as:** `vane__emberhand__move.png`

> A single video-game hero-unit sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: an ash-cloaked
> desert warlord on foot — a commanding figure in a long ash-grey cloak with a bright
> crimson sash across the chest, dual pistols held forward one in each hand, light scorched
> armour plates at the shoulders. Viewed from DIRECTLY ABOVE (pure top-down), facing
> straight up with both pistols pointing up, exactly one figure, centred with a generous
> empty margin. Muted desert sunlight from the upper left, soft shading painted into the
> sprite, NO shadow cast on the ground. Faction paint: scorched red-iron armour (main
> #d1503a, shadow #8f3020, highlight #ffb08f) with the sash and small accents in glowing
> ember crimson (#ff4a3d), ash-dusted finish, thin dark outline rim. Background: every
> pixel outside the figure is solid flat pure magenta #FF00FF — no gradient, no vignette,
> no ground, no grid, no text. Square PNG.

### 2.10 Harvester — enemy variant (the player one already exists)
**Save as:** `harvester__enemy__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a chunky tracked
> ore-hauler harvester — the biggest ground vehicle: very wide treads, a large ribbed cargo
> hopper on the back with a yellow-and-black hazard stripe along its lip, a front intake
> scoop blade, an exhaust stack, and a faint purple crystal glow inside the hopper. Dusty
> industrial economy vehicle, not a war machine. Viewed from DIRECTLY ABOVE (pure
> top-down), facing straight up with the scoop at the top, exactly one vehicle, centred
> with a generous empty margin. Muted desert sunlight from the upper left, soft shading
> painted into the sprite, NO shadow cast on the ground. Faction paint: scorched red-iron
> bodywork (main #d1503a, shadow #8f3020, highlight #ffb08f) with small ember-crimson
> accent lights (#ff4a3d), sand-worn finish, thin dark outline rim. Background: every pixel
> outside the vehicle is solid flat pure magenta #FF00FF — no gradient, no vignette, no
> ground, no base plate, no grid, no text. Square PNG.

*(Optional extra while you're here: an MCV enemy variant also doesn't exist —
ENEMY-REPAINT the existing player MCV design if Gemini can be shown it, or skip; the AI
rarely shows one.)*

---

# BATCH 3 — Missing buildings (14 prompts → 25 images)

All buildings use the **slight three-quarter depth** (lit roof, darker front face) and the
**flat-no-base rule**. Player prompt first, then the ENEMY REPAINT follow-up in the same
chat, except the three neutral ones.

> **Shared building boilerplate** — every prompt below already contains it, but for
> re-rolls, the non-negotiables are: *painted late-90s Westwood RTS style; viewed from
> almost directly above with slight three-quarter depth (lit roof, darker lower front
> face); desert sun upper-left; NO ground shadow; sits FLAT — NO base platform, NO concrete
> pad, NO ground tile; solid flat pure magenta #FF00FF everywhere outside the structure;
> one building, centred, generous margin; square PNG.*

### 3.1 War Factory
**Save as:** `war_factory__player__idle.png` → ENEMY REPAINT → `war_factory__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a vehicle war
> factory — a big industrial garage building with one large open assembly bay door at the
> front, an overhead gantry crane visible inside the bay, corrugated roof panels, tall
> vents, and hazard striping around the bay opening. Viewed from almost directly above with
> a slight three-quarter depth: the roof brightly lit, the front (lower) face and open bay
> a little darker so it reads as having height. Muted desert sunlight from the upper left,
> soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty
> steel blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing
> cyan accent lights (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits
> FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid
> flat pure magenta #FF00FF fills every pixel outside the structure, right up to its
> footprint. No gradient, no vignette, no grid, no text. One building only, centred,
> generous margin. Square PNG.

### 3.2 Defense Turret
**Save as:** `defense_turret__player__idle.png` → ENEMY REPAINT → `defense_turret__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a squat
> anti-ground defense turret — a short armoured drum pedestal topped by a rotary multi-
> barrel cannon in a compact armoured housing, ammo feed chutes, small armour skirts around
> the pedestal base. The cannon points straight up (north). Viewed from almost directly
> above with a slight three-quarter depth: the top brightly lit, the front (lower) face a
> little darker. Muted desert sunlight from the upper left, soft shading painted into the
> sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey armour (main
> #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan accents (#00e5ff),
> sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base
> platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF
> fills every pixel outside the structure, right up to its footprint. No gradient, no
> vignette, no grid, no text. One turret only, centred, generous margin. Square PNG.

### 3.3 AA Turret
**Save as:** `aa_turret__player__idle.png` → ENEMY REPAINT → `aa_turret__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: an anti-air
> missile turret — a short armoured pedestal carrying a quad missile rack (four boxy
> missile tubes in a 2×2 cluster) angled slightly skyward, with a small radar dish on a
> side arm. The rack points straight up (north). Viewed from almost directly above with a
> slight three-quarter depth: the top brightly lit, the front (lower) face a little darker.
> Muted desert sunlight from the upper left, soft shading painted into the sprite, NO
> shadow cast on the ground. Faction paint: dusty steel blue-grey armour (main #3d7fd6,
> shadow #28568f, highlight #a7d6ff) with glowing cyan accents (#00e5ff) and yellow warhead
> tips, sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO
> base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta
> #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient,
> no vignette, no grid, no text. One turret only, centred, generous margin. Square PNG.

### 3.4 Radar
**Save as:** `radar__player__idle.png` → ENEMY REPAINT → `radar__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a radar station
> — a reinforced dome building with a large rotating radar dish mounted on top on a pivot
> arm, plus a small antenna cluster and cable conduits running down the dome. Viewed from
> almost directly above with a slight three-quarter depth: the dome brightly lit, the front
> (lower) face a little darker. Muted desert sunlight from the upper left, soft shading
> painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel
> blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan
> accents (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with
> absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure
> magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No
> gradient, no vignette, no grid, no text. One building only, centred, generous margin.
> Square PNG.

### 3.5 Processing Plant
**Save as:** `processing_plant__player__idle.png` → ENEMY REPAINT → `processing_plant__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystal
> processing plant — an industrial refinery structure built around a central open crucible
> vat glowing bright violet (molten crystal, tones #b49bd8 to #e6d4ff), with two smoke
> stacks, pipework feeding the crucible, and a small control cabin. The violet glow is its
> signature. Viewed from almost directly above with a slight three-quarter depth: the roof
> brightly lit, the front (lower) face a little darker. Muted desert sunlight from the
> upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction
> paint: dusty steel blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff)
> with cyan accent lights (#00e5ff), sand-worn finish, thin dark outline rim. The structure
> sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it —
> solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its
> footprint. No gradient, no vignette, no grid, no text. One building only, centred,
> generous margin. Square PNG.

### 3.6 Skypad
**Save as:** `skypad__player__idle.png` → ENEMY REPAINT → `skypad__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a VTOL landing
> pad — a low octagonal landing platform with a painted landing circle and edge lights,
> flanked on one side by a small fuel rig: pump housing, hoses, and two small fuel tanks.
> The platform is a built structure raised only slightly, NOT a patch of ground. Viewed
> from almost directly above with a slight three-quarter depth: the pad surface brightly
> lit, its front (lower) edge a little darker. Muted desert sunlight from the upper left,
> soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty
> steel blue-grey deck plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with the
> landing circle and edge lights glowing cyan (#00e5ff), sand-worn finish, thin dark
> outline rim. The structure sits FLAT with absolutely NO extra base platform, NO concrete
> apron, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel
> outside the structure, right up to its footprint. No gradient, no vignette, no grid, no
> text. One structure only, centred, generous margin. Square PNG.

### 3.7 Wall segment
**Save as:** `wall__player__idle.png` → ENEMY REPAINT → `wall__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: ONE straight
> modular defensive wall segment — a thick armoured concrete-and-steel barrier wall, seen
> from almost directly above, running perfectly horizontally ALL THE WAY from the left edge
> of the image to the right edge (so identical segments butt together seamlessly side by
> side), with panel seams, rivet lines, and a slightly lit top face with a darker front
> (lower) face. Muted desert sunlight from the upper left, soft shading painted into the
> sprite, NO shadow cast on the ground. Faction paint: dusty steel-grey armour with a
> blue-grey trim stripe (#3d7fd6, shadow #28568f) and tiny cyan marker lights (#00e5ff),
> sand-worn finish, thin dark outline rim. NO base platform and NO ground beneath it —
> solid flat pure magenta #FF00FF fills all pixels above and below the wall segment. The
> wall itself must touch the left and right image edges. No gradient, no grid, no text.
> Wide rectangular PNG, roughly 1:1 to 2:1.

### 3.8 Gate
**Save as:** `gate__player__idle.png` → ENEMY REPAINT → `gate__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: ONE armoured
> gate segment matching a modular defensive wall — the same thick armoured barrier wall
> running perfectly horizontally from the left edge of the image to the right edge, but its
> central section is a pair of heavy sliding blast doors that meet in the middle (closed),
> with hazard striping on the door edges and a small gatehouse light. Seen from almost
> directly above, top face lit, front (lower) face darker. Muted desert sunlight from the
> upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction
> paint: dusty steel-grey armour with blue-grey trim (#3d7fd6, shadow #28568f) and cyan
> marker lights (#00e5ff), sand-worn finish, thin dark outline rim. NO base platform and NO
> ground — solid flat pure magenta #FF00FF fills all pixels above and below the segment,
> which must touch the left and right image edges. No gradient, no grid, no text. Wide
> rectangular PNG, roughly 1:1 to 2:1.

### 3.9 Bunker
**Save as:** `bunker__player__idle.png` → ENEMY REPAINT → `bunker__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: an infantry
> pillbox bunker — a low round concrete pillbox ringed with sandbags, with narrow dark
> horizontal firing slits on all sides and a reinforced hatch on the roof. Viewed from
> almost directly above with a slight three-quarter depth: the roof brightly lit, the front
> (lower) face a little darker. Muted desert sunlight from the upper left, soft shading
> painted into the sprite, NO shadow cast on the ground. Mostly bare weathered concrete and
> sandbags, with a dusty steel blue-grey hatch and trim (#3d7fd6, shadow #28568f) and one
> small cyan lamp (#00e5ff), thin dark outline rim. The structure sits FLAT with absolutely
> NO base platform, NO concrete pad extending beyond the sandbag ring, NO ground tile —
> solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its
> footprint. No gradient, no vignette, no grid, no text. One bunker only, centred, generous
> margin. Square PNG.

### 3.10 Infirmary
**Save as:** `infirmary__player__idle.png` → ENEMY REPAINT → `infirmary__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a field hospital
> infirmary — a low medical building: half rigid prefab module, half canvas field-tent
> extension, with a large red cross painted on the flat roof, a stretcher rack by the door,
> and a small air-filtration unit. Viewed from almost directly above with a slight
> three-quarter depth: the roof brightly lit, the front (lower) face a little darker. Muted
> desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast
> on the ground. Faction paint: sand-toned canvas plus dusty steel blue-grey prefab plating
> (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with a small cyan lamp (#00e5ff) and
> the red cross in warning red, thin dark outline rim. The structure sits FLAT with
> absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure
> magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No
> gradient, no vignette, no grid, no text. One building only, centred, generous margin.
> Square PNG.

### 3.11 Machine Shop
**Save as:** `machine_shop__player__idle.png` → ENEMY REPAINT → `machine_shop__enemy__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a vehicle repair
> machine shop — an open-sided workshop structure with a small overhead crane arm on a
> gantry, a parts yard beside it (stacked crates, spare tank treads, barrels, a spare
> turret), a workbench, and an arc-welding glow inside. Viewed from almost directly above
> with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little
> darker. Muted desert sunlight from the upper left, soft shading painted into the sprite,
> NO shadow cast on the ground. Faction paint: dusty steel blue-grey structure (main
> #3d7fd6, shadow #28568f, highlight #a7d6ff) with cyan accent lights (#00e5ff), hazard-
> yellow crane arm, sand-worn finish, thin dark outline rim. The structure and its parts
> yard sit FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath
> them — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up
> to its footprint. No gradient, no vignette, no grid, no text. One building only, centred,
> generous margin. Square PNG.

### 3.12 Derrick (neutral)
**Save as:** `derrick__neutral__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a neutral
> capturable pumpjack derrick — a classic oil-well pumpjack with a nodding beam head, a
> small lattice frame, a drive motor housing, one storage tank, and connecting pipes.
> Abandoned, rusty, weather-beaten. Viewed from almost directly above with a slight
> three-quarter depth: the top brightly lit, the front (lower) face a little darker. Muted
> desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast
> on the ground. Paint: neutral sand-bleached grey metal (main #9a9a9a, shadow #6a6a6a,
> highlight #d8d8d8) with rust streaks and faded hazard yellow, thin dark outline rim. The
> structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile
> beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure,
> right up to its footprint. No gradient, no vignette, no grid, no text. One structure
> only, centred, generous margin. Square PNG.

### 3.13 Relay (neutral)
**Save as:** `relay__neutral__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a mysterious
> neutral crystal relay — an antenna array of three tall translucent violet crystal spires
> (glowing from within, tones #b49bd8 to #e6d4ff) growing out of a cracked obsidian-black
> mound base (#3c3630), ringed by a few smaller crystal shards, with faint arcs of violet
> energy between the spire tips. Grown, not built — no straight machined edges on the
> crystals. Viewed from almost directly above with a slight three-quarter depth: tops lit,
> lower faces darker. Muted desert sunlight from the upper left plus the violet inner glow,
> soft shading painted into the sprite, NO shadow cast on the ground. Thin dark outline
> rim. The formation sits FLAT with absolutely NO base platform and NO ground tile beneath
> it — solid flat pure magenta #FF00FF fills every pixel outside the formation, right up to
> its footprint. No gradient, no vignette, no grid, no text. One formation only, centred,
> generous margin. Square PNG.

### 3.14 Wreck (neutral decal)
**Save as:** `wreck__neutral__idle.png`

> A single video-game sprite for a late-1990s Westwood-style desert RTS (Command & Conquer,
> Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a
> modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: the burnt-out wreck of a
> destroyed military vehicle — a blackened, gutted tank hull husk: scorched charcoal metal,
> torn plating peeled open, a collapsed turret askew, ash and char tones with a few faint
> dying orange embers deep in the hull. Flat and dead — this is battlefield debris. Viewed
> from DIRECTLY ABOVE (pure top-down), exactly one wreck, centred with a generous empty
> margin. Muted desert sunlight from the upper left, soft shading painted into the sprite,
> NO shadow cast on the ground. Charcoal and gunmetal tones (#3c3630, #33363b, #6a6a6a),
> thin dark outline rim. Background: every pixel outside the wreck is solid flat pure
> magenta #FF00FF — no gradient, no vignette, no scorched ground ring, no grid, no text.
> Square PNG.

---

# BATCH 4 — Animation strips (§0.6 — 9 prompts, player team first)

All strips: **frames side by side in ONE horizontal row, identical character and scale in
every frame, facing straight up, magenta background.** Walk/drive = 4 frames (4:1 wide
image); fire = 2 frames (2:1). Enemy variants come later, after these prove in-engine.
The importing session splits strips and writes the `frames`/`fps` sidecars.

### 4.1 Infantry walk
**Save as:** `infantry__player__walk.png`

> A 4-frame walk-cycle sprite strip of the SAME character for a late-1990s Westwood-style
> desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern
> 3D, NOT cartoon. The character: a small sci-fi desert infantry soldier — helmet, backpack,
> shoulder pads, rifle held forward — in dusty steel blue-grey armour (#3d7fd6, shadow
> #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up.
> FOUR frames side by side in one horizontal row, identical character, size, and position
> in each frame — only the legs and arms change mid-stride between frames to make a walking
> loop. Character centred in each quarter of the image, legs clearly visible. Solid flat
> pure magenta #FF00FF background filling every non-character pixel. No shadows outside the
> character, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

### 4.2 Rocket Trooper walk
**Save as:** `rocket_trooper__player__walk.png`

> A 4-frame walk-cycle sprite strip of the SAME character for a late-1990s Westwood-style
> desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern
> 3D, NOT cartoon. The character: a small sci-fi desert soldier carrying a fat twin-tube
> rocket launcher over one shoulder with yellow warhead tips — helmet, backpack — in dusty
> steel blue-grey armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from
> DIRECTLY ABOVE, facing straight up. FOUR frames side by side in one horizontal row,
> identical character, size, and position in each frame — only the legs and free arm change
> mid-stride between frames to make a walking loop; the launcher stays steady on the
> shoulder. Character centred in each quarter of the image, legs clearly visible. Solid
> flat pure magenta #FF00FF background filling every non-character pixel. No shadows
> outside the character, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect
> ratio. PNG.

### 4.3 Ghostwalker walk (Emberhand)
**Save as:** `ghostwalker__emberhand__walk.png`

> A 4-frame walk-cycle sprite strip of the SAME character for a late-1990s Westwood-style
> desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern
> 3D, NOT cartoon. The character: a cloaked scout-assassin — lean figure in a ragged
> tattered shroud-cloak, long curved blade held low, ash-stained wrappings, scorched
> red-iron armour pieces (#d1503a, shadow #8f3020) with faint ember-crimson glows (#ff4a3d)
> — viewed from DIRECTLY ABOVE, facing straight up. FOUR frames side by side in one
> horizontal row, identical character, size, and position in each frame — only the legs and
> the cloak's trailing edge change mid-stride between frames to make a stalking walk loop.
> Character centred in each quarter of the image. Solid flat pure magenta #FF00FF
> background filling every non-character pixel. No shadows outside the character, no grid
> lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

### 4.4 Harvester drive
**Save as:** `harvester__player__drive.png`

> A 4-frame drive-animation sprite strip of the SAME vehicle for a late-1990s
> Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style
> — NOT modern 3D, NOT cartoon. The vehicle: a chunky tracked ore-hauler harvester — very
> wide treads, a big ribbed rear hopper with a yellow-and-black hazard stripe, front intake
> scoop, exhaust stack, faint purple glow in the hopper — in dusty steel blue-grey paint
> (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing
> straight up. FOUR frames side by side in one horizontal row, identical vehicle, size, and
> position in each frame — the ONLY change between frames is the tread-link pattern
> shifting forward slightly each frame (rolling tracks) and a subtle exhaust puff. Vehicle
> centred in each quarter of the image. Solid flat pure magenta #FF00FF background filling
> every non-vehicle pixel. No shadows outside the vehicle, no grid lines, no frame borders,
> no labels. Wide image, 4:1 aspect ratio. PNG.

### 4.5 Scout Vehicle drive
**Save as:** `scout_vehicle__player__drive.png`

> A 4-frame drive-animation sprite strip of the SAME vehicle for a late-1990s
> Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style
> — NOT modern 3D, NOT cartoon. The vehicle: a fast four-wheel military recon buggy — open
> lightweight frame, chunky off-road tyres, roll cage, small pintle machine gun — in dusty
> steel blue-grey paint (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from
> DIRECTLY ABOVE, facing straight up. FOUR frames side by side in one horizontal row,
> identical vehicle, size, and position in each frame — the ONLY change between frames is
> the wheel-tread pattern rotating slightly each frame and a faint dust flick at the rear
> wheels (kept inside the sprite silhouette). Vehicle centred in each quarter of the image.
> Solid flat pure magenta #FF00FF background filling every non-vehicle pixel. No shadows
> outside the vehicle, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect
> ratio. PNG.

### 4.6 Assault Tank drive
**Save as:** `assault_tank__player__drive.png`

> A 4-frame drive-animation sprite strip of the SAME vehicle for a late-1990s
> Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style
> — NOT modern 3D, NOT cartoon. The vehicle: a mid-size tracked battle tank — wedge glacis
> hull, wide treads with side skirts, circular turret with a single long forward cannon —
> in dusty steel blue-grey armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff),
> viewed from DIRECTLY ABOVE, facing straight up with the barrel pointing up. FOUR frames
> side by side in one horizontal row, identical tank, size, and position in each frame —
> the ONLY change between frames is the tread-link pattern shifting forward slightly each
> frame (rolling tracks). Tank centred in each quarter of the image. Solid flat pure
> magenta #FF00FF background filling every non-tank pixel. No shadows outside the tank, no
> grid lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

### 4.7 Infantry fire (2-frame recoil)
**Save as:** `infantry__player__fire.png`

> A 2-frame firing-animation sprite strip of the SAME character for a late-1990s
> Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style
> — NOT modern 3D, NOT cartoon. The character: a small sci-fi desert infantry soldier —
> helmet, backpack, rifle held forward — in dusty steel blue-grey armour (#3d7fd6, shadow
> #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up,
> standing still in a firing stance. TWO frames side by side in one horizontal row,
> identical character, size, and position in each frame: FRAME 1 = aiming, ready; FRAME 2 =
> the shot — a small bright muzzle flash at the rifle tip and the shoulders rocked back
> slightly in recoil. Character centred in each half of the image. Solid flat pure magenta
> #FF00FF background filling every non-character pixel. No shadows outside the character,
> no grid lines, no frame borders, no labels. Wide image, 2:1 aspect ratio. PNG.

### 4.8 Assault Tank fire (2-frame recoil)
**Save as:** `assault_tank__player__fire.png`

> A 2-frame firing-animation sprite strip of the SAME vehicle for a late-1990s
> Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style
> — NOT modern 3D, NOT cartoon. The vehicle: a mid-size tracked battle tank — wedge hull,
> wide treads, circular turret with a single long forward cannon — in dusty steel blue-grey
> armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE,
> facing straight up with the barrel pointing up. TWO frames side by side in one horizontal
> row, identical tank, size, and position in each frame: FRAME 1 = ready; FRAME 2 = the
> shot — a bright muzzle flash at the barrel tip and the barrel recoiled back a few pixels
> into the turret. Tank centred in each half of the image. Solid flat pure magenta #FF00FF
> background filling every non-tank pixel. No shadows outside the tank, no grid lines, no
> frame borders, no labels. Wide image, 2:1 aspect ratio. PNG.

### 4.9 Longbow fire (2-frame recoil)
**Save as:** `longbow__player__fire.png`

> A 2-frame firing-animation sprite strip of the SAME vehicle for a late-1990s
> Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style
> — NOT modern 3D, NOT cartoon. The vehicle: a tracked long-range artillery vehicle — a low
> tracked chassis with one very long single artillery barrel pointing forward and four
> splayed hydraulic stabilizer feet — in dusty steel blue-grey armour (#3d7fd6, shadow
> #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up with
> the barrel pointing up. TWO frames side by side in one horizontal row, identical vehicle,
> size, and position in each frame: FRAME 1 = ready, feet planted; FRAME 2 = the shot — a
> large bright muzzle blast at the barrel tip, the barrel recoiled back along its cradle,
> and a small smoke puff (kept inside the sprite silhouette). Vehicle centred in each half
> of the image. Solid flat pure magenta #FF00FF background filling every non-vehicle pixel.
> No shadows outside the vehicle, no grid lines, no frame borders, no labels. Wide image,
> 2:1 aspect ratio. PNG.

---

# BATCH 5 — Faction skins (12 prompts; makes Emberhand + Shardborn LOOK owned)

Minimum set per faction: infantry, rocket_trooper, harvester, barracks, refinery,
defense_turret. **These are re-designs, not repaints** — Emberhand kit looks salvaged and
scorched; Shardborn kit looks GROWN, not built.
**Importer note:** filenames use faction names as the team token (`__emberhand__` /
`__shardborn__`); the loader currently knows `player/enemy/neutral`, so the importing
session budgets a small loader/manifest extension to key faction skins.

**Emberhand shared brief (baked into 5.1–5.6):** scorched dark red-iron plating (#d1503a,
shadow #8f3020, highlight #ffb08f), ash-black cloth and soot streaks, mismatched welded
salvage plates with visible weld seams and rivets, ember-crimson glows (#ff4a3d), ragged
practical silhouettes.

**Shardborn shared brief (baked into 5.7–5.12):** grown-not-built — translucent violet
crystal (#b49bd8 to #e6d4ff) with a soft violet inner glow, fused with obsidian-black
organic plating (#3c3630); flowing faceted forms with NO straight machined edges, no
bolts, no panels; looks extruded from living crystal.

### 5.1 Emberhand infantry — **Save as:** `infantry__emberhand__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a desert raider
> infantry soldier of a scavenger warband — rifle held forward, ash-black cloth wraps under
> mismatched welded salvage armour plates in scorched red-iron (#d1503a, shadow #8f3020,
> highlight #ffb08f) with visible weld seams, soot streaks, and a small ember-crimson glow
> (#ff4a3d) at the goggles; a ragged half-cape. Viewed from DIRECTLY ABOVE (pure top-down),
> facing straight up, exactly one figure, centred with a generous empty margin. Muted
> desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast
> on the ground, thin dark outline rim. Background: every pixel outside the figure is solid
> flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text.
> Square PNG.

### 5.2 Emberhand rocket trooper — **Save as:** `rocket_trooper__emberhand__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a desert raider
> rocket trooper of a scavenger warband — a fat twin-tube rocket launcher over one
> shoulder, its tubes clearly salvaged and mismatched with welded patch plates and yellow
> warhead tips; ash-black cloth wraps under scorched red-iron armour (#d1503a, shadow
> #8f3020, highlight #ffb08f) with soot streaks and a small ember-crimson glow (#ff4a3d).
> Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one figure,
> centred with a generous empty margin. Muted desert sunlight from the upper left, soft
> shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim.
> Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no
> gradient, no vignette, no ground, no grid, no text. Square PNG.

### 5.3 Emberhand harvester — **Save as:** `harvester__emberhand__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a scavenger
> warband's tracked ore-hauler harvester — the biggest ground vehicle: very wide treads, a
> big ribbed rear hopper, a front intake scoop, an exhaust stack — but built from salvage:
> mismatched welded plates in scorched red-iron (#d1503a, shadow #8f3020, highlight
> #ffb08f), soot-blackened exhaust, chained-on spare parts, a faded hazard stripe on the
> hopper lip, faint purple crystal glow inside the hopper, small ember-crimson lights
> (#ff4a3d). Viewed from DIRECTLY ABOVE (pure top-down), facing straight up with the scoop
> at the top, exactly one vehicle, centred with a generous empty margin. Muted desert
> sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the
> ground, thin dark outline rim. Background: every pixel outside the vehicle is solid flat
> pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

### 5.4 Emberhand barracks — **Save as:** `barracks__emberhand__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a scavenger
> warband barracks — a low bunker assembled from salvaged shipping containers and welded
> scrap plates in scorched red-iron (#d1503a, shadow #8f3020, highlight #ffb08f), a lit
> doorway glowing ember-crimson (#ff4a3d), a ragged canvas awning, soot-streaked vents, a
> warband banner pole. Viewed from almost directly above with a slight three-quarter depth:
> roof lit, front (lower) face darker. Muted desert sunlight from the upper left, soft
> shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. The
> structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile —
> solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its
> footprint. No gradient, no vignette, no grid, no text. One building only, centred,
> generous margin. Square PNG.

### 5.5 Emberhand refinery — **Save as:** `refinery__emberhand__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a scavenger
> warband ore refinery — two vertical silo tanks patched with mismatched welded plates, a
> low open docking bay, exposed jury-rigged pipework, a soot-blackened exhaust stack, all
> in scorched red-iron (#d1503a, shadow #8f3020, highlight #ffb08f) with ember-crimson
> lights (#ff4a3d) and a faint purple crystal glow at the intake. Viewed from almost
> directly above with a slight three-quarter depth: roof lit, front (lower) face darker.
> Muted desert sunlight from the upper left, soft shading painted into the sprite, NO
> shadow cast on the ground, thin dark outline rim. The structure sits FLAT with absolutely
> NO base platform, NO concrete pad, NO ground tile — solid flat pure magenta #FF00FF fills
> every pixel outside the structure, right up to its footprint. No gradient, no vignette,
> no grid, no text. One building only, centred, generous margin. Square PNG.

### 5.6 Emberhand defense turret — **Save as:** `defense_turret__emberhand__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a scavenger
> warband defense turret — a squat pedestal of welded scrap plates topped by a salvaged
> rotary cannon with mismatched barrels, ammo belts draped over the side, in scorched
> red-iron (#d1503a, shadow #8f3020, highlight #ffb08f) with an ember-crimson sight glow
> (#ff4a3d). The cannon points straight up. Viewed from almost directly above with a slight
> three-quarter depth: top lit, front (lower) face darker. Muted desert sunlight from the
> upper left, soft shading painted into the sprite, NO shadow cast on the ground, thin dark
> outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad,
> NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the structure,
> right up to its footprint. No gradient, no vignette, no grid, no text. One turret only,
> centred, generous margin. Square PNG.

### 5.7 Shardborn infantry — **Save as:** `infantry__shardborn__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline
> warrior — a humanoid figure whose armour is GROWN, not built: translucent violet crystal
> plates (#b49bd8 to #e6d4ff) with a soft violet inner glow, fused over obsidian-black
> organic under-plating (#3c3630), crystal spurs at the shoulders, its forearm extruded
> into a faceted crystal blade-rifle. Flowing faceted forms, NO straight machined edges, no
> bolts, no fabric. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly
> one figure, centred with a generous empty margin. Muted desert sunlight from the upper
> left plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on
> the ground, thin dark outline rim. Background: every pixel outside the figure is solid
> flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text.
> Square PNG.

### 5.8 Shardborn rocket trooper — **Save as:** `rocket_trooper__shardborn__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline
> artillery warrior — a humanoid figure of grown translucent violet crystal (#b49bd8 to
> #e6d4ff, soft inner glow) over obsidian-black organic plating (#3c3630), with a large
> hollow crystal launcher-horn grown over one shoulder, glowing shard projectiles visible
> inside it. Flowing faceted forms, NO straight machined edges, no bolts, no fabric. Viewed
> from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one figure, centred with
> a generous empty margin. Muted desert sunlight from the upper left plus the violet inner
> glow, soft shading painted into the sprite, NO shadow cast on the ground, thin dark
> outline rim. Background: every pixel outside the figure is solid flat pure magenta
> #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

### 5.9 Shardborn harvester — **Save as:** `harvester__shardborn__move.png`

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command &
> Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette —
> NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline
> harvester creature-machine — a large low burrowing collector GROWN from obsidian-black
> organic plating (#3c3630) and translucent violet crystal (#b49bd8 to #e6d4ff, soft inner
> glow): a segmented beetle-like body instead of treads, a fanged crystal intake maw at the
> front, and a swollen glowing crystal storage bulb on its back instead of a hopper.
> Flowing faceted forms, NO straight machined edges, no bolts. Viewed from DIRECTLY ABOVE
> (pure top-down), facing straight up with the maw at the top, exactly one creature-
> machine, centred with a generous empty margin. Muted desert sunlight from the upper left
> plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on the
> ground, thin dark outline rim. Background: every pixel outside it is solid flat pure
> magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

### 5.10 Shardborn barracks — **Save as:** `barracks__shardborn__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline
> spawning structure — a low hive-like mound GROWN from obsidian-black organic plating
> (#3c3630) and clusters of translucent violet crystal (#b49bd8 to #e6d4ff, soft inner
> glow), with one glowing fissure-opening where warriors emerge and small crystal spires
> around it. Flowing organic-faceted forms, NO straight machined edges, no doors, no
> panels. Viewed from almost directly above with a slight three-quarter depth: top lit,
> front (lower) face darker. Muted desert sunlight from the upper left plus the violet
> inner glow, soft shading painted into the sprite, NO shadow cast on the ground, thin dark
> outline rim. The formation sits FLAT with absolutely NO base platform and NO ground tile
> — solid flat pure magenta #FF00FF fills every pixel outside the formation, right up to
> its footprint. No gradient, no vignette, no grid, no text. One formation only, centred,
> generous margin. Square PNG.

### 5.11 Shardborn refinery — **Save as:** `refinery__shardborn__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline
> digestion structure — a resource processor GROWN from obsidian-black organic plating
> (#3c3630) with two tall swollen translucent violet crystal sacs (#b49bd8 to #e6d4ff)
> glowing brightly with absorbed energy, connected by rope-like crystal veins to a low
> intake maw where a harvester docks. Flowing organic-faceted forms, NO straight machined
> edges, no pipes, no panels. Viewed from almost directly above with a slight three-quarter
> depth: top lit, front (lower) face darker. Muted desert sunlight from the upper left plus
> the violet inner glow, soft shading painted into the sprite, NO shadow cast on the
> ground, thin dark outline rim. The formation sits FLAT with absolutely NO base platform
> and NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the
> formation, right up to its footprint. No gradient, no vignette, no grid, no text. One
> formation only, centred, generous margin. Square PNG.

### 5.12 Shardborn defense turret — **Save as:** `defense_turret__shardborn__idle.png`

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command
> & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette
> — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline
> defense spire — a defensive growth: a twisted obsidian-black stalk (#3c3630) crowned by a
> large sharp translucent violet crystal lance-shard (#b49bd8 to #e6d4ff) glowing at its
> core and aimed straight up, ringed by smaller crystal spurs at the base. Grown, not
> built: flowing faceted forms, NO straight machined edges, no barrels, no panels. Viewed
> from almost directly above with a slight three-quarter depth: top lit, front (lower) face
> darker. Muted desert sunlight from the upper left plus the violet inner glow, soft
> shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. The
> formation sits FLAT with absolutely NO base platform and NO ground tile — solid flat pure
> magenta #FF00FF fills every pixel outside the formation, right up to its footprint. No
> gradient, no vignette, no grid, no text. One formation only, centred, generous margin.
> Square PNG.

---

# BATCH 6 — Presentation art (10 prompts — plain illustrations, NO magenta)

These are normal paintings, not sprites. **View wiring is NEW work** for the importing
session (title/briefing/mission-select image slots), so filenames below are proposals —
put them in a `presentation/` subfolder of the drop.

### 6.1 Title backdrop — **Save as:** `presentation/title_backdrop.png`

> A wide painted title-screen backdrop for a late-1990s Westwood-style desert RTS (Command
> & Conquer / Dune 2000 era) — a hand-painted, slightly gritty concept-art style, NOT
> modern photoreal 3D, NOT cartoon. Scene: a vast desert at dusk on an alien world, the
> sand veined with glowing purple crystal seams running toward the horizon; distant
> industrial refinery silhouettes with tiny lights on the skyline; a towering violet
> lightning storm building on the horizon; warm dusk light from the low sun against the
> cold violet glow. Epic, quiet, ominous. Leave the upper-middle area relatively calm so a
> game logo can sit over it. Wide 16:9 image, no text, no logo, no characters.

### 6.2–6.7 Briefing portraits ×6 — bust, 3/4 view, painted, dark neutral background, ~square

Shared framing (already in each prompt): *painted military briefing portrait for a
late-90s Westwood-style RTS — head-and-shoulders bust, three-quarter view, dramatic single
key light, plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime,
roughly square, no text.*

**6.2 The Warden** — Save as: `presentation/portrait_warden.png`

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command &
> Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light,
> plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly
> square, no text. Subject: THE WARDEN — an armoured hero commander whose face is fully
> enclosed in a sleek steel-grey combat helmet with a single glowing cyan visor slit,
> heavy powered-armour shoulder plates with cyan seam lights, battle-worn steel blue-grey
> finish. Imposing, anonymous, loyal.

**6.3 Marshal Corr** — Save as: `presentation/portrait_corr.png`

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command &
> Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light,
> plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly
> square, no text. Subject: MARSHAL CORR — a weathered senior military commander in his
> 60s, grey-templed close-cropped hair, deep lines, a small scar over one brow, a stiff
> steel-grey uniform collar with subtle cyan rank bars. Stern, tired, principled — a man
> carrying a war.

**6.4 Sera Vane** — Save as: `presentation/portrait_vane.png`

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command &
> Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light,
> plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly
> square, no text. Subject: SERA VANE — a desert warlord woman in her 40s, sun-hardened
> face with pale ash-mark ritual streaks across one cheek, dark hair pulled back, an
> ash-grey cloak clasped with scorched iron, a crimson sash across her chest, faint ember-
> orange reflected light on one side of her face. Fierce, charismatic, dangerous.

**6.5 Director Halex** — Save as: `presentation/portrait_halex.png`

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command &
> Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light,
> plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly
> square, no text. Subject: DIRECTOR HALEX — a cold corporate executive in his 50s,
> immaculate: slicked steel-grey hair, rimless glasses catching the light, a severe
> high-collared charcoal corporate suit with a thin cyan pin, the faintest contemptuous
> smile. Bloodless, calculating.

**6.6 Broker Yssel** — Save as: `presentation/portrait_yssel.png`

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command &
> Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light,
> plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly
> square, no text. Subject: BROKER YSSEL — an ornately dressed information broker of
> indeterminate age, layered rich fabrics in desert tones with gold thread, many small
> rings and a jewelled ear cuff, kohl-lined knowing eyes, a warm practiced smile that
> does not reach them. Opulent, friendly, untrustworthy.

**6.7 The Chorus** — Save as: `presentation/portrait_chorus.png`

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command &
> Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light,
> plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly
> square, no text. Subject: THE CHORUS — a shard-touched human face, serene and WRONG:
> translucent violet crystal growths fusing through one temple and cheek, faint violet
> light glowing beneath the skin along the veins, and eyes that are uniformly wrong — no
> pupils, softly luminous violet. Calm, alien, quietly terrifying — many speaking as one.

### 6.8 Act I card — **Save as:** `presentation/act1_card.png`

> A wide painted campaign act-card illustration for a late-1990s Westwood-style desert RTS
> (Command & Conquer era) — hand-painted gritty concept-art style, NOT photoreal, NOT
> cartoon, no text. Scene for "Operation Aether Prime": a formation of steel-grey military
> dropships with cyan running lights descending through dusty morning air over a vast
> desert, landing struts deploying, sand billowing beneath them; below, tiny vehicles and
> troops fan out from a beachhead; purple crystal seams glint in the dunes. Confident,
> martial, dawn-of-the-campaign mood. Wide 16:9, leave lower third calmer for a title
> overlay.

### 6.9 Act II card — **Save as:** `presentation/act2_card.png`

> A wide painted campaign act-card illustration for a late-1990s Westwood-style desert RTS
> (Command & Conquer era) — hand-painted gritty concept-art style, NOT photoreal, NOT
> cartoon, no text. Scene for "The Waking Deep": a night scene at the mouth of a vast
> glowing crystal vein — a canyon floor split by pulsing violet light from below; a line of
> ragged silhouetted desert raiders with scavenged armour and weapons stand at its rim,
> lit only by the violet glow, ash and embers drifting; something enormous coils beneath
> the light. Ominous, awed, before-the-plunge mood. Wide 16:9, leave lower third calmer
> for a title overlay.

### 6.10 Credits backdrop — **Save as:** `presentation/credits_backdrop.png`

> A wide painted illustration for the end credits of a late-1990s Westwood-style desert RTS
> (Command & Conquer era) — hand-painted gritty concept-art style, NOT photoreal, NOT
> cartoon, no text. Scene: "the First Vein" — a vast glowing fissure splitting a desert
> plain, radiant violet light pouring up out of it into the night sky like an aurora; at
> its rim, a handful of tiny human figures and one small vehicle stand silhouetted, dwarfed
> by the scale; drifting motes of light rise from the depths. Vast, elegiac, final. Wide
> 16:9, dark enough overall for light credit text to scroll over.

---

# BATCH 7 — New terrain tiles (OPTIONAL — only if Gemini's tiles actually tile)

Terrain must be **seamless** (left edge continues the right edge, top continues bottom).
Test by tiling one output 2×2 in any editor; if visible seams persist after 2–3 re-rolls,
**skip this batch** — the engine's procedural ground is fine. Opaque, NO magenta. Deliver
2 variant images per type (`_2` suffix on the second, matching the existing sand set).

### 7.1 Scorched field — **Save as:** `terrain__scorched.png` (variant → `terrain__scorched_2.png`)

> A single seamless square ground-texture tile for a late-1990s Westwood-style desert RTS
> (Command & Conquer / Dune 2000 era), painted gritty style, viewed from directly above.
> Subject: scorched battlefield sand — desert ground charred black and ash-grey by a
> massive burn (base near #3c3630 fading into charred sand #7a6650), with fine ash
> drifts, hairline cracked glassy patches, and a few faint dying embers. Muted, dark,
> matte. CRITICAL: the texture must be perfectly SEAMLESS and tileable — the left edge
> must continue the right edge exactly and the top edge must continue the bottom edge
> exactly, with no vignette, no lighting gradient, no centred feature, no border. Even,
> flat overhead lighting. Square image, texture fills the entire frame edge to edge. PNG.

*(For the `_2` variant, paste in the same chat: "Another tile of the exact same scorched
ground texture — same palette, same scale, same flat lighting, seamless and tileable —
but a different random arrangement of cracks, ash drifts, and embers.")*

### 7.2 Crystal lattice (Shardborn creep) — **Save as:** `terrain__crystal_lattice.png` (variant → `terrain__crystal_lattice_2.png`)

> A single seamless square ground-texture tile for a late-1990s Westwood-style desert RTS
> (Command & Conquer / Dune 2000 era), painted gritty style, viewed from directly above.
> Subject: alien crystal-creep ground — desert sand being overgrown by a web-like lattice
> of translucent violet crystal veins (tones #7d6a9a base with brighter veins #b49bd8 to
> #e6d4ff) spreading across darker corrupted ground (#3c3630), with tiny crystal nubs
> budding at vein junctions and a faint soft violet glow along the veins. CRITICAL: the
> texture must be perfectly SEAMLESS and tileable — the left edge must continue the right
> edge exactly and the top edge must continue the bottom edge exactly, with no vignette,
> no lighting gradient, no centred feature, no border. Even, flat overhead lighting.
> Square image, texture fills the entire frame edge to edge. PNG.

*(For the `_2` variant, paste in the same chat: "Another tile of the exact same crystal-
creep texture — same palette, same scale, same flat lighting, seamless and tileable — but
a different random arrangement of veins and crystal nubs.")*

---

## Delivery checklist (operator)

- [ ] Batch 1 (6 images) — re-gens; import these FIRST to prove the pipeline
- [ ] Batch 2 (15 images) — new units
- [ ] Batch 3 (25 images) — new buildings
- [ ] Batch 4 (9 strips) — animation (importing session wires frames/fps sidecars)
- [ ] Batch 5 (12 images) — faction skins (importing session budgets a small loader tweak)
- [ ] Batch 6 (10 images) — presentation art (importing session budgets NEW view wiring)
- [ ] Batch 7 (4 tiles) — optional terrain; skip if not seamless
- [ ] Everything in ONE folder under `~/Code/` (not Downloads/Desktop), exact filenames
- [ ] Tell Claude the folder path → `node scripts/import-art.mjs <folder>` per batch, with
      `pnpm run verify` + `pnpm run test:live` + a screenshot probe after each

**Total: ~54 prompts → 81 images.** Import order C → A → B → D → E → F (per
`docs/ART_HANDOFF.md`).
