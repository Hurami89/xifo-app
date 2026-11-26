// One Tetra Master card as Nalfey's add-on draws it (card.lua Card:draw): the side's coloured back, the picture, the
// arrows round the edge and the 4-character code at the bottom. Drawn at any width; the art is 42 x 51.
import React from 'react';
import { Image, View, ViewStyle, StyleProp } from 'react-native';
import { TM } from './art';
import { DIRS } from './rules';

export type Face = { id: number; arrows: number; code: string };

const AT: Record<string, [number, number]> = {
  up: [18, 0], down: [18, 43], left: [0, 22], right: [34, 22],
  upleft: [0, 0], upright: [34, 0], downleft: [0, 43], downright: [34, 43],
};

export function CardView({ card, side, width, dim, glow, style }: {
  card: Face | null; side?: 'blue' | 'red' | null; width: number; dim?: boolean; glow?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const k = width / 42;
  const h = 51 * k;
  if (!card) {
    return <Image source={TM.cardback} style={[{ width, height: h }, style as any]} resizeMode="stretch" />;
  }
  return (
    <View style={[{ width, height: h, opacity: dim ? 0.5 : 1 }, glow && { shadowColor: '#FFD27A', shadowOpacity: 0.9, shadowRadius: 8 }, style]}>
      {side ? <Image source={side === 'blue' ? TM.back_blue : TM.back_red} style={{ position: 'absolute', width, height: h }} resizeMode="stretch" /> : null}
      <Image source={TM.card[card.id]} style={{ position: 'absolute', width, height: h }} resizeMode="stretch" />
      {DIRS.map((d, i) => (card.arrows & (1 << i)) ? (
        <Image key={d.name} source={TM.arrow[d.name]} style={{ position: 'absolute', left: AT[d.name][0] * k, top: AT[d.name][1] * k, width: 8 * k, height: 8 * k }} />
      ) : null)}
      <View style={{ position: 'absolute', left: 9 * k, top: 36 * k, flexDirection: 'row' }}>
        {card.code.split('').map((ch, i) => TM.glyph[ch] ? (
          <Image key={i} source={TM.glyph[ch]} style={{ width: 7 * k, height: 7 * k, marginRight: -1 * k }} />
        ) : null)}
      </View>
      {glow ? <View style={{ position: 'absolute', left: 0, top: 0, width, height: h, borderWidth: 2, borderColor: '#FFD27A', borderRadius: 3 }} /> : null}
    </View>
  );
}
