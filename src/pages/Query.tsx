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

  return (
    <Page title="Query">
      <p className="mb-3 text-sm text-dim">
        Ask your game history anything with SQL. {games ? `${games.length} saved games loaded.` : ''}
      </p>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {EXAMPLES.map((x) => (
          <button
            key={x.name}
            onClick={() => {
              setSql(x.sql);
              run(x.sql);
            }}
            className="shrink-0 rounded-full bg-felt-2 px-3 py-1.5 text-sm hover:bg-felt-3"
          >
            {x.name}
          </button>
        ))}
      </div>

      <textarea
        id="sql"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run();
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={7}
        className="w-full rounded-lg bg-felt-2 p-3 font-mono text-[13px] leading-relaxed"
      />
      <div className="mt-2 flex gap-2">
        <Btn variant="primary" onClick={() => run()} disabled={!ready} className="flex-1">
          {ready ? 'Run query' : 'Loading'}
        </Btn>
        <Btn onClick={() => setShowSchema((x) => !x)}>{showSchema ? 'Hide tables' : 'Tables'}</Btn>
      </div>

      {showSchema && (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-felt-2 p-3 text-xs leading-relaxed text-dim">{SCHEMA}</pre>
      )}

      {err && <p className="mt-4 rounded-lg bg-blood/15 p-3 text-sm text-bone">{err}</p>}

      {res && res.length === 0 && !err && <p className="mt-4 text-dim">The query ran and returned no rows.</p>}

      {res?.map((r, i) => (
        <div key={i} className="mt-4">
          <div className="mb-1 text-xs text-dim">{r.values.length} rows</div>
          <div className="max-h-[60vh] overflow-auto rounded-lg bg-felt-2">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="sticky top-0 bg-felt-3">
                <tr>
                  {r.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {c}
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
        </div>
      ))}
    </Page>
  );
}
