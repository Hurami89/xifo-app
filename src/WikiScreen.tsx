// The wiki: a contents page with groups, and the pages (Back and Contents above an open page).
// (2026-11-26) Before, it was dressed as a 2004 web browser, with an address bar and a status bar that did nothing.
// Pages ship inside the app (src/wikiData.ts) and are refreshed from GitHub (wiki/ in the app's repo) when online.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { ART, Btn, C, F, Pane, Pic, Strip, T, Win } from './ui';
import Markdown from './Markdown';
import { WIKI_INDEX, WIKI_PAGES } from './wikiData';
import { getJSON, setJSON, wikiBase } from './store';

type Index = typeof WIKI_INDEX;

async function refresh(): Promise<{ index: Index; pages: Record<string, string> } | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(wikiBase() + 'index.json', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const index = (await res.json()) as Index;
    if (!Array.isArray(index.pages)) return null;
    const pages: Record<string, string> = {};
    await Promise.all(index.pages.map(async (p) => {
      if (!/^[a-z0-9-]{1,40}$/.test(p.id)) return;
      const r = await fetch(wikiBase() + p.id + '.md');
      if (r.ok) pages[p.id] = (await r.text()).slice(0, 60000);
    }));
    return { index: { ...index, pages: index.pages.filter((p) => pages[p.id]) }, pages };
  } catch {
    return null;
  }
}

export default function WikiScreen() {
  const [index, setIndex] = useState<Index>(WIKI_INDEX);
  const [pages, setPages] = useState<Record<string, string>>(WIKI_PAGES);
  const [history, setHistory] = useState<string[]>([]);
  const page = history[history.length - 1];
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    (async () => {
      const cached = await getJSON<{ index: Index; pages: Record<string, string> } | null>('wiki.cache', null);
      if (cached?.index?.pages?.length) { setIndex(cached.index); setPages({ ...WIKI_PAGES, ...cached.pages }); }
      const fresh = await refresh();
      if (fresh && fresh.index.pages.length) {
        setIndex(fresh.index);
        setPages({ ...WIKI_PAGES, ...fresh.pages });
        setJSON('wiki.cache', fresh);
      }
    })();
  }, []);

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [page]);

  const open = (id: string) => { if (pages[id]) setHistory((h) => [...h, id]); };
  const groups: Record<string, Index['pages']> = {};
  index.pages.forEach((p) => { (groups[p.group || 'Pages'] ||= []).push(p); });
  const title = page ? index.pages.find((p) => p.id === page)?.title || page : 'Contents';

  return (
    <View style={st.wrap}>
      <Win title={title} style={{ flex: 1, alignSelf: 'stretch' }} bodyStyle={{ padding: 0 }}
        right={page ? (
          <View style={st.toolbar}>
            <Btn small label="‹ Back" onPress={() => setHistory((h) => h.slice(0, -1))} />
            {history.length > 1 ? <Btn small label="Contents" onPress={() => setHistory([])} /> : null}
          </View>
        ) : null}>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
          {page ? (
            <View style={{ padding: 4 }}>
              <Markdown text={(pages[page] || '').replace(/^\s*#\s+[^\n]*\n+/, '')} onPage={open} />
            </View>
          ) : (
            <>
              <Pic source={ART.logo} ratio={442 / 186} mode="contain" style={st.logo} />
              <T style={st.welcome}>The XI: Forever Offline guide. Pick a page.</T>
              {Object.entries(groups).map(([g, list]) => (
                <Pane key={g} style={{ marginBottom: 10 }}>
                  <Strip title={g} />
                  {list.map((p) => (
                    <Pressable key={p.id} onPress={() => open(p.id)} style={({ pressed }) => [st.item, pressed && { backgroundColor: C.rowPressed }]}>
                      <T style={st.itemText}>{p.title}</T>
                      <T style={st.arrow}>›</T>
                    </Pressable>
                  ))}
                </Pane>
              ))}
            </>
          )}
        </ScrollView>
      </Win>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, padding: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 4 },
  logo: { width: '70%', alignSelf: 'center', marginBottom: 6 },
  welcome: { textAlign: 'center', color: C.dim, marginBottom: 12, fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.rowLine },
  itemText: { flex: 1, fontFamily: F.semi, color: C.link, fontSize: 15.5 },
  arrow: { fontSize: 20, color: C.dim },
});
