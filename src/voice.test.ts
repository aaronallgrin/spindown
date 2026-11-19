import { describe, expect, it } from 'vitest';
import { makeConfig, newGame, reduce } from './game';
import { parseVoice } from './voice';
import type { LiveGame } from './types';

function table(names = ['Aaron', 'Tim', 'DSW', 'Dylan']): LiveGame {
  const c = makeConfig('commander', undefined, 4, 'p4');
  c.players = c.players.map((p, i) => ({ ...p, name: names[i] }));
  const g = newGame(c);
  return reduce(reduce(g, { t: 'pick', seat: 0 }), { t: 'pick', seat: 0 });
}
const apply = (g: LiveGame, text: string, speaker = 0) => {
  const h = parseVoice(text, g, speaker);
  if ('error' in h) throw new Error(h.error);
  return { g: reduce(g, { t: 'batch', actions: h.actions }), said: h.said };
};
const lives = (g: LiveGame) => g.players.map((p) => p.life);

describe('voice', () => {
  it('opponents take 3 and I gain 1, with me as the source', () => {
    const { g, said } = apply(table(), 'Opponents take 3 and I gain 1.');
    expect(lives(g)).toEqual([41, 37, 37, 37]);
    expect(said).toBe('Opponents −3, Aaron +1');
    expect(g.events.filter((e) => e.kind === 'life' && e.delta! < 0).every((e) => e.from === 0)).toBe(true);
    expect(g.events.find((e) => e.kind === 'life' && e.seat === 0)?.from).toBeUndefined();
  });

  it('names, nicknames and number words', () => {
    expect(lives(apply(table(), 'Tim and Spencer lose five').g)).toEqual([40, 35, 35, 40]);
    expect(lives(apply(table(['Aaron', 'Tim', 'Spencer', 'Dylan']), 'D.S.W. takes 4 and Dyl takes 2').g)).toEqual([40, 40, 36, 38]);
    expect(lives(apply(table(), 'everyone takes 1').g)).toEqual([39, 39, 39, 39]);
    expect(lives(apply(table(), 'I take 6', 2).g)).toEqual([40, 40, 34, 40]);
  });

  it('sets the round', () => {
    expect(apply(table(), "it's actually turn 6").g.round).toBe(6);
    expect(apply(apply(table(), 'round 6').g, 'round two').g.round).toBe(2);
  });

  it('changes nothing it only half understood', () => {
    const g = table();
    for (const s of ['', 'Bob takes 3', 'opponents take 3 and draw a card', 'Tim takes 6 commander damage', 'open stats'])
      expect('error' in parseVoice(s, g, 0)).toBe(true);
  });

});
