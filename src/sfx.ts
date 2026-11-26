// (2026-11-25) Sound for portable fishing and Ventures: short chiptune effects and one music loop each. Everything is
// original (art/make_sounds.py makes it). Two switches, kept on the device: effects and music; both start on.
// Music only plays while its screen is the one showing (Desktop.tsx tells the screen), and never before the first tap on
// the web, where browsers refuse sound until the page has been touched.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import { getJSON, setJSON } from './store';

const FX = {
  cast: require('../assets/sounds/sfx/cast.wav'),
  bite: require('../assets/sounds/sfx/bite.wav'),
  hit: require('../assets/sounds/sfx/hit.wav'),
  miss: require('../assets/sounds/sfx/miss.wav'),
  gold: require('../assets/sounds/sfx/gold.wav'),
  catch: require('../assets/sounds/sfx/catch.wav'),
  lost: require('../assets/sounds/sfx/lost.wav'),
  skill: require('../assets/sounds/sfx/skill.wav'),
  reel: require('../assets/sounds/sfx/reel.wav'),
  select: require('../assets/sounds/sfx/select.wav'),
  depart: require('../assets/sounds/sfx/depart.wav'),
  home: require('../assets/sounds/sfx/home.wav'),
  levelup: require('../assets/sounds/sfx/levelup.wav'),
  // Tetra Master (Nalfey's sounds)
  tm_battle: require('../assets/tetra/snd/snd_card_battle.mp3'),
  tm_choose: require('../assets/tetra/snd/snd_choose_card.mp3'),
  tm_coin: require('../assets/tetra/snd/snd_coin.mp3'),
  tm_combo: require('../assets/tetra/snd/snd_combo_woosh.mp3'),
  tm_cursor: require('../assets/tetra/snd/snd_cursor.mp3'),
  tm_error: require('../assets/tetra/snd/snd_error.mp3'),
  tm_flip: require('../assets/tetra/snd/snd_flip_card.mp3'),
  tm_lose_card: require('../assets/tetra/snd/snd_lose_card.mp3'),
  tm_lose: require('../assets/tetra/snd/snd_lose_game.mp3'),
  tm_perfect: require('../assets/tetra/snd/snd_perfect_game.mp3'),
  tm_put: require('../assets/tetra/snd/snd_put.mp3'),
  tm_tie: require('../assets/tetra/snd/snd_tie_game.mp3'),
  tm_win_card: require('../assets/tetra/snd/snd_win_card.mp3'),
  tm_win: require('../assets/tetra/snd/snd_win_game.mp3'),
};
const MUSIC = {
  fishing: require('../assets/sounds/bgm/fishing.mp3'),
  ventures: require('../assets/sounds/bgm/ventures.mp3'),
  tetra: require('../assets/tetra/snd/mus_quadmist.mp3'),
};
export type Fx = keyof typeof FX;
export type Track = keyof typeof MUSIC;

const S = { fx: true, music: true, loaded: false, want: null as Track | null };
const players: Partial<Record<Fx, AudioPlayer>> = {};
const tracks: Partial<Record<Track, AudioPlayer>> = {};
const listeners = new Set<() => void>();
let playing: Track | null = null;

async function load() {
  if (S.loaded) return;
  S.loaded = true;
  S.fx = await getJSON('sound.fx', true);
  S.music = await getJSON('sound.music', true);
  listeners.forEach((f) => f());
  apply();
}
load();

function player(name: Fx) {
  if (!players[name]) {
    try { players[name] = createAudioPlayer(FX[name]); } catch { return null; }
  }
  return players[name] || null;
}

/** A short effect (nothing when effects are off). */
export function sfx(name: Fx, volume = 0.8) {
  if (!S.fx) return;
  const p = player(name);
  if (!p) return;
  try { p.volume = volume; p.seekTo(0); p.play(); } catch {}
}

function apply() {
  const want = S.music && !away ? S.want : null;
  if (playing && playing !== want) {
    try { tracks[playing]?.pause(); } catch {}
    playing = null;
  }
  if (want && playing !== want) {
    try {
      if (!tracks[want]) {
        const p = createAudioPlayer(MUSIC[want]);
        p.loop = true;
        p.volume = 0.35;
        tracks[want] = p;
      }
      tracks[want]!.play();
      playing = want;
    } catch {}
  }
}

// the app in the background (or the browser tab hidden): the music stops, and comes back with the app
let away = false;
try {
  AppState.addEventListener('change', (s) => {
    const nowAway = s !== 'active';
    if (nowAway === away) return;
    away = nowAway;
    if (away) {
      try { if (playing) tracks[playing]?.pause(); } catch {}
      playing = null;
    } else {
      apply();
    }
  });
} catch {}

/** The music a screen wants while it shows (null: none). */
export function music(track: Track | null) {
  S.want = track;
  apply();
}

export function setFx(on: boolean) { S.fx = on; setJSON('sound.fx', on); listeners.forEach((f) => f()); }
export function setMusic(on: boolean) { S.music = on; setJSON('sound.music', on); apply(); listeners.forEach((f) => f()); }

/** { fx, music } for the switches, updated when either changes. */
export function useSound() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return { fx: S.fx, music: S.music };
}

/** Plays `track` while `active` is true (the screen is the one showing). */
export function useMusic(track: Track, active: boolean) {
  useEffect(() => {
    if (active) music(track);
    else if (S.want === track) music(null);
  }, [track, active]);
  useEffect(() => () => { if (S.want === track) music(null); }, [track]);
}
