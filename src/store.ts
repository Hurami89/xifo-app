// Small settings store (AsyncStorage) plus the app's fixed addresses.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';

export const LINKS = {
  relay: 'https://chat.xiforever.com',
  website: 'https://xiforever.com',
  worlds: 'https://xiforever.com/worlds.json',
  discord: 'https://discord.gg/2bh3QYPptz',
  twitch: 'https://twitch.tv/hurami',
  github: 'https://github.com/Hurami89/xi-forever-offline',
  download: 'https://github.com/Hurami89/xi-forever-offline/releases/latest/download/XI-Forever-Offline.zip',
  kitReleases: 'https://api.github.com/repos/Hurami89/xi-forever-offline/releases?per_page=5',
  patchNotes: 'https://raw.githubusercontent.com/Hurami89/xi-forever-offline/main/PATCH-NOTES.md',
  appRepo: 'Hurami89/xifo-app',
};
export const APP_VERSION = '1.0.0';

export const appReleasesApi = () => `https://api.github.com/repos/${LINKS.appRepo}/releases/latest`;
export const wikiBase = () => `https://raw.githubusercontent.com/${LINKS.appRepo}/main/wiki/`;

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable: the app still works, it just forgets
  }
}

/** This phone's own Stinkshell key: 32 hex characters, made once, never shown. The relay keeps only a hash. */
export async function stinkKey(): Promise<string> {
  const have = await getJSON<string>('stink.key', '');
  if (/^[0-9a-f]{32}$/.test(have)) return have;
  const key = Array.from(getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
  await setJSON('stink.key', key);
  return key;
}

export async function relayUrl(): Promise<string> {
  const custom = await getJSON<string>('stink.relay', '');
  return (custom || LINKS.relay).replace(/\/+$/, '');
}
