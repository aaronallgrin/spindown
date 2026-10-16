import { useEffect, useRef, useState } from 'react';
import type { Database } from 'sql.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { EXAMPLES, SCHEMA, buildDb } from '../sql';
import { Btn, Page } from '../ui';

const LAST = 'spindown.lastQuery';

export default function Query() {
  const games = useLiveQuery(() => db.games.toArray(), []);
  const sqlDb = useRef<Database | null>(null);
  const [ready, setReady] = useState(false);
  const [sql, setSql] = useState(() => {
    try {
      return localStorage.getItem(LAST) || EXAMPLES[0].sql;
    } catch {
      return EXAMPLES[0].sql;
    }
  });
  const [res, setRes] = useState<{ columns: string[]; values: unknown[][] }[] | null>(null);
  const [err, setErr] = useState('');
  const [showSchema, setShowSchema] = useState(false);

  useEffect(() => {
    if (!games) return;
    let alive = true;
    setReady(false);
    buildDb(games)
      .then((d) => {
        if (!alive) return d.close();
        sqlDb.current?.close();
        sqlDb.current = d;
        setReady(true);
      })
      .catch((e) => setErr(`The query engine could not start: ${(e as Error).message}`));
    return () => {
      alive = false;
    };
  }, [games]);

  const run = (text = sql) => {
    if (!sqlDb.current) return;
    try {
      localStorage.setItem(LAST, text);
    } catch {
      /* ignore */
    }
    try {
      setErr('');
      setRes(sqlDb.current.exec(text));
    } catch (e) {
      setRes(null);
      setErr((e as Error).message);
    }
  };

  const [asked, setAsked] = useState<string | null>(null);
  const [own, setOwn] = useState(false);

  const results = (
    <>
      {err && <p className="mt-3 rounded-lg bg-blood/15 p-3 text-sm text-bone">{err}</p>}
      {res && res.length === 0 && !err && <p className="mt-3 text-dim">No games answer that yet.</p>}
      {res?.map((r, i) => (
        <div key={i} className="mt-3 max-h-[60vh] overflow-auto rounded-lg bg-felt">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="sticky top-0 bg-felt-3">
              <tr>
                {r.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {pretty(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.values.map((row, j) => (
                <tr key={j} className="border-t border-line/60">
                  {row.map((v, k) => (
                    <td key={k} className={`whitespace-nowrap px-3 py-2 ${typeof v === 'number' ? 'text-right' : ''}`}>
                      {v == null ? <span className="text-dim">–</span> : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );

  return (
    <Page title="Query">
      <p className="mb-4 text-sm text-dim">
        Tap a question to answer it from your games. {games ? `${games.length} saved games.` : ''}
      </p>

      <div className="flex flex-col gap-2">
        {EXAMPLES.map((x) => (
          <div key={x.name} className={`rounded-xl bg-felt-2 ${asked === x.name ? 'p-3 ring-1 ring-brass/60' : ''}`}>
            <button
              disabled={!ready}
              onClick={() => {
                if (asked === x.name) return setAsked(null);
                setAsked(x.name);
                setOwn(false);
                setSql(x.sql);
                run(x.sql);
              }}
              className={`w-full text-left font-semibold ${asked === x.name ? 'text-brass' : 'px-4 py-3 hover:text-brass'}`}
            >
              {x.name}
            </button>
            {asked === x.name && results}
          </div>
        ))}
      </div>

      <div className="mt-10">
        {!own ? (
          <button
            onClick={() => {
              setOwn(true);
              setAsked(null);
              setRes(null);
              setErr('');
            }}
            className="text-sm text-dim hover:text-bone"
          >
            Write your own question (advanced)
          </button>
        ) : (
          <div>
            <textarea
              id="sql"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={6}
              className="w-full rounded-lg bg-felt-2 p-3 font-mono text-[13px] leading-relaxed"
            />
            <div className="mt-2 flex gap-2">
              <Btn variant="primary" onClick={() => run()} disabled={!ready} className="flex-1">
                Run
              </Btn>
              <Btn onClick={() => setShowSchema((x) => !x)}>{showSchema ? 'Hide tables' : 'Tables'}</Btn>
              <Btn onClick={() => setOwn(false)}>Close</Btn>
            </div>
            {showSchema && (
              <pre className="mt-3 overflow-x-auto rounded-lg bg-felt-2 p-3 text-xs leading-relaxed text-dim">{SCHEMA}</pre>
            )}
            {results}
          </div>
        )}
      </div>
    </Page>
  );
}

/** win_pct -> Win %, commander_damage -> Commander damage */
function pretty(c: string) {
  const m: Record<string, string> = { win_pct: 'Win %', per_game: 'Per game', avg_minutes: 'Avg min', longest_minutes: 'Longest min' };
  if (m[c]) return m[c];
  const t = c.replace(/_/g, ' ');
  return t[0].toUpperCase() + t.slice(1);
}
