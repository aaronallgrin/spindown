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

export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json);
  const games: GameRecord[] = Array.isArray(data) ? data : data.games;
  if (!Array.isArray(games)) throw new Error('That file has no games in it.');
  await db.games.bulkPut(games);
  return games.length;
}
