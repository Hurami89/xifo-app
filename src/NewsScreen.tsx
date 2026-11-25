// NEWS: a 2004 web-portal front page. Rotating banner, newest version + patch notes, the chat room, The Hub,
// the hardcore hall, 88x31 link buttons, and a note when a newer version of this app is out.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { ART, Btn, C, F, Pic, PicBtn, Strip, T, Win } from './ui';
import Markdown from './Markdown';
import { announcements, health, Line } from './stink';
import { appReleasesApi, getJSON, LINKS, setJSON } from './store';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

type Release = { tag: string; date: string; url: string };

async function getText(url: string, ms = 10000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

function newestNotes(md: string): { title: string; body: string } | null {
  const start = md.search(/^## /m);
  if (start < 0) return null;
  const rest = md.slice(start);
  const next = rest.slice(3).search(/^## /m);
  const section = next < 0 ? rest : rest.slice(0, next + 3);
  const [first, ...body] = section.split('\n');
  return { title: first.replace(/^##\s*/, ''), body: body.join('\n').trim().slice(0, 6000) };
}

const newer = (a: string, b: string) => {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

export default function NewsScreen({ goChat, goWiki }: { goChat: () => void; goWiki: () => void }) {
  const [banner, setBanner] = useState(0);
  const [release, setRelease] = useState<Release | null>(null);
  const [notes, setNotes] = useState<{ title: string; body: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [people, setPeople] = useState<number | null>(null);
  const [hc, setHc] = useState<Line[]>([]);
  const [appUpdate, setAppUpdate] = useState<{ tag: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setBanner((b) => (b + 1) % ART.banners.length), 6000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const cached = await getJSON<{ release: Release | null; notes: typeof notes }>('news.cache', { release: null, notes: null });
    if (cached.release) setRelease(cached.release);
    if (cached.notes) setNotes(cached.notes);
    const [rel, md, count, lines, app] = await Promise.all([
      getText(LINKS.kitReleases), getText(LINKS.patchNotes), health(), announcements(0), getText(appReleasesApi()),
    ]);
    let r = cached.release;
    try {
      const list = JSON.parse(rel || '[]');
      const full = Array.isArray(list) ? list.find((x: any) => !x.prerelease && !x.draft) : null;
      if (full) r = { tag: full.tag_name, date: (full.published_at || '').slice(0, 10), url: full.html_url };
    } catch {}
    const n = md ? newestNotes(md) : cached.notes;
    setRelease(r);
    setNotes(n);
    setPeople(count);
    setHc(lines.slice(-8).reverse());
    try {
      const a = JSON.parse(app || 'null');
      const apk = a?.assets?.find((x: any) => String(x.name).endsWith('.apk'));
      if (Platform.OS !== 'web' && a?.tag_name && newer(a.tag_name, APP_VERSION)) setAppUpdate({ tag: a.tag_name, url: apk?.browser_download_url || a.html_url });
    } catch {}
    setJSON('news.cache', { release: r, notes: n });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <ScrollView contentContainerStyle={st.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {appUpdate && (
        <Pressable onPress={() => open(appUpdate.url)} style={st.infoBar}>
          <T style={st.infoText}>A new version of this app is out ({appUpdate.tag}). Tap here to download it.</T>
        </Pressable>
      )}
      <View style={st.hero}>
        <Pic source={ART.banners[banner]} ratio={2.5} />
        <View style={st.dots}>
          {ART.banners.map((_, i) => (
            <Pressable key={i} onPress={() => setBanner(i)} hitSlop={8}>
              <View style={[st.dot, i === banner && st.dotOn]} />
            </Pressable>
          ))}
        </View>
      </View>

      <Win title="What's new" icon={ART.buddy.game} style={st.box} bodyStyle={{ padding: 0 }}>
        <View style={st.relRow}>
          <View style={{ flex: 1 }}>
            <T style={st.relLabel}>Newest version</T>
            <T style={st.relTag}>{release ? release.tag : '...'}</T>
            {release?.date ? <T style={st.relDate}>out {release.date}</T> : null}
          </View>
          <PicBtn source={ART.b88.download} label="Download XI: Forever Offline" style={st.b88} onPress={() => open(LINKS.download)} />
        </View>
        {notes ? (
          <View style={{ padding: 10 }}>
            <T style={st.notesTitle}>Patch notes {notes.title}</T>
            <View style={!showAll && { maxHeight: 260, overflow: 'hidden' }}>
              <Markdown text={notes.body} />
            </View>
            <Btn small label={showAll ? 'Show less' : 'Read all of it'} onPress={() => setShowAll(!showAll)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
          </View>
        ) : (
          <T style={st.muted}>Patch notes show here when you're online.</T>
        )}
      </Win>

      <Win title="Stinkshell" icon={ART.buddy.phone} style={st.box}>
        <View style={st.row}>
          <View style={[st.bigDot, { backgroundColor: people ? C.dotOn : C.dotOff }]} />
          <T style={{ flex: 1, fontSize: 15 }}>
            {people == null ? "Can't reach the chat room right now." : people === 1 ? '1 person is in the chat room.' : `${people} people are in the chat room.`}
          </T>
          <Btn primary small label="Join" onPress={goChat} />
        </View>
      </Win>

      <Win title="The Hub" icon={ART.buddy.game} style={st.box} bodyStyle={{ padding: 0 }}>
        <Pressable onPress={goWiki}><Pic source={ART.hub} ratio={4} /></Pressable>
        <T style={[st.muted, { paddingTop: 8 }]}>The official world, always online. In the launcher: CO-OP, pick The Hub, VISIT.</T>
      </Win>

      <Win title="Hall of Hardcore" icon={ART.hc.silver} style={st.box} bodyStyle={{ padding: 0 }}>
        <Strip title="Latest from the hardcore runs" />
        {hc.length ? hc.map((l) => (
          <View key={l.seq} style={st.hcRow}>
            <Image source={l.text.includes('(Steel)') ? ART.hc.steel : l.text.includes('(Silver)') ? ART.hc.silver : l.text.includes('Randomized') ? ART.hc.random : ART.hc.iron} style={{ width: 26, height: 26 }} />
            <T style={st.hcText}>{l.text}</T>
          </View>
        )) : <T style={st.muted}>No news from the hardcore runs yet. Be the first!</T>}
      </Win>

      <Win title="Links" icon={ART.buddy.web} style={st.box}>
        <View style={st.badges}>
          <PicBtn source={ART.b88.discord} label="Discord" style={st.b88} onPress={() => open(LINKS.discord)} />
          <PicBtn source={ART.b88.twitch} label="Twitch" style={st.b88} onPress={() => open(LINKS.twitch)} />
          <PicBtn source={ART.b88.github} label="GitHub" style={st.b88} onPress={() => open(LINKS.github)} />
          <PicBtn source={ART.b88.site} label="xiforever.com" style={st.b88} onPress={() => open(LINKS.website)} />
          <PicBtn source={ART.b88.hub} label="The Hub guide" style={st.b88} onPress={goWiki} />
          <PicBtn source={ART.b88.download} label="Download" style={st.b88} onPress={() => open(LINKS.download)} />
        </View>
      </Win>

      <T style={st.footer}>XI: Forever Offline app {APP_VERSION} · best viewed on a phone held upright{'\n'}Unofficial fan project, not affiliated with Square Enix. FINAL FANTASY XI © SQUARE ENIX CO., LTD.</T>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 10, paddingBottom: 24 },
  infoBar: { backgroundColor: C.noteBg, borderWidth: 1, borderColor: C.noteEdge, borderRadius: 3, padding: 8, marginBottom: 10 },
  infoText: { fontSize: 13.5, color: C.noteText },
  hero: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: C.heroEdge, marginBottom: 12, backgroundColor: C.winOuter },
  heroImg: { width: '100%', aspectRatio: 2.5 },
  dots: { position: 'absolute', bottom: 6, right: 8, flexDirection: 'row', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(8,48,110,0.6)' },
  dotOn: { backgroundColor: '#FFF' },
  box: { marginBottom: 12 },
  relRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.boxBg },
  relLabel: { fontSize: 12.5, color: C.dim },
  relTag: { fontFamily: F.bold, fontSize: 24, color: C.accent },
  relDate: { fontSize: 12.5, color: C.dim },
  b88: { width: 88 * 1.25, height: 31 * 1.25 },
  notesTitle: { fontFamily: F.bold, fontSize: 15, marginBottom: 6, color: C.ink },
  muted: { color: C.dim, fontSize: 14, padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bigDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
  hubImg: { width: '100%', aspectRatio: 4 },
  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.rowLine },
  hcText: { flex: 1, color: C.hardcore, fontSize: 13.5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  footer: { textAlign: 'center', fontSize: 11.5, color: C.onWall, textShadowColor: C.onWallShadow, textShadowRadius: 3, marginTop: 4 },
});
