import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportAll, importAll } from '../db';
import { Btn, Page, Pips, fmtDate } from '../ui';

const fmtLabel = { commander: 'Commander', constructed: 'Constructed', other: 'Other' };

export default function History() {
  const games = useLiveQuery(() => db.games.orderBy('startedAt').reverse().toArray(), []);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const doExport = async () => {
    const blob = new Blob([await exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spindown-games-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (f: File) => {
    try {
      const n = await importAll(await f.text());
      setMsg(`Imported ${n} games.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <Page title="Game history">
      <div className="mb-4 flex gap-2">
        <Btn onClick={doExport} disabled={!games?.length} className="flex-1 text-sm">
          Export backup
        </Btn>
        <Btn onClick={() => file.current?.click()} className="flex-1 text-sm">
          Import backup
        </Btn>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
        />
      </div>
      {msg && <p className="mb-4 rounded-lg bg-felt-2 px-3 py-2 text-sm">{msg}</p>}

      {games?.length === 0 && (
        <p className="rounded-xl bg-felt-2 px-4 py-5 text-dim">No saved games yet. Finish a game and choose Save game to record it.</p>
      )}

      <div className="flex flex-col gap-2">
        {games?.map((g) => (
          <Link key={g.id} to={`/history/${g.id}`} className="rounded-xl bg-felt-2 px-4 py-3 hover:bg-felt-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold">{g.winnerName ? `${g.winnerName} won` : 'Draw'}</span>
              <span className="shrink-0 text-sm text-dim">{fmtDate(g.startedAt)}</span>
            </div>
            <div className="mb-2 text-sm text-dim">
              {fmtLabel[g.format]}, {g.playerCount} players, {g.rounds} rounds, {g.durationMin} min
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {[...g.players]
                .sort((a, b) => a.turnOrder - b.turnOrder)
                .map((p) => (
                  <span key={p.seat} className={`flex items-center gap-1.5 ${p.result === 'win' ? 'text-brass-2' : 'text-bone/80'}`}>
                    <Pips colors={p.colors} size={8} />
                    {p.name}
                  </span>
                ))}
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
