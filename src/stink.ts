// Stinkshell client: the same relay the game add-on and the website chat room use (dev/stinkshell/stinkshell_relay.py).
//   POST /hello {name} -> {screen, seq}     POST /say {name, text} -> {ok} | {error}
//   GET  /poll?since=N -> {seq, lines, people}  (waits up to 25 s)
//   GET  /health -> {ok, people}             GET /announcements?since=N -> {seq, lines} (hardcore lines only)
import { Platform } from 'react-native';
import { relayUrl, stinkKey } from './store';

export type Line = { seq: number; t: number; kind: string; screen: string; text: string };

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Stink-Key': await stinkKey(),
    // Phone app: shown as "mobile: Nick" by a relay that knows the app (2026-11-24 patch). An older relay sees the
    // website's address instead and shows "website: Nick", so a phone can never take a character's name either way.
  };
  // In a browser (xiforever.com/app, the PC / Linux app) the page is the website itself: the relay names its visitors
  // "website: Nick" by the page's address, and an extra header would make the browser refuse the request.
  if (Platform.OS !== 'web') {
    h['X-Stink-App'] = '1';
    h.Origin = 'https://xiforever.com';
  }
  return h;
}

async function call(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener('abort', () => ctrl.abort());
  }
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch((await relayUrl()) + path, { ...init, headers: await headers(), signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && !body.error) body.error = `The room answered ${res.status}.`;
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function health(): Promise<number | null> {
  try {
    const b = await call('/health', { timeoutMs: 8000 });
    return typeof b.people === 'number' ? b.people : null;
  } catch {
    return null;
  }
}

export async function announcements(since = 0): Promise<Line[]> {
  try {
    const b = await call(`/announcements?since=${since}`, { timeoutMs: 10000 });
    return Array.isArray(b.lines) ? b.lines : [];
  } catch {
    return [];
  }
}

type Events = {
  onLines: (lines: Line[]) => void;
  onPeople: (people: string[]) => void;
  onStatus: (status: 'connecting' | 'online' | 'offline', note?: string) => void;
  onError: (msg: string) => void;
};

/** One signed-on session. start() says hello and keeps polling until stop(). */
export class Room {
  screen = '';
  private seq = 0;
  private running = false;
  private abort: AbortController | null = null;

  constructor(private name: string, private ev: Events) {}

  async start(): Promise<boolean> {
    this.running = true;
    this.ev.onStatus('connecting');
    try {
      const b = await call('/hello', { method: 'POST', body: JSON.stringify({ name: this.name }) });
      if (b.error) {
        this.ev.onError(b.error);
        this.ev.onStatus('offline', b.error);
        this.running = false;
        return false;
      }
      this.screen = b.screen;
      this.seq = b.seq || 0;
    } catch {
      this.ev.onStatus('offline', "Can't reach the chat room. Check your connection.");
      this.running = false;
      return false;
    }
    this.ev.onStatus('online');
    this.loop();
    return true;
  }

  private async loop() {
    let wait = 1000;
    while (this.running) {
      this.abort = new AbortController();
      try {
        const b = await call(`/poll?since=${this.seq}`, { signal: this.abort.signal, timeoutMs: 35000 });
        if (!this.running) break;
        if (b.error) this.ev.onError(b.error);
        if (Array.isArray(b.lines) && b.lines.length) {
          const fresh = b.lines.filter((l: Line) => l.seq > this.seq);
          if (fresh.length) this.ev.onLines(fresh);
        }
        if (typeof b.seq === 'number') this.seq = Math.max(this.seq, b.seq);
        if (Array.isArray(b.people)) this.ev.onPeople(b.people);
        this.ev.onStatus('online');
        wait = 1000;
        if (b.error) await sleep(10000);
      } catch {
        if (!this.running) break;
        this.ev.onStatus('offline', 'Connection lost. Trying again...');
        await sleep(wait);
        wait = Math.min(wait * 2, 30000);
      }
    }
  }

  async say(text: string): Promise<string | null> {
    try {
      const b = await call('/say', { method: 'POST', body: JSON.stringify({ name: this.name, text }) });
      return b.error || null;
    } catch {
      return "Couldn't send that. Check your connection.";
    }
  }

  stop() {
    this.running = false;
    this.abort?.abort();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
