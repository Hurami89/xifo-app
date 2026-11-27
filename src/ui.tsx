// Building blocks for every look (src/theme.ts): sections, panes, strips, buttons, icons, fields, pictures. Everything
// reads TH, which App.tsx sets before this file loads.
// (2026-11-26) The windows of the old desktop (a title bar with a minimise and a close button that did nothing) are plain
// sections now: a title, one edge, and a close button only where closing does something.
import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TH } from './theme';

export const C = TH;

export const F = { reg: 'Selawik', semi: 'Selawik-Semibold', bold: 'Selawik-Bold' };

export const ART = {
  get wallpaper() { return TH.wallpaper; },
  get logo() { return TH.logo; },
  get banners() { return TH.banners; },
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
};

/** One-colour icons (art/make_ui_icons.py draws them), tinted with the look's colours. */
export const ICONS = {
  home: require('../assets/ui/home.png'), chat: require('../assets/ui/chat.png'), play: require('../assets/ui/play.png'),
  book: require('../assets/ui/book.png'), person: require('../assets/ui/person.png'), gear: require('../assets/ui/gear.png'),
  sound: require('../assets/ui/sound.png'), mute: require('../assets/ui/mute.png'), back: require('../assets/ui/back.png'),
  close: require('../assets/ui/close.png'), check: require('../assets/ui/check.png'),
};
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ImageStyle> }) {
  return <Image source={ICONS[name]} resizeMode="contain" style={[{ width: size, height: size, tintColor: color || TH.ink }, style]} />;
}

/** An icon to press, with a finger-sized area around it. `dot`: a small red mark (something new behind it). */
export function IconBtn({ name, label, onPress, size = 22, color, dot, style }: {
  name: IconName; label: string; onPress?: () => void; size?: number; color?: string; dot?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }, style]}>
      <Icon name={name} size={size} color={color} />
      {dot ? <View style={s.iconDot} /> : null}
    </Pressable>
  );
}

/** A section: its title, then what is in it. `title=""` leaves the title line out; `onClose` adds a close button;
 * `right` puts something at the end of the title line. */
export function Win({ title, children, style, bodyStyle, onClose, right }: {
  title: string; children: React.ReactNode; style?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>; onClose?: () => void; right?: React.ReactNode;
}) {
  return (
    <View style={[s.win, style]}>
      {title ? (
        <View style={s.title}>
          <Text style={s.titleText} numberOfLines={1}>{title}</Text>
          {right}
          {onClose ? <IconBtn name="close" label="Close" onPress={onClose} size={16} color={TH.dim} style={s.titleClose} /> : null}
        </View>
      ) : null}
      <View style={[s.body, bodyStyle]}>{children}</View>
    </View>
  );
}

/** A darker inset inside a section, for lists. */
export function Pane({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.pane, style]}>{children}</View>;
}

/** A small heading inside a section. */
export function Strip({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={s.strip}>
      <Text style={s.stripText}>{title}</Text>
      {right}
    </View>
  );
}

/** A row of choices of which one is on (the games on the Play tab). Made for the top bar. */
export function Seg<K extends string>({ items, value, onChange, style }: {
  items: { id: K; label: string }[]; value: K; onChange: (id: K) => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.seg, style]}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable key={it.id} onPress={() => onChange(it.id)} accessibilityRole="button" accessibilityLabel={it.label}
            aria-selected={on} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Btn({ label, onPress, disabled, style, small, primary, active, textStyle }: {
  label: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
  primary?: boolean; active?: boolean; textStyle?: StyleProp<TextStyle>;
}) {
  // (2026-11-26) a chosen button (`active`) is filled with the look's "on" colour; a brighter edge alone was easy to miss
  const colors = disabled ? TH.disabledGrad : primary ? TH.primaryGrad : active ? [TH.chipOn, TH.chipOn] : TH.btnGrad;
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label} style={style}>
      {({ pressed }) => (
        <LinearGradient
          colors={(pressed && !disabled ? colors.slice().reverse() : colors) as any}
          style={[s.btn, small && s.btnSmall, primary && s.btnPrimary, active && !primary && { borderColor: TH.chipOnEdge }]}>
          <View style={s.btnShine} />
          <Text style={[s.btnText, small && { fontSize: 13 }, primary && s.btnTextPrimary, disabled && { color: TH.disabledText },
            active && !primary && !disabled && { color: TH.chipOnText }, textStyle]} numberOfLines={1}>{label}</Text>
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

/** A picture that keeps its shape: a frame with the aspect ratio, the image filling it. */
export function Pic({ source, ratio, style, mode = 'cover' }: { source: ImageSourcePropType; ratio: number; style?: StyleProp<ViewStyle>; mode?: 'cover' | 'contain' }) {
  return (
    <View style={[{ width: '100%', aspectRatio: ratio, overflow: 'hidden' }, style]}>
      <Image source={source} resizeMode={mode} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

const vana = TH.name === 'vanadiel';
const cinzel = TH.titleFont === 'Cinzel';
const s = StyleSheet.create({
  win: {
    borderRadius: vana ? 6 : 10, overflow: 'hidden', borderWidth: 1, borderColor: TH.paneEdge, backgroundColor: TH.winBg,
    // Android draws an elevation's shadow inside a see-through view too, so only the looks with solid sections get one
    shadowColor: '#000', shadowOpacity: TH.cardShade, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: TH.winBg.startsWith('#') ? 3 : 0,
  },
  title: { flexDirection: 'row', alignItems: 'center', minHeight: 36, paddingLeft: 12, paddingRight: 6, borderBottomWidth: 1, borderBottomColor: TH.rowLine },
  titleText: { flex: 1, color: TH.stripText, fontFamily: TH.titleFont, fontSize: cinzel ? 14 : 15, letterSpacing: cinzel ? 0.6 : 0.2, paddingVertical: 8 },
  titleClose: { width: 32, height: 32 },
  // (2026-11-25) flexGrow, not flex: 1. On phones flex: 1 sizes a section that doesn't fill the screen from nothing, so
  // the Stinkshell sign-in showed only its title ("minimized"). Sections that fill the screen still do.
  body: { flexGrow: 1, flexShrink: 1, padding: 10 },
  pane: { backgroundColor: TH.paneBg, borderRadius: vana ? 4 : 8, overflow: 'hidden' },
  strip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 9, paddingBottom: 5 },
  stripText: { flex: 1, fontFamily: F.bold, fontSize: 11.5, letterSpacing: 0.9, color: TH.dim, textTransform: 'uppercase' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconDot: { position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: '#E8302A', borderWidth: 1, borderColor: '#FFFFFF' },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 9, padding: 3, gap: 2 },
  segItem: { flex: 1, minHeight: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: TH.segOn },
  segText: { fontFamily: F.semi, fontSize: 14, color: TH.titleText, opacity: 0.85 },
  segTextOn: { color: TH.segOnText, opacity: 1, fontFamily: F.bold },
  btn: { borderRadius: TH.btnRadius, borderWidth: 1, borderColor: TH.btnBorder, paddingVertical: 7, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnSmall: { paddingVertical: 4, paddingHorizontal: 9 },
  btnPrimary: { borderColor: TH.primaryBorder, borderRadius: TH.primaryRadius, paddingHorizontal: 18 },
  btnShine: { position: 'absolute', left: 1, right: 1, top: 1, height: '45%', backgroundColor: `rgba(255,255,255,${TH.btnShine})`, borderRadius: 3 },
  btnText: { color: TH.btnText, fontFamily: TH.btnFont, fontSize: TH.btnFont === 'Cinzel' ? 13.5 : 15 },
  btnTextPrimary: { color: TH.primaryText, fontFamily: TH.btnFont === 'Cinzel' ? 'Cinzel' : F.bold, textShadowColor: TH.primaryShadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  field: { backgroundColor: TH.fieldBg, borderWidth: 1, borderColor: TH.fieldEdge, borderRadius: vana ? 2 : 3 },
  fieldText: { paddingHorizontal: 8, paddingVertical: 7, fontSize: 15, color: TH.fieldText, fontFamily: F.reg, minHeight: 36 },
  t: { fontFamily: F.reg, fontSize: 15, color: TH.ink },
});
