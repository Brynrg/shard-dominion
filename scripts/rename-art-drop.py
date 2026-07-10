#!/usr/bin/env python3
"""Rename a numbered Grok art drop (1.png, 2.jpg, ...) to pipeline filenames.

Usage: python3 scripts/rename-art-drop.py <numbered-folder> [--out art-drop]

Numbers map to scripts/art-prompts.json order (same numbering as
docs/GROK_ART_PROMPTS.md). JPG/JPEG/WEBP are converted to PNG via macOS sips.
Partial drops are fine — missing numbers are just reported.
"""
import json, os, sys, shutil, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) < 2:
    print(__doc__); sys.exit(1)
src = os.path.expanduser(sys.argv[1])
out = os.path.join(ROOT, 'art-drop')
if '--out' in sys.argv:
    out = os.path.expanduser(sys.argv[sys.argv.index('--out') + 1])

entries = json.load(open(os.path.join(ROOT, 'scripts', 'art-prompts.json')))
entries.sort(key=lambda e: e['batch'])

found, missing = 0, []
for i, e in enumerate(entries, 1):
    srcfile = None
    for ext in ('png', 'jpg', 'jpeg', 'webp'):
        for name in (f'{i}.{ext}', f'{i:02d}.{ext}', f'{i:03d}.{ext}'):
            p = os.path.join(src, name)
            if os.path.isfile(p):
                srcfile = p
                break
        if srcfile: break
    if not srcfile:
        missing.append((i, e['file']))
        continue
    dest = os.path.join(out, e['file'])
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if srcfile.lower().endswith('.png'):
        shutil.copyfile(srcfile, dest)
    else:
        r = subprocess.run(['sips', '-s', 'format', 'png', srcfile, '--out', dest],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(f'  CONVERT FAILED #{i}: {r.stderr.strip()[:120]}'); continue
    found += 1
    print(f'  #{i} -> {e["file"]}')

print(f'\n{found} renamed into {out}; {len(missing)} not present yet.')
if missing and len(missing) < 82:
    print('still missing:', ', '.join(f'#{i}' for i, _ in missing[:20]),
          '…' if len(missing) > 20 else '')
