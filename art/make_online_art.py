"""The Online 2003 look (the app's default since 2026-11-25): a dark wallpaper and five banners from the art packs.

Usage:  python art/make_online_art.py [KIT]      (KIT = C:\\FFXISOLO, for art-src\\newart)
Writes assets/art/o_wallpaper.jpg (1080 x 2160) and o_banner_1..5.jpg (1000 x 400): game screenshots from the art
packs, darkened and cooled to a night-blue, with a soft vignette and faint scanlines, the way a 2003 online service
dimmed its pictures behind dark chrome.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
KIT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(APP, '..', 'FFXISOLO')
SRC = os.path.join(KIT, 'art-src', 'newart')
OUT = os.path.join(APP, 'assets', 'art')
WALL = '04a_2.jpg'
BANNERS = ['02b.jpg', '03_11.jpg', '05d_2.jpg', '07_07.jpg', '01d.jpg']


def cover(img, w, h, focus=0.5):
    s = max(w / img.width, h / img.height)
    img = img.resize((int(img.width * s + 0.5), int(img.height * s + 0.5)), Image.LANCZOS)
    x = int((img.width - w) * focus)
    y = (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def night(img, dark=0.5, vignette=0.55, lines=True):
    a = np.asarray(img.convert('RGB'), np.float32) / 255
    grey = a.mean(axis=2, keepdims=True)
    a = a * 0.6 + grey * 0.4                                         # less saturated
    a = a * np.array([0.82, 0.9, 1.15]) * dark                       # night blue, darker
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    a *= (1 - vignette * np.clip(d - 0.35, 0, 1))[..., None]
    if lines:
        a[::3] *= 0.86                                               # faint scanlines
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def main():
    wall = cover(Image.open(os.path.join(SRC, WALL)), 1080, 2160, 0.42)
    night(wall.filter(ImageFilter.GaussianBlur(1.2)), 0.42, 0.7).save(os.path.join(OUT, 'o_wallpaper.jpg'), quality=84, optimize=True, progressive=True)
    for i, name in enumerate(BANNERS, 1):
        b = cover(Image.open(os.path.join(SRC, name)), 1000, 400)
        night(b, 0.72, 0.45).save(os.path.join(OUT, f'o_banner_{i}.jpg'), quality=86, optimize=True, progressive=True)
    print('online look: wallpaper + 5 banners')


if __name__ == '__main__':
    main()
