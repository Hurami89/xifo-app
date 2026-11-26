// A Tetra Master match as the screen sees it, for both kinds of match:
//   LocalGame - against the computer, played right here (rules.ts / ai.ts, the game's own rules and computer players)
//   PvpGame   - against another player, played by the hub (dev/armory/tetra_hub.py); this side only sends moves
// Both turn what happens into the same events (the rules' own), shown one after the other with a little time for each,
// like Nalfey's add-on. You are always "me" and always blue on screen, whichever side the hub gave you.
import * as R from './rules';
import * as AI from './ai';
import type { Face } from './CardView';
import type { TmCard } from '../armory';
import { call } from '../armory';
import { sfx } from '../sfx';

export type Who = 'me' | 'opp';
export type HandCard = Face & { key: string; uid?: number };
export type CellView = { block?: 1 | 2; card?: Face; side?: Who };
export type Anim =
  | { kind: 'battle'; ax: number; ay: number; dx: number; dy: number; ap: number; dp: number; af: number; df: number; t0: number; win: boolean }
  | { kind: 'flash'; x: number; y: number; t0: number }
  | null;
export type Result = { winner: Who | 'draw'; perfect: boolean; me: number; opp: number; gil: number; how?: string };
export type View = {
  phase: 'wait' | 'coin' | 'play' | 'over';
  cells: Record<string, CellView>;
  hand: HandCard[];
  oppCount: number;
  turn: Who;
  first: Who;
  choose: { x: number; y: number }[] | null;
  anim: Anim;
  note: string;
  busy: boolean;
  result: Result | null;
  seconds: number | null;          // PvP: time left in this turn
  waiting?: { waiting: number; playing: number };
  opponent: { name: string; portrait?: number; race?: number; face?: number; record?: { w: number; l: number; d: number } };
  upgrades: { uid: number; id: number; type: string }[];
};

const key = (x: number, y: number) => `${x},${y}`;
const STEP: Record<string, number> = { place: 330, capture: 420, combo: 340, battle: 1500, upgrade: 900, left: 0 };

export function faceOf(c: { id: number; arrows: number; type: string; atk: number; pdef: number; mdef: number }): Face {
  return { id: c.id, arrows: c.arrows, code: R.cardCode(c as R.Card) };
}

function blankView(): View {
  return { phase: 'wait', cells: {}, hand: [], oppCount: 5, turn: 'me', first: 'me', choose: null, anim: null, note: '', busy: false,
    result: null, seconds: null, opponent: { name: '' }, upgrades: [] };
}

export abstract class Game {
  view: View = blankView();
  private queue: any[] = [];
  private playing = false;
  private listeners = new Set<(v: View) => void>();
  protected stopped = false;
  protected replaying = false;

  subscribe(f: (v: View) => void) { this.listeners.add(f); f(this.view); return () => { this.listeners.delete(f); }; }
  protected set(p: Partial<View>) { this.view = { ...this.view, ...p }; this.listeners.forEach((f) => f(this.view)); }

  abstract place(handIndex: number, x: number, y: number): void;
  abstract chooseBattle(index: number): void;
  abstract leave(): void;
  protected afterEvents() {}

  /** Events in the rules' own words; `me` is the side that is drawn blue. */
  protected push(events: any[], me: R.Side) {
    for (const e of events) this.queue.push({ ...e, side: e.side ? (e.side === me ? 'me' : 'opp') : undefined,
      winner: e.winner ? (e.winner === 'draw' ? 'draw' : e.winner === me ? 'me' : 'opp') : undefined, _me: me });
    if (!this.playing) this.run();
  }

  private run() {
    if (this.stopped) return;
    const e = this.queue.shift();
    if (!e) {
      this.playing = false;
      this.set({ busy: false, anim: null });
      this.afterEvents();
      return;
    }
    this.playing = true;
    this.set({ busy: true });
    const wait = this.replaying ? 0 : this.show(e);
    setTimeout(() => this.run(), wait);
  }

  /** Shows one event; returns how long to wait before the next. */
  private show(e: any): number {
    const v = this.view;
    const cells = { ...v.cells };
    const t0 = Date.now();
    switch (e.type) {
      case 'place': {
        cells[key(e.x, e.y)] = { card: { id: e.id, arrows: e.arrows, code: e.code }, side: e.side };
        let hand = v.hand, oppCount = v.oppCount;
        if (e.side === 'me' && !this.replaying) {
          const i = hand.findIndex((h) => h.id === e.id && h.arrows === e.arrows);
          if (i >= 0) hand = hand.slice(0, i).concat(hand.slice(i + 1));
        } else if (e.side === 'opp' && !this.replaying) oppCount = Math.max(0, oppCount - 1);
        this.set({ cells, hand, oppCount, choose: null, anim: null,
          note: e.auto ? (e.side === 'me' ? "Time's up: a card was played for you." : "Their time ran out.") : '' });
        sfx('tm_put');
        return STEP.place;
      }
      case 'capture':
      case 'combo': {
        const c = cells[key(e.x, e.y)];
        if (c) cells[key(e.x, e.y)] = { ...c, side: e.side };
        this.set({ cells, anim: { kind: 'flash', x: e.x, y: e.y, t0 } });
        sfx(e.type === 'combo' ? 'tm_combo' : e.side === 'me' ? 'tm_win_card' : 'tm_lose_card');
        return STEP[e.type];
      }
      case 'battle':
        this.set({ anim: { kind: 'battle', ax: e.ax, ay: e.ay, dx: e.dx, dy: e.dy, ap: e.attacker_power, dp: e.defender_power,
          af: e.attacker_final, df: e.defender_final, t0, win: e.attacker_wins } });
        sfx('tm_battle');
        return STEP.battle;
      case 'upgrade': {
        const c = cells[key(e.x, e.y)];
        if (c?.card) cells[key(e.x, e.y)] = { ...c, card: { ...c.card, code: c.card.code[0] + e.to + c.card.code.slice(2) } };
        this.set({ cells, note: `Class up: ${e.from} to ${e.to}!` });
        this.onUpgrade(e);
        return STEP.upgrade;
      }
      case 'choose':
        this.set({ choose: e.side === 'me' ? e.options.map((o: any) => ({ x: o.x, y: o.y })) : null, turn: e.side });
        if (e.side === 'me') sfx('tm_choose');
        return 0;
      case 'turn':
        this.set({ turn: e.side, choose: null });
        return 0;
      case 'end':
      case 'left':
        this.onEnd(e);
        return 0;
    }
    return 0;
  }

  protected onUpgrade(_e: any) {}
  protected abstract onEnd(e: any): void;

  protected endSound(r: Result) {
    sfx(r.winner === 'draw' ? 'tm_tie' : r.winner === 'me' ? (r.perfect ? 'tm_perfect' : 'tm_win') : 'tm_lose', 0.9);
  }

  stop() { this.stopped = true; this.listeners.clear(); }
}

// ------------------------------------------------------------------------------------------------ against the computer
export class LocalGame extends Game {
  m: R.Match;
  private deck: R.Card[];

  constructor(deck: TmCard[], public level: AI.Level, private gilRate: number, portrait: number, name: string,
              private onDone: (r: Result, upgrades: View['upgrades']) => void) {
    super();
    const rng = R.mathRng;
    this.deck = deck.map((c) => ({ id: c.id, type: c.type, arrows: c.arrows, atk: c.atk, pdef: c.pdef, mdef: c.mdef, uid: c.uid }));
    this.m = R.newMatch({ rng, hands: { blue: this.deck, red: AI.computerHand(level, rng) }, first: rng(1, 2) === 1 ? 'blue' : 'red' });
    const cells: Record<string, CellView> = {};
    for (let x = 1; x <= 4; x++) for (let y = 1; y <= 4; y++) {
      const c = this.m.cells[x][y] as any;
      if (c?.block) cells[key(x, y)] = { block: c.block };
    }
    const first: Who = this.m.turn === 'blue' ? 'me' : 'opp';
    this.set({ phase: 'coin', cells, first, turn: first, oppCount: 5,
      hand: this.m.hands.blue.map((c, i) => ({ ...faceOf(c), key: `h${i}`, uid: c.uid })),
      opponent: { name, portrait } });
    sfx('tm_coin');
    setTimeout(() => { if (!this.stopped) { this.set({ phase: 'play' }); this.afterEvents(); } }, 1700);
  }

  place(handIndex: number, x: number, y: number) {
    if (this.view.busy || this.view.phase !== 'play') return;
    const ev = R.place(this.m, 'blue', handIndex, x, y);
    if (typeof ev === 'string') { sfx('tm_error'); return; }
    this.push(ev, 'blue');
  }

  chooseBattle(index: number) {
    if (this.view.busy) return;
    const ev = R.chooseBattle(this.m, 'blue', index);
    if (typeof ev === 'string') { sfx('tm_error'); return; }
    this.push(ev, 'blue');
  }

  protected afterEvents() {
    if (this.stopped || this.view.phase !== 'play' || this.m.over || this.m.turn !== 'red') return;
    setTimeout(() => {
      if (this.stopped || this.m.over || this.m.turn !== 'red') return;
      const ev = this.m.pending
        ? R.chooseBattle(this.m, 'red', AI.chooseBattle(this.m, 'red', this.level))
        : (() => { const mv = AI.chooseMove(this.m, 'red', this.level); return R.place(this.m, 'red', mv.hand, mv.x, mv.y); })();
      if (typeof ev !== 'string') this.push(ev, 'blue');
    }, 650);
  }

  protected onEnd(e: any) {
    // your cards that moved up a class keep it (the server's finish): the card on the board with your uid
    const ups: View['upgrades'] = [];
    for (let x = 1; x <= 4; x++) for (let y = 1; y <= 4; y++) {
      const c = R.cardAt(this.m.cells, x, y);
      if (c && c.owner === 'blue' && c.uid) {
        const before = this.deck.find((d) => d.uid === c.uid);
        if (before && before.type !== c.type) ups.push({ uid: c.uid, id: c.id, type: c.type });
      }
    }
    const won = e.winner === 'me';
    const gil = won ? AI.winGil(this.level, e.perfect, this.gilRate) : 0;
    const r: Result = { winner: e.winner, perfect: e.perfect, me: e.blue, opp: e.red, gil };
    this.set({ phase: 'over', result: r, upgrades: ups, choose: null });
    this.endSound(r);
    this.onDone(r, ups);
  }

  leave() { this.stop(); }
}

// ------------------------------------------------------------------------------------------------ against a player
export class PvpGame extends Game {
  private ticket = '';
  private since = 0;
  private me: R.Side = 'blue';
  private started = false;
  private clock: any = null;
  private deadline = 0;

  constructor(private char: string, private uids: number[], private onDone: (r: Result) => void, private onError: (m: string) => void) {
    super();
    this.set({ phase: 'wait', opponent: { name: '' } });
    this.join();
  }

  private async join() {
    const out = await call('/tm/queue', { char: this.char, uids: this.uids });
    if (this.stopped) return;
    if (!out.ticket) { this.onError(out.error || 'Could not join.'); return; }
    this.ticket = out.ticket;
    this.loop();
  }

  private async loop() {
    let fails = 0;
    while (!this.stopped) {
      const v = await call(`/tm/poll?t=${this.ticket}&since=${this.since}`, undefined, 30000);
      if (this.stopped) return;
      if (v.error) {
        if (++fails > 5) { this.onError(v.error); return; }
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      fails = 0;
      if (v.state === 'gone') { this.onError('The match is gone (the hub restarted?).'); return; }
      if (v.state === 'waiting') { this.set({ waiting: { waiting: v.waiting, playing: v.playing } }); continue; }
      if (!this.started) this.begin(v);
      if (v.seconds !== undefined) this.deadline = Date.now() + v.seconds * 1000;
      if (v.events?.length) this.push(v.events, this.me);
      this.since = v.next ?? this.since;
      if (v.state === 'over') {
        if (v.result?.how === 'left' && !this.view.result) this.onEnd({ type: 'left', winner: v.result.winner === this.me ? 'me' : 'opp' });
        return;
      }
    }
  }

  private begin(v: any) {
    this.started = true;
    this.me = v.you;
    const cells: Record<string, CellView> = {};
    for (const b of v.blocks || []) cells[key(b.x, b.y)] = { block: b.block };
    const first: Who = v.first === v.you ? 'me' : 'opp';
    this.replaying = (v.events || []).some((e: any) => e.type === 'place');   // back in a match already under way
    this.set({ phase: this.replaying ? 'play' : 'coin', cells, first, turn: first, oppCount: v.opponent.cards,
      hand: (v.hand || []).map((c: any, i: number) => ({ ...faceOf(c), key: `h${i}`, uid: c.uid })),
      opponent: { name: v.opponent.name, race: v.opponent.race, face: v.opponent.face, record: v.opponent.record } });
    if (!this.replaying) {
      sfx('tm_coin');
      setTimeout(() => { if (!this.stopped && this.view.phase === 'coin') this.set({ phase: 'play' }); }, 1700);
    }
    this.clock = setInterval(() => {
      if (this.stopped || this.view.phase === 'over') { clearInterval(this.clock); return; }
      this.set({ seconds: Math.max(0, Math.round((this.deadline - Date.now()) / 1000)) });
    }, 1000);
  }

  protected afterEvents() { this.replaying = false; }

  async place(handIndex: number, x: number, y: number) {
    if (this.view.busy || this.view.turn !== 'me' || this.view.phase !== 'play') return;
    this.set({ busy: true });
    const out = await call('/tm/move', { t: this.ticket, hand: handIndex, x, y });
    if (out.error) { sfx('tm_error'); this.set({ busy: false, note: out.error }); }
  }

  async chooseBattle(index: number) {
    if (this.view.busy) return;
    this.set({ busy: true, choose: null });
    const out = await call('/tm/move', { t: this.ticket, battle: index });
    if (out.error) { sfx('tm_error'); this.set({ busy: false, note: out.error }); }
  }

  protected onEnd(e: any) {
    if (this.view.result) return;
    let me = 0, opp = 0;
    for (const c of Object.values(this.view.cells)) if (c.side === 'me') me++; else if (c.side === 'opp') opp++;
    const r: Result = { winner: e.winner, perfect: !!e.perfect, me, opp, gil: 0, how: e.type === 'left' ? 'left' : undefined };
    this.set({ phase: 'over', result: r, choose: null, seconds: null });
    this.endSound(r);
    this.onDone(r);
  }

  leave() {
    if (this.ticket) call('/tm/leave', { t: this.ticket });
    clearInterval(this.clock);
    this.stop();
  }
}
