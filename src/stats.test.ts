import { describe, expect, it } from 'vitest';
import { makeConfig, newGame, reduce, toRecord, type Action } from './game';
import { byPlayer, grudges } from './stats';

const NAMES = ['Aaron', 'Tim', 'Chris', 'Cody'];
function game(...as: Action[]) {
  const c = makeConfig('commander', undefined, 4, 'p4-sides');
  c.players = c.players.map((p, i) => ({ ...p, name: NAMES[i] }));
  let g = newGame(c);
  g = reduce(reduce(g, { t: 'pick', seat: 0 }), { t: 'pick', seat: 0 });
  return toRecord(as.reduce(reduce, g));
}

describe('grudges', () => {
  it('counts commander damage by source, nets out fixes, skips your own commander and plain life loss', () => {
    const g = game(
      { t: 'cmdr', seat: 0, from: 1, partner: 0, d: 5 },
      { t: 'cmdr', seat: 0, from: 1, partner: 0, d: 4 },
      { t: 'cmdr', seat: 2, from: 1, partner: 0, d: 3 },
      { t: 'round', d: 1 },
      { t: 'cmdr', seat: 2, from: 1, partner: 0, d: -1 },
      { t: 'cmdr', seat: 1, from: 1, partner: 0, d: 2 },
      { t: 'life', seat: 3, d: -6 },
    );
    const { dmg, aggressive } = grudges([g, game()]);
    expect(dmg.get('Tim')?.get('Aaron')).toBe(9);
    expect(dmg.get('Tim')?.get('Chris')).toBe(2);
    expect(dmg.get('Tim')?.has('Tim')).toBe(false);
    expect(dmg.get('Tim')?.has('Cody')).toBe(false);
    // the second game had no commander damage, so it doesn't count toward the average
    expect(aggressive[0]).toMatchObject({ name: 'Tim', games: 1, total: 11, avg: 11, fav: 'Aaron' });
  });
});

describe('misplays', () => {
  it('counts the * rate only over games that tracked it', () => {
    const tracked = game({ t: 'extra', seat: 0, d: 1 }, { t: 'extra', seat: 0, d: 1 });
    const untracked = { ...game(), players: game().players.map((p) => ({ ...p, finalExtra: undefined })) };
    const aaron = byPlayer([tracked, untracked, untracked]).find((r) => r.label === 'Aaron')!;
    expect(aaron.games).toBe(3);
    expect(aaron.extra).toMatchObject({ misplays: 2, misplayGames: 1 });
  });
});
