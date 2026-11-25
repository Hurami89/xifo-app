// The armory on xiforever.com (dev/armory/armory_service.py in the kit repo): pairing with a launcher, this phone's
// characters (ME tab) and sending portable fishing catches back (FISH tab).
import { getRandomBytes } from 'expo-crypto';
import { getJSON, LINKS, setJSON } from './store';

export type Equip = { slot: number; id: number; name: string };
export type Mate = { name: string; race: number; face: number; mjob: number; sjob: number; level: number; role?: string; equip: Equip[] };
export type Card = {
  name: string; race: number; face: number; size: number; nation: number; mjob: number; sjob: number; mlvl: number; slvl: number;
  hp: number; mp: number; jobs: Record<string, number>; equip: Equip[]; crafts: Record<string, { skill: number; rank: number }>;
  rank: number; fame: Record<string, number>; quests: number; titles: number; keyitems: number; playtime: number; gil: number;
  hardcore: { mode: number; dead: boolean; deaths: number } | null; squad: Mate[]; world: string;
  fishing: { skill: number; rank: number; cap: number; rate?: number; rods: { id: number; name: string }[];
    bait: { id: number; name: string; qty: number }[]; catches?: number };
  _vis: 'public' | 'link' | 'hidden'; _synced: number; _link: string;
};
export type Pending = { id: string; char: string; made: number; count: number; skill: number; gil: number };

export const JOBS = ['WAR', 'MNK', 'WHM', 'BLM', 'RDM', 'THF', 'PLD', 'DRK', 'BST', 'BRD', 'RNG', 'SAM', 'NIN', 'DRG', 'SMN', 'BLU',
  'COR', 'PUP', 'DNC', 'SCH', 'GEO', 'RUN'];
export const ERA_JOBS = JOBS.slice(0, 18);
export const RACES: Record<number, [string, string]> = { 1: ['Hume', 'Male'], 2: ['Hume', 'Female'], 3: ['Elvaan', 'Male'],
  4: ['Elvaan', 'Female'], 5: ['Tarutaru', 'Male'], 6: ['Tarutaru', 'Female'], 7: ['Mithra', 'Female'], 8: ['Galka', 'Male'] };
export const NATIONS = ["San d'Oria", 'Bastok', 'Windurst'];
export const MODES: Record<number, string> = { 1: 'Iron', 2: 'Steel', 3: 'Silver', 4: 'Randomized' };

export const jobLine = (c: { mjob: number; mlvl: number; sjob: number; slvl: number }) =>
  `${JOBS[c.mjob - 1]}${c.mlvl}` + (c.sjob ? `/${JOBS[c.sjob - 1]}${c.slvl}` : '');

export async function siteUrl(): Promise<string> {
  return ((await getJSON<string>('armory.url', '')) || LINKS.website).replace(/\/+$/, '');
}

async function phoneKey(): Promise<string> {
  const have = await getJSON<string>('armory.phone', '');
  if (/^[0-9a-f]{32}$/.test(have)) return have;
  const key = Array.from(getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
  await setJSON('armory.phone', key);
  return key;
}

async function call(path: string, body?: unknown): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch((await siteUrl()) + '/armory/api' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Armory-Phone': await phoneKey() },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) return { error: data.error || 'This phone is not paired.', unpaired: true };
    if (!res.ok && !data.error) data.error = `xiforever.com answered ${res.status}.`;
    return data;
  } catch {
    return { error: "Can't reach xiforever.com. Check your connection.", offline: true };
  } finally {
    clearTimeout(t);
  }
}

export async function claim(code: string): Promise<{ ok?: boolean; names?: string[]; error?: string }> {
  return call('/claim', { code });
}

export async function me(): Promise<{ cards?: Card[]; pending?: Pending[]; error?: string; unpaired?: boolean; offline?: boolean }> {
  const out = await call('/me');
  if (out.cards) await setJSON('armory.me', { cards: out.cards, pending: out.pending || [], at: Date.now() });
  return out;
}

export async function cachedMe(): Promise<{ cards: Card[]; pending: Pending[]; at: number } | null> {
  return getJSON('armory.me', null);
}

export type Report = { id: string; char: string; catches: { item: number; count: number; name: string }[]; skill: number;
  gil: number; gilFound: number; bait: { item: number; count: number }[] };

export async function sendReport(r: Report): Promise<{ ok?: boolean; error?: string; offline?: boolean }> {
  return call('/fish', r);
}

export const newId = () => 'f' + Array.from(getRandomBytes(10), (b) => b.toString(16).padStart(2, '0')).join('');
