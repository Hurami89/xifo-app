// FISHING (Play tab): portable fishing. Pick one of your characters, a real fishing spot, a rod and bait from the character's own
// gear, and it fishes by itself, like a fishbot (2026-11-25, the user: "take out the minigame ... it still takes a bit
// to catch a fish, comparable to in game, ... fish up a little less than in game"): see AUTO in fishing/engine.ts.
// While the app is closed the time is fished out when it opens again (at most CATCHUP_HOURS, while the bait lasts,
// and never past the game's daily DAILY_CATCHES). Catches, skill-ups and gil spent are sent to xiforever.com and arrive with the character at the
// launcher's next PLAY (delivery box, fishing skill, gil). Rules and data: src/fishing/engine.ts, src/fishData.json.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Vibration, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Btn, C, F, Pane, Strip, T, Win } from './ui';
import { faceOf } from './faces';
import { Card, cachedMe, me, newId, Pending, Report, sendReport, siteUrl } from './armory';
import { ItemIcon, PairBox } from './MeScreen';
import { getJSON, LINKS, setJSON } from './store';
import * as E from './fishing/engine';
import Scene, { Phase, SCENE_RATIO } from './fishing/Scene';
import { TH } from './theme';
import { sfx, useMusic } from './sfx';

const RANKS = ['Amateur', 'Recruit', 'Initiate', 'Novice', 'Apprentice', 'Journeyman', 'Craftsman', 'Artisan', 'Adept', 'Veteran', 'Expert'];

type Save = {
  starter: boolean;
  bait: Record<string, number>;          // phone-only bait and lures (starter pack, bought)
  ownedUsed: Record<string, number>;     // the character's own bait used, not yet sent
  skillHigh: number;                     // best known fishing skill in tenths
  unsent: { catches: Record<string, number>; skill: number; gil: number; gilFound: number };
  outbox: Report | null;                 // a report being sent (kept until xiforever.com has it)
  log: Record<string, { count: number; best: number }>;
  zone: number | null; spot: number | null; rod: number | null; baitPick: string | null;
  total: number;
  auto: { on: boolean; at: number } | null;          // the auto-fisher: on, and when it last fished (for the catch-up)
  daily: { day: string; count: number };            // catches today (the game's fishing fatigue)
};
const fresh = (): Save => ({ starter: false, bait: {}, ownedUsed: {}, skillHigh: 0, unsent: { catches: {}, skill: 0, gil: 0, gilFound: 0 },
  outbox: null, log: {}, zone: null, spot: null, rod: null, baitPick: null, total: 0, auto: null, daily: { day: '', count: 0 } });

type Line = { id: number; text: string; kind?: 'good' | 'bad' | 'skill' | 'info' };
// what the scene shows of the auto-fisher's fight (the result is already known; this only plays it out)
type Show = { fish: E.Fish; stamina: number; arrow: 'L' | 'R' | null; started: number; seconds: number; won: boolean };
type Status = { text: string; fish?: string };

export default function FishScreen({ cardsHint, goMe, active = true }: { cardsHint: Card[] | null; goMe: () => void; active?: boolean }) {
  useMusic('fishing', active);   // (2026-11-25) the fishing music while this tab shows
  const [cards, setCards] = useState<Card[] | null>(cardsHint);
  const [pending, setPending] = useState<Pending[]>([]);
  const [unpaired, setUnpaired] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [save, setSave] = useState<Save>(fresh());
  const [view, setView] = useState<'spot' | 'where' | 'shop' | 'log'>('where');
  const [region, setRegion] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [auto, setAuto] = useState(false);
  const [show, setShow] = useState<Show | null>(null);
  const [status, setStatus] = useState<Status>({ text: '' });
  const [session, setSession] = useState({ casts: 0, caught: 0 });
  const [pick, setPick] = useState<'rod' | 'bait' | null>(null);
  const [base, setBase] = useState(LINKS.website);
  const [resume, setResume] = useState(0);
  const [sending, setSending] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [hitTick, setHitTick] = useState(0);
  const [missTick, setMissTick] = useState(0);
  const [critBite, setCritBite] = useState(false);
  const [landedFish, setLandedFish] = useState<{ id: number; name: string; size: number; item: boolean; large?: boolean } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const lineId = useRef(0);
  const autoRef = useRef(false);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const fightTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const checked = useRef<Record<string, boolean>>({});
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (cardsHint) setCards(cardsHint); }, [cardsHint]);
  useEffect(() => { siteUrl().then(setBase).catch(() => {}); }, []);
  useEffect(() => {
    (async () => {
      const cached = await cachedMe();
      if (cached && !cards) { setCards(cached.cards); setPending(cached.pending); }
      const out = await me();
      if (out.unpaired) setUnpaired(true);
      if (out.cards) { setCards(out.cards); setPending(out.pending || []); setUnpaired(false); }
      setWho((w) => w || (out.cards || cached?.cards || [])[0]?.name || null);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // this character's saved fishing (per character, on this phone)
  useEffect(() => {
    if (!who) return;
    (async () => {
      const s = { ...fresh(), ...(await getJSON<Save>('fish.' + who, fresh())) };
      if (!s.starter) {
        Object.entries(E.STARTER).forEach(([id, n]) => { s.bait[id] = (s.bait[id] || 0) + n; });
        s.starter = true;
        say(`Welcome, ${who}! The guild sent you a starter pack: ${E.STARTER[17396]} Little Worms and ${E.STARTER[16998]} Balls of Insect Paste.`, 'info');
      }
      setSave(s);
      setView(s.zone ? 'spot' : 'where');
      setJSON('fish.' + who, s);
    })();
  }, [who]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = cards?.find((c) => c.name === who) || null;
  const update = (fn: (s: Save) => void) => {
    const s: Save = JSON.parse(JSON.stringify(saveRef.current));
    fn(s);
    saveRef.current = s;
    setSave(s);
    if (who) setJSON('fish.' + who, s);
  };
  const say = (text: string, kind?: Line['kind']) => setLines((l) => [...l.slice(-40), { id: ++lineId.current, text, kind }]);

  // ------------------------------------------------------------------ what the character has right now
  const rank = card?.fishing.rank || 0;
  const cap = (rank + 1) * 100;
  const pendingFor = pending.filter((p) => p.char === who);
  const skill = card ? Math.min(cap, Math.max(Math.round(card.fishing.skill * 10) + pendingFor.reduce((n, p) => n + p.skill, 0)
    + save.unsent.skill + (save.outbox?.skill || 0), save.skillHigh)) : 0;
  const gil = card ? Math.max(0, card.gil - pendingFor.reduce((n, p) => n + p.gil, 0) - save.unsent.gil - (save.outbox?.gil || 0)) : 0;
  const rods = useMemo(() => E.rodsFor((card?.fishing.rods || []).map((r) => r.id)), [card]);
  const equipped = (slot: number) => card?.equip.find((e) => e.slot === slot)?.id;      // the game's Range / Ammo slots
  const rod = rods.find((r) => r.id === save.rod) || rods.find((r) => r.id === equipped(2)) || rods[0];
  const baitList = useMemo(() => {
    const out: { key: string; bait: E.Bait; qty: number; own: boolean }[] = [];
    Object.entries(save.bait).forEach(([id, q]) => { const b = E.BAIT[id]; if (b && q > 0) out.push({ key: 'p' + id, bait: b, qty: q, own: false }); });
    (card?.fishing.bait || []).forEach((b) => {
      const bait = E.BAIT[String(b.id)];
      const left = b.qty - (save.ownedUsed[String(b.id)] || 0);
      if (bait && left > 0) out.push({ key: 'o' + b.id, bait, qty: left, own: true });
    });
    return out;
  }, [save, card]);
  const baitSel = baitList.find((b) => b.key === save.baitPick) || baitList.find((b) => b.own && b.bait.id === equipped(3))
    || baitList[0] || null;
  const zone = E.ZONES.find((z) => z.id === save.zone) || null;
  const spot = zone?.spots.find((s) => s.id === save.spot) || zone?.spots[0] || null;

  // ------------------------------------------------------------------ sending catches to the character
  const flush = useCallback(async () => {
    const s = saveRef.current;
    if (!who) return;
    const u = s.unsent;
    const hasNew = Object.keys(u.catches).length || u.skill || u.gil || u.gilFound || Object.keys(s.ownedUsed).length;
    if (!s.outbox && !hasNew) return;
    if (!s.outbox) {
      update((d) => {
        d.outbox = {
          id: newId(), char: who,
          catches: Object.entries(d.unsent.catches).map(([id, n]) => ({ item: Number(id), count: n, name: E.FISH[id]?.name || '' })),
          skill: d.unsent.skill, gil: d.unsent.gil, gilFound: d.unsent.gilFound,
          bait: Object.entries(d.ownedUsed).map(([id, n]) => ({ item: Number(id), count: n })),
        };
        d.unsent = { catches: {}, skill: 0, gil: 0, gilFound: 0 };
        d.ownedUsed = {};
      });
    }
    const out = saveRef.current.outbox!;
    setSending('Sending to your character...');
    const res = await sendReport(out);
    if (res.ok) {
      update((d) => { if (d.outbox?.id === out.id) d.outbox = null; });
      setPending((p) => [...p, { id: out.id, char: out.char, made: Date.now() / 1000, count: out.catches.reduce((n, c) => n + c.count, 0), skill: out.skill, gil: out.gil }]);
      setSending('Sent: it arrives at your next PLAY.');
    } else {
      setSending(res.offline ? 'Offline: your catches are kept and sent later.' : res.error || 'Not sent yet.');
    }
  }, [who]); // eslint-disable-line react-hooks/exhaustive-deps

  const soon = () => {
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(flush, 15000);
  };
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') flush(); });
    const t = setInterval(flush, 120000);
    return () => { sub.remove(); clearInterval(t); };
  }, [flush]);

  // ------------------------------------------------------------------ the auto-fisher
  // What the loop needs, as it is now (the loop runs in timers across renders).
  const live = useRef({ spot, rod, bait: baitSel, skill, rank, cap, city: !!zone?.city, rate: card?.fishing.rate ?? 1 });
  live.current = { spot, rod, bait: baitSel, skill, rank, cap, city: !!zone?.city, rate: card?.fishing.rate ?? 1 };
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  };
  const quiet = () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    if (fightTimer.current) clearInterval(fightTimer.current);
    fightTimer.current = null;
  };
  useEffect(() => quiet, []);                       // leaving the screen stops the timers (save.auto stays on: catch-up)

  const startAuto = () => {
    if (!spot || !rod || !baitSel || autoRef.current) return;
    autoRef.current = true;
    setAuto(true);
    setSession({ casts: 0, caught: 0 });
    update((d) => { d.auto = { on: true, at: Date.now() }; });
    say(`${who} starts fishing (${baitSel.bait.name}, ${rod.name}).`, 'info');
    castOnce();
  };
  const stopAuto = (why?: string) => {
    autoRef.current = false;
    setAuto(false);
    quiet();
    setShow(null);
    setLandedFish(null);
    setPhase('idle');
    setStatus({ text: '' });
    update((d) => { d.auto = null; });
    if (why) say(why, 'info');
    flush();
  };

  const castOnce = () => {
    if (!autoRef.current) return;
    const L = live.current;
    if (!L.spot || !L.rod) return stopAuto('Pick a fishing spot first.');
    if (!L.bait) return stopAuto('Out of bait: fishing stops. Visit the Tackle Shop or pick other bait.');
    const today = E.dayKey();
    const s = saveRef.current;
    if ((s.daily.day === today ? s.daily.count : 0) >= E.DAILY_CATCHES) {
      return stopAuto(`${who} is worn out from fishing today (${E.DAILY_CATCHES} catches). Rest until tomorrow.`);
    }
    const r = E.autoCast(L.spot, L.bait.bait, Math.floor(L.skill / 10), L.rod);
    const wait = E.waitSeconds();
    update((d) => { if (d.auto) d.auto.at = Date.now(); });
    setSession((x) => ({ ...x, casts: x.casts + 1 }));
    setPhase('cast');
    setStatus({ text: 'Casting...' });
    sfx('cast', 0.6);
    later(() => { setPhase('wait'); setStatus({ text: 'Waiting for a bite...' }); }, 800);
    later(() => {
      if (r.kind === 'nothing') {
        say("You didn't catch anything.", 'bad');
        setPhase('lost');
        setStatus({ text: 'Nothing bit. Casting again...' });
        later(() => { setPhase('idle'); next(); }, 1500);
        return;
      }
      useBait();
      const crit = r.kind === 'caught' && r.critical;
      Vibration.vibrate(crit ? [0, 60, 60, 60] : 60);
      sfx(crit ? 'gold' : 'bite', 0.7);
      say(crit ? 'Your keen senses tell you: this one is hooked fast!' : r.fish.item ? 'Something heavy and lifeless pulls at your line...'
        : r.fish.large ? 'Something clamps onto your line ferociously!' : 'Something caught the hook!', crit ? 'good' : undefined);
      setCritBite(crit);
      setPhase('bite');
      setStatus({ text: 'Something bit!' });
      later(() => playFight(r), 900);
    }, (E.CAST_SECONDS + wait) * 1000);
  };
  const next = () => later(castOnce, 700);

  /** Plays out a fight whose end is already known: the arrows, the reel, the fish tiring (or not). */
  const playFight = (r: Exclude<E.AutoResult, { kind: 'nothing' }>) => {
    const L = live.current;
    const pulls = r.kind === 'caught' || r.tired;                 // the fish tires (a too-big one still gets off at the end)
    const p = E.fightParams(r.fish, L.rod!, Math.floor(L.skill / 10), r.kind === 'caught' && r.critical);
    const started = Date.now();
    let arrowAt = started + p.every * 1000;
    let answerAt = 0;
    let dir: 'L' | 'R' | null = null;
    setPhase('fight');
    setStatus({ text: 'Fighting...', fish: r.fish.item ? 'something heavy' : 'a fish' });
    fightTimer.current = setInterval(() => {
      const now = Date.now();
      const t = (now - started) / 1000;
      const u = Math.min(1, t / r.seconds);
      const stamina = pulls ? Math.max(0, 100 * (1 - u) + 8 * Math.sin(t * 2.3) * (1 - u))
        : Math.max(25, 100 - 55 * Math.sin(Math.min(1, u * 1.4) * Math.PI / 2) + 10 * Math.sin(t * 1.7));
      if (!dir && now >= arrowAt) { dir = Math.random() < 0.5 ? 'L' : 'R'; answerAt = now + E.rand(E.AUTO_REACT[0], E.AUTO_REACT[1]) * 1000; }
      if (dir && now >= answerAt) {
        if (Math.random() < E.AUTO_ACCURACY) { setHitTick((n) => n + 1); sfx('reel', 0.25); } else setMissTick((n) => n + 1);
        dir = null;
        arrowAt = now + p.every * 1000;
      }
      setShow({ fish: r.fish, stamina, arrow: dir, started, seconds: r.seconds, won: pulls });
      if (t >= r.seconds) {
        if (fightTimer.current) clearInterval(fightTimer.current);
        fightTimer.current = null;
        finish(r);
      }
    }, 100);
  };

  const finish = (r: Exclude<E.AutoResult, { kind: 'nothing' }>) => {
    setShow(null);
    if (r.kind === 'lost') {
      say(`You lost your catch: ${r.why}.`, 'bad');
      sfx('lost', 0.6);
      setPhase('lost');
      setStatus({ text: 'It got away. Casting again...' });
      later(() => { setPhase('idle'); next(); }, 1500);
      return;
    }
    const size = landed(r.fish);
    setLandedFish({ id: r.fish.id, name: r.fish.id === E.GIL_ITEM ? 'Gil!' : r.fish.name, size, item: r.fish.item, large: r.fish.large });
    setSession((x) => ({ ...x, caught: x.caught + 1 }));
    setPhase('caught');
    setStatus({ text: 'Caught!' });
    sfx('catch', 0.7);
    later(() => { setLandedFish(null); setPhase('idle'); next(); }, E.AFTER_SECONDS * 1000 + 600);
  };

  const useBait = () => {
    const b = live.current.bait;
    if (!b || b.bait.lure) return;
    const id = String(b.bait.id);
    update((d) => {
      if (b.own) d.ownedUsed[id] = (d.ownedUsed[id] || 0) + 1;
      else d.bait[id] = Math.max(0, (d.bait[id] || 0) - 1);
    });
  };

  const landed = (fish: E.Fish): number => {
    const L = live.current;
    const size = E.sizeOf(fish);
    const today = E.dayKey();
    if (fish.id === E.GIL_ITEM) {
      const g = E.randInt(10, 120);
      say(`You fished up ${g} gil!`, 'good');
      update((d) => { d.unsent.gilFound += g; d.total += 1; });
    } else {
      say(`You caught ${/^[AEIOU]/.test(fish.name) ? 'an' : 'a'} ${fish.name}!${size ? ` (${E.ilmsText(size)})` : ''}`, 'good');
      update((d) => {
        d.unsent.catches[String(fish.id)] = (d.unsent.catches[String(fish.id)] || 0) + 1;
        const l = d.log[String(fish.id)] || { count: 0, best: 0 };
        d.log[String(fish.id)] = { count: l.count + 1, best: Math.max(l.best, size) };
        d.total += 1;
        d.daily = { day: today, count: (d.daily.day === today ? d.daily.count : 0) + 1 };
      });
    }
    const gain = Math.min(E.skillUp(fish.skill, L.skill, L.rank, L.city, L.rate), L.cap - L.skill);
    if (gain > 0) {
      const now = L.skill + gain;
      setTimeout(() => sfx('skill'), 900);
      say(`Your fishing skill rises ${(gain / 10).toFixed(1)} points.${Math.floor(now / 10) > Math.floor(L.skill / 10) ? ` Fishing skill reaches level ${Math.floor(now / 10)}!` : ''}`, 'skill');
      update((d) => { d.unsent.skill += gain; d.skillHigh = Math.max(d.skillHigh, now); });
    } else if (L.skill >= L.cap && fish.skill > Math.floor(L.skill / 10)) {
      say(`Your skill is capped at ${L.cap / 10} by your guild rank (${RANKS[L.rank]}). Rank up at the Fishermen's Guild in game to go higher.`, 'info');
    }
    soon();
    return size;
  };

  // ------------------------------------------------------------------ while the app was closed
  // The auto-fisher was on when the app closed (or the phone slept): the time since is fished out now, cast by cast
  // with the same rules, as long as the bait lasts, up to CATCHUP_HOURS and the daily limit. Then it carries on.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setResume((n) => n + 1); });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!who || !card || !spot || !rod) return;
    const s = saveRef.current;
    if (!s.auto?.on) return;
    const away = (Date.now() - s.auto.at) / 1000;
    if (away < 60) {
      if (!autoRef.current && view === 'spot' && !checked.current[who]) { checked.current[who] = true; resumeLive(); }
      return;
    }
    checked.current[who] = true;
    quiet();
    catchUp(Math.min(away, E.CATCHUP_HOURS * 3600));
  }, [who, card, spot, rod, resume]); // eslint-disable-line react-hooks/exhaustive-deps

  const resumeLive = () => {
    if (!live.current.bait) return;
    autoRef.current = true;
    setAuto(true);
    setSession({ casts: 0, caught: 0 });
    later(castOnce, 1200);
  };

  const catchUp = (seconds: number) => {
    const L = live.current;
    if (!L.spot || !L.rod) return;
    const b = L.bait;
    const today = E.dayKey();
    const s0 = saveRef.current;
    let done = s0.daily.day === today ? s0.daily.count : 0;
    let skillT = L.skill;
    let left = b ? (b.bait.lure ? Infinity : b.qty) : 0;
    let t = 0;
    let casts = 0;
    let used = 0;
    let gained = 0;
    let gil = 0;
    let why = '';
    const got: Record<string, { n: number; best: number }> = {};
    while (t < seconds) {
      if (!b || left <= 0) { why = 'the bait ran out'; break; }
      if (done >= E.DAILY_CATCHES) { why = `${who} got worn out (${E.DAILY_CATCHES} catches today)`; break; }
      const r = E.autoCast(L.spot, b.bait, Math.floor(skillT / 10), L.rod);
      t += E.castSeconds(r);
      if (t > seconds) break;
      casts++;
      if (r.kind === 'nothing') continue;
      if (!b.bait.lure) { left--; used++; }
      if (r.kind !== 'caught') continue;
      done++;
      if (r.fish.id === E.GIL_ITEM) { gil += E.randInt(10, 120); continue; }
      const size = E.sizeOf(r.fish);
      const g = got[String(r.fish.id)] || { n: 0, best: 0 };
      got[String(r.fish.id)] = { n: g.n + 1, best: Math.max(g.best, size) };
      const up = Math.min(E.skillUp(r.fish.skill, skillT, L.rank, L.city, L.rate), L.cap - skillT);
      if (up > 0) { skillT += up; gained += up; }
    }
    const caught = Object.values(got).reduce((n, g) => n + g.n, 0);
    update((d) => {
      Object.entries(got).forEach(([id, g]) => {
        d.unsent.catches[id] = (d.unsent.catches[id] || 0) + g.n;
        const l = d.log[id] || { count: 0, best: 0 };
        d.log[id] = { count: l.count + g.n, best: Math.max(l.best, g.best) };
      });
      d.total += caught + (gil ? 1 : 0);
      d.unsent.gilFound += gil;
      d.unsent.skill += gained;
      d.skillHigh = Math.max(d.skillHigh, skillT);
      d.daily = { day: today, count: done };
      if (b && used) {
        const id = String(b.bait.id);
        if (b.own) d.ownedUsed[id] = (d.ownedUsed[id] || 0) + used;
        else d.bait[id] = Math.max(0, (d.bait[id] || 0) - used);
      }
      d.auto = why ? null : { on: true, at: Date.now() };
    });
    const mins = Math.round(seconds / 60);
    const list = Object.entries(got).sort((a, b) => b[1].n - a[1].n).map(([id, g]) => `${g.n} ${E.FISH[id]?.name || '?'}`).join(', ');
    say(`While you were away (${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}), ${who} cast ${casts} times`
      + ` and caught ${caught}${list ? `: ${list}` : ''}${gil ? `, plus ${gil} gil` : ''}.`, caught ? 'good' : 'info');
    if (gained) say(`Fishing skill rose ${(gained / 10).toFixed(1)} points while you were away.`, 'skill');
    if (why) { say(`Fishing stopped: ${why}.`, 'info'); autoRef.current = false; setAuto(false); }
    else if (view === 'spot') resumeLive();
    soon();
  };

  // ------------------------------------------------------------------ screens
  if (unpaired && !cards?.length) {
    return <ScrollView contentContainerStyle={st.wrap}><PairBox onPaired={async () => { const o = await me(); if (o.cards) { setCards(o.cards); setWho(o.cards[0]?.name || null); setUnpaired(false); } }} /></ScrollView>;
  }
  if (!cards || !cards.length || !card) {
    return (
      <View style={st.wrap}>
        <Win title="Portable Fishing">
          <T style={st.p}>Fishing needs one of your characters. Press <T style={{ fontFamily: F.bold }}>SYNC NOW</T> on the launcher's Characters page, then open Me and pull down.</T>
          <Btn small label="Go to Me" onPress={goMe} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Win>
      </View>
    );
  }

  const head = (
    <View style={st.head}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
        {cards.map((c) => (
          <Pressable key={c.name} onPress={() => { if (c.name !== who) { if (autoRef.current) stopAuto(); setWho(c.name); } }}
            style={[st.chip, c.name === who && st.chipOn]}>
            <Image source={faceOf(c.race, c.face)} style={st.chipFace} />
            <T style={[st.chipName, c.name === who && { color: C.chipOnText }]}>{c.name}</T>
          </Pressable>
        ))}
      </ScrollView>
      <View style={st.stats}>
        <Stat label="Fishing" value={`${(skill / 10).toFixed(1)}`} sub={`cap ${cap / 10} · ${RANKS[rank]}`} />
        <Stat label="Gil" value={gil.toLocaleString()} />
        <Stat label="Caught" value={String(save.total)} sub={sending ? '' : undefined} />
      </View>
      {sending ? <T style={st.sending}>{sending}</T> : null}
    </View>
  );

  if (view === 'where') {
    const regions = E.regions();
    return (
      <ScrollView contentContainerStyle={st.wrap}>
        {head}
        <Win title={region || 'Where to fish?'}
          right={region ? <Btn small label="‹ Regions" onPress={() => setRegion(null)} style={st.headBtn} /> : null}>
          <Pane>
            {!region ? regions.map((r) => (
              <Pressable key={r} onPress={() => setRegion(r)} style={({ pressed }) => [st.row, pressed && st.rowOn]}>
                <T style={st.rowText}>{r}</T>
                <T style={st.rowSub}>{E.ZONES.filter((z) => z.region === r).length} places ›</T>
              </Pressable>
            )) : E.ZONES.filter((z) => z.region === region).map((z) => (
              <View key={z.id}>
                <Strip title={z.name + (z.city ? ' (town)' : '')} />
                {z.spots.map((s) => {
                  const seen = s.pool.filter(([fid]) => save.log[String(fid)]).length;
                  const lo = Math.min(...s.pool.map(([fid]) => E.FISH[String(fid)]?.skill ?? 999));
                  const hi = Math.max(...s.pool.map(([fid]) => E.FISH[String(fid)]?.skill ?? 0));
                  return (
                    <Pressable key={s.id} onPress={() => { update((d) => { d.zone = z.id; d.spot = s.id; }); setView('spot'); flush(); }}
                      style={({ pressed }) => [st.row, pressed && st.rowOn]}>
                      <T style={st.rowText}>{s.name}</T>
                      <T style={st.rowSub}>{seen}/{s.pool.length} known · lv {lo}-{hi} ›</T>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Pane>
        </Win>
      </ScrollView>
    );
  }

  if (view === 'shop') {
    return (
      <ScrollView contentContainerStyle={st.wrap}>
        {head}
        <Win title="Tackle Shop" right={<Btn small label="‹ Back" onPress={() => setView(save.zone ? 'spot' : 'where')} style={st.headBtn} />}>
          <T style={st.p}>Paid with {who}'s gil (taken off at the next PLAY). Bait bought here stays on the phone; lures are never used up.</T>
          <Pane>
            {Object.entries(E.SHOP).map(([id, price]) => {
              const b = E.BAIT[id];
              if (!b) return null;
              const have = save.bait[id] || 0;
              const buy = (n: number) => {
                if (gil < price * n) { say(`Not enough gil for ${n} ${b.name}.`, 'bad'); return; }
                update((d) => { d.bait[id] = (d.bait[id] || 0) + n; d.unsent.gil += price * n; });
                say(`Bought ${n} ${b.name} for ${price * n} gil.`, 'info');
                soon();
              };
              return (
                <View key={id} style={st.row}>
                  <View style={{ flex: 1 }}>
                    <T style={st.rowText}>{b.name}{b.lure ? ' (lure)' : ''}</T>
                    <T style={st.rowSub}>{price} gil{have ? ` · you have ${b.lure ? 'it' : have}` : ''}</T>
                  </View>
                  {b.lure ? (have ? null : <Btn small label="Buy" onPress={() => buy(1)} />) : (
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Btn small label="1" onPress={() => buy(1)} />
                      <Btn small label="12" onPress={() => buy(12)} />
                    </View>
                  )}
                </View>
              );
            })}
          </Pane>
        </Win>
      </ScrollView>
    );
  }

  if (view === 'log') {
    const entries = Object.entries(save.log).map(([id, v]) => ({ f: E.FISH[id], ...v })).filter((e) => e.f).sort((a, b) => a.f.skill - b.f.skill);
    return (
      <ScrollView contentContainerStyle={st.wrap}>
        {head}
        <Win title={`${who}'s Fish Log`} right={<Btn small label="‹ Back" onPress={() => setView(save.zone ? 'spot' : 'where')} style={st.headBtn} />}>
          <T style={st.p}>{entries.length} of {Object.keys(E.FISH).length} catches found.</T>
          <Pane>
            {entries.length ? entries.map((e) => (
              <View key={e.f.id} style={st.row}>
                <T style={st.rowText}>{e.f.name}</T>
                <T style={st.rowSub}>x{e.count}{e.best ? ` · best ${e.best} ilms` : ''} · lv {e.f.skill}</T>
              </View>
            )) : <T style={[st.p, { padding: 8 }]}>Nothing yet. Go catch something!</T>}
          </Pane>
        </Win>
      </ScrollView>
    );
  }

  // ------------------------------------------------------------------ at the water
  const today = save.daily.day === E.dayKey() ? save.daily.count : 0;
  const leave = (to: 'where' | 'shop' | 'log') => { if (autoRef.current) stopAuto(); flush(); setView(to); };
  const rodOwned = (card.fishing.rods || []).length > 0;
  return (
    <ScrollView contentContainerStyle={st.wrap}>
      {head}
      <Win title="" bodyStyle={{ padding: 0 }}>
        <View>
          <View style={{ width: '100%', aspectRatio: SCENE_RATIO, overflow: 'hidden', backgroundColor: '#0A1A2C' }} />
          <Scene phase={phase} arrow={show?.arrow || null} hitTick={hitTick} missTick={missTick} stamina={show?.stamina ?? 100}
            critical={critBite} large={show?.fish.large ?? landedFish?.large} zoneId={zone?.id} fishId={show?.fish.id ?? landedFish?.id}
            catchName={landedFish?.name} catchSize={landedFish?.size} isItem={landedFish?.item} />
          <LinearGradient colors={['rgba(0,10,40,0.6)', 'rgba(0,10,40,0.0)']} style={st.sceneShade} pointerEvents="none">
            <T style={st.sceneTitle}>{spot?.name}</T>
            <T style={st.sceneSub}>{zone?.name}{zone?.city ? ' · town' : ''}</T>
          </LinearGradient>
        </View>
        <View style={{ padding: 10 }}>
          <View>
            <View style={st.gear}>
              <GearSlot label="Range" id={rod?.id} base={base} name={rod ? rod.name + (rodOwned ? '' : ' (loaned)') : '-'}
                open={pick === 'rod'} locked={auto} onPress={() => setPick(pick === 'rod' ? null : 'rod')} />
              <GearSlot label="Ammo" id={baitSel?.bait.id} base={base} locked={auto} open={pick === 'bait'}
                name={baitSel ? baitSel.bait.name : 'No bait'} sub={baitSel ? (baitSel.bait.lure ? 'lure' : `x${baitSel.qty}${baitSel.own ? '' : ' (phone)'}`) : 'Tackle Shop'}
                onPress={() => setPick(pick === 'bait' ? null : 'bait')} />
            </View>
            {pick === 'rod' && !auto ? (
              <View style={st.pickList}>
                {rods.map((r) => (
                  <Pressable key={r.id} onPress={() => { update((d) => { d.rod = r.id; }); setPick(null); }}
                    style={({ pressed }) => [st.pickRow, r.id === rod?.id && st.pickOn, pressed && st.rowOn]}>
                    <ItemIcon id={r.id} base={base} size={28} />
                    <T style={st.pickName}>{r.name}</T>
                    <T style={st.rowSub}>{r.large ? 'for big catches' : 'for small catches'}{r.id === equipped(2) ? ' · equipped' : ''}</T>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {pick === 'bait' && !auto ? (
              <View style={st.pickList}>
                {baitList.length ? baitList.map((b) => (
                  <Pressable key={b.key} onPress={() => { update((d) => { d.baitPick = b.key; }); setPick(null); }}
                    style={({ pressed }) => [st.pickRow, b.key === baitSel?.key && st.pickOn, pressed && st.rowOn]}>
                    <ItemIcon id={b.bait.id} base={base} size={28} />
                    <T style={st.pickName}>{b.bait.name}</T>
                    <T style={st.rowSub}>{b.bait.lure ? 'lure' : `x${b.qty}`}{b.own ? (b.bait.id === equipped(3) ? ' · equipped' : ' · bag') : ' · phone'}</T>
                  </Pressable>
                )) : <T style={[st.rowSub, { padding: 8 }]}>No bait left. Visit the Tackle Shop.</T>}
              </View>
            ) : null}
          </View>
          <View style={st.autoBox}>
            <View style={{ flex: 1 }}>
              <T style={st.autoTitle}>{auto ? (status.text || 'Fishing...') : 'Ready to fish'}</T>
              <T style={st.rowSub}>{auto ? `This session: ${session.casts} casts · ${session.caught} caught` : 'It fishes by itself, at the game\'s pace.'}
                {`  ·  today ${today}/${E.DAILY_CATCHES}`}</T>
              {show ? (
                <View style={[st.meter, { marginTop: 5 }]}>
                  <LinearGradient colors={TH.staminaGrad as any} style={[st.meterFill, { width: `${Math.max(0, show.stamina)}%` }]} />
                </View>
              ) : null}
            </View>
            <Btn primary={!auto} label={auto ? 'Stop' : 'Start fishing'} onPress={() => (auto ? stopAuto(`${who} stops fishing.`) : startAuto())}
              disabled={!auto && (!baitSel || today >= E.DAILY_CATCHES)} style={{ minWidth: 130 }} />
          </View>
        </View>
      </Win>
      <Win title="" style={st.feed} bodyStyle={{ minHeight: 64 }}>
        {lines.slice(-8).map((l) => (
          <T key={l.id} style={[st.feedLine, l.kind === 'good' && { color: C.feedGood, fontFamily: F.semi },
            l.kind === 'bad' && { color: C.feedBad }, l.kind === 'skill' && { color: C.feedSkill, fontFamily: F.bold },
            l.kind === 'info' && { color: C.feedInfo }]}>{l.text}</T>
        ))}
        {!lines.length && <T style={st.feedLine}>Pick a rod and bait, then Start fishing. It keeps fishing while the app is closed, too (up to {E.CATCHUP_HOURS} hours, while the bait lasts).</T>}
      </Win>
      <View style={st.tools}>
        <Btn small label="Change spot" onPress={() => leave('where')} style={st.tool} />
        <Btn small label="Tackle Shop" onPress={() => leave('shop')} style={st.tool} />
        <Btn small label="Fish Log" onPress={() => leave('log')} style={st.tool} />
        <Btn small label="Send now" onPress={flush} style={st.tool} />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={st.stat}>
      <T style={st.statLabel}>{label}</T>
      <T style={st.statValue}>{value}</T>
      {sub ? <T style={st.statSub}>{sub}</T> : null}
    </View>
  );
}

/** One slot of the fishing gear, like the Profile's equipment pane: the item's icon from the game, its name. */
function GearSlot({ label, id, base, name, sub, open, locked, onPress }: { label: string; id?: number; base: string; name: string;
  sub?: string; open: boolean; locked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={locked ? undefined : onPress} style={({ pressed }) => [st.slot, open && st.slotOpen, pressed && !locked && st.rowOn]}>
      <ItemIcon id={id} base={base} />
      <View style={{ flex: 1 }}>
        <T style={st.slotName}>{label}</T>
        <T style={st.slotItem} numberOfLines={2}>{name}</T>
        {sub ? <T style={st.slotSub}>{sub}</T> : null}
      </View>
      {!locked ? <T style={st.slotArrow}>{open ? '▲' : '▼'}</T> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 10, paddingBottom: 24 },
  p: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  head: { marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.chipBg, borderRadius: 16, paddingRight: 12, borderWidth: 1, borderColor: C.chipEdge },
  chipOn: { backgroundColor: C.chipOn, borderColor: C.chipOnEdge },
  chipFace: { width: 30, height: 28, borderRadius: 14 },
  chipName: { fontFamily: F.semi, fontSize: 14, color: C.chipText },
  stats: { flexDirection: 'row', marginTop: 8, backgroundColor: C.statBg, borderWidth: 1, borderColor: C.paneEdge, borderRadius: 10, paddingVertical: 6 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statLabel: { fontSize: 11, color: C.dim },
  statValue: { fontFamily: F.bold, fontSize: 19, color: C.accent },
  statSub: { fontSize: 10.5, color: C.dim },
  sending: { fontSize: 12, color: C.onWall, textShadowColor: C.onWallShadow, textShadowRadius: 3, textAlign: 'center', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.rowLine, gap: 6 },
  rowOn: { backgroundColor: C.rowPressed },
  rowText: { flex: 1, fontFamily: F.semi, fontSize: 14.5, color: C.link },
  rowSub: { fontSize: 12.5, color: C.dim },
  sceneShade: { position: 'absolute', left: 0, right: 0, top: 0, padding: 10, paddingBottom: 26 },
  sceneTitle: { color: '#FFF', fontFamily: F.bold, fontSize: 18, textShadowColor: '#062C5C', textShadowRadius: 3 },
  sceneSub: { color: '#DDEEFF', fontSize: 12.5 },
  label: { fontFamily: F.semi, fontSize: 13, color: C.dim, marginBottom: 4 },
  feed: { marginTop: 10 },
  feedLine: { fontSize: 14, lineHeight: 20 },
  tools: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  tool: { flexBasis: '47%', flexGrow: 1 },
  headBtn: { marginRight: 4 },
  gear: { flexDirection: 'row', gap: 6 },
  slot: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.boxBg, borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 5 },
  slotOpen: { borderColor: C.accent },
  slotName: { fontSize: 9.5, color: C.dim, letterSpacing: 0.5 },
  slotItem: { fontSize: 12.5, lineHeight: 15, fontFamily: F.semi },
  slotSub: { fontSize: 10.5, color: C.dim },
  slotArrow: { fontSize: 10, color: C.dim },
  pickList: { marginTop: 6, backgroundColor: C.paneBg, borderRadius: 8, overflow: 'hidden' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.rowLine },
  pickOn: { backgroundColor: C.rowPressed },
  pickName: { flex: 1, fontFamily: F.semi, fontSize: 13.5, color: C.link },
  autoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  autoTitle: { fontFamily: F.bold, fontSize: 15, color: C.accent },
  meter: { flex: 1, height: 14, backgroundColor: C.meterBg, borderWidth: 1, borderColor: C.paneEdge, borderRadius: 7, overflow: 'hidden' },
  meterFill: { height: '100%' },
});
