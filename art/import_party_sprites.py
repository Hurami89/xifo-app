"""Imports Kaza's "Records of Vana'diel" battle sprites (his own art, used with his permission) as the Ventures party
companions: art/venture-pack/party/k1..k6.png, 10 frames of 32 x 32 in the app's frame order, facing right.

Usage:  python art/import_party_sprites.py "<folder with StreamingAssets/.../Chara/Battle/BC_FF1_P001...>"
The sprites face left in his set (toward the enemies); the app's party stands on the left, so they are mirrored.
"""
import os
import sys

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'venture-pack', 'party')
# the app's 10 frames: idle0 idle1 walk0 walk1 atk0 atk1 cast hurt sit win
ORDER = ['Default_00', 'Ready_00', 'Default_00', 'Ready_00', 'RightAttack_00', 'RightAttack_01', 'SkillReady_00',
         'Damage_00', 'Dying_00', 'Win_00']
PICK = ['P001', 'P002', 'P003', 'P004', 'P005', 'P006']


def main(root):
    battle = None
    for dirpath, dirnames, _ in os.walk(root):
        if any(d.startswith('BC_FF1_P0') for d in dirnames):
            battle = dirpath
            break
    if not battle:
        raise SystemExit('no BC_FF1_P0xx folders under ' + root)
    os.makedirs(OUT, exist_ok=True)
    for i, p in enumerate(PICK, 1):
        sheet = Image.new('RGBA', (32 * len(ORDER), 32), (0, 0, 0, 0))
        for k, name in enumerate(ORDER):
            path = os.path.join(battle, 'BC_FF1_' + p, name + '.png')
            if not os.path.exists(path):
                path = os.path.join(battle, 'BC_FF1_' + p, 'Default_00.png')
            fr = ImageOps.mirror(Image.open(path).convert('RGBA'))
            sheet.paste(fr, (k * 32, 32 - fr.height))
        sheet.save(os.path.join(OUT, f'k{i}.png'), optimize=True)
    print(f'{len(PICK)} party sprites -> {OUT}')


if __name__ == '__main__':
    main(sys.argv[1])
