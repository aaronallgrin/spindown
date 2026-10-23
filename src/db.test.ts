import { describe, expect, it, vi } from 'vitest';

vi.mock('dexie', () => ({ default: class { version = () => ({ stores() {} }); } }));
const { parseBackup } = await import('./db');

const game = { id: 'g1', startedAt: 1, players: [] };

describe('parseBackup', () => {
  it('reads an export and a bare list', () => {
    expect(parseBackup(JSON.stringify({ app: 'spindown', games: [game] }))).toEqual([game]);
    expect(parseBackup(JSON.stringify([game]))).toEqual([game]);
  });

  it("unwraps the nightly backup's raw cloud rows and skips deleted ones", () => {
    const rows = [
      { id: 'g1', data: game, deleted: false, updated_at: 'x' },
      { id: 'g2', data: { ...game, id: 'g2' }, deleted: true, updated_at: 'x' },
    ];
    expect(parseBackup(JSON.stringify({ games: rows }))).toEqual([game]);
  });

  it('refuses the whole file if any game is damaged', () => {
    expect(() => parseBackup(JSON.stringify({ games: [game, { id: 'g2' }] }))).toThrow(/1 of these/);
    expect(() => parseBackup(JSON.stringify({ nope: 1 }))).toThrow(/no games/);
    expect(() => parseBackup('null')).toThrow(/no games/);
  });
});
