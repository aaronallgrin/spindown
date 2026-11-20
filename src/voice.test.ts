import { describe, expect, it } from 'vitest';
import { makeConfig, newGame, reduce } from './game';
import { parseVoice } from './voice';
import type { LiveGame } from './types';

const card = (name: string) => ({ name, colorIdentity: [] });
function table(names = ['Aaron', 'Tim', 'DSW', 'Dylan']): LiveGame {
  const c = makeConfig('commander', undefined, 4, 'p4');
  c.players = c.players.map((p, i) => ({ ...p, name: names[i], commander: card(['Norin the Wary', 'The Ur-Dragon', 'Atraxa, Praetors\' Voice', 'Thrasios, Triton Hero'][i]) }));
  c.players[3] = { ...c.players[3], hasPartner: true, partner: card('Tymna the Weaver') };
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

  it('commander damage: from the speaker, or the commander or player named, and it takes life', () => {
    const a = apply(table(), 'Tim takes 6 commander damage').g;
    expect(a.players[1]).toMatchObject({ life: 34, cmdr: { '0:0': 6 } });
    expect(apply(table(), 'Tim takes 5 commander damage from Atraxa').g.players[1].cmdr).toEqual({ '2:0': 5 });
    expect(apply(table(), 'Tim takes 5 commander damage from Spencer').g.players[1].cmdr).toEqual({ '2:0': 5 });
    expect(apply(table(), 'I take 7 commander damage from Tymna').g.players[0].cmdr).toEqual({ '3:1': 7 });
    expect(parseVoice('Tim takes 3 commander damage', table(), 3)).toEqual({ error: 'Which of Dylan’s commanders? Say its name' });
  });

  it('poison, asterisk and monarch', () => {
    const { g, said } = apply(table(), 'Tim gets 2 poison and I get an asterisk and I am the monarch');
    expect(g.players[1].poison).toBe(2);
    expect(g.players[0].extra).toBe(1);
    expect(g.monarchSeat).toBe(0);
    expect(said).toBe('Tim +2 poison, Aaron +1 *, Aaron is the monarch');
    expect(apply(g, 'take back my star').g.players[0].extra).toBe(0);
    expect(apply(g, 'remove 1 poison from Tim').g.players[1].poison).toBe(1);
    expect(apply(g, 'Tim is the patriarchy').g.monarchSeat).toBe(1);
    expect(apply(g, "I'm the monarchy").g.monarchSeat).toBe(0); // already the monarch: stays
  });

  it('changes nothing it only half understood', () => {
    const g = table();
    for (const s of ['', 'Bob takes 3', 'opponents take 3 and draw a card', 'open stats', 'the monarch', 'Tim and Spencer are the monarch'])
      expect('error' in parseVoice(s, g, 0)).toBe(true);
  });

  it('guesses misheard names, but only when the exact words fail', () => {
    const g = table(['Aaron', 'Tim', 'Cody', 'Dylan']);
    const h = parseVoice('Kodi takes 3', g, 0);
    expect(h).toMatchObject({ said: 'Cody −3', guessed: [{ heard: 'kodi', meant: 'Cody' }] });
    const c = parseVoice('Tim takes 5 commander damage from nora the weary', g, 2);
    expect(c).toMatchObject({ guessed: [{ heard: 'nora the weary', meant: 'Norin the Wary' }] });
    if ('error' in c) throw new Error(c.error);
    expect(reduce(g, { t: 'batch', actions: c.actions }).players[1].cmdr).toEqual({ '0:0': 5 });
    // exact words never get a guess attached
    expect(parseVoice('Cody takes 3', g, 0)).not.toHaveProperty('guessed');
    // too far off: still nothing
    expect('error' in parseVoice('Erin takes 3', g, 1)).toBe(true);
  });

  it('uses fixes the group confirmed, without asking again', () => {
    const g = table();
    const h = parseVoice('Erin takes 3', g, 1, { erin: 'Aaron' });
    expect(h).toMatchObject({ said: 'Aaron −3' });
    expect(h).not.toHaveProperty('guessed');
    // a real player named Erin wins over the fix
    expect(parseVoice('Erin takes 3', table(['Erin', 'Tim', 'DSW', 'Dylan']), 1, { erin: 'Aaron' })).toMatchObject({ said: 'Erin −3' });
  });
});
