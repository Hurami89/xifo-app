"""The Ventures pixel art for the app: camp backdrops, squad mates (every race in every job) and monsters.

Usage:  python art/make_pixel_ventures.py
Writes  assets/ventures/bg/<scene>.png + fg/<scene>.png (240 x 126 grid, 4x), assets/ventures/c/r<race>_<JOB>.png
(10 frames of 24 x 32, 4x), assets/ventures/m/<look>.png (4 frames of 32 x 32, 4x) and src/ventures/art.ts.

All of it is drawn by these scripts (ventures_scenes.py, ventures_chars.py, ventures_mobs.py) and given the 16-bit
pass (ventures_shade.py). A sprite pack can replace any sheet: put a PNG with the same name and frame layout (at 1x)
in art/venture-pack/c/ or art/venture-pack/m/ (only art you have the artist's permission for) and run this again.
"""
import os

from PIL import Image

import ventures_chars as C
import ventures_mobs as M
import ventures_scenes as S
from ventures_shade import snes
from make_pixel_lakes import save_png

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
OUT = os.path.join(APP, 'assets', 'ventures')
PACK = os.path.join(HERE, 'venture-pack')
UP = 4


def up(im):
    return im.resize((im.width * UP, im.height * UP), Image.NEAREST)


def pack(kind, name):
    path = os.path.join(PACK, kind, name + '.png')
    return Image.open(path).convert('RGBA') if os.path.exists(path) else None


def main():
    for sub in ('bg', 'fg', 'c', 'm'):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    lines = ['// Made by art/make_pixel_ventures.py. Grid sizes: scenes 240 x 126, mates 24 x 32 a frame (10 frames),',
             '// monsters 32 x 32 a frame (4 frames). Every file is drawn at 4x.',
             'export const SCENE_W = 240, SCENE_H = 126, GROUND = %d;' % S.GY,
             'export const MATE_W = %d, MATE_H = %d, MATE_FRAMES = %d;' % (C.FW, C.FH, len(C.FRAMES)),
             'export const MOB_W = %d, MOB_H = %d, MOB_FRAMES = 4;' % (M.MW, M.MH),
             "export const FRAME = { idle0: 0, idle1: 1, walk0: 2, walk1: 3, atk0: 4, atk1: 5, cast: 6, hurt: 7, sit: 8, win: 9 } as const;",
             'export const SCENES: Record<string, { bg: any; fg: any }> = {']
    total = 0
    for sc in S.SCENES:
        p = S.paint(sc)
        bp, fp = os.path.join(OUT, 'bg', sc + '.png'), os.path.join(OUT, 'fg', sc + '.png')
        painted = pack('bg', sc)      # Kaza's painting of the zone, pixelled by oldgame_pixel.py
        if painted is not None:
            save_png(up(painted.convert('RGB')), bp, colors=64)
            up(Image.new('RGBA', (240, 126), (0, 0, 0, 0))).save(fp, optimize=True)
        else:
            save_png(up(p.img), bp, colors=64)
            up(p.fg).save(fp, optimize=True)
        total += os.path.getsize(bp) + os.path.getsize(fp)
        lines.append(f"  {sc}: {{ bg: require('../../assets/ventures/bg/{sc}.png'), fg: require('../../assets/ventures/fg/{sc}.png') }},")
    lines.append('};')
    lines.append('export const MATES: Record<string, any> = {')
    for race in range(1, 9):
        for job in C.JOBS:
            name = f'r{race}_{job}'
            sheet = pack('c', name)
            if sheet is None:
                sheet = Image.new('RGBA', (C.FW * len(C.FRAMES), C.FH), (0, 0, 0, 0))
                for i in range(len(C.FRAMES)):
                    sheet.paste(snes(C.draw_frame(race, job, i, (race * 3 + C.JOBS.index(job)) % 8)), (i * C.FW, 0))
            path = os.path.join(OUT, 'c', name + '.png')
            up(sheet).save(path, optimize=True)
            total += os.path.getsize(path)
            lines.append(f"  {name}: require('../../assets/ventures/c/{name}.png'),")
    lines.append('};')
    lines.append('export const MOBS: Record<string, any> = {')
    for look in M.PAINT:
        sheet = pack('m', look)
        if sheet is None:
            sheet = Image.new('RGBA', (M.MW * 4, M.MH), (0, 0, 0, 0))
            for i in range(4):
                sheet.paste(snes(M.frame(look, i)), (i * M.MW, 0))
        path = os.path.join(OUT, 'm', look + '.png')
        up(sheet).save(path, optimize=True)
        total += os.path.getsize(path)
        lines.append(f"  {look}: require('../../assets/ventures/m/{look}.png'),")
    lines.append('};')
    # Kaza's monsters (his own renders, pixelled by oldgame_pixel.py), one per camp monster by name, 40 x 40 a frame
    mt = os.path.join(PACK, 'mt')
    names = sorted(f[:-4] for f in os.listdir(mt) if f.endswith('.png')) if os.path.isdir(mt) else []
    os.makedirs(os.path.join(OUT, 'mt'), exist_ok=True)
    lines.append("// Kaza's monsters by camp-monster name (spaces etc. as _), 40 x 40 a frame, the same 4 frames.")
    lines.append('export const MOBT_W = 40, MOBT_H = 40;')
    lines.append('export const MOBT: Record<string, any> = {')
    for name in names:
        path = os.path.join(OUT, 'mt', name + '.png')
        up(Image.open(os.path.join(mt, name + '.png')).convert('RGBA')).save(path, optimize=True)
        total += os.path.getsize(path)
        lines.append(f"  {name}: require('../../assets/ventures/mt/{name}.png'),")
    lines.append('};')
    # the party companions: Kaza's "Records of Vana'diel" sprites (his own art, with his permission), 32 x 32 a frame
    party = sorted(f[:-4] for f in os.listdir(os.path.join(PACK, 'party')) if f.endswith('.png')) \
        if os.path.isdir(os.path.join(PACK, 'party')) else []
    os.makedirs(os.path.join(OUT, 'p'), exist_ok=True)
    lines.append("// The party's other adventurers: Kaza's Records of Vana'diel sprites, 32 x 32 a frame, the same 10 frames.")
    lines.append('export const PARTY_W = 32, PARTY_H = 32;')
    lines.append('export const PARTY: any[] = [')
    for name in party:
        path = os.path.join(OUT, 'p', name + '.png')
        up(Image.open(os.path.join(PACK, 'party', name + '.png')).convert('RGBA')).save(path, optimize=True)
        total += os.path.getsize(path)
        lines.append(f"  require('../../assets/ventures/p/{name}.png'),")
    lines.append('];')
    os.makedirs(os.path.join(APP, 'src', 'ventures'), exist_ok=True)
    with open(os.path.join(APP, 'src', 'ventures', 'art.ts'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'{len(S.SCENES)} scenes, {8 * len(C.JOBS)} mate sheets, {len(M.PAINT)} monsters, {total // 1024} KB')


if __name__ == '__main__':
    main()
