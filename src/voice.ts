import type { Action } from './game';
import type { LiveGame } from './types';

/**
 * Voice commands, spoken by the player whose name was tapped (the "speaker").
 * Understands, in any mix joined by "and":
 *   "opponents take 3", "I gain 1", "Tim and Chris lose 2", "everyone takes 1", "it's turn 6"
 * Damage the speaker says someone else takes is credited to the speaker as its source.
 * All or nothing: if any part isn't understood, nothing changes.
 */

// spoken nicknames: any word in a group matches a player named with any other word in it
const NICKNAMES = [
  ['spencer', 'dsw', 'd s w'],
  ['dylan', 'dyl', 'dill'],
];

const NUMS: Record<string, number> = {
  one: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};
const NUM = `(\\d+|${Object.keys(NUMS).join('|')})`;
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUMS[s]);

const LOSE = 'takes?|took|loses?|lost|lose';
const GAIN = 'gains?|gained';
const CLAUSE = new RegExp(`(.*?)\\b(${LOSE}|${GAIN})\\s+${NUM}\\b`, 'g');

export type Heard = { actions: Action[]; said: string } | { error: string };

export function parseVoice(text: string, g: LiveGame, speaker: number): Heard {
  const t = text
    .toLowerCase()
    .replace(/(\w)\.(?=\w)/g, '$1') // "D.S.W." → "dsw"
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return { error: 'Didn’t hear anything' };
  if (/\bcommander\b/.test(t)) return { error: 'Commander damage by voice isn’t in yet' };

  const turn = t.match(new RegExp(`\\b(?:turn|round)\\s+(?:number\\s+)?${NUM}\\b`));
  if (turn && !new RegExp(CLAUSE.source).test(t)) {
    const n = num(turn[1]);
    if (!n || n > 99) return { error: `Didn’t catch: “${text}”` };
    return { actions: [{ t: 'round', d: n - g.round }], said: `Round ${n}` };
  }

  const actions: Action[] = [];
  const said: string[] = [];
  let end = 0;
  for (const m of t.matchAll(CLAUSE)) {
    end = m.index + m[0].length;
    const who = people(m[1], g, speaker);
    const n = num(m[3]);
    if (!who.length || !n) return { error: `Didn’t catch: “${text}”` };
    const d = new RegExp(`^(${GAIN})$`).test(m[2]) ? n : -n;
    for (const seat of who) {
      // you can't be the source of your own damage here, and gains have no source
      const from = d < 0 && seat !== speaker ? speaker : undefined;
      actions.push({ t: 'life', seat, d, from });
    }
    said.push(`${label(who, g, speaker)} ${d > 0 ? '+' : '−'}${n}`);
  }
  // anything meaningful left over after the last clause means we only half understood
  const rest = t.slice(end).replace(/\b(life|damage|each|please|and|then|now)\b/g, '').trim();
  if (!actions.length || rest) return { error: `Didn’t catch: “${text}”` };
  return { actions, said: said.join(', ') };
}

/** Seats named in a clause's subject, e.g. "and tim and chris" or "my opponents". */
function people(subject: string, g: LiveGame, speaker: number): number[] {
  const s = ` ${subject} `;
  const live = g.players.filter((p) => !p.out).map((p) => p.seat);
  if (/\b(everyone|everybody|each player|all players|all of us|the table)\b/.test(s) && !/\belse\b/.test(s)) return live;
  if (/\b(opponents?|everyone else|everybody else|the others)\b/.test(s)) return live.filter((x) => x !== speaker);
  const seats = new Set<number>();
  if (/\b(i|me|myself)\b/.test(s)) seats.add(speaker);
  g.config.players.forEach((p, seat) => {
    if (names(p.name).some((n) => new RegExp(`\\b${n}\\b`).test(s))) seats.add(seat);
  });
  return [...seats];
}

/** Ways to say a player's name: full name, first name, and nicknames that go with either. */
function names(name: string): string[] {
  const full = name.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').trim();
  if (!full) return [];
  const own = [full, full.split(' ')[0]];
  const nick = NICKNAMES.filter((grp) => grp.some((w) => own.includes(w))).flat();
  return [...new Set([...own, ...nick])].map((n) => n.replace(/'/g, "'?"));
}

function label(seats: number[], g: LiveGame, speaker: number) {
  const others = g.players.filter((p) => !p.out && p.seat !== speaker).map((p) => p.seat);
  if (seats.length > 1 && seats.length === others.length && !seats.includes(speaker)) return 'Opponents';
  return seats.map((s) => g.config.players[s].name).join(' & ');
}

// the browser's own speech-to-text (Safari and Chrome); TypeScript doesn't declare the constructor
type Rec = {
  lang: string;
  interimResults: boolean;
  onresult: (e: SpeechRecognitionEvent) => void;
  onerror: (e: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
const w = globalThis as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
export const canListen = !!SR;

/** Listen for one sentence. `onText` gets the words so far; `onDone` fires once, with the final words or an error. Returns stop (finish now). */
export function listen(onText: (text: string) => void, onDone: (r: { text: string } | { error: string }) => void) {
  const rec = new SR!();
  rec.lang = 'en-US';
  rec.interimResults = true;
  let text = '';
  let done = false;
  const finish = (r: { text: string } | { error: string }) => {
    if (done) return;
    done = true;
    onDone(r);
  };
  rec.onresult = (e) => {
    text = [...e.results].map((r) => r[0].transcript).join('');
    onText(text);
    if (e.results[e.results.length - 1].isFinal) finish({ text });
  };
  rec.onerror = (e) => finish({ error: e.error === 'not-allowed' ? 'Microphone is blocked for Spindown' : e.error === 'no-speech' ? 'Didn’t hear anything' : 'Voice stopped, try again' });
  rec.onend = () => finish(text ? { text } : { error: 'Didn’t hear anything' });
  rec.start();
  return () => rec.stop();
}
