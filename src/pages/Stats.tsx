import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  applyFilters,
  byBracket,
  byColor,
  byColorCount,
  byDeck,
  byPlayer,
  bySubFormat,
  byTurnOrder,
  fastestWins,
  headToHead,
  outCauses,
  pct,
  summary,
  type Filters,
  type Row,
} from '../stats';
import { Page, Pips, fmtDate } from '../ui';

const FKEY = 'spindown.statsFilters';
const loadF = (): Filters => {
  try {
    return { format: 'all', players: 'all', days: 'all', player: 'all', ...JSON.parse(localStorage.getItem(FKEY) || '{}') };
  } catch {
    return { format: 'all', players: 'all', days: 'all', player: 'all' };
  }
};

export default function Stats() {
  const all = useLiveQuery(() => db.games.toArray(), []);
  const [f, setF] = useState<Filters>(loadF);
  const set = (p: Partial<Filters>) => {
    const n = { ...f, ...p };
    setF(n);
    try {
      localStorage.setItem(FKEY, JSON.stringify(n));
    } catch {
      /* ignore */
    }
  };

  const names = useMemo(
    () => [...new Set((all ?? []).flatMap((g) => g.players.map((p) => p.name)))].sort((a, b) => a.localeCompare(b)),
    [all],
  );
  const games = useMemo(() => applyFilters(all ?? [], f), [all, f]);
  const s = summary(games);
  const fair = games.length ? games.reduce((a, g) => a + 1 / g.playerCount, 0) / games.length : 0;
  const forPlayer = f.player === 'all' ? games : games.map((g) => ({ ...g, players: g.players.filter((p) => p.name === f.player) }));
  const isCmdr = f.format === 'commander' || (f.format === 'all' && games.some((g) => g.format === 'commander'));

  if (all === undefined) return <Page title="Stats">{null}</Page>;

  return (
    <Page title="Stats">
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          label="Format"
          value={f.format}
          onChange={(v) => set({ format: v as Filters['format'] })}
          options={[
            ['all', 'All formats'],
            ['commander', 'Commander'],
            ['constructed', 'Constructed'],
            ['other', 'Other'],
          ]}
        />
        <Select
          label="Players"
          value={String(f.players)}
          onChange={(v) => set({ players: v === 'all' ? 'all' : Number(v) })}
          options={[['all', 'Any table size'], ...[2, 3, 4, 5, 6].map((n) => [String(n), `${n} players`] as [string, string])]}
        />
        <Select
          label="When"
          value={String(f.days)}
          onChange={(v) => set({ days: v === 'all' ? 'all' : (Number(v) as Filters['days']) })}
          options={[
            ['all', 'All time'],
            ['30', 'Last 30 days'],
            ['90', 'Last 90 days'],
            ['365', 'Last year'],
          ]}
        />
        <Select
          label="Player"
          value={f.player}
          onChange={(v) => set({ player: v })}
          options={[['all', 'Everyone'], ...names.map((n) => [n, n] as [string, string])]}
        />
      </div>

      {games.length === 0 ? (
        <p className="rounded-xl bg-felt-2 p-5 text-dim">
          {all.length === 0 ? 'Stats appear once you save your first game.' : 'No saved games match these filters.'}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Games" value={String(s.games)} />
            <Tile label="Avg rounds" value={s.avgRounds.toFixed(1)} />
            <Tile label="Avg length" value={`${Math.round(s.avgMinutes)} min`} />
          </div>

          <Section title="Players" note={fair ? `A fair share of wins at these tables is ${pct(fair)}.` : undefined}>
            {byPlayer(games).map((r) => (
              <RateRow
                key={r.key}
                row={r}
                fair={fair}
                sub={`Avg finish ${(r.extra!.avgPlace as number).toFixed(1)}, * ${r.extra!.misplays}`}
              />
            ))}
          </Section>

          <Section title={isCmdr ? 'Commanders' : 'Decks'}>
            {byDeck(forPlayer)
              .slice(0, 15)
              .map((r) => (
                <RateRow key={r.key} row={r} fair={fair} sub={r.extra!.pilots as string} pips />
              ))}
          </Section>

          <Section title="Turn order" note="Win rate by position in the turn order.">
            {byTurnOrder(forPlayer).map((r) => (
              <RateRow key={r.key} row={r} fair={fair} label={`Went ${r.label}`} />
            ))}
          </Section>

          <Section title="Colors" note="A deck counts toward every color in its identity.">
            {byColor(forPlayer).map((r) => (
              <RateRow key={r.key} row={r} fair={fair} pips />
            ))}
            <div className="my-1 border-t border-line" />
            {byColorCount(forPlayer).map((r) => (
              <RateRow key={r.key} row={r} fair={fair} />
            ))}
          </Section>

          {byBracket(forPlayer).length > 0 && (
            <Section title="Brackets">
              {byBracket(forPlayer).map((r) => (
                <RateRow key={r.key} row={r} fair={fair} />
              ))}
            </Section>
          )}

          <CountSection title="How players went out" rows={outCauses(forPlayer)} />

          <CountSection
            title="Misplays *"
            rows={byPlayer(games)
              .map((r) => ({ key: r.key, label: r.label, n: r.extra!.misplays as number, per: (r.extra!.misplays as number) / r.games }))
              .filter((r) => r.n > 0)
              .sort((a, b) => b.n - a.n)}
            empty="Nobody has a * yet."
          />

          <Section title="Fastest wins">
            {fastestWins(f.player === 'all' ? games : games.filter((g) => g.winnerName === f.player)).map(({ g, w }) => (
              <Link key={g.id} to={`/history/${g.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-felt-3">
                <span className="w-16 shrink-0 font-cond text-lg font-bold text-brass">Round {g.rounds}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{w.name}</span>
                  <span className="flex items-center gap-1.5 truncate text-sm text-dim">
                    <Pips colors={w.colors} size={8} />
                    {w.commander ?? w.deckName ?? ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-dim">{fmtDate(g.startedAt)}</span>
              </Link>
            ))}
          </Section>

          {f.format === 'all' && bySubFormat(games).length > 1 && (
            <CountSection
              title="Games by format"
              rows={bySubFormat(games).map((r) => ({ key: r.key, label: r.label, n: r.games }))}
            />
          )}

          {names.length >= 2 && <HeadToHead games={games} names={names} />}
        </div>
      )}
    </Page>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-dim">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-felt-2 px-2.5 py-2.5 text-sm text-bone"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-felt-2 px-3 py-3">
      <div className="text-xs text-dim">{label}</div>
      <div className="font-cond text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-cond text-2xl font-bold">{title}</h2>
      {note && <p className="mb-2 text-sm text-dim">{note}</p>}
      <div className={`flex flex-col rounded-xl bg-felt-2 p-2 ${note ? '' : 'mt-2'}`}>{children}</div>
    </section>
  );
}

/** one ranked row: label, then a win-rate bar with the fair-share mark */
function RateRow({ row, fair, sub, label, pips }: { row: Row; fair: number; sub?: string; label?: string; pips?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate font-semibold">
          {pips && row.colors && <Pips colors={row.colors} size={9} />}
          <span className="truncate">{label ?? row.label}</span>
        </div>
        {sub && <div className="truncate text-xs text-dim">{sub}</div>}
      </div>
      <div className="text-right">
        <span className="font-cond text-xl font-bold tabular-nums">{pct(row.rate)}</span>
        <span className="ml-1.5 text-xs text-dim tabular-nums">
          {row.wins}/{row.games}
        </span>
      </div>
      <div className="relative col-span-2 mt-1.5 h-1.5 rounded-full bg-felt-3" aria-hidden>
        <div className="h-full rounded-full bg-brass" style={{ width: `${Math.max(row.rate * 100, row.rate ? 2 : 0)}%` }} />
        {fair > 0 && <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-bone/60" style={{ left: `${fair * 100}%` }} />}
      </div>
    </div>
  );
}

function CountSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: string; n: number; per?: number }[];
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Section title={title}>
      {rows.length === 0 && <p className="px-2 py-2 text-sm text-dim">{empty ?? 'Nothing yet.'}</p>}
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-2">
          <span className="truncate font-semibold">{r.label}</span>
          <span className="text-right">
            <span className="font-cond text-xl font-bold tabular-nums">{r.n}</span>
            {r.per != null && <span className="ml-1.5 text-xs text-dim">{r.per.toFixed(1)} a game</span>}
          </span>
          <div className="col-span-2 mt-1.5 h-1.5 rounded-full bg-felt-3" aria-hidden>
            <div className="h-full rounded-full bg-brass" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </Section>
  );
}

function HeadToHead({ games, names }: { games: Parameters<typeof headToHead>[0]; names: string[] }) {
  const [a, setA] = useState(names[0]);
  const [b, setB] = useState(names[1]);
  const h = headToHead(games, a, b);
  return (
    <Section title="Head to head">
      <div className="grid grid-cols-2 gap-2 p-1">
        <Select label="Player" value={a} onChange={setA} options={names.map((n) => [n, n])} />
        <Select label="Against" value={b} onChange={setB} options={names.map((n) => [n, n])} />
      </div>
      {a === b ? (
        <p className="px-2 py-3 text-sm text-dim">Pick two different players.</p>
      ) : h.together === 0 ? (
        <p className="px-2 py-3 text-sm text-dim">
          {a} and {b} haven't played a saved game together.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 p-1 pt-3 text-center">
          <Tile label="Games together" value={String(h.together)} />
          <Tile label={`${a} won`} value={String(h.aWins)} />
          <Tile label={`${b} won`} value={String(h.bWins)} />
          <p className="col-span-3 px-1 pb-1 text-sm text-dim">
            {a} outlasted {b} in {h.aAhead} of {h.together} games.
          </p>
        </div>
      )}
    </Section>
  );
}
