"""Portable fishing data for the app, from the game server's own fishing tables (LandSandBoat / Phoenix sql/).

Usage:  python tools/make_fish_data.py SERVER_DIR        (a checkout of Hurami89/xi-forever-offline-server)
Writes src/fishData.json: the era's fishing zones and their spots, which fish (and items) bite there and how often,
each fish's skill level, size and fight numbers, the bait that works on it, and the era's rods.

Era: classic zones up to Treasures of Aht Urhgan. Left out: Abyssea, the [S] past zones and other Wings of the Goddess
zones, Seekers, Adoulin and later, Dynamis, Limbus, battlefields and GM areas, legendary fish, contest fish,
quest-only fish and anything the server has switched off."""
import json
import os
import re
import sys

SRV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'srv')
SQL = os.path.join(SRV, 'sql')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'fishData.json')

# zones that are not era / not real fishing holes
OUT_OF_ERA = {0, 15, 45, 132, 215, 216, 217, 218, 253, 254, 255, 49, 133, 229, 86, 93, 129, 182, 183, 43, 44, 222, 210,
              37, 38, 39, 40, 41, 42, 134, 135, 185, 186, 187, 188, 131}
OUT_OF_ERA |= set(range(80, 100)) | {136, 137, 138, 155, 156, 164, 171, 175} | set(range(256, 400))
# towns: fishing here skills up a little less (the server's "not in a city" bonus)
CITIES = {26, 48, 50, 53, 230, 231, 232, 234, 235, 236, 238, 239, 240, 241, 243, 244, 245, 246, 247, 248, 249, 250, 252}
REGION = {
    "San d'Oria & Norvallen": [100, 101, 230, 231, 232, 190, 167, 104, 149, 196, 105, 195, 140, 142],
    'Bastok & Zulkheim': [106, 107, 234, 235, 236, 172, 191, 102, 103, 193, 248, 173, 143],
    'Windurst & Sarutabaruta': [115, 116, 238, 239, 240, 241, 242, 192, 194, 117, 145, 118, 249, 198, 151, 119, 120],
    'Jeuno, Qufim & the north': [126, 243, 244, 245, 246, 184, 157, 158, 109, 110, 147, 197, 111, 112, 204, 154, 166],
    'Kuzotz & Altepa': [114, 125, 208, 247, 174],
    'Elshimo': [123, 124, 250, 252, 153, 159, 160, 176],
    "Li'Telor & Vollbow": [121, 122, 113, 128, 127, 177, 178, 213],
    'Movalpolos & Lumoria': [11, 12, 13, 130],
    'Tavnazia': [24, 25, 26, 27, 28, 29, 30],
    'Aht Urhgan': [48, 50, 51, 52, 53, 54, 55, 56, 57, 61, 62, 65, 68, 72, 79, 46, 47, 58, 59],
    'Boats & Bibiki Bay': [1, 2, 3, 4, 220, 221, 227, 228],
    'Elsewhere': [],
}


def rows(table):
    """The VALUES tuples of every INSERT in sql/<table>.sql, as Python lists (strings unquoted, numbers as numbers)."""
    text = open(os.path.join(SQL, table + '.sql'), encoding='utf-8', errors='replace').read()
    out = []
    for m in re.finditer(r"INSERT INTO `%s` VALUES \((.*?)\);" % table, text):
        body, vals, cur, q, i = m.group(1), [], '', False, 0
        while i < len(body):
            ch = body[i]
            if q:
                if ch == '\\' and i + 1 < len(body):
                    cur += body[i + 1]
                    i += 2
                    continue
                if ch == "'":
                    q = False
                else:
                    cur += ch
            elif ch == "'":
                q = True
                cur = cur or ''
            elif ch == ',':
                vals.append(cur.strip())
                cur = ''
            else:
                cur += ch
            i += 1
        vals.append(cur.strip())
        out.append([int(v) if re.fullmatch(r'-?\d+', v) else (float(v) if re.fullmatch(r'-?\d+\.\d+', v) else v) for v in vals])
    return out


def comments(table):
    """{(groupid, fishid): name} from the -- comments after fishing_group rows (names of items that are not fish)."""
    text = open(os.path.join(SQL, table + '.sql'), encoding='utf-8', errors='replace').read()
    found = {}
    for m in re.finditer(r"INSERT INTO `%s` VALUES \((\d+),(\d+),(\d+)\);\s*--\s*(.+)" % table, text):
        found[int(m.group(2))] = m.group(4).strip()
    return found


def pretty(name):
    return str(name).replace('_', ' ').replace('dOria', "d'Oria").replace('RuLude', "Ru'Lude").replace('PsoXja', "Pso'Xja") \
        .replace('Ru Aun', "Ru'Aun").replace('RuAun', "Ru'Aun").replace('ZiTah', "Zi'Tah").replace('RoMaeve', "Ro'Maeve") \
        .replace('VeLugannon', "Ve'Lugannon").replace('RuAvitau', "Ru'Avitau").replace('FeiYin', "Fei'Yin") \
        .replace('QuBia', "Qu'Bia").replace('AlTaieu', "Al'Taieu").replace('HuXzoi', "Hu'Xzoi").replace('RuHmet', "Ru'Hmet") \
        .replace('Ifrits', "Ifrit's").replace('Behemoths', "Behemoth's").replace('Sealions', "Sealion's") \
        .replace('Carpenters', "Carpenters'").replace('King Ranperres', "King Ranperre's").replace('Dragons Aery', "Dragon's Aery")


def main():
    zones = {r[0]: {'name': pretty(r[1]), 'difficulty': r[2]} for r in rows('fishing_zone')}
    areas = {}
    for r in rows('fishing_area'):
        areas[(r[0], r[1])] = r[2]
    fish_cols = ['fishid', 'name', 'skill_level', 'difficulty', 'base_delay', 'base_move', 'min_length', 'max_length',
                 'ranking', 'size_type', 'water_type', 'log', 'quest', 'quest_status', 'flags', 'hour_pattern',
                 'moon_pattern', 'month_pattern', 'legendary', 'legendary_flags', 'item', 'max_hook', 'rarity',
                 'required_keyitem', 'required_catches', 'family', 'quest_only', 'contest', 'disabled']
    fish = {}
    for r in rows('fishing_fish'):
        f = dict(zip(fish_cols, r))
        if f['disabled'] or f['quest_only'] or f['contest'] or f['legendary'] or f['required_keyitem']:
            continue
        fish[f['fishid']] = f
    groups = {}
    for gid, fid, rarity in rows('fishing_group'):
        groups.setdefault(gid, []).append((fid, rarity))
    names = comments('fishing_group')
    catch = {}
    for zid, aid, gid in rows('fishing_catch'):
        catch.setdefault((zid, aid), []).append(gid)
    affinity = {}
    for baitid, fid, power in rows('fishing_bait_affinity'):
        affinity.setdefault(fid, {})[baitid] = power
    baits = {}
    for r in rows('fishing_bait'):
        baits[r[0]] = {'id': r[0], 'name': r[1], 'lure': r[2] == 1, 'hooks': r[3], 'losable': r[4] == 1}
    rods = {}
    for r in rows('fishing_rod'):
        rodid, name, material, size, flags, min_rank, max_rank, attack, lgd_attack, recovery, ftime = r[:11]
        legendary, rating = r[20], r[21]
        # (2026-11-25, Hasuko: the app only showed the first rod) the rods that can also land legendary fish (Lu Shang's,
        # Ebisu, Judges) were left out, so a character holding one only saw its other rod. They fish normally here
        # (the legendary fish themselves stay out).
        if name in ('Goldfish Basket', 'Maze Monger Fishing Rod'):
            continue
        rods[rodid] = {'id': rodid, 'name': name, 'large': size == 1, 'attack': attack, 'recovery': recovery,
                       'time': ftime, 'rating': rating, 'minRank': min_rank, 'maxRank': max_rank}

    used_fish, used_bait = set(), set()
    out_zones = []
    for (zid, aid), gids in sorted(catch.items()):
        if zid in OUT_OF_ERA or zid not in zones:
            continue
        pool = {}
        for gid in gids:
            for fid, rarity in groups.get(gid, []):
                if fid in fish:
                    pool[fid] = max(pool.get(fid, 0), rarity)
                elif fid not in fish and fid < 90000 and fid in names and not any(fid == f for f in fish):
                    pass
        if not pool:
            continue
        zone = next((z for z in out_zones if z['id'] == zid), None)
        if zone is None:
            region = next((k for k, v in REGION.items() if zid in v), 'Elsewhere')
            zone = {'id': zid, 'name': zones[zid]['name'], 'region': region, 'city': zid in CITIES, 'spots': []}
            out_zones.append(zone)
        zone['spots'].append({'id': aid, 'name': areas.get((zid, aid), 'Whole Zone'),
                              'pool': [[fid, rar] for fid, rar in sorted(pool.items(), key=lambda x: -x[1])]})
        used_fish |= set(pool)

    out_fish = {}
    for fid in sorted(used_fish):
        f = fish[fid]
        bait = affinity.get(fid, {})
        used_bait |= set(bait)
        out_fish[fid] = {'id': fid, 'name': f['name'], 'skill': f['skill_level'], 'diff': f['difficulty'],
                         'delay': f['base_delay'], 'move': f['base_move'], 'min': f['min_length'], 'max': f['max_length'],
                         'rank': f['ranking'], 'large': f['size_type'] == 1, 'item': f['item'] == 1,
                         'bait': {str(k): v for k, v in bait.items()}}
    out_zones.sort(key=lambda z: (list(REGION).index(z['region']), z['name']))
    data = {
        'version': 1,
        'source': 'xi-forever-offline-server sql/fishing_*.sql',
        'zones': out_zones,
        'fish': out_fish,
        'bait': {str(k): v for k, v in sorted(baits.items()) if k in used_bait},
        'rods': {str(k): v for k, v in sorted(rods.items())},
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, separators=(',', ':'))
    print(f"zones {len(out_zones)}, spots {sum(len(z['spots']) for z in out_zones)}, fish/items {len(out_fish)}, "
          f"bait {len(data['bait'])}, rods {len(data['rods'])}, {os.path.getsize(OUT) // 1024} KB")


if __name__ == '__main__':
    main()
