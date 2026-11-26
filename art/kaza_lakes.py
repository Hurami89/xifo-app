"""Portable fishing's backdrops with Kaza's paintings of the zones (2026-11-25; his own art, used with his permission).

    python art/kaza_lakes.py           every mapped zone: assets/lakes/z<id>.png gets his painting above the water line
    python art/kaza_lakes.py preview   a few zones side by side, before and after: art/kaza-lakes-preview.png

Above the water (hz in src/fishing/lakes.ts) his painting of the zone takes the place of the drawn sky and far shore,
cut down to the scene's 240 x 126 pixels with a small palette like the other painted backdrops; the water below, the
foreground and everything that moves are the scene's own. The drawn backdrops come from art/make_pixel_lakes.py (run it
again, then this). Source: art/oldgame-src/battlebacks1 (from old-hame-assets.zip; not in git).
"""
import os
import re
import sys

from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
SRC = os.path.join(HERE, 'oldgame-src', 'battlebacks1')
LAKES = os.path.join(APP, 'assets', 'lakes')
UP = 4
GW, GH = 240, 126

# zone id -> (his painting, the part of it to use: top, bottom as fractions of its height)
PAINTING = {
    100: ('RonfaureBB', 0.0, 0.5), 101: ('RonfaureEastBB', 0.0, 0.5), 102: ('bb-plains', 0.0, 0.5),
    103: ('ValkDunesBB', 0.0, 0.5), 104: ('JugnerBB', 0.0, 0.5), 105: ('bb-plains', 0.0, 0.5),
    106: ('GustabergBB', 0.0, 0.5), 107: ('GustabergBB', 0.0, 0.5), 109: ('PASHOWBB', 0.0, 0.5),
    110: ('Rolanberry', 0.0, 0.5), 111: ('BEAUBB', 0.0, 0.5), 114: ('EASTALTEP2BB', 0.0, 0.5),
    115: ('SarutaBG', 0.0, 0.5), 116: ('Saruta2', 0.0, 0.5), 118: ('buburimupenninsula', 0.0, 0.5),
    120: ('sauromuguechampaign', 0.0, 0.5), 121: ('sanctuaryofzitah', 0.0, 0.5), 122: ('bb-romaeve', 0.0, 0.5),
    123: ('JUNGLEBB', 0.0, 0.5), 124: ('JUNGLEBB', 0.0, 0.5), 125: ('WESTALTEPBB', 0.0, 0.5),
    126: ('bb-frosted', 0.0, 0.5), 130: ('bb-Garden', 0.0, 0.5), 140: ('GhelsbaBB1', 0.0, 0.5),
    143: ('PalboroughBB0', 0.0, 0.5), 145: ('GiddeusBB', 0.0, 0.5), 149: ('bb-davoi2', 0.0, 0.5),
    151: ('bbCastleOwater', 0.0, 0.5), 153: ('boyhaydatree-interior', 0.0, 0.5), 154: ('bb-DragonsAery', 0.0, 0.5),
    157: ('bb-Delkfutts', 0.0, 0.5), 158: ('bb-Delkfutts', 0.0, 0.5), 159: ('bb-TempleUgg', 0.0, 0.5),
    160: ('DENBB', 0.0, 0.5), 172: ('ZeruhnBattleBack', 0.0, 0.5), 173: ('CaveBB', 0.0, 0.5),
    174: ('QSANDBB', 0.0, 0.5), 176: ('SSGBB', 0.0, 0.5), 178: ('bb-Ruavitu', 0.0, 0.5), 184: ('bb-Delkfutts', 0.0, 0.5),
    191: ('DANGRUFBB', 0.0, 0.5), 193: ('BGordelles', 0.0, 0.5), 196: ('gusgen', 0.0, 0.5), 208: ('QSANDBB', 0.0, 0.5),
    213: ('BBLoO', 0.0, 0.5), 2: ('bbcarpentercaves', 0.0, 0.5), 3: ('bb-manaclipperpirates', 0.0, 0.5),
    4: ('reef', 0.0, 0.5), 25: ('bbBlurrycliff', 0.0, 0.5), 27: ('bb-sewers', 0.0, 0.5), 54: ('reef', 0.0, 0.5),
    79: ('bb-Bugs', 0.0, 0.5), 51: ('bb-Wild', 0.0, 0.5), 52: ('mysticgrove2', 0.0, 0.5), 65: ('JUNGLEBB', 0.0, 0.5),
    68: ('undergroundruins', 0.0, 0.5), 61: ('LavaPlatform', 0.0, 0.5), 231: ('sandoria', 0.0, 0.5),
    232: ('sandoria', 0.0, 0.5), 247: ('RABAOBB', 0.0, 0.5),
}


def load_png(path):
    """Some of his PNGs carry metadata older Pillow can't read: keep only the picture's chunks."""
    import io
    import struct
    try:
        im = Image.open(path)
        im.load()
        return im
    except Exception:
        b = open(path, 'rb').read()
        out, i = [b[:8]], 8
        while i < len(b):
            n, = struct.unpack('>I', b[i:i + 4])
            if b[i + 4:i + 8] in (b'IHDR', b'PLTE', b'tRNS', b'IDAT', b'IEND'):
                out.append(b[i:i + 12 + n])
            i += 12 + n
        im = Image.open(io.BytesIO(b''.join(out)))
        im.load()
        return im


def horizons():
    """hz per zone from src/fishing/lakes.ts."""
    text = open(os.path.join(APP, 'src', 'fishing', 'lakes.ts'), encoding='utf-8').read()
    return {int(m.group(1)): float(m.group(2)) for m in re.finditer(r'\n\s*(\d+): \{ img: .*?hz: ([\d.]+)', text)}


def painted(zone, hz_frac, lake):
    """The zone's backdrop: his painting above the water line, and the water rebuilt so it mirrors the new shore."""
    import random
    name, top, bottom = PAINTING[zone]
    src = load_png(os.path.join(SRC, name + '.png')).convert('RGB')
    hz = round(GH * hz_frac)
    w, h = src.size
    part = src.crop((0, int(h * top), w, int(h * bottom))).resize((GW, hz), Image.LANCZOS)
    part = ImageEnhance.Color(part).enhance(1.1)
    part = part.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    base = lake.convert('RGB').resize((GW, GH), Image.NEAREST)
    out = base.copy()
    out.paste(part, (0, 0))
    bp, op, pp = base.load(), out.load(), part.load()
    rng = random.Random(zone)
    deep = GH - hz
    for y in range(hz, GH):
        row = sorted(bp[x, y] for x in range(GW))
        water = row[len(row) // 2]                          # the water's own colour at this depth (no old reflections)
        d = (y - hz) / max(1, deep)
        mirror = hz - 1 - int((y - hz) * 1.4)               # the shore mirrored, stretched a little
        strength = max(0.0, 0.5 * (1 - d * 1.8))
        shift = int(round(1.5 * __import__('math').sin(y * 1.7)))   # small waves break the mirror up
        for x in range(GW):
            c = water
            if mirror >= 0 and strength > 0:
                m = pp[min(GW - 1, max(0, x + shift)), mirror]
                m = (int(m[0] * 0.8), int(m[1] * 0.85), int(min(255, m[2] * 0.95 + 12)))
                c = tuple(int(c[i] * (1 - strength) + m[i] * strength) for i in range(3))
            op[x, y] = c
        for _ in range(int(1 + d * 4)):                     # the shimmer dashes
            x0, n = rng.randrange(0, GW - 8), rng.randrange(2, 7)
            light = rng.random() < 0.55
            for x in range(x0, x0 + n):
                c = op[x, y]
                op[x, y] = tuple(min(255, int(v * 1.35 + 30)) for v in c) if light else tuple(int(v * 0.7) for v in c)
    for k, a in ((hz - 1, 0.5),):                           # the shore line meets the water
        for x in range(GW):
            p, q = op[x, k], op[x, hz]
            op[x, k] = tuple(int(p[i] * a + q[i] * (1 - a)) for i in range(3))
    return out.resize((GW * UP, GH * UP), Image.NEAREST)


def main(preview=False):
    hz = horizons()
    zones = [z for z in PAINTING if z in hz and os.path.exists(os.path.join(SRC, PAINTING[z][0] + '.png'))]
    if preview:
        pick = [z for z in (100, 115, 118, 126, 109, 173) if z in zones]
        sheet = Image.new('RGB', (GW * 2 * 2 + 4, (GH * 2 + 4) * len(pick)), (0, 0, 0))
        for i, z in enumerate(pick):
            lake = Image.open(os.path.join(LAKES, f'z{z}.png'))
            before = lake.convert('RGB').resize((GW * 2, GH * 2), Image.NEAREST)
            after = painted(z, hz[z], lake).resize((GW * 2, GH * 2), Image.NEAREST)
            sheet.paste(before, (0, i * (GH * 2 + 4)))
            sheet.paste(after, (GW * 2 + 4, i * (GH * 2 + 4)))
        sheet.save(os.path.join(HERE, 'kaza-lakes-preview.png'))
        print('preview -> art/kaza-lakes-preview.png')
        return
    done = 0
    for z in zones:
        path = os.path.join(LAKES, f'z{z}.png')
        im = painted(z, hz[z], Image.open(path))
        im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)
        done += 1
    print(f'{done} fishing backdrops now have Kaza\'s paintings ({len(hz) - done} keep the drawn ones)')


if __name__ == '__main__':
    main(preview=sys.argv[1:2] == ['preview'])
