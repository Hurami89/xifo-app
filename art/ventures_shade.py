"""The 16-bit pass (SNES RPG look) for the Ventures sprites: flat shapes in, shaded sprites out.

  - light from the top-left: the first pixel of each colour area toward the light is lit, the last toward the shade
    is darker, and big areas get a soft second shadow step (3-4 tones per material, like the old 16-bit sprites);
  - outlines in a deep shade of the colour next to them (a coloured outline, not flat black), darkest at the feet;
  - a single bright specular dot on metal and on round shapes' lit corner.
Works on any RGBA sprite drawn with flat colours (ventures_chars.py, ventures_mobs.py, a sprite pack).
"""
from PIL import Image

OUTLINE_K = 0.3


def _same(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) < 24


def _k(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3])


def _warm(c, k):
    """Lighten toward a warm white (lit) or darken toward a cool purple (shade), the 16-bit palettes' habit."""
    if k >= 1:
        t = min(1.0, k - 1)
        return tuple(min(255, int(v + (w - v) * t)) for v, w in zip(c[:3], (255, 246, 214)))
    t = 1 - k
    return tuple(max(0, int(v * (1 - t) + s * t)) for v, s in zip(c[:3], (34, 22, 58)))


def strip_outline(im):
    """Drops the flat drawings' black outline (the 16-bit pass draws its own)."""
    im = im.convert("RGBA").copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][:3] == (24, 18, 26):
                px[x, y] = (0, 0, 0, 0)
    return im


def snes(im):
    """The look used in the app: shaded at the sprite's own size (three tones per colour) with a crisp dark ink line."""
    return shade16(strip_outline(im), ink=(30, 20, 34, 255))


def hires(im):
    """The 16-bit look: the flat drawing at double size, then shaded and outlined at that size (finer edges)."""
    flat = strip_outline(im)
    return shade16(flat.resize((flat.width * 2, flat.height * 2), Image.NEAREST))


def shade16(im, outline=True, ink=None):
    im = im.convert("RGBA")
    w, h = im.size
    src = im.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()
    flat = [[src[x, y] for x in range(w)] for y in range(h)]

    # the size of each flat colour area: tiny details (an eye, a blush, a buckle) keep their exact colour
    size = [[0] * w for _ in range(h)]
    seen = [[False] * w for _ in range(h)]
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0] or not flat[y0][x0][3]:
                continue
            stack, cells, c0 = [(x0, y0)], [], flat[y0][x0]
            seen[y0][x0] = True
            while stack:
                x, y = stack.pop()
                cells.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and flat[ny][nx][3] and flat[ny][nx][:3] == c0[:3]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            for x, y in cells:
                size[y][x] = len(cells)

    def solid(x, y):
        return 0 <= x < w and 0 <= y < h and flat[y][x][3] > 0 and flat[y][x][:3] != (24, 18, 26)

    for y in range(h):
        for x in range(w):
            c = flat[y][x]
            if not c[3]:
                continue
            if c[:3] == (24, 18, 26):                     # the old black outline: recoloured below
                continue
            up = solid(x, y - 1) and _same(flat[y - 1][x], c)
            left = solid(x - 1, y) and _same(flat[y][x - 1], c)
            down = solid(x, y + 1) and _same(flat[y + 1][x], c)
            right = solid(x + 1, y) and _same(flat[y][x + 1], c)
            down2 = solid(x, y + 2) and _same(flat[y + 2][x], c)
            right2 = solid(x + 2, y) and _same(flat[y][x + 2], c)
            col = c[:3]
            if size[y][x] < 7:
                pass
            elif not up or not left:
                col = _warm(c, 1.22 if (not up and not left) else 1.12)
            elif not down or not right:
                col = _warm(c, 0.74)
            elif not down2 or not right2:
                col = _warm(c, 0.88)
            dst[x, y] = col + (c[3],)
    # specular dots: the top-left-most pixel of each bright metal-ish area
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = flat[y][x]
            if c[3] and min(c[:3]) > 170 and max(c[:3]) - min(c[:3]) < 40:
                if not solid(x - 1, y - 1) and not solid(x, y - 1) and solid(x + 1, y + 1):
                    dst[x, y] = (255, 255, 250, 255)
    if outline:
        for y in range(h):
            for x in range(w):
                if dst[x, y][3]:
                    continue
                near = None
                for dx, dy in ((0, 1), (-1, 0), (1, 0), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and flat[ny][nx][3] and flat[ny][nx][:3] != (24, 18, 26):
                        near = flat[ny][nx]
                        break
                if near is not None and ink is not None:
                    dst[x, y] = ink
                elif near is not None:
                    k = OUTLINE_K * (0.7 if (y + 1 < h and dst[x, y + 1][3] == 0 and y > h * 0.75) else 1.0)
                    base = _warm(near, 0.0 + 1e-9)
                    col = tuple(int(b * (1 - k) + n * k * 0.55) for b, n in zip(base, near[:3]))
                    dst[x, y] = col + (255,)
    return out
