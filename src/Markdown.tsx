// A small markdown renderer for the wiki and patch notes: # headings, paragraphs, - and 1. lists, **bold**, `code`,
// [links](page or https://...) and ![](picture) lines that point at the app's own art.
import React from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { ART, C, F, Pic } from './ui';

const PICS: Record<string, { src: any; ratio: number; width?: number }> = {
  banner_1: { src: ART.banners[0], ratio: 2.5 }, banner_2: { src: ART.banners[1], ratio: 2.5 },
  banner_3: { src: ART.banners[2], ratio: 2.5 }, banner_4: { src: ART.banners[3], ratio: 2.5 },
  banner_5: { src: ART.banners[4], ratio: 2.5 }, hub: { src: ART.hub, ratio: 4 },
  logo: { src: ART.logo, ratio: 442 / 186 },
  hc_iron: { src: ART.hc.iron, ratio: 1, width: 56 }, hc_steel: { src: ART.hc.steel, ratio: 1, width: 56 },
  hc_silver: { src: ART.hc.silver, ratio: 1, width: 56 }, hc_random: { src: ART.hc.random, ratio: 1, width: 56 },
};

type Props = { text: string; onPage?: (id: string) => void };

function inline(text: string, onPage?: (id: string) => void, keyBase = 'i'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}${k++}`;
    if (tok.startsWith('**')) out.push(<Text key={key} style={st.b}>{tok.slice(2, -2)}</Text>);
    else if (tok.startsWith('`')) out.push(<Text key={key} style={st.code}>{tok.slice(1, -1)}</Text>);
    else if (tok.startsWith('[')) {
      const label = tok.slice(1, tok.indexOf(']'));
      const href = tok.slice(tok.indexOf('(') + 1, -1);
      out.push(
        <Text key={key} style={st.link} onPress={() => (/^https?:/.test(href) ? Linking.openURL(href) : onPage?.(href))}>{label}</Text>,
      );
    } else out.push(<Text key={key} style={st.i}>{tok.slice(1, -1)}</Text>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text, onPage }: Props) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push(<Text key={'p' + blocks.length} style={st.p}>{inline(para.join(' '), onPage, 'p' + blocks.length)}</Text>);
      para = [];
    }
  };
  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const pic = line.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    if (!line.trim()) return flush();
    if (pic) {
      flush();
      if (pic[1] === 'hc_cards') {
        blocks.push(
          <View key={'c' + blocks.length} style={st.cards}>
            {(['iron', 'steel', 'silver', 'random'] as const).map((m) => (
              <View key={m} style={{ flex: 1 }}><Pic source={ART.hcCard[m]} ratio={232 / 330} mode="contain" /></View>
            ))}
          </View>,
        );
        return;
      }
      const p = PICS[pic[1]];
      if (p) {
        blocks.push(
          p.width
            ? <Image key={'img' + blocks.length} source={p.src} style={{ width: p.width, height: p.width, marginVertical: 6 }} />
            : <Pic key={'img' + blocks.length} source={p.src} ratio={p.ratio} style={st.pic} />,
        );
      }
      return;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      const lvl = h[1].length;
      blocks.push(<Text key={'h' + blocks.length} style={lvl === 1 ? st.h1 : lvl === 2 ? st.h2 : st.h3}>{inline(h[2], onPage)}</Text>);
      return;
    }
    const li = line.match(/^\s*(?:[-*•]|(\d+)\.)\s+(.*)$/);
    if (li) {
      flush();
      blocks.push(
        <View key={'l' + blocks.length} style={st.li}>
          <Text style={st.bullet}>{li[1] ? li[1] + '.' : '•'}</Text>
          <Text style={st.liText}>{inline(li[2], onPage, 'l' + blocks.length)}</Text>
        </View>,
      );
      return;
    }
    para.push(line.trim());
  });
  flush();
  return <View>{blocks}</View>;
}

const st = StyleSheet.create({
  h1: { fontFamily: F.bold, fontSize: 22, color: C.accent, marginBottom: 8 },
  h2: { fontFamily: F.bold, fontSize: 17, color: C.accent, marginTop: 14, marginBottom: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.line },
  h3: { fontFamily: F.semi, fontSize: 15.5, color: C.ink, marginTop: 10, marginBottom: 2 },
  p: { fontFamily: F.reg, fontSize: 15, lineHeight: 22, color: C.ink, marginBottom: 8 },
  b: { fontFamily: F.bold },
  i: { fontStyle: 'italic', color: C.dim },
  code: { fontFamily: 'monospace', fontSize: 13.5, backgroundColor: C.boxBg, color: C.ink },
  link: { color: C.link, textDecorationLine: 'underline' },
  li: { flexDirection: 'row', marginBottom: 4, paddingRight: 4 },
  bullet: { width: 20, fontFamily: F.bold, fontSize: 15, color: C.accent, lineHeight: 22 },
  liText: { flex: 1, fontFamily: F.reg, fontSize: 15, lineHeight: 22, color: C.ink },
  pic: { borderRadius: 4, marginVertical: 8, borderWidth: 1, borderColor: C.paneEdge },
  cards: { flexDirection: 'row', gap: 4, marginVertical: 8 },
  card: { flex: 1, aspectRatio: 232 / 330 },
});
