// The Ventures pixel stage: a camp's backdrop, the party on the left, the monster on the right, played back from the
// venture's timeline (src/ventures/api.ts). Phases: on the road (walking in), fighting (attacks in turn, the monster
// flinches, damage numbers, its HP running down to the next kill), resting (sitting, "Zz"), home (victory pose).
// Plain React Native views and images on a 240 x 126 grid, like the fishing scene, so it runs the same everywhere.
import React, { useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { FRAME, GROUND, MOB_H, MOB_W, MOBS, MOBT, MOBT_H, MOBT_W, PARTY, PARTY_H, PARTY_W, SCENES, SCENE_H, SCENE_W } from './art';
import { HAIR_TONES, MASK_ROW, MASK_ROWS, MATE_COLS, MATE_F, MATE_FROWS, MATE_MASK, MATE_POSE, MATE_SHEET, NECK, RACE_FIT, RACE_LOOK,
  SKIN_TONES } from './mate_art';
import { GEN_COLS, GEN_CX, GEN_FH, GEN_FOOT, GEN_FROWS, GEN_FW, GEN_POSE, GEN_SHEET, GEN_TALL } from './gen_art';
import type { Camp, Ev, PartyMember, VMate } from './api';
import { F } from '../ui';
import { LinearGradient } from 'expo-linear-gradient';
import { timeOfDay, TimeOfDay, vanaNow } from '../fishing/vanatime';

export const STAGE_RATIO = SCENE_W / SCENE_H;
const JOBS = ['WAR', 'MNK', 'WHM', 'BLM', 'RDM', 'THF', 'PLD', 'DRK', 'BST', 'BRD', 'RNG', 'SAM', 'NIN', 'DRG', 'SMN', 'BLU', 'COR', 'PUP'];
const CASTERS = new Set(['WHM', 'BLM', 'RDM', 'SMN', 'BRD', 'SCH', 'GEO']);
// feet positions (grid x centre, y), front of the party first
const SPOTS: [number, number][] = [[104, 108], [84, 118], [70, 100], [52, 113], [36, 103], [20, 119]];
const MOB_AT: [number, number] = [182, 112];
// (2026-11-25) the light of the Vana'diel hour outdoors; caves, towers and halls keep their own light
const INDOOR = new Set(['korroloka', 'gusgen', 'oztroja', 'ssg', 'crawlers', 'garlaige', 'gustav', 'onzozo', 'kuftal', 'krt', 'boyahda',
  'ifrits', 'den', 'aydeewa']);
const TINT: Record<TimeOfDay, [string, string] | null> = {
  dawn: ['rgba(120,70,160,0.22)', 'rgba(255,150,90,0.18)'], day: null,
  dusk: ['rgba(110,40,120,0.28)', 'rgba(255,110,60,0.22)'], night: ['rgba(6,10,40,0.38)', 'rgba(10,20,64,0.26)'],
};
const CAMPFIRE: [number, number] = [64, 116];
const MOB_SCALE = 1.35;
const MOBT_SCALE = 1.1;

/** Kaza's pixelled monster for this camp monster by name, else the drawn look. */
function mobArt(mob: { name: string; look: string }) {
  const own = MOBT[mob.name.replace(/[^A-Za-z0-9]/g, '_')];
  return own
    ? { src: own, fw: MOBT_W, fh: MOBT_H, scale: MOBT_SCALE }
    : { src: MOBS[mob.look] || MOBS.slime, fw: MOB_W, fh: MOB_H, scale: MOB_SCALE };
}

/** Kaza's hero for this mate: men Aeodin or Dario, women Kayame or Lazulai (by face); Elvaan women Kayame (her long
 * ears), Mithra Lazulai. */
function heroFor(race: number, face: number): string {
  const [r, sex] = RACE_LOOK[race] || RACE_LOOK[1];
  if (r === 'elvaan' && sex === 'f') return 'Kayame';
  if (r === 'mithra') return 'Lazulai';
  const pick = Math.floor(face / 2) % 2;
  return sex === 'm' ? (pick ? 'Dario' : 'Aeodin') : (pick ? 'Lazulai' : 'Kayame');
}

const INK = '#181418';
// his heroes at their own 64 px (2026-11-25 v2), drawn as tall as v1's 40 px at 0.85 were, so the camps still fit
const MATE_SCALE = (40 * 0.85) / 64;
// what each job does in a fight: swing a weapon, thrust (fists, lance, puppet, claws), shoot, or cast
const THRUST = new Set(['MNK', 'DRG', 'PUP', 'BST']);
const SHOOT = new Set(['RNG', 'COR']);

/** The mate frame for one of the old 10 poses (FRAME, used by the party sprites and the fishing scene). A job with a
 * generated sheet (`gen`) is played more slowly: its frames are whole drawings, not in-betweens, and flicker when rushed. */
export function mateFrame(old: number, job = 'WAR', step = 0, gen = !!GEN_SHEET[job]): number {
  const P = MATE_POSE;
  const attack = CASTERS.has(job) ? P.cast : THRUST.has(job) ? P.thrust : SHOOT.has(job) ? P.shoot : P.swing;
  switch (old) {
    case FRAME.idle0: case FRAME.idle1: return P.idle[[0, 1, 2, 1][Math.floor(step / (gen ? 3 : 1)) % 4]];
    case FRAME.walk0: case FRAME.walk1: return P.walk[[0, 1, 2, 1][Math.floor(step / (gen ? 2 : 1)) % 4]];
    case FRAME.atk0: return attack[0];
    case FRAME.atk1: return attack[attack.length - 1];
    case FRAME.cast: return P.cast[Math.floor(step / (gen ? 3 : 1)) % 2];
    case FRAME.hurt: return P.hurt[0];
    case FRAME.sit: return P.sit[0];
    case FRAME.win: return P.win[Math.floor(step / (gen ? 3 : 1)) % 2];
  }
  return P.idle[0];
}

/** One horizontal slice (rows y0..y1) of one frame of a sheet, sized sx by sy, centred on cx with its bottom on `bottom`
 * (grid pixels). Used to give each race its build: the head and the body are sized apart. */
function Slice({ src, frame, row = 0, rows = 1, y0, y1, sx, sy, cx, bottom, P, tint }: {
  src: any; frame: number; row?: number; rows?: number; y0: number; y1: number; sx: number; sy: number; cx: number;
  bottom: number; P: number; tint?: string;
}) {
  const fw = MATE_F * sx * P;
  const fh = MATE_F * sy * P;
  const h = (y1 - y0) * sy * P;
  const col = frame % MATE_COLS;
  const frow = Math.floor(frame / MATE_COLS);
  return (
    <View style={{ position: 'absolute', left: Math.round(cx * P - fw / 2), top: Math.round(bottom * P - h), width: Math.ceil(fw),
      height: Math.ceil(h), overflow: 'hidden' }}>
      <Image source={src} resizeMode="stretch" style={{ position: 'absolute', left: -col * fw, top: -((row * MATE_FROWS + frow) * fh) - y0 * sy * P,
        width: fw * MATE_COLS, height: fh * MATE_FROWS * rows, ...(tint ? { tintColor: tint } : null) }} />
    </View>
  );
}

// (2026-11-26) Jobs that have a generated sheet (gen_art.ts, art/gen_mates.py) are drawn from it: the job has a file
// for every race look, so there is nothing to tint or rebuild. A job without one stays Kaza's.
const GEN_SCALE = 31 / GEN_TALL;          // a Hume stands 31 grid pixels tall, about as tall as Kaza's heroes
/** For each of the 22 mate frames (MATE_POSE): [the generated sheet's frame, squash, steps back]. */
const GEN_OF: [number, number, number][] = [];
{
  const put = (from: number[], to: number[], squash = 1, back = 0) =>
    from.forEach((f, k) => { GEN_OF[f] = [to[Math.min(k, to.length - 1)], squash, back]; });
  put(MATE_POSE.idle, GEN_POSE.idle);
  put(MATE_POSE.walk, GEN_POSE.walk);
  put(MATE_POSE.swing, GEN_POSE.attack);
  put(MATE_POSE.thrust, GEN_POSE.attack);
  put(MATE_POSE.shoot, GEN_POSE.attack);
  put(MATE_POSE.cast, GEN_POSE.ability);                  // a mage's attack is its spell
  put(MATE_POSE.win, GEN_POSE.ability);
  put(MATE_POSE.hurt, GEN_POSE.hurt);
  put(MATE_POSE.evade, [GEN_POSE.idle[0]], 1, 5);         // the sheets have no dodge: a step back
  put(MATE_POSE.sit, [GEN_POSE.idle[1]], 0.82);           // nor a seat: hunkered down
}

/** A squad mate from its job's generated sheet: the file of its race look, sized by its race. `frame` is one of the 22
 * mate frames, as for Kaza's heroes. */
function GenMate({ m, frame, x, y, P }: { m: Extract<Member, { kind: 'mate' }>; frame: number; x: number; y: number; P: number }) {
  const look = RACE_LOOK[m.race] || RACE_LOOK[1];
  const looks = GEN_SHEET[m.job];
  const src = looks[Math.max(0, Math.min(looks.length - 1, (m.race | 0) - 1))];
  const [f, squash, back] = GEN_OF[frame] || GEN_OF[0];
  const sx = GEN_SCALE * look[2] * P;                     // screen pixels for one of the frame's pixels
  const sy = sx * squash;
  const fw = GEN_FW * sx;
  const fh = GEN_FH * sy;
  return (
    <View style={{ position: 'absolute', left: Math.round((x - back) * P - GEN_CX * sx), top: Math.round(y * P - GEN_FOOT * sy),
      width: Math.ceil(fw), height: Math.ceil(fh), overflow: 'hidden' }}>
      <Image source={src} resizeMode="stretch" style={{ position: 'absolute', left: -(f % GEN_COLS) * fw, top: -Math.floor(f / GEN_COLS) * fh,
        width: fw * GEN_COLS, height: fh * GEN_FROWS }} />
    </View>
  );
}

/** A squad mate as in the game. A job with a generated sheet: the picture of the mate's race look in that job
 * (GenMate). Any other job: Kaza's hero (KazaMate). */
function Mate(p: { m: Extract<Member, { kind: 'mate' }>; frame: number; x: number; y: number; P: number }) {
  return GEN_SHEET[p.m.job] ? <GenMate {...p} /> : <KazaMate {...p} />;
}

/** Kaza's hero in the job's outfit, with the character's own hair colour (by face) and race: skin, build (Taru short
 * and round, Elvaan long, Galka broad and big), Elvaan ears, Mithra ears and tail, Galka tail. */
function KazaMate({ m, frame, x, y, P }: { m: Extract<Member, { kind: 'mate' }>; frame: number; x: number; y: number; P: number }) {
  const [race, sex] = RACE_LOOK[m.race] || RACE_LOOK[1];
  const face = Math.max(0, Math.min(15, m.face | 0));
  const key = `${heroFor(m.race, face)}_${m.job}`;
  const sheet = MATE_SHEET[key] ? key : 'Aeodin_WAR';
  const hair = (HAIR_TONES[race] || HAIR_TONES.hume)[face];
  const skin = SKIN_TONES[race] || SKIN_TONES.hume;
  const [hx, hy, bx, by] = (RACE_FIT[race] || RACE_FIT.hume).map((v) => v * MATE_SCALE);
  const neck = (NECK[sheet] || [])[frame] ?? 29;
  const feet = y + 5 * by;                          // his frames have ~5 rows under the feet
  const headBottom = feet - (MATE_F - neck) * by;
  const layers: [any, number | null, string | undefined][] = [[MATE_SHEET[sheet], null, undefined]];
  const mask = (name: string, tint: string) => layers.push([MATE_MASK[sheet], MASK_ROW[name], tint]);
  if (race === 'mithra' || race === 'galka') {
    mask('tail_ink', INK);
    mask('tail', race === 'galka' ? skin[2] : hair[2]);
  }
  for (let i = 0; i < 4; i++) mask(`hair${i}`, hair[i]);
  for (let i = 0; i < 4; i++) mask(`skin${i}`, skin[i]);
  if (race === 'elvaan' && sex === 'm') { mask('elf_ink', INK); mask('elf_ear', skin[1]); }
  if (race === 'mithra') { mask('cat_ink', INK); mask('cat_ears', hair[1]); }
  return (
    <>
      {layers.map(([src, row, tint], i) => (
        <Slice key={'b' + i} src={src} frame={frame} row={row ?? 0} rows={row == null ? 1 : MASK_ROWS} y0={neck} y1={MATE_F}
          sx={bx} sy={by} cx={x} bottom={feet} P={P} tint={tint} />
      ))}
      {layers.map(([src, row, tint], i) => (
        <Slice key={'h' + i} src={src} frame={frame} row={row ?? 0} rows={row == null ? 1 : MASK_ROWS} y0={0} y1={neck}
          sx={hx} sy={hy} cx={x} bottom={headBottom} P={P} tint={tint} />
      ))}
    </>
  );
}

/** A character as Kaza's hero in its job, with its own hair, skin and build, for other screens: the fishing scene's
 * angler (always his: the rod is held where his heroes' hands are, and the generated sheets carry weapons and pets).
 * job = the game's job number (1 WAR .. 18 PUP); x, y = the feet, in 240-wide grid pixels. */
export function MateFigure({ race, face, job, frame, x, y, P }: { race: number; face: number; job: number; frame: number; x: number;
  y: number; P: number }) {
  const j = JOBS[job - 1] || 'WAR';
  return <KazaMate m={{ kind: 'mate', race, face, job: j, weapon: 0 }} frame={mateFrame(frame, j, Math.floor(Date.now() / 300), false)}
    x={x} y={y} P={P} />;
}

export type Phase = 'road' | 'fight' | 'rest' | 'home';
export type Member = { kind: 'mate'; race: number; job: string; face: number; weapon: number } | { kind: 'party'; idx: number; job: string };

export function membersOf(mates: VMate[], party: PartyMember[]): Member[] {
  const out: Member[] = mates.map((m) => ({ kind: 'mate', race: m.race, job: JOBS[m.job - 1] || 'WAR', face: m.face || 0,
    weapon: m.weapon || 0 }));
  party.forEach((p, i) => {
    let h = 0;
    for (const ch of p.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    // (2026-11-27, Hurami: the party members a venture recruits were Kaza's small party sprites, smaller than the squad)
    // drawn with the same generated job sprites as your mates, in their own race (from the hub; else one by name)
    if (GEN_SHEET[p.job]) {
      const race = p.race >= 1 && p.race <= 8 ? p.race : 1 + (h % 8);
      out.push({ kind: 'mate', race, job: p.job, face: h % 16, weapon: 0 });
    } else {
      out.push({ kind: 'party', idx: (h + i) % Math.max(1, PARTY.length), job: p.job });
    }
  });
  return out.slice(0, 6);
}

/** Where a venture stands at `sec` seconds in: the phase, the camp, the monster being fought and its HP. */
export function stateAt(events: Ev[], sec: number, over: boolean) {
  let camp = events.find((e) => e.k === 'arrive')?.camp || '';
  let arrive = events.find((e) => e.k === 'arrive')?.t ?? 0;
  let last: Ev | null = null;
  let next: Ev | null = null;
  let rest: Ev | null = null;
  for (const e of events) {
    if ((e.k === 'arrive' || e.k === 'move') && e.t <= sec && e.camp) camp = e.camp;
    if (e.k === 'rest' && e.t <= sec && sec < e.t + (e.d || 0)) rest = e;
    if (e.k === 'kill') {
      if (e.t <= sec) last = e;
      else if (!next) next = e;
    }
  }
  const phase: Phase = over ? 'home' : sec < arrive ? 'road' : rest ? 'rest' : 'fight';
  const from = last ? last.t : arrive;
  const to = next ? next.t : from + 120;
  const hp = next ? Math.max(0.03, 1 - (sec - from) / Math.max(1, to - from)) : 1;
  return { phase, camp, fighting: next || last, last, hp, roadT: arrive ? Math.min(1, sec / arrive) : 1 };
}

function Sheet({ src, fw, fh, frames, frame, x, y, P, scale = 1, o = 1, flash = false, row = 0, rows = 1, tint }: {
  src: any; fw: number; fh: number; frames: number; frame: number; x: number; y: number; P: number; scale?: number; o?: number; flash?: boolean;
  row?: number; rows?: number; tint?: string;
}) {
  const w = fw * scale * P;
  const h = fh * scale * P;
  return (
    <View style={{ position: 'absolute', left: Math.round((x - (fw * scale) / 2) * P), top: Math.round((y - fh * scale) * P), width: w, height: h,
      overflow: 'hidden', opacity: o }}>
      <Image source={src} style={{ position: 'absolute', left: -frame * w, top: -row * h, width: w * frames, height: h * rows,
        ...(tint ? { tintColor: tint } : null) }} />
      {flash ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.25)' }]} /> : null}
    </View>
  );
}

export default function Stage({ camps, events, sec, over, mates, party, still, label }: {
  camps: Record<string, Camp>; events: Ev[]; sec: number; over: boolean; mates: VMate[]; party: PartyMember[];
  still?: Phase; label?: string;
}) {
  const [box, setBox] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setTick((n) => n + 1), 120);
    return () => clearInterval(t);
  }, [still]);
  const P = box / SCENE_W;
  const st = useMemo(() => stateAt(events, sec, over), [events, sec, over]);
  const phase: Phase = still || st.phase;
  const camp = camps[st.camp] || Object.values(camps)[0];
  const scene = (camp && SCENES[camp.scene]) || SCENES.ronfaure;
  const fe = st.fighting && st.fighting.c ? camps[st.fighting.c] : camp;
  const mob = fe && st.fighting && st.fighting.m != null ? fe.mobs[st.fighting.m] : camp?.mobs[0];
  const members = membersOf(mates, party);
  const c = tick % 18;
  // (2026-11-26) a mate with a sheet of its own makes its other move on every fourth turn: a fighter its job's
  // ability (a battle cry, an aura, a roll of the dice: nothing lands on the monster then), a mage a blow with its
  // weapon in place of a spell
  const other = (m: Member, i: number) => m.kind === 'mate' && !!GEN_SHEET[m.job] && (Math.floor((tick - i * 3) / 18) + i) % 4 === 3;
  const special = (m: Member, i: number) => other(m, i) && !CASTERS.has(m.job);
  const hitNow = phase === 'fight' && members.some((m, i) => c === (i * 3 + 1) % 18 && !special(m, i));
  const hitAfter = phase === 'fight' && members.some((m, i) => c === (i * 3 + 2) % 18 && !special(m, i));     // the frame after a hit
  const onLayout = (e: LayoutChangeEvent) => setBox(e.nativeEvent.layout.width);
  const tod = (camp && INDOOR.has(camp.scene)) ? 'day' : timeOfDay(vanaNow().hour);
  const tint = TINT[tod];
  // a kill a moment ago: the fallen monster fades out (and the next one fades in) with the exp it gave
  const since = st.last ? sec - st.last.t : 99;
  const fallen = phase === 'fight' && st.last && since >= 0 && since < 2.5 && st.last !== st.fighting
    ? ((st.last.c ? camps[st.last.c] : camp)?.mobs[st.last.m ?? 0] || null) : null;
  const shake = hitNow ? ((tick * 7) % 3) - 1 : 0;
  const dmg = 20 + ((tick * 37) % 140);
  const crit = dmg > 140;

  return (
    <View style={st_.wrap} onLayout={onLayout}>
      {P > 0 && (
        <View style={[st_.full, { transform: [{ translateX: shake * P }, { translateY: (hitNow ? 1 : 0) * P }] }]}>
          <Image source={scene.bg} style={st_.full} />
          {phase === 'fight' && mob ? (
            <>
              <View style={[st_.shadow, { left: (MOB_AT[0] - 16) * P, top: (MOB_AT[1] - 3) * P, width: 32 * P, height: 6 * P, borderRadius: 16 * P }]} />
              {fallen ? (
                <Sheet {...mobArt(fallen)} frames={4} P={P} frame={3} x={MOB_AT[0] + 4 + since * 3} y={MOB_AT[1]} o={Math.max(0, 1 - since / 1.2)} />
              ) : null}
              <Sheet {...mobArt(mob)} frames={4} P={P} o={fallen ? Math.min(1, Math.max(0, (since - 0.8) / 1.2)) : 1}
                frame={hitNow ? 3 : c % 9 === 4 ? 2 : tick % 4 < 2 ? 0 : 1} x={MOB_AT[0] + (hitNow ? 2 : 0)} y={MOB_AT[1]} />
              {hitNow ? [0, 1, 2, 3, 4, 5].map((k) => {                       // sparks where the blow lands
                const a = (k / 6) * Math.PI * 2 + tick;
                return <View key={'s' + k} style={[st_.px, { left: (MOB_AT[0] - 8 + Math.cos(a) * 12) * P, top: (MOB_AT[1] - 24 + Math.sin(a) * 9) * P,
                  width: 3 * P, height: 3 * P, backgroundColor: k % 2 ? '#FFE680' : '#FFFFFF', borderColor: '#5A3000', borderWidth: P * 0.5 }]} />;
              }) : null}
              {hitNow || hitAfter ? (
                <Text style={[st_.dmg, { left: (MOB_AT[0] - 8) * P, top: (MOB_AT[1] - 44 - (hitAfter ? 6 : 0)) * P, fontSize: (crit ? 11 : 9) * P,
                  color: crit ? '#FFE060' : '#FFFFFF', opacity: hitAfter ? 0.55 : 1 }]}>
                  {String(dmg)}
                </Text>
              ) : null}
              {fallen ? (
                <Text style={[st_.dmg, { left: (MOB_AT[0] - 18) * P, top: (MOB_AT[1] - 50 - since * 8) * P, fontSize: 8 * P, color: '#9EF0FF',
                  opacity: Math.max(0, 1 - since / 2.5) }]}>
                  {st.last?.x ? `+${st.last.x} EXP` : 'Defeated!'}
                </Text>
              ) : null}
            </>
          ) : null}
          {members
            .map((m, i) => ({ m, i, spot: SPOTS[i] }))
            .sort((a, b) => a.spot[1] - b.spot[1])
            .map(({ m, i, spot }) => {
              let frame: number = tick % 6 < 3 ? FRAME.idle0 : FRAME.idle1;
              let mf: number | null = null;                  // a squad mate's own frame (22 of them), when it differs
              let x = spot[0];
              if (phase === 'road') {
                frame = (tick + i) % 4 < 2 ? FRAME.walk0 : FRAME.walk1;
                x = spot[0] - 70 * (1 - st.roadT) + ((tick % 2) ? 0.5 : 0);
              } else if (phase === 'rest') {
                frame = FRAME.sit;
              } else if (phase === 'home') {
                frame = tick % 8 < 5 ? FRAME.win : FRAME.idle0;
              } else {
                const k = (c - i * 3 + 18) % 18;
                const own = special(m, i);                             // a fighter's ability this turn, not its attack
                const casts = CASTERS.has(m.job) && !other(m, i);      // a mage's spell (on its other turn: its weapon)
                if (k === 0) frame = casts ? FRAME.cast : FRAME.atk0;
                else if (k === 1) frame = casts ? FRAME.cast : FRAME.atk1;
                if (k === 1 && !own && !casts && !SHOOT.has(m.job)) x += 6;
                if (m.kind === 'mate') {
                  // the whole move: wind-up, strike, follow-through (a cast or an ability: raise, then release)
                  const atk = casts || own ? MATE_POSE.cast : THRUST.has(m.job) ? MATE_POSE.thrust
                    : SHOOT.has(m.job) ? MATE_POSE.shoot : MATE_POSE.swing;
                  if (k <= 2) mf = atk[Math.min(atk.length - 1, k)];
                  else if (i === 0 && c % 9 === 4) mf = (Math.floor(c / 9) + i) % 2 ? MATE_POSE.evade[0] : MATE_POSE.hurt[0];
                }
              }
              const casting = frame === FRAME.cast;
              const fx: React.ReactNode[] = [
                <View key={'sh' + i} style={[st_.shadow, { left: (x - 9) * P, top: (spot[1] - 2) * P, width: 18 * P, height: 4 * P, borderRadius: 9 * P }]} />,
              ];
              if (casting) {                                           // a glow at the caster's feet, motes rising
                fx.push(<View key={'g' + i} style={[st_.glow, { left: (x - 12) * P, top: (spot[1] - 4) * P, width: 24 * P, height: 7 * P, borderRadius: 12 * P }]} />);
                [0, 1, 2].forEach((k) => fx.push(<View key={'m' + i + k} style={[st_.px, { left: (x - 6 + k * 6) * P,
                  top: (spot[1] - 10 - ((tick * 3 + k * 5) % 22)) * P, width: P * 1.5, height: P * 1.5, backgroundColor: k === 1 ? '#C8F4FF' : '#FFFFFF' }]} />));
              }
              if (phase === 'road') {                                  // dust behind the feet
                [0, 1].forEach((k) => fx.push(<View key={'d' + i + k} style={[st_.px, { left: (x - 8 - k * 4 - ((tick + i) % 3)) * P,
                  top: (spot[1] - 2 - k) * P, width: (2 + k) * P, height: (2 + k) * P, backgroundColor: 'rgba(214,196,160,0.55)' }]} />));
              }
              const body = m.kind === 'mate' ? <Mate key={i} m={m} frame={mf ?? mateFrame(frame, m.job, tick + i)} x={x} y={spot[1]} P={P} />
                : <Sheet key={i} src={PARTY[m.idx] || PARTY[0]} fw={PARTY_W} fh={PARTY_H} frames={10} frame={frame} x={x} y={spot[1]} P={P} />;
              return <React.Fragment key={'f' + i}>{fx}{body}</React.Fragment>;
            })}
          <Image source={scene.fg} style={st_.full} />
          {phase === 'rest' ? (                                         // the campfire
            <>
              <View style={[st_.glow, { left: (CAMPFIRE[0] - 22) * P, top: (CAMPFIRE[1] - 10) * P, width: 44 * P, height: 16 * P, borderRadius: 22 * P,
                backgroundColor: 'rgba(255,150,60,0.22)' }]} />
              <View style={[st_.px, { left: (CAMPFIRE[0] - 6) * P, top: (CAMPFIRE[1] - 2) * P, width: 12 * P, height: 2 * P, backgroundColor: '#6A3A1C' }]} />
              {[[-3, '#FF7020', 7], [0, '#FFB030', 9 + (tick % 3)], [3, '#FF7020', 6 + ((tick + 1) % 2)], [0, '#FFF0A0', 4 + (tick % 2)]].map(([dx, col, hgt], k) => (
                <View key={'fl' + k} style={[st_.px, { left: (CAMPFIRE[0] - 1.5 + (dx as number)) * P, top: (CAMPFIRE[1] - 2 - (hgt as number)) * P,
                  width: 3 * P, height: (hgt as number) * P, backgroundColor: col as string }]} />
              ))}
              <View style={[st_.px, { left: (CAMPFIRE[0] - 1 + ((tick % 4) - 2)) * P, top: (CAMPFIRE[1] - 16 - (tick % 8)) * P, width: P, height: P, backgroundColor: '#FFD080' }]} />
            </>
          ) : null}
          {phase === 'home' ? [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {        // the homecoming: sparkles over the party
            const x = 20 + ((k * 53 + tick * 3) % 120);
            const y = 30 + ((k * 29 + tick * 5) % 60);
            return (tick + k) % 3 ? <View key={'h' + k} style={[st_.px, { left: x * P, top: y * P, width: 2 * P, height: 2 * P,
              backgroundColor: k % 2 ? '#FFE680' : '#FFFFFF' }]} /> : null;
          }) : null}
          {tint ? <LinearGradient pointerEvents="none" colors={tint} style={st_.full} /> : null}
          {phase === 'rest' ? (
            <Text style={[st_.zz, { left: 72 * P, top: (70 - (tick % 6)) * P, fontSize: 9 * P }]}>{tick % 12 < 6 ? 'Z z' : 'z Z'}</Text>
          ) : null}
          {phase === 'fight' && mob ? (
            <View style={[st_.hud, { right: 4 * P, top: 4 * P, padding: 2 * P, borderRadius: 2 * P }]}>
              <Text style={[st_.hudText, { fontSize: 7 * P }]} numberOfLines={1}>
                {mob.name}{st.fighting?.lv ? `  Lv.${st.fighting.lv}` : ''}
              </Text>
              <View style={[st_.hpBack, { height: 2.5 * P, marginTop: 1.5 * P }]}>
                <View style={[st_.hp, { width: `${Math.round(st.hp * 100)}%`, backgroundColor: st.hp < 0.25 ? '#E05040' : st.hp < 0.5 ? '#E0B040' : '#58C050' }]} />
              </View>
            </View>
          ) : null}
          {label ? (
            <View style={[st_.label, { left: 4 * P, top: 4 * P, padding: 2 * P, borderRadius: 2 * P }]}>
              <Text style={[st_.hudText, { fontSize: 7 * P }]}>{label}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const st_ = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: STAGE_RATIO, overflow: 'hidden', backgroundColor: '#101828' },
  full: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  dmg: { position: 'absolute', color: '#FFFFFF', fontFamily: F.bold, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  zz: { position: 'absolute', color: '#FFFFFF', fontFamily: F.bold, textShadowColor: '#203060', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  hud: { position: 'absolute', backgroundColor: 'rgba(10,16,48,0.82)', borderWidth: 1, borderColor: '#A3ACD6', minWidth: '34%', maxWidth: '50%' },
  label: { position: 'absolute', backgroundColor: 'rgba(10,16,48,0.82)', borderWidth: 1, borderColor: '#A3ACD6', maxWidth: '58%' },
  hudText: { color: '#F4E6B8', fontFamily: F.bold },
  hpBack: { backgroundColor: '#202838', borderRadius: 1, overflow: 'hidden' },
  hp: { height: '100%' },
  px: { position: 'absolute' },
  shadow: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.25)' },
  glow: { position: 'absolute', backgroundColor: 'rgba(170,230,255,0.35)' },
});
