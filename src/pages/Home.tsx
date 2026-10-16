import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useStore } from '../store';
import { D20, Pips, fmtDate } from '../ui';

export default function Home() {
  const { game } = useStore();
  const nav = useNavigate();
  const recent = useLiveQuery(() => db.games.orderBy('startedAt').reverse().limit(3).toArray(), []);
  const count = useLiveQuery(() => db.games.count(), []);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-10 pt-10">
      <div className="mb-10 flex items-center gap-4">
        <D20 value="20" size={64} />
        <div>
          <h1 className="flex items-center font-cond text-5xl font-bold leading-none tracking-wide">
            <span className="text-bone">Spin</span>
            <span className="ml-1 rounded-md bg-brass px-1.5 pb-0.5 text-felt">down</span>
          </h1>
          <p className="mt-1 text-dim">Life, turns and the record of every game.</p>
        </div>
      </div>

      {game && (
        <button
          onClick={() => nav('/play')}
          className="mb-3 rounded-xl border border-brass/60 bg-felt-2 px-5 py-4 text-left transition hover:bg-felt-3"
        >
          <div className="font-cond text-2xl font-semibold text-brass-2">Resume game</div>
          <div className="text-sm text-dim">
            {game.config.players.map((p) => p.name || '—').join(', ')}
            {game.round > 0 && `, round ${game.round}`}
          </div>
        </button>
      )}

      <Link
        to="/setup"
        className="mb-8 rounded-xl bg-brass px-5 py-5 text-felt transition hover:bg-brass-2"
      >
        <div className="font-cond text-3xl font-bold">New game</div>
        <div className="text-sm opacity-80">Pick players, decks and seats</div>
      </Link>

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-cond text-xl font-semibold">Recent games</h2>
        <Link to="/history" className="text-sm text-dim hover:text-bone">
          All {count ?? ''} games
        </Link>
      </div>
      {recent && recent.length === 0 && (
        <p className="rounded-xl bg-felt-2 px-4 py-5 text-dim">
          Finished games land here. Play one and its result, turn count and eliminations are saved on this phone.
        </p>
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
    </div>
  );
}
