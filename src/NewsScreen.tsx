// HOME (2026-11-26, before: NEWS as a 2004 web portal): the rotating banner, the newest version with the start of its
// patch notes, who is in the chat room, The Hub, the hardcore hall when it has news, a few links, and a note when a
// newer version of this app is out.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { ART, Btn, C, F, Pic, T, Win } from './ui';
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
  // the first few notes, two lines each, until "Read the patch notes" opens all of them
  const first = useMemo(() => (notes ? notes.body.split('\n').map((l) => l.match(/^\s*[-*•]\s+(.*)$/)?.[1] || '')
    .filter(Boolean).slice(0, 3).map((l) => l.replace(/\*\*|`/g, '')) : []), [notes]);

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

      <Win title="What's new" style={st.box} right={<T style={st.relDate}>{release?.date ? `out ${release.date}` : ''}</T>}>
        <View style={st.relRow}>
          <T style={st.relTag}>{release ? release.tag : '...'}</T>
          <Btn primary small label="Download" onPress={() => open(LINKS.download)} />
        </View>
        {notes ? (
          <>
            {showAll || !first.length ? (
              <View style={!showAll && { maxHeight: 132, overflow: 'hidden' }}>
                <Markdown text={notes.body} />
              </View>
            ) : first.map((line, i) => (
              <View key={i} style={st.note}>
                <T style={st.noteDot}>•</T>
                <T style={st.noteText} numberOfLines={2}>{line}</T>
              </View>
            ))}
            <Pressable onPress={() => setShowAll(!showAll)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', paddingTop: 8 }}>
              <T style={st.more}>{showAll ? 'Show less' : 'Read the patch notes ›'}</T>
            </Pressable>
          </>
        ) : (
          <T style={st.muted}>Patch notes show here when you're online.</T>
        )}
      </Win>

      <Win title="" style={st.box}>
        <View style={st.row}>
          <View style={[st.bigDot, { backgroundColor: people ? C.dotOn : C.dotOff }]} />
          <T style={{ flex: 1, fontSize: 15 }}>
            {people == null ? "Can't reach the chat room right now." : people === 1 ? '1 person is in the chat room.' : `${people} people are in the chat room.`}
          </T>
          <Btn small label="Join" onPress={goChat} />
        </View>
      </Win>

      <Win title="The Hub" style={st.box} bodyStyle={{ padding: 0 }}>
        <Pressable onPress={goWiki} accessibilityRole="button" accessibilityLabel="The Hub guide">
          <Pic source={ART.hub} ratio={4} />
          <T style={[st.muted, { padding: 10 }]}>The official world, always online. In the launcher: CO-OP, pick The Hub, VISIT.  <T style={st.more}>Guide ›</T></T>
        </Pressable>
      </Win>

      {hc.length ? (
        <Win title="Hall of Hardcore" style={st.box} bodyStyle={{ padding: 0 }}>
          {hc.map((l) => (
            <View key={l.seq} style={st.hcRow}>
              <Image source={l.text.includes('(Steel)') ? ART.hc.steel : l.text.includes('(Silver)') ? ART.hc.silver : l.text.includes('Randomized') ? ART.hc.random : ART.hc.iron} style={{ width: 26, height: 26 }} />
              <T style={st.hcText}>{l.text}</T>
            </View>
          ))}
        </Win>
      ) : null}

      <View style={st.links}>
        <Btn small label="Discord" onPress={() => open(LINKS.discord)} style={st.link} />
        <Btn small label="Twitch" onPress={() => open(LINKS.twitch)} style={st.link} />
        <Btn small label="GitHub" onPress={() => open(LINKS.github)} style={st.link} />
        <Btn small label="Website" onPress={() => open(LINKS.website)} style={st.link} />
      </View>

      <T style={st.footer}>XIFO app {APP_VERSION}. An unofficial fan project, not affiliated with Square Enix.{'\n'}FINAL FANTASY XI © SQUARE ENIX CO., LTD.</T>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 10, paddingBottom: 24 },
  infoBar: { backgroundColor: C.noteBg, borderWidth: 1, borderColor: C.noteEdge, borderRadius: 3, padding: 8, marginBottom: 10 },
  infoText: { fontSize: 13.5, color: C.noteText },
  hero: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: C.heroEdge, marginBottom: 12, backgroundColor: C.winOuter },
  dots: { position: 'absolute', bottom: 6, right: 8, flexDirection: 'row', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(8,48,110,0.6)' },
  dotOn: { backgroundColor: '#FFF' },
  box: { marginBottom: 12 },
  relRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  relTag: { flex: 1, fontFamily: F.bold, fontSize: 24, color: C.accent },
  relDate: { fontSize: 12.5, color: C.dim, paddingRight: 6 },
  more: { fontFamily: F.semi, fontSize: 14, color: C.link },
  note: { flexDirection: 'row', marginBottom: 6 },
  noteDot: { width: 16, fontFamily: F.bold, fontSize: 14.5, lineHeight: 20, color: C.accent },
  noteText: { flex: 1, fontSize: 14.5, lineHeight: 20 },
  muted: { color: C.dim, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bigDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.rowLine },
  hcText: { flex: 1, color: C.hardcore, fontSize: 13.5 },
  links: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  link: { flex: 1 },
  footer: { textAlign: 'center', fontSize: 11.5, lineHeight: 16, color: C.onWall, textShadowColor: C.onWallShadow, textShadowRadius: 3 },
});
