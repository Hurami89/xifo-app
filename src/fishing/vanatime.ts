// Vana'diel time, worked out the way the server does (vana_time.cpp): 25 Vana'diel minutes to an Earth minute,
// counted from 2002-01-01 00:00 JST (the game's base date), plus 886 Vana'diel years.
export const DAYS = ['Firesday', 'Earthsday', 'Watersday', 'Windsday', 'Iceday', 'Lightningday', 'Lightsday', 'Darksday'];
export const DAY_COLORS = ['#FF7A5A', '#E8C34A', '#6AAEFF', '#6FD87A', '#A8ECFF', '#C88AFF', '#FFFFFF', '#9A9AB8'];
const BASE = 1009810800; // unix seconds
const YEAR = 518400;     // Vana'diel minutes in a Vana'diel year

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export function vanaNow(ms = Date.now()) {
  const mins = Math.floor(((ms / 1000 - BASE) / 60) * 25) + 886 * YEAR;
  return { hour: Math.floor((mins % 1440) / 60), minute: mins % 60, day: Math.floor(mins / 1440) % 8 };
}

/** The look of the sky at a Vana'diel hour: dawn 4-6, day 6-17, dusk 17-20, night 20-4. */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 4 && hour < 6) return 'dawn';
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}
