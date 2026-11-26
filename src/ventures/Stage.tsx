// The Ventures pixel stage: a camp's backdrop, the party on the left, the monster on the right, played back from the
// venture's timeline (src/ventures/api.ts). Phases: on the road (walking in), fighting (attacks in turn, the monster
// flinches, damage numbers, its HP running down to the next kill), resting (sitting, "Zz"), home (victory pose).
// Plain React Native views and images on a 240 x 126 grid, like the fishing scene, so it runs the same everywhere.
import React, { useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { FRAME, GROUND, MOB_H, MOB_W, MOBS, MOBT, MOBT_H, MOBT_W, PARTY, PARTY_H, PARTY_W, SCENES, SCENE_H, SCENE_W } from './art';
import { HAIR_TONES, MASK_ROW, MASK_ROWS, MATE_F, MATE_MASK, MATE_SHEET, NECK, RACE_FIT, RACE_LOOK, SKIN_TONES } from './mate_art';
import type { Camp, Ev, PartyMember, VMate } from './api';
import { F } from '../ui';

export const STAGE_RATIO = SCENE_W / SCENE_H;
const JOBS = ['WAR', 'MNK', 'WHM', 'BLM', 'RDM', 'THF', 'PLD', 'DRK', 'BST', 'BRD', 'RNG', 'SAM', 'NIN', 'DRG', 'SMN', 'BLU', 'COR', 'PUP'];
const CASTERS = new Set(['WHM', 'BLM', 'RDM', 'SMN', 'BRD', 'SCH', 'GEO']);
// feet positions (grid x centre, y), front of the party first
const SPOTS: [number, number][] = [[104, 108], [84, 118], [70, 100], [52, 113], [36, 103], [20, 119]];
const MOB_AT: [number, number] = [182, 112];
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
const MATE_SCALE = 0.85;      // his heroes are drawn a little bigger than the party and the camps were laid out for

/** One horizontal slice (rows y0..y1) of one frame of a sheet, sized sx by sy, centred on cx with its bottom on `bottom`
 * (grid pixels). Used to give each race its build: the head and the body are sized apart. */
function Slice({ src, frame, row = 0, rows = 1, y0, y1, sx, sy, cx, bottom, P, tint }: {
  src: any; frame: number; row?: number; rows?: number; y0: number; y1: number; sx: number; sy: number; cx: number;
  bottom: number; P: number; tint?: string;
}) {
  const fw = MATE_F * sx * P;
  const fh = MATE_F * sy * P;
  const h = (y1 - y0) * sy * P;
  return (
    <View style={{ position: 'absolute', left: Math.round(cx * P - fw / 2), top: Math.round(bottom * P - h), width: Math.ceil(fw),
      height: Math.ceil(h), overflow: 'hidden' }}>
      <Image source={src} style={{ position: 'absolute', left: -frame * fw, top: -(row * fh) - y0 * sy * P, width: fw * 10,
        height: fh * rows, ...(tint ? { tintColor: tint } : null) }} />
    </View>
  );
}

/** A squad mate as in the game: Kaza's hero in the job's outfit, with the mate's own hair colour (by face) and race:
 * skin, build (Taru short and round, Elvaan long, Galka broad and big), Elvaan ears, Mithra ears and tail, Galka tail. */
function Mate({ m, frame, x, y, P }: { m: Extract<Member, { kind: 'mate' }>; frame: number; x: number; y: number; P: number }) {
  const [race, sex] = RACE_LOOK[m.race] || RACE_LOOK[1];
  const face = Math.max(0, Math.min(15, m.face | 0));
  const key = `${heroFor(m.race, face)}_${m.job}`;
  const sheet = MATE_SHEET[key] ? key : 'Aeodin_WAR';
  const hair = (HAIR_TONES[race] || HAIR_TONES.hume)[face];
  const skin = SKIN_TONES[race] || SKIN_TONES.hume;
  const [hx, hy, bx, by] = (RACE_FIT[race] || RACE_FIT.hume).map((v) => v * MATE_SCALE);
  const neck = (NECK[sheet] || [])[frame] ?? 18;
  const feet = y + 3 * by;                          // his frames have ~3 rows under the feet
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

export type Phase = 'road' | 'fight' | 'rest' | 'home';
export type Member = { kind: 'mate'; race: number; job: string; face: number; weapon: number } | { kind: 'party'; idx: number; job: string };

export function membersOf(mates: VMate[], party: PartyMember[]): Member[] {
  const out: Member[] = mates.map((m) => ({ kind: 'mate', race: m.race, job: JOBS[m.job - 1] || 'WAR', face: m.face || 0,
    weapon: m.weapon || 0 }));
  party.forEach((p, i) => {
    let h = 0;
    for (const ch of p.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    out.push({ kind: 'party', idx: (h + i) % Math.max(1, PARTY.length), job: p.job });
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
    const t = setInterval(() => setTick((n) => n + 1), 160);
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
  const hitNow = phase === 'fight' && members.some((_, i) => (c === (i * 3 + 1) % 18));
  const onLayout = (e: LayoutChangeEvent) => setBox(e.nativeEvent.layout.width);

  return (
    <View style={st_.wrap} onLayout={onLayout}>
      {P > 0 && (
        <>
          <Image source={scene.bg} style={st_.full} />
          {phase === 'fight' && mob ? (
            <>
              <Sheet {...mobArt(mob)} frames={4} P={P}
                frame={hitNow ? 3 : c % 9 === 4 ? 2 : tick % 4 < 2 ? 0 : 1} x={MOB_AT[0] + (hitNow ? 2 : 0)} y={MOB_AT[1]} />
              {hitNow ? (
                <Text style={[st_.dmg, { left: (MOB_AT[0] - 8) * P, top: (MOB_AT[1] - 44 - (tick % 3)) * P, fontSize: 9 * P }]}>
                  {String(20 + ((tick * 37) % 140))}
                </Text>
              ) : null}
            </>
          ) : null}
          {members
            .map((m, i) => ({ m, i, spot: SPOTS[i] }))
            .sort((a, b) => a.spot[1] - b.spot[1])
            .map(({ m, i, spot }) => {
              let frame: number = tick % 6 < 3 ? FRAME.idle0 : FRAME.idle1;
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
                if (k === 0) frame = CASTERS.has(m.job) ? FRAME.cast : FRAME.atk0;
                else if (k === 1) frame = CASTERS.has(m.job) ? FRAME.cast : FRAME.atk1;
                if (k === 1 && !CASTERS.has(m.job)) x += 6;
              }
              if (m.kind === 'mate') {
                return <Mate key={i} m={m} frame={frame} x={x} y={spot[1]} P={P} />;
              }
              return <Sheet key={i} src={PARTY[m.idx] || PARTY[0]} fw={PARTY_W} fh={PARTY_H} frames={10} frame={frame} x={x} y={spot[1]} P={P} />;
            })}
          <Image source={scene.fg} style={st_.full} />
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
        </>
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
});
