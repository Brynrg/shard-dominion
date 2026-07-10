#!/usr/bin/env python3
"""Emit docs/GEMINI_ZIP_PROMPTS.md — ONE pasteable master prompt per batch.

Same 81 assets and same GLOBAL numbering as docs/GROK_ART_PROMPTS.md, but
consolidated so the operator pastes a whole batch at once into the Gemini app.
Gemini generates the images in order; the operator saves each by its number;
scripts/rename-art-drop.py maps numbers -> pipeline filenames.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
entries = json.load(open(os.path.join(ROOT, 'scripts', 'art-prompts.json')))
entries.sort(key=lambda e: e['batch'])

BATCH_TITLES = {
    1: 'Purple-base re-gens (the 6 originals)',
    2: 'Missing units',
    3: 'Missing buildings',
    4: 'Animation strips',
    5: 'Faction skins (Emberhand + Shardborn)',
    6: 'Presentation art (plain illustrations — NO magenta)',
    7: 'New terrain tiles (OPTIONAL)',
}

# Assign the global number (1..81) in the same order the Grok doc uses.
num_by_file = {}
for i, e in enumerate(entries, 1):
    num_by_file[e['file']] = i

def line_for(e):
    n = num_by_file[e['file']]
    p = e['prompt']
    if 'basedOn' in e:
        base_n = num_by_file[e['basedOn']]
        # Rewrite the "attached image" phrasing for a same-paste batch.
        p = re.sub(r'(?:as in |as )?the attached image',
                   f'as IMAGE {base_n} directly above', p)
        head = f'=== IMAGE {n} — save as {n}.png (this is a recolor of IMAGE {base_n}) ==='
    else:
        head = f'=== IMAGE {n} — save as {n}.png ==='
    return f'{head}\n{p}'

# Per-batch wrapper instructions (the homogeneous rule for that batch type).
def wrapper(batch, count, first_n, last_n):
    common = (
        f'Generate the following {count} game-art images (numbers {first_n} through {last_n}). '
        'Produce EACH numbered item as its OWN separate image — do NOT combine them into a '
        'grid, sheet, or collage, and do not caption them. Keep every technical rule written '
        'in each description. Work through them in order; after you show each image I download '
        'it and save it as its number.'
    )
    return common

out = []
out.append('# Gemini Master-Prompt Package — Shard Dominion (paste-per-batch, 2026-07-10)\n')
out.append("""> Built for the **Gemini app** (gemini.google.com) — no API, no cost beyond your
> Gemini plan. Same 81 assets as the Grok/Gemini API paths, but consolidated so you
> paste **one block per batch** instead of one prompt per image.

## Reality check (so you don't hunt for a button that isn't there)
The Gemini chat does **not** export a zip. It shows generated images inline and you
download them individually. That's fine — the numbering below removes all the pain:

## Workflow
1. Make one folder under `~/Code/`, e.g. `~/Code/art-drop-gemini/`. (Under `~/Code/` —
   **never** Downloads/Desktop; macOS TCC blocks the terminal from reading those.)
2. Copy **one batch block** below (everything inside the ``` fence) and paste it into a
   fresh Gemini chat. Gemini generates the images **in order**.
   - If it stops after a few, type **“continue”** — it does the next ones.
   - If it makes a grid instead of separate images, say **“generate each as a separate
     image, one at a time.”**
3. Download each image **in the order shown** and save it as just its number: `1.png`,
   `2.png`, … They can land in Downloads — you'll move the folder after. Re-rolling a
   bad one? Overwrite that number.
4. When a batch is done, move/copy the numbered files into your `~/Code/art-drop-gemini/`
   folder and tell Claude the path. Claude runs `rename-art-drop.py` (numbers → real
   filenames, JPG→PNG) then imports + verifies.

**Re-roll, don't settle** if you see: a shadow on the ground, a coloured base platform
under a building, a non-magenta background on a sprite, more than one object in a frame,
grids, or text.

**Note on enemy/recolor variants:** in this paste-a-batch mode each image is generated
independently, so a "recolor of IMAGE N" is approximate, not pixel-identical. That's fine
for buildings/terrain. If you want a truly identical chassis recolor, generate the base
image first, then in the SAME chat say "now recolor that exact image to …".
""")

# Group entries by batch, preserving global numbering.
by_batch = {}
for e in entries:
    by_batch.setdefault(e['batch'], []).append(e)

for batch in sorted(by_batch):
    es = by_batch[batch]
    nums = [num_by_file[e['file']] for e in es]
    first_n, last_n = min(nums), max(nums)
    out.append(f'\n---\n\n## BATCH {batch} — {BATCH_TITLES[batch]}  (images {first_n}–{last_n})\n')
    out.append('Paste everything inside this block into one Gemini chat:\n')
    block = [wrapper(batch, len(es), first_n, last_n), '']
    for e in es:
        block.append(line_for(e))
        block.append('')
    out.append('```\n' + '\n'.join(block).rstrip() + '\n```\n')

dest = os.path.join(ROOT, 'docs', 'GEMINI_ZIP_PROMPTS.md')
open(dest, 'w', encoding='utf-8').write('\n'.join(out))
print('wrote', dest, f'({len(entries)} images across {len(by_batch)} batches)')
