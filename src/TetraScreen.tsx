// CARDS (Play tab): Tetra Master with your character's own cards (2026-11-25, the user: "add tetra master into the app ... connect to
// your cards in game since you have to unlock them in game ... the same game modes and add pvp").
//
// The cards are the ones the character has in the game (the launcher syncs them with the character: collection, hidden
// numbers, deck). Tetra Master opens once Luto Mewrilah in Upper Jeuno has given the character the starter deck.
//   Against the computer: Easy, Normal and Hard, played on the phone with the game's own rules and computer players.
//     A win pays the game's gil (times the world's Tetra Master gil rate), and cards that go up a class keep it: both
//     reach the character at the next PLAY, like phone fishing.
//   Against a player: the hub matches you with whoever else is looking for a game and runs the match. As in the game,
//     no cards change hands; it counts in your win / loss record.
// The look is Nalfey's: his board, cards, arrows, numbers and sounds (used with his permission), in dark fantasy colours.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PairBox } from './MeScreen';
import { Card as Char, cachedMe, me, newId, Report, sendReport, TmCard, call } from './armory';
import { faceOf as portraitOf } from './faces';
import { getJSON, setJSON } from './store';
import { sfx, useMusic } from './sfx';
import { TM, PEOPLE } from './tetra/art';
import { CardView } from './tetra/CardView';
import * as R from './tetra/rules';
import * as AI from './tetra/ai';
import { faceOf, Game, LocalGame, PvpGame, View as GameView } from './tetra/game';

// dark fantasy colours (the board's own: black, violet, old gold)
const D = {
  bg: '#07050C', panel: 'rgba(14,9,24,0.9)', edge: '#8A6A2E', edgeHi: '#E3B95C', gold: '#E8C878', text: '#E9E2D0',
  dim: '#A89F8E', blue: '#7FB2FF', red: '#FF7A6E', good: '#9BE08A', bad: '#F08070', btn: ['#3A2350', '#1A0F28'],
};
const CINZEL = 'Cinzel';
const n = (v: number) => Math.round(v).toLocaleString('en-US');
const strength = (id: number) => { const b = R.base(id)!; return b.attack + b.pdef + b.mdef + (({ X: 2, A: 4 } as any)[b.type] || 0); };

function Gold({ children, size = 16, style }: { children: React.ReactNode; size?: number; style?: any }) {
  return <Text style={[{ fontFamily: CINZEL, color: D.gold, fontSize: size, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }, style]}>{children}</Text>;
}
function Txt({ children, style, ...rest }: React.ComponentProps<typeof Text>) {
  return <Text {...rest} style={[{ color: D.text, fontFamily: 'Selawik', fontSize: 14 }, style]}>{children}</Text>;
}
function Panel({ title, children, style }: { title?: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[st.panel, style]}>
      <View style={st.cornerTL} /><View style={st.cornerTR} /><View style={st.cornerBL} /><View style={st.cornerBR} />
      {title ? <View style={st.panelHead}><View style={st.rule} /><Gold size={15} style={{ marginHorizontal: 8 }}>{title}</Gold><View style={st.rule} /></View> : null}
      {children}
    </View>
  );
}
function Btn({ label, sub, onPress, disabled, small, style }: { label: string; sub?: string; onPress?: () => void; disabled?: boolean; small?: boolean; style?: any }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={({ pressed }) => [st.btn, small && st.btnSmall, pressed && !disabled && st.btnDown, disabled && { opacity: 0.45 }, style]}
      accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[st.btnText, small && { fontSize: 12.5 }]}>{label}</Text>
      {sub ? <Text style={st.btnSub}>{sub}</Text> : null}
    </Pressable>
  );
}

type Overrides = Record<number, string>;       // card uid -> class it went up to on the phone (until the game has it)

export default function TetraScreen({ active = true, goMe }: { active?: boolean; goMe?: () => void }) {
  const [chars, setChars] = useState<Char[]>([]);
  const [unpaired, setUnpaired] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [mode, setMode] = useState<'lobby' | 'deck' | 'match'>('lobby');
  const [deckPick, setDeckPick] = useState<number[]>([]);
  const [decks, setDecks] = useState<Record<string, number[]>>({});
  const [ups, setUps] = useState<Record<string, Overrides>>({});
  const [lobby, setLobby] = useState<{ waiting: number; playing: number; record?: { w: number; l: number; d: number } } | null>(null);
  const [note, setNote] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [kind, setKind] = useState<'local' | 'pvp'>('local');
  const [level, setLevel] = useState<AI.Level>('normal');
  useMusic('tetra', active && mode === 'match');

  const load = useCallback(async () => {
    const cached = await cachedMe();
    if (cached) setChars(cached.cards);
    setDecks(await getJSON('tm.decks', {}));
    setUps(await getJSON('tm.ups', {}));
    const out = await me();
    if (out.unpaired) { setUnpaired(true); return; }
    setUnpaired(false);
    if (out.cards) setChars(out.cards);
    flush();
  }, []);
  useEffect(() => { if (active) load(); }, [active, load]);

  const ready = chars.filter((c) => c.tetra?.unlocked);
  useEffect(() => {
    if (!who && chars.length) setWho((ready[0] || chars[0]).name);
  }, [chars]);                                         // eslint-disable-line react-hooks/exhaustive-deps
  const char = chars.find((c) => c.name === who) || null;
  const tm = char?.tetra;

  // the collection, with the classes won on the phone that the game hasn't taken in yet
  const collection: TmCard[] = useMemo(() => {
    const o = (who && ups[who]) || {};
    return (tm?.cards || []).map((c) => (o[c.uid] && 'PMXA'.indexOf(o[c.uid]) > 'PMXA'.indexOf(c.type) ? { ...c, type: o[c.uid] as any } : c));
  }, [tm, ups, who]);
  const deck: TmCard[] = useMemo(() => {
    const byUid = new Map(collection.map((c) => [c.uid, c]));
    const want = (who && decks[who]) || tm?.deck || [];
    const out: TmCard[] = [];
    for (const u of want) { const c = byUid.get(u); if (c && !out.includes(c)) out.push(c); }
    for (const c of collection) { if (out.length >= 5) break; if (!out.includes(c)) out.push(c); }
    return out.slice(0, 5);
  }, [collection, decks, tm, who]);

  useEffect(() => {
    if (!active || mode !== 'lobby' || !char) return;
    let live = true;
    const tick = async () => {
      const out = await call(`/tm/lobby?char=${encodeURIComponent(char.name)}`);
      if (live && !out.error) setLobby(out);
    };
    tick();
    const t = setInterval(tick, 15000);
    return () => { live = false; clearInterval(t); };
  }, [active, mode, char?.name]);                     // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------ results back to the game
  async function flush() {
    const out: Report[] = await getJSON('tm.out', []);
    const left: Report[] = [];
    for (const r of out) {
      const res = await sendReport(r);
      if (!res.ok && !(res.error || '').includes('not one of your')) left.push(r);
    }
    await setJSON('tm.out', left);
  }

  async function finished(name: string, gil: number, won: boolean, upgrades: { uid: number; id: number; type: string }[]) {
    if (upgrades.length) {
      const all = { ...ups, [name]: { ...(ups[name] || {}) } };
      for (const u of upgrades) all[name][u.uid] = u.type;
      setUps(all);
      await setJSON('tm.ups', all);
    }
    if (gil <= 0 && !upgrades.length) return;
    const r: Report = { id: newId(), char: name, catches: [], skill: 0, gil: 0, gilFound: gil, bait: [],
      tetra: { gil, wins: won ? 1 : 0, played: 1, upgrades } };
    const out: Report[] = await getJSON('tm.out', []);
    out.push(r);
    await setJSON('tm.out', out);
    flush();
  }

  // ------------------------------------------------------------------ starting a match
  function playComputer(lv: AI.Level) {
    if (!char || deck.length < 5) return;
    sfx('tm_choose');
    const p = Math.floor(Math.random() * PEOPLE.length);
    const g = new LocalGame(deck, lv, tm?.gilRate ?? 1, p, PEOPLE[p], (r, upgrades) => finished(char.name, r.gil, r.winner === 'me', upgrades));
    setLevel(lv);
    setKind('local');
    setGame(g);
    setMode('match');
  }
  function playPvp() {
    if (!char || deck.length < 5) return;
    sfx('tm_choose');
    const g = new PvpGame(char.name, deck.map((c) => c.uid), () => {}, (msg) => { setNote(msg); quit(); });
    setKind('pvp');
    setGame(g);
    setMode('match');
  }
  function quit() {
    game?.leave();
    setGame(null);
    setMode('lobby');
  }

  // ------------------------------------------------------------------ screens
  if (unpaired) {
    return (
      <Shell>
        <Header />
        <Panel title="Pair with your launcher">
          <Txt style={{ marginBottom: 8 }}>Tetra Master here plays with your character's own cards from the game. Pair this app with your launcher first (it's quick):</Txt>
          <PairBox onPaired={load} title="" />
        </Panel>
      </Shell>
    );
  }

  if (mode === 'match' && game) {
    return <Match game={game} kind={kind} level={level} who={char} onQuit={quit}
      onAgain={kind === 'local' ? () => playComputer(level) : () => { game.leave(); playPvp(); }} />;
  }

  if (mode === 'deck' && char) {
    const sorted = [...collection].sort((a, b) => strength(b.id) - strength(a.id) || a.id - b.id);
    const toggle = (uid: number) => {
      sfx('tm_cursor');
      setDeckPick((p) => (p.includes(uid) ? p.filter((u) => u !== uid) : p.length >= 5 ? p : [...p, uid]));
    };
    return (
      <Shell>
        <Panel title={`${char.name}'s cards (${collection.length})`}>
          <Txt style={{ color: D.dim, marginBottom: 8 }}>Pick the 5 you play with ({deckPick.length}/5). This deck is for the app; your deck in the game stays as it is.</Txt>
          <View style={st.grid}>
            {sorted.map((c) => {
              const on = deckPick.includes(c.uid);
              return (
                <Pressable key={c.uid} onPress={() => toggle(c.uid)} style={{ margin: 3 }}>
                  <CardView card={faceOf(c)} side={on ? 'blue' : null} width={58} glow={on} dim={!on && deckPick.length >= 5} />
                  <Text numberOfLines={1} style={st.cardName}>{R.cardName(c.id)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={st.row}>
            <Btn label="Save deck" disabled={deckPick.length !== 5} onPress={async () => {
              const all = { ...decks, [char.name]: deckPick };
              setDecks(all);
              await setJSON('tm.decks', all);
              setMode('lobby');
            }} style={{ flex: 1 }} />
            <Btn label="Cancel" onPress={() => setMode('lobby')} style={{ flex: 1 }} />
          </View>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header />
      {note ? <Txt style={{ color: D.bad, marginBottom: 8, textAlign: 'center' }}>{note}</Txt> : null}
      {!chars.length ? (
        <Panel title="No characters yet">
          <Txt>Press PLAY in the launcher once so your characters (and their cards) come over.</Txt>
          {goMe ? <Btn label="Open Me" onPress={goMe} style={{ marginTop: 10 }} /> : null}
        </Panel>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }}>
            {chars.map((c) => {
              const on = c.name === who;
              const open = !!c.tetra?.unlocked;
              return (
                <Pressable key={c.name} onPress={() => { sfx('tm_cursor'); setWho(c.name); setNote(''); }} style={[st.chip, on && st.chipOn]}>
                  <Image source={portraitOf(c.race, c.face)} style={[st.chipFace, !open && { opacity: 0.45 }]} />
                  <Text style={[st.chipName, on && { color: D.gold }]}>{c.name}</Text>
                  <Text style={st.chipSub}>{open ? `${c.tetra!.cards.length} cards` : 'locked'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {char && !tm?.unlocked ? (
            <Panel title="Sealed">
              <Txt style={{ lineHeight: 21 }}>
                {char.name} hasn't learned Tetra Master yet. In the game, talk to <Text style={{ color: D.gold }}>Luto Mewrilah</Text> in
                Upper Jeuno (G-8): she gives every newcomer a starter deck. Then press PLAY in the launcher (or let it sync) and your cards show up here.
              </Txt>
              {!tm ? <Txt style={{ color: D.dim, marginTop: 8, fontSize: 12.5 }}>(Nothing about this character's cards has come over yet: the launcher needs the newest update.)</Txt> : null}
            </Panel>
          ) : char ? (
            <>
              <Panel title="Your deck">
                <View style={[st.row, { justifyContent: 'center' }]}>
                  {deck.map((c) => <CardView key={c.uid} card={faceOf(c)} side="blue" width={56} style={{ marginHorizontal: 2 }} />)}
                </View>
                {deck.length < 5 ? <Txt style={{ color: D.bad, marginTop: 6 }}>You need 5 cards to play. Card traders in the taverns sell more.</Txt> : null}
                <Btn small label="Change deck" onPress={() => { setDeckPick(deck.map((c) => c.uid)); setMode('deck'); }} style={{ alignSelf: 'center', marginTop: 8 }} />
              </Panel>
              <Panel title="Challenge the computer">
                <View style={st.row}>
                  {AI.LEVELS.map((lv) => (
                    <Btn key={lv} label={lv[0].toUpperCase() + lv.slice(1)} sub={`${n(AI.winGil(lv, false, tm?.gilRate ?? 1))} gil`}
                      disabled={deck.length < 5} onPress={() => playComputer(lv)} style={{ flex: 1 }} />
                  ))}
                </View>
                <Txt style={{ color: D.dim, fontSize: 12.5, marginTop: 6 }}>A perfect game pays double. Gil and class-ups reach {char.name} at your next PLAY.</Txt>
              </Panel>
              <Panel title="Duel another player">
                <Btn label="Find an opponent" sub={lobby ? `${lobby.waiting} waiting, ${lobby.playing} playing` : undefined}
                  disabled={deck.length < 5} onPress={playPvp} />
                <Txt style={{ color: D.dim, fontSize: 12.5, marginTop: 6 }}>
                  {lobby?.record ? `Record: ${lobby.record.w} won, ${lobby.record.l} lost, ${lobby.record.d} drawn. ` : ''}
                  No cards change hands: it's for glory.
                </Txt>
              </Panel>
            </>
          ) : null}
        </>
      )}
      <Txt style={{ color: D.dim, fontSize: 11, textAlign: 'center', marginTop: 6 }}>Card art and sounds: Nalfey. Tetra Master is Square Enix's.</Txt>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ImageBackground source={TM.background} style={{ flex: 1, backgroundColor: D.bg }} resizeMode="cover">
      <View style={{ ...FILL, backgroundColor: 'rgba(5,3,10,0.55)' }} />
      <ScrollView contentContainerStyle={{ padding: 10, paddingBottom: 24 }}>{children}</ScrollView>
    </ImageBackground>
  );
}

function Header() {
  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <Gold size={28}>Tetra Master</Gold>
      <View style={[st.rule, { width: 180, marginTop: 4 }]} />
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ the match
function useGame(game: Game) {
  const [v, setV] = useState<GameView>(game.view);
  useEffect(() => game.subscribe(setV), [game]);
  return v;
}

function Match({ game, kind, level, who, onQuit, onAgain }: { game: Game; kind: 'local' | 'pvp'; level: AI.Level; who: Char | null;
  onQuit: () => void; onAgain: () => void }) {
  const v = useGame(game);
  const [W, setW] = useState(360);
  const [H, setH] = useState(640);
  const [sel, setSel] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60); return () => clearInterval(t); }, []);
  useEffect(() => { if (v.turn !== 'me') setSel(null); }, [v.turn]);

  // sizes: the board takes the width (or the height left over), cards keep Nalfey's 42 x 51 shape
  const handW = Math.min(64, (W - 20) / 5 - 6);
  const top = 70;
  const boardS = Math.min((W - 16) / 224, (H - top - handW * 51 / 42 - 90) / 240);
  const bw = 224 * boardS, bh = 240 * boardS;
  const cell = (x: number, y: number) => ({ left: (25 + (x - 1) * 42) * boardS, top: (9 + (y - 1) * 52) * boardS });
  const myTurn = v.phase === 'play' && v.turn === 'me' && !v.busy;

  const tapCell = (x: number, y: number) => {
    if (v.choose && myTurn) {
      const k = v.choose.findIndex((o) => o.x === x && o.y === y);
      if (k >= 0) { sfx('tm_choose'); game.chooseBattle(k + 1); }
      return;
    }
    if (!myTurn || sel === null || v.cells[`${x},${y}`]) { if (myTurn && sel === null) sfx('tm_error'); return; }
    game.place(sel + 1, x, y);
    setSel(null);
  };

  let me = 0, opp = 0;
  for (const c of Object.values(v.cells)) if (c.side === 'me') me++; else if (c.side === 'opp') opp++;

  const opponentFace = v.opponent.portrait !== undefined ? TM.people[v.opponent.portrait]
    : v.opponent.race ? portraitOf(v.opponent.race, v.opponent.face || 0) : null;
  const battle = v.anim?.kind === 'battle' ? v.anim : null;
  const bt = battle ? Math.min(1, (Date.now() - battle.t0) / 1300) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }} onLayout={(e) => { setW(Math.min(560, e.nativeEvent.layout.width)); setH(e.nativeEvent.layout.height); }}>
      <ImageBackground source={TM.background} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={{ ...FILL, backgroundColor: 'rgba(5,3,10,0.35)' }} />
      </ImageBackground>
      {/* the opponent */}
      <View style={st.topBar}>
        {opponentFace ? <Image source={opponentFace} style={st.oppFace} /> : <View style={st.oppFace} />}
        <View style={{ flex: 1 }}>
          <Gold size={15}>{v.phase === 'wait' ? 'Looking for an opponent...' : v.opponent.name}</Gold>
          <Text style={st.small}>
            {kind === 'local' ? `Computer, ${level}` : v.opponent.record ? `${v.opponent.record.w}-${v.opponent.record.l}-${v.opponent.record.d}` : ''}
            {v.seconds !== null && v.phase === 'play' ? `   ${v.turn === 'me' ? 'Your turn' : 'Their turn'}: ${v.seconds}s` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {v.phase !== 'wait' && Array.from({ length: v.oppCount }).map((_, i) => <CardView key={i} card={null} width={24} style={{ marginLeft: -9 }} />)}
        </View>
      </View>

      {v.phase === 'wait' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Image source={TM.coin[Math.floor(Date.now() / 90) % 8]} style={{ width: 58, height: 72, marginBottom: 14 }} />
          <Gold size={18}>Looking for an opponent</Gold>
          <Text style={[st.small, { marginTop: 8, textAlign: 'center' }]}>
            {v.waiting ? `${v.waiting.waiting} waiting, ${v.waiting.playing} playing right now.` : 'Asking the hub...'}{'\n'}A match starts as soon as someone else joins.
          </Text>
          <Btn label="Stop looking" onPress={onQuit} style={{ marginTop: 18, minWidth: 180 }} />
        </View>
      ) : (
        <>
          {/* the board */}
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <View style={{ width: bw, height: bh }}>
              <Image source={TM.grid} style={{ width: bw, height: bh }} resizeMode="stretch" />
              {[1, 2, 3, 4].map((x) => [1, 2, 3, 4].map((y) => {
                const c = v.cells[`${x},${y}`];
                const p = cell(x, y);
                const flash = v.anim?.kind === 'flash' && v.anim.x === x && v.anim.y === y;
                const fight = v.choose?.some((o) => o.x === x && o.y === y);
                return (
                  <Pressable key={`${x}${y}`} onPress={() => tapCell(x, y)} accessibilityLabel={`square ${x} ${y}`}
                    style={{ position: 'absolute', left: p.left, top: p.top, width: 42 * boardS, height: 51 * boardS }}>
                    {c?.block ? <Image source={c.block === 2 ? TM.block2 : TM.block1} style={{ width: 42 * boardS, height: 51 * boardS }} />
                      : c?.card ? <CardView card={c.card} side={c.side === 'me' ? 'blue' : 'red'} width={42 * boardS} glow={flash} />
                        : myTurn && sel !== null ? <View style={st.cellHint} /> : null}
                    {fight ? <View style={st.fight}><Gold size={13}>Fight?</Gold></View> : null}
                  </Pressable>
                );
              }))}
              {battle ? (
                <>
                  {[{ x: battle.ax, y: battle.ay, from: battle.ap, to: battle.af }, { x: battle.dx, y: battle.dy, from: battle.dp, to: battle.df }].map((b, i) => {
                    const p = cell(b.x, b.y);
                    const k = Math.min(1, Math.max(0, (bt - 0.2) / 0.45));
                    return (
                      <View key={i} style={{ position: 'absolute', left: p.left, top: p.top + 16 * boardS, width: 42 * boardS, alignItems: 'center' }}>
                        <Text style={st.power}>{Math.round(b.from - (b.from - b.to) * k)}</Text>
                      </View>
                    );
                  })}
                  {bt > 0.2 && bt < 0.7 ? (() => {
                    const a = cell(battle.ax, battle.ay), d = cell(battle.dx, battle.dy);
                    const fr = Math.min(7, Math.floor((bt - 0.2) / 0.0625));
                    return <Image source={TM.boom[fr]} style={{ position: 'absolute', left: (a.left + d.left) / 2 + 6 * boardS, top: (a.top + d.top) / 2 + 10 * boardS, width: 30 * boardS, height: 28 * boardS }} />;
                  })() : null}
                </>
              ) : null}
              {v.phase === 'coin' ? (
                <View style={st.overlay}>
                  <Image source={TM.coin[Math.floor(Date.now() / 80) % 8]} style={{ width: 58, height: 72 }} />
                  <Gold size={18} style={{ marginTop: 8 }}>{v.first === 'me' ? 'You go first' : `${v.opponent.name || 'They'} goes first`}</Gold>
                </View>
              ) : null}
            </View>
          </View>

          {/* score and messages */}
          <View style={st.scoreRow}>
            <Image source={TM.blue[Math.min(10, me)]} style={st.digit} resizeMode="contain" />
            <Text style={[st.small, { flex: 1, textAlign: 'center', color: v.note ? D.gold : D.dim }]} numberOfLines={2}>
              {v.note || (v.phase !== 'play' ? '' : v.choose && myTurn ? 'Two battles: tap the one to fight.' : myTurn ? (sel === null ? 'Your turn: pick a card.' : 'Now tap an empty square.') : 'Their turn...')}
            </Text>
            <Image source={TM.red[Math.min(10, opp)]} style={st.digit} resizeMode="contain" />
          </View>

          {/* your hand */}
          <View style={st.hand}>
            {v.hand.map((c, i) => (
              <Pressable key={c.key} onPress={() => { if (!myTurn || v.choose) return; sfx('tm_cursor'); setSel(sel === i ? null : i); }}
                accessibilityLabel={`hand ${i + 1} ${R.cardName(c.id)}`}
                style={{ marginHorizontal: 3, transform: [{ translateY: sel === i ? -10 : 0 }] }}>
                <CardView card={c} side="blue" width={handW} glow={sel === i} dim={!myTurn} />
              </Pressable>
            ))}
          </View>

          <View style={[st.row, { justifyContent: 'center', marginTop: 8 }]}>
            {v.phase !== 'over' ? <Btn small label={kind === 'pvp' ? 'Give up' : 'Leave'} onPress={onQuit} /> : null}
          </View>
        </>
      )}

      {v.phase === 'over' && v.result ? (
        <View style={st.resultWrap}>
          <Panel style={{ alignItems: 'center', minWidth: 260 }}>
            <Gold size={30}>{v.result.winner === 'draw' ? 'Draw' : v.result.winner === 'me' ? (v.result.perfect ? 'Perfect!' : 'You win') : 'You lose'}</Gold>
            <Text style={[st.small, { marginTop: 4 }]}>
              {v.result.how === 'left' ? (v.result.winner === 'me' ? 'Your opponent left the match.' : 'You left the match.') : `${v.result.me} to ${v.result.opp}`}
            </Text>
            {v.result.gil > 0 ? <Gold size={18} style={{ marginTop: 8 }}>+{n(v.result.gil)} gil</Gold> : null}
            {v.upgrades.map((u) => <Text key={u.uid} style={[st.small, { color: D.good }]}>{R.cardName(u.id)} is now class {u.type}!</Text>)}
            {(v.result.gil > 0 || v.upgrades.length) && who ? <Text style={[st.small, { marginTop: 4, textAlign: 'center' }]}>It reaches {who.name} at your next PLAY.</Text> : null}
            <View style={[st.row, { marginTop: 14 }]}>
              <Btn label={kind === 'pvp' ? 'Find another' : 'Play again'} onPress={onAgain} style={{ flex: 1 }} />
              <Btn label="Back" onPress={onQuit} style={{ flex: 1 }} />
            </View>
          </Panel>
        </View>
      ) : null}
    </View>
  );
}

const FILL = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 };
const corner = { position: 'absolute' as const, width: 10, height: 10, borderColor: D.edgeHi };
const st = StyleSheet.create({
  panel: { backgroundColor: D.panel, borderWidth: 1, borderColor: D.edge, borderRadius: 3, padding: 12, marginBottom: 10 },
  panelHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rule: { flex: 1, height: 1, backgroundColor: D.edge },
  cornerTL: { ...corner, left: -1, top: -1, borderLeftWidth: 2, borderTopWidth: 2 },
  cornerTR: { ...corner, right: -1, top: -1, borderRightWidth: 2, borderTopWidth: 2 },
  cornerBL: { ...corner, left: -1, bottom: -1, borderLeftWidth: 2, borderBottomWidth: 2 },
  cornerBR: { ...corner, right: -1, bottom: -1, borderRightWidth: 2, borderBottomWidth: 2 },
  btn: { backgroundColor: '#2A1A3E', borderWidth: 1, borderColor: D.edge, borderRadius: 3, paddingVertical: 9, paddingHorizontal: 10, alignItems: 'center', marginHorizontal: 3 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 12 },
  btnDown: { backgroundColor: '#4A2E66', borderColor: D.edgeHi },
  btnText: { fontFamily: CINZEL, color: D.gold, fontSize: 14.5 },
  btnSub: { color: D.dim, fontSize: 11.5, marginTop: 1, fontFamily: 'Selawik' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 },
  cardName: { color: D.dim, fontSize: 9.5, width: 58, textAlign: 'center' },
  chip: { alignItems: 'center', padding: 6, marginRight: 6, borderWidth: 1, borderColor: '#3A2C18', borderRadius: 3, backgroundColor: D.panel, width: 84 },
  chipOn: { borderColor: D.edgeHi },
  chipFace: { width: 48, height: 45, borderRadius: 2 },
  chipName: { color: D.text, fontSize: 13, marginTop: 3, fontFamily: 'Selawik-Semibold' },
  chipSub: { color: D.dim, fontSize: 11 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, backgroundColor: 'rgba(10,6,18,0.85)', borderBottomWidth: 1, borderBottomColor: D.edge },
  oppFace: { width: 44, height: 44, borderWidth: 1, borderColor: D.edge, backgroundColor: '#000' },
  small: { color: D.dim, fontSize: 12.5, fontFamily: 'Selawik' },
  cellHint: { flex: 1, borderWidth: 1, borderColor: 'rgba(232,200,120,0.45)', borderStyle: 'dashed', borderRadius: 2 },
  fight: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  power: { fontFamily: CINZEL, fontSize: 20, color: '#FFE6A0', textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 1, height: 1 } },
  overlay: { ...FILL, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginTop: 6, minHeight: 34 },
  digit: { width: 30, height: 34 },
  hand: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, paddingTop: 10 },
  resultWrap: { ...FILL, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 20 },
});
void Platform;
