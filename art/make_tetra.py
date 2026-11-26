"""Tetra Master's art and sounds for the app (2026-11-25), from the kit's Tetra Master add-on (Nalfey's work, used with his
permission: art credit). Cuts the sprite sheet into its pieces (the same rectangles as the add-on, from Nalfey's init.lua),
doubles every picture pixel for pixel so the phone scales them down instead of blurring them up, and writes
src/tetra/art.ts (the app needs a require() for each file).

  python art/make_tetra.py C:\\FFXISOLO\\tetramaster
"""
import os
import shutil
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "assets", "tetra")
K = 2

PIECES = {
    "background": (10, 498, 320, 240), "grid": (340, 498, 224, 240),
    "back_blue": (18, 822, 42, 51), "back_red": (66, 822, 42, 51), "block1": (114, 822, 42, 51), "block2": (162, 822, 42, 51),
    "cardback": (210, 822, 42, 51), "divider": (202, 759, 43, 23),
}
ARROWS = {"upleft": (202, 790), "up": (210, 790), "upright": (218, 790), "downleft": (226, 790), "down": (234, 790),
          "downright": (242, 790), "left": (202, 798), "right": (210, 798)}
SCORE = [(154, 762, 16, 20), (11, 764, 13, 19), (26, 763, 16, 21), (42, 763, 16, 22), (58, 764, 17, 21), (75, 763, 15, 21),
         (90, 762, 16, 21), (106, 763, 16, 20), (122, 762, 16, 22), (138, 762, 16, 22), (171, 762, 27, 20)]
GLYPHS = "0123456789ABCDEFPMX"
SOUNDS = ["mus_quadmist", "snd_card_battle", "snd_choose_card", "snd_coin", "snd_combo_woosh", "snd_cursor", "snd_error",
          "snd_flip_card", "snd_lose_card", "snd_lose_game", "snd_perfect_game", "snd_put", "snd_tie_game", "snd_win_card",
          "snd_win_game"]


def big(im, k=K):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def save(im, *parts):
    path = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)
    return "/".join(parts)


def main(src):
    sprites = os.path.join(src, "assets", "sprites")
    sheet = Image.open(os.path.join(sprites, "graphics.png")).convert("RGBA")
    crop = lambda x, y, w, h: sheet.crop((x, y, x + w, y + h))
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    files = {}
    for name, r in PIECES.items():
        files[name] = save(big(crop(*r)) if name not in ("background",) else crop(*r).resize((640, 480), Image.NEAREST), name + ".png")
    for name, (x, y) in ARROWS.items():
        files["arrow_" + name] = save(big(crop(x, y, 8, 8), 3), "arrow_" + name + ".png")
    for i, (x, y, w, h) in enumerate(SCORE):
        files[f"blue_{i}"] = save(big(crop(x, y, w, h)), f"blue_{i}.png")
        files[f"red_{i}"] = save(big(crop(x, y + 34, w, h)), f"red_{i}.png")
    for i, ch in enumerate(GLYPHS):
        files["g_" + ch] = save(big(crop(356 + i * 8, 822, 7, 7), 3), f"g_{ch}.png")
    for cid in range(1, 251):
        im = Image.open(os.path.join(sprites, "Cards", f"{cid:03d}.png")).convert("RGBA")
        files[f"c{cid}"] = save(big(im), "cards", f"{cid:03d}.png")
    for kind, folder, stem in (("coin", "Coin", "coin"), ("boom", "Explosion", "explosion")):
        for i in range(1, 9):
            files[f"{kind}{i}"] = save(big(Image.open(os.path.join(sprites, folder, f"{stem}_{i:02d}.png")).convert("RGBA")), f"{kind}_{i}.png")
    people = []
    for fn in sorted(os.listdir(os.path.join(sprites, "Characters"))):
        if fn[:2].isdigit():
            stem = os.path.splitext(fn)[0]
            files["p_" + stem[:2]] = save(big(Image.open(os.path.join(sprites, "Characters", fn)).convert("RGBA"), 3), "people", fn)
            people.append(stem[3:].replace("_", " "))
    for s in SOUNDS:
        os.makedirs(os.path.join(OUT, "snd"), exist_ok=True)
        shutil.copyfile(os.path.join(src, "assets", "sound", s + ".mp3"), os.path.join(OUT, "snd", s + ".mp3"))
    shutil.copyfile(os.path.join(src, "assets", "fonts", "Cinzel-Bold.ttf"), os.path.join(OUT, "Cinzel-Bold.ttf"))

    req = lambda rel: f"require('../../assets/tetra/{rel}')"
    lines = ["// Made by art/make_tetra.py from the kit's Tetra Master add-on (art and sounds: Nalfey, used with his permission).",
             "// Do not edit by hand.", "/* eslint-disable */", "export const TM = {"]
    for name in list(PIECES) + ["divider"]:
        if name in PIECES and f"  {name}:" not in "\n".join(lines):
            lines.append(f"  {name}: {req(files[name])},")
    lines.append("  arrow: {" + ", ".join(f"{n}: {req(files['arrow_' + n])}" for n in ARROWS) + "} as Record<string, any>,")
    lines.append("  blue: [" + ", ".join(req(files[f'blue_{i}']) for i in range(11)) + "],")
    lines.append("  red: [" + ", ".join(req(files[f'red_{i}']) for i in range(11)) + "],")
    lines.append("  glyph: {" + ", ".join(f"'{ch}': {req(files['g_' + ch])}" for ch in GLYPHS) + "} as Record<string, any>,")
    lines.append("  coin: [" + ", ".join(req(files[f'coin{i}']) for i in range(1, 9)) + "],")
    lines.append("  boom: [" + ", ".join(req(files[f'boom{i}']) for i in range(1, 9)) + "],")
    lines.append("  people: [" + ", ".join(req(files['p_' + f'{i + 1:02d}']) for i in range(len(people))) + "],")
    lines.append("  card: [null, " + ", ".join(req(files[f'c{cid}']) for cid in range(1, 251)) + "],")
    # (the sounds are in src/sfx.ts, the font in App.tsx)
    lines.append("};")
    lines.append("export const PEOPLE = " + repr(people).replace("'", '"') + ";")
    with open(os.path.join(APP, "src", "tetra", "art.ts"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print(f"{len(files)} pictures, {len(SOUNDS)} sounds, {size // 1024} KB -> assets/tetra")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else r"C:\FFXISOLO\tetramaster")
