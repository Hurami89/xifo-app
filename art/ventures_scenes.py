"""Pixel backdrops for Ventures: one painted scene per camp area (the scene keys of venture_data.json).

Painted at 240 x 126 grid pixels like the fishing lakes (make_pixel_lakes.py's Pic: dithered gradients, ridges,
clouds, caves), but these are land: the ground starts at GY and the party and the monster stand on it, feet at
about y 112. Each place gets its own sky, far landmarks (the crags, Delkfutt's Tower, the Star Tree, Selbina's
lighthouse...), middle ground and ground texture, plus a foreground layer (grass, roots, stalagmites) drawn in front.
"""
import math

from PIL import Image, ImageDraw

from make_pixel_lakes import H, W, Pic, mix, shade

GY = 84            # where the ground starts


# ------------------------------------------------------------------ pieces
def sky(p, stops, sun=None, clouds=None, n=5, stars=False, top=GY):
    p.grad(0, top, stops, steps=7)
    if stars:
        im, d = p.draw()
        for _ in range(60):
            d.point((p.rng.uniform(0, W), p.rng.uniform(0, top * 0.7)), fill=(230, 230, 255))
        p.put(im)
    if sun:
        x, y, col = sun
        p.glow(x, y, 18, col, 0.8)
        p.sun(x, y, 5, mix(col, (255, 255, 255), 0.5), mix(stops[-1][1], col, 0.5))
    if clouds:
        p.clouds(n, 4, top * 0.5, clouds, mix(clouds, stops[1][1], 0.5))


def ground(p, cols, top=GY, kind="grass"):
    """The floor: dithered bands from far (cols[0]) to near (cols[-1]), then texture by kind."""
    stops = [(i / (len(cols) - 1), c) for i, c in enumerate(cols)]
    p.grad(top, H, stops, steps=6)
    im, d = p.draw()
    rng = p.rng
    if kind in ("grass", "savanna", "snowgrass"):
        tuft = shade(cols[-1], 1.25)
        for _ in range(170):
            x, y = rng.uniform(0, W), rng.uniform(top + 2, H)
            hgt = 1 + (y - top) / 18
            d.line([(x, y), (x + rng.uniform(-1, 1), y - hgt)], fill=tuft if rng.random() < 0.6 else shade(cols[-1], 0.8))
        if kind == "grass":
            for _ in range(14):
                x, y = rng.uniform(0, W), rng.uniform(top + 6, H - 4)
                d.point((x, y), fill=rng.choice([(250, 240, 120), (250, 180, 200), (230, 240, 255)]))
    elif kind == "sand":
        for y in range(top + 3, H, 5):
            ph = rng.uniform(0, 6)
            for x in range(0, W, 2):
                if math.sin(x * 0.08 + ph + y * 0.3) > 0.6:
                    d.point((x, y + int(math.sin(x * 0.05) * 1.5)), fill=shade(cols[-1], 1.12))
    elif kind in ("stone", "cave", "tomb"):
        for _ in range(60):
            x, y = rng.uniform(0, W), rng.uniform(top + 2, H)
            r = 1 + (y - top) / 12
            d.ellipse([x - r * 1.6, y - r * 0.6, x + r * 1.6, y + r * 0.6], fill=shade(mix(cols[0], cols[-1], (y - top) / (H - top)), rng.uniform(0.82, 1.15)))
        if kind == "tomb":
            for y in range(top + 4, H, 7):
                d.line([(0, y), (W, y)], fill=shade(cols[-1], 0.75))
                off = 0 if (y // 7) % 2 else 9
                for x in range(off, W, 18):
                    d.line([(x, y), (x, y + 7)], fill=shade(cols[-1], 0.75))
    elif kind == "snow":
        for _ in range(80):
            x, y = rng.uniform(0, W), rng.uniform(top + 2, H)
            d.point((x, y), fill=(255, 255, 255))
        for _ in range(10):
            x, y = rng.uniform(0, W), rng.uniform(top + 4, H)
            d.arc([x - 10, y - 2, x + 10, y + 3], 190, 350, fill=(200, 214, 236))
    elif kind == "swamp":
        for _ in range(8):
            x, y = rng.uniform(0, W), rng.uniform(top + 6, H - 6)
            d.ellipse([x - 14, y - 3, x + 14, y + 3], fill=(60, 80, 70))
            d.line([(x - 8, y - 1), (x + 6, y - 1)], fill=(110, 140, 120))
    elif kind == "lava":
        for _ in range(7):
            x, y = rng.uniform(0, W), rng.uniform(top + 6, H - 4)
            d.ellipse([x - 12, y - 2, x + 12, y + 3], fill=(230, 90, 30))
            d.line([(x - 6, y), (x + 6, y)], fill=(255, 200, 80))
    elif kind == "nest":
        for _ in range(40):
            x, y = rng.uniform(0, W), rng.uniform(top + 2, H)
            d.arc([x - 6, y - 2, x + 6, y + 2], 0, 180, fill=shade(cols[-1], 0.8))
    elif kind == "wood":
        for y in range(top + 2, H, 4):
            d.line([(0, y), (W, y)], fill=shade(cols[-1], 0.78))
            for x in range(int(rng.uniform(0, 30)), W, 31):
                d.line([(x, y), (x, y + 4)], fill=shade(cols[-1], 0.7))
    # the path the party stands on: a lighter band
    d.line([(0, top), (W, top)], fill=shade(cols[0], 0.8))
    p.put(im)


def far_ridge(p, base, amp, col, waves=3, snow=None, top=GY):
    p.ridge(base, amp, col, top=top, waves=waves, snow=snow)


def trees(p, y, kind, col, n, hmin, hmax, x0=0, x1=W):
    p.treeline(y, kind, col, n=n, hmin=hmin, hmax=hmax, x0=x0, x1=x1)


def crag(p, x, base, h, col, glow):
    """The great crystal crags of Holla, Dem and Mea: a pale spire with a soft light."""
    im, d = p.draw()
    d.polygon([(x - 7, base), (x - 3, base - h), (x + 1, base - h - 6), (x + 4, base - h + 2), (x + 8, base)], fill=col)
    d.line([(x - 3, base - h), (x - 5, base)], fill=shade(col, 1.25))
    d.line([(x + 1, base - h - 6), (x + 1, base - 4)], fill=shade(col, 1.15))
    p.put(im)
    p.glow(x, base - h - 2, 12, glow, 0.6)


def tower(p, x, base, w, h, col, cap=None, windows=True):
    im, d = p.draw()
    d.rectangle([x - w / 2, base - h, x + w / 2, base], fill=col)
    d.line([(x - w / 2, base - h), (x - w / 2, base)], fill=shade(col, 1.25))
    d.line([(x + w / 2, base - h), (x + w / 2, base)], fill=shade(col, 0.75))
    if cap:
        d.polygon([(x - w / 2 - 2, base - h), (x, base - h - w * 1.1), (x + w / 2 + 2, base - h)], fill=cap)
    if windows:
        for k in range(4, int(h) - 3, 7):
            d.point((x, base - h + k), fill=(250, 220, 140))
    p.put(im)


def big_tree(p, x, base, h, trunk, leaf):
    im, d = p.draw()
    d.polygon([(x - 6, base), (x - 3, base - h), (x + 3, base - h), (x + 7, base)], fill=trunk)
    d.line([(x - 3, base - h), (x - 6, base)], fill=shade(trunk, 1.25))
    for (ox, oy, r) in ((0, -h - 10, 22), (-18, -h - 2, 16), (18, -h - 1, 16), (-8, -h - 22, 14), (10, -h - 20, 14)):
        d.ellipse([x + ox - r, base + oy - r * 0.7, x + ox + r, base + oy + r * 0.7], fill=leaf)
    for (ox, oy, r) in ((-6, -h - 16, 8), (12, -h - 8, 6)):
        d.ellipse([x + ox - r, base + oy - r * 0.6, x + ox + r, base + oy + r * 0.6], fill=shade(leaf, 1.2))
    p.put(im)


def sea(p, y0, y1, top, deep):
    p.grad(y0, y1, [(0, top), (1, deep)], steps=4)
    im, d = p.draw()
    for _ in range(40):
        x, y = p.rng.uniform(0, W), p.rng.uniform(y0 + 1, y1 - 1)
        d.line([(x, y), (x + p.rng.uniform(2, 6), y)], fill=shade(top, 1.25))
    p.put(im)


def ruins(p, x, base, col, n=3):
    im, d = p.draw()
    for i in range(n):
        h = p.rng.uniform(10, 24)
        xx = x + i * 9
        d.rectangle([xx, base - h, xx + 5, base], fill=col)
        d.line([(xx, base - h), (xx, base)], fill=shade(col, 1.25))
        d.rectangle([xx - 1, base - h - 2, xx + 6, base - h], fill=shade(col, 1.1))
    d.rectangle([x - 1, base - 26, x + (n - 1) * 9 + 6, base - 24], fill=shade(col, 1.05))
    p.put(im)


def fg(p, kind, col):
    """The foreground layer (drawn in front of the sprites): grass, roots, rocks, stalagmites, snow."""
    d = ImageDraw.Draw(p.fg)
    rng = p.rng
    if kind == "grass":
        for side in (0, 1):
            for _ in range(16):
                x = rng.uniform(-4, 30) if side == 0 else rng.uniform(W - 30, W + 4)
                h = rng.uniform(8, 20)
                lean = rng.uniform(-4, 4)
                d.line([(x, H), (x + lean, H - h)], fill=col + (255,), width=2)
                d.line([(x + 1, H), (x + lean + 1, H - h)], fill=shade(col, 1.35) + (255,))
    elif kind == "rocks":
        p.fg_rocks(col, n=4, side="left")
    elif kind == "stalagmites":
        p.fg_stalagmites(col)
    elif kind == "snow":
        p.fg_snow()
    elif kind == "ferns":
        p.fg_ferns(col)
    elif kind == "roots":
        for x0 in (0, W):
            for k in range(3):
                pts = [(x0, H - 10 - k * 9)]
                for t in range(1, 6):
                    pts.append((x0 + (t * 9 if x0 == 0 else -t * 9), H - 10 - k * 9 + math.sin(t + k) * 4 + t * 2))
                d.line(pts, fill=col + (255,), width=3)
                d.line(pts, fill=shade(col, 1.3) + (255,))


# ------------------------------------------------------------------ the places
SKY_DAY = [(0, (72, 124, 206)), (0.6, (132, 182, 232)), (1, (210, 228, 238))]
SKY_WARM = [(0, (90, 120, 190)), (0.55, (200, 170, 160)), (1, (246, 206, 150))]
SKY_GREY = [(0, (96, 108, 128)), (0.7, (150, 160, 170)), (1, (196, 200, 204))]
SKY_DUSK = [(0, (50, 40, 90)), (0.5, (150, 80, 110)), (1, (240, 150, 100))]
SKY_NIGHT = [(0, (14, 18, 46)), (0.7, (40, 50, 96)), (1, (70, 80, 120))]


def paint(scene):
    p = Pic(sum(ord(c) * (i + 1) for i, c in enumerate(scene)) * 31 + 7)
    r = p.rng
    if scene == "ronfaure":
        sky(p, SKY_DAY, sun=(190, 22, (255, 246, 220)), clouds=(255, 255, 255))
        far_ridge(p, GY - 18, 10, (110, 150, 120))
        for x in (40, 52, 64):
            tower(p, x, GY - 18, 6, r.uniform(16, 26), (176, 170, 164), cap=(70, 80, 140))
        trees(p, GY, "round", (54, 110, 52), 70, 10, 22)
        trees(p, GY, "round", (40, 92, 44), 30, 14, 26, x0=150, x1=W)
        ground(p, [(96, 150, 70), (70, 124, 54), (58, 104, 46)], kind="grass")
        fg(p, "grass", (48, 104, 44))
    elif scene == "gustaberg":
        sky(p, SKY_WARM, sun=(200, 20, (255, 230, 190)), clouds=(240, 226, 210))
        far_ridge(p, GY - 6, 34, (150, 112, 84), waves=2)
        far_ridge(p, GY, 18, (124, 92, 70), waves=4)
        im, d = p.draw()
        for x in (30, 44):                               # the chimneys of Bastok, far away
            d.rectangle([x, GY - 46, x + 3, GY - 30], fill=(92, 84, 84))
            d.ellipse([x - 3, GY - 54, x + 7, GY - 46], fill=(200, 196, 196))
        p.put(im)
        trees(p, GY, "dead", (110, 84, 60), 12, 6, 12)
        ground(p, [(176, 136, 96), (150, 112, 78), (130, 96, 66)], kind="stone")
        fg(p, "rocks", (120, 92, 70))
    elif scene == "sarutabaruta":
        sky(p, SKY_DAY, sun=(60, 18, (255, 248, 220)), clouds=(255, 255, 255))
        far_ridge(p, GY - 4, 8, (150, 176, 110))
        big_tree(p, 190, GY - 8, 30, (110, 80, 60), (90, 150, 80))      # the Star Tree, far off
        trees(p, GY, "round", (130, 170, 80), 16, 4, 9)
        ground(p, [(190, 200, 110), (160, 176, 90), (138, 154, 74)], kind="savanna")
        fg(p, "grass", (140, 160, 70))
    elif scene == "latheine":
        sky(p, SKY_DAY, sun=(210, 20, (255, 250, 230)), clouds=(255, 255, 255), n=6)
        far_ridge(p, GY - 10, 18, (120, 150, 140), waves=2)
        crag(p, 70, GY - 6, 46, (226, 232, 240), (200, 230, 255))        # Holla
        trees(p, GY, "round", (70, 130, 60), 28, 5, 11)
        ground(p, [(120, 170, 80), (96, 148, 64), (80, 128, 56)], kind="grass")
        fg(p, "grass", (70, 124, 52))
    elif scene == "konschtat":
        sky(p, SKY_DAY, sun=(50, 22, (255, 248, 224)), clouds=(255, 255, 255))
        far_ridge(p, GY - 8, 22, (140, 150, 120), waves=2.5)
        crag(p, 180, GY - 6, 50, (232, 228, 236), (230, 220, 255))       # Dem
        trees(p, GY, "bush", (100, 140, 70), 22, 4, 8)
        ground(p, [(150, 170, 96), (124, 150, 80), (104, 130, 66)], kind="grass")
        fg(p, "grass", (100, 130, 60))
    elif scene == "tahrongi":
        sky(p, SKY_WARM, sun=(200, 16, (255, 236, 200)), clouds=(250, 230, 210), n=3)
        far_ridge(p, GY - 4, 44, (176, 104, 70), waves=1.6)
        far_ridge(p, GY, 22, (150, 86, 60), waves=3)
        crag(p, 120, GY - 32, 30, (236, 226, 236), (255, 220, 240))      # Mea
        ground(p, [(196, 140, 96), (170, 116, 80), (150, 100, 70)], kind="stone")
        fg(p, "rocks", (140, 90, 64))
    elif scene == "valkurm":
        sky(p, SKY_DAY, sun=(200, 18, (255, 250, 230)), clouds=(255, 255, 255))
        sea(p, GY - 18, GY - 4, (110, 176, 214), (60, 120, 180))
        tower(p, 210, GY - 10, 6, 30, (236, 232, 222), cap=(190, 60, 50))  # the lighthouse by Selbina
        p.glow(210, GY - 42, 8, (255, 240, 180), 0.7)
        far_ridge(p, GY - 2, 10, (224, 200, 140), waves=2)
        ruins(p, 40, GY - 2, (190, 176, 150))
        ground(p, [(236, 214, 150), (220, 194, 128), (204, 176, 112)], kind="sand")
    elif scene == "buburimu":
        sky(p, SKY_DAY, sun=(40, 20, (255, 248, 226)), clouds=(255, 255, 255))
        sea(p, GY - 16, GY - 2, (100, 170, 210), (50, 110, 170))
        tower(p, 200, GY - 4, 5, 22, (230, 226, 216), cap=(80, 90, 140))  # Mhaura
        far_ridge(p, GY, 8, (120, 160, 80), waves=3)
        trees(p, GY, "pine", (60, 110, 60), 10, 6, 12, x0=0, x1=90)
        ground(p, [(140, 180, 90), (114, 156, 74), (96, 136, 62)], kind="grass")
        fg(p, "grass", (90, 130, 56))
    elif scene == "jugner":
        sky(p, [(0, (60, 96, 150)), (0.6, (120, 160, 170)), (1, (180, 200, 190))], clouds=(220, 230, 230), n=3)
        trees(p, GY - 20, "pine", (36, 70, 50), 60, 14, 30)
        sea(p, GY - 14, GY - 4, (90, 140, 150), (50, 90, 110))           # the lake
        trees(p, GY, "pine", (30, 60, 40), 30, 18, 34)
        ground(p, [(76, 110, 62), (60, 92, 50), (48, 76, 42)], kind="grass")
        p.glow(120, GY - 30, 60, (210, 230, 220), 0.25, sy=0.4)          # morning mist
        fg(p, "ferns", (40, 90, 48))
    elif scene == "qufim":
        sky(p, SKY_GREY, clouds=(220, 224, 230), n=6)
        im, d = p.draw()                                                  # Delkfutt's Tower in the clouds
        d.rectangle([150, 0, 168, GY - 14], fill=(110, 116, 130))
        d.line([(150, 0), (150, GY - 14)], fill=(150, 156, 170))
        for y in range(6, GY - 16, 9):
            d.line([(150, y), (168, y)], fill=(96, 100, 112))
        p.put(im)
        sea(p, GY - 14, GY - 2, (130, 150, 170), (80, 96, 120))
        ground(p, [(200, 206, 210), (176, 184, 190), (150, 160, 168)], kind="snowgrass")
        fg(p, "rocks", (130, 136, 146))
    elif scene in ("korroloka", "gusgen", "kuftal", "gustav", "den", "aydeewa", "crawlers", "ssg", "onzozo"):
        cave_scene(p, scene)
    elif scene == "rolanberry":
        sky(p, SKY_WARM, sun=(60, 18, (255, 236, 210)), clouds=(250, 236, 220))
        far_ridge(p, GY - 4, 18, (150, 100, 90), waves=2.5)
        im, d = p.draw()
        for _ in range(26):                                               # the berry bushes
            x, y = r.uniform(0, W), r.uniform(GY - 6, GY)
            d.ellipse([x - 5, y - 4, x + 5, y + 2], fill=(90, 110, 60))
            for k in range(3):
                d.point((x + r.uniform(-3, 3), y + r.uniform(-3, 0)), fill=(200, 40, 70))
        p.put(im)
        ground(p, [(170, 150, 100), (150, 126, 86), (130, 108, 74)], kind="grass")
        fg(p, "grass", (120, 110, 60))
    elif scene == "sauromugue":
        sky(p, SKY_DAY, sun=(190, 16, (255, 248, 220)), clouds=(255, 255, 255), n=3)
        far_ridge(p, GY - 4, 10, (190, 176, 110), waves=2)
        tower(p, 70, GY - 2, 14, 40, (170, 160, 140), windows=False)     # the old tower
        im, d = p.draw()
        d.polygon([(63, GY - 42), (66, GY - 48), (70, GY - 42)], fill=(170, 160, 140))
        d.polygon([(72, GY - 42), (76, GY - 50), (78, GY - 42)], fill=(170, 160, 140))
        p.put(im)
        ground(p, [(214, 196, 120), (190, 170, 100), (168, 148, 86)], kind="savanna")
        fg(p, "grass", (170, 150, 70))
    elif scene in ("yuhtunga", "yhoator", "mamook"):
        sky(p, [(0, (80, 150, 200)), (0.7, (150, 210, 220)), (1, (210, 240, 220))], clouds=(255, 255, 255), n=3)
        trees(p, GY - 12, "jungle", (40, 110, 60), 30, 14, 26)
        if scene == "yhoator":
            im, d = p.draw()                                              # the temple, far off
            d.polygon([(170, GY - 12), (180, GY - 44), (200, GY - 44), (210, GY - 12)], fill=(130, 140, 110))
            for y in range(GY - 40, GY - 12, 5):
                d.line([(172 + (GY - 12 - y) * 0.3, y), (208 - (GY - 12 - y) * 0.3, y)], fill=(110, 120, 94))
            p.put(im)
        if scene == "mamook":
            im, d = p.draw()                                              # Mamool Ja huts
            for x in (40, 70, 190):
                d.rectangle([x - 8, GY - 22, x + 8, GY - 8], fill=(150, 110, 70))
                d.polygon([(x - 12, GY - 22), (x, GY - 34), (x + 12, GY - 22)], fill=(180, 150, 80))
            p.put(im)
        trees(p, GY, "palm", (50, 130, 60), 12, 10, 18)
        if scene == "yuhtunga":
            sea(p, GY - 4, GY + 4, (90, 160, 160), (60, 120, 120))        # the river
        ground(p, [(90, 140, 70), (70, 120, 56), (58, 100, 48)], kind="grass")
        fg(p, "ferns", (40, 120, 50))
    elif scene == "bibiki":
        sky(p, SKY_DAY, sun=(190, 20, (255, 250, 230)), clouds=(255, 255, 255))
        sea(p, GY - 22, GY - 2, (90, 200, 210), (40, 130, 180))
        im, d = p.draw()                                                  # Purgonorgo Isle
        d.ellipse([150, GY - 24, 210, GY - 16], fill=(90, 150, 80))
        p.put(im)
        trees(p, GY - 18, "palm", (50, 130, 60), 3, 6, 8, x0=160, x1=200)
        trees(p, GY, "palm", (50, 140, 60), 4, 14, 22, x0=0, x1=60)
        ground(p, [(240, 226, 180), (226, 206, 156), (210, 190, 140)], kind="sand")
    elif scene == "oztroja":
        sky(p, SKY_DUSK, sun=(200, 26, (255, 200, 140)))
        im, d = p.draw()                                                  # the wooden fortress
        for x in range(10, W, 46):
            d.rectangle([x, GY - 50, x + 30, GY], fill=(110, 70, 60))
            d.polygon([(x - 4, GY - 50), (x + 15, GY - 64), (x + 34, GY - 50)], fill=(80, 50, 60))
            for y in range(GY - 46, GY, 6):
                d.line([(x, y), (x + 30, y)], fill=(90, 56, 50))
            d.rectangle([x + 12, GY - 38, x + 18, GY - 30], fill=(250, 200, 110))
        p.put(im)
        for x in (60, 170):
            p.glow(x, GY - 10, 10, (255, 170, 80), 0.9)
        ground(p, [(120, 84, 62), (100, 68, 52), (84, 58, 44)], kind="wood")
    elif scene in ("attohwa",):
        sky(p, [(0, (70, 60, 80)), (0.6, (130, 110, 120)), (1, (170, 150, 140))], clouds=(150, 140, 150), n=5)
        far_ridge(p, GY - 4, 30, (90, 80, 90), waves=2)
        trees(p, GY, "dead", (60, 50, 56), 16, 8, 16)
        ground(p, [(130, 116, 110), (110, 96, 92), (92, 80, 78)], kind="stone")
        p.glow(120, GY - 10, 70, (180, 200, 120), 0.2, sy=0.35)          # the miasma
        fg(p, "rocks", (90, 80, 84))
    elif scene == "misareaux":
        sky(p, SKY_GREY, clouds=(214, 218, 222), n=5)
        sea(p, GY - 16, GY - 4, (110, 130, 150), (70, 86, 110))
        far_ridge(p, GY - 6, 24, (100, 110, 96), waves=2)
        ruins(p, 170, GY - 6, (150, 150, 140), n=4)
        ground(p, [(110, 130, 96), (94, 112, 80), (80, 96, 70)], kind="grass")
        fg(p, "grass", (80, 100, 66))
    elif scene == "garlaige" or scene == "krt":
        hall_scene(p, scene)
    elif scene == "uleguerand":
        sky(p, [(0, (60, 90, 150)), (0.6, (150, 180, 220)), (1, (220, 230, 245))], clouds=(255, 255, 255), n=4)
        far_ridge(p, GY - 4, 50, (200, 210, 230), waves=1.5, snow=(250, 252, 255))
        far_ridge(p, GY, 20, (170, 184, 210), waves=3, snow=(245, 248, 255))
        trees(p, GY, "pine", (70, 90, 100), 12, 8, 14)
        ground(p, [(236, 242, 250), (220, 228, 242), (204, 214, 232)], kind="snow")
        fg(p, "snow", (240, 244, 250))
    elif scene == "boyahda":
        p.grad(0, GY, [(0, (40, 60, 34)), (0.5, (70, 96, 50)), (1, (100, 120, 60))], steps=6)
        im, d = p.draw()                                                  # inside the great tree: bark and light
        for x in range(0, W, 16):
            d.line([(x + r.uniform(-3, 3), 0), (x + r.uniform(-6, 6), GY)], fill=(56, 76, 40), width=3)
        p.put(im)
        for _ in range(4):
            p.glow(r.uniform(20, W - 20), r.uniform(10, 40), 18, (210, 240, 150), 0.6)
        ground(p, [(90, 110, 60), (74, 92, 50), (60, 76, 42)], kind="grass")
        im, d = p.draw()
        for _ in range(12):                                               # glowing mushrooms
            x, y = r.uniform(0, W), r.uniform(GY + 2, GY + 14)
            d.ellipse([x - 3, y - 2, x + 3, y + 1], fill=(170, 230, 210))
        p.put(im)
        fg(p, "roots", (90, 66, 40))
    elif scene in ("wajaom", "bhaflau"):
        warm = scene == "wajaom"
        sky(p, SKY_WARM if warm else SKY_DUSK, sun=(60, 24, (255, 220, 160)), clouds=(250, 226, 210), n=3)
        far_ridge(p, GY - 2, 12, (150, 130, 90) if warm else (120, 80, 90), waves=2)
        im, d = p.draw()                                                  # flat-topped trees
        for x in (30, 90, 160, 215):
            h = r.uniform(18, 30)
            d.line([(x, GY), (x + 2, GY - h)], fill=(90, 60, 40), width=2)
            d.ellipse([x - 16, GY - h - 6, x + 18, GY - h + 3], fill=(80, 120, 60) if warm else (140, 70, 60))
        p.put(im)
        ground(p, [(190, 170, 100), (166, 144, 84), (146, 124, 72)] if warm else [(150, 110, 90), (126, 92, 76), (106, 78, 64)], kind="savanna")
        fg(p, "grass", (150, 130, 60) if warm else (120, 80, 70))
    elif scene in ("ifrits", "zhayolm"):
        if scene == "ifrits":
            sky(p, [(0, (60, 20, 20)), (0.6, (150, 60, 40)), (1, (230, 140, 70))], clouds=(120, 70, 60), n=4)
            far_ridge(p, GY - 2, 46, (70, 46, 44), waves=1.4)
            p.glow(110, GY - 46, 22, (255, 160, 60), 0.7)
        else:                                                             # Zhayolm: daylight, black rock, steam vents
            sky(p, [(0, (90, 120, 170)), (0.6, (200, 170, 140)), (1, (236, 200, 150))], sun=(60, 18, (255, 236, 200)),
                clouds=(240, 230, 220), n=3)
            far_ridge(p, GY - 2, 40, (60, 52, 56), waves=2)
            for x in (70, 150, 210):
                p.glow(x, GY - 14, 10, (240, 240, 240), 0.6, sy=2.0)
        ground(p, [(90, 64, 58), (76, 54, 50), (62, 44, 42)], kind="lava")
        fg(p, "rocks", (60, 44, 42))
    elif scene == "caedarva":
        sky(p, [(0, (50, 70, 70)), (0.6, (100, 130, 110)), (1, (160, 180, 150))], clouds=(170, 190, 170), n=4)
        trees(p, GY - 8, "jungle", (40, 80, 60), 20, 12, 22)
        ruins(p, 150, GY - 4, (120, 130, 110), n=3)
        ground(p, [(80, 104, 76), (66, 88, 64), (54, 74, 54)], kind="swamp")
        p.glow(120, GY - 4, 80, (200, 220, 200), 0.25, sy=0.3)
        fg(p, "ferns", (40, 90, 56))
    elif scene == "valley":
        sky(p, SKY_DAY, sun=(120, 14, (255, 250, 230)), clouds=(255, 255, 255))
        far_ridge(p, GY - 4, 50, (110, 130, 96), waves=1.2)
        im, d = p.draw()                                                  # the waterfall
        d.rectangle([118, GY - 52, 126, GY - 2], fill=(200, 230, 240))
        d.line([(120, GY - 52), (120, GY - 2)], fill=(250, 255, 255))
        p.put(im)
        ground(p, [(110, 160, 80), (90, 136, 64), (74, 116, 54)], kind="grass")
        fg(p, "grass", (70, 120, 50))
    else:
        sky(p, SKY_DAY, clouds=(255, 255, 255))
        ground(p, [(110, 160, 80), (90, 136, 64), (74, 116, 54)], kind="grass")
    return p


def cave_scene(p, scene):
    looks = {
        "korroloka": ((60, 90, 110), (110, 200, 220), "cave", [(80, 110, 120), (64, 90, 100), (52, 74, 84)], (150, 220, 240)),
        "gusgen": ((90, 76, 64), None, "stone", [(120, 100, 84), (100, 84, 70), (84, 70, 58)], None),
        "kuftal": ((150, 110, 70), None, "sand", [(200, 160, 110), (180, 140, 94), (160, 124, 82)], None),
        "gustav": ((90, 80, 76), None, "stone", [(110, 100, 92), (94, 84, 78), (80, 72, 66)], None),
        "den": ((40, 50, 60), None, "stone", [(70, 80, 84), (58, 66, 70), (46, 54, 58)], None),
        "aydeewa": ((60, 50, 90), (180, 120, 240), "cave", [(90, 80, 110), (74, 66, 92), (60, 54, 78)], (200, 160, 250)),
        "crawlers": ((120, 80, 50), None, "nest", [(150, 110, 70), (130, 94, 60), (110, 80, 50)], None),
        "ssg": ((40, 70, 100), (100, 180, 220), "cave", [(70, 100, 120), (56, 84, 104), (44, 70, 88)], (120, 200, 230)),
        "onzozo": ((70, 90, 70), (160, 220, 140), "stone", [(100, 120, 90), (84, 100, 76), (70, 86, 64)], None),
    }
    rock, glow, kind, cols, crystals = looks[scene]
    p.cave(GY, rock, glow=glow, crystals=crystals, beams=scene == "gusgen",
           torches={"gusgen": 3, "den": 0, "gustav": 2, "kuftal": 1}.get(scene, 0))
    if scene == "den":
        for x in (40, 110, 190):                                          # the tonberries' lanterns
            p.glow(x, GY - 20, 12, (255, 210, 120), 0.9)
            im, d = p.draw()
            d.rectangle([x - 2, GY - 23, x + 2, GY - 17], fill=(255, 220, 140))
            p.put(im)
    if scene == "ssg":
        sea(p, GY - 8, GY, (70, 130, 170), (40, 80, 120))
    if scene == "crawlers":
        im, d = p.draw()
        for x in range(20, W, 40):                                        # hanging cocoons
            d.line([(x, 0), (x, 20)], fill=(200, 190, 160))
            d.ellipse([x - 4, 18, x + 4, 32], fill=(220, 210, 180))
        p.put(im)
    ground(p, cols, kind=kind)
    fg(p, "stalagmites", shade(rock, 0.8))


def hall_scene(p, scene):
    if scene == "garlaige":
        wall, floor = (120, 110, 100), [(140, 130, 116), (120, 110, 98), (100, 92, 82)]
    else:
        wall, floor = (80, 90, 110), [(110, 116, 130), (92, 98, 112), (76, 82, 96)]
    p.cave(GY, wall, bricks=True, torches=3 if scene == "garlaige" else 2)
    im, d = p.draw()
    for x in range(20, W, 50):                                            # pillars
        d.rectangle([x, 6, x + 10, GY], fill=shade(wall, 1.1))
        d.line([(x, 6), (x, GY)], fill=shade(wall, 1.35))
        d.line([(x + 10, 6), (x + 10, GY)], fill=shade(wall, 0.7))
        d.rectangle([x - 2, 4, x + 12, 8], fill=shade(wall, 1.2))
    if scene == "garlaige":
        for x in (45, 145):
            d.rectangle([x, 12, x + 10, 40], fill=(140, 40, 50))          # banners
            d.polygon([(x, 40), (x + 5, 46), (x + 10, 40)], fill=(140, 40, 50))
    else:
        for x in (60, 170):
            d.rectangle([x, GY - 10, x + 24, GY - 2], fill=(90, 86, 96))  # coffins
            d.line([(x, GY - 10), (x + 24, GY - 10)], fill=(130, 126, 140))
    p.put(im)
    ground(p, floor, kind="tomb")
    fg(p, "rocks", shade(wall, 0.8))


SCENES = ["ronfaure", "gustaberg", "sarutabaruta", "latheine", "konschtat", "tahrongi", "valkurm", "buburimu", "jugner",
          "qufim", "korroloka", "gusgen", "rolanberry", "sauromugue", "yuhtunga", "bibiki", "oztroja", "attohwa",
          "misareaux", "yhoator", "ssg", "crawlers", "garlaige", "gustav", "onzozo", "uleguerand", "kuftal", "krt",
          "boyahda", "wajaom", "ifrits", "caedarva", "den", "bhaflau", "aydeewa", "valley", "zhayolm", "mamook"]
