import Dexie, { type EntityTable } from 'dexie';
import type { GameRecord } from './types';

export const db = new Dexie('spindown') as Dexie & {
  games: EntityTable<GameRecord, 'id'>;
};

db.version(1).stores({
  games: 'id, startedAt, format, winnerName, synced',
});

export async function exportAll(): Promise<string> {
  const games = await db.games.orderBy('startedAt').toArray();
  return JSON.stringify({ app: 'spindown', version: 1, exportedAt: Date.now(), games }, null, 2);
}

/** Games from an export or nightly backup; throws before anything is saved if any are damaged. */
export function parseBackup(json: string): GameRecord[] {
  const data = JSON.parse(json);
  const rows: unknown = Array.isArray(data) ? data : data?.games;
  if (!Array.isArray(rows)) throw new Error('That file has no games in it.');
  // the nightly backup's tables.json holds raw cloud rows ({ id, data, deleted }); unwrap them
  const games = rows.flatMap((x) => (x?.data && !x.players ? (x.deleted ? [] : [x.data]) : [x]));
  const bad = games.filter((g) => typeof g?.id !== 'string' || typeof g.startedAt !== 'number' || !Array.isArray(g.players));
  if (bad.length) throw new Error(`${bad.length} of these aren't Spindown games, so nothing was imported.`);
  return games;
}

export async function importAll(json: string): Promise<number> {
  const games = parseBackup(json);
  // imported games upload on the next sync
  await db.games.bulkPut(games.map((g) => ({ ...g, synced: 0 as const })));
  return games.length;
}
