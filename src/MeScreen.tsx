// ME: your own characters, as the launcher synced them (pair the phone once with a code from the launcher).
// (2026-11-26) Only what a character has is shown: the gear it wears, the jobs it has levelled, the crafts it has raised.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ART, Btn, C, F, Field, T, Win } from './ui';
import { faceOf } from './faces';
import { Card, cachedMe, claim, ERA_JOBS, JOBS, jobLine, me, MODES, NATIONS, Pending, RACES, siteUrl } from './armory';
import { LINKS, setJSON } from './store';

const SLOT_ORDER = [0, 1, 2, 3, 4, 9, 11, 12, 5, 6, 13, 14, 15, 10, 7, 8];
const SLOT_NAME: Record<number, string> = { 0: 'Main', 1: 'Sub', 2: 'Range', 3: 'Ammo', 4: 'Head', 9: 'Neck', 11: 'Ear', 12: 'Ear',
  5: 'Body', 6: 'Hands', 13: 'Ring', 14: 'Ring', 15: 'Back', 10: 'Waist', 7: 'Legs', 8: 'Feet' };
const MODE_ICON: Record<number, any> = { 1: ART.hc.iron, 2: ART.hc.steel, 3: ART.hc.silver, 4: ART.hc.random };
const CRAFTS = ['Fishing', 'Woodworking', 'Smithing', 'Goldsmithing', 'Clothcraft', 'Leathercraft', 'Bonecraft', 'Alchemy', 'Cooking'];

export const ago = (t: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - t));
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.floor(s / 60)} minutes ago`;
  if (s < 129600) return `${Math.floor(s / 3600)} hours ago`;
  return `${Math.floor(s / 86400)} days ago`;
};
const hours = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);

/** Pairing with the launcher. `title=""`: without its own title line (inside a screen that has one already). */
export function PairBox({ onPaired, title = 'Pair with my launcher' }: { onPaired: () => void; title?: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const go = async () => {
    setBusy(true);
    setNote('');
    const out = await claim(code.trim());
    setBusy(false);
    if (out.ok) onPaired();
    else setNote(out.error || 'That did not work.');
  };
  return (
    <Win title={title}>
      <T style={st.h}>See your characters and play on the go</T>
      <T style={st.p}>1. In the launcher: Characters page, <T style={st.b}>PAIR APP</T>.</T>
      <T style={st.p}>2. Type the 6-character code here (it works for 10 minutes).</T>
      <T style={st.p}>3. Press <T style={st.b}>SYNC NOW</T> in the launcher, so your characters are on xiforever.com.</T>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        <Field boxStyle={{ flex: 1 }} value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="ABC123"
          maxLength={8} autoCapitalize="characters" onSubmitEditing={go} style={{ letterSpacing: 4, fontFamily: F.bold, fontSize: 20 }} />
        <Btn primary label={busy ? 'Pairing...' : 'Pair'} onPress={go} disabled={busy || code.trim().length < 6} />
      </View>
      {note ? <T style={st.err}>{note}</T> : null}
    </Win>
  );
}

export default function MeScreen({ onCards }: { onCards?: (cards: Card[]) => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [pick, setPick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paired, setPaired] = useState(true);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const cached = await cachedMe();
    if (cached && cards === null) { setCards(cached.cards); setPending(cached.pending); onCards?.(cached.cards); }
    const out = await me();
    setLoading(false);
    if (out.unpaired) { setPaired(false); setCards(null); return; }
    setPaired(true);
    if (out.cards) { setCards(out.cards); setPending(out.pending || []); onCards?.(out.cards); setNote(''); }
    else setNote(out.error || '');
  }, [cards, onCards]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!paired) {
    return <ScrollView contentContainerStyle={st.wrap}><PairBox onPaired={load} /></ScrollView>;
  }
  const c = cards && cards[Math.min(pick, cards.length - 1)];
  return (
    <ScrollView contentContainerStyle={st.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {note ? <T style={st.warn}>{note}</T> : null}
      {cards && cards.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
          {cards.map((k, i) => (
            <Pressable key={k.name} onPress={() => setPick(i)} style={[st.chip, i === pick && st.chipOn]}>
              <Image source={faceOf(k.race, k.face)} style={st.chipFace} />
              <T style={[st.chipName, i === pick && { color: C.chipOnText }]}>{k.name}</T>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {cards && !cards.length && (
        <Win title="No characters yet">
          <T style={st.p}>This phone is paired. Now press <T style={st.b}>SYNC NOW</T> on the launcher's Characters page, then pull down here.</T>
        </Win>
      )}
      {c && <Profile c={c} pending={pending.filter((p) => p.char === c.name)} />}
      {cards === null && !loading && <T style={st.warn}>Pull down to load your characters.</T>}
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 4 }}>
        <Btn small label="Refresh" onPress={load} />
        <Btn small label="Unpair this phone" onPress={() => {
          const go = async () => { await setJSON('armory.phone', ''); await setJSON('armory.me', null); setCards(null); setPaired(false); };
          if (Platform.OS === 'web') return go();
          Alert.alert('Unpair', 'Forget the launcher on this phone? You can pair again with a new code.', [{ text: 'Cancel' }, { text: 'Unpair', style: 'destructive', onPress: go }]);
        }} />
      </View>
    </ScrollView>
  );
}

/** An item's 32x32 icon, from the hub (xiforever.com/armory/icon/<id>.png, cached there). Nothing if it has none. */
export function ItemIcon({ id, base, size = 32 }: { id?: number; base: string; size?: number }) {
  const [bad, setBad] = useState(false);
  if (!id || bad) return <View style={[st.icon, { width: size, height: size }, st.iconEmpty]} />;
  return <Image source={{ uri: `${base}/armory/icon/${id}.png` }} onError={() => setBad(true)}
    style={[st.icon, { width: size, height: size }]} resizeMode="contain" />;
}

export function Profile({ c, pending }: { c: Card; pending: Pending[] }) {
  const [base, setBase] = useState(LINKS.website);
  useEffect(() => { siteUrl().then(setBase).catch(() => {}); }, []);
  const [race, sex] = RACES[c.race] || ['Hume', 'Male'];
  const equip = new Map(c.equip.map((e) => [e.slot, e]));
  const worn = SLOT_ORDER.filter((s) => equip.get(s));
  const jobs = ERA_JOBS.filter((j) => c.jobs[j]);
  const crafts = CRAFTS.map((k) => ({ k, skill: (k === 'Fishing' ? c.fishing : c.crafts[k])?.skill || 0 })).filter((x) => x.skill > 0);
  const open = async () => Linking.openURL((await siteUrl()) + c._link).catch(() => {});
  return (
    <>
      <Win title="" style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={st.portrait}>
            <Image source={faceOf(c.race, c.face)} style={st.face} />
            {c.hardcore ? <Image source={MODE_ICON[c.hardcore.mode]} style={st.mode} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <T style={st.name}>{c.name}</T>
            <T style={st.sub}>{race} {sex} · {NATIONS[c.nation]}{c.rank ? ` · Rank ${c.rank}` : ''}</T>
            <T style={st.job}>{jobLine(c)}</T>
            <View style={st.chips}>
              {c.hardcore ? <T style={[st.tag, st.tagHc]}>{MODES[c.hardcore.mode]}{c.hardcore.dead ? ' · fallen' : ''}</T> : null}
              <T style={[st.tag, st.tagGil]}>{c.gil.toLocaleString()} gil</T>
              <T style={st.tag}>{hours(c.playtime)} played</T>
            </View>
          </View>
        </View>
        {pending.some((p) => p.count) ? (
          <T style={st.info}>{pending.reduce((n, p) => n + p.count, 0)} catch(es) from this phone are waiting: they arrive in the delivery box at your next PLAY.</T>
        ) : null}
        {pending.some((p) => p.tetra) ? (
          <T style={st.info}>Tetra Master: {pending.reduce((n, p) => n + (p.tetra?.gil || 0), 0).toLocaleString('en-US')} gil
            {pending.some((p) => p.tetra?.upgrades.length) ? ' and class-ups' : ''} from this phone arrive at your next PLAY.</T>
        ) : null}
        <T style={st.facts}>
          Quests {c.quests} · Titles {c.titles} · Key items {c.keyitems}{c.hp ? ` · HP ${c.hp} · MP ${c.mp}` : ''}{c.world ? ` · ${c.world}` : ''}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <Btn small primary label="Open my page" onPress={open} />
          <T style={st.vis}>{c._vis === 'public' ? 'Everyone can see it' : c._vis === 'link' ? 'Only people with the link' : 'Hidden'} · synced {ago(c._synced)}</T>
        </View>
      </Win>
      <Win title="Equipment" style={{ marginBottom: 12 }} bodyStyle={{ padding: 6 }}>
        {worn.length ? (
          <View style={st.equip}>
            {worn.map((s) => {
              const e = equip.get(s)!;
              return (
                <View key={s} style={st.slot}>
                  <View style={st.slotIn}>
                    <ItemIcon id={e.id} base={base} />
                    <View style={{ flex: 1 }}>
                      <T style={st.slotName}>{SLOT_NAME[s]}</T>
                      <T style={st.slotItem} numberOfLines={2}>{e.name}</T>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : <T style={st.none}>Nothing equipped at the last sync.</T>}
      </Win>
      {jobs.length ? (
        <Win title="Jobs" style={{ marginBottom: 12 }}>
          <View style={st.jobs}>
            {jobs.map((j) => (
              <View key={j} style={[st.jobBox, c.jobs[j] >= 75 && st.jobMax]}>
                <T style={st.jobName}>{j}</T>
                <T style={st.jobLv}>{c.jobs[j]}</T>
              </View>
            ))}
          </View>
        </Win>
      ) : null}
      {crafts.length ? (
        <Win title="Crafts & Fishing" style={{ marginBottom: 12 }}>
          {crafts.map(({ k, skill }) => (
            <View key={k} style={st.craft}>
              <T style={st.craftName}>{k}</T>
              <T style={st.craftVal}>{skill.toFixed(1)}</T>
              <View style={st.bar}><View style={[st.barFill, { width: `${Math.min(100, skill)}%` }]} /></View>
            </View>
          ))}
        </Win>
      ) : null}
      {c.squad.length ? (
        <Win title={`${c.name}'s Squad`} style={{ marginBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {c.squad.map((m) => (
              <View key={m.name} style={st.mate}>
                <Image source={faceOf(m.race, m.face)} style={st.mateFace} />
                <T style={st.mateName}>{m.name}</T>
                <T style={st.mateJob}>{JOBS[m.mjob - 1]}{m.level}{m.sjob ? `/${JOBS[m.sjob - 1]}` : ''}</T>
                <View style={st.mateIcons}>{m.equip.slice(0, 8).map((e) => <ItemIcon key={e.slot} id={e.id} base={base} size={24} />)}</View>
              </View>
            ))}
          </ScrollView>
        </Win>
      ) : null}
    </>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 10, paddingBottom: 24 },
  h: { fontFamily: F.bold, fontSize: 18, color: C.accent, marginBottom: 6 },
  p: { fontSize: 14.5, lineHeight: 21, marginBottom: 3 },
  b: { fontFamily: F.bold },
  err: { color: C.err, marginTop: 6 },
  warn: { color: C.onWall, textShadowColor: C.onWallShadow, textShadowRadius: 3, textAlign: 'center', marginBottom: 8 },
  info: { backgroundColor: C.noteBg, borderWidth: 1, borderColor: C.noteEdge, padding: 6, marginTop: 8, fontSize: 13, color: C.noteText },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.chipBg, borderRadius: 16, paddingRight: 12, borderWidth: 1, borderColor: C.chipEdge },
  chipOn: { backgroundColor: C.chipOn, borderColor: C.chipOnEdge },
  chipFace: { width: 30, height: 28, borderRadius: 14 },
  chipName: { fontFamily: F.semi, fontSize: 14, color: C.chipText },
  portrait: { width: 116, padding: 4, backgroundColor: C.boxBg, borderRadius: 8 },
  face: { width: 108, height: 100, borderRadius: 3 },
  mode: { position: 'absolute', right: 4, top: 4, width: 32, height: 32 },
  name: { fontFamily: F.bold, fontSize: 26, color: C.accent },
  sub: { color: C.dim, fontSize: 13 },
  job: { fontFamily: F.bold, fontSize: 18, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: { fontSize: 12, backgroundColor: C.boxBg, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  tagHc: { backgroundColor: C.hcBg, borderColor: C.hcEdge, color: C.hardcore, fontFamily: F.bold },
  tagGil: { backgroundColor: C.gilBg, borderColor: C.gilEdge, color: C.gilText, fontFamily: F.semi },
  equip: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '50%', padding: 3 },
  slotIn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.boxBg, borderRadius: 6, padding: 5 },
  none: { color: C.dim, fontSize: 14, padding: 4 },
  facts: { color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 10 },
  icon: { borderRadius: 3 },
  iconEmpty: { backgroundColor: C.line, opacity: 0.35 },
  mateIcons: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, justifyContent: 'center', marginTop: 4 },
  slotName: { fontSize: 9.5, color: C.dim, letterSpacing: 0.5 },
  slotItem: { fontSize: 11.5, lineHeight: 14, minHeight: 28 },
  vis: { fontSize: 12, color: C.dim, alignSelf: 'center', flex: 1 },
  jobs: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  jobBox: { width: '15%', minWidth: 48, alignItems: 'center', backgroundColor: C.boxBg, borderWidth: 1, borderColor: 'transparent', borderRadius: 6, paddingVertical: 4 },
  jobMax: { backgroundColor: C.maxBg, borderColor: C.maxEdge },
  jobName: { fontSize: 11, color: C.dim },
  jobLv: { fontFamily: F.bold, fontSize: 15 },
  craft: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  craftName: { width: 100, fontSize: 13.5 },
  craftVal: { width: 40, fontFamily: F.semi, fontSize: 13.5 },
  bar: { flex: 1, height: 9, backgroundColor: C.barBg, borderRadius: 5, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.barFill },
  mate: { width: 112, backgroundColor: C.boxBg, borderRadius: 8, padding: 5, alignItems: 'center' },
  mateFace: { width: 100, height: 93, borderRadius: 4 },
  mateName: { fontFamily: F.bold, fontSize: 13.5, marginTop: 3 },
  mateJob: { fontSize: 12.5, color: C.dim },
  mateGear: { fontSize: 10.5, color: C.ink, alignSelf: 'stretch' },
});
