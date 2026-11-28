// Portable fishing: the rules. Data is the server's own (src/fishData.json, made by tools/make_fish_data.py from
// sql/fishing_*.sql). Hook chances, the "too big for your skill" loss and skill-ups follow the server's fishingutils.cpp;
// the fight itself is a phone version of the game's arrows-and-stamina fight.
import DATA from '../fishData.json';

export type Fish = { id: number; name: string; skill: number; diff: number; delay: number; move: number; min: number; max: number;
  rank: number; large: boolean; item: boolean; bait: Record<string, number> };
export type Rod = { id: number; name: string; large: boolean; attack: number; recovery: number; time: number; rating: number; minRank: number; maxRank: number };
export type Bait = { id: number; name: string; lure: boolean; hooks: number; losable: boolean };
export type Spot = { id: number; name: string; pool: [number, number][] };
export type Zone = { id: number; name: string; region: string; city: boolean; spots: Spot[] };

export const FISH = DATA.fish as unknown as Record<string, Fish>;
export const RODS = DATA.rods as unknown as Record<string, Rod>;
export const BAIT = DATA.bait as unknown as Record<string, Bait>;
export const ZONES = DATA.zones as unknown as Zone[];
export const GIL_ITEM = 65535;
export const LOANER_ROD = 17391;          // Willow Fishing Rod: the phone lends one when the character has none

// Bait sold in the phone's tackle shop, for the character's gil (XIFO's own prices). Lures are never used up.
export const SHOP: Record<number, number> = {
  17396: 4, 16995: 9, 16996: 10, 16997: 12, 16998: 12, 16999: 12, 16993: 16, 17392: 16, 16994: 20, 17000: 22, 17395: 30,
  16992: 40, 17393: 40, 17397: 40, 17005: 60, 17394: 70, 17001: 250,
  17407: 350, 17400: 450, 17404: 500, 17405: 500, 17402: 600, 17403: 600, 17401: 800, 17399: 1000, 17002: 1500, 17398: 1800,
};
export const STARTER: Record<number, number> = { 17396: 24, 16998: 12 };      // free once per character

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));

export function regions(): string[] {
  return Array.from(new Set(ZONES.map((z) => z.region)));
}

/** What bites on this cast: a fish, an item, or nothing. Chances as the server works them out (GetHookChance). */
export function rollHook(spot: Spot, bait: Bait, skill: number, rod: Rod): { fish: Fish | null; critical: boolean } {
  const candidates: { fish: Fish; weight: number }[] = [];
  for (const [fid, rarity] of spot.pool) {
    const f = FISH[String(fid)];
    if (!f) continue;
    const power = f.item ? 1 : f.bait[String(bait.id)] || 0;
    if (!power) continue;
    let hook = { 1: bait.lure ? 30 : 35, 2: bait.lure ? 60 : 65, 3: bait.lure ? 75 : 80 }[Math.min(3, power) as 1 | 2 | 3];
    if (f.skill > skill) hook -= Math.min(hook, Math.floor((f.skill - skill) * 0.25));
    if (skill - 10 > f.skill) hook -= Math.min(hook, Math.floor((skill - 10 - f.skill) * 0.15));
    // the server's rod penalty: a fish smaller than the rod -3, bigger than the rod -5; then rarity, kept within 20..120
    if (rod.large && !f.large) hook -= Math.min(hook, 3);
    else if (!rod.large && f.large) hook -= Math.min(hook, 5);
    if (rarity < 1000) hook = Math.floor(hook * (rarity / 1000));
    candidates.push({ fish: f, weight: Math.max(20, Math.min(120, hook)) });
  }
  if (!candidates.length) return { fish: null, critical: false };
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  // the chance that anything bites at all grows with the best hook chance here
  const best = Math.max(...candidates.map((c) => c.weight));
  if (Math.random() * 100 > Math.min(92, 35 + best * 0.8)) return { fish: null, critical: false };
  let r = Math.random() * total;
  let pick = candidates[0].fish;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) { pick = c.fish; break; }
  }
  // a critical bite (golden arrows): the server's CalculateCriticalBite, without the moon
  const crit = pick.skill - 4 > skill ? 0 : Math.min(70, 5 + Math.max(0, skill - Math.max(0, pick.skill - 4)) * 2);
  return { fish: pick, critical: Math.random() * 100 < crit * 0.35 };
}

/** The server's CalculateLoseChance: a fish too big for the rod, too small for it, or far above your skill may get away
 * at the end of the fight. Returns [chance in %, why]. */
export function loseChance(f: Fish, skill: number, rod: Rod): [number, string] {
  let tooBig = 0;
  let tooSmall = 0;
  let lowSkill = 0;
  if (f.large && !rod.large && f.rank > rod.maxRank) tooBig = Math.max(0, Math.min(50, 50 - (skill - f.skill)));
  else if (!f.large && rod.large) tooSmall = Math.min(90, Math.floor(f.skill * 1.8));
  if (!f.item && skill + 7 < f.skill) lowSkill = skill + 50 <= f.skill ? 100 : Math.floor((f.skill - (skill + 7)) * 0.8);
  if (tooBig > 0 && tooBig > lowSkill) return [tooBig, 'too big for this rod'];
  if (tooSmall > 0 && tooSmall > lowSkill) return [Math.min(100, tooSmall), 'too small for this rod'];
  if (!f.item && lowSkill > 0) return [Math.min(100, lowSkill), 'your skill is too low'];
  return [0, ''];
}

/** The fish's auto-regen, as the server's CalculateRegen works it out for a plain rod: 128 is neutral, above it the fish
 * gets stamina back by itself (far above your skill), below it the fish tires by itself (far below your skill). */
export function regenOf(f: Fish, rod: Rod, skill: number): number {
  let regen = 128;
  if (f.large) regen += 1;                                            // large fish and items
  if (!f.item && f.skill <= skill - 12) regen -= Math.min(regen, 1 + Math.floor((skill - 12 - f.skill) / 1.5));
  if (!f.item && f.skill >= skill + 24) regen += 1 + Math.floor((f.skill - (skill + 24)) * 0.5);
  return Math.max(0, Math.min(182, regen));
}

/** The fight, with the server's own numbers (fishingutils: CalculateStamina, CalculateAttack, CalculateHeal,
 * CalculateRegen) turned into 0..100 stamina: each right arrow takes the rod's attack, a wrong or missed one gives the
 * fish its heal back, and the auto-regen moves the fish's stamina every second by itself (2026-11-27, Hurami: skill-1
 * anglers were landing skill-37 Shining Trout in East Ronfaure; in the game such a fish keeps getting its stamina back). */
export function fightParams(f: Fish, rod: Rod, skill: number, critical: boolean) {
  const stamina = Math.floor((f.skill + 36) / 2) * 100;                // CalculateStamina (one fish, middle of the +-5%)
  const attack = Math.floor(f.diff * (rod.attack / 100) * 20);        // CalculateAttack
  const heal = Math.floor((attack / 20) * (rod.recovery / 100)) * 10 * (critical ? 0.7 : 1);   // CalculateHeal
  const drift = ((regenOf(f, rod, skill) - 128) * REGEN_PER_SECOND / stamina) * 100;   // % of its stamina per second
  return {
    seconds: rod.time,
    hit: (attack / stamina) * 100 * (critical ? 1.3 : 1),            // stamina taken by a right arrow (more gold arrows)
    heal: (heal / stamina) * 100,                                     // stamina the fish gets back on a wrong or missed one
    every: 0.6 + f.delay * 0.08,                                      // seconds between arrows
    window: Math.max(0.55, 1.35 - f.move * 0.05),                     // seconds to answer an arrow
    pull: drift,                                                      // stamina per second the fish gets back (< 0: tires)
  };
}
// One step of auto-regen (away from 128) in stamina points per second. The client's own unit is not published: one point
// a frame at the game's 30 frames a second. A skill-37 Shining Trout against skill 1 (7 steps) then gets back ~6% of its
// stamina a second ("recovers rapidly", as SE describes a fish far above your skill); a Crayfish 13+ below you tires.
export const REGEN_PER_SECOND = 30;

/** Skill-up after a catch: the server's FishingSkillup, line for line (values in tenths, like the game keeps them). */
export function skillUp(catchLevel: number, skillTenths: number, rank: number, inCity: boolean, rate = 1): number {
  const maxSkill = (rank + 1) * 100;
  const level = Math.floor(skillTenths / 10);
  if (catchLevel <= level || catchLevel - level > 50) return 0;
  const diff = catchLevel - level;
  let roll = 90;
  const normDist = Math.exp(-0.5 * Math.log(2 * Math.PI) - Math.log(5) - Math.pow(diff - 11, 2) / 50);
  // the world's fishing skill-up rate (map.FISHING_SKILL_MULTIPLIER, or the hardcore profile's), as the server applies it
  const maxChance = Math.max(4, Math.floor(normDist * 200) + Math.floor((100 - level) / 10) - Math.floor(level / 10)) * rate;
  if (!inCity) roll -= 10;
  if (level < 50) roll -= 20 - Math.floor(level / 3);
  const maxAmount = Math.min(1 + Math.floor(diff / 5), 3);
  if (randInt(0, roll - 1) >= maxChance) return 0;
  let amount = 1;
  if (randInt(0, 7) === 1) amount = randInt(1, maxAmount);
  if (amount + skillTenths > maxSkill) amount = maxSkill - skillTenths;
  return Math.max(0, amount);
}

export function sizeOf(f: Fish): number {
  if (f.max <= 1) return 0;
  const t = Math.pow(Math.random(), 1.6);
  return Math.round(f.min + (f.max - f.min) * t);
}

export function ilmsText(size: number): string {
  // the game shows fish sizes in ilms (and pounds for big ones); one ilm is about one centimetre
  return `${size} ilms`;
}

export function rodsFor(owned: number[]): Rod[] {
  const mine = owned.map((id) => RODS[String(id)]).filter(Boolean);
  return mine.length ? mine : [RODS[String(LOANER_ROD)]];
}

// ------------------------------------------------------------------ auto-fishing (2026-11-25)
// The phone fishes by itself, like a fishbot: cast, wait for a bite, fight, land it or lose it, again. The pace follows
// the game (a cast, a wait of several seconds, a fight of up to the rod's time, the catch), and the fight is played by
// a steady but not perfect hand (AUTO_ACCURACY), so it lands a little less than a good player would in game.
export const AUTO_ACCURACY = 0.9;       // share of arrows it answers right: it lands ~87-92% of what a careful player
                                        // does, in fights ~10% longer, so ~85% of the fish an hour of fishing by hand brings
export const AUTO_REACT = [0.25, 0.5];  // its reaction time, seconds (min, max)
export const DAILY_CATCHES = 200;       // the game's fishing fatigue: a character lands at most this many a day
export const CATCHUP_HOURS = 4;         // after the app was closed, at most this long is fished out at once

export const CAST_SECONDS = 3.5;        // the cast, from the swing to the bobber settling
export const AFTER_SECONDS = 3;         // reeling in / showing the catch before the next cast
export const waitSeconds = () => rand(5, 14);        // until something bites (or nothing does)

/** The fight played out by the auto-fisher: whether the fish tires before the rod's time runs out, and how long it
 * took. Same numbers as the hand-played fight (fightParams). */
export function autoFight(f: Fish, rod: Rod, skill: number, critical: boolean): { won: boolean; seconds: number } {
  const p = fightParams(f, rod, skill, critical);
  let stamina = 100;
  let t = 0;
  while (t < p.seconds) {
    t += p.every;                                   // the next arrow
    const react = rand(AUTO_REACT[0], AUTO_REACT[1]);
    // the fish's auto-regen (or drain) runs the whole time: the wait for the arrow and the answer to it
    stamina = Math.min(100, stamina + p.pull * (p.every + Math.min(react, p.window)));
    if (react <= p.window && Math.random() < AUTO_ACCURACY) {
      stamina -= p.hit;
    } else {
      stamina = Math.min(100, stamina + p.heal);
    }
    t += Math.min(react, p.window);
    if (stamina <= 0) return { won: true, seconds: Math.max(3, t) };
  }
  return { won: false, seconds: p.seconds };
}

export type AutoResult = { kind: 'nothing' } | { kind: 'lost'; fish: Fish; why: string; seconds: number; tired: boolean }
  | { kind: 'caught'; fish: Fish; critical: boolean; seconds: number };

/** One whole cast for the auto-fisher: the bite, the fight and the end of it (no bait handling, no skill-ups). */
export function autoCast(spot: Spot, bait: Bait, skillLevel: number, rod: Rod): AutoResult {
  const { fish, critical } = rollHook(spot, bait, skillLevel, rod);
  if (!fish) return { kind: 'nothing' };
  const fight = autoFight(fish, rod, skillLevel, critical);
  if (!fight.won) return { kind: 'lost', fish, why: fish.item ? 'it sank back into the water' : 'it got away', seconds: fight.seconds, tired: false };
  const [lose, why] = loseChance(fish, skillLevel, rod);
  if (Math.random() * 100 < lose) return { kind: 'lost', fish, why, seconds: fight.seconds, tired: true };
  return { kind: 'caught', fish, critical, seconds: fight.seconds };
}

/** One whole cast's time for the auto-fisher: the cast, the wait, the fight (when something bit) and reeling in. */
export function castSeconds(r: AutoResult, wait = waitSeconds()): number {
  return CAST_SECONDS + wait + (r.kind === 'nothing' ? 0 : r.seconds) + AFTER_SECONDS;
}

/** The Earth day a catch counts towards (the daily fatigue). */
export const dayKey = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);
