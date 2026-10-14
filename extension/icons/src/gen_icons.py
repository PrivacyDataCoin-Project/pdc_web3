#!/usr/bin/env python3
"""Generate PDC logo-based icons for the extension.

Draws a simplified PDC mark: dark rounded square (#05060d) with a cyan (#3bc7ff)
interlocking double-hex ring motif, exported at 16/32/48/128 px.
"""
from PIL import Image, ImageDraw

BG = (5, 6, 13, 255)        # #05060d
CYAN = (59, 199, 255, 255)  # #3bc7ff
BLUE = (30, 48, 243, 255)   # #1e30f3

def make_icon(size: int) -> Image.Image:
    s = size * 8  # supersample
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded dark square background
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 5, fill=BG)

    # Two overlapping hexagon outlines (cyan + blue), rotated relative halves
    import math
    def hexagon(cx, cy, r, rotation, color, width):
        pts = []
        for i in range(6):
            a = rotation + i * math.pi / 3
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        d.line(pts + [pts[0]], fill=color, width=width, joint='curve')

    cx, cy = s / 2, s / 2
    r = s * 0.30
    w = max(s // 16, 3)
    hexagon(cx - s * 0.06, cy, r, math.pi / 6, BLUE, w)
    hexagon(cx + s * 0.06, cy, r, -math.pi / 6, CYAN, w)

    # Center dot
    cr = s * 0.075
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=CYAN)

    return img.resize((size, size), Image.LANCZOS)

import pathlib
out = pathlib.Path(__file__).parent
for size in (16, 32, 48, 128):
    make_icon(size).save(out / f'icon{size}.png')
    print(f'icon{size}.png done')
