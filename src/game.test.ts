import { describe, expect, it } from 'vitest';
import { lethalCause, makeConfig, needsNames, newGame, quickName, reduce, starReasons, toRecord, turnOrder, type Action } from './game';
import { recapText } from './recap';
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

  it('keeps the reason for each * and never merges different reasons', () => {
    const g = run(started(), { t: 'extra', seat: 1, d: 1, note: 'Misplay' }, { t: 'extra', seat: 1, d: 1, note: 'Slow' });
    expect(g.players[1].extra).toBe(2);
    expect(g.events.filter((e) => e.kind === 'extra').map((e) => e.note)).toEqual(['Misplay', 'Slow']);
  });

  it('lists * reasons with take-backs removing the latest', () => {
    const g = run(
      started(),
      { t: 'extra', seat: 1, d: 1, note: 'Misplay' },
      { t: 'round', d: 1 },
      { t: 'extra', seat: 1, d: 1, note: 'Slow play' },
      { t: 'extra', seat: 1, d: -1 },
      { t: 'extra', seat: 1, d: 1, note: 'Take-back' },
      { t: 'extra', seat: 2, d: 1 },
    );
    expect(starReasons(g.events, 1)).toEqual([{ note: 'Misplay', round: 1 }, { note: 'Take-back', round: 2 }]);
    expect(starReasons(g.events, 2)).toEqual([{ note: undefined, round: 2 }]);
  });

  it('finds lethal from life, poison and 21 from one commander', () => {
    const g = started();
    expect(lethalCause(g, { ...g.players[0], life: 0 })).toBe('life');
    expect(lethalCause(g, { ...g.players[0], poison: 10 })).toBe('poison');
    expect(lethalCause(g, { ...g.players[0], cmdr: { '1:0': 20, '1:1': 20 } })).toBeNull();
    expect(lethalCause(g, { ...g.players[0], cmdr: { '1:0': 21 } })).toBe('commander');
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

describe('dandan events', () => {
  it('logs a mark against the player and takes back only their latest', () => {
    const g = run(
      started(0),
      { t: 'mark', seat: 0, kind: 'dandanKill', d: 1 },
      { t: 'mark', seat: 1, kind: 'dandanKill', d: 1 },
      { t: 'mark', seat: 0, kind: 'diminishing', d: 1 },
      { t: 'mark', seat: 0, kind: 'dandanKill', d: -1 },
      { t: 'mark', seat: 2, kind: 'dandanBlock', d: -1 },
    );
    const marks = g.events.filter((e) => e.kind !== 'first').map((e) => `${e.seat}:${e.kind}`);
    expect(marks).toEqual(['1:dandanKill', '0:diminishing']);
    expect(toRecord(g).events.some((e) => e.kind === 'diminishing')).toBe(true);
  });
});

describe('quick start', () => {
  it('plays with placeholder names, then takes real ones after the game', () => {
    const c = makeConfig('commander', undefined, 4, 'p4');
    c.players = c.players.map((p, i) => ({ ...p, name: quickName(i) }));
    let g = newGame(c);
    expect(g.phase).toBe('choosingFirst');
    g = run(g, { t: 'pick', seat: 0 }, { t: 'pick', seat: 0 }, { t: 'end', winner: 2 });
    expect(needsNames(g.config)).toBe(true);
    // no renaming mid-game, but a forgotten commander can be added
    const mid = reduce(started(), { t: 'seatInfo', seat: 0, setup: { ...c.players[0], name: 'X', deckName: 'Late' } }).config.players[0];
    expect(mid.name).toBe('Aaron');
    expect(mid.deckName).toBe('Late');
    g = NAMES.reduce((x, name, seat) => reduce(x, { t: 'seatInfo', seat, setup: { ...x.config.players[seat], name } }), g);
    expect(needsNames(g.config)).toBe(false);
    expect(toRecord(g).winnerName).toBe('Chris');
  });
});

describe('recap', () => {
  it('names the winner, who went out how, and misplays', () => {
    const g = run(
      started(0),
      { t: 'extra', seat: 3, d: 1 },
      { t: 'extra', seat: 3, d: 1 },
      { t: 'out', seat: 1, cause: 'poison' },
      { t: 'end', winner: 0 },
    );
    const text = recapText(toRecord(g), 'https://x.test');
    expect(text).toMatch(/^🏆 Aaron won/);
    expect(text).toContain('Tim: out round');
    expect(text).toContain('* Misplays: Cody 2');
    expect(text.endsWith('Tracked with Spindown https://x.test')).toBe(true);
  });
});

describe('Pauper Commander', () => {
  it('starts at 30 and dies to 16 commander damage', () => {
    const c = makeConfig('commander', 'Pauper Commander', 4, 'p4-sides');
    expect(c.startingLife).toBe(30);
    const g = newGame(c);
    const p = { ...g.players[0], cmdr: { '1:0': 15 } };
    expect(lethalCause(g, p)).toBe(null);
    expect(lethalCause(g, { ...p, cmdr: { '1:0': 16 } })).toBe('commander');
  });
  it('leaves regular Commander at 40 and 21', () => {
    const c = makeConfig('commander', undefined, 4, 'p4-sides');
    const g = newGame(c);
    expect(c.startingLife).toBe(40);
    expect(lethalCause(g, { ...g.players[0], cmdr: { '1:0': 16 } })).toBe(null);
  });
});
