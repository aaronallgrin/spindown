/**
 * Pauper Secret Santa. Sign-ups and the Unboxing Day date live in Supabase
 * (supabase/santa.sql). The host taps Draw names once everyone's in; the draw happens
 * inside the database, and a phone can only ever ask who *it* drew.
 */
import { playerKey, playerName } from './polls';
import { cloud } from './push';
import type { GameRecord } from './types';

export const EXCHANGE = '2026';
export const SIGNUPS_CLOSE = '2026-11-19'; // last day to sign up (also enforced in santa.sql)
export const MIN_DRAW = 3; // fewer than this and the loop is pointless
export const SANTA_PLAYERS = // quick picks on sign-up; anyone else types their name
  ['Aaron', 'Andrew', 'Chris', 'Cody', 'Colin', 'Josh', 'Marion', 'Tim'];
export const LEAGUE = 'Pauper Secret Santa League';
export const HOST = 'Aaron'; // the one who sets Unboxing Day
export const PDH_HOME = 'https://www.pdhhomebase.com/';

export type Signup = { name: string; theme: string; avoid: string };
export type Exchange = { signups: Signup[]; unboxing: string | null; drawn: boolean };

const ex = `exchange=eq.${EXCHANGE}`;
const json = (r: Response) => r.json();

export async function loadExchange(): Promise<Exchange> {
  const [signups, settings, drawn] = await Promise.all([
    cloud(`rest/v1/santa_signups?${ex}&select=name,theme,avoid&order=created_at`).then(json),
    cloud(`rest/v1/santa_settings?${ex}&select=unboxing`).then(json),
    cloud('rest/v1/rpc/santa_drawn', { method: 'POST', body: JSON.stringify({ p_exchange: EXCHANGE }) }).then(json),
  ]);
  return { signups, unboxing: settings[0]?.unboxing ?? null, drawn: !!drawn };
}

// this phone signed up as… (kept on the phone; the database keeps the proof)
const MINE = `spindown.santa.${EXCHANGE}`;
export const mySignup = () => {
  try {
    return localStorage.getItem(MINE);
  } catch {
    return null;
  }
};

/** This phone belongs to the host (by its sign-up, else the name it remembers). */
export const amHost = () => (mySignup() ?? playerName()).trim().toLowerCase() === HOST.toLowerCase();

/** 'Thursday, November 19' */
export const closesOn = () => new Date(`${SIGNUPS_CLOSE}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export async function signUp(s: Signup) {
  try {
    await cloud('rest/v1/santa_signups', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({ exchange: EXCHANGE, player_key: playerKey(), ...s }),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m.includes('409')) throw new Error(`${s.name}'s already in, or this phone already signed someone up.`);
    throw e;
  }
  try {
    localStorage.setItem(MINE, s.name);
  } catch {
    /* private mode */
  }
  notify('santa-signup'); // tells the host who joined
}

/** Host only (the app hides the button from everyone else). */
export async function drawNames() {
  await cloud('rest/v1/rpc/santa_draw', { method: 'POST', body: JSON.stringify({ p_exchange: EXCHANGE }) });
  notify('santa-drawn');
}

export async function myMatch(): Promise<Signup | null> {
  const rows = await cloud('rest/v1/rpc/santa_my_match', {
    method: 'POST',
    body: JSON.stringify({ p_exchange: EXCHANGE, p_key: playerKey() }),
  }).then(json);
  return rows[0] ?? null;
}

export async function setUnboxing(date: string | null) {
  await cloud(`rest/v1/santa_settings?${ex}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ unboxing: date }) });
  if (date) notify('santa-date');
}

/** Tell the notify function something happened; it decides whether and what to send. */
export function notify(kind: string) {
  cloud('functions/v1/notify', { method: 'POST', body: JSON.stringify({ kind, exchange: EXCHANGE }) }).catch(() => {});
}

/** 'YYYY-MM-DD' for today on this phone. */
export const today = (d = new Date()) => d.toLocaleDateString('en-CA');
export const signupsOpen = (now = today()) => now <= SIGNUPS_CLOSE;
export const isUnboxed = (unboxing: string | null, now = today()) => !!unboxing && now >= unboxing;

/** Wins from games tagged with the league, for everyone in the exchange (zeros included). */
export function standings(games: GameRecord[], names: string[]) {
  const wins = new Map(names.map((n) => [n.toLowerCase(), 0]));
  for (const g of games) {
    const w = g.winnerName?.trim().toLowerCase();
    if (g.config.league === LEAGUE && w && wins.has(w)) wins.set(w, wins.get(w)! + 1);
  }
  return names.map((name) => ({ name, wins: wins.get(name.toLowerCase())! })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}

/** Home shows the tile through the season: Nov to Feb. */
export const santaSeason = (d = new Date()) => d.getMonth() >= 10 || d.getMonth() <= 1;
