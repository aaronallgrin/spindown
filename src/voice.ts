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

/** A name the phone misheard and what Spindown thinks it was ("nora the weary" → "norin the wary"). */
export type Guess = { heard: string; meant: string; sure?: boolean };
export type Heard = { actions: Action[]; said: string; guessed?: Guess[] } | { error: string };

const clean = (text: string) =>
  text
    .toLowerCase()
    .replace(/(\w)\.(?=\w)/g, '$1') // "D.S.W." → "dsw"
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Exact words first. If that fails, try the group's confirmed fixes (`learned`, heard → meant),
 * then sound-alike names at this table. A result with `guessed` should be confirmed before applying,
 * unless every guess is `sure` (one name is clearly closest, like "erin" when Aaron is the only near match).
 */
export function parseVoice(text: string, g: LiveGame, speaker: number, learned: Record<string, string> = {}): Heard {
  const exact = parseExact(text, g, speaker);
  if (!('error' in exact)) return exact;
  const taught = swap(clean(text), Object.entries(learned).map(([heard, meant]) => ({ heard, meant })));
  const fixed = parseExact(taught, g, speaker);
  if (!('error' in fixed)) return fixed;
  const guessed = guesses(taught, g);
  const r = guessed.length ? parseExact(swap(taught, guessed), g, speaker) : exact;
  return 'error' in r ? exact : { ...r, guessed };
}

function swap(t: string, pairs: Guess[]) {
  for (const { heard, meant } of pairs) if (clean(heard)) t = t.replace(new RegExp(`\\b${clean(heard)}\\b`, 'g'), clean(meant));
  return t;
}

// words the parser already understands; never mistaken for a name
const GRAMMAR = new Set(
  `and then also from take takes took lose loses lost get gets got gain gains gained commander damage poison life
   i i'm im me my myself monarch monarchy patriarch patriarchy asterisk asterisks star stars misplay misplays turn round
   number it it's its is are am the a an to too for of remove back away minus undo everyone everybody each player players
   all us table opponent opponents else others actually please point points now one`
    .split(/\s+/)
    .concat(Object.keys(NUMS)),
);

/** Runs of 1–3 unknown words that sound like a name at this table. */
function guesses(t: string, g: LiveGame): Guess[] {
  // only names that make sense in that spot: players anywhere, commanders only after "from" in commander damage
  const players = new Map<string, string>(); // as spoken → as written
  const cards = new Map<string, string>();
  for (const p of g.config.players)
    for (const [n, min, to] of [[p.name, 3, players], [p.commander?.name, 4, cards], [p.hasPartner ? p.partner?.name : '', 4, cards]] as const) {
      const full = clean(n ?? '');
      if (!full) continue;
      to.set(full, n!.trim());
      if (full.split(' ')[0].length >= min) to.set(full.split(' ')[0], n!.trim().split(/[\s,]/)[0]);
    }
  const words = t.split(' ');
  const used = new Set<number>();
  const out: Guess[] = [];
  for (let len = 3; len >= 1; len--)
    for (let i = 0; i + len <= words.length; i++) {
      const run = words.slice(i, i + len);
      // "the"/"of" may sit inside a name ("norin the wary"), never at its ends
      if (run.some((w, j) => GRAMMAR.has(w) && (j === 0 || j === len - 1 || !['the', 'of'].includes(w)) || /^\d+$/.test(w))) continue;
      if (run.some((_, j) => used.has(i + j))) continue;
      const heard = run.join(' ');
      if (heard.length < 3 || players.has(heard) || cards.has(heard)) continue;
      const before = words.slice(0, i);
      const clauseStart = Math.max(before.lastIndexOf('and'), before.lastIndexOf('then'));
      const clauseWords = words.slice(clauseStart + 1);
      const afterFrom = before.lastIndexOf('from') > clauseStart && clauseWords.includes('commander');
      const pool = afterFrom ? new Map([...players, ...cards]) : players;
      // best and runner-up, counting each person or card once
      const best = new Map<string, number>();
      for (const [n, written] of pool) best.set(written, Math.max(best.get(written) ?? 0, similarity(heard, n)));
      const [[meant, top] = ['', 0], [, next] = ['', 0]] = [...best].sort((a, b) => b[1] - a[1]);
      if (top < 0.6) continue;
      run.forEach((_, j) => used.add(i + j));
      // a clear winner at the table needs no question; very short words are too easy to mishear to be sure
      out.push({ heard, meant, sure: top - next >= 0.25 && heard.length >= 4 });
    }
  return out;
}

// rough "sounds like" spelling so kodi/cody and kristen/christen line up
const sound = (s: string) =>
  s.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/[yi]+/g, 'i').replace(/z/g, 's').replace(/(.)\1+/g, '$1');

// consonants only, so vowels the phone swaps around ("erin" / "aaron") still line up
const skeleton = (s: string) => sound(s).replace(/[aeiou ]/g, '');

function similarity(a: string, b: string) {
  const ratio = (x: string, y: string) => 1 - distance(x, y) / Math.max(x.length, y.length, 1);
  const heard = ratio(sound(a), sound(b));
  return Math.max(ratio(a, b), heard, (heard + ratio(skeleton(a), skeleton(b))) / 2);
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function parseExact(text: string, g: LiveGame, speaker: number): Heard {
  const t = clean(text);
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
