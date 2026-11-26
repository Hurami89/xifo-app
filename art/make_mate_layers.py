"""The Ventures squad mates in layers, so each mate looks like the one in the game (2026-11-25).

Usage:  python art/make_mate_layers.py
Writes  assets/ventures/ml/*.png (all at 4x) and src/ventures/mate_art.ts:
  b_r<race>_<JOB>.png   body: tail, legs, torso, back arm                10 frames of 24 x 32
  h_r<race>_<kind>.png  head: one row per face (1A..8B = 0..15), kind = how much a hat hides (open, helm, hood);
                        Galka have one row (their look doesn't change with the face here)
  t_r<race>_<JOB>.png   top: hat, front arm, shield, wyvern, puppet, casting sparkle
  w_r<race>.png         weapon in the hand: one row per weapon kind (WEAPONS)
The app draws them in that order: body, head, top, weapon. Drawing: ventures_chars.py; the 16-bit pass: ventures_shade.py.
"""
import os

from PIL import Image

import ventures_chars as C
from ventures_shade import snes

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
OUT = os.path.join(APP, 'assets', 'ventures', 'ml')
UP = 4
N = len(C.FRAMES)


def row(race, job, layer, **kw):
    s = Image.new('RGBA', (C.FW * N, C.FH), (0, 0, 0, 0))
    for i in range(N):
        s.paste(snes(C.draw_frame(race, job, i, layer=layer, **kw)), (i * C.FW, 0))
    return s


def stack(rows):
    s = Image.new('RGBA', (C.FW * N, C.FH * len(rows)), (0, 0, 0, 0))
    for i, r in enumerate(rows):
        s.paste(r, (0, i * C.FH))
    return s


def save(im, name):
    path = os.path.join(OUT, name + '.png')
    im.resize((im.width * UP, im.height * UP), Image.NEAREST).save(path, optimize=True)
    return os.path.getsize(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    body, top, head, weap = [], [], [], []
    for race in range(1, 9):
        rname = C.RACE[race][0]
        for job in C.JOBS:
            total += save(row(race, job, 'body'), f'b_r{race}_{job}')
            total += save(row(race, job, 'top'), f't_r{race}_{job}')
            body.append(f'r{race}_{job}')
            top.append(f'r{race}_{job}')
        for kind, hat in C.HAT_KINDS.items():
            if rname == 'galka':
                rows = [row(race, 'WAR', 'head', hat=hat or 'band')]
            else:
                rows = [row(race, 'WAR', 'head', hat=hat or 'band', hair_i=f // 2, hair=C.FACE_HAIR[rname][f])
                        for f in range(16)]
            total += save(stack(rows), f'h_r{race}_{kind}')
            head.append(f'r{race}_{kind}')
        rows = [row(race, 'WAR', 'weap', weapon=w) for w in C.WEAPONS]
        total += save(stack(rows), f'w_r{race}')
        weap.append(f'r{race}')

    req = lambda n: f"require('../../assets/ventures/ml/{n}.png')"
    L = ['// Made by art/make_mate_layers.py: the squad mates in layers (body, head, top, weapon), 24 x 32 a frame, 4x.',
         '// Draw order: MATE_BODY, MATE_HEAD (row = face 0..15; Galka: row 0), MATE_TOP, MATE_WEAP (row = WEAPON_ROW).',
         'export const MATE_BODY: Record<string, any> = {']
    L += [f"  {k}: {req('b_' + k)}," for k in body] + ['};', 'export const MATE_TOP: Record<string, any> = {']
    L += [f"  {k}: {req('t_' + k)}," for k in top] + ['};', 'export const MATE_HEAD: Record<string, any> = {']
    L += [f"  {k}: {req('h_' + k)}," for k in head] + ['};', 'export const MATE_WEAP: Record<string, any> = {']
    L += [f"  {k}: {req('w_' + k)}," for k in weap] + ['};']
    L.append('export const WEAPON_ROW: Record<string, number> = { %s };' %
             ', '.join(f'{w}: {i}' for i, w in enumerate(C.WEAPONS)))
    L.append('export const WEAPON_ROWS = %d;' % len(C.WEAPONS))
    L.append('/** item_weapon.skill -> the weapon drawn (fists: nothing in the hand). */')
    L.append('export const SKILL_WEAPON: Record<number, string> = { %s };' %
             ', '.join(f"{k}: '{v}'" for k, v in C.SKILL_WEAPON.items()))
    L.append('export const JOB_WEAPON: Record<string, string> = { %s };' %
             ', '.join(f"{j}: '{C.job_weapon(j)}'" for j in C.JOBS))
    L.append('export const HAT_KIND: Record<string, string> = { %s };' %
             ', '.join(f"{j}: '{C.hat_kind(j)}'" for j in C.JOBS))
    with open(os.path.join(APP, 'src', 'ventures', 'mate_art.ts'), 'w') as f:
        f.write('\n'.join(L) + '\n')
    print(f'{len(body)} bodies, {len(head)} head sheets, {len(top)} tops, {len(weap)} weapon sheets, {total // 1024} KB')


if __name__ == '__main__':
    main()
