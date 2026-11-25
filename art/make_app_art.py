"""The phone app's own art in the launcher's Aero look (a mid-2000s Frutiger Aero desktop).

Usage:  python art/make_app_art.py [KIT]
        KIT = a checkout of Hurami89/xi-forever-offline (default ../hurami89/xi-forever-offline next to this repo).
Uses the kit's art-src/scripts/aero_lib.py and aero_buttons.py (same drawing, same Selawik lettering, same art pieces),
and copies a few finished pictures from the kit's assets. Writes into assets/ of this repo. Needs Pillow + numpy."""
import math
import os
import random
import shutil
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
KIT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(APP, '..', 'hurami89', 'xi-forever-offline'))
sys.path.insert(0, os.path.join(KIT, 'art-src', 'scripts'))
os.environ.setdefault('XIFO_UI', os.path.join(KIT, 'assets', 'ui'))
import aero_lib as A          # noqa: E402
import aero_buttons as B      # noqa: E402

OUT = os.path.join(APP, 'assets')
ART = os.path.join(OUT, 'art')
os.makedirs(ART, exist_ok=True)


def save(img, name, folder=ART, quality=88):
    path = os.path.join(folder, name)
    if name.endswith('.jpg'):
        img.convert('RGB').save(path, quality=quality, optimize=True, progressive=True)
    else:
        img.save(path, optimize=True)
    print(name, img.size, os.path.getsize(path) // 1024, 'KB')


def scene(W, H, rng, horizon=1.0, figures=(), hills_at=0.82):
    img = A.to_img(A.sky(W, H, horizon=horizon, sun=(0.84, 0.12))).convert('RGBA')
    A.clouds(img, rng, 5, (0, -H * 0.02, W, H * 0.45), scale=W / 900, alpha=0.8)
    A.flare(img, W * 0.84, H * 0.12, W * 0.06, 0.9)
    A.ribbons(img, rng, 3, 0.55, 0.12, [(255, 255, 255), (200, 245, 255), (210, 255, 220)], alpha=0.35)
    A.bubbles(img, rng, 18, (0, H * 0.15, W, H * 0.8), W * 0.012, W * 0.05, alpha=0.85)
    A.hills(img, hills_at, H * 0.05, rng)
    for name, h, x, foot in figures:
        fig = A.fit_height(A.art(name), int(h))
        img.alpha_composite(A.glow_of(fig, (255, 255, 255), 7, 1.1), (int(x), int(foot - h)))
        img.alpha_composite(fig, (int(x), int(foot - h)))
    return img


def glass_xi(size, sub=False):
    return B.wordmark(size, size, sub=sub)


# ------------------------------------------------------------------ icons
def icons():
    rng = random.Random(11)
    N = 1024
    bg = scene(N, N, rng, horizon=1.05, hills_at=0.78)
    full = bg.copy()
    xi = glass_xi(int(N * 1.02), sub=True)
    full.alpha_composite(xi, ((N - xi.width) // 2, int(N * 0.06)))
    full.alpha_composite(A.gloss((N, N), int(N * 0.18), top_alpha=0.45, cut=0.46, bottom_alpha=0.25))
    save(full.convert('RGB'), 'icon.png', OUT)
    # Android adaptive icon: the background scene, the glass XI on its own (inside the middle 60%)
    save(bg.convert('RGB'), 'android-icon-background.png', OUT)
    fg = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    mark = glass_xi(int(N * 0.66), sub=False)
    fg.alpha_composite(mark, ((N - mark.width) // 2, (N - mark.height) // 2 + int(N * 0.04)))
    save(fg, 'android-icon-foreground.png', OUT)
    mono = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    a = fg.split()[3].point(lambda v: 255 if v > 90 else 0)
    mono.putalpha(a)
    save(mono, 'android-icon-monochrome.png', OUT)
    fav = full.resize((48, 48), Image.LANCZOS)
    save(fav, 'favicon.png', OUT)
    # splash: the logo tile, big
    tile = B.make_home(size=(884, 372), tile=True)
    save(tile, 'splash-icon.png', OUT)


# ------------------------------------------------------------------ wallpaper
def wallpaper():
    rng = random.Random(4)
    W, H = 1080, 2160
    img = scene(W, H, rng, horizon=1.0, hills_at=0.86, figures=[
        ('hume-f', 560, 40, H * 0.985), ('mini-mithra', 380, 330, H * 0.99), ('aldo', 520, 760, H * 0.985)])
    save(img, 'wallpaper.jpg', quality=84)


# ------------------------------------------------------------------ taskbar buttons with a figure (like the launcher's)
TABS = {
    'tab_chat': ('CHAT', ['ferena'], 'aqua'),
    'tab_wiki': ('WIKI', ['aldo'], 'sky'),
    'tab_news': ('NEWS', ['apu'], 'leaf'),
    'tab_fish': ('FISH', ['mini-mithra'], 'aqua'),
    'tab_me': ('ME', ['hume-f'], 'sky'),
    'tab_vent': ('VENTURE', ['apu-red'], 'leaf'),
}


def tabs():
    for key, val in TABS.items():
        B.BUTTONS[key] = val
        for hover in (False, True):
            img = B.make_button(key, size=(300, 132), hover=hover)
            save(img, key + ('_on' if hover else '') + '.png')


def start_orb():
    """The start orb: a green glass sphere with a crystal in it (the project's, not anyone's logo)."""
    S = 4
    r = 60 * S
    size = r * 2 + 16 * S
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / r
    col = A.ramp([(0, (140, 250, 150)), (0.7, (34, 160, 64)), (1, (10, 74, 30))], d)
    al = np.clip((1 - d) * r / 2, 0, 1) * 255
    orb = Image.fromarray(np.dstack([col, al]).astype(np.uint8), 'RGBA')
    dd = ImageDraw.Draw(orb)
    cx = cy = size / 2
    dd.polygon([(cx, cy - r * 0.62), (cx + r * 0.36, cy), (cx, cy + r * 0.62), (cx - r * 0.36, cy)], fill=(235, 255, 255, 240))
    dd.polygon([(cx, cy - r * 0.62), (cx + r * 0.36, cy), (cx, cy)], fill=(190, 240, 255, 255))
    dd.line([(cx, cy - r * 0.62), (cx, cy + r * 0.62)], fill=(110, 190, 225, 255), width=S * 2)
    A.bubble(orb, cx, cy, r, 0.9, tint=(230, 255, 240))
    out = Image.new('RGBA', (size + 24 * S, size + 24 * S), (0, 0, 0, 0))
    out.alpha_composite(A.glow_of(orb, (160, 255, 200), 8 * S, 1.0), (12 * S, 12 * S))
    out.alpha_composite(orb, (12 * S, 12 * S))
    save(out.resize((out.width // S * 3 // 2, out.height // S * 3 // 2), Image.LANCZOS), 'start_orb.png')


# ------------------------------------------------------------------ 88x31 buttons (drawn at 3x)
BADGES = {
    'b88_discord': ('DISCORD', 'storm', (150, 160, 255)),
    'b88_twitch': ('TWITCH', 'storm', (200, 150, 255)),
    'b88_github': ('GITHUB', 'storm', (230, 230, 230)),
    'b88_site': ('XIFOREVER.COM', 'sky', None),
    'b88_download': ('GET XIFO', 'leaf', None),
    'b88_hub': ('THE HUB', 'aqua', None),
}


def badges():
    for key, (text, scheme, tint) in BADGES.items():
        w, h = 88 * 3, 31 * 3
        W, H = w * B.S, h * B.S
        rng = B.seed_of(key)
        img = B.wallpaper(W, H, scheme, rng)
        if tint:
            lay = Image.new('RGBA', (W, H), tint + (70,))
            img.alpha_composite(lay)
            A.bubbles(img, rng, 6, (0, 0, W, H), H * 0.05, H * 0.14, alpha=0.6)
        lab = B.label(text, int(W * 0.86), H * 0.62, H * 0.5, scheme)
        img.alpha_composite(lab, ((W - lab.width) // 2, (H - lab.height) // 2))
        save(B.finish(img, w, h, scheme, 4), key + '.png')


# ------------------------------------------------------------------ buddy icons and emoticons
def glossy_disc(size, top, bottom, rim):
    S = 4
    N = size * S
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    d = np.sqrt((xx - N / 2) ** 2 + (yy - N / 2) ** 2) / (N / 2 - S * 2)
    col = A.ramp([(0, top), (1, bottom)], yy / N)
    al = np.clip((1 - d) * N / 6, 0, 1) * 255
    img = Image.fromarray(np.dstack([col, al]).astype(np.uint8), 'RGBA')
    ImageDraw.Draw(img).ellipse([S * 2, S * 2, N - S * 2, N - S * 2], outline=rim + (255,), width=S * 2)
    return img, S


def finish_disc(img, S, name):
    N = img.width
    hl = Image.new('L', (N, N), 0)
    ImageDraw.Draw(hl).ellipse([N * 0.18, N * 0.07, N * 0.82, N * 0.5], fill=150)
    hl = hl.filter(ImageFilter.GaussianBlur(N * 0.04))
    lay = Image.new('RGBA', (N, N), (255, 255, 255, 0))
    lay.putalpha(ImageChops.multiply(hl, img.split()[3]))
    img.alpha_composite(lay)
    save(img.resize((N // S, N // S), Image.LANCZOS), name)


def buddies():
    # in game: a crystal on blue glass; website: a globe; phone: a handset
    img, S = glossy_disc(96, (150, 210, 255), (20, 90, 190), (10, 50, 120))
    N = img.width
    d = ImageDraw.Draw(img)
    cx, cy, r = N / 2, N / 2, N * 0.34
    d.polygon([(cx, cy - r), (cx + r * 0.55, cy), (cx, cy + r), (cx - r * 0.55, cy)], fill=(235, 255, 255, 255), outline=(40, 120, 200, 255))
    d.polygon([(cx, cy - r), (cx + r * 0.55, cy), (cx, cy)], fill=(180, 235, 255, 255))
    finish_disc(img, S, 'buddy_game.png')
    img, S = glossy_disc(96, (150, 235, 160), (24, 130, 60), (10, 80, 30))
    d = ImageDraw.Draw(img)
    r = N * 0.3
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 255), width=S * 3)
    d.ellipse([cx - r * 0.45, cy - r, cx + r * 0.45, cy + r], outline=(255, 255, 255, 255), width=S * 3)
    d.line([(cx - r, cy), (cx + r, cy)], fill=(255, 255, 255, 255), width=S * 3)
    finish_disc(img, S, 'buddy_web.png')
    img, S = glossy_disc(96, (255, 210, 120), (220, 110, 20), (130, 60, 10))
    d = ImageDraw.Draw(img)
    pw, ph = N * 0.3, N * 0.52
    d.rounded_rectangle([cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2], radius=S * 8, fill=(255, 255, 255, 255))
    d.rectangle([cx - pw / 2 + S * 6, cy - ph / 2 + S * 10, cx + pw / 2 - S * 6, cy + ph / 2 - S * 16], fill=(80, 160, 230, 255))
    d.ellipse([cx - S * 4, cy + ph / 2 - S * 12, cx + S * 4, cy + ph / 2 - S * 4], fill=(150, 150, 150, 255))
    finish_disc(img, S, 'buddy_phone.png')


def small_icons():
    """Taskbar icons for the Vana'diel look: a fish and a person on glossy discs."""
    img, S = glossy_disc(64, (140, 200, 255), (30, 90, 190), (10, 50, 120))
    N = img.width
    d = ImageDraw.Draw(img)
    cx = cy = N / 2
    d.ellipse([cx - N * 0.27, cy - N * 0.13, cx + N * 0.17, cy + N * 0.13], fill=(255, 255, 255, 255))
    d.polygon([(cx + N * 0.12, cy), (cx + N * 0.32, cy - N * 0.15), (cx + N * 0.32, cy + N * 0.15)], fill=(255, 255, 255, 255))
    d.ellipse([cx - N * 0.18, cy - N * 0.05, cx - N * 0.11, cy + N * 0.02], fill=(30, 90, 190, 255))
    finish_disc(img, S, 'icon_fish.png')
    img, S = glossy_disc(64, (255, 230, 150), (200, 150, 40), (120, 80, 10))
    d = ImageDraw.Draw(img)
    d.ellipse([cx - N * 0.13, cy - N * 0.3, cx + N * 0.13, cy - N * 0.04], fill=(255, 255, 255, 255))
    d.chord([cx - N * 0.27, cy + N * 0.0, cx + N * 0.27, cy + N * 0.5], 180, 360, fill=(255, 255, 255, 255))
    finish_disc(img, S, 'icon_me.png')
    img, S = glossy_disc(64, (170, 240, 150), (40, 140, 60), (20, 80, 30))       # Ventures: a sword and a pennant
    d = ImageDraw.Draw(img)
    d.line([(cx - N * 0.22, cy + N * 0.26), (cx + N * 0.2, cy - N * 0.28)], fill=(255, 255, 255, 255), width=S * 5)
    d.line([(cx - N * 0.27, cy + N * 0.12), (cx - N * 0.08, cy + N * 0.3)], fill=(255, 255, 255, 255), width=S * 5)
    d.polygon([(cx + N * 0.02, cy - N * 0.3), (cx + N * 0.3, cy - N * 0.2), (cx + N * 0.02, cy - N * 0.1)], fill=(255, 230, 120, 255))
    finish_disc(img, S, 'icon_vent.png')


def fish_sprites():
    """Sprites for the fishing scene: a fish (side view), its shadow under the water, and a sparkle for item catches."""
    S = 4
    W, H = 160 * S, 80 * S

    def fish_shape(d, fill, eye=None, fin=None):
        d.ellipse([W * 0.12, H * 0.18, W * 0.80, H * 0.82], fill=fill)
        d.polygon([(W * 0.74, H * 0.5), (W * 0.98, H * 0.12), (W * 0.92, H * 0.5), (W * 0.98, H * 0.88)], fill=fill)
        if fin:
            d.polygon([(W * 0.38, H * 0.22), (W * 0.55, H * 0.02), (W * 0.62, H * 0.24)], fill=fin)
            d.polygon([(W * 0.42, H * 0.70), (W * 0.52, H * 0.95), (W * 0.60, H * 0.72)], fill=fin)
        if eye:
            d.ellipse([W * 0.20, H * 0.36, W * 0.28, H * 0.48], fill=(255, 255, 255, 255))
            d.ellipse([W * 0.215, H * 0.385, W * 0.26, H * 0.46], fill=eye)

    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    body = A.to_img(A.ramp([(0, (150, 215, 255)), (0.5, (60, 140, 220)), (1, (230, 240, 250))], yy / H)).convert('RGBA')
    mask = Image.new('L', (W, H), 0)
    fish_shape(ImageDraw.Draw(mask), 255)
    body.putalpha(mask)
    img.alpha_composite(body)
    d = ImageDraw.Draw(img)
    fish_shape(d, None, eye=(20, 30, 60, 255), fin=(40, 110, 200, 255))
    for i in range(5):                                         # scales
        x = W * (0.35 + i * 0.08)
        d.arc([x - W * 0.05, H * 0.30, x + W * 0.05, H * 0.62], 300, 60, fill=(255, 255, 255, 120), width=S * 2)
    hl = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    ImageDraw.Draw(hl).ellipse([W * 0.2, H * 0.22, W * 0.6, H * 0.42], fill=(255, 255, 255, 110))
    img.alpha_composite(hl.filter(ImageFilter.GaussianBlur(S * 3)))
    save(img.resize((W // S, H // S), Image.LANCZOS), 'fish_sprite.png')
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fish_shape(ImageDraw.Draw(sh), (4, 20, 50, 150))
    save(sh.filter(ImageFilter.GaussianBlur(S * 3)).resize((W // S, H // S), Image.LANCZOS), 'fish_shadow.png')
    N = 96 * S
    sp = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(sp)
    c = N / 2
    for ang, ln in ((0, 0.48), (90, 0.48), (45, 0.3), (135, 0.3)):
        import math as _m
        dx, dy = _m.cos(_m.radians(ang)) * N * ln, _m.sin(_m.radians(ang)) * N * ln
        d.polygon([(c - dx, c - dy), (c + dy * 0.12, c - dx * 0.12), (c + dx, c + dy), (c - dy * 0.12, c + dx * 0.12)], fill=(255, 240, 170, 255))
    sp.alpha_composite(A.glow_of(sp, (255, 220, 120), S * 6, 1.2))
    save(sp.resize((96, 96), Image.LANCZOS), 'sparkle.png')


def emoticons():
    faces = {'smile': ':)', 'sad': ':(', 'grin': ':D', 'wink': ';)', 'tongue': ':P', 'happy': '^^', 'wow': ':O', 'cool': 'B)'}
    for key in faces:
        img, S = glossy_disc(48, (255, 240, 120), (240, 170, 10), (150, 90, 0))
        N = img.width
        d = ImageDraw.Draw(img)
        ink = (70, 40, 0, 255)
        ey = N * 0.4
        w = S * 3
        if key == 'happy':
            for ex in (N * 0.34, N * 0.66):
                d.arc([ex - N * 0.08, ey - N * 0.06, ex + N * 0.08, ey + N * 0.08], 200, 340, fill=ink, width=w)
        elif key == 'cool':
            d.rounded_rectangle([N * 0.2, ey - N * 0.08, N * 0.48, ey + N * 0.07], radius=S * 3, fill=(20, 20, 30, 255))
            d.rounded_rectangle([N * 0.52, ey - N * 0.08, N * 0.8, ey + N * 0.07], radius=S * 3, fill=(20, 20, 30, 255))
            d.line([(N * 0.46, ey - N * 0.04), (N * 0.54, ey - N * 0.04)], fill=(20, 20, 30, 255), width=w)
        else:
            for i, ex in enumerate((N * 0.36, N * 0.64)):
                if key == 'wink' and i == 1:
                    d.line([(ex - N * 0.06, ey), (ex + N * 0.06, ey)], fill=ink, width=w)
                else:
                    d.ellipse([ex - N * 0.045, ey - N * 0.08, ex + N * 0.045, ey + N * 0.06], fill=ink)
        my = N * 0.62
        box = [N * 0.28, my - N * 0.12, N * 0.72, my + N * 0.14]
        if key in ('smile', 'wink', 'happy', 'cool'):
            d.arc(box, 20, 160, fill=ink, width=w)
        elif key == 'sad':
            d.arc([N * 0.3, my + N * 0.02, N * 0.7, my + N * 0.3], 200, 340, fill=ink, width=w)
        elif key == 'grin':
            d.chord(box, 0, 180, fill=ink)
            d.chord([N * 0.33, my - N * 0.02, N * 0.67, my + N * 0.06], 0, 180, fill=(255, 255, 255, 255))
        elif key == 'tongue':
            d.line([(N * 0.32, my + N * 0.02), (N * 0.68, my + N * 0.02)], fill=ink, width=w)
            d.chord([N * 0.44, my - N * 0.06, N * 0.62, my + N * 0.16], 0, 180, fill=(230, 60, 80, 255))
        elif key == 'wow':
            d.ellipse([N * 0.42, my - N * 0.06, N * 0.58, my + N * 0.12], fill=ink)
        finish_disc(img, S, 'emo_' + key + '.png')


# ------------------------------------------------------------------ copies of finished art from the kit
def copies():
    press = os.path.join(KIT, 'assets', 'press')
    for i, name in enumerate(['aero_01_hills', 'aero_02_desktop', 'aero_03_dive', 'aero_04_royal', 'aero_05_install'], 1):
        im = Image.open(os.path.join(press, name + '__theme-aero.jpg'))
        save(im.resize((1000, 400), Image.LANCZOS), f'banner_{i}.jpg', quality=84)
    im = Image.open(os.path.join(KIT, 'assets', 'worlds', 'hub_banner.jpg'))
    save(im.resize((800, 200), Image.LANCZOS), 'hub_banner.jpg', quality=86)
    for mode in ('iron', 'steel', 'silver', 'random'):
        im = Image.open(os.path.join(KIT, 'assets', 'ui', f'hc_icon_{mode}.png')).convert('RGBA')
        save(im.resize((96, 96), Image.LANCZOS), f'hc_{mode}.png')
        im = Image.open(os.path.join(press, 'aero-ui', f'hc_card_{mode}.png')).convert('RGBA')
        save(im, f'hc_card_{mode}.png')
    save(Image.open(os.path.join(press, 'aero-ui', 'logo_tile.png')).convert('RGBA'), 'logo_tile.png')
    cb = os.path.join(KIT, 'assets', 'crystalboy', 'crystalboy.png')
    if os.path.exists(cb):
        im = Image.open(cb).convert('RGBA')
        im.thumbnail((360, 360))
        save(im, 'crystalboy.png')
    for f in ('selawk.ttf', 'selawksb.ttf', 'selawkb.ttf', 'OFL-selawik.txt'):
        os.makedirs(os.path.join(OUT, 'fonts'), exist_ok=True)
        shutil.copy(os.path.join(KIT, 'art-src', 'fonts', f), os.path.join(OUT, 'fonts', f))


def vanadiel():
    """The Vana'diel 2006 theme: the memorial book's map of Vana'diel as wallpaper (the part under the title, dimmed
    navy), the launcher's classic parchment banners and wordmark, an XP-style start button."""
    src = os.path.join(KIT, 'art-src', 'final-fantasy-11-10th-anniversary-official-memorial-book-a-decade-of-vanadiel.jpg')
    im = Image.open(src).convert('RGB')
    w, h = im.size
    crop = im.crop((0, int(h * 0.535), w, h))
    W, H = 1080, 2160
    scale = max(W / crop.width, H / crop.height)
    crop = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS)
    x0 = (crop.width - W) // 2
    crop = crop.crop((x0, 0, x0 + W, H)).filter(ImageFilter.GaussianBlur(1.2))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    vign = np.clip(((xx / W - 0.5) ** 2 + (yy / H - 0.45) ** 2) * 1.6, 0, 1)
    arr = np.asarray(crop, dtype=np.float32)
    navy = np.array([10, 16, 44], dtype=np.float32)
    k = (0.50 + 0.35 * vign)[..., None]
    out = arr * (1 - k) + navy * k
    save(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), 'v_wallpaper.jpg', quality=82)
    press = os.path.join(KIT, 'assets', 'press')
    for i, name in enumerate(['1_adventurers', '4_races', '11_adventurers_2', '5_shantotto', '3_vanadiel_map'], 1):
        b = Image.open(os.path.join(press, name + '__center.png')).convert('RGB')
        save(b.resize((1000, 400), Image.LANCZOS), f'v_banner_{i}.jpg', quality=85)
    save(Image.open(os.path.join(KIT, 'assets', 'ui', 'logo_tile.png')).convert('RGBA'), 'v_logo_tile.png')


def faces():
    """The game's face portraits (the kit's assets/faces, the same ones the launcher shows), small, and src/faces.ts."""
    src = os.path.join(KIT, 'assets', 'faces')
    os.makedirs(os.path.join(OUT, 'faces'), exist_ok=True)
    pre = {1: 'Hm', 2: 'Hf', 3: 'Em', 4: 'Ef', 5: 'Tm', 6: 'Tf', 7: 'M', 8: 'G'}
    lines = ["// Generated by art/make_app_art.py (faces): the game's face portraits, race id -> face 0..15.",
             '/* eslint-disable */', 'export const FACES: Record<number, any[]> = {']
    for race, p in pre.items():
        items = []
        for face in range(16):
            fn = f"{p}{face // 2 + 1}{'ab'[face % 2]}.jpg"
            Image.open(os.path.join(src, fn)).convert('RGB').resize((160, 149), Image.LANCZOS).save(
                os.path.join(OUT, 'faces', fn), quality=82, optimize=True)
            items.append(f"require('../assets/faces/{fn}')")
        lines.append(f"  {race}: [{', '.join(items)}],")
    lines += ['};', 'export const faceOf = (race: number, face: number) => (FACES[race] || FACES[1])[Math.max(0, Math.min(15, face || 0))];']
    with open(os.path.join(APP, 'src', 'faces.ts'), 'w') as fh:
        fh.write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    faces()
    vanadiel()
    copies()
    icons()
    wallpaper()
    tabs()
    start_orb()
    badges()
    buddies()
    emoticons()
    small_icons()
    fish_sprites()
