#!/usr/bin/env python3
"""Emit docs/GEMINI_ZIP_PROMPTS.md — ONE pasteable master prompt per batch, using
the REAL pipeline filenames as the label for each image.

The operator pastes a batch block into the Gemini app; Gemini generates each image
and names the file exactly as given (e.g. construction_yard__neutral__idle.png);
the operator downloads the set as a zip and hands it to Claude, who unzips it and
runs scripts/import-art.mjs directly — no renaming, because the names are already
the pipeline names.
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

def label(e):
    """The download filename Gemini should use — the pipeline basename."""
    return os.path.basename(e['file'])

def block_for(e, by_file):
    p = e['prompt']
    if 'basedOn' in e:
        base = label(by_file[e['basedOn']])
        p = re.sub(r'(?:as in |as )?the attached image',
                   f'as {base} directly above', p)
        head = f'FILE: {label(e)}   (a recolor of {base})'
    else:
        head = f'FILE: {label(e)}'
    return f'{head}\n{p}'

def wrapper(count, kind):
    return (
        f'Generate the following {count} game-art images. Produce EACH as its OWN '
        'separate image — do NOT combine them into a grid, sheet, or collage, and do '
        'not add captions. For each one, NAME THE IMAGE FILE EXACTLY as the "FILE:" '
        'name given (keep the .png). Keep every technical rule written in each '
        'description. When all are done, package them so I can download the whole set '
        'as a single zip.'
    )

by_file = {e['file']: e for e in entries}
by_batch = {}
for e in entries:
    by_batch.setdefault(e['batch'], []).append(e)

out = []
out.append('# Gemini Master-Prompt Package — Shard Dominion (filename-labelled, zip-ready)\n')
out.append("""> For the **Gemini app** (gemini.google.com) — no API. Each batch is ONE pasteable
> block. Gemini generates every image, names each file exactly as its `FILE:` line,
> and you download the set as a zip. Because the names are already the real pipeline
> names, Claude imports the zip directly — no renaming step.

## Workflow
1. Copy **one batch block** below (everything inside the ``` fence) into a fresh
   Gemini chat.
2. Let Gemini generate them all (if it stops early, say **“continue”**; if it makes a
   grid, say **“generate each as its own separate image”**).
3. Download the set as a **zip**. Move the zip into `~/Code/` (e.g.
   `~/Code/gemini-art.zip`) — **not** Downloads/Desktop, macOS TCC blocks the terminal
   from reading those. Tell Claude the path; Claude unzips + runs `import-art.mjs` and
   verifies in-engine.
4. **Re-roll, don't settle** on any image with: a shadow on the ground, a coloured base
   platform under a building, a non-magenta background on a sprite, more than one object,
   a grid, or text.

**If Gemini ignores the filenames** (some versions name downloads generically): just
keep the images **in the order shown**, save them `1.png, 2.png, …`, and Claude's
`rename-art-drop.py` maps order→names instead. Either way works.

**Recolor/enemy variants:** each image is generated independently here, so "a recolor
of X.png" is approximate, not pixel-identical — fine for buildings/terrain. For a truly
identical chassis, generate the base first, then in the SAME chat say "recolor that exact
image to …".
""")

for batch in sorted(by_batch):
    es = by_batch[batch]
    out.append(f'\n---\n\n## BATCH {batch} — {BATCH_TITLES[batch]}  ({len(es)} images)\n')
    out.append('Paste everything inside this block into one Gemini chat:\n')
    body = [wrapper(len(es), batch), '']
    for e in es:
        body.append(block_for(e, by_file))
        body.append('')
    out.append('```\n' + '\n'.join(body).rstrip() + '\n```\n')

dest = os.path.join(ROOT, 'docs', 'GEMINI_ZIP_PROMPTS.md')
open(dest, 'w', encoding='utf-8').write('\n'.join(out))
print('wrote', dest, f'({len(entries)} images across {len(by_batch)} batches)')
