import type { GameRecord, Mana, OutCause, PlayerResult } from './types';
import { MANA } from './types';

export interface Filters {
  format: 'all' | GameRecord['format'];
  players: 'all' | number;
  days: 'all' | 30 | 90 | 365;
  player: 'all' | string;
}

export function applyFilters(games: GameRecord[], f: Filters): GameRecord[] {
  const since = f.days === 'all' ? 0 : Date.now() - f.days * 86400000;
  return games.filter(
    (g) =>
      (f.format === 'all' || g.format === f.format) &&
      (f.players === 'all' || g.playerCount === f.players) &&
      g.startedAt >= since &&
      (f.player === 'all' || g.players.some((p) => p.name === f.player)),
  );
}

/** 1 = winner, then by who lasted longest */
export function places(g: GameRecord): Map<number, number> {
  const outOrder = g.events.filter((e) => e.kind === 'out').map((e) => e.seat);
  // a player taken back and knocked out again counts at their last knockout
  const lastOut = new Map<number, number>();
  outOrder.forEach((s, i) => lastOut.set(s, i));
  const ranked = [...g.players].sort((a, b) => {
    if (a.result === 'win') return -1;
    if (b.result === 'win') return 1;
    return (lastOut.get(b.seat) ?? 1e9) - (lastOut.get(a.seat) ?? 1e9);
  });
  return new Map(ranked.map((p, i) => [p.seat, i + 1]));
}

export interface Row {
  key: string;
  label: string;
  games: number;
  wins: number;
  rate: number;
  extra?: Record<string, number | string>;
  colors?: Mana[];
}

const finish = (m: Map<string, Row>) =>
  [...m.values()]
    .map((r) => ({ ...r, rate: r.games ? r.wins / r.games : 0 }))
    .sort((a, b) => b.wins - a.wins || b.rate - a.rate || b.games - a.games);

function tally(
  games: GameRecord[],
  keyOf: (p: PlayerResult, g: GameRecord) => string | string[] | null,
  labelOf: (k: string, p: PlayerResult) => string = (k) => k,
  only?: (p: PlayerResult) => boolean,
) {
  const m = new Map<string, Row>();
  for (const g of games)
    for (const p of g.players) {
      if (only && !only(p)) continue;
      const ks = keyOf(p, g);
      if (ks == null) continue;
      for (const k of Array.isArray(ks) ? ks : [ks]) {
        const r = m.get(k) ?? { key: k, label: labelOf(k, p), games: 0, wins: 0, rate: 0, colors: p.colors };
        r.games++;
        if (p.result === 'win') r.wins++;
        m.set(k, r);
      }
    }
  return m;
}

export function summary(games: GameRecord[]) {
  const n = games.length;
  const avg = (f: (g: GameRecord) => number) => (n ? games.reduce((a, g) => a + f(g), 0) / n : 0);
  return {
    games: n,
    avgRounds: avg((g) => g.rounds),
    avgMinutes: avg((g) => g.durationMin),
    draws: games.filter((g) => !g.winnerName).length,
  };
}

export function byPlayer(games: GameRecord[]): Row[] {
  const m = tally(games, (p) => p.name);
  // average finishing place and misplays
  for (const g of games) {
    const pl = places(g);
    for (const p of g.players) {
      const r = m.get(p.name)!;
      const e = (r.extra ??= { placeSum: 0, misplays: 0 });
      e.placeSum = (e.placeSum as number) + (pl.get(p.seat) ?? g.playerCount);
      e.misplays = (e.misplays as number) + (p.finalExtra ?? 0);
    }
  }
  return finish(m).map((r) => ({
    ...r,
    extra: { avgPlace: (r.extra!.placeSum as number) / r.games, misplays: r.extra!.misplays as number },
  }));
}

export function byDeck(games: GameRecord[]): Row[] {
  const m = tally(
    games,
    (p) => (p.commander ? [p.commander, p.partner].filter(Boolean).join(' + ') : p.deckName || null),
  );
  const pilots = new Map<string, Set<string>>();
  for (const g of games)
    for (const p of g.players) {
      const k = p.commander ? [p.commander, p.partner].filter(Boolean).join(' + ') : p.deckName;
      if (!k) continue;
      const s = pilots.get(k) ?? new Set();
      s.add(p.name);
      pilots.set(k, s);
    }
  return finish(m).map((r) => ({ ...r, extra: { pilots: [...(pilots.get(r.key) ?? [])].join(', ') } }));
}

export function byTurnOrder(games: GameRecord[]): Row[] {
  const m = tally(games, (p) => String(p.turnOrder), (k) => ordinal(Number(k)));
  return [...finish(m)].sort((a, b) => Number(a.key) - Number(b.key));
}

export function byColor(games: GameRecord[]): Row[] {
  const name: Record<Mana, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
  const m = tally(
    games,
    (p) => (p.colors.length ? p.colors : ['C']),
    (k) => name[k as Mana] ?? 'Colorless',
  );
  for (const r of m.values()) r.colors = r.key === 'C' ? [] : [r.key as Mana];
  const order = [...MANA, 'C'];
  return [...finish(m)].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export function byColorCount(games: GameRecord[]): Row[] {
  const label = ['Colorless', 'Mono', 'Two colors', 'Three colors', 'Four colors', 'Five colors'];
  const m = tally(games, (p) => String(p.colors.length), (k) => label[Number(k)]);
  return [...finish(m)].sort((a, b) => Number(a.key) - Number(b.key));
}

export function byBracket(games: GameRecord[]): Row[] {
  const label = ['Precon', '1 Exhibition', '2 Core', '3 Upgraded', '4 Optimized', '5 cEDH'];
  const m = tally(games, (p) => (p.bracket == null ? null : String(p.bracket)), (k) => label[Number(k)]);
  return [...finish(m)].sort((a, b) => Number(a.key) - Number(b.key));
}

export function bySubFormat(games: GameRecord[]): Row[] {
  const m = new Map<string, Row>();
  for (const g of games) {
    const k = g.config.subFormat ?? (g.format === 'commander' ? 'Commander' : g.format);
    const r = m.get(k) ?? { key: k, label: k, games: 0, wins: 0, rate: 0 };
    r.games++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.games - a.games);
}

export const CAUSE_LABEL: Record<OutCause, string> = {
  life: 'Life',
  commander: 'Commander damage',
  poison: 'Poison',
  concede: 'Conceded',
  lose: 'Lost',
  opponentWon: 'Opponent won',
  other: 'Other',
};

export function outCauses(games: GameRecord[]) {
  const c = new Map<string, number>();
  for (const g of games) for (const p of g.players) if (p.outCause) c.set(p.outCause, (c.get(p.outCause) ?? 0) + 1);
  return [...c.entries()].map(([k, n]) => ({ key: k, label: CAUSE_LABEL[k as OutCause] ?? k, n })).sort((a, b) => b.n - a.n);
}

export function fastestWins(games: GameRecord[], n = 5) {
  return games
    .filter((g) => g.winnerName)
    .map((g) => ({ g, w: g.players.find((p) => p.result === 'win')! }))
    .sort((a, b) => a.g.rounds - b.g.rounds || a.g.durationMin - b.g.durationMin)
    .slice(0, n);
}

/** who knocks out whom: wins over each opponent in games both played */
export function headToHead(games: GameRecord[], a: string, b: string) {
  let together = 0;
  let aWins = 0;
  let bWins = 0;
  let aAhead = 0;
  for (const g of games) {
    const pa = g.players.find((p) => p.name === a);
    const pb = g.players.find((p) => p.name === b);
    if (!pa || !pb) continue;
    together++;
    if (pa.result === 'win') aWins++;
    if (pb.result === 'win') bWins++;
    const pl = places(g);
    if ((pl.get(pa.seat) ?? 99) < (pl.get(pb.seat) ?? 99)) aAhead++;
  }
  return { together, aWins, bWins, aAhead };
}

export const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10]}`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
