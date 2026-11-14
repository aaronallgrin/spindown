import { describe, expect, it } from 'vitest';
import { makeConfig, newGame, reduce, toRecord, type Action } from './game';
import { grudges } from './stats';

const NAMES = ['Aaron', 'Tim', 'Chris', 'Cody'];
function game(...as: Action[]) {
  const c = makeConfig('commander', undefined, 4, 'p4-sides');
  c.players = c.players.map((p, i) => ({ ...p, name: NAMES[i] }));
  let g = newGame(c);
  g = reduce(reduce(g, { t: 'pick', seat: 0 }), { t: 'pick', seat: 0 });
  return toRecord(as.reduce(reduce, g));
}

describe('grudges', () => {
  it('adds commander damage and attack damage, nets out fixed mis-taps, skips your own commander', () => {
    const g = game(
      { t: 'cmdr', seat: 0, from: 1, partner: 0, d: 5 },
      { t: 'cmdr', seat: 1, from: 1, partner: 0, d: 2 },
      { t: 'attack', seat: 1 },
      { t: 'life', seat: 0, d: -4 },
      { t: 'life', seat: 2, d: -3 },
      { t: 'life', seat: 2, d: 1 },
      { t: 'round', d: 1 },
      { t: 'life', seat: 3, d: -6 },
    );
    const { dmg, aggressive } = grudges([g, game()]);
    expect(dmg.get('Tim')?.get('Aaron')).toBe(9);
    expect(dmg.get('Tim')?.get('Chris')).toBe(2);
    expect(dmg.get('Tim')?.has('Tim')).toBe(false);
    expect(dmg.get('Tim')?.has('Cody')).toBe(false);
    // the empty second game doesn't count toward the average
    expect(aggressive[0]).toMatchObject({ name: 'Tim', games: 1, total: 11, avg: 11, fav: 'Aaron' });
  });
});
