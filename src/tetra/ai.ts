// Tetra Master's computer players, ported line for line from the server (modules/custom/lua/tetramaster_ai.lua):
//   easy   - Nalfey's AI: a random free cell, a random card, a random battle (the same rolls)
//   normal - tries every card on every free cell, counting each battle by its real odds
//   hard   - like normal, then looks at the other player's best answer to its 10 best moves
import * as R from './rules';
import type { Match, Rng, Side } from './rules';

export type Level = 'easy' | 'normal' | 'hard';
export const LEVELS: Level[] = ['easy', 'normal', 'hard'];
const HARD_CANDIDATES = 10;

/** Chance that power <ap> beats <dp> (each keeps a whole number 0..power, the attacker must end strictly higher). */
export function winChance(ap: number, dp: number) {
  let wins = 0;
  for (let a = 0; a <= ap; a++) wins += Math.min(a, dp + 1);
  return wins / ((ap + 1) * (dp + 1));
}

function cloneMatch(m: Match): Match {
  const c: Match = { rng: m.rng, cells: [[], [], [], [], []], hands: { blue: [], red: [] }, turn: m.turn, pending: null,
    over: m.over, moves: m.moves, placedX: m.placedX, placedY: m.placedY };
  for (let x = 1; x <= 4; x++) for (let y = 1; y <= 4; y++) { const cell = m.cells[x][y]; c.cells[x][y] = cell ? { ...cell } as any : null; }
  for (const side of R.SIDES) c.hands[side] = m.hands[side].map((card) => ({ ...card }));
  return c;
}

/** A fixed outcome for "what if" copies: the attacker wins (or loses) its battle with its full power; no upgrades. */
function fixedRng(attackerWins: boolean): Rng {
  let n = 0;
  return (lo, hi) => {
    if (lo === 0) {
      n++;
      const attackerRoll = n % 2 === 1;
      if (attackerWins) return attackerRoll ? lo : hi;
      return attackerRoll ? hi : lo;
    }
    return hi;
  };
}

function lead(m: Match, side: Side) {
  const [b, r] = R.score(m);
  return side === 'blue' ? b - r : r - b;
}

type Outcome = { p: number; m: Match };

function outcomes(m: Match, act: (c: Match) => R.Ev[] | string): Outcome[] | null {
  const probe = cloneMatch(m);
  probe.rng = fixedRng(true);
  const events = act(probe);
  if (typeof events === 'string') return null;
  let p: number | null = null;
  for (const e of events) if (e.type === 'battle') { p = winChance(e.attacker_power, e.defender_power); break; }
  let list: Outcome[];
  if (p === null) list = [{ p: 1, m: probe }];
  else {
    const lose = cloneMatch(m);
    lose.rng = fixedRng(false);
    act(lose);
    list = [{ p, m: probe }, { p: 1 - p, m: lose }];
  }
  const out: Outcome[] = [];
  for (const o of list) {
    if (o.m.pending) {
      const k = chooseBattle(o.m, o.m.turn, 'normal', () => 1);
      const side = o.m.turn;
      const sub = outcomes(o.m, (c) => R.chooseBattle(c, side, k)) ?? [{ p: 1, m: o.m }];
      for (const s2 of sub) out.push({ p: o.p * s2.p, m: s2.m });
    } else out.push(o);
  }
  return out;
}

const placeOutcomes = (m: Match, side: Side, i: number, x: number, y: number) => outcomes(m, (c) => R.place(c, side, i, x, y));

function evalMove(m: Match, side: Side, i: number, x: number, y: number) {
  const list = placeOutcomes(m, side, i, x, y);
  if (!list) return null;
  return list.reduce((v, o) => v + o.p * lead(o.m, side), 0);
}

function bestReply(m: Match, side: Side) {
  let best: number | null = null;
  for (let i = 1; i <= m.hands[side].length; i++) {
    for (const cell of R.freeCells(m)) {
      const v = evalMove(m, side, i, cell.x, cell.y);
      if (v !== null && (best === null || v > best)) best = v;
    }
  }
  return best;
}

function easyMove(m: Match, side: Side, rng: Rng) {
  for (;;) {
    const x = rng(1, 4);
    const y = rng(1, 4);
    if (m.cells[x][y] === null) return { hand: rng(1, m.hands[side].length), x, y };
  }
}

/** A move for <side>: { hand (1-based), x, y }. */
export function chooseMove(m: Match, side: Side, level: Level, rng: Rng = m.rng): { hand: number; x: number; y: number } {
  if (level !== 'normal' && level !== 'hard') return easyMove(m, side, rng);
  const other = R.opposite(side);
  let scored: { hand: number; x: number; y: number; v: number; list: Outcome[] }[] = [];
  for (let i = 1; i <= m.hands[side].length; i++) {
    for (const cell of R.freeCells(m)) {
      const list = placeOutcomes(m, side, i, cell.x, cell.y);
      if (list) scored.push({ hand: i, x: cell.x, y: cell.y, v: list.reduce((v, o) => v + o.p * lead(o.m, side), 0), list });
    }
  }
  if (level === 'hard' && m.hands[other].length > 0) {
    // (Lua's table.sort is not stable; ties keep their order here, which only changes which of equal moves is looked at)
    scored.sort((a, b) => b.v - a.v);
    const keep = scored.slice(0, Math.min(HARD_CANDIDATES, scored.length));
    for (const s of keep) {
      let v = 0;
      for (const o of s.list) {
        let value = lead(o.m, side);
        if (!o.m.over) {
          const reply = bestReply(o.m, other);
          if (reply !== null) value = -reply;
        }
        v += o.p * value;
      }
      s.v = v;
    }
    scored = keep;
  }
  let bestV = -Infinity;
  for (const s of scored) if (s.v > bestV) bestV = s.v;
  const top = scored.filter((s) => s.v >= bestV - 1e-9);
  return top[rng(1, top.length) - 1];
}

/** Which of m.pending to fight (1-based). */
export function chooseBattle(m: Match, side: Side, level: Level, rng: Rng = m.rng) {
  if (level !== 'normal' && level !== 'hard') return rng(1, m.pending!.length);
  let bestK = 1, bestV: number | null = null;
  m.pending!.forEach((b, i) => {
    const att = R.cardAt(m.cells, m.placedX!, m.placedY!)!;
    const def = R.cardAt(m.cells, b.x, b.y)!;
    const [ap, dp] = R.battleStats(att, def);
    const p = winChance(ap, dp);
    if (bestV === null || p > bestV) { bestK = i + 1; bestV = p; }
  });
  return bestK;
}

/** The computer's hand: random cards, weaker for easy and stronger for hard (the server's computerHand). */
export function computerHand(level: Level, rng: Rng) {
  let lo = 0, hi = 45;
  if (level === 'easy') { lo = 0; hi = 9; } else if (level === 'hard') { lo = 12; hi = 45; }
  const pool: number[] = [];
  for (let id = 1; id <= 250; id++) {
    const b = R.base(id)!;
    const p = b.attack + b.pdef + b.mdef;
    if (p >= lo && p <= hi) pool.push(id);
  }
  const hand: R.Card[] = [];
  for (let k = 0; k < R.HAND_SIZE; k++) hand.push(R.newCard(rng, pool[rng(1, pool.length) - 1])!);
  return hand;
}

/** Gil for a win against the computer (the server's CONFIG.gil and perfect bonus), times the world's TM_GIL_RATE. */
export const GIL: Record<Level, number> = { easy: 100, normal: 300, hard: 800 };
export const winGil = (level: Level, perfect: boolean, rate: number) => Math.floor(GIL[level] * (perfect ? 2 : 1) * rate + 0.5);
