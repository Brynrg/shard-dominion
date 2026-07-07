# Shard Dominion — Art Asset Specification (v1)

This is the exact, drop-in spec for real sprite art to replace the procedural graphics.
Deliver assets to these conventions (format, sizes, naming, metadata) and the engine
loads them with **zero code changes on your side** — I wire a loader that reads each
sheet + its JSON sidecar and falls back to the current procedural art for anything not
yet delivered. So you can ship assets **incrementally** (one unit at a time is fine).

Art can be **hand-drawn OR AI-generated** — each asset below has a ready-to-paste
generation prompt plus hard technical requirements. The technical requirements are what
make it plug in; the prompt is just to hit the style.

---

## 0. Art direction (read first)

- **Era / style:** late-1990s Westwood real-time-strategy — think **Dune 2000 / Command &
  Conquer: Tiberian Sun**. Pre-rendered-look 3D models shot from a fixed high angle, then
  reduced to small sprites. Gritty, industrial, military-desert. Readable silhouettes over
  a noisy sand background matter more than fine surface detail.
- **Camera / perspective:** **top-down at a ~35–45° tilt** (high three-quarter). You see
  the tops of units plus a little of their front/sides. This ONE camera angle is used for
  **every** unit, building, and tile — do not mix flat top-down and side views.
- **Light:** single key light from the **upper-left (north-west)**, warm desert sun. Bake
  soft **form/self-shadow** into the sprite (darker lower-right of each shape). **Do NOT
  bake a ground/cast shadow** — the engine draws the contact shadow beneath every unit.
- **Background:** fully **transparent** (RGBA alpha). No skybox, no ground, no frame.
- **Readability:** give each sprite a subtle **1–2 px darker rim / outline** so it separates
  from the sand. Keep internal detail crisp at small size (see per-asset in-game px below).
- **Setting flavor:** planet "Aether Prime", a desert veined with a purple power-crystal
  called **Shard**. Vehicles are dusty, sand-worn, functional. Two rival clans (see colors).

---

## 0.5 Two production paths (pick based on your tool)

**PATH A — image generator (Grok / DALL·E / Midjourney). RECOMMENDED, and what the
loader is tuned for.** AI image tools cannot produce a precise 16-facing sprite *atlas*
(consistent scale, exact grid, correct per-cell rotation), so **don't ask them to.**
Instead deliver **ONE clean top-down sprite per unit/building**:
- **One image per asset**, the unit **facing straight UP (North)**, centred, generous margin.
- **Background = solid pure magenta `#FF00FF`** filling every non-sprite pixel. The engine
  **chroma-keys that magenta to transparent** at load, so it doesn't matter that the file
  is opaque. (Buildings too.)
- **PNG strongly preferred; JPG tolerated.** JPEG has **no transparency and fuzzes the
  magenta edges** → slight fringing. PNG keys cleanly. **Never rely on "transparent
  background" from an image model — use the magenta key instead.**
- The engine **rotates** each unit sprite to its heading and keeps buildings static, so
  you get all directions from the single image. Animation frames are optional/later.

**PATH B — pre-rendered/hand-authored atlas (Blender, Aseprite, a 3D pipeline).** If you
have a real rendering pipeline, deliver the full multi-facing sheets in §3–5 (transparent
PNG, 16/8 facings, animation rows). Higher fidelity; more work. The loader supports both.

> The rest of this doc is the full PATH-B spec. For PATH A you only need: one magenta-
> background PNG per asset, named `assetId__team__state.png`, unit facing up. That's it —
> I generate the JSON + manifest via `scripts/import-art.mjs`.

## 1. Global technical requirements

| Property | Requirement |
|---|---|
| Format | **PNG-32, RGBA**, straight (non-premultiplied) alpha, sRGB |
| Background | Fully transparent |
| Cast shadow | **None** (engine adds it). Bake only self-shading. |
| Delivery scale | **4× the in-game size** (crisp + future-proof; engine downscales). Every frame's pixel size below is already the 4× number. |
| Layout | One **sprite sheet PNG per (asset, team, state)** + a **JSON sidecar** with identical basename. |
| Grid | **Row = facing** (top→bottom, in facing order below). **Column = animation frame** (left→right, in time). No padding/gutter between frames; every frame is exactly `frameWidth × frameHeight`. |
| Pivot | The unit's **ground contact point** (where it "stands"), given in JSON as `pivotX/pivotY` in frame pixels. Keep it identical across all facings/frames of a sheet. The engine blits so the pivot sits on the world position. |
| Consistency | A unit must be the **same scale** in every facing (a tank doesn't grow when it turns). Center the unit consistently. |
| Color space | Use the exact **team + terrain hex** in §2 so new art matches the existing HUD, radar blips, fog and UI (which stay procedural). |

---

## 2. Palettes (match these exactly)

**Faction colors** — every unit/building comes in two team variants that read instantly as
blue vs red. Use these as the dominant hull/trim hues:

| Team | Hull (main) | Hull shadow | Light accent | Glow / stripe |
|---|---|---|---|---|
| **player** (blue) | `#3d7fd6` | `#28568f` | `#a7d6ff` | `#00e5ff` |
| **enemy** (red) | `#d1503a` | `#8f3020` | `#ffb08f` | `#ff4a3d` |
| **neutral** (gray, for slab/wrecks) | `#9a9a9a` | `#6a6a6a` | `#d8d8d8` | `#ffffff` |

**Terrain base colors** (so tiles blend with the untextured/fog areas the engine still draws):

| Type | Base | Notes |
|---|---|---|
| `sand` | `#d9be86` | default ground |
| `deep_sand` | `#c9a566` | darker drift |
| `dune` | `#d8b979` | wind-rippled |
| `rock` | `#7a6650` | raised, casts AO (engine adds) |
| `impassable` | `#3c3630` | near-black rubble/cliff |
| `shard` | `#7d6a9a` base, flecks `#b49bd8` → `#e6d4ff` | the **purple resource crystal**; should glow/catch light and draw the eye |

Metals/neutral detailing (barrels, treads, vents): treads `#221f18`, steel `#5b5f66`,
steel-dark `#33363b`, hazard yellow `#e8b100`, warning red `#ff4a3d`.

---

## 3. Facing & animation conventions

Mobile units are drawn from many **fixed heading frames** (no live rotation — that's the
Westwood look). Deliver facings in this order:

- **Facing 0 = pointing NORTH (up / screen −Y). Facings increase CLOCKWISE.**
- **Vehicles, harvester, MCV → 16 facings** (22.5° apart).
- **Infantry, rocket trooper → 8 facings** (45° apart) — infantry read fine at 8, and their
  walk animation matters more than fine heading.

**16-facing table (row order, top→bottom of the sheet):**

| Row | Heading | ° CW from North |
|---|---|---|
| 0 | N | 0 |
| 1 | NNE | 22.5 |
| 2 | NE | 45 |
| 3 | ENE | 67.5 |
| 4 | E | 90 |
| 5 | ESE | 112.5 |
| 6 | SE | 135 |
| 7 | SSE | 157.5 |
| 8 | S | 180 |
| 9 | SSW | 202.5 |
| 10 | SW | 225 |
| 11 | WSW | 247.5 |
| 12 | W | 270 |
| 13 | WNW | 292.5 |
| 14 | NW | 315 |
| 15 | NNW | 337.5 |

**8-facing (infantry):** rows 0–7 = N, NE, E, SE, S, SW, W, NW.

> If your pipeline more naturally produces "0 = East" or counter-clockwise, that's fine —
> just state it in the JSON (`facing0`, `facingOrder`) and I map it. But the default above
> is preferred.

**Animation columns** (left→right in time) — required vs optional per asset in §5. If an
asset has no animation, deliver **1 column** (static). `fps` in JSON drives playback.

---

## 4. Naming & delivery structure

Lowercase, double-underscore separators:

```
<assetId>__<team>__<state>.png
<assetId>__<team>__<state>.json      (sidecar, same basename)
```

- `assetId` — the exact ids in §5 (e.g. `vehicle`, `refinery`, `rocket_trooper`).
- `team` — `player` | `enemy` | `neutral`.
- `state` — `move` (default) | `fire` | `deploy` | `idle` | `build` | `damaged` | `die`.

Folder tree:

```
art/
  units/        vehicle__player__move.png (+ .json), vehicle__player__fire.png, vehicle__enemy__move.png, ...
  buildings/    refinery__player__idle.png (+ .json), refinery__enemy__idle.png, ...
  terrain/      terrain__sand.png (+ .json), terrain__rock.png, terrain__shard.png, ...
  fx/           fx__explosion_large.png (+ .json), fx__muzzle_bullet.png, ...
  projectiles/  proj__bullet.png (+ .json), proj__rocket.png, proj__shell.png
```

**JSON sidecar schema** (one per sheet):

```json
{
  "assetId": "vehicle",
  "team": "player",
  "state": "move",
  "frameWidth": 192,
  "frameHeight": 192,
  "facings": 16,
  "frames": 1,
  "facing0": "north",
  "facingOrder": "cw",
  "fps": 0,
  "pivotX": 96,
  "pivotY": 108,
  "inGameWidthPx": 44,
  "scale": 4
}
```
- `facings` = number of rows, `frames` = number of animation columns.
- `pivotX/pivotY` = ground point inside one frame (px). For a top-down vehicle, ≈ frame
  center. For a tall building, center-x and near the **base** of the footprint.
- `inGameWidthPx` = how wide the sprite should appear on screen at 1× zoom (engine scales
  the frame to this). Tile = 32 px in-game for reference.

---

## 5. Asset manifest (per-asset, extreme detail)

### 5.1 Units (assetId, in `art/units/`)

All units: **transparent bg, self-shadow only, NW light, dusty desert finish, subtle dark
rim.** Provide **both `player` and `enemy`** variants. Frame sizes are the 4×-delivery px.

Reusable **style preamble** to prepend to any unit generation prompt:
> *Top-down three-quarter (≈40° tilt) sprite of a gritty late-90s Westwood-style desert RTS
> unit, single sun from upper-left, soft baked self-shadow, NO ground shadow, transparent
> background, crisp readable silhouette with a subtle dark rim, sand-worn military finish,
> centered, consistent scale.*

| assetId | What it is | In-game px | Frame px (4×) | Facings | States (cols) |
|---|---|---|---|---|---|
| `infantry` | rifleman trooper | 26 | 128×128 | 8 | **move** = 4-frame walk *(req)*; **fire** = 3-frame *(opt)*; **die** = 4-frame *(opt)* |
| `rocket_trooper` | trooper with shoulder rocket launcher | 26 | 128×128 | 8 | same as infantry |
| `vehicle` | light scout **tank**, rotating-look turret + barrel | 44 | 192×192 | 16 | **move** = 1 static *(req)*; **fire** = 3-frame recoil+muzzle *(opt)* |
| `harvester` | chunky tracked **ore hauler** w/ front scoop + hopper | 52 | 224×224 | 16 | **move** = 1 static *(req)*; **harvest** = 4-frame scooping loop *(opt)* |
| `mcv` | heavy **mobile construction vehicle** (deploys into a building) | 48 | 208×208 | 16 | **move** = 1 static *(req)*; **deploy** = 6-frame unfold, facing N only *(opt)* |

Per-unit detail cues (keep the established read so gameplay stays legible):

- **infantry** — small; helmet, backpack, shoulder pads; rifle held forward. Team color on
  torso/helmet band. Legs visible for the walk cycle.
- **rocket_trooper** — same body; a fat **twin-tube launcher** over the shoulder with a
  yellow warhead tip. Must be distinguishable from `infantry` at a glance.
- **vehicle** — wedge glacis hull + **circular turret with a hatch** + a single forward
  barrel with a bright team-color muzzle band; side-skirts over the treads; rear engine
  deck with louvres. Team color on hull body.
- **harvester** — the biggest ground unit; wide treads, ribbed **hopper** on the back,
  a **front intake scoop/blade**, an exhaust stack, and a **yellow/black hazard stripe**
  along the hopper lip. Muted/dusty — it's economy, not military. When full it can show a
  faint **purple Shard glow** in the hopper (engine also adds a glow, so keep it subtle).
- **mcv** — broad hexagonal crawler, fold-out panel seams, a glowing team-color **core**
  with vents, a small warning beacon. `deploy` (optional) morphs it toward the
  construction-yard footprint over 6 frames.

### 5.2 Buildings (assetId, in `art/buildings/`)

Buildings do **not** rotate → `facings: 1`. Provide **`player` + `enemy`**. Drawn in the
same 3/4 tilt with visible **height/depth** (a lit roof and a darker front face) and a
**team-color trim/stripe**. Pivot = horizontal center, vertical at the **front-base** of
the footprint (give `pivotY` near the bottom of the sprite). Buildings sit on the ground;
include a bit of grounded skirt but **no cast shadow**.

| assetId | Footprint (tiles) | In-game px (w×h) | Frame px (4×) | States |
|---|---|---|---|---|
| `refinery` | 3×2 | 96×80 | 384×320 | **idle** = 4-frame (venting exhaust / dock light) *(req)*; **damaged** *(opt)* |
| `barracks` | 2×2 | 64×64 | 256×256 | **idle** = 2-frame (door light / vent) *(req)*; **damaged** *(opt)* |
| `construction_yard` | 2×2 | 80×72 | 320×288 | **idle** = 4-frame (**crane arm sweeps** + hazard beacon blink) *(req)*; **build** = 6-frame rise *(opt)*; **damaged** *(opt)* |
| `power_node` | 1×1 | 40×56 | 160×224 | **idle** = 2-frame (pulsing antenna light) *(req)* |
| `concrete_slab` | 1×1 | 32×32 | 128×128 | 1 static, **neutral** team only *(opt)* |

Detail cues:
- **refinery** — two vertical **silo tanks** + a **docking bay** where the harvester unloads;
  a small exhaust that puffs (the 4 idle frames).
- **barracks** — blocky bunker with a **lit doorway** troops exit from; roof ridge/vents.
- **construction_yard** — heaviest structure; a **crane arm** that sweeps across the roof
  (animate its hook L↔R across the 4 idle frames) + a blinking red hazard beacon.
- **power_node** — a compact pylon with an **antenna mast** whose tip light pulses.

### 5.3 Terrain (in `art/terrain/`, `neutral`)

Tiles are **32 px in-game → 128×128 at 4×**, seamlessly tileable (edges wrap). Deliver each
type as a **horizontal strip of 3–4 variant tiles** (reduces obvious repetition); the engine
picks a variant deterministically per map cell. Match the §2 base hues.

| file | frames (variants) | notes |
|---|---|---|
| `terrain__sand.png` | 4 | default ground, faint grain |
| `terrain__deep_sand.png` | 3 | darker drift |
| `terrain__dune.png` | 3 | wind ripples (directional ridges ok) |
| `terrain__rock.png` | 3 | raised rocky ground, cracks/facets |
| `terrain__impassable.png` | 2 | near-black rubble/cliff |
| `terrain__shard.png` | **3 (density: full → medium → low)** | glowing purple crystal clusters; frame 0 = richest, 2 = nearly mined-out. Should clearly **draw the eye** as the resource. |

*(Optional, advanced but very high-value: a sand↔rock and sand↔shard **transition/edge
set** — 12 edge/corner tiles each — so terrain borders aren't hard grid lines. If omitted,
the engine keeps its procedural edge-blending.)*

### 5.4 Combat FX (in `art/fx/`, `neutral`)

Sheets are a **single horizontal strip** of animation frames (`facings: 1`). Additive-glow
friendly (bright on transparent).

| file | frames | in-game px | frame px (4×) | notes |
|---|---|---|---|---|
| `fx__explosion_large.png` | 8 | 64 | 256×256 | building/vehicle death — fireball → smoke |
| `fx__explosion_small.png` | 6 | 34 | 136×136 | infantry death / small hit |
| `fx__muzzle_bullet.png` | 3 | 16 | 64×64 | quick yellow-white flash |
| `fx__muzzle_rocket.png` | 4 | 22 | 88×88 | launcher backblast + smoke |
| `fx__shard_sparkle.png` | 4 | 20 | 80×80 | *(opt)* crystal glint on shard tiles |

### 5.5 Projectiles (in `art/projectiles/`, `neutral`)

Deliver **pointing East (+X, screen right)**; the engine rotates them to travel direction.
Single frame each (optional 2-frame flicker). Small, bright.

| file | in-game px | frame px (4×) | notes |
|---|---|---|---|
| `proj__bullet.png` | 6 | 24×24 | short yellow tracer |
| `proj__rocket.png` | 14×6 | 56×24 | small missile with a fin + faint flame tail |
| `proj__shell.png` | 8 | 32×32 | tank shell / glowing slug |

### 5.6 Optional UI (in `art/ui/`) — *nice-to-have; engine currently draws these*

`ui__cursor.png` (32px), `ui__selection_ring.png` (48px, animated 4-frame spin optional),
`ui__hud_frame.png` (9-slice command panel), `ui__radar_frame.png`. Skip unless you want a
themed UI pass — if delivered, include a 9-slice guide for frames.

---

## 6. Team-color handling — pick ONE

**(A) Two full variants (simplest, recommended).** Deliver a `__player__` (blue) and an
`__enemy__` (red) sheet per unit/building, colored per §2. Zero ambiguity, best quality,
more files. This is the default assumed above.

**(B) Base + team mask (half the art, needs a remap step).** Deliver one **neutral** sheet
plus a same-size **`__mask` PNG** whose alpha marks the team-recolorable pixels (grayscale
= how strongly to tint). I then multiply the mask by each team hue at load. Use this if art
volume is a concern; tell me and I'll build the remap path instead of loading two variants.

Do not mix approaches within a category.

---

## 7. Priority order (ship incrementally)

Everything falls back to current procedural art until its sheet lands, so deliver in this
order for the fastest visible win:

1. `vehicle`, `infantry`, `rocket_trooper` (both teams) — the units you see most.
2. `harvester`, `mcv`.
3. `refinery`, `construction_yard`, `barracks`, `power_node` (both teams).
4. `terrain__sand/rock/shard` (+ variants).
5. `fx__explosion_large/small`, `fx__muzzle_*`, projectiles.
6. Transitions / UI / damaged states (polish).

---

## 8. Acceptance checklist (per sheet)

- [ ] PNG-32 RGBA, transparent bg, no cast shadow.
- [ ] Grid exact: `facings` rows × `frames` cols, every cell `frameWidth×frameHeight`, no gutters.
- [ ] Facing 0 + order match the JSON; unit scale identical across all facings.
- [ ] Pivot consistent across every frame; JSON `pivotX/pivotY` correct.
- [ ] Team hues match §2; silhouette readable at the stated in-game px.
- [ ] JSON sidecar present with matching basename and all fields filled.
- [ ] Filename matches `assetId__team__state` from §5.

Deliver into the `art/` tree (or a zip mirroring it). I'll add the loader + a JSON manifest
and swap each asset in as it arrives. Ping me with any asset where the convention is awkward
for your tooling and I'll adapt the engine side rather than make you conform.
