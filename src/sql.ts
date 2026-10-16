import type { Database, SqlJsStatic } from 'sql.js';
import type { GameRecord } from './types';
import { IDENTITY_NAMES, identityKey, places } from './stats';
import { roundSeconds, trophies } from './eggs';

let SQL: Promise<SqlJsStatic> | null = null;

async function engine() {
  SQL ??= (async () => {
    const [{ default: init }, { default: wasmUrl }] = await Promise.all([
      import('sql.js/dist/sql-wasm-browser.js'),
      import('sql.js/dist/sql-wasm-browser.wasm?url'),
    ]);
    return init({ locateFile: () => wasmUrl });
  })();
  return SQL;
}

export const SCHEMA = `games(id, date, format, sub_format, players, rounds, minutes, winner)
players(game_id, date, format, sub_format, name, seat, turn_order, place, result, won,
        commander, partner, deck, theme, colors, identity, color_count, bracket,
        out_round, out_cause, final_life, poison, cmdr_damage_taken, misplays)
events(game_id, at, round, player, kind, delta, from_player, cause)
rounds(game_id, date, players, round, seconds)
trophies(game_id, date, trophy, player)`;

const day = (ms: number) => new Date(ms).toLocaleDateString('en-CA');

/** Build an in-memory database of every saved game. */
export async function buildDb(games: GameRecord[]): Promise<Database> {
  const S = await engine();
  const d = new S.Database();
  d.run(`
    CREATE TABLE games(id TEXT PRIMARY KEY, date TEXT, format TEXT, sub_format TEXT, players INT, rounds INT, minutes INT, winner TEXT);
    CREATE TABLE players(game_id TEXT, date TEXT, format TEXT, sub_format TEXT, name TEXT, seat INT, turn_order INT, place INT,
      result TEXT, won INT, commander TEXT, partner TEXT, deck TEXT, theme TEXT, colors TEXT, identity TEXT, color_count INT, bracket TEXT,
      out_round INT, out_cause TEXT, final_life INT, poison INT, cmdr_damage_taken INT, misplays INT);
    CREATE TABLE events(game_id TEXT, at TEXT, round INT, player TEXT, kind TEXT, delta INT, from_player TEXT, cause TEXT);
    CREATE TABLE rounds(game_id TEXT, date TEXT, players INT, round INT, seconds INT);
    CREATE TABLE trophies(game_id TEXT, date TEXT, trophy TEXT, player TEXT);
  `);
  const ri = d.prepare('INSERT INTO rounds VALUES (?,?,?,?,?)');
  const ti = d.prepare('INSERT INTO trophies VALUES (?,?,?,?)');
  const gi = d.prepare('INSERT INTO games VALUES (?,?,?,?,?,?,?,?)');
  const pi = d.prepare('INSERT INTO players VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const ei = d.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?)');
  d.run('BEGIN');
  for (const g of games) {
    const sub = g.config.subFormat ?? (g.format === 'commander' ? 'Commander' : null);
    gi.run([g.id, day(g.startedAt), g.format, sub, g.playerCount, g.rounds || null, g.imported ? null : g.durationMin, g.winnerName]);
    const pl = places(g);
    const nameOf = (seat?: number) => (seat == null || seat < 0 ? null : g.players.find((p) => p.seat === seat)?.name ?? null);
    for (const p of g.players)
      pi.run([
        g.id,
        day(g.startedAt),
        g.format,
        sub,
        p.name,
        p.seat + 1,
        p.turnOrder || null,
        pl.get(p.seat) ?? null,
        p.result,
        p.result === 'win' ? 1 : 0,
        p.commander ?? null,
        p.partner ?? null,
        p.deckName ?? null,
        p.theme ?? null,
        p.colors.join(''),
        IDENTITY_NAMES[identityKey(p.colors)] ?? null,
        p.colors.length,
        p.bracket == null ? null : p.bracket === 0 ? 'P' : String(p.bracket),
        p.outRound ?? null,
        p.outCause ?? null,
        p.finalLife,
        p.finalPoison,
        p.cmdrDamageTaken,
        p.finalExtra ?? 0,
      ]);
    roundSeconds(g).forEach((s, i) => ri.run([g.id, day(g.startedAt), g.playerCount, i + 1, s]));
    for (const t of trophies(g)) ti.run([g.id, day(g.startedAt), t.title, t.name ?? null]);
    for (const e of g.events)
      ei.run([g.id, new Date(e.at).toISOString(), e.round, nameOf(e.seat), e.kind, e.delta ?? null, nameOf(e.from), e.cause ?? null]);
  }
  d.run('COMMIT');
  gi.free();
  pi.free();
  ei.free();
  ri.free();
  ti.free();
  return d;
}

export const EXAMPLES: { name: string; sql: string }[] = [
  {
    name: 'Who wins the most?',
    sql: `SELECT name, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct
FROM players
GROUP BY name
ORDER BY wins DESC;`,
  },
  {
    name: 'Which commanders win most? (3+ games)',
    sql: `SELECT commander, partner, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct
FROM players
WHERE commander IS NOT NULL
GROUP BY commander, partner
HAVING COUNT(*) >= 3
ORDER BY win_pct DESC;`,
  },
  {
    name: 'Does going first matter?',
    sql: `SELECT turn_order, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct
FROM players
GROUP BY turn_order
ORDER BY turn_order;`,
  },
  {
    name: 'Who deals the most commander damage?',
    sql: `SELECT from_player, SUM(delta) AS commander_damage
FROM events
WHERE kind = 'cmdr' AND delta > 0
GROUP BY from_player
ORDER BY commander_damage DESC;`,
  },
  {
    name: 'Who has the most *?',
    sql: `SELECT name, SUM(misplays) AS total, ROUND(AVG(misplays), 2) AS per_game
FROM players
GROUP BY name
ORDER BY total DESC;`,
  },
  {
    name: 'How does each bracket do?',
    sql: `SELECT bracket, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct
FROM players
WHERE bracket IS NOT NULL
GROUP BY bracket
ORDER BY bracket;`,
  },
  {
    name: 'How many games each month?',
    sql: `SELECT substr(date, 1, 7) AS month, COUNT(*) AS games,
  ROUND(AVG(rounds), 1) AS avg_rounds, ROUND(AVG(minutes)) AS avg_minutes
FROM games
GROUP BY month
ORDER BY month DESC;`,
  },
  {
    name: 'How long does each round take?',
    sql: `SELECT round, COUNT(*) AS games, ROUND(AVG(seconds) / 60.0, 1) AS avg_minutes,
  ROUND(MAX(seconds) / 60.0, 1) AS longest_minutes
FROM rounds
GROUP BY round
ORDER BY round;`,
  },
  {
    name: 'Who has which trophies?',
    sql: `SELECT player, trophy, COUNT(*) AS times
FROM trophies
GROUP BY player, trophy
ORDER BY times DESC;`,
  },
  {
    name: 'Biggest single life swings?',
    sql: `SELECT date(at) AS day, player, round, delta
FROM events
WHERE kind = 'life'
ORDER BY ABS(delta) DESC
LIMIT 10;`,
  },
];
