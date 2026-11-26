// Tetra Master's rules, ported line for line from the server (modules/custom/lua/tetramaster_rules.lua, itself a 1-to-1
// port of Nalfey's TetraMaster addon). Same rules, same order of dice rolls: the app's matches against the computer play
// exactly like the game's, and dev/armory/tetra_rules.py (the hub's PvP matches) is the same again in Python.
// Board: cells[x][y], x and y 1-4 (index 0 unused). A cell is null (empty), { block: 1 | 2 } or a card on the board.
import { CARDS } from './cards';

export type Side = 'blue' | 'red';
export type Klass = 'P' | 'M' | 'X' | 'A';
export type Rng = (lo: number, hi: number) => number;

export type Card = {
  id: number; type: Klass; arrows: number; atk: number; pdef: number; mdef: number;
  uid?: number; side?: Side; owner?: Side;
};
export type Cell = null | { block: 1 | 2 } | Card;
export type Battle = { x: number; y: number; dir: string };
export type Ev =
  | { type: 'place'; side: Side; x: number; y: number; id: number; arrows: number; code: string }
  | { type: 'capture'; x: number; y: number; side: Side }
  | { type: 'combo'; x: number; y: number; side: Side; count: number; from_x: number; from_y: number }
  | { type: 'battle'; ax: number; ay: number; dx: number; dy: number; attacker_power: number; defender_power: number;
      attacker_final: number; defender_final: number; attacker_wins: boolean }
  | { type: 'upgrade'; x: number; y: number; from: Klass; to: Klass }
  | { type: 'choose'; side: Side; options: Battle[] }
  | { type: 'turn'; side: Side }
  | { type: 'end'; blue: number; red: number; winner: Side | 'draw'; perfect: boolean };

export type Match = {
  rng: Rng; cells: Cell[][]; hands: Record<Side, Card[]>; turn: Side; pending: Battle[] | null;
  over: boolean; moves: number; placedX?: number; placedY?: number;
};

export const SIDES: Side[] = ['blue', 'red'];
export const HAND_SIZE = 5;
export const DIRS = [
  { name: 'up', dx: 0, dy: -1, counter: 'down' },
  { name: 'down', dx: 0, dy: 1, counter: 'up' },
  { name: 'left', dx: -1, dy: 0, counter: 'right' },
  { name: 'right', dx: 1, dy: 0, counter: 'left' },
  { name: 'upleft', dx: -1, dy: -1, counter: 'downright' },
  { name: 'upright', dx: 1, dy: -1, counter: 'downleft' },
  { name: 'downleft', dx: -1, dy: 1, counter: 'upright' },
  { name: 'downright', dx: 1, dy: 1, counter: 'upleft' },
];
const BIT: Record<string, number> = {};
DIRS.forEach((d, i) => { BIT[d.name] = 1 << i; });

export const hasArrow = (mask: number, name: string) => (mask & BIT[name]) !== 0;
export const opposite = (s: Side): Side => (s === 'blue' ? 'red' : 'blue');

const HEX = '0123456789ABCDEF';
/** The printed numbers of card <id>: { name, attack, type, pdef, mdef } or null. */
export function base(id: number) {
  const e = CARDS[id];
  if (!e || id < 1) return null;
  const c = e[1];
  return { name: e[0], attack: HEX.indexOf(c[0]), type: c[1] as Klass, pdef: HEX.indexOf(c[2]), mdef: HEX.indexOf(c[3]) };
}
export const cardName = (id: number) => base(id)?.name ?? `Card ${id}`;

const rollHidden = (rng: Rng, digit: number) => rng(digit * 16, digit * 16 + 15);

/** A new copy of card <id>: random arrows, then hidden attack, physical and magical defence (card.lua's roll order). */
export function newCard(rng: Rng, id: number): Card | null {
  const b = base(id);
  if (!b) return null;
  let mask = 0;
  for (let i = 0; i < DIRS.length; i++) if (rng(1, 2) === 1) mask |= 1 << i;
  return { id, type: b.type, arrows: mask, atk: rollHidden(rng, b.attack), pdef: rollHidden(rng, b.pdef), mdef: rollHidden(rng, b.mdef) };
}

export const copyCard = (c: Card): Card =>
  ({ id: c.id, type: c.type, arrows: c.arrows, atk: c.atk, pdef: c.pdef, mdef: c.mdef, uid: c.uid });

/** The code a card shows: printed attack, its class now, printed defences (hidden stats / 16). */
export function cardCode(c: Card) {
  const d = (v: number) => HEX[Math.floor(v / 16)] ?? 'F';
  return d(c.atk) + c.type + d(c.pdef) + d(c.mdef);
}

/** A new board with 0-6 blocked cells (count, then x, y and look for each new block). */
export function newBoard(rng: Rng): Cell[][] {
  const cells: Cell[][] = [[], [], [], [], []];
  for (let x = 1; x <= 4; x++) for (let y = 1; y <= 4; y++) cells[x][y] = null;
  const blocks = rng(0, 6);
  let placed = 0;
  while (placed < blocks) {
    const x = rng(1, 4);
    const y = rng(1, 4);
    if (cells[x][y] === null) {
      cells[x][y] = { block: rng(1, 2) === 1 ? 2 : 1 };
      placed++;
    }
  }
  return cells;
}

export function cardAt(cells: Cell[][], x: number, y: number): Card | null {
  if (x < 1 || x > 4 || y < 1 || y > 4) return null;
  const c = cells[x][y] as Card | null;
  return c && (c as Card).side ? c : null;
}

export function newMatch(opts: { rng: Rng; hands: Record<Side, Card[]>; first?: Side; cells?: Cell[][] }): Match {
  const m: Match = { rng: opts.rng, cells: opts.cells ?? newBoard(opts.rng), hands: { blue: [], red: [] },
    turn: opts.first ?? 'blue', pending: null, over: false, moves: 0 };
  for (const side of SIDES) for (const card of opts.hands[side]) m.hands[side].push({ ...copyCard(card), owner: side });
  return m;
}

export function freeCells(m: Match) {
  const list: { x: number; y: number }[] = [];
  for (let x = 1; x <= 4; x++) for (let y = 1; y <= 4; y++) if (m.cells[x][y] === null) list.push({ x, y });
  return list;
}

/** Attacker vs defender numbers by the attacker's class. */
export function battleStats(a: Card, d: Card): [number, number] {
  if (a.type === 'M') return [a.atk, d.mdef];
  if (a.type === 'X') return [a.atk, Math.min(d.pdef, d.mdef)];
  if (a.type === 'A') return [Math.max(a.atk, a.pdef, a.mdef), Math.min(d.atk, d.pdef, d.mdef)];
  return [a.atk, d.pdef];
}

function rollBattle(rng: Rng, a: Card, d: Card) {
  const [ap, dp] = battleStats(a, d);
  const aFinal = ap - rng(0, ap);
  const dFinal = dp - rng(0, dp);
  return { attacker_power: ap, defender_power: dp, attacker_final: aFinal, defender_final: dFinal, attacker_wins: aFinal > dFinal };
}

function maybeUpgrade(rng: Rng, card: Card, x: number, y: number, events: Ev[]) {
  const before = card.type;
  if (card.type === 'P' || card.type === 'M') {
    if (rng(1, 64) === 1) card.type = 'X';
  } else if (card.type === 'X') {
    if (rng(1, 128) === 1) card.type = 'A';
  }
  if (card.type !== before) events.push({ type: 'upgrade', x, y, from: before, to: card.type });
}

function flip(card: Card, x: number, y: number, side: Side, events: Ev[], ev: any) {
  card.side = side;
  ev.x = x; ev.y = y; ev.side = side;
  events.push(ev);
}

function arrowTargets(cells: Cell[][], ox: number, oy: number, winner: Side, seen: Set<number>) {
  const out: { x: number; y: number; card: Card; ox: number; oy: number }[] = [];
  const card = cardAt(cells, ox, oy);
  if (!card) return out;
  for (const d of DIRS) {
    if (!hasArrow(card.arrows, d.name)) continue;
    const nx = ox + d.dx, ny = oy + d.dy, key = nx * 10 + ny;
    if (seen.has(key)) continue;
    const t = cardAt(cells, nx, ny);
    if (t && t.side !== winner) {
      seen.add(key);
      out.push({ x: nx, y: ny, card: t, ox, oy });
    }
  }
  return out;
}

function pendingBattles(m: Match, px: number, py: number): Battle[] {
  const list: Battle[] = [];
  const placed = cardAt(m.cells, px, py)!;
  for (const d of DIRS) {
    const def = cardAt(m.cells, px + d.dx, py + d.dy);
    if (def && def.side !== placed.side && hasArrow(placed.arrows, d.name) && hasArrow(def.arrows, d.counter)) {
      list.push({ x: px + d.dx, y: py + d.dy, dir: d.name });
    }
  }
  return list;
}

function fight(m: Match, px: number, py: number, battle: Battle, events: Ev[]) {
  const placed = cardAt(m.cells, px, py)!;
  const def = cardAt(m.cells, battle.x, battle.y)!;
  const res = rollBattle(m.rng, placed, def);
  events.push({ type: 'battle', ax: px, ay: py, dx: battle.x, dy: battle.y, ...res });
  if (res.attacker_wins) {
    const winner = placed.side!;
    flip(def, battle.x, battle.y, winner, events, { type: 'capture' });
    const seen = new Set([battle.x * 10 + battle.y]);
    const combo = arrowTargets(m.cells, battle.x, battle.y, winner, seen);
    for (const f of arrowTargets(m.cells, px, py, winner, seen)) combo.push(f);
    combo.forEach((f, i) => flip(f.card, f.x, f.y, winner, events, { type: 'combo', count: i + 1, from_x: f.ox, from_y: f.oy }));
    maybeUpgrade(m.rng, placed, px, py, events);
  } else {
    const winner = def.side!;
    const loser = placed.side!;
    let n = 0;
    for (const d of DIRS) {
      if (!hasArrow(placed.arrows, d.name)) continue;
      const adj = cardAt(m.cells, px + d.dx, py + d.dy);
      if (adj && adj !== placed && adj.side === loser) {
        n++;
        flip(adj, px + d.dx, py + d.dy, winner, events, { type: 'combo', count: n, from_x: px, from_y: py });
      }
    }
    flip(placed, px, py, winner, events, { type: 'capture' });
    maybeUpgrade(m.rng, def, battle.x, battle.y, events);
  }
}

function countSide(m: Match, side: Side) {
  let n = 0;
  for (let x = 1; x <= 4; x++) for (let y = 1; y <= 4; y++) if (cardAt(m.cells, x, y)?.side === side) n++;
  return n;
}

export const score = (m: Match): [number, number] => [countSide(m, 'blue'), countSide(m, 'red')];

export function result(m: Match): [Side | 'draw', boolean] {
  const [b, r] = score(m);
  if (b === r) return ['draw', false];
  return b > r ? ['blue', r === 0] : ['red', b === 0];
}

function endTurn(m: Match, events: Ev[]) {
  m.pending = null;
  m.moves++;
  if (m.hands.blue.length === 0 && m.hands.red.length === 0) {
    m.over = true;
    const [b, r] = score(m);
    const [winner, perfect] = result(m);
    events.push({ type: 'end', blue: b, red: r, winner, perfect });
  } else {
    m.turn = opposite(m.turn);
    events.push({ type: 'turn', side: m.turn });
  }
}

function resolveBattles(m: Match, events: Ev[]) {
  for (;;) {
    const list = pendingBattles(m, m.placedX!, m.placedY!);
    if (list.length === 0) { endTurn(m, events); return; }
    if (list.length > 1) {
      m.pending = list;
      events.push({ type: 'choose', side: m.turn, options: list });
      return;
    }
    fight(m, m.placedX!, m.placedY!, list[0], events);
  }
}

/** Places card number <handIndex> (1-based, as in Lua) of <side>'s hand at (x, y). Events, or [null, reason]. */
export function place(m: Match, side: Side, handIndex: number, x: number, y: number): Ev[] | string {
  if (m.over) return 'over';
  if (m.pending) return 'choose a battle first';
  if (side !== m.turn) return 'not your turn';
  if (!(x >= 1 && x <= 4 && y >= 1 && y <= 4) || m.cells[x][y] !== null) return 'cell not free';
  const hand = m.hands[side];
  const card = hand[handIndex - 1];
  if (!card) return 'no such card';
  hand.splice(handIndex - 1, 1);
  card.side = side;
  m.cells[x][y] = card;
  m.placedX = x; m.placedY = y;
  const events: Ev[] = [{ type: 'place', side, x, y, id: card.id, arrows: card.arrows, code: cardCode(card) }];
  for (const d of DIRS) {
    if (!hasArrow(card.arrows, d.name)) continue;
    const def = cardAt(m.cells, x + d.dx, y + d.dy);
    if (def && def.side !== side && !hasArrow(def.arrows, d.counter)) flip(def, x + d.dx, y + d.dy, side, events, { type: 'capture' });
  }
  resolveBattles(m, events);
  return events;
}

/** Picks battle number <index> (1-based) of m.pending. */
export function chooseBattle(m: Match, side: Side, index: number): Ev[] | string {
  if (!m.pending) return 'nothing to choose';
  if (side !== m.turn) return 'not your turn';
  const battle = m.pending[index - 1];
  if (!battle) return 'no such battle';
  m.pending = null;
  const events: Ev[] = [];
  fight(m, m.placedX!, m.placedY!, battle, events);
  resolveBattles(m, events);
  return events;
}

/** math.random(lo, hi) for the app's own matches. */
export const mathRng: Rng = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
