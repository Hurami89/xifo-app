"""Ventures squad mates from Kaza's four heroes (Aeodin, Dario, Kayame, Lazulai; his own art, with his permission),
adapted to each mate (2026-11-25):
  * the job's outfit and weapon: his sheet for that job (every hero is drawn in all 18 jobs)
  * male mates use Aeodin or Dario, female mates Kayame or Lazulai (picked by the face); Elvaan women are Kayame
    (she has the long ears), Mithra are Lazulai
  * hair and skin: cut out into masks the app tints with the mate's own hair colour (by face) and race's skin
  * race: the app scales Tarutaru down and Galka up; Elvaan men get long ears, Mithra cat ears and a tail (masks too)

(2026-11-25, v2: the user "can we increase the quality of our venture squad mates") his art at its own 64 x 64 a frame
(v1 shrank it to 40, which blurred the outlines, eyes and trim), hair and skin masks exact to his pixels, and 22 frames
instead of 10: a breathing idle, a full walk, swing, thrust and shot attacks, casting, hurt, dodge, rest and victory.

Usage:  python art/kaza_mates.py [Aeodin Dario Kayame Lazulai]      (sources: art/oldgame-src/sv_actors, unpacked from old-hame-assets.zip)
Writes  assets/ventures/km/<Hero>_<JOB>.png       the sheet: 22 frames of 64 x 64 (11 a row, 2 rows), facing right, 3x
        assets/ventures/km/<Hero>_<JOB>_m.png     the masks: the same grid once for each of MASKS, white, 2x (Android
                                                  draws nothing bigger than 4096 pixels, and flat-tinted masks keep fine at 2x)
        src/ventures/mate_art.ts
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
SRC = os.path.join(HERE, 'oldgame-src', 'sv_actors')
OUT = os.path.join(APP, 'assets', 'ventures', 'km')
UP = 3          # the sheet
UPM = 2         # the masks
MV = 64
F = 64
COLS, FROWS = 11, 2
MOTION = {'walk': 0, 'wait': 1, 'chant': 2, 'guard': 3, 'damage': 4, 'evade': 5, 'thrust': 6, 'swing': 7, 'missile': 8,
          'skill': 9, 'spell': 10, 'item': 11, 'escape': 12, 'victory': 13, 'dying': 14, 'abnormal': 15, 'sleep': 16,
          'dead': 17}
# the app's 22 frames (src/ventures/mate_art.ts MATE_POSE says which is which)
ORDER = [('wait', 0), ('wait', 1), ('wait', 2), ('walk', 0), ('walk', 1), ('walk', 2), ('swing', 0), ('swing', 1),
         ('swing', 2), ('thrust', 0), ('thrust', 1), ('thrust', 2), ('missile', 0), ('missile', 1), ('missile', 2),
         ('spell', 0), ('spell', 2), ('damage', 0), ('evade', 0), ('dying', 1), ('victory', 0), ('victory', 1)]
POSES = {'idle': [0, 1, 2], 'walk': [3, 4, 5], 'swing': [6, 7, 8], 'thrust': [9, 10, 11], 'shoot': [12, 13, 14],
         'cast': [15, 16], 'hurt': [17], 'evade': [18], 'sit': [19], 'win': [20, 21]}
NFR = len(ORDER)
JOBS = ['WAR', 'MNK', 'WHM', 'BLM', 'RDM', 'THF', 'PLD', 'DRK', 'BST', 'BRD', 'RNG', 'SAM', 'NIN', 'DRG', 'SMN', 'BLU',
        'COR', 'PUP']
HEROES = ['Aeodin', 'Dario', 'Kayame', 'Lazulai']

# his palettes: hair (light to dark: 0 shine, 1 light, 2 mid, 3 dark) and skin (0 light, 1 mid, 2 shade, 3 line)
HAIR = {
    'Aeodin': {(241, 234, 215): 0, (212, 191, 139): 1, (134, 93, 65): 2, (84, 46, 32): 3},
    'Dario': {(178, 183, 177): 0, (142, 149, 141): 1, (97, 103, 96): 2, (59, 64, 59): 3},
    'Kayame': {(239, 242, 250): 0, (203, 212, 238): 0, (147, 163, 212): 1, (66, 102, 152): 2, (64, 100, 150): 2,
               (31, 47, 95): 3},
    'Lazulai': {(252, 252, 252): 0, (247, 247, 247): 0, (213, 213, 213): 1, (126, 126, 126): 2},
}
SKIN = {(246, 211, 188): 0, (251, 220, 200): 0, (235, 193, 167): 1, (249, 193, 157): 1, (247, 198, 191): 1,
        (216, 160, 126): 2, (234, 151, 119): 2, (178, 104, 61): 3, (179, 103, 57): 3, (154, 79, 35): 3, (150, 75, 31): 3}
HEAD_PART = {'Aeodin': 0.42, 'Dario': 0.42, 'Kayame': 0.55, 'Lazulai': 0.62}   # where hair may start (outfits share colours)
# mask rows
MASKS = ['hair0', 'hair1', 'hair2', 'hair3', 'skin0', 'skin1', 'skin2', 'skin3', 'elf_ink', 'elf_ear', 'cat_ink', 'cat_ears',
         'tail_ink', 'tail']


def mv_frame(sheet, motion, k):
    m = MOTION[motion]
    col, row = m // 6, m % 6
    return sheet.crop(((col * 3 + k) * MV, row * MV, (col * 3 + k + 1) * MV, (row + 1) * MV))


def labels(fr, hero):
    """per pixel: None, ('hair', band) or ('skin', band)"""
    w, h = fr.size
    px = fr.load()
    bb = fr.getbbox() or (0, 0, w, h)
    cut = bb[1] + (bb[3] - bb[1]) * HEAD_PART[hero]
    out = {}
    pal = HAIR[hero]
    seeds = []
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 128:
                continue
            c = p[:3]
            if c in SKIN:
                out[x, y] = ('skin', SKIN[c])
            elif y <= cut and c in pal:
                seeds.append((x, y))
    # hair: from the head down through touching hair colours (long hair hanging at the back), not below 80%
    floor = bb[1] + (bb[3] - bb[1]) * 0.8
    seen = set(seeds)
    stack = list(seeds)
    while stack:
        x, y = stack.pop()
        out[x, y] = ('hair', pal[px[x, y][:3]])
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) in seen or not (0 <= nx < w and 0 <= ny < h) or ny > floor:
                continue
            q = px[nx, ny]
            if q[3] >= 128 and q[:3] in pal:
                seen.add((nx, ny))
                stack.append((nx, ny))
    return out


def frame_and_masks(src, hero):
    """one 64-px frame, mirrored to face right, and its masks (dict name -> L image), pixel for pixel."""
    small = ImageOps.mirror(src.convert('RGBA'))
    arr = np.asarray(small)
    small = Image.fromarray(np.dstack([arr[..., :3], np.where(arr[..., 3] >= 128, 255, 0).astype(np.uint8)]), 'RGBA')
    lab = labels(small, hero)
    final = {n: Image.new('L', (F, F), 0) for n in MASKS}
    fp = {n: final[n].load() for n in final}
    for (x, y), (k, b) in lab.items():
        fp[f'{k}{b}'][x, y] = 255
    # race extras from where the head and body are in this frame (v1's shapes, at 64 px: x 1.6)
    S = F / 40
    hair = [(x, y) for (x, y), (k, _) in lab.items() if k == 'hair']
    skin = [(x, y) for (x, y), (k, _) in lab.items() if k == 'skin']
    bb = small.getbbox()
    if hair and bb:
        hx0 = min(x for x, _ in hair)
        hx1 = max(x for x, _ in hair)
        hy0 = min(y for _, y in hair)
        d = ImageDraw.Draw(final['cat_ears'])
        for cx in (hx0 + (hx1 - hx0) * 0.22, hx0 + (hx1 - hx0) * 0.62):
            cx = int(cx)
            d.polygon([(cx - 2 * S, hy0 + 2 * S), (cx, hy0 - 3 * S), (cx + 2 * S, hy0 + 2 * S)], fill=255)
        top_skin = min((y for _, y in skin), default=None)
        if top_skin is not None:
            band = [(x, y) for x, y in skin if top_skin <= y <= top_skin + 7 * S]
            fx0 = min(x for x, _ in band)
            fx1 = max(x for x, _ in band)
            ex = fx0 + (fx1 - fx0) // 3
            ey = top_skin + 4 * S
            d = ImageDraw.Draw(final['elf_ear'])
            d.polygon([(ex + 1 * S, ey + 2 * S), (ex - 1 * S, ey - 1 * S), (ex - 5 * S, ey - 5 * S), (ex - 1 * S, ey + 3 * S)], fill=255)
        tx = bb[0] + 2 * S
        ty = bb[1] + int((bb[3] - bb[1]) * 0.66)
        d = ImageDraw.Draw(final['tail'])
        d.line([(tx, ty), (tx - 3 * S, ty - 1 * S), (tx - 5 * S, ty - 4 * S), (tx - 5 * S, ty - 7 * S)], fill=255, width=3)
    # a dark rim round the added parts
    for part, ink in (('elf_ear', 'elf_ink'), ('cat_ears', 'cat_ink'), ('tail', 'tail_ink')):
        m = np.asarray(final[part]) > 0
        grown = m.copy()
        grown[1:] |= m[:-1]
        grown[:-1] |= m[1:]
        grown[:, 1:] |= m[:, :-1]
        grown[:, :-1] |= m[:, 1:]
        final[ink] = Image.fromarray(np.where(grown & ~m, 255, 0).astype(np.uint8))
    return small, final


def outline_mask(m):
    """a dark rim round the extra parts (ears, tail) drawn into the mask's own pixels as a 2nd shade is not possible
    with a flat tint, so the extras get a 1-px outline in the base instead (see build)."""
    return m


def build_one(hero, job):
    """the sheet (COLS x FROWS frames) and the masks (the same grid once per mask, stacked), both at 1x"""
    src = Image.open(os.path.join(SRC, hero + job.capitalize() + '.png')).convert('RGBA')
    base = Image.new('RGBA', (F * COLS, F * FROWS), (0, 0, 0, 0))
    mask = Image.new('L', (F * COLS, F * FROWS * len(MASKS)), 0)
    for i, (motion, k) in enumerate(ORDER):
        fr, ms = frame_and_masks(mv_frame(src, motion, k), hero)
        cx, cy = (i % COLS) * F, (i // COLS) * F
        base.alpha_composite(fr, (cx, cy))
        for r, name in enumerate(MASKS):
            mask.paste(ms[name], (cx, cy + r * F * FROWS))
    white = Image.new('RGBA', mask.size, (255, 255, 255, 0))
    white.putalpha(mask)
    return base, white


def ramp4(c):
    r, g, b = c
    hl = (min(255, int(r * 1.3 + 30)), min(255, int(g * 1.3 + 26)), min(255, int(b * 1.25 + 18)))
    mid = (int(r * 0.72), int(g * 0.70), min(255, int(b * 0.78 + 12)))
    dk = (int(r * 0.45), int(g * 0.42), min(255, int(b * 0.5 + 16)))
    return [hl, tuple(c), mid, dk]


# hair colour by face (1A..8B = 0..15), per race
_C = dict(black=(52, 46, 50), dbrown=(96, 60, 38), brown=(140, 92, 54), lbrown=(178, 120, 64), blonde=(222, 190, 112),
          pblond=(236, 220, 160), red=(186, 70, 40), auburn=(150, 66, 46), orange=(220, 132, 56), silver=(206, 210, 220),
          white=(236, 232, 220), purple=(128, 86, 150), blue=(80, 104, 176), pink=(226, 150, 170), green=(98, 130, 96))
FACE_HAIR = {
    'hume': 'dbrown blonde black lbrown brown red blonde dbrown black auburn lbrown blonde red black brown pblond',
    'elvaan': 'silver dbrown blonde black white brown auburn silver black red pblond lbrown dbrown white brown blonde',
    'taru': 'brown orange lbrown blonde red dbrown orange purple blonde brown black red pink lbrown blue orange',
    'mithra': 'brown red white black lbrown orange dbrown blonde black silver auburn brown red pblond dbrown white',
    'galka': 'black dbrown brown black dbrown red brown black dbrown brown black auburn dbrown black brown dbrown',
}
SKIN_OF = {'hume': (238, 192, 160), 'elvaan': (236, 198, 170), 'taru': (246, 204, 166), 'mithra': (208, 150, 104),
           'galka': (176, 124, 92)}
RACES = {1: ('hume', 'm'), 2: ('hume', 'f'), 3: ('elvaan', 'm'), 4: ('elvaan', 'f'), 5: ('taru', 'm'), 6: ('taru', 'f'),
         7: ('mithra', 'f'), 8: ('galka', 'm')}
SCALE = {'hume': 1.0, 'elvaan': 1.07, 'taru': 0.78, 'mithra': 0.97, 'galka': 1.15}
# each race's build: the head and the body (below the neck) sized apart, (head x, head y, body x, body y):
# Tarutaru a big head on a short round body, Elvaan a long slender body, Galka a broad, tall, heavy body
FIT = {'hume': (1, 1, 1, 1), 'mithra': (0.97, 0.97, 0.97, 0.97), 'taru': (0.95, 0.95, 0.8, 0.52),
       'elvaan': (1, 1, 0.94, 1.25), 'galka': (1.1, 1.1, 1.45, 1.3)}


def necks(name):
    """the row under the chin in each frame (64-px units), from the saved mask sheet"""
    m = Image.open(os.path.join(OUT, name + '_m.png')).convert('RGBA')
    m = np.asarray(m.resize((m.width // UPM, m.height // UPM), Image.NEAREST))[..., 3] > 0
    out = []
    for f in range(NFR):
        cx, cy = (f % COLS) * F, (f // COLS) * F

        def cell(r):
            return m[cy + r * F * FROWS: cy + r * F * FROWS + F, cx: cx + F]
        hair = np.zeros((F, F), bool)
        skin = np.zeros((F, F), bool)
        for r in range(4):
            hair |= cell(r)
            skin |= cell(4 + r)
        hy = np.nonzero(hair.any(axis=1))[0]
        if not len(hy):
            out.append(26)
            continue
        top = hy.min()
        sy = [y for y in np.nonzero(skin.any(axis=1))[0] if y <= top + 26]
        out.append(int(min(F - 6, (max(sy) + 1) if sy else hy.max() + 1)))
    return out


def hexc(c):
    return '#%02x%02x%02x' % tuple(c)


def main(only=None):
    """only: hero names to (re)build this run (the build is slow: one hero a run fits a short shell); default all."""
    os.makedirs(OUT, exist_ok=True)
    total = 0
    keys = [f'{h}_{j}' for h in HEROES for j in JOBS]
    for hero in (only or HEROES):
        for job in JOBS:
            b, m = build_one(hero, job)
            name = f'{hero}_{job}'
            for im, suffix, up in ((b, '', UP), (m, '_m', UPM)):
                p = os.path.join(OUT, name + suffix + '.png')
                im.resize((im.width * up, im.height * up), Image.NEAREST).save(p, optimize=True)
                total += os.path.getsize(p)
        print(hero, 'done')
    req = lambda n: f"require('../../assets/ventures/km/{n}.png')"
    L = ["// Made by art/kaza_mates.py: squad mates from Kaza's heroes (his art, with permission), 64 x 64 a frame, sheet 3x, masks 2x.",
         '// Frames sit in a grid of MATE_COLS x MATE_FROWS. Draw MATE_SHEET, then each MATE_MASK grid tinted (grids top to',
         '// bottom: ' + ', '.join(MASKS) + ').',
         'export const MATE_F = %d;' % F,
         'export const MATE_COLS = %d;' % COLS,
         'export const MATE_FROWS = %d;' % FROWS,
         'export const MASK_ROWS = %d;' % len(MASKS),
         '/** which frames make each pose */',
         'export const MATE_POSE: Record<string, number[]> = { %s };' % ', '.join(f"{k}: [{', '.join(map(str, v))}]" for k, v in POSES.items()),
         'export const MASK_ROW: Record<string, number> = { %s };' % ', '.join(f'{n}: {i}' for i, n in enumerate(MASKS)),
         'export const MATE_SHEET: Record<string, any> = {']
    L += [f'  {k}: {req(k)},' for k in keys] + ['};', 'export const MATE_MASK: Record<string, any> = {']
    L += [f'  {k}: {req(k + "_m")},' for k in keys] + ['};']
    L.append('/** the row under the chin per frame (head above, body below), for sizing the races apart */')
    L.append('export const NECK: Record<string, number[]> = {')
    L += [f'  {k}: [{", ".join(str(v) for v in necks(k))}],' for k in keys] + ['};']
    L.append('/** race -> [head x, head y, body x, body y] */')
    L.append('export const RACE_FIT: Record<string, number[]> = { %s };' %
             ', '.join(f"{r}: [{', '.join(str(v) for v in f)}]" for r, f in FIT.items()))
    L.append('/** race id -> [race, sex, scale] */')
    L.append('export const RACE_LOOK: Record<number, [string, string, number]> = { %s };' %
             ', '.join(f"{i}: ['{r}', '{s}', {SCALE[r]}]" for i, (r, s) in RACES.items()))
    L.append('/** hair colours by race and face (0..15): 4 tones each, shine to dark */')
    L.append('export const HAIR_TONES: Record<string, string[][]> = {')
    for race, names in FACE_HAIR.items():
        L.append(f'  {race}: [' + ', '.join('[' + ', '.join(f"'{hexc(t)}'" for t in ramp4(_C[n])) + ']'
                                             for n in names.split()) + '],')
    L.append('};')
    L.append('export const SKIN_TONES: Record<string, string[]> = { %s };' % ', '.join(
        f"{r}: [{', '.join(repr(hexc(t)) for t in ramp4(c))}]" for r, c in SKIN_OF.items()))
    with open(os.path.join(APP, 'src', 'ventures', 'mate_art.ts'), 'w') as f:
        f.write('\n'.join(L).replace('"', "'") + '\n')
    print(f'{len(keys)} mates listed; built this run: {total // 1024} KB')


def hero_for(race_id, face):
    race, sex = RACES[race_id]
    if race == 'elvaan' and sex == 'f':
        return 'Kayame'
    if race == 'mithra':
        return 'Lazulai'
    pair = ('Aeodin', 'Dario') if sex == 'm' else ('Kayame', 'Lazulai')
    return pair[(face // 2) % 2]


if __name__ == '__main__':
    import sys
    main(sys.argv[1:] or None)
