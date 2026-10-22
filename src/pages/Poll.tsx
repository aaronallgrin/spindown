import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Link, useNavigate } from '../nav';
import ConfirmBtn from '../components/ConfirmBtn';
import { Btn, Page } from '../ui';
import { StatusChip, formatLine } from '../components/PollBits';
import {
  acceptPollCode,
  bestTimes,
  dayLong,
  dayShort,
  deletePoll,
  dowShort,
  eventFor,
  getPoll,
  googleCalUrl,
  hourLong,
  hourShort,
  icsHref,
  isApple,
  parseDay,
  playerKey,
  playerName,
  pollsCfg,
  saveResponse,
  setPlayerName,
  setScheduled,
  shareLink,
  type Poll as PollT,
  type PollResponse,
} from '../polls';

/** One poll: mark your hours, see the group's overlap, lock in a time, add it to the calendar. */
export default function Poll() {
  const { id = '' } = useParams();
  const [search] = useSearchParams();
  const nav = useNavigate();
  const me = playerKey();

  const [poll, setPoll] = useState<PollT | null | undefined>(undefined);
  const [responses, setResponses] = useState<PollResponse[]>([]);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'mine' | 'group'>('mine');
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [name, setName] = useState(playerName());
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [peek, setPeek] = useState<string | null>(null);

  // a shared link carries the group's connection; keep it and tidy the address
  const code = search.get('c');
  const [linkOk] = useState(() => (code ? acceptPollCode(code) : true));
  useEffect(() => {
    if (code && linkOk) nav(`/poll/${id}`, { replace: true });
  }, [code, linkOk, id, nav]);

  const load = useCallback(async () => {
    try {
      const r = await getPoll(id);
      setPoll(r.poll);
      setResponses(r.responses);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    if (!pollsCfg()) return;
    load();
    const t = window.setInterval(() => document.visibilityState === 'visible' && load(), 15_000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const flash = (s: string) => {
    setNote(s);
    window.setTimeout(() => setNote(''), 2500);
  };

  const saved = responses.find((r) => r.player_key === me);
  const mine = useMemo(() => draft ?? new Set(saved?.slots ?? []), [draft, saved]);
  const dirty = draft !== null;

  // the group as it would look with my unsaved changes
  const everyone = useMemo(() => {
    const others = responses.filter((r) => r.player_key !== me);
    return mine.size ? [...others, { poll_id: id, player_key: me, name: name.trim() || 'You', slots: [...mine] }] : others;
  }, [responses, mine, me, id, name]);
  const nameOf = (k: string) => (k === me ? name.trim() || 'You' : everyone.find((r) => r.player_key === k)?.name || 'Someone');

  if (!linkOk)
    return (
      <Page title="Poll" back="/find">
        <p className="rounded-xl bg-blood/15 p-4">This poll link is damaged. Ask for the link again.</p>
      </Page>
    );
  if (!pollsCfg())
    return (
      <Page title="Poll" back="/find">
        <p className="rounded-xl bg-felt-2 p-4 text-dim">This phone isn’t connected to your group. Open the poll from the link your group sent.</p>
      </Page>
    );
  if (poll === undefined)
    return (
      <Page title="Poll" back="/find">
        {err ? <p className="rounded-xl bg-blood/15 p-4">{err}</p> : <p className="text-dim">Loading poll</p>}
      </Page>
    );
  if (poll === null)
    return (
      <Page title="Poll" back="/find">
        <p className="rounded-xl bg-felt-2 p-4 text-dim">This poll was deleted by its host.</p>
      </Page>
    );

  const host = poll.host_key === me;
  const best = bestTimes(poll, everyone);

  const save = async () => {
    if (!name.trim()) return flash('Add your name first.');
    setPlayerName(name);
    setSaving(true);
    try {
      await saveResponse(poll.id, [...mine]);
      await load();
      setDraft(null);
      flash('Saved. The group can see it now.');
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const lock = async (day: string, hour: number, free: string[]) => {
    try {
      await setScheduled(poll.id, { date: day, hour, players: free.map(nameOf) });
      await load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const share = async () => {
    const url = shareLink(poll.id);
    const text = `${poll.title}: when can you play? Mark your hours in Spindown.`;
    try {
      if (navigator.share) return await navigator.share({ title: poll.title, text, url });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash('Link copied. Paste it in your group chat.');
    } catch {
      flash(url);
    }
  };

  return (
    <Page
      title={poll.title}
      back="/find"
      action={
        <Btn onClick={share} className="!px-3 text-sm">
          Share
        </Btn>
      }
    >
      <div className="flex flex-col gap-4">
        {search.get('new') && !poll.scheduled && (
          <div className="rounded-xl bg-brass/15 p-4 text-sm">
            <p className="mb-3">Poll created. Mark your own hours below, then send the link to your group.</p>
            <Btn variant="primary" onClick={share} className="w-full">
              Send the link
            </Btn>
          </div>
        )}

        {poll.scheduled && <Locked poll={poll} host={host} onReopen={() => setScheduled(poll.id, null).then(load).catch((e: Error) => flash(e.message))} />}

        <div className="rounded-2xl bg-felt-2/80 p-4 ring-1 ring-white/[.05]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-dim">
              {formatLine(poll)} · {poll.length_h}h game · {poll.needed} players
            </span>
            <StatusChip p={poll} />
          </div>
          {poll.location && <div className="mt-1">{poll.location}</div>}
          {poll.notes && <div className="mt-1 text-sm text-dim">{poll.notes}</div>}
          <div className="mt-1 text-sm text-dim">Hosted by {poll.host_name}</div>
        </div>

        <div className="flex rounded-full bg-white/[.05] p-1 ring-1 ring-white/[.05]" role="tablist">
          {(
            [
              ['mine', 'My hours'],
              ['group', `Group · ${everyone.length}`],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => (setTab(v), setPeek(null))}
              className={`flex-1 rounded-full px-2 py-2 text-sm transition ${tab === v ? 'bg-bone font-semibold text-felt shadow' : 'text-dim hover:text-bone'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'mine' ? (
          <>
            <p className="text-sm text-dim">Tap or drag across the hours you could play. Drag again to clear.</p>
            <Grid poll={poll} mode="mine" mine={mine} onChange={(s) => setDraft(s)} />
            <label className="flex flex-col gap-1">
              <span className="text-sm text-dim">Your name</span>
              <input
                id="poll-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!draft) setDraft(new Set(mine));
                }}
                maxLength={24}
                placeholder="How the group knows you"
                className="rounded-lg bg-felt-2 px-3 py-3 placeholder:text-dim"
              />
            </label>
            <div className="sticky bottom-4 z-20">
              <Btn variant="primary" onClick={save} disabled={saving || (!dirty && !!saved)} className="w-full py-3.5 font-cond text-xl font-bold shadow-lg">
                {saving ? 'Saving' : dirty || !saved ? 'Save my hours' : 'Saved'}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <Grid poll={poll} mode="group" responses={everyone} peek={peek} onPeek={setPeek} />
            {peek && (
              <div className="rounded-xl bg-felt-2 p-3">
                <div className="mb-1.5 text-sm text-dim">
                  {dayShort(peek.split('|')[0])} · {hourShort(+peek.split('|')[1])}–{hourShort(+peek.split('|')[1] + 1)}
                </div>
                <Names
                  all={everyone.map((r) => r.player_key)}
                  on={everyone.filter((r) => r.slots.includes(peek)).map((r) => r.player_key)}
                  nameOf={nameOf}
                />
              </div>
            )}
            {!everyone.length && <p className="text-sm text-dim">Nobody has answered yet.</p>}
          </>
        )}

        <h2 className="mt-2 px-1 font-cond text-xl font-semibold">Best {poll.length_h}-hour windows</h2>
        {best.length === 0 && <p className="px-1 text-sm text-dim">No window fits anyone yet.</p>}
        {best.map((w) => {
          const full = w.free.length >= poll.needed;
          const isLocked = poll.scheduled?.date === w.day && poll.scheduled.hour === w.hour;
          return (
            <div key={`${w.day}|${w.hour}`} className={`flex items-center gap-3 rounded-2xl p-3.5 ${isLocked ? 'bg-mana-g/10 ring-1 ring-mana-g/60' : 'bg-felt-2/80 ring-1 ring-white/[.05]'}`}>
              <div className={`w-12 text-center font-cond text-3xl font-bold tabular-nums ${full ? 'text-mana-g' : ''}`}>
                {w.free.length}
                <span className="text-base text-dim">/{poll.needed}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-cond text-lg font-bold">
                  {dayShort(w.day)} · {hourShort(w.hour)}–{hourShort(w.hour + poll.length_h)}
                </div>
                <Names all={w.free} on={w.free} nameOf={nameOf} />
                <div className={`mt-1 text-xs ${full ? 'text-mana-g' : 'text-dim'}`}>{full ? 'Pod is full' : `Needs ${poll.needed - w.free.length} more`}</div>
              </div>
              {host && !isLocked && (
                <Btn variant={full ? 'primary' : 'quiet'} onClick={() => lock(w.day, w.hour, w.free)} className="shrink-0 text-sm">
                  Lock in
                </Btn>
              )}
            </div>
          );
        })}
        {!host && !poll.scheduled && <p className="px-1 text-sm text-dim">{poll.host_name} locks in the time once enough people answer.</p>}

        {host && (
          <ConfirmBtn
            variant="quiet"
            onConfirm={() =>
              deletePoll(poll.id)
                .then(() => nav('/find', { replace: true }))
                .catch((e: Error) => flash(e.message))
            }
            confirmLabel="Tap again to delete this poll for everyone"
            className="mt-6"
          >
            Delete poll
          </ConfirmBtn>
        )}
        <Link to="/find" className="text-center text-sm text-dim hover:text-bone">
          All polls
        </Link>
      </div>

      {note && (
        <div className="fixed inset-x-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-xl bg-bone px-4 py-3 text-center text-sm font-semibold break-all text-felt shadow-xl">
          {note}
        </div>
      )}
    </Page>
  );
}

function Names({ all, on, nameOf }: { all: string[]; on: string[]; nameOf: (k: string) => string }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {all.map((k) => (
        <span key={k} className={`rounded-md bg-white/[.07] px-2 py-px text-xs ${on.includes(k) ? '' : 'line-through opacity-45'}`}>
          {nameOf(k)}
        </span>
      ))}
    </div>
  );
}

/** The locked-in game and the buttons that put it on a phone's calendar. */
function Locked({ poll, host, onReopen }: { poll: PollT; host: boolean; onReopen: () => void }) {
  const e = eventFor(poll)!;
  const s = poll.scheduled!;
  const apple = isApple();
  const file = `${poll.title.replace(/[^\w -]+/g, '').trim() || 'game'}.ics`;
  const appleBtn = (
    <a key="apple" href={icsHref(e)} download={file} className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold ${apple ? 'bg-brass text-felt' : 'bg-white/[.06] text-bone'}`}>
      Apple Calendar
    </a>
  );
  const googleBtn = (
    <a key="google" href={googleCalUrl(e)} target="_blank" rel="noopener" className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold ${apple ? 'bg-white/[.06] text-bone' : 'bg-brass text-felt'}`}>
      Google Calendar
    </a>
  );
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-mana-g/10 p-4 ring-1 ring-mana-g/60">
      <div className="text-xs font-semibold tracking-widest text-mana-g uppercase">Game locked in</div>
      <div className="font-cond text-3xl leading-none font-bold">{dayLong(s.date)}</div>
      <div>
        {hourLong(s.hour)} – {hourLong(s.hour + poll.length_h)}
        {poll.location && ` · ${poll.location}`}
      </div>
      {s.players.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {s.players.map((n, i) => (
            <span key={i} className="rounded-md bg-white/[.08] px-2 py-px text-xs">
              {n}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">{apple ? [appleBtn, googleBtn] : [googleBtn, appleBtn]}</div>
      {parseDay(s.date) < new Date(new Date().toDateString()) && <p className="text-xs text-dim">This game has already happened.</p>}
      {host && (
        <button onClick={onReopen} className="self-start text-sm text-dim underline-offset-2 hover:text-bone hover:underline">
          Reopen the poll
        </button>
      )}
    </div>
  );
}

/** Days across, hours down. "mine" paints by tap or drag; "group" shades by how many are free. */
function Grid(
  props:
    | { poll: PollT; mode: 'mine'; mine: Set<string>; onChange: (s: Set<string>) => void }
    | { poll: PollT; mode: 'group'; responses: PollResponse[]; peek: string | null; onPeek: (k: string | null) => void },
) {
  const { poll } = props;
  const days = [...poll.days].sort();
  const hours = Array.from({ length: poll.end_h - poll.start_h }, (_, i) => poll.start_h + i);
  const paint = useRef<{ on: boolean; last: string } | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    if (props.mode === 'group') for (const r of props.responses) for (const s of r.slots) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [props]);
  const total = props.mode === 'group' ? Math.max(1, props.responses.length) : 1;

  const touch = (key: string | undefined) => {
    if (props.mode !== 'mine' || !key || !paint.current || paint.current.last === key) return;
    paint.current.last = key;
    const next = new Set(props.mine);
    if (paint.current.on) next.add(key);
    else next.delete(key);
    props.onChange(next);
  };
  const keyAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-k]')?.dataset.k;

  useEffect(() => {
    const up = () => (paint.current = null);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[280px] gap-[3px] select-none"
        style={{ gridTemplateColumns: `2.25rem repeat(${days.length}, minmax(0, 1fr))`, touchAction: props.mode === 'mine' ? 'none' : 'auto' }}
        onPointerDown={(e) => {
          if (props.mode !== 'mine') return;
          const k = keyAt(e.clientX, e.clientY);
          if (!k) return;
          e.preventDefault();
          paint.current = { on: !props.mine.has(k), last: '' };
          touch(k);
        }}
        onPointerMove={(e) => paint.current && touch(keyAt(e.clientX, e.clientY))}
      >
        <div />
        {days.map((d) => (
          <div key={d} className="pb-1 text-center font-cond text-xs leading-tight text-dim">
            {dowShort(d)}
            <b className="block text-lg text-bone">{parseDay(d).getDate()}</b>
          </div>
        ))}
        {hours.map((h) => (
          <Row key={h} h={h} days={days}>
            {(k) => {
              if (props.mode === 'mine') {
                const on = props.mine.has(k);
                return (
                  <button
                    key={k}
                    data-k={k}
                    aria-pressed={on}
                    aria-label={`${dayShort(k.split('|')[0])} ${hourShort(h)}`}
                    onKeyDown={(e) => {
                      if (e.key !== ' ' && e.key !== 'Enter') return;
                      e.preventDefault();
                      const next = new Set(props.mine);
                      if (on) next.delete(k);
                      else next.add(k);
                      props.onChange(next);
                    }}
                    className={`h-8 rounded-md transition-colors ${on ? 'bg-brass' : 'bg-felt-2 hover:bg-felt-3'}`}
                  />
                );
              }
              const c = counts[k] ?? 0;
              const a = c ? 0.18 + (0.82 * c) / total : 0;
              return (
                <button
                  key={k}
                  aria-label={`${dayShort(k.split('|')[0])} ${hourShort(h)}: ${c} free`}
                  onClick={() => props.onPeek(props.peek === k ? null : k)}
                  className={`relative h-8 rounded-md ${c ? '' : 'bg-felt-2'} ${props.peek === k ? 'ring-2 ring-bone' : ''}`}
                  style={c ? { background: `rgb(255 163 26 / ${a})` } : undefined}
                >
                  {c > 0 && <span className={`text-[11px] font-bold ${a > 0.5 ? 'text-felt' : 'text-bone'}`}>{c}</span>}
                </button>
              );
            }}
          </Row>
        ))}
      </div>
    </div>
  );
}

function Row({ h, days, children }: { h: number; days: string[]; children: (k: string) => ReactNode }) {
  return (
    <>
      <div className="-translate-y-2 pr-1 text-right text-[11px] text-dim tabular-nums">{hourShort(h)}</div>
      {days.map((d) => children(`${d}|${h}`))}
    </>
  );
}
