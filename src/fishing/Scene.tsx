// The water while you fish, in pixel art. Every zone has its own backdrop (src/fishing/lakes.ts, painted by
// art/make_pixel_lakes.py at 240x126 "pixels"); everything that moves is drawn on the same pixel grid and steps at
// 30 frames a second, like an old console game:
//  - the place: light glinting on the water, the foreground swaying, birds by day, stars and fireflies by night, drips
//    falling from cave ceilings, a fish jumping somewhere now and then; outdoors the sky follows the Vana'diel clock;
//  - the rod whips back and forward on the cast and bends under load; the line sags when slack, goes taut in a fight;
//  - the bobber flies out, sits half under, gets nibbles, and plunges on a bite;
//  - the fish's shadow (its own shape: a fish, an eel, a crab...) runs the way the arrows point, closer as it tires,
//    breaking the surface on a good tug and thrashing near the end;
//  - the catch leaps out flipping and dangles from the line, or the line snaps, or the bobber skips back.
// Plain React Native views and images (no canvas), so it works the same on phones, the website and the PC app.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LAKES, Lake } from './lakes';
import { FISH_PX, PX_BIRD0, PX_BIRD1, PX_BOBBER, PX_REEL, PX_RIPPLE0, PX_RIPPLE1, PX_RIPPLE2, PX_RIPPLE3, PX_RIPPLE4, PX_RIPPLE5, PX_STAR } from './sprites';
import { DAYS, DAY_COLORS, TimeOfDay, timeOfDay, vanaNow } from './vanatime';

export type Phase = 'idle' | 'cast' | 'wait' | 'bite' | 'fight' | 'caught' | 'lost';
export const SCENE_RATIO = 240 / 126;
const GW = 240;                      // the pixel grid
const GH = 126;
const RIPPLES = [PX_RIPPLE0, PX_RIPPLE1, PX_RIPPLE2, PX_RIPPLE3, PX_RIPPLE4, PX_RIPPLE5];
const FALLBACK_LAKE = LAKES[100] || Object.values(LAKES)[0];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

type FxKind = 'ripple' | 'big' | 'far' | 'splash' | 'bigsplash' | 'bubble' | 'drip' | 'burst' | 'snap' | 'cave';
type Drop = { vx: number; vy: number; s: number };
type Fx = { id: number; kind: FxKind; x: number; y: number; born: number; life: number; drops?: Drop[]; land?: number; landed?: boolean };
const LIFE: Record<FxKind, number> = { ripple: 1.0, big: 1.1, far: 0.6, splash: 0.75, bigsplash: 0.95, bubble: 0.55, drip: 0.5, burst: 0.9, snap: 0.35, cave: 2 };

type Sim = {
  t: number; bend: number; bendV: number; castT: number; landed: boolean;
  bx: number; by: number; fx: number; fy: number; fvx: number; fvy: number; face: number; surf: number;
  shake: number; reel: number; reelV: number; nibble: number; nextNibble: number; wakeAt: number; thrashAt: number;
  bubbleAt: number; dripAt: number; leapT: number; lx: number; ly: number; burst: boolean; snapT: number; homeT: number;
  lost: 'snap' | 'home' | null; farAt: number; caveAt: number; fx_: Fx[]; fxId: number;
};

/** One square on the pixel grid. */
const Px = ({ x, y, s = 1, c, o = 1, P }: { x: number; y: number; s?: number; c: string; o?: number; P: number }) => (
  <View style={{ position: 'absolute', left: Math.round(x) * P, top: Math.round(y) * P, width: s * P, height: s * P, backgroundColor: c, opacity: o }} />
);
/** A sprite drawn w x h grid pixels (times k), its top-left on the grid. */
const Spr = ({ src, x, y, w, h, P, flip = false, o = 1, k = 1 }: { src: any; x: number; y: number; w: number; h: number; P: number; flip?: boolean; o?: number; k?: number }) => (
  <Image source={src} style={{ position: 'absolute', left: Math.round(x) * P, top: Math.round(y) * P, width: Math.round(w * k) * P, height: Math.round(h * k) * P, opacity: o,
    transform: flip ? [{ scaleX: -1 }] : undefined }} />
);

const TINT: Record<TimeOfDay, [string, string, string] | null> = {
  dawn: ['rgba(110,60,150,0.34)', 'rgba(255,150,90,0.28)', 'rgba(40,40,90,0.24)'],
  day: null,
  dusk: ['rgba(90,30,110,0.40)', 'rgba(255,110,60,0.32)', 'rgba(40,20,60,0.36)'],
  night: ['rgba(4,8,34,0.76)', 'rgba(10,20,64,0.58)', 'rgba(2,6,26,0.66)'],
};

export default function Scene({ phase, arrow, hitTick, missTick = 0, stamina = 100, catchName, catchSize, isItem, critical, large, hour, zoneId, fishId }: {
  phase: Phase; arrow: 'L' | 'R' | null; hitTick: number; missTick?: number; stamina?: number; catchName?: string; catchSize?: number;
  isItem?: boolean; critical?: boolean; large?: boolean; hour?: number; zoneId?: number | null; fishId?: number | null;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [, setFrame] = useState(0);
  const [clock, setClock] = useState(() => vanaNow());
  const lake: Lake = (zoneId != null && LAKES[zoneId]) || FALLBACK_LAKE;
  const P = box.w / GW;
  const hz = Math.round(GH * lake.hz);
  const cave = lake.kind === 'cave';
  const tod: TimeOfDay = cave ? 'day' : lake.kind === 'night' ? 'night' : timeOfDay(hour ?? clock.hour);
  const night = tod === 'night';
  const sprite = (fishId != null && FISH_PX[fishId]) || FISH_PX[4401] || Object.values(FISH_PX)[0];

  const prev = useRef<Phase>('idle');
  const live = useRef({ phase, arrow, stamina, hz, cave });
  live.current = { phase, arrow, stamina, hz, cave };
  const sim = useRef<Sim>({
    t: 0, bend: 0.04, bendV: 0, castT: 1, landed: true, bx: 0, by: 0, fx: 0, fy: 0, fvx: 0, fvy: 0, face: -1, surf: 0,
    shake: 0, reel: 0, reelV: 0, nibble: 0, nextNibble: 0, wakeAt: 0, thrashAt: 0, bubbleAt: 0, dripAt: 0,
    leapT: 0, lx: 0, ly: 0, burst: false, snapT: 1, homeT: 1, lost: null, farAt: rnd(3, 7), caveAt: rnd(1, 3), fx_: [], fxId: 0,
  }).current;

  const add = useCallback((kind: FxKind, x: number, y: number, extra?: Partial<Fx>) => {
    const f: Fx = { id: ++sim.fxId, kind, x, y, born: sim.t, life: LIFE[kind], ...extra };
    if (kind === 'splash' || kind === 'bigsplash') {
      const n = kind === 'bigsplash' ? 12 : 8;
      const k = kind === 'bigsplash' ? 1.35 : 1;
      f.drops = Array.from({ length: n }, (_, i) => ({ vx: ((i / (n - 1)) * 2 - 1) * 22 * k + rnd(-4, 4), vy: -rnd(28, 52) * k, s: Math.random() < 0.3 ? 2 : 1 }));
    }
    if (kind === 'burst') f.drops = Array.from({ length: 8 }, (_, i) => ({ vx: Math.cos((i / 8) * Math.PI * 2) * 40, vy: Math.sin((i / 8) * Math.PI * 2) * 26, s: 1 }));
    sim.fx_ = [...sim.fx_.slice(-40), f];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const t = setInterval(() => setClock(vanaNow()), 20000); return () => clearInterval(t); }, []);

  // ---- the rod (grid units): from the bottom-right corner up to the tip, bent by the load
  const butt = { x: GW + 6, y: GH + 10 };
  const tip0 = { x: GW * 0.84, y: GH * 0.2 };
  const rodLen = Math.hypot(tip0.x - butt.x, tip0.y - butt.y);
  const a0 = Math.atan2(tip0.y - butt.y, tip0.x - butt.x);
  const castWhip = (c: number) => (c < 0.3 ? 0.38 * Math.sin((c / 0.3) * Math.PI / 2) : c < 0.5 ? lerp(0.38, -0.3, (c - 0.3) / 0.2) : -0.3 * (1 - (c - 0.5) / 0.5) ** 2);
  const rodPath = (step: number) => {
    const whip = sim.castT < 1 ? castWhip(sim.castT) : 0;
    const sway = 0.012 * Math.sin(sim.t * 1.3);
    const pts: { x: number; y: number; u: number }[] = [];
    let x = butt.x;
    let y = butt.y;
    const n = Math.ceil(rodLen / step);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const a = a0 + whip + sway - sim.bend * 1.0 * u ** 1.7;
      x += Math.cos(a) * rodLen / n;
      y += Math.sin(a) * rodLen / n;
      pts.push({ x, y, u });
    }
    return pts;
  };
  const rodTip = () => { const p = rodPath(6); return p[p.length - 1]; };

  // ---- phase changes
  useEffect(() => {
    if (!box.w) return;
    const from = prev.current;
    prev.current = phase;
    if (phase === 'cast') {
      sim.bx = Math.round(GW * rnd(0.26, 0.58));
      sim.by = Math.round(hz + (GH - hz) * rnd(0.3, 0.55));
      sim.castT = 0; sim.landed = false;
      sim.leapT = 0; sim.snapT = 1; sim.homeT = 1; sim.lost = null; sim.surf = 0;
      sim.nextNibble = sim.t + rnd(1.4, 2.6);
    }
    if (phase === 'bite') {
      sim.bendV += critical ? 9 : 6;
      sim.shake = critical ? 3 : large ? 2.5 : 1.6;
      add('big', sim.bx, sim.by + 1);
      add('splash', sim.bx, sim.by);
      if (critical) add('snap', sim.bx, sim.by - 12);
    }
    if (phase === 'fight') {
      sim.fx = sim.bx; sim.fy = sim.by + 3; sim.fvx = 0; sim.fvy = 0; sim.face = -1;
      sim.thrashAt = sim.t + 1.5;
      add('ripple', sim.bx, sim.by);
    }
    if (phase === 'caught') {
      sim.leapT = 0; sim.burst = false;
      sim.lx = from === 'fight' ? sim.fx : sim.bx;
      sim.ly = from === 'fight' ? sim.fy : sim.by;
      sim.shake = 2.5; sim.reelV = 18;
      add('bigsplash', sim.lx, sim.ly);
      add('big', sim.lx, sim.ly + 1);
    }
    if (phase === 'lost') {
      if (from === 'fight' || from === 'bite') {
        sim.lost = 'snap'; sim.snapT = 0; sim.bendV -= 4; sim.shake = 2;
        add('snap', sim.fx || sim.bx, (sim.fy || sim.by) - 4);
        add('splash', sim.fx || sim.bx, sim.fy || sim.by);
      } else {
        sim.lost = 'home'; sim.homeT = 0; sim.reelV = 14;
        add('ripple', sim.bx, sim.by);
      }
    }
    if (phase === 'idle') sim.surf = 0;
  }, [phase, box.w]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {                                   // a good tug
    if (!hitTick || live.current.phase !== 'fight') return;
    sim.surf = 1; sim.shake = Math.max(sim.shake, 1.6); sim.bendV -= 5; sim.reelV = 16;
    add('splash', sim.fx, sim.fy);
    add('ripple', sim.fx, sim.fy + 1);
  }, [hitTick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {                                   // a wrong tug: the fish runs
    if (!missTick || live.current.phase !== 'fight') return;
    sim.fvx += sim.face * 140; sim.bendV += 6; sim.reelV = -10;
    add('far', sim.fx, sim.fy + 1);
  }, [missTick]); // eslint-disable-line react-hooks/exhaustive-deps

  function leapPos() {
    const u = easeOut(clamp(sim.leapT, 0, 1));
    const hang = sim.leapT > 1 ? Math.round(Math.sin((sim.leapT - 1) * 9) * 1.5) : 0;
    return { x: lerp(sim.lx, GW * 0.5, u), y: lerp(sim.ly, GH * 0.42, u) - Math.sin(Math.PI * Math.min(1, sim.leapT)) * GH * 0.2 + hang };
  }
  function homePos() {
    const u = sim.homeT;
    const tp = rodTip();
    return { x: lerp(sim.bx, tp.x, u * u), y: lerp(sim.by, tp.y + 8, u * u * u) - Math.abs(Math.sin(u * Math.PI * 3)) * 6 * (1 - u) };
  }

  // ---- the loop: 30 steps a second while something happens, 12 while resting
  useEffect(() => {
    if (!box.w) return;
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const L = live.current;
      const busy = L.phase !== 'idle' || Math.abs(sim.bendV) > 0.02 || sim.castT < 1 || sim.fx_.length > 0;
      if (last && now - last < (busy ? 1000 / 30 : 1000 / 12) - 2) return;
      const dt = last ? Math.min(0.08, (now - last) / 1000) : 0.033;
      last = now;
      sim.t += dt;
      const t = sim.t;
      const ph = L.phase;
      let target = 0.04;
      if (ph === 'wait') target = 0.06 + sim.nibble * 0.12;
      if (ph === 'bite') target = 0.42 + 0.08 * Math.sin(t * 26);
      if (ph === 'fight') target = 0.24 + 0.42 * (L.stamina / 100) + (L.arrow ? 0.2 : 0) + 0.04 * Math.sin(t * 38);
      if (ph === 'caught') target = 0.3 * (1 - clamp(sim.leapT - 0.6, 0, 1)) + 0.12;
      sim.bendV += (target - sim.bend) * 140 * dt - sim.bendV * 9 * dt;
      sim.bend = clamp(sim.bend + sim.bendV * dt, -0.05, 1.2);
      sim.shake *= Math.exp(-dt * 9);
      sim.surf *= Math.exp(-dt * 3.5);
      sim.nibble *= Math.exp(-dt * 7);
      sim.reelV += ((ph === 'fight' ? 3 : 0) - sim.reelV) * dt * 2.5;
      sim.reel += sim.reelV * dt;
      if (sim.castT < 1) {
        sim.castT = Math.min(1, sim.castT + dt / 0.8);
        if (sim.castT >= 1 && !sim.landed) { sim.landed = true; add('splash', sim.bx, sim.by); add('big', sim.bx, sim.by + 1); }
      }
      if (ph === 'wait' && sim.landed && t > sim.nextNibble) { sim.nibble = 1; sim.nextNibble = t + rnd(1.2, 3.4); add('far', sim.bx, sim.by + 2); }
      if (ph === 'bite' && t > sim.bubbleAt) { sim.bubbleAt = t + 0.1; add('bubble', sim.bx + rnd(-5, 5), sim.by + rnd(0, 3)); }
      if (ph === 'fight') {
        const tired = 1 - L.stamina / 100;
        const tx = clamp(sim.bx + (L.arrow ? (L.arrow === 'L' ? -1 : 1) * GW * 0.24 : GW * 0.07 * Math.sin(t * 0.8)), GW * 0.18, GW * 0.8);
        const ty = clamp(sim.by + tired * (GH * 0.9 - sim.by) * 0.55 + 3 * Math.sin(t * 1.9), L.hz + 8, GH * 0.9);
        const k = L.arrow ? 16 : 5;
        const c = 2 * Math.sqrt(k) * 0.75;
        sim.fvx += ((tx - sim.fx) * k - sim.fvx * c) * dt;
        sim.fvy += ((ty - sim.fy) * k - sim.fvy * c) * dt;
        sim.fvx = clamp(sim.fvx, -240, 240);
        sim.fx += sim.fvx * dt;
        sim.fy += sim.fvy * dt;
        if (sim.fvx < -8) sim.face = -1;
        if (sim.fvx > 8) sim.face = 1;
        if (Math.abs(sim.fvx) > 30 && t > sim.wakeAt) { sim.wakeAt = t + 0.16; add('far', sim.fx - sim.face * 14, sim.fy + 2); }
        if (tired > 0.62 && t > sim.thrashAt) { sim.thrashAt = t + rnd(0.8, 1.5); sim.surf = 0.9; add('splash', sim.fx, sim.fy); sim.bendV += 3; }
      }
      if (ph === 'caught') {
        sim.leapT = Math.min(1.6, sim.leapT + dt / 0.85);
        if (sim.leapT < 0.85 && t > sim.dripAt) { sim.dripAt = t + 0.06; const p = leapPos(); add('drip', p.x, p.y + 4); }
        if (sim.leapT >= 1 && !sim.burst) { sim.burst = true; const p = leapPos(); add('burst', p.x, p.y); }
      }
      if (ph === 'lost' && sim.lost === 'snap') { sim.snapT = Math.min(1, sim.snapT + dt / 1.1); sim.fy -= dt * 14; sim.fx += sim.face * dt * 30; }
      if (ph === 'lost' && sim.lost === 'home') {
        const was = sim.homeT;
        sim.homeT = Math.min(1, sim.homeT + dt / 0.75);
        if (was < 0.33 && sim.homeT >= 0.33) { const p = homePos(); add('far', p.x, p.y + 2); }
        if (was < 0.6 && sim.homeT >= 0.6) { const p = homePos(); add('far', p.x, p.y + 2); }
      }
      if (ph !== 'fight' && ph !== 'caught' && t > sim.farAt) {
        sim.farAt = t + rnd(7, 15);
        add('far', rnd(0.08, 0.92) * GW, L.hz + (GH - L.hz) * rnd(0.06, 0.28));
      }
      if (L.cave && t > sim.caveAt) {                     // a drip from the ceiling
        sim.caveAt = t + rnd(1.5, 4);
        add('cave', rnd(0.05, 0.75) * GW, rnd(4, 14), { land: L.hz + rnd(2, (GH - L.hz) * 0.5) });
      }
      for (const f of sim.fx_) {
        if (f.kind === 'cave' && !f.landed) {
          const y = f.y + 0.5 * 160 * (t - f.born) ** 2;
          if (y >= f.land!) { f.landed = true; f.life = 0; add('far', f.x, f.land!); }
        }
      }
      sim.fx_ = sim.fx_.filter((f) => t - f.born < f.life);
      setFrame((n) => (n + 1) & 0xffff);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [box.w]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the place, fixed per zone
  const amb = useMemo(() => ({
    glints: Array.from({ length: 12 }, () => { const k = Math.random(); return { x: rnd(0, GW), y: Math.round(hz + 3 + k * k * (GH - hz - 6)), w: Math.round(2 + rnd(0, 6) * (0.5 + k)), ph: rnd(0, 6), sp: rnd(0.6, 1.4) }; }),
    stars: Array.from({ length: 26 }, () => ({ x: Math.round(rnd(0, GW)), y: Math.round(rnd(0, hz * 0.8)), ph: rnd(0, 6) })),
    flies: Array.from({ length: 8 }, () => ({ x: rnd(4, GW * 0.6), y: rnd(hz + 6, GH - 6), ph: rnd(0, 6), r: rnd(4, 12) })),
    bird: { y: Math.round(rnd(0.15, 0.55) * hz), at: rnd(2, 8) },
  }), [zoneId, hz]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const t = sim.t;
  const out: React.ReactNode[] = [];
  let n = 0;
  const key = () => 'k' + n++;

  if (P > 0) {
    // ambient
    for (const g of amb.glints) {
      const v = Math.sin(t * g.sp + g.ph);
      if (v > 0.55) out.push(<View key={key()} style={{ position: 'absolute', left: Math.round(g.x + (Math.round(t * 2 * g.sp) % 6)) * P, top: g.y * P, width: g.w * P, height: P,
        backgroundColor: night ? '#C8D6FF' : cave ? '#9ED8E8' : '#FFF8E0', opacity: night || cave ? 0.45 : 0.75 }} />);
    }
    if (night && !cave) {
      for (const s of amb.stars) if (Math.sin(t * 2.2 + s.ph) > -0.3) out.push(<Px key={key()} x={s.x} y={s.y} c="#FFFFFF" o={Math.sin(t * 2.2 + s.ph) > 0.7 ? 1 : 0.55} P={P} />);
      for (const f of amb.flies) {
        if (Math.sin(t * 3 + f.ph) > 0) {
          const x = f.x + Math.sin(t * 0.7 + f.ph) * f.r;
          const y = f.y + Math.cos(t * 0.9 + f.ph) * f.r * 0.4;
          out.push(<Px key={key()} x={x - 1} y={y - 1} s={3} c="#E6FF8A" o={0.25} P={P} />);
          out.push(<Px key={key()} x={x} y={y} c="#F4FFB0" P={P} />);
        }
      }
    }
    if (!night && !cave && tod !== 'dusk') {
      const cyc = (t + amb.bird.at) % 18;
      if (cyc < 9) {
        const bx = -10 + (cyc / 9) * (GW + 20);
        const fr = Math.floor(t * 4) % 2 ? PX_BIRD1 : PX_BIRD0;
        [[0, 0], [7, 3], [-6, 4]].forEach(([dx, dy]) => out.push(<Spr key={key()} src={fr.img} x={bx + dx} y={amb.bird.y + dy + Math.round(Math.sin(t * 2))} w={fr.w} h={fr.h} P={P} />));
      }
    }

    // the fish under the water
    const tired = 1 - (stamina ?? 100) / 100;
    const fk = (0.85 + 0.35 * tired) * (large ? 1.15 : 1);
    if (phase === 'fight' || (phase === 'lost' && sim.lost === 'snap')) {
      const fw = sprite.w * fk;
      const fh = sprite.h * fk;
      const wig = Math.floor(t * (Math.abs(sim.fvx) > 30 ? 14 : 6)) % 2;
      const fade = phase === 'lost' ? 1 - sim.snapT : 1;
      out.push(<Spr key={key()} src={sprite.shadow} x={sim.fx - fw / 2} y={sim.fy - fh / 2 + wig} w={sprite.w} h={sprite.h} k={fk} P={P}
        flip={sim.face === 1} o={(0.5 + 0.35 * tired) * fade * (1 - Math.min(0.8, sim.surf))} />);
      if (sim.surf > 0.08 && phase === 'fight') {
        out.push(<Spr key={key()} src={sprite.img} x={sim.fx - fw / 2} y={sim.fy - fh / 2 - Math.round(3 * sim.surf)} w={sprite.w} h={sprite.h} k={fk} P={P}
          flip={(sim.face === 1) !== (Math.floor(t * 12) % 3 === 0 && sim.surf > 0.4)} />);
      }
      if (critical && phase === 'fight' && Math.floor(t * 6) % 2) out.push(<Spr key={key()} src={PX_STAR.img} x={sim.fx - 2 + Math.sin(t * 5) * 8} y={sim.fy - 9} w={5} h={5} P={P} />);
    }

    // effects
    for (const f of sim.fx_) {
      const age = t - f.born;
      const u = age / f.life;
      if (f.kind === 'ripple' || f.kind === 'big' || f.kind === 'far') {
        const frames = f.kind === 'far' ? 3 : f.kind === 'big' ? 6 : 5;
        const r = RIPPLES[Math.min(frames - 1, Math.floor(u * frames))];
        out.push(<Spr key={key()} src={r.img} x={f.x - Math.floor(r.w / 2)} y={f.y - Math.floor(r.h / 2)} w={r.w} h={r.h} P={P} o={0.9} />);
        if (f.kind === 'big' && u > 0.25) {
          const r2 = RIPPLES[Math.min(4, Math.floor(((u - 0.25) / 0.75) * 5))];
          out.push(<Spr key={key()} src={r2.img} x={f.x - Math.floor(r2.w / 2)} y={f.y - Math.floor(r2.h / 2)} w={r2.w} h={r2.h} P={P} o={0.7} />);
        }
      } else if (f.kind === 'splash' || f.kind === 'bigsplash') {
        if (age < 0.12) out.push(<Px key={key()} x={f.x - 2} y={f.y - 2} s={4} c="#EAF6FF" o={0.9} P={P} />);
        for (const d of f.drops!) {
          const y = f.y + d.vy * age + 0.5 * 160 * age * age;
          if (y > f.y + 2) continue;
          out.push(<Px key={key()} x={f.x + d.vx * age} y={y} s={d.s} c="#F2FAFF" P={P} />);
        }
      } else if (f.kind === 'bubble') {
        out.push(<Px key={key()} x={f.x + Math.sin(age * 12)} y={f.y - age * 14} c="#E4F4FF" o={1 - u} P={P} />);
      } else if (f.kind === 'drip' || f.kind === 'cave') {
        out.push(<Px key={key()} x={f.x} y={f.y + 0.5 * 160 * age * age} c={f.kind === 'cave' ? '#BFE4F4' : '#DFF0FF'} P={P} />);
      } else if (f.kind === 'burst') {
        for (const d of f.drops!) out.push(<Spr key={key()} src={PX_STAR.img} x={f.x - 2 + d.vx * easeOut(u)} y={f.y - 2 + d.vy * easeOut(u)} w={5} h={5} P={P} o={u > 0.7 ? 0.5 : 1} />);
      } else if (f.kind === 'snap') {
        out.push(<Spr key={key()} src={PX_STAR.img} x={f.x - 5} y={f.y - 5} w={5} h={5} k={2} P={P} o={1 - u * 0.6} />);
      }
    }

    // the line and the bobber
    const rod = rodPath(1);
    const tip = rod[rod.length - 1];
    let end: { x: number; y: number } | null = null;
    let slack = 0.55;
    let lineO = 0.85;
    if (sim.castT < 1 && phase !== 'idle') {
      const c = sim.castT;
      if (c < 0.42) { end = { x: tip.x - 2 + Math.sin(c * 20) * 2, y: tip.y + 9 }; slack = 0.1; }
      else {
        const v = easeOut((c - 0.42) / 0.58);
        end = { x: lerp(tip.x, sim.bx, v), y: lerp(tip.y + 9, sim.by, v) - Math.sin(Math.PI * v) * GH * 0.26 };
        slack = 0.25 + v * 0.3;
      }
    } else if (phase === 'wait') {
      end = { x: sim.bx, y: sim.by + Math.round(Math.sin(t * 3.4)) * 0.6 + sim.nibble * 3 };
    } else if (phase === 'bite') {
      end = { x: sim.bx + Math.round(Math.sin(t * 31)), y: sim.by + 3 + Math.round(Math.sin(t * 22)) };
      slack = 0.05; lineO = 0.95;
    } else if (phase === 'fight') {
      end = { x: sim.fx + sim.face * sprite.w * fk * 0.42, y: sim.fy };
      slack = 0; lineO = 1;
    } else if (phase === 'caught') {
      const p = leapPos();
      end = sim.leapT > 1 ? { x: p.x, y: p.y - sprite.h * 0.5 } : { x: p.x - sprite.w * 0.42, y: p.y };
      slack = 0.02; lineO = 0.95;
    } else if (phase === 'lost' && sim.lost === 'snap') {
      end = { x: tip.x - 8 - sim.snapT * 14 + Math.sin(t * 5) * 2, y: tip.y + GH * 0.28 * Math.min(1, sim.snapT * 2.2) };
      slack = 0.35; lineO = 0.8 - sim.snapT * 0.4;
    } else if (phase === 'lost' && sim.lost === 'home') {
      end = homePos(); slack = 0.3;
    }
    if (end) {
      const dx = end.x - tip.x;
      const dy = end.y - tip.y;
      const len = Math.hypot(dx, dy) || 1;
      const hum = phase === 'fight' ? (Math.floor(t * 30) % 2 ? 1 : -1) * 0.7 : 0;
      const c = { x: (tip.x + end.x) / 2 + (-dy / len) * hum, y: (tip.y + end.y) / 2 + slack * len * 0.22 + (dx / len) * hum };
      // stepped pixels, merged into runs (a shallow line is a few wide bars, a steep one a few tall ones)
      const N = Math.min(200, Math.ceil(len * 1.2));
      const col = night ? '#C8D4F0' : '#F4F8FF';
      let run: { x: number; y: number; w: number; h: number } | null = null;
      const flush = () => { if (run) out.push(<View key={key()} style={{ position: 'absolute', left: run.x * P, top: run.y * P, width: run.w * P, height: run.h * P, backgroundColor: col, opacity: lineO }} />); };
      let lx = -99;
      let ly = -99;
      for (let i = 0; i <= N; i++) {
        const v = i / N;
        const x = Math.round((1 - v) * (1 - v) * tip.x + 2 * (1 - v) * v * c.x + v * v * end.x);
        const y = Math.round((1 - v) * (1 - v) * tip.y + 2 * (1 - v) * v * c.y + v * v * end.y);
        if (x === lx && y === ly) continue;
        lx = x; ly = y;
        if (run && run.h === 1 && y === run.y && (x === run.x + run.w || x === run.x - 1)) { if (x < run.x) run.x = x; run.w++; continue; }
        if (run && run.w === 1 && x === run.x && (y === run.y + run.h || y === run.y - 1)) { if (y < run.y) run.y = y; run.h++; continue; }
        flush();
        run = { x, y, w: 1, h: 1 };
      }
      flush();
    }
    const showBob = (sim.castT < 1 && phase !== 'idle') || phase === 'wait' || phase === 'bite' || (phase === 'lost' && sim.lost === 'home');
    if (showBob && end) {
      const floating = (phase === 'wait' && sim.landed) || (phase === 'lost' && sim.lost === 'home' && sim.homeT < 0.15);
      const rows = phase === 'bite' ? 3 : floating ? 5 : 8;             // the rest is under the water
      out.push(
        <View key={key()} style={{ position: 'absolute', left: Math.round(end.x - 2) * P, top: Math.round(end.y - 5) * P, width: 5 * P, height: rows * P, overflow: 'hidden' }}>
          <Image source={PX_BOBBER.img} style={{ width: 5 * P, height: 8 * P }} />
        </View>,
      );
      if (floating) out.push(<View key={key()} style={{ position: 'absolute', left: Math.round(end.x - 3) * P, top: Math.round(end.y) * P, width: 7 * P, height: P, backgroundColor: '#FFFFFF', opacity: 0.45 }} />);
    }

    // the catch: it leaps out flipping, then dangles nose-up from the line
    if (phase === 'caught') {
      const p = leapPos();
      const u = clamp(sim.leapT, 0, 1);
      const k = sim.leapT > 1 ? 1.25 : lerp(0.9, 1.25, u);
      if (sim.leapT > 1 && !isItem) {
        const bw = Math.round(sprite.w * k);
        const bh = Math.round(sprite.h * k);
        out.push(
          <View key={key()} style={{ position: 'absolute', left: Math.round(p.x - bh / 2) * P, top: Math.round(p.y - bh / 2) * P, width: bh * P, height: bw * P, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={sprite.img} style={{ width: bw * P, height: bh * P, transform: [{ rotate: Math.floor(t * 3) % 2 ? '90deg' : '80deg' }] }} />
          </View>,
        );
      } else {
        out.push(<Spr key={key()} src={sprite.img} x={p.x - (sprite.w * k) / 2} y={p.y - (sprite.h * k) / 2} w={sprite.w} h={sprite.h} k={k} P={P} flip={Math.floor(u * 6) % 2 === 1} />);
      }
    }

    // the rod in front of everything, then the reel
    // chunky near the hand, one pixel at the tip; a chunk every so often (not every point) to keep it light
    const grip = rod.length * 0.16;
    let since = 99;
    rod.forEach((q, i) => {
      const s = q.u < 0.35 ? 3 : q.u < 0.7 ? 2 : 1;
      since++;
      if (since < s * 0.9 && i !== rod.length - 1) return;
      since = 0;
      if (q.y > GH + 2 || q.x > GW + 2) return;
      const ring = i % 14 === 0 && i >= grip;
      const c = i < grip ? '#2E1C10' : ring ? '#C9CED8' : i % 2 ? '#7A4E2A' : '#8A5C32';
      out.push(<Px key={key()} x={q.x - Math.floor(s / 2)} y={q.y - Math.floor(s / 2)} s={s} c={c} P={P} />);
      if (s === 3 && i >= grip && !ring) out.push(<Px key={key()} x={q.x - 1} y={q.y - 1} c="#B07A44" P={P} />);
    });
    const rp = rod[Math.floor(rod.length * 0.2)];
    if (rp) {
      out.push(<Spr key={key()} src={PX_REEL.img} x={rp.x - 9} y={rp.y - 1} w={8} h={8} P={P} />);
      out.push(<Px key={key()} x={rp.x - 5 + Math.cos(sim.reel) * 4} y={rp.y + 3 + Math.sin(sim.reel) * 4} s={2} c="#E8D8B0" P={P} />);
    }
    if (critical && phase === 'bite') out.push(<Spr key={key()} src={PX_STAR.img} x={sim.bx - 5} y={sim.by - 18 - (Math.floor(t * 8) % 2)} w={5} h={5} k={2} P={P} />);
  }

  const sx = Math.round(sim.shake * Math.sin(t * 71)) * P;
  const sy = Math.round(sim.shake * Math.cos(t * 53)) * P;
  const fgShift = lake.sway ? Math.round(Math.sin(t * 1.6)) * P : 0;
  const showTag = phase === 'caught' && !!catchName && sim.leapT > 0.75;
  const tint = TINT[tod];
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: '#0A1020' }]} onLayout={onLayout} pointerEvents="none">
      {P > 0 && (
        <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: sx }, { translateY: sy }] }]}>
          <Image source={lake.img} style={{ position: 'absolute', left: 0, top: 0, width: GW * P, height: GH * P }} />
          {tint && lake.kind !== 'night' && <LinearGradient pointerEvents="none" colors={tint} locations={[0, (hz / GH) * 0.98, 1]} style={StyleSheet.absoluteFill} />}
          {out}
          <Image source={lake.fg} style={{ position: 'absolute', left: fgShift, top: 0, width: GW * P, height: GH * P, opacity: night ? 0.85 : 1 }} />
        </View>
      )}
      {P > 0 && (
        <View style={st.clock}>
          <View style={[st.dayDot, { backgroundColor: DAY_COLORS[clock.day] }]} />
          <Text style={st.clockText}>{DAYS[clock.day]} {String(hour ?? clock.hour).padStart(2, '0')}:{String(hour != null ? 0 : clock.minute).padStart(2, '0')}</Text>
        </View>
      )}
      {showTag ? (
        <View style={st.tagWrap}>
          <View style={st.tag}>
            <Text style={st.tagText}>Obtained: <Text style={st.tagName}>{catchName}</Text></Text>
            {catchSize ? <Text style={st.tagSub}>{catchSize} ilms</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  clock: { position: 'absolute', right: 6, top: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: '#0C1230', borderWidth: 2, borderColor: '#B8C0E0' },
  dayDot: { width: 6, height: 6, marginRight: 5 },
  clockText: { color: '#F0F2FF', fontSize: 11, fontFamily: 'Pixel' },
  tagWrap: { position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center' },
  tag: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#0C1230', borderWidth: 2, borderColor: '#E8ECFF', alignItems: 'center' },
  tagText: { color: '#F0F2FF', fontSize: 14, fontFamily: 'Pixel' },
  tagName: { color: '#FFD86A', fontFamily: 'Pixel-Bold' },
  tagSub: { color: '#B8C4E8', fontSize: 11, fontFamily: 'Pixel' },
});
