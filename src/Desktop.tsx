// The app's frame (2026-11-26, in place of the Windows-desktop frame with its taskbar and Start menu): a slim top
// bar, the screens, and a bottom bar of five tabs: Home, Chat, Play, Wiki, Me. Play holds the three games (Fishing,
// Ventures, Cards) behind a switch in the top bar and opens the one used last. The gear opens Settings: sound, the
// look, the app's version. Every screen stays open while you switch, so the chat room keeps running.
// On a computer (the website, the PC / Linux app) it sits in a phone-wide column.
import React, { useEffect, useState } from 'react';
import { BackHandler, ImageBackground, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatScreen from './ChatScreen';
import WikiScreen from './WikiScreen';
import NewsScreen from './NewsScreen';
import MeScreen from './MeScreen';
import FishScreen from './FishScreen';
import VenturesScreen from './VenturesScreen';
import TetraScreen from './TetraScreen';
import type { Card } from './armory';
import { ART, Btn, F, Field, Icon, IconBtn, IconName, Seg, T } from './ui';
import { TH, THEMES, ThemeName } from './theme';
import { getJSON, LINKS, setJSON } from './store';
import { APP_VERSION, checkUpdate, Update } from './update';
import { setFx, setMusic, useSound } from './sfx';

type Tab = 'home' | 'chat' | 'play' | 'wiki' | 'me';
type Game = 'fish' | 'vent' | 'tm';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' }, { id: 'chat', label: 'Chat', icon: 'chat' }, { id: 'play', label: 'Play', icon: 'play' },
  { id: 'wiki', label: 'Wiki', icon: 'book' }, { id: 'me', label: 'Me', icon: 'person' },
];
const GAMES: { id: Game; label: string }[] = [{ id: 'fish', label: 'Fishing' }, { id: 'vent', label: 'Ventures' }, { id: 'tm', label: 'Cards' }];
const TITLE: Record<Tab, string> = { home: 'XI: Forever Offline', chat: 'Stinkshell chat', play: '', wiki: 'Wiki', me: 'My characters' };
const WIDE = Platform.OS === 'web';

/** Settings, up from the bottom: sound, the look, the app's version and (for testing) the chat room's address. */
function Settings({ close, update, setUpdate }: { close: () => void; update: Update | null; setUpdate: (u: Update | null) => void }) {
  const sound = useSound();
  const insets = useSafeAreaInsets();
  const [relay, setRelay] = useState('');
  const [more, setMore] = useState(false);
  const [note, setNote] = useState('');
  const [upNote, setUpNote] = useState('');
  useEffect(() => { getJSON('stink.relay', '').then(setRelay); }, []);
  const checkNow = async () => {
    setUpNote('Checking...');
    const u = await checkUpdate();
    if (u === 'error') setUpNote("Couldn't reach GitHub. Check your connection.");
    else { setUpdate(u); setUpNote(u ? '' : `You have the newest version (${APP_VERSION}).`); }
  };
  const pickLook = async (name: ThemeName) => {
    await setJSON('app.theme', name);
    if (Platform.OS === 'web') { try { (globalThis as any).location.reload(); } catch {} return; }
    setNote(name === TH.name ? '' : `${THEMES[name].label} is set. Close the app and open it again to see it.`);
  };
  const row = (label: string, on: boolean, set: (v: boolean) => void) => (
    <View style={st.setRow}>
      <T style={st.setLabel}>{label}</T>
      <Switch value={on} onValueChange={set} accessibilityLabel={label}
        trackColor={{ false: TH.barBg, true: TH.chipOn }} thumbColor={on ? TH.chipOnEdge : TH.dim}
        {...(Platform.OS === 'web' ? { activeThumbColor: TH.chipOnEdge } as any : null)} />
    </View>
  );
  return (
    <Pressable style={[StyleSheet.absoluteFill, st.shade]} onPress={close} accessibilityLabel="Close settings">
      <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 10 }]} onPress={() => {}}>
        <View style={st.sheetHead}>
          <T style={st.sheetTitle}>Settings</T>
          <IconBtn name="close" label="Close" onPress={close} size={18} color={TH.dim} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 6 }}>
          <T style={st.setHead}>Sound</T>
          {row('Sound effects', sound.fx, setFx)}
          {row('Music', sound.music, setMusic)}

          <T style={st.setHead}>Look</T>
          <View style={st.looks}>
            {(Object.keys(THEMES) as ThemeName[]).map((n) => (
              <Pressable key={n} onPress={() => pickLook(n)} accessibilityRole="button" accessibilityLabel={THEMES[n].label}
                style={[st.look, n === TH.name && st.lookOn]}>
                <T style={[st.lookText, n === TH.name && { color: TH.accent }]} numberOfLines={1}>{THEMES[n].label}</T>
                {n === TH.name ? <Icon name="check" size={15} color={TH.accent} /> : null}
              </Pressable>
            ))}
          </View>
          {note ? <T style={[st.setText, { color: TH.accent, marginTop: 6 }]}>{note}</T> : null}

          <T style={st.setHead}>About</T>
          <T style={st.setText}>XIFO app {APP_VERSION}. Free and open source (GPL-3.0). An unofficial fan project, not affiliated with Square Enix.</T>
          {Platform.OS !== 'web' ? (
            <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
              {update ? (
                <Btn small primary label={`Download ${update.tag}`} onPress={() => Linking.openURL(update.url).catch(() => {})} />
              ) : (
                <Btn small label="Check for updates" onPress={checkNow} />
              )}
              {upNote ? <T style={[st.setText, { marginTop: 4 }]}>{upNote}</T> : null}
              {update ? <T style={[st.setText, { marginTop: 4 }]}>Version {update.tag} is out (you have {APP_VERSION}). It installs over this one and keeps your pairing.</T> : null}
            </View>
          ) : null}

          <Pressable onPress={() => setMore((v) => !v)} accessibilityRole="button" accessibilityLabel="For testing" hitSlop={6}>
            <T style={[st.setHead, { marginBottom: 0 }]}>For testing {more ? '▴' : '▾'}</T>
          </Pressable>
          {more ? (
            <View style={{ marginTop: 6 }}>
              <T style={st.setText}>Chat room address (leave empty for the real one)</T>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <Field boxStyle={{ flex: 1 }} value={relay} onChangeText={setRelay} placeholder={LINKS.relay} autoCapitalize="none" keyboardType="url" />
                <Btn small label="Save" onPress={() => { setJSON('stink.relay', relay.trim()); close(); }} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

export default function Desktop() {
  const [tab, setTab] = useState<Tab>('home');
  const [game, setGame] = useState<Game>('fish');
  const [settings, setSettings] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [update, setUpdate] = useState<Update | null>(null);
  const sound = useSound();
  const insets = useSafeAreaInsets();
  useEffect(() => { checkUpdate().then((u) => { if (u && u !== 'error') setUpdate(u); }); }, []);
  useEffect(() => { getJSON<Game>('app.play', 'fish').then((g) => { if (GAMES.some((x) => x.id === g)) setGame(g); }); }, []);

  // a screen is made the first time it shows (also when the game used last arrives from storage after Play was opened)
  useEffect(() => {
    const k = tab === 'play' ? game : tab;
    setSeen((s) => (s[k] ? s : { ...s, [k]: true }));
  }, [tab, game]);
  // Android's back button closes Settings first
  useEffect(() => {
    if (!settings) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setSettings(false); return true; });
    return () => sub.remove();
  }, [settings]);
  const go = (t: Tab) => { setTab(t); setSettings(false); };
  const pick = (g: Game) => { setGame(g); setJSON('app.play', g); };
  const playing = (g: Game) => tab === 'play' && game === g;
  const loud = sound.fx || sound.music;
  const hide = (shown: boolean) => [st.screen, !shown && st.hidden];

  return (
    <ImageBackground source={ART.wallpaper} style={{ flex: 1, backgroundColor: '#0A1030' }} resizeMode="cover"
      imageStyle={WIDE ? { width: '100%', height: '100%' } : undefined}>
      <StatusBar style={TH.statusBar} />
      <View style={[{ flex: 1 }, WIDE && st.column]}>
        <LinearGradient colors={TH.titleGrad as any} style={[st.top, { paddingTop: insets.top, paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 2) }]}>
          <View style={st.topRow}>
            {tab === 'play'
              ? <Seg items={GAMES} value={game} onChange={pick} style={{ flex: 1, marginRight: 4 }} />
              : <T style={st.topTitle} numberOfLines={1}>{TITLE[tab]}</T>}
            {tab === 'play' ? (
              <IconBtn name={loud ? 'sound' : 'mute'} label={loud ? 'Sound is on' : 'Sound is off'} color={TH.titleText}
                onPress={() => { setFx(!loud); setMusic(!loud); }} />
            ) : null}
            <IconBtn name="gear" label="Settings" color={TH.titleText} dot={!!update} onPress={() => setSettings((v) => !v)} />
          </View>
        </LinearGradient>
        <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right }}>
          <View style={hide(tab === 'chat')}><ChatScreen onCount={setCount} /></View>
          <View style={hide(tab === 'wiki')}><WikiScreen /></View>
          <View style={hide(tab === 'home')}><NewsScreen goChat={() => go('chat')} goWiki={() => go('wiki')} /></View>
          {seen.fish && <View style={hide(playing('fish'))}><FishScreen cardsHint={cards} goMe={() => go('me')} active={playing('fish')} /></View>}
          {seen.vent && <View style={hide(playing('vent'))}><VenturesScreen active={playing('vent')} /></View>}
          {seen.tm && <View style={hide(playing('tm'))}><TetraScreen active={playing('tm')} goMe={() => go('me')} /></View>}
          {seen.me && <View style={hide(tab === 'me')}><MeScreen onCards={setCards} /></View>}
        </View>
        <LinearGradient colors={TH.taskGrad as any} style={[st.bar, { paddingBottom: insets.bottom }]}>
          {TABS.map((t) => {
            const on = tab === t.id;
            const tint = on ? TH.barOn : TH.barIcon;
            return (
              <Pressable key={t.id} onPress={() => go(t.id)} accessibilityRole="tab" accessibilityLabel={t.label}
                aria-selected={on} style={st.tab}>
                <View style={[st.tabPatch, on && { backgroundColor: TH.barOnBg }]}>
                  <Icon name={t.icon} size={22} color={tint} />
                  {t.id === 'chat' && count ? <View style={[st.live, { backgroundColor: TH.dotOn }]} /> : null}
                </View>
                <T style={[st.tabText, { color: tint }, on && { fontFamily: F.bold }]} numberOfLines={1}>{t.label}</T>
              </Pressable>
            );
          })}
        </LinearGradient>
        {settings && <Settings close={() => setSettings(false)} update={update} setUpdate={setUpdate} />}
      </View>
    </ImageBackground>
  );
}

const cinzel = TH.titleFont === 'Cinzel';
const st = StyleSheet.create({
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  screen: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hidden: { display: 'none' },
  top: { borderBottomWidth: 1, borderBottomColor: TH.taskEdge },
  topRow: { height: 46, flexDirection: 'row', alignItems: 'center' },
  topTitle: { flex: 1, color: TH.titleText, fontFamily: TH.titleFont, fontSize: cinzel ? 17 : 18, letterSpacing: cinzel ? 0.6 : 0.2,
    textShadowColor: TH.titleTextShadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  bar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: TH.taskEdge },
  tab: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabPatch: { width: 54, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: F.semi, fontSize: 11.5, letterSpacing: 0.2 },
  live: { position: 'absolute', top: 2, right: 11, width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.5)' },
  shade: { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 10 },
  sheet: { maxHeight: '86%', backgroundColor: TH.menuBg, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderBottomWidth: 0,
    borderColor: TH.paneEdge },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 4, paddingTop: 4 },
  sheetTitle: { flex: 1, fontFamily: TH.titleFont, fontSize: cinzel ? 17 : 18, color: TH.menuText },
  setHead: { fontFamily: F.bold, fontSize: 11.5, letterSpacing: 0.9, textTransform: 'uppercase', color: TH.menuSub, marginTop: 16, marginBottom: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  setLabel: { flex: 1, fontSize: 15.5, color: TH.menuText },
  setText: { fontSize: 13.5, lineHeight: 19, color: TH.menuSub },
  looks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  look: { width: '48%', flexGrow: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    paddingHorizontal: 12, borderWidth: 1, borderColor: TH.line, borderRadius: 8 },
  lookOn: { borderColor: TH.accent },
  lookText: { flex: 1, fontSize: 14.5, color: TH.menuText },
});
