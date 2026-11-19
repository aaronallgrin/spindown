import { describe, expect, it } from 'vitest';
import { rankEvents, when, type MagicEvent } from './events';

const ev = (p: Partial<MagicEvent>): MagicEvent => ({
  id: p.title ?? '', title: '', format: 'Modern', tags: [], start: '2026-11-20T23:00:00Z', tz: 'America/New_York',
  miles: 5, store: '', address: '', fee: 0, ...p,
});

describe('rankEvents', () => {
  it('puts the soonest event first, whatever its format or distance', () => {
    const out = rankEvents([
      ev({ title: 'fnm sat', miles: 1, start: '2026-11-22T23:00:00Z' }),
      ev({ title: 'cmd fri', format: 'Commander', miles: 9, start: '2026-11-21T23:00:00Z' }),
      ev({ title: 'pre jan', tags: ['magic_prerelease'], miles: 20, start: '2027-01-29T23:00:00Z' }),
      ev({ title: 'cmd thu', format: 'Commander', miles: 2, start: '2026-11-20T23:00:00Z' }),
    ]);
    expect(out.map((e) => e.title)).toEqual(['cmd thu', 'cmd fri', 'fnm sat', 'pre jan']);
  });

  it('keeps one prerelease per store (its earliest) and only the 3 closest stores', () => {
    const pre = (title: string, store: string, miles: number, start: string) =>
      ev({ title, store, miles, start, tags: ['magic_prerelease'] });
    const out = rankEvents([
      pre('A sat', 'A', 1, '2027-01-30T17:00:00Z'),
      pre('A fri', 'A', 1, '2027-01-29T23:00:00Z'),
      pre('B', 'B', 3, '2027-01-29T23:00:00Z'),
      pre('C', 'C', 2, '2027-01-29T23:00:00Z'),
      pre('D', 'D', 9, '2027-01-29T23:00:00Z'),
    ]);
    expect(out.map((e) => e.title).sort()).toEqual(['A fri', 'B', 'C']);
  });
});

describe('when', () => {
  it('shows the time in the store’s time zone', () => {
    expect(when(ev({ start: '2026-11-20T23:30:00Z' }))).toMatch(/6:30\s?PM/);
  });
});
