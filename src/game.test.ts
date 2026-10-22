import { describe, expect, it } from 'vitest';
import { lethalCause, makeConfig, newGame, reduce, toRecord, turnOrder, type Action } from './game';
import { packUndo, unpackUndo } from './undoStore';
import type { LiveGame } from './types';

const NAMES = ['Aaron', 'Tim', 'Chris', 'Cody'];

function started(first = 1): LiveGame {
  const c = makeConfig('commander', undefined, 4, 'p4');
  c.players = c.players.map((p, i) => ({ ...p, name: NAMES[i] }));
  let g = newGame(c);
  g = reduce(g, { t: 'pick', seat: first });
  return reduce(g, { t: 'pick', seat: first });
}
const run = (g: LiveGame, ...as: Action[]) => as.reduce(reduce, g);

describe('setup', () => {
  it('starts at 40 for Commander and 30 for multiplayer Brawl', () => {
    expect(makeConfig('commander', undefined, 4, 'p4').startingLife).toBe(40);
    expect(makeConfig('other', 'Brawl', 2, 'p2').startingLife).toBe(25);
    expect(makeConfig('other', 'Brawl', 4, 'p4').startingLife).toBe(30);
  });

  it('waits for names, then needs two taps on the same seat to pick first', () => {
    const c = makeConfig('commander', undefined, 4, 'p4');
    const g = newGame(c);
    expect(g.phase).toBe('seating');
    const named = newGame({ ...c, players: c.players.map((p, i) => ({ ...p, name: NAMES[i] })) });
    expect(named.phase).toBe('choosingFirst');
    const once = reduce(named, { t: 'pick', seat: 2 });
    expect(once.phase).toBe('choosingFirst');
    const twice = reduce(once, { t: 'pick', seat: 2 });
    expect(twice).toMatchObject({ phase: 'playing', firstSeat: 2, round: 1 });
  });

  it('gives every seat the shared deck in Dandân', () => {
    const c = makeConfig('other', 'Dandân', 2, 'p2');
    const g = newGame(c);
    expect(g.config.players.every((p) => p.deckName === 'Shared Dandân deck' && p.colors.join() === 'U')).toBe(true);
  });
});

describe('counters', () => {
  it('merges quick taps on the same seat into one life event', () => {
    const g = run(started(), { t: 'life', seat: 0, d: -1 }, { t: 'life', seat: 0, d: -1 }, { t: 'life', seat: 0, d: -1 });
    expect(g.players[0].life).toBe(37);
    const life = g.events.filter((e) => e.kind === 'life');
    expect(life).toHaveLength(1);
    expect(life[0].delta).toBe(-3);
  });

  it('keeps a gain and a loss as separate events', () => {
    const g = run(started(), { t: 'life', seat: 0, d: -2 }, { t: 'life', seat: 0, d: 1 });
    expect(g.events.filter((e) => e.kind === 'life')).toHaveLength(2);
  });

  it('takes life with commander damage, including from your own commander', () => {
    const g = run(started(), { t: 'cmdr', seat: 0, from: 2, partner: 0, d: 7 }, { t: 'cmdr', seat: 0, from: 0, partner: 0, d: 2 });
    expect(g.players[0].life).toBe(31);
    expect(g.players[0].cmdr).toEqual({ '2:0': 7, '0:0': 2 });
  });

  it('never takes poison or commander damage below zero', () => {
    const g = run(started(), { t: 'poison', seat: 1, d: -1 }, { t: 'cmdr', seat: 1, from: 0, partner: 0, d: -3 });
    expect(g.players[1].poison).toBe(0);
    expect(g.players[1].life).toBe(40);
  });

  it('finds lethal from life, poison and 21 from one commander', () => {
    const g = started();
    expect(lethalCause(g, { ...g.players[0], life: 0 })).toBe('life');
    expect(lethalCause(g, { ...g.players[0], poison: 10 })).toBe('poison');
    expect(lethalCause(g, { ...g.players[0], cmdr: { '1:0': 20, '1:1': 20 } })).toBeNull();
    expect(lethalCause(g, { ...g.players[0], cmdr: { '1:0': 21 } })).toBe('commander');
  });

  it('moves the monarch and drops it when the monarch is knocked out', () => {
    let g = run(started(), { t: 'monarch', seat: 2 });
    expect(g.monarchSeat).toBe(2);
    g = reduce(g, { t: 'monarch', seat: 3 });
    expect(g.monarchSeat).toBe(3);
    g = reduce(g, { t: 'out', seat: 3, cause: 'life' });
    expect(g.monarchSeat).toBeNull();
  });
});

describe('ending', () => {
  it('ends when one player is left and records the round each player went out', () => {
    const g = run(
      started(1),
      { t: 'round', d: 1 },
      { t: 'out', seat: 0, cause: 'life' },
      { t: 'round', d: 1 },
      { t: 'out', seat: 2, cause: 'commander' },
      { t: 'out', seat: 3, cause: 'poison' },
    );
    expect(g).toMatchObject({ phase: 'over', winnerSeat: 1, draw: false });
    const r = toRecord(g);
    expect(r.winnerName).toBe('Tim');
    expect(r.rounds).toBe(3);
    expect(r.players.map((p) => p.outRound)).toEqual([2, undefined, 3, 3]);
    expect(r.players.map((p) => p.turnOrder)).toEqual([4, 1, 2, 3]);
  });

  it('can take back a declared win', () => {
    let g = run(started(), { t: 'win', seat: 2 });
    expect(g.phase).toBe('over');
    g = reduce(g, { t: 'takeBackWin' });
    expect(g.phase).toBe('playing');
    expect(g.players.every((p) => !p.out)).toBe(true);
  });

  it('records who held the monarch at the end', () => {
    const g = run(started(), { t: 'monarch', seat: 2 }, { t: 'end', winner: 2 });
    expect(toRecord(g).players.map((p) => p.wasMonarchAtEnd)).toEqual([false, false, true, false]);
  });

  it('counts turn order clockwise from the first player', () => {
    expect(turnOrder(started(2))).toEqual([2, 3, 0, 1]);
  });
});

describe('undo history', () => {
  it('survives a reload', () => {
    const states: LiveGame[] = [];
    let g = started();
    for (const a of [
      { t: 'life', seat: 0, d: -5 },
      { t: 'poison', seat: 1, d: 2 },
      { t: 'round', d: 1 },
      { t: 'life', seat: 3, d: 4 },
    ] as Action[]) {
      states.push(g);
      g = reduce(g, a);
    }
    const back = unpackUndo(JSON.parse(JSON.stringify(packUndo(states))), g);
    expect(back).toEqual(states);
  });

  it('is dropped when it belongs to another game', () => {
    const a = started();
    const b = started();
    expect(unpackUndo(packUndo([a]), b)).toEqual([]);
  });
});
