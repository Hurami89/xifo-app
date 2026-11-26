"""Ventures squad mates from Kaza's four heroes (Aeodin, Dario, Kayame, Lazulai; his own art, with his permission),
adapted to each mate (2026-11-25):
  * the job's outfit and weapon: his sheet for that job (every hero is drawn in all 18 jobs)
  * male mates use Aeodin or Dario, female mates Kayame or Lazulai (picked by the face); Elvaan women are Kayame
    (she has the long ears), Mithra are Lazulai
  * hair and skin: cut out into masks the app tints with the mate's own hair colour (by face) and race's skin
  * race: the app scales Tarutaru down and Galka up; Elvaan men get long ears, Mithra cat ears and a tail (masks too)

Usage:  python art/kaza_mates.py [Aeodin Dario Kayame Lazulai]      (sources: art/oldgame-src/sv_actors, unpacked from old-hame-assets.zip)
Writes  assets/ventures/km/<Hero>_<JOB>.png       the sheet, 10 frames of 40 x 40, facing right (4x)
        assets/ventures/km/<Hero>_<JOB>_m.png     the masks: one 10-frame row each (see MASKS), white (4x)
        src/ventures/mate_art.ts
"""
import os

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
SRC = os.path.join(HERE, 'oldgame-src', 'sv_actors')
OUT = os.path.join(APP, 'assets', 'ventures', 'km')
UP = 4
MV = 64
F = 40
MOTION = {'walk': 0, 'wait': 1, 'chant': 2, 'guard': 3, 'damage': 4, 'evade': 5, 'thrust': 6, 'swing': 7, 'missile': 8,
          'skill': 9, 'spell': 10, 'item': 11, 'escape': 12, 'victory': 13, 'dying': 14, 'abnormal': 15, 'sleep': 16,
          'dead': 17}
# the app's 10 frames: idle0 idle1 walk0 walk1 atk0 atk1 cast hurt sit win
ORDER = [('wait', 0), ('wait', 1), ('walk', 0), ('walk', 2), ('swing', 0), ('swing', 2), ('spell', 1), ('damage', 0),
         ('dying', 1), ('victory', 1)]
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


def shrink_rgba(im, w, h):
    big = im.resize((w * 4, h * 4), Image.LANCZOS)
    r, g, b, a = big.split()
    pm = Image.merge('RGB', [Image.composite(c, Image.new('L', big.size, 0), a) for c in (r, g, b)])
    pm = pm.resize((w, h), Image.BOX)
    a2 = a.resize((w, h), Image.BOX)
    px, pa = pm.load(), a2.load()
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    po = out.load()
    for y in range(h):
        for x in range(w):
            al = pa[x, y]
            if al > 110:
                c = px[x, y]
                k = 255 / al
                po[x, y] = (min(255, int(c[0] * k)), min(255, int(c[1] * k)), min(255, int(c[2] * k)), 255)
    return out


def frame_and_masks(src, hero):
    """one 64-px frame -> the 40-px frame (mirrored to face right) and its masks (dict name -> L image)."""
    src = ImageOps.mirror(src.convert('RGBA'))
    lab = labels(src, hero)
    small = shrink_rgba(src, F, F)
    masks = {}
    for name in MASKS[:8]:
        kind, band = name[:4], int(name[4])
        m = Image.new('L', src.size, 0)
        mp = m.load()
        for (x, y), (k, b) in lab.items():
            if k == kind and b == band:
                mp[x, y] = 255
        masks[name] = m.resize((F, F), Image.BOX)
    # each output pixel goes to the label that covers most of it (if hair/skin cover more than the rest)
    alpha = small.split()[3].load()
    cover = {n: masks[n].load() for n in masks}
    final = {n: Image.new('L', (F, F), 0) for n in MASKS}
    fp = {n: final[n].load() for n in final}
    for y in range(F):
        for x in range(F):
            if not alpha[x, y]:
                continue
            best, bv = None, 0
            for n in cover:
                v = cover[n][x, y]
                if v > bv:
                    best, bv = n, v
            tot = sum(cover[n][x, y] for n in cover)
            if best and tot >= 128:
                fp[best][x, y] = 255
    # race extras from where the head and body are in this frame
    hair = [(x, y) for y in range(F) for x in range(F) if any(fp['hair%d' % b][x, y] for b in range(4))]
    skin = [(x, y) for y in range(F) for x in range(F) if any(fp['skin%d' % b][x, y] for b in range(4))]
    bb = small.getbbox()
    if hair and bb:
        hx0 = min(x for x, _ in hair)
        hx1 = max(x for x, _ in hair)
        hy0 = min(y for _, y in hair)
        hy1 = max(y for _, y in hair)
        d = ImageDraw.Draw(final['cat_ears'])
        for cx in (hx0 + (hx1 - hx0) * 0.22, hx0 + (hx1 - hx0) * 0.62):
            cx = int(cx)
            d.polygon([(cx - 2, hy0 + 2), (cx, hy0 - 3), (cx + 2, hy0 + 2)], fill=255)
        # an Elvaan ear: from the back of the face, swept back and up
        top_skin = min((y for _, y in skin), default=None)
        if top_skin is not None:
            band = [(x, y) for x, y in skin if top_skin <= y <= top_skin + 7]
            fx0 = min(x for x, _ in band)
            fx1 = max(x for x, _ in band)
            ex = fx0 + (fx1 - fx0) // 3          # the ear sits at the back third of the face, swept back and up
            ey = top_skin + 4
            d = ImageDraw.Draw(final['elf_ear'])
            d.polygon([(ex + 1, ey + 2), (ex - 1, ey - 1), (ex - 5, ey - 5), (ex - 1, ey + 3)], fill=255)
        # a tail from the back of the hips
        tx = bb[0] + 2
        ty = bb[1] + int((bb[3] - bb[1]) * 0.66)
        d = ImageDraw.Draw(final['tail'])
        d.line([(tx, ty), (tx - 3, ty - 1), (tx - 5, ty - 4), (tx - 5, ty - 7)], fill=255, width=2)
    # a dark rim round the added parts
    for part, ink in (('elf_ear', 'elf_ink'), ('cat_ears', 'cat_ink'), ('tail', 'tail_ink')):
        mp = final[part].load()
        ip = final[ink].load()
        for y in range(F):
            for x in range(F):
                if mp[x, y]:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < F and 0 <= ny < F and not mp[nx, ny]:
                            ip[nx, ny] = 255
    return small, final


def outline_mask(m):
    """a dark rim round the extra parts (ears, tail) drawn into the mask's own pixels as a 2nd shade is not possible
    with a flat tint, so the extras get a 1-px outline in the base instead (see build)."""
    return m


def build_one(hero, job):
    src = Image.open(os.path.join(SRC, hero + job.capitalize() + '.png')).convert('RGBA')
    base = Image.new('RGBA', (F * 10, F), (0, 0, 0, 0))
    mask = Image.new('L', (F * 10, F * len(MASKS)), 0)
    for i, (motion, k) in enumerate(ORDER):
        fr, ms = frame_and_masks(mv_frame(src, motion, k), hero)
        base.alpha_composite(fr, (i * F, 0))
        for r, name in enumerate(MASKS):
            mask.paste(ms[name], (i * F, r * F))
    rgb = ImageEnhance.Color(base.convert('RGB')).enhance(1.1)
    q = rgb.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    q.putalpha(base.split()[3])
    white = Image.new('RGBA', mask.size, (255, 255, 255, 0))
    white.putalpha(mask)
    return q, white


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
    """the row under the chin in each of the 10 frames (40-px units), from the saved mask sheet"""
    m = Image.open(os.path.join(OUT, name + '_m.png')).convert('RGBA')
    m = m.resize((m.width // UP, m.height // UP), Image.NEAREST).split()[3].load()
    out = []
    for f in range(10):
        hair = [y for r in range(4) for y in range(F) for x in range(F) if m[f * F + x, r * F + y]]
        skin = [y for r in range(4, 8) for y in range(F) for x in range(F) if m[f * F + x, r * F + y]]
        if not hair:
            out.append(16)
            continue
        top = min(hair)
        face = [y for y in skin if y <= top + 16]
        out.append(min(F - 4, (max(face) + 1) if face else max(hair) + 1))
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
            for im, suffix in ((b, ''), (m, '_m')):
                p = os.path.join(OUT, name + suffix + '.png')
                im.resize((im.width * UP, im.height * UP), Image.NEAREST).save(p, optimize=True)
                total += os.path.getsize(p)
        print(hero, 'done')
    req = lambda n: f"require('../../assets/ventures/km/{n}.png')"
    L = ["// Made by art/kaza_mates.py: squad mates from Kaza's heroes (his art, with permission), 40 x 40 a frame, 4x.",
         '// Draw MATE_SHEET, then each MATE_MASK row tinted (rows: ' + ', '.join(MASKS) + ').',
         'export const MATE_F = %d;' % F,
         'export const MASK_ROWS = %d;' % len(MASKS),
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
