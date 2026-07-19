#!/usr/bin/env python3
"""Rebuild scripts/art-prompts.json with Warcraft-III-quality style language
and full roster coverage (core + expansion units/buildings).

Keeps the magenta PATH-A contract the importer expects.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts" / "art-prompts.json"

STYLE = (
    "A single game sprite at Warcraft III / Frozen Throne production quality: "
    "pre-rendered chunky 3D model with rich hand-painted textures, heroic proportions, "
    "visible rivets/panel seams/weathering, grit and sand wear, dramatic upper-left desert "
    "key light with soft form-shadows baked into the mesh — IP-clean sci-fi desert military RTS "
    "(NOT fantasy orcs/elves, NOT flat vector UI icons, NOT cartoon, NOT modern PBR photo, "
    "NOT pixel-art dithering). Hard readable silhouette, thin dark rim outline. "
)

MAGENTA_BLDG = (
    "The structure sits FLAT with absolutely NO base platform, NO concrete pad, NO ground tile "
    "beneath it — solid flat pure magenta #FF00FF fills every pixel outside the structure, "
    "right up to its footprint. No cast shadow on the ground (engine draws contact shadow). "
    "No gradient backdrop, no vignette, no grid, no text. One building only, centred, generous margin. Square PNG."
)

MAGENTA_UNIT = (
    "Background: every pixel outside the subject is solid flat pure magenta #FF00FF — "
    "no gradient, no vignette, no ground, no base plate, no cast shadow, no grid, no text. "
    "Square PNG."
)

VIEW_BLDG = (
    "Viewed from almost directly above with a slight three-quarter depth: roof brightly lit, "
    "front (lower) face a little darker so it reads as having height. "
)

VIEW_UNIT = (
    "Viewed from DIRECTLY ABOVE (pure top-down), facing straight up / north, "
    "exactly one subject, centred with a generous empty margin on all sides. "
)

CONCORD = (
    "Faction paint: dusty steel-blue armour plating (main #3d7fd6, shadow #28568f, highlight #a7d6ff) "
    "with glowing cyan accent lights (#00e5ff), sand-worn battle finish."
)
EMBER = (
    "Faction paint: scorched red-iron armour (main #d1503a, shadow #8f3020, highlight #ffb08f) "
    "with ember-crimson accent lights (#ff4a3d), ash-worn battle finish."
)
NEUTRAL = (
    "Paint in neutral sand-bleached grey metal (main #9a9a9a, shadow #6a6a6a, highlight #d8d8d8), "
    "dusty and sand-worn."
)
SHARDBORN = (
    "Faction paint: living teal-crystal armour (main #3ddc97, shadow #1c2b26, highlight #c8fff0) "
    "with violet Shard glow accents (#b48bff), crystalline facet seams."
)

RECOLOR_EMBER = (
    "Keep exactly the same vehicle/structure/figure as in the attached image — same pose, "
    "same camera, same Warcraft-III-quality painted RTS style, and the same solid pure magenta "
    "#FF00FF background — but repaint the faction colours only: dusty steel-blue armour becomes "
    "scorched red-iron (main #d1503a, shadow #8f3020, pale highlight #ffb08f), and every glowing "
    "cyan accent becomes ember crimson (#ff4a3d). Change nothing else about the design."
)

RECOLOR_SHARD = (
    "Keep exactly the same vehicle/structure/figure as in the attached image — same pose, "
    "same camera, same Warcraft-III-quality painted RTS style, and the same solid pure magenta "
    "#FF00FF background — but repaint the faction colours only: dusty steel-blue armour becomes "
    "living teal-crystal (main #3ddc97, shadow #1c2b26, highlight #c8fff0), and accents become "
    "violet Shard glow (#b48bff). Change nothing else about the design."
)


def bldg(subject: str, paint: str) -> str:
    return f"{STYLE}Subject: {subject} {VIEW_BLDG}{paint} {MAGENTA_BLDG}"


def unit(subject: str, paint: str) -> str:
    return f"{STYLE}Subject: {subject} {VIEW_UNIT}{paint} {MAGENTA_UNIT}"


# (file, batch, subject, paint_key, kind)  paint_key: concord|ember|neutral|shardborn|recolor_ember|recolor_shard
# basedOn derived for recolors
BUILDINGS = [
    ("construction_yard", "heavy construction yard HQ — broad industrial platform with roof crane arm + hook, fold-out panel seams, red hazard beacon, vents and machinery"),
    ("barracks", "military infantry barracks — low bunker with lit troop doorway, ridged roof vents, sandbags at walls"),
    ("refinery", "ore/Shard refinery — two vertical silo tanks, open docking bay for a hauler, pipework, exhaust stack, faint purple crystal glow in intake hopper"),
    ("power_node", "compact power pylon — squat generator with cooling fins and tall antenna mast with glowing tip"),
    ("war_factory", "vehicle war factory — huge roll-up bay door, gantry crane rail across roof, industrial vents"),
    ("defense_turret", "ground defense turret — squat armored base with rotating gun turret and long barrel"),
    ("aa_turret", "anti-air turret — twin upward barrels and a small radar dish on an armored pad"),
    ("radar", "radar station — low building with large rotating dish on a mast"),
    ("processing_plant", "processing plant — reactor drum, silo, pipework converting Shard into energy cells"),
    ("skypad", "air skypad — circular landing pad with H marking and glow ring, small control booth"),
    ("wall", "fortified wall segment — thick armor plate with battlements, seams, no gate opening"),
    ("gate", "base gate — two heavy wall pillars with open glowing throat between them"),
    ("bunker", "domed pillbox bunker — low armored dome with firing slits"),
    ("infirmary", "field infirmary — medical building with glowing white/cyan cross emblem"),
    ("machine_shop", "machine shop — sawtooth factory roof, repair bay door"),
    ("tech_lab", "tech laboratory — research building with glowing dome and instrument masts"),
    ("heavy_gate", "heavy reinforced gate — thicker wall pillars, barred glowing throat, heavier armor"),
    ("barracks_elite", "elite barracks — larger bunker with chevron banner, reinforced doorway, more sandbags"),
    ("armor_upgrade_center", "armor upgrade center — plating press / anvil workshop with industrial press arms"),
    ("air_pad", "compact air pad — landing circle with chevrons and fuel tanks"),
    ("radar_addon", "radar upgrade annex — small dish mast attached to a compact housing"),
    ("ion_cannon", "superweapon ion cannon — massive emitter dish on a heavy fortified platform with glowing core"),
    ("resonance_device", "Shardborn resonance device — living crystal spire growing from a fortified housing, violet glow"),
    ("generic_structure", "generic industrial outbuilding — boxy utility structure with vents and lights"),
    ("derrick", "capturable oil/Shard derrick — lattice pump-jack tower over a small base pad housing"),
    ("relay", "capture relay beacon — antenna mast with bright tip light on a small bunker"),
    ("wreck", "burned-out vehicle wreck — rusted hull debris, holes, scorch marks, no crew"),
]

UNITS = [
    ("infantry", "tiny sci-fi desert infantry soldier in armor with rifle, helmet, backpack — readable at small size"),
    ("rocket_trooper", "anti-vehicle infantry with oversized shoulder rocket tube, helmet, armored vest"),
    ("vehicle", "light tracked scout tank — small turret, short barrel, compact hull"),
    ("harvester", "heavy tracked Shard harvester — ore hopper body, front intake scoop, wide treads"),
    ("scout_vehicle", "fast four-wheel recon buggy — open frame, roll cage, pintle MG, chunky tires"),
    ("assault_tank", "mid-size tracked main battle tank — wedge glacis, wide treads, circular turret, long cannon"),
    ("longbow", "tracked long-range artillery — very long barrel, splayed stabilizer feet, ammo rack"),
    ("skimmer_apc", "hover APC — glowing hover skirt, blocky troop cabin, sensor mast"),
    ("gunship", "twin-rotor gunship — narrow fuselage, stub wings with missile pods, rotor discs"),
    ("mcv", "mobile construction vehicle — huge tracked industrial truck with folded crane"),
    ("riftmaw", "obsidian crystal worm creep — segmented body rearing up, glowing violet crystal spines, open jaws"),
    ("warden", "Concord hero commander in heavy exo armor — oversized shoulders, cyan visor, two-handed cannon"),
    ("ghostwalker", "stealth scout in ragged ash cloak — curved blade, ember accents, hooded silhouette"),
    ("vane", "Emberhand hero — cloak with crimson sash, dual forward pistols, commanding pose"),
    ("howitzer", "tracked siege howitzer — short fat barrel, heavy chassis, stabilizer legs"),
    ("engineer", "support engineer infantry — tool pack, wrench, rifle, utility pouches"),
    ("transport_apc", "wheeled armored personnel carrier — boxy troop cabin, side viewports, rear ramp"),
    ("defense_drone", "compact flying defense drone — disc body, twin rotors, short forward gun"),
    ("repair_truck", "wheeled repair truck — crane arm, medical/repair cross marking, tool bed"),
    ("medium_tank", "medium tracked tank — balanced turret and barrel, chamfered hull"),
    ("super_heavy_tank", "super-heavy behemoth tank — oversized hull, thick treads, long cannon, side sponsons"),
    ("commando", "stealth demo infantry — satchel charge pack, compact rifle, dark kit"),
    ("laser_trooper", "anti-air infantry with glowing laser rifle emitter, antenna pack"),
    ("razor", "Concord hero razor — twin shoulder laser emitters, exo armor, glowing cyan visor"),
    ("tempest", "Shardborn hero tank — crystalline wedge prow, missile pods, violet/teal glow"),
]

FACTION_SKIN_UNITS = ["infantry", "rocket_trooper", "harvester"]
FACTION_SKIN_BLDGS = ["barracks", "refinery", "defense_turret"]


def paint_for(key: str) -> str:
    return {
        "concord": CONCORD,
        "ember": EMBER,
        "neutral": NEUTRAL,
        "shardborn": SHARDBORN,
    }[key]


def main() -> None:
    entries: list[dict] = []
    batch = 1

    # Buildings: player+enemy (or neutral-only for props)
    for bid, subject in BUILDINGS:
        if bid in ("derrick", "relay", "wreck"):
            entries.append({
                "file": f"{bid}__neutral__idle.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": bldg(subject, paint_for("neutral")),
            })
            continue
        if bid == "construction_yard":
            entries.append({
                "file": f"{bid}__neutral__idle.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": bldg(subject, paint_for("neutral")),
            })
            entries.append({
                "file": f"{bid}__player__idle.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": bldg(subject, paint_for("concord")),
            })
            entries.append({
                "file": f"{bid}__enemy__idle.png",
                "batch": batch,
                "aspect": "1:1",
                "basedOn": f"{bid}__player__idle.png",
                "prompt": RECOLOR_EMBER,
            })
            continue
        if bid == "resonance_device":
            entries.append({
                "file": f"{bid}__player__idle.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": bldg(subject, paint_for("shardborn")),
            })
            entries.append({
                "file": f"{bid}__enemy__idle.png",
                "batch": batch,
                "aspect": "1:1",
                "basedOn": f"{bid}__player__idle.png",
                "prompt": RECOLOR_EMBER,
            })
            continue

        entries.append({
            "file": f"{bid}__player__idle.png",
            "batch": batch,
            "aspect": "1:1",
            "prompt": bldg(subject, paint_for("concord")),
        })
        entries.append({
            "file": f"{bid}__enemy__idle.png",
            "batch": batch,
            "aspect": "1:1",
            "basedOn": f"{bid}__player__idle.png",
            "prompt": RECOLOR_EMBER,
        })
        if bid in FACTION_SKIN_BLDGS:
            entries.append({
                "file": f"{bid}__emberhand__idle.png",
                "batch": batch,
                "aspect": "1:1",
                "basedOn": f"{bid}__player__idle.png",
                "prompt": RECOLOR_EMBER,
            })
            entries.append({
                "file": f"{bid}__shardborn__idle.png",
                "batch": batch,
                "aspect": "1:1",
                "basedOn": f"{bid}__player__idle.png",
                "prompt": RECOLOR_SHARD,
            })

    batch = 2
    for uid, subject in UNITS:
        if uid == "riftmaw":
            entries.append({
                "file": f"{uid}__neutral__move.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": unit(subject, paint_for("neutral")),
            })
            continue
        if uid == "ghostwalker":
            entries.append({
                "file": f"{uid}__emberhand__move.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": unit(subject, paint_for("ember")),
            })
            continue
        if uid == "vane":
            entries.append({
                "file": f"{uid}__emberhand__move.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": unit(subject, paint_for("ember")),
            })
            continue
        if uid == "tempest":
            entries.append({
                "file": f"{uid}__shardborn__move.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": unit(subject, paint_for("shardborn")),
            })
            entries.append({
                "file": f"{uid}__player__move.png",
                "batch": batch,
                "aspect": "1:1",
                "basedOn": f"{uid}__shardborn__move.png",
                "prompt": (
                    "Keep exactly the same vehicle as in the attached image — same pose and camera — "
                    "but shift accents slightly toward Concord steel-blue trim while keeping the "
                    "crystalline teal body. Solid pure magenta #FF00FF background unchanged."
                ),
            })
            continue
        if uid == "warden" or uid == "razor" or uid == "mcv":
            entries.append({
                "file": f"{uid}__player__move.png",
                "batch": batch,
                "aspect": "1:1",
                "prompt": unit(subject, paint_for("concord")),
            })
            if uid == "razor":
                entries.append({
                    "file": f"{uid}__shardborn__move.png",
                    "batch": batch,
                    "aspect": "1:1",
                    "basedOn": f"{uid}__player__move.png",
                    "prompt": RECOLOR_SHARD,
                })
            continue

        entries.append({
            "file": f"{uid}__player__move.png",
            "batch": batch,
            "aspect": "1:1",
            "prompt": unit(subject, paint_for("concord")),
        })
        entries.append({
            "file": f"{uid}__enemy__move.png",
            "batch": batch,
            "aspect": "1:1",
            "basedOn": f"{uid}__player__move.png",
            "prompt": RECOLOR_EMBER,
        })
        if uid in FACTION_SKIN_UNITS:
            entries.append({
                "file": f"{uid}__emberhand__move.png",
                "batch": batch,
                "aspect": "1:1",
                "basedOn": f"{uid}__player__move.png",
                "prompt": RECOLOR_EMBER,
            })
            entries.append({
                "file": f"{uid}__shardborn__move.png",
                "batch": batch,
                "aspect": "1:1",
                "basedOn": f"{uid}__player__move.png",
                "prompt": RECOLOR_SHARD,
            })

    OUT.write_text(json.dumps(entries, indent=2) + "\n")
    print(f"wrote {len(entries)} prompts → {OUT}")


if __name__ == "__main__":
    main()
