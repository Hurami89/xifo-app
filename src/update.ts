// Is a newer version of this app out? (2026-11-25) Asked of GitHub's newest release of Hurami89/xifo-app. Only the
// phone app needs it: the PC / Linux app and xiforever.com/app always show the newest version by themselves.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { appReleasesApi } from './store';

export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
export type Update = { tag: string; url: string };

export const newer = (a: string, b: string) => {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

/** The newer release (with its APK link), null when this is the newest, 'error' when GitHub can't be reached. */
export async function checkUpdate(): Promise<Update | null | 'error'> {
  if (Platform.OS === 'web') return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(appReleasesApi(), { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } });
    clearTimeout(t);
    if (!r.ok) return 'error';
    const a = await r.json();
    const apk = a?.assets?.find((x: any) => String(x.name).endsWith('.apk'));
    return a?.tag_name && newer(a.tag_name, APP_VERSION) ? { tag: a.tag_name, url: apk?.browser_download_url || a.html_url } : null;
  } catch {
    return 'error';
  }
}
