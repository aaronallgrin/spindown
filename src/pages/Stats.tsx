import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  applyFilters,
  byColorCount,
  byIdentity,
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
import { CardNames } from '../components/CardName';
import StatsTabs from '../components/StatsTabs';
import { TrophyIcon } from '../components/Trophies';
import type { GameRecord } from '../types';
import { TROPHY_INFO, eggsFound, fmtSecs, roundSeconds, trophies } from '../eggs';

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

  if (all === undefined)
    return (
      <Page title="Stats">
        <StatsTabs active="stats" />
      </Page>
    );

  return (
    <Page title="Stats">
      <StatsTabs active="stats" />
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
            <Tile label="Avg rounds" value={s.avgRounds == null ? '–' : s.avgRounds.toFixed(1)} />
            <Tile label="Avg length" value={s.avgMinutes == null ? '–' : `${Math.round(s.avgMinutes)} min`} />
          </div>

          <Section
            title="Players"
            note={`Average place: 1 is a win, 2 is last one knocked out.${fair ? ` The tick on each bar is a fair share of wins, ${pct(fair)}.` : ''}`}
          >
            {byPlayer(games).map((r) => (
              <RateRow
                key={r.key}
                row={r}
                fair={fair}
                sub={`Average place ${(r.extra!.avgPlace as number).toFixed(1)}${(r.extra!.misplays as number) > 0 ? `, ${r.extra!.misplays} *` : ''}`}
              />
            ))}
          </Section>

          <Section title={isCmdr ? 'Commander win rate' : 'Deck win rate'} note="Most wins first. Tap a name to see the card.">
            {byDeck(forPlayer)
              .slice(0, 15)
              .map((r) => (
                <RateRow
                  key={r.key}
                  row={r}
                  fair={fair}
                  sub={r.extra!.pilots as string}
                  pips
                  label={isCmdr ? <CardNames text={r.label} /> : undefined}
                />
              ))}
          </Section>

          <Section title="Turn order" note="Win rate by position in the turn order.">
            {byTurnOrder(forPlayer).map((r) => (
              <RateRow key={r.key} row={r} fair={fair} label={`Went ${r.label}`} />
            ))}
          </Section>

          <Section title="Color identity win rate" note="Most wins first, then best win rate.">
            {byIdentity(forPlayer).map((r) => (
              <RateRow key={r.key} row={r} fair={fair} pips />
            ))}
          </Section>

          <Section title="Commander color win rate" note="By how many colors the commander has.">
            {byColorCount(forPlayer).map((r) => (
              <RateRow key={r.key} row={r} fair={fair} />
            ))}
          </Section>


          <CountSection title="How players went out" rows={outCauses(forPlayer)} />

          <CountSection
            title="Misplays *"
            rows={byPlayer(games)
              .map((r) => ({ key: r.key, label: r.label, n: r.extra!.misplays as number, per: (r.extra!.misplays as number) / r.games }))
              .filter((r) => r.n > 0)
              .sort((a, b) => b.n - a.n)}
            empty="Nobody has a * yet."
          />

          <RoundTimes games={games} />

          <TrophyCase games={games} />

          <Section title="Fastest wins">
            {fastestWins(f.player === 'all' ? games : games.filter((g) => g.winnerName === f.player)).map(({ g, w }) => (
              <Link key={g.id} to={`/history/${g.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-felt-3">
                <span className="w-16 shrink-0 font-cond text-lg font-bold text-brass">Round {g.rounds}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{w.name}</span>
                  <span className="flex items-center gap-1.5 truncate text-sm text-dim">
                    <Pips colors={w.colors} size={8} />
                    {w.commander ? <CardNames text={[w.commander, w.partner].filter(Boolean).join(' + ')} /> : (w.deckName ?? '')}
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
function RateRow({ row, fair, sub, label, pips }: { row: Row; fair: number; sub?: string; label?: ReactNode; pips?: boolean }) {
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

function RoundTimes({ games }: { games: GameRecord[] }) {
  const rows = games.flatMap((g) => roundSeconds(g).map((s, i) => ({ g, round: i + 1, s }))).filter((r) => r.s > 0);
  if (!rows.length) return null;
  const avg = rows.reduce((a, r) => a + r.s, 0) / rows.length;
  const longest = [...rows].sort((a, b) => b.s - a.s).slice(0, 3);
  // average time by round number, first 10 rounds
  const byRound = Array.from({ length: 10 }, (_, i) => {
    const r = rows.filter((x) => x.round === i + 1);
    return { round: i + 1, n: r.length, avg: r.length ? r.reduce((a, x) => a + x.s, 0) / r.length : 0 };
  }).filter((r) => r.n);
  const max = Math.max(...byRound.map((r) => r.avg));
  return (
    <Section title="Round times" note={`An average round takes ${fmtSecs(avg)}.`}>
      {byRound.map((r) => (
        <div key={r.round} className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 px-2 py-1.5">
          <span className="text-sm text-dim">Round {r.round}</span>
          <div className="h-1.5 rounded-full bg-felt-3" aria-hidden>
            <div className="h-full rounded-full bg-brass" style={{ width: `${(r.avg / max) * 100}%` }} />
          </div>
          <span className="text-right font-cond text-lg font-bold tabular-nums">{fmtSecs(r.avg)}</span>
        </div>
      ))}
      <div className="mt-2 border-t border-line px-2 pt-2 text-sm text-dim">
        Longest rounds:{' '}
        {longest.map((l, i) => (
          <Link key={i} to={`/history/${l.g.id}`} className="text-bone hover:text-brass">
            {fmtSecs(l.s)} (round {l.round}, {fmtDate(l.g.startedAt)}){i < longest.length - 1 ? ', ' : ''}
          </Link>
        ))}
      </div>
    </Section>
  );
}

function TrophyCase({ games }: { games: GameRecord[] }) {
  const won = games.flatMap((g) => trophies(g));
  const secrets = new Map<string, Set<string>>();
  for (const g of games)
    for (const e of eggsFound(g)) {
      if (!e.name) continue;
      const s = secrets.get(e.name) ?? new Set();
      s.add(e.id);
      secrets.set(e.name, s);
    }
  if (!won.length && !secrets.size) return null;
  const ids = Object.keys(TROPHY_INFO).filter((id) => won.some((t) => t.id === id));
  return (
    <Section title="Trophy case">
      {ids.map((id) => {
        const holders = new Map<string, number>();
        won.filter((t) => t.id === id).forEach((t) => holders.set(t.name ?? 'The table', (holders.get(t.name ?? 'The table') ?? 0) + 1));
        return (
          <div key={id} className="flex items-start gap-3 px-2 py-2">
            <TrophyIcon size={22} />
            <div className="min-w-0">
              <div className="font-semibold">{TROPHY_INFO[id].title}</div>
              <div className="text-sm text-dim">
                {[...holders.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([n, c]) => (c > 1 ? `${n} ×${c}` : n))
                  .join(', ')}
              </div>
            </div>
          </div>
        );
      })}
      {secrets.size > 0 && (
        <div className="mt-1 border-t border-line px-2 pt-2 text-sm text-dim">
          Secrets found:{' '}
          {[...secrets.entries()]
            .sort((a, b) => b[1].size - a[1].size)
            .map(([n, s]) => `${n} ${s.size}`)
            .join(', ')}
        </div>
      )}
    </Section>
  );
}
