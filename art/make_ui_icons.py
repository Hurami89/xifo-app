"""The app's small one-colour icons (2026-11-26): assets/ui/<name>.png, white on clear, 96 x 96.

    python art/make_ui_icons.py

The app tints them with the look's colours (src/ui.tsx, Icon). Each is drawn here on a 24 x 24 grid, four times
oversized and scaled down, so the edges are smooth. Needs Pillow.
"""
import math
import os

from PIL import Image, ImageChops, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'ui')
SIZE, OVER = 96, 4
K = SIZE * OVER / 24.0                      # canvas pixels for one grid unit


def canvas():
    return Image.new('L', (SIZE * OVER, SIZE * OVER), 0)


def P(pts):
    return [(x * K, y * K) for x, y in pts]


def poly(im, pts, fill=255):
    ImageDraw.Draw(im).polygon(P(pts), fill=fill)


def dot(im, x, y, r, fill=255):
    ImageDraw.Draw(im).ellipse([(x - r) * K, (y - r) * K, (x + r) * K, (y + r) * K], fill=fill)


def line(im, pts, w, fill=255):
    """A stroke with round ends and joints."""
    d = ImageDraw.Draw(im)
    d.line(P(pts), fill=fill, width=int(round(w * K)), joint='curve')
    for x, y in pts:
        dot(im, x, y, w / 2.0, fill)


def box(im, x0, y0, x1, y1, r, fill=255):
    ImageDraw.Draw(im).rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K], radius=r * K, fill=fill)


def arc(im, cx, cy, r, a0, a1, w):
    """A round-ended arc, angles in degrees, 0 = to the right, clockwise."""
    pts = [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in range(a0, a1 + 1, 4)]
    line(im, pts, w)


def home():
    im = canvas()
    poly(im, [(12, 2.6), (1.8, 11.6), (4.4, 11.6), (4.4, 20.6), (19.6, 20.6), (19.6, 11.6), (22.2, 11.6)])
    box(im, 10, 14, 14, 21, 0.6, fill=0)                       # the door
    return im


def chat():
    im = canvas()
    box(im, 2.6, 3.6, 21.4, 16.6, 3.4)
    poly(im, [(6.6, 15.6), (6.6, 21.4), (12.6, 16.2)])
    for x in (7.8, 12, 16.2):
        dot(im, x, 10.1, 1.25, fill=0)
    return im


def play():
    """Crossed swords."""
    out = canvas()
    for turn in (45, -45):
        im = canvas()
        poly(im, [(12, 0.8), (13.5, 3.4), (13.5, 15.2), (10.5, 15.2), (10.5, 3.4)])     # the blade
        box(im, 7.2, 15.0, 16.8, 16.9, 0.9)                                             # the guard
        box(im, 11.0, 16.6, 13.0, 21.0, 0.6)                                            # the grip
        dot(im, 12, 21.9, 1.5)                                                          # the pommel
        out = ImageChops.lighter(out, im.rotate(turn, resample=Image.BICUBIC, center=(12 * K, 12 * K)))
    return out


def book():
    im = canvas()
    poly(im, [(2.4, 4.6), (11.1, 6.2), (11.1, 20.8), (2.4, 19.2)])
    poly(im, [(21.6, 4.6), (12.9, 6.2), (12.9, 20.8), (21.6, 19.2)])
    for y in (9.2, 12.2, 15.2):                                 # lines of writing
        line(im, [(4.6, y - 0.75), (9.1, y)], 0.9, fill=0)
        line(im, [(19.4, y - 0.75), (14.9, y)], 0.9, fill=0)
    return im


def person():
    im = canvas()
    dot(im, 12, 7.6, 4.4)
    body = canvas()
    ImageDraw.Draw(body).ellipse([3.6 * K, 13.4 * K, 20.4 * K, 30 * K], fill=255)
    ImageDraw.Draw(body).rectangle([0, 21.4 * K, 24 * K, 24 * K], fill=0)
    return ImageChops.lighter(im, body)


def gear():
    im = canvas()
    for k in range(8):
        tooth = canvas()
        box(tooth, 10.2, 1.4, 13.8, 6.4, 0.8)
        im = ImageChops.lighter(im, tooth.rotate(k * 45, resample=Image.BICUBIC, center=(12 * K, 12 * K)))
    dot(im, 12, 12, 7.6)
    dot(im, 12, 12, 3.2, fill=0)
    return im


def speaker(on=True):
    im = canvas()
    poly(im, [(2.6, 9), (6.8, 9), (12.2, 4.2), (12.2, 19.8), (6.8, 15), (2.6, 15)])
    if on:
        arc(im, 12.6, 12, 4.4, -44, 44, 2.0)
        arc(im, 12.6, 12, 8.2, -44, 44, 2.0)
    else:
        line(im, [(15.6, 9), (21.4, 15)], 2.0)
        line(im, [(21.4, 9), (15.6, 15)], 2.0)
    return im


def back():
    im = canvas()
    line(im, [(14.8, 4.8), (7.6, 12), (14.8, 19.2)], 2.6)
    return im


def close():
    im = canvas()
    line(im, [(5.6, 5.6), (18.4, 18.4)], 2.6)
    line(im, [(18.4, 5.6), (5.6, 18.4)], 2.6)
    return im


def check():
    im = canvas()
    line(im, [(4.4, 12.6), (9.6, 17.8), (19.8, 6.4)], 2.8)
    return im


ICONS = {'home': home, 'chat': chat, 'play': play, 'book': book, 'person': person, 'gear': gear,
         'sound': lambda: speaker(True), 'mute': lambda: speaker(False), 'back': back, 'close': close, 'check': check}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, draw in ICONS.items():
        a = draw().resize((SIZE, SIZE), Image.LANCZOS)
        im = Image.merge('RGBA', (Image.new('L', a.size, 255),) * 3 + (a,))
        im.save(os.path.join(OUT, name + '.png'), optimize=True)
    print('%d icons in %s' % (len(ICONS), OUT))


if __name__ == '__main__':
    main()
