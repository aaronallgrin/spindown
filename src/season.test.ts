import { describe, expect, it } from 'vitest';
import { easter, seasonOf, themesOn } from './season';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('seasons', () => {
  it('turns white on Dec 1 and changes on the first day of each season', () => {
    expect(seasonOf(day(2026, 11, 30))).toBe('fall');
    expect(seasonOf(day(2026, 12, 1))).toBe('winter');
    expect(seasonOf(day(2027, 3, 19))).toBe('winter');
    expect(seasonOf(day(2027, 3, 20))).toBe('spring');
    expect(seasonOf(day(2027, 6, 21))).toBe('summer');
    expect(seasonOf(day(2027, 9, 22))).toBe('fall');
  });
});

describe('holidays', () => {
  it('finds Easter', () => {
    expect(easter(2026)).toEqual(day(2026, 4, 5));
    expect(easter(2027)).toEqual(day(2027, 3, 28));
    expect(easter(2028)).toEqual(day(2028, 4, 16));
  });
  it('picks the holiday over the season', () => {
    expect(themesOn(day(2027, 2, 14))).toEqual(['valentines']);
    expect(themesOn(day(2027, 7, 4))).toEqual(['july4']);
    expect(themesOn(day(2027, 10, 31))).toEqual(['halloween']);
    expect(themesOn(day(2027, 11, 1))).toEqual(['fall']);
    expect(themesOn(day(2027, 3, 28))).toEqual(['easter']);
    expect(themesOn(day(2026, 12, 24))).toEqual(['christmas']);
    expect(themesOn(day(2026, 12, 30))).toEqual(['kwanzaa']);
    expect(themesOn(day(2027, 1, 1))).toEqual(['kwanzaa']);
    expect(themesOn(day(2027, 1, 2))).toEqual(['winter']);
  });
  it('follows the Hebrew calendar for Hanukkah and Passover', () => {
    expect(themesOn(day(2026, 12, 4))).toEqual(['winter']);
    expect(themesOn(day(2026, 12, 5))).toEqual(['hanukkah']);
    expect(themesOn(day(2026, 12, 12))).toEqual(['hanukkah']);
    expect(themesOn(day(2026, 12, 13))).toEqual(['winter']);
    expect(themesOn(day(2027, 4, 22))).toEqual(['passover']);
    expect(themesOn(day(2027, 4, 29))).toEqual(['passover']);
    expect(themesOn(day(2027, 4, 30))).toEqual(['spring']);
  });
  it('shares the screen when holidays overlap', () => {
    expect(themesOn(day(2027, 12, 25))).toEqual(['hanukkah', 'christmas']);
    expect(themesOn(day(2027, 12, 28))).toEqual(['hanukkah', 'kwanzaa']);
  });
});
