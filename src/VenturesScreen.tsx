// VENTURES (Play tab): send squad mates off to level at a real exp camp of the era while you do something else. Pick a character,
// pick one or more mates (together they go as one party), a camp that fits their level and how long (1-12 hours).
// The hub plans the whole venture; this screen plays it back as a pixel scene with a timer, and when they come home
// shows what happened and what they brought. Exp (a flat 3,000 an hour) goes to each mate in the game, gil to the
// character, items to the delivery box: the launcher takes them in while you play (or at the next PLAY).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Btn, F, Icon, Pane, Strip, T, Win } from './ui';
import { PairBox } from './MeScreen';
import { siteUrl } from './armory';
import { TH } from './theme';
import { sfx, useMusic } from './sfx';
import { Camp, cachedCamps, cachedState, fetchState, markSeen, newVentureId, recall, RosterChar, start, State, Venture } from './ventures/api';
import Stage, { stateAt } from './ventures/Stage';

const JOBS = ['WAR', 'MNK', 'WHM', 'BLM', 'RDM', 'THF', 'PLD', 'DRK', 'BST', 'BRD', 'RNG', 'SAM', 'NIN', 'DRG', 'SMN', 'BLU', 'COR', 'PUP'];
const RACE = ['', 'Hume', 'Hume', 'Elvaan', 'Elvaan', 'Tarutaru', 'Tarutaru', 'Mithra', 'Galka'];
const n = (v: number) => Math.round(v).toLocaleString('en-US');
const clock = (sec: number) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`;
};
/** Who is on a venture, short: "Volker & Ayame", "Volker, Ayame +4". */
const names = (ms: { name: string }[]) => (ms.length <= 2 ? ms.map((m) => m.name).join(' & ') : `${ms[0].name}, ${ms[1].name} +${ms.length - 2}`);
const confirm = (title: string, text: string, yes: () => void) => {
  if (Platform.OS === 'web') { if ((globalThis as any).confirm?.(`${title}\n\n${text}`)) yes(); return; }
  Alert.alert(title, text, [{ text: 'No', style: 'cancel' }, { text: 'Yes', onPress: yes }]);
};

export default function VenturesScreen({ active = true }: { active?: boolean }) {
  useMusic('ventures', active);   // (2026-11-25) the Ventures music while this tab shows
  const [state, setState] = useState<State | null>(null);
  const [camps, setCamps] = useState<Record<string, Camp>>({});
  const [unpaired, setUnpaired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [who, setWho] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [campId, setCampId] = useState<string | null>(null);
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Venture | null>(null);
  const [how, setHow] = useState(false);
  const [allPast, setAllPast] = useState(false);
  const [, setNow] = useState(0);
  const offset = useRef(0);                       // hub clock minus this device's clock

  const now = () => Date.now() / 1000 + offset.current;

  const load = useCallback(async () => {
    setLoading(true);
    const haveCamps = Object.keys(camps).length > 0;
    const out = await fetchState(!haveCamps);
    setLoading(false);
    if (out.unpaired) { setUnpaired(true); return; }
    setUnpaired(false);
    if (out.error) { setNote(out.error); return; }
    setNote('');
    offset.current = out.now - Date.now() / 1000;
    if (out.camps) setCamps(Object.fromEntries(out.camps.map((c) => [c.id, c])));
    setState(out);
  }, [camps]);

  useEffect(() => {
    (async () => {
      const cc = await cachedCamps();
      if (cc) setCamps(Object.fromEntries(cc.map((c) => [c.id, c])));
      const cs = await cachedState();
      if (cs) setState(cs);
      load();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const roster = state?.roster || [];
  const char: RosterChar | undefined = roster.find((r) => r.name === who) || roster[0];
  const mine = (state?.ventures || []).filter((v) => char && v.char === char.name);
  const t = now();
  const out = mine.filter((v) => t < v.end);
  const back = mine.filter((v) => t >= v.end).sort((a, b) => b.end - a.end);
  const fresh = back.filter((v) => !v.seen);
  const away = new Set(out.flatMap((v) => v.slots));
  const chosen = (char?.mates || []).filter((m) => picked.includes(m.slot));
  const low = chosen.length ? Math.min(...chosen.map((m) => m.level)) : 0;
  const fits = useMemo(() => {
    if (!low) return [] as Camp[];
    const all = Object.values(camps);
    const ok = all.filter((c) => c.lo <= low && low <= c.hi && c.solo === (low < (state?.partyFrom || 10)));
    return ok.length ? ok : all.filter((c) => c.lo - 3 <= low && low <= c.hi + 3).slice(0, 4);
  }, [camps, low, state?.partyFrom]);
  useEffect(() => { if (fits.length && !fits.find((c) => c.id === campId)) setCampId(fits[0].id); }, [fits, campId]);

  const send = async () => {
    if (!char || !chosen.length || !campId) return;
    setBusy(true);
    const res = await start({ id: newVentureId(), char: char.name, slots: chosen.map((m) => m.slot), camp: campId, hours });
    setBusy(false);
    if (res.error) { setNote(res.error); sfx('miss', 0.5); return; }
    sfx('depart');
    setPicked([]);
    load();
  };
  const bringHome = (v: Venture) => confirm('Call them home early?', 'They come back now with what they have earned so far.', async () => {
    const res = await recall(v.id);
    if (res.error) setNote(res.error);
    load();
  });
  const open = (v: Venture) => {
    if (!v.seen) sfx(v.results?.levels?.some((lv, i) => lv > (v.mates[i]?.level ?? lv)) ? 'levelup' : 'home');
    else sfx('select', 0.5);
    setReport(v);
    if (!v.seen) { markSeen(v.id); v.seen = true; }
  };

  if (unpaired) return <ScrollView contentContainerStyle={st.wrap}><PairBox onPaired={load} /></ScrollView>;
  if (report) return <Report v={report} camps={camps} close={() => setReport(null)} />;

  const intro = (
    <T style={st.p}>Send squad mates out to level at the real exp camps of the era while you do something else.
      They earn <T style={st.b}>{n(state?.expPerHour || 3000)} exp an hour</T>, plus whatever the camp drops. It all
      arrives in your game: exp and gil when you're logged in, items in your delivery box.</T>
  );
  const home = (char?.mates || []).filter((m) => !away.has(m.slot));
  const gone = (char?.mates || []).filter((m) => away.has(m.slot));
  const past = back.filter((v) => v.seen);

  return (
    <ScrollView contentContainerStyle={st.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {note ? <T style={st.err}>{note}</T> : null}
      {roster.length > 1 ? (
        <View style={st.chips}>
          {roster.map((r) => (
            <Btn key={r.name} small label={r.name} active={char?.name === r.name} onPress={() => { setWho(r.name); setPicked([]); }} />
          ))}
        </View>
      ) : null}
      {!mine.length ? (
        <Win title="Ventures" style={st.gap}>
          {intro}
          {!roster.length ? (
            <T style={[st.p, { marginTop: 6 }]}>No squads yet. Press PLAY once in the launcher (with this app paired) and your squad
              mates show up here.</T>
          ) : null}
        </Win>
      ) : null}

      {fresh.map((v) => (
        <Pressable key={v.id} onPress={() => open(v)} accessibilityRole="button" accessibilityLabel="Read the report">
          <Win title={`Back from ${camps[v.camp]?.title || 'their venture'}`} style={st.gap} bodyStyle={{ padding: 0 }}>
            <Stage camps={camps} events={v.events} sec={v.end - v.start} over mates={v.mates} party={v.party}
              label={camps[v.camp]?.title} />
            <View style={st.under}>
              <T style={st.who} numberOfLines={1}>{names(v.mates)}</T>
              <T style={st.small}>
                +{n(v.results.exp[0] || 0)} exp{v.results.gil ? `, ${n(v.results.gil)} gil` : ''}, {v.results.items.reduce((a, i) => a + i[1], 0)} item(s).
                <T style={st.link}>  Read the report ›</T>
              </T>
            </View>
          </Win>
        </Pressable>
      ))}

      {out.map((v) => {
        const sec = t - v.start;
        const s = stateAt(v.events, sec, false);
        const so = v.events.filter((e) => e.t <= sec);
        const exp = so.reduce((a, e) => a + (e.k === 'kill' ? e.x || 0 : 0), 0);
        const kills = so.filter((e) => e.k === 'kill').length;
        const latest = so.slice(-4).reverse().map((e) => lineOf(e, camps)).filter(Boolean)[0];
        const c = camps[s.camp];
        return (
          <Win key={v.id} title={c ? c.title : 'On the road'} style={st.gap} bodyStyle={{ padding: 0 }}
            right={<T style={st.left}>back in {clock(v.end - t)}</T>}>
            <Stage camps={camps} events={v.events} sec={sec} over={false} mates={v.mates} party={v.party}
              label={s.phase === 'road' ? 'On the road...' : s.phase === 'rest' ? 'Resting' : c?.spot} />
            <View style={st.barBack}><View style={[st.bar, { width: `${Math.min(100, (sec / (v.end - v.start)) * 100)}%` }]} /></View>
            <View style={st.under}>
              <View style={st.row}>
                <T style={st.who} numberOfLines={1}>{names(v.mates)}</T>
                <T style={st.small}>{kills} kills · +{n(exp)} exp</T>
              </View>
              <View style={[st.row, { alignItems: 'center', marginTop: 4 }]}>
                <T style={[st.small, { flex: 1, color: TH.dim }]} numberOfLines={2}>{latest || ''}</T>
                <Btn small label="Call home" onPress={() => bringHome(v)} />
              </View>
            </View>
          </Win>
        );
      })}

      {char ? (
        <Win title={`Send ${char.name}'s squad`} style={st.gap}>
          {home.length ? (
            <>
              <Strip title="Who goes" right={<T style={st.hint}>one, or several together</T>} />
              <Pane style={{ marginBottom: 8 }}>
                {home.map((m) => {
                  const on = picked.includes(m.slot);
                  return (
                    <Pressable key={m.slot} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== m.slot) : [...p, m.slot]))}
                      accessibilityRole="checkbox" accessibilityLabel={m.name} aria-checked={on}
                      style={[st.mate, on && { backgroundColor: TH.rowPressed }]}>
                      <View style={[st.tick, on && st.tickOn]}>{on ? <Icon name="check" size={13} color={TH.chipOnText} /> : null}</View>
                      <T style={[st.b, { flex: 1 }]} numberOfLines={1}>{m.name}</T>
                      <T style={st.small}>{RACE[m.race]} · {JOBS[m.job - 1] || '?'}{m.level}</T>
                    </Pressable>
                  );
                })}
              </Pane>
            </>
          ) : (
            <T style={st.p}>{char.mates.length ? 'Everyone is out on a venture.' : 'No squad mates on this character yet.'}</T>
          )}
          {gone.length && home.length ? <T style={[st.small, { color: TH.dim, marginBottom: 8 }]}>Away: {gone.map((m) => m.name).join(', ')}</T> : null}
          {chosen.length ? (
            <>
              <Strip title={low < (state?.partyFrom || 10) ? 'Where' : 'Which camp'}
                right={low < (state?.partyFrom || 10) ? <T style={st.hint}>solo hunting below level 10</T> : undefined} />
              <Pane style={{ marginBottom: 8 }}>
                {fits.map((c) => (
                  <Pressable key={c.id} onPress={() => { setCampId(c.id); sfx('select', 0.5); }} accessibilityRole="radio" accessibilityLabel={c.title}
                    aria-checked={campId === c.id} style={[st.camp, campId === c.id && { backgroundColor: TH.rowPressed }]}>
                    <View style={[st.tick, st.round, campId === c.id && st.tickOn]}>{campId === c.id ? <View style={st.pip} /> : null}</View>
                    <View style={{ flex: 1 }}>
                      <T style={st.b}>{c.title} <T style={st.small}>({c.spot}, Lv {c.lo}-{c.hi})</T></T>
                      <T style={[st.small, { color: TH.dim }]} numberOfLines={2}>{c.mobs.map((m) => m.name).join(', ')}</T>
                    </View>
                  </Pressable>
                ))}
              </Pane>
              {campId && camps[campId] ? (
                <View style={st.preview}>
                  <Stage camps={camps} events={[{ t: 0, k: 'arrive', camp: campId }, { t: 999999, k: 'kill', c: campId, m: 0 }]} sec={10} over={false}
                    mates={chosen.map((m) => ({ ...m }))} party={[]} label={`${camps[campId].title}: ${camps[campId].spot}`} />
                </View>
              ) : null}
              <Strip title="How long" />
              <View style={st.hours}>
                {(state?.hours || [1, 2, 4, 8, 12]).map((h) => (
                  <Btn key={h} small label={`${h} h`} active={hours === h} onPress={() => setHours(h)} style={{ flex: 1 }} />
                ))}
              </View>
              <T style={[st.small, { marginTop: 8, color: TH.dim }]}>
                About {n((state?.expPerHour || 3000) * hours)} exp for {chosen.length > 1 ? 'each of them' : chosen[0].name}.
                {chosen.length > 1 ? ' They go as one party.' : ''}
              </T>
              <Btn primary label={busy ? 'Sending...' : 'Send them off'} disabled={busy || !campId} onPress={send} style={{ marginTop: 8 }} />
            </>
          ) : null}
        </Win>
      ) : null}

      {past.length ? (
        <Win title="Past ventures" style={st.gap} bodyStyle={{ padding: 0 }}>
          {past.slice(0, allPast ? 20 : 3).map((v) => (
            <Pressable key={v.id} onPress={() => open(v)} style={st.mate}>
              <View style={{ flex: 1 }}>
                <T style={st.b} numberOfLines={1}>{camps[v.camp]?.title || v.camp} · {names(v.mates)}</T>
                <T style={[st.small, { color: TH.dim }]}>{new Date(v.end * 1000).toLocaleDateString()} · {v.hours}h{v.recalled ? ' (called home early)' : ''} ·
                  +{n(v.results.exp[0] || 0)} exp</T>
              </View>
              <T style={st.link}>›</T>
            </Pressable>
          ))}
          {past.length > 3 && !allPast ? (
            <Pressable onPress={() => setAllPast(true)} accessibilityRole="button" style={st.mate}>
              <T style={st.link}>Show all {Math.min(20, past.length)}</T>
            </Pressable>
          ) : null}
        </Win>
      ) : null}

      {mine.length ? (
        <Win title="" style={st.gap}>
          <Pressable onPress={() => setHow((v) => !v)} accessibilityRole="button" accessibilityLabel="How Ventures work" hitSlop={8}>
            <T style={st.link}>How Ventures work {how ? '▴' : '▾'}</T>
          </Pressable>
          {how ? <View style={{ marginTop: 8 }}>{intro}</View> : null}
        </Win>
      ) : null}
    </ScrollView>
  );
}

function lineOf(e: State['ventures'][number]['events'][number], camps: Record<string, Camp>): string {
  const mob = e.c && e.m != null ? camps[e.c]?.mobs[e.m]?.name : '';
  if (e.k === 'arrive') return `Arrived at ${camps[e.camp || '']?.title || 'camp'}.`;
  if (e.k === 'move') return `Moved on to ${camps[e.camp || '']?.title || 'a new camp'}.`;
  if (e.k === 'rest') return 'Resting up.';
  if (e.k === 'party') return 'Joined a party.';
  if (e.k === 'kill') {
    if (e.up?.length) return `Defeated a ${mob} and levelled up to ${e.up[e.up.length - 1][1]}!`;
    if (e.sc) return `Skillchain: ${e.sc}! Defeated a ${mob}.`;
    if (e.close) return `Close call! Defeated a ${mob}.`;
    if (e.link) return `A ${mob} linked. Defeated both.`;
    return `Defeated a ${mob} (+${e.x} exp).`;
  }
  return '';
}

function Report({ v, camps, close }: { v: Venture; camps: Record<string, Camp>; close: () => void }) {
  const [icon, setIcon] = useState('');
  useEffect(() => { siteUrl().then((u) => setIcon(u + '/armory/icon/')); }, []);
  const total = v.end - v.start;
  const firstKill = v.events.find((e) => e.k === 'kill');
  const best = v.events.find((e) => e.k === 'kill' && (e.up || e.sc)) || firstKill;
  const cards: { label: string; sec: number; still: 'road' | 'fight' | 'rest' | 'home' }[] = [
    { label: 'Setting off', sec: Math.max(1, (v.events.find((e) => e.k === 'arrive')?.t || 60) / 2), still: 'road' },
    { label: 'At camp', sec: firstKill ? firstKill.t - 5 : total / 3, still: 'fight' },
    { label: best?.up ? 'Level up!' : best?.sc ? best.sc : 'The hunt', sec: best ? best.t - 2 : total / 2, still: 'fight' },
    { label: 'Home again', sec: total, still: 'home' },
  ];
  return (
    <ScrollView contentContainerStyle={st.wrap}>
      <Win title={`Report: ${names(v.mates)}`} onClose={close}>
        <View style={st.grid}>
          {cards.map((c, i) => (
            <View key={i} style={st.cell}>
              <Stage camps={camps} events={v.events} sec={c.sec} over={c.still === 'home'} mates={v.mates} party={v.party} still={c.still} label={c.label} />
            </View>
          ))}
        </View>
        <Pane style={{ padding: 8, marginTop: 8 }}>
          {(v.story || []).map((line, i) => <T key={i} style={[st.p, { marginBottom: 4 }]}>{line}</T>)}
        </Pane>
        <Strip title="What they brought home" />
        <Pane style={{ padding: 8 }}>
          {v.mates.map((m, i) => (
            <T key={m.slot} style={st.p}>
              <T style={st.b}>{m.name}</T>: +{n(v.results.exp[i] || 0)} exp
              {v.results.levels[i] > m.level ? <T style={{ color: TH.feedGood }}>  (level {m.level} → {v.results.levels[i]})</T> : null}
            </T>
          ))}
          {v.results.gil ? <T style={st.p}>{n(v.results.gil)} gil</T> : null}
          {v.results.items.map(([id, count, name]) => (
            <View key={id} style={st.item}>
              {icon ? <Image source={{ uri: icon + id + '.png' }} style={st.icon} /> : null}
              <T style={st.p}>{name}{count > 1 ? ` x${count}` : ''}</T>
            </View>
          ))}
          <T style={[st.small, { marginTop: 6, color: TH.dim }]}>
            {v.applied ? 'Already in your game: exp and gil to the squad and you, items in your delivery box.'
              : 'Arrives in your game the next time the launcher is running: exp and gil straight away, items in your delivery box.'}
          </T>
        </Pane>
        <Btn label="Back" onPress={close} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
      </Win>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 8, paddingBottom: 30 },
  gap: { marginTop: 10 },
  p: { fontSize: 14.5, lineHeight: 20 },
  b: { fontFamily: F.bold },
  small: { fontSize: 13, color: TH.ink },
  err: { color: TH.err, marginTop: 6 },
  link: { color: TH.link, fontFamily: F.semi },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  hours: { flexDirection: 'row', gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barBack: { height: 4, backgroundColor: TH.barBg, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: TH.barFill },
  under: { padding: 10 },
  who: { flex: 1, fontFamily: F.bold, fontSize: 14.5 },
  left: { fontSize: 13, color: TH.dim, paddingRight: 6 },
  hint: { fontSize: 12, color: TH.dim },
  mate: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: TH.rowLine },
  camp: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: TH.rowLine },
  tick: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: TH.dim, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: TH.chipOn, borderColor: TH.chipOnEdge },
  round: { borderRadius: 10 },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: TH.chipOnText },
  preview: { borderRadius: 8, overflow: 'hidden', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: '49%' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  icon: { width: 20, height: 20 },
});
