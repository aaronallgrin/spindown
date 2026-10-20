/**
 * Easter eggs. Live ones show as a quiet line on the player's panel once a
 * number has settled; end-of-game ones become trophies on the summary and Stats.
 */
import type { GameRecord } from './types';

export interface Egg {
  id: string;
  text: string;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const ONE_LIFE = [
  { id: 'mostly-dead', text: "See? You're only mostly dead. Mostly dead is slightly alive." },
  { id: 'kaiba', text: 'My deck has no pathetic cards, Kaiba! Draw!' },
];

const VALUES: Record<number, Egg> = {
  11: { id: 'fresh-prince', text: 'Now this is a story all about how my life got flipped-turned upside down.' },
  13: { id: '13', text: 'Unlucky for some.' },
  21: { id: '21', text: "What's 9 + 10?" },
  23: { id: '23', text: "Nobody likes you when you're 23." },
  25: { id: '25', text: 'Something funnier than 24.' },
  33: { id: '33', text: 'The same age as Frodo when he left the Shire. Time for an adventure.' },
  42: { id: '42', text: 'Life, the universe, and everything.' },
  61: { id: '61', text: 'Six swan.' },
  67: { id: '67', text: 'Six seven.' },
  69: { id: '69', text: 'Nice.' },
  173: { id: '173', text: "Don't blink." },
  420: { id: '420', text: 'Blaze it.' },
  666: { id: '666', text: 'The number of the beast.' },
  777: { id: '777', text: 'Jackpot. The slot machine smiles on you.' },
  911: { id: '911', text: "What's your emergency?" },
  1337: { id: '1337', text: '1337 h4x0r.' },
  8281: { id: '8281', text: '82 and 81, back to back. Also 91 squared. A rare square.' },
  80085: { id: '80085', text: 'Calculator humor. Very mature.' },
};

const reverse = (n: number) => Number(String(Math.abs(n)).split('').reverse().join(''));

/**
 * After a player's life settles from `before` to `after`.
 * `highest` is whether they still have the highest life at the table.
 */
export function lifeEgg(before: number, after: number, highest: boolean): Egg | null {
  const d = after - before;
  if (!d) return null;
  if (after >= 10000 && after !== 80085)
    return { id: 'hulk', text: "Caution: Gamma exposure approaching Hulk levels. Don't make it angry." };
  if (before <= 9000 && after > 9000 && after !== 80085) return { id: 'over-9000', text: "IT'S OVER NINE THOUSAAAAAND!" };
  if (VALUES[after] && after !== 11) return VALUES[after];
  if (after === 1) return pick(ONE_LIFE);
  if (before >= 10 && after >= 10 && reverse(before) === after && String(before).length === String(after).length)
    return VALUES[11];
  if (after === 11) return VALUES[11];
  if (d === -21) return { id: 'ouch-21', text: 'Ouch. That smelled like pure lethal Commander damage.' };
  if (before > 0 && before % 2 === 0 && after === before / 2 && before >= 10)
    return { id: 'demon', text: 'Signing a contract with a demon? Bold strategy.' };
  if (d >= 15) return { id: 'sailor-moon', text: 'In the name of the moon, I will punish you! (And heal myself.)' };
  if (d <= -15 && highest) return { id: 'sorrow', text: "I've completely immersed myself in shadow." };
  return null;
}

export function poisonEgg(after: number): Egg | null {
  if (after === 1) return { id: 'all-will-be-one', text: 'All will be one. Mostly just your loss, though.' };
  if (after === 9) return { id: 'curie', text: "You're glowing. Marie Curie would be proud." };
  return null;
}

/** after commander damage from one commander settles */
export function cmdrEgg(before: number, after: number): Egg | null {
  if (after === 21) return { id: 'ouch-21', text: 'Ouch. That smelled like pure lethal Commander damage.' };
  if (after - before === 6)
    return {
      id: 'dreadmaw',
      text: 'If you feel the ground quake, run. If you hear its bellow, flee. If you see its teeth, it’s too late.',
    };
  return null;
}

/** Just for Tim: he wins without picking up a single * (misplay) counter. */
export const TIM_CLEAN: Egg = { id: 'tim-clean', text: 'A win with no asterisks.' };
export const timCleanWin = (name: string | undefined, stars: number | undefined) =>
  name?.trim().toLowerCase() === 'tim' && !stars;

export const ZENKAI: Egg = { id: 'zenkai', text: "Saiyan DNA activated. What doesn't kill you makes you stronger." };
export const HATCH: Egg = { id: 'hatch', text: 'Execute DHARMA Protocol: Reset the timer or face the anomaly.' };

const SHAME = [
  'Shame.',
  'Shame. Shame. Shame.',
  'Noted. Forever.',
  'The table will remember this.',
  'Your deck is embarrassed for you.',
  "We're not mad. Just disappointed.",
  'Bold. Wrong, but bold.',
  'Somewhere, a judge sighed.',
];
export const shame = () => pick(SHAME);

// ---------------- trophies (worked out from a saved game) ----------------

export interface Trophy {
  id: string;
  title: string;
  text: string;
  /** -1 for the whole table */
  seat: number;
  name?: string;
}

/** `how` must match the rules in trophies() below. */
export const TROPHY_INFO: Record<string, { title: string; text: string; how: string; table?: boolean }> = {
  'black-lotus': { title: 'Black Lotus', text: 'Did you just sell a Black Lotus to fund this turn?', how: 'Win the game in round 2 or earlier.' },
  blockbuster: { title: 'Blockbuster late fee', text: 'Be Kind, Rewind. You owe the table $3.50 in late fees for this match.', how: 'The game runs past round 20 or longer than 2 hours.', table: true },
  nokia: { title: 'Nokia 3310', text: "Indestructible. You took a beating and didn't crack.", how: 'Win after taking more separate hits than anyone else, at least 5 (ties count).' },
  napster: { title: 'Napster', text: 'Illegal Downloading: 99% Complete. You downloaded a whole second life total.', how: 'Drop below 5 life, then climb 10 or more above your low. Biggest comeback of the game gets it.' },
  participation: { title: 'Participation trophy', text: "You tried your best, and that's what matters.", how: 'First player knocked out, in a game of 3 or more.' },
  matrix: { title: 'The One', text: 'Stayed at 1 life for more than 3 turns and survived. He is the One.', how: 'Sit at exactly 1 life when 4 or more rounds tick over, and don\'t lose.' },
  hulk: { title: 'Hulk mode', text: "Caution: Gamma exposure approaching Hulk levels. Don't make it angry.", how: 'Anyone hits 10,000 life. Goes to whoever ends with the most life.' },
  hatch: { title: 'The Hatch', text: 'Execute DHARMA Protocol: Reset the timer or face the anomaly.', how: 'The game reaches round 108.', table: true },
};

/** Replay a saved game's events to recover each player's life over time. */
function replay(g: GameRecord) {
  const life = new Map(g.players.map((p) => [p.seat, g.startingLife]));
  const low = new Map<number, number>(); // lowest life so far, once under 5
  const climb = new Map<number, number>();
  const hits = new Map<number, number>();
  const atOneRounds = new Map<number, number>();
  const out = new Set<number>();
  let peak = 0;
  const loses = g.config.cmdrDamageLosesLife !== false;
  const setLife = (seat: number, v: number) => {
    life.set(seat, v);
    peak = Math.max(peak, v);
    if (v < 5) low.set(seat, Math.min(low.get(seat) ?? v, v));
    const lo = low.get(seat);
    if (lo != null) climb.set(seat, Math.max(climb.get(seat) ?? 0, v - lo));
  };
  for (const e of g.events) {
    if (e.kind === 'life' && e.delta) {
      if (e.delta < 0) hits.set(e.seat, (hits.get(e.seat) ?? 0) + 1);
      setLife(e.seat, (life.get(e.seat) ?? 0) + e.delta);
    } else if (e.kind === 'cmdr' && e.delta) {
      if (e.delta > 0) hits.set(e.seat, (hits.get(e.seat) ?? 0) + 1);
      if (loses) setLife(e.seat, (life.get(e.seat) ?? 0) - e.delta);
    } else if (e.kind === 'turn' && (e.delta ?? 1) > 0) {
      for (const [seat, v] of life) if (v === 1 && !out.has(seat)) atOneRounds.set(seat, (atOneRounds.get(seat) ?? 0) + 1);
    } else if (e.kind === 'out') out.add(e.seat);
    else if (e.kind === 'revive') out.delete(e.seat);
  }
  return { climb, hits, atOneRounds, peak, out };
}

export function trophies(g: GameRecord): Trophy[] {
  const res: Trophy[] = [];
  const add = (id: string, seat: number) => {
    const p = g.players.find((x) => x.seat === seat);
    res.push({ id, seat, name: p?.name, title: TROPHY_INFO[id].title, text: TROPHY_INFO[id].text });
  };
  const winner = g.players.find((p) => p.result === 'win');
  const r = replay(g);

  if (winner && g.rounds > 0 && g.rounds <= 2) add('black-lotus', winner.seat);
  if (g.rounds > 20 || g.durationMin > 120) add('blockbuster', -1);
  if (g.rounds >= 108) add('hatch', -1);

  if (winner) {
    const most = Math.max(0, ...r.hits.values());
    if (most >= 5 && (r.hits.get(winner.seat) ?? 0) === most) add('nokia', winner.seat);
  }
  const best = [...r.climb.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 10) add('napster', best[0]);

  const firstOut = g.events.find((e) => e.kind === 'out' && e.cause !== 'opponentWon');
  if (firstOut && g.playerCount > 2) add('participation', firstOut.seat);

  for (const [seat, n] of r.atOneRounds) {
    const p = g.players.find((x) => x.seat === seat);
    if (n > 3 && p && p.result !== 'loss') add('matrix', seat);
  }
  if (r.peak >= 10000) {
    const top = g.players.reduce((a, b) => (b.finalLife > a.finalLife ? b : a));
    add('hulk', top.seat);
  }
  return res;
}

/** Live easter eggs a game recorded, by player. */
export function eggsFound(g: GameRecord) {
  return g.events
    .filter((e) => e.kind === 'egg' && e.egg)
    .map((e) => ({ id: e.egg!, seat: e.seat, name: g.players.find((p) => p.seat === e.seat)?.name }));
}

/** Seconds spent on each round, from the round-change log. Index 0 = round 1. */
export function roundSeconds(g: Pick<GameRecord, 'events' | 'endedAt'>): number[] {
  const start = g.events.find((e) => e.kind === 'first');
  if (!start) return [];
  const secs: number[] = [];
  let round = 1;
  let t = start.at;
  const close = (until: number) => {
    secs[round - 1] = (secs[round - 1] ?? 0) + Math.max(0, until - t) / 1000;
  };
  for (const e of g.events) {
    if (e.kind !== 'turn' || e.at < t) continue;
    close(e.at);
    round = e.round;
    t = e.at;
  }
  close(g.endedAt);
  return Array.from({ length: secs.length }, (_, i) => Math.round(secs[i] ?? 0));
}

export const fmtSecs = (s: number) => {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
