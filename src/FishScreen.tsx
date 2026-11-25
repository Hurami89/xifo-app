// FISH: portable fishing. Pick one of your characters, a real fishing spot, a rod and bait, cast, and fight the fish
// with the arrows. Catches, skill-ups and gil spent are sent to xiforever.com and arrive with the character at the
// launcher's next PLAY (delivery box, fishing skill, gil). Rules and data: src/fishing/engine.ts, src/fishData.json.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Vibration, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ART, Btn, C, F, Pane, Pic, Strip, T, Win } from './ui';
import { faceOf } from './faces';
import { Card, cachedMe, me, newId, Pending, Report, sendReport } from './armory';
import { PairBox } from './MeScreen';
import { getJSON, setJSON } from './store';
import * as E from './fishing/engine';
import Scene, { Phase, SCENE_RATIO } from './fishing/Scene';
import { TH } from './theme';

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
};
const fresh = (): Save => ({ starter: false, bait: {}, ownedUsed: {}, skillHigh: 0, unsent: { catches: {}, skill: 0, gil: 0, gilFound: 0 },
  outbox: null, log: {}, zone: null, spot: null, rod: null, baitPick: null, total: 0 });

type Line = { id: number; text: string; kind?: 'good' | 'bad' | 'skill' | 'info' };
type Fight = { fish: E.Fish; critical: boolean; p: ReturnType<typeof E.fightParams>; stamina: number; left: number;
  arrow: null | { dir: 'L' | 'R'; until: number; gold: boolean }; next: number; result?: string };

export default function FishScreen({ cardsHint, goMe }: { cardsHint: Card[] | null; goMe: () => void }) {
  const [cards, setCards] = useState<Card[] | null>(cardsHint);
  const [pending, setPending] = useState<Pending[]>([]);
  const [unpaired, setUnpaired] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [save, setSave] = useState<Save>(fresh());
  const [view, setView] = useState<'spot' | 'where' | 'shop' | 'log'>('where');
  const [region, setRegion] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState<'cast' | 'fight' | null>(null);
  const [fight, setFight] = useState<Fight | null>(null);
  const [sending, setSending] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [hitTick, setHitTick] = useState(0);
  const [missTick, setMissTick] = useState(0);
  const [critBite, setCritBite] = useState(false);
  const [landedFish, setLandedFish] = useState<{ id: number; name: string; size: number; item: boolean; large?: boolean } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const lineId = useRef(0);
  const fightRef = useRef<Fight | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (cardsHint) setCards(cardsHint); }, [cardsHint]);
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
  const rod = rods.find((r) => r.id === save.rod) || rods[0];
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
  const baitSel = baitList.find((b) => b.key === save.baitPick) || baitList[0] || null;
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

  // ------------------------------------------------------------------ casting
  const cast = () => {
    if (!spot || !rod || !baitSel || busy) return;
    setBusy('cast');
    setPhase('cast');
    setTimeout(() => setPhase((ph) => (ph === 'cast' ? 'wait' : ph)), 800);
    say(`You cast your line (${baitSel.bait.name}).`);
    const wait = E.rand(2.5, 7.5) * 1000;
    setTimeout(() => {
      const { fish, critical } = E.rollHook(spot, baitSel.bait, Math.floor(skill / 10), rod);
      if (!fish) {
        say("You didn't catch anything.", 'bad');
        setPhase('lost');
        setTimeout(() => { setPhase('idle'); setBusy(null); }, 900);
        return;
      }
      useBait();
      Vibration.vibrate(critical ? [0, 60, 60, 60] : 80);
      say(critical ? 'Your keen senses tell you: this one is hooked fast!' : fish.item ? 'Something heavy and lifeless pulls at your line...'
        : fish.large ? 'Something clamps onto your line ferociously!' : 'Something caught the hook!', critical ? 'good' : undefined);
      const p = E.fightParams(fish, rod, Math.floor(skill / 10), critical);
      setPhase('bite');
      setCritBite(critical);
      setTimeout(() => {
        fightRef.current = { fish, critical, p, stamina: 100, left: p.seconds, arrow: null, next: Date.now() + p.every * 1000 };
        setFight(fightRef.current);
        setPhase('fight');
        setBusy('fight');
      }, 900);
    }, wait);
  };

  const useBait = () => {
    if (!baitSel || baitSel.bait.lure) return;
    const id = String(baitSel.bait.id);
    update((d) => {
      if (baitSel.own) d.ownedUsed[id] = (d.ownedUsed[id] || 0) + 1;
      else d.bait[id] = Math.max(0, (d.bait[id] || 0) - 1);
    });
  };

  // the fight's clock. The live fight is fightRef (the clock and the taps both change it); `fight` is only what is drawn.
  useEffect(() => {
    if (busy !== 'fight') return;
    const tick = setInterval(() => {
      const f = fightRef.current;
      if (!f || f.result) return;
      const now = Date.now();
      const dt = 0.05;
      let { stamina, arrow, next } = f;
      if (arrow && now > arrow.until) { stamina = Math.min(100, stamina + f.p.heal); arrow = null; }
      if (!arrow && now >= next) {
        arrow = { dir: Math.random() < 0.5 ? 'L' : 'R', until: now + f.p.window * 1000, gold: f.critical };
        next = now + f.p.every * 1000 + f.p.window * 500;
      }
      stamina = Math.min(100, stamina + f.p.pull * dt);
      const left = f.left - dt;
      if (left <= 0) return end({ ...f, left: 0, stamina, arrow: null }, false);
      fightRef.current = { ...f, stamina, arrow, next, left };
      setFight(fightRef.current);
    }, 50);
    return () => clearInterval(tick);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (dir: 'L' | 'R') => {
    const f = fightRef.current;
    if (!f || f.result) return;
    let stamina = f.stamina;
    if (f.arrow && f.arrow.dir === dir) { stamina -= f.p.hit; setHitTick((n) => n + 1); }
    else { stamina = Math.min(100, stamina + f.p.heal * 0.6); setMissTick((n) => n + 1); }
    const nf = { ...f, stamina, arrow: null };
    if (stamina <= 0) return end(nf, true);
    fightRef.current = nf;
    setFight(nf);
  };

  const end = (f: Fight, won: boolean) => {
    fightRef.current = { ...f, result: 'done' };
    setFight(null);
    const finish = (ms: number) => setTimeout(() => { fightRef.current = null; setPhase('idle'); setBusy(null); setLandedFish(null); }, ms);
    if (!won) { say(f.fish.item ? 'Whatever it was sank back into the water.' : 'You lost your catch.', 'bad'); setPhase('lost'); finish(900); return; }
    const [lose, why] = E.loseChance(f.fish, Math.floor(skill / 10), rod!);
    if (Math.random() * 100 < lose) { say(`You lost your catch: ${why}.`, 'bad'); setPhase('lost'); finish(900); return; }
    const size = landed(f.fish);
    setLandedFish({ id: f.fish.id, name: f.fish.id === E.GIL_ITEM ? 'Gil!' : f.fish.name, size, item: f.fish.item, large: f.fish.large });
    setPhase('caught');
    finish(2200);
  };

  const landed = (fish: E.Fish): number => {
    const size = E.sizeOf(fish);
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
      });
    }
    const gain = Math.min(E.skillUp(fish.skill, skill, rank, !!zone?.city, card?.fishing.rate ?? 1), cap - skill);
    if (gain > 0) {
      const now = skill + gain;
      say(`Your fishing skill rises ${(gain / 10).toFixed(1)} points.${Math.floor(now / 10) > Math.floor(skill / 10) ? ` Fishing skill reaches level ${Math.floor(now / 10)}!` : ''}`, 'skill');
      update((d) => { d.unsent.skill += gain; d.skillHigh = Math.max(d.skillHigh, now); });
    } else if (skill >= cap && fish.skill > Math.floor(skill / 10)) {
      say(`Your skill is capped at ${cap / 10} by your guild rank (${RANKS[rank]}). Rank up at the Fishermen's Guild in game to go higher.`, 'info');
    }
    soon();
    return size;
  };

  // ------------------------------------------------------------------ screens
  if (unpaired && !cards?.length) {
    return <ScrollView contentContainerStyle={st.wrap}><PairBox onPaired={async () => { const o = await me(); if (o.cards) { setCards(o.cards); setWho(o.cards[0]?.name || null); setUnpaired(false); } }} /></ScrollView>;
  }
  if (!cards || !cards.length || !card) {
    return (
      <View style={st.wrap}>
        <Win title="Portable Fishing" icon={ART.buddy.phone}>
          <Pic source={ART.banners[2]} ratio={2.5} style={st.banner} />
          <T style={st.p}>Fishing needs one of your characters. Press <T style={{ fontFamily: F.bold }}>SYNC NOW</T> on the launcher's Characters page, then open ME and pull down.</T>
          <Btn small label="Go to ME" onPress={goMe} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Win>
      </View>
    );
  }

  const head = (
    <View style={st.head}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
        {cards.map((c) => (
          <Pressable key={c.name} onPress={() => !busy && setWho(c.name)} style={[st.chip, c.name === who && st.chipOn]}>
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
        <Win title={region ? `${region} - Fishing spots` : 'Where to fish?'} icon={ART.buddy.web}>
          {region && <Btn small label="◀ All regions" onPress={() => setRegion(null)} style={{ alignSelf: 'flex-start', marginBottom: 6 }} />}
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
        <Win title="Tackle Shop" icon={ART.buddy.game}>
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
          <Btn label="◀ Back to fishing" onPress={() => setView(save.zone ? 'spot' : 'where')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
        </Win>
      </ScrollView>
    );
  }

  if (view === 'log') {
    const entries = Object.entries(save.log).map(([id, v]) => ({ f: E.FISH[id], ...v })).filter((e) => e.f).sort((a, b) => a.f.skill - b.f.skill);
    return (
      <ScrollView contentContainerStyle={st.wrap}>
        {head}
        <Win title={`${who}'s Fish Log`} icon={ART.buddy.game}>
          <T style={st.p}>{entries.length} of {Object.keys(E.FISH).length} catches found.</T>
          <Pane>
            {entries.length ? entries.map((e) => (
              <View key={e.f.id} style={st.row}>
                <T style={st.rowText}>{e.f.name}</T>
                <T style={st.rowSub}>x{e.count}{e.best ? ` · best ${e.best} ilms` : ''} · lv {e.f.skill}</T>
              </View>
            )) : <T style={[st.p, { padding: 8 }]}>Nothing yet. Go catch something!</T>}
          </Pane>
          <Btn label="◀ Back to fishing" onPress={() => setView(save.zone ? 'spot' : 'where')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
        </Win>
      </ScrollView>
    );
  }

  // ------------------------------------------------------------------ at the water
  return (
    <ScrollView contentContainerStyle={st.wrap} scrollEnabled={!fight}>
      {head}
      <Win title={`${zone?.name || ''} - ${spot?.name || ''}`} icon={ART.buddy.phone} bodyStyle={{ padding: 0 }}>
        <View>
          <View style={{ width: '100%', aspectRatio: SCENE_RATIO, overflow: 'hidden', backgroundColor: '#0A1A2C' }} />
          <Scene phase={phase} arrow={fight?.arrow?.dir || null} hitTick={hitTick} missTick={missTick} stamina={fight?.stamina ?? 100}
            critical={critBite} large={fight?.fish.large ?? landedFish?.large} zoneId={zone?.id} fishId={fight?.fish.id ?? landedFish?.id}
            catchName={landedFish?.name} catchSize={landedFish?.size} isItem={landedFish?.item} />
          <LinearGradient colors={['rgba(0,10,40,0.6)', 'rgba(0,10,40,0.0)']} style={st.sceneShade} pointerEvents="none">
            <T style={st.sceneTitle}>{spot?.name}</T>
            <T style={st.sceneSub}>{zone?.name}{zone?.city ? ' · town' : ''}</T>
          </LinearGradient>
        </View>
        {fight ? (
          <FightPanel f={fight} tap={tap} giveUp={() => end(fight, false)} />
        ) : (
          <View style={{ padding: 8 }}>
            <T style={st.label}>Rod</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
              {rods.map((r) => (
                <Btn key={r.id} small active={r.id === rod?.id} label={r.name + ((card.fishing.rods || []).length ? '' : ' (loaned)')}
                  onPress={() => !busy && update((d) => { d.rod = r.id; })} />
              ))}
            </ScrollView>
            <T style={[st.label, { marginTop: 6 }]}>Bait</T>
            {baitList.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
                {baitList.map((b) => (
                  <Btn key={b.key} small active={b.key === baitSel?.key} label={`${b.bait.name}${b.bait.lure ? '' : ` x${b.qty}`}${b.own ? ' (bag)' : ''}`}
                    onPress={() => !busy && update((d) => { d.baitPick = b.key; })} />
                ))}
              </ScrollView>
            ) : <T style={st.rowSub}>No bait left. Visit the Tackle Shop.</T>}
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <Btn primary label={busy === 'cast' ? 'Waiting for a bite...' : busy ? '...' : 'Cast'} onPress={cast} disabled={!!busy || !baitSel} style={{ minWidth: 200 }} />
            </View>
          </View>
        )}
      </Win>
      <Pane style={st.feed}>
        {lines.slice(-8).map((l) => (
          <T key={l.id} style={[st.feedLine, l.kind === 'good' && { color: C.feedGood, fontFamily: F.semi },
            l.kind === 'bad' && { color: C.feedBad }, l.kind === 'skill' && { color: C.feedSkill, fontFamily: F.bold },
            l.kind === 'info' && { color: C.feedInfo }]}>{l.text}</T>
        ))}
        {!lines.length && <T style={st.feedLine}>Pick a rod and bait, then cast.</T>}
      </Pane>
      <View style={st.tools}>
        <Btn small label="Change spot" onPress={() => { if (!busy) { flush(); setView('where'); } }} />
        <Btn small label="Tackle Shop" onPress={() => !busy && setView('shop')} />
        <Btn small label="Fish Log" onPress={() => !busy && setView('log')} />
        <Btn small label="Send now" onPress={flush} />
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

function FightPanel({ f, tap, giveUp }: { f: Fight; tap: (d: 'L' | 'R') => void; giveUp: () => void }) {
  return (
    <View style={{ padding: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <T style={st.fightLabel}>Fish</T>
        <View style={st.meter}><LinearGradient colors={TH.staminaGrad as any} style={[st.meterFill, { width: `${Math.max(0, f.stamina)}%` }]} /></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <T style={st.fightLabel}>Time</T>
        <View style={st.meter}><LinearGradient colors={TH.timeGrad as any} style={[st.meterFill, { width: `${(f.left / f.p.seconds) * 100}%` }]} /></View>
      </View>
      <LinearGradient colors={TH.arrowBox as any} style={st.arrowBox}>
        <T style={[st.arrow, { color: f.arrow?.gold ? C.arrowGold : C.arrow, opacity: f.arrow ? 1 : 0.15 }]}>
          {f.arrow ? (f.arrow.dir === 'L' ? '◀◀◀' : '▶▶▶') : '· · ·'}
        </T>
      </LinearGradient>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Pressable onPress={() => tap('L')} style={{ flex: 1 }} accessibilityLabel="Reel left">
          <LinearGradient colors={TH.bigGrad as any} style={st.big}><T style={st.bigText}>◀</T></LinearGradient>
        </Pressable>
        <Pressable onPress={() => tap('R')} style={{ flex: 1 }} accessibilityLabel="Reel right">
          <LinearGradient colors={TH.bigGrad as any} style={st.big}><T style={st.bigText}>▶</T></LinearGradient>
        </Pressable>
      </View>
      <Btn small label="Give up" onPress={giveUp} style={{ alignSelf: 'center', marginTop: 6 }} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 10, paddingBottom: 24 },
  banner: { borderRadius: 4, borderWidth: 1, borderColor: C.paneEdge, marginBottom: 10 },
  p: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  head: { marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.chipBg, borderRadius: 16, paddingRight: 12, borderWidth: 1, borderColor: C.chipEdge },
  chipOn: { backgroundColor: C.chipOn, borderColor: C.chipOnEdge },
  chipFace: { width: 30, height: 28, borderRadius: 14 },
  chipName: { fontFamily: F.semi, fontSize: 14, color: C.chipText },
  stats: { flexDirection: 'row', gap: 6, marginTop: 8 },
  stat: { flex: 1, backgroundColor: C.statBg, borderWidth: 1, borderColor: C.chipEdge, borderRadius: 6, padding: 6, alignItems: 'center' },
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
  feed: { marginTop: 10, padding: 8, minHeight: 120 },
  feedLine: { fontSize: 14, lineHeight: 20 },
  tools: { flexDirection: 'row', gap: 5, marginTop: 8, flexWrap: 'wrap' },
  fightLabel: { fontSize: 12, color: C.dim, width: 34 },
  meter: { flex: 1, height: 14, backgroundColor: C.meterBg, borderWidth: 1, borderColor: C.paneEdge, borderRadius: 7, overflow: 'hidden' },
  meterFill: { height: '100%' },
  arrowBox: { height: 74, borderRadius: 6, marginTop: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.paneEdge },
  arrow: { fontSize: 44, fontFamily: F.bold, textShadowColor: '#000', textShadowRadius: 6 },
  big: { height: 72, borderRadius: TH.name === 'vanadiel' ? 4 : 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.bigBorder },
  bigText: { fontSize: 36, color: '#FFF', fontFamily: F.bold, textShadowColor: '#000', textShadowRadius: 2 },
});
