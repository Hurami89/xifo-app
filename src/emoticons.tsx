// 2004 messenger emoticons: :) :( :D ;) :P ^^ :O B) drawn as little glossy faces inside the text.
import React from 'react';
import { Image, StyleProp, Text, TextStyle } from 'react-native';

const FACES: Record<string, any> = {
  ':)': require('../assets/art/emo_smile.png'), ':-)': require('../assets/art/emo_smile.png'),
  ':(': require('../assets/art/emo_sad.png'), ':-(': require('../assets/art/emo_sad.png'),
  ':D': require('../assets/art/emo_grin.png'), ':-D': require('../assets/art/emo_grin.png'),
  ';)': require('../assets/art/emo_wink.png'), ';-)': require('../assets/art/emo_wink.png'),
  ':P': require('../assets/art/emo_tongue.png'), ':p': require('../assets/art/emo_tongue.png'),
  '^^': require('../assets/art/emo_happy.png'), '^_^': require('../assets/art/emo_happy.png'),
  ':O': require('../assets/art/emo_wow.png'), ':o': require('../assets/art/emo_wow.png'),
  'B)': require('../assets/art/emo_cool.png'),
};
const RE = /(:-?\)|:-?\(|:-?D|;-?\)|:[Pp]|\^_?\^|:[Oo]|B\))/g;

export function Rich({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const parts = text.split(RE);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        FACES[p] ? <Image key={i} source={FACES[p]} style={{ width: 19, height: 19 }} accessibilityLabel={p} /> : <Text key={i}>{p}</Text>,
      )}
    </Text>
  );
}
