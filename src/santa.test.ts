import { describe, expect, it } from 'vitest';
import { LEAGUE, isUnboxed, santaSeason, signupsOpen, standings } from './santa';
import type { GameRecord } from './types';

const game = (winnerName: string | null, league?: string) => ({ winnerName, config: { league } }) as unknown as GameRecord;

describe('Holiday League standings', () => {
  it('counts only league wins, any capitalization, and keeps zeros', () => {
    const t = standings([game('Tim', LEAGUE), game('tim', LEAGUE), game('Josh', LEAGUE), game('Josh'), game(null, LEAGUE), game('Stranger', LEAGUE)], ['Aaron', 'Josh', 'Tim']);
    expect(t).toEqual([
      { name: 'Tim', wins: 2 },
      { name: 'Josh', wins: 1 },
      { name: 'Aaron', wins: 0 },
    ]);
  });
});

describe('dates', () => {
  it('unboxes on the day, not before', () => {
    expect(isUnboxed(null, '2026-12-20')).toBe(false);
    expect(isUnboxed('2026-12-20', '2026-12-19')).toBe(false);
    expect(isUnboxed('2026-12-20', '2026-12-20')).toBe(true);
  });
  it('shows the tile Nov through Feb', () => {
    expect(santaSeason(new Date(2026, 10, 1))).toBe(true);
    expect(santaSeason(new Date(2027, 1, 28))).toBe(true);
    expect(santaSeason(new Date(2027, 2, 1))).toBe(false);
  });
});

it('sign-ups stay open through Nov 19', () => {
  expect(signupsOpen('2026-11-19')).toBe(true);
  expect(signupsOpen('2026-11-20')).toBe(false);
});
