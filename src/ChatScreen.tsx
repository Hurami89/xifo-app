// The Stinkshell chat room, as a 2004 messenger window: sign-in card, "Name says:" lines, buddy list, emoticons.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import { ART, Btn, C, F, Field, Pane, Pic, Strip, T, Win } from './ui';
import { TH } from './theme';
import { Line, Room } from './stink';
import { getJSON, setJSON } from './store';
import { cleanWords } from './filter';
import { Rich } from './emoticons';

const NAME_RE = /^[A-Za-z0-9_]{2,15}$/;
const MAX_LINES = 400;
type Status = 'connecting' | 'online' | 'offline';

export function buddyOf(screen: string) {
  if (screen.startsWith('website: ')) return ART.buddy.web;
  if (screen.startsWith('mobile: ')) return ART.buddy.phone;
  return ART.buddy.game;
}

function hcIcon(text: string) {
  if (text.includes('(Steel)')) return ART.hc.steel;
  if (text.includes('(Silver)')) return ART.hc.silver;
  if (text.includes('Randomized')) return ART.hc.random;
  return ART.hc.iron;
}

function useSounds(enabled: boolean) {
  const players = useRef<Record<string, AudioPlayer>>({});
  useEffect(() => {
    try {
      players.current = {
        open: createAudioPlayer(require('../assets/sounds/door-open.wav')),
        close: createAudioPlayer(require('../assets/sounds/door-close.wav')),
        msg: createAudioPlayer(require('../assets/sounds/message.wav')),
      };
    } catch {
      players.current = {};
    }
    return () => Object.values(players.current).forEach((p) => { try { p.remove(); } catch {} });
  }, []);
  return useCallback((name: 'open' | 'close' | 'msg') => {
    if (!enabled) return;
    const p = players.current[name];
    if (!p) return;
    try { p.seekTo(0); p.play(); } catch {}
  }, [enabled]);
}

export default function ChatScreen({ onCount }: { onCount?: (n: number | null) => void }) {
  const [name, setName] = useState('');
  const [signedOn, setSignedOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>('offline');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [showPeople, setShowPeople] = useState(false);
  const [text, setText] = useState('');
  const [blocked, setBlocked] = useState<string[]>([]);
  const [clean, setClean] = useState(true);
  const [sound, setSound] = useState(true);
  const [screen, setScreen] = useState('');
  const room = useRef<Room | null>(null);
  const list = useRef<FlatList<Line>>(null);
  const play = useSounds(sound);
  const playRef = useRef(play);
  playRef.current = play;
  const screenRef = useRef('');

  useEffect(() => {
    (async () => {
      setName(await getJSON('stink.name', ''));
      setBlocked(await getJSON<string[]>('stink.blocked', []));
      setClean(await getJSON('stink.clean', true));
      setSound(await getJSON('stink.sound', true));
    })();
    return () => room.current?.stop();
  }, []);

  useEffect(() => { if (signedOn) onCount?.(people.length); }, [people, signedOn, onCount]);

  const signOn = async () => {
    const n = name.trim();
    if (!NAME_RE.test(n)) {
      setNote('Screen names are 2-15 letters, numbers or _ (no spaces).');
      return;
    }
    setBusy(true);
    setNote('');
    await setJSON('stink.name', n);
    setLines([]);
    const r = new Room(n, {
      onLines: (fresh) => {
        setLines((old) => [...old, ...fresh].slice(-MAX_LINES));
        const me = screenRef.current;
        for (const l of fresh) {
          if (l.kind === 'enter' && l.screen !== me) playRef.current('open');
          else if (l.kind === 'leave') playRef.current('close');
          else if (l.kind === 'say' && l.screen !== me) playRef.current('msg');
        }
      },
      onPeople: setPeople,
      onStatus: (s, why) => { setStatus(s); if (why) setNote(why); else if (s === 'online') setNote(''); },
      onError: (msg) => setNote(msg),
    });
    room.current = r;
    const ok = await r.start();
    setBusy(false);
    if (ok) {
      screenRef.current = r.screen;
      setScreen(r.screen);
      setSignedOn(true);
      playRef.current('open');
    }
  };

  const signOff = () => {
    room.current?.stop();
    room.current = null;
    setSignedOn(false);
    setStatus('offline');
    setPeople([]);
    playRef.current('close');
  };

  const send = async () => {
    const t = text.trim();
    if (!t || !room.current) return;
    setText('');
    const err = await room.current.say(t);
    if (err) setNote(err);
  };

  const saveBlocked = (next: string[]) => { setBlocked(next); setJSON('stink.blocked', next); };

  const askBlock = (who: string) => {
    if (!who || who === screen) return;
    const isBlocked = blocked.some((b) => b.toLowerCase() === who.toLowerCase());
    const go = () => saveBlocked(isBlocked ? blocked.filter((b) => b.toLowerCase() !== who.toLowerCase()) : [...blocked, who]);
    if (Platform.OS === 'web') return go();
    Alert.alert(who, isBlocked ? 'Show this person\'s messages again?' : 'Block this person? You stop seeing what they say (only you). To report someone, tell a moderator on the Discord.', [
      { text: 'Cancel', style: 'cancel' },
      { text: isBlocked ? 'Unblock' : 'Block', style: isBlocked ? 'default' : 'destructive', onPress: go },
    ]);
  };

  const shown = useMemo(() => {
    const hide = new Set(blocked.map((b) => b.toLowerCase()));
    return lines.filter((l) => !(l.screen && hide.has(l.screen.toLowerCase())));
  }, [lines, blocked]);

  // ------------------------------------------------------------------ sign-in card
  if (!signedOn) {
    return (
      <View style={st.wrap}>
        <Win title="Stinkshell Messenger" icon={ART.buddy.game} style={{ alignSelf: 'stretch' }}>
          <Pic source={ART.banners[1]} ratio={2.5} style={st.banner} />
          <View style={st.signBox}>
            <View style={st.picFrame}><Image source={ART.buddy.phone} style={{ width: 64, height: 64 }} /></View>
            <View style={{ flex: 1 }}>
              <T style={st.signTitle}>Sign in to the room</T>
              <T style={st.hint}>One room for everyone: players in game, on xiforever.com and on phones.</T>
            </View>
          </View>
          <T style={st.label}>Screen name</T>
          <Field value={name} onChangeText={setName} placeholder="YourName" maxLength={15} autoCapitalize="none"
            onSubmitEditing={signOn} returnKeyType="go" />
          <T style={st.hint}>You'll show as <T style={{ fontFamily: F.bold }}>{Platform.OS === 'web' ? 'website' : 'mobile'}: {name.trim() || 'YourName'}</T>, so nobody can take a character's name.</T>
          {note ? <T style={st.err}>{note}</T> : null}
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Btn primary label={busy ? 'Signing in...' : 'Sign In'} onPress={signOn} disabled={busy} style={{ minWidth: 160 }} />
          </View>
        </Win>
        <Win title="Room Rules" style={{ alignSelf: 'stretch', marginTop: 12 }}>
          <T style={st.rules}>
            {'• Be nice. No hate, no harassment, nothing gross.\n• Moderators can mute, kick and ban.\n• Long-press a name to block someone (only you stop seeing them).\n• Trouble with someone? Tell a moderator on the Discord.'}
          </T>
        </Win>
      </View>
    );
  }

  // ------------------------------------------------------------------ the room
  const dot = status === 'online' ? C.dotOn : status === 'connecting' ? '#E8B500' : C.red;
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View style={st.wrap}>
        <Win title={TH.chatMode === 'ffxi' ? 'Stinkshell - Linkshell' : 'Main Room - Stinkshell'} icon={ART.buddy.game} style={{ flex: 1, alignSelf: 'stretch' }} onClose={signOff}>
          <View style={st.meRow}>
            <Image source={buddyOf(screen)} style={{ width: 30, height: 30 }} />
            <View style={{ flex: 1 }}>
              <T style={st.meName} numberOfLines={1}>{screen}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={[st.dot, { backgroundColor: dot }]} />
                <T style={st.meStatus}>{status === 'online' ? 'Online' : status === 'connecting' ? 'Connecting...' : 'Offline'}</T>
              </View>
            </View>
            <Btn small label={`People (${people.length})`} active={showPeople} onPress={() => setShowPeople((v) => !v)} />
          </View>
          {note ? <T style={st.err} numberOfLines={2}>{note}</T> : null}
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            <Pane style={{ flex: 1 }}>
              <FlatList
                ref={list}
                data={shown}
                keyExtractor={(l) => String(l.seq)}
                renderItem={({ item, index }) => (
                  <ChatLine line={item} prev={shown[index - 1]} me={screen} clean={clean} onName={askBlock} />
                )}
                contentContainerStyle={{ padding: 8 }}
                onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={<T style={st.sys}>You have entered the room. Say hi!</T>}
              />
            </Pane>
            {showPeople && (
              <Pane style={{ width: 150 }}>
                <Strip title={`Online (${people.length})`} />
                <FlatList
                  data={people}
                  keyExtractor={(p) => p}
                  contentContainerStyle={{ padding: 4 }}
                  renderItem={({ item }) => (
                    <Pressable onLongPress={() => askBlock(item)} onPress={() => setText((t) => t + item.replace(/^(website|mobile): /, '') + ' ')} style={st.person}>
                      <Image source={buddyOf(item)} style={{ width: 18, height: 18 }} />
                      <T style={[st.personName, item === screen && { color: C.me }]} numberOfLines={1}>{item}</T>
                    </Pressable>
                  )}
                />
              </Pane>
            )}
          </View>
          <View style={st.inputRow}>
            <Field boxStyle={{ flex: 1 }} value={text} onChangeText={setText} placeholder="Type a message... :)"
              maxLength={200} onSubmitEditing={send} returnKeyType="send" submitBehavior="submit" />
            <Btn primary label="Send" onPress={send} />
          </View>
          <View style={st.bottomRow}>
            <Btn small label="Sign Out" onPress={signOff} />
            <Btn small label={sound ? 'Sounds: On' : 'Sounds: Off'} onPress={() => { setSound(!sound); setJSON('stink.sound', !sound); }} />
            <Btn small label={clean ? 'Filter: On' : 'Filter: Off'} onPress={() => { setClean(!clean); setJSON('stink.clean', !clean); }} />
            {blocked.length > 0 && <Btn small label={`Blocked (${blocked.length})`} onPress={() => {
              if (Platform.OS === 'web') return saveBlocked([]);
              Alert.alert('Blocked', blocked.join(', '), [{ text: 'Close' }, { text: 'Unblock all', onPress: () => saveBlocked([]) }]);
            }} />}
          </View>
        </Win>
      </View>
    </KeyboardAvoidingView>
  );
}

const ChatLine = React.memo(function ChatLine({ line, prev, me, clean, onName }: {
  line: Line; prev?: Line; me: string; clean: boolean; onName: (who: string) => void;
}) {
  const body = clean ? cleanWords(line.text) : line.text;
  if (line.kind === 'say' && TH.chatMode === 'ffxi') {
    // Final Fantasy XI's linkshell chat: <Name> text, in the linkshell's green
    return (
      <Text style={st.lsLine}>
        <Text style={[st.lsName, line.screen === me && { color: C.me }]} onLongPress={() => onName(line.screen)}>{'<' + line.screen + '> '}</Text>
        <Rich text={body} style={st.lsText} />
      </Text>
    );
  }
  if (line.kind === 'say') {
    const sameAsBefore = prev && prev.kind === 'say' && prev.screen === line.screen && line.t - prev.t < 120;
    return (
      <View style={{ marginTop: sameAsBefore ? 0 : 6 }}>
        {!sameAsBefore && (
          <Pressable onLongPress={() => onName(line.screen)} style={st.saysRow}>
            <Image source={buddyOf(line.screen)} style={{ width: 16, height: 16 }} />
            <Text style={[st.says, { color: line.screen === me ? C.me : C.dim }]}>{line.screen} says:</Text>
          </Pressable>
        )}
        <Rich text={body} style={st.msg} />
      </View>
    );
  }
  if (line.kind === 'enter' || line.kind === 'leave') {
    return (
      <View style={st.evRow}>
        <Image source={buddyOf(line.screen)} style={{ width: 14, height: 14, opacity: line.kind === 'leave' ? 0.4 : 1 }} />
        <T style={[st.ev, line.kind === 'leave' && { color: C.system }]}>{body}</T>
      </View>
    );
  }
  if (line.kind === 'hardcore') {
    return (
      <View style={st.hcRow}>
        <Image source={hcIcon(line.text)} style={{ width: 26, height: 26 }} />
        <T style={st.hc}>{body}</T>
      </View>
    );
  }
  return <T style={st.sys}>{body}</T>;
});

const st = StyleSheet.create({
  wrap: { flex: 1, padding: 10, alignItems: 'center' },
  banner: { borderRadius: 4, borderWidth: 1, borderColor: C.paneEdge },
  signBox: { flexDirection: 'row', gap: 10, alignItems: 'center', marginVertical: 12 },
  picFrame: { padding: 4, backgroundColor: C.boxBg, borderWidth: 1, borderColor: C.paneEdge, borderRadius: 6 },
  signTitle: { fontFamily: F.bold, fontSize: 18, color: C.accent },
  label: { fontFamily: F.semi, fontSize: 14, marginBottom: 4 },
  hint: { fontSize: 13, color: C.dim, marginTop: 4 },
  err: { color: C.err, fontSize: 13, marginVertical: 4 },
  rules: { fontSize: 14, lineHeight: 21 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  meName: { fontFamily: F.bold, fontSize: 15 },
  meStatus: { fontSize: 12, color: C.dim },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.3)' },
  saysRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  says: { fontFamily: F.reg, fontSize: 13 },
  msg: { fontFamily: F.reg, fontSize: 15.5, lineHeight: 21, color: C.ink, marginLeft: 21 },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  ev: { fontSize: 13, color: C.enter, fontStyle: 'italic' },
  sys: { color: C.system, fontStyle: 'italic', fontSize: 13, marginTop: 5 },
  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, padding: 6, backgroundColor: C.hcBg, borderRadius: 4, borderWidth: 1, borderColor: C.hcEdge },
  lsLine: { marginTop: 3, fontSize: 15, lineHeight: 21 },
  lsName: { color: C.chatSay, fontFamily: F.semi },
  lsText: { color: C.chatSay, fontFamily: F.reg, fontSize: 15, lineHeight: 21 },
  hc: { flex: 1, color: C.hardcore, fontFamily: F.semi, fontSize: 14 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  personName: { fontSize: 13.5, flex: 1 },
  inputRow: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' },
  bottomRow: { flexDirection: 'row', gap: 5, marginTop: 6, flexWrap: 'wrap' },
});
