#!/usr/bin/env python3
"""Hue-shift Concord blue/cyan → Emberhand red or Shardborn teal; keep magenta key."""
from __future__ import annotations
import colorsys
import sys
from pathlib import Path
from PIL import Image

def main() -> None:
    if len(sys.argv) != 4:
        print('usage: python3 scripts/recolor-faction.py <src.png> <dst.png> emberhand|shardborn')
        sys.exit(1)
    src, dst, faction = sys.argv[1], sys.argv[2], sys.argv[3]
    targets = {
        'emberhand': {'blue': 0.03, 'cyan': 0.02},
        'shardborn': {'blue': 0.45, 'cyan': 0.48},
    }
    if faction not in targets:
        print('faction must be emberhand|shardborn'); sys.exit(1)
    t = targets[faction]
    im = Image.open(src).convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 230 and g < 40 and b > 230:
                continue
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            hh, s, v = colorsys.rgb_to_hsv(rf, gf, bf)
            if s < 0.12:
                continue
            if 0.45 <= hh <= 0.72:
                hh = t['cyan'] if hh < 0.55 else t['blue']
                rr, gg, bb = colorsys.hsv_to_rgb(hh, min(1.0, s * 1.05), v)
                px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    im.save(dst)
    print(f'recolored {src} → {dst} ({faction})')

if __name__ == '__main__':
    main()
