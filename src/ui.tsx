// Building blocks for both looks (src/theme.ts): windows, panes, strips, buttons, fields, pictures. Everything reads TH,
// which App.tsx sets before this file loads.
import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TH } from './theme';

export const C = TH;

export const F = { reg: 'Selawik', semi: 'Selawik-Semibold', bold: 'Selawik-Bold' };

export const ART = {
  get wallpaper() { return TH.wallpaper; },
  get logo() { return TH.logo; },
  get banners() { return TH.banners; },
  orb: require('../assets/art/start_orb.png'),
  hub: require('../assets/art/hub_banner.jpg'),
  buddy: {
    game: require('../assets/art/buddy_game.png'),
    web: require('../assets/art/buddy_web.png'),
    phone: require('../assets/art/buddy_phone.png'),
  },
  hc: {
    iron: require('../assets/art/hc_iron.png'),
    steel: require('../assets/art/hc_steel.png'),
    silver: require('../assets/art/hc_silver.png'),
    random: require('../assets/art/hc_random.png'),
  },
  hcCard: {
    iron: require('../assets/art/hc_card_iron.png'),
    steel: require('../assets/art/hc_card_steel.png'),
    silver: require('../assets/art/hc_card_silver.png'),
    random: require('../assets/art/hc_card_random.png'),
  },
  b88: {
    discord: require('../assets/art/b88_discord.png'),
    twitch: require('../assets/art/b88_twitch.png'),
    github: require('../assets/art/b88_github.png'),
    site: require('../assets/art/b88_site.png'),
    download: require('../assets/art/b88_download.png'),
    hub: require('../assets/art/b88_hub.png'),
  },
  tabs: {
    chat: [require('../assets/art/tab_chat.png'), require('../assets/art/tab_chat_on.png')],
    wiki: [require('../assets/art/tab_wiki.png'), require('../assets/art/tab_wiki_on.png')],
    news: [require('../assets/art/tab_news.png'), require('../assets/art/tab_news_on.png')],
    fish: [require('../assets/art/tab_fish.png'), require('../assets/art/tab_fish_on.png')],
    me: [require('../assets/art/tab_me.png'), require('../assets/art/tab_me_on.png')],
  } as Record<string, ImageSourcePropType[]>,
};

/** A window: Final Fantasy XI's navy menu with a header band (Vana'diel), or an XP glass window (Aero). */
export function Win({ title, icon, children, style, bodyStyle, onClose }: {
  title: string; icon?: ImageSourcePropType; children: React.ReactNode; style?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>; onClose?: () => void;
}) {
  return (
    <View style={[s.win, style]}>
      <LinearGradient colors={TH.titleGrad as any} locations={TH.titleGrad.length === 4 ? [0, 0.12, 0.55, 1] : undefined} style={s.title}>
        <View style={s.titleShine} />
        {icon ? <Image source={icon} style={s.titleIcon} /> : null}
        <Text style={s.titleText} numberOfLines={1}>{title}</Text>
        <View style={s.caps}>
          <LinearGradient colors={TH.capMin as any} style={s.cap}><Text style={s.capText}>_</Text></LinearGradient>
          <Pressable onPress={onClose} hitSlop={6} accessibilityLabel="Close">
            <LinearGradient colors={TH.capClose as any} style={s.cap}><Text style={s.capText}>×</Text></LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
      <View style={[s.body, bodyStyle]}>{children}</View>
    </View>
  );
}

export function Pane({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.pane, style]}>{children}</View>;
}

export function Strip({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <LinearGradient colors={TH.stripGrad as any} style={s.strip}>
      <Text style={s.stripText}>{title}</Text>
      {right}
    </LinearGradient>
  );
}

export function Btn({ label, onPress, disabled, style, small, primary, active, textStyle }: {
  label: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
  primary?: boolean; active?: boolean; textStyle?: StyleProp<TextStyle>;
}) {
  const colors = disabled ? TH.disabledGrad : primary ? TH.primaryGrad : active ? TH.activeGrad : TH.btnGrad;
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label} style={style}>
      {({ pressed }) => (
        <LinearGradient
          colors={(pressed && !disabled ? colors.slice().reverse() : colors) as any}
          style={[s.btn, small && s.btnSmall, primary && s.btnPrimary, active && !primary && { borderColor: TH.accent }]}>
          <View style={s.btnShine} />
          <Text style={[s.btnText, small && { fontSize: 13 }, primary && s.btnTextPrimary, disabled && { color: TH.disabledText },
            active && !primary && { color: TH.accent }, textStyle]}>{label}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { boxStyle?: StyleProp<ViewStyle> }) {
  const { boxStyle, style, ...rest } = props;
  return (
    <View style={[s.field, boxStyle]}>
      <TextInput placeholderTextColor={TH.placeholder} autoCorrect={false} style={[s.fieldText, style]} {...rest} />
    </View>
  );
}

export function T({ children, style, ...rest }: React.ComponentProps<typeof Text>) {
  return <Text style={[s.t, style]} {...rest}>{children}</Text>;
}

export function PicBtn({ source, onPress, style, label }: { source: ImageSourcePropType; onPress?: () => void; style?: StyleProp<any>; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label}>
      {({ pressed }) => <Image source={source} style={[style, pressed && { opacity: 0.75 }]} resizeMode="contain" />}
    </Pressable>
  );
}

/** A picture that keeps its shape: a frame with the aspect ratio, the image filling it. */
export function Pic({ source, ratio, style, mode = 'cover' }: { source: ImageSourcePropType; ratio: number; style?: StyleProp<ViewStyle>; mode?: 'cover' | 'contain' }) {
  return (
    <View style={[{ width: '100%', aspectRatio: ratio, overflow: 'hidden' }, style]}>
      <Image source={source} resizeMode={mode} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

const vana = TH.name === 'vanadiel';
const s = StyleSheet.create({
  win: {
    borderRadius: TH.winRadius, borderBottomLeftRadius: vana ? TH.winRadius : 4, borderBottomRightRadius: vana ? TH.winRadius : 4, overflow: 'hidden',
    borderWidth: 1, borderColor: TH.winBorder, backgroundColor: TH.winOuter,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  title: { height: vana ? 30 : 32, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
    borderBottomWidth: vana ? 1 : 0, borderBottomColor: '#8E97C2' },
  titleShine: { position: 'absolute', left: 0, right: 0, top: 0, height: 13, backgroundColor: `rgba(255,255,255,${TH.titleShine})` },
  titleIcon: { width: 20, height: 20, marginRight: 6 },
  titleText: { flex: 1, color: TH.titleText, fontFamily: F.bold, fontSize: 15, letterSpacing: vana ? 0.4 : 0,
    textShadowColor: TH.titleTextShadow, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  caps: { flexDirection: 'row', gap: 3 },
  cap: { width: vana ? 22 : 24, height: vana ? 19 : 22, borderRadius: vana ? 2 : 4, borderWidth: 1, borderColor: TH.capBorder, alignItems: 'center', justifyContent: 'center' },
  capText: { color: '#FFF', fontFamily: F.bold, fontSize: 15, lineHeight: 18, marginTop: -2 },
  body: { flex: 1, backgroundColor: TH.winBg, margin: vana ? 0 : 3, marginTop: 0, padding: 8 },
  pane: { backgroundColor: TH.paneBg, borderWidth: 1, borderColor: TH.paneEdge, borderRadius: vana ? 2 : 3 },
  strip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: TH.line },
  stripText: { flex: 1, fontFamily: F.bold, fontSize: 13, color: TH.stripText },
  btn: { borderRadius: TH.btnRadius, borderWidth: 1, borderColor: TH.btnBorder, paddingVertical: 7, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnSmall: { paddingVertical: 4, paddingHorizontal: 9 },
  btnPrimary: { borderColor: TH.primaryBorder, borderRadius: TH.primaryRadius, paddingHorizontal: 18 },
  btnShine: { position: 'absolute', left: 1, right: 1, top: 1, height: '45%', backgroundColor: `rgba(255,255,255,${TH.btnShine})`, borderRadius: 3 },
  btnText: { color: TH.btnText, fontFamily: F.semi, fontSize: 15 },
  btnTextPrimary: { color: TH.primaryText, fontFamily: F.bold, textShadowColor: TH.primaryShadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  field: { backgroundColor: TH.fieldBg, borderWidth: 1, borderColor: TH.fieldEdge, borderRadius: vana ? 2 : 3 },
  fieldText: { paddingHorizontal: 8, paddingVertical: 7, fontSize: 15, color: TH.fieldText, fontFamily: F.reg, minHeight: 36 },
  t: { fontFamily: F.reg, fontSize: 15, color: TH.ink },
});
