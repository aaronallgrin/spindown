import type { Action } from './game';
import type { LiveGame } from './types';

/**
 * Voice commands, spoken by the player whose name was tapped (the "speaker").
 * Parts joined by "and", e.g. "opponents take 3 and I gain 1":
 *   life:      "Tim and Chris lose 2", "everyone takes 1", "I gain 4"
 *   commander: "Tim takes 6 commander damage" (from the speaker's commander), "... from Norin" / "from Chris"
 *   poison:    "Tim gets 2 poison", "remove 1 poison from me"
 *   *:         "Tim gets an asterisk", "take back my star"
 *   monarch:   "I'm the monarch", "Tim is the monarchy" ("patriarchy" too, a common mishearing)
 *   round:     "it's turn 6"
 * Damage the speaker says someone else takes is credited to the speaker unless "from" names someone.
 * All or nothing: if any part isn't understood, nothing changes.
 */

// spoken nicknames: any word in a group matches a player named with any other word in it
const NICKNAMES = [
  ['spencer', 'dsw', 'd s w'],
  ['dylan', 'dyl', 'dill'],
];

const NUMS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
};
// mishearings, trusted only right after a verb ("takes for", "gain to")
const LOOSE: Record<string, number> = { to: 2, too: 2, for: 4 };
const NUM = `(\\d+|${Object.keys(NUMS).join('|')})`;
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : (NUMS[s] ?? LOOSE[s]));

const LOSE = 'takes?|took|loses?|lost|lose|gets?|got';
const GAIN = 'gains?|gained';
const VERB_NUM = new RegExp(`\\b(${LOSE}|${GAIN})\\s+(\\d+|${[...Object.keys(NUMS), ...Object.keys(LOOSE)].join('|')})\\b`);
const ROUND = new RegExp(`\\b(?:turn|round)\\s+(?:number\\s+)?${NUM}\\b`);
const MONARCH = /\b(monarch|monarchy|patriarch|patriarchy)\b/;
const STAR = /\b(asterisks?|stars?|misplays?)\b/;
const POISON = /\bpoison\b/;
const CMDR = /\bcommander\b/;
const TAKE_OFF = /\b(remove|take back|take away|minus|undo)\b/;

export type Heard = { actions: Action[]; said: string } | { error: string };

export function parseVoice(text: string, g: LiveGame, speaker: number): Heard {
  const t = text
    .toLowerCase()
    .replace(/(\w)\.(?=\w)/g, '$1') // "D.S.W." → "dsw"
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return { error: 'Didn’t hear anything' };
  const nope = { error: `Didn’t catch: “${text}”` };

  // "Tim and Chris take 2 and I gain 1": split on "and", then glue pieces back until each holds an action
  const clauses: string[] = [];
  let cur: string[] = [];
  for (const piece of t.split(/\s+(?:and|then|also)\s+/)) {
    cur.push(piece);
    const c = cur.join(' and ');
    if ([VERB_NUM, ROUND, MONARCH, STAR, POISON, CMDR].some((r) => r.test(c))) {
      clauses.push(c);
      cur = [];
    }
  }
  if (cur.length || !clauses.length) return nope;

  const actions: Action[] = [];
  const said: string[] = [];
  for (const c of clauses) {
    const r = clause(c, g, speaker);
    if ('error' in r) return r.error ? r : nope;
    actions.push(...r.actions);
    said.push(r.said);
  }
  return { actions, said: said.join(', ') };
}

function clause(c: string, g: LiveGame, speaker: number): Heard {
  const [target, source = ''] = c.split(/\bfrom\b/);
  // damage has a target and maybe a source ("from Chris"); poison, * and the crown are just about who's named
  const damage = CMDR.test(c) || (!!c.match(VERB_NUM) && !MONARCH.test(c) && !STAR.test(c) && !POISON.test(c));
  const who = people(damage ? target : c, g, speaker);
  const one = who.length === 1 ? who[0] : null;
  const name = (seat: number) => g.config.players[seat].name;
  const list = label(who, g, speaker);
  const verb = c.match(VERB_NUM);
  // a count said anywhere ("2 poison"), "a"/"an" meaning one, else the number right after the verb
  const strict = c.match(new RegExp(`\\b${NUM}\\b`));
  const count = strict ? num(strict[1]) : verb ? num(verb[2]) : /\b(an?|my|one)\b/.test(c) ? 1 : 0;
  const sign = TAKE_OFF.test(c) || /\b(loses?|lost)\b/.test(c) ? -1 : 1;

  if (MONARCH.test(c)) {
    if (one == null) return { error: 'Say one player for the monarch' };
    // the monarch action toggles, so saying the current monarch again changes nothing
    return { actions: g.monarchSeat === one ? [] : [{ t: 'monarch', seat: one }], said: `${name(one)} is the monarch` };
  }
  if (STAR.test(c)) {
    const star = g.config.extraCounter?.trim();
    if (!star) return { error: `No ${star || '*'} counter in this game` };
    if (!who.length || !count) return { error: '' };
    return { actions: who.map((seat) => ({ t: 'extra', seat, d: sign * count })), said: `${list} ${sign > 0 ? '+' : '−'}${count} ${star}` };
  }
  if (POISON.test(c)) {
    if (!who.length || !count) return { error: '' };
    return { actions: who.map((seat) => ({ t: 'poison', seat, d: sign * count })), said: `${list} ${sign > 0 ? '+' : '−'}${count} poison` };
  }
  if (CMDR.test(c)) {
    if (g.config.format !== 'commander') return { error: 'No commander damage in this format' };
    if (!who.length || !count) return { error: '' };
    const src = commander(c, source, g, speaker);
    if ('error' in src) return src;
    const card = (src.partner ? g.config.players[src.seat].partner : g.config.players[src.seat].commander)?.name ?? `${name(src.seat)}’s commander`;
    return {
      actions: who.map((seat) => ({ t: 'cmdr', seat, from: src.seat, partner: src.partner, d: sign * count })),
      said: `${list} ${sign > 0 ? '+' : '−'}${count} commander damage (${card})`,
    };
  }
  if (verb) {
    // nothing but filler may follow the number, or we only half understood
    const at = target.indexOf(verb[0]);
    if (at < 0 || target.slice(at + verb[0].length).replace(/\b(life|damage|each|please|points?|now)\b/g, '').trim()) return { error: '' };
    if (!who.length || !count) return { error: '' };
    const d = new RegExp(`^(${GAIN})$`).test(verb[1]) ? count : -count;
    const from = source ? people(source, g, speaker) : [speaker];
    if (from.length !== 1) return { error: '' };
    return {
      // gains have no source, and you can't be the source of your own damage here
      actions: who.map((seat) => ({ t: 'life', seat, d, from: d < 0 && seat !== from[0] ? from[0] : undefined })),
      said: `${list} ${d > 0 ? '+' : '−'}${count}`,
    };
  }
  const turn = c.match(ROUND);
  if (turn) {
    const n = num(turn[1]);
    if (!n || n > 99) return { error: '' };
    return { actions: [{ t: 'round', d: n - g.round }], said: `Round ${n}` };
  }
  return { error: '' };
}

/** Whose commander dealt the damage: a commander's name, a player's name, or the speaker's own. */
function commander(c: string, source: string, g: LiveGame, speaker: number): { seat: number; partner: 0 | 1 } | { error: string } {
  const s = ` ${c} `;
  for (const [seat, p] of g.config.players.entries()) {
    const cards = [p.commander?.name, p.hasPartner ? p.partner?.name : undefined];
    for (const partner of [0, 1] as const) {
      const card = cards[partner]?.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').trim();
      // the whole name, or its first word if it's a real name: "Norin the Wary" or "Norin", but not "the"
      const first = card?.split(' ')[0] ?? '';
      if (card && [card, ...(first.length >= 4 ? [first] : [])].some((n) => new RegExp(`\\b${n}\\b`).test(s))) return { seat, partner };
    }
  }
  const who = source.trim() ? people(source, g, speaker) : [speaker];
  if (who.length !== 1) return { error: '' };
  const p = g.config.players[who[0]];
  if (p.hasPartner) return { error: `Which of ${p.name}’s commanders? Say its name` };
  return { seat: who[0], partner: 0 };
}

/** Seats named in a clause's subject, e.g. "and tim and chris" or "my opponents". */
function people(subject: string, g: LiveGame, speaker: number): number[] {
  const s = ` ${subject} `;
  const live = g.players.filter((p) => !p.out).map((p) => p.seat);
  if (/\b(everyone|everybody|each player|all players|all of us|the table)\b/.test(s) && !/\belse\b/.test(s)) return live;
  if (/\b(opponents?|everyone else|everybody else|the others)\b/.test(s)) return live.filter((x) => x !== speaker);
  const seats = new Set<number>();
  if (/\b(i|me|my|myself)\b/.test(s)) seats.add(speaker);
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
