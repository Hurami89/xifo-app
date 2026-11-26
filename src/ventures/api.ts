// Ventures on the hub (dev/armory/ventures_hub.py in the kit repo): the squads the launcher sent, the camps, the
// ventures out now and the ones that came home. The hub plans each venture when the mates leave; the app plays it back.
import { getRandomBytes } from 'expo-crypto';
import { call } from '../armory';
import { getJSON, setJSON } from '../store';

export type RosterMate = { slot: number; name: string; race: number; face: number; weapon?: number; job: number; sjob: number; level: number; exp: number };
export type RosterChar = { name: string; mates: RosterMate[]; at: number };
export type CampMob = { name: string; lo: number; hi: number; look: string };
export type Camp = { id: string; zone: number; title: string; spot: string; lo: number; hi: number; solo: boolean; scene: string; mobs: CampMob[] };
export type Ev = { t: number; k: 'leave' | 'arrive' | 'party' | 'rest' | 'move' | 'kill' | 'home'; c?: string; camp?: string; m?: number;
  lv?: number; x?: number; d?: number; drops?: [number, number][]; gil?: number; up?: [number, number][]; sc?: string; link?: boolean; close?: boolean };
export type PartyMember = { name: string; job: string; race: number; bot?: boolean };
export type VMate = { slot: number; name: string; job: number; race: number; face: number; weapon?: number; level: number; exp: number };
export type Results = { exp: number[]; levels: number[]; gil: number; kills: number; items: [number, number, string][] };
export type Venture = {
  id: string; char: string; slots: number[]; camp: string; hours: number; start: number; end: number; planned: number;
  recalled: boolean; over: boolean; applied: boolean; seen: boolean; party: PartyMember[]; mates: VMate[]; solo: boolean;
  events: Ev[]; results: Results; story?: string[];
};
export type State = { now: number; roster: RosterChar[]; ventures: Venture[]; hours: number[]; expPerHour: number; partyFrom: number;
  camps?: Camp[]; error?: string; unpaired?: boolean; offline?: boolean };

export async function fetchState(withCamps: boolean): Promise<State> {
  const out = await call('/ventures' + (withCamps ? '?camps=1' : ''));
  if (out.camps) await setJSON('ventures.camps', out.camps);
  if (out.roster) await setJSON('ventures.cache', { ...out, camps: undefined, at: Date.now() });
  return out;
}
export const cachedCamps = () => getJSON<Camp[] | null>('ventures.camps', null);
export const cachedState = () => getJSON<(State & { at: number }) | null>('ventures.cache', null);

export const newVentureId = () => 'v' + Array.from(getRandomBytes(10), (b) => b.toString(16).padStart(2, '0')).join('');
export const start = (body: { id: string; char: string; slots: number[]; camp: string; hours: number }) => call('/ventures/start', body);
export const recall = (id: string) => call('/ventures/recall', { id });
export const markSeen = (id: string) => call('/ventures/seen', { id });
