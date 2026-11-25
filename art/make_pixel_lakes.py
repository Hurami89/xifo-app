"""Pixel-art fishing backdrops, one for every fishing zone, plus the fishing scene's pixel sprites.

Usage:  python art/make_pixel_lakes.py
Writes  assets/lakes/z<zone>.png (+ z<zone>_fg.png, a foreground layer that sways), assets/px/*.png (sprites, one per
fish and item), src/fishing/lakes.ts and src/fishing/sprites.ts. Needs Pillow + numpy.

Every picture is painted at 240x126 "pixels" with flat colours, dithered gradients and hard edges, then blown up 4x
with nearest-neighbour (so phones and browsers keep it crisp). Each zone gets a look from its kind of place (forest,
coast, desert, snow, swamp, jungle, cave, mine, city, ship...) plus its own landmarks, and its own random seed, so no
two zones are the same picture."""
import json
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
W, H = 240, 126
UP = 4
LAKES = os.path.join(APP, 'assets', 'lakes')
PX = os.path.join(APP, 'assets', 'px')
os.makedirs(LAKES, exist_ok=True)
os.makedirs(PX, exist_ok=True)

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


class Pic:
    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.a = np.zeros((H, W, 3), np.uint8)
        self.fg = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    @property
    def img(self):
        return Image.fromarray(self.a)

    def put(self, im):
        self.a = np.asarray(im.convert('RGB')).copy()

    def draw(self):
        im = self.img
        return im, ImageDraw.Draw(im)

    # ------------------------------------------------------------ fills
    def grad(self, y0, y1, stops, steps=6, x0=0, x1=W):
        """Vertical gradient in a few flat bands, dithered where bands meet."""
        cols = []
        for i in range(steps):
            t = i / (steps - 1)
            for j in range(len(stops) - 1):
                if stops[j][0] <= t <= stops[j + 1][0]:
                    u = (t - stops[j][0]) / max(1e-6, stops[j + 1][0] - stops[j][0])
                    cols.append(mix(stops[j][1], stops[j + 1][1], u))
                    break
        cols = np.array(cols, np.float32)
        for y in range(max(0, int(y0)), min(H, int(y1))):
            t = (y - y0) / max(1, (y1 - y0)) * (steps - 1)
            lo = int(t)
            fr = t - lo
            for x in range(x0, x1):
                k = lo + (1 if fr > BAYER[y % 4, x % 4] else 0)
                self.a[y, x] = cols[min(steps - 1, k)]

    def ridge(self, base, amp, col, rough=0.06, top=None, snow=None, edge=1.15, waves=3):
        """A row of mountains / hills: a jagged top line, filled down to `top` (horizon), lit edge, optional snowcaps."""
        rng = self.rng
        ph = [rng.uniform(0, 6.3) for _ in range(4)]
        fr = [rng.uniform(0.6, 1.4) * waves / W * 2 * math.pi, rng.uniform(2, 4) * waves / W * 2 * math.pi]
        ys = []
        for x in range(W):
            v = 0.55 * math.sin(x * fr[0] + ph[0]) + 0.3 * math.sin(x * fr[1] + ph[1]) + rough * 3 * math.sin(x * 0.9 + ph[2])
            ys.append(int(base - amp * (0.5 + 0.5 * v)))
        bottom = top if top is not None else base
        light = shade(col, edge)
        for x, y in enumerate(ys):
            for yy in range(max(0, y), int(bottom)):
                self.a[yy, x] = col
            if 0 <= y < H:
                self.a[y, x] = light
            if snow and 0 <= y < H:
                depth = int(2 + 3 * (0.5 + 0.5 * math.sin(x * 0.37 + ph[3])))
                if y < base - amp * 0.45:
                    for yy in range(y, min(H, y + depth)):
                        self.a[yy, x] = snow
        return ys

    def clouds(self, n, y0, y1, col, col2=None):
        im, d = self.draw()
        for _ in range(n):
            cx, cy = self.rng.uniform(-10, W + 10), self.rng.uniform(y0, y1)
            w = self.rng.uniform(12, 34)
            for k in range(3):
                ox = (k - 1) * w * 0.45
                r = w * (0.35 if k != 1 else 0.5)
                d.ellipse([cx + ox - r, cy - r * 0.45, cx + ox + r, cy + r * 0.45], fill=col)
            if col2:
                d.line([cx - w * 0.7, cy + w * 0.2, cx + w * 0.7, cy + w * 0.2], fill=col2)
        self.put(im)

    def sun(self, x, y, r, col, halo):
        im, d = self.draw()
        d.ellipse([x - r - 3, y - r - 3, x + r + 3, y + r + 3], fill=halo)
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)
        self.put(im)

    # ------------------------------------------------------------ trees and things on the far shore
    def treeline(self, hz, kind, col, n=60, hmin=4, hmax=11, x0=0, x1=W):
        im, d = self.draw()
        rng = self.rng
        dark = shade(col, 0.75)
        light = shade(col, 1.25)
        xs = sorted(rng.uniform(x0, x1) for _ in range(n))
        for x in xs:
            h = rng.uniform(hmin, hmax)
            if kind == 'pine':
                w = h * 0.45
                d.polygon([(x - w, hz), (x, hz - h * 1.5), (x + w, hz)], fill=dark)
                d.line([(x, hz - h * 1.5), (x - w * 0.5, hz - h * 0.6)], fill=light)
            elif kind == 'round':
                r = h * 0.55
                d.rectangle([x - 0.5, hz - h * 0.6, x + 0.5, hz], fill=(60, 40, 26))
                d.ellipse([x - r, hz - h - r * 0.4, x + r, hz - h * 0.3], fill=col)
                d.point((x - r * 0.4, hz - h * 0.85), fill=light)
            elif kind == 'palm':
                d.line([(x, hz), (x + h * 0.3, hz - h * 1.4)], fill=(96, 70, 40))
                tx, ty = x + h * 0.3, hz - h * 1.4
                for a in (-2.6, -2.0, -1.2, -0.6, 0.0):
                    d.line([(tx, ty), (tx + math.cos(a) * h * 0.7, ty + math.sin(a) * h * 0.35 + h * 0.2)], fill=col)
            elif kind == 'dead':
                d.line([(x, hz), (x, hz - h * 1.3)], fill=dark)
                d.line([(x, hz - h * 0.8), (x - h * 0.4, hz - h * 1.15)], fill=dark)
                d.line([(x, hz - h), (x + h * 0.35, hz - h * 1.4)], fill=dark)
            elif kind == 'jungle':
                r = h * 0.8
                d.ellipse([x - r, hz - h * 1.6, x + r, hz - h * 0.2], fill=col)
                d.ellipse([x - r * 0.5, hz - h * 1.9, x + r * 0.7, hz - h * 1.0], fill=light)
                d.line([(x + r * 0.6, hz - h), (x + r * 0.6, hz - h * 0.2)], fill=dark)
            elif kind == 'bush':
                r = h * 0.5
                d.ellipse([x - r * 1.4, hz - r * 1.3, x + r * 1.4, hz + 1], fill=col)
            elif kind == 'mushroom':
                d.rectangle([x - 1, hz - h, x + 1, hz], fill=(220, 210, 180))
                d.ellipse([x - h * 0.7, hz - h - h * 0.35, x + h * 0.7, hz - h + h * 0.25], fill=col)
                d.point((x - h * 0.2, hz - h - h * 0.15), fill=(250, 250, 240))
        d.line([(x0, hz), (x1, hz)], fill=dark)
        self.put(im)

    def tower(self, x, hz, h, w, col, cap=None):
        im, d = self.draw()
        d.rectangle([x - w / 2, hz - h, x + w / 2, hz], fill=col)
        d.line([(x - w / 2, hz - h), (x - w / 2, hz)], fill=shade(col, 1.3))
        if cap:
            d.polygon([(x - w / 2 - 1, hz - h), (x, hz - h - w), (x + w / 2 + 1, hz - h)], fill=cap)
        for k in range(3, int(h) - 2, 6):
            d.point((x, hz - h + k), fill=(250, 220, 130))
        self.put(im)

    def glow(self, x, y, r, col, strength=0.9, sy=1.0):
        """A soft light, dithered (no smooth gradients in pixel art)."""
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        dd = np.sqrt((xx - x) ** 2 + ((yy - y) / sy) ** 2) / r
        k = strength * np.clip(1 - dd, 0, 1) ** 1.6
        th = BAYER[(yy % 4).astype(int), (xx % 4).astype(int)]
        m = k > th
        c = np.array(col, np.float32)
        self.a[m] = (self.a[m].astype(np.float32) * 0.45 + c * 0.55).astype(np.uint8)
        m2 = k > th + 0.55
        self.a[m2] = (self.a[m2].astype(np.float32) * 0.2 + c * 0.8).astype(np.uint8)

    # ------------------------------------------------------------ water
    def water(self, hz, top, deep, refl=0.45, waves=(255, 255, 255), wave_n=45, jitter=2.2, flow=False):
        """Water under the horizon: a dithered top-to-deep gradient, the far shore mirrored in it (rippled), wave dashes."""
        src = self.a.copy()
        self.grad(hz, H, [(0, top), (0.5, mix(top, deep, 0.6)), (1, deep)], steps=7)
        rng = self.rng
        for y in range(hz, H):
            dd = (y - hz) / (H - hz)
            sy = hz - 1 - int((y - hz) * 1.15)
            if sy < 0:
                continue
            sh = int(round(math.sin(y * 1.7) * jitter * (0.3 + dd)))
            row = np.roll(src[sy], sh, axis=0).astype(np.float32)
            k = refl * (1 - dd) ** 1.4
            if k <= 0.02:
                continue
            base = self.a[y].astype(np.float32)
            mask = ((np.arange(W) + y) % 2 == 0) if k < 0.12 else np.ones(W, bool)
            out = base * (1 - k) + row * k
            self.a[y][mask] = out[mask].astype(np.uint8)
        im, d = self.draw()
        wl = mix(top, waves, 0.35)
        wd = shade(deep, 0.8)
        for _ in range(wave_n):
            y = rng.uniform(hz + 2, H - 1)
            dd = (y - hz) / (H - hz)
            w = rng.uniform(2, 7) * (0.5 + dd * 2) * (2.2 if flow else 1)
            x = rng.uniform(-5, W)
            d.line([(x, int(y)), (x + w, int(y))], fill=wl if rng.random() < 0.65 else wd)
        d.line([(0, hz), (W, hz)], fill=mix(top, (255, 255, 255), 0.35))
        self.put(im)

    # ------------------------------------------------------------ caves and indoors
    def cave(self, hz, rock, glow=None, crystals=None, beams=False, bricks=False, torches=0):
        rng = self.rng
        self.grad(0, hz, [(0, shade(rock, 0.45)), (0.6, rock), (1, shade(rock, 0.8))], steps=5)
        im, d = self.draw()
        if bricks:
            for y in range(4, hz, 5):
                off = 0 if (y // 5) % 2 else 4
                d.line([(0, y), (W, y)], fill=shade(rock, 0.7))
                for x in range(off, W, 8):
                    d.line([(x, y), (x, y + 4)], fill=shade(rock, 0.7))
        else:
            for _ in range(90):                                    # rock lumps
                x, y = rng.uniform(0, W), rng.uniform(0, hz)
                r = rng.uniform(2, 7)
                d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=shade(rock, rng.uniform(0.75, 1.2)))
        for _ in range(26):                                        # stalactites
            x = rng.uniform(0, W)
            h = rng.uniform(4, 18)
            w = rng.uniform(2, 5)
            d.polygon([(x - w, 0), (x, h), (x + w, 0)], fill=shade(rock, 0.55))
            d.line([(x - w * 0.4, 0), (x, h - 1)], fill=shade(rock, 0.95))
        if beams:                                                  # mine timbers
            for x in range(18, W, 54):
                d.rectangle([x, 8, x + 3, hz], fill=(92, 62, 34))
                d.rectangle([x - 14, 8, x + 17, 11], fill=(110, 76, 42))
                d.line([(x, 8), (x, hz)], fill=(130, 92, 52))
        lights = []
        for _ in range(torches):
            x = rng.uniform(15, W - 15)
            y = rng.uniform(hz * 0.35, hz * 0.7)
            lights.append((x, y))
            d.rectangle([x - 0.5, y, x + 0.5, y + 5], fill=(80, 50, 30))
        if crystals:
            for _ in range(10):
                x = rng.uniform(0, W)
                y = rng.uniform(hz * 0.4, hz)
                h = rng.uniform(4, 11)
                d.polygon([(x - 2, y), (x, y - h), (x + 2, y)], fill=crystals)
                d.line([(x, y - h), (x, y)], fill=mix(crystals, (255, 255, 255), 0.5))
        d.line([(0, hz - 1), (W, hz - 1)], fill=shade(rock, 0.6))
        self.put(im)
        if glow:
            self.glow(rng.uniform(W * 0.3, W * 0.7), hz * 0.55, 40, glow, 0.7, sy=0.6)
        for x, y in lights:
            self.glow(x, y - 1, 14, (255, 170, 80), 0.9)
            im, d = self.draw()
            d.rectangle([x - 1, y - 3, x + 1, y], fill=(255, 220, 120))
            d.point((x, y - 4), fill=(255, 250, 210))
            self.put(im)

    # ------------------------------------------------------------ foreground (separate layer, may sway)
    def fg_reeds(self, side='left', col=(34, 70, 40), n=12, cattail=True):
        d = ImageDraw.Draw(self.fg)
        rng = self.rng
        for _ in range(n):
            x = rng.uniform(0, 34) if side == 'left' else rng.uniform(W - 60, W - 26)
            h = rng.uniform(26, 58)
            lean = rng.uniform(-4, 9)
            d.line([(x, H), (x + lean, H - h)], fill=col + (255,), width=2)
            d.line([(x + 1, H), (x + lean + 1, H - h)], fill=shade(col, 1.4) + (255,))
            if cattail and rng.random() < 0.4:
                d.rectangle([x + lean - 1, H - h, x + lean + 1, H - h + 6], fill=(96, 58, 30, 255))

    def fg_rocks(self, col=(86, 80, 76), n=5, side='left'):
        d = ImageDraw.Draw(self.fg)
        rng = self.rng
        for _ in range(n):
            x = rng.uniform(-10, 70) if side == 'left' else rng.uniform(W * 0.35, W * 0.7)
            r = rng.uniform(6, 16)
            y = H - rng.uniform(0, 4)
            d.ellipse([x - r, y - r * 0.8, x + r, y + r * 0.6], fill=col + (255,))
            d.arc([x - r, y - r * 0.8, x + r, y + r * 0.6], 190, 300, fill=shade(col, 1.35) + (255,))
            d.line([(x - r * 0.8, y), (x + r * 0.8, y)], fill=shade(col, 0.7) + (255,))

    def fg_rail(self, col=(120, 82, 46)):
        d = ImageDraw.Draw(self.fg)
        d.rectangle([0, H - 18, W, H - 15], fill=col + (255,))
        d.line([(0, H - 18), (W, H - 18)], fill=shade(col, 1.4) + (255,))
        for x in range(4, W, 16):
            d.rectangle([x, H - 15, x + 2, H], fill=shade(col, 0.85) + (255,))
        d.rectangle([0, H - 4, W, H], fill=shade(col, 0.7) + (255,))

    def fg_pier(self, col=(124, 92, 56)):
        d = ImageDraw.Draw(self.fg)
        for i, y in enumerate(range(H - 10, H, 3)):
            d.rectangle([0, y, W * 0.42, y + 2], fill=shade(col, 1 - i * 0.08) + (255,))
            d.line([(0, y), (W * 0.42, y)], fill=shade(col, 1.3) + (255,))
        for x in (8, 46, 84):
            d.rectangle([x, H - 16, x + 4, H], fill=shade(col, 0.75) + (255,))

    def fg_ledge(self, col=(150, 140, 126), rail=True):
        d = ImageDraw.Draw(self.fg)
        d.rectangle([0, H - 8, W, H], fill=col + (255,))
        d.line([(0, H - 8), (W, H - 8)], fill=shade(col, 1.25) + (255,))
        for x in range(0, W, 12):
            d.line([(x, H - 8), (x, H)], fill=shade(col, 0.75) + (255,))
        if rail:
            for x in range(6, W, 20):
                d.rectangle([x, H - 20, x + 2, H - 8], fill=shade(col, 0.8) + (255,))
            d.rectangle([0, H - 21, W, H - 19], fill=shade(col, 0.9) + (255,))

    def fg_stalagmites(self, col=(70, 62, 60)):
        d = ImageDraw.Draw(self.fg)
        rng = self.rng
        for _ in range(6):
            x = rng.choice([rng.uniform(0, 50), rng.uniform(W - 40, W)])
            h = rng.uniform(12, 30)
            w = rng.uniform(4, 8)
            d.polygon([(x - w, H), (x, H - h), (x + w, H)], fill=col + (255,))
            d.line([(x, H - h), (x - w * 0.5, H)], fill=shade(col, 1.4) + (255,))

    def fg_snow(self):
        d = ImageDraw.Draw(self.fg)
        d.ellipse([-30, H - 14, 70, H + 20], fill=(236, 242, 250, 255))
        d.arc([-30, H - 14, 70, H + 20], 200, 330, fill=(255, 255, 255, 255))
        d.ellipse([40, H - 7, 110, H + 14], fill=(214, 226, 240, 255))

    def fg_palm(self):
        d = ImageDraw.Draw(self.fg)
        cx, cy = -6, 10
        for k in range(7):
            a = 0.15 + k * 0.2
            ex, ey = cx + math.cos(a) * 70, cy + math.sin(a) * 50
            d.line([(cx, cy), (ex, ey)], fill=(40, 96, 46, 255), width=3)
            for t in np.linspace(0.2, 1, 7):
                px, py = cx + (ex - cx) * t, cy + (ey - cy) * t
                d.line([(px, py), (px + 4, py + 6)], fill=(56, 124, 58, 255))

    def fg_ferns(self, col=(46, 104, 50)):
        d = ImageDraw.Draw(self.fg)
        rng = self.rng
        for _ in range(5):
            x = rng.uniform(-6, 40)
            for a in np.linspace(-2.6, -0.5, 5):
                ln = rng.uniform(16, 30)
                d.line([(x, H), (x + math.cos(a) * ln, H + math.sin(a) * ln)], fill=col + (255,), width=2)

    def fg_crystals(self, col):
        d = ImageDraw.Draw(self.fg)
        rng = self.rng
        for _ in range(4):
            x = rng.uniform(0, 44)
            h = rng.uniform(14, 30)
            d.polygon([(x - 4, H), (x - 1, H - h), (x + 3, H - h + 3), (x + 5, H)], fill=col + (255,))
            d.line([(x - 1, H - h), (x - 2, H)], fill=mix(col, (255, 255, 255), 0.6) + (255,))


# ------------------------------------------------------------------ the places
SKY = [(0, (70, 120, 200)), (0.65, (130, 180, 230)), (1, (214, 230, 236))]
SEA = ((110, 176, 214), (18, 54, 120))
LAKE = ((120, 176, 190), (30, 74, 104))


def outdoor(p, hz, sky=SKY, clouds=(255, 255, 255), sun=True):
    p.grad(0, hz, sky, steps=6)
    if sun:
        p.glow(W * 0.72, hz * 0.28, 16, (255, 250, 230), 0.8)
        p.sun(W * 0.72, hz * 0.28, 5, (255, 248, 214), mix(sky[-1][1], (255, 250, 230), 0.5))
    if clouds:
        p.clouds(p.rng.randint(3, 6), 4, hz * 0.55, clouds, mix(clouds, sky[1][1], 0.5))


def paint(z):
    zid, name = z['id'], z['name']
    p = Pic(zid * 7919 + 17)
    r = p.rng
    kind = 'outdoor'
    sway = False
    hz = 58

    def sea(hz_, top=SEA[0], deep=SEA[1]):
        p.water(hz_, top, deep, refl=0.25, wave_n=70, jitter=3)

    def lake(hz_, top=LAKE[0], deep=LAKE[1], **kw):
        p.water(hz_, top, deep, **kw)

    def far_hills(hz_, col, amp=14, waves=3, snow=None):
        p.ridge(hz_ - 2, amp, col, top=hz_, waves=waves, snow=snow)

    def mountains(hz_, col, snow=None):
        p.ridge(hz_ - 10, 26, mix(col, (200, 214, 236), 0.45), top=hz_, waves=2.5, snow=snow)
        p.ridge(hz_ - 3, 14, col, top=hz_, waves=4)

    n = name
    # ---- towns
    if 'San d\'Oria' in n:
        hz = 64
        outdoor(p, hz)
        far_hills(hz, (96, 132, 92))
        for x in (40, 70, 110, 150, 190):
            p.tower(x + r.uniform(-6, 6), hz, r.uniform(16, 30), 8, (168, 160, 150), cap=(64, 72, 120))
        p.tower(125, hz, 44, 14, (184, 176, 164), cap=(64, 72, 120))
        im, d = p.draw()
        for x in (60, 125, 180):
            d.rectangle([x, hz - 30, x + 3, hz - 22], fill=(170, 40, 40))
        p.put(im)
        lake(hz, (110, 150, 170), (40, 60, 90))
        p.fg_ledge((150, 144, 134))
    elif 'Bastok' in n:
        hz = 62
        outdoor(p, hz, sky=[(0, (110, 130, 170)), (0.7, (190, 170, 150)), (1, (220, 196, 160))], clouds=(210, 200, 190))
        mountains(hz, (120, 94, 74))
        im, d = p.draw()
        for x in range(10, W, 26):
            h = r.uniform(10, 26)
            d.rectangle([x, hz - h, x + 16, hz], fill=(96, 88, 84))
            d.rectangle([x + 2, hz - h + 3, x + 4, hz - h + 5], fill=(250, 210, 120))
            if r.random() < 0.5:
                d.rectangle([x + 10, hz - h - 14, x + 13, hz - h], fill=(80, 70, 66))
                for k in range(4):
                    d.ellipse([x + 9 + k * 3, hz - h - 20 - k * 5, x + 15 + k * 4, hz - h - 16 - k * 5], fill=(170, 166, 162))
        p.put(im)
        lake(hz, (120, 150, 160), (46, 62, 74))
        p.fg_ledge((120, 104, 92), rail='Port' in n)
    elif 'Windurst' in n or n == 'Heavens Tower':
        hz = 60
        outdoor(p, hz)
        im, d = p.draw()
        d.rectangle([150, 6, 168, hz], fill=(110, 82, 52))           # the Star Tree
        d.ellipse([110, -14, 210, 34], fill=(62, 128, 64))
        d.ellipse([125, -6, 180, 22], fill=(90, 160, 80))
        p.put(im)
        p.treeline(hz, 'mushroom', (190, 92, 70), n=12, hmin=6, hmax=11, x1=140)
        p.treeline(hz, 'round', (70, 140, 70), n=20, hmin=4, hmax=9)
        lake(hz, (120, 190, 200), (34, 90, 120))
        p.fg_reeds(); sway = True
    elif 'Jeuno' in n:
        hz = 66
        outdoor(p, hz, sky=[(0, (60, 96, 170)), (0.7, (150, 176, 214)), (1, (230, 214, 190))])
        far_hills(hz, (110, 120, 140), amp=18)
        im, d = p.draw()
        for x in range(0, W, 48):                                     # arches
            d.rectangle([x, hz - 34, x + 48, hz - 28], fill=(176, 160, 136))
            d.rectangle([x, hz - 28, x + 6, hz], fill=(160, 144, 122))
            d.arc([x + 6, hz - 30, x + 48, hz + 8], 180, 360, fill=(120, 108, 92))
        d.ellipse([170, 10, 200, 18], fill=(150, 110, 70))            # an airship
        d.rectangle([180, 18, 190, 21], fill=(120, 80, 50))
        p.put(im)
        lake(hz, (100, 150, 190), (30, 60, 110))
        p.fg_ledge((176, 160, 136))
    elif n in ('Aht Urhgan Whitegate', 'Al Zahbi'):
        hz = 62
        outdoor(p, hz, sky=[(0, (60, 120, 200)), (0.7, (150, 200, 236)), (1, (240, 230, 200))])
        im, d = p.draw()
        for x in range(4, W, 30):
            h = r.uniform(10, 22)
            d.rectangle([x, hz - h, x + 22, hz], fill=(226, 206, 166))
            d.ellipse([x + 3, hz - h - 9, x + 19, hz - h + 7], fill=(80, 150, 170) if r.random() < 0.5 else (230, 214, 180))
        for x in (60, 170):
            d.rectangle([x, hz - 44, x + 4, hz], fill=(236, 220, 186))
            d.polygon([(x - 1, hz - 44), (x + 2, hz - 52), (x + 5, hz - 44)], fill=(80, 150, 170))
        p.put(im)
        sea(hz, (100, 190, 220), (20, 80, 140))
        p.fg_ledge((214, 196, 160))
    elif n in ('Selbina', 'Mhaura', 'Nashmau', 'Tavnazian Safehold', 'Port Jeuno'):
        hz = 60
        outdoor(p, hz)
        far_hills(hz, (90, 120, 100) if n != 'Nashmau' else (150, 120, 90), amp=10)
        im, d = p.draw()
        for x in (30, 70, 200):                                       # masts
            d.line([(x, hz), (x, hz - 30)], fill=(90, 66, 40))
            d.polygon([(x + 1, hz - 28), (x + 14, hz - 16), (x + 1, hz - 8)], fill=(236, 230, 214))
        if n == 'Selbina':
            d.rectangle([150, hz - 20, 156, hz], fill=(200, 190, 170))
            for a in range(4):
                ang = a * math.pi / 2 + 0.4
                d.line([(153, hz - 20), (153 + math.cos(ang) * 11, hz - 20 + math.sin(ang) * 11)], fill=(120, 90, 60), width=2)
        p.put(im)
        sea(hz)
        p.fg_pier()
    elif n == 'Rabao':
        hz = 70
        outdoor(p, hz, sky=[(0, (110, 150, 210)), (0.7, (220, 200, 160)), (1, (246, 220, 170))], clouds=None)
        p.ridge(hz - 4, 16, (214, 170, 110), top=hz, waves=2)
        im, d = p.draw()
        for x in (40, 70, 120):
            d.polygon([(x - 12, hz), (x, hz - 14), (x + 12, hz)], fill=(180, 80, 60) if x != 70 else (230, 210, 170))
        p.put(im)
        p.treeline(hz, 'palm', (60, 140, 60), n=6, hmin=8, hmax=12)
        lake(hz, (90, 190, 200), (30, 100, 120))
        p.fg_rocks((190, 150, 100))
    elif n == 'Kazham':
        hz = 62
        outdoor(p, hz)
        p.treeline(hz, 'jungle', (40, 110, 50), n=30, hmin=5, hmax=10)
        im, d = p.draw()
        for x in (50, 110, 170):
            d.rectangle([x, hz - 8, x + 16, hz - 2], fill=(150, 110, 60))
            d.polygon([(x - 3, hz - 8), (x + 8, hz - 16), (x + 19, hz - 8)], fill=(200, 170, 90))
            d.line([(x + 2, hz - 2), (x + 2, hz + 3)], fill=(90, 60, 30))
        p.put(im)
        sea(hz, (90, 190, 200), (20, 90, 130))
        p.fg_palm(); sway = True
    elif n == 'Norg':
        hz = 64; kind = 'cave'
        p.cave(hz, (70, 64, 70), torches=4)
        im, d = p.draw()
        d.polygon([(120, hz), (130, hz - 10), (190, hz - 10), (200, hz)], fill=(90, 60, 40))   # a pirate ship
        d.line([(160, hz - 10), (160, hz - 40)], fill=(70, 50, 30))
        d.polygon([(161, hz - 38), (176, hz - 26), (161, hz - 16)], fill=(40, 40, 46))
        p.put(im)
        lake(hz, (50, 90, 110), (10, 20, 34), refl=0.55)
        p.fg_pier((100, 74, 48))
    # ---- ships
    elif n.startswith('Ship bound') or 'sea route' in n.lower() or 'Silver Sea' in n or n == 'Manaclipper':
        hz = 56
        dark = 'Pirates' in n
        outdoor(p, hz, sky=[(0, (40, 50, 90)), (0.7, (90, 90, 130)), (1, (150, 130, 150))] if dark else SKY)
        sea(hz, (70, 120, 170) if dark else SEA[0], (10, 30, 70) if dark else SEA[1])
        if 'Silver' in n:
            im, d = p.draw()
            for _ in range(40):
                d.point((r.uniform(0, W), r.uniform(hz + 2, H)), fill=(230, 236, 250))
            p.put(im)
        if dark:
            im, d = p.draw()
            d.polygon([(30, hz), (36, hz - 6), (70, hz - 6), (74, hz)], fill=(30, 26, 30))
            d.line([(52, hz - 6), (52, hz - 26)], fill=(30, 26, 30))
            d.polygon([(53, hz - 25), (64, hz - 18), (53, hz - 11)], fill=(20, 20, 20))
            p.put(im)
        p.fg_rail((110, 76, 42) if n != 'Manaclipper' else (150, 110, 70))
    # ---- underground and indoors
    elif any(k in n for k in ('Mines', 'Tunnel', 'Caves', 'Grotto', 'Oubliette', 'Wadi', 'Rancor', 'Labyrinth', 'Subterrane',
                              'Oldton', 'Ranguemont', 'Temple of', 'Delkfutt', 'Aqueducts', 'Fei\'Yin', 'Castle Oztroja',
                              'Shrine', 'Boyahda')) and n != 'Dangruf Wadi':
        hz = 62; kind = 'cave'
        look = dict(rock=(84, 74, 66))
        water = ((60, 100, 120), (10, 24, 40))
        if 'Mines' in n:
            look = dict(rock=(96, 78, 62), beams=True, torches=2)
        if 'Gusgen' in n:
            look = dict(rock=(80, 84, 76), beams=True, torches=1)
            water = ((70, 110, 90), (12, 30, 24))
        if 'Zeruhn' in n or 'Korroloka' in n:
            look = dict(rock=(110, 84, 64), torches=2, beams='Zeruhn' in n)
        if 'Ordelles' in n or 'Grotto' in n:
            look = dict(rock=(66, 84, 96), crystals=(110, 200, 220), glow=(120, 220, 240))
            water = ((60, 130, 150), (8, 30, 50))
        if 'Sea Serpent' in n:
            look = dict(rock=(56, 80, 96), crystals=(90, 200, 200), glow=(90, 220, 220))
        if 'Oubliette' in n or 'Aqueducts' in n:
            look = dict(rock=(96, 96, 104), bricks=True, torches=2)
            water = ((70, 100, 100), (14, 24, 30))
        if 'Kuftal' in n or 'Quicksand' in n:
            look = dict(rock=(150, 114, 74), torches=1)
            water = ((90, 150, 150), (24, 50, 60))
        if 'Rancor' in n:
            look = dict(rock=(70, 50, 54), torches=5, glow=(255, 150, 70))
            water = ((90, 70, 70), (20, 12, 16))
        if 'Labyrinth' in n:
            look = dict(rock=(70, 86, 70), crystals=(160, 220, 120))
        if 'Aydeewa' in n:
            look = dict(rock=(120, 96, 74), glow=(200, 160, 90))
        if 'Oldton' in n:
            look = dict(rock=(84, 80, 92), beams=True, torches=3)
        if 'Temple of' in n:
            look = dict(rock=(96, 100, 78), bricks=True, torches=3)
            water = ((70, 120, 100), (14, 36, 30))
        if 'Delkfutt' in n:
            look = dict(rock=(110, 110, 124), bricks=True, glow=(170, 190, 255))
        if 'Fei\'Yin' in n:
            look = dict(rock=(70, 56, 90), bricks=True, glow=(200, 120, 255), torches=2)
            water = ((90, 80, 130), (14, 10, 30))
        if 'Oztroja' in n:
            look = dict(rock=(110, 100, 84), bricks=True, torches=3)
        if 'Shrine' in n:
            look = dict(rock=(110, 130, 150), crystals=(200, 236, 255), glow=(220, 240, 255))
            water = ((140, 200, 220), (30, 70, 100))
        if 'Boyahda' in n:
            look = dict(rock=(84, 70, 50), glow=(160, 220, 120))
            water = ((80, 120, 90), (16, 34, 20))
        if 'Ranguemont' in n:
            look = dict(rock=(78, 76, 84), crystals=(150, 160, 220))
        p.cave(hz, **look)
        lake(hz, water[0], water[1], refl=0.5, wave_n=40)
        if 'Grotto' in n or 'Shrine' in n or 'Labyrinth' in n:
            p.fg_crystals(look.get('crystals', (150, 200, 220)))
        else:
            p.fg_stalagmites(shade(look['rock'], 0.8))
    # ---- outdoors
    elif 'Ronfaure' in n or n in ('Jugner Forest', 'Davoi', 'Ghelsba Outpost'):
        hz = 60
        outdoor(p, hz)
        far_hills(hz, (80, 116, 96), amp=12)
        p.treeline(hz, 'pine', (40, 92, 56), n=70, hmin=6, hmax=13)
        if n == 'Davoi':
            im, d = p.draw()
            d.rectangle([160, hz - 22, 190, hz], fill=(110, 80, 50))      # an orc fort
            for x in range(160, 192, 5):
                d.polygon([(x, hz - 22), (x + 2, hz - 27), (x + 4, hz - 22)], fill=(90, 64, 40))
            p.put(im)
        lake(hz, (100, 160, 150), (24, 60, 60), flow='Jugner' in n)
        p.fg_reeds(); sway = True
    elif n in ('La Theine Plateau', 'Batallia Downs', 'Rolanberry Fields', 'West Sarutabaruta', 'East Sarutabaruta',
               'Sauromugue Champaign', 'Wajaom Woodlands', 'Lufaise Meadows', 'Giddeus'):
        hz = 62
        outdoor(p, hz)
        far_hills(hz, (118, 150, 90) if 'Sarutabaruta' not in n else (160, 160, 90), amp=16, waves=2)
        if n == 'Batallia Downs':
            p.tower(70, hz, 30, 6, (120, 116, 110))
        if n == 'Rolanberry Fields':
            p.tower(190, hz, 52, 8, (100, 96, 110), cap=(90, 80, 100))          # Delkfutt's Tower on the skyline
        if n in ('Sauromugue Champaign', 'La Theine Plateau'):
            im, d = p.draw()
            for x in (60, 150):                                                # the giant bones / rocks
                d.arc([x - 20, hz - 26, x + 20, hz + 14], 190, 350, fill=(230, 222, 200), width=3)
            p.put(im)
        p.treeline(hz, 'round' if 'Sarutabaruta' not in n else 'bush', (70, 130, 60), n=26, hmin=4, hmax=8)
        if n == 'Giddeus':
            im, d = p.draw()
            d.rectangle([108, 10, 124, hz], fill=(110, 90, 70))
            d.rectangle([112, 10, 120, hz], fill=(200, 230, 240))              # a waterfall
            p.put(im)
        lake(hz)
        p.fg_reeds(); sway = True
    elif 'Gustaberg' in n or n in ('Dangruf Wadi', 'Mount Zhayolm', 'Palborough Mines'):
        hz = 64
        outdoor(p, hz, sky=[(0, (80, 130, 200)), (0.7, (170, 190, 210)), (1, (226, 214, 190))])
        p.ridge(hz - 6, 30, (150, 110, 80), top=hz, waves=2, rough=0.1)
        p.ridge(hz - 2, 14, (124, 90, 66), top=hz, waves=5, rough=0.1)
        if n == 'Mount Zhayolm':
            im, d = p.draw()
            d.polygon([(140, hz), (176, hz - 50), (212, hz)], fill=(90, 70, 70))
            d.polygon([(170, hz - 44), (176, hz - 50), (182, hz - 44)], fill=(255, 140, 60))
            p.put(im)
        lake(hz, (110, 160, 180), (40, 70, 90) if 'Wadi' not in n else (60, 60, 60))
        p.fg_rocks((126, 100, 80))
    elif n in ('Valkurm Dunes', 'Eastern Altepa Desert', 'Western Altepa Desert', 'Cape Teriggan'):
        hz = 64
        outdoor(p, hz, sky=[(0, (90, 150, 220)), (0.7, (210, 210, 200)), (1, (250, 230, 190))], clouds=None if 'Altepa' in n else (255, 255, 255))
        p.ridge(hz - 2, 12, (226, 190, 130), top=hz, waves=2.5)
        if 'Altepa' in n:
            im, d = p.draw()
            d.polygon([(150, hz - 1), (170, hz - 30), (190, hz - 1)], fill=(206, 170, 110))        # a pyramid
            d.line([(170, hz - 30), (190, hz - 1)], fill=(170, 134, 84))
            p.put(im)
            p.treeline(hz, 'palm', (60, 140, 60), n=5, hmin=7, hmax=11, x0=10, x1=110)
            lake(hz, (90, 190, 200), (30, 100, 120))
            p.fg_rocks((200, 160, 110))
        else:
            if n == 'Cape Teriggan':
                im, d = p.draw()
                for x in (60, 120, 180):
                    d.rectangle([x, hz - 26, x + 6, hz], fill=(190, 180, 160))          # standing stones
                p.put(im)
            sea(hz)
            p.fg_rocks((214, 190, 140))
    elif n in ('Beaucedine Glacier', 'Dragon\'s Aery'):
        hz = 64
        outdoor(p, hz, sky=[(0, (130, 150, 190)), (0.7, (200, 214, 232)), (1, (236, 240, 246))], clouds=(240, 244, 250))
        mountains(hz, (120, 130, 160), snow=(244, 248, 255))
        p.treeline(hz, 'pine', (60, 80, 90), n=24, hmin=5, hmax=10)
        lake(hz, (170, 210, 230), (60, 100, 140))
        p.fg_snow()
    elif n in ('Pashhow Marshlands', 'Caedarva Mire', 'Bhaflau Thickets'):
        hz = 60
        outdoor(p, hz, sky=[(0, (110, 130, 130)), (0.7, (170, 180, 160)), (1, (200, 206, 180))], clouds=(210, 214, 200), sun=False)
        p.ridge(hz - 2, 10, (90, 110, 80), top=hz, waves=3)
        p.treeline(hz, 'dead', (60, 70, 50), n=18, hmin=6, hmax=12)
        p.treeline(hz, 'bush', (70, 96, 56), n=20, hmin=3, hmax=6)
        lake(hz, (110, 126, 84), (34, 46, 30), refl=0.5)
        p.fg_reeds(col=(60, 80, 44)); sway = True
    elif n in ('Yuhtunga Jungle', 'Yhoator Jungle', 'Mamook', 'Arrapago Reef', 'Talacca Cove', 'Bibiki Bay',
               'Carpenters\' Landing', 'Phanauet Channel'):
        hz = 58
        outdoor(p, hz)
        if n in ('Arrapago Reef', 'Talacca Cove', 'Bibiki Bay'):
            far_hills(hz, (70, 120, 90), amp=10)
            p.treeline(hz, 'palm', (50, 130, 60), n=8, hmin=8, hmax=12)
            sea(hz, (90, 196, 210), (20, 90, 140))
            p.fg_palm() if n != 'Bibiki Bay' else p.fg_pier()
            sway = n != 'Bibiki Bay'
        elif n in ('Carpenters\' Landing', 'Phanauet Channel'):
            p.treeline(hz, 'pine', (50, 96, 60), n=60, hmin=8, hmax=16)
            p.treeline(hz, 'round', (60, 110, 60), n=20, hmin=6, hmax=10)
            lake(hz, (100, 150, 130), (30, 60, 50), flow=True)
            if n == 'Phanauet Channel':
                p.fg_rail((140, 100, 60))
            else:
                p.fg_pier()
        else:
            p.treeline(hz, 'jungle', (36, 100, 46), n=40, hmin=6, hmax=13)
            if n == 'Yhoator Jungle':
                im, d = p.draw()
                d.rectangle([168, hz - 26, 196, hz], fill=(120, 124, 96))              # the temple
                d.polygon([(164, hz - 26), (182, hz - 38), (200, hz - 26)], fill=(100, 104, 80))
                p.put(im)
            lake(hz, (80, 150, 120), (20, 60, 50), refl=0.55)
            p.fg_ferns(); sway = True
    elif n in ('Qufim Island', 'Buburimu Peninsula', 'Misareaux Coast'):
        hz = 60
        cold = n == 'Qufim Island'
        outdoor(p, hz, sky=[(0, (110, 130, 170)), (0.7, (180, 196, 214)), (1, (226, 232, 236))] if cold else SKY)
        if cold:
            p.tower(60, hz, 58, 9, (96, 92, 108), cap=(80, 76, 96))                   # Delkfutt's Tower
        else:
            far_hills(hz, (90, 130, 90), amp=8)
        sea(hz, (100, 150, 190) if cold else SEA[0], (20, 50, 90) if cold else SEA[1])
        p.fg_rocks((110, 108, 104) if cold else (150, 140, 120))
    elif n in ('Ro\'Maeve',):
        hz = 64
        p.grad(0, hz, [(0, (12, 16, 46)), (0.7, (40, 50, 100)), (1, (90, 100, 150))], steps=6)
        im, d = p.draw()
        for _ in range(50):
            d.point((r.uniform(0, W), r.uniform(0, hz - 10)), fill=(230, 236, 255))
        d.ellipse([170, 8, 196, 34], fill=(240, 240, 226))
        for x in (40, 100, 140):                                                    # moongates
            d.rectangle([x, hz - 34, x + 4, hz], fill=(170, 176, 200))
            d.rectangle([x + 22, hz - 34, x + 26, hz], fill=(170, 176, 200))
            d.rectangle([x - 2, hz - 38, x + 28, hz - 34], fill=(190, 196, 220))
        p.put(im)
        lake(hz, (80, 100, 160), (10, 16, 46), refl=0.65)
        p.fg_crystals((180, 190, 240))
        kind = 'night'
    elif n == 'Ru\'Aun Gardens':
        hz = 70
        outdoor(p, hz, sky=[(0, (90, 160, 230)), (0.7, (200, 226, 246)), (1, (250, 250, 250))], clouds=(255, 255, 255))
        im, d = p.draw()
        for x, y in ((50, 30), (180, 22), (120, 46)):                                # floating islands
            d.polygon([(x - 18, y), (x + 18, y), (x + 4, y + 14), (x - 6, y + 12)], fill=(120, 100, 80))
            d.rectangle([x - 18, y - 2, x + 18, y], fill=(90, 160, 80))
            d.polygon([(x - 6, y - 2), (x, y - 12), (x + 6, y - 2)], fill=(190, 60, 60))
        p.put(im)
        lake(hz, (150, 200, 230), (60, 110, 170))
        p.fg_ledge((200, 196, 186), rail=False)
    elif n == 'The Sanctuary of Zi\'Tah':
        hz = 62
        outdoor(p, hz, sky=[(0, (60, 110, 170)), (0.7, (150, 200, 200)), (1, (210, 236, 220))])
        p.treeline(hz, 'round', (50, 120, 70), n=50, hmin=7, hmax=14)
        im, d = p.draw()
        d.polygon([(130, hz), (140, hz - 44), (150, hz)], fill=(170, 230, 240))     # the great crystal
        d.line([(140, hz - 44), (136, hz)], fill=(240, 255, 255))
        p.put(im)
        lake(hz, (110, 190, 180), (24, 80, 80))
        p.fg_ferns(); sway = True
    else:
        hz = 60
        outdoor(p, hz)
        far_hills(hz, (96, 130, 100))
        p.treeline(hz, 'round', (60, 120, 60), n=30)
        lake(hz)
        p.fg_reeds(); sway = True
    return p, hz, kind, sway


def upscale(img):
    return img.resize((img.width * UP, img.height * UP), Image.NEAREST)


def save_png(img, path, colors=None):
    if colors and img.mode == 'RGB':
        img = img.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    img.save(path, optimize=True)


def lakes():
    data = json.load(open(os.path.join(APP, 'src', 'fishData.json')))
    lines = ['// Made by art/make_pixel_lakes.py: one pixel-art backdrop per fishing zone.',
             "// hz = where the water starts (0-1 of the height); kind 'cave' = no sky, no time-of-day tint; sway = the foreground sways.",
             'export type Lake = { img: any; fg: any; hz: number; kind: string; sway: boolean };',
             'export const LAKES: Record<number, Lake> = {']
    total = 0
    for z in data['zones']:
        p, hz, kind, sway = paint(z)
        bg = upscale(p.img)
        fg = upscale(p.fg)
        bp = os.path.join(LAKES, f"z{z['id']}.png")
        fp = os.path.join(LAKES, f"z{z['id']}_fg.png")
        save_png(bg, bp, colors=48)
        fg.save(fp, optimize=True)
        total += os.path.getsize(bp) + os.path.getsize(fp)
        lines.append(f"  {z['id']}: {{ img: require('../../assets/lakes/z{z['id']}.png'), fg: require('../../assets/lakes/z{z['id']}_fg.png'), "
                     f"hz: {hz / H:.3f}, kind: '{kind}', sway: {'true' if sway else 'false'} }},")
    lines.append('};')
    with open(os.path.join(APP, 'src', 'fishing', 'lakes.ts'), 'w') as fh:
        fh.write('\n'.join(lines) + '\n')
    print(len(data['zones']), 'lakes', total // 1024, 'KB')


# ------------------------------------------------------------------ sprites
def outline(arr, col):
    """A 1-pixel dark outline around the opaque part of an RGBA array."""
    a = arr[..., 3] > 0
    o = np.zeros_like(a)
    o[1:] |= a[:-1]; o[:-1] |= a[1:]; o[:, 1:] |= a[:, :-1]; o[:, :-1] |= a[:, 1:]
    o &= ~a
    arr[o] = col + (255,)
    return arr


FISH_COLOURS = [
    ('Gold', (236, 180, 50), (255, 230, 120)), ('Tiny Goldfish', (240, 120, 40), (255, 200, 120)),
    ('Silver', (190, 200, 214), (240, 244, 250)), ('Black', (54, 54, 64), (110, 110, 130)), ('Dark', (60, 66, 80), (120, 126, 140)),
    ('Red', (196, 60, 50), (240, 140, 110)), ('Yellow', (230, 200, 50), (255, 240, 150)), ('Copper', (184, 110, 60), (230, 170, 120)),
    ('Cobalt', (50, 90, 200), (120, 170, 250)), ('Bluetail', (120, 150, 190), (210, 220, 240)), ('Crystal', (150, 220, 236), (230, 250, 255)),
    ('Tiger', (230, 140, 50), (250, 210, 140)), ('Zebra', (220, 220, 210), (255, 255, 250)), ('Forest', (80, 120, 60), (160, 190, 110)),
    ('Moat', (120, 110, 70), (190, 180, 130)), ('Shining', (200, 210, 220), (250, 220, 230)), ('Noble', (230, 140, 170), (255, 210, 220)),
    ('Betta', (170, 40, 90), (230, 110, 160)), ('Coral', (240, 200, 60), (255, 250, 220)), ('Moorish', (240, 220, 80), (255, 255, 240)),
    ('Ogre', (90, 80, 60), (150, 140, 110)), ('Icefish', (200, 230, 240), (250, 255, 255)), ('Bastore', (150, 170, 190), (220, 230, 240)),
    ('Salmon', (190, 110, 100), (240, 190, 170)), ('Trout', (140, 150, 120), (210, 210, 180)), ('Bass', (90, 120, 80), (190, 200, 150)),
    ('Shark', (120, 130, 150), (220, 226, 236)), ('Pipira', (150, 140, 130), (230, 110, 90)), ('Greedie', (130, 150, 170), (210, 220, 230)),
]
SHAPES = [
    (('Eel', 'Yilanbaligi', 'Black Ghost', 'Lungfish'), 'eel'), (('Lobster', 'Crayfish', 'Istakoz', 'Pterygotus', 'Trilobite'), 'lobster'),
    (('Calamary', 'Kalamar'), 'squid'), (('Ahtapot', 'Nebimonite'), 'octopus'), (('Frog',), 'frog'), (('Newt', 'Siredon'), 'newt'),
    (('Terrapin', 'Kaplumbaga'), 'turtle'), (('Shell', 'Clam', 'Istiridye', 'Urchin'), 'shell'), (('Jellyfish', 'Denizanasi'), 'jelly'),
    (('Sole', 'Dil'), 'flat'), (('Globe', 'Greedie', 'Bibikibo', 'Quus'), 'round'), (('Shark', 'Kilicbaligi', 'Lakerda'), 'shark'),
    (('Marimo',), 'ball'), (('Kelp',), 'kelp'), (('Sardine', 'Hamsi', 'Herring', 'Goby', 'Icefish', 'Alabaligi'), 'slim'),
    (('Bream', 'Butterfly', 'Idol', 'Wrasse', 'Mercanbaligi', 'Crescent'), 'deep'),
    (('Bucket',), 'bucket'), (('Log',), 'log'), (('Coral Fragment',), 'coral'), (('Mask',), 'mask'), (('Shield',), 'shield'),
    (('Cap',), 'cap'), (('ring', 'Ring'), 'ring'), (('Leggings', 'Subligar'), 'boot'), (('Dagger', 'Sword', 'Greatsword'), 'sword'),
    (('Pick',), 'pick'), (('Gil',), 'coin'),
]


def fish_sprite(name, large):
    shape = 'fish'
    for keys, s in SHAPES:
        if any(k in name for k in keys):
            shape = s
            break
    h = sum(ord(c) for c in name)
    base, light = [(110, 130, 150), (190, 200, 210)], None
    col, lit = None, None
    for key, c, l in FISH_COLOURS:
        if key in name:
            col, lit = c, l
            break
    if col is None:
        pal = [((110, 140, 160), (200, 214, 226)), ((130, 120, 80), (200, 190, 140)), ((90, 110, 120), (170, 190, 200)),
               ((150, 120, 100), (220, 200, 180)), ((100, 140, 110), (180, 210, 180))]
        col, lit = pal[h % len(pal)]
    S = 32 if large else 24
    im = Image.new('RGBA', (S, S // 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w, hh = S, S // 2
    dark = shade(col, 0.6)
    eye = [(0, 0, 0, 0)]

    def body(x0, y0, x1, y1):
        d.ellipse([x0, y0, x1, y1], fill=col)
        d.ellipse([x0 + 2, (y0 + y1) / 2, x1 - 3, y1 - 1], fill=lit)       # pale belly

    if shape in ('fish', 'slim', 'deep', 'shark'):
        top = {'fish': 0.2, 'slim': 0.3, 'deep': 0.06, 'shark': 0.25}[shape]
        body(1, hh * top, w * 0.78, hh * (1 - top))
        d.polygon([(w * 0.72, hh * 0.5), (w - 1, hh * 0.12), (w - 3, hh * 0.5), (w - 1, hh * 0.88)], fill=dark)
        fin = hh * (0.0 if shape == 'shark' else top - 0.15)
        d.polygon([(w * 0.35, hh * top + 1), (w * (0.42 if shape != 'shark' else 0.40), max(0, fin)), (w * 0.55, hh * top + 1)], fill=dark)
        if any(k in name for k in ('Tiger', 'Zebra', 'Butterfly', 'Idol', 'Tricolored')):
            for x in range(int(w * 0.25), int(w * 0.7), 4):
                d.line([(x, hh * top + 1), (x, hh * (1 - top) - 1)], fill=(40, 40, 40) if 'Tricolored' not in name else (230, 120, 40))
        if 'Trout' in name or 'Shining' in name:
            d.line([(w * 0.15, hh * 0.5), (w * 0.7, hh * 0.5)], fill=(240, 120, 150))
        eye = [(w * 0.14, hh * 0.38)]
    elif shape == 'eel':
        for x in range(1, w - 2):
            y = hh * 0.5 + math.sin(x * 0.45) * hh * 0.18
            d.rectangle([x, y - 1.5, x + 1, y + 1.5], fill=col)
            d.point((x, y + 1.5), fill=lit)
        eye = [(3, hh * 0.5 - 1)]
    elif shape == 'lobster':
        d.ellipse([w * 0.25, hh * 0.3, w * 0.85, hh * 0.75], fill=col)
        for k in range(3):
            d.line([(w * (0.35 + k * 0.12), hh * 0.75), (w * (0.3 + k * 0.12), hh - 1)], fill=dark)
        d.ellipse([1, hh * 0.08, w * 0.25, hh * 0.42], fill=col)
        d.ellipse([1, hh * 0.55, w * 0.22, hh * 0.9], fill=col)
        d.polygon([(w * 0.85, hh * 0.5), (w - 1, hh * 0.25), (w - 1, hh * 0.75)], fill=dark)
        eye = [(w * 0.3, hh * 0.35)]
    elif shape in ('squid', 'octopus'):
        d.ellipse([w * 0.15, hh * 0.05, w * 0.6, hh * 0.6], fill=col)
        for k in range(5):
            x = w * (0.18 + k * 0.09)
            d.line([(x, hh * 0.5), (x + math.sin(k) * 2, hh - 1)], fill=col)
        if shape == 'squid':
            d.polygon([(w * 0.6, hh * 0.2), (w * 0.9, hh * 0.32), (w * 0.6, hh * 0.45)], fill=dark)
        eye = [(w * 0.3, hh * 0.3), (w * 0.45, hh * 0.3)]
    elif shape in ('frog', 'newt', 'turtle'):
        if shape == 'turtle':
            d.ellipse([w * 0.2, hh * 0.15, w * 0.8, hh * 0.8], fill=col)
            d.ellipse([w * 0.3, hh * 0.25, w * 0.7, hh * 0.65], fill=lit)
            d.ellipse([1, hh * 0.35, w * 0.25, hh * 0.65], fill=(120, 150, 90))
        elif shape == 'frog':
            d.ellipse([w * 0.15, hh * 0.2, w * 0.75, hh * 0.9], fill=col)
            d.line([(w * 0.6, hh * 0.85), (w * 0.9, hh * 0.95)], fill=dark, width=2)
        else:
            d.rectangle([w * 0.1, hh * 0.4, w * 0.75, hh * 0.65], fill=col)
            d.polygon([(w * 0.75, hh * 0.45), (w - 1, hh * 0.55), (w * 0.75, hh * 0.62)], fill=col)
            for x in (0.22, 0.6):
                d.line([(w * x, hh * 0.65), (w * x - 2, hh * 0.9)], fill=dark)
        eye = [(w * 0.22, hh * 0.35)]
    elif shape == 'shell':
        d.pieslice([w * 0.15, hh * 0.05, w * 0.85, hh * 1.4], 180, 360, fill=col)
        for k in range(5):
            d.line([(w * 0.5, hh * 0.72), (w * (0.18 + k * 0.16), hh * 0.2)], fill=dark)
        if 'Urchin' in name:
            for a in np.linspace(math.pi, 2 * math.pi, 9):
                d.line([(w * 0.5, hh * 0.7), (w * 0.5 + math.cos(a) * w * 0.45, hh * 0.7 + math.sin(a) * hh * 0.7)], fill=dark)
    elif shape == 'jelly':
        d.pieslice([w * 0.2, 1, w * 0.8, hh * 1.0], 180, 360, fill=col)
        for k in range(5):
            d.line([(w * (0.25 + k * 0.12), hh * 0.5), (w * (0.25 + k * 0.12), hh - 1)], fill=lit)
    elif shape == 'flat':
        d.ellipse([1, hh * 0.3, w * 0.85, hh * 0.75], fill=col)
        d.polygon([(w * 0.82, hh * 0.52), (w - 1, hh * 0.3), (w - 1, hh * 0.75)], fill=dark)
        eye = [(w * 0.14, hh * 0.42), (w * 0.2, hh * 0.38)]
    elif shape == 'round':
        d.ellipse([w * 0.12, 1, w * 0.72, hh - 1], fill=col)
        d.ellipse([w * 0.18, hh * 0.5, w * 0.66, hh - 2], fill=lit)
        d.polygon([(w * 0.7, hh * 0.5), (w - 2, hh * 0.25), (w - 2, hh * 0.75)], fill=dark)
        eye = [(w * 0.24, hh * 0.35)]
    elif shape == 'ball':
        d.ellipse([w * 0.3, 1, w * 0.7, hh - 1], fill=(70, 150, 70))
        d.point((w * 0.42, hh * 0.3), fill=(180, 230, 160))
    elif shape == 'kelp':
        for k in range(4):
            x = w * (0.25 + k * 0.15)
            d.line([(x, hh - 1), (x + math.sin(k * 2) * 3, 1)], fill=(60, 120, 60), width=2)
    elif shape == 'bucket':
        d.polygon([(w * 0.3, hh * 0.2), (w * 0.7, hh * 0.2), (w * 0.64, hh - 1), (w * 0.36, hh - 1)], fill=(150, 100, 60))
        d.arc([w * 0.3, 0, w * 0.7, hh * 0.5], 180, 360, fill=(110, 90, 80))
    elif shape == 'log':
        d.rectangle([2, hh * 0.3, w - 4, hh * 0.75], fill=(130, 90, 50))
        d.ellipse([w - 7, hh * 0.3, w - 1, hh * 0.75], fill=(200, 160, 110))
    elif shape == 'coral':
        for a in (-0.6, 0, 0.6):
            d.line([(w * 0.5, hh - 1), (w * 0.5 + math.sin(a) * w * 0.3, 2)], fill=(240, 120, 120), width=2)
    elif shape == 'mask':
        d.ellipse([w * 0.25, 1, w * 0.75, hh - 1], fill=(150, 110, 70) if 'Bugbear' in name else (120, 120, 110))
        d.rectangle([w * 0.35, hh * 0.35, w * 0.45, hh * 0.45], fill=(20, 20, 20))
        d.rectangle([w * 0.55, hh * 0.35, w * 0.65, hh * 0.45], fill=(20, 20, 20))
    elif shape == 'shield':
        d.polygon([(w * 0.3, 1), (w * 0.7, 1), (w * 0.7, hh * 0.6), (w * 0.5, hh - 1), (w * 0.3, hh * 0.6)], fill=(110, 160, 170))
        d.line([(w * 0.5, 2), (w * 0.5, hh - 2)], fill=(200, 230, 230))
    elif shape == 'cap':
        d.pieslice([w * 0.25, 1, w * 0.75, hh * 1.4], 180, 360, fill=(140, 90, 60))
        d.rectangle([w * 0.2, hh * 0.68, w * 0.8, hh * 0.78], fill=(110, 70, 50))
    elif shape == 'ring':
        c = (230, 160, 90) if 'Copper' in name else (220, 226, 236)
        d.ellipse([w * 0.32, hh * 0.15, w * 0.68, hh - 1], outline=c, width=2)
        d.rectangle([w * 0.47, 0, w * 0.53, hh * 0.2], fill=(120, 200, 255))
    elif shape == 'boot':
        d.polygon([(w * 0.35, 1), (w * 0.55, 1), (w * 0.55, hh * 0.7), (w * 0.75, hh * 0.7), (w * 0.75, hh - 1), (w * 0.35, hh - 1)], fill=(140, 96, 64))
    elif shape == 'sword':
        L = 0.95 if 'Great' in name else (0.6 if 'Dagger' in name else 0.8)
        c = (200, 210, 220) if 'Mythril' in name else (170, 120, 80)
        d.line([(2, hh * 0.5), (w * L, hh * 0.5)], fill=c, width=2)
        d.line([(w * 0.2, hh * 0.2), (w * 0.2, hh * 0.8)], fill=(150, 110, 60), width=2)
    elif shape == 'pick':
        d.line([(w * 0.5, hh - 1), (w * 0.5, 2)], fill=(130, 90, 50), width=2)
        d.arc([w * 0.2, 1, w * 0.8, hh], 190, 350, fill=(150, 120, 100), width=2)
    elif shape == 'coin':
        d.ellipse([w * 0.3, 1, w * 0.7, hh - 1], fill=(240, 200, 60))
        d.ellipse([w * 0.38, 3, w * 0.62, hh - 3], outline=(200, 150, 40))
    arr = np.asarray(im).copy()
    arr = outline(arr, (22, 26, 40))
    im = Image.fromarray(arr)
    d = ImageDraw.Draw(im)
    for e in eye:
        if e != (0, 0, 0, 0):
            d.point(e, fill=(250, 250, 250, 255))
            d.point((e[0] + 1, e[1]), fill=(10, 10, 20, 255))
    # the shadow under water: the same silhouette, dark and flat
    sa = np.asarray(im).copy()
    m = sa[..., 3] > 0
    sh = np.zeros_like(sa)
    sh[m] = (16, 30, 50, 200)
    return im, Image.fromarray(sh), shape


def sprites():
    data = json.load(open(os.path.join(APP, 'src', 'fishData.json')))
    lines = ['// Made by art/make_pixel_lakes.py: a pixel sprite (and its shadow) for every fish and item.',
             'export const FISH_PX: Record<number, { img: any; shadow: any; w: number; h: number }> = {']
    for f in (data['fish'] if isinstance(data['fish'], list) else data['fish'].values()):
        im, sh, shape = fish_sprite(f['name'], f['large'])
        upscale(im).save(os.path.join(PX, f"f{f['id']}.png"), optimize=True)
        upscale(sh).save(os.path.join(PX, f"f{f['id']}_s.png"), optimize=True)
        lines.append(f"  {f['id']}: {{ img: require('../../assets/px/f{f['id']}.png'), shadow: require('../../assets/px/f{f['id']}_s.png'), w: {im.width}, h: {im.height} }}, // {f['name']} ({shape})")
    lines.append('};')

    # the bobber (floating, half under), a reel, a ripple in 6 frames, a star, the moon, a bird in 2 frames
    def sprite(w, h, fn, name):
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        fn(ImageDraw.Draw(im), im)
        upscale(im).save(os.path.join(PX, name + '.png'), optimize=True)
        lines.append(f"export const PX_{name.upper()} = {{ img: require('../../assets/px/{name}.png'), w: {w}, h: {h} }};")

    def bobber(d, im):
        d.rectangle([2, 0, 2, 1], fill=(250, 250, 250))
        d.rectangle([1, 2, 3, 4], fill=(220, 50, 40)); d.point((1, 2), fill=(255, 160, 140))
        d.rectangle([0, 3, 4, 4], fill=(220, 50, 40))
        d.rectangle([0, 5, 4, 6], fill=(246, 246, 246)); d.rectangle([1, 7, 3, 7], fill=(246, 246, 246))
    sprite(5, 8, bobber, 'bobber')

    def reel(d, im):
        d.ellipse([0, 0, 7, 7], fill=(60, 64, 76)); d.ellipse([2, 2, 5, 5], fill=(150, 156, 170)); d.point((3, 3), fill=(40, 40, 50))
    sprite(8, 8, reel, 'reel')

    for k in range(6):
        rw = 6 + k * 6
        rh = max(2, rw // 3)

        def rip(d, im, rw=rw, rh=rh, k=k):
            d.ellipse([0, 0, rw - 1, rh - 1], outline=(255, 255, 255, 255 - k * 36))
        sprite(rw, rh, rip, f'ripple{k}')

    def star(d, im):
        d.line([(2, 0), (2, 4)], fill=(255, 240, 160)); d.line([(0, 2), (4, 2)], fill=(255, 240, 160)); d.point((2, 2), fill=(255, 255, 255))
    sprite(5, 5, star, 'star')

    def moon(d, im):
        d.ellipse([0, 0, 10, 10], fill=(244, 242, 220)); d.point((3, 4), fill=(210, 206, 180)); d.point((6, 6), fill=(210, 206, 180)); d.point((7, 3), fill=(220, 216, 190))
    sprite(11, 11, moon, 'moon')

    def bird0(d, im):
        d.line([(0, 0), (2, 2), (4, 0)], fill=(30, 34, 46))
    sprite(5, 3, bird0, 'bird0')

    def bird1(d, im):
        d.line([(0, 2), (2, 1), (4, 2)], fill=(30, 34, 46))
    sprite(5, 3, bird1, 'bird1')
    with open(os.path.join(APP, 'src', 'fishing', 'sprites.ts'), 'w') as fh:
        fh.write('\n'.join(lines) + '\n')
    print(len(data['fish']), 'fish sprites')


if __name__ == '__main__':
    lakes()
    sprites()
