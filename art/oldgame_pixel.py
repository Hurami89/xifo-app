"""Turns Kaza's old-game art (his own, drawn by hand, given to us to use) into Ventures pixel art.

  python art/oldgame_pixel.py preview      a test sheet:  art/oldgame-preview.png
  python art/oldgame_pixel.py build        everything into art/venture-pack/ (then run make_pixel_ventures.py)

Source: art/oldgame-src/{sv_enemies,sv_actors,battlebacks1}/ (unpacked from old-hame-assets.zip; not in git).
  * monsters (RPG Maker side-view battlers, painted or rendered): cut out, shrunk to a 32 x 32 sprite with a small
    palette and a dark outline (the 16-bit look), turned to face the party, four frames made from the one picture
    (idle, bob, lunge, hurt flash)
  * heroes (Aeodin, Dario, Kayame, Lazulai in every job; RPG Maker side-view sheets, 9 x 6 frames of 64): mirrored to
    face right, shrunk to 40 x 40 frames, palette cut, in the app's 10-frame order
  * battle backgrounds (1280 x 720 paintings of FFXI zones): shrunk to the 240 x 126 stage, palette cut (painted pixels)
"""
import io
import os
import struct
import sys

from PIL import Image, ImageEnhance, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'oldgame-src')
PACK = os.path.join(HERE, 'venture-pack')
INK = (28, 20, 32, 255)


def load(path):
    """Open a PNG; if its metadata (Photoshop text blocks etc.) trips PIL up, keep only the picture chunks."""
    try:
        im = Image.open(path)
        im.load()
        return im
    except Exception:
        b = open(path, 'rb').read()
        out, i = [b[:8]], 8
        while i < len(b):
            n, = struct.unpack('>I', b[i:i + 4])
            if b[i + 4:i + 8] in (b'IHDR', b'PLTE', b'tRNS', b'IDAT', b'IEND'):
                out.append(b[i:i + 12 + n])
            i += 12 + n
        im = Image.open(io.BytesIO(b''.join(out)))
        im.load()
        return im


def cutout(im):
    im = im.convert('RGBA')
    bb = im.split()[3].point(lambda a: 255 if a > 24 else 0).getbbox()
    return im.crop(bb) if bb else im


def shrink(im, w, h):
    """Premultiplied two-step shrink so edges don't pick up dark fringes."""
    big = im.resize((w * 4, h * 4), Image.LANCZOS)
    r, g, b, a = big.split()
    pm = Image.merge('RGB', [Image.composite(c, Image.new('L', big.size, 0), a) for c in (r, g, b)])
    pm = pm.resize((w, h), Image.BOX)
    a2 = a.resize((w, h), Image.BOX)
    px, pa = pm.load(), a2.load()
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    po = out.load()
    for y in range(h):
        for x in range(w):
            al = pa[x, y]
            if al > 110:
                c = px[x, y]
                k = 255 / al
                po[x, y] = (min(255, int(c[0] * k)), min(255, int(c[1] * k)), min(255, int(c[2] * k)), 255)
    return out


def palette(im, colors):
    rgb = im.convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(1.15)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.08)
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = q.convert('RGBA')
    out.putalpha(im.split()[3])
    return out


def ink(im):
    """A dark outline round the sprite (the old console look)."""
    w, h = im.size
    src = im.load()
    out = im.copy()
    po = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3]:
                    po[x, y] = INK
                    break
    return out


# ------------------------------------------------------------------ monsters
def mob_sprite(path, size=32, colors=20, face_left=True):
    im = cutout(load(path))
    s = (size - 2) / max(im.width, im.height)
    w, h = max(4, round(im.width * s)), max(4, round(im.height * s))
    spr = ink(palette(shrink(im, w, h), colors))
    if face_left:
        spr = ImageOps.mirror(spr)        # RPG Maker's enemies face right (toward a party on the right)
    return spr


def mob_sheet(spr, size=32):
    """idle, bob, lunge, hurt flash: 4 frames of size x size, feet on the bottom row."""
    sheet = Image.new('RGBA', (size * 4, size), (0, 0, 0, 0))
    x0 = (size - spr.width) // 2
    y0 = size - spr.height
    for i in range(4):
        f = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        dx, dy = {0: (0, 0), 1: (0, 1), 2: (-3, 0), 3: (1, 0)}[i]
        s = spr
        if i == 1 and spr.height > 6:      # a small squash for the breathing frame
            s = spr.resize((spr.width, spr.height - 1), Image.NEAREST)
        if i == 3:
            px = s.copy().load()
            s = s.copy()
            p2 = s.load()
            for y in range(s.height):
                for x in range(s.width):
                    r, g, b, a = p2[x, y]
                    if a and (r, g, b) != INK[:3]:
                        p2[x, y] = (min(255, r + 110), min(255, g + 110), min(255, b + 110), a)
        f.alpha_composite(s, (max(0, x0 + dx), max(0, y0 + dy + (1 if i == 1 else 0) - (1 if i == 1 else 0))))
        sheet.alpha_composite(f, (i * size, 0))
    return sheet


# ------------------------------------------------------------------ heroes
MV = 64            # RPG Maker MV side-view frame
MOTION = {'walk': 0, 'wait': 1, 'chant': 2, 'guard': 3, 'damage': 4, 'evade': 5, 'thrust': 6, 'swing': 7, 'missile': 8,
          'skill': 9, 'spell': 10, 'item': 11, 'escape': 12, 'victory': 13, 'dying': 14, 'abnormal': 15, 'sleep': 16, 'dead': 17}
# the app's 10 frames: idle0 idle1 walk0 walk1 atk0 atk1 cast hurt sit win
ORDER = [('wait', 0), ('wait', 1), ('walk', 0), ('walk', 2), ('swing', 0), ('swing', 2), ('spell', 1), ('damage', 0),
         ('dying', 1), ('victory', 1)]
HERO = 40


def mv_frame(sheet, motion, k):
    m = MOTION[motion]
    col, row = m // 6, m % 6
    return sheet.crop(((col * 3 + k) * MV, row * MV, (col * 3 + k + 1) * MV, (row + 1) * MV))


def hero_sheet(path, colors=28):
    src = load(path).convert('RGBA')
    out = Image.new('RGBA', (HERO * len(ORDER), HERO), (0, 0, 0, 0))
    for i, (motion, k) in enumerate(ORDER):
        fr = ImageOps.mirror(mv_frame(src, motion, k))           # MV's party faces left; ours faces right
        fr = palette(shrink(fr, HERO, HERO), colors)
        out.alpha_composite(fr, (i * HERO, 0))
    return out


# ------------------------------------------------------------------ backgrounds
def backdrop(path, colors=56):
    im = load(path).convert('RGB')
    small = im.resize((240, 135), Image.LANCZOS)
    small = small.crop((0, 9, 240, 135))                          # keep the ground: the party stands low
    small = ImageEnhance.Color(small).enhance(1.1)
    return small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


def preview():
    bg = backdrop(os.path.join(SRC, 'battlebacks1', 'Bububeach.png'))
    bg2 = backdrop(os.path.join(SRC, 'battlebacks1', 'CRAWLERBB.png'))
    heroes = [hero_sheet(os.path.join(SRC, 'sv_actors', n + '.png')) for n in ('AeodinWar', 'KayameBlm', 'DarioThf', 'LazulaiWhm')]
    mobs = [mob_sheet(mob_sprite(os.path.join(SRC, 'sv_enemies', n + '.png'))) for n in
            ('Crab_1_(FFXI)', 'Bee_1_(FFXI)', 'Colibri', 'Adamantoise', 'BSTCRAB', 'Crawler_1_(FFXI)')]
    W, H = 240, 126
    sheet = Image.new('RGB', (W * 2 + 4, H * 2 + 4 + 48), (0, 0, 0))
    for j, (b, mi) in enumerate(((bg, 0), (bg2, 5))):
        scene = b.convert('RGBA')
        for i, (x, y) in enumerate(((100, 110), (78, 120), (62, 102), (40, 116))):
            fr = heroes[i].crop((0, 0, HERO, HERO))
            scene.alpha_composite(fr, (x - HERO // 2, y - HERO))
        m = mobs[mi].crop((0, 0, 32, 32)).resize((43, 43), Image.NEAREST)
        scene.alpha_composite(m, (182 - 21, 112 - 43))
        sheet.paste(scene.convert('RGB'), (j * (W + 4), 0))
    strip = Image.new('RGBA', (W * 2 + 4, H + 4 + 48), (60, 80, 70, 255))
    for i, hs in enumerate(heroes):
        strip.alpha_composite(hs.crop((0, 0, HERO * 6, HERO)), (0, i * 30 if i < 2 else 0) if False else ((i % 2) * 242, (i // 2) * 42))
    for i, ms in enumerate(mobs):
        strip.alpha_composite(ms.crop((0, 0, 32, 32)), (i * 40, 90))
    sheet.paste(strip.convert('RGB'), (0, H + 4))
    sheet = sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST)
    sheet.save(os.path.join(HERE, 'oldgame-preview.png'))
    print('preview -> art/oldgame-preview.png')




# ------------------------------------------------------------------ the full build
# Which of his monsters stands for each camp monster (by the name the app shows); the rest keep the drawn looks.
MOB_FOR = {
    'Forest Hare': 'Rabbit_1_(FFXI)', 'Carrion Worm': 'worm', 'Scarab Beetle': 'Beetle_1_(FFXI)', 'Forest Funguar': 'funguar',
    'Wild Sheep': 'sheep', 'Stone Eater': 'worm', 'Maneating Hornet': 'bumblebee', 'Walking Sapling': 'sapling1',
    'Rock Lizard': 'Lizard_1_(FFXI)', 'Ornery Sheep': 'sheep2', 'Savanna Rarab': 'rarab', 'Crawler': 'crawler',
    'Mandragora': 'Mandragora_1_(FFXI)', 'River Crab': 'crab2', 'Pug Pugil': 'pugil', 'Giant Bee': 'Bee_1_(FFXI)',
    'Steppe Hare': 'rarab2', 'Strolling Sapling': 'sapling2', 'Rock Eater': 'worm2', 'Huge Wasp': 'diggerwasp',
    'Mad Sheep': 'sheep', 'Akbaba': 'lesserbirdvulture', 'Mist Lizard': 'Lizard_1_(FFXI)', 'Canyon Rarab': 'caverarab',
    'Pygmaioi': 'kolshushu_pygmaioi', 'Killer Bee': 'Bee_1_(FFXI)', 'Canyon Crawler': 'earthcrawler', 'Wild Dhalmel': 'Dhalmel_(FFXI)',
    'Hill Lizard': 'Lizard_1_(FFXI)', 'Sand Hare': 'rarab4', 'Goblin Ambusher': 'goblin', 'Goblin Butcher': 'goblin5',
    'Goblin Tinkerer': 'maze-goblintinkerer', 'Goblin Mugger': 'goblinnn', 'Snipper': 'kolshushu_snipper',
    'Damselfly': 'damselfly1', 'Brutal Sheep': 'sheep2', 'Thread Leech': 'leech', 'Beach Pugil': 'beachpugil',
    'Zu': 'kolshushu_bird3', 'Carnivorous Crawler': 'kolshushu_crawler', 'Bull Dhalmel': 'Dhalmel_(FFXI)', 'Sylvestre': 'BSTMANDY',
    'Forest Leech': 'leech', 'Stag Beetle': 'Beetle_1_(FFXI)', 'Land Pugil': 'ghelsbapugil', 'Jugner Funguar': 'funguar2',
    'Forest Tiger': 'Tiger_1_(FFXI)', 'Clipper': 'crab2', 'Greater Pugil': 'pugil2', 'Giant Ranger': 'Gigas_1_(FFXI)',
    'Giant Ascetic': 'Gigas_2_(FFXI)', 'Giant Trapper': 'tower-gigas', 'Giant Hunter': 'Gigas_1_(FFXI)', 'Huge Spider': 'Spider_1_(FFXI)',
    'Combat': 'Bat', 'Wendigo': 'Skeleton_4_(FFXI)', 'Amphisbaena': 'worm2', 'Sadfly': 'damselfly3', 'Mauthe Doog': 'deathhound',
    'Myconid': 'clfunguar', 'Death Wasp': 'diggerwasp', 'Berry Grub': 'giantgrub', 'Goobbue Farmer': 'goobue', 'Moon Bat': 'batalternate',
    'Sauromugue Skink': 'Lizard_1_(FFXI)', 'Diving Beetle': 'copperbeetle', 'Champaign Coeurl': 'Coeurl_1_(FFXI)',
    'Tabar Beak': 'kolshushu_axebeak', 'Yuhtunga Mandragora': 'Mandragora_1_(FFXI)', 'Ivory Lizard': 'Lizard_1_(FFXI)',
    'Death Jacket': 'deathjacket', 'Young Opo-opo': 'temple-templeopoopo', 'Goblin Smithy': 'goblin5', 'Goblin Furrier': 'goblin',
    'Coralline Uragnite': 'purongoro-coastlineuragnite', 'Jagil': 'remora', 'Coastal Opo-opo': 'purongoro-coastalopoopo',
    'Alraune': 'purongoro-alarune', 'Toucan': 'kolshushu_bird', 'Eft': 'bibiki-eft', 'Yagudo Herald': 'new-yagudo1',
    'Yagudo Drummer': 'castleo-chanter', 'Yagudo Oracle': 'new-yagudo2', 'Yagudo Interrogator': 'castleo-templar', 'Bulwark Bat': 'Bat',
    'Flesh Eater': 'worm2', 'Hecteyes': 'pso-hecteyes', 'Gallinipper': 'zitah-gnat', 'Tracer Antlion': 'Antlion_1_(FFXI)',
    'Doom Scorpion': 'scorpionbrown', 'Gigantobugard': 'zitah-nmbugard', 'Bugard': 'zitah-nmbugard', 'Tavnazian Sheep': 'sheep',
    'Mantrap': 'clflytrap2', 'Yhoator Wasp': 'temple-templebee', 'White Lizard': 'leapinglizzie', 'Worker Crawler': 'crawler',
    'Goblin Reaper': 'goblin4', 'Brook Sahagin': 'sahagin1', 'Rivulet Sahagin': 'sahagin2', 'Riparian Sahagin': 'sahagin3',
    'Bigclaw': 'crab2', 'Ironshell': 'rockcrab', 'Royal Leech': 'leech2', 'Soldier Crawler': 'Crawler_2_(FFXI)',
    'Maze Lizard': 'leapinglizzie', 'Nest Beetle': 'Beetle_1_(FFXI)', 'Labyrinth Lizard': 'Lizard_1_(FFXI)', 'Siege Bat': 'Bat_Trio_1_(FFXI)',
    'Borer Beetle': 'Beetle_1_(FFXI)', 'Citadel Bats': 'Bat_Trio_2_(FFXI)', 'Wingrats': 'ratato', 'Demonic Weapon': 'evilweapon3',
    'Tonberry Creeper': 'temple-tonberry1', 'Tonberry Hexer': 'temple-tonberry2', 'Master Coeurl': 'Coeurl_2_(FFXI)',
    'Goblin Poacher': 'goblin4', 'Yagudo Zealot': 'castleo-assassin', 'Yagudo Conquistador': 'new-yagudo1',
    'Yagudo Lutenist': 'castleo-chanter', 'Yagudo Prior': 'castleo-abbott', 'Hawker': 'damselfly5', 'Makara': 'pugil2',
    'Greater Gaylas': 'zitah-lessergaylas', 'Goblin Robber': 'goblinnn', 'Cockatrice': 'cockatrice1', 'Mushussu': 'lizard-nm1',
    'Goblin Miner': 'goblin4', 'Goblin Bouncer': 'goblin5', 'Flying Manta': 'remora', 'Hornfly': 'damselfly5', 'Exoray': 'ochu',
    'Blazer Beetle': 'copperbeetle', 'Witch Hazel': 'BSTMANDY', 'Soul Stinger': 'diggerwasp', 'Funnel Bats': 'Bat_Trio_1_(FFXI)',
    'Fallen Officer': 'Skeleton_Mace_Shield_(FFXI)', 'Explosure': 'Bomb3', 'Chamber Beetle': 'copperbeetle',
    'Marsh Sahagin': 'sahagin2', 'Swamp Sahagin': 'sahagin4', 'Bog Sahagin': 'sahagin3', 'Rock Crab': 'rockcrab',
    'Razorjaw Pugil': 'horrorpugil', 'Variable Hare': 'new-rabbit', 'Snoll': 'pso-snoll', 'Uleguerand Tiger': 'xarctiger',
    'Buffalo': 'ram', 'Glacier Eater': 'worm2', 'Robber Crab': 'rockcrab', 'Cave Worm': 'landworm', 'Sand Lizard': 'Lizard_1_(FFXI)',
    'Recluse Spider': 'sandspider', 'Tomb Worm': 'krtWorm', 'Dire Bat': 'Giant_Bat_1_(FFXI)', 'Cherry Sapling': 'krtSapling',
    'Armet Beetle': 'Beetle_1_(FFXI)', 'Bark Spider': 'boyhayda-barktaratuntula', 'Death Cap': 'boyhayda-deathcap',
    'Mourioche': 'BSTMANDY', 'Moss Eater': 'worm', 'Worker Pephredo': 'kolshushu_bee', 'Lesser Colibri': 'Colibri',
    'Aht Urhgan Attercop': 'Spider_3_(FFXI)', 'Wajaom Tiger': 'Tiger_1_(FFXI)', 'Old Opo-opo': 'Opo-Opo_1_(FFXI)',
    'Volcano Wasp': 'diggerwasp', 'Dodomeki': 'kolshushu_bird2', 'Marsh Murre': 'lesserbirdblue', 'Chigoe': 'nm-megachigoesmall1',
    'Puktrap': 'temple-puk', 'Wild Karakul': 'sheep2', 'Caedarva Leech': 'leech2', 'Tonberry Trailer': 'Tonberry_1_(FFXI)',
    'Tonberry Slasher': 'tonberry-katana', 'Mousse': 'nm-Mousse', 'Tonberry Beleaguerer': 'Tonberry_2_(FFXI)', 'Colibri': 'Colibri',
    'Treant Sapling': 'sapling3', 'Robber Crab SSG': 'rockcrab', 'Shore Sahagin': 'sahagin1', 'Delta Sahagin': 'sahagin4',
    'Devil Manta': 'remora', 'Greatclaw': 'BSTcrabking', 'Deinonychus': 'Raptor_1_(FFXI)', 'Sabotender Sediendo': 'Sabotender_1_(FFXI)',
    'Haunt': 'ghost2', 'Fossorial Flea': 'nm-megachigoesmall2', 'Phlebotomic Slug': 'ordSlug', 'Slime Mold': 'slimeearth',
    'Defoliator': 'caterpillar', 'Mycohopper': 'funguar2', 'Mold Eater': 'worm', 'Velociraptor': 'Raptor_1_(FFXI)',
    'Peryton': 'sky-hippgryph', 'Polar Hare': 'rarab3', 'Nival Raptor': 'Raptor_2_(FFXI)', 'Mountain Worm': 'Worm_1_(FFXI)',
    'Giant Buffalo': 'ram', 'Mindgazer': 'Ahriman_1', 'Monarch Ogrefly': 'damselfly5', 'Cutlass Scorpion': 'Scorpion_1_(FFXI)',
    'Tracker Antlion': 'Antlion_1_(FFXI)', 'Magmatic Eruca': 'caterpillar', 'Zhayolm Apkallu': 'bstApkallu', 'Assassin Fly': 'damselfly5',
    'Mountain Clot': 'slimefire', 'Sicklemoon Jagil': 'remora', 'Carriage Lizard': 'Lizard_1_(FFXI)', 'Puk': 'temple-puk',
    'Hunting Raptor': 'Raptor_2_(FFXI)', 'Korrigan': 'BSTMANDY', 'Processionaire': 'caterpillar', 'Skimmer': 'damselfly3',
    'Elder Goobbue': 'boyhayda-eldergoobue', 'Darter': 'damselfly5',
    'Dire Bat UDT TC': 'Giant_Bat_1_(FFXI)', 'Droma': 'hound', 'Locus Armet Beetle': 'Beetle_1_(FFXI)',
    'Locus Tomb Worm': 'krtWorm',   # Mamool Ja: none in his set, so they keep the drawn look
}
# Which painted battle background each camp scene uses (his paintings of the zones)
BG_FOR = {
    'ronfaure': 'RonfaureEastBB', 'gustaberg': 'GustabergBB', 'sarutabaruta': 'SarutaBG', 'latheine': 'bb-plains',
    'konschtat': 'KONBB', 'tahrongi': 'tahrongi', 'valkurm': 'ValkDunesBB', 'buburimu': 'buburimupenninsula', 'jugner': 'JugnerBB',
    'qufim': 'qufimtower', 'korroloka': 'CaveBB', 'gusgen': 'gusgen', 'rolanberry': 'Rolanberry', 'sauromugue': 'sauromuguechampaign',
    'yuhtunga': 'JUNGLEBB', 'bibiki': 'bbPuronogoIsle', 'oztroja': 'bbCastleOztroja', 'misareaux': 'bbBlurrycliff',
    'yhoator': 'JUNGLEBB', 'ssg': 'SSGBB', 'crawlers': 'CRAWLERBB', 'garlaige': 'Garliage1', 'gustav': 'KTunnelBB',
    'onzozo': 'BBLoO', 'uleguerand': 'iceexpanse', 'kuftal': 'QSANDBB', 'krt': 'bbRanperreInterior',
    'boyahda': 'boyhaydatree-interior', 'ifrits': 'CAULDRONBB0', 'den': 'DENBB', 'valley': 'bbValde', 'attohwa': 'bb-Mold',
    'caedarva': 'bb-Bugs', 'zhayolm': 'LavaPlatform', 'mamook': 'JUNGLEBB', 'wajaom': 'bb-Wild', 'bhaflau': 'mysticgrove2',
    'aydeewa': 'undergroundruins',
}
HEROES = ['Aeodin', 'Dario', 'Kayame', 'Lazulai']
JOB_FILE = {'WAR': 'War', 'MNK': 'Mnk', 'WHM': 'Whm', 'BLM': 'Blm', 'RDM': 'Rdm', 'THF': 'Thf', 'PLD': 'Pld', 'DRK': 'Drk',
            'BST': 'Bst', 'BRD': 'Brd', 'RNG': 'Rng', 'SAM': 'Sam', 'NIN': 'Nin', 'DRG': 'Drg', 'SMN': 'Smn', 'BLU': 'Blu',
            'COR': 'Cor', 'PUP': 'Pup'}
MOB_SIZE = 40


def safe(name):
    return ''.join(c if c.isalnum() else '_' for c in name)


def build():
    out_bg, out_mob, out_hero = (os.path.join(PACK, d) for d in ('bg', 'mt', 'h'))
    for d in (out_bg, out_mob, out_hero):
        os.makedirs(d, exist_ok=True)
    nb = nm = nh = 0
    for scene, name in BG_FOR.items():
        path = os.path.join(SRC, 'battlebacks1', name + '.png')
        try:
            backdrop(path).save(os.path.join(out_bg, scene + '.png'))
            nb += 1
        except Exception as e:
            print('background', scene, name, 'skipped:', e)
    done = {}
    for shown, name in MOB_FOR.items():
        path = os.path.join(SRC, 'sv_enemies', name + '.png')
        try:
            if name not in done:
                done[name] = mob_sheet(mob_sprite(path, MOB_SIZE, 24), MOB_SIZE)
            done[name].save(os.path.join(out_mob, safe(shown) + '.png'))
            nm += 1
        except Exception as e:
            print('monster', shown, name, 'skipped:', e)
    for hero in HEROES:
        for job, f in JOB_FILE.items():
            path = os.path.join(SRC, 'sv_actors', hero + f + '.png')
            try:
                hero_sheet(path).save(os.path.join(out_hero, f'{hero}_{job}.png'))
                nh += 1
            except Exception as e:
                print('hero', hero, job, 'skipped:', e)
    print(f'{nb} backgrounds, {nm} monsters, {nh} hero sheets -> art/venture-pack')


if __name__ == '__main__':
    {'preview': preview, 'build': build}[sys.argv[1] if len(sys.argv) > 1 else 'preview']()
