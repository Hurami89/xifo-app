// The desktop: wallpaper, the programs (Stinkshell chat, the wiki, news, portable fishing, ventures, your characters) and a
// taskbar: XP's own (Vana'diel look) or Aero glass with the art-pack buttons. Every program stays open while you
// switch, so the chat room keeps running. On a computer (the website, the PC / Linux app) it sits in a phone-wide column.
import React, { useEffect, useState } from 'react';
import { Image, ImageBackground, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import ChatScreen from './ChatScreen';
import WikiScreen from './WikiScreen';
import NewsScreen from './NewsScreen';
import MeScreen from './MeScreen';
import FishScreen from './FishScreen';
import VenturesScreen from './VenturesScreen';
import type { Card } from './armory';
import { ART, Btn, C, F, Field, T } from './ui';
import { TH, THEMES, ThemeName } from './theme';
import { getJSON, LINKS, setJSON } from './store';
import { APP_VERSION, checkUpdate, Update } from './update';

type Tab = 'chat' | 'wiki' | 'news' | 'fish' | 'vent' | 'me';
const TABS: Tab[] = ['chat', 'wiki', 'news', 'fish', 'vent', 'me'];
const LABEL: Record<Tab, string> = { chat: 'Chat', wiki: 'Wiki', news: 'News', fish: 'Fish', vent: 'Venture', me: 'Me' };
const ICON: Record<Tab, any> = {
  chat: ART.buddy.phone, wiki: ART.buddy.web, news: ART.buddy.game,
  fish: require('../assets/art/icon_fish.png'), vent: require('../assets/art/icon_vent.png'), me: require('../assets/art/icon_me.png'),
};
const XP = TH.tabMode === 'xp';
const WIDE = Platform.OS === 'web';

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  const h = now.getHours();
  return <T style={st.clock}>{`${h % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`}</T>;
}

function StartMenu({ go, close, update, setUpdate }: { go: (t: Tab) => void; close: () => void; update: Update | null; setUpdate: (u: Update | null) => void }) {
  const [relay, setRelay] = useState('');
  const [about, setAbout] = useState(false);
  const [note, setNote] = useState('');
  const [upNote, setUpNote] = useState('');
  useEffect(() => { getJSON('stink.relay', '').then(setRelay); }, []);
  const checkNow = async () => {
    setUpNote('Checking...');
    const u = await checkUpdate();
    if (u === 'error') setUpNote("Couldn't reach GitHub. Check your connection.");
    else { setUpdate(u); setUpNote(u ? '' : `You have the newest version (${APP_VERSION}).`); }
  };
  const item = (icon: any, label: string, sub: string, onPress: () => void, wide = false) => (
    <Pressable onPress={onPress} style={({ pressed }) => [st.smItem, pressed && { backgroundColor: TH.menuPressed }]}>
      {({ pressed }) => (
        <>
          <Image source={icon} style={wide ? { width: 52, height: 18 } : { width: 30, height: 30 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <T style={[st.smLabel, pressed && { color: '#FFF' }]}>{label}</T>
            {sub ? <T style={[st.smSub, pressed && { color: '#DDE' }]}>{sub}</T> : null}
          </View>
        </>
      )}
    </Pressable>
  );
  const pickLook = async (name: ThemeName) => {
    await setJSON('app.theme', name);
    if (Platform.OS === 'web') { try { (globalThis as any).location.reload(); } catch {} return; }
    setNote(name === TH.name ? '' : `${THEMES[name].label} is set. Close the app and open it again to see it.`);
  };
  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={close}>
      <Pressable style={st.startMenu} onPress={() => {}}>
        <LinearGradient colors={TH.menuHead as any} style={st.smHead}>
          <Image source={ART.buddy.game} style={{ width: 38, height: 38 }} />
          <T style={[st.smHeadText, { flex: 1 }]}>XI: Forever Offline</T>
          <Clock />
        </LinearGradient>
        {about ? (
          <View style={{ padding: 12, backgroundColor: TH.menuBg }}>
            <Image source={ART.logo} style={{ width: '80%', alignSelf: 'center', aspectRatio: 442 / 186 }} resizeMode="contain" />
            <T style={st.smText}>
              App version {Constants.expoConfig?.version}. Free and open source (GPL-3.0). Unofficial fan project, not affiliated with Square Enix.
            </T>
            {Platform.OS !== 'web' ? (
              <View style={{ marginTop: 10 }}>
                {update ? (
                  <Btn small primary label={`Download ${update.tag}`} onPress={() => Linking.openURL(update.url).catch(() => {})} />
                ) : (
                  <Btn small label="Check for updates" onPress={checkNow} />
                )}
                {upNote ? <T style={[st.smText, { color: TH.menuSub, marginTop: 4 }]}>{upNote}</T> : null}
                {update ? <T style={[st.smText, { color: TH.menuSub, marginTop: 4 }]}>Version {update.tag} is out (you have {APP_VERSION}). It installs over this one and keeps your pairing.</T> : null}
              </View>
            ) : null}
            <T style={[st.smText, { color: TH.menuSub, marginTop: 10 }]}>Look</T>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {(Object.keys(THEMES) as ThemeName[]).map((n) => (
                <Pressable key={n} onPress={() => pickLook(n)} style={[st.look, n === TH.name && st.lookOn]}>
                  <T style={[st.smText, { textAlign: 'center' }]}>{THEMES[n].label}{n === TH.name ? ' ✓' : ''}</T>
                </Pressable>
              ))}
            </View>
            {note ? <T style={[st.smText, { color: '#6B4E00', marginTop: 6 }]}>{note}</T> : null}
            <T style={[st.smText, { color: TH.menuSub, marginTop: 10 }]}>Chat room address (for testing; leave empty for the real one)</T>
            <Field value={relay} onChangeText={setRelay} placeholder={LINKS.relay} autoCapitalize="none" keyboardType="url" />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              <Btn small label="Save" onPress={() => { setJSON('stink.relay', relay.trim()); setAbout(false); }} />
              <Btn small label="Back" onPress={() => setAbout(false)} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <View style={st.smLeft}>
              {item(ART.buddy.phone, 'Stinkshell', 'Chat with everyone', () => go('chat'))}
              {item(ART.buddy.web, "Vana'diel Explorer", 'The wiki', () => go('wiki'))}
              {item(ART.buddy.game, 'XIFO News', "What's new", () => go('news'))}
              {item(ICON.fish, 'Portable Fishing', 'Fish on the go', () => go('fish'))}
              {item(ICON.vent, 'Ventures', 'Send your squad out', () => go('vent'))}
              {item(ICON.me, 'My Characters', 'Your profile', () => go('me'))}
            </View>
            <View style={st.smRight}>
              {item(ART.b88.discord, 'Discord', '', () => Linking.openURL(LINKS.discord), true)}
              {item(ART.b88.site, 'Website', '', () => Linking.openURL(LINKS.website), true)}
              {item(ART.b88.github, 'GitHub', '', () => Linking.openURL(LINKS.github), true)}
              {item(ART.hc.iron, update ? 'Update ready!' : 'Look & About', update ? update.tag : '', () => setAbout(true))}
            </View>
          </View>
        )}
        <LinearGradient colors={TH.menuFoot as any} style={st.smFoot}>
          <Btn small label="Close" onPress={close} />
        </LinearGradient>
      </Pressable>
    </Pressable>
  );
}

export default function Desktop() {
  const [tab, setTab] = useState<Tab>('news');
  const [start, setStart] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [seen, setSeen] = useState<Record<string, boolean>>({ news: true });
  const [update, setUpdate] = useState<Update | null>(null);
  useEffect(() => { checkUpdate().then((u) => { if (u && u !== 'error') setUpdate(u); }); }, []);
  const insets = useSafeAreaInsets();
  const go = (t: Tab) => { setTab(t); setStart(false); setSeen((s) => (s[t] ? s : { ...s, [t]: true })); };

  const taskbar = (
    <LinearGradient colors={TH.taskGrad as any} locations={[0, 0.1, 0.6, 1]} style={[st.taskbar, { paddingBottom: insets.bottom }]}>
      <View style={st.taskRow}>
        {XP ? (
          <Pressable onPress={() => setStart((v) => !v)} accessibilityLabel="Start">
            <LinearGradient colors={(start ? TH.startOnGrad : TH.startGrad) as any} style={st.xpStart}>
              <Image source={ART.buddy.game} style={{ width: 20, height: 20 }} />
              <T style={st.xpStartText}>XIFO</T>
              {update ? <View style={st.badge}><T style={st.badgeText}>1</T></View> : null}
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable onPress={() => setStart((v) => !v)} accessibilityLabel="Start" hitSlop={4}>
            <Image source={ART.orb} style={[st.orb, start && { opacity: 0.85 }]} />
            {update ? <View style={[st.badge, { top: -8, right: 0 }]}><T style={st.badgeText}>1</T></View> : null}
          </Pressable>
        )}
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => go(t)} accessibilityRole="tab" accessibilityLabel={t} style={{ flex: 1 }}>
            {XP ? (
              <LinearGradient colors={(tab === t ? TH.tabOnGrad : TH.tabGrad) as any} style={[st.xpTab, tab === t && st.xpTabOn]}>
                <Image source={ICON[t]} style={{ width: 14, height: 14 }} />
                <T style={[st.xpTabText, LABEL[t].length > 5 && { fontSize: 10.5 }]} numberOfLines={1}>{LABEL[t]}</T>
              </LinearGradient>
            ) : (
              <Image source={ART.tabs[t][tab === t ? 1 : 0]} style={[st.tab, tab === t && st.tabOn]} resizeMode="contain" />
            )}
          </Pressable>
        ))}
        <View style={[st.trayDot, { backgroundColor: count ? TH.dotOn : TH.dotOff }]} />
      </View>
    </LinearGradient>
  );

  return (
    <ImageBackground source={ART.wallpaper} style={{ flex: 1, backgroundColor: '#0A1030' }} resizeMode="cover"
      imageStyle={WIDE ? { width: '100%', height: '100%' } : undefined}>
      <StatusBar style={TH.statusBar} />
      <View style={[{ flex: 1 }, WIDE && st.column]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View style={{ flex: 1 }}>
            <View style={[st.screen, tab !== 'chat' && st.hidden]}><ChatScreen onCount={setCount} /></View>
            <View style={[st.screen, tab !== 'wiki' && st.hidden]}><WikiScreen /></View>
            <View style={[st.screen, tab !== 'news' && st.hidden]}><NewsScreen goChat={() => go('chat')} goWiki={() => go('wiki')} /></View>
            {seen.fish && <View style={[st.screen, tab !== 'fish' && st.hidden]}><FishScreen cardsHint={cards} goMe={() => go('me')} active={tab === 'fish'} /></View>}
            {seen.vent && <View style={[st.screen, tab !== 'vent' && st.hidden]}><VenturesScreen active={tab === 'vent'} /></View>}
            {seen.me && <View style={[st.screen, tab !== 'me' && st.hidden]}><MeScreen onCards={setCards} /></View>}
          </View>
        </SafeAreaView>
        {taskbar}
        {start && <StartMenu go={go} close={() => setStart(false)} update={update} setUpdate={setUpdate} />}
      </View>
    </ImageBackground>
  );
}

const st = StyleSheet.create({
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  screen: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hidden: { display: 'none' },
  taskbar: { borderTopWidth: 1, borderTopColor: TH.taskEdge },
  taskRow: { flexDirection: 'row', alignItems: 'center', height: XP ? 46 : 52, paddingHorizontal: XP ? 0 : 4, gap: 2, paddingRight: 4 },
  orb: { width: 50, height: 50, marginTop: -10 },
  tab: { width: '100%', aspectRatio: 300 / 132 },
  tabOn: { transform: [{ scale: 1.04 }] },
  xpStart: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 6, paddingRight: 11,
    borderTopRightRadius: 16, borderBottomRightRadius: 16, borderWidth: 1, borderColor: TH.startEdge },
  xpStartText: { color: TH.startText, fontFamily: F.bold, fontSize: 15, fontStyle: 'italic', textShadowColor: TH.startShadow, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  xpTab: { height: 32, borderRadius: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 1,
    borderWidth: 1, borderColor: TH.name === 'online' ? '#000000' : '#1A3F99' },
  xpTabOn: { borderColor: TH.name === 'online' ? TH.accent : '#10286A' },
  xpTabText: { color: TH.tabText, fontFamily: F.semi, fontSize: 12, textShadowColor: '#0A2A6A', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  badge: { position: 'absolute', top: 3, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#E8302A',
    borderWidth: 1, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFFFFF', fontFamily: F.bold, fontSize: 10, lineHeight: 12 },
  trayDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 2 },
  clock: { color: '#FFF', fontSize: 12.5, fontFamily: F.reg },
  startMenu: { position: 'absolute', left: 4, bottom: 56, width: 330, maxWidth: '96%', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: TH.menuEdge, backgroundColor: TH.menuBg, elevation: 12, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10 },
  smHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  smHeadText: { color: '#FFF', fontFamily: F.bold, fontSize: 17, textShadowColor: '#0B3D91', textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 } },
  smLeft: { flex: 1.1, backgroundColor: TH.menuBg, paddingVertical: 4 },
  smRight: { flex: 1, backgroundColor: TH.menuSide, borderLeftWidth: 1, borderLeftColor: TH.line, paddingVertical: 4 },
  smItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 7 },
  smLabel: { fontFamily: F.semi, fontSize: 14, color: TH.menuText },
  smSub: { fontSize: 11.5, color: TH.menuSub },
  smText: { fontSize: 13.5, color: TH.menuText },
  smFoot: { flexDirection: 'row', justifyContent: 'flex-end', padding: 6 },
  look: { flex: 1, padding: 8, borderWidth: 1, borderColor: TH.line, borderRadius: 4, backgroundColor: TH.paneBg },
  lookOn: { borderColor: TH.accent, backgroundColor: TH.rowPressed },
});
void C;
