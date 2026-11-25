// XI: Forever Offline app. This file only gets things ready: the fonts and the saved look (src/theme.ts) come first,
// then the desktop (src/Desktop.tsx) is loaded, so every screen is drawn in the chosen look.
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { applyTheme, DEFAULT_THEME } from './src/theme';
import { getJSON } from './src/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

// In a browser (xiforever.com/app, the PC / Linux app): thin scrollbars in the app's colours instead of the browser's own.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const css = document.createElement('style');
  css.textContent = '*{scrollbar-width:thin;scrollbar-color:#5D6DAA transparent}' +
    '::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#5D6DAA;border-radius:4px}' +
    '::-webkit-scrollbar-track{background:transparent}';
  document.head.appendChild(css);
}

export default function App() {
  const [fonts, fontError] = useFonts({
    Selawik: require('./assets/fonts/selawk.ttf'),
    'Selawik-Semibold': require('./assets/fonts/selawksb.ttf'),
    'Selawik-Bold': require('./assets/fonts/selawkb.ttf'),
    Pixel: require('./assets/fonts/PixelifySans-Regular.ttf'),
    'Pixel-Bold': require('./assets/fonts/PixelifySans-Bold.ttf'),
  });
  const [Desktop, setDesktop] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    (async () => {
      applyTheme(await getJSON<string>('app.theme', DEFAULT_THEME));
      setDesktop(() => require('./src/Desktop').default);
    })();
  }, []);
  const ready = (fonts || fontError) && Desktop;
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: '#0A1030' }} />;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <Desktop />
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
