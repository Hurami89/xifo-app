"""Pixel monsters for Ventures: one look per kind of monster the camps have (crab, lizard, goblin, yagudo, tonberry...).

One frame is 32 x 32 grid pixels, facing left (toward the party). Four frames: 0 idle, 1 idle (bob), 2 attack, 3 hurt.
Drawn with flat colours and a dark outline, like the characters (ventures_chars.py).
"""
import math

from PIL import Image, ImageDraw

MW, MH = 32, 32
OUTLINE = (24, 18, 26, 255)
G = 30                          # ground line


def dk(c, k=0.7):
    return tuple(max(0, int(v * k)) for v in c[:3])


def lt(c, k=1.25):
    return tuple(min(255, int(v * k)) for v in c[:3])


def eye(d, x, y, col=(250, 240, 120)):
    d.point((x, y), fill=col)


def legs4(d, x0, x1, y, col, f, h=3):
    for i, x in enumerate((x0, x0 + 3, x1 - 3, x1)):
        off = (1 if (i + f) % 2 else 0) if f in (0, 1) else 0
        d.line([(x, y), (x - off, y + h)], fill=col)


# Each painter: (d, f, k) where f is the frame, k the attack lunge (pixels toward the left)
def rabbit(d, f, k):
    c = (226, 214, 196)
    y = 22 - (1 if f == 1 else 0)
    d.ellipse([12 - k, y, 24 - k, y + 7], fill=c)
    d.ellipse([7 - k, y - 3, 14 - k, y + 3], fill=c)
    d.rectangle([9 - k, y - 9, 10 - k, y - 3], fill=c)
    d.rectangle([11 - k, y - 8, 12 - k, y - 3], fill=lt(c, 1.05))
    d.point((9 - k, y - 6), fill=(230, 160, 160))
    eye(d, 8 - k, y - 1, (40, 30, 40))
    d.point((23 - k, y + 1), fill=(255, 255, 255))
    d.rectangle([13 - k, y + 7, 15 - k, G], fill=dk(c, 0.9))
    d.rectangle([20 - k, y + 7, 22 - k, G], fill=dk(c, 0.9))


def worm(d, f, k):
    c = (176, 130, 110)
    rise = 4 if f == 2 else (1 if f == 1 else 0)
    pts = [(24, G), (22, G - 3), (19, G - 6 - rise), (15, G - 9 - rise), (11 - k, G - 11 - rise)]
    for i, (x, y) in enumerate(pts):
        r = 4 - i * 0.4
        d.ellipse([x - r, y - r, x + r, y + r], fill=c if i % 2 == 0 else dk(c, 0.88))
    x, y = pts[-1]
    d.ellipse([x - 3, y - 3, x + 1, y + 1], fill=(200, 90, 100))
    d.point((x - 2, y - 1), fill=(50, 20, 30))
    d.ellipse([22, G - 2, 30, G + 1], fill=(110, 84, 60))


def beetle(d, f, k):
    c = (70, 110, 80)
    y = 18 - (1 if f == 1 else 0)
    d.ellipse([10 - k, y, 27 - k, y + 10], fill=c)
    d.line([(18 - k, y), (18 - k, y + 9)], fill=dk(c))
    d.arc([12 - k, y + 1, 22 - k, y + 6], 200, 300, fill=lt(c, 1.5))
    d.ellipse([5 - k, y + 3, 11 - k, y + 8], fill=dk(c, 0.6))
    d.line([(6 - k, y + 4), (2 - k, y - 1 - (2 if f == 2 else 0))], fill=dk(c, 0.5), width=2)
    eye(d, 7 - k, y + 5, (230, 80, 60))
    for x in (12, 17, 22):
        d.line([(x - k, y + 9), (x - 2 - k, G)], fill=dk(c, 0.5))


def funguar(d, f, k):
    cap, stem = (200, 70, 60), (230, 220, 190)
    y = 10 + (1 if f == 1 else 0)
    d.rectangle([13 - k, y + 8, 19 - k, G - 2], fill=stem)
    d.ellipse([7 - k, y, 25 - k, y + 11], fill=cap)
    for (x, yy) in ((11, y + 3), (17, y + 2), (21, y + 5), (14, y + 6)):
        d.ellipse([x - 1 - k, yy - 1, x + 1 - k, yy + 1], fill=(250, 240, 220))
    eye(d, 14 - k, y + 13, (30, 20, 30))
    d.rectangle([11 - k, G - 2, 21 - k, G], fill=dk(stem))


def sheep(d, f, k):
    wool, face = (232, 230, 220), (70, 60, 60)
    y = 15 - (1 if f == 1 else 0)
    for (x, yy, r) in ((15, y + 4, 6), (21, y + 3, 6), (25, y + 6, 5), (12, y + 7, 5), (19, y + 8, 6)):
        d.ellipse([x - r - k, yy - r, x + r - k, yy + r], fill=wool)
    d.ellipse([4 - k, y + 1, 11 - k, y + 9], fill=face)
    d.arc([7 - k, y - 1, 14 - k, y + 6], 180, 360, fill=(200, 180, 140), width=2)
    eye(d, 6 - k, y + 4, (240, 220, 80))
    for x in (12, 16, 21, 25):
        d.line([(x - k, y + 13), (x - k, G)], fill=face)


def bee(d, f, k):
    body = (230, 190, 50)
    y = 12 + (2 if f == 1 else 0)
    d.ellipse([13 - k, y + 1, 26 - k, y + 9], fill=body)
    for x in (17, 21):
        d.line([(x - k, y + 1), (x - k, y + 9)], fill=(40, 30, 30), width=2)
    d.ellipse([7 - k, y + 1, 14 - k, y + 8], fill=(60, 44, 40))
    eye(d, 9 - k, y + 4, (220, 50, 40))
    d.polygon([(26 - k, y + 5), (30 - k, y + 6), (26 - k, y + 7)], fill=(40, 30, 30))
    wing = (220, 236, 250)
    up = f % 2 == 0
    d.ellipse([15 - k, y - (6 if up else 3), 22 - k, y + (1 if up else 3)], fill=wing)
    d.line([(10 - k, y + 1), (8 - k, y - 3)], fill=(40, 30, 30))


def sapling(d, f, k):
    bark, leaf = (120, 86, 52), (80, 150, 60)
    sway = 1 if f == 1 else 0
    d.rectangle([13 - k, 14, 19 - k, G - 2], fill=bark)
    d.line([(13 - k, G - 2), (10 - k, G)], fill=bark, width=2)
    d.line([(19 - k, G - 2), (22 - k, G)], fill=bark, width=2)
    d.ellipse([8 - k + sway, 3, 24 - k + sway, 17], fill=leaf)
    d.ellipse([11 - k + sway, 1, 20 - k + sway, 9], fill=lt(leaf))
    eye(d, 14 - k, 19, (250, 230, 120))
    d.line([(13 - k, 17), (7 - k - (3 if f == 2 else 0), 15)], fill=bark, width=2)


def mandragora(d, f, k):
    body, leaf = (230, 190, 120), (70, 160, 60)
    y = 15 - (2 if f == 1 else 0)
    d.ellipse([10 - k, y, 22 - k, y + 11], fill=body)
    for a in (-0.9, -0.3, 0.3, 0.9):
        d.line([(16 - k, y), (16 - k + math.sin(a) * 7, y - 7)], fill=leaf, width=2)
    eye(d, 13 - k, y + 4, (40, 30, 30))
    eye(d, 17 - k, y + 4, (40, 30, 30))
    d.point((15 - k, y + 7), fill=(170, 90, 80))
    d.line([(13 - k, y + 11), (12 - k, G)], fill=body)
    d.line([(19 - k, y + 11), (20 - k, G)], fill=body)
    d.line([(10 - k, y + 5), (6 - k - (2 if f == 2 else 0), y + 3)], fill=body)


def lizard(d, f, k, c=(110, 150, 70)):
    y = 20 - (1 if f == 1 else 0)
    d.polygon([(24 - k, y + 2), (31 - k, y), (30 - k, y + 4)], fill=dk(c, 0.85))
    d.ellipse([11 - k, y, 26 - k, y + 8], fill=c)
    d.ellipse([3 - k, y - 1, 12 - k, y + 6], fill=c)
    d.line([(4 - k, y + 4), (10 - k, y + 4)], fill=dk(c, 0.5))
    if f == 2:
        d.polygon([(3 - k, y + 4), (8 - k, y + 4), (5 - k, y + 7)], fill=(200, 60, 70))
    eye(d, 6 - k, y + 1, (250, 220, 60))
    for i in range(10):
        d.point((13 + i - k, y + 1), fill=lt(c, 1.3) if i % 2 else dk(c))
    legs4(d, 12 - k, 24 - k, y + 7, dk(c, 0.75), f, G - y - 7)


def raptor(d, f, k):
    c = (110, 130, 150)
    y = 11 - (1 if f == 1 else 0)
    d.ellipse([12 - k, y + 6, 25 - k, y + 15], fill=c)
    d.polygon([(24 - k, y + 9), (31 - k, y + 6), (31 - k, y + 9)], fill=c)
    d.line([(14 - k, y + 8), (9 - k, y + 1)], fill=c, width=4)
    d.ellipse([2 - k, y - 2, 12 - k, y + 5], fill=c)
    d.line([(3 - k, y + 3), (9 - k, y + 3)], fill=dk(c, 0.5))
    eye(d, 6 - k, y, (250, 200, 40))
    for x in (15, 21):
        d.line([(x - k, y + 14), (x - 2 - k, G)], fill=dk(c), width=2)
    d.line([(11 - k, y + 10), (8 - k - (3 if f == 2 else 0), y + 12)], fill=dk(c))


def crab(d, f, k, c=(200, 90, 60)):
    y = 18 + (1 if f == 1 else 0)
    d.ellipse([9 - k, y, 27 - k, y + 9], fill=c)
    d.arc([11 - k, y + 1, 25 - k, y + 7], 200, 340, fill=lt(c, 1.35))
    for x in (8, 13):
        d.line([(x + 3 - k, y), (x + 3 - k, y - 3)], fill=dk(c))
        eye(d, x + 3 - k, y - 4, (20, 20, 20))
    reach = 4 if f == 2 else 0
    d.line([(10 - k, y + 4), (5 - k - reach, y + 1)], fill=c, width=2)
    d.polygon([(1 - k - reach, y - 3), (6 - k - reach, y - 1), (5 - k - reach, y + 3), (1 - k - reach, y + 2)], fill=c)
    d.line([(1 - k - reach, y), (4 - k - reach, y)], fill=dk(c, 0.5))
    for x in (12, 16, 20, 24):
        d.line([(x - k, y + 8), (x - 2 - k, G)], fill=dk(c))


def crawler(d, f, k, c=(170, 180, 90)):
    y = 20 - (1 if f == 1 else 0)
    for i, x in enumerate((24, 19, 14)):
        d.ellipse([x - 5 - k, y, x + 5 - k, y + 8], fill=c if i % 2 == 0 else dk(c, 0.9))
        d.line([(x - k, y + 8), (x - k, G)], fill=dk(c))
    d.ellipse([3 - k, y - 1, 12 - k, y + 8], fill=lt(c, 1.1))
    eye(d, 5 - k, y + 2, (40, 30, 30))
    d.line([(4 - k, y - 1), (2 - k, y - 4)], fill=dk(c))


def pugil(d, f, k, c=(90, 140, 170)):
    y = 16 + (1 if f == 1 else 0)
    d.ellipse([7 - k, y, 25 - k, y + 11], fill=c)
    d.polygon([(24 - k, y + 5), (31 - k, y), (31 - k, y + 11)], fill=dk(c, 0.85))
    for x in (12, 16, 20):
        d.line([(x - k, y), (x + 1 - k, y - 4)], fill=(220, 120, 80))
    eye(d, 10 - k, y + 4, (250, 240, 200))
    d.point((10 - k, y + 4), fill=(20, 20, 30))
    d.line([(7 - k, y + 7), (11 - k, y + 8)], fill=dk(c, 0.5))
    d.ellipse([12 - k, y + 9, 18 - k, y + 13], fill=lt(c, 1.2))


def bird(d, f, k, c=(130, 110, 90)):
    y = 12 + (2 if f == 1 else 0)
    d.ellipse([10 - k, y + 3, 24 - k, y + 12], fill=c)
    d.ellipse([5 - k, y, 13 - k, y + 7], fill=lt(c, 1.1))
    d.polygon([(5 - k, y + 3), (1 - k, y + 5), (5 - k, y + 5)], fill=(230, 180, 60))
    eye(d, 8 - k, y + 2, (30, 20, 20))
    up = f % 2 == 0
    d.polygon([(14 - k, y + 5), (26 - k, y - (5 if up else -2)), (22 - k, y + 8)], fill=dk(c, 0.85))
    d.polygon([(22 - k, y + 8), (30 - k, y + 6), (24 - k, y + 11)], fill=dk(c))
    d.line([(15 - k, y + 12), (14 - k, G)], fill=(200, 160, 60))
    d.line([(19 - k, y + 12), (19 - k, G)], fill=(200, 160, 60))


def cockatrice(d, f, k):
    bird(d, f, k, (200, 160, 80))
    d.polygon([(7 - k, 11), (9 - k, 7), (11 - k, 11)], fill=(220, 60, 50))
    d.line([(26 - k, 20), (31 - k, 14)], fill=(70, 120, 70), width=2)


def dhalmel(d, f, k):
    c = (200, 150, 90)
    y = 12 - (1 if f == 1 else 0)
    d.ellipse([12 - k, y + 4, 27 - k, y + 12], fill=c)
    d.line([(13 - k, y + 6), (9 - k, y - 4)], fill=c, width=3)
    d.ellipse([3 - k, y - 7, 11 - k, y - 1], fill=c)
    eye(d, 5 - k, y - 5, (30, 20, 20))
    for x in (8, 10):
        d.line([(x - k, y - 7), (x + 1 - k, y - 10)], fill=(240, 230, 200))
    for x in (14, 18, 22, 25):
        d.line([(x - k, y + 11), (x - k, G)], fill=dk(c), width=2)
    for x in (16, 21):
        d.point((x - k, y + 7), fill=(240, 230, 220))


def goblin(d, f, k, c=(120, 150, 90), robe=(130, 90, 60)):
    y = 9 + (1 if f == 1 else 0)
    d.rectangle([10 - k, y + 10, 21 - k, y + 17], fill=robe)
    d.rectangle([12 - k, y + 17, 14 - k, G], fill=dk(robe, 0.6))
    d.rectangle([17 - k, y + 17, 19 - k, G], fill=dk(robe, 0.6))
    d.ellipse([9 - k, y, 21 - k, y + 11], fill=c)
    d.rectangle([9 - k, y + 2, 21 - k, y + 5], fill=(170, 150, 120))               # the goblin mask
    d.point((11 - k, y + 3), fill=(30, 20, 20))
    d.point((15 - k, y + 3), fill=(30, 20, 20))
    d.polygon([(8 - k, y + 4), (5 - k, y + 2), (9 - k, y + 6)], fill=c)
    d.rectangle([18 - k, y + 12, 25 - k, y + 18], fill=(150, 110, 70))              # the sack
    arm_y = y + 8 if f == 2 else y + 12
    d.line([(10 - k, y + 12), (5 - k, arm_y)], fill=c, width=2)
    d.line([(5 - k, arm_y), (3 - k, arm_y - 7)], fill=(200, 205, 215))


def fly(d, f, k, c=(110, 140, 90)):
    y = 12 + (2 if f == 1 else 0)
    d.ellipse([10 - k, y + 2, 26 - k, y + 8], fill=c)
    d.ellipse([5 - k, y + 1, 12 - k, y + 8], fill=dk(c, 0.8))
    eye(d, 6 - k, y + 3, (220, 40, 40))
    eye(d, 9 - k, y + 3, (220, 40, 40))
    up = f % 2 == 0
    d.ellipse([13 - k, y - (7 if up else 2), 21 - k, y + 2], fill=(210, 230, 240))
    d.ellipse([18 - k, y - (6 if up else 1), 27 - k, y + 3], fill=(200, 220, 236))
    d.line([(26 - k, y + 5), (31 - k, y + 5)], fill=dk(c))


def leech(d, f, k, c=(90, 60, 80)):
    y = 21 - (2 if f == 2 else 0)
    d.ellipse([8 - k, y, 28 - k, y + 9], fill=c)
    for x in range(11, 26, 3):
        d.line([(x - k, y + 1), (x - k, y + 8)], fill=dk(c, 0.8))
    d.ellipse([4 - k, y + 1, 10 - k, y + 7], fill=(190, 80, 90))
    d.point((6 - k, y + 4), fill=(40, 10, 20))


def bat(d, f, k, c=(80, 70, 100)):
    y = 11 + (3 if f == 1 else 0)
    up = f % 2 == 0
    wy = -6 if up else 3
    d.polygon([(14 - k, y + 3), (2 - k, y + wy), (6 - k, y + 6), (10 - k, y + 4)], fill=dk(c, 0.85))
    d.polygon([(18 - k, y + 3), (30 - k, y + wy), (26 - k, y + 6), (22 - k, y + 4)], fill=dk(c, 0.85))
    d.ellipse([12 - k, y, 20 - k, y + 9], fill=c)
    d.polygon([(13 - k, y), (13 - k, y - 3), (15 - k, y)], fill=c)
    d.polygon([(17 - k, y), (19 - k, y - 3), (19 - k, y)], fill=c)
    eye(d, 14 - k, y + 3, (250, 60, 60))
    eye(d, 17 - k, y + 3, (250, 60, 60))


def skeleton(d, f, k):
    c = (230, 226, 210)
    y = 6 + (1 if f == 1 else 0)
    d.ellipse([10 - k, y, 19 - k, y + 8], fill=c)
    eye(d, 12 - k, y + 4, (30, 20, 30))
    eye(d, 15 - k, y + 4, (30, 20, 30))
    d.line([(14 - k, y + 8), (14 - k, y + 18)], fill=c, width=2)
    for yy in range(y + 10, y + 16, 2):
        d.line([(11 - k, yy), (17 - k, yy)], fill=c)
    d.line([(14 - k, y + 18), (11 - k, G)], fill=c, width=2)
    d.line([(14 - k, y + 18), (18 - k, G)], fill=c, width=2)
    ay = y + 6 if f == 2 else y + 12
    d.line([(12 - k, y + 10), (6 - k, ay)], fill=c)
    d.line([(6 - k, ay), (4 - k, ay - 8)], fill=(150, 150, 160), width=2)


def gigas(d, f, k):
    c, cloth = (170, 140, 120), (120, 90, 60)
    y = 1 + (1 if f == 1 else 0)
    d.rectangle([9 - k, y + 9, 25 - k, y + 21], fill=c)
    d.rectangle([9 - k, y + 17, 25 - k, y + 22], fill=cloth)
    d.ellipse([12 - k, y, 22 - k, y + 10], fill=c)
    eye(d, 14 - k, y + 4, (30, 20, 20))
    d.line([(13 - k, y + 7), (16 - k, y + 7)], fill=dk(c, 0.6))
    d.rectangle([11 - k, y + 22, 15 - k, G], fill=dk(c))
    d.rectangle([19 - k, y + 22, 23 - k, G], fill=dk(c))
    ay = y + 4 if f == 2 else y + 13
    d.line([(10 - k, y + 11), (4 - k, ay)], fill=c, width=3)
    d.ellipse([1 - k, ay - 4, 6 - k, ay + 1], fill=(150, 130, 110))


def spider(d, f, k, c=(80, 70, 60)):
    y = 18 - (1 if f == 1 else 0)
    for i, x in enumerate((8, 12, 18, 22)):
        lift = 2 if (i + f) % 2 else 0
        d.line([(x - k, y + 4), (x - 4 - k, y - 2 - lift), (x - 6 - k, G)], fill=dk(c))
        d.line([(x - k, y + 4), (x + 4 - k, y - 1 - lift), (x + 6 - k, G)], fill=dk(c))
    d.ellipse([14 - k, y - 1, 28 - k, y + 9], fill=c)
    d.arc([16 - k, y, 26 - k, y + 6], 200, 330, fill=(200, 160, 60))
    d.ellipse([6 - k, y + 1, 15 - k, y + 8], fill=dk(c, 0.9))
    for x in (8, 10, 12):
        eye(d, x - k, y + 3, (240, 60, 40))


def hound(d, f, k, c=(110, 100, 90)):
    y = 14 - (1 if f == 1 else 0)
    d.ellipse([11 - k, y + 2, 27 - k, y + 11], fill=c)
    d.line([(26 - k, y + 4), (31 - k, y - 1)], fill=c, width=2)
    d.ellipse([3 - k, y - 1, 13 - k, y + 7], fill=c)
    d.polygon([(8 - k, y - 1), (11 - k, y - 5), (12 - k, y)], fill=dk(c))
    eye(d, 6 - k, y + 2, (240, 60, 40))
    d.line([(3 - k, y + 5), (8 - k, y + 5)], fill=dk(c, 0.4))
    if f == 2:
        d.polygon([(2 - k, y + 5), (7 - k, y + 5), (4 - k, y + 8)], fill=(220, 220, 220))
    legs4(d, 12 - k, 25 - k, y + 10, dk(c, 0.8), f, G - y - 10)


def coeurl(d, f, k):
    hound(d, f, k, (220, 190, 100))
    for x in (14, 19, 23):
        d.point((x - k, 18), fill=(60, 50, 40))
    d.line([(9 - k, 13), (6 - k, 5)], fill=(220, 190, 100))
    d.ellipse([4 - k, 3, 8 - k, 7], fill=(250, 220, 120))


def goobbue(d, f, k):
    c = (130, 110, 70)
    y = 5 + (1 if f == 1 else 0)
    d.ellipse([7 - k, y + 2, 27 - k, G - 1], fill=c)
    d.ellipse([10 - k, y, 24 - k, y + 9], fill=(90, 120, 60))                       # mossy top
    eye(d, 11 - k, y + 13, (240, 230, 120))
    d.line([(10 - k, y + 17), (15 - k, y + 17)], fill=dk(c, 0.5))
    ay = y + 6 if f == 2 else y + 16
    d.line([(8 - k, y + 12), (2 - k, ay)], fill=c, width=3)


def opo(d, f, k):
    c = (160, 110, 70)
    y = 11 + (1 if f == 1 else 0)
    d.ellipse([11 - k, y + 7, 22 - k, y + 17], fill=c)
    d.ellipse([8 - k, y, 20 - k, y + 10], fill=c)
    d.ellipse([9 - k, y + 3, 15 - k, y + 9], fill=(230, 200, 160))
    eye(d, 11 - k, y + 5, (30, 20, 20))
    d.arc([18 - k, y + 6, 30 - k, y + 18], 270, 90, fill=c, width=2)
    d.line([(13 - k, y + 17), (12 - k, G)], fill=dk(c), width=2)
    d.line([(19 - k, y + 17), (20 - k, G)], fill=dk(c), width=2)
    d.line([(11 - k, y + 10), (5 - k - (3 if f == 2 else 0), y + 8)], fill=c, width=2)


def yagudo(d, f, k):
    feather, robe = (60, 70, 140), (150, 60, 50)
    y = 4 + (1 if f == 1 else 0)
    d.rectangle([10 - k, y + 10, 20 - k, y + 21], fill=robe)
    d.line([(10 - k, y + 12), (20 - k, y + 12)], fill=(220, 190, 90))
    d.ellipse([10 - k, y, 20 - k, y + 10], fill=feather)
    d.polygon([(10 - k, y + 4), (4 - k, y + 6), (10 - k, y + 7)], fill=(230, 180, 50))
    eye(d, 12 - k, y + 3, (250, 240, 120))
    d.polygon([(17 - k, y), (22 - k, y - 4), (20 - k, y + 2)], fill=(200, 60, 60))
    d.line([(12 - k, y + 21), (11 - k, G)], fill=(220, 180, 60), width=2)
    d.line([(18 - k, y + 21), (19 - k, G)], fill=(220, 180, 60), width=2)
    ay = y + 6 if f == 2 else y + 14
    d.line([(10 - k, y + 12), (5 - k, ay)], fill=feather, width=2)
    d.line([(5 - k, ay + 4), (5 - k, ay - 8)], fill=(140, 100, 60))


def uragnite(d, f, k):
    shell, body = (230, 200, 180), (160, 120, 140)
    y = 14 + (1 if f == 1 else 0)
    d.ellipse([12 - k, y, 28 - k, y + 14], fill=shell)
    d.arc([15 - k, y + 3, 25 - k, y + 11], 0, 359, fill=dk(shell, 0.8))
    d.ellipse([4 - k, y + 7, 15 - k, G - 1], fill=body)
    for x in (4, 7, 10):
        d.line([(x - k, G - 2), (x - 2 - k, G)], fill=body)
    eye(d, 7 - k, y + 9, (30, 20, 30))


def flytrap(d, f, k):
    stem, head = (60, 130, 60), (160, 60, 100)
    y = 8 + (1 if f == 1 else 0)
    d.rectangle([15 - k, y + 10, 18 - k, G - 3], fill=stem)
    d.ellipse([10 - k, G - 5, 24 - k, G], fill=dk(stem))
    open_ = 4 if f == 2 else 2
    d.pieslice([5 - k, y - 2, 25 - k, y + 16], 200, 360, fill=head)
    d.pieslice([5 - k, y + open_, 25 - k, y + 16 + open_], 0, 160, fill=head)
    for x in range(8, 22, 3):
        d.point((x - k, y + 7), fill=(250, 250, 240))
    d.line([(14 - k, y + 16), (6 - k, y + 20)], fill=stem, width=2)


def eye_mob(d, f, k):
    c = (160, 90, 140)
    y = 9 + (2 if f == 1 else 0)
    d.ellipse([7 - k, y, 25 - k, y + 16], fill=c)
    d.ellipse([10 - k, y + 4, 19 - k, y + 12], fill=(250, 250, 240))
    d.ellipse([11 - k, y + 6, 15 - k, y + 10], fill=(200, 40, 40) if f != 2 else (250, 200, 60))
    d.point((12 - k, y + 7), fill=(20, 10, 20))
    for x in (10, 15, 20):
        d.line([(x - k, y + 15), (x - 1 - k, G - (1 if f % 2 else 0))], fill=dk(c))


def antlion(d, f, k):
    c = (170, 140, 90)
    y = 18 - (2 if f == 2 else 0)
    d.ellipse([10 - k, y, 28 - k, y + 10], fill=c)
    d.ellipse([4 - k, y + 1, 13 - k, y + 8], fill=dk(c, 0.85))
    d.line([(5 - k, y + 2), (0 - k, y - 2)], fill=(80, 60, 40), width=2)
    d.line([(5 - k, y + 6), (0 - k, y + 9)], fill=(80, 60, 40), width=2)
    eye(d, 7 - k, y + 3, (30, 20, 20))
    d.rectangle([0, G - 1, 31, G + 1], fill=(200, 170, 110))


def scorpion(d, f, k):
    c = (140, 80, 60)
    y = 21 - (1 if f == 1 else 0)
    d.ellipse([8 - k, y, 24 - k, y + 7], fill=c)
    sting = 4 if f == 2 else 0
    d.line([(23 - k, y + 2), (28 - k, y - 4), (26 - k, y - 10), (20 - k - sting, y - 12)], fill=c, width=2)
    d.point((19 - k - sting, y - 12), fill=(250, 220, 90))
    d.line([(9 - k, y + 3), (4 - k, y)], fill=c, width=2)
    d.polygon([(0 - k, y - 3), (4 - k, y - 2), (4 - k, y + 2), (0 - k, y + 1)], fill=c)
    eye(d, 10 - k, y + 2, (240, 60, 40))
    for x in (11, 15, 19, 22):
        d.line([(x - k, y + 6), (x - 2 - k, G)], fill=dk(c))


def bugard(d, f, k):
    c = (130, 150, 170)
    y = 9 + (1 if f == 1 else 0)
    d.ellipse([9 - k, y + 3, 28 - k, y + 17], fill=c)
    d.ellipse([3 - k, y + 1, 13 - k, y + 11], fill=c)
    d.ellipse([10 - k, y - 2, 16 - k, y + 6], fill=lt(c, 1.15))                     # big ears
    eye(d, 6 - k, y + 4, (30, 20, 20))
    d.line([(3 - k, y + 8), (8 - k, y + 8)], fill=dk(c, 0.5))
    for x in (12, 17, 22, 26):
        d.line([(x - k, y + 16), (x - k, G)], fill=dk(c), width=3)


def sahagin(d, f, k):
    c = (70, 130, 150)
    y = 6 + (1 if f == 1 else 0)
    d.rectangle([11 - k, y + 9, 20 - k, y + 20], fill=c)
    d.line([(11 - k, y + 14), (20 - k, y + 14)], fill=(200, 190, 110))
    d.ellipse([9 - k, y, 20 - k, y + 10], fill=c)
    d.polygon([(14 - k, y), (19 - k, y - 5), (20 - k, y + 2)], fill=(200, 80, 70))     # fin
    eye(d, 11 - k, y + 4, (250, 240, 120))
    d.line([(9 - k, y + 7), (13 - k, y + 7)], fill=dk(c, 0.5))
    d.line([(13 - k, y + 20), (12 - k, G)], fill=dk(c), width=2)
    d.line([(18 - k, y + 20), (19 - k, G)], fill=dk(c), width=2)
    ay = y + 4 if f == 2 else y + 12
    d.line([(11 - k, y + 11), (5 - k, ay)], fill=c, width=2)
    d.line([(4 - k, ay + 6), (4 - k, ay - 7)], fill=(170, 170, 180))
    d.polygon([(2 - k, ay - 7), (4 - k, ay - 10), (6 - k, ay - 7)], fill=(170, 170, 180))


def tonberry(d, f, k):
    c, robe = (90, 140, 110), (130, 110, 80)
    y = 13 + (1 if f == 1 else 0)
    d.polygon([(10 - k, y + 6), (22 - k, y + 6), (24 - k, G), (8 - k, G)], fill=robe)
    d.ellipse([10 - k, y - 2, 22 - k, y + 8], fill=c)
    d.rectangle([10 - k, y - 2, 22 - k, y + 2], fill=robe)                           # hood
    eye(d, 13 - k, y + 4, (250, 240, 140))
    eye(d, 17 - k, y + 4, (250, 240, 140))
    lx, ly = 5 - k, y + 4
    d.line([(10 - k, y + 9), (lx, ly + 3)], fill=c, width=2)
    d.rectangle([lx - 2, ly - 2, lx + 1, ly + 2], fill=(250, 210, 90))               # the lantern
    if f == 2:
        d.line([(22 - k, y + 9), (27 - k, y + 2)], fill=(200, 205, 215), width=2)    # the knife
    else:
        d.line([(22 - k, y + 10), (25 - k, y + 12)], fill=(200, 205, 215))


def weapon_mob(d, f, k):
    y = 4 + (2 if f == 1 else 0)
    tilt = 4 if f == 2 else 0
    d.line([(14 - k + tilt, y), (16 - k - tilt, y + 22)], fill=(200, 206, 220), width=3)
    d.line([(10 - k, y + 18), (21 - k, y + 18)], fill=(200, 160, 60), width=2)
    d.rectangle([14 - k, y + 19, 17 - k, y + 24], fill=(120, 60, 60))
    d.ellipse([11 - k, y + 2, 20 - k, y + 9], fill=(140, 80, 200))


def manta(d, f, k):
    c = (60, 80, 110)
    y = 12 + (3 if f == 1 else 0)
    up = f % 2 == 0
    d.polygon([(4 - k, y + 5), (16 - k, y - (5 if up else 0)), (28 - k, y + 5), (16 - k, y + 10)], fill=c)
    d.line([(16 - k, y + 8), (30 - k, y + 14)], fill=dk(c))
    eye(d, 10 - k, y + 4, (250, 240, 200))
    d.line([(6 - k, y + 5), (26 - k, y + 5)], fill=lt(c, 1.4))


def slime(d, f, k, c=(110, 170, 90)):
    squash = 2 if f == 1 else 0
    d.ellipse([7 - k, 14 + squash, 25 - k, G + 1], fill=c)
    d.ellipse([10 - k, 16 + squash, 15 - k, 20 + squash], fill=lt(c, 1.4))
    eye(d, 12 - k, 22, (30, 30, 30))
    eye(d, 16 - k, 22, (30, 30, 30))
    if f == 2:
        d.ellipse([2 - k, 20, 8 - k, 25], fill=c)


def snoll(d, f, k):
    c = (236, 242, 250)
    y = 8 + (1 if f == 1 else 0)
    d.ellipse([8 - k, y + 9, 24 - k, G], fill=c)
    d.ellipse([10 - k, y, 22 - k, y + 11], fill=c)
    eye(d, 13 - k, y + 5, (30, 30, 40))
    eye(d, 17 - k, y + 5, (30, 30, 40))
    d.polygon([(14 - k, y + 7), (10 - k, y + 8), (14 - k, y + 9)], fill=(240, 140, 50))
    d.line([(10 - k, y + 14), (4 - k, y + (6 if f == 2 else 12))], fill=(130, 90, 60))


def flea(d, f, k):
    c = (120, 80, 60)
    y = 18 - (6 if f == 1 else 0)
    d.ellipse([9 - k, y, 25 - k, y + 10], fill=c)
    d.ellipse([5 - k, y + 2, 12 - k, y + 8], fill=dk(c, 0.85))
    eye(d, 7 - k, y + 4, (240, 60, 40))
    d.line([(20 - k, y + 8), (26 - k, y + 2), (28 - k, G)], fill=dk(c), width=2)
    d.line([(13 - k, y + 9), (11 - k, G)], fill=dk(c))


def puk(d, f, k):
    c = (90, 160, 140)
    y = 10 + (2 if f == 1 else 0)
    d.ellipse([9 - k, y + 2, 25 - k, y + 12], fill=c)
    d.ellipse([3 - k, y + 1, 12 - k, y + 9], fill=c)
    eye(d, 6 - k, y + 4, (250, 230, 60))
    up = f % 2 == 0
    d.polygon([(14 - k, y + 4), (24 - k, y - (7 if up else 0)), (22 - k, y + 6)], fill=lt(c, 1.2))
    d.line([(24 - k, y + 9), (31 - k, y + 13)], fill=dk(c), width=2)


def bomb(d, f, k):
    c = (240, 140, 50)
    r = 9 + (1 if f == 1 else 0) + (2 if f == 2 else 0)
    cx, cy = 16 - k, 16
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
    d.ellipse([cx - r + 3, cy - r + 2, cx - 1, cy - 2], fill=(255, 220, 120))
    eye(d, cx - 4, cy, (30, 20, 20))
    eye(d, cx + 1, cy, (30, 20, 20))
    d.arc([cx - 4, cy + 1, cx + 2, cy + 6], 20, 160, fill=(30, 20, 20))
    for a in range(0, 360, 60):
        x, y = cx + math.cos(math.radians(a)) * (r + 2), cy + math.sin(math.radians(a)) * (r + 2)
        d.point((x, y), fill=(255, 100, 40))


def ghost(d, f, k):
    c = (200, 210, 230)
    y = 6 + (2 if f == 1 else 0)
    d.ellipse([9 - k, y, 23 - k, y + 14], fill=c)
    d.polygon([(9 - k, y + 7), (23 - k, y + 7), (26 - k, y + 22), (20 - k, y + 18), (16 - k, y + 23), (12 - k, y + 18), (8 - k, y + 22)], fill=c)
    eye(d, 12 - k, y + 6, (40, 30, 60))
    eye(d, 17 - k, y + 6, (40, 30, 60))
    d.line([(9 - k, y + 9), (3 - k, y + (4 if f == 2 else 11))], fill=c, width=2)


def mamool(d, f, k):
    c, robe = (90, 150, 90), (180, 80, 60)
    y = 5 + (1 if f == 1 else 0)
    d.rectangle([10 - k, y + 10, 20 - k, y + 21], fill=robe)
    d.ellipse([9 - k, y, 20 - k, y + 11], fill=c)
    d.polygon([(9 - k, y + 5), (3 - k, y + 6), (9 - k, y + 9)], fill=c)
    eye(d, 11 - k, y + 3, (250, 220, 60))
    d.polygon([(13 - k, y), (16 - k, y - 5), (19 - k, y)], fill=(230, 200, 80))      # crest
    d.line([(20 - k, y + 18), (27 - k, y + 24)], fill=c, width=3)                      # tail
    d.line([(12 - k, y + 21), (11 - k, G)], fill=dk(c), width=2)
    d.line([(18 - k, y + 21), (19 - k, G)], fill=dk(c), width=2)
    ay = y + 4 if f == 2 else y + 13
    d.line([(10 - k, y + 12), (5 - k, ay)], fill=c, width=2)
    d.line([(5 - k, ay + 6), (5 - k, ay - 8)], fill=(150, 110, 60))


def buffalo(d, f, k):
    c = (110, 80, 60)
    y = 9 - (1 if f == 1 else 0)
    d.ellipse([10 - k, y + 2, 29 - k, y + 16], fill=c)
    d.ellipse([10 - k, y, 20 - k, y + 9], fill=(140, 110, 80))                        # hump
    d.ellipse([3 - k, y + 5, 13 - k, y + 14], fill=dk(c, 0.9))
    d.arc([1 - k, y + 1, 9 - k, y + 9], 150, 330, fill=(236, 226, 200), width=2)
    eye(d, 5 - k, y + 9, (250, 80, 60))
    for x in (13, 18, 23, 27):
        d.line([(x - k, y + 15), (x - k, G)], fill=dk(c, 0.7), width=2)


def cactuar(d, f, k):
    c = (90, 170, 80)
    y = 6 + (2 if f == 1 else 0)
    d.rounded_rectangle([11 - k, y, 20 - k, y + 18], 4, fill=c)
    d.line([(11 - k, y + 9), (6 - k, y + (4 if f != 2 else 12))], fill=c, width=3)
    d.line([(20 - k, y + 9), (25 - k, y + (14 if f != 2 else 4))], fill=c, width=3)
    eye(d, 13 - k, y + 4, (30, 30, 30))
    eye(d, 17 - k, y + 4, (30, 30, 30))
    d.ellipse([14 - k, y + 7, 17 - k, y + 9], fill=(30, 30, 30))
    d.line([(13 - k, y + 18), (11 - k, G)], fill=c, width=2)
    d.line([(18 - k, y + 18), (20 - k, G)], fill=c, width=2)


PAINT = {
    "rabbit": rabbit, "worm": worm, "beetle": beetle, "funguar": funguar, "sheep": sheep, "bee": bee, "sapling": sapling,
    "mandragora": mandragora, "lizard": lizard, "raptor": raptor, "crab": crab, "crawler": crawler, "pugil": pugil,
    "bird": bird, "cockatrice": cockatrice, "dhalmel": dhalmel, "goblin": goblin, "fly": fly, "leech": leech, "bat": bat,
    "skeleton": skeleton, "gigas": gigas, "spider": spider, "hound": hound, "coeurl": coeurl, "goobbue": goobbue,
    "opo": opo, "yagudo": yagudo, "uragnite": uragnite, "flytrap": flytrap, "eye": eye_mob, "antlion": antlion,
    "scorpion": scorpion, "bugard": bugard, "sahagin": sahagin, "tonberry": tonberry, "weapon": weapon_mob,
    "manta": manta, "slime": slime, "snoll": snoll, "flea": flea, "puk": puk, "bomb": bomb, "ghost": ghost,
    "mamool": mamool, "buffalo": buffalo, "cactuar": cactuar,
}


def outline(im):
    px = im.load()
    out = im.copy()
    po = out.load()
    for y in range(MH):
        for x in range(MW):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < MW and 0 <= ny < MH and px[nx, ny][3]:
                    po[x, y] = OUTLINE
                    break
    return out


def frame(look, f):
    im = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    PAINT.get(look, slime)(d, f, 2 if f == 2 else 0)
    if f == 3:                                                 # hurt: a white flash on the body
        px = im.load()
        for y in range(MH):
            for x in range(MW):
                r, g, b, a = px[x, y]
                if a:
                    px[x, y] = (min(255, r + 110), min(255, g + 110), min(255, b + 110), a)
    return outline(im)


def sheet(look):
    s = Image.new("RGBA", (MW * 4, MH), (0, 0, 0, 0))
    for i in range(4):
        s.paste(frame(look, i), (i * MW, 0))
    return s
