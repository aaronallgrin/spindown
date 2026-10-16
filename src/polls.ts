import { decodeInvite, encodeInvite, getSync, type SyncConfig } from './sync';

/**
 * Find a game: availability polls kept in Supabase (see supabase/polls.sql).
 * Players have no accounts. Each phone gets a random key plus the name its owner types,
 * and a poll's share link carries the group's Supabase URL and anon key so a friend's
 * phone can answer without setting up cloud sync.
 */

export interface Scheduled {
  date: string; // YYYY-MM-DD
  hour: number; // start hour, 0-23
  players: string[];
}

export interface Poll {
  id: string;
  title: string;
  format: string;
  brackets: number[];
  needed: number;
  length_h: number;
  start_h: number;
  end_h: number;
  days: string[];
  tz: string;
  location: string;
  notes: string;
  host_key: string;
  host_name: string;
  scheduled: Scheduled | null;
  created_at?: string;
}

export interface PollResponse {
  poll_id: string;
  player_key: string;
  name: string;
  slots: string[]; // 'YYYY-MM-DD|hour'
}

export type NewPoll = Omit<Poll, 'id' | 'created_at' | 'scheduled' | 'host_key' | 'host_name' | 'tz'>;

// ---------- who am I on this phone ----------

const KEY = 'spindown.playerKey';
const NAME = 'spindown.playerName';
const POLL_CFG = 'spindown.pollsCfg';

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

export function playerKey() {
  let k = read(KEY);
  if (!k) {
    k = crypto.randomUUID();
    write(KEY, k);
  }
  return k;
}
export const playerName = () => read(NAME) ?? '';
export const setPlayerName = (n: string) => write(NAME, n.trim().slice(0, 24));

// ---------- connection ----------

/** Cloud sync's connection if this phone has one, otherwise one saved from a poll link. */
export function pollsCfg(): SyncConfig | null {
  const s = getSync();
  if (s) return s;
  try {
    return JSON.parse(read(POLL_CFG) || 'null');
  } catch {
    return null;
  }
}

/** Save the connection from a poll link. Returns false if the code is damaged. */
export function acceptPollCode(code: string) {
  const c = decodeInvite(code);
  if (!c) return false;
  if (!getSync()) write(POLL_CFG, JSON.stringify(c));
  return true;
}

export function shareLink(pollId: string) {
  const c = pollsCfg();
  const q = c ? `?c=${encodeInvite(c)}` : '';
  return `${location.origin}${location.pathname}#/poll/${pollId}${q}`;
}

// ---------- REST ----------

class PollError extends Error {}

async function rest<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const c = pollsCfg();
  if (!c) throw new PollError('This phone isn’t connected to your group yet.');
  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    'Content-Type': 'application/json',
  };
  if (init.prefer) headers.Prefer = init.prefer;
  let r: Response;
  try {
    r = await fetch(`${c.url.replace(/\/+$/, '')}/rest/v1/${path}`, { ...init, headers });
  } catch {
    throw new PollError('Can’t reach the group right now. Check you’re online.');
  }
  if (!r.ok) {
    const body = await r.text();
    if (r.status === 404 || body.includes('does not exist') || body.includes('schema cache'))
      throw new PollError('The poll tables are missing. Run supabase/polls.sql in your Supabase project.');
    throw new PollError(`Supabase answered ${r.status}: ${body.slice(0, 140)}`);
  }
  if (r.status === 204 || init.prefer?.includes('return=minimal')) return undefined as T;
  return r.json();
}

export async function listPolls(): Promise<{ polls: Poll[]; counts: Record<string, number> }> {
  const polls = await rest<Poll[]>('polls?select=*&order=created_at.desc&limit=60');
  const today = isoDay(new Date());
  const live = polls.filter((p) => (p.scheduled ? p.scheduled.date >= today : [...p.days].sort().at(-1)! >= today));
  const counts: Record<string, number> = {};
  if (live.length) {
    const ids = live.map((p) => `"${p.id}"`).join(',');
    const rows = await rest<{ poll_id: string }[]>(`poll_responses?select=poll_id&poll_id=in.(${ids})`);
    for (const r of rows) counts[r.poll_id] = (counts[r.poll_id] ?? 0) + 1;
  }
  return { polls: live, counts };
}

export async function getPoll(id: string): Promise<{ poll: Poll | null; responses: PollResponse[] }> {
  const enc = encodeURIComponent(id);
  const [polls, responses] = await Promise.all([
    rest<Poll[]>(`polls?select=*&id=eq.${enc}`),
    rest<PollResponse[]>(`poll_responses?select=poll_id,player_key,name,slots&poll_id=eq.${enc}&order=updated_at.asc`),
  ]);
  return { poll: polls[0] ?? null, responses };
}

export async function createPoll(p: NewPoll): Promise<string> {
  const id = crypto.randomUUID().slice(0, 8);
  const row: Poll = {
    ...p,
    id,
    days: [...p.days].sort(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    host_key: playerKey(),
    host_name: playerName() || 'Host',
    scheduled: null,
  };
  await rest('polls', { method: 'POST', body: JSON.stringify(row), prefer: 'return=minimal' });
  return id;
}

export async function saveResponse(pollId: string, slots: string[]) {
  const row = {
    poll_id: pollId,
    player_key: playerKey(),
    name: playerName() || 'Player',
    slots: [...slots].sort(),
    updated_at: new Date().toISOString(),
  };
  await rest('poll_responses?on_conflict=poll_id,player_key', {
    method: 'POST',
    body: JSON.stringify(row),
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

export async function setScheduled(pollId: string, scheduled: Scheduled | null) {
  await rest(`polls?id=eq.${encodeURIComponent(pollId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduled, updated_at: new Date().toISOString() }),
    prefer: 'return=minimal',
  });
}

export async function deletePoll(pollId: string) {
  await rest(`polls?id=eq.${encodeURIComponent(pollId)}`, { method: 'DELETE', prefer: 'return=minimal' });
}

// ---------- dates ----------

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const dowShort = (s: string) => DOW[parseDay(s).getDay()];
export const dayShort = (s: string) => {
  const d = parseDay(s);
  return `${DOW[d.getDay()]} ${d.getDate()}`;
};
export const dayLong = (s: string) => {
  const d = parseDay(s);
  return `${DOW_LONG[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
};
/** 19 -> "7p", 24 -> "12a" */
export const hourShort = (h: number) => `${((h + 11) % 12) + 1}${h % 24 < 12 ? 'a' : 'p'}`;
/** 19 -> "7:00 PM" */
export const hourLong = (h: number) => `${((h + 11) % 12) + 1}:00 ${h % 24 < 12 ? 'AM' : 'PM'}`;

export const pollRange = (p: Pick<Poll, 'days'>) => {
  const d = [...p.days].sort();
  return d.length === 1 ? dayShort(d[0]) : `${dayShort(d[0])} – ${dayShort(d[d.length - 1])}`;
};

// ---------- best times ----------

export interface Window {
  day: string;
  hour: number;
  free: string[]; // player keys free for the whole game
}

/** The top windows where the whole game fits, most players first, earliest breaking ties. */
export function bestTimes(p: Pick<Poll, 'days' | 'start_h' | 'end_h' | 'length_h'>, responses: Pick<PollResponse, 'player_key' | 'slots'>[], top = 3): Window[] {
  const sets = responses.map((r) => ({ key: r.player_key, set: new Set(r.slots) }));
  const all: Window[] = [];
  for (const day of [...p.days].sort()) {
    for (let h = p.start_h; h + p.length_h <= p.end_h; h++) {
      const free = sets
        .filter(({ set }) => {
          for (let k = 0; k < p.length_h; k++) if (!set.has(`${day}|${h + k}`)) return false;
          return true;
        })
        .map((s) => s.key);
      if (free.length) all.push({ day, hour: h, free });
    }
  }
  all.sort((a, b) => b.free.length - a.free.length || a.day.localeCompare(b.day) || a.hour - b.hour);
  // overlapping starts on one day with the same group are the same option; keep the earliest
  const kept: Window[] = [];
  for (const w of all) {
    const same = kept.some(
      (k) => k.day === w.day && Math.abs(k.hour - w.hour) < p.length_h && k.free.length === w.free.length && k.free.every((x) => w.free.includes(x)),
    );
    if (same) continue;
    kept.push(w);
    if (kept.length === top) break;
  }
  return kept;
}

// ---------- calendar ----------

export interface CalEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  details: string;
  location: string;
  tz: string;
}

export const BRACKET_LABEL = (n: number) => (n === 0 ? 'P' : String(n));

export function eventFor(p: Poll): CalEvent | null {
  const s = p.scheduled;
  if (!s) return null;
  const d = parseDay(s.date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.hour);
  const end = new Date(start.getTime() + p.length_h * 3600e3);
  const fmt = p.format === 'Commander' && p.brackets.length ? `Commander, bracket ${p.brackets.map(BRACKET_LABEL).join(', ')}` : p.format;
  const details = [fmt, s.players.length ? `Players: ${s.players.join(', ')}` : '', p.notes, 'Scheduled with Spindown'].filter(Boolean).join('\n');
  return { uid: `${p.id}-${s.date}-${s.hour}@spindown`, title: `MTG: ${p.title}`, start, end, details, location: p.location, tz: p.tz };
}

const stampLocal = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const stampUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Google Calendar's "add event" page. Opens the Calendar app on Android. */
export function googleCalUrl(e: CalEvent) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stampLocal(e.start)}/${stampLocal(e.end)}`,
    ctz: e.tz,
    details: e.details,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** An .ics file. iPhone opens it straight into "Add to Calendar". */
export function icsText(e: CalEvent) {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Spindown//Find a Game//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stampUtc(new Date())}`,
    `DTSTART;TZID=${e.tz}:${stampLocal(e.start)}`,
    `DTEND;TZID=${e.tz}:${stampLocal(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `DESCRIPTION:${esc(e.details)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Game night in 2 hours',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export const icsHref = (e: CalEvent) => `data:text/calendar;charset=utf-8,${encodeURIComponent(icsText(e))}`;

export const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
