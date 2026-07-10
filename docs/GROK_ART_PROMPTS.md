# Grok Art Prompt Package — Shard Dominion (numbered edition, 2026-07-10)

> Same 81 assets as `docs/GEMINI_ART_PROMPTS.md`, re-cut for the **Grok chat UI**
> (your subscription — no API key, no cost). The naming problem is solved by NUMBERS:
> you never type an asset filename.

## Workflow (operator)

1. Make one folder for the drop, e.g. `~/Code/art-drop-grok/`. (**Under `~/Code/`** —
   never Downloads/Desktop, macOS TCC blocks the terminal there.)
2. Go prompt by prompt, in order. **Open a NEW Grok chat for each numbered prompt** —
   EXCEPT follow-ups marked "SAME chat", which you paste into the chat you're already in
   (they edit the image just generated, so enemy variants keep the identical chassis).
3. Download each image and save it into the folder named **just its number**: `1.png`,
   `2.png`, … (`.jpg` is fine too — the renamer converts). Re-rolling? Overwrite the
   same number.
4. **Re-roll, don't settle** if you see: a shadow on the ground, a coloured base platform
   under a building, a non-magenta background on a sprite, more than one object, grids,
   or text.
5. When a batch is done (or all of it), tell Claude the folder path. Claude runs
   `python3 scripts/rename-art-drop.py <folder>` (numbers → real filenames, JPG → PNG),
   then imports and verifies. Stop after batch 1 for the in-engine proof before
   grinding the rest.

**Quality bar (what "good" looks like):** hard readable silhouette, painted late-90s
Westwood RTS look, flat magenta everywhere outside the sprite, units pure top-down
facing up, buildings with a slightly lit roof + darker front face and NO base pad.


---

# BATCH 1 — Purple-base re-gens (the 6 originals — do these first)

### #1 → becomes `construction_yard__neutral__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a heavy construction yard — the biggest, heaviest structure on a desert base: a broad industrial platform building with a large roof-mounted crane arm with a hook, fold-out panel seams, a small blinking red hazard beacon, vents and machinery details. Viewed from almost directly above with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little darker so it reads as having height. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Paint it in neutral sand-bleached grey metal (main #9a9a9a, shadow #6a6a6a, highlight #d8d8d8), dusty and sand-worn, with a thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `1.png` (or `1.jpg`)

### #2 → becomes `barracks__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a military infantry barracks — a blocky low bunker building with a lit doorway that troops march out of, a ridged roof with vents, sandbag details at the walls. Viewed from almost directly above with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little darker so it reads as having height. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey armour plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan accent lights (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `2.png` (or `2.jpg`)

### #3 → becomes `barracks__enemy__idle.png`
**SAME chat as #2** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `3.png` (or `3.jpg`)

### #4 → becomes `refinery__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: an ore refinery — a wide industrial structure with two vertical silo tanks, a low open docking bay where a hauler truck unloads, pipework connecting silos to the bay, a small exhaust stack, and a faint purple crystal glow inside the intake hopper. Viewed from almost directly above with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little darker so it reads as having height. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan accent lights (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Wide-ish square PNG.

**Save as:** `4.png` (or `4.jpg`)

### #5 → becomes `refinery__enemy__idle.png`
**SAME chat as #4** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `5.png` (or `5.jpg`)

### #6 → becomes `power_node__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a compact power pylon node — a small squat generator housing with cooling fins and a tall thin antenna mast whose tip light glows. Viewed from almost directly above with a slight three-quarter depth: the top brightly lit, the front (lower) face a little darker so it reads as having height. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with a glowing cyan tip light and accents (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `6.png` (or `6.jpg`)


---

# BATCH 2 — Missing units

### #7 → becomes `scout_vehicle__player__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a fast four-wheel military recon buggy — open lightweight frame, chunky off-road tyres, a roll cage, and a small pintle-mounted machine gun behind the driver. Viewed from DIRECTLY ABOVE (pure top-down), the buggy facing straight up, exactly one vehicle, centred with a generous empty margin on all sides. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey bodywork (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with small glowing cyan accent lights (#00e5ff), sand-worn battle finish, thin dark outline rim. Background: every pixel outside the vehicle is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no base plate, no grid, no text. Square PNG.

**Save as:** `7.png` (or `7.jpg`)

### #8 → becomes `scout_vehicle__enemy__move.png`
**SAME chat as #7** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `8.png` (or `8.jpg`)

### #9 → becomes `assault_tank__player__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a mid-size tracked main battle tank — wedge-shaped glacis hull, wide treads with side skirts, a circular turret with a hatch and a single long forward cannon barrel with a bright muzzle band, rear engine deck with louvres. Clearly bigger and heavier than a light scout tank. Viewed from DIRECTLY ABOVE (pure top-down), the tank facing straight up with the barrel pointing up, exactly one vehicle, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey armour (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with a glowing cyan muzzle band and accents (#00e5ff), sand-worn battle finish, thin dark outline rim. Background: every pixel outside the vehicle is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no base plate, no grid, no text. Square PNG.

**Save as:** `9.png` (or `9.jpg`)

### #10 → becomes `assault_tank__enemy__move.png`
**SAME chat as #9** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `10.png` (or `10.jpg`)

### #11 → becomes `longbow__player__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a tracked long-range artillery vehicle — a low tracked chassis carrying one very long single artillery barrel pointing forward, with four splayed hydraulic recoil stabilizer feet folded at its corners and an ammunition rack behind the gun mount. The extremely long barrel is its signature. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up with the barrel pointing up, exactly one vehicle, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey armour (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan accents (#00e5ff), sand-worn battle finish, thin dark outline rim. Background: every pixel outside the vehicle is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no base plate, no grid, no text. Square PNG.

**Save as:** `11.png` (or `11.jpg`)

### #12 → becomes `longbow__enemy__move.png`
**SAME chat as #11** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `12.png` (or `12.jpg`)

### #13 → becomes `skimmer_apc__player__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a boxy hover armoured personnel carrier for eight passengers — a slab-sided rectangular hull riding on glowing hover skirts instead of wheels, a rear loading ramp, small viewports along the sides, a low profile sensor mast. Utilitarian troop bus, not a gun platform. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one vehicle, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey armour (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with the hover skirts glowing cyan (#00e5ff), sand-worn finish, thin dark outline rim. Background: every pixel outside the vehicle is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no base plate, no grid, no text. Square PNG.

**Save as:** `13.png` (or `13.jpg`)

### #14 → becomes `skimmer_apc__enemy__move.png`
**SAME chat as #13** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `14.png` (or `14.jpg`)

### #15 → becomes `gunship__player__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a small twin-rotor VTOL attack gunship seen from above — two side-mounted rotor pods (rotor discs drawn as translucent blur circles), a narrow armed fuselage with a cockpit canopy at the front, and four missile pods slung under stub wings. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one aircraft, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, and ABSOLUTELY NO shadow on the ground — the game engine draws the flying-height shadow itself. Faction paint: dusty steel blue-grey fuselage (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan canopy and accents (#00e5ff), sand-worn finish, thin dark outline rim. Background: every pixel outside the aircraft is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `15.png` (or `15.jpg`)

### #16 → becomes `gunship__enemy__move.png`
**SAME chat as #15** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `16.png` (or `16.jpg`)

### #17 → becomes `riftmaw__neutral__move.png`
**New chat.**

> A single video-game monster sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline burrower creature — a segmented obsidian-black worm bursting upward out of the ground, jaws open, its back armoured with rows of jagged translucent violet crystal spines that glow from within (crystal tones from #b49bd8 to #e6d4ff over near-black obsidian #3c3630 plating). A small spray of erupted sand debris may be part of the creature's silhouette, but nothing else touches the background. Viewed from DIRECTLY ABOVE (pure top-down), the creature oriented straight up, exactly one creature, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Thin dark outline rim. Background: every pixel outside the creature is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground plane, no grid, no text. Square PNG.

**Save as:** `17.png` (or `17.jpg`)

### #18 → becomes `warden__player__move.png`
**New chat.**

> A single video-game hero-unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a heavy exo-armoured commander on foot — bulky powered armour with oversized shoulder plates, a helmet with a glowing cyan visor slit, and an oversized two-handed cannon held forward. Visibly bigger and bulkier than a normal infantry soldier. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up with the cannon pointing up, exactly one figure, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: steel blue-grey powered armour (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with the visor and armour seams glowing cyan (#00e5ff), sand-worn finish, thin dark outline rim. Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `18.png` (or `18.jpg`)

### #19 → becomes `ghostwalker__emberhand__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a cloaked scout-assassin on foot — a lean figure wrapped in a ragged, tattered shroud-cloak, a long curved blade held low in one hand, ash-stained wrappings, a half-mask. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one figure, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: scorched dark iron and ash-black cloth (main #d1503a on the armour pieces, shadow #8f3020, highlight #ffb08f) with faint ember-crimson glowing embers along the cloak edge (#ff4a3d), thin dark outline rim. Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `19.png` (or `19.jpg`)

### #20 → becomes `vane__emberhand__move.png`
**New chat.**

> A single video-game hero-unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: an ash-cloaked desert warlord on foot — a commanding figure in a long ash-grey cloak with a bright crimson sash across the chest, dual pistols held forward one in each hand, light scorched armour plates at the shoulders. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up with both pistols pointing up, exactly one figure, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: scorched red-iron armour (main #d1503a, shadow #8f3020, highlight #ffb08f) with the sash and small accents in glowing ember crimson (#ff4a3d), ash-dusted finish, thin dark outline rim. Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `20.png` (or `20.jpg`)

### #21 → becomes `harvester__enemy__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a chunky tracked ore-hauler harvester — the biggest ground vehicle: very wide treads, a large ribbed cargo hopper on the back with a yellow-and-black hazard stripe along its lip, a front intake scoop blade, an exhaust stack, and a faint purple crystal glow inside the hopper. Dusty industrial economy vehicle, not a war machine. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up with the scoop at the top, exactly one vehicle, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: scorched red-iron bodywork (main #d1503a, shadow #8f3020, highlight #ffb08f) with small ember-crimson accent lights (#ff4a3d), sand-worn finish, thin dark outline rim. Background: every pixel outside the vehicle is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no base plate, no grid, no text. Square PNG.

**Save as:** `21.png` (or `21.jpg`)


---

# BATCH 3 — Missing buildings

### #22 → becomes `war_factory__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a vehicle war factory — a big industrial garage building with one large open assembly bay door at the front, an overhead gantry crane visible inside the bay, corrugated roof panels, tall vents, and hazard striping around the bay opening. Viewed from almost directly above with a slight three-quarter depth: the roof brightly lit, the front (lower) face and open bay a little darker so it reads as having height. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan accent lights (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `22.png` (or `22.jpg`)

### #23 → becomes `war_factory__enemy__idle.png`
**SAME chat as #22** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `23.png` (or `23.jpg`)

### #24 → becomes `defense_turret__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a squat anti-ground defense turret — a short armoured drum pedestal topped by a rotary multi- barrel cannon in a compact armoured housing, ammo feed chutes, small armour skirts around the pedestal base. The cannon points straight up (north). Viewed from almost directly above with a slight three-quarter depth: the top brightly lit, the front (lower) face a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey armour (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan accents (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One turret only, centred, generous margin. Square PNG.

**Save as:** `24.png` (or `24.jpg`)

### #25 → becomes `defense_turret__enemy__idle.png`
**SAME chat as #24** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `25.png` (or `25.jpg`)

### #26 → becomes `aa_turret__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: an anti-air missile turret — a short armoured pedestal carrying a quad missile rack (four boxy missile tubes in a 2×2 cluster) angled slightly skyward, with a small radar dish on a side arm. The rack points straight up (north). Viewed from almost directly above with a slight three-quarter depth: the top brightly lit, the front (lower) face a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey armour (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan accents (#00e5ff) and yellow warhead tips, sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One turret only, centred, generous margin. Square PNG.

**Save as:** `26.png` (or `26.jpg`)

### #27 → becomes `aa_turret__enemy__idle.png`
**SAME chat as #26** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `27.png` (or `27.jpg`)

### #28 → becomes `radar__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a radar station — a reinforced dome building with a large rotating radar dish mounted on top on a pivot arm, plus a small antenna cluster and cable conduits running down the dome. Viewed from almost directly above with a slight three-quarter depth: the dome brightly lit, the front (lower) face a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with glowing cyan accents (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `28.png` (or `28.jpg`)

### #29 → becomes `radar__enemy__idle.png`
**SAME chat as #28** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `29.png` (or `29.jpg`)

### #30 → becomes `processing_plant__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystal processing plant — an industrial refinery structure built around a central open crucible vat glowing bright violet (molten crystal, tones #b49bd8 to #e6d4ff), with two smoke stacks, pipework feeding the crucible, and a small control cabin. The violet glow is its signature. Viewed from almost directly above with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with cyan accent lights (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `30.png` (or `30.jpg`)

### #31 → becomes `processing_plant__enemy__idle.png`
**SAME chat as #30** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `31.png` (or `31.jpg`)

### #32 → becomes `skypad__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a VTOL landing pad — a low octagonal landing platform with a painted landing circle and edge lights, flanked on one side by a small fuel rig: pump housing, hoses, and two small fuel tanks. The platform is a built structure raised only slightly, NOT a patch of ground. Viewed from almost directly above with a slight three-quarter depth: the pad surface brightly lit, its front (lower) edge a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey deck plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with the landing circle and edge lights glowing cyan (#00e5ff), sand-worn finish, thin dark outline rim. The structure sits FLAT with absolutely NO extra base platform, NO concrete apron, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One structure only, centred, generous margin. Square PNG.

**Save as:** `32.png` (or `32.jpg`)

### #33 → becomes `skypad__enemy__idle.png`
**SAME chat as #32** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `33.png` (or `33.jpg`)

### #34 → becomes `wall__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: ONE straight modular defensive wall segment — a thick armoured concrete-and-steel barrier wall, seen from almost directly above, running perfectly horizontally ALL THE WAY from the left edge of the image to the right edge (so identical segments butt together seamlessly side by side), with panel seams, rivet lines, and a slightly lit top face with a darker front (lower) face. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel-grey armour with a blue-grey trim stripe (#3d7fd6, shadow #28568f) and tiny cyan marker lights (#00e5ff), sand-worn finish, thin dark outline rim. NO base platform and NO ground beneath it — solid flat pure magenta #FF00FF fills all pixels above and below the wall segment. The wall itself must touch the left and right image edges. No gradient, no grid, no text. Wide rectangular PNG, roughly 1:1 to 2:1.

**Save as:** `34.png` (or `34.jpg`)

### #35 → becomes `wall__enemy__idle.png`
**SAME chat as #34** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `35.png` (or `35.jpg`)

### #36 → becomes `gate__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: ONE armoured gate segment matching a modular defensive wall — the same thick armoured barrier wall running perfectly horizontally from the left edge of the image to the right edge, but its central section is a pair of heavy sliding blast doors that meet in the middle (closed), with hazard striping on the door edges and a small gatehouse light. Seen from almost directly above, top face lit, front (lower) face darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel-grey armour with blue-grey trim (#3d7fd6, shadow #28568f) and cyan marker lights (#00e5ff), sand-worn finish, thin dark outline rim. NO base platform and NO ground — solid flat pure magenta #FF00FF fills all pixels above and below the segment, which must touch the left and right image edges. No gradient, no grid, no text. Wide rectangular PNG, roughly 1:1 to 2:1.

**Save as:** `36.png` (or `36.jpg`)

### #37 → becomes `gate__enemy__idle.png`
**SAME chat as #36** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `37.png` (or `37.jpg`)

### #38 → becomes `bunker__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: an infantry pillbox bunker — a low round concrete pillbox ringed with sandbags, with narrow dark horizontal firing slits on all sides and a reinforced hatch on the roof. Viewed from almost directly above with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Mostly bare weathered concrete and sandbags, with a dusty steel blue-grey hatch and trim (#3d7fd6, shadow #28568f) and one small cyan lamp (#00e5ff), thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad extending beyond the sandbag ring, NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One bunker only, centred, generous margin. Square PNG.

**Save as:** `38.png` (or `38.jpg`)

### #39 → becomes `bunker__enemy__idle.png`
**SAME chat as #38** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `39.png` (or `39.jpg`)

### #40 → becomes `infirmary__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a field hospital infirmary — a low medical building: half rigid prefab module, half canvas field-tent extension, with a large red cross painted on the flat roof, a stretcher rack by the door, and a small air-filtration unit. Viewed from almost directly above with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: sand-toned canvas plus dusty steel blue-grey prefab plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with a small cyan lamp (#00e5ff) and the red cross in warning red, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `40.png` (or `40.jpg`)

### #41 → becomes `infirmary__enemy__idle.png`
**SAME chat as #40** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `41.png` (or `41.jpg`)

### #42 → becomes `machine_shop__player__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a vehicle repair machine shop — an open-sided workshop structure with a small overhead crane arm on a gantry, a parts yard beside it (stacked crates, spare tank treads, barrels, a spare turret), a workbench, and an arc-welding glow inside. Viewed from almost directly above with a slight three-quarter depth: the roof brightly lit, the front (lower) face a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Faction paint: dusty steel blue-grey structure (main #3d7fd6, shadow #28568f, highlight #a7d6ff) with cyan accent lights (#00e5ff), hazard- yellow crane arm, sand-worn finish, thin dark outline rim. The structure and its parts yard sit FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath them — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `42.png` (or `42.jpg`)

### #43 → becomes `machine_shop__enemy__idle.png`
**SAME chat as #42** — paste right after its image:

> Keep exactly the same vehicle/structure/figure as the image you just generated above — same pose, same top-down camera, same painted late-90s RTS style, and the same solid pure magenta #FF00FF background — but repaint the faction colours only: the dusty steel blue-grey armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight #ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). Change nothing else about the design.

**Save as:** `43.png` (or `43.jpg`)

### #44 → becomes `derrick__neutral__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a neutral capturable pumpjack derrick — a classic oil-well pumpjack with a nodding beam head, a small lattice frame, a drive motor housing, one storage tank, and connecting pipes. Abandoned, rusty, weather-beaten. Viewed from almost directly above with a slight three-quarter depth: the top brightly lit, the front (lower) face a little darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Paint: neutral sand-bleached grey metal (main #9a9a9a, shadow #6a6a6a, highlight #d8d8d8) with rust streaks and faded hazard yellow, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One structure only, centred, generous margin. Square PNG.

**Save as:** `44.png` (or `44.jpg`)

### #45 → becomes `relay__neutral__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a mysterious neutral crystal relay — an antenna array of three tall translucent violet crystal spires (glowing from within, tones #b49bd8 to #e6d4ff) growing out of a cracked obsidian-black mound base (#3c3630), ringed by a few smaller crystal shards, with faint arcs of violet energy between the spire tips. Grown, not built — no straight machined edges on the crystals. Viewed from almost directly above with a slight three-quarter depth: tops lit, lower faces darker. Muted desert sunlight from the upper left plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on the ground. Thin dark outline rim. The formation sits FLAT with absolutely NO base platform and NO ground tile beneath it — solid flat pure magenta #FF00FF fills every pixel outside the formation, right up to its footprint. No gradient, no vignette, no grid, no text. One formation only, centred, generous margin. Square PNG.

**Save as:** `45.png` (or `45.jpg`)

### #46 → becomes `wreck__neutral__idle.png`
**New chat.**

> A single video-game sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: the burnt-out wreck of a destroyed military vehicle — a blackened, gutted tank hull husk: scorched charcoal metal, torn plating peeled open, a collapsed turret askew, ash and char tones with a few faint dying orange embers deep in the hull. Flat and dead — this is battlefield debris. Viewed from DIRECTLY ABOVE (pure top-down), exactly one wreck, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground. Charcoal and gunmetal tones (#3c3630, #33363b, #6a6a6a), thin dark outline rim. Background: every pixel outside the wreck is solid flat pure magenta #FF00FF — no gradient, no vignette, no scorched ground ring, no grid, no text. Square PNG.

**Save as:** `46.png` (or `46.jpg`)


---

# BATCH 4 — Animation strips

### #47 → becomes `infantry__player__walk.png` *(wide 4-frame strip)*
**New chat.**

> A 4-frame walk-cycle sprite strip of the SAME character for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The character: a small sci-fi desert infantry soldier — helmet, backpack, shoulder pads, rifle held forward — in dusty steel blue-grey armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up. FOUR frames side by side in one horizontal row, identical character, size, and position in each frame — only the legs and arms change mid-stride between frames to make a walking loop. Character centred in each quarter of the image, legs clearly visible. Solid flat pure magenta #FF00FF background filling every non-character pixel. No shadows outside the character, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

**Save as:** `47.png` (or `47.jpg`)

### #48 → becomes `rocket_trooper__player__walk.png` *(wide 4-frame strip)*
**New chat.**

> A 4-frame walk-cycle sprite strip of the SAME character for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The character: a small sci-fi desert soldier carrying a fat twin-tube rocket launcher over one shoulder with yellow warhead tips — helmet, backpack — in dusty steel blue-grey armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up. FOUR frames side by side in one horizontal row, identical character, size, and position in each frame — only the legs and free arm change mid-stride between frames to make a walking loop; the launcher stays steady on the shoulder. Character centred in each quarter of the image, legs clearly visible. Solid flat pure magenta #FF00FF background filling every non-character pixel. No shadows outside the character, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

**Save as:** `48.png` (or `48.jpg`)

### #49 → becomes `ghostwalker__emberhand__walk.png` *(wide 4-frame strip)*
**New chat.**

> A 4-frame walk-cycle sprite strip of the SAME character for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The character: a cloaked scout-assassin — lean figure in a ragged tattered shroud-cloak, long curved blade held low, ash-stained wrappings, scorched red-iron armour pieces (#d1503a, shadow #8f3020) with faint ember-crimson glows (#ff4a3d) — viewed from DIRECTLY ABOVE, facing straight up. FOUR frames side by side in one horizontal row, identical character, size, and position in each frame — only the legs and the cloak's trailing edge change mid-stride between frames to make a stalking walk loop. Character centred in each quarter of the image. Solid flat pure magenta #FF00FF background filling every non-character pixel. No shadows outside the character, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

**Save as:** `49.png` (or `49.jpg`)

### #50 → becomes `harvester__player__drive.png` *(wide 4-frame strip)*
**New chat.**

> A 4-frame drive-animation sprite strip of the SAME vehicle for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The vehicle: a chunky tracked ore-hauler harvester — very wide treads, a big ribbed rear hopper with a yellow-and-black hazard stripe, front intake scoop, exhaust stack, faint purple glow in the hopper — in dusty steel blue-grey paint (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up. FOUR frames side by side in one horizontal row, identical vehicle, size, and position in each frame — the ONLY change between frames is the tread-link pattern shifting forward slightly each frame (rolling tracks) and a subtle exhaust puff. Vehicle centred in each quarter of the image. Solid flat pure magenta #FF00FF background filling every non-vehicle pixel. No shadows outside the vehicle, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

**Save as:** `50.png` (or `50.jpg`)

### #51 → becomes `scout_vehicle__player__drive.png` *(wide 4-frame strip)*
**New chat.**

> A 4-frame drive-animation sprite strip of the SAME vehicle for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The vehicle: a fast four-wheel military recon buggy — open lightweight frame, chunky off-road tyres, roll cage, small pintle machine gun — in dusty steel blue-grey paint (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up. FOUR frames side by side in one horizontal row, identical vehicle, size, and position in each frame — the ONLY change between frames is the wheel-tread pattern rotating slightly each frame and a faint dust flick at the rear wheels (kept inside the sprite silhouette). Vehicle centred in each quarter of the image. Solid flat pure magenta #FF00FF background filling every non-vehicle pixel. No shadows outside the vehicle, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

**Save as:** `51.png` (or `51.jpg`)

### #52 → becomes `assault_tank__player__drive.png` *(wide 4-frame strip)*
**New chat.**

> A 4-frame drive-animation sprite strip of the SAME vehicle for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The vehicle: a mid-size tracked battle tank — wedge glacis hull, wide treads with side skirts, circular turret with a single long forward cannon — in dusty steel blue-grey armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up with the barrel pointing up. FOUR frames side by side in one horizontal row, identical tank, size, and position in each frame — the ONLY change between frames is the tread-link pattern shifting forward slightly each frame (rolling tracks). Tank centred in each quarter of the image. Solid flat pure magenta #FF00FF background filling every non-tank pixel. No shadows outside the tank, no grid lines, no frame borders, no labels. Wide image, 4:1 aspect ratio. PNG.

**Save as:** `52.png` (or `52.jpg`)

### #53 → becomes `infantry__player__fire.png` *(wide image)*
**New chat.**

> A 2-frame firing-animation sprite strip of the SAME character for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The character: a small sci-fi desert infantry soldier — helmet, backpack, rifle held forward — in dusty steel blue-grey armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up, standing still in a firing stance. TWO frames side by side in one horizontal row, identical character, size, and position in each frame: FRAME 1 = aiming, ready; FRAME 2 = the shot — a small bright muzzle flash at the rifle tip and the shoulders rocked back slightly in recoil. Character centred in each half of the image. Solid flat pure magenta #FF00FF background filling every non-character pixel. No shadows outside the character, no grid lines, no frame borders, no labels. Wide image, 2:1 aspect ratio. PNG.

**Save as:** `53.png` (or `53.jpg`)

### #54 → becomes `assault_tank__player__fire.png` *(wide image)*
**New chat.**

> A 2-frame firing-animation sprite strip of the SAME vehicle for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The vehicle: a mid-size tracked battle tank — wedge hull, wide treads, circular turret with a single long forward cannon — in dusty steel blue-grey armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up with the barrel pointing up. TWO frames side by side in one horizontal row, identical tank, size, and position in each frame: FRAME 1 = ready; FRAME 2 = the shot — a bright muzzle flash at the barrel tip and the barrel recoiled back a few pixels into the turret. Tank centred in each half of the image. Solid flat pure magenta #FF00FF background filling every non-tank pixel. No shadows outside the tank, no grid lines, no frame borders, no labels. Wide image, 2:1 aspect ratio. PNG.

**Save as:** `54.png` (or `54.jpg`)

### #55 → becomes `longbow__player__fire.png` *(wide image)*
**New chat.**

> A 2-frame firing-animation sprite strip of the SAME vehicle for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted chunky retro style — NOT modern 3D, NOT cartoon. The vehicle: a tracked long-range artillery vehicle — a low tracked chassis with one very long single artillery barrel pointing forward and four splayed hydraulic stabilizer feet — in dusty steel blue-grey armour (#3d7fd6, shadow #28568f) with cyan accents (#00e5ff), viewed from DIRECTLY ABOVE, facing straight up with the barrel pointing up. TWO frames side by side in one horizontal row, identical vehicle, size, and position in each frame: FRAME 1 = ready, feet planted; FRAME 2 = the shot — a large bright muzzle blast at the barrel tip, the barrel recoiled back along its cradle, and a small smoke puff (kept inside the sprite silhouette). Vehicle centred in each half of the image. Solid flat pure magenta #FF00FF background filling every non-vehicle pixel. No shadows outside the vehicle, no grid lines, no frame borders, no labels. Wide image, 2:1 aspect ratio. PNG.

**Save as:** `55.png` (or `55.jpg`)


---

# BATCH 5 — Faction skins (Emberhand + Shardborn)

### #56 → becomes `infantry__emberhand__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a desert raider infantry soldier of a scavenger warband — rifle held forward, ash-black cloth wraps under mismatched welded salvage armour plates in scorched red-iron (#d1503a, shadow #8f3020, highlight #ffb08f) with visible weld seams, soot streaks, and a small ember-crimson glow (#ff4a3d) at the goggles; a ragged half-cape. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one figure, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `56.png` (or `56.jpg`)

### #57 → becomes `rocket_trooper__emberhand__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a desert raider rocket trooper of a scavenger warband — a fat twin-tube rocket launcher over one shoulder, its tubes clearly salvaged and mismatched with welded patch plates and yellow warhead tips; ash-black cloth wraps under scorched red-iron armour (#d1503a, shadow #8f3020, highlight #ffb08f) with soot streaks and a small ember-crimson glow (#ff4a3d). Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one figure, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `57.png` (or `57.jpg`)

### #58 → becomes `harvester__emberhand__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a scavenger warband's tracked ore-hauler harvester — the biggest ground vehicle: very wide treads, a big ribbed rear hopper, a front intake scoop, an exhaust stack — but built from salvage: mismatched welded plates in scorched red-iron (#d1503a, shadow #8f3020, highlight #ffb08f), soot-blackened exhaust, chained-on spare parts, a faded hazard stripe on the hopper lip, faint purple crystal glow inside the hopper, small ember-crimson lights (#ff4a3d). Viewed from DIRECTLY ABOVE (pure top-down), facing straight up with the scoop at the top, exactly one vehicle, centred with a generous empty margin. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. Background: every pixel outside the vehicle is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `58.png` (or `58.jpg`)

### #59 → becomes `barracks__emberhand__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a scavenger warband barracks — a low bunker assembled from salvaged shipping containers and welded scrap plates in scorched red-iron (#d1503a, shadow #8f3020, highlight #ffb08f), a lit doorway glowing ember-crimson (#ff4a3d), a ragged canvas awning, soot-streaked vents, a warband banner pole. Viewed from almost directly above with a slight three-quarter depth: roof lit, front (lower) face darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `59.png` (or `59.jpg`)

### #60 → becomes `refinery__emberhand__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a scavenger warband ore refinery — two vertical silo tanks patched with mismatched welded plates, a low open docking bay, exposed jury-rigged pipework, a soot-blackened exhaust stack, all in scorched red-iron (#d1503a, shadow #8f3020, highlight #ffb08f) with ember-crimson lights (#ff4a3d) and a faint purple crystal glow at the intake. Viewed from almost directly above with a slight three-quarter depth: roof lit, front (lower) face darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG.

**Save as:** `60.png` (or `60.jpg`)

### #61 → becomes `defense_turret__emberhand__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a scavenger warband defense turret — a squat pedestal of welded scrap plates topped by a salvaged rotary cannon with mismatched barrels, ammo belts draped over the side, in scorched red-iron (#d1503a, shadow #8f3020, highlight #ffb08f) with an ember-crimson sight glow (#ff4a3d). The cannon points straight up. Viewed from almost directly above with a slight three-quarter depth: top lit, front (lower) face darker. Muted desert sunlight from the upper left, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the structure, right up to its footprint. No gradient, no vignette, no grid, no text. One turret only, centred, generous margin. Square PNG.

**Save as:** `61.png` (or `61.jpg`)

### #62 → becomes `infantry__shardborn__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline warrior — a humanoid figure whose armour is GROWN, not built: translucent violet crystal plates (#b49bd8 to #e6d4ff) with a soft violet inner glow, fused over obsidian-black organic under-plating (#3c3630), crystal spurs at the shoulders, its forearm extruded into a faceted crystal blade-rifle. Flowing faceted forms, NO straight machined edges, no bolts, no fabric. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one figure, centred with a generous empty margin. Muted desert sunlight from the upper left plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `62.png` (or `62.jpg`)

### #63 → becomes `rocket_trooper__shardborn__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline artillery warrior — a humanoid figure of grown translucent violet crystal (#b49bd8 to #e6d4ff, soft inner glow) over obsidian-black organic plating (#3c3630), with a large hollow crystal launcher-horn grown over one shoulder, glowing shard projectiles visible inside it. Flowing faceted forms, NO straight machined edges, no bolts, no fabric. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up, exactly one figure, centred with a generous empty margin. Muted desert sunlight from the upper left plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. Background: every pixel outside the figure is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `63.png` (or `63.jpg`)

### #64 → becomes `harvester__shardborn__move.png`
**New chat.**

> A single video-game unit sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline harvester creature-machine — a large low burrowing collector GROWN from obsidian-black organic plating (#3c3630) and translucent violet crystal (#b49bd8 to #e6d4ff, soft inner glow): a segmented beetle-like body instead of treads, a fanged crystal intake maw at the front, and a swollen glowing crystal storage bulb on its back instead of a hopper. Flowing faceted forms, NO straight machined edges, no bolts. Viewed from DIRECTLY ABOVE (pure top-down), facing straight up with the maw at the top, exactly one creature- machine, centred with a generous empty margin. Muted desert sunlight from the upper left plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. Background: every pixel outside it is solid flat pure magenta #FF00FF — no gradient, no vignette, no ground, no grid, no text. Square PNG.

**Save as:** `64.png` (or `64.jpg`)

### #65 → becomes `barracks__shardborn__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline spawning structure — a low hive-like mound GROWN from obsidian-black organic plating (#3c3630) and clusters of translucent violet crystal (#b49bd8 to #e6d4ff, soft inner glow), with one glowing fissure-opening where warriors emerge and small crystal spires around it. Flowing organic-faceted forms, NO straight machined edges, no doors, no panels. Viewed from almost directly above with a slight three-quarter depth: top lit, front (lower) face darker. Muted desert sunlight from the upper left plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. The formation sits FLAT with absolutely NO base platform and NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the formation, right up to its footprint. No gradient, no vignette, no grid, no text. One formation only, centred, generous margin. Square PNG.

**Save as:** `65.png` (or `65.jpg`)

### #66 → becomes `refinery__shardborn__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline digestion structure — a resource processor GROWN from obsidian-black organic plating (#3c3630) with two tall swollen translucent violet crystal sacs (#b49bd8 to #e6d4ff) glowing brightly with absorbed energy, connected by rope-like crystal veins to a low intake maw where a harvester docks. Flowing organic-faceted forms, NO straight machined edges, no pipes, no panels. Viewed from almost directly above with a slight three-quarter depth: top lit, front (lower) face darker. Muted desert sunlight from the upper left plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. The formation sits FLAT with absolutely NO base platform and NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the formation, right up to its footprint. No gradient, no vignette, no grid, no text. One formation only, centred, generous margin. Square PNG.

**Save as:** `66.png` (or `66.jpg`)

### #67 → becomes `defense_turret__shardborn__idle.png`
**New chat.**

> A single video-game building sprite for a late-1990s Westwood-style desert RTS (Command & Conquer, Red Alert, Dune 2000 era), painted and chunky with a hard readable silhouette — NOT a modern 3D render, NOT cartoon, NOT pixel-art dithering. Subject: a crystalline defense spire — a defensive growth: a twisted obsidian-black stalk (#3c3630) crowned by a large sharp translucent violet crystal lance-shard (#b49bd8 to #e6d4ff) glowing at its core and aimed straight up, ringed by smaller crystal spurs at the base. Grown, not built: flowing faceted forms, NO straight machined edges, no barrels, no panels. Viewed from almost directly above with a slight three-quarter depth: top lit, front (lower) face darker. Muted desert sunlight from the upper left plus the violet inner glow, soft shading painted into the sprite, NO shadow cast on the ground, thin dark outline rim. The formation sits FLAT with absolutely NO base platform and NO ground tile — solid flat pure magenta #FF00FF fills every pixel outside the formation, right up to its footprint. No gradient, no vignette, no grid, no text. One formation only, centred, generous margin. Square PNG.

**Save as:** `67.png` (or `67.jpg`)


---

# BATCH 6 — Presentation art (plain illustrations — NO magenta)

### #68 → becomes `presentation/title_backdrop.png` *(wide image)*
**New chat.**

> A wide painted title-screen backdrop for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era) — a hand-painted, slightly gritty concept-art style, NOT modern photoreal 3D, NOT cartoon. Scene: a vast desert at dusk on an alien world, the sand veined with glowing purple crystal seams running toward the horizon; distant industrial refinery silhouettes with tiny lights on the skyline; a towering violet lightning storm building on the horizon; warm dusk light from the low sun against the cold violet glow. Epic, quiet, ominous. Leave the upper-middle area relatively calm so a game logo can sit over it. Wide 16:9 image, no text, no logo, no characters.

**Save as:** `68.png` (or `68.jpg`)

### #69 → becomes `presentation/portrait_warden.png`
**New chat.**

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command & Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light, plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly square, no text. Subject: THE WARDEN — an armoured hero commander whose face is fully enclosed in a sleek steel-grey combat helmet with a single glowing cyan visor slit, heavy powered-armour shoulder plates with cyan seam lights, battle-worn steel blue-grey finish. Imposing, anonymous, loyal.

**Save as:** `69.png` (or `69.jpg`)

### #70 → becomes `presentation/portrait_corr.png`
**New chat.**

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command & Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light, plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly square, no text. Subject: MARSHAL CORR — a weathered senior military commander in his 60s, grey-templed close-cropped hair, deep lines, a small scar over one brow, a stiff steel-grey uniform collar with subtle cyan rank bars. Stern, tired, principled — a man carrying a war.

**Save as:** `70.png` (or `70.jpg`)

### #71 → becomes `presentation/portrait_vane.png`
**New chat.**

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command & Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light, plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly square, no text. Subject: SERA VANE — a desert warlord woman in her 40s, sun-hardened face with pale ash-mark ritual streaks across one cheek, dark hair pulled back, an ash-grey cloak clasped with scorched iron, a crimson sash across her chest, faint ember- orange reflected light on one side of her face. Fierce, charismatic, dangerous.

**Save as:** `71.png` (or `71.jpg`)

### #72 → becomes `presentation/portrait_halex.png`
**New chat.**

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command & Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light, plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly square, no text. Subject: DIRECTOR HALEX — a cold corporate executive in his 50s, immaculate: slicked steel-grey hair, rimless glasses catching the light, a severe high-collared charcoal corporate suit with a thin cyan pin, the faintest contemptuous smile. Bloodless, calculating.

**Save as:** `72.png` (or `72.jpg`)

### #73 → becomes `presentation/portrait_yssel.png`
**New chat.**

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command & Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light, plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly square, no text. Subject: BROKER YSSEL — an ornately dressed information broker of indeterminate age, layered rich fabrics in desert tones with gold thread, many small rings and a jewelled ear cuff, kohl-lined knowing eyes, a warm practiced smile that does not reach them. Opulent, friendly, untrustworthy.

**Save as:** `73.png` (or `73.jpg`)

### #74 → becomes `presentation/portrait_chorus.png`
**New chat.**

> A painted military briefing portrait for a late-1990s Westwood-style RTS (Command & Conquer era) — head-and-shoulders bust, three-quarter view, dramatic single key light, plain dark neutral backdrop, gritty painted style, NOT photoreal, NOT anime, roughly square, no text. Subject: THE CHORUS — a shard-touched human face, serene and WRONG: translucent violet crystal growths fusing through one temple and cheek, faint violet light glowing beneath the skin along the veins, and eyes that are uniformly wrong — no pupils, softly luminous violet. Calm, alien, quietly terrifying — many speaking as one.

**Save as:** `74.png` (or `74.jpg`)

### #75 → becomes `presentation/act1_card.png` *(wide image)*
**New chat.**

> A wide painted campaign act-card illustration for a late-1990s Westwood-style desert RTS (Command & Conquer era) — hand-painted gritty concept-art style, NOT photoreal, NOT cartoon, no text. Scene for "Operation Aether Prime": a formation of steel-grey military dropships with cyan running lights descending through dusty morning air over a vast desert, landing struts deploying, sand billowing beneath them; below, tiny vehicles and troops fan out from a beachhead; purple crystal seams glint in the dunes. Confident, martial, dawn-of-the-campaign mood. Wide 16:9, leave lower third calmer for a title overlay.

**Save as:** `75.png` (or `75.jpg`)

### #76 → becomes `presentation/act2_card.png` *(wide image)*
**New chat.**

> A wide painted campaign act-card illustration for a late-1990s Westwood-style desert RTS (Command & Conquer era) — hand-painted gritty concept-art style, NOT photoreal, NOT cartoon, no text. Scene for "The Waking Deep": a night scene at the mouth of a vast glowing crystal vein — a canyon floor split by pulsing violet light from below; a line of ragged silhouetted desert raiders with scavenged armour and weapons stand at its rim, lit only by the violet glow, ash and embers drifting; something enormous coils beneath the light. Ominous, awed, before-the-plunge mood. Wide 16:9, leave lower third calmer for a title overlay.

**Save as:** `76.png` (or `76.jpg`)

### #77 → becomes `presentation/credits_backdrop.png` *(wide image)*
**New chat.**

> A wide painted illustration for the end credits of a late-1990s Westwood-style desert RTS (Command & Conquer era) — hand-painted gritty concept-art style, NOT photoreal, NOT cartoon, no text. Scene: "the First Vein" — a vast glowing fissure splitting a desert plain, radiant violet light pouring up out of it into the night sky like an aurora; at its rim, a handful of tiny human figures and one small vehicle stand silhouetted, dwarfed by the scale; drifting motes of light rise from the depths. Vast, elegiac, final. Wide 16:9, dark enough overall for light credit text to scroll over.

**Save as:** `77.png` (or `77.jpg`)


---

# BATCH 7 — New terrain tiles (OPTIONAL — skip if not seamless)

### #78 → becomes `terrain__scorched.png`
**New chat.**

> A single seamless square ground-texture tile for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted gritty style, viewed from directly above. Subject: scorched battlefield sand — desert ground charred black and ash-grey by a massive burn (base near #3c3630 fading into charred sand #7a6650), with fine ash drifts, hairline cracked glassy patches, and a few faint dying embers. Muted, dark, matte. CRITICAL: the texture must be perfectly SEAMLESS and tileable — the left edge must continue the right edge exactly and the top edge must continue the bottom edge exactly, with no vignette, no lighting gradient, no centred feature, no border. Even, flat overhead lighting. Square image, texture fills the entire frame edge to edge. PNG.

**Save as:** `78.png` (or `78.jpg`)

### #79 → becomes `terrain__scorched_2.png`
**SAME chat as #78** — paste right after its image:

> Another tile of the exact same scorched-ground texture as the image you just generated above — same palette, same scale, same flat even lighting, perfectly seamless and tileable (left edge continues the right edge, top continues the bottom) — but a different random arrangement of cracks, ash drifts, and embers. Square PNG, texture fills the frame edge to edge.

**Save as:** `79.png` (or `79.jpg`)

### #80 → becomes `terrain__crystal_lattice.png`
**New chat.**

> A single seamless square ground-texture tile for a late-1990s Westwood-style desert RTS (Command & Conquer / Dune 2000 era), painted gritty style, viewed from directly above. Subject: alien crystal-creep ground — desert sand being overgrown by a web-like lattice of translucent violet crystal veins (tones #7d6a9a base with brighter veins #b49bd8 to #e6d4ff) spreading across darker corrupted ground (#3c3630), with tiny crystal nubs budding at vein junctions and a faint soft violet glow along the veins. CRITICAL: the texture must be perfectly SEAMLESS and tileable — the left edge must continue the right edge exactly and the top edge must continue the bottom edge exactly, with no vignette, no lighting gradient, no centred feature, no border. Even, flat overhead lighting. Square image, texture fills the entire frame edge to edge. PNG.

**Save as:** `80.png` (or `80.jpg`)

### #81 → becomes `terrain__crystal_lattice_2.png`
**SAME chat as #80** — paste right after its image:

> Another tile of the exact same crystal-creep texture as the image you just generated above — same palette, same scale, same flat even lighting, perfectly seamless and tileable (left edge continues the right edge, top continues the bottom) — but a different random arrangement of violet veins and crystal nubs. Square PNG, texture fills the frame edge to edge.

**Save as:** `81.png` (or `81.jpg`)

---

## Checklist

- Batch 1 = #1–#6 · Batch 2 = #7–#21 · Batch 3 = #22–#46 · Batch 4 = #47–#55 ·
  Batch 5 = #56–#67 · Batch 6 = #68–#77 · Batch 7 = #78–#81
- One folder, files named by number, tell Claude the path. Everything else is scripted.
