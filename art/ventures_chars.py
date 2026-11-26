"""Pixel squad mates for Ventures: every race (Hume m/f, Elvaan m/f, Tarutaru m/f, Mithra, Galka) in every era job's look.

One frame is 24 x 32 grid pixels, the figure facing right (the party stands on the left, the monster on the right).
Ten frames per sheet, left to right:
  0 idle   1 idle (breathing)   2 walk   3 walk   4 attack wind-up   5 attack strike   6 casting
  7 hurt   8 resting (sitting)  9 victory
Chibi proportions like the old console games: a big head, a short body. Job looks follow the era's artifact armor:
the Warrior's horned helm, the White Mage's red-trimmed hood, the Black Mage's pointed hat and so on.
"""
from PIL import Image, ImageDraw

FW, FH = 24, 32
FRAMES = ["idle0", "idle1", "walk0", "walk1", "atk0", "atk1", "cast", "hurt", "sit", "win"]
OUTLINE = (24, 18, 26, 255)

SKIN = {"hume": (240, 196, 160), "elvaan": (236, 200, 170), "taru": (248, 206, 168), "mithra": (214, 160, 112),
        "galka": (176, 132, 100)}
HAIR = [(70, 44, 28), (150, 92, 44), (214, 180, 100), (40, 36, 40), (180, 70, 40), (230, 226, 210), (110, 70, 120),
        (60, 80, 140)]
RACE = {1: ("hume", "m"), 2: ("hume", "f"), 3: ("elvaan", "m"), 4: ("elvaan", "f"), 5: ("taru", "m"), 6: ("taru", "f"),
        7: ("mithra", "f"), 8: ("galka", "m")}

# body colour, trim, legs, headgear, weapon, extra
JOB = {
    "WAR": ((168, 52, 40), (210, 170, 70), (96, 60, 40), "horns", "axe", None),
    "MNK": ((222, 138, 52), (120, 50, 30), (180, 100, 40), "band", "fists", None),
    "WHM": ((242, 240, 232), (196, 40, 48), (232, 228, 220), "hood_w", "club", None),
    "BLM": ((58, 54, 120), (200, 170, 60), (40, 38, 80), "pointy", "staff", None),
    "RDM": ((176, 30, 44), (232, 214, 150), (120, 24, 34), "feather", "sword", None),
    "THF": ((70, 110, 64), (130, 90, 52), (60, 56, 50), "bandana", "dagger", None),
    "PLD": ((196, 204, 216), (90, 120, 200), (150, 160, 176), "helm", "sword", "shield"),
    "DRK": ((54, 46, 58), (150, 40, 50), (40, 36, 44), "dark_helm", "scythe", None),
    "BST": ((150, 104, 60), (226, 214, 180), (110, 74, 46), "fur", "axe", None),
    "BRD": ((70, 140, 90), (230, 200, 90), (60, 90, 70), "cap_feather", "harp", None),
    "RNG": ((96, 120, 60), (150, 110, 60), (80, 70, 46), "hood_g", "bow", None),
    "SAM": ((180, 40, 36), (40, 40, 40), (70, 60, 56), "kabuto", "katana", None),
    "NIN": ((60, 52, 92), (170, 40, 50), (44, 40, 66), "mask", "kunai", None),
    "DRG": ((60, 90, 170), (220, 200, 120), (50, 66, 120), "drg_helm", "lance", "wyvern"),
    "SMN": ((100, 150, 70), (230, 220, 160), (70, 110, 60), "horn_hat", "staff", None),
    "BLU": ((60, 120, 150), (220, 190, 90), (50, 80, 110), "turban", "sword", None),
    "COR": ((150, 34, 40), (220, 190, 90), (60, 50, 60), "tricorne", "gun", None),
    "PUP": ((120, 70, 140), (230, 170, 60), (80, 50, 100), "jester", "fists", "puppet"),
}
JOBS = list(JOB)
STEEL, WOOD, GOLD = (200, 206, 214), (130, 90, 50), (226, 190, 80)

# ---------------------------------------------------------------- the mate's own look (2026-11-25)
# FFXI has 8 faces per race, each in 2 hair colours (1A, 1B, ... 8B = face 0..15): the hairstyle goes with the face,
# A/B is the colour. Here: style = face // 2 (hair shape and eyes), colour from FACE_HAIR (close to the game's, by eye).
_C = dict(black=(40, 36, 40), dbrown=(70, 44, 28), brown=(110, 70, 40), lbrown=(150, 92, 44), blonde=(214, 180, 100),
          pblond=(232, 214, 150), red=(170, 60, 36), auburn=(130, 56, 40), orange=(210, 120, 50), silver=(200, 204, 214),
          white=(230, 226, 210), purple=(110, 70, 120), blue=(60, 80, 140), pink=(220, 140, 160))
_HAIRS = {
    "hume": "dbrown blonde black lbrown brown red blonde dbrown black auburn lbrown blonde red black brown pblond",
    "elvaan": "silver dbrown blonde black white brown auburn silver black red pblond lbrown dbrown white brown blonde",
    "taru": "brown orange lbrown blonde red dbrown orange purple blonde brown black red pink lbrown blue orange",
    "mithra": "brown red white black lbrown orange dbrown blonde black silver auburn brown red pblond dbrown white",
}
FACE_HAIR = {race: [_C[n] for n in names.split()] for race, names in _HAIRS.items()}

# The layers a mate is drawn in, so the app can put any face on any job and any weapon in the hand:
#   body  (race x job)      tail, legs, torso, the back arm
#   head  (race x face x the hat's kind)   face, eyes, hair; the hat's kind decides how much hair shows
#   top   (race x job)      hat, the front arm, shield, wyvern, puppet, the casting sparkle
#   weap  (race x weapon)   what's in the hand
LAYERS = ("body", "head", "top", "weap")
HOODS = ("hood_w", "hood_g", "turban", "tricorne")
HAT_KINDS = {"open": None, "helm": "helm", "hood": "hood_w"}     # a hat that stands for each kind


def hat_kind(job):
    hat = JOB[job][3]
    return "hood" if hat in HOODS else ("helm" if hat in HELMS else "open")


# weapons by the game's weapon skill (item_weapon.skill); hand-to-hand shows nothing in the hand
WEAPONS = ["dagger", "sword", "greatsword", "axe", "greataxe", "scythe", "lance", "katana", "greatkatana", "club",
           "staff", "bow", "gun", "harp"]
SKILL_WEAPON = {1: "fists", 2: "dagger", 3: "sword", 4: "greatsword", 5: "axe", 6: "greataxe", 7: "scythe", 8: "lance",
                9: "katana", 10: "greatkatana", 11: "club", 12: "staff", 25: "bow", 26: "gun", 41: "harp", 42: "harp"}


def job_weapon(job):
    w = JOB[job][4]
    return "dagger" if w == "kunai" else w


def dark(c, k=0.72):
    return tuple(max(0, int(v * k)) for v in c[:3])


def light(c, k=1.22):
    return tuple(min(255, int(v * k)) for v in c[:3])


class Fig:
    """Measurements of one body type: head box, torso box, legs, so poses can move the parts."""

    def __init__(self, race, sex):
        self.race, self.sex = race, sex
        if race == "taru":
            self.head, self.hw, self.hh = 11, 12, 10     # top y, width, height
            self.torso, self.tw, self.th = 21, 6, 5
            self.leg = 3
        elif race == "galka":
            self.head, self.hw, self.hh = 5, 9, 8
            self.torso, self.tw, self.th = 13, 12, 9
            self.leg = 6
        elif race == "elvaan":
            self.head, self.hw, self.hh = 2, 10, 9
            self.torso, self.tw, self.th = 11, 8 if sex == "m" else 7, 9
            self.leg = 8
        else:
            self.head, self.hw, self.hh = 3, 10, 9
            self.torso, self.tw, self.th = 12, 8 if sex == "m" else 7, 8
            self.leg = 7
        self.cx = 11                                     # body centre column


def draw_frame(race_id, job, frame, hair_i=0, layer=None, weapon=None, hair=None, hat=None):
    """One frame. layer None: the whole figure; else one of LAYERS (see above). weapon / hair / hat replace the
    job's weapon, the hair colour from hair_i, and the job's hat (for the head layer: only its kind matters)."""
    race, sex = RACE[race_id]
    f = Fig(race, sex)
    skin = SKIN[race]
    if hair is None:
        hair = HAIR[hair_i % len(HAIR)]
    if race == "galka":
        hair = (90, 70, 60)
    body, trim, legs, job_hat, job_weap, extra = JOB[job]
    hat = job_hat if hat is None else hat
    weapon = job_weap if weapon is None else weapon
    ims = {k: Image.new("RGBA", (FW, FH), (0, 0, 0, 0)) for k in LAYERS}
    d = ImageDraw.Draw(ims["body"])
    dh, dt, dw = (ImageDraw.Draw(ims[k]) for k in ("head", "top", "weap"))
    pose = FRAMES[frame]
    bob = 1 if pose == "idle1" else 0
    sit = pose == "sit"
    lean = -1 if pose == "hurt" else (1 if pose == "atk1" else 0)
    dy = bob + (4 if sit else 0)
    cx = f.cx + lean
    ground = 29

    # ---------------------------------------------------------------- tail (behind)
    if race == "mithra":
        tx = cx - f.tw // 2 - 1
        ty = f.torso + f.th - 2 + dy
        tail = (200, 140, 90)
        swish = 1 if frame % 2 else 0
        d.line([(tx, ty), (tx - 3, ty - 2 - swish), (tx - 4, ty - 6 - swish)], fill=tail, width=1)
        d.point((tx - 4, ty - 7 - swish), fill=dark(tail))
    if race == "galka":
        d.rectangle([cx - f.tw // 2 - 2, f.torso + f.th - 3 + dy, cx - f.tw // 2, f.torso + f.th - 1 + dy], fill=skin)

    # ---------------------------------------------------------------- legs
    lx0 = cx - f.tw // 2 + (1 if race != "galka" else 1)
    lx1 = cx + f.tw // 2 - (2 if race != "galka" else 2)
    ly = f.torso + f.th + dy
    lw = 2 if race != "galka" else 4
    if sit:
        d.rectangle([lx0 - 1, ground - 3, lx1 + 3, ground - 1], fill=legs)       # legs folded forward
        d.rectangle([lx1 + 2, ground - 2, lx1 + 4, ground - 1], fill=dark(legs, 0.5))
    else:
        step = {"walk0": (-1, 1), "walk1": (1, -1)}.get(pose, (0, 0))
        for i, x in enumerate((lx0, lx1 - lw + 2)):
            off = step[i]
            top = ly
            d.rectangle([x + off, top, x + off + lw - 1, ground - 2], fill=legs)
            d.rectangle([x + off, ground - 1, x + off + lw, ground - 1], fill=dark(legs, 0.45))  # boots
        if sex == "f" and race in ("hume", "elvaan", "mithra") and job in ("WHM", "BLM", "SMN", "RDM", "BRD"):
            d.rectangle([cx - f.tw // 2, ly, cx + f.tw // 2 - 1, ly + 3], fill=body)      # skirt / robe hem

    # ---------------------------------------------------------------- torso
    t0 = f.torso + dy
    tx0, tx1 = cx - f.tw // 2, cx + f.tw // 2 - 1
    d.rectangle([tx0, t0, tx1, t0 + f.th - 1], fill=body)
    d.line([(tx0, t0), (tx1, t0)], fill=light(body))
    d.line([(tx0, t0 + 1), (tx0, t0 + f.th - 1)], fill=dark(body, 0.8))                # shade on the far side
    d.rectangle([tx0, t0 + f.th - 2, tx1, t0 + f.th - 2], fill=trim)                    # belt
    if job in ("WHM",):
        d.line([(tx0 + 1, t0 + 1), (cx, t0 + f.th - 3)], fill=trim)                      # the red triangles
        d.line([(tx1 - 1, t0 + 1), (cx, t0 + f.th - 3)], fill=trim)
    elif job in ("PLD", "DRK", "DRG", "WAR", "SAM"):
        d.rectangle([tx0, t0, tx0 + 1, t0 + 2], fill=light(body, 1.35) if job != "DRK" else (90, 80, 96))   # pauldron
        d.rectangle([tx1 - 1, t0, tx1, t0 + 2], fill=light(body, 1.35) if job != "DRK" else (90, 80, 96))
    elif job == "BLM":
        d.line([(cx, t0 + 1), (cx, t0 + f.th - 3)], fill=trim)
    elif job == "RDM" or job == "COR":
        d.line([(tx0 + 1, t0 + 1), (tx0 + 1, t0 + f.th - 3)], fill=trim)
    elif job == "MNK":
        d.line([(tx0 + 1, t0), (tx1 - 1, t0 + f.th - 3)], fill=trim)
    elif job == "BST":
        d.rectangle([tx0, t0, tx1, t0 + 1], fill=trim)                                   # fur collar

    # ---------------------------------------------------------------- arms and weapon
    sh_y = t0 + 1
    back_x, front_x = tx0 - 1, tx1 + 1
    arm = body if job not in ("MNK",) else skin
    # back arm
    if pose == "cast" or pose == "win":
        d.rectangle([back_x, sh_y - 4, back_x, sh_y + 1], fill=arm)
        d.point((back_x, sh_y - 5), fill=skin)
    elif not sit:
        d.rectangle([back_x, sh_y, back_x, sh_y + 4], fill=dark(arm, 0.85))
        d.point((back_x, sh_y + 5), fill=dark(skin, 0.9))
    # ---------------------------------------------------------------- head
    hy = f.head + dy
    hx0 = cx - f.hw // 2
    hx1 = hx0 + f.hw - 1
    hy1 = hy + f.hh - 1
    draw_head(dh, race, sex, pose, frame, hx0, hx1, hy, hy1, skin, hair, hair_i, hat)
    if hat == job_hat:
        draw_hat(dt, hat, hx0, hx1, hy, hy1, body, trim, hair, race)
    d = dt                                     # everything from here on is in front of the head

    # ---------------------------------------------------------------- arms and weapon (in front)
    sh_y = t0 + 1
    back_x, front_x = tx0 - 1, tx1 + 1
    arm = body if job not in ("MNK",) else skin
    # front arm (holds the weapon)
    if pose == "atk0":
        hand = (front_x + 1, sh_y - 4)
        d.line([(front_x, sh_y), (hand[0], hand[1] + 1)], fill=arm)
    elif pose == "atk1":
        hand = (front_x + 3, sh_y + 1)
        d.line([(front_x, sh_y), (hand[0] - 1, hand[1])], fill=arm)
    elif pose in ("cast", "win"):
        hand = (front_x + 1, sh_y - 5)
        d.line([(front_x, sh_y), (front_x + 1, sh_y - 4)], fill=arm)
    elif sit:
        hand = (front_x, sh_y + 3)
        d.line([(front_x, sh_y), (front_x, sh_y + 2)], fill=arm)
    else:
        hand = (front_x + 1, sh_y + 4)
        d.line([(front_x, sh_y), (front_x, sh_y + 3)], fill=arm)
    d.point(hand, fill=skin)
    draw_weapon(dw, weapon, hand, pose)
    if extra == "shield":
        sx = back_x - 2
        d.rectangle([sx, sh_y + 1, sx + 2, sh_y + 6], fill=(90, 120, 200))
        d.line([(sx, sh_y + 1), (sx + 2, sh_y + 1)], fill=GOLD)
        d.point((sx + 1, sh_y + 3), fill=GOLD)

    # ---------------------------------------------------------------- job extras
    if extra == "wyvern" and not sit:
        wx, wy = hx0 - 5, hy - 2 + (1 if frame % 2 else 0)
        wc = (70, 110, 200)
        d.rectangle([wx, wy, wx + 3, wy + 2], fill=wc)
        d.point((wx + 4, wy), fill=wc)
        d.line([(wx, wy - 1), (wx - 2, wy - 3)], fill=light(wc))
        d.line([(wx + 2, wy - 1), (wx + 2, wy - 3)], fill=light(wc))
        d.point((wx + 4, wy + 1), fill=(250, 220, 90))
    if extra == "puppet" and not sit:
        px, py = 1, ground - 10 + (1 if frame % 2 else 0)
        d.rectangle([px + 1, py, px + 4, py + 3], fill=(220, 200, 170))                 # head
        d.rectangle([px, py + 4, px + 5, py + 7], fill=(200, 80, 60))                     # body
        d.point((px + 3, py + 1), fill=(30, 30, 40))
        d.rectangle([px + 1, py + 8, px + 1, ground - 1], fill=(90, 60, 40))
        d.rectangle([px + 4, py + 8, px + 4, ground - 1], fill=(90, 60, 40))

    if pose == "cast":
        for (x, y) in ((hand[0] + 1, hand[1] - 2), (hand[0] - 2, hand[1] - 3), (hand[0] + 2, hand[1] + 1)):
            if 0 <= x < FW and 0 <= y < FH:
                d.point((x, y), fill=(255, 250, 180))
    if layer is not None:
        return outline(ims[layer])
    im = ims["body"]
    for k in ("head", "top", "weap"):
        im.alpha_composite(ims[k])
    return outline(im)


IRIS = [(60, 110, 200), (90, 60, 40), (60, 140, 90), (120, 70, 150), (200, 120, 40), (70, 90, 110)]
HELMS = ("pointy", "kabuto", "helm", "dark_helm", "drg_helm", "horns", "horn_hat", "hood_w", "hood_g", "tricorne", "turban", "mask")


def draw_head(d, race, sex, pose, frame, hx0, hx1, hy, hy1, skin, hair, hair_i, hat):
    """A 3/4 head facing right, in the 16-bit RPG manner: a big hair mass framing the face, a two-tone eye with a
    white glint, a blush, three tones of hair (lit band on top, the base, a shade at the back and the tips)."""
    hl, hd = light(hair, 1.3), dark(hair, 0.62)
    sk_d = dark(skin, 0.86)
    # face
    d.rectangle([hx0 + 1, hy, hx1, hy1 - 1], fill=skin)
    d.rectangle([hx0 + 2, hy1, hx1 - 1, hy1], fill=skin)                                  # chin
    d.line([(hx0 + 1, hy1 - 1), (hx0 + 3, hy1 - 1)], fill=sk_d)                           # jaw shade
    eye_y = hy + (5 if race != "taru" else 6)
    ex = hx1 - 2
    iris = IRIS[hair_i % len(IRIS)] if race != "galka" else (150, 90, 40)
    if race == "mithra":
        iris = (90, 160, 70) if hair_i % 2 else (200, 150, 40)
    closed = pose == "hurt" or pose == "sit"
    for x in (ex, ex - 4) if race != "galka" else (ex,):
        if closed:
            d.line([(x - 1, eye_y), (x, eye_y)], fill=(40, 28, 40))
        else:
            d.point((x, eye_y - 1), fill=(34, 24, 40))                                    # lash
            d.point((x, eye_y), fill=iris)
            d.point((x, eye_y + 1), fill=dark(iris, 0.7))
            if x == ex:
                d.point((x + 1, eye_y), fill=(250, 250, 255))                             # the white
    if race != "galka":
        d.point((ex - 1, eye_y + 2), fill=(236, 150, 140))                                # blush
        d.point((ex - 2, eye_y + 3), fill=dark(skin, 0.6) if pose != "atk1" else (150, 50, 50))   # mouth
    else:
        d.rectangle([hx1 - 1, eye_y + 1, hx1 + 1, eye_y + 3], fill=sk_d)                  # muzzle
        d.point((hx1 + 1, eye_y + 1), fill=(40, 30, 30))
    if race == "galka":
        d.rectangle([hx0 + 1, hy - 1, hx1 - 1, hy + 1], fill=dark(skin, 0.75))            # heavy brow ridge / mane
        d.rectangle([hx0 - 1, hy + 1, hx0 + 1, hy + 6], fill=(70, 56, 50))                # mane at the back
        d.line([(hx0 - 2, hy + 2), (hx0 - 3, hy + 5)], fill=(70, 56, 50))                 # ponytail
        return
    under = hat in HELMS
    # hair: the back mass
    long_ = sex == "f" or race == "mithra"
    back_bottom = hy1 + (4 if long_ and race != "taru" else (2 if long_ else 0))
    d.rectangle([hx0 - 1, hy + 1, hx0 + 3, back_bottom], fill=hair)
    d.rectangle([hx0 - 1, back_bottom - 1, hx0 + 2, back_bottom], fill=hd)
    d.line([(hx0 - 1, hy + 2), (hx0 - 1, back_bottom)], fill=hd)
    if not under or hat in ("hood_w", "hood_g", "turban", "tricorne"):
        # the crown and the fringe
        d.rectangle([hx0, hy - 2, hx1, hy + 1], fill=hair)
        d.rectangle([hx0 + 1, hy - 3, hx1 - 2, hy - 3], fill=hair)
        for x, y in ((hx1, hy + 2), (hx1 - 1, hy + 3), (hx1 - 3, hy + 2), (hx0 + 5, hy + 3), (hx0 + 4, hy + 2), (hx1 - 5, hy + 2)):
            d.point((x, y), fill=hair)                                                    # jagged bangs
        d.line([(hx0 + 2, hy - 2), (hx1 - 3, hy - 2)], fill=hl)                           # the lit band
        d.point((hx0 + 3, hy - 1), fill=hl)
        d.point((hx1 - 4, hy - 1), fill=hl)
        d.line([(hx0 + 4, hy + 1), (hx1 - 1, hy + 1)], fill=dark(hair, 0.8))              # shade under the fringe
    # race details
    if race == "elvaan":
        d.line([(hx0 + 2, eye_y), (hx0 - 2, eye_y - 4)], fill=skin)                       # the long ear, swept back
        d.point((hx0 - 1, eye_y - 2), fill=sk_d)
    if race == "taru":
        d.rectangle([hx0, eye_y - 1, hx0 + 1, eye_y + 1], fill=skin)                      # round ear
        if sex == "m" and not under:
            d.polygon([(hx0 + 2, hy - 3), (hx0 + 4, hy - 7), (hx0 + 6, hy - 3)], fill=hair)   # the tuft
            d.point((hx0 + 4, hy - 6), fill=hl)
        elif sex == "f":
            d.rectangle([hx0 - 3, hy + 2, hx0, hy + 5], fill=hair)                        # pigtails
            d.rectangle([hx0 - 3, hy + 5, hx0 - 1, hy + 6], fill=hd)
    if race == "mithra" and not under:
        for x0 in (hx0 + 1, hx1 - 3):
            d.polygon([(x0, hy - 2), (x0 + 1, hy - 6), (x0 + 3, hy - 2)], fill=hair)
            d.point((x0 + 1, hy - 4), fill=(240, 180, 170))
    if race == "hume" and sex == "f" and not under and hair_i % 3 == 0:
        d.rectangle([hx0 - 3, hy + 1, hx0 - 1, hy + 3], fill=hair)                       # a ponytail
        d.line([(hx0 - 3, hy + 3), (hx0 - 4, hy + 7)], fill=hd)


def draw_hat(d, hat, hx0, hx1, hy, hy1, body, trim, hair, race):
    w = hx1 - hx0
    if hat == "horns":
        d.rectangle([hx0, hy - 2, hx1, hy + 1], fill=STEEL)
        d.line([(hx0, hy + 2), (hx1, hy + 2)], fill=dark(STEEL))
        d.line([(hx0, hy - 1), (hx0 - 2, hy - 4)], fill=(236, 226, 200))
        d.line([(hx1, hy - 1), (hx1 + 2, hy - 4)], fill=(236, 226, 200))
    elif hat == "band":
        d.line([(hx0, hy + 1), (hx1, hy + 1)], fill=(220, 220, 230))
        d.line([(hx0 - 1, hy + 1), (hx0 - 3, hy + 3)], fill=(220, 220, 230))
    elif hat == "hood_w":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy + 1], fill=(242, 240, 232))
        d.rectangle([hx0 - 1, hy, hx0, hy1 + 1], fill=(242, 240, 232))
        d.polygon([(hx0 + w // 2 - 1, hy - 2), (hx0 + w // 2 + 1, hy - 2), (hx0 + w // 2, hy)], fill=trim)
        d.line([(hx0 - 1, hy + 1), (hx1 + 1, hy + 1)], fill=trim)
    elif hat == "pointy":
        d.rectangle([hx0 - 2, hy, hx1 + 2, hy + 1], fill=body)                             # brim
        d.polygon([(hx0, hy), (hx0 + w // 2 - 1, hy - 7), (hx0 + w // 2 + 3, hy - 9), (hx1, hy)], fill=body)
        d.line([(hx0, hy - 1), (hx1, hy - 1)], fill=trim)
    elif hat == "feather":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy], fill=body)
        d.rectangle([hx0 - 2, hy, hx1 + 2, hy], fill=dark(body))
        d.line([(hx0 + 1, hy - 3), (hx0 - 3, hy - 6)], fill=(240, 240, 240))
        d.line([(hx0 + 2, hy - 3), (hx0 - 2, hy - 7)], fill=(220, 220, 220))
    elif hat == "bandana":
        d.rectangle([hx0, hy - 1, hx1, hy + 1], fill=trim)
        d.line([(hx0 - 1, hy + 1), (hx0 - 3, hy + 2)], fill=trim)
    elif hat == "helm":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy + 2], fill=STEEL)
        d.rectangle([hx0 - 1, hy + 2, hx0 + 1, hy1], fill=STEEL)
        d.line([(hx0 + 2, hy - 3), (hx1 - 2, hy - 3)], fill=(90, 120, 200))                 # plume line
        d.line([(hx0 - 1, hy - 1), (hx1 + 1, hy - 1)], fill=light(STEEL))
    elif hat == "dark_helm":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy + 2], fill=(60, 52, 66))
        d.rectangle([hx0 - 1, hy + 2, hx0 + 1, hy1], fill=(60, 52, 66))
        d.line([(hx1 - 1, hy - 2), (hx1 + 2, hy - 5)], fill=(90, 80, 96))
        d.line([(hx0 + 1, hy - 2), (hx0 - 1, hy - 5)], fill=(90, 80, 96))
        d.point((hx1 - 1, hy + 4), fill=(230, 60, 60))
    elif hat == "fur":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy + 1], fill=(150, 104, 60))
        d.point((hx0, hy - 3), fill=(150, 104, 60))
        d.point((hx1, hy - 3), fill=(150, 104, 60))
    elif hat == "cap_feather":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy], fill=body)
        d.line([(hx1, hy - 2), (hx1 + 4, hy - 5)], fill=(230, 60, 60))
    elif hat == "hood_g":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy + 1], fill=body)
        d.rectangle([hx0 - 1, hy + 1, hx0, hy1], fill=body)
        d.polygon([(hx0 - 1, hy - 2), (hx0 - 3, hy + 2), (hx0, hy + 1)], fill=dark(body))
    elif hat == "kabuto":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy + 1], fill=(50, 46, 50))
        d.rectangle([hx0 - 2, hy + 1, hx0, hy + 4], fill=(50, 46, 50))
        d.line([(hx0 + 2, hy - 3), (hx0 + w // 2, hy - 6), (hx1 - 2, hy - 3)], fill=GOLD)
    elif hat == "mask":
        d.rectangle([hx0, hy - 1, hx1, hy + 1], fill=body)
        d.rectangle([hx0 + 2, hy1 - 2, hx1, hy1], fill=body)
        d.line([(hx0 - 1, hy + 1), (hx0 - 4, hy + 3)], fill=trim)
    elif hat == "drg_helm":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy + 2], fill=(60, 90, 170))
        d.polygon([(hx1, hy - 2), (hx1 + 3, hy), (hx1, hy + 1)], fill=(60, 90, 170))
        d.line([(hx0 + 1, hy - 3), (hx0 - 2, hy - 6)], fill=GOLD)
        d.line([(hx0 + 3, hy - 3), (hx0 + 1, hy - 6)], fill=GOLD)
    elif hat == "horn_hat":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy], fill=body)
        d.line([(hx0 + 2, hy - 2), (hx0 + 1, hy - 6)], fill=trim)
        d.line([(hx1 - 2, hy - 2), (hx1 - 1, hy - 6)], fill=trim)
    elif hat == "turban":
        d.rectangle([hx0 - 1, hy - 3, hx1 + 1, hy + 1], fill=body)
        d.line([(hx0, hy - 2), (hx1, hy)], fill=trim)
        d.point((hx1 - 1, hy - 2), fill=(240, 60, 80))
    elif hat == "tricorne":
        d.rectangle([hx0 - 3, hy - 1, hx1 + 3, hy], fill=(50, 40, 44))
        d.rectangle([hx0 - 1, hy - 4, hx1 + 1, hy - 1], fill=(50, 40, 44))
        d.line([(hx0 - 1, hy - 4), (hx1 + 1, hy - 4)], fill=GOLD)
    elif hat == "jester":
        d.rectangle([hx0 - 1, hy - 2, hx1 + 1, hy], fill=body)
        d.line([(hx0, hy - 2), (hx0 - 3, hy - 5)], fill=trim)
        d.line([(hx1, hy - 2), (hx1 + 2, hy - 5)], fill=body)
        d.point((hx0 - 3, hy - 6), fill=GOLD)
        d.point((hx1 + 2, hy - 6), fill=GOLD)


def draw_weapon(d, weapon, hand, pose):
    x, y = hand
    up = pose in ("atk0", "cast", "win")
    if weapon == "axe":
        if up:
            d.line([(x, y), (x - 1, y - 6)], fill=WOOD)
            d.rectangle([x - 3, y - 7, x, y - 5], fill=STEEL)
        else:
            d.line([(x, y), (x + 5, y - 1)], fill=WOOD)
            d.rectangle([x + 4, y - 3, x + 6, y], fill=STEEL)
    elif weapon == "sword":
        if up:
            d.line([(x, y), (x, y - 8)], fill=STEEL)
            d.line([(x - 1, y - 1), (x + 1, y - 1)], fill=GOLD)
        else:
            d.line([(x, y), (x + 7, y - 2)], fill=STEEL)
            d.line([(x, y - 1), (x, y + 1)], fill=GOLD)
    elif weapon == "greatsword":
        if up:
            d.rectangle([x, y - 11, x + 1, y], fill=STEEL)
            d.line([(x - 1, y - 1), (x + 2, y - 1)], fill=GOLD)
        else:
            d.line([(x, y), (x + 10, y - 3)], fill=STEEL)
            d.line([(x + 1, y + 1), (x + 10, y - 2)], fill=dark(STEEL, 0.85))
            d.line([(x, y - 2), (x, y + 2)], fill=GOLD)
    elif weapon == "greataxe":
        if up:
            d.line([(x, y + 2), (x - 1, y - 9)], fill=WOOD)
            d.rectangle([x - 4, y - 10, x + 2, y - 7], fill=STEEL)
        else:
            d.line([(x - 2, y + 1), (x + 8, y - 2)], fill=WOOD)
            d.rectangle([x + 6, y - 5, x + 9, y + 1], fill=STEEL)
    elif weapon == "greatkatana":
        if up:
            d.line([(x, y + 1), (x - 3, y - 12)], fill=(230, 236, 244))
        else:
            d.line([(x - 1, y + 1), (x + 11, y - 4)], fill=(230, 236, 244))
        d.line([(x, y), (x, y + 1)], fill=(40, 40, 40))
    elif weapon == "dagger" or weapon == "kunai":
        if up:
            d.line([(x, y), (x, y - 4)], fill=STEEL)
        else:
            d.line([(x, y), (x + 4, y - 1)], fill=STEEL)
    elif weapon == "katana":
        if up:
            d.line([(x, y), (x - 2, y - 9)], fill=(230, 236, 244))
        else:
            d.line([(x, y), (x + 8, y - 3)], fill=(230, 236, 244))
        d.point((x, y), fill=(40, 40, 40))
    elif weapon == "scythe":
        top = (x - 1, y - 9) if up else (x + 1, y - 9)
        d.line([(x, y + 3), top], fill=(70, 60, 70))
        d.line([top, (top[0] + 5, top[1] + 2)], fill=STEEL)
    elif weapon == "lance":
        if up:
            d.line([(x, y + 2), (x + 1, y - 10)], fill=(150, 130, 90))
            d.point((x + 1, y - 11), fill=STEEL)
        else:
            d.line([(x - 3, y + 1), (x + 9, y - 2)], fill=(150, 130, 90))
            d.line([(x + 9, y - 2), (x + 11, y - 3)], fill=STEEL)
    elif weapon == "staff":
        d.line([(x, y + 4), (x, y - 8)], fill=WOOD)
        d.point((x, y - 9), fill=(120, 220, 255))
        d.point((x - 1, y - 8), fill=(90, 160, 220))
    elif weapon == "club":
        d.line([(x, y + 1), (x + (0 if up else 3), y - 5)], fill=WOOD)
        d.rectangle([x - 1 + (0 if up else 3), y - 7, x + 1 + (0 if up else 3), y - 5], fill=(200, 190, 150))
    elif weapon == "bow":
        d.arc([x - 1, y - 6, x + 3, y + 4], 270, 90, fill=WOOD)
        d.line([(x + 1, y - 6), (x + 1, y + 4)], fill=(230, 230, 220))
    elif weapon == "harp":
        d.rectangle([x, y - 4, x + 3, y], fill=GOLD)
        d.line([(x + 1, y - 3), (x + 1, y - 1)], fill=(250, 240, 200))
    elif weapon == "gun":
        d.line([(x, y), (x + 5, y - (2 if up else 0))], fill=(70, 70, 80))
        d.point((x, y + 1), fill=WOOD)


def outline(im):
    """A dark outline round the figure, then a light rim on the top-right edges (the old console look)."""
    px = im.load()
    out = im.copy()
    po = out.load()
    for y in range(FH):
        for x in range(FW):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < FW and 0 <= ny < FH and px[nx, ny][3]:
                    po[x, y] = OUTLINE
                    break
    return out


def sheet(race_id, job, hair_i=0):
    s = Image.new("RGBA", (FW * len(FRAMES), FH), (0, 0, 0, 0))
    for i in range(len(FRAMES)):
        s.paste(draw_frame(race_id, job, i, hair_i), (i * FW, 0))
    return s
