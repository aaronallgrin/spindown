import { trophies } from './eggs';
import type { GameRecord, PlayerResult } from './types';
import { causeLabel } from './ui';

const deck = (p: PlayerResult) => [p.commander, p.partner].filter(Boolean).join(' + ') || p.deckName || '';

/** A short write-up of one game to paste in the group chat. */
export function recapText(g: GameRecord, link = ''): string {
  const winner = g.players.find((p) => p.result === 'win');
  const lines = [
    winner ? `🏆 ${winner.name} won${deck(winner) ? ` with ${deck(winner)}` : ''}` : '🤝 Draw',
    [g.rounds ? `${g.rounds} ${g.rounds === 1 ? 'round' : 'rounds'}` : '', g.imported ? '' : `${g.durationMin} min`].filter(Boolean).join(' · '),
    '',
  ];
  // last one out first, like a podium
  const out = g.players.filter((p) => p.result !== 'win').sort((a, b) => (b.outRound ?? 99) - (a.outRound ?? 99));
  for (const p of out) {
    const how = p.outRound ? `out round ${p.outRound}${p.outCause ? `, ${causeLabel[p.outCause].toLowerCase()}` : ''}` : p.result === 'draw' ? 'drew' : 'still in';
    lines.push(`${p.name}${deck(p) ? ` (${deck(p)})` : ''}: ${how}`);
  }
  const misplays = g.config.extraCounter === '*' ? g.players.filter((p) => (p.finalExtra ?? 0) > 0) : [];
  if (misplays.length) lines.push('', `* Misplays: ${misplays.map((p) => `${p.name} ${p.finalExtra}`).join(', ')}`);
  const t = trophies(g);
  if (t.length) lines.push('', ...t.map((x) => `🏅 ${x.title}${x.name ? `: ${x.name}` : ''}`));
  if (link) lines.push('', `Tracked with Spindown ${link}`);
  return lines.join('\n');
}
