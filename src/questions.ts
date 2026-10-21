import type { GameRecord } from './types';

/** How an answer is drawn. Columns are named from the query's result. */
export interface ChartSpec {
  kind: 'hbar' | 'vbar' | 'line' | 'table';
  label: string;
  value: string;
  /** shown small beside the value, like "4/11" */
  note?: string;
  format?: 'pct' | 'num' | 'min';
  /** how to write the labels: 1 -> 1st, 2026-02 -> Feb */
  labelFormat?: 'ordinal' | 'month';
}

export interface Question {
  id: string;
  title: string;
  /** extra words that should find it in search */
  keywords: string;
  sql: string;
  chart: ChartSpec;
  /** generated from a player or commander name */
  about?: string;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

const BASE: Question[] = [
  {
    id: 'wins',
    title: 'Who wins the most?',
    keywords: 'player win rate leaderboard best',
    sql: `SELECT name, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct, SUM(won) || '/' || COUNT(*) AS record
FROM players GROUP BY name ORDER BY wins DESC, win_pct DESC;`,
    chart: { kind: 'hbar', label: 'name', value: 'win_pct', note: 'record', format: 'pct' },
  },
  {
    id: 'commanders',
    title: 'Which commanders win most? (3+ games)',
    keywords: 'commander deck best win rate edh',
    sql: `SELECT commander || COALESCE(' + ' || partner, '') AS commander, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct, SUM(won) || '/' || COUNT(*) AS record
FROM players WHERE commander IS NOT NULL
GROUP BY commander, partner HAVING COUNT(*) >= 3 ORDER BY win_pct DESC, games DESC;`,
    chart: { kind: 'hbar', label: 'commander', value: 'win_pct', note: 'record', format: 'pct' },
  },
  {
    id: 'popular',
    title: 'Most played commanders',
    keywords: 'commander popular played often',
    sql: `SELECT commander || COALESCE(' + ' || partner, '') AS commander, COUNT(*) AS games, SUM(won) AS wins
FROM players WHERE commander IS NOT NULL
GROUP BY commander, partner ORDER BY games DESC, wins DESC LIMIT 15;`,
    chart: { kind: 'hbar', label: 'commander', value: 'games', format: 'num' },
  },
  {
    id: 'first',
    title: 'Does going first matter?',
    keywords: 'turn order first second seat position',
    sql: `SELECT turn_order, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct, SUM(won) || '/' || COUNT(*) AS record
FROM players WHERE turn_order IS NOT NULL
GROUP BY turn_order ORDER BY turn_order;`,
    chart: { kind: 'vbar', label: 'turn_order', value: 'win_pct', note: 'record', format: 'pct', labelFormat: 'ordinal' },
  },
  {
    id: 'identity',
    title: 'Which color identities win most?',
    keywords: 'colors color identity boros dimir guild shard wedge mono five',
    sql: `SELECT identity, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct, SUM(won) || '/' || COUNT(*) AS record
FROM players WHERE identity IS NOT NULL
GROUP BY identity ORDER BY wins DESC, win_pct DESC;`,
    chart: { kind: 'hbar', label: 'identity', value: 'win_pct', note: 'record', format: 'pct' },
  },
  {
    id: 'pod',
    title: 'Win rate by pod size',
    keywords: 'players table size 3 4 5 pod',
    sql: `SELECT g.players || ' players' AS pod, p.name, COUNT(*) AS games, SUM(p.won) AS wins,
  ROUND(100.0 * SUM(p.won) / COUNT(*), 1) AS win_pct
FROM players p JOIN games g ON g.id = p.game_id
GROUP BY g.players, p.name HAVING COUNT(*) >= 2 ORDER BY g.players, win_pct DESC;`,
    chart: { kind: 'table', label: 'name', value: 'win_pct' },
  },
  {
    id: 'out-first',
    title: 'Who gets knocked out first most?',
    keywords: 'first out eliminated early loses',
    sql: `SELECT p.name, COUNT(*) AS times
FROM players p JOIN games g ON g.id = p.game_id
WHERE p.place = g.players AND g.players > 2 AND p.result = 'loss'
GROUP BY p.name ORDER BY times DESC;`,
    chart: { kind: 'hbar', label: 'name', value: 'times', format: 'num' },
  },
  {
    id: 'place',
    title: 'Average finishing place',
    keywords: 'place finish rank average',
    sql: `SELECT name, ROUND(AVG(place), 2) AS avg_place, COUNT(*) AS games
FROM players WHERE place IS NOT NULL GROUP BY name HAVING COUNT(*) >= 2 ORDER BY avg_place;`,
    chart: { kind: 'hbar', label: 'name', value: 'avg_place', format: 'num' },
  },
  {
    id: 'cmdr-dmg',
    title: 'Who deals the most commander damage?',
    keywords: 'commander damage voltron hits',
    sql: `SELECT from_player AS player, SUM(delta) AS commander_damage
FROM events WHERE kind = 'cmdr' AND delta > 0 AND from_player IS NOT NULL AND from_player <> player
GROUP BY from_player ORDER BY commander_damage DESC;`,
    chart: { kind: 'hbar', label: 'player', value: 'commander_damage', format: 'num' },
  },
  {
    id: 'star',
    title: 'Who has the most *?',
    keywords: 'misplay asterisk mistakes shame',
    sql: `SELECT name, SUM(misplays) AS total, ROUND(AVG(misplays), 2) AS per_game
FROM players GROUP BY name HAVING SUM(misplays) > 0 ORDER BY total DESC;`,
    chart: { kind: 'hbar', label: 'name', value: 'total', note: 'per_game', format: 'num' },
  },
  {
    id: 'months',
    title: 'How many games each month?',
    keywords: 'month time history games played calendar',
    sql: `SELECT substr(date, 1, 7) AS month, COUNT(*) AS games
FROM games GROUP BY month ORDER BY month;`,
    chart: { kind: 'line', label: 'month', value: 'games', format: 'num', labelFormat: 'month' },
  },
  {
    id: 'game-length',
    title: 'How long are games?',
    keywords: 'length minutes duration time long',
    sql: `SELECT substr(date, 1, 7) AS month, ROUND(AVG(minutes)) AS avg_minutes, ROUND(AVG(rounds), 1) AS avg_rounds
FROM games WHERE minutes IS NOT NULL GROUP BY month ORDER BY month;`,
    chart: { kind: 'line', label: 'month', value: 'avg_minutes', format: 'min', labelFormat: 'month' },
  },
  {
    id: 'rounds',
    title: 'How long does each round take?',
    keywords: 'round turn time minutes speed slow',
    sql: `SELECT round, ROUND(AVG(seconds) / 60.0, 1) AS avg_minutes, COUNT(*) AS games
FROM rounds GROUP BY round ORDER BY round;`,
    chart: { kind: 'vbar', label: 'round', value: 'avg_minutes', format: 'min' },
  },
  {
    id: 'outs',
    title: 'How do players go out?',
    keywords: 'eliminated knocked out poison concede life commander damage',
    sql: `SELECT COALESCE(out_cause, 'not recorded') AS how, COUNT(*) AS times
FROM players WHERE result = 'loss' GROUP BY how ORDER BY times DESC;`,
    chart: { kind: 'hbar', label: 'how', value: 'times', format: 'num' },
  },
  {
    id: 'trophies',
    title: 'Who has which trophies?',
    keywords: 'trophy trophies easter egg achievement',
    sql: `SELECT player, trophy, COUNT(*) AS times FROM trophies GROUP BY player, trophy ORDER BY times DESC;`,
    chart: { kind: 'table', label: 'player', value: 'times' },
  },
  {
    id: 'swings',
    title: 'Biggest single life swings',
    keywords: 'life swing big gain loss damage',
    sql: `SELECT date(at) AS day, player, round, delta FROM events
WHERE kind = 'life' ORDER BY ABS(delta) DESC LIMIT 10;`,
    chart: { kind: 'table', label: 'player', value: 'delta' },
  },
];

/** Questions about one player. */
function playerQuestions(name: string): Question[] {
  const n = q(name);
  return [
    {
      id: `p-cmd-${name}`,
      about: name,
      title: `${name}: how each commander does`,
      keywords: '',
      sql: `SELECT COALESCE(commander || COALESCE(' + ' || partner, ''), deck, 'Unknown') AS played, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct, SUM(won) || '/' || COUNT(*) AS record
FROM players WHERE name = ${n} GROUP BY 1 ORDER BY wins DESC, games DESC;`,
      chart: { kind: 'hbar', label: 'played', value: 'win_pct', note: 'record', format: 'pct' },
    },
    {
      id: `p-month-${name}`,
      about: name,
      title: `${name}: win rate by month`,
      keywords: '',
      sql: `SELECT substr(date, 1, 7) AS month, ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct, COUNT(*) AS games
FROM players WHERE name = ${n} GROUP BY month ORDER BY month;`,
      chart: { kind: 'line', label: 'month', value: 'win_pct', format: 'pct', labelFormat: 'month' },
    },
    {
      id: `p-vs-${name}`,
      about: name,
      title: `Who does ${name} beat?`,
      keywords: '',
      sql: `SELECT o.name AS opponent, COUNT(*) AS games_together, SUM(me.won) AS wins,
  ROUND(100.0 * SUM(me.won) / COUNT(*), 1) AS win_pct, SUM(me.won) || '/' || COUNT(*) AS record
FROM players me JOIN players o ON o.game_id = me.game_id AND o.name <> me.name
WHERE me.name = ${n} GROUP BY o.name ORDER BY win_pct DESC, games_together DESC;`,
      chart: { kind: 'hbar', label: 'opponent', value: 'win_pct', note: 'record', format: 'pct' },
    },
  ];
}

/** Questions about one commander. */
function commanderQuestions(cmd: string): Question[] {
  const c = q(cmd);
  return [
    {
      id: `c-${cmd}`,
      about: cmd,
      title: `${cmd}: who plays it and how it does`,
      keywords: '',
      sql: `SELECT name AS pilot, COUNT(*) AS games, SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct, SUM(won) || '/' || COUNT(*) AS record
FROM players WHERE commander = ${c} OR partner = ${c} GROUP BY name ORDER BY wins DESC, games DESC;`,
      chart: { kind: 'hbar', label: 'pilot', value: 'win_pct', note: 'record', format: 'pct' },
    },
  ];
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Questions matching the search text, including ones made for named players and commanders. */
export function findQuestions(text: string, games: GameRecord[]): Question[] {
  const t = norm(text.trim());
  if (!t) return BASE;
  const words = t.split(/\s+/).filter((w) => w.length > 1);
  const names = [...new Set(games.flatMap((g) => g.players.map((p) => p.name)))];
  const cmds = [...new Set(games.flatMap((g) => g.players.flatMap((p) => [p.commander, p.partner]).filter(Boolean) as string[]))];
  // a word that names a player only finds that player's questions ("tim" is not "time")
  const playerWords = new Set(words.filter((w) => names.some((n) => norm(n).split(/\s+/).some((part) => part.startsWith(w)))));
  const topicWords = words.filter((w) => !playerWords.has(w));
  const hit = (s: string) => topicWords.some((w) => norm(s).split(/[^a-z0-9*]+/).some((part) => part.startsWith(w)));
  const out: Question[] = [];
  for (const n of names) if ([...playerWords].some((w) => norm(n).split(/\s+/).some((part) => part.startsWith(w)))) out.push(...playerQuestions(n));
  for (const c of cmds) if (words.some((w) => w.length > 2 && norm(c).includes(w))) out.push(...commanderQuestions(c));
  for (const b of BASE) if (hit(b.title) || hit(b.keywords)) out.push(b);
  return out.slice(0, 30);
}

export const SUGGESTIONS = ['first', 'commander', 'colors', 'month', 'trophies'];
