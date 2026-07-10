#!/usr/bin/env python3
"""Extract docs/GEMINI_ART_PROMPTS.md into scripts/art-prompts.json.

Each entry: { file, prompt, aspect, batch, basedOn? }
- basedOn = another entry's file; the generator attaches that generated PNG as
  image input (palette repaints / terrain variants stay chassis-identical).
Run after editing the prompt doc to regenerate the manifest.
"""
import json, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, 'docs', 'GEMINI_ART_PROMPTS.md')
OUT = os.path.join(ROOT, 'scripts', 'art-prompts.json')

REPAINT_PROMPT = (
    "Keep exactly the same vehicle/structure/figure as in the attached image — same pose, "
    "same top-down camera, same painted late-90s RTS style, and the same solid pure magenta "
    "#FF00FF background — but repaint the faction colours only: the dusty steel blue-grey "
    "armour becomes scorched red-iron (main #d1503a, shadow tone #8f3020, pale highlight "
    "#ffb08f), and every glowing cyan accent light becomes ember crimson (#ff4a3d). "
    "Change nothing else about the design."
)
VARIANT_PROMPTS = {
    'terrain__scorched_2.png': (
        "Another tile of the exact same scorched-ground texture as the attached image — same "
        "palette, same scale, same flat even lighting, perfectly seamless and tileable (left "
        "edge continues the right edge, top continues the bottom) — but a different random "
        "arrangement of cracks, ash drifts, and embers. Square PNG, texture fills the frame "
        "edge to edge."
    ),
    'terrain__crystal_lattice_2.png': (
        "Another tile of the exact same crystal-creep texture as the attached image — same "
        "palette, same scale, same flat even lighting, perfectly seamless and tileable (left "
        "edge continues the right edge, top continues the bottom) — but a different random "
        "arrangement of violet veins and crystal nubs. Square PNG, texture fills the frame "
        "edge to edge."
    ),
}

def aspect_for(fname: str) -> str:
    base = os.path.basename(fname)
    if '__walk' in base or '__drive' in base:
        return '21:9'   # 4-frame strip (closest supported to 4:1)
    if '__fire' in base:
        return '16:9'   # 2-frame strip
    if base.startswith(('title_', 'act', 'credits_')):
        return '16:9'
    return '1:1'

text = open(DOC, encoding='utf-8').read()
lines = text.splitlines()

entries = []
batch = 0
pending = []          # files awaiting the next blockquote: [(file, basedOn)]
i = 0
while i < len(lines):
    line = lines[i]
    m = re.match(r'# BATCH (\d)', line)
    if m:
        batch = int(m.group(1))
        pending = []
    files = re.findall(r'`([^`]+\.png)`', line)
    if 'Save as:' in line and files:
        pending = [(files[0], None)]
        if 'ENEMY REPAINT' in line and len(files) > 1:
            pending.append((files[1], files[0]))
        elif 'variant' in line and len(files) > 1:
            pending.append((files[1], files[0]))
    elif line.startswith('> ') and pending:
        quote = []
        while i < len(lines) and lines[i].startswith('>'):
            quote.append(lines[i][1:].strip())
            i += 1
        prompt = ' '.join(q for q in quote if q)
        for fname, based in pending:
            if based and os.path.basename(fname) in VARIANT_PROMPTS:
                p = VARIANT_PROMPTS[os.path.basename(fname)]
            elif based:
                p = REPAINT_PROMPT
            else:
                p = prompt
            entries.append({'file': fname, 'batch': batch, 'aspect': aspect_for(fname),
                            **({'basedOn': based} if based else {}), 'prompt': p})
        pending = []
        continue
    i += 1

# validation
names = [e['file'] for e in entries]
assert len(names) == len(set(names)), 'duplicate filenames'
for e in entries:
    if 'basedOn' in e:
        assert e['basedOn'] in names, f"basedOn missing: {e['basedOn']}"
counts = {}
for e in entries:
    counts[e['batch']] = counts.get(e['batch'], 0) + 1
print('per batch:', dict(sorted(counts.items())), 'total:', len(entries))
expected = {1: 6, 2: 15, 3: 25, 4: 9, 5: 12, 6: 10, 7: 4}
assert counts == expected, f'batch counts off — expected {expected}'

json.dump(entries, open(OUT, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print('wrote', OUT)
