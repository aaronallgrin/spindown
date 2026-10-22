import { useEffect, useState } from 'react';
import { Link, useNavigate } from '../nav';
import { BRACKETS } from '../types';
import { Btn, Page } from '../ui';
import { FORMATS, StatusChip, formatLine } from '../components/PollBits';
import {
  addDays,
  createPoll,
  dayShort,
  hourShort,
  isoDay,
  listPolls,
  playerName,
  pollRange,
  pollsCfg,
  setPlayerName,
  type Poll,
} from '../polls';

/** Polls the group has running, newest first. */
export default function FindGame() {
  const cfg = pollsCfg();
  const [data, setData] = useState<{ polls: Poll[]; counts: Record<string, number> } | null>(null);
  const [err, setErr] = useState('');

  const cfgUrl = cfg?.url;
  useEffect(() => {
    if (!cfgUrl) return;
    let alive = true;
    const load = () =>
      listPolls()
        .then((d) => alive && (setData(d), setErr('')))
        .catch((e: Error) => alive && setErr(e.message));
    load();
    const t = window.setInterval(() => document.visibilityState === 'visible' && load(), 30_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [cfgUrl]);

  if (!cfg)
    return (
      <Page title="Find a game">
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-felt-2 p-4 text-dim">
            Polls are shared through your group's Supabase. Turn on cloud sync on this phone, or open a poll link a friend sent you.
          </p>
          <Link to="/sync" className="rounded-xl bg-brass px-4 py-3 text-center font-semibold text-felt">
            Set up cloud sync
          </Link>
        </div>
      </Page>
    );

  return (
    <Page title="Find a game">
      <div className="flex flex-col gap-4">
        <Link
          to="/find/new"
          className="rounded-2xl bg-brass py-4 text-center font-cond text-2xl font-bold text-felt shadow-[0_10px_30px_-10px_rgba(255,163,26,.6)]"
        >
          Start a poll
        </Link>
        {err && <p className="rounded-xl bg-blood/15 p-3 text-sm">{err}</p>}
        {!data && !err && <p className="text-dim">Loading polls</p>}
        {data && data.polls.length === 0 && (
          <p className="rounded-2xl bg-felt-2/80 px-4 py-5 text-dim">
            No polls yet. Start one, pick the days that might work, and send the link to your group.
          </p>
        )}
        {data && data.polls.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {data.polls.map((p) => (
              <Link
                key={p.id}
                to={`/poll/${p.id}`}
                className="flex flex-col gap-1 rounded-2xl bg-felt-2/80 px-4 py-3 ring-1 ring-white/[.05] transition hover:bg-felt-3"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate font-cond text-xl font-bold">{p.title}</span>
                  <StatusChip p={p} />
                </span>
                <span className="text-sm text-dim">
                  {formatLine(p)} · {pollRange(p)} · {data.counts[p.id] ?? 0} answered
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

// ---------- start a poll ----------

const nextFriday = () => {
  let d = addDays(new Date(), 1);
  while (d.getDay() !== 5) d = addDays(d, 1);
  return d;
};

export function NewPoll() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('Commander');
  const [brackets, setBrackets] = useState<number[]>([2, 3]);
  const [days, setDays] = useState<string[]>(() => [0, 1, 2].map((i) => isoDay(addDays(nextFriday(), i))));
  const [startH, setStartH] = useState(17);
  const [endH, setEndH] = useState(23);
  const [length, setLength] = useState(3);
  const [needed, setNeeded] = useState(4);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState(playerName());
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const upcoming = Array.from({ length: 14 }, (_, i) => isoDay(addDays(new Date(), i + 1)));
  const toggleDay = (d: string) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : cur.length < 7 ? [...cur, d] : (setMsg('Pick up to 7 days.'), cur)));
  const toggleBracket = (n: number) => setBrackets((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort()));

  const submit = async () => {
    setMsg('');
    if (!name.trim()) return setMsg('Add your name so the group knows who’s hosting.');
    if (!days.length) return setMsg('Pick at least one day.');
    if (endH - startH < length) return setMsg(`The hours need to fit a ${length}-hour game.`);
    setPlayerName(name);
    setBusy(true);
    try {
      const id = await createPoll({
        title: title.trim() || `${format} night`,
        format,
        brackets: format === 'Commander' ? brackets : [],
        needed,
        length_h: length,
        start_h: startH,
        end_h: endH,
        days,
        location: location.trim(),
        notes: notes.trim(),
      });
      nav(`/poll/${id}?new=1`, { replace: true });
    } catch (e) {
      setBusy(false);
      setMsg((e as Error).message);
    }
  };

  const pill = (on: boolean) =>
    `rounded-xl px-3 py-2 text-sm font-semibold transition ${on ? 'bg-brass text-felt' : 'bg-white/[.06] text-bone/85 hover:bg-white/10'}`;
  const field = 'rounded-lg bg-felt-2 px-3 py-3 placeholder:text-dim';
  const label = 'text-sm text-dim';
  const hours = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <Page title="Start a poll" back="/find">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className={label}>Name</span>
          <input id="poll-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder={`${format} night`} className={field} />
        </label>

        <div className="flex flex-col gap-2">
          <span className={label}>Format</span>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)} className={pill(format === f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {format === 'Commander' && (
          <div className="flex flex-col gap-2">
            <span className={label}>Brackets welcome</span>
            <div className="flex flex-wrap gap-2">
              {BRACKETS.map((b) => (
                <button
                  key={b.n}
                  type="button"
                  aria-pressed={brackets.includes(b.n)}
                  onClick={() => toggleBracket(b.n)}
                  className={`${pill(brackets.includes(b.n))} min-w-11 font-cond text-lg`}
                  title={b.name}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className={label}>Which days could work? Up to 7.</span>
          <div className="grid grid-cols-7 gap-1.5">
            {upcoming.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={dayShort(d)}
                  onClick={() => toggleDay(d)}
                  className={`flex flex-col items-center rounded-xl py-1.5 text-xs leading-tight transition ${
                    on ? 'bg-brass text-felt' : 'bg-white/[.06] text-bone/85 hover:bg-white/10'
                  }`}
                >
                  {dayShort(d).split(' ')[0]}
                  <b className="font-cond text-lg">{dayShort(d).split(' ')[1]}</b>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={label}>From</span>
            <select id="poll-start" value={startH} onChange={(e) => setStartH(+e.target.value)} className={field}>
              {hours(8, 22).map((h) => (
                <option key={h} value={h}>
                  {hourShort(h).replace('a', ' AM').replace('p', ' PM')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Until</span>
            <select id="poll-end" value={endH} onChange={(e) => setEndH(+e.target.value)} className={field}>
              {hours(10, 24).map((h) => (
                <option key={h} value={h}>
                  {h === 24 ? 'Midnight' : hourShort(h).replace('a', ' AM').replace('p', ' PM')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Game length</span>
            <select id="poll-length" value={length} onChange={(e) => setLength(+e.target.value)} className={field}>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} hours
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Players needed</span>
            <select id="poll-needed" value={needed} onChange={(e) => setNeeded(+e.target.value)} className={field}>
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className={label}>Where</span>
          <input id="poll-where" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={60} placeholder="Someone’s place, the LGS…" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Notes</span>
          <textarea id="poll-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} rows={2} placeholder="Bring 2 decks, proxies OK…" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Your name</span>
          <input id="poll-host" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="How the group knows you" className={field} />
        </label>

        {msg && <p className="rounded-lg bg-blood/15 p-3 text-sm">{msg}</p>}
        <Btn variant="primary" type="submit" disabled={busy} className="py-3.5 font-cond text-2xl font-bold">
          {busy ? 'Creating' : 'Create poll'}
        </Btn>
      </form>
    </Page>
  );
}
