import { describe, expect, it } from 'vitest';
import { turnAreas } from './layouts';

describe('turnAreas', () => {
  // standard 4: a b / d c, a and d on the left edge, b and c on the right
  const std = ['a b', 'd c'];
  it('puts your own edge at the bottom with neighbours in the right places', () => {
    expect(turnAreas(std, 0)).toEqual([['a', 'b'], ['d', 'c']]);
    expect(turnAreas(std, 90)).toEqual([['b', 'c'], ['a', 'd']]);
    expect(turnAreas(std, 270)).toEqual([['d', 'a'], ['c', 'b']]);
    expect(turnAreas(std, 180)).toEqual([['c', 'd'], ['b', 'a']]);
  });
  it('keeps a seat that spans an end in one piece', () => {
    expect(turnAreas(['a a', 'd b', 'c c'], 90)).toEqual([['a', 'b', 'c'], ['a', 'd', 'c']]);
  });
});
