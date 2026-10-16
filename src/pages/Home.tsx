import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useStore } from '../store';
import { makeConfig } from '../game';
import { defaultLayout, layoutsFor } from '../layouts';
import { SUB_FORMATS, type Format } from '../types';
import ConfirmBtn from '../components/ConfirmBtn';
import LayoutThumb from '../components/LayoutThumb';
import { D20, Pips, Segmented, fmtDate } from '../ui';

const PREFS = 'spindown.newGame';
type Prefs = { format: Format; players: number; layoutId: string; sub: Record<string, string> };

const defaultPlayers = (f: Format) => (f === 'commander' ? 4 : 2);

const loadPrefs = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null');
    if (p && layoutsFor(p.players, 'portrait').some((l) => l.id === p.layoutId)) return { ...p, sub: p.sub ?? {} };
  } catch {
    /* ignore */
  }
  return { format: 'commander', players: 4, layoutId: 'p4-sides', sub: {} };
};

export default function Home() {
  const { game, start, discard } = useStore();
  const nav = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const recent = useLiveQuery(() => db.games.orderBy('startedAt').reverse().limit(3).toArray(), []);
  const count = useLiveQuery(() => db.games.count(), []);
  const layouts = layoutsFor(prefs.players, 'portrait');
  const subs = prefs.format === 'commander' ? [] : SUB_FORMATS[prefs.format];
  const subFormat = subs.length ? (subs.find((s) => s.name === prefs.sub[prefs.format]) ?? subs[0]).name : undefined;

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    if (patch.format && patch.format !== prefs.format) next.players = defaultPlayers(patch.format);
    if (next.players !== prefs.players) next.layoutId = defaultLayout(next.players, 'portrait').id;
    setPrefs(next);
    try {
      localStorage.setItem(PREFS, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const begin = () => {
    if (game) discard();
    start(makeConfig(prefs.format, subFormat, prefs.players, prefs.layoutId));
    nav('/play');
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-8 pt-10">
      <div className="mb-8 flex items-center gap-4">
        <D20 value="20" size={64} />
        <div>
          <h1 className="flex items-center font-cond text-5xl font-bold leading-none tracking-wide">
            <span className="text-bone">Spin</span>
            <span className="ml-1 rounded-md bg-brass px-1.5 pb-0.5 text-felt">down</span>
          </h1>
          <p className="mt-1.5 text-sm text-dim">Created by aaronallgrin</p>
        </div>
      </div>

      {game && (
        <button
          onClick={() => nav('/play')}
          className="mb-4 rounded-xl border border-brass/70 bg-felt-2 px-5 py-4 text-left transition hover:bg-felt-3"
        >
          <div className="font-cond text-2xl font-semibold text-brass">Resume game</div>
          <div className="text-sm text-dim">
            {game.phase === 'seating'
              ? 'Still choosing seats'
              : `${game.config.players.map((p) => p.name).join(', ')}${game.round > 0 ? `, round ${game.round}` : ''}`}
          </div>
        </button>
      )}

      <section className="mb-8 flex flex-col gap-3 rounded-2xl bg-felt-2 p-4">
        <Segmented
          label="Format"
          value={prefs.format}
          onChange={(format) => update({ format })}
          options={[
            { v: 'commander', label: 'Commander' },
            { v: 'constructed', label: 'Constructed' },
            { v: 'other', label: 'Other' },
          ]}
        />
        <div className="flex items-center justify-between rounded-lg bg-felt-3 px-3 py-2">
          <span className="text-dim">Players</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Fewer players"
              disabled={prefs.players <= 2}
              onClick={() => update({ players: prefs.players - 1 })}
              className="h-10 w-10 rounded-md text-2xl text-dim hover:text-bone disabled:opacity-30"
            >
              −
            </button>
            <span className="w-8 text-center font-cond text-3xl font-bold tabular-nums">{prefs.players}</span>
            <button
              type="button"
              aria-label="More players"
              disabled={prefs.players >= 6}
              onClick={() => update({ players: prefs.players + 1 })}
              className="h-10 w-10 rounded-md text-2xl text-dim hover:text-bone disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
        {subs.length > 0 && (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format">
            {subs.map((s) => (
              <button
                key={s.name}
                type="button"
                role="radio"
                aria-checked={s.name === subFormat}
                onClick={() => update({ sub: { ...prefs.sub, [prefs.format]: s.name } })}
                className={`rounded-lg px-2 py-2.5 text-sm transition ${
                  s.name === subFormat ? 'bg-brass font-semibold text-felt' : 'bg-felt-3 text-bone hover:bg-line'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        {layouts.length > 1 && (
          <div className="flex gap-3">
            {layouts.map((l) => (
              <LayoutThumb key={l.id} layout={l} selected={l.id === prefs.layoutId} onClick={() => update({ layoutId: l.id })} />
            ))}
          </div>
        )}
        <ConfirmBtn
          variant="primary"
          skip={!game}
          onConfirm={begin}
          confirmLabel="Tap again to drop the unfinished game"
          className="mt-1 py-4 font-cond text-3xl font-bold"
        >
          New game
        </ConfirmBtn>
      </section>

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-cond text-xl font-semibold">Recent games</h2>
        <Link to="/history" className="text-sm text-dim hover:text-bone">
          All {count ?? ''} games
        </Link>
      </div>
      {recent && recent.length === 0 && (
        <p className="rounded-xl bg-felt-2 px-4 py-5 text-dim">Finished games show up here once you save them.</p>
      )}
      <div className="flex flex-col gap-2">
        {recent?.map((g) => {
          const w = g.players.find((p) => p.result === 'win');
          return (
            <Link key={g.id} to={`/history/${g.id}`} className="rounded-xl bg-felt-2 px-4 py-3 hover:bg-felt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{w ? `${w.name} won` : 'Draw'}</span>
                <span className="text-sm text-dim">{fmtDate(g.startedAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-dim">
                {w && <Pips colors={w.colors} size={10} />}
                <span className="truncate">{w?.commander ?? w?.deckName ?? ''}</span>
                <span className="ml-auto shrink-0">round {g.rounds}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-auto pt-10 text-center text-xs text-dim">Version {__BUILD_DATE__}</p>
    </div>
  );
}
