import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useNavigate } from '../nav';
import { Btn, Page } from '../ui';
import { Elf } from '../components/Elf';
import { confetti } from '../confetti';
import { playerName, setPlayerName } from '../polls';
import { pushState, turnOn, type PushState } from '../push';
import {
  HOST,
  LEAGUE,
  PDH_HOME,
  SANTA_PLAYERS,
  SIZE,
  isUnboxed,
  loadExchange,
  myMatch,
  mySignup,
  setUnboxing,
  signUp,
  standings,
  type Exchange,
  type Signup,
} from '../santa';

const SEEN = 'spindown.santaSeen';

/** Pauper Secret Santa: sign up, get your match, then the Holiday League. */
export default function Santa() {
  const nav = useNavigate();
  const [x, setX] = useState<Exchange | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    loadExchange().then(
      (e) => {
        setX(e);
        setErr('');
      },
      (e) => setErr(e instanceof Error ? e.message : 'Couldn’t load the exchange.'),
    );
  }, []);
  useEffect(() => {
    load();
    try {
      localStorage.setItem(SEEN, '1');
    } catch {
      /* private mode */
    }
  }, [load]);

  const go = (v: 'signup' | 'reveal') => nav(`/santa/${v}`);

  return (
    <Page title="Pauper Secret Santa">
      <svg className="-mt-3 mb-3 block h-3 w-48" viewBox="0 0 190 12" aria-hidden>
        <path d="M2 7 C 22 2, 34 11, 55 6 S 92 2, 110 7 S 150 11, 168 5 C 175 3, 181 4, 187 8" fill="none" stroke="#FFA31A" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <p className="text-dim">You build a Pauper Commander deck for one of us. Someone builds one for you. Nobody knows who.</p>
      <p className="mt-1 font-semibold text-bone">$20 cap, deck box included</p>
      <p className="text-[11px] text-brass">IP by Andrew</p>

      {err && <p className="mt-4 rounded-xl bg-blood/20 px-4 py-3 text-sm">{err}</p>}
      {!x && !err && <p className="mt-6 text-dim">Loading…</p>}
      {x && <Body x={x} go={go} reload={load} />}
    </Page>
  );
}

function Body({ x, go, reload }: { x: Exchange; go: (v: 'signup' | 'reveal') => void; reload: () => void }) {
  const nav = useNavigate();
  const n = x.signups.length;
  const mine = mySignup();
  const unboxed = isUnboxed(x.unboxing);
  const league = x.drawn && <League names={x.signups.map((s) => s.name)} startGame={() => startLeagueGame(nav)} />;

  return (
    <>
      {unboxed && league}

      <Card>
        <h3 className="font-cond text-lg font-bold text-brass">
          {x.drawn ? 'Names are drawn' : n === SIZE - 1 ? 'One more and we draw' : `${n} of ${SIZE} in. Waiting on ${SIZE - n}`}
        </h3>
        <div className="my-2 h-2 overflow-hidden rounded bg-felt">
          <div className="h-full bg-brass transition-all" style={{ width: `${(n / SIZE) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {x.signups.map((s) => (
            <span key={s.name} className="rounded-full bg-felt px-2.5 py-1 text-sm">
              {s.name}
            </span>
          ))}
        </div>
      </Card>

      {x.drawn ? (
        <Btn variant="primary" className="w-full py-4 font-cond text-xl" onClick={() => go('reveal')}>
          Find out who you’re building for
        </Btn>
      ) : mine ? (
        <>
          <p className="py-2 text-center text-dim">You’re in, {mine}. We draw when everyone’s signed up</p>
          <NotifyNudge name={mine} />
        </>
      ) : (
        <Btn variant="primary" className="w-full py-4 font-cond text-xl" onClick={() => go('signup')}>
          Sign up
        </Btn>
      )}

      <a href={PDH_HOME} target="_blank" rel="noopener" className="block">
        <Card>
          <Duo a="Pauper" b="Commander" c="rules" />
          <ul className="list-disc space-y-1 pl-5 text-[15px]">
            <li>Commander: any creature printed at uncommon (doesn’t need to be legendary). Partners OK if both are uncommon</li>
            <li>The other 99: cards printed at common in paper or on MTGO. Singleton, basics excepted</li>
            <li>30 starting life. 16 damage from one commander kills</li>
            <li>Follow the PDH Home Base ban list</li>
          </ul>
          <p className="mt-2.5 text-sm text-brass">Full rules and ban list at PDH Home Base ›</p>
        </Card>
      </a>

      <Card>
        <Duo a="House" b="rules" />
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          <li>Sleeve it in old sleeves you already have</li>
          <li>Make a deck box for it. Cardboard and tape counts</li>
          <li>$20 cap, deck box included</li>
          <li>Include the tokens and counters the deck needs</li>
          <li>Tuck in a note: what the deck wants to do, and one card to watch for</li>
          <li>Respect their “avoid” list</li>
          <li>Don’t tell anyone who you drew until the reveal on Unboxing Day</li>
        </ul>
      </Card>

      <Card>
        <Duo a="Unboxing" b="Day" />
        <UnboxingDate date={x.unboxing} reload={reload} />
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          <li>Everyone brings their wrapped deck. Open them together</li>
          <li>Name tag on the deck box or the wrapping, so the right person grabs it</li>
          <li>Play your new deck right away, in pods</li>
          <li>After the first game, everyone guesses who built theirs. Then the Santas reveal</li>
        </ul>
      </Card>

      {!unboxed && league}
    </>
  );
}

function League({ names, startGame }: { names: string[]; startGame: () => void }) {
  const games = useLiveQuery(() => db.games.toArray(), []);
  const rows = standings(games ?? [], names);
  const top = rows[0]?.wins ?? 0;
  return (
    <Card>
      <Duo a="Holiday" b="League" />
      <p className="mb-2 text-sm text-dim">
        Gift decks only. A win is a point, counted from Spindown games tagged {LEAGUE}. Whoever has the most when it wraps up is Holiday Champion, and gets to be insufferable about it until next year.
      </p>
      <ul>
        {rows.map((r) => (
          <li key={r.name} className="flex items-center border-b border-white/[.06] py-1.5 last:border-0">
            <span>
              {r.name}
              {top > 0 && r.wins === top && <span className="ml-1.5 text-xs text-brass">leads</span>}
            </span>
            <span className="ml-auto font-cond text-lg font-bold text-brass">{r.wins}</span>
          </li>
        ))}
      </ul>
      <Btn className="mt-3 w-full" onClick={startGame}>
        Start a league game
      </Btn>
    </Card>
  );
}

/** Pre-set New game to Pauper Commander with the league tag, then open it. */
function startLeagueGame(nav: ReturnType<typeof useNavigate>) {
  const KEY = 'spindown.newGame.v2';
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}');
    localStorage.setItem(KEY, JSON.stringify({ ...p, kind: 'commander', pauper: true, league: LEAGUE }));
  } catch {
    /* falls back to whatever New game remembers */
  }
  nav('/new');
}

function UnboxingDate({ date, reload }: { date: string | null; reload: () => void }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(date ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const host = playerName().toLowerCase() === HOST.toLowerCase();
  const pretty = date && new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const save = async () => {
    setBusy(true);
    try {
      await setUnboxing(val || null);
      setEdit(false);
      reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Couldn’t save.');
    }
    setBusy(false);
  };

  return (
    <div className="mb-2">
      {edit ? (
        <div className="flex gap-2">
          <input type="date" value={val} onChange={(e) => setVal(e.target.value)} className="min-w-0 flex-1 rounded-xl bg-white/[.06] px-3 py-2 text-bone" />
          <Btn variant="primary" disabled={busy} onClick={save}>
            Save
          </Btn>
        </div>
      ) : (
        <p className="text-dim">
          {pretty ?? 'Date TBD'}
          {host && (
            <button type="button" onClick={() => setEdit(true)} className="ml-2 text-sm text-brass">
              {date ? 'Change' : 'Set the date'}
            </button>
          )}
        </p>
      )}
      {note && <p className="text-sm text-dim">{note}</p>}
    </div>
  );
}

/** After signing up: offer a heads-up for the draw, if this phone can and hasn't said yes yet. */
function NotifyNudge({ name }: { name: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);
  if (state !== 'off') return null;
  return (
    <div className="text-center">
      <Btn
        className="w-full"
        onClick={() =>
          turnOn(name).then(
            () => setState('on'),
            (e) => setNote(e instanceof Error ? e.message : 'That didn’t work.'),
          )
        }
      >
        Tell me when names are drawn
      </Btn>
      {note && <p className="mt-1 text-sm text-dim">{note}</p>}
    </div>
  );
}

export function SantaSignUp() {
  const nav = useNavigate();
  const [taken, setTaken] = useState<string[] | null>(null);
  useEffect(() => {
    loadExchange().then(
      (x) => setTaken(x.signups.map((s) => s.name)),
      () => setTaken([]),
    );
  }, []);
  const open = SANTA_PLAYERS.filter((n) => !taken?.includes(n));
  const [name, setName] = useState('');
  const picked = name || (taken && open.includes(playerName()) ? playerName() : '');
  const [theme, setTheme] = useState('');
  const [avoid, setAvoid] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = picked;
    if (!name) return setErr('Tap your name first.');
    if (!theme.trim()) return setErr('Give your Santa something to work with.');
    setBusy(true);
    setErr('');
    try {
      await signUp({ name, theme: theme.trim(), avoid: avoid.trim() });
      setPlayerName(name);
      nav('/santa', { replace: true });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'That didn’t go through.');
      setBusy(false);
    }
  };

  return (
    <Page title="Sign up" back="/santa">
      <p className="text-dim">This is all your Santa gets. Specific helps. Leave a little room to be surprised.</p>
      <form onSubmit={submit}>
        <p className="mt-5 mb-2 text-sm text-dim">Who are you?</p>
        <div className="flex flex-wrap gap-2">
          {open.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === picked}
              onClick={() => setName(n)}
              className={`rounded-full px-4 py-2 font-cond text-lg transition ${n === picked ? 'bg-brass font-bold text-felt' : 'bg-felt-2 text-bone ring-1 ring-white/10'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="mt-5 mb-1.5 block text-sm text-dim" htmlFor="theme">
          Theme, vibe, colors, mechanics you want
        </label>
        <textarea
          id="theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          maxLength={400}
          placeholder="Golgari graveyard stuff. Squirrels. Something that goes wide"
          className="min-h-24 w-full rounded-xl bg-white/[.06] p-3 text-bone placeholder:text-dim"
        />
        <label className="mt-4 mb-1.5 block text-sm text-dim" htmlFor="avoid">
          Please avoid (optional)
        </label>
        <textarea
          id="avoid"
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          maxLength={300}
          placeholder="No mill. Already have a Rakdos deck"
          className="min-h-20 w-full rounded-xl bg-white/[.06] p-3 text-bone placeholder:text-dim"
        />
        <p className="min-h-5 py-1 text-sm text-blood">{err}</p>
        <Btn variant="primary" type="submit" disabled={busy} className="w-full py-4 font-cond text-xl">
          {busy ? 'Signing up…' : 'Sign up'}
        </Btn>
      </form>
    </Page>
  );
}

export function SantaReveal() {
  const [match, setMatch] = useState<Signup | null | undefined>(undefined);
  const [shown, setShown] = useState(false);
  const [pop, setPop] = useState(0);
  const [err, setErr] = useState('');
  const card = useRef<HTMLDivElement>(null);
  const me = mySignup() ?? playerName();

  const show = async () => {
    try {
      const m = match === undefined ? await myMatch() : match;
      setMatch(m);
      if (!m) return;
      setShown(true);
      setPop((p) => p + 1);
      confetti(card.current);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn’t check.');
    }
  };

  return (
    <Page title="Your match" back="/santa">
      <p className="text-dim">Just you and your screen{me ? `, ${me}` : ''}. Hit Hide before anyone looks over</p>
      <div ref={card} className="relative mt-16 rounded-2xl bg-felt-2 px-5 py-8 text-center">
        <Elf pop={shown ? pop : 0} />
        {match === null ? (
          <p>This phone didn’t sign up, so there’s no match here. Open Spindown on the phone you signed up with.</p>
        ) : shown && match ? (
          <>
            <p className="text-dim">You’re building for</p>
            <p className="my-2 font-cond text-4xl font-extrabold text-brass">{match.name}</p>
            <div className="text-left">
              <h3 className="font-cond text-lg font-bold text-brass">Theme / vibe</h3>
              <p className="mb-3 whitespace-pre-wrap">{match.theme}</p>
              {match.avoid && (
                <>
                  <h3 className="font-cond text-lg font-bold text-brass">Avoid</h3>
                  <p className="whitespace-pre-wrap">{match.avoid}</p>
                </>
              )}
            </div>
            <Btn className="mt-5 w-full" onClick={() => setShown(false)}>
              Hide
            </Btn>
          </>
        ) : (
          <Btn variant="primary" className="w-full py-4 font-cond text-xl" onClick={show}>
            Tap to reveal
          </Btn>
        )}
        {err && <p className="mt-2 text-sm text-dim">{err}</p>}
      </div>
    </Page>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="my-3 rounded-2xl bg-felt-2 px-4 py-3.5">{children}</section>;
}

/** Heading in the logo's style: white word, second word black on orange. */
function Duo({ a, b, c }: { a: string; b: string; c?: string }) {
  return (
    <h3 className="mb-2 font-cond text-xl font-bold">
      {a} <span className="rounded-md bg-brass px-1.5 pb-0.5 text-felt">{b}</span>
      {c && ` ${c}`}
    </h3>
  );
}
