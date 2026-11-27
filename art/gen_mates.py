"""Squad mates from generated sprite sheets (2026-11-26): cuts art/gen/<job>.png into the app's Ventures mates.

One sheet per job, made with an image tool (art/gen/PROMPT.md says how): 8 rows, one person a row, in the game's
race order (1 Hume m, 2 Hume f, 3 Elvaan m, 4 Elvaan f, 5 Tarutaru m, 6 Tarutaru f, 7 Mithra, 8 Galka), 12 frames a row,
everybody facing right on a transparent background: 3 idle, 3 walking, 3 attacking, 2 of the job's ability, 1 hit.
A sheet is found by the job's name in its file name ("Warrior Race Sprite Sheet-1.png", "monk.png", "WHM.png"). The
raw sheets are about 3 MB each and are not in the repository (.gitignore); what this script makes of them is.

    python art/gen_mates.py [JOB ...] [--preview DIR]     (no job = every sheet in art/gen; DIR gets strips and GIFs)

Writes assets/ventures/gm/<JOB>_<1..8>.png, a file for each race look: its 12 frames of FW x FH, GRID[0] a row, at ZOOM
times their size (like the app's other pixel art: the phone scales pictures smoothly, and a 1x file would come out
blurred; a file per look also means that only the looks on the screen are loaded). In a frame the figure stands on
y = FOOT with its middle at x = CX, and a Hume is TALL pixels tall. Also writes src/ventures/gen_art.ts (the jobs that
have a sheet). A job without a sheet keeps Kaza's art (art/kaza_mates.py); src/ventures/Stage.tsx picks.

What it does to a sheet, which is soft "fake pixel" art at about twice the size:
  1. finds the figures by transparency and sorts them into rows by their feet lines; pets and loose pieces (a "!",
     sparks, notes, dice) go to the figure they touch or stand in front of;
  2. two frames that touch are pulled apart (split_pair), a row with too many pieces gets its smallest ones merged;
  3. scales each row so that its standing figure is TALL pixels tall (the tool draws the races and the jobs at
     different sizes; TALLER lets a job with tall headgear stand taller, so the body under it keeps its size);
  4. box-filters down, cuts the whole sheet to one palette of 255 colours, makes the alpha hard and gives soft edges
     back their ink line;
  5. stands every frame on its row's feet line, the middle of the feet under the body (not under a weapon or a pet);
     the idle and walking frames are then lined up by head and shoulders, so the body does not jump between them;
  6. a pet that the sheet only draws in the attack frames is put into the other frames too (COMPANION): a wyvern
     over its master's head, Carbuncle and the automaton at their master's feet.
The settings a single sheet may need are at the top: PICK, TALLER, LIFT, COMPANION, CUTS.
Check a new sheet with --preview before it goes into the app. Needs Pillow, numpy and scipy.
"""
import os
import re
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'gen')
OUT = os.path.join(APP, 'assets', 'ventures', 'gm')
TS = os.path.join(APP, 'src', 'ventures', 'gen_art.ts')

JOBS = ['WAR', 'MNK', 'WHM', 'BLM', 'RDM', 'THF', 'PLD', 'DRK', 'BST', 'BRD', 'RNG', 'SAM', 'NIN', 'DRG', 'SMN', 'BLU', 'COR', 'PUP']
NAMES = {'warrior': 'WAR', 'monk': 'MNK', 'whitemage': 'WHM', 'blackmage': 'BLM', 'redmage': 'RDM', 'thief': 'THF',
         'paladin': 'PLD', 'darkknight': 'DRK', 'beastmaster': 'BST', 'bard': 'BRD', 'ranger': 'RNG', 'samurai': 'SAM',
         'ninja': 'NIN', 'dragoon': 'DRG', 'summoner': 'SMN', 'bluemage': 'BLU', 'corsair': 'COR', 'puppetmaster': 'PUP'}
ROWS, COLS = 8, 12
ZOOM, GRID = 3, (6, 2)            # a file in the app: one race look's 12 frames, 6 a row in 2 rows, at 3 times their size
FW, FH, CX, FOOT, TALL = 144, 100, 56, 84, 56     # CX: not the middle, weapons and pets are in front; FOOT: a
                                                  # summoning circle reaches under the feet
POSE = {'idle': [0, 1, 2], 'walk': [3, 4, 5], 'attack': [6, 7, 8], 'ability': [9, 10], 'hurt': [11]}
# a sheet with another number of frames a row: which of its frames fill the 12 places (BST has two walking frames)
PICK = {'BST': [0, 1, 2, 3, 4, 3, 5, 6, 7, 8, 9, 10]}
# job: how tall its people stand with their headgear on, as a factor of TALL (a row is scaled so that its standing
# figure is TALL x this: with 1.0 a tall hat would make the body under it smaller than the same person's in other jobs)
TALLER = {'WHM': 1.05, 'BLM': 1.2, 'RDM': 1.15, 'DRK': 1.08, 'BST': 1.08, 'BRD': 1.1, 'RNG': 1.08, 'SAM': 1.09,
          'BLU': 1.12, 'COR': 1.2, 'PUP': 1.12}
# jobs whose pet touches a figure in the sheet, so that the two are one shape: the pet is taken off it first.
# 'fly': the pet hangs in the air (and may touch the next frame's figure); 'ground': it stands in front of its master
LIFT = {'DRG': 'fly', 'PUP': 'ground'}
# jobs whose pet is only drawn in the attack and ability frames: the pet of the first attack frame is put into the
# standing, walking and hit frames too, at the same place, so it does not come and go (BST's sheet has its pet everywhere)
COMPANION = {'DRG', 'SMN', 'PUP'}
HOVER = 14                        # how far a flying pet put into a frame dips behind its master's head, in pixels
# (job, row): x of the cut between two touching frames, in the sheet's own pixels, where split_pair gets it wrong
CUTS = {}
INK = (24, 18, 26)


# ------------------------------------------------------------------ finding the frames
def core_of(mask, k):
    """The biggest piece left after wearing the shape down by k pixels (the head and body; weapons and tails go)."""
    while k >= 1:
        er = ndimage.binary_erosion(mask, iterations=k)
        if er.any():
            lab, n = ndimage.label(er)
            sizes = ndimage.sum(er, lab, range(1, n + 1))
            return lab == int(np.argmax(sizes)) + 1
        k -= 1
    return mask


def seam_of(mask, lo, hi):
    """A cut from top to bottom that stays in the columns lo..hi: for each row the x where the right side starts, chosen
    so that as few touching pixels as possible end up on different sides (two shapes that only touch come apart along
    the line where they touch)."""
    h = mask.shape[0]
    n = hi - lo + 1
    m = mask.astype(np.int32)
    side = np.zeros((h, n), np.int32)                 # a pixel and its left neighbour parted
    for j in range(n):
        side[:, j] = m[:, lo + j - 1] & m[:, lo + j]
    down = m[:-1] & m[1:]                             # a pixel and the one under it parted when the cut steps sideways
    acc = np.concatenate([np.zeros((h - 1, 1), np.int32), np.cumsum(down, axis=1)], axis=1)
    cost = np.zeros((h, n), np.int64)
    came = np.zeros((h, n), np.int32)
    cost[0] = side[0]
    jj = np.arange(n)
    for y in range(1, h):
        a = acc[y - 1, lo + jj]                                           # columns before lo + j
        step = np.abs(a[:, None] - a[None, :])                            # from j (row y - 1) to j2 (row y)
        tot = cost[y - 1][:, None] + step
        came[y] = np.argmin(tot, axis=0)
        cost[y] = tot[came[y], jj] + side[y]
    seam = np.zeros(h, np.int32)
    j = int(np.argmin(cost[-1]))
    for y in range(h - 1, -1, -1):
        seam[y] = lo + j
        j = came[y][j]
    return seam


def split_pair(mask, back, k0, cut=None):
    """Two frames that touch, as one shape: (left, right). They face right, so what reaches forward from the left one
    (a weapon) is its own, and the right one starts where its back should be: `back` pixels behind the middle of its
    body, as the row's other frames have it. The cut is the line near there that parts the fewest touching pixels
    (seam_of); a piece that the cut leaves without its body goes to the other side."""
    h, w = mask.shape
    cores = None
    for k in range(k0, 1, -1):
        er = ndimage.binary_erosion(mask, iterations=k)
        lab, n = ndimage.label(er)
        if n >= 2:
            sizes = ndimage.sum(er, lab, range(1, n + 1))
            order = np.argsort(sizes)[::-1]
            if sizes[order[1]] > sizes[order[0]] * 0.3:
                a, b = lab == order[0] + 1, lab == order[1] + 1
                ax, bx = np.where(a)[1].mean(), np.where(b)[1].mean()
                cores = (a, b, ax, bx) if ax < bx else (b, a, bx, ax)
                break
    if cut is not None:
        lo, hi = max(1, cut - 2), min(w - 1, cut + 3)
    elif cores:
        want = cores[3] - back
        lo, hi = int(max(cores[2] + 6, want - 16)), int(min(cores[3] - 4, want + 16))
    else:
        lo, hi = int(w * 0.3), int(w * 0.7)
    lo = max(1, min(lo, w - 2)); hi = max(lo + 1, min(hi, w - 1))
    seam = seam_of(mask, lo, hi)
    xs = np.arange(w)[None, :]
    left, right = mask & (xs < seam[:, None]), mask & (xs >= seam[:, None])
    if cores:
        for side, other, core in ((left, right, cores[0]), (right, left, cores[1])):
            lab, n = ndimage.label(side, structure=np.ones((3, 3)))
            main = np.bincount(lab[core & side], minlength=n + 1)[1:]
            keep = int(np.argmax(main)) + 1 if main.any() else 0
            for i in range(1, n + 1):
                piece = lab == i
                if i != keep and (ndimage.binary_dilation(piece, structure=np.ones((3, 3))) & other).any():
                    side[piece] = False
                    other[piece] = True
    return left, right


def lift_pets(mask, lab, n, pitch, how):
    """A pet that touches a figure is one shape with it. Each big shape is worn down a few pixels; a big piece that
    then stands apart from the figure (the biggest piece) gets a label of its own if it is where a pet would be:
    'fly' = it ends well above the figure's feet, 'ground' = it is short and in front of the figure.
    Returns (lab, n)."""
    areas = ndimage.sum(mask, lab, range(1, n + 1))
    boxes = ndimage.find_objects(lab)
    ref = float(np.median(np.sort(areas)[::-1][:ROWS * COLS]))
    k = max(2, int(round(pitch * 0.025)))
    lab = lab.copy()
    for i in range(len(boxes)):
        if areas[i] < ref * 0.5:
            continue
        sl = boxes[i]
        m = lab[sl] == i + 1
        er = ndimage.binary_erosion(m, iterations=k)
        l2, n2 = ndimage.label(er)
        if n2 < 2:
            continue
        sizes = ndimage.sum(er, l2, range(1, n2 + 1))
        seeds = [j for j in range(n2) if sizes[j] >= ref * 0.08]
        if len(seeds) < 2:
            continue
        rows_ = {j: np.where((l2 == j + 1).any(axis=1))[0] for j in seeds}
        cols_ = {j: np.where((l2 == j + 1).any(axis=0))[0] for j in seeds}
        fig = max(seeds, key=lambda j: sizes[j])
        top, bottom = rows_[fig][0], rows_[fig][-1]
        height = bottom - top + 1
        if how == 'fly':
            pets = [j for j in seeds if j != fig and rows_[j][-1] < bottom - height * 0.4]
        else:
            pets = [j for j in seeds if j != fig and rows_[j][0] > top + height * 0.35 and cols_[j].mean() > cols_[fig].mean()]
        if not pets:
            continue
        # grow the seeds back through the shape a pixel at a time, so each gets its own thin parts
        own = np.zeros(m.shape, np.int32)
        for j in seeds:
            own[l2 == j + 1] = j + 1
        free = m & (own == 0)
        while free.any():
            grew = False
            for j in seeds:
                g = ndimage.binary_dilation(own == j + 1) & free
                if g.any():
                    own[g] = j + 1
                    free &= ~g
                    grew = True
            if not grew:
                break
        for j in pets:
            n += 1
            view = lab[sl]
            view[own == j + 1] = n
    return lab, n


def frames_of(A, job='', log=print):
    """The sheet's frames as [row] = (feet line, [(rgba array, x0, y0, body height, pet, front), ...]), each with its
    own pixels only; pet is the frame's companion alone, (rgba array, x0, y0), or None; front: see where it is set.
    A row's figures are the big shapes that stand on its feet line; anything else (a pet, a "!", notes, dice) goes to
    the figure it belongs to: a small piece to the one it touches, the rest to the figure it is in front of (everybody
    faces right, so a frame's own things are between its figure and the next one)."""
    H, W = A.shape[:2]
    pitch = H / ROWS
    want = len(set(PICK[job])) if job in PICK else COLS
    mask = A[..., 3] > 40
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n < ROWS * 6:
        raise RuntimeError('too few figures found (%d): is the background transparent?' % n)
    if job in LIFT:
        lab, n = lift_pets(mask, lab, n, pitch, LIFT[job])
    areas = ndimage.sum(mask, lab, range(1, n + 1))
    boxes = ndimage.find_objects(lab)
    big = np.argsort(areas)[::-1][:40]
    ref_area = float(np.median(areas[big]))
    ref_h = float(np.median([boxes[i][0].stop - boxes[i][0].start for i in big]))
    cand = [i for i in range(n) if areas[i] >= ref_area * 0.3 and boxes[i][0].stop - boxes[i][0].start >= ref_h * 0.45]
    # rows: the feet lines that many figures share (a flying pet as big as a figure stands on none of them)
    cand.sort(key=lambda i: boxes[i][0].stop)
    groups = [[cand[0]]]
    for i in cand[1:]:
        if boxes[i][0].stop - boxes[groups[-1][-1]][0].stop <= pitch * 0.12:
            groups[-1].append(i)
        else:
            groups.append([i])
    groups = sorted(sorted(groups, key=len, reverse=True)[:ROWS], key=lambda g: boxes[g[0]][0].stop)
    if len(groups) != ROWS or min(len(g) for g in groups) < want - 3:
        raise RuntimeError('could not find %d rows of figures (found rows of %s)' % (ROWS, [len(g) for g in groups]))
    lines = [float(np.median([boxes[i][0].stop for i in g])) for g in groups]
    body = [i for g in groups for i in g]
    row_of = {i: r for r, g in enumerate(groups) for i in g}
    owner = np.zeros(lab.shape, np.int32)
    for i in body:
        owner[lab == i + 1] = i + 1
    dist, (iy, ix) = ndimage.distance_transform_edt(owner == 0, return_indices=True)
    dropped = 0
    pets = {}                                           # figure: its biggest companion piece (a label)
    for i in range(n):
        if i in row_of or areas[i] < 6:
            continue
        sl = boxes[i]
        ys, xs = np.where(lab[sl] == i + 1)
        ys, xs = ys + sl[0].start, xs + sl[1].start
        j = int(np.argmin(dist[ys, xs]))
        near, gap = int(owner[iy[ys[j], xs[j]], ix[ys[j], xs[j]]]) - 1, float(dist[ys[j], xs[j]])
        # its row: the first feet line at or under the piece's middle (a "!" reaches up to the feet of the row above,
        # so the nearest figure does not say which row it is in)
        cy, cx = (sl[0].start + sl[0].stop) / 2.0, (sl[1].start + sl[1].stop) / 2.0
        r = next((k for k, y in enumerate(lines) if cy <= y + pitch * 0.03), ROWS - 1)
        left = [b for b in groups[r] if boxes[b][1].start <= cx]
        cell = max(left, key=lambda b: boxes[b][1].start) if left else min(groups[r], key=lambda b: boxes[b][1].start)
        small = areas[i] < ref_area * 0.06
        mine = row_of[near] == r
        if small and mine and gap <= pitch * 0.05:
            who = near                                  # touching: a spark on a staff, a tear on a face
        elif cx - boxes[cell][1].stop <= pitch * 0.75:
            who = cell
        elif mine and gap <= pitch * 0.2:
            who = near
        else:
            dropped += 1
            continue
        owner[ys, xs] = who + 1
        if areas[i] >= ref_area * 0.09 and (who not in pets or areas[i] > areas[pets[who]]):
            pets[who] = i                               # (a "!" is under a twentieth of a figure, the smallest pet a seventh)
    if dropped:
        log('  %d loose piece(s) far from any figure left out' % dropped)
    k0 = max(3, int(round(pitch * 0.07)))
    out = []
    for r, ids in enumerate(groups):
        pieces = []
        for i in ids:
            ys, xs = np.where(owner == i + 1)
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            sl = boxes[i]
            pieces.append([owner[y0:y1, x0:x1] == i + 1, x0, y0, sl[1].start + (sl[1].stop - sl[1].start) / 2.0, sl[0].stop - sl[0].start, i])
        pieces.sort(key=lambda p: p[3])
        while len(pieces) > want:                       # too many: the smallest joins its nearest neighbour
            k = int(np.argmin([p[0].sum() for p in pieces]))
            near = min((j for j in range(len(pieces)) if j != k), key=lambda j: abs(pieces[j][3] - pieces[k][3]))
            a, b = pieces[k], pieces[near]
            x0, y0 = min(a[1], b[1]), min(a[2], b[2])
            x1 = max(a[1] + a[0].shape[1], b[1] + b[0].shape[1]); y1 = max(a[2] + a[0].shape[0], b[2] + b[0].shape[0])
            m = np.zeros((y1 - y0, x1 - x0), bool)
            for p in (a, b):
                m[p[2] - y0:p[2] - y0 + p[0].shape[0], p[1] - x0:p[1] - x0 + p[0].shape[1]] |= p[0]
            pieces = [p for j, p in enumerate(pieces) if j not in (k, near)] + [[m, x0, y0, b[3], b[4], b[5]]]
            pieces.sort(key=lambda p: p[3])
            log('  row %d: an extra piece was joined to the frame beside it' % (r + 1))
        if len(pieces) < want:                          # too few: frames touch; pull the widest apart
            single = sorted(pieces, key=lambda p: p[0].shape[1])[:max(1, len(pieces) // 2)]
            back = float(np.median([np.where(core_of(p[0], k0))[1].mean() for p in single]))
        while len(pieces) < want:
            k = int(np.argmax([p[0].shape[1] for p in pieces]))
            m, x0, y0, _, bh, _ = pieces.pop(k)
            cut = CUTS.get((job, r))
            left, right = split_pair(m, back, k0 + 6, None if cut is None else cut - x0)
            for part in (left, right):
                ys, xs = np.where(part)
                if len(ys):
                    pieces.append([part[ys.min():ys.max() + 1, xs.min():xs.max() + 1], x0 + xs.min(), y0 + ys.min(),
                                   x0 + (xs.min() + xs.max()) / 2.0, bh, None])
            pieces.sort(key=lambda p: p[3])
            log('  row %d: two frames touched and were pulled apart near x = %d (check them)' % (r + 1, x0 + m.shape[1] // 2))
        line = []
        for m, x0, y0, _, bh, i in pieces:
            crop = A[y0:y0 + m.shape[0], x0:x0 + m.shape[1]].copy()
            crop[..., 3] = np.where(m, crop[..., 3], 0)
            pet = None
            if i in pets:                               # its companion, cut out alone (for COMPANION)
                sl = boxes[pets[i]]
                pm = lab[sl] == pets[i] + 1
                pc = A[sl].copy()
                pc[..., 3] = np.where(pm, pc[..., 3], 0)
                pet = (pc, sl[1].start, sl[0].start)
            # how much stands in front of the figure at ground level, as a part of a figure (a pet that touches its
            # master is not a piece of its own, but it shows here: about 0.15, against 0.03 for a foot or a hem)
            core = core_of(m, max(2, int(round(bh * 0.09))))
            right = np.where(core.any(axis=0))[0][-1] + int(pitch * 0.04)
            ground = int(round(lines[r] - y0))
            front = m[max(0, ground - int(bh * 0.5)):ground + 4, min(m.shape[1], right):].sum() / ref_area
            line.append((crop, x0, y0, bh, pet, front))
        out.append((lines[r], line))
    return out


# ------------------------------------------------------------------ making them pixel art
def shrink(crop, s):
    """Box-filtered down by s (colours weighted by their alpha, so the transparent pixels' colour does not leak in)."""
    im = Image.fromarray(crop, 'RGBA')
    w, h = max(1, int(round(im.width * s))), max(1, int(round(im.height * s)))
    return np.asarray(im.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA'))


def stand(alpha):
    """Where a frame stands: (x of the middle of the feet, y of the ground), from the part of the shape under its
    body (a weapon resting on the ground in front, or a tail behind, does not count)."""
    m = alpha > 0
    h = m.shape[0]
    core = core_of(m, max(2, int(round(h * 0.09))))
    xs = np.where(core.any(axis=0))[0]
    pad = max(3, int(round((xs[-1] - xs[0] + 1) * 0.3)))
    x0, x1 = max(0, xs[0] - pad), min(m.shape[1], xs[-1] + pad + 1)
    under = m[:, x0:x1]
    ys = np.where(under.any(axis=1))[0]
    ground = ys[-1]
    low = under[max(0, ground - max(2, h // 9)):ground + 1]
    fx = np.where(low.any(axis=0))[0]
    return x0 + (fx[0] + fx[-1]) / 2.0, int(ground)


def build(path, job, log=print):
    """One sheet -> (the app's sheet as an RGBA image, [[frame, ...] per row] for previews)."""
    A = np.asarray(Image.open(path).convert('RGBA'))
    rows = frames_of(A, job, log)
    pick = PICK.get(job, list(range(COLS)))
    if len(rows) != ROWS or any(len(line) != len(set(pick)) for _, line in rows):
        raise RuntimeError('expected %d rows of %d frames, found %s' % (ROWS, len(set(pick)), [len(line) for _, line in rows]))
    small, grounds, mates, scales = [], [], [], []
    for feet, line in rows:
        # the row's size: its standing figure (the body alone, without pets or loose effects) becomes TALL pixels
        s = TALL * TALLER.get(job, 1.0) / float(np.median([f[3] for f in line[:3]]))
        scales.append(s)
        small.append([shrink(line[k][0], s) for k in pick])
        grounds.append([(feet - line[k][2]) * s for k in pick])
        mate = None
        if job in COMPANION:
            # the pet of the first attack frame that has one alone, and where it is from that frame's own corner
            for c in POSE['attack'] + POSE['ability']:
                f = line[pick[c]]
                if f[4]:
                    pc, px, py = f[4]
                    mate = (c, pc, (px - f[1]) * s, (py - f[2]) * s)
                    break
        # which frames have their pet already (alone, or touching the figure: a pet on the ground shows in `front`)
        mates.append((mate, [line[k][4] is not None or (LIFT.get(job) != 'fly' and line[k][5] >= 0.07) for k in pick]))
    log('  figure heights in the sheet, by row: %s' % ' '.join(str(int(np.median([f[3] for f in line[:3]]))) for _, line in rows))
    # one palette for the sheet
    px = np.concatenate([f[f[..., 3] > 110][:, :3] for line in small for f in line])
    pal = Image.fromarray(px.reshape(-1, 1, 3), 'RGB').quantize(254, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    sheet = Image.new('RGBA', (FW * COLS, FH * ROWS), (0, 0, 0, 0))
    frames = []
    def pixelled(f):
        a = f[..., 3]
        hard = a > 110
        rgb = np.asarray(Image.fromarray(f[..., :3], 'RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'))
        ring = ndimage.binary_dilation(hard, structure=np.ones((3, 3))) & ~hard & (a > 28)     # a soft edge: its ink line
        img = np.zeros(f.shape, np.uint8)
        img[hard, :3] = rgb[hard]
        img[ring, :3] = INK
        img[..., 3] = np.where(hard | ring, 255, 0)
        return img

    placed = []
    for r, line in enumerate(small):
        out = []
        for c, f in enumerate(line):
            img = pixelled(f)
            fx, _ = stand(img[..., 3])
            out.append([img, int(round(CX - fx)), FOOT - int(round(grounds[r][c]))])     # on the row's own feet line
        # standing and walking: the head and shoulders stay where they are in the second idle frame (the feet alone
        # would let the body jump a few pixels from one drawing to the next)
        def upper(k, dx=0):
            img, x, y = out[k]
            m = np.zeros((FH, FW + 40), bool)
            y0, x0 = max(0, y), max(0, x + 20 + dx)
            part = img[max(0, -y):, :, 3] > 0
            m[y0:y0 + part.shape[0], x0:x0 + part.shape[1]] = part[:FH - y0, :FW + 40 - x0]
            return m[FOOT - TALL - 6:FOOT - int(TALL * 0.45)]
        first = POSE['idle'][1]
        img, x, y = out[first]                         # the row's middle: the middle of that frame's head and body
        centre = np.where(core_of(img[..., 3] > 0, max(2, int(round(img.shape[0] * 0.09)))))[1].mean() + x
        for f in out:
            f[1] += int(round(CX - centre))
        ref = upper(first)
        for k in POSE['idle'] + POSE['walk']:
            if k != first:
                best = max(range(-7, 8), key=lambda dx: ((upper(k, dx) & ref).sum(), -abs(dx)))
                out[k][1] += best
        placed.append(out)
    # the pets (COMPANION): where each row's own pet is, from the middle of the feet (CX, FOOT), in its own scale
    spots = {}
    for r, (mate, _) in enumerate(mates):
        if mate:
            src, pc, px, py = mate
            h = shrink(pc, scales[r]).shape[0]
            spots[r] = (pc, (placed[r][src][1] + px - CX) / scales[r], (placed[r][src][2] + py + h - FOOT) / scales[r])
    if job in COMPANION and not spots:
        log('  no pet found alone in any attack frame: the standing and walking frames stay without one')
    for r, out in enumerate(placed):
        cells = []
        pet = None
        if spots:
            # a row whose pet always touches its master borrows the nearest row's (the pets are drawn alike)
            lender = min(spots, key=lambda k: (abs(k - r), k))
            if lender != r:
                log('  row %d: its pet is never alone in the attack frames; the one of row %d is used' % (r + 1, lender + 1))
            pc, dx, dy = spots[lender]
            pet = Image.fromarray(pixelled(shrink(pc, scales[r])), 'RGBA')
            at = (int(round(CX + dx * scales[r])), int(round(FOOT + dy * scales[r])) - pet.height)
            if LIFT.get(job) == 'fly':
                # a pet in the air hovers over its master's head, half behind it: beside the head (where the sheet
                # has it when they attack) it would cover the face of whoever stands in front
                img, x, y = out[POSE['idle'][1]]
                top = y + int(np.where((img[..., 3] > 0).any(axis=1))[0][0])
                at = (CX + 4 - pet.width // 2, max(1, top + HOVER - pet.height))
            else:
                # a pet on the ground stands clear of its master: forward until the standing figure (a broad one
                # would hide it) covers no more than a fifth of it
                pa = np.asarray(pet)[..., 3] > 0
                def hidden(step):
                    worst = 0.0
                    for c in POSE['idle']:
                        img, x, y = out[c]
                        fig = np.zeros((FH, FW + 80), bool)
                        part = img[max(0, -y):, max(0, -x):, 3] > 0
                        y0, x0 = max(0, y), max(0, x)
                        fig[y0:y0 + part.shape[0], x0:x0 + part.shape[1]] = part[:FH - y0, :FW + 80 - x0]
                        px0, py0 = max(0, at[0] + step), max(0, at[1])
                        win = fig[py0:py0 + pa.shape[0], px0:px0 + pa.shape[1]]
                        worst = max(worst, (win & pa[:win.shape[0], :win.shape[1]]).sum() / max(1, pa.sum()))
                    return worst
                step = next((k for k in range(0, 31) if hidden(k) <= 0.2), 30)
                at = (at[0] + step, at[1])
        has = mates[r][1]
        for c, (img, x, y) in enumerate(out):
            cell = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
            if pet is not None and not has[c] and c in POSE['idle'] + POSE['walk'] + POSE['hurt']:
                bob = (0, -1, -2)[c % 3] if LIFT.get(job) == 'fly' else 0          # it flaps
                cell.paste(pet, (at[0], at[1] + bob), pet)                          # behind the figure
                if at[1] + bob < 0 or at[0] < 0 or at[0] + pet.width > FW:
                    log('  row %d frame %d: its pet does not fit the cell and was cut off' % (r + 1, c + 1))
            im = Image.fromarray(img, 'RGBA')
            cell.paste(im, (x, y), im)                 # (the alpha is all or nothing, so this is exact)
            if x < 0 or y < 0 or x + img.shape[1] > FW or y + img.shape[0] > FH:
                log('  row %d frame %d does not fit its cell and was cut off (%d, %d, %d wide)' % (r + 1, c + 1, x, y, img.shape[1]))
            sheet.paste(cell, (c * FW, r * FH))
            cells.append(cell)
        frames.append(cells)
    return sheet, frames


def look_files(job):
    return [os.path.join(OUT, '%s_%d.png' % (job, r + 1)) for r in range(ROWS)]


def save_looks(sheet, job):
    """The job's sheet as the app's files: each row (a race look) apart, its frames GRID[0] a row, ZOOM times as big."""
    gc, gr = GRID
    for r, path in enumerate(look_files(job)):
        im = Image.new('RGBA', (FW * gc, FH * gr), (0, 0, 0, 0))
        for c in range(COLS):
            im.paste(sheet.crop((c * FW, r * FH, (c + 1) * FW, (r + 1) * FH)), ((c % gc) * FW, (c // gc) * FH))
        save_sheet(im.resize((im.width * ZOOM, im.height * ZOOM), Image.NEAREST), path)


def save_sheet(sheet, path):
    """The sheet as an 8-bit PNG: its colours (at most 255) and one transparent index."""
    a = np.asarray(sheet)
    opaque = a[..., 3] > 0
    cols, inv = np.unique(a[opaque][:, :3], axis=0, return_inverse=True)
    if len(cols) > 255:
        raise RuntimeError('%d colours' % len(cols))
    idx = np.full(a.shape[:2], 255, np.uint8)
    idx[opaque] = inv.astype(np.uint8)
    im = Image.fromarray(idx, 'P')
    pal = np.zeros((256, 3), np.uint8)
    pal[:len(cols)] = cols
    im.putpalette(pal.tobytes())
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, transparency=255, optimize=True)


# ------------------------------------------------------------------ files
def sheets():
    """{job: path} for the sheets in art/gen (the newest of a job's sheets)."""
    found = {}
    names = sorted(NAMES, key=len, reverse=True)
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith('.png'):
            continue
        stem = re.sub(r'[^a-z]', '', os.path.splitext(f)[0].lower())
        job = stem.upper() if stem.upper() in JOBS else next((NAMES[n] for n in names if n in stem), None)
        if not job:
            continue
        p = os.path.join(SRC, f)
        if job not in found or os.path.getmtime(p) > os.path.getmtime(found[job]):
            found[job] = p
    return found


def write_ts(jobs):
    gc, gr = GRID
    lines = ["// Made by art/gen_mates.py: squad mates cut from generated sprite sheets (art/gen), one sheet a job.",
             "// GEN_SHEET[job][the game's race number - 1] is that race look's file: %d frames of GEN_FW x GEN_FH, GEN_COLS a row in" % COLS,
             "// GEN_FROWS rows (the file itself is %d times that size, to stay sharp). In a frame the figure stands on y = GEN_FOOT" % ZOOM,
             "// with its middle at x = GEN_CX, and a Hume is GEN_TALL pixels tall.",
             "export const GEN_FW = %d;" % FW, "export const GEN_FH = %d;" % FH, "export const GEN_CX = %d;" % CX, "export const GEN_FOOT = %d;" % FOOT,
             "export const GEN_TALL = %d;" % TALL, "export const GEN_COLS = %d;" % gc, "export const GEN_FROWS = %d;" % gr,
             "/** which frames make each pose */",
             "export const GEN_POSE: Record<string, number[]> = { %s };" % ', '.join('%s: [%s]' % (k, ', '.join(map(str, v))) for k, v in POSE.items()),
             "/** the jobs that have a sheet; the others keep Kaza's art (mate_art.ts) */",
             "export const GEN_SHEET: Record<string, any[]> = {"]
    for j in JOBS:
        if j in jobs:
            lines.append("  %s: [" % j)
            lines += ["    require('../../assets/ventures/gm/%s_%d.png')," % (j, r + 1) for r in range(ROWS)]
            lines.append("  ],")
    lines += ["};", ""]
    with open(TS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))


def preview(frames, job, folder):
    """A strip of every frame and an animation of all eight (idle, walk, attack, ability, hit), on grass green, 2x."""
    os.makedirs(folder, exist_ok=True)
    bg = (70, 90, 60, 255)
    strip = Image.new('RGBA', (FW * COLS, FH * ROWS), bg)
    for r, line in enumerate(frames):
        for c, f in enumerate(line):
            strip.alpha_composite(f, (c * FW, r * FH))
    strip.convert('RGB').resize((strip.width * 2, strip.height * 2), Image.NEAREST).save(os.path.join(folder, job + '_frames.png'))
    plan = [0, 1, 2, 1] * 2 + [3, 4, 5, 4] * 2 + [6, 7, 8, 8] * 2 + [9, 10, 9, 10] + [11, 11, 0, 0]
    seq = []
    for k in plan:
        im = Image.new('RGBA', (FW * 4, FH * 2), bg)
        for r in range(ROWS):
            im.alpha_composite(frames[r][k], ((r % 4) * FW, (r // 4) * FH))
        seq.append(im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST))
    seq[0].save(os.path.join(folder, job + '.gif'), save_all=True, append_images=seq[1:], duration=150, loop=0)


def main():
    args = sys.argv[1:]
    folder = None
    if '--preview' in args:
        i = args.index('--preview')
        folder = args[i + 1]
        del args[i:i + 2]
    found = sheets()
    todo = [j.upper() for j in args] or [j for j in JOBS if j in found]
    for job in todo:
        if job not in found:
            print('%s: no sheet in art/gen' % job)
            continue
        print('%s: %s' % (job, os.path.basename(found[job])))
        sheet, frames = build(found[job], job)
        save_looks(sheet, job)
        if folder:
            preview(frames, job, folder)
    have = [j for j in JOBS if all(os.path.exists(p) for p in look_files(j))]
    write_ts(have)
    print('%d of %d jobs have a sheet: %s' % (len(have), len(JOBS), ' '.join(have) or '-'))
    missing = [j for j in JOBS if j not in have]
    if missing:
        print('still Kaza\'s art: ' + ' '.join(missing))


if __name__ == '__main__':
    main()
