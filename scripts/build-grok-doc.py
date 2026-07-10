#!/usr/bin/env python3
"""Emit docs/GROK_ART_PROMPTS.md — the Grok-chat edition of the art package.

Reads scripts/art-prompts.json (same source of truth as the Gemini generator) and
numbers every image 1..N in generation order. The operator saves each Grok image as
its number; scripts/rename-art-drop.py maps numbers -> pipeline filenames.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
entries = json.load(open(os.path.join(ROOT, 'scripts', 'art-prompts.json')))
entries.sort(key=lambda e: e['batch'])

BATCH_TITLES = {
    1: 'Purple-base re-gens (the 6 originals — do these first)',
    2: 'Missing units',
    3: 'Missing buildings',
    4: 'Animation strips',
    5: 'Faction skins (Emberhand + Shardborn)',
    6: 'Presentation art (plain illustrations — NO magenta)',
    7: 'New terrain tiles (OPTIONAL — skip if not seamless)',
}

def chatify(e, num_by_file):
    """Rewrites API-flavoured follow-up prompts for the Grok chat flow."""
    p = e['prompt']
    if 'basedOn' in e:
        p = p.replace('as in the attached image', 'as the image you just generated above')
        p = p.replace('as the attached image', 'as the image you just generated above')
        return p
    return p

out = []
out.append('# Grok Art Prompt Package — Shard Dominion (numbered edition, 2026-07-10)\n')
out.append("""> Same 81 assets as `docs/GEMINI_ART_PROMPTS.md`, re-cut for the **Grok chat UI**
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
""")

n = 0
num_by_file = {}
cur_batch = 0
for e in entries:
    n += 1
    num_by_file[e['file']] = n
    if e['batch'] != cur_batch:
        cur_batch = e['batch']
        out.append(f"\n---\n\n# BATCH {cur_batch} — {BATCH_TITLES[cur_batch]}\n")
    aspect_note = {'21:9': ' *(wide 4-frame strip)*', '16:9': ' *(wide image)*'}.get(e['aspect'], '')
    if 'basedOn' in e:
        base_n = num_by_file[e['basedOn']]
        out.append(f"### #{n} → becomes `{e['file']}`{aspect_note}")
        out.append(f"**SAME chat as #{base_n}** — paste right after its image:\n")
    else:
        out.append(f"### #{n} → becomes `{e['file']}`{aspect_note}")
        out.append("**New chat.**\n")
    prompt = chatify(e, num_by_file)
    out.append('> ' + prompt + '\n')
    out.append(f"**Save as:** `{n}.png` (or `{n}.jpg`)\n")

out.append("""---

## Checklist

- Batch 1 = #1–#6 · Batch 2 = #7–#21 · Batch 3 = #22–#46 · Batch 4 = #47–#55 ·
  Batch 5 = #56–#67 · Batch 6 = #68–#77 · Batch 7 = #78–#81
- One folder, files named by number, tell Claude the path. Everything else is scripted.
""")

dest = os.path.join(ROOT, 'docs', 'GROK_ART_PROMPTS.md')
open(dest, 'w', encoding='utf-8').write('\n'.join(out))
print('wrote', dest, f'({n} numbered images)')
